"""
ingest_knowledge.py — Pipeline d'ingestion du corpus de formation par poste.

Outil ponctuel à lancer en local (PAS dans un container, PAS lié au backend).
Remplit la table Supabase `role_knowledge_chunks` à partir de documents
(PDF, Markdown, texte) rangés dans un dossier par métier.

Usage:
    python ingest_knowledge.py --role devops --folder ./knowledge/devops
    python ingest_knowledge.py --role devops --folder ./knowledge/devops --clear

Structure attendue du dossier :
    knowledge/
      devops/
        kubernetes_docs.pdf
        ci_cd_best_practices.md
        terraform_intro.txt
      data_scientist/
        pandas_guide.pdf
        ...

Chunking : découpage par ~800 tokens avec 100 tokens d'overlap.

Setup requis (une seule fois) :
    python -m venv venv
    venv\\Scripts\\activate
    pip install voyageai pypdf tiktoken sqlalchemy psycopg2-binary python-dotenv

Variables d'environnement (fichier .env dans le même dossier que ce script) :
    DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres
    VOYAGE_API_KEY=pa-xxxxx
"""

import os
import time
import argparse
from dotenv import load_dotenv

load_dotenv()

import tiktoken
from pypdf import PdfReader
from sqlalchemy import create_engine, text
import voyageai
from voyageai.error import RateLimitError

# ── Config ──────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL")
VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
EMBEDDING_MODEL = "voyage-3"

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set — check your .env file in the tools/ folder")
if not VOYAGE_API_KEY:
    raise RuntimeError("VOYAGE_API_KEY is not set — check your .env file in the tools/ folder")

engine = create_engine(DATABASE_URL)
vo = voyageai.Client(api_key=VOYAGE_API_KEY)
tokenizer = tiktoken.get_encoding("cl100k_base")

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

# Sans moyen de paiement enregistré sur Voyage : limite réduite à 3 req/min et
# 10K tokens/min. EMBED_BATCH_SIZE reste petit pour rester sous la limite TPM
# par appel (chunks ~800 tokens), RATE_LIMIT_DELAY_SECONDS espace les appels
# pour rester sous la limite RPM même quand tout se passe bien.
EMBED_BATCH_SIZE = 8
RATE_LIMIT_DELAY_SECONDS = 21
RATE_LIMIT_RETRY_WAIT_SECONDS = 65
MAX_EMBED_RETRIES = 6


def embed_with_retry(batch: list, input_type: str = "document") -> list:
    """Appelle vo.embed avec retry/backoff sur RateLimitError.

    Sans carte bancaire sur le compte Voyage, le tier gratuit est limité à
    3 req/min. Si la limite est quand même atteinte, on attend et on
    réessaie au lieu de laisser planter tout le script (et perdre le travail
    déjà fait sur les fichiers précédents).
    """
    for attempt in range(1, MAX_EMBED_RETRIES + 1):
        try:
            result = vo.embed(batch, model=EMBEDDING_MODEL, input_type=input_type)
            return result.embeddings
        except RateLimitError:
            if attempt == MAX_EMBED_RETRIES:
                raise
            print(f"  ⏳ Rate limited by Voyage (tentative {attempt}/{MAX_EMBED_RETRIES}) "
                  f"— attente {RATE_LIMIT_RETRY_WAIT_SECONDS}s avant retry...")
            time.sleep(RATE_LIMIT_RETRY_WAIT_SECONDS)


# ── Extraction de texte ────────────────────────────────────────────────────

def extract_text(filepath: str) -> str:
    ext = filepath.lower().split(".")[-1]

    if ext == "pdf":
        reader = PdfReader(filepath)
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    elif ext in ("md", "txt"):
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()

    else:
        print(f"  ⚠️  Skipping unsupported file type: {filepath}")
        return ""


# ── Chunking ────────────────────────────────────────────────────────────────

def chunk_text(text_content: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list:
    tokens = tokenizer.encode(text_content)
    chunks = []

    start = 0
    while start < len(tokens):
        end = start + chunk_size
        chunk_tokens = tokens[start:end]
        chunk_str = tokenizer.decode(chunk_tokens).strip()
        if chunk_str:
            chunks.append(chunk_str)
        start += chunk_size - overlap

    return chunks


# ── Nettoyage avant réingestion (option --clear) ──────────────────────────

def clear_role(role: str):
    with engine.connect() as conn:
        result = conn.execute(
            text("DELETE FROM role_knowledge_chunks WHERE role = :role"),
            {"role": role}
        )
        conn.commit()
    print(f"🗑️  Cleared existing knowledge for role '{role}'")


# ── Ingestion ───────────────────────────────────────────────────────────────

def ingest_file(filepath: str, role: str, category: str) -> int:
    filename = os.path.basename(filepath)
    print(f"📄 Processing {filename}...")

    raw_text = extract_text(filepath)
    if not raw_text.strip():
        print(f"  ⚠️  No text extracted, skipping")
        return 0

    chunks = chunk_text(raw_text)
    print(f"  → {len(chunks)} chunks")

    if not chunks:
        return 0

    # Embed en petits batches, espacés pour respecter les rate limits Voyage
    embeddings = []
    for i in range(0, len(chunks), EMBED_BATCH_SIZE):
        batch = chunks[i:i + EMBED_BATCH_SIZE]
        embeddings.extend(embed_with_retry(batch, input_type="document"))
        # Pas de pause après le tout dernier batch du fichier — inutile d'attendre
        # si rien d'autre ne suit immédiatement.
        if i + EMBED_BATCH_SIZE < len(chunks):
            time.sleep(RATE_LIMIT_DELAY_SECONDS)

    # Insert en base
    with engine.connect() as conn:
        for chunk, embedding in zip(chunks, embeddings):
            conn.execute(text("""
                INSERT INTO role_knowledge_chunks (role, source, category, content, embedding)
                VALUES (:role, :source, :category, :content, :embedding)
            """), {
                "role": role,
                "source": filename,
                "category": category,
                "content": chunk,
                "embedding": str(embedding)
            })
        conn.commit()

    print(f"  ✓ {len(chunks)} chunks inserted")
    return len(chunks)


def ingest_folder(role: str, folder: str):
    if not os.path.isdir(folder):
        print(f"❌ Folder not found: {folder}")
        return

    total = 0
    files_processed = 0

    filepaths = [
        os.path.join(folder, f) for f in sorted(os.listdir(folder))
        if os.path.isfile(os.path.join(folder, f))
    ]

    for idx, filepath in enumerate(filepaths):
        total += ingest_file(filepath, role, category="general")
        files_processed += 1
        # Espace les appels entre fichiers aussi — sinon le dernier batch d'un
        # fichier et le premier du suivant se suivent sans pause.
        if idx < len(filepaths) - 1:
            time.sleep(RATE_LIMIT_DELAY_SECONDS)

    if files_processed == 0:
        print(f"⚠️  No files found in {folder}")
        return

    print(f"\n✅ Done — {total} total chunks ingested for role '{role}' ({files_processed} files)")


# ── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest training documents into the role knowledge base.")
    parser.add_argument("--role", required=True, help="Role identifier, e.g. devops, data_scientist, customer_support")
    parser.add_argument("--folder", required=True, help="Folder containing source documents (.pdf, .md, .txt)")
    parser.add_argument("--clear", action="store_true", help="Delete existing chunks for this role before ingesting")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"  Ingesting knowledge for role: {args.role}")
    print(f"  Source folder: {args.folder}")
    print(f"{'='*60}\n")

    if args.clear:
        clear_role(args.role)

    ingest_folder(args.role, args.folder)
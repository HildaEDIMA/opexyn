"""
retrieval.py — Retrieval sémantique sur deux corpus distincts :

1. role_knowledge_chunks — connaissance de FORMATION du poste (DevOps, Data
   Science, Support...), partagée entre tous les agents du même rôle.
   Recherche par similarité vectorielle (pgvector + Voyage embeddings).

2. agent_knowledge — connaissance propre au client/agent (paragraphes
   métiers courts, règles d'escalade, etc.) — gardé en retrieval simple
   par mots-clés, suffisant pour un petit volume.
"""

from sqlalchemy import text
from config import CLIENT_ID, AGENT_ID, AGENT_NAME, AGENT_ROLE
from embeddings import embed_query
from db import engine


class RetrievalMemory:
    def __init__(self):
        self.client_id = CLIENT_ID
        self.agent_id = AGENT_ID
        self.role = AGENT_ROLE
        self._setup_client_table()

    # ── Setup ────────────────────────────────────────────────────────────────

    def _setup_client_table(self):
        try:
            with engine.connect() as conn:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS agent_knowledge (
                        id SERIAL PRIMARY KEY,
                        agent_id VARCHAR NOT NULL,
                        client_id VARCHAR NOT NULL,
                        content TEXT NOT NULL,
                        category VARCHAR DEFAULT 'general',
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.commit()
        except Exception as e:
            print(f"[Retrieval] Client table setup error: {e}")

    # ── Connaissance de FORMATION du poste (sémantique, pgvector) ────────────

    def retrieve_role_knowledge(self, query: str, top_k: int = 5) -> str:
        """Recherche par similarité vectorielle dans le corpus de formation du rôle."""
        try:
            query_embedding = embed_query(query)

            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT content, source, category,
                           1 - (embedding <=> :query_embedding) AS similarity
                    FROM role_knowledge_chunks
                    WHERE role = :role
                    ORDER BY embedding <=> :query_embedding
                    LIMIT :top_k
                """), {
                    "query_embedding": str(query_embedding),
                    "role": self.role,
                    "top_k": top_k
                })
                rows = result.fetchall()

            if not rows:
                return f"No training knowledge found for role '{self.role}'."

            formatted = []
            for i, row in enumerate(rows):
                content, source, category, similarity = row
                formatted.append(f"[{i+1}] ({category}, source: {source or 'unknown'})\n{content}")

            return "\n\n".join(formatted)

        except Exception as e:
            print(f"[Retrieval] role_knowledge error: {e}")
            return "Knowledge retrieval error."

    # ── Connaissance CLIENT (mots-clés, petit volume) ────────────────────────

    def add_client_knowledge(self, content: str, category: str = "general"):
        try:
            with engine.connect() as conn:
                conn.execute(text("""
                    INSERT INTO agent_knowledge (agent_id, client_id, content, category)
                    VALUES (:agent_id, :client_id, :content, :category)
                """), {
                    "agent_id": self.agent_id,
                    "client_id": self.client_id,
                    "content": content,
                    "category": category
                })
                conn.commit()
        except Exception as e:
            print(f"[Retrieval] add_client_knowledge error: {e}")

    def retrieve_client_knowledge(self, query: str, top_k: int = 4) -> str:
        try:
            query_lower = query.lower()
            keywords = [w for w in query_lower.split() if len(w) > 3]

            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT content, category FROM agent_knowledge
                    WHERE agent_id = :agent_id AND client_id = :client_id
                    ORDER BY created_at DESC
                    LIMIT 50
                """), {"agent_id": self.agent_id, "client_id": self.client_id})
                rows = result.fetchall()

            if not rows:
                return "No client-specific knowledge found."

            scored = []
            for row in rows:
                content_lower = row[0].lower()
                score = sum(1 for kw in keywords if kw in content_lower)
                scored.append((score, row[0]))

            scored.sort(reverse=True)
            top = [content for score, content in scored[:top_k] if score > 0]

            if not top:
                top = [row[0] for row in rows[:top_k]]

            return "\n\n".join([f"[{i+1}] {c}" for i, c in enumerate(top)])

        except Exception as e:
            print(f"[Retrieval] client_knowledge error: {e}")
            return "Retrieval error."

    # ── Recherche combinée — utilisée par le tool search_knowledge ───────────

    def search(self, query: str, top_k_role: int = 4, top_k_client: int = 3) -> str:
        """Combine les deux corpus pour une requête donnée."""
        role_results = self.retrieve_role_knowledge(query, top_k_role)
        client_results = self.retrieve_client_knowledge(query, top_k_client)

        return (
            f"=== TRAINING KNOWLEDGE ({self.role}) ===\n{role_results}\n\n"
            f"=== CLIENT-SPECIFIC KNOWLEDGE ===\n{client_results}"
        )


retrieval_memory = RetrievalMemory()
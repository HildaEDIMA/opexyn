"""
embeddings.py — Wrapper autour de l'API Voyage pour générer des embeddings.
"""

import voyageai
from config import VOYAGE_API_KEY, EMBEDDING_MODEL

_client = voyageai.Client(api_key=VOYAGE_API_KEY)


def embed_query(text: str) -> list:
    """Embed une requête (ce que l'agent recherche)."""
    result = _client.embed([text], model=EMBEDDING_MODEL, input_type="query")
    return result.embeddings[0]


def embed_documents(texts: list) -> list:
    """Embed une liste de chunks de documents (pour l'ingestion)."""
    # Voyage limite le batch — on découpe par sécurité
    all_embeddings = []
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        result = _client.embed(batch, model=EMBEDDING_MODEL, input_type="document")
        all_embeddings.extend(result.embeddings)
    return all_embeddings
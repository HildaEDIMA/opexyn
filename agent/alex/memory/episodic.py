import json
from datetime import datetime
from sqlalchemy import text
from config import AGENT_ID, CLIENT_ID
from db import engine


class EpisodicMemory:
    def __init__(self):
        self.agent_id = AGENT_ID
        self.client_id = CLIENT_ID

    def save(self, memory_type: str, content: str, importance: int = 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("""
                    INSERT INTO episodic_memories 
                    (agent_id, client_id, memory_type, content, importance, created_at)
                    VALUES (:agent_id, :client_id, :memory_type, :content, :importance, :created_at)
                """), {
                    "agent_id": self.agent_id,
                    "client_id": self.client_id,
                    "memory_type": memory_type,
                    "content": content,
                    "importance": importance,
                    "created_at": datetime.utcnow()
                })
                conn.commit()
            print(f"[Memory] Souvenir sauvegardé: {memory_type}")
        except Exception as e:
            print(f"[Memory] save failed: {e}")

    def get_recent(self, limit: int = 20) -> list:
        try:
            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT memory_type, content, importance, created_at
                    FROM episodic_memories
                    WHERE agent_id = :agent_id AND client_id = :client_id
                    ORDER BY importance DESC, created_at DESC
                    LIMIT :limit
                """), {
                    "agent_id": self.agent_id,
                    "client_id": self.client_id,
                    "limit": limit
                })
                rows = result.fetchall()
                return [
                    {
                        "type": row[0],
                        "content": row[1],
                        "importance": row[2],
                        "created_at": str(row[3])
                    }
                    for row in rows
                ]
        except Exception as e:
            print(f"[Memory] get_recent failed: {e}")
            return []

    def get_by_type(self, memory_type: str) -> list:
        try:
            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT content, importance, created_at
                    FROM episodic_memories
                    WHERE agent_id = :agent_id 
                    AND client_id = :client_id
                    AND memory_type = :memory_type
                    ORDER BY created_at DESC
                    LIMIT 10
                """), {
                    "agent_id": self.agent_id,
                    "client_id": self.client_id,
                    "memory_type": memory_type
                })
                rows = result.fetchall()
                return [{"content": row[0], "importance": row[1]} for row in rows]
        except Exception as e:
            print(f"[Memory] get_by_type failed: {e}")
            return []

    def format_for_context(self) -> str:
        memories = self.get_recent(15)
        if not memories:
            return "No episodic memories yet."

        formatted = []
        for m in memories:
            priority = "⚠️ IMPORTANT" if m["importance"] >= 2 else "→"
            formatted.append(f"{priority} [{m['type']}] {m['content']}")

        return "\n".join(formatted)


episodic_memory = EpisodicMemory()
"""
permissions.py — Lecture des permissions/autonomie de l'agent depuis la DB.

Lu à chaque exécution d'instruction (pas mis en cache), car le client peut
changer les règles d'autonomie à tout moment depuis le dashboard sans
redémarrer le container.
"""

from sqlalchemy import text
from config import AGENT_ID
from db import engine


def get_permissions() -> dict:
    """Retourne {tools, rules, autonomy_mode} — valeurs par défaut sûres si absent."""
    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT permissions FROM agent_instances WHERE id = :aid
            """), {"aid": AGENT_ID}).fetchone()
        if row and row[0]:
            perms = row[0]
            return {
                "tools": perms.get("tools", []),
                "rules": perms.get("rules", {}),
                "autonomy_mode": perms.get("autonomy_mode", "learning"),
            }
    except Exception as e:
        print(f"[Permissions] fetch failed: {e}")

    # Par défaut : le plus prudent possible si jamais la lecture échoue
    return {"tools": [], "rules": {}, "autonomy_mode": "learning"}
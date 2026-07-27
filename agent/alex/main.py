import asyncio
import sys
import uvicorn
from datetime import datetime, timedelta
from api.server import app
from agent_loop import agent_runtime
from browser.screenshot import streamer
from config import AGENT_ID, AGENT_NAME
from db import engine
from sqlalchemy import text

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

LEARNING_MODE_DURATION_DAYS = 7
LEARNING_MODE_CHECK_INTERVAL_SECONDS = 3600  # vérifie une fois par heure


async def start_api():
    print("[Main] Starting API server...", flush=True)
    config = uvicorn.Config(app, host="0.0.0.0", port=8001, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


async def start_agent():
    print("[Main] Starting agent loop...", flush=True)
    await agent_runtime.run()


async def learning_mode_watcher():
    """Bascule automatiquement l'agent de 'learning' à 'autonomous' après 7 jours."""
    while True:
        try:
            with engine.connect() as conn:
                row = conn.execute(text("""
                    SELECT permissions, learning_mode_started_at
                    FROM agent_instances WHERE id = :aid
                """), {"aid": AGENT_ID}).fetchone()

            if row and row[0]:
                permissions = row[0]
                started_at = row[1]

                if permissions.get("autonomy_mode") == "learning" and started_at:
                    elapsed = datetime.utcnow() - started_at
                    if elapsed >= timedelta(days=LEARNING_MODE_DURATION_DAYS):
                        permissions["autonomy_mode"] = "autonomous"
                        with engine.connect() as conn:
                            conn.execute(text("""
                                UPDATE agent_instances SET permissions = :p WHERE id = :aid
                            """), {"p": permissions, "aid": AGENT_ID})
                            conn.commit()
                        streamer.log_action(
                            f"{AGENT_NAME} has graduated from learning mode to autonomous mode.",
                            "done"
                        )
                        print(f"[{AGENT_NAME}] Learning mode expired — switched to autonomous", flush=True)

        except Exception as e:
            print(f"[{AGENT_NAME}] learning_mode_watcher error: {e}", flush=True)

        await asyncio.sleep(LEARNING_MODE_CHECK_INTERVAL_SECONDS)


async def main():
    print("=" * 50, flush=True)
    print("  AI EMPLOYEE — Opexyn Platform", flush=True)
    print("=" * 50, flush=True)

    await asyncio.gather(
        start_api(),
        start_agent(),
        learning_mode_watcher(),
    )


if __name__ == "__main__":
    print("[Main] Booting...", flush=True)
    asyncio.run(main())
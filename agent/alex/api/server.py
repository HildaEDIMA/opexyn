"""
server.py — API interne de l'agent (port 8001)

Trois responsabilités :
  1. WebSocket /ws        — canal bidirectionnel avec le dashboard (chat + logs + screenshots)
  2. REST endpoints        — status, memories, screenshot ponctuel, instruction (fallback HTTP)
  3. Gestion de session     — sauvegarde des cookies du navigateur après connexion manuelle
                              à un outil (Gmail, WhatsApp...)

Le chat fonctionne ainsi :
  - Dashboard envoie  { type: "chat", content: "..." }
  - server.py pousse l'instruction dans agent_state.instruction_queue
    avec un callback qui renverra la réponse au même WebSocket
  - agent_loop.py consomme, exécute, appelle le callback
  - Dashboard reçoit  { type: "chat_reply", content: "...", ... }

Le endpoint POST /instruction est le pendant HTTP de ce même flux, utilisé
par le backend (agent.py) quand le WebSocket est indisponible ou pour des
appels ponctuels qui n'ont pas besoin d'attendre la réponse en direct
(ex: "Navigate to X for tool setup" depuis ConnectTools.jsx). Il n'y a pas
de callback dans ce cas : la réponse finale ne remonte pas par cette voie,
seulement l'accusé de mise en queue.
"""

import sys
import os
sys.path.insert(0, '/app')

import asyncio
import base64
import json
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from browser.screenshot import streamer
from browser.session import browser_session
from memory.episodic import episodic_memory
from state import agent_state
from config import CLIENT_ID, AGENT_ID, AGENT_NAME
from db import engine
from sqlalchemy import text


app = FastAPI(title=f"{AGENT_NAME} Internal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket — canal principal dashboard ─────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    streamer.add_client(websocket)

    try:
        await websocket.send_json({
            "type": "connected",
            "agent": AGENT_NAME,
            "is_busy": agent_state.is_busy,
            "timestamp": datetime.utcnow().isoformat()
        })

        if not streamer.is_streaming:
            asyncio.create_task(streamer.start_streaming(interval_seconds=3))

        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            await _handle_message(message, websocket)

    except WebSocketDisconnect:
        streamer.remove_client(websocket)
        print("[API] Dashboard disconnected")
    except Exception as e:
        streamer.remove_client(websocket)
        print(f"[API] WebSocket error: {e}")


async def _handle_message(message: dict, websocket: WebSocket):
    msg_type = message.get("type")

    # ── Chat : l'utilisateur donne une instruction à l'agent ────────────────
    if msg_type == "chat":
        instruction = message.get("content", "").strip()
        if not instruction:
            return

        # L'agent est occupé — on refuse poliment
        if agent_state.is_busy:
            await websocket.send_json({
                "type": "chat_reply",
                "content": f"Je suis en train de travailler sur une tâche. Envoie ton instruction quand j'aurai terminé.",
                "is_busy": True,
                "timestamp": datetime.utcnow().isoformat()
            })
            return

        # Accuse réception immédiat
        await websocket.send_json({
            "type": "chat_ack",
            "content": instruction,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Callback — sera appelé par agent_loop quand la tâche est finie
        async def reply_callback(summary: str):
            try:
                await websocket.send_json({
                    "type": "chat_reply",
                    "content": summary,
                    "is_busy": False,
                    "timestamp": datetime.utcnow().isoformat()
                })
            except Exception as e:
                print(f"[API] reply_callback error: {e}")

        # Pousse dans la queue — agent_loop consommera
        await agent_state.push_instruction(instruction, reply_callback)

    # ── Ping keepalive ──────────────────────────────────────────────────────
    elif msg_type == "ping":
        await websocket.send_json({"type": "pong"})


# ── REST endpoints ────────────────────────────────────────────────────────────

@app.get("/status")
async def get_status():
    """État courant de l'agent — poolé par le dashboard toutes les 4s."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT status, updated_at
                FROM agent_instances
                WHERE id = :agent_id
            """), {"agent_id": AGENT_ID})
            row = result.fetchone()
    except Exception as e:
        print(f"[API] get_status DB error: {e}")
        row = None

    return {
        "agent_id": AGENT_ID,
        "client_id": CLIENT_ID,
        "status": row[0] if row else "unknown",
        "updated_at": str(row[1]) if row else None,
        "is_busy": agent_state.is_busy,
        "current_action": streamer.current_action,
        "logs": streamer.actions_log[-20:]
    }


@app.get("/stats")
async def get_stats():
    """Statistiques journalières — poolées par le dashboard."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT tasks_completed, date
                FROM agent_daily_stats
                WHERE agent_id = :agent_id AND date = :today
            """), {"agent_id": AGENT_ID, "today": datetime.utcnow().date()})
            row = result.fetchone()

        if row:
            return {
                "tasks_completed": row[0],
                "date": str(row[1])
            }
    except Exception as e:
        print(f"[API] get_stats DB error: {e}")

    return {
        "tasks_completed": 0,
        "date": str(datetime.utcnow().date())
    }


@app.get("/memories")
async def get_memories():
    """Dernières mémoires de l'agent."""
    memories = episodic_memory.get_recent(20)
    return {"memories": memories}


@app.get("/screenshot")
async def get_screenshot():
    """Screenshot ponctuel du bureau de l'agent (fallback HTTP si WebSocket indispo)."""
    path = "/app/screenshots/current.png"
    if os.path.exists(path):
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        return {"screenshot": data, "timestamp": datetime.utcnow().isoformat()}
    return {"screenshot": None}


# ── Instruction — fallback HTTP du chat ────────────────────────────────────────
# Utilisé par le backend (agent.py → POST /agent/instruction/{agent_id}) quand
# aucun WebSocket n'est disponible, et par ConnectTools.jsx (open-browser) qui
# n'a de toute façon pas besoin d'attendre la réponse finale en direct.
#
# Pas de reply_callback ici : contrairement au flux WebSocket, il n'y a pas de
# canal ouvert vers lequel renvoyer le résumé final une fois la tâche terminée.
# L'instruction est simplement mise en queue ; son résultat sera visible au
# prochain GET /status ou dans les mémoires épisodiques, pas retourné par cet
# appel.

@app.post("/instruction")
async def receive_instruction(payload: dict):
    instruction = (payload.get("instruction") or "").strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="Missing 'instruction' field")

    if agent_state.is_busy:
        return {
            "status": "busy",
            "message": "Agent is currently working on another task. Instruction was NOT queued.",
        }

    await agent_state.push_instruction(instruction, reply_callback=None)

    return {
        "status": "queued",
        "instruction": instruction,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Auth — sauvegarde de session navigateur ────────────────────────────────────
# Utilisé par ConnectTools.jsx : après que le client se soit connecté
# manuellement à un outil (Gmail, WhatsApp...) dans le bureau virtuel de
# l'agent, ce endpoint persiste les cookies de la session Playwright active
# sur disque, dans /app/sessions/ (créé par le Dockerfile). Au prochain
# démarrage du navigateur, ces cookies pourront être rechargés pour éviter
# une reconnexion — c'est ce qui permet à l'agent de ne pas re-déclencher
# de captcha/2FA à chaque tâche.

SESSIONS_DIR = "/app/sessions"


@app.post("/auth/save-session")
async def save_session():
    if browser_session.context is None:
        raise HTTPException(
            status_code=400,
            detail="No active browser session to save. Open the browser and log in first.",
        )

    try:
        os.makedirs(SESSIONS_DIR, exist_ok=True)
        session_path = os.path.join(SESSIONS_DIR, f"{AGENT_ID}.json")
        storage_state = await browser_session.context.storage_state(path=session_path)

        streamer.log_action("Browser session saved.", "done")

        return {
            "status": "ok",
            "path": session_path,
            "cookies_saved": len(storage_state.get("cookies", [])),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        print(f"[API] save-session failed: {e}")
        raise HTTPException(status_code=500, detail=f"Could not save session: {e}")
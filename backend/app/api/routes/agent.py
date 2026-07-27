from fastapi import APIRouter, Depends, HTTPException, WebSocket
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from app.api.routes.auth import get_current_client
from app.db.models.agent import AgentInstance
from app.schemas.agent import AgentInstanceResponse
from app.services.orchestrator import get_or_spawn_agent, get_or_spawn_agent_async
from app.db.models.agent import AgentTemplate
from app.schemas.agent import AgentTemplateResponse
from app.services.orchestrator import stop_agent_container
from app.db.models.agent import AgentApproval
from typing import List
from datetime import datetime
import httpx
import asyncio

router = APIRouter()


# ── Helper de sécurité ─────────────────────────────────────────────────────────

def get_agent_for_client(db: Session, agent_id: str, client_id: str) -> AgentInstance:
    """Récupère un agent précis, en vérifiant qu'il appartient bien à ce client."""
    agent = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id,
        AgentInstance.client_id == client_id
    ).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found or not yours")

    return agent


# ── Liste des agents du client ──────────────────────────────────────────────────

@router.get("/my-agents", response_model=List[AgentInstanceResponse])
def get_my_agents(db: Session = Depends(get_db), current_client=Depends(get_current_client)):
    agents = db.query(AgentInstance).filter(
        AgentInstance.client_id == current_client.id
    ).all()
    return [AgentInstanceResponse.from_orm_with_template(a) for a in agents]


# ── Infos d'un agent précis — nom personnalisé + poste (role) ─────────────────
# Utilisé par AgentDashboard.jsx pour afficher dynamiquement le nom choisi par
# le client, plutôt qu'un nom figé en dur côté frontend.

@router.get("/agent-info/{agent_id}")
def get_agent_info(
    agent_id: str,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    agent = get_agent_for_client(db, agent_id, str(current_client.id))
    try:
        get_or_spawn_agent(agent, db)  # garantit que internal_url/novnc_url sont à jour
    except Exception as e:
        print(f"[agent-info] spawn failed: {e}")
    return {
        "id": str(agent.id),
        "name": agent.name,
        "role": agent.template.role if agent.template else None,
        "role_display_name": agent.template.display_name if agent.template else None,
        "status": agent.status,
        "novnc_url": agent.novnc_url,
    }


@router.get("/approvals/{agent_id}")
def list_pending_approvals(
    agent_id: str,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    """Liste les demandes d'approbation en attente pour cet agent."""
    get_agent_for_client(db, agent_id, str(current_client.id))  # vérifie l'ownership

    approvals = db.query(AgentApproval).filter(
        AgentApproval.agent_id == agent_id,
        AgentApproval.status == "pending"
    ).order_by(AgentApproval.created_at.desc()).all()

    return [
        {
            "id": str(a.id),
            "action_description": a.action_description,
            "created_at": a.created_at.isoformat(),
        }
        for a in approvals
    ]

@router.post("/approvals/{approval_id}/respond")
def respond_to_approval(
    approval_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    """Le client approuve ou rejette une demande. L'agent (qui poll la DB) la détecte
    au prochain cycle (max APPROVAL_POLL_INTERVAL secondes de latence)."""
    approval = db.query(AgentApproval).filter(AgentApproval.id == approval_id).first()

    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if str(approval.client_id) != str(current_client.id):
        raise HTTPException(status_code=403, detail="Not your approval request")

    if approval.status != "pending":
        raise HTTPException(status_code=400, detail=f"Already resolved ({approval.status})")

    approved = data.get("approved", False)
    approval.status = "approved" if approved else "rejected"
    approval.resolved_at = datetime.utcnow()

    db.commit()

    return {"status": "ok", "resolved_as": approval.status}

# ── Onboarding — sauvegarde le briefing spécifique à l'agent ───────────────────
# Scopé par agent_id explicite (et non plus "le dernier agent créé") : la
# devinette par created_at.desc() fonctionnait par accident tant qu'un client
# n'avait qu'un seul agent, et casse dès qu'il en a 2.

@router.post("/onboarding/{agent_id}")
def save_onboarding(
    agent_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    agent = get_agent_for_client(db, agent_id, str(current_client.id))

    autonomy_mode = data.get("autonomy_mode", "learning")

    agent.onboarding_data = {
        "briefing": data.get("briefing", ""),
        "autonomy_mode": autonomy_mode,
        "rules": data.get("rules", {}),
        "tools": data.get("tools", []),
    }
    agent.permissions = {
        "tools": data.get("tools", []),
        "rules": data.get("rules", {}),
        "autonomy_mode": autonomy_mode,
    }

    # Démarre le compte à rebours de 7 jours uniquement si le client a choisi "learning"
    if autonomy_mode == "learning":
        agent.learning_mode_started_at = datetime.utcnow()

    agent.status = "active"

    db.commit()
    db.refresh(agent)

    return {"status": "ok", "agent_id": str(agent.id)}

# ── Status / Stats / Screenshot / Instruction — par agent_id ──────────────────

@router.get("/status/{agent_id}")
async def get_agent_status(
    agent_id: str,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    agent = get_agent_for_client(db, agent_id, str(current_client.id))
    agent_url = await get_or_spawn_agent_async(agent, db)
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{agent_url}/status", timeout=5.0)
            return res.json()
    except Exception:
        return {"status": "offline", "is_busy": False}


@router.get("/stats/{agent_id}")
async def get_agent_stats(
    agent_id: str,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    agent = get_agent_for_client(db, agent_id, str(current_client.id))
    agent_url = await get_or_spawn_agent_async(agent, db)
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{agent_url}/stats", timeout=5.0)
            return res.json()
    except Exception:
        return {"tasks_completed": 0, "emails_handled": 0, "whatsapp_handled": 0, "escalations": 0}


@router.get("/screenshot/{agent_id}")
async def get_screenshot(
    agent_id: str,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    agent = get_agent_for_client(db, agent_id, str(current_client.id))
    agent_url = await get_or_spawn_agent_async(agent, db)
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{agent_url}/screenshot", timeout=5.0)
            return res.json()
    except Exception:
        return {"screenshot": None}


@router.post("/instruction/{agent_id}")
async def send_instruction(
    agent_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    agent = get_agent_for_client(db, agent_id, str(current_client.id))
    agent_url = await get_or_spawn_agent_async(agent, db)
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{agent_url}/instruction",
                json={"instruction": data.get("instruction")},
                timeout=10.0
            )
            return res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Outils — check session / open browser / save session ──────────────────────
# (gardés génériques par agent_id pour cohérence avec ConnectTools.jsx)

@router.get("/check-session/{agent_id}/{tool}")
async def check_session(
    agent_id: str,
    tool: str,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    agent = get_agent_for_client(db, agent_id, str(current_client.id))
    agent_url = await get_or_spawn_agent_async(agent, db)
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{agent_url}/status", timeout=5.0)
            data = res.json()
            return {"valid": data.get("browser_running", False)}
    except Exception:
        return {"valid": False}


@router.post("/open-browser/{agent_id}")
async def open_browser(
    agent_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    agent = get_agent_for_client(db, agent_id, str(current_client.id))
    agent_url = await get_or_spawn_agent_async(agent, db)
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{agent_url}/instruction",
                json={"instruction": f"Navigate to {data.get('url')} for {data.get('tool')} setup"},
                timeout=10.0
            )
            return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-session/{agent_id}")
async def save_session(
    agent_id: str,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    agent = get_agent_for_client(db, agent_id, str(current_client.id))
    agent_url = await get_or_spawn_agent_async(agent, db)
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(f"{agent_url}/auth/save-session", timeout=10.0)
            return res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── WebSocket proxy — relais authentifié vers le container de l'agent ─────────

@router.websocket("/ws/{agent_id}")
async def agent_websocket_proxy(
    websocket: WebSocket,
    agent_id: str,
    token: str,
    db: Session = Depends(get_db)
):
    from app.services.auth import decode_token, get_client_by_email

    email = decode_token(token)
    if not email:
        await websocket.close(code=4001)
        return

    current_client = get_client_by_email(db, email)
    if not current_client:
        await websocket.close(code=4001)
        return

    # Sécurité : vérifie que cet agent appartient bien à ce client
    agent = db.query(AgentInstance).filter(
        AgentInstance.id == agent_id,
        AgentInstance.client_id == current_client.id
    ).first()

    if not agent:
        await websocket.close(code=4004)
        return

    agent_url = await get_or_spawn_agent_async(agent, db)
    agent_ws_url = agent_url.replace("http://", "ws://") + "/ws"

    await websocket.accept()

    try:
        import websockets as ws_lib
        async with ws_lib.connect(agent_ws_url) as agent_ws:

            async def client_to_agent():
                try:
                    while True:
                        data = await websocket.receive_text()
                        await agent_ws.send(data)
                except Exception as e:
                    print(f"[WS Proxy] client→agent closed: {e}")

            async def agent_to_client():
                try:
                    async for message in agent_ws:
                        await websocket.send_text(message)
                except Exception as e:
                    print(f"[WS Proxy] agent→client closed: {e}")

            done, pending = await asyncio.wait(
                [
                    asyncio.create_task(client_to_agent()),
                    asyncio.create_task(agent_to_client()),
                ],
                return_when=asyncio.FIRST_COMPLETED
            )

            for task in pending:
                task.cancel()

    except Exception as e:
        print(f"[WS Proxy] Connection error: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass


@router.get("/templates", response_model=List[AgentTemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    """Liste publique des postes disponibles — alimente la Marketplace.
    Générique : ne connaît aucun rôle en dur, lit simplement ce qui est actif en base.
    """
    templates = db.query(AgentTemplate).filter(AgentTemplate.is_active == True).all()
    return templates
# Tables qui référencent agent_instances.id par une FK agent_id. Postgres
# refuse de supprimer l'agent tant que ces lignes existent (ForeignKeyViolation),
# donc il faut les vider explicitement avant — c'est exactement ce qui manquait
# et faisait échouer le delete avec un 500 silencieux côté frontend.
_AGENT_CHILD_TABLES = (
    "agent_plan_tasks",
    "agent_self_actions",
    "episodic_memories",
    "agent_daily_stats",
)


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    """Supprime définitivement un agent : arrête/retire son container Docker,
    vide les tables qui le référencent par clé étrangère, puis supprime son
    enregistrement en base. Action irréversible."""
    agent = get_agent_for_client(db, agent_id, str(current_client.id))

    # Arrête et retire le container s'il existe — ne bloque pas la suppression
    # en base même si le container n'est plus joignable (déjà arrêté, host
    # redémarré, etc.)
    try:
        stop_agent_container(agent, db)
    except Exception as e:
        print(f"[delete_agent] Container stop failed (continuing anyway): {e}")

    try:
        # AgentApproval a un modèle ORM importé plus haut — on l'utilise
        # directement plutôt qu'un DELETE brut.
        db.query(AgentApproval).filter(AgentApproval.agent_id == agent_id).delete()

        for table in _AGENT_CHILD_TABLES:
            db.execute(text(f"DELETE FROM {table} WHERE agent_id = :aid"), {"aid": agent_id})

        db.delete(agent)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[delete_agent] DB cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=f"Could not delete agent: {e}")

    return {"status": "deleted", "agent_id": agent_id}
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.api.routes.auth import get_current_client
from app.services.billing import create_checkout_session, create_portal_session, PLANS
from app.core.config import settings
from app.db.models.agent import AgentInstance, AgentTemplate
from datetime import datetime, timedelta
import uuid
import stripe

router = APIRouter()

stripe.api_key = settings.STRIPE_SECRET_KEY


# ── Helper — extraction sûre des metadata Stripe ─────────────────────────────
# session.metadata est un StripeObject, PAS un vrai dict Python : il ne
# supporte ni dict(...) (casse avec KeyError sur un index entier) ni .get()
# (AttributeError, car .get n'existe pas sur cet objet dans cette version du
# SDK). Seul l'accès par clé obj["key"] fonctionne, donc on l'enveloppe dans
# un try/except pour simuler un .get() sûr.
def safe_meta(metadata, key, default=None):
    if not metadata:
        return default
    try:
        return metadata[key]
    except (KeyError, TypeError):
        return default


# ── Schémas ─────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    template_id: str
    agent_name: str


# ── Plans ───────────────────────────────────────────────────────────────────

@router.get("/plans")
def get_plans():
    return PLANS


# ── Checkout — générique, lié au template choisi par le client ──────────────

@router.post("/checkout/{plan}")
def checkout(
    plan: str,
    data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_client=Depends(get_current_client)
):
    # Vérifie que le template existe et est actif avant de lancer le paiement
    template = db.query(AgentTemplate).filter(
        AgentTemplate.id == data.template_id,
        AgentTemplate.is_active == True
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Role not found or no longer available")

    if not data.agent_name.strip():
        raise HTTPException(status_code=400, detail="Agent name is required")

    try:
        session = create_checkout_session(
            plan=plan,
            template_id=str(template.id),
            agent_name=data.agent_name.strip(),
            client_email=current_client.email,
            client_id=str(current_client.id),
            success_url="http://localhost:5173/dashboard?payment=success",
            cancel_url="http://localhost:5173/marketplace?payment=cancelled"
        )
        return {"checkout_url": session.url}
    except Exception as e:
        print(f"STRIPE ERROR: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ── Portail client Stripe ─────────────────────────────────────────────────────

@router.post("/portal")
def portal(db: Session = Depends(get_db), current_client=Depends(get_current_client)):
    if not current_client.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription")
    try:
        session = create_portal_session(
            stripe_customer_id=current_client.stripe_customer_id,
            return_url="http://localhost:5173/billing"
        )
        return {"portal_url": session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Webhook Stripe — générique, plus aucun rôle codé en dur ──────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event.type == "checkout.session.completed":
        session = event.data.object
        metadata = session.metadata

        client_id = safe_meta(metadata, "client_id")
        plan = safe_meta(metadata, "plan")
        template_id = safe_meta(metadata, "template_id")
        agent_name = safe_meta(metadata, "agent_name")

        if not client_id or not plan or not template_id or not agent_name:
            print(f"[Webhook] Missing metadata: {metadata}")
            return {"status": "ignored"}

        template = db.query(AgentTemplate).filter(AgentTemplate.id == template_id).first()
        if not template:
            print(f"[Webhook] Template {template_id} not found")
            return {"status": "ignored"}

        # Vérifie si un agent de ce poste précis existe déjà pour ce client
        existing = db.query(AgentInstance).filter(
            AgentInstance.client_id == client_id,
            AgentInstance.template_id == template.id
        ).first()

        if existing:
            existing.subscription_status = "active"
            existing.subscription_plan = plan
            existing.is_active = True
            existing.subscription_end = datetime.utcnow() + timedelta(days=30)
            db.commit()
            return {"status": "updated"}

        agent = AgentInstance(
            id=uuid.uuid4(),
            client_id=client_id,
            template_id=template.id,
            name=agent_name,
            is_active=True,
            status="pending_onboarding",
            subscription_plan=plan,
            subscription_status="active",
            subscription_end=datetime.utcnow() + timedelta(days=30),
            daily_action_limit=PLANS.get(plan, {}).get("tickets", 100),
        )
        db.add(agent)
        db.commit()
        print(f"[Webhook] Created agent '{agent_name}' ({template.role}) for client {client_id}")

    elif event.type == "customer.subscription.deleted":
        session = event.data.object
        client_id = safe_meta(session.metadata, "client_id")
        if client_id:
            agents = db.query(AgentInstance).filter(
                AgentInstance.client_id == client_id
            ).all()
            for agent in agents:
                agent.is_active = False
                agent.subscription_status = "cancelled"
                agent.status = "inactive"
            db.commit()

    return {"status": "ok"}
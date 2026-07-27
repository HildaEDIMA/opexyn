# app/services/billing.py
import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

PLANS = {
    "discovery": {
        "name": "Discovery",
        "price_id": settings.STRIPE_PRICE_DISCOVERY,
        "amount": 149,
        "daily_action_limit": 100,
        "max_agents": 1,
        "description": "1 AI employee, 100 actions/day"
    },
    "startup": {
        "name": "Startup",
        "price_id": settings.STRIPE_PRICE_STARTUP,
        "amount": 399,
        "daily_action_limit": 200,
        "max_agents": 3,
        "description": "Up to 3 AI employees, 200 actions/day each"
    },
    "growth": {
        "name": "Growth",
        "price_id": settings.STRIPE_PRICE_GROWTH,
        "amount": 699,
        "daily_action_limit": 500,
        "max_agents": None,  # illimité
        "description": "Unlimited AI employees, 500 actions/day each"
    }
}


def create_checkout_session(plan: str, template_id: str, agent_name: str, client_email: str, client_id: str, success_url: str, cancel_url: str):
    plan_data = PLANS.get(plan)
    if not plan_data:
        raise ValueError(f"Plan {plan} introuvable")
    
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        mode="subscription",
        customer_email=client_email,
        line_items=[{
            "price": plan_data["price_id"],
            "quantity": 1
        }],
        metadata={
            "client_id": client_id,
            "plan": plan,
            "template_id": template_id,
            "agent_name": agent_name,
        },
        success_url=success_url,
        cancel_url=cancel_url
    )
    return session

def create_portal_session(stripe_customer_id: str, return_url: str):
    session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url=return_url
    )
    return session
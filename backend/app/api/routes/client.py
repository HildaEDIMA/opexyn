from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.client import ClientContext, ClientResponse
from app.api.routes.auth import get_current_client

router = APIRouter()

@router.put("/context", response_model=ClientResponse)
def update_context(data: ClientContext, db: Session = Depends(get_db), current_client=Depends(get_current_client)):
    current_client.business_description = data.business_description
    current_client.business_priorities = data.business_priorities
    current_client.short_term_goals = data.short_term_goals
    current_client.long_term_goals = data.long_term_goals
    db.commit()
    db.refresh(current_client)
    return current_client

@router.get("/me", response_model=ClientResponse)
def get_profile(current_client=Depends(get_current_client)):
    return current_client
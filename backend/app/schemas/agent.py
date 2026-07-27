# app/schemas/agent.py
from pydantic import BaseModel, computed_field
from typing import Optional
from uuid import UUID
from datetime import datetime


class AgentInstanceResponse(BaseModel):
    id: UUID
    template_id: UUID
    name: str
    is_active: bool
    status: str
    subscription_plan: Optional[str]
    subscription_status: str
    created_at: datetime

    # Champs dérivés du template lié — exposés directement pour éviter au
    # frontend de devoir faire un appel supplémentaire juste pour afficher
    # le poste de l'agent (ex: dans la liste /my-agents).
    role: Optional[str] = None
    role_display_name: Optional[str] = None

    class Config:
        from_attributes = True

    @staticmethod
    def from_orm_with_template(agent):
        """Construit la réponse en résolvant role/role_display_name depuis agent.template.

        À utiliser à la place de la validation automatique quand le endpoint
        a besoin d'exposer ces deux champs dérivés (ex: GET /my-agents).
        """
        data = AgentInstanceResponse.model_validate(agent).model_dump()
        if agent.template:
            data["role"] = agent.template.role
            data["role_display_name"] = agent.template.display_name
        return AgentInstanceResponse(**data)
    
class AgentTemplateResponse(BaseModel):
    id: UUID
    role: str
    display_name: str
    description: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True
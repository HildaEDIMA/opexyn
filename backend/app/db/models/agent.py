from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime
import uuid

class AgentTemplate(Base):
    """Le modèle général d'un POSTE/RÔLE — ex: Customer Support, Sales Development, Ops & Admin.

    Un template ne porte jamais de prénom : c'est un rôle générique, partagé
    par tous les clients qui choisissent ce poste. Il ne porte pas de quota
    (le quota dépend du plan acheté, donc il vit sur AgentInstance).
    Chaque poste a sa propre image Docker dédiée (docker_image), car les
    capacités/RAG/skills embarqués diffèrent selon le rôle.
    """
    __tablename__ = "agent_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(String, nullable=False, unique=True)  # ex: "customer_support", "sales_development", "ops_admin"
    display_name = Column(String, nullable=False)        # ex: "Customer Support", "Sales Development"
    description = Column(Text, nullable=True)
    personality = Column(Text, nullable=True)
    skills = Column(JSON, nullable=True)
    tools = Column(JSON, nullable=True)
    docker_image = Column(String, nullable=False)         # ex: "opexyn-support", "opexyn-sales", "opexyn-admin"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    instances = relationship("AgentInstance", back_populates="template")


class AgentInstance(Base):
    """Une instance concrète créée par un client — porte le nom personnalisé choisi
    à la création, ainsi que le quota journalier (daily_action_limit) déterminé
    par le plan acheté pour CETTE instance précise.
    """
    __tablename__ = "agent_instances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("agent_templates.id"), nullable=False)

    name = Column(String, nullable=False)  # nom personnalisé choisi par le client — obligatoire, pas de fallback figé
    is_active = Column(Boolean, default=True)
    status = Column(String, default="pending_onboarding")

    subscription_plan = Column(String)
    subscription_status = Column(String)
    subscription_end = Column(DateTime)

    daily_action_limit = Column(Integer, nullable=True)  # quota/jour fixé selon le plan acheté à la création

    internal_url = Column(String, nullable=True)
    novnc_url = Column(String, nullable=True)  # URL noVNC complète, port mappé dynamiquement par container
    container_id = Column(String, nullable=True)

    onboarding_data = Column(JSON, nullable=True)
    permissions = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default="now()")
    updated_at = Column(DateTime, server_default="now()")

    # Relations
    client = relationship("Client", back_populates="agents")
    template = relationship("AgentTemplate", back_populates="instances")

class AgentApproval(Base):
    __tablename__ = "agent_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agent_instances.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), nullable=False)
    action_description = Column(Text, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
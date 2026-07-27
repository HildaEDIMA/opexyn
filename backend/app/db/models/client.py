from sqlalchemy import Column, String, Text, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime
import uuid

class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Informations de base
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)  # Null si Google OAuth
    full_name = Column(String, nullable=False)
    company_name = Column(String, nullable=False)
    country = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    
    # Auth
    google_id = Column(String, nullable=True, unique=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Contexte entreprise
    business_description = Column(Text, nullable=True)
    business_priorities = Column(Text, nullable=True)
    short_term_goals = Column(Text, nullable=True)
    long_term_goals = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relations
    agents = relationship("AgentInstance", back_populates="client")
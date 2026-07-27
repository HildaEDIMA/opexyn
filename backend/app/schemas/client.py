from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime

class ClientRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: str
    country: Optional[str] = None
    phone: Optional[str] = None

class ClientLogin(BaseModel):
    email: EmailStr
    password: str

class ClientContext(BaseModel):
    business_description: Optional[str] = None
    business_priorities: Optional[str] = None
    short_term_goals: Optional[str] = None
    long_term_goals: Optional[str] = None

class ClientResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    company_name: str
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
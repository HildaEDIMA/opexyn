from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # App
    APP_NAME: str = "Opexyn"
    DEBUG: bool = True
    SECRET_KEY: str = "change-this-in-production"
    
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost/opexyn"
    
    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    ALGORITHM: str = "HS256"
    
    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"
    FRONTEND_URL: str = "http://localhost:5173"

    # Stripe
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRICE_DISCOVERY: Optional[str] = None
    STRIPE_PRICE_STARTUP: Optional[str] = None
    STRIPE_PRICE_GROWTH: Optional[str] = None

    # vérification mail
    RESEND_API_KEY: Optional[str] = None

    # Anthropic — utilisé par les containers agents (Alex et futurs postes)
    ANTHROPIC_API_KEY: Optional[str] = None

    # Embedding
    VOYAGE_API_KEY: Optional[str] = None

    # URL à laquelle les containers agents peuvent joindre le backend.
    # En dev local (backend lancé directement sur l'hôte, pas dans Docker
    # Compose), il faut utiliser host.docker.internal plutôt que "backend"
    # ou "localhost", qui ne désignent pas l'hôte Windows depuis le container.
    BACKEND_URL_FOR_AGENTS: str = "http://host.docker.internal:8000"

    class Config:
        env_file = ".env"

settings = Settings()
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.client import ClientRegister, ClientResponse, Token
from app.services.auth import (
    create_client,
    get_client_by_email,
    authenticate_client,
    create_access_token,
    decode_token
)
from app.core.config import settings
from app.services.email import send_verification_email, send_welcome_email, generate_verification_token
from sqlalchemy import text
from datetime import datetime, timedelta

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_client(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Token invalide")
    client = get_client_by_email(db, email)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return client

@router.post("/register", response_model=ClientResponse)
def register(data: ClientRegister, db: Session = Depends(get_db)):
    existing = get_client_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already used")
    
    client = create_client(db, data)
    
    # Génère et sauvegarde le token de vérification
    token = generate_verification_token()
    db.execute(text("""
        INSERT INTO email_verifications (client_id, token, expires_at)
        VALUES (:client_id, :token, :expires_at)
    """), {
        "client_id": str(client.id),
        "token": token,
        "expires_at": datetime.utcnow() + timedelta(hours=24)
    })
    db.commit()
    
    # Envoie l'email de vérification
    send_verification_email(
        to_email=client.email,
        full_name=client.full_name,
        token=token
    )
    
    return client

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    client = authenticate_client(db, form_data.username, form_data.password)
    if not client:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = create_access_token({"sub": client.email})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=ClientResponse)
def me(current_client=Depends(get_current_client)):
    return current_client

from fastapi.responses import RedirectResponse
import httpx

@router.get("/google")
async def google_login():
    """Redirige vers Google OAuth"""
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=select_account"
    )
    return RedirectResponse(google_auth_url)

@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """Callback Google OAuth"""
    try:
        # Échange le code contre un access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                }
            )
            token_data = token_response.json()

        if "error" in token_data:
            print(f"[Google OAuth] Token error: {token_data}")
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=token_failed")

        # Récupère les infos utilisateur
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {token_data['access_token']}"}
            )
            user_info = user_response.json()

        email = user_info.get("email")
        full_name = user_info.get("name", "")
        google_id = user_info.get("id")

        if not email:
            return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=no_email")

        # Vérifie si le client existe
        existing = get_client_by_email(db, email)
        is_new = False

        if not existing:
            # Nouveau client — crée le compte
            from app.db.models.client import Client as ClientModel
            existing = ClientModel(
                email=email,
                full_name=full_name,
                company_name=full_name,
                google_id=google_id,
                is_verified=True,
                hashed_password=None,
            )
            db.add(existing)
            db.commit()
            db.refresh(existing)
            is_new = True
        else:
            if not existing.google_id:
                existing.google_id = google_id
                db.commit()

        # Crée le JWT
        token = create_access_token({"sub": existing.email})

        # Redirige vers le frontend
        redirect_url = f"{settings.FRONTEND_URL}/auth/callback?token={token}&new={str(is_new).lower()}"
        return RedirectResponse(redirect_url)

    except Exception as e:
        print(f"[Google OAuth] Error: {e}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=oauth_failed")
    

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    # Cherche le token
    result = db.execute(text("""
        SELECT client_id, expires_at, used
        FROM email_verifications
        WHERE token = :token
    """), {"token": token}).fetchone()
    
    if not result:
        raise HTTPException(status_code=400, detail="Invalid token")
    
    if result[2]:  # used
        raise HTTPException(status_code=400, detail="Token already used")
    
    if datetime.utcnow() > result[1]:  # expired
        raise HTTPException(status_code=400, detail="Token expired")
    
    # Vérifie le client
    db.execute(text("""
        UPDATE clients SET is_verified = TRUE WHERE id = :client_id
    """), {"client_id": result[0]})
    
    # Marque le token comme utilisé
    db.execute(text("""
        UPDATE email_verifications SET used = TRUE WHERE token = :token
    """), {"token": token})
    
    db.commit()
    
    # Envoie l'email de bienvenue
    client = db.execute(text("""
        SELECT email, full_name FROM clients WHERE id = :client_id
    """), {"client_id": result[0]}).fetchone()
    
    if client:
        send_welcome_email(client[0], client[1])
    
    # Redirige vers le frontend
    from fastapi.responses import RedirectResponse
    return RedirectResponse(f"{settings.FRONTEND_URL}/login?verified=true")
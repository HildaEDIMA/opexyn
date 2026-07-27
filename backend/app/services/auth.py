from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.models.client import Client
from app.schemas.client import ClientRegister

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_client_by_email(db: Session, email: str) -> Optional[Client]:
    return db.query(Client).filter(Client.email == email).first()

def create_client(db: Session, data: ClientRegister) -> Client:
    client = Client(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        company_name=data.company_name,
        country=data.country,
        phone=data.phone,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client

def authenticate_client(db: Session, email: str, password: str) -> Optional[Client]:
    client = get_client_by_email(db, email)
    if not client:
        return None
    if not verify_password(password, client.hashed_password):
        return None
    return client

def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
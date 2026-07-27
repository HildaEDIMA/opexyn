"""
database.py — Connexion DB du backend principal.

CORRECTIF (voir aussi app/db.py côté container agent, même diagnostic) :
Le backend tourne en continu et garde un pool de connexions ouvertes
(QueuePool, comportement par défaut de SQLAlchemy). Si la base (ou un
pooler PgBouncer en amont, ou Supabase lui-même) ferme une connexion
inactive après un certain délai, SQLAlchemy ne le sait pas tant qu'il
n'essaie pas de s'en servir — d'où l'erreur observée :

    psycopg2.OperationalError: server closed the connection unexpectedly

pool_pre_ping=True fait exécuter un SELECT 1 léger avant de réutiliser une
connexion du pool ; si elle est morte, SQLAlchemy en ouvre une nouvelle de
façon transparente au lieu de laisser l'erreur remonter jusqu'à la requête
de l'utilisateur. pool_recycle referme et recrée proactivement toute
connexion plus vieille que N secondes, avant même qu'elle soit détectée
comme morte — utile car certains proxies (PgBouncer, load balancers cloud)
coupent silencieusement les connexions inactives au-delà d'un certain âge,
pas seulement au-delà d'un certain temps d'inactivité.

Même résolution IPv4 forcée que côté container : sur certains réseaux
Windows, la résolution IPv6 du host Supabase direct échoue ou est
instable — forcer IPv4 évite des échecs de connexion intermittents
indépendants du problème de pooling ci-dessus.
"""
import socket
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import urlparse, urlunparse
from app.core.config import settings


def _force_ipv4_url(url: str) -> str:
    """Résout le hostname en IPv4 et remplace dans l'URL. Si la résolution
    IPv4 échoue (ex: hostname invalide en dev local), retourne l'URL
    d'origine plutôt que de faire planter le démarrage du backend."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return url

        results = socket.getaddrinfo(hostname, None, socket.AF_INET)
        ipv4 = results[0][4][0]
        print(f"[DB] Resolved {hostname} → {ipv4} (IPv4 forced)")

        port = parsed.port or 5432
        netloc = f"{parsed.username}:{parsed.password}@{ipv4}:{port}"

        return urlunparse((
            parsed.scheme, netloc, parsed.path,
            parsed.params, parsed.query, parsed.fragment
        ))
    except Exception as e:
        print(f"[DB] IPv4 resolution failed ({e}), using original URL")
        return url


_resolved_url = _force_ipv4_url(settings.DATABASE_URL)

engine = create_engine(
    _resolved_url,
    connect_args={
        "sslmode": "require",
        "gssencmode": "disable",
        "connect_timeout": 10,
    },
    pool_pre_ping=True,   # vérifie la connexion avant usage — détecte les connexions mortes
    pool_recycle=280,     # referme/recrée toute connexion de plus de 280s, avant qu'elle soit coupée par un proxy en amont
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
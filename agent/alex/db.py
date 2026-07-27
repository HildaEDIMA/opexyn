"""
Module de connexion DB centralisé.
Force IPv4 via le pooler Supabase (port 6543).
Le host direct db.xxx.supabase.co est IPv6-only — incompatible avec Docker Windows.

IMPORTANT — Double pooling avec PgBouncer (port 6543, transaction mode) :
PgBouncer gère déjà son propre pool de connexions vers Postgres. Si SQLAlchemy
pool AUSSI ses connexions (QueuePool par défaut), on se retrouve avec deux
couches de pooling qui ne se synchronisent pas : PgBouncer peut fermer une
connexion backend à tout moment (fin de transaction, recyclage interne) sans
que SQLAlchemy le sache, jusqu'à ce qu'on essaie de s'en servir → 
"server closed the connection unexpectedly".

Solution : NullPool. SQLAlchemy n'essaie plus de garder des connexions
persistantes de son côté — chaque requête ouvre/ferme une connexion physique,
et c'est PgBouncer qui fait le vrai travail de pooling en amont. C'est le
comportement recommandé par Supabase pour tout usage via le pooler transaction
mode (port 6543).
"""
import socket
import os
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from urllib.parse import urlparse, urlunparse


def _force_ipv4_url(url: str) -> str:
    """
    Résout le hostname en IPv4 et remplace dans l'URL.
    Si IPv4 non disponible, retourne l'URL originale.
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname

        # Résolution forcée en IPv4
        results = socket.getaddrinfo(hostname, None, socket.AF_INET)
        ipv4 = results[0][4][0]
        print(f"[DB] Resolved {hostname} → {ipv4} (IPv4 forced)")

        port = parsed.port or 5432
        netloc = f"{parsed.username}:{parsed.password}@{ipv4}:{port}"

        new_url = urlunparse((
            parsed.scheme,
            netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))
        return new_url
    except Exception as e:
        print(f"[DB] IPv4 resolution failed ({e}), using original URL")
        return url


def make_engine():
    database_url = os.getenv("DATABASE_URL", "")
    ipv4_url = _force_ipv4_url(database_url)

    return create_engine(
        ipv4_url,
        connect_args={
            "sslmode": "require",
            "gssencmode": "disable",
            "connect_timeout": 10,
        },
        poolclass=NullPool,   # PgBouncer fait déjà le pooling — on ne double-pool plus
        pool_pre_ping=True,   # gardé par sécurité, coût quasi nul avec NullPool
    )


engine = make_engine()
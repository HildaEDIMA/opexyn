# app/services/orchestrator.py
import docker
from sqlalchemy.orm import Session
from app.db.models.agent import AgentInstance
from app.core.config import settings
import asyncio
import threading
import time
import docker

# ── Client Docker — initialisé LAZILY, pas au moment de l'import ─────────────
# docker.from_env() au niveau module fait crasher tout le backend si Docker
# Desktop n'est pas encore lancé quand Python importe ce fichier.
# On le crée à la première utilisation réelle à la place.

_docker_client = None

def get_docker_client():
    global _docker_client
    if _docker_client is None:
        _docker_client = docker.from_env()
    return _docker_client


AGENT_NETWORK = "opexyn_network"


# ── Verrou par agent ──────────────────────────────────────────────────────────
# Le dashboard poll /status et /screenshot toutes les 4-5s PAR agent, et chaque
# appel déclenche indépendamment get_or_spawn_agent(). Sans verrou, un poll qui
# arrive pendant qu'un autre thread est en train de stop/remove/create le même
# container Docker produit une cascade de 409 Conflict ("removal already in
# progress", "container name already in use", "marked for removal cannot be
# started") — c'est exactement ce qui apparaît dans les logs. Un verrou par
# agent_id sérialise tous les appels Docker concernant CE container, sans
# bloquer les autres agents entre eux.

_agent_locks: dict[str, threading.Lock] = {}
_agent_locks_guard = threading.Lock()


def _get_agent_lock(agent_id: str) -> threading.Lock:
    with _agent_locks_guard:
        lock = _agent_locks.get(agent_id)
        if lock is None:
            lock = threading.Lock()
            _agent_locks[agent_id] = lock
        return lock


def _wait_container_gone(client, container_name: str, timeout: float = 10.0):
    """Attend que Docker ait fini de retirer un container avant de continuer.
    Évite un create() immédiat qui tomberait sur 'name already in use' pendant
    que la suppression précédente est encore en vol."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            client.containers.get(container_name)
            time.sleep(0.3)
        except docker.errors.NotFound:
            return
    # Timeout — on laisse l'appelant retenter et échouer proprement si besoin.


def _get_host_port(container, container_port: str) -> str:
    container.reload()
    port_bindings = container.attrs["NetworkSettings"]["Ports"].get(container_port)
    if not port_bindings:
        raise RuntimeError(f"Aucun port mappé ({container_port}) pour le container {container.name}")
    return port_bindings[0]["HostPort"]


def _build_urls(container):
    api_port = _get_host_port(container, "8001/tcp")
    novnc_port = _get_host_port(container, "6080/tcp")
    internal_url = f"http://127.0.0.1:{api_port}"
    novnc_url = (
        f"http://127.0.0.1:{novnc_port}/vnc.html"
        f"?autoconnect=1&reconnect=1&reconnect_delay=2000&resize=scale&show_dot=1&view_clip=0&path=websockify"
    )
    return internal_url, novnc_url


def spawn_agent_container(agent_instance: AgentInstance, db: Session) -> str:
    """N'appeler que sous le verrou de l'agent — voir get_or_spawn_agent."""
    client = get_docker_client()
    container_name = f"agent_{str(agent_instance.id)[:8]}"

    agent_image = agent_instance.template.docker_image if agent_instance.template else None
    if not agent_image:
        raise ValueError(
            f"Aucune image Docker définie pour le template "
            f"'{agent_instance.template.role if agent_instance.template else 'inconnu'}' "
            f"de l'agent {agent_instance.id}"
        )

    try:
        existing = client.containers.get(container_name)
        if existing.status == "running":
            internal_url, novnc_url = _build_urls(existing)
            agent_instance.internal_url = internal_url
            agent_instance.novnc_url = novnc_url
            db.commit()
            return internal_url
        else:
            existing.remove(force=True)
    except docker.errors.NotFound:
        pass
    except docker.errors.APIError as e:
        # Suppression déjà en cours (ex: un delete concurrent) — attend qu'elle
        # se termine plutôt que de planter, puis continue vers la création.
        if "already in progress" in str(e):
            _wait_container_gone(client, container_name)
        else:
            raise

    container = client.containers.run(
        agent_image,
        name=container_name,
        detach=True,
        network=AGENT_NETWORK,
        ports={
            "8001/tcp": None,
            "6080/tcp": None,
        },
        environment={
            "AGENT_ID": str(agent_instance.id),
            "CLIENT_ID": str(agent_instance.client_id),
            "AGENT_NAME": agent_instance.name,
            "AGENT_ROLE": agent_instance.template.role if agent_instance.template else "",
            "AGENT_DAILY_ACTION_LIMIT": str(agent_instance.daily_action_limit or 100),
            "DATABASE_URL": settings.DATABASE_URL,
            "ANTHROPIC_API_KEY": settings.ANTHROPIC_API_KEY,
            "VOYAGE_API_KEY": settings.VOYAGE_API_KEY,
            "BACKEND_URL": settings.BACKEND_URL_FOR_AGENTS,
        },
        mem_limit="2g",
        cpu_period=100000,
        cpu_quota=50000,
        restart_policy={"Name": "unless-stopped"},
    )

    internal_url, novnc_url = _build_urls(container)

    agent_instance.internal_url = internal_url
    agent_instance.novnc_url = novnc_url
    agent_instance.container_id = container.id
    db.commit()

    return internal_url


def stop_agent_container(agent_instance: AgentInstance, db: Session):
    client = get_docker_client()
    container_name = f"agent_{str(agent_instance.id)[:8]}"
    lock = _get_agent_lock(str(agent_instance.id))

    with lock:
        try:
            container = client.containers.get(container_name)
            try:
                container.stop(timeout=10)
            except docker.errors.APIError as e:
                # Déjà stoppé / déjà en cours d'arrêt — pas bloquant.
                print(f"[Orchestrator] stop() non-fatal error for {container_name}: {e}")
            try:
                container.remove(force=True)
            except docker.errors.APIError as e:
                # "removal already in progress" — quelqu'un d'autre (ou Docker
                # lui-même) s'en occupe déjà. On attend que ce soit fini plutôt
                # que de faire remonter une erreur qui bloquerait la suppression
                # de l'agent en base côté delete_agent().
                if "already in progress" in str(e):
                    _wait_container_gone(client, container_name)
                else:
                    print(f"[Orchestrator] remove() non-fatal error for {container_name}: {e}")

            agent_instance.internal_url = None
            agent_instance.novnc_url = None
            agent_instance.container_id = None
            db.commit()
        except docker.errors.NotFound:
            # Déjà absent — état cible atteint, rien à faire.
            agent_instance.internal_url = None
            agent_instance.novnc_url = None
            agent_instance.container_id = None
            db.commit()


def get_or_spawn_agent(agent_instance: AgentInstance, db: Session) -> str:
    """Retourne l'URL du container — resync les ports depuis Docker si nécessaire.
    Sérialisé par agent_id pour éviter les race conditions avec un stop/delete
    concurrent sur le même container (voir _agent_locks)."""
    client = get_docker_client()
    container_name = f"agent_{str(agent_instance.id)[:8]}"
    lock = _get_agent_lock(str(agent_instance.id))

    with lock:
        try:
            container = client.containers.get(container_name)
            if container.status == "running":
                # Container trouvé et actif — resync TOUJOURS les ports depuis Docker
                # (les ports changent à chaque redémarrage de Docker Desktop)
                internal_url, novnc_url = _build_urls(container)

                # Met à jour en DB seulement si les URLs ont changé
                if agent_instance.internal_url != internal_url or agent_instance.novnc_url != novnc_url:
                    agent_instance.internal_url = internal_url
                    agent_instance.novnc_url = novnc_url
                    db.commit()
                    print(f"[Orchestrator] Updated URLs for {container_name}: {internal_url}")

                return internal_url
            else:
                # Container existe mais n'est pas running — le supprimer et respawner
                try:
                    container.remove(force=True)
                except docker.errors.APIError as e:
                    if "already in progress" in str(e):
                        _wait_container_gone(client, container_name)
                    else:
                        raise
        except docker.errors.NotFound:
            pass

        # Container introuvable ou supprimé — on le respawne
        return spawn_agent_container(agent_instance, db)


# ── Wrapper async — à utiliser depuis les routes `async def` ─────────────────
# Le SDK Docker est 100% synchrone (y compris get_docker_client/container.reload
# via npipe sur Windows, qui peut bloquer jusqu'à 60s). L'appeler directement
# dans une route async gèle TOUT le event loop FastAPI pendant ce temps —
# plus aucune autre requête n'est traitée, même sur d'autres endpoints.
# to_thread() délègue l'appel bloquant à un thread du pool, sans bloquer la loop.
async def get_or_spawn_agent_async(agent_instance: AgentInstance, db: Session) -> str:
    return await asyncio.to_thread(get_or_spawn_agent, agent_instance, db)
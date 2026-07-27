"""
role_bootstrap.py — Checklist de démarrage exécutée UNE SEULE FOIS par agent,
juste après sa première activation, avant qu'il ne soit disponible pour le chat.

Générique : chaque rôle a sa propre liste de tâches d'initialisation.
Si un rôle n'a pas de checklist dédiée, une tâche minimale par défaut s'applique.

La tâche "vérifier les outils connectés" est résolue dynamiquement à partir de
`permissions.get_permissions()["tools"]` : sans ça, l'agent n'a aucune cible
concrète ("your connected tools" ne veut rien dire pour lui) et improvise —
on l'a vu partir explorer son PROPRE backend (localhost:8000/8001) faute de
mieux, ce qui n'a évidemment aucun sens.
"""

# URLs connues des outils que le client peut connecter (voir ConnectTools.jsx).
# Permet de donner à l'agent une cible concrète au lieu de le laisser deviner.
KNOWN_TOOL_URLS = {
    "gmail": "https://mail.google.com",
    "outlook": "https://outlook.office.com/mail",
    "whatsapp": "https://web.whatsapp.com",
    "slack": "https://slack.com/signin",
    "hubspot": "https://app.hubspot.com",
    "salesforce": "https://login.salesforce.com",
    "notion": "https://www.notion.so/login",
    "calendar": "https://calendar.google.com",
    "drive": "https://drive.google.com",
    "trello": "https://trello.com/login",
    "asana": "https://app.asana.com",
}

# Placeholder remplacé dynamiquement par get_bootstrap_tasks() avec la vraie
# liste d'outils connectés pour ce client précis.
_TOOLS_CHECK_PLACEHOLDER = "__CONNECTED_TOOLS_CHECK__"


def _connected_tools_instruction(tools: list) -> str:
    if not tools:
        return (
            "No external tools are connected for this client yet. Skip any browser check — "
            "just take a screenshot of your desktop to confirm your environment works, and "
            "save a memory note that no tools are connected yet."
        )

    lines = []
    for t in tools:
        url = KNOWN_TOOL_URLS.get(str(t).lower())
        lines.append(f"- {t}: {url}" if url else f"- {t}: (no known URL — use search_knowledge to check for it, or skip)")
    tool_list = "\n".join(lines)

    return (
        "Check whether the following tools connected by this client are reachable:\n"
        f"{tool_list}\n\n"
        "Use the `playwright_action` tool (action='navigate') to open each URL directly — "
        "do NOT click the browser's address bar with mouse_click/keyboard_type, that's slow "
        "and unreliable when you already have a direct navigation tool. For each tool, take "
        "a screenshot after navigating to see whether you're logged in or need authentication, "
        "then report which ones are ready.\n\n"
        "IMPORTANT: these are the client's external tools only. Do NOT explore your own "
        "backend or internal infrastructure (localhost, ports 8000/8001, /docs, curl to "
        "internal services, etc.) — that is not part of this task."
    )


ROLE_BOOTSTRAP_TASKS = {

    "customer_support": [
        _TOOLS_CHECK_PLACEHOLDER,
        "Use search_knowledge to review your training on handling refunds, complaints, and escalation rules. Save a memory note confirming you've reviewed your core support procedures.",
    ],

    "sales_development": [
        _TOOLS_CHECK_PLACEHOLDER,
        "Use search_knowledge to review your training on lead qualification and outreach cadence. Save a memory note confirming you've reviewed your core sales procedures.",
    ],

    "ops_admin": [
        _TOOLS_CHECK_PLACEHOLDER,
        "Use search_knowledge to review your training on scheduling and document handling. Save a memory note confirming you're ready to manage operations.",
    ],

    "hr": [
        _TOOLS_CHECK_PLACEHOLDER,
        "Use search_knowledge to review your training on onboarding procedures and confidentiality rules. Save a memory note confirming you understand your confidentiality obligations.",
    ],
}

DEFAULT_BOOTSTRAP_TASKS = [
    "Take a screenshot of your desktop to confirm everything is working. Save a memory note that you are ready to begin work.",
]


def get_bootstrap_tasks(role: str, tools: list = None) -> list:
    """tools: liste des outils connectés par le client (permissions()['tools']).
    Remplace le placeholder de vérification d'outils par une instruction
    concrète, résolue avec les vrais noms/URLs plutôt qu'un texte générique.
    """
    raw_tasks = ROLE_BOOTSTRAP_TASKS.get(role, DEFAULT_BOOTSTRAP_TASKS)
    return [
        _connected_tools_instruction(tools or []) if t == _TOOLS_CHECK_PLACEHOLDER else t
        for t in raw_tasks
    ]
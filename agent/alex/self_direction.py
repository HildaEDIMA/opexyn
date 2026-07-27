"""
self_direction.py — Auto-assignation de tâches quand l'agent est idle.

Quand la queue d'instructions reste vide pendant WAKE_CHECK_INTERVAL_MINUTES,
l'agent loop appelle decide_next_action() pour se demander "que devrais-je
faire maintenant ?", en s'appuyant sur :
  - le briefing client (agent_instances.onboarding_data->>'briefing')
  - ses mémoires récentes (episodic_memory)
  - son plan persistant (agent_plan_tasks — géré par l'agent lui-même via
    l'outil `manage_plan`, jamais par ce module)

Il répond soit une instruction concrète, soit IDLE (None) s'il n'a pas assez
de contexte pour agir utilement — jamais de tâche inventée juste pour se
justifier. La queue d'instructions du client reste toujours prioritaire :
ce module n'est appelé QUE quand la queue est vide (voir agent_loop.run()).

Ce module ne décide JAMAIS lui-même quoi faire — il ne fait que rassembler
le contexte (briefing, mémoire, plan) et poser la question au modèle. Toute
la décision (piocher dans le plan, l'ignorer, checker un canal, replanifier)
reste au jugement du modèle, pas à une règle codée ici.
"""

from datetime import datetime
from typing import Optional

from anthropic import Anthropic
from sqlalchemy import text

from db import engine
from config import ANTHROPIC_API_KEY, AGENT_ID, AGENT_NAME, AGENT_ROLE
from memory.episodic import episodic_memory

client = Anthropic(api_key=ANTHROPIC_API_KEY)

# Sonnet 5 pour la décision — c'est un jugement ("que devrais-je faire là,
# maintenant ?"), pas une exécution mécanique, donc ça mérite un modèle plus
# capable que Haiku. Le budget de tokens est monté car l'adaptive thinking
# de Sonnet 5 consomme du budget avant même la réponse texte.
DECISION_MODEL = "claude-sonnet-5"
DECISION_MAX_TOKENS = 1024


def _get_briefing_and_limit() -> dict:
    """Récupère le briefing client + la limite d'auto-actions journalière
    + la liste des outils connectés (pour que le modèle sache ce qu'il a
    à sa disposition, sans qu'on lui impose quoi en faire)."""
    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT onboarding_data, daily_action_limit
                FROM agent_instances WHERE id = :aid
            """), {"aid": AGENT_ID}).fetchone()
        if row:
            onboarding = row[0] or {}
            return {
                "briefing": (onboarding.get("briefing") or "").strip(),
                "daily_action_limit": row[1] or 100,
                "tools": onboarding.get("tools", []),
            }
    except Exception as e:
        print(f"[{AGENT_NAME}] _get_briefing_and_limit failed: {e}")
    return {"briefing": "", "daily_action_limit": 100, "tools": []}


def _get_pending_plan() -> str:
    """Liste des tâches en attente dans le plan persistant de l'agent —
    lecture seule ici, la gestion (add/cancel/reprioritize) se fait
    exclusivement via l'outil manage_plan pendant execute()."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, description, priority, note FROM agent_plan_tasks
                WHERE agent_id = :aid AND status = 'pending'
                ORDER BY priority ASC, created_at ASC
            """), {"aid": AGENT_ID}).fetchall()
        if not rows:
            return "Plan is currently empty."
        return "\n".join(
            f"[{r[0]}] (P{r[2]}) {r[1]}" + (f" — {r[3]}" if r[3] else "")
            for r in rows
        )
    except Exception as e:
        print(f"[{AGENT_NAME}] _get_pending_plan failed: {e}")
        return "Could not read plan."


def _count_self_actions_today() -> int:
    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT COUNT(*) FROM agent_self_actions
                WHERE agent_id = :aid AND action_date = CURRENT_DATE
            """), {"aid": AGENT_ID}).fetchone()
        return row[0] if row else 0
    except Exception as e:
        print(f"[{AGENT_NAME}] _count_self_actions_today failed: {e}")
        # Par sécurité, si on ne peut pas vérifier le quota, on considère
        # qu'il est atteint plutôt que de risquer une boucle d'auto-actions
        # incontrôlée en cas de souci DB.
        return 10**9


def _record_self_action(instruction: str):
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO agent_self_actions (agent_id, action_date, instruction)
                VALUES (:aid, CURRENT_DATE, :instr)
            """), {"aid": AGENT_ID, "instr": instruction[:500]})
            conn.commit()
    except Exception as e:
        print(f"[{AGENT_NAME}] _record_self_action failed: {e}")


DECISION_SYSTEM_PROMPT_TEMPLATE = """You are {name}, an autonomous AI {role} employee.

You are not a passive assistant waiting to be told what to do. Like a good
employee left alone for a while, your default is to find something genuinely
useful to move things forward — not to sit idle until someone gives you an
instruction.

Nobody has given you an instruction for a while. Decide what you should do
right now, based on everything below. Use real judgment, not a fixed
checklist — the right answer changes with the situation.

CLIENT BRIEFING:
{briefing}

YOUR CONNECTED TOOLS: {tools}
(You decide if/when checking one of these is the right move right now —
no fixed rule says you must check them every cycle. If a communication tool
is connected and it's been a while since you looked, that's often worth
weighing — but it's your call, not a mandate.)

YOUR PENDING PLAN (tasks you previously decided were worth doing — added,
reprioritized, or left there by you via `manage_plan`):
{plan}

YOUR RECENT MEMORY:
{memories}

CURRENT DATE/TIME: {now}
SELF-ASSIGNED ACTIONS TODAY: {count}/{limit}

HOW TO DECIDE:
- Look at your plan first — if something on it is still relevant, that's
  often your best next action, since you already judged it worth doing.
  But don't execute it on autopilot: if the situation has moved on and an
  item no longer makes sense, you can cancel it (via `manage_plan`, once
  you're executing) instead of doing it anyway.
- Default to action. Look for something concrete and useful you can do that
  clearly serves the briefing: checking on something, following up, reviewing
  relevant training, preparing something for later, tidying up unfinished
  work, verifying that a tool/setup still works.
- Prefer tasks you can actually complete on your own right now over vague
  or open-ended ones.
- Check your memory first so you don't repeat something you already did
  recently — redundant work is worse than no work.
- Only reply IDLE if, after genuinely considering it, there is truly nothing
  useful to do: the briefing gives you no real direction, your plan is empty,
  and every reasonable next step was already done recently. IDLE should be
  the exception, not the default answer.
- Never invent artificial busywork just to have something to report.

RULES:
- If you found something worth doing, reply with ONLY that task, phrased as
  an instruction to yourself, in one or two sentences. Nothing else.
- Otherwise reply with EXACTLY: IDLE

Reply with either a single task instruction, or the single word IDLE.
Nothing else — no explanation, no preamble.
"""


async def decide_next_action() -> Optional[str]:
    """
    Interroge le modèle pour savoir si l'agent doit s'auto-assigner une tâche.
    Retourne l'instruction (str) à exécuter, ou None si IDLE / pas de
    contexte exploitable / quota journalier atteint.
    """
    ctx = _get_briefing_and_limit()
    briefing = ctx["briefing"]
    tools = ctx["tools"]
    plan = _get_pending_plan()

    # Avant, on s'arrêtait dès qu'il n'y avait pas de briefing. Mais un plan
    # non-vide ou des outils connectés sont eux aussi un contexte exploitable
    # — on ne bloque que si vraiment rien n'est disponible pour raisonner.
    if not briefing and not tools and plan == "Plan is currently empty.":
        return None

    limit = ctx["daily_action_limit"]
    count = _count_self_actions_today()
    if count >= limit:
        return None

    memories = episodic_memory.format_for_context()
    now = datetime.now().strftime("%A %d %B %Y, %H:%M")

    system = DECISION_SYSTEM_PROMPT_TEMPLATE.format(
        name=AGENT_NAME,
        role=AGENT_ROLE,
        briefing=briefing if briefing else "No briefing written yet.",
        tools=", ".join(tools) if tools else "None connected.",
        plan=plan,
        memories=memories if memories else "No previous memories.",
        now=now,
        count=count,
        limit=limit,
    )

    try:
        response = client.messages.create(
            model=DECISION_MODEL,
            max_tokens=DECISION_MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": "What should you do right now, if anything?"}],
        )
        text_out = "".join(
            block.text for block in response.content if hasattr(block, "text")
        ).strip()
    except Exception as e:
        print(f"[{AGENT_NAME}] decide_next_action failed: {e}")
        return None

    if not text_out or text_out.upper().startswith("IDLE"):
        return None

    _record_self_action(text_out)
    return text_out
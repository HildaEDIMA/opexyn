"""
agent_loop.py — Boucle agentique de l'agent

L'agent est autonome avec son propre ordinateur Linux virtuel.
Il reçoit des instructions via la queue `agent_state.instruction_queue`,
les exécute avec ses outils (bash, souris, clavier, screenshot, recherche
de connaissances métier), et respecte les règles d'autonomie définies par
le client (approbation humaine requise ou non, selon le mode et la catégorie
d'action).

Il gère aussi son propre plan de tâches persistant via l'outil `manage_plan` —
ce n'est PAS un backlog piloté par du code externe : l'agent décide lui-même
quoi y mettre, reprioriser, annuler, en fonction de son jugement.
"""

import asyncio
import subprocess
import base64
import os
import uuid
from datetime import datetime, timedelta
from anthropic import Anthropic

from browser.screenshot import streamer
from browser.session import browser_session
from memory.episodic import episodic_memory
from memory.retrieval import retrieval_memory
from state import agent_state
from permissions import get_permissions
from role_boostrap import get_bootstrap_tasks
from config import ANTHROPIC_API_KEY, CLIENT_ID, AGENT_ID, AGENT_NAME, AGENT_ROLE, WAKE_CHECK_INTERVAL_MINUTES
from self_direction import decide_next_action
from db import engine
from sqlalchemy import text


# ── Client Anthropic ──────────────────────────────────────────────────────────

client = Anthropic(api_key=ANTHROPIC_API_KEY)

APPROVAL_POLL_INTERVAL = 5       # secondes entre chaque vérification
APPROVAL_TIMEOUT_SECONDS = 600   # 10 minutes max d'attente avant timeout


# ── Définition des outils de l'agent ──────────────────────────────────────────

TOOLS = [
    {
        "name": "search_knowledge",
        "description": (
            "Search your training knowledge base and client-specific knowledge for "
            "information relevant to the current task. Use this whenever you need "
            "domain expertise, best practices, or specific procedures — before "
            "attempting a task you're unsure about. This searches both your "
            "professional training corpus (role-specific) and the specific client's "
            "business rules and preferences."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "What you want to know — phrase it as a natural question or topic, e.g. 'how to set up a CI/CD rollback strategy' or 'how to handle a refund request'"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "request_human_approval",
        "description": (
            "Request approval from your human supervisor before taking a consequential "
            "action. You MUST call this before acting whenever your autonomy rules require "
            "it for the category of action you're about to take (see AUTONOMY RULES in your "
            "system prompt). This pauses your work until the human responds (approved, "
            "rejected, or times out after 10 minutes — treated as rejected). Always wait for "
            "the result before proceeding with the action."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "action_description": {
                    "type": "string",
                    "description": "Clear, specific description of the action you want to take, so the human can make an informed decision. E.g. 'Send a 20% discount code to customer john@example.com to resolve their complaint about a late delivery.'"
                }
            },
            "required": ["action_description"]
        }
    },
    {
        "name": "playwright_action",
        "description": (
            "Interact with the browser using Playwright (reliable selectors, no coordinate guessing). "
            "Use this INSTEAD of mouse_click/keyboard_type whenever possible for web pages. "
            "Actions: 'navigate' (go to URL), 'click' (click a CSS selector), "
            "'fill' (type into an input field by selector), 'press' (press a key), "
            "'scroll' (scroll the page or a specific scrollable element — use this to scroll, "
            "NEVER simulate scrolling via repeated mouse_click or xdotool, clicking does not "
            "scroll and wastes turns), "
            "'evaluate' (run JavaScript), 'wait' (wait for a selector to appear), "
            "'get_text' (get text content of a selector), 'get_url' (current page URL)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["navigate", "click", "fill", "press", "scroll", "evaluate", "wait", "get_text", "get_url"],
                    "description": "The Playwright action to perform"
                },
                "url": {"type": "string", "description": "URL to navigate to (for 'navigate' action)"},
                "selector": {"type": "string", "description": "CSS selector or text selector for the target element. For 'scroll', optional: the specific scrollable container to scroll (e.g. a chat list div) — if omitted, scrolls the whole page."},
                "text": {"type": "string", "description": "Text to type (for 'fill' action) or key to press (for 'press' action)"},
                "script": {"type": "string", "description": "JavaScript to evaluate in the page (for 'evaluate' action)"},
                "amount": {"type": "integer", "description": "Pixels to scroll for 'scroll' action — positive scrolls down, negative scrolls up. Default 600.", "default": 600},
                "timeout": {"type": "integer", "description": "Timeout in milliseconds (default 10000)", "default": 10000}
            },
            "required": ["action"]
        }
    },
    {
        "name": "bash",
        "description": (
            "Execute a bash command on your Linux computer (Ubuntu, DISPLAY=:99). "
            "Use this for anything: navigate filesystem, create files/folders, "
            "download content, install packages, run scripts, check processes, etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "The bash command to execute"},
                "timeout": {"type": "integer", "description": "Timeout in seconds (default 30)", "default": 30}
            },
            "required": ["command"]
        }
    },
    {
        "name": "mouse_click",
        "description": (
            "Move the mouse to (x, y) and click on your virtual desktop (1280x800). "
            "Always take a screenshot first to know the current coordinates."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "x": {"type": "integer", "description": "X coordinate (0-1280)"},
                "y": {"type": "integer", "description": "Y coordinate (0-800)"},
                "button": {"type": "string", "enum": ["left", "right", "double"], "default": "left", "description": "Mouse button"}
            },
            "required": ["x", "y"]
        }
    },
    {
        "name": "keyboard_type",
        "description": "Type text or press a special key on your virtual desktop.",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Text to type character by character"},
                "key": {"type": "string", "description": "Special key to press. Examples: Return, Tab, Escape, ctrl+c, ctrl+v, ctrl+t, super, F5"}
            }
        }
    },
    {
        "name": "screenshot",
        "description": (
            "Take a screenshot of your current desktop and return it as base64. "
            "Use this to see the current state of the screen before clicking or typing."
        ),
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "open_app",
        "description": "Open an application on your virtual desktop.",
        "input_schema": {
            "type": "object",
            "properties": {
                "app": {
                    "type": "string",
                    "description": "Application to open. Known apps: 'chromium' (web browser), 'terminal' (xterm), 'files' (pcmanfm file manager). Or any other installed command."
                }
            },
            "required": ["app"]
        }
    },
    {
        "name": "save_memory",
        "description": (
            "Save an important note to your persistent memory. "
            "Use this for things to remember across sessions: "
            "credentials locations, client preferences, completed setups, etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "What to remember"},
                "importance": {"type": "integer", "enum": [1, 2, 3], "default": 1, "description": "1=normal, 2=important, 3=critical"}
            },
            "required": ["content"]
        }
    },
    {
        "name": "manage_plan",
        "description": (
            "View and manage your own task plan — a persistent list of things you intend "
            "to do, that survives across sessions. This is entirely yours to manage: add "
            "tasks when you identify useful work for later, reprioritize or cancel them "
            "when the situation changes, mark them done as you complete them. Nobody else "
            "decides this for you — use your judgment about what belongs on it and what "
            "doesn't anymore. Actions: "
            "'list' (see your current plan), "
            "'add' (add a new task — needs description, optional priority 1-3), "
            "'update_priority' (needs task_id, priority), "
            "'cancel' (needs task_id, optional note explaining why it's no longer relevant), "
            "'complete' (needs task_id — use when you finish a planned task outside of a "
            "normal execute() call, e.g. during self-directed work)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["list", "add", "update_priority", "cancel", "complete"]},
                "task_id": {"type": "string", "description": "Required for update_priority, cancel, complete"},
                "description": {"type": "string", "description": "Required for add"},
                "priority": {"type": "integer", "enum": [1, 2, 3], "description": "For add/update_priority (1=urgent, 2=normal, 3=if time allows)"},
                "note": {"type": "string", "description": "Optional context — e.g. why you're cancelling something"}
            },
            "required": ["action"]
        }
    },
    {
        "name": "notify_client",
        "description": (
            "Send a message directly to the client's chat, visible immediately in their "
            "dashboard — not buried in an internal log. Use this as soon as you're blocked "
            "and need something from the client to proceed (credentials, a decision, missing "
            "information), or whenever you have something important to tell them before you "
            "finish. This matters most for self-initiated tasks: never just give up silently "
            "in task_done without telling the client what you needed — they won't see that "
            "unless you notify_client first. You can call this mid-task, before task_done."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "The message to send to the client — clear, specific, and professional."}
            },
            "required": ["message"]
        }
    },
    {
        "name": "wait_for_human_handoff",
        "description": (
            "Use this when you're blocked by something a human must do physically in the "
            "browser — logging in, entering a 2FA code, solving a captcha — and you can "
            "resume automatically once they've done it. This sends your message to the "
            "client's chat, then polls the browser session and returns as soon as the page "
            "URL indicates the block is resolved (or after timeout_seconds). This is "
            "different from `notify_client`: use `wait_for_human_handoff` for a physical "
            "action to wait on and continue after; use `notify_client` (then `task_done`) "
            "for a decision or missing information where you should stop and let the "
            "client come back to you. Never use `task_done` for a physical blockage — "
            "use this instead."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "Message to the client explaining what you're waiting on — clear, specific, professional."},
                "check_url_contains": {"type": "string", "description": "A substring expected in the browser's URL once the block is resolved (e.g. a post-login path)."},
                "timeout_seconds": {"type": "integer", "description": "Max seconds to wait before giving up. Default 300 (5 minutes)."}
            },
            "required": ["message", "check_url_contains"]
        }
    },
    {
        "name": "task_done",
        "description": (
            "Signal that the current task is complete. Always call this when you have "
            "finished what was asked. The summary is sent DIRECTLY to the client's chat "
            "as-is — write it as a message to a non-technical client, not an internal log: "
            "2-3 sentences max, no markdown, no bullet points, plain conversational text. "
            "Never use task_done to report a blockage or an unfinished task: if you're "
            "stuck and need something from the client, call `notify_client` (or "
            "`wait_for_human_handoff` for a physical action like login/2FA/captcha) — "
            "task_done is for closing out completed work only."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "What was accomplished — sent verbatim to the client's chat. Plain text, 2-3 sentences, no markdown."}
            },
            "required": ["summary"]
        }
    }
]


# ── Exécution des outils ──────────────────────────────────────────────────────

def _run_bash_sync(command: str, timeout: int = 30) -> str:
    """Corps bloquant réel — ne JAMAIS appeler directement depuis du code
    async, toujours passer par _run_bash() ci-dessous."""
    env = {
        "DISPLAY": ":99",
        "HOME": "/root",
        "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    }
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True, timeout=timeout, env=env
        )
        out = result.stdout.strip()
        err = result.stderr.strip()
        if result.returncode == 0:
            return out if out else "OK"
        else:
            return f"ERROR (exit {result.returncode}): {err or out}"
    except subprocess.TimeoutExpired:
        return f"TIMEOUT: command exceeded {timeout}s"
    except Exception as e:
        return f"EXCEPTION: {e}"


async def _run_bash(command: str, timeout: int = 30) -> str:
    # subprocess.run() est bloquant. server.py (WebSocket /ws) et agent_loop.py
    # tournent dans le MÊME event loop du container — un bash bloquant ici gèle
    # aussi le handshake WebSocket du dashboard, qui time out côté client.
    # to_thread() délègue l'appel bloquant à un thread, sans geler la loop.
    return await asyncio.to_thread(_run_bash_sync, command, timeout)


async def _mouse_click(x: int, y: int, button: str = "left") -> str:
    btn_map = {"left": "1", "right": "3", "double": "1"}
    double_flag = "--repeat 2 --delay 100 " if button == "double" else ""
    cmd = f"xdotool mousemove {x} {y} click {double_flag}{btn_map.get(button, '1')}"
    return await _run_bash(cmd)


async def _keyboard_type(text: str = None, key: str = None) -> str:
    if text:
        safe = text.replace("'", "'\\''")
        return await _run_bash(f"xdotool type --clearmodifiers --delay 30 '{safe}'")
    elif key:
        return await _run_bash(f"xdotool key '{key}'")
    return "ERROR: provide either text or key"


def _open_app(app: str) -> str:
    known = {
        "chromium": "chromium --no-sandbox --disable-gpu --start-maximized",
        "terminal": "xterm",
        "files":    "pcmanfm",
    }
    cmd = known.get(app, app)
    try:
        subprocess.Popen(
            f"DISPLAY=:99 {cmd}",
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env={"DISPLAY": ":99", "HOME": "/root",
                 "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"}
        )
        return f"Launched {app}"
    except Exception as e:
        return f"ERROR: {e}"


async def _take_screenshot() -> str:
    path = "/app/screenshots/current.png"
    os.makedirs("/app/screenshots", exist_ok=True)
    result = await _run_bash(f"import -window root {path}")
    if "ERROR" in result:
        result = await _run_bash(f"scrot {path}")
    if "ERROR" in result:
        return f"Screenshot failed: {result}"
    try:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    except Exception as e:
        return f"Screenshot read failed: {e}"


# ── Plan persistant de l'agent ─────────────────────────────────────────────
# Contrairement à un backlog piloté par du code externe, ces fonctions ne
# décident jamais QUOI faire ou QUAND — elles se contentent de stocker et
# restituer ce que l'agent lui-même décide via l'outil `manage_plan`. Tout
# le jugement (prioriser, annuler, garder) reste côté modèle.

def _manage_plan(agent_id: str, action: str, task_id: str = None,
                  description: str = None, priority: int = 2, note: str = None) -> str:
    try:
        with engine.connect() as conn:
            if action == "list":
                rows = conn.execute(text("""
                    SELECT id, description, priority, note FROM agent_plan_tasks
                    WHERE agent_id = :aid AND status = 'pending'
                    ORDER BY priority ASC, created_at ASC
                """), {"aid": agent_id}).fetchall()
                if not rows:
                    return "Your plan is currently empty."
                return "\n".join(
                    f"[{r[0]}] (P{r[2]}) {r[1]}" + (f" — {r[3]}" if r[3] else "")
                    for r in rows
                )

            if action == "add":
                if not description:
                    return "ERROR: add requires a 'description'."
                new_id = str(uuid.uuid4())
                conn.execute(text("""
                    INSERT INTO agent_plan_tasks (id, agent_id, description, priority, note)
                    VALUES (:id, :aid, :desc, :prio, :note)
                """), {"id": new_id, "aid": agent_id, "desc": description, "prio": priority, "note": note})
                conn.commit()
                return f"Added to plan: [{new_id}] {description}"

            if action in ("update_priority", "cancel", "complete"):
                if not task_id:
                    return f"ERROR: {action} requires a 'task_id'."
                if action == "update_priority":
                    conn.execute(text("""
                        UPDATE agent_plan_tasks SET priority = :p
                        WHERE id = :id AND agent_id = :aid
                    """), {"p": priority, "id": task_id, "aid": agent_id})
                else:
                    status_map = {"cancel": "cancelled", "complete": "done"}
                    conn.execute(text("""
                        UPDATE agent_plan_tasks SET status = :s, note = :note, resolved_at = :t
                        WHERE id = :id AND agent_id = :aid
                    """), {"s": status_map[action], "note": note, "t": datetime.utcnow(),
                            "id": task_id, "aid": agent_id})
                conn.commit()
                return f"Task {task_id} updated ({action})."

            return f"Unknown action: {action}"
    except Exception as e:
        return f"manage_plan error: {e}"


# ── Approbation humaine ─────────────────────────────────────────────────────

async def _request_approval(action_description: str) -> str:
    """Crée une demande d'approbation en DB, notifie le dashboard en direct,
    puis attend la réponse du client (poll DB) jusqu'à résolution ou timeout."""

    approval_id = str(uuid.uuid4())

    try:
        with engine.connect() as conn:
            conn.execute(text("""
                INSERT INTO agent_approvals (id, agent_id, client_id, action_description, status, created_at)
                VALUES (:id, :agent_id, :client_id, :desc, 'pending', :now)
            """), {
                "id": approval_id,
                "agent_id": AGENT_ID,
                "client_id": CLIENT_ID,
                "desc": action_description,
                "now": datetime.utcnow(),
            })
            conn.commit()
    except Exception as e:
        return f"ERROR: could not create approval request ({e}) — treat as NOT approved, do not proceed."

    streamer.log_action(f"⏸ Awaiting approval: {action_description[:80]}", "info")
    await streamer.broadcast({
        "type": "approval_request",
        "approval_id": approval_id,
        "action_description": action_description,
        "timestamp": datetime.utcnow().isoformat(),
    })

    elapsed = 0
    while elapsed < APPROVAL_TIMEOUT_SECONDS:
        await asyncio.sleep(APPROVAL_POLL_INTERVAL)
        elapsed += APPROVAL_POLL_INTERVAL

        try:
            with engine.connect() as conn:
                row = conn.execute(text("""
                    SELECT status FROM agent_approvals WHERE id = :id
                """), {"id": approval_id}).fetchone()
        except Exception as e:
            continue

        if row and row[0] in ("approved", "rejected"):
            streamer.log_action(f"{'✓' if row[0] == 'approved' else '✗'} Approval {row[0]}", "info")
            return f"APPROVAL_{row[0].upper()}"

    # Timeout — on marque la demande comme telle et on refuse par sécurité
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                UPDATE agent_approvals SET status = 'timeout', resolved_at = :now WHERE id = :id
            """), {"id": approval_id, "now": datetime.utcnow()})
            conn.commit()
    except Exception:
        pass

    streamer.log_action("⏱ Approval request timed out — treated as rejected", "error")
    return "APPROVAL_TIMEOUT"


async def _execute_tool(tool_name: str, tool_input: dict) -> str:
    """Dispatch un appel d'outil et retourne le résultat sous forme de string."""

    streamer.log_action(f"→ {tool_name}", "info")

    if tool_name == "search_knowledge":
        if "query" not in tool_input:
            return "ERROR: search_knowledge requires a 'query' field."
        query = tool_input["query"]
        streamer.log_action(f"🔍 Searching knowledge: {query[:60]}", "info")
        try:
            return retrieval_memory.search(query)
        except Exception as e:
            return f"Knowledge search error: {e}"

    elif tool_name == "request_human_approval":
        if "action_description" not in tool_input:
            return "ERROR: request_human_approval requires an 'action_description' field."
        return await _request_approval(tool_input["action_description"])

    elif tool_name == "playwright_action":
        action = tool_input.get("action")
        if not action:
            return "ERROR: playwright_action requires an 'action' field."
        timeout = tool_input.get("timeout", 10000)
        streamer.log_action(f"[PW] {action} {tool_input.get('selector', tool_input.get('url', ''))[:60]}", "info")
        try:
            page = browser_session.page
            if page is None:
                return "ERROR: Browser not started"

            if action == "navigate":
                if "url" not in tool_input:
                    return "ERROR: navigate requires a 'url' field."
                await page.goto(tool_input["url"], wait_until="domcontentloaded", timeout=timeout)
                return f"Navigated to {tool_input['url']}"
            elif action == "click":
                if "selector" not in tool_input:
                    return "ERROR: click requires a 'selector' field."
                await page.click(tool_input["selector"], timeout=timeout)
                return f"Clicked {tool_input['selector']}"
            elif action == "fill":
                if "selector" not in tool_input or "text" not in tool_input:
                    return "ERROR: fill requires both 'selector' and 'text' fields."
                await page.fill(tool_input["selector"], tool_input["text"], timeout=timeout)
                return f"Filled {tool_input['selector']} with text"
            elif action == "press":
                if "text" not in tool_input:
                    return "ERROR: press requires a 'text' field (the key to press)."
                selector = tool_input.get("selector")
                key = tool_input["text"]
                if selector:
                    await page.press(selector, key, timeout=timeout)
                else:
                    await page.keyboard.press(key)
                return f"Pressed {key}"
            elif action == "scroll":
                amount = tool_input.get("amount", 600)
                selector = tool_input.get("selector")
                if selector:
                    moved = await page.evaluate(
                        "(sel, amt) => { const el = document.querySelector(sel); "
                        "if (!el) return false; el.scrollBy(0, amt); return true; }",
                        [selector, amount]
                    )
                    if not moved:
                        return f"ERROR: no element found for selector {selector} — cannot scroll it"
                    return f"Scrolled element '{selector}' by {amount}px"
                else:
                    await page.evaluate(f"window.scrollBy(0, {amount})")
                    return f"Scrolled page by {amount}px"
            elif action == "evaluate":
                if "script" not in tool_input:
                    return "ERROR: evaluate requires a 'script' field."
                result = await page.evaluate(tool_input["script"])
                return str(result)
            elif action == "wait":
                if "selector" not in tool_input:
                    return "ERROR: wait requires a 'selector' field."
                await page.wait_for_selector(tool_input["selector"], timeout=timeout)
                return f"Element {tool_input['selector']} is visible"
            elif action == "get_text":
                if "selector" not in tool_input:
                    return "ERROR: get_text requires a 'selector' field."
                text_content = await page.inner_text(tool_input["selector"])
                return text_content[:2000]
            elif action == "get_url":
                return page.url

            return f"Unknown playwright action: {action}"

        except Exception as e:
            return f"Playwright error: {e}"

    elif tool_name == "bash":
        if "command" not in tool_input:
            return "ERROR: bash requires a 'command' field."
        cmd = tool_input["command"]
        timeout = tool_input.get("timeout", 30)
        streamer.log_action(f"$ {cmd[:80]}", "info")
        result = await _run_bash(cmd, timeout)
        streamer.log_action(f"  {result[:120]}", "info")
        return result

    elif tool_name == "mouse_click":
        if "x" not in tool_input or "y" not in tool_input:
            return "ERROR: mouse_click requires both 'x' and 'y' coordinates. Take a screenshot first, then provide both."
        x, y = tool_input["x"], tool_input["y"]
        button = tool_input.get("button", "left")
        streamer.log_action(f"Click ({x},{y}) [{button}]", "info")
        return await _mouse_click(x, y, button)

    elif tool_name == "keyboard_type":
        text_val = tool_input.get("text")
        key = tool_input.get("key")
        if not text_val and not key:
            return "ERROR: keyboard_type requires either 'text' (to type) or 'key' (a special key to press)."
        label = f'"{text_val[:30]}"' if text_val else f"key:{key}"
        streamer.log_action(f"Type {label}", "info")
        return await _keyboard_type(text_val, key)

    elif tool_name == "screenshot":
        streamer.log_action("Taking screenshot...", "info")
        b64 = await _take_screenshot()
        if b64.startswith("Screenshot"):
            return b64
        return {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}}

    elif tool_name == "open_app":
        if "app" not in tool_input:
            return "ERROR: open_app requires an 'app' field."
        app = tool_input["app"]
        streamer.log_action(f"Opening {app}...", "info")
        result = _open_app(app)
        await asyncio.sleep(1.5)
        return result

    elif tool_name == "save_memory":
        if "content" not in tool_input:
            return "ERROR: save_memory requires a 'content' field."
        content = tool_input["content"]
        importance = tool_input.get("importance", 1)
        episodic_memory.save("agent_note", content, importance)
        return "Memory saved."

    elif tool_name == "manage_plan":
        if "action" not in tool_input:
            return "ERROR: manage_plan requires an 'action' field."
        return _manage_plan(
            AGENT_ID,
            action=tool_input["action"],
            task_id=tool_input.get("task_id"),
            description=tool_input.get("description"),
            priority=tool_input.get("priority", 2),
            note=tool_input.get("note"),
        )

    elif tool_name == "notify_client":
        if "message" not in tool_input:
            return "ERROR: notify_client requires a 'message' field."
        message = tool_input["message"]
        streamer.log_action(f"Message to client: {message[:80]}", "info")
        # Même format que les réponses de chat classiques (server.py) — le
        # dashboard n'a besoin d'aucune modif, ça arrive comme un message
        # normal dans la conversation plutôt que d'être enterré dans les logs.
        await streamer.broadcast({
            "type": "chat_reply",
            "content": message,
            "is_busy": agent_state.is_busy,
            "self_initiated": True,
            "timestamp": datetime.utcnow().isoformat()
        })
        return "Message sent to client."

    elif tool_name == "wait_for_human_handoff":
        if "message" not in tool_input or "check_url_contains" not in tool_input:
            return "ERROR: wait_for_human_handoff requires 'message' and 'check_url_contains' fields."
        message = tool_input["message"]
        check_url_contains = tool_input["check_url_contains"]
        timeout_seconds = tool_input.get("timeout_seconds", 300)

        await streamer.broadcast({
            "type": "chat_reply",
            "content": message,
            "is_busy": True,
            "self_initiated": True,
            "timestamp": datetime.utcnow().isoformat()
        })
        streamer.log_action(f"⏸ En attente: {message[:80]}", "info")

        elapsed = 0
        while elapsed < timeout_seconds:
            await asyncio.sleep(5)
            elapsed += 5
            page = browser_session.page
            if page and check_url_contains in page.url:
                streamer.log_action("✓ Débloqué — reprise", "info")
                return "HANDOFF_RESOLVED"

        streamer.log_action("⏱ Handoff expiré", "error")
        return "HANDOFF_TIMEOUT"

    elif tool_name == "task_done":
        if "summary" not in tool_input:
            return "ERROR: task_done requires a 'summary' field."
        summary = tool_input["summary"]
        # Garde-fou : le résumé de task_done était parfois enterré dans les logs
        # techniques sans jamais atteindre le chat client. On force sa visibilité
        # ici, au niveau du code, plutôt que de compter sur le modèle pour avoir
        # pensé à appeler notify_client avant de clôturer.
        await streamer.broadcast({
            "type": "chat_reply",
            "content": summary,
            "is_busy": False,
            "self_initiated": True,
            "timestamp": datetime.utcnow().isoformat()
        })
        streamer.log_action(f"✓ {summary}", "done")
        return f"TASK_DONE:{summary}"

    return f"Unknown tool: {tool_name}"


# ── Boucle agentique principale ───────────────────────────────────────────────

class AgentRuntime:
    """
    L'agent reçoit une instruction texte, l'exécute en boucle tool-use
    jusqu'à appeler task_done, puis retourne son résumé.
    """

    def __init__(self):
        self.stats = {
            "tasks_completed": 0,
            "started_at": datetime.utcnow().isoformat()
        }

    # ── Contexte système ──────────────────────────────────────────────────────

    def _build_autonomy_section(self, is_self_directed: bool = False) -> str:
        perms = get_permissions()
        mode = perms.get("autonomy_mode", "learning")
        rules = perms.get("rules", {})

        if mode == "learning":
            base = (
                "AUTONOMY RULES — LEARNING MODE:\n"
                "You are currently in LEARNING MODE. You MUST call `request_human_approval` "
                "before taking ANY consequential action — sending a message, making a change, "
                "spending money, deleting data, or anything that affects the outside world or "
                "the client's systems. Read-only actions (browsing, searching, checking status) "
                "do not require approval. When in doubt, ask for approval."
            )
        else:
            lines = ["AUTONOMY RULES — AUTONOMOUS MODE:"]
            if rules:
                for category, setting in rules.items():
                    readable = category.replace("_", " ")
                    if setting == "validate" or setting == "always_alert":
                        lines.append(f"- For '{readable}' actions: call `request_human_approval` BEFORE acting.")
                    else:
                        lines.append(f"- For '{readable}' actions: you may act autonomously, no approval needed.")
            else:
                lines.append("No specific rules configured — use `request_human_approval` for anything that spends money, deletes data, or has irreversible consequences.")

            lines.append(
                "For any action that doesn't clearly match a category above but is irreversible, "
                "high-stakes, or involves spending money or deleting data: always call "
                "`request_human_approval` first, regardless of category."
            )
            base = "\n".join(lines)

        if is_self_directed:
            # Tâche que l'agent s'est lui-même assignée (decide_next_action), pas une
            # demande du client. Même en LEARNING MODE, on ne le fait pas attendre une
            # approbation humaine pour du travail sans risque qu'il a initié seul —
            # sinon l'auto-direction devient juste une source d'attente et perd tout
            # son intérêt. Les actions à effet réel restent soumises à approbation,
            # comme pour une tâche demandée par le client.
            base += (
                "\n\nNOTE — this task is self-initiated by you, not requested by the client. "
                "You may freely take actions that are read-only or have no real-world effect "
                "(browsing, searching, reviewing training/knowledge, checking status, preparing "
                "notes) without approval, even in learning mode. If completing this task would "
                "require an action with a real effect (sending something, changing data, "
                "spending money), call `request_human_approval` before doing it, exactly as you "
                "would for a client-requested task. If you get blocked on something only the "
                "client can resolve (missing credentials, a decision, information you don't "
                "have), call `notify_client` to tell them directly — then use task_done to close "
                "out the task. Don't just stop quietly; the client won't see a task_done summary "
                "unless you also notify_client."
            )

        return base

    def _build_system_prompt(self, is_self_directed: bool = False) -> str:
        memories = episodic_memory.format_for_context()
        plan = _manage_plan(AGENT_ID, "list")
        now = datetime.now().strftime("%A %d %B %Y, %H:%M")
        autonomy_section = self._build_autonomy_section(is_self_directed)

        return f"""You are {AGENT_NAME}, an autonomous AI {AGENT_ROLE} employee with your own Linux computer.

COMPUTER SPECS:
- OS: Ubuntu Linux
- Display: :99 (virtual, 1280×800, managed by Xvfb)
- Desktop: Openbox window manager
- Desktop path: /root/Bureau/
- Browser: Chromium controlled by Playwright (available via playwright_action tool)
- Available: bash, xdotool, wget, curl, python3, imagemagick

{autonomy_section}

YOUR MEMORY (from previous sessions):
{memories if memories else "No previous memories."}

YOUR CURRENT PLAN (managed by you via `manage_plan` — nobody else decides this):
{plan}

CURRENT DATE/TIME: {now}

TOOL PRIORITY RULES:
0. **When facing a task requiring domain expertise** (technical procedures, best
   practices, specific methodologies): use `search_knowledge` FIRST to consult
   your training before acting. Don't rely solely on your general knowledge for
   role-specific tasks.

0b. **Before any consequential action**: check the AUTONOMY RULES above. If approval
   is required, call `request_human_approval` and WAIT for its result before proceeding.
   If the result is APPROVAL_REJECTED or APPROVAL_TIMEOUT, do NOT perform the action —
   report this back via task_done instead.

0c. **If you get blocked, distinguish WHAT kind of block it is:**
   - **Physical block a human must resolve in the browser** (login, 2FA, captcha) and you
     can resume automatically once it's done → call `wait_for_human_handoff`, NEVER
     `task_done`. It notifies the client and waits for you.
   - **Informational block** — missing credentials you can't get another way, a decision
     only the client can make, information you don't have → call `notify_client` to tell
     them directly in the chat as soon as you realize you need it, then close the task
     with `task_done`.
   Do NOT silently give up and only mention the blockage in the task_done summary: the
   client will not see that unless you notify_client or wait_for_human_handoff first.
   This matters most for self-initiated tasks, since nobody is already watching for your
   result. `task_done` is only for work that is actually finished — never use it to
   report an unfinished or blocked task.

0d. **Never attempt to read or extract stored credentials** — passwords, tokens, or
   session data saved by the browser or OS (e.g. querying Chromium's "Login Data" file,
   reading cookie/password stores, decrypting saved logins). If you need to be logged
   into a tool and aren't, that's a case for `notify_client` (ask the client to log in
   or provide credentials) or `request_human_approval`, never for digging through local
   credential storage yourself.

0e. **You own your plan.** `manage_plan` is not a fixed schedule handed to you — it's
   yours to maintain. Check it, add to it when you spot useful work for later, reprioritize
   or cancel entries as the situation changes. Use judgment, not a fixed rule: an urgent
   incoming message can justify dropping what you're doing to handle it now; a planned
   task that no longer makes sense given new information should be cancelled with a note
   explaining why, not left to rot silently. Decide based on what actually matters right
   now, not on rigid ordering.

1. **For web interactions (clicking, typing in websites, going to a URL)**: ALWAYS use `playwright_action` — never click the browser's address bar with mouse_click/keyboard_type to type a URL, that is slow, error-prone, and unnecessary when `playwright_action` (action="navigate") does it directly and reliably.
   - Use `playwright_action` with action="navigate" to go to URLs
   - Use `playwright_action` with action="click" and a CSS selector to click elements
   - Use `playwright_action` with action="fill" to type into input fields
   - Use `playwright_action` with action="press" to press keys (e.g. "Enter")
   - Use `playwright_action` with action="wait" to wait for elements to load
   - Use `playwright_action` with action="get_text" to read page content
   - Only fall back to mouse_click/xdotool for things that are genuinely not a web page (desktop apps, window management) — never as a substitute for navigating a URL.

1a. **To scroll anything on a web page** (a chat list, a feed, a long article): use
   `playwright_action` with action="scroll". Pass a `selector` if you need to scroll a
   specific container (e.g. a chat panel) rather than the whole page — if you don't know
   the right selector, use action="evaluate" with a short script to inspect the DOM first.
   NEVER attempt to scroll via repeated mouse_click, xdotool mousemove, or bash loops —
   clicking does not scroll, it will not work, and it burns through your turn budget for
   nothing. If you catch yourself trying the same click-based "scroll" more than once
   without the content changing, stop and switch to action="scroll" immediately.

1b. **Never explore your own backend or internal infrastructure** (localhost, ports 8000/8001, `/docs`, curl to internal services, etc.) unless a task explicitly asks you to. Those are not client tools or client data — if you're unsure what a task is asking you to check, re-read the task rather than defaulting to inspecting your own system.

2. **For GUI desktop interactions (non-browser)**: use screenshot first, then mouse_click/keyboard_type.

3. **For file system, scripts, processes**: use bash.

4. Take a screenshot after each major action to verify results.
5. Be autonomous and methodical. Break complex tasks into steps, verify each step.
6. When a task is done, call task_done with a clear summary of what you accomplished —
   2-3 sentences, plain text, no markdown, since it's shown verbatim in the client's chat.
7. If something fails, try an alternative approach before giving up.
8. Never ask for clarification mid-task — use your best judgment and report what you did.

COMMON SELECTORS FOR CHATGPT:
- Message input: 'div[contenteditable="true"]' or '#prompt-textarea'
- Send button: 'button[data-testid="send-button"]'
"""

    # ── DB helpers ────────────────────────────────────────────────────────────

    def _update_status(self, status: str):
        try:
            with engine.connect() as conn:
                conn.execute(text("""
                    UPDATE agent_instances
                    SET status = :s, updated_at = :t
                    WHERE id = :aid
                """), {"s": status, "t": datetime.utcnow(), "aid": AGENT_ID})
                conn.commit()
        except Exception as e:
            print(f"[{AGENT_NAME}] update_status failed: {e}")

    def _is_bootstrap_completed(self) -> bool:
        try:
            with engine.connect() as conn:
                row = conn.execute(text("""
                    SELECT bootstrap_completed FROM agent_instances WHERE id = :aid
                """), {"aid": AGENT_ID}).fetchone()
                return bool(row and row[0])
        except Exception as e:
            print(f"[{AGENT_NAME}] bootstrap check failed: {e}")
            return True  # par sécurité, n'exécute pas la checklist en cas de doute

    def _mark_bootstrap_completed(self):
        try:
            with engine.connect() as conn:
                conn.execute(text("""
                    UPDATE agent_instances SET bootstrap_completed = TRUE WHERE id = :aid
                """), {"aid": AGENT_ID})
                conn.commit()
        except Exception as e:
            print(f"[{AGENT_NAME}] mark_bootstrap_completed failed: {e}")

    # ── Exécution d'une instruction ───────────────────────────────────────────

    async def execute(self, instruction: str, is_self_directed: bool = False) -> str:
        """
        Exécute une instruction en boucle agentique.
        Retourne le résumé final (summary de task_done) ou un message d'erreur.

        is_self_directed=True : la tâche vient de decide_next_action() (auto-
        assignée par l'agent), pas d'une instruction du client — voir
        _build_autonomy_section pour l'impact sur les règles d'approbation.
        """
        streamer.log_action(f"New task: {instruction[:80]}", "wake")
        self._update_status("working")
        agent_state.is_busy = True

        system = self._build_system_prompt(is_self_directed)
        messages = [{"role": "user", "content": instruction}]

        final_summary = None

        try:
            for turn in range(50):

                if turn == 40:
                    # Filet de sécurité : s'il reste occupé à 10 tours de la fin,
                    # mieux vaut qu'il découpe via manage_plan et clôture proprement
                    # plutôt que d'épuiser le budget en silence puis rapporter un
                    # échec vague ("max turns reached").
                    messages.append({
                        "role": "user",
                        "content": (
                            "You're approaching your turn limit for this task. If you won't "
                            "realistically finish in the next few turns, use `manage_plan` to "
                            "save the remaining work as a task with clear notes on what's left, "
                            "then call `task_done` summarizing what you completed so far. Don't "
                            "silently run out of turns."
                        )
                    })

                response = client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=4096,
                    system=system,
                    tools=TOOLS,
                    messages=messages
                )

                messages.append({"role": "assistant", "content": response.content})

                if response.stop_reason == "end_turn":
                    for block in response.content:
                        if hasattr(block, "text"):
                            final_summary = block.text
                            break
                    break

                if response.stop_reason == "tool_use":
                    tool_results = []
                    done = False

                    for block in response.content:
                        if block.type != "tool_use":
                            continue

                        # Un outil qui lève une exception ne doit jamais empêcher
                        # l'envoi du tool_result correspondant — sinon le tool_use
                        # reste orphelin dans `messages` et l'appel API suivant
                        # échoue en 400 ("tool_use ids were found without
                        # tool_result blocks"), tuant toute la tâche même si elle
                        # avait bien avancé.
                        try:
                            result = await _execute_tool(block.name, block.input)
                        except Exception as tool_error:
                            streamer.log_action(f"Tool error ({block.name}): {tool_error}", "error")
                            result = f"Tool execution error: {tool_error}"

                        if isinstance(result, str) and result.startswith("TASK_DONE:"):
                            final_summary = result[len("TASK_DONE:"):]
                            done = True

                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result if isinstance(result, str) else [result]
                        })

                    # Garde-fou final : si malgré tout un tool_use de ce tour n'a
                    # pas reçu de tool_result, on en génère un plutôt que d'envoyer
                    # un historique invalide à l'API.
                    returned_ids = {tr["tool_use_id"] for tr in tool_results}
                    for block in response.content:
                        if block.type == "tool_use" and block.id not in returned_ids:
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": "Tool execution error: no result was produced for this call.",
                                "is_error": True,
                            })

                    messages.append({"role": "user", "content": tool_results})

                    if done:
                        break

            else:
                final_summary = "Task reached maximum steps (40). Partial work may have been done."
                streamer.log_action("Max turns reached", "error")

        except Exception as e:
            import traceback
            final_summary = f"Error during execution: {e}"
            streamer.log_action(f"Agent error: {e}", "error")
            print(f"[{AGENT_NAME}] execute() failed:\n{traceback.format_exc()}")

        finally:
            agent_state.is_busy = False
            self._update_status("active")
            self.stats["tasks_completed"] += 1

        summary = final_summary or "Task completed."
        streamer.log_action(f"Done: {summary[:80]}", "done")

        episodic_memory.save(
            "task_completed",
            f"[{datetime.now().strftime('%H:%M')}] {instruction[:100]} → {summary[:150]}",
            importance=1
        )

        return summary

    # ── Checklist de démarrage par rôle ──────────────────────────────────────

    async def run_bootstrap_if_needed(self) -> bool:
        """Exécute la checklist de démarrage propre au rôle, une seule fois.

        Retourne True si le bootstrap vient d'être exécuté pour la première
        fois (permet à run() de déclencher un kickoff immédiat au lieu de
        laisser l'agent silencieux jusqu'au premier cycle de veille).
        """
        if self._is_bootstrap_completed():
            return False

        tasks = get_bootstrap_tasks(AGENT_ROLE, get_permissions().get("tools", []))
        streamer.log_action(f"Running first-time setup for {AGENT_NAME} ({len(tasks)} steps)...", "wake")

        for i, task in enumerate(tasks, 1):
            streamer.log_action(f"Setup step {i}/{len(tasks)}", "info")
            await self.execute(task)

        self._mark_bootstrap_completed()
        streamer.log_action(f"{AGENT_NAME} setup complete — ready for instructions.", "done")
        return True

    # ── Exécution d'une tâche auto-assignée ────────────────────────────────────

    async def _execute_self_directed(self, instruction: str):
        """Exécute une tâche auto-assignée et envoie TOUJOURS le résumé final
        dans le chat, que le modèle ait pensé ou non à appeler `notify_client`
        lui-même. On a vu l'agent prétendre avoir notifié le client dans son
        résumé sans avoir réellement appelé l'outil — plutôt que de compter
        sur la fiabilité du modèle pour ça, on garantit la visibilité au
        niveau du code.
        """
        summary = await self.execute(instruction, is_self_directed=True)
        if summary:
            await streamer.broadcast({
                "type": "chat_reply",
                "content": summary,
                "is_busy": False,
                "self_initiated": True,
                "timestamp": datetime.utcnow().isoformat()
            })

    # ── Boucle principale — attend les instructions ───────────────────────────

    async def run(self):
        """
        Boucle principale de l'agent.

        La queue d'instructions du client reste TOUJOURS prioritaire : dès
        qu'une instruction y arrive, elle interrompt immédiatement l'attente
        (asyncio.wait_for retourne dès que la queue a un item, peu importe
        le timeout restant).

        Si rien n'arrive pendant `current_interval` secondes (initialement
        WAKE_CHECK_INTERVAL_MINUTES), l'agent se demande s'il doit s'auto-
        assigner une tâche via decide_next_action() — qui voit maintenant
        aussi son plan persistant (`manage_plan`) et peut piocher dedans au
        lieu d'improviser à chaque fois. S'il reste IDLE plusieurs fois de
        suite, l'intervalle double (backoff, plafonné à 2x la base — réduit
        depuis 4x pour rester réactif sur les canaux de communication) pour
        éviter de payer un appel LLM toutes les 30 min sans raison. Il
        repasse à l'intervalle de base dès qu'une vraie instruction arrive
        ou qu'une auto-action est réellement exécutée.
        """
        self._update_status("active")
        just_onboarded = await self.run_bootstrap_if_needed()
        streamer.log_action(f"{AGENT_NAME} is ready.", "done")

        base_interval = WAKE_CHECK_INTERVAL_MINUTES * 60
        max_interval = base_interval * 2   # réduit de *4 à *2 — reste réactif
        current_interval = base_interval

        if just_onboarded:
            # Premier démarrage : l'agent vient de lire son briefing pendant
            # le bootstrap. On ne le laisse pas silencieux pendant
            # WAKE_CHECK_INTERVAL_MINUTES (30 min par défaut) — il doit
            # analyser le briefing et se lancer tout de suite s'il y a de
            # quoi faire, comme un nouvel employé qui commence sa journée
            # au lieu d'attendre qu'on vienne le voir.
            streamer.log_action(f"{AGENT_NAME} is reviewing the briefing to plan initial work...", "info")
            kickoff_instruction = await decide_next_action()
            if kickoff_instruction:
                streamer.log_action(f"Self-assigned: {kickoff_instruction[:80]}", "wake")
                await self._execute_self_directed(kickoff_instruction)

        while True:
            try:
                try:
                    instruction, reply_callback = await asyncio.wait_for(
                        agent_state.instruction_queue.get(),
                        timeout=current_interval
                    )
                except asyncio.TimeoutError:
                    streamer.log_action(
                        f"{AGENT_NAME} is idle — considering self-directed work...", "info"
                    )
                    self_instruction = await decide_next_action()

                    if self_instruction:
                        current_interval = base_interval
                        streamer.log_action(f"Self-assigned: {self_instruction[:80]}", "wake")
                        await self._execute_self_directed(self_instruction)
                    else:
                        current_interval = min(current_interval * 2, max_interval)
                        streamer.log_action(
                            f"{AGENT_NAME} stays idle — next check in {current_interval // 60} min.",
                            "info"
                        )
                    continue

                current_interval = base_interval
                streamer.log_action(f"Received: {instruction[:60]}", "info")

                summary = await self.execute(instruction)

                if reply_callback:
                    await reply_callback(summary)

                agent_state.instruction_queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                streamer.log_action(f"Run loop error: {e}", "error")
                await asyncio.sleep(2)


# Instance globale — un seul agent par container
agent_runtime = AgentRuntime()
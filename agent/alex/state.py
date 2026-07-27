"""
state.py — État partagé entre agent_loop et server.

Ni l'un ni l'autre ne s'importe mutuellement — ils passent par ici.
La queue est le seul canal de communication : server.py pousse une instruction,
agent_loop.py la consomme et appelle le callback avec la réponse.
"""

import asyncio
from typing import Callable, Optional, Tuple


class AgentState:
    def __init__(self):
        # File d'attente des instructions
        # Chaque item : (instruction: str, reply_callback: Callable | None)
        self.instruction_queue: asyncio.Queue[Tuple[str, Optional[Callable]]] = asyncio.Queue()

        # True pendant qu'Alex exécute une tâche
        self.is_busy: bool = False

    async def push_instruction(self, instruction: str, reply_callback: Optional[Callable] = None):
        """
        Pousse une instruction dans la queue.
        reply_callback(summary: str) sera appelé par agent_loop quand la tâche est finie.
        """
        await self.instruction_queue.put((instruction, reply_callback))


# Instance globale — importée par agent_loop ET server
agent_state = AgentState()
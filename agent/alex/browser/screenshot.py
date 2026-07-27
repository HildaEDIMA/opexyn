import asyncio
import base64
import json
from datetime import datetime
from .session import browser_session
from config import AGENT_NAME

class ScreenshotStreamer:
    def __init__(self):
        self.clients = set()
        self.is_streaming = False
        self.current_screenshot = None
        self.current_action = "idle"
        self.actions_log = []

    def add_client(self, websocket):
        self.clients.add(websocket)

    def remove_client(self, websocket):
        self.clients.discard(websocket)

    def log_action(self, action: str, status: str = "running"):
        """Log une action d'Alex"""
        entry = {
            "time": datetime.now().strftime("%H:%M:%S"),
            "action": action,
            "status": status
        }
        self.actions_log.append(entry)
        if len(self.actions_log) > 50:
            self.actions_log = self.actions_log[-50:]
        self.current_action = action
        print(f"[{AGENT_NAME}] {action}")

    async def broadcast(self, data: dict):
        """Envoie les données à tous les clients connectés"""
        if not self.clients:
            return

        message = json.dumps(data)
        disconnected = set()

        for client in self.clients:
            try:
                await client.send_text(message)
            except Exception:
                disconnected.add(client)

        self.clients -= disconnected

    async def start_streaming(self, interval_seconds: int = 3):
        """Stream les screenshots en continu"""
        self.is_streaming = True

        try:
            while self.is_streaming and self.clients:
                try:
                    if browser_session.is_running:
                        screenshot_bytes = await browser_session.take_screenshot()
                        screenshot_b64 = base64.b64encode(screenshot_bytes).decode()

                        await self.broadcast({
                            "type": "screenshot",
                            "data": screenshot_b64,
                            "action": self.current_action,
                            "logs": self.actions_log[-10:],
                            "timestamp": datetime.now().isoformat()
                        })
                except Exception as e:
                    print(f"[Screenshot] Erreur: {e}")

                await asyncio.sleep(interval_seconds)
        finally:
            # Toujours remettre à False — permet la relance si un nouveau client arrive
            self.is_streaming = False

    def stop_streaming(self):
        self.is_streaming = False


# Instance globale
streamer = ScreenshotStreamer()
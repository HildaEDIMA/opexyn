import os
import asyncio
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
from config import AGENT_ID, CLIENT_ID

SCREENSHOTS_DIR = "/app/screenshots"

CHROMIUM_PATH = "/usr/bin/chromium"

class BrowserSession:
    def __init__(self):
        self.playwright   = None
        self.browser: Browser        = None
        self.context: BrowserContext = None
        self.page: Page              = None
        self.is_running   = False
        self.current_action = "idle"

    async def start(self):
        """Démarre Chromium sur Xvfb — visible via noVNC"""
        self.playwright = await async_playwright().start()

        display = os.environ.get("DISPLAY", ":99")
        print(f"[Browser] Starting Chromium on display {display}")

        self.browser = await self.playwright.chromium.launch(
            headless=False,
            executable_path=CHROMIUM_PATH,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-extensions",
                "--start-maximized",
                f"--display={display}",
            ],
            env={"DISPLAY": display, "HOME": "/root"}
        )

        self.context = await self.browser.new_context(
            viewport={"width": 1024, "height": 768},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )

        self.page = await self.context.new_page()
        self.is_running = True
        print("[Browser] Chromium started on virtual display ✓")

    async def take_screenshot(self) -> bytes:
        os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
        return await self.page.screenshot(
            path=f"{SCREENSHOTS_DIR}/current.png",
            full_page=False
        )

    async def navigate(self, url: str):
        self.current_action = f"Navigating to {url}"
        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        print(f"[Browser] Navigated to {url}")

    async def check_gmail_session(self) -> bool:
        try:
            current_url = self.page.url
            if "mail.google.com" in current_url and "accounts.google" not in current_url:
                return True
            await self.navigate("https://mail.google.com")
            await asyncio.sleep(2)
            return "accounts.google.com" not in self.page.url
        except Exception as e:
            print(f"[Browser] Gmail check error: {e}")
            return False

    async def check_whatsapp_session(self) -> bool:
        try:
            await self.navigate("https://web.whatsapp.com")
            await asyncio.sleep(3)
            qr = await self.page.query_selector('[data-testid="qrcode"]')
            return qr is None
        except Exception as e:
            print(f"[Browser] WhatsApp check error: {e}")
            return False

    async def close(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        self.is_running = False


browser_session = BrowserSession()
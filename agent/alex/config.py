import os
from dotenv import load_dotenv

load_dotenv()

# Identité de l'agent — injectée dynamiquement par l'orchestrateur
AGENT_ID = os.getenv("AGENT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")
AGENT_NAME = os.getenv("AGENT_NAME", "Agent")
AGENT_ROLE = os.getenv("AGENT_ROLE", "AI Employee")

# APIs
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# Cycle veille/éveil
SLEEP_DURATION_HOURS = int(os.getenv("SLEEP_DURATION_HOURS", "3"))
WAKE_CHECK_INTERVAL_MINUTES = int(os.getenv("WAKE_CHECK_INTERVAL_MINUTES", "30"))

# Confidence score minimum
MIN_CONFIDENCE_SCORE = float(os.getenv("MIN_CONFIDENCE_SCORE", "0.75"))

# Backend principal
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
INTERNAL_API_PORT = int(os.getenv("INTERNAL_API_PORT", "8001"))

# Screenshots
SCREENSHOT_INTERVAL_SECONDS = int(os.getenv("SCREENSHOT_INTERVAL_SECONDS", "3"))


VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY")
EMBEDDING_MODEL = "voyage-3"
EMBEDDING_DIM = 1024
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import auth, client, agent, billing

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(client.router, prefix="/api/client", tags=["client"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])

@app.get("/")
def root():
    return {"message": "Opexyn API is running"}
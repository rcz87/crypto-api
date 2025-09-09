from fastapi import FastAPI
from app.api import health, replay, heatmap, auth as auth_api, export, webhooks
from app.metrics import setup_metrics
from app.workers.scheduler import start_scheduler
from app.core.security import setup_security_middleware, setup_security_headers
from app.core.logging import setup_logging

# Setup logging
setup_logging()

app = FastAPI(
    title="Coinglass Full System",
    description="Advanced cryptocurrency trading data gateway with institutional-grade analytics",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Setup security middleware
setup_security_middleware(app)
setup_security_headers(app)

# Setup metrics and monitoring
setup_metrics(app)

# Include routers
app.include_router(health.router)
app.include_router(auth_api.router)
app.include_router(replay.router)
app.include_router(heatmap.router)
app.include_router(export.router)
app.include_router(webhooks.router)

@app.on_event("startup")
async def on_startup():
    """Application startup tasks"""
    start_scheduler()

@app.on_event("shutdown")
async def on_shutdown():
    """Application shutdown tasks"""
    from app.workers.scheduler import stop_scheduler
    stop_scheduler()
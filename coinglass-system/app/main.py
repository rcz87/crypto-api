from fastapi import FastAPI, HTTPException
from app.api import health, replay, heatmap, auth as auth_api, export, webhooks, advanced
from app.metrics import setup_metrics
from app.workers.scheduler import start_scheduler
from app.core.security import setup_security_middleware, setup_security_headers
from app.core.logging import setup_logging, logger
from app.core.settings import settings

# Setup logging
setup_logging()

def validate_startup_requirements():
    """Validate critical startup requirements"""
    if not settings.CG_API_KEY:
        logger.error("CG_API_KEY is required but not configured")
        raise HTTPException(
            status_code=500, 
            detail="Server configuration error: CG_API_KEY is missing. Please configure the API key before starting the service."
        )
    
    logger.info("Startup validation completed successfully")
    logger.info(f"Configured for environment: {settings.ENV}")
    logger.info(f"Monitoring symbols: {settings.SYMBOLS}")
    logger.info(f"Target exchanges: {settings.EXCHANGES}")

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
app.include_router(advanced.router)

@app.on_event("startup")
async def on_startup():
    """Application startup tasks"""
    validate_startup_requirements()
    start_scheduler()

@app.on_event("shutdown")
async def on_shutdown():
    """Application shutdown tasks"""
    from app.workers.scheduler import stop_scheduler
    stop_scheduler()
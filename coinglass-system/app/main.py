from fastapi import FastAPI
from app.api import health, replay, heatmap
from app.metrics import setup_metrics
from app.workers.scheduler import start_scheduler

app = FastAPI(title="Coinglass Full System")
app.include_router(health.router)
app.include_router(replay.router)
app.include_router(heatmap.router)
setup_metrics(app)

@app.on_event("startup")
def on_startup():
    start_scheduler()
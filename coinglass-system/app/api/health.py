from fastapi import APIRouter
from app.core.cache import redis_client
from app.core.db import check_db

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/live")
def live():
    return {"status": "ok"}

@router.get("/ready")
def ready():
    ok = True
    err = {}
    try:
        redis_client.ping()
    except Exception as e:
        ok = False; err["redis"] = str(e)
    try:
        check_db()
    except Exception as e:
        ok = False; err["db"] = str(e)
    return {"status": "ready" if ok else "degraded", "errors": err}
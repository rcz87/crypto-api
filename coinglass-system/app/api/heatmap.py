from fastapi import APIRouter
from sqlalchemy import text
from app.core.db import engine

router = APIRouter(prefix="/heatmap", tags=["heatmap"])

@router.get("/{symbol}")
def tiles(symbol: str, minutes: int = 60):
    sql = text(
        """
        SELECT ts_min, bucket, score, components
        FROM composite_heatmap
        WHERE symbol = :sym AND ts_min >= now() - ( :mins || ' minutes')::interval
        ORDER BY ts_min DESC
        """
    )
    with engine.begin() as conn:
        rows = conn.execute(sql, {"sym": symbol.upper(), "mins": minutes}).mappings().all()
    return {"symbol": symbol.upper(), "tiles": [dict(r) for r in rows]}
from fastapi import APIRouter
from app.core.coinglass_client import CoinglassClient

router = APIRouter(prefix="/replay", tags=["replay"])

@router.get("/oi/{symbol}")
def replay_oi(symbol: str, interval: str = "1h"):
    return CoinglassClient().oi_ohlc(symbol.upper(), interval, aggregated=True)
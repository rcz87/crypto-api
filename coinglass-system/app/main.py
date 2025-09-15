import os
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    COINGLASS_API_KEY: str | None = None
    PORT: int = int(os.getenv("PORT", "8000"))
    class Config:
        env_file = ".env"

settings = Settings()
app = FastAPI(title="CoinGlass Python Service")

# Setup Prometheus metrics BEFORE startup
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

@app.get("/health")
def health():
    return {"status": "ok", "has_key": bool(settings.COINGLASS_API_KEY)}

# placeholder route to confirm server works
@app.get("/advanced/whale/alerts")
def whale_alerts(symbol: str = "BTC"):
    # NOTE: replace with real implementation that calls CoinGlass v4 later
    return {"symbol": symbol, "status": "stub-ok"}

# Additional premium endpoints (stubs for now)
@app.get("/advanced/whale/positions")
def whale_positions(exchange: str = "binance"):
    return {"exchange": exchange, "positions": [], "status": "stub-ok"}

@app.get("/advanced/etf/bitcoin")
def bitcoin_etfs():
    return {"etfs": [], "status": "stub-ok"}

@app.get("/advanced/etf/flows")
def etf_flows(days: int = 30):
    return {"days": days, "flows": [], "status": "stub-ok"}

@app.get("/advanced/market/sentiment")
def market_sentiment():
    return {"sentiment": "neutral", "metrics": {}, "status": "stub-ok"}

@app.get("/advanced/market/coins")
def supported_coins():
    return {"coins": ["BTC", "ETH", "SOL"], "status": "stub-ok"}

@app.get("/advanced/liquidation/heatmap/{symbol}")
def liquidation_heatmap(symbol: str, timeframe: str = "1h"):
    return {"symbol": symbol, "timeframe": timeframe, "heatmap": [], "status": "stub-ok"}

@app.get("/advanced/spot/orderbook/{symbol}")
def spot_orderbook(symbol: str, exchange: str = "binance"):
    return {"symbol": symbol, "exchange": exchange, "orderbook": {"bids": [], "asks": []}, "status": "stub-ok"}

@app.get("/advanced/options/oi/{symbol}")
def options_oi(symbol: str = "BTC"):
    return {"symbol": symbol, "open_interest": 0, "status": "stub-ok"}

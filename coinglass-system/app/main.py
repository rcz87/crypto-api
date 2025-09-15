import os
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic_settings import BaseSettings

# Import router (use try-except for graceful handling)
try:
    from .routers.gpts_unified import router as gpts_router
    print("✅ GPT Actions router imported successfully")
except ImportError as e:
    print(f"❌ Failed to import GPT Actions router with relative import: {e}")
    try:
        import sys
        import os
        sys.path.append(os.path.dirname(__file__))
        from routers.gpts_unified import router as gpts_router
        print("✅ GPT Actions router imported successfully (absolute path)")
    except ImportError as e2:
        print(f"❌ Failed to import GPT Actions router with absolute path: {e2}")
        gpts_router = None

class Settings(BaseSettings):
    COINGLASS_API_KEY: str | None = None
    PORT: int = int(os.getenv("PORT", "8000"))
    class Config:
        env_file = ".env"

settings = Settings()
app = FastAPI(title="CoinGlass Python Service")

# Setup Prometheus metrics BEFORE startup
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Include GPT Actions unified router if available
if gpts_router is not None:
    app.include_router(gpts_router, tags=["GPT Actions"])

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

@app.get("/advanced/technical/atr")
def technical_atr(symbol: str = "BTC", timeframe: str = "1h"):
    # Placeholder ATR calculation - replace with real implementation
    atr_percent = 0.8 if symbol == "SOL" else 1.2 if symbol == "BTC" else 1.0
    return {
        "symbol": symbol, 
        "timeframe": timeframe,
        "atr_percent": atr_percent,
        "status": "stub-ok"
    }

@app.get("/advanced/ticker/{symbol}")
def ticker_data(symbol: str):
    # Placeholder price data - replace with real market data
    prices = {
        "SOL": 200.0,
        "BTC": 65000.0,
        "ETH": 3500.0
    }
    price = prices.get(symbol.upper(), 100.0)
    return {
        "symbol": symbol,
        "price": price,
        "last": price,
        "status": "stub-ok"
    }

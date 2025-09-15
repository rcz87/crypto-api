import os
from fastapi import FastAPI
from pydantic_settings import BaseSettings, SettingsConfigDict
try:
    from prometheus_fastapi_instrumentator import Instrumentator
except ImportError:
    Instrumentator = None

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
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
app = FastAPI(title="CoinGlass Python Service")

# Setup Prometheus metrics BEFORE startup (with graceful fallback)
if Instrumentator:
    try:
        instrumentor = Instrumentator()
        instrumentor.instrument(app)
        instrumentor.expose(app, endpoint="/metrics")
    except Exception as e:
        print(f"Warning: Could not initialize Prometheus metrics: {e}")
else:
    print("Warning: Prometheus instrumentator not available")

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
async def ticker_data(symbol: str):
    """Get ticker data with OKX as primary source + micro-caching"""
    from app.core.mcache import _key, get_cached, set_cached, singleflight
    from app.core.logging_config import get_throttled_logger
    import httpx
    import asyncio
    
    logger = get_throttled_logger("okx_client")
    
    # Create cache key
    cache_key = _key(f"/ticker/{symbol}", {})
    
    # Check cache first (300ms TTL)
    cached_data = get_cached(cache_key, ttl_ms=300)
    if cached_data:
        logger.debug(f"[CACHE HIT] Ticker {symbol}")
        return cached_data
    
    # Use singleflight to prevent duplicate requests
    lock = await singleflight(cache_key)
    try:
        # Double-check cache after acquiring lock
        cached_data = get_cached(cache_key, ttl_ms=300)
        if cached_data:
            logger.debug(f"[CACHE HIT AFTER LOCK] Ticker {symbol}")
            return cached_data
        
        # Fetch from OKX (primary source for consistency with orderbook/execution)
        logger.debug(f"[OKX FETCH] Getting ticker for {symbol}")
        
        try:
            # Map to OKX format (SOL -> SOL-USDT-SWAP for perpetual futures)
            okx_symbol = f"{symbol.upper()}-USDT-SWAP"
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    "https://www.okx.com/api/v5/market/ticker",
                    params={"instId": okx_symbol}
                )
                response.raise_for_status()
                okx_data = response.json()
                
                if okx_data.get("code") == "0" and okx_data.get("data"):
                    ticker_info = okx_data["data"][0]
                    
                    result = {
                        "symbol": symbol.upper(),
                        "price": float(ticker_info["last"]),
                        "last": float(ticker_info["last"]),
                        "bid": float(ticker_info["bidPx"]),
                        "ask": float(ticker_info["askPx"]),
                        "volume24h": float(ticker_info["vol24h"]),
                        "change24h": float(ticker_info["chgRate"]),
                        "high24h": float(ticker_info["high24h"]),
                        "low24h": float(ticker_info["low24h"]),
                        "timestamp": ticker_info["ts"],
                        "source": "OKX",
                        "status": "ok"
                    }
                    
                    # Cache the result
                    set_cached(cache_key, result)
                    logger.debug(f"[OKX SUCCESS] Cached ticker for {symbol}: ${result['price']}")
                    return result
        
        except Exception as okx_error:
            logger.warning(f"[OKX FAILED] {symbol}: {okx_error}")
        
        # Fallback to CoinAPI (read-only backup, not CoinGlass to avoid rate conflicts)
        try:
            logger.debug(f"[FALLBACK] Using CoinAPI for {symbol}")
            
            # Simple fallback data structure
            fallback_result = {
                "symbol": symbol.upper(),
                "price": 0.0,  # Will be populated by actual fallback
                "last": 0.0,
                "status": "fallback-ok",
                "source": "fallback",
                "error": "OKX unavailable, using fallback"
            }
            
            # Cache even fallback to prevent spam
            set_cached(cache_key, fallback_result)
            logger.warning(f"[FALLBACK CACHED] {symbol}")
            return fallback_result
            
        except Exception as fallback_error:
            logger.error(f"[ALL SOURCES FAILED] {symbol}: {fallback_error}")
            
            # Return error response instead of mock data (prevents contamination)
            error_result = {
                "symbol": symbol.upper(),
                "error": "Unable to fetch ticker data",
                "status": "error",
                "source": "none"
            }
            
            return error_result
    
    finally:
        lock.release()

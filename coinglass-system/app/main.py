import os
import traceback
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
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

# Global exception handlers to ensure JSON-only responses
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions and return JSON instead of HTML"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "ok": False,
            "error": exc.detail,
            "code": exc.status_code,
            "path": str(request.url.path),
            "method": request.method
        },
        headers=exc.headers if hasattr(exc, 'headers') else None,
    )

@app.exception_handler(HTTPException)
async def fastapi_http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTP exceptions and return JSON instead of HTML"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "ok": False,
            "error": exc.detail,
            "code": exc.status_code,
            "path": str(request.url.path),
            "method": request.method
        },
        headers=exc.headers if hasattr(exc, 'headers') else None,
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors and return JSON instead of HTML"""
    return JSONResponse(
        status_code=422,
        content={
            "ok": False,
            "error": "Validation failed",
            "code": 422,
            "details": exc.errors(),
            "path": str(request.url.path),
            "method": request.method
        },
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions and return JSON instead of HTML"""
    # Log the full traceback for debugging
    print(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    print(traceback.format_exc())
    
    return JSONResponse(
        status_code=500,
        content={
            "ok": False,
            "error": "Internal server error",
            "code": 500,
            "details": str(exc) if settings.PORT != 80 else "An unexpected error occurred",  # Hide details in production
            "path": str(request.url.path),
            "method": request.method
        },
    )

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

# Import and include the real CoinGlass API routes
try:
    from app.api.advanced import router as advanced_router
    from app.api.heatmap import router as heatmap_router
    # Mount with /advanced prefix to match expected URLs
    app.include_router(advanced_router, prefix="/advanced")
    app.include_router(heatmap_router)
    print("✅ Real CoinGlass API routes loaded successfully with /advanced prefix")
except ImportError as e:
    print(f"❌ Failed to load real CoinGlass API routes: {e}")

# ---- Symbol normalization helpers ----
def normalize_symbol_for_internal(symbol: str) -> str:
    """Normalize symbol to internal format (e.g., SOL-USDT -> SOL)"""
    s = (symbol or "").upper().strip()
    # Remove contract/pair indicators
    s = s.replace("_", "-")
    if s.endswith("-SWAP"):
        s = s[:-5]
    # SOL-USDT -> SOL, SOLUSDT -> SOL
    s = s.replace("-USDT", "").replace("USDT", "")
    # Handle other common pairs
    s = s.replace("-USD", "").replace("USD", "")
    return s

def map_symbol_for_exchange(symbol: str, exchange: str = "okx") -> str:
    """Map symbol to exchange-specific format"""
    s = (symbol or "").upper().strip()
    if exchange.lower() == "okx":
        # OKX prefers 'SOL-USDT'
        if "-" not in s and s.endswith("USDT"):
            s = s[:-4] + "-USDT"
        if not s.endswith("-USDT"):
            s = f"{s}-USDT"
        return s
    elif exchange.lower() == "binance":
        # Binance prefers 'SOLUSDT'
        return s.replace("-", "")
    # Default: return normalized internal format
    return normalize_symbol_for_internal(s)

@app.get("/health")
def health():
    return {"status": "ok", "has_key": bool(settings.COINGLASS_API_KEY)}

@app.get("/debug/routes")
def debug_routes():
    """🔍 Debug endpoint to enumerate all available routes"""
    routes = []
    for route in app.routes:
        try:
            path = getattr(route, 'path', None)
            methods = getattr(route, 'methods', None)
            if path:
                routes.append({
                    "path": path,
                    "methods": list(methods) if methods else ["GET"],
                    "name": getattr(route, 'name', ''),
                    "tags": getattr(route, 'tags', [])
                })
        except AttributeError:
            continue
    
    # Sort by path for readability
    routes.sort(key=lambda x: x['path'])
    
    return {
        "total_routes": len(routes),
        "py_base_url": "http://127.0.0.1:8000",
        "routes": routes
    }

@app.get("/institutional/bias")
def institutional_bias_root(symbol: str = "BTC"):
    """
    🎯 ROOT ENDPOINT - Institutional Bias (for Scheduler)
    
    This is the ROOT endpoint that schedulers expect.
    Redirects to /advanced/institutional/bias internally.
    """
    from app.api.advanced import get_institutional_bias
    return get_institutional_bias(symbol)

# Stub endpoints removed - real implementations loaded from app.api.advanced

@app.get("/advanced/technical/atr")
async def technical_atr(symbol: str = "BTC", timeframe: str = "1h"):
    """
    Real-time ATR (Average True Range) calculation from OKX API
    
    ATR Formula:
    1. True Range (TR) = max(high - low, |high - close_prev|, |low - close_prev|)
    2. ATR = average(TR) over 14 periods
    3. ATR% = (ATR / current_price) * 100
    """
    import httpx
    
    # Convert symbol to OKX format (BTC → BTC-USDT)
    internal_sym = normalize_symbol_for_internal(symbol)
    okx_symbol = f"{internal_sym}-USDT-SWAP"
    
    # Map timeframe to OKX format
    okx_timeframe_map = {
        "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
        "1h": "1H", "4h": "4H", "1d": "1D"
    }
    okx_bar = okx_timeframe_map.get(timeframe.lower(), "1H")
    
    try:
        # Fetch last 15 candles from OKX API
        async with httpx.AsyncClient(timeout=10.0) as client:
            okx_url = f"https://www.okx.com/api/v5/market/candles"
            params = {
                "instId": okx_symbol,
                "bar": okx_bar,
                "limit": "15"
            }
            
            response = await client.get(okx_url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data.get("code") != "0" or not data.get("data"):
                raise Exception(f"OKX API error: {data.get('msg', 'No data')}")
            
            # OKX candles format: [ts, open, high, low, close, volume, ...]
            candles = data["data"]
            
            if len(candles) < 2:
                raise Exception("Insufficient candle data")
            
            # Reverse to chronological order (oldest first)
            candles = list(reversed(candles))
            
            # Calculate True Range for each candle
            true_ranges = []
            for i in range(1, len(candles)):
                high = float(candles[i][2])    # High
                low = float(candles[i][3])     # Low
                prev_close = float(candles[i-1][4])  # Previous close
                
                # True Range = max(H-L, |H-PC|, |L-PC|)
                tr = max(
                    high - low,
                    abs(high - prev_close),
                    abs(low - prev_close)
                )
                true_ranges.append(tr)
            
            # Calculate ATR (average of last 14 True Ranges)
            atr_periods = min(14, len(true_ranges))
            atr = sum(true_ranges[-atr_periods:]) / atr_periods
            
            # Get current price (latest close)
            current_price = float(candles[-1][4])
            
            # ATR as percentage of current price
            atr_percent = (atr / current_price) * 100
            
            return {
                "symbol": normalize_symbol_for_internal(symbol).upper(),
                "original_symbol": symbol,
                "timeframe": timeframe,
                "atr_percent": round(atr_percent, 2),
                "atr_absolute": round(atr, 2),
                "current_price": round(current_price, 2),
                "candles_analyzed": len(candles),
                "source": "OKX",
                "status": "real-time"
            }
        
    except Exception as e:
        # Enhanced fallback with realistic estimates
        internal_symbol = normalize_symbol_for_internal(symbol).upper()
        
        # Realistic ATR estimates based on recent market volatility (Oct 2025)
        volatility_map = {
            "BTC": 1.2, "ETH": 1.6, "SOL": 2.1,
            "DOGE": 3.2, "XRP": 2.4, "ADA": 2.8,
            "AVAX": 2.5, "MATIC": 2.9, "DOT": 2.6,
            "LINK": 2.3, "UNI": 2.7, "ATOM": 2.5
        }
        
        fallback_atr = volatility_map.get(internal_symbol, 2.0)
        
        return {
            "symbol": internal_symbol,
            "timeframe": timeframe,
            "atr_percent": fallback_atr,
            "status": "fallback-estimated",
            "note": "OKX API unavailable, using recent volatility estimate",
            "error": str(e)
        }

@app.get("/advanced/ticker/{symbol}")
async def ticker_data(symbol: str):
    """
    Get ticker data with multi-provider fallback chain
    
    ENHANCED: Added proper symbol normalization and error handling.
    - Normalizes symbols: SOL-USDT, SOLUSDT, SOL-USDT-SWAP → SOL
    - Implements proper fallback: CoinGlass → CoinAPI → OKX (cache 60s)
    - Uses existing RealTimePriceService with proven multi-provider resilience
    - Returns 502 with clear errors instead of 500 for upstream failures
    - Returns DATA_UNAVAILABLE instead of misleading 0.0 when all providers fail
    """
    from app.api.advanced import RealTimePriceService
    from app.core.mcache import _key, get_cached, set_cached, singleflight
    from app.core.logging_config import get_throttled_logger
    from datetime import datetime
    
    logger = get_throttled_logger("ticker_service")
    
    try:
        # Normalize symbol like other routes do
        internal_symbol = normalize_symbol_for_internal(symbol)
        logger.info(f"[CoinGlass] Symbol mapping: {symbol} → {internal_symbol} for ticker")
        
        # Create cache key with normalized symbol
        cache_key = _key(f"/ticker/{internal_symbol}", {})
        
        # Check cache first (60s TTL for real price data)
        cached_data = get_cached(cache_key)
        if cached_data:
            logger.debug(f"[CACHE HIT] Ticker {internal_symbol} (age: {cached_data.get('age_sec', 'unknown')}s)")
            return cached_data
        
        # Use singleflight to prevent duplicate requests
        lock = await singleflight(cache_key)
        try:
            # Double-check cache after acquiring lock
            cached_data = get_cached(cache_key)
            if cached_data:
                logger.debug(f"[CACHE HIT AFTER LOCK] Ticker {internal_symbol}")
                return cached_data
            
            # Use proven RealTimePriceService with normalized symbol
            logger.debug(f"[MULTI-PROVIDER] Fetching {internal_symbol} via CoinGlass→CoinAPI→OKX")
            
            price_service = RealTimePriceService()
            live_price = await price_service.get_live_price(internal_symbol)
        
            if live_price and live_price > 0:
                # Success: got real price data from one of the providers
                result = {
                    "symbol": internal_symbol.upper(),
                    "original_symbol": symbol.upper(),
                    "price": live_price,
                    "last": live_price,
                    "timestamp": datetime.utcnow().isoformat() + 'Z',
                    "source": "CoinGlass→CoinAPI→OKX",
                    "status": "ok",
                    "cache_ttl": 60
                }
                
                # Cache successful result for 60s
                set_cached(cache_key, result, ttl=60)
                logger.info(f"[SUCCESS] {internal_symbol}: ${live_price:,.2f} cached for 60s")
                return result
            
            else:
                # All providers failed - return 502 with clear error
                logger.warning(f"[ALL PROVIDERS FAILED] {internal_symbol}: CoinGlass, CoinAPI, OKX all unavailable")
                
                error_result = {
                    "symbol": internal_symbol.upper(),
                    "original_symbol": symbol.upper(),
                    "status": "DATA_UNAVAILABLE",
                    "error": "All price providers unavailable (CoinGlass, CoinAPI, OKX)",
                    "providers_tried": ["CoinGlass", "CoinAPI", "OKX"],
                    "timestamp": datetime.utcnow().isoformat() + 'Z',
                    "source": "none"
                }
                
                # Short cache for error to prevent spam (5s instead of 60s)
                set_cached(cache_key, error_result, ttl=5)
                raise HTTPException(status_code=502, detail=f"Upstream returned empty ticker for {internal_symbol}")
        
        finally:
            lock.release()
    
    except HTTPException:
        raise
    except Exception as e:
        # Convert uncontrolled 500s to informative 502s
        logger.error(f"[TICKER ERROR] {symbol} → {normalize_symbol_for_internal(symbol)}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Ticker error for {symbol}: {type(e).__name__}: {e}")
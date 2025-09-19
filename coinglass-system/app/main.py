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

@app.get("/health")
def health():
    return {"status": "ok", "has_key": bool(settings.COINGLASS_API_KEY)}

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
    """
    Get ticker data with multi-provider fallback chain
    
    PATCH: Fixed OKX-only dependency causing 0.0 price fallbacks.
    - Implements proper fallback: CoinGlass → CoinAPI → OKX (cache 60s)
    - Uses existing RealTimePriceService with proven multi-provider resilience
    - Eliminates hardcoded 0.0 fallback data that contaminates GPT analysis
    - Returns DATA_UNAVAILABLE instead of misleading 0.0 when all providers fail
    """
    from app.api.advanced import RealTimePriceService
    from app.core.mcache import _key, get_cached, set_cached, singleflight
    from app.core.logging_config import get_throttled_logger
    from datetime import datetime
    
    logger = get_throttled_logger("ticker_service")
    
    # Create cache key with 60s TTL (user request: cache 60s)
    cache_key = _key(f"/ticker/{symbol}", {})
    
    # Check cache first (60s TTL for real price data)
    cached_data = get_cached(cache_key, ttl_ms=60000)  # 60s = 60000ms
    if cached_data:
        logger.debug(f"[CACHE HIT] Ticker {symbol} (age: {cached_data.get('age_sec', 'unknown')}s)")
        return cached_data
    
    # Use singleflight to prevent duplicate requests
    lock = await singleflight(cache_key)
    try:
        # Double-check cache after acquiring lock
        cached_data = get_cached(cache_key, ttl_ms=60000)
        if cached_data:
            logger.debug(f"[CACHE HIT AFTER LOCK] Ticker {symbol}")
            return cached_data
        
        # Use proven RealTimePriceService with multi-provider fallback
        logger.debug(f"[MULTI-PROVIDER] Fetching {symbol} via CoinGlass→CoinAPI→OKX")
        
        price_service = RealTimePriceService()
        live_price = await price_service.get_live_price(symbol)
        
        if live_price and live_price > 0:
            # Success: got real price data from one of the providers
            result = {
                "symbol": symbol.upper(),
                "price": live_price,
                "last": live_price,
                "timestamp": datetime.utcnow().isoformat() + 'Z',
                "source": "CoinGlass→CoinAPI→OKX",
                "status": "ok",
                "cache_ttl": 60
            }
            
            # Cache successful result for 60s
            set_cached(cache_key, result)
            logger.info(f"[SUCCESS] {symbol}: ${live_price:,.2f} cached for 60s")
            return result
        
        else:
            # All providers failed - return DATA_UNAVAILABLE instead of misleading 0.0
            logger.warning(f"[ALL PROVIDERS FAILED] {symbol}: CoinGlass, CoinAPI, OKX all unavailable")
            
            error_result = {
                "symbol": symbol.upper(),
                "status": "DATA_UNAVAILABLE",
                "error": "All price providers unavailable (CoinGlass, CoinAPI, OKX)",
                "providers_tried": ["CoinGlass", "CoinAPI", "OKX"],
                "timestamp": datetime.utcnow().isoformat() + 'Z',
                "source": "none"
            }
            
            # Short cache for error to prevent spam (5s instead of 60s)
            set_cached(cache_key, error_result, ttl_ms=5000)
            return error_result
    
    finally:
        lock.release()
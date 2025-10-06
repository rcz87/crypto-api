"""
Unified GPT Actions endpoint for CoinGlass Premium Intelligence.
Consolidates all 11 /advanced/* endpoints into a single interface.
Enhanced with unified symbol mapping to prevent API conflicts.
"""

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Union, Dict, Any
from enum import Enum

router = APIRouter()

# Unified Symbol Mapping for CoinGlass - mirrors shared/symbolMapping.ts
COINGLASS_SYMBOL_MAPPING = {
    # Major cryptocurrencies
    'BTC': 'BTC', 'ETH': 'ETH', 'SOL': 'SOL',
    
    # Layer 1 protocols
    'ADA': 'ADA', 'AVAX': 'AVAX', 'DOT': 'DOT', 'ATOM': 'ATOM', 'NEAR': 'NEAR',
    'ALGO': 'ALGO', 'FTM': 'FTM', 'LUNA': 'LUNA', 'ONE': 'ONE',
    
    # Layer 2 & Scaling solutions
    'MATIC': 'MATIC', 'ARB': 'ARB', 'OP': 'OP', 'LRC': 'LRC',
    
    # DeFi tokens
    'UNI': 'UNI', 'SUSHI': 'SUSHI', 'AAVE': 'AAVE', 'COMP': 'COMP',
    'MKR': 'MKR', 'SNX': 'SNX', 'CRV': 'CRV', '1INCH': '1INCH', 'YFI': 'YFI',
    
    # Meme coins
    'DOGE': 'DOGE', 'SHIB': 'SHIB', 'PEPE': 'PEPE', 'FLOKI': 'FLOKI',
    
    # Exchange tokens
    'BNB': 'BNB', 'CRO': 'CRO', 'FTT': 'FTT', 'LEO': 'LEO',
    
    # Privacy coins
    'XMR': 'XMR', 'ZEC': 'ZEC', 'DASH': 'DASH',
    
    # Enterprise & utility tokens
    'LINK': 'LINK', 'VET': 'VET', 'XLM': 'XLM', 'TRX': 'TRX',
    'THETA': 'THETA', 'HBAR': 'HBAR', 'ICP': 'ICP', 'EOS': 'EOS',
    
    # Gaming & NFT tokens
    'AXS': 'AXS', 'SAND': 'SAND', 'MANA': 'MANA', 'ENJ': 'ENJ', 'CHZ': 'CHZ',
    
    # AI & Infrastructure tokens
    'FET': 'FET', 'OCEAN': 'OCEAN', 'AGIX': 'AGIX', 'AR': 'AR', 'FIL': 'FIL',
    
    # Other major altcoins
    'LTC': 'LTC', 'BCH': 'BCH', 'XRP': 'XRP', 'ETC': 'ETC', 'BSV': 'BSV',
    'FLOW': 'FLOW', 'APT': 'APT', 'SUI': 'SUI', 'DYDX': 'DYDX', 'GMX': 'GMX',
    
    # Stablecoins
    'USDT': 'USDT', 'USDC': 'USDC', 'DAI': 'DAI', 'BUSD': 'BUSD'
}

def convert_user_symbol_to_coinglass(user_symbol: str) -> str:
    """
    Convert user-friendly symbol to CoinGlass format.
    
    PATCH: Fixed inconsistent symbol normalization across providers.
    - Handles mixed formats: SOL, SOLUSDT, SOL-USDT-SWAP → SOL (CoinGlass)
    - Eliminates "Unknown symbol" warnings by normalizing input formats first
    - Maintains fallback for genuine unknown symbols without spam warnings
    
    Args:
        user_symbol: User-friendly symbol (e.g., 'SOL', 'BTC', 'SOL-USDT-SWAP')
    Returns:
        CoinGlass-compatible symbol or normalized fallback
    """
    # Step 1: Normalize mixed input formats to user-friendly symbol
    normalized = user_symbol.upper().strip()
    
    # Handle provider-specific formats and extract base symbol
    if '-USDT-SWAP' in normalized:
        # OKX format: "SOL-USDT-SWAP" → "SOL"
        base_symbol = normalized.split('-')[0]
    elif 'USDT' in normalized and len(normalized) > 4:
        # Spot format: "SOLUSDT" → "SOL" 
        base_symbol = normalized.replace('USDT', '').replace('USD', '')
    elif '/' in normalized:
        # CoinAPI format: "SOL/USDT" → "SOL"
        base_symbol = normalized.split('/')[0]
    else:
        # Already user-friendly: "SOL" → "SOL"
        base_symbol = normalized
    
    # Step 2: Check if base symbol is in our comprehensive mapping
    mapped = COINGLASS_SYMBOL_MAPPING.get(base_symbol)
    
    # Use throttled logging to reduce spam
    from app.core.logging_config import get_throttled_logger
    logger = get_throttled_logger("symbol_mapping")
    
    if mapped:
        # Success: symbol found in mapping
        logger.debug(f"[CoinGlass] Symbol mapping: {user_symbol} → {mapped} for coinglass")
        return mapped
    else:
        # Fallback: return base symbol without warning spam
        # Only log genuine unknowns (not format variations)
        if base_symbol not in ['UNKNOWN', '']:
            logger.debug(f"[CoinGlass] Symbol mapping: {base_symbol} → {base_symbol} for coinglass (fallback)")
        return base_symbol

def validate_symbol_support(symbol: str) -> bool:
    """Check if a symbol is supported by the unified mapping."""
    return symbol.upper() in COINGLASS_SYMBOL_MAPPING

class OperationType(str, Enum):
    """Supported operations mapping to /advanced/* endpoints"""
    whale_alerts = "whale_alerts"
    whale_positions = "whale_positions"
    etf_flows = "etf_flows" 
    etf_bitcoin = "etf_bitcoin"
    market_sentiment = "market_sentiment"
    market_coins = "market_coins"
    atr = "atr"
    ticker = "ticker"
    liquidation_heatmap = "liquidation_heatmap"
    spot_orderbook = "spot_orderbook"
    options_oi = "options_oi"
    
    # CoinGlass Advanced Data
    oi_history = "oi_history"
    oi_aggregated = "oi_aggregated"
    funding_rate = "funding_rate"
    taker_volume = "taker_volume"
    
    # OKX Real-time Data (proxied to Node.js)
    cvd_analysis = "cvd_analysis"
    funding_rate_okx = "funding_rate_okx"
    open_interest_okx = "open_interest_okx"

class SingleOperationRequest(BaseModel):
    """Single operation request format"""
    op: OperationType = Field(..., description="Operation to perform")
    params: Dict[str, Any] = Field(default_factory=dict, description="Operation parameters")

class BatchOperationRequest(BaseModel):
    """Batch operations request format"""
    ops: List[SingleOperationRequest] = Field(..., description="Array of operations to perform", min_length=1, max_length=10)

class OperationResult(BaseModel):
    """Individual operation result"""
    ok: bool = Field(..., description="Operation success status")
    op: str = Field(..., description="Operation name")
    args: Dict[str, Any] = Field(..., description="Actual parameters used")
    data: Optional[Union[Dict[str, Any], List[Any]]] = Field(default=None, description="Operation result data")
    error: Optional[str] = Field(default=None, description="Error message if failed")

class SingleResponse(BaseModel):
    """Single operation response"""
    ok: bool = Field(..., description="Overall success status")
    op: str = Field(..., description="Operation name")
    args: Dict[str, Any] = Field(..., description="Actual parameters used")
    data: Optional[Union[Dict[str, Any], List[Any]]] = Field(default=None, description="Result data")
    error: Optional[str] = Field(default=None, description="Error message if failed")

class BatchResponse(BaseModel):
    """Batch operations response"""
    ok: bool = Field(..., description="Overall success status")
    results: List[OperationResult] = Field(..., description="Array of operation results")

# Operation configurations with endpoint mappings and smart defaults
# Endpoints without /advanced prefix since router is already mounted under /advanced
OPERATION_CONFIG = {
    "whale_alerts": {
        "endpoint": "/whale/alerts",
        "method": "GET",
        "defaults": {"exchange": "hyperliquid"},
        "query_params": ["exchange"],
        "path_params": []
    },
    "whale_positions": {
        "endpoint": "/whale/positions", 
        "method": "GET",
        "defaults": {"exchange": "binance", "symbol": "BTC"},
        "query_params": ["exchange", "symbol"],
        "path_params": []
    },
    "etf_flows": {
        "endpoint": "/etf/flows",
        "method": "GET", 
        "defaults": {"asset": "BTC", "window": "1d"},
        "query_params": ["asset", "window", "days"],
        "path_params": []
    },
    "etf_bitcoin": {
        "endpoint": "/etf/bitcoin",
        "method": "GET",
        "defaults": {},
        "query_params": [],
        "path_params": []
    },
    "market_sentiment": {
        "endpoint": "/market/sentiment",
        "method": "GET",
        "defaults": {},
        "query_params": [],
        "path_params": []
    },
    "market_coins": {
        "endpoint": "/market/coins",
        "method": "GET",
        "defaults": {"limit": 200},
        "query_params": ["limit"],
        "path_params": []
    },
    "atr": {
        "endpoint": "/technical/atr",
        "method": "GET",
        "defaults": {"symbol": "BTC", "tf": "1h", "len": 14},
        "query_params": ["symbol", "timeframe", "tf", "len"],
        "path_params": []
    },
    "ticker": {
        "endpoint": "/ticker/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "BTC"},
        "query_params": [],
        "path_params": ["symbol"]
    },
    "liquidation_heatmap": {
        "endpoint": "/liquidation/coin-history/{symbol}",
        "method": "GET", 
        "defaults": {"symbol": "BTC", "interval": "1h"},
        "query_params": ["interval"],
        "path_params": ["symbol"]
    },
    "spot_orderbook": {
        "endpoint": "/spot/orderbook/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "BTC", "exchange": "binance"},
        "query_params": ["exchange"],
        "path_params": ["symbol"]
    },
    "options_oi": {
        "endpoint": "/options/oi/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "BTC", "window": "1d"},
        "query_params": ["window"],
        "path_params": ["symbol"]
    },
    
    # CoinGlass Advanced Data Operations
    "oi_history": {
        "endpoint": "/oi/history/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "SOLUSDT", "interval": "1h"},
        "query_params": ["interval", "exchange"],
        "path_params": ["symbol"]
    },
    "oi_aggregated": {
        "endpoint": "/oi/aggregated/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "SOLUSDT", "interval": "1h"},
        "query_params": ["interval"],
        "path_params": ["symbol"]
    },
    "funding_rate": {
        "endpoint": "/funding/rate/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "SOLUSDT", "interval": "8h", "exchange": "OKX"},
        "query_params": ["interval", "exchange"],
        "path_params": ["symbol"]
    },
    "taker_volume": {
        "endpoint": "/taker-volume/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "SOLUSDT", "exchange": "OKX", "interval": "1h"},
        "query_params": ["exchange", "interval"],
        "path_params": ["symbol"]
    },
    
    # OKX Real-time Data Operations (Node.js proxy)
    "cvd_analysis": {
        "endpoint": "/api/{symbol}/cvd",
        "method": "GET",
        "defaults": {"symbol": "sol"},
        "query_params": [],
        "path_params": ["symbol"],
        "proxy_to": "nodejs"
    },
    "funding_rate_okx": {
        "endpoint": "/api/{symbol}/funding",
        "method": "GET",
        "defaults": {"symbol": "sol"},
        "query_params": [],
        "path_params": ["symbol"],
        "proxy_to": "nodejs"
    },
    "open_interest_okx": {
        "endpoint": "/api/{symbol}/open-interest",
        "method": "GET",
        "defaults": {"symbol": "sol"},
        "query_params": [],
        "path_params": ["symbol"],
        "proxy_to": "nodejs"
    }
}

async def execute_operation(operation: SingleOperationRequest, base_url: str) -> OperationResult:
    """Execute a single operation by proxying to the appropriate /advanced/* endpoint or Node.js OKX service"""
    op_name = operation.op.value
    
    if op_name not in OPERATION_CONFIG:
        return OperationResult(
            ok=False,
            op=op_name,
            args=operation.params,
            error=f"Unknown operation: {op_name}"
        )
    
    config = OPERATION_CONFIG[op_name]
    
    # Apply smart defaults and merge with provided params
    final_params = {**config["defaults"], **operation.params}
    
    # Apply unified symbol mapping for symbol-related parameters
    symbol_params = ['symbol', 'asset']  # Parameters that need symbol conversion
    for param in symbol_params:
        if param in final_params:
            original_symbol = final_params[param]
            # For OKX endpoints, keep lowercase (sol, btc, eth)
            if config.get("proxy_to") == "nodejs":
                final_params[param] = original_symbol.lower().replace('usdt', '').replace('-usdt-swap', '')
            else:
                # For CoinGlass, apply normal mapping
                mapped_symbol = convert_user_symbol_to_coinglass(original_symbol)
                final_params[param] = mapped_symbol
            
            # Log symbol mapping for monitoring
            print(f"[Symbol] {original_symbol} → {final_params[param]} for {op_name}")
    
    # Build endpoint URL with path parameters
    endpoint = config["endpoint"]
    for path_param in config["path_params"]:
        if path_param in final_params:
            endpoint = endpoint.replace(f"{{{path_param}}}", str(final_params[path_param]))
    
    # Build query parameters
    query_params = {}
    for param in config["query_params"]:
        if param in final_params:
            query_params[param] = final_params[param]
    
    # Determine target URL based on proxy configuration
    if config.get("proxy_to") == "nodejs":
        # Proxy to Node.js OKX service on port 5000
        target_url = f"http://127.0.0.1:5000{endpoint}"
    else:
        # Default: CoinGlass Python FastAPI on port 8000
        if not endpoint.startswith('/'):
            endpoint = '/' + endpoint
        target_url = f"{base_url}/advanced{endpoint}"
    
    # Make internal HTTP request
    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=config["method"],
                url=target_url,
                params=query_params,
                timeout=30.0
            )
            
            if response.status_code == 200:
                raw_data = response.json()
                
                # Handle Node.js response format {success: true, data: {...}}
                if isinstance(raw_data, dict) and "success" in raw_data:
                    if raw_data["success"]:
                        actual_data = raw_data.get("data", {})
                    else:
                        return OperationResult(
                            ok=False,
                            op=op_name,
                            args=final_params,
                            error=raw_data.get("error", "Unknown error from OKX service")
                        )
                else:
                    actual_data = raw_data
                
                # Format adapter: wrap arrays in dict structure for GPT Actions compatibility
                if isinstance(actual_data, list):
                    formatted_data = {
                        "items": actual_data,
                        "count": len(actual_data),
                        "type": "array",
                        "source": "okx_api" if config.get("proxy_to") == "nodejs" else "coinglass_api"
                    }
                else:
                    formatted_data = actual_data
                
                return OperationResult(
                    ok=True,
                    op=op_name,
                    args=final_params,
                    data=formatted_data
                )
            else:
                return OperationResult(
                    ok=False,
                    op=op_name,
                    args=final_params,
                    error=f"HTTP {response.status_code}: {response.text}"
                )
                
    except Exception as e:
        return OperationResult(
            ok=False,
            op=op_name,
            args=final_params,
            error=f"Request failed: {str(e)}"
        )

# ==============================================================================
# MISSING GPT ACTIONS ENDPOINTS - Implementing from OpenAPI spec
# ==============================================================================

@router.post("/gpts/coinglass/whale-data", response_model=SingleResponse)
async def whale_data_endpoint(
    request: Request,
    body: Optional[SingleOperationRequest] = None
) -> SingleResponse:
    """
    GPT Actions endpoint for whale detection data.
    Specialized interface for whale alerts and positions.
    """
    if body is None:
        body = SingleOperationRequest(op=OperationType.whale_alerts, params={})
    
    base_url = "http://127.0.0.1:8000"
    result = await execute_operation(body, base_url)
    
    return SingleResponse(
        ok=result.ok,
        op=result.op,
        args=result.args,
        data=result.data,
        error=result.error
    )

@router.post("/gpts/coinglass/live-template", response_model=SingleResponse) 
async def live_template_endpoint(
    request: Request,
    body: Optional[SingleOperationRequest] = None
) -> SingleResponse:
    """
    GPT Actions endpoint for live market template data.
    Provides standardized market overview templates.
    """
    if body is None:
        body = SingleOperationRequest(op=OperationType.market_sentiment, params={})
    
    base_url = "http://127.0.0.1:8000"
    result = await execute_operation(body, base_url)
    
    return SingleResponse(
        ok=result.ok,
        op=result.op,
        args=result.args,
        data=result.data,
        error=result.error
    )

@router.get("/gpts/unified/symbols")
async def unified_symbols_endpoint():
    """
    GPT Actions endpoint to get all supported symbols.
    Returns the complete list of supported cryptocurrency symbols.
    """
    return {
        "ok": True,
        "symbols": list(COINGLASS_SYMBOL_MAPPING.keys()),
        "count": len(COINGLASS_SYMBOL_MAPPING),
        "source": "coinglass_unified_mapping"
    }

@router.get("/gpts/health")
async def gpts_health_endpoint():
    """
    GPT Actions health check endpoint.
    Verifies GPT Actions endpoints are operational.
    """
    return {
        "status": "ok",
        "service": "coinglass_gpt_actions",
        "version": "4.0.1",
        "endpoints": [
            "/gpts/coinglass/whale-data",
            "/gpts/coinglass/live-template", 
            "/gpts/unified/advanced",
            "/gpts/unified/symbols",
            "/gpts/health"
        ],
        "ready": True
    }

@router.post("/gpts/advanced", response_model=Union[SingleResponse, BatchResponse])
async def unified_advanced_endpoint(
    request: Request,
    body: Union[SingleOperationRequest, BatchOperationRequest]
) -> Union[SingleResponse, BatchResponse]:
    """
    Unified GPT Actions endpoint for all CoinGlass Premium Intelligence.
    
    Consolidates all 11 /advanced/* endpoints into a single interface supporting:
    - Single operations: {op: "ticker", params: {symbol: "SOL"}}
    - Batch operations: {ops: [{op: "whale_alerts", params: {...}}, ...]}
    
    Smart defaults reduce parameter complexity:
    - whale_alerts: min_usd=1,000,000
    - market_coins: limit=200  
    - liquidation_heatmap: timeframe="1h"
    - spot_orderbook: exchange="binance"
    - atr: tf="1h", len=14
    - etf_flows: window="1d"
    - options_oi: window="1d"
    """
    
    # Determine base URL for internal requests
    base_url = "http://127.0.0.1:8000"
    
    # Handle single operation
    if isinstance(body, SingleOperationRequest):
        result = await execute_operation(body, base_url)
        return SingleResponse(
            ok=result.ok,
            op=result.op,
            args=result.args,
            data=result.data,
            error=result.error
        )
    
    # Handle batch operations
    elif isinstance(body, BatchOperationRequest):
        results = []
        overall_success = True
        
        for operation in body.ops:
            result = await execute_operation(operation, base_url)
            results.append(result)
            if not result.ok:
                overall_success = False
        
        return BatchResponse(
            ok=overall_success,
            results=results
        )
    
    else:
        raise HTTPException(
            status_code=400,
            detail="Request must contain either 'op' (single) or 'ops' (batch) field"
        )
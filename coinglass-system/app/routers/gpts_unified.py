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
    Args:
        user_symbol: User-friendly symbol (e.g., 'SOL', 'BTC')
    Returns:
        CoinGlass-compatible symbol or original if not found
    """
    normalized = user_symbol.upper()
    mapped = COINGLASS_SYMBOL_MAPPING.get(normalized)
    
    if mapped:
        print(f"[SymbolMapping] {user_symbol} → {mapped} (CoinGlass)")
        return mapped
    else:
        print(f"[SymbolMapping] WARNING: Unknown symbol {user_symbol}, using as-is")
        return user_symbol

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

class SingleOperationRequest(BaseModel):
    """Single operation request format"""
    op: OperationType = Field(..., description="Operation to perform")
    params: Dict[str, Any] = Field(default_factory=dict, description="Operation parameters")

class BatchOperationRequest(BaseModel):
    """Batch operations request format"""
    ops: List[SingleOperationRequest] = Field(..., description="Array of operations to perform", min_items=1, max_items=10)

class OperationResult(BaseModel):
    """Individual operation result"""
    ok: bool = Field(..., description="Operation success status")
    op: str = Field(..., description="Operation name")
    args: Dict[str, Any] = Field(..., description="Actual parameters used")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Operation result data")
    error: Optional[str] = Field(default=None, description="Error message if failed")

class SingleResponse(BaseModel):
    """Single operation response"""
    ok: bool = Field(..., description="Overall success status")
    op: str = Field(..., description="Operation name")
    args: Dict[str, Any] = Field(..., description="Actual parameters used")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Result data")
    error: Optional[str] = Field(default=None, description="Error message if failed")

class BatchResponse(BaseModel):
    """Batch operations response"""
    ok: bool = Field(..., description="Overall success status")
    results: List[OperationResult] = Field(..., description="Array of operation results")

# Operation configurations with endpoint mappings and smart defaults
OPERATION_CONFIG = {
    "whale_alerts": {
        "endpoint": "/advanced/whale/alerts",
        "method": "GET",
        "defaults": {"symbol": "BTC", "min_usd": 1000000},
        "query_params": ["symbol", "min_usd"],
        "path_params": []
    },
    "whale_positions": {
        "endpoint": "/advanced/whale/positions", 
        "method": "GET",
        "defaults": {"exchange": "binance", "symbol": "BTC"},
        "query_params": ["exchange", "symbol"],
        "path_params": []
    },
    "etf_flows": {
        "endpoint": "/advanced/etf/flows",
        "method": "GET", 
        "defaults": {"asset": "BTC", "window": "1d"},
        "query_params": ["asset", "window", "days"],
        "path_params": []
    },
    "etf_bitcoin": {
        "endpoint": "/advanced/etf/bitcoin",
        "method": "GET",
        "defaults": {},
        "query_params": [],
        "path_params": []
    },
    "market_sentiment": {
        "endpoint": "/advanced/market/sentiment",
        "method": "GET",
        "defaults": {},
        "query_params": [],
        "path_params": []
    },
    "market_coins": {
        "endpoint": "/advanced/market/coins",
        "method": "GET",
        "defaults": {"limit": 200},
        "query_params": ["limit"],
        "path_params": []
    },
    "atr": {
        "endpoint": "/advanced/technical/atr",
        "method": "GET",
        "defaults": {"symbol": "BTC", "tf": "1h", "len": 14},
        "query_params": ["symbol", "timeframe", "tf", "len"],
        "path_params": []
    },
    "ticker": {
        "endpoint": "/advanced/ticker/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "BTC"},
        "query_params": [],
        "path_params": ["symbol"]
    },
    "liquidation_heatmap": {
        "endpoint": "/advanced/liquidation/heatmap/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "BTC", "timeframe": "1h"},
        "query_params": ["timeframe"],
        "path_params": ["symbol"]
    },
    "spot_orderbook": {
        "endpoint": "/advanced/spot/orderbook/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "BTC", "exchange": "binance"},
        "query_params": ["exchange"],
        "path_params": ["symbol"]
    },
    "options_oi": {
        "endpoint": "/advanced/options/oi/{symbol}",
        "method": "GET",
        "defaults": {"symbol": "BTC", "window": "1d"},
        "query_params": ["window"],
        "path_params": ["symbol"]
    }
}

async def execute_operation(operation: SingleOperationRequest, base_url: str) -> OperationResult:
    """Execute a single operation by proxying to the appropriate /advanced/* endpoint"""
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
            mapped_symbol = convert_user_symbol_to_coinglass(original_symbol)
            final_params[param] = mapped_symbol
            
            # Log symbol mapping for monitoring
            print(f"[CoinGlass] Symbol mapping: {original_symbol} → {mapped_symbol} for {op_name}")
    
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
    
    # Make internal HTTP request
    try:
        async with httpx.AsyncClient() as client:
            url = f"{base_url}{endpoint}"
            response = await client.request(
                method=config["method"],
                url=url,
                params=query_params,
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return OperationResult(
                    ok=True,
                    op=op_name,
                    args=final_params,
                    data=data
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
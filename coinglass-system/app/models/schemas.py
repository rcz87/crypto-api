from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any

class FuturesOIData(BaseModel):
    ts: datetime
    symbol: str
    interval: str
    aggregated: bool
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    oi_value: Optional[float] = None

class FundingRateData(BaseModel):
    ts: datetime
    symbol: str
    exchange: Optional[str] = None
    interval: str
    rate: Optional[float] = None
    rate_oi_weighted: Optional[float] = None

class LiquidationData(BaseModel):
    ts: datetime
    symbol: str
    side: str
    price: float
    qty: float
    exchange: Optional[str] = None
    bucket: Optional[float] = None
    meta: Optional[Dict[str, Any]] = None

class HeatmapTile(BaseModel):
    ts_min: datetime
    symbol: str
    bucket: float
    score: float
    components: Optional[Dict[str, Any]] = None

class AlertMessage(BaseModel):
    alert_type: str
    symbol: str
    message: str
    severity: str = "info"
    timestamp: datetime = datetime.now()

# === NEW SCHEMAS FOR COINGLASS V4 FEATURES ===

class WhaleAlert(BaseModel):
    exchange: str
    symbol: str
    side: str  # "long" or "short"
    position_size: float
    notional_value: float
    timestamp: Optional[datetime] = None
    meta: Optional[Dict[str, Any]] = None

class WhalePosition(BaseModel):
    exchange: str
    symbol: str
    side: str
    position_size: float
    notional_value: float
    unrealized_pnl: Optional[float] = None
    timestamp: Optional[datetime] = None

# === SEPARATE ETF MODELS BASED ON ENDPOINT STRUCTURE ===

class ETFAssetDetails(BaseModel):
    """Nested asset details from /api/etf/bitcoin/list"""
    update_date: Optional[str] = None  # String date from CoinGlass API
    update_timestamp: Optional[int] = None  # Milliseconds timestamp
    last_quote_time: Optional[int] = None  # Alternative timestamp

class ETFStatusItem(BaseModel):
    """Model for /api/etf/bitcoin/list - realtime status"""
    ticker: str
    fund_name: str
    aum: Optional[float] = None  # Assets Under Management
    nav: Optional[float] = None  # Net Asset Value
    closing_price: Optional[float] = None
    shares_outstanding: Optional[float] = None
    asset_details: Optional[ETFAssetDetails] = None

class ETFFlowHistory(BaseModel):
    """Model for /api/etf/bitcoin/flow-history - time-series data"""
    timestamp: int  # Milliseconds timestamp from API
    ticker: str
    net_flow: float  # Daily net inflow/outflow in USD
    closing_price: float
    shares_outstanding: Optional[float] = None

# Legacy support - keep existing ETFData for backward compatibility
class ETFData(BaseModel):
    ticker: str
    name: str
    aum: Optional[float] = None  # Assets Under Management
    nav: Optional[float] = None  # Net Asset Value
    price: Optional[float] = None
    flows_1d: Optional[float] = None
    flows_7d: Optional[float] = None
    flows_30d: Optional[float] = None
    timestamp: Optional[datetime] = None

class MarketSentiment(BaseModel):
    symbol: str
    price: float
    change_24h: float
    change_percentage_24h: float
    volume_24h: float
    market_cap: Optional[float] = None
    dominance: Optional[float] = None
    timestamp: Optional[datetime] = None

class LiquidationHeatmapData(BaseModel):
    symbol: str
    price_level: float
    liquidation_amount: float
    side: str  # "long" or "short"
    intensity: float  # Heat intensity score
    exchange: Optional[str] = None
    timestamp: Optional[datetime] = None

class SpotOrderbook(BaseModel):
    symbol: str
    exchange: str
    bids: list[list[float]]  # [[price, quantity], ...]
    asks: list[list[float]]  # [[price, quantity], ...]
    timestamp: Optional[datetime] = None

class OptionsData(BaseModel):
    symbol: str
    strike_price: float
    expiry_date: datetime
    option_type: str  # "call" or "put"
    open_interest: float
    volume_24h: float
    implied_volatility: Optional[float] = None
    timestamp: datetime

class SupportedCoin(BaseModel):
    symbol: str
    name: str
    is_active: bool = True
    supported_intervals: Optional[list[str]] = None
    exchange_availability: Optional[list[str]] = None

class SupportedCoinsResponse(BaseModel):
    data: list[SupportedCoin]
    count: int
    timestamp: datetime
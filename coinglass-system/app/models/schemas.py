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
from pydantic import BaseModel, validator, Field
from typing import Optional, List, Union, Dict, Any
from datetime import datetime
import re

class APIKeyRequest(BaseModel):
    user_id: str = Field(..., min_length=3, max_length=50)
    tier: str = Field(default="standard", pattern="^(standard|premium|enterprise)$")
    description: Optional[str] = Field(None, max_length=200)

class SymbolValidator(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=20)
    
    @validator('symbol')
    def symbol_must_be_uppercase(cls, v):
        if not re.match(r'^[A-Z0-9]+$', v):
            raise ValueError('Symbol must contain only uppercase letters and numbers')
        return v

class TimeRangeValidator(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    @validator('end_time')
    def end_time_after_start_time(cls, v, values):
        if 'start_time' in values and values['start_time'] and v:
            if v <= values['start_time']:
                raise ValueError('end_time must be after start_time')
        return v

class HeatmapRequest(BaseModel):
    symbol: str = Field(..., min_length=2, max_length=20)
    minutes: int = Field(default=60, ge=1, le=1440)  # 1 minute to 24 hours
    resolution: Optional[int] = Field(default=100, ge=10, le=1000)
    
    @validator('symbol')
    def symbol_uppercase(cls, v):
        return v.upper()

class SignalRequest(BaseModel):
    symbols: List[str] = Field(..., min_items=1, max_items=50)
    signal_types: Optional[List[str]] = Field(default=None)
    severity_levels: Optional[List[str]] = Field(default=None)
    
    @validator('symbols')
    def symbols_uppercase(cls, v):
        return [symbol.upper() for symbol in v]
    
    @validator('signal_types')
    def valid_signal_types(cls, v):
        if v:
            valid_types = ['liquidation_cascade', 'funding_extreme', 'oi_spike', 'volume_anomaly']
            for signal_type in v:
                if signal_type not in valid_types:
                    raise ValueError(f'Invalid signal type: {signal_type}')
        return v

class LiquidationFilter(BaseModel):
    symbol: Optional[str] = None
    side: Optional[str] = Field(None, pattern="^(long|short)$")
    min_amount: Optional[float] = Field(None, ge=0)
    max_amount: Optional[float] = None
    exchange: Optional[str] = None
    time_range: Optional[TimeRangeValidator] = None
    
    @validator('max_amount')
    def max_amount_greater_than_min(cls, v, values):
        if v and 'min_amount' in values and values['min_amount']:
            if v <= values['min_amount']:
                raise ValueError('max_amount must be greater than min_amount')
        return v

class DataExportRequest(BaseModel):
    data_type: str = Field(..., pattern="^(liquidations|funding_rate|oi_data|heatmap)$")
    format: str = Field(default="json", pattern="^(json|csv|parquet)$")
    symbols: List[str] = Field(..., min_items=1, max_items=20)
    time_range: TimeRangeValidator
    filters: Optional[Dict[str, Any]] = None
    
    @validator('symbols')
    def symbols_uppercase(cls, v):
        return [symbol.upper() for symbol in v]

class WebhookConfig(BaseModel):
    url: str = Field(..., pattern=r'^https?://.+')
    events: List[str] = Field(..., min_items=1)
    secret: Optional[str] = Field(None, min_length=16)
    active: bool = Field(default=True)
    
    @validator('events')
    def valid_events(cls, v):
        valid_events = ['signal_generated', 'liquidation_cascade', 'funding_extreme', 'system_alert']
        for event in v:
            if event not in valid_events:
                raise ValueError(f'Invalid event: {event}')
        return v

def validate_pagination(page: int = 1, limit: int = 100) -> tuple:
    """Validate pagination parameters"""
    if page < 1:
        page = 1
    if limit < 1:
        limit = 1
    if limit > 1000:
        limit = 1000
    
    offset = (page - 1) * limit
    return offset, limit

def validate_timeframe(timeframe: str) -> str:
    """Validate timeframe parameter"""
    valid_timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']
    if timeframe not in valid_timeframes:
        raise ValueError(f'Invalid timeframe. Must be one of: {valid_timeframes}')
    return timeframe

def sanitize_symbol(symbol: str) -> str:
    """Sanitize symbol input"""
    if not symbol:
        raise ValueError("Symbol cannot be empty")
    
    # Remove special characters and convert to uppercase
    sanitized = re.sub(r'[^A-Z0-9]', '', symbol.upper())
    
    if len(sanitized) < 2 or len(sanitized) > 20:
        raise ValueError("Symbol must be between 2 and 20 characters")
    
    return sanitized
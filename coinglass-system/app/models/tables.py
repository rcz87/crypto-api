from sqlalchemy import Column, String, Numeric, Boolean, DateTime, Integer, JSON, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

class FuturesOIOHLC(Base):
    __tablename__ = "futures_oi_ohlc"
    
    ts = Column(DateTime, primary_key=True)
    symbol = Column(String, primary_key=True)
    interval = Column(String, primary_key=True)
    aggregated = Column(Boolean, nullable=False)
    open = Column(Numeric)
    high = Column(Numeric)
    low = Column(Numeric)
    close = Column(Numeric)
    oi_value = Column(Numeric)

class FundingRate(Base):
    __tablename__ = "funding_rate"
    
    ts = Column(DateTime, primary_key=True)
    symbol = Column(String, primary_key=True)
    exchange = Column(String)
    interval = Column(String, primary_key=True)
    rate = Column(Numeric)
    rate_oi_weighted = Column(Numeric)

class Liquidations(Base):
    __tablename__ = "liquidations"
    
    ts = Column(DateTime, primary_key=True)
    symbol = Column(String, primary_key=True)
    side = Column(String, primary_key=True)
    price = Column(Numeric, primary_key=True)
    qty = Column(Numeric, nullable=False)
    exchange = Column(String)
    bucket = Column(Numeric)
    meta = Column(JSON)

class CompositeHeatmap(Base):
    __tablename__ = "composite_heatmap"
    
    ts_min = Column(DateTime, primary_key=True)
    symbol = Column(String, primary_key=True)
    bucket = Column(Numeric, primary_key=True)
    score = Column(Numeric, nullable=False)
    components = Column(JSON)

class TakerVolume(Base):
    __tablename__ = "taker_volume"
    
    ts = Column(DateTime, primary_key=True)
    symbol = Column(String, primary_key=True)
    exchange = Column(String)
    interval = Column(String, primary_key=True)
    taker_buy = Column(Numeric)
    taker_sell = Column(Numeric)

class LongShortRatio(Base):
    __tablename__ = "long_short_ratio"
    
    ts = Column(DateTime, primary_key=True)
    scope = Column(String, primary_key=True)
    ratio = Column(Numeric)

class LongShortRatioSymbol(Base):
    __tablename__ = "long_short_ratio_symbol"
    
    ts = Column(DateTime, primary_key=True)
    symbol = Column(String, primary_key=True)
    interval = Column(String, primary_key=True)
    ratio = Column(Numeric)

class PriceOHLC(Base):
    __tablename__ = "price_ohlc"
    
    ts = Column(DateTime, primary_key=True)
    symbol = Column(String, primary_key=True)
    interval = Column(String, primary_key=True)
    open = Column(Numeric)
    high = Column(Numeric)
    low = Column(Numeric)
    close = Column(Numeric)
    volume = Column(Numeric)

class LiquidationHeatmap(Base):
    __tablename__ = "liquidation_heatmap"
    
    ts_min = Column(DateTime, primary_key=True)
    symbol = Column(String, primary_key=True)
    bucket = Column(Numeric, primary_key=True)
    qty_sum = Column(Numeric, nullable=False)
    events_count = Column(Integer, nullable=False)

# New tables for enhanced functionality
class WebhookEndpoints(Base):
    __tablename__ = "webhook_endpoints"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    url = Column(String, nullable=False)
    events = Column(JSON, nullable=False)  # List of event types
    secret = Column(String)  # Webhook secret for verification
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_triggered = Column(DateTime)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)

class AlertHistory(Base):
    __tablename__ = "alert_history"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_type = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    channel = Column(String, nullable=False)  # telegram, webhook, email
    user_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    delivered_at = Column(DateTime)
    status = Column(String, default="pending")  # pending, delivered, failed
    retry_count = Column(Integer, default=0)
    meta_data = Column('metadata', JSON)

class SignalBacktest(Base):
    __tablename__ = "signal_backtest"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    signal_type = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    generated_at = Column(DateTime, nullable=False)
    signal_data = Column(JSON, nullable=False)
    
    # Backtest results
    entry_price = Column(Numeric)
    exit_price = Column(Numeric)
    pnl = Column(Numeric)
    pnl_percentage = Column(Numeric)
    hold_duration_minutes = Column(Integer)
    max_drawdown = Column(Numeric)
    accuracy = Column(Numeric)  # Signal accuracy (0-1)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class DataQualityMetrics(Base):
    __tablename__ = "data_quality_metrics"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    data_type = Column(String, nullable=False)  # liquidations, funding_rate, etc.
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Quality metrics
    records_processed = Column(Integer, default=0)
    records_rejected = Column(Integer, default=0)
    duplicates_found = Column(Integer, default=0)
    validation_errors = Column(Integer, default=0)
    processing_time_ms = Column(Integer)
    
    # Data freshness
    latest_data_timestamp = Column(DateTime)
    data_lag_minutes = Column(Integer)
    
    # Health status
    status = Column(String, default="healthy")  # healthy, warning, critical
    alerts = Column(JSON)  # List of alert messages

class UserApiUsage(Base):
    __tablename__ = "user_api_usage"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    tier = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    response_time_ms = Column(Integer)
    status_code = Column(Integer)
    ip_address = Column(String)
    user_agent = Column(String)

class SystemHealth(Base):
    __tablename__ = "system_health"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    component = Column(String, nullable=False)  # database, redis, api, worker
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False)  # healthy, degraded, down
    response_time_ms = Column(Integer)
    error_message = Column(Text)
    metrics = Column(JSON)  # Additional component-specific metrics
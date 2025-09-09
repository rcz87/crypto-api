from sqlalchemy import Column, String, Numeric, Boolean, DateTime, Integer, JSON
from sqlalchemy.ext.declarative import declarative_base

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
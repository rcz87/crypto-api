from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.db import SessionLocal
from app.core.settings import settings
from app.core.logging import logger

def build_composite_indicators():
    """Build composite indicators from multiple data sources"""
    try:
        db = SessionLocal()
        
        for symbol in settings.SYMBOLS:
            build_symbol_composite(db, symbol)
        
        db.commit()
        logger.info(f"Composite indicators built for {len(settings.SYMBOLS)} symbols")
        
    except Exception as e:
        logger.error(f"Error building composite indicators: {e}")
        db.rollback()
    finally:
        db.close()

def build_symbol_composite(db: Session, symbol: str):
    """Build composite indicators for a specific symbol"""
    
    # Get latest data from various sources
    funding_query = text("""
        SELECT rate, rate_oi_weighted 
        FROM funding_rate 
        WHERE symbol = :symbol 
        ORDER BY ts DESC 
        LIMIT 1
    """)
    
    oi_query = text("""
        SELECT close as oi_value 
        FROM futures_oi_ohlc 
        WHERE symbol = :symbol 
        ORDER BY ts DESC 
        LIMIT 1
    """)
    
    liq_query = text("""
        SELECT SUM(qty) as total_liq, COUNT(*) as liq_count
        FROM liquidations 
        WHERE symbol = :symbol 
        AND ts >= NOW() - INTERVAL '1 hour'
    """)
    
    funding_result = db.execute(funding_query, {"symbol": symbol}).fetchone()
    oi_result = db.execute(oi_query, {"symbol": symbol}).fetchone()
    liq_result = db.execute(liq_query, {"symbol": symbol}).fetchone()
    
    # Calculate composite score
    composite_score = calculate_composite_score(funding_result, oi_result, liq_result)
    
    logger.debug(f"Composite score for {symbol}: {composite_score}")

def calculate_composite_score(funding_data, oi_data, liq_data) -> float:
    """Calculate composite market score"""
    score = 50  # Neutral baseline
    
    if funding_data:
        # Funding rate component
        funding_rate = funding_data[0] if funding_data[0] else 0
        if funding_rate > 0.01:  # High positive funding
            score += 10
        elif funding_rate < -0.01:  # High negative funding
            score -= 10
    
    if liq_data:
        # Liquidation component
        total_liq = liq_data[0] if liq_data[0] else 0
        if total_liq > 10000000:  # High liquidations
            score += 15
    
    return max(0, min(100, score))
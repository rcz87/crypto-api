import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.db import SessionLocal
from app.core.settings import settings
from app.models.tables import CompositeHeatmap
from app.core.logging import logger

def build_heatmaps():
    """Build composite heatmaps from liquidation and other data"""
    try:
        db = SessionLocal()
        
        for symbol in settings.SYMBOLS:
            build_symbol_heatmap(db, symbol)
        
        db.commit()
        logger.info(f"Heatmaps built for {len(settings.SYMBOLS)} symbols")
        
    except Exception as e:
        logger.error(f"Error building heatmaps: {e}")
        db.rollback()
    finally:
        db.close()

def build_symbol_heatmap(db: Session, symbol: str):
    """Build heatmap for a specific symbol"""
    
    # Get liquidation data for the last hour
    query = text("""
        SELECT price, qty, ts
        FROM liquidations 
        WHERE symbol = :symbol 
        AND ts >= NOW() - INTERVAL '1 hour'
    """)
    
    result = db.execute(query, {"symbol": symbol})
    liquidations = result.fetchall()
    
    if not liquidations:
        return
    
    # Create price buckets and aggregate
    df = pd.DataFrame(liquidations, columns=['price', 'qty', 'ts'])
    
    # Create 100 price buckets
    min_price = df['price'].min()
    max_price = df['price'].max()
    price_range = max_price - min_price
    bucket_size = price_range / 100
    
    heatmap_data = []
    
    for i in range(100):
        bucket_min = min_price + (i * bucket_size)
        bucket_max = bucket_min + bucket_size
        bucket_center = (bucket_min + bucket_max) / 2
        
        # Get liquidations in this bucket
        bucket_liq = df[(df['price'] >= bucket_min) & (df['price'] < bucket_max)]
        
        if len(bucket_liq) > 0:
            total_qty = bucket_liq['qty'].sum()
            score = calculate_heatmap_score(total_qty, len(bucket_liq))
            
            components = {
                "total_qty": float(total_qty),
                "event_count": len(bucket_liq),
                "avg_size": float(bucket_liq['qty'].mean())
            }
            
            heatmap_data.append({
                "symbol": symbol,
                "bucket": bucket_center,
                "score": score,
                "components": components
            })
    
    # Insert heatmap data
    for data in heatmap_data:
        heatmap_entry = CompositeHeatmap(**data)
        db.merge(heatmap_entry)

def calculate_heatmap_score(total_qty: float, event_count: int) -> float:
    """Calculate composite score for heatmap tile"""
    # Simple scoring: combine volume and frequency
    volume_score = min(total_qty / 1000000, 100)  # Normalize to max 100
    frequency_score = min(event_count * 2, 100)   # Normalize to max 100
    
    return (volume_score + frequency_score) / 2
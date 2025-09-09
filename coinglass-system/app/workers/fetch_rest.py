import asyncio
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.core.coinglass_client import CoinglassClient
from app.core.settings import settings
from app.models.schemas import FuturesOIData, FundingRateData, LiquidationData
from app.models.tables import FuturesOIOHLC, FundingRate, Liquidations
from app.core.logging import logger

def fetch_all_data():
    """Fetch all data from CoinGlass API for configured symbols"""
    try:
        client = CoinglassClient()
        db = SessionLocal()
        
        for symbol in settings.SYMBOLS:
            # Fetch OI data
            oi_data = client.oi_ohlc(symbol, "1h", aggregated=True)
            process_oi_data(db, symbol, oi_data)
            
            # Fetch funding rate
            funding_data = client.funding_rate(symbol, "1h")
            process_funding_data(db, symbol, funding_data)
            
            # Fetch liquidations
            liq_data = client.liquidations(symbol, "1h")
            process_liquidation_data(db, symbol, liq_data)
        
        db.commit()
        logger.info(f"Successfully fetched data for {len(settings.SYMBOLS)} symbols")
        
    except Exception as e:
        logger.error(f"Error fetching REST data: {e}")
        db.rollback()
    finally:
        db.close()

def process_oi_data(db: Session, symbol: str, data: dict):
    # Process and insert OI data
    pass

def process_funding_data(db: Session, symbol: str, data: dict):
    # Process and insert funding rate data
    pass

def process_liquidation_data(db: Session, symbol: str, data: dict):
    # Process and insert liquidation data
    pass
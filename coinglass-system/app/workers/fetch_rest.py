import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.core.db import SessionLocal
from app.core.coinglass_client import CoinglassClient
from app.core.settings import settings
from app.core.http import HttpError, RateLimitExceeded
from app.models.schemas import (
    FuturesOIData, FundingRateData, LiquidationData, 
    WhaleAlert, WhalePosition, ETFData, ETFFlowHistory, 
    MarketSentiment, LiquidationHeatmapData
)
from app.models.tables import (
    FuturesOIOHLC, FundingRate, Liquidations, LiquidationHeatmap,
    CompositeHeatmap, AlertHistory
)
from app.core.logging import logger

def fetch_all_data():
    """Fetch all data from CoinGlass API for configured symbols"""
    client = None
    db = None
    
    try:
        client = CoinglassClient()
        db = SessionLocal()
        
        stats = {
            'symbols_processed': 0,
            'oi_records': 0,
            'funding_records': 0,
            'liquidation_records': 0,
            'heatmap_records': 0,
            'errors': 0
        }
        
        for symbol in settings.SYMBOLS:
            try:
                logger.info(f"Processing data for symbol: {symbol}")
                
                # Fetch OI data with error handling
                try:
                    oi_data = client.oi_ohlc(symbol, "1h", aggregated=True)
                    stats['oi_records'] += process_oi_data(db, symbol, oi_data)
                except (HttpError, RateLimitExceeded) as e:
                    logger.error(f"Failed to fetch OI data for {symbol}: {e}")
                    stats['errors'] += 1
                
                # Fetch funding rate data
                try:
                    funding_data = client.funding_rate(symbol, "1h")
                    stats['funding_records'] += process_funding_data(db, symbol, funding_data)
                except (HttpError, RateLimitExceeded) as e:
                    logger.error(f"Failed to fetch funding data for {symbol}: {e}")
                    stats['errors'] += 1
                
                # Fetch liquidations data
                try:
                    liq_data = client.liquidations(symbol, "1h")
                    stats['liquidation_records'] += process_liquidation_data(db, symbol, liq_data)
                except (HttpError, RateLimitExceeded) as e:
                    logger.error(f"Failed to fetch liquidations for {symbol}: {e}")
                    stats['errors'] += 1
                
                # Fetch liquidation heatmap
                try:
                    heatmap_data = client.liquidation_heatmap(symbol, "1h")
                    stats['heatmap_records'] += process_heatmap_data(db, symbol, heatmap_data)
                except (HttpError, RateLimitExceeded) as e:
                    logger.error(f"Failed to fetch heatmap for {symbol}: {e}")
                    stats['errors'] += 1
                
                stats['symbols_processed'] += 1
                
            except Exception as e:
                logger.error(f"Unexpected error processing symbol {symbol}: {e}")
                stats['errors'] += 1
        
        # Fetch global market data (once per run)
        try:
            whale_alerts = client.whale_alerts()
            process_whale_data(db, whale_alerts)
        except (HttpError, RateLimitExceeded) as e:
            logger.error(f"Failed to fetch whale alerts: {e}")
            stats['errors'] += 1
        
        try:
            market_sentiment = client.market_sentiment()
            process_sentiment_data(db, market_sentiment)
        except (HttpError, RateLimitExceeded) as e:
            logger.error(f"Failed to fetch market sentiment: {e}")
            stats['errors'] += 1
        
        try:
            etf_flows = client.etf_flows_history(7)  # Last 7 days
            process_etf_data(db, etf_flows)
        except (HttpError, RateLimitExceeded) as e:
            logger.error(f"Failed to fetch ETF flows: {e}")
            stats['errors'] += 1
        
        db.commit()
        logger.info(f"Data fetch completed: {stats}")
        
    except Exception as e:
        logger.error(f"Critical error in fetch_all_data: {e}")
        if db:
            db.rollback()
        raise
    finally:
        if client and hasattr(client.http, 'close'):
            client.http.close()
        if db:
            db.close()

def process_oi_data(db: Session, symbol: str, data: dict) -> int:
    """Process and insert Open Interest OHLC data"""
    if not data or 'data' not in data:
        logger.warning(f"No OI data received for {symbol}")
        return 0
    
    records_inserted = 0
    
    try:
        # Extract data array from API response
        oi_records = data.get('data', [])
        
        for record in oi_records:
            try:
                # Parse timestamp
                timestamp = _parse_timestamp(record.get('timestamp', record.get('ts')))
                if not timestamp:
                    continue
                
                # Create OI record
                oi_entry = FuturesOIOHLC(
                    ts=timestamp,
                    symbol=symbol,
                    interval="1h",
                    aggregated=True,
                    open=_safe_float(record.get('open')),
                    high=_safe_float(record.get('high')),
                    low=_safe_float(record.get('low')),
                    close=_safe_float(record.get('close')),
                    oi_value=_safe_float(record.get('openInterest', record.get('oi')))
                )
                
                db.merge(oi_entry)  # Use merge to handle duplicates
                records_inserted += 1
                
            except Exception as e:
                logger.warning(f"Skipped invalid OI record for {symbol}: {e}")
                continue
        
        logger.debug(f"Processed {records_inserted} OI records for {symbol}")
        return records_inserted
        
    except Exception as e:
        logger.error(f"Error processing OI data for {symbol}: {e}")
        return 0

def process_funding_data(db: Session, symbol: str, data: dict) -> int:
    """Process and insert funding rate data"""
    if not data or 'data' not in data:
        logger.warning(f"No funding data received for {symbol}")
        return 0
    
    records_inserted = 0
    
    try:
        funding_records = data.get('data', [])
        
        for record in funding_records:
            try:
                timestamp = _parse_timestamp(record.get('timestamp', record.get('ts')))
                if not timestamp:
                    continue
                
                funding_entry = FundingRate(
                    ts=timestamp,
                    symbol=symbol,
                    exchange=record.get('exchange', 'aggregated'),
                    interval="1h",
                    rate=_safe_float(record.get('fundingRate', record.get('rate'))),
                    rate_oi_weighted=_safe_float(record.get('oiWeightedRate'))
                )
                
                db.merge(funding_entry)
                records_inserted += 1
                
            except Exception as e:
                logger.warning(f"Skipped invalid funding record for {symbol}: {e}")
                continue
        
        logger.debug(f"Processed {records_inserted} funding records for {symbol}")
        return records_inserted
        
    except Exception as e:
        logger.error(f"Error processing funding data for {symbol}: {e}")
        return 0

def process_liquidation_data(db: Session, symbol: str, data: dict) -> int:
    """Process and insert liquidation data"""
    if not data or 'data' not in data:
        logger.warning(f"No liquidation data received for {symbol}")
        return 0
    
    records_inserted = 0
    
    try:
        liq_records = data.get('data', [])
        
        for record in liq_records:
            try:
                timestamp = _parse_timestamp(record.get('timestamp', record.get('ts')))
                if not timestamp:
                    continue
                
                price = _safe_float(record.get('price'))
                qty = _safe_float(record.get('qty', record.get('quantity')))
                
                if not price or not qty:
                    continue
                
                liq_entry = Liquidations(
                    ts=timestamp,
                    symbol=symbol,
                    side=record.get('side', 'unknown').lower(),
                    price=price,
                    qty=qty,
                    exchange=record.get('exchange'),
                    bucket=_safe_float(record.get('bucket')),
                    meta=record.get('meta', {})
                )
                
                db.merge(liq_entry)
                records_inserted += 1
                
            except Exception as e:
                logger.warning(f"Skipped invalid liquidation record for {symbol}: {e}")
                continue
        
        logger.debug(f"Processed {records_inserted} liquidation records for {symbol}")
        return records_inserted
        
    except Exception as e:
        logger.error(f"Error processing liquidation data for {symbol}: {e}")
        return 0

def process_heatmap_data(db: Session, symbol: str, data: dict) -> int:
    """Process liquidation heatmap data"""
    if not data or 'data' not in data:
        logger.warning(f"No heatmap data received for {symbol}")
        return 0
    
    records_inserted = 0
    
    try:
        heatmap_records = data.get('data', [])
        
        for record in heatmap_records:
            try:
                timestamp = _parse_timestamp(record.get('timestamp', record.get('ts')))
                if not timestamp:
                    continue
                
                bucket = _safe_float(record.get('bucket', record.get('price_level')))
                qty_sum = _safe_float(record.get('qty_sum', record.get('amount')))
                events_count = record.get('events_count', record.get('count', 1))
                
                if bucket is None or qty_sum is None:
                    continue
                
                heatmap_entry = LiquidationHeatmap(
                    ts_min=timestamp,
                    symbol=symbol,
                    bucket=bucket,
                    qty_sum=qty_sum,
                    events_count=int(events_count) if events_count else 0
                )
                
                db.merge(heatmap_entry)
                records_inserted += 1
                
            except Exception as e:
                logger.warning(f"Skipped invalid heatmap record for {symbol}: {e}")
                continue
        
        logger.debug(f"Processed {records_inserted} heatmap records for {symbol}")
        return records_inserted
        
    except Exception as e:
        logger.error(f"Error processing heatmap data for {symbol}: {e}")
        return 0

def process_whale_data(db: Session, data: dict):
    """Process whale alerts and positions"""
    if not data or 'data' not in data:
        logger.warning("No whale data received")
        return
    
    try:
        whale_records = data.get('data', [])
        alerts_created = 0
        
        for record in whale_records:
            try:
                # Extract whale alert information
                symbol = record.get('symbol', '')
                position_size = _safe_float(record.get('position_size', record.get('size')))
                notional_value = _safe_float(record.get('notional_value', record.get('notional')))
                
                if not symbol or not position_size or not notional_value:
                    continue
                
                # Create alert if position is significant (>$1M)
                if notional_value >= 1000000:
                    alert = AlertHistory(
                        alert_type='whale_position',
                        symbol=symbol,
                        severity='info',
                        message=f"Large {record.get('side', 'unknown')} position detected: ${notional_value:,.0f} ({position_size:,.2f} {symbol})",
                        channel='system',
                        metadata={
                            'exchange': record.get('exchange'),
                            'side': record.get('side'),
                            'position_size': position_size,
                            'notional_value': notional_value,
                            'source': 'whale_alerts'
                        }
                    )
                    
                    db.add(alert)
                    alerts_created += 1
                
            except Exception as e:
                logger.warning(f"Skipped invalid whale record: {e}")
                continue
        
        logger.debug(f"Created {alerts_created} whale alerts")
        
    except Exception as e:
        logger.error(f"Error processing whale data: {e}")

def process_sentiment_data(db: Session, data: dict):
    """Process market sentiment data"""
    if not data or 'data' not in data:
        logger.warning("No market sentiment data received")
        return
    
    try:
        sentiment_records = data.get('data', [])
        
        for record in sentiment_records:
            try:
                # Extract market sentiment metrics
                symbol = record.get('symbol', '')
                change_24h = _safe_float(record.get('change_24h', record.get('priceChange')))
                change_pct_24h = _safe_float(record.get('change_percentage_24h', record.get('priceChangePercent')))
                
                if not symbol:
                    continue
                
                # Create alerts for significant market movements
                if abs(change_pct_24h or 0) >= 10:  # 10% threshold
                    severity = 'warning' if abs(change_pct_24h) >= 20 else 'info'
                    direction = 'up' if change_pct_24h > 0 else 'down'
                    
                    alert = AlertHistory(
                        alert_type='market_movement',
                        symbol=symbol,
                        severity=severity,
                        message=f"{symbol} moved {direction} by {abs(change_pct_24h):.1f}% in 24h (${change_24h:,.2f})",
                        channel='system',
                        metadata={
                            'price_change_24h': change_24h,
                            'price_change_percent_24h': change_pct_24h,
                            'volume_24h': _safe_float(record.get('volume_24h')),
                            'market_cap': _safe_float(record.get('market_cap')),
                            'source': 'market_sentiment'
                        }
                    )
                    
                    db.add(alert)
                
            except Exception as e:
                logger.warning(f"Skipped invalid sentiment record: {e}")
                continue
        
        logger.debug("Processed market sentiment data")
        
    except Exception as e:
        logger.error(f"Error processing sentiment data: {e}")

def process_etf_data(db: Session, data: dict):
    """Process ETF flow data"""
    if not data or 'data' not in data:
        logger.warning("No ETF flow data received")
        return
    
    try:
        etf_records = data.get('data', [])
        
        for record in etf_records:
            try:
                # Extract ETF flow information
                ticker = record.get('ticker', '')
                net_flow = _safe_float(record.get('net_flow', record.get('flow')))
                
                if not ticker or net_flow is None:
                    continue
                
                # Create alerts for significant ETF flows (>$100M)
                if abs(net_flow) >= 100000000:
                    flow_type = 'inflow' if net_flow > 0 else 'outflow'
                    severity = 'warning' if abs(net_flow) >= 500000000 else 'info'
                    
                    alert = AlertHistory(
                        alert_type='etf_flow',
                        symbol='BTC',  # Assuming Bitcoin ETF
                        severity=severity,
                        message=f"Significant ETF {flow_type}: {ticker} had ${abs(net_flow):,.0f} {flow_type}",
                        channel='system',
                        metadata={
                            'ticker': ticker,
                            'net_flow': net_flow,
                            'flow_type': flow_type,
                            'closing_price': _safe_float(record.get('closing_price')),
                            'source': 'etf_flows'
                        }
                    )
                    
                    db.add(alert)
                
            except Exception as e:
                logger.warning(f"Skipped invalid ETF record: {e}")
                continue
        
        logger.debug("Processed ETF flow data")
        
    except Exception as e:
        logger.error(f"Error processing ETF data: {e}")


# === UTILITY FUNCTIONS ===

def _parse_timestamp(timestamp_value: Any) -> Optional[datetime]:
    """Parse timestamp from various formats to datetime object"""
    if not timestamp_value:
        return None
    
    try:
        # If it's already a datetime object
        if isinstance(timestamp_value, datetime):
            return timestamp_value
        
        # If it's a Unix timestamp (integer or float)
        if isinstance(timestamp_value, (int, float)):
            # Handle both seconds and milliseconds timestamps
            if timestamp_value > 1e12:  # Milliseconds
                return datetime.fromtimestamp(timestamp_value / 1000, tz=timezone.utc)
            else:  # Seconds
                return datetime.fromtimestamp(timestamp_value, tz=timezone.utc)
        
        # If it's a string, try to parse it
        if isinstance(timestamp_value, str):
            # Try ISO format first
            try:
                return datetime.fromisoformat(timestamp_value.replace('Z', '+00:00'))
            except ValueError:
                pass
            
            # Try as Unix timestamp string
            try:
                ts = float(timestamp_value)
                if ts > 1e12:  # Milliseconds
                    return datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
                else:  # Seconds
                    return datetime.fromtimestamp(ts, tz=timezone.utc)
            except ValueError:
                pass
        
        logger.warning(f"Unable to parse timestamp: {timestamp_value}")
        return None
        
    except Exception as e:
        logger.warning(f"Error parsing timestamp {timestamp_value}: {e}")
        return None


def _safe_float(value: Any) -> Optional[float]:
    """Safely convert value to float, return None if invalid"""
    if value is None:
        return None
    
    try:
        if isinstance(value, (int, float)):
            return float(value)
        
        if isinstance(value, str):
            # Handle empty strings
            if not value.strip():
                return None
            
            # Remove common formatting
            clean_value = value.replace(',', '').replace('$', '').replace('%', '')
            return float(clean_value)
        
        return None
        
    except (ValueError, TypeError):
        return None


def _safe_int(value: Any) -> Optional[int]:
    """Safely convert value to int, return None if invalid"""
    if value is None:
        return None
    
    try:
        if isinstance(value, int):
            return value
        
        if isinstance(value, float):
            return int(value)
        
        if isinstance(value, str):
            # Handle empty strings
            if not value.strip():
                return None
            
            # Remove common formatting
            clean_value = value.replace(',', '').replace('$', '')
            return int(float(clean_value))  # Convert to float first to handle decimals
        
        return None
        
    except (ValueError, TypeError):
        return None
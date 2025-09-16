from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import List, Optional
from datetime import datetime
import time
from app.core.coinglass_client import CoinglassClient
from app.core.sniper_engine import SniperTimingEngine
from app.core.http import HttpError, RateLimitExceeded
from app.core.logging import logger
from app.models.schemas import (
    WhaleAlert, WhalePosition, ETFData, ETFFlowHistory, 
    MarketSentiment, LiquidationHeatmapData, SpotOrderbook, 
    OptionsData, AlertMessage, SupportedCoin, SupportedCoinsResponse
)

router = APIRouter(prefix="/advanced", tags=["advanced"])

@router.get("/whale/alerts", response_model=List[WhaleAlert])
def get_whale_alerts(
    exchange: str = Query("hyperliquid", description="Exchange to filter whale alerts")
):
    """Get whale alerts for large positions >$1M"""
    try:
        client = CoinglassClient()
        raw_data = client.whale_alerts(exchange)
        
        # Validate and transform response using Pydantic
        whale_alerts = []
        if raw_data and 'data' in raw_data:
            for record in raw_data['data']:
                try:
                    alert = WhaleAlert(
                        exchange=record.get('exchange', exchange),
                        symbol=record.get('symbol', ''),
                        side=record.get('side', 'unknown'),
                        position_size=float(record.get('position_size', 0)),
                        notional_value=float(record.get('notional_value', 0)),
                        timestamp=record.get('timestamp'),
                        meta=record.get('meta', {})
                    )
                    whale_alerts.append(alert)
                except Exception as e:
                    logger.warning(f"Skipped invalid whale alert: {e}")
                    continue
        
        return whale_alerts
        
    except RateLimitExceeded as e:
        raise HTTPException(
            status_code=429,
            detail={"message": "Rate limit exceeded", "retry_after": e.retry_after}
        )
    except HttpError as e:
        logger.error(f"HTTP error in whale alerts: {e}")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail={"message": e.message, "error_data": e.response_data}
        )
    except Exception as e:
        logger.error(f"Unexpected error in whale alerts: {e}")
        raise HTTPException(
            status_code=500,
            detail={"message": "Internal server error", "error": str(e)}
        )

@router.get("/whale/positions", response_model=List[WhalePosition])
def get_whale_positions(
    exchange: str = Query("hyperliquid", description="Exchange to filter whale positions")
):
    """Get current whale positions >$1M notional value"""
    try:
        client = CoinglassClient()
        raw_data = client.whale_positions(exchange)
        
        # Validate and transform response
        whale_positions = []
        if raw_data and 'data' in raw_data:
            for record in raw_data['data']:
                try:
                    position = WhalePosition(
                        exchange=record.get('exchange', exchange),
                        symbol=record.get('symbol', ''),
                        side=record.get('side', 'unknown'),
                        position_size=float(record.get('position_size', 0)),
                        notional_value=float(record.get('notional_value', 0)),
                        unrealized_pnl=record.get('unrealized_pnl'),
                        timestamp=record.get('timestamp')
                    )
                    whale_positions.append(position)
                except Exception as e:
                    logger.warning(f"Skipped invalid whale position: {e}")
                    continue
        
        return whale_positions
        
    except RateLimitExceeded as e:
        raise HTTPException(status_code=429, detail={"message": "Rate limit exceeded", "retry_after": e.retry_after})
    except HttpError as e:
        logger.error(f"HTTP error in whale positions: {e}")
        raise HTTPException(status_code=e.status_code or 500, detail={"message": e.message})
    except Exception as e:
        logger.error(f"Unexpected error in whale positions: {e}")
        raise HTTPException(status_code=500, detail={"message": "Internal server error"})

@router.get("/etf/bitcoin", response_model=List[ETFData])
def get_bitcoin_etfs():
    """Get Bitcoin ETF list and status information (Pro+ feature)"""
    # Feature gate: ETF endpoints require Pro+ tier
    from app.core.settings import settings
    if not hasattr(settings, 'CG_TIER') or settings.CG_TIER not in ['pro', 'enterprise']:
        raise HTTPException(
            status_code=402, 
            detail={"code": "feature_locked", "message": "ETF endpoints require Pro+ subscription"}
        )
    
    try:
        client = CoinglassClient()
        raw_data = client.bitcoin_etfs()
        
        # Validate and transform response
        etf_data = []
        if raw_data and 'data' in raw_data:
            for record in raw_data['data']:
                try:
                    etf = ETFData(
                        ticker=record.get('ticker', ''),
                        name=record.get('name', ''),
                        aum=record.get('aum'),
                        nav=record.get('nav'),
                        price=record.get('price'),
                        flows_1d=record.get('flows_1d'),
                        flows_7d=record.get('flows_7d'),
                        flows_30d=record.get('flows_30d'),
                        timestamp=record.get('timestamp')
                    )
                    etf_data.append(etf)
                except Exception as e:
                    logger.warning(f"Skipped invalid ETF record: {e}")
                    continue
        
        return etf_data
        
    except RateLimitExceeded as e:
        raise HTTPException(status_code=429, detail={"message": "Rate limit exceeded"})
    except HttpError as e:
        logger.error(f"HTTP error in bitcoin ETFs: {e}")
        raise HTTPException(status_code=e.status_code or 500, detail={"message": e.message})
    except Exception as e:
        logger.error(f"Unexpected error in bitcoin ETFs: {e}")
        raise HTTPException(status_code=500, detail={"message": "Internal server error"})

@router.get("/etf/flows", response_model=List[ETFFlowHistory])
def get_etf_flows_history(
    days: int = Query(30, ge=1, le=365, description="Number of days of ETF flow history")
):
    """Get historical Bitcoin ETF flow data (Pro+ feature)"""
    # Feature gate: ETF endpoints require Pro+ tier
    from app.core.settings import settings
    if not hasattr(settings, 'CG_TIER') or settings.CG_TIER not in ['pro', 'enterprise']:
        raise HTTPException(
            status_code=402, 
            detail={"code": "feature_locked", "message": "ETF endpoints require Pro+ subscription"}
        )
    
    try:
        client = CoinglassClient()
        raw_data = client.etf_flows_history(days)
        
        # Validate and transform response
        flow_data = []
        if raw_data and 'data' in raw_data:
            for record in raw_data['data']:
                try:
                    flow = ETFFlowHistory(
                        date=record.get('date'),
                        ticker=record.get('ticker', ''),
                        net_flow=float(record.get('net_flow', 0)),
                        closing_price=float(record.get('closing_price', 0)),
                        shares_outstanding=record.get('shares_outstanding')
                    )
                    flow_data.append(flow)
                except Exception as e:
                    logger.warning(f"Skipped invalid ETF flow record: {e}")
                    continue
        
        return flow_data
        
    except RateLimitExceeded as e:
        raise HTTPException(status_code=429, detail={"message": "Rate limit exceeded"})
    except HttpError as e:
        logger.error(f"HTTP error in ETF flows: {e}")
        raise HTTPException(status_code=e.status_code or 500, detail={"message": e.message})
    except Exception as e:
        logger.error(f"Unexpected error in ETF flows: {e}")
        raise HTTPException(status_code=500, detail={"message": "Internal server error"})

@router.get("/market/sentiment", response_model=List[MarketSentiment])
def get_market_sentiment():
    """Get futures performance metrics and market sentiment"""
    try:
        client = CoinglassClient()
        raw_data = client.market_sentiment()
        
        # Validate and transform response
        sentiment_data = []
        if raw_data and 'data' in raw_data:
            for record in raw_data['data']:
                try:
                    sentiment = MarketSentiment(
                        symbol=record.get('symbol', ''),
                        price=float(record.get('price', 0)),
                        change_24h=float(record.get('change_24h', 0)),
                        change_percentage_24h=float(record.get('change_percentage_24h', 0)),
                        volume_24h=float(record.get('volume_24h', 0)),
                        market_cap=record.get('market_cap'),
                        dominance=record.get('dominance'),
                        timestamp=record.get('timestamp')
                    )
                    sentiment_data.append(sentiment)
                except Exception as e:
                    logger.warning(f"Skipped invalid sentiment record: {e}")
                    continue
        
        return sentiment_data
        
    except RateLimitExceeded as e:
        raise HTTPException(status_code=429, detail={"message": "Rate limit exceeded"})
    except HttpError as e:
        logger.error(f"HTTP error in market sentiment: {e}")
        raise HTTPException(status_code=e.status_code or 500, detail={"message": e.message})
    except Exception as e:
        logger.error(f"Unexpected error in market sentiment: {e}")
        raise HTTPException(status_code=500, detail={"message": "Internal server error"})

@router.get("/market/coins", response_model=SupportedCoinsResponse)
def get_supported_coins():
    """Get list of supported cryptocurrencies"""
    try:
        client = CoinglassClient()
        raw_data = client.supported_coins()
        
        # Validate and transform response
        supported_coins = []
        if raw_data and 'data' in raw_data:
            for record in raw_data['data']:
                try:
                    coin = SupportedCoin(
                        symbol=record.get('symbol', ''),
                        name=record.get('name', record.get('symbol', '')),
                        is_active=record.get('is_active', True),
                        supported_intervals=record.get('intervals', ['1h', '4h', '1d']),
                        exchange_availability=record.get('exchanges', [])
                    )
                    supported_coins.append(coin)
                except Exception as e:
                    logger.warning(f"Skipped invalid coin record: {e}")
                    continue
        
        # If raw_data is just a list of symbols (simpler format)
        elif isinstance(raw_data, list):
            for symbol in raw_data:
                try:
                    coin = SupportedCoin(
                        symbol=symbol if isinstance(symbol, str) else symbol.get('symbol', ''),
                        name=symbol if isinstance(symbol, str) else symbol.get('name', symbol.get('symbol', '')),
                        is_active=True,
                        supported_intervals=['1h', '4h', '1d'],
                        exchange_availability=[]
                    )
                    supported_coins.append(coin)
                except Exception as e:
                    logger.warning(f"Skipped invalid coin symbol: {e}")
                    continue
        
        return SupportedCoinsResponse(
            data=supported_coins,
            count=len(supported_coins),
            timestamp=datetime.now()
        )
        
    except RateLimitExceeded as e:
        raise HTTPException(status_code=429, detail={"message": "Rate limit exceeded"})
    except HttpError as e:
        logger.error(f"HTTP error in supported coins: {e}")
        raise HTTPException(status_code=e.status_code or 500, detail={"message": e.message})
    except Exception as e:
        logger.error(f"Unexpected error in supported coins: {e}")
        raise HTTPException(status_code=500, detail={"message": "Internal server error"})

@router.get("/liquidation/heatmap/{symbol}", response_model=List[LiquidationHeatmapData])
def get_liquidation_heatmap(
    symbol: str,
    timeframe: str = Query("1h", regex="^(1h|4h|1d)$", description="Timeframe for heatmap data")
):
    """Get liquidation heatmap data for symbol"""
    try:
        client = CoinglassClient()
        raw_data = client.liquidation_heatmap(symbol.upper(), timeframe)
        
        # Validate and transform response
        heatmap_data = []
        if raw_data and 'data' in raw_data:
            for record in raw_data['data']:
                try:
                    heatmap = LiquidationHeatmapData(
                        symbol=symbol.upper(),
                        price_level=float(record.get('price_level', record.get('bucket', 0))),
                        liquidation_amount=float(record.get('liquidation_amount', record.get('qty_sum', 0))),
                        side=record.get('side', 'unknown'),
                        intensity=float(record.get('intensity', record.get('score', 0))),
                        exchange=record.get('exchange'),
                        timestamp=record.get('timestamp')
                    )
                    heatmap_data.append(heatmap)
                except Exception as e:
                    logger.warning(f"Skipped invalid heatmap record: {e}")
                    continue
        
        return heatmap_data
        
    except RateLimitExceeded as e:
        raise HTTPException(status_code=429, detail={"message": "Rate limit exceeded"})
    except HttpError as e:
        logger.error(f"HTTP error in liquidation heatmap: {e}")
        raise HTTPException(status_code=e.status_code or 500, detail={"message": e.message})
    except Exception as e:
        logger.error(f"Unexpected error in liquidation heatmap: {e}")
        raise HTTPException(status_code=500, detail={"message": "Internal server error"})

@router.get("/spot/orderbook/{symbol}", response_model=SpotOrderbook)
def get_spot_orderbook(
    symbol: str,
    exchange: str = Query("binance", description="Exchange for orderbook data")
):
    """Get spot market order book data"""
    try:
        client = CoinglassClient()
        raw_data = client.spot_orderbook(symbol.upper(), exchange)
        
        # Validate and transform response
        if raw_data and 'data' in raw_data:
            data = raw_data['data']
            orderbook = SpotOrderbook(
                symbol=symbol.upper(),
                exchange=exchange,
                bids=data.get('bids', []),
                asks=data.get('asks', []),
                timestamp=data.get('timestamp')
            )
            return orderbook
        
        # Return empty orderbook if no data
        return SpotOrderbook(
            symbol=symbol.upper(),
            exchange=exchange,
            bids=[],
            asks=[],
            timestamp=None
        )
        
    except RateLimitExceeded as e:
        raise HTTPException(status_code=429, detail={"message": "Rate limit exceeded"})
    except HttpError as e:
        logger.error(f"HTTP error in spot orderbook: {e}")
        raise HTTPException(status_code=e.status_code or 500, detail={"message": e.message})
    except Exception as e:
        logger.error(f"Unexpected error in spot orderbook: {e}")
        raise HTTPException(status_code=500, detail={"message": "Internal server error"})

@router.get("/options/oi/{symbol}", response_model=List[OptionsData])
def get_options_oi(
    symbol: str = "BTC"
):
    """Get options open interest data"""
    try:
        client = CoinglassClient()
        raw_data = client.options_oi(symbol.upper())
        
        # Validate and transform response
        options_data = []
        if raw_data and 'data' in raw_data:
            for record in raw_data['data']:
                try:
                    option = OptionsData(
                        symbol=symbol.upper(),
                        strike_price=float(record.get('strike_price', 0)),
                        expiry_date=record.get('expiry_date'),
                        option_type=record.get('option_type', record.get('type', 'unknown')),
                        open_interest=float(record.get('open_interest', 0)),
                        volume_24h=float(record.get('volume_24h', 0)),
                        implied_volatility=record.get('implied_volatility'),
                        timestamp=record.get('timestamp')
                    )
                    options_data.append(option)
                except Exception as e:
                    logger.warning(f"Skipped invalid options record: {e}")
                    continue
        
        return options_data
        
    except RateLimitExceeded as e:
        raise HTTPException(status_code=429, detail={"message": "Rate limit exceeded"})
    except HttpError as e:
        logger.error(f"HTTP error in options OI: {e}")
        raise HTTPException(status_code=e.status_code or 500, detail={"message": e.message})
    except Exception as e:
        logger.error(f"Unexpected error in options OI: {e}")
        raise HTTPException(status_code=500, detail={"message": "Internal server error"})


# === NEW STANDARD PACKAGE ENDPOINTS ===

@router.get("/oi/history/{symbol}")
def get_oi_history(
    symbol: str,
    interval: str = Query("1h", description="Time interval (1h, 4h, 1d)")
):
    """Get Open Interest history for specific pair (Standard Package)"""
    try:
        client = CoinglassClient()
        raw_data = client.oi_history(symbol, interval)
        return raw_data
    except Exception as e:
        logger.error(f"Error in OI history: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/oi/aggregated/{symbol}")
def get_oi_aggregated(
    symbol: str,
    interval: str = Query("1h", description="Time interval (1h, 4h, 1d)")
):
    """Get Aggregated Open Interest OHLC (Standard Package)"""
    try:
        client = CoinglassClient()
        raw_data = client.oi_aggregated_history(symbol, interval)
        return raw_data
    except Exception as e:
        logger.error(f"Error in OI aggregated: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/funding/rate/{symbol}")
def get_funding_rate(
    symbol: str,
    interval: str = Query("8h", description="Time interval (8h, 1h, 4h)"),
    exchange: str = Query("OKX", description="Exchange name")
):
    """Get funding rate history (All Packages)"""
    try:
        client = CoinglassClient()
        raw_data = client.funding_rate(symbol, interval, exchange)
        return raw_data
    except Exception as e:
        logger.error(f"Error in funding rate: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/long-short-ratio/{symbol}")
def get_long_short_ratio(
    symbol: str,
    interval: str = Query("1h", description="Time interval (1h, 4h, 1d)")
):
    """Get global long-short account ratio (Standard Package)"""
    try:
        client = CoinglassClient()
        raw_data = client.global_long_short_ratio(symbol, interval)
        return raw_data
    except Exception as e:
        logger.error(f"Error in long-short ratio: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/taker-volume/{symbol}")
def get_taker_volume(
    symbol: str,
    exchange: str = Query("OKX", description="Exchange name"),
    interval: str = Query("1h", description="Time interval")
):
    """Get taker buy/sell volume data (pair-level)"""
    try:
        client = CoinglassClient()
        raw_data = client.taker_buysell_volume(symbol, exchange, interval)
        return raw_data
    except Exception as e:
        logger.error(f"Error in taker volume: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/taker-volume-aggregated/{coin}")
def get_taker_volume_aggregated(
    coin: str,
    interval: str = Query("1h", description="Time interval")
):
    """Get aggregated taker buy/sell volume data (coin-level fallback)"""
    try:
        client = CoinglassClient()
        raw_data = client.taker_buysell_volume_aggregated(coin, interval)
        return raw_data
    except Exception as e:
        logger.error(f"Error in aggregated taker volume: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/liquidation/coin-history/{symbol}")
def get_liquidation_coin_history(
    symbol: str,
    interval: str = Query("1h", description="Time interval")
):
    """Get coin liquidation history (Standard Package)"""
    try:
        client = CoinglassClient()
        raw_data = client.liquidation_history_coin(symbol, interval)
        return raw_data
    except Exception as e:
        logger.error(f"Error in liquidation history: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/orderbook/futures-history/{symbol}")
def get_futures_orderbook_history(
    symbol: str,
    exchange: str = Query("Binance", description="Exchange name")
):
    """Get futures orderbook history (Standard Package)"""
    try:
        client = CoinglassClient()
        raw_data = client.futures_orderbook_askbids_history(symbol, exchange)
        return raw_data
    except Exception as e:
        logger.error(f"Error in futures orderbook history: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/coins-markets")
def get_coins_markets():
    """Get futures coins markets screener (Standard Package)"""
    try:
        client = CoinglassClient()
        raw_data = client.coins_markets()
        return raw_data
    except Exception as e:
        logger.error(f"Error in coins markets: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/exchanges/oi-list")
def get_oi_exchange_list():
    """Get exchange list for open interest (Standard Package)"""
    try:
        client = CoinglassClient()
        raw_data = client.oi_exchange_list()
        return raw_data
    except Exception as e:
        logger.error(f"Error in OI exchange list: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/exchanges/taker-volume-list")
def get_taker_volume_exchanges():
    """Get exchange list for taker buy/sell volume (All Packages)"""
    try:
        client = CoinglassClient()
        raw_data = client.taker_buysell_volume_exchanges()
        return raw_data
    except Exception as e:
        logger.error(f"Error in taker volume exchanges: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/health")
def health_check():
    """Health check endpoint for the advanced CoinGlass API"""
    try:
        # Test basic connectivity to CoinGlass API
        client = CoinglassClient()
        test_data = client.supported_coins()
        
        return {
            "status": "healthy",
            "timestamp": str(datetime.now()),
            "api_connection": "ok" if test_data else "degraded",
            "message": "Advanced CoinGlass API is operational"
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "timestamp": str(datetime.now()),
                "api_connection": "error",
                "error": str(e),
                "message": "Advanced CoinGlass API is experiencing issues"
            }
        )

@router.get("/orderbook/futures-askbids/{symbol}")
def get_futures_orderbook_askbids(
    symbol: str,
    exchange: str = Query("Binance", description="Exchange name")
):
    """Get futures orderbook ask-bids history for liquidity analysis (Standard)"""
    try:
        client = CoinglassClient()
        raw_data = client.futures_orderbook_askbids_history(symbol, exchange)
        return raw_data
    except Exception as e:
        logger.error(f"Error in futures orderbook: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/orderbook/futures-aggregated/{coin}")
def get_futures_orderbook_aggregated(
    coin: str
):
    """Get aggregated futures orderbook for coin-level liquidity (Standard)"""
    try:
        client = CoinglassClient()
        raw_data = client.futures_orderbook_aggregated(coin)
        return raw_data
    except Exception as e:
        logger.error(f"Error in aggregated orderbook: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/sniper-timing/{coin}")
def get_sniper_timing_signals(
    coin: str,
    exchange: str = Query("Binance", description="Exchange for analysis")
):
    """Get institutional-grade 5-minute LONG/SHORT sniper signals"""
    try:
        engine = SniperTimingEngine()
        signal_data = engine.analyze_sniper_signals(coin.upper(), exchange)
        return signal_data
    except Exception as e:
        logger.error(f"Error in sniper timing analysis: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})

@router.get("/sniper-timing/multi-scan")
def get_multi_coin_sniper_scan(
    coins: str = Query("BTC,ETH,SOL", description="Comma-separated coin list")
):
    """Scan multiple coins for best sniper timing opportunities"""
    try:
        coin_list = [coin.strip().upper() for coin in coins.split(",")]
        engine = SniperTimingEngine()
        results = engine.multi_coin_scan(coin_list)
        
        return {
            "scan_results": results,
            "best_signals": [r for r in results if r.get('confidence', 0) >= 70],
            "timestamp": int(time.time() * 1000),
            "coins_scanned": len(coin_list)
        }
    except Exception as e:
        logger.error(f"Error in multi-coin sniper scan: {e}")
        raise HTTPException(status_code=500, detail={"message": str(e)})
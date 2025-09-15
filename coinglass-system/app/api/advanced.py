from fastapi import APIRouter
from app.core.coinglass_client import CoinglassClient
from app.models.schemas import WhaleAlert, WhalePosition, ETFData, ETFFlowHistory, MarketSentiment

router = APIRouter(prefix="/advanced", tags=["advanced"])

@router.get("/whale/alerts")
def get_whale_alerts():
    """Get whale alerts for large positions >$1M"""
    return CoinglassClient().whale_alerts()

@router.get("/whale/positions")
def get_whale_positions():
    """Get current whale positions >$1M notional value"""
    return CoinglassClient().whale_positions()

@router.get("/etf/bitcoin")
def get_bitcoin_etfs():
    """Get Bitcoin ETF list and status information"""
    return CoinglassClient().bitcoin_etfs()

@router.get("/etf/flows")
def get_etf_flows_history(days: int = 30):
    """Get historical Bitcoin ETF flow data"""
    return CoinglassClient().etf_flows_history(days)

@router.get("/market/sentiment")
def get_market_sentiment():
    """Get futures performance metrics and market sentiment"""
    return CoinglassClient().market_sentiment()

@router.get("/market/coins")
def get_supported_coins():
    """Get list of supported cryptocurrencies"""
    return CoinglassClient().supported_coins()

@router.get("/liquidation/heatmap/{symbol}")
def get_liquidation_heatmap(symbol: str, timeframe: str = "1h"):
    """Get liquidation heatmap data for symbol"""
    return CoinglassClient().liquidation_heatmap(symbol.upper(), timeframe)

@router.get("/spot/orderbook/{symbol}")
def get_spot_orderbook(symbol: str, exchange: str = "binance"):
    """Get spot market order book data"""
    return CoinglassClient().spot_orderbook(symbol.upper(), exchange)

@router.get("/options/oi/{symbol}")
def get_options_oi(symbol: str = "BTC"):
    """Get options open interest data"""
    return CoinglassClient().options_oi(symbol.upper())
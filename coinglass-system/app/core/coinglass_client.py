from app.core.http import Http
from app.core.settings import settings

class CoinglassClient:
    def __init__(self):
        self.http = Http({
            "CG-API-KEY": settings.CG_API_KEY,
            "accept": "application/json"
        })
        self.base_url = "https://open-api-v4.coinglass.com"

    def oi_ohlc(self, symbol: str, interval: str, aggregated: bool = False):
        url = f"{self.base_url}/api/futures/openInterest/ohlc"
        params = {
            "symbol": symbol,
            "interval": interval,
            "aggregated": aggregated
        }
        response = self.http.get(url, params)
        return response.json()

    def funding_rate(self, symbol: str, interval: str = "1h"):
        url = f"{self.base_url}/api/futures/fundingRate"
        params = {"symbol": symbol, "interval": interval}
        response = self.http.get(url, params)
        return response.json()

    def liquidations(self, symbol: str, timeframe: str = "1h"):
        url = f"{self.base_url}/api/futures/liquidation"
        params = {"symbol": symbol, "timeframe": timeframe}
        response = self.http.get(url, params)
        return response.json()

    def long_short_ratio(self, symbol: str, interval: str = "1h"):
        url = f"{self.base_url}/api/futures/longShortRatio"
        params = {"symbol": symbol, "interval": interval}
        response = self.http.get(url, params)
        return response.json()

    # === WHALE POSITION ENDPOINTS ===
    def whale_alerts(self, exchange: str = "hyperliquid"):
        """Get whale alerts for large positions >$1M"""
        url = f"{self.base_url}/api/{exchange}/whale-alert"
        response = self.http.get(url)
        return response.json()

    def whale_positions(self, exchange: str = "hyperliquid"):
        """Get current whale positions >$1M notional value"""
        url = f"{self.base_url}/api/{exchange}/whale-position"
        response = self.http.get(url)
        return response.json()

    # === ETF FLOW ENDPOINTS ===
    def bitcoin_etfs(self):
        """Get Bitcoin ETF list and status information"""
        url = f"{self.base_url}/api/bitcoin-etfs"
        response = self.http.get(url)
        return response.json()

    def etf_flows_history(self, days: int = 30):
        """Get historical Bitcoin ETF flow data"""
        url = f"{self.base_url}/api/etf-flows-history"
        params = {"days": days}
        response = self.http.get(url, params)
        return response.json()

    # === MACRO SENTIMENT ENDPOINTS ===
    def supported_coins(self):
        """Get list of supported cryptocurrencies"""
        url = f"{self.base_url}/api/coins"
        response = self.http.get(url)
        return response.json()

    def market_sentiment(self):
        """Get futures performance metrics and market sentiment"""
        url = f"{self.base_url}/api/futures/coins-markets"
        response = self.http.get(url)
        return response.json()

    # === ADVANCED LIQUIDATION ENDPOINTS ===
    def liquidation_heatmap(self, symbol: str, timeframe: str = "1h"):
        """Get liquidation heatmap data"""
        url = f"{self.base_url}/api/futures/liquidation-heatmap"
        params = {"symbol": symbol, "timeframe": timeframe}
        response = self.http.get(url, params)
        return response.json()

    # === SPOT MARKET ENDPOINTS ===
    def spot_orderbook(self, symbol: str, exchange: str = "binance"):
        """Get spot market order book data"""
        url = f"{self.base_url}/api/spot/orderbook"
        params = {"symbol": symbol, "exchange": exchange}
        response = self.http.get(url, params)
        return response.json()

    # === OPTIONS ENDPOINTS ===
    def options_oi(self, symbol: str = "BTC"):
        """Get options open interest data"""
        url = f"{self.base_url}/api/options/open-interest"
        params = {"symbol": symbol}
        response = self.http.get(url, params)
        return response.json()
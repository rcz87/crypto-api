from app.core.http import Http
from app.core.settings import settings

class CoinglassClient:
    def __init__(self):
        self.http = Http({
            "CG-API-KEY": settings.CG_API_KEY,
            "accept": "application/json"
        })
        self.base_url = "https://open-api-v4.coinglass.com"

    # === STANDARD PACKAGE ENDPOINTS (Verified v4) ===
    
    # 1. Open Interest (OI) - Available in Standard
    def oi_history(self, symbol: str, interval: str = "1h"):
        """Get Open Interest history for specific pair"""
        url = f"{self.base_url}/api/futures/open-interest/history"
        params = {"symbol": symbol, "interval": interval}
        response = self.http.get(url, params)
        return response.json()
    
    def oi_aggregated_history(self, symbol: str, interval: str = "1h"):
        """Get Aggregated Open Interest OHLC"""
        url = f"{self.base_url}/api/futures/open-interest/aggregated-history"
        params = {"symbol": symbol, "interval": interval}
        response = self.http.get(url, params)
        return response.json()

    # 2. Funding Rate - Available in all packages
    def funding_rate(self, symbol: str, interval: str = "8h", exchange: str = "Binance"):
        """Get funding rate history"""
        url = f"{self.base_url}/api/futures/funding-rate/history"
        # Use instrument format for funding rate
        params = {"instrument": f"{symbol}USDT", "interval": interval, "exchange": exchange}
        response = self.http.get(url, params)
        return response.json()

    # 3. Long/Short Ratio - Available in Standard
    def global_long_short_ratio(self, symbol: str, interval: str = "1h"):
        """Get global long-short account ratio history"""
        url = f"{self.base_url}/api/futures/global-long-short-account-ratio/history"
        params = {"symbol": symbol, "interval": interval}
        response = self.http.get(url, params)
        return response.json()

    # 4. Taker Buy/Sell Volume - Available in all packages
    def taker_buysell_volume_exchanges(self):
        """Get exchange list for taker buy/sell volume"""
        url = f"{self.base_url}/api/futures/supported-exchange"
        response = self.http.get(url)
        return response.json()
    
    def taker_buysell_volume(self, symbol: str, exchange: str = "Binance", interval: str = "1h"):
        """Get taker buy/sell volume data"""
        url = f"{self.base_url}/api/futures/taker-buy-sell-volume/history"
        # Use both symbol and exchange parameters
        params = {"symbol": symbol, "exchange": exchange, "interval": interval}
        response = self.http.get(url, params)
        return response.json()

    # 5. Liquidation History - Available in Standard
    def liquidation_history_coin(self, symbol: str, interval: str = "1h"):
        """Get coin liquidation history"""
        url = f"{self.base_url}/api/futures/liquidation/coin-history"
        params = {"symbol": symbol, "interval": interval}
        response = self.http.get(url, params)
        return response.json()
    
    def liquidation_history_pair(self, symbol: str, exchange: str = "Binance", interval: str = "1h"):
        """Get pair liquidation history"""
        url = f"{self.base_url}/api/futures/liquidation/pair-history"
        params = {"symbol": symbol, "exchange": exchange, "interval": interval}
        response = self.http.get(url, params)
        return response.json()

    # 6. Orderbook History - Available from Standard
    def futures_orderbook_history(self, symbol: str, exchange: str = "Binance"):
        """Get futures orderbook history"""
        url = f"{self.base_url}/api/futures/orderbook/history"
        params = {"symbol": symbol, "exchange": exchange}
        response = self.http.get(url, params)
        return response.json()
    
    def spot_orderbook_history(self, symbol: str, exchange: str = "Binance"):
        """Get spot orderbook history"""
        url = f"{self.base_url}/api/spot/orderbook/history"
        params = {"symbol": symbol, "exchange": exchange}
        response = self.http.get(url, params)
        return response.json()

    # 7. Large Limit Orders - Available from Standard
    def large_limit_orders(self, symbol: str, exchange: str = "Binance"):
        """Get large limit order history (spot)"""
        url = f"{self.base_url}/api/spot/orderbook/large-limit-order-history"
        params = {"symbol": symbol, "exchange": exchange}
        response = self.http.get(url, params)
        return response.json()

    # 8. Coins Markets - Available from Standard
    def coins_markets(self):
        """Get futures coins markets (screener)"""
        url = f"{self.base_url}/api/futures/coins-markets"
        response = self.http.get(url)
        return response.json()

    # 9. Supported Coins & Exchange Lists - Available from Standard
    def supported_coins(self):
        """Get list of supported cryptocurrencies"""
        url = f"{self.base_url}/api/futures/supported-coins"
        response = self.http.get(url)
        return response.json()
    
    def oi_exchange_list(self):
        """Get exchange list for open interest"""
        url = f"{self.base_url}/api/futures/open-interest/exchange-list"
        response = self.http.get(url)
        return response.json()

    # LEGACY METHODS (keeping for backward compatibility)
    def oi_ohlc(self, symbol: str, interval: str, aggregated: bool = False):
        """Legacy method - redirects to new implementation"""
        if aggregated:
            return self.oi_aggregated_history(symbol, interval)
        else:
            return self.oi_history(symbol, interval)

    def liquidations(self, symbol: str, timeframe: str = "1h"):
        """Legacy method - redirects to coin liquidation history"""
        return self.liquidation_history_coin(symbol, timeframe)

    def long_short_ratio(self, symbol: str, interval: str = "1h"):
        """Legacy method - redirects to global long-short ratio"""
        return self.global_long_short_ratio(symbol, interval)

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
        url = f"{self.base_url}/api/etf/bitcoin-etfs"
        response = self.http.get(url)
        return response.json()

    def etf_flows_history(self, days: int = 30):
        """Get historical Bitcoin ETF flow data"""
        url = f"{self.base_url}/api/etf/flows-history"
        params = {"days": days}
        response = self.http.get(url, params)
        return response.json()

    # === MACRO SENTIMENT ENDPOINTS ===
    def supported_coins(self):
        """Get list of supported cryptocurrencies"""
        url = f"{self.base_url}/api/futures/supported-coins"
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
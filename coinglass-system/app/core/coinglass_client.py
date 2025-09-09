from app.core.http import Http
from app.core.settings import settings

class CoinglassClient:
    def __init__(self):
        self.http = Http({"Authorization": f"Bearer {settings.CG_API_KEY}"})
        self.base_url = "https://api.coinglass.com"

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
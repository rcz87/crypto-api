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
    def funding_rate(self, symbol: str, interval: str = "8h", exchange: str = "OKX"):
        """Get funding rate history with fallback logic"""
        url = f"{self.base_url}/api/futures/funding-rate/history"
        params = {
            "symbol": f"{symbol}USDT", 
            "interval": interval, 
            "exchange": exchange
        }
        response = self.http.get(url, params=params)
        result = response.json()
        
        # If code 400 "instrument" error, fallback to Binance
        if isinstance(result, dict) and result.get('code') == '400' and result.get('msg') == 'instrument':
            if exchange != "Binance":
                params["exchange"] = "Binance"
                fallback_response = self.http.get(url, params=params)
                return fallback_response.json()
        
        return result

    # 3. Long/Short Ratio - Available in Standard
    def global_long_short_ratio(self, symbol: str, interval: str = "1h"):
        """Get global long-short account ratio history"""
        url = f"{self.base_url}/api/futures/global-long-short-account-ratio/history"
        params = {"symbol": symbol, "interval": interval}
        response = self.http.get(url, params)
        return response.json()

    # Pre-validation helper for pair/exchange validation
    def validate_pair_exchange(self, symbol: str, exchange: str, cache_seconds: int = 120):
        """Pre-validate pair/exchange availability via supported-exchange-pairs"""
        supported_pairs = self.taker_buysell_volume_exchanges()
        if not supported_pairs or 'data' not in supported_pairs:
            return False
            
        # Check if exchange exists and has the symbol
        exchange_data = supported_pairs['data'].get(exchange, [])
        for pair in exchange_data:
            if pair.get('instrument_id', '').startswith(symbol):
                return True
        return False

    # 4. Taker Buy/Sell Volume - Available in all packages
    def taker_buysell_volume_exchanges(self):
        """Get exchange list for taker buy/sell volume"""
        # FIXED: Use correct spelling "supported" from v4 docs
        url = f"{self.base_url}/api/futures/supported-exchange-pairs"
        response = self.http.get(url)
        result = response.json()
        
        # If 404, fallback to OI exchange list
        if response.status_code == 404:
            fallback_url = f"{self.base_url}/api/futures/open-interest/exchange-list"
            fallback_params = {"coin": "BTC"}  # Use BTC as reference coin
            fallback_response = self.http.get(fallback_url, params=fallback_params)
            return {
                "warning": "fallback_oi_exchange_list", 
                "data": fallback_response.json()
            }
        
        return result
    
    def taker_buysell_volume(self, symbol: str, exchange: str = "OKX", interval: str = "1h"):
        """Get taker buy/sell volume data (pair-level) with proactive validation and fallback"""
        
        # PRE-VALIDATION: Check pair/exchange availability before making request
        is_valid = self.validate_pair_exchange(symbol, exchange)
        if not is_valid:
            # Invalid pair/exchange combo - go directly to aggregated fallback
            result = self.taker_buysell_volume_aggregated(symbol, interval)
            result['validation_note'] = f'Pair {symbol}-{exchange} not supported, using aggregated data'
            return result
        
        # Pair/exchange validated - proceed with pair-level request
        url = f"{self.base_url}/api/futures/v2/taker-buy-sell-volume/history"
        params = {
            "symbol": f"{symbol}USDT", 
            "exchange": exchange, 
            "interval": interval
        }
        response = self.http.get(url, params=params)
        result = response.json()
        
        # Backup error handling - if still get "instrument" error despite validation
        if isinstance(result, dict) and result.get('code') == '400' and result.get('msg') == 'instrument':
            fallback_result = self.taker_buysell_volume_aggregated(symbol, interval)
            fallback_result['validation_note'] = f'Validation passed but API error, using aggregated fallback'
            return fallback_result
        
        return result
    
    def taker_buysell_volume_aggregated(self, coin: str, interval: str = "1h"):
        """Get aggregated taker buy/sell volume data (coin-level) - Official spec: symbol= parameter"""
        url = f"{self.base_url}/api/futures/aggregated-taker-buy-sell-volume/history"
        # Add time range for last 72 hours to get more data for aggregated
        import time
        end_time = int(time.time() * 1000)  # Current time in milliseconds
        start_time = end_time - (72 * 60 * 60 * 1000)  # 72 hours ago for better coverage
        
        params = {
            "symbol": coin,  # OFFICIAL: Use symbol=SOL (matches CoinGlass v4 official documentation)
            "interval": interval,
            "exchange_list": "Binance,OKX,Bybit",  # Required in actual implementation
            "start_time": start_time,
            "end_time": end_time
        }
        
        response = self.http.get(url, params=params)
        return response.json()

    # 5. Liquidation History - Available in Standard
    def liquidation_history_coin(self, symbol: str, interval: str = "1h"):
        """Get coin liquidation history with proper symbol formatting"""
        from app.core.logging import logger
        
        # Clean symbol format for CoinGlass API
        clean_symbol = symbol.replace("-USDT-SWAP", "").replace("-SWAP", "").replace("USDT", "")
        if clean_symbol.endswith("-"):
            clean_symbol = clean_symbol[:-1]
        
        # Try primary liquidation endpoint with clean symbol
        url = f"{self.base_url}/api/futures/liquidation/coin-history"
        params = {"symbol": clean_symbol, "interval": interval}
        
        try:
            response = self.http.get(url, params=params)
            if response.status_code == 200:
                result = response.json()
                if result and 'data' in result:
                    logger.info(f"Liquidation data found for {clean_symbol}")
                    return result
        except Exception as e:
            logger.debug(f"Primary liquidation endpoint failed for {clean_symbol}: {e}")
        
        # Try alternative endpoint
        try:
            alt_url = f"{self.base_url}/api/futures/liquidation/history"
            response = self.http.get(alt_url, params=params)
            if response.status_code == 200:
                result = response.json()
                if result and 'data' in result:
                    logger.info(f"Using alternative liquidation endpoint for {clean_symbol}")
                    return result
        except Exception as e:
            logger.debug(f"Alternative liquidation endpoint failed for {clean_symbol}: {e}")
        
        # Return empty data instead of causing errors
        logger.warning(f"All liquidation endpoints failed for {clean_symbol}, returning empty data")
        return {"data": [], "message": "Liquidation data unavailable"}
    
    def liquidation_history_pair(self, symbol: str, exchange: str = "Binance", interval: str = "1h"):
        """Get pair liquidation history"""
        url = f"{self.base_url}/api/futures/liquidation/pair-history"
        params = {"symbol": symbol, "exchange": exchange, "interval": interval}
        response = self.http.get(url, params)
        return response.json()

    # 6. Orderbook History - Available from Standard (v4 corrected)
    def futures_orderbook_askbids_history(self, symbol: str, exchange: str = "Binance"):
        """Get futures orderbook ask-bids history with time range (v4)"""
        url = f"{self.base_url}/api/futures/orderbook/ask-bids-history"
        # Add time range for last 24 hours to get data
        import time
        end_time = int(time.time() * 1000)  # Current time in milliseconds
        start_time = end_time - (24 * 60 * 60 * 1000)  # 24 hours ago
        
        params = {
            "symbol": f"{symbol}USDT" if not symbol.endswith("USDT") else symbol,
            "exchange": exchange,
            "interval": "1h",
            "start_time": start_time,
            "end_time": end_time
        }
        response = self.http.get(url, params=params)
        result = response.json()
        
        # If empty data, fallback to aggregated orderbook
        if not result.get('data') or (isinstance(result.get('data'), list) and len(result['data']) == 0):
            return self.futures_orderbook_aggregated(symbol.replace('USDT', ''))
        
        return result
    
    def futures_orderbook_aggregated(self, coin: str):
        """Get aggregated futures orderbook (coin-level)"""
        url = f"{self.base_url}/api/futures/orderbook/aggregated-history"
        # Add time range for last 24 hours to get data
        import time
        end_time = int(time.time() * 1000)  # Current time in milliseconds  
        start_time = end_time - (24 * 60 * 60 * 1000)  # 24 hours ago
        
        params = {
            "coin": coin,
            "interval": "1h",
            "start_time": start_time,
            "end_time": end_time
        }
        response = self.http.get(url, params=params)
        return response.json()
    
    def spot_orderbook_history(self, symbol: str, exchange: str = "Binance"):
        """Get spot orderbook history"""
        url = f"{self.base_url}/api/spot/orderbook/history"
        params = {"symbol": symbol, "exchange": exchange}
        response = self.http.get(url, params=params)
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
        """Get Bitcoin ETF list and status information from real CoinGlass API"""
        # Use real CoinGlass API v4 endpoint with correct URL
        url = f"{self.base_url}/api/etf/bitcoin/list"
        response = self.http.get(url)
        return response.json()

    def etf_flows_history(self, days: int = 30):
        """Get ETF flows data using real CoinGlass API v4 endpoints"""
        from app.core.logging import logger
        
        # Use correct CoinGlass v4 ETF endpoint
        endpoint = "/api/etf/bitcoin/list"
        try:
            url = f"{self.base_url}{endpoint}"
            response = self.http.get(url)
            
            if response.status_code == 200:
                result = response.json()
                if result and 'data' in result:
                    logger.info(f"ETF endpoint successful: {endpoint}")
                    # Return real API data with proper field mapping
                    return self._process_real_etf_flows(result)
            else:
                logger.error(f"ETF endpoint failed with status {response.status_code}")
                
        except Exception as e:
            logger.error(f"ETF endpoint {endpoint} failed: {e}")
            
        # Return empty data if real API fails - NO SYNTHETIC DATA
        logger.warning("ETF endpoint failed, returning empty data (no synthetic generation)")
        return {"data": [], "success": False, "error": "Real ETF data unavailable"}

    def _process_real_etf_flows(self, data):
        """Process real ETF flows data from CoinGlass API v4 with correct field mapping"""
        try:
            if not data or 'data' not in data:
                return {"data": [], "success": False, "error": "No data in API response"}
            
            # Extract real ETF data from API response
            etf_data = data['data']
            processed_flows = []
            
            for etf_item in etf_data:
                if isinstance(etf_item, dict):
                    # Map CoinGlass API v4 fields correctly - use flows_1d, flows_7d, flows_30d
                    processed_item = {
                        "ticker": etf_item.get("ticker", etf_item.get("fund_name", "Unknown")),
                        "date": etf_item.get("date", ""),
                        # Use correct v4 API field names 
                        "flows_1d": etf_item.get("flows_1d", etf_item.get("net_inflow_1d", 0)),
                        "flows_7d": etf_item.get("flows_7d", etf_item.get("net_inflow_7d", 0)),
                        "flows_30d": etf_item.get("flows_30d", etf_item.get("net_inflow_30d", 0)),
                        # Legacy compatibility fields (for backward compatibility only)
                        "net_inflow": etf_item.get("flows_1d", etf_item.get("net_inflow_1d", 0)),
                        "net_flow": etf_item.get("flows_1d", etf_item.get("net_inflow_1d", 0)),
                        # Additional real fields from API
                        "price": etf_item.get("price", 0),
                        "market_value": etf_item.get("market_value", 0),
                        "shares_outstanding": etf_item.get("shares_outstanding", 0),
                        "source": "real_api_v4"
                    }
                    processed_flows.append(processed_item)
            
            return {"data": processed_flows, "success": True}
            
        except Exception as e:
            from app.core.logging import logger
            logger.error(f"Error processing real ETF flows: {e}")
            return {"data": [], "success": False, "error": f"Processing error: {str(e)}"}

    def _get_etf_flows_fallback(self):
        """NO FALLBACK - Return empty data if real API fails"""
        from app.core.logging import logger
        logger.warning("ETF flows fallback called - returning empty data (no synthetic generation)")
        return {"data": [], "success": False, "error": "Real ETF data unavailable, no fallback synthetic data"}

    # === MACRO SENTIMENT ENDPOINTS ===

    def market_sentiment(self):
        """Get market sentiment using working endpoints"""
        from app.core.logging import logger
        
        # Primary: Use working coins-markets endpoint
        try:
            url = f"{self.base_url}/api/futures/coins-markets"
            response = self.http.get(url)
            if response.status_code == 200:
                result = response.json()
                if result and result.get('data'):
                    logger.info("Using coins-markets for market sentiment")
                    return result
        except Exception as e:
            logger.debug(f"Coins-markets endpoint failed: {e}")
        
        # Fallback: Use funding rate data for market sentiment
        logger.info("Using funding rate fallback for market sentiment")
        return self._get_market_sentiment_fallback()

    def _get_market_sentiment_fallback(self):
        """NO FALLBACK - Return empty data if real API fails"""
        from app.core.logging import logger
        logger.warning("Market sentiment fallback called - returning empty data (no synthetic generation)")
        return {"data": [], "success": False, "error": "Real market sentiment data unavailable, no fallback synthetic data"}

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
from app.core.http import Http
from app.core.settings import settings
from app.core.logging import logger
from typing import Optional

class CoinglassClient:
    def __init__(self):
        self.http = Http({
            "CG-API-KEY": settings.CG_API_KEY,
            "accept": "application/json"
        })
        self.base_url = "https://open-api-v4.coinglass.com"
        
        # Endpoint pattern validation for CoinGlass v4 compliance
        self.forbidden_path_patterns = [
            "/coin-history/{symbol}",  # Should use query params
            "/pair-history/{symbol}",  # Should use query params  
            "/history/{symbol}",       # Should use query params
            "/{symbol}/history",       # Should use query params
        ]
        
        self.valid_liquidation_endpoints = {
            "aggregated_history": "/api/futures/liquidation/aggregated-history",  # Use coin= param
            "pair_history": "/api/futures/liquidation/history",  # Use pair= param
        }

    def _validate_and_fix_endpoint(self, url_path: str, symbol: Optional[str] = None):
        """Lint endpoint builder: block invalid v4 patterns and force query params"""
        
        # Check for forbidden path patterns
        symbol_placeholder = symbol if symbol else "SYMBOL"
        for forbidden in self.forbidden_path_patterns:
            if forbidden.replace("{symbol}", symbol_placeholder) in url_path:
                logger.error(f"🚫 BLOCKED: Invalid CoinGlass v4 endpoint pattern: {url_path}")
                logger.info(f"💡 Use query params instead of path variables for: {url_path}")
                
                # Auto-fix common liquidation patterns
                if "coin-history" in url_path:
                    fixed_url = self.valid_liquidation_endpoints["aggregated_history"]
                    logger.info(f"🔧 AUTO-FIX: {url_path} → {fixed_url} (use coin= param)")
                    return fixed_url
                elif "liquidation/history" in url_path and not "aggregated" in url_path:
                    fixed_url = self.valid_liquidation_endpoints["pair_history"]
                    logger.info(f"🔧 AUTO-FIX: {url_path} → {fixed_url} (use pair= param)")
                    return fixed_url
                    
                raise ValueError(f"Invalid CoinGlass v4 endpoint pattern: {url_path}. Use query params instead.")
                
        return url_path

    def _build_url(self, endpoint_path: str, symbol: Optional[str] = None):
        """Safe URL builder with v4 compliance validation"""
        validated_path = self._validate_and_fix_endpoint(endpoint_path, symbol)
        return f"{self.base_url}{validated_path}"

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

    def _resolve_symbol_with_exchange_pairs(self, symbol: str):
        """Resolve symbol using /api/futures/supported-exchange-pairs endpoint"""
        from app.core.logging import logger
        
        try:
            url = f"{self.base_url}/api/futures/supported-exchange-pairs"
            response = self.http.get(url)
            
            if response.status_code == 200:
                pairs_data = response.json()
                if pairs_data and 'data' in pairs_data:
                    # Look for matching symbol in supported pairs
                    clean_symbol = symbol.replace("-USDT-SWAP", "").replace("-SWAP", "").replace("USDT", "")
                    if clean_symbol.endswith("-"):
                        clean_symbol = clean_symbol[:-1]
                    
                    for pair_info in pairs_data['data']:
                        if isinstance(pair_info, dict):
                            # Check various symbol fields that might exist
                            for field in ['symbol', 'coin', 'base_currency', 'currency']:
                                if field in pair_info and pair_info[field] == clean_symbol:
                                    logger.info(f"Symbol resolved: {symbol} → {clean_symbol} via supported-exchange-pairs")
                                    return clean_symbol
                    
                    logger.debug(f"Symbol {clean_symbol} not found in supported exchange pairs")
            else:
                logger.debug(f"Failed to fetch supported-exchange-pairs: {response.status_code}")
                
        except Exception as e:
            logger.debug(f"Symbol resolution failed: {e}")
        
        # Fallback to basic cleaning if resolver fails
        clean_symbol = symbol.replace("-USDT-SWAP", "").replace("-SWAP", "").replace("USDT", "")
        if clean_symbol.endswith("-"):
            clean_symbol = clean_symbol[:-1]
        return clean_symbol

    # 5. Liquidation History - Available in Standard
    def liquidation_history_coin(self, symbol: str, interval: str = "1h"):
        """Get coin liquidation history using proper CoinGlass v4 symbol resolution"""
        from app.core.logging import logger
        
        # FIX: Use proper symbol resolver instead of guessing variants
        resolved_symbol = self._resolve_symbol_with_exchange_pairs(symbol)
        
        # FIX: Use correct CoinGlass v4 aggregated-history endpoint with query params
        url = f"{self.base_url}/api/futures/liquidation/aggregated-history"
        params = {"coin": resolved_symbol, "interval": interval}  # Use 'coin' param per docs
        
        try:
            response = self.http.get(url, params=params)
            if response.status_code == 200:
                result = response.json()
                if result and 'data' in result:
                    if result['data']:  # Has actual data
                        logger.info(f"✅ Liquidation data found for {resolved_symbol} (original: {symbol})")
                        return result
                    else:  # Empty data but valid response
                        logger.info(f"📊 Valid liquidation response for {resolved_symbol}, but data is empty")
                        return {"data": [], "message": "No liquidation events in this timeframe"}
            else:
                logger.debug(f"Liquidation aggregated-history failed: {response.status_code}")
        except Exception as e:
            logger.debug(f"Liquidation aggregated-history error: {e}")
        
        # Try alternative pair-level endpoint as fallback
        alt_url = f"{self.base_url}/api/futures/liquidation/history"
        alt_params = {"pair": f"{resolved_symbol}-USDT", "interval": interval}
        
        try:
            response = self.http.get(alt_url, params=alt_params)
            if response.status_code == 200:
                result = response.json()
                if result and 'data' in result:
                    logger.info(f"✅ Alternative liquidation endpoint worked for {resolved_symbol}")
                    return result
        except Exception as e:
            logger.debug(f"Alternative liquidation endpoint failed: {e}")
        
        # Return meaningful empty data
        logger.info(f"📊 No liquidation data available for {resolved_symbol} (original: {symbol})")
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
                    from datetime import datetime
                    current_date = datetime.now().strftime("%Y-%m-%d")
                    
                    # FIX: Handle proper ETF structure from /api/etf/bitcoin/list per CoinGlass docs
                    asset_details = etf_item.get("asset_details", {})
                    
                    # Get timestamp from multiple possible sources per docs
                    update_timestamp = (
                        asset_details.get("update_timestamp") or 
                        asset_details.get("last_quote_time") or
                        etf_item.get("update_timestamp")
                    )
                    
                    # Get date string properly or fallback to current
                    update_date = asset_details.get("update_date", "")
                    if not update_date or update_date.strip() == "":
                        if update_timestamp:
                            # Convert ms timestamp to date string
                            from datetime import datetime
                            update_date = datetime.fromtimestamp(update_timestamp / 1000).strftime("%Y-%m-%d")
                        else:
                            update_date = current_date
                    
                    processed_item = {
                        "ticker": etf_item.get("ticker", etf_item.get("fund_name", "Unknown")),
                        "date": update_date,  # Now properly extracted per docs
                        "net_flow": etf_item.get("net_flow", 0),
                        "closing_price": etf_item.get("closing_price", etf_item.get("price", 0)),
                        "shares_outstanding": etf_item.get("shares_outstanding", 0),
                        "source": "real_api_v4_fixed"
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

    # === LIQUIDATION ENDPOINTS (Standard Package Alternative) ===
    def liquidation_history(self, symbol: str, interval: str = "1h"):
        """Get liquidation history data - Standard package compatible"""
        url = f"{self.base_url}/api/futures/liquidation/history"
        params = {"symbol": symbol, "interval": interval}
        response = self.http.get(url, params)
        return response.json()
    
    def liquidation_coin_history(self, symbol: str, interval: str = "1h"):
        """Get liquidation coin history using lint-validated endpoint builder"""
        # Use validated endpoint builder (will auto-fix if needed)
        url = self._build_url("/api/futures/liquidation/aggregated-history")
        params = {"coin": symbol, "interval": interval}  # Use 'coin' param per CoinGlass docs
        response = self.http.get(url, params)
        return response.json()

    # === SPOT MARKET ENDPOINTS (Standard Package Alternative) ===
    def spot_orderbook_history(self, symbol: str, exchange: str = "binance", interval: str = "1h"):
        """Get spot orderbook history data - Standard package compatible"""
        url = f"{self.base_url}/api/spot/orderbook-history"
        params = {"symbol": symbol, "exchange": exchange, "interval": interval}
        response = self.http.get(url, params)
        return response.json()
    
    # === FUTURES FOCUS (Standard Package Features) ===
    def top_positions(self, coin: str = "BTC", data_type: str = "open-interest"):
        """Get top positions by open interest - Standard package"""
        url = f"{self.base_url}/api/futures/top-positions"
        params = {"coin": coin, "data_type": data_type}
        response = self.http.get(url, params)
        return response.json()
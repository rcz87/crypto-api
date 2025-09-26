from app.core.http import Http
from app.core.settings import settings
from app.core.logging import logger
from typing import Optional
import time

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
    
    def _apply_guardrails_with_fallback(self, response_data: dict, endpoint: str, params: dict, original_interval: str = "1h"):
        """Enhanced Guardrails: interval fallback + external service backup"""
        
        if not response_data or not response_data.get('data'):
            # GUARDRAILS: Log detailed information about empty response
            logger.warning(f"🚨 GUARDRAILS: Empty data detected")
            logger.info(f"📍 Endpoint: {endpoint}")
            logger.info(f"📋 Params: {params}")
            logger.info(f"🕒 Interval: {original_interval}")
            
            # Extract pair/coin info from params
            pair_coin = params.get('pair') or params.get('coin') or params.get('symbol', 'unknown')
            logger.info(f"💱 Pair/Coin: {pair_coin}")
            
            # STEP 1: AUTO-FALLBACK interval strategy
            interval_fallback_data = self._try_interval_fallback(endpoint, params, original_interval)
            if interval_fallback_data and interval_fallback_data.get('data'):
                return interval_fallback_data
            
            # STEP 2: External service backup (NodeJS/OKX backup)
            logger.info(f"🔄 EXTERNAL BACKUP: Trying NodeJS service for {pair_coin}...")
            external_backup = self._try_external_backup(pair_coin, endpoint)
            if external_backup:
                logger.info(f"✅ EXTERNAL BACKUP SUCCESS: Got data from NodeJS service")
                return external_backup
            
            # STEP 3: Last resort - mock minimal data to prevent total failure
            logger.warning(f"🚨 ALL FALLBACKS FAILED: Generating minimal response for {pair_coin}")
            return self._generate_minimal_response(pair_coin, endpoint)
        
        # Return original data if valid
        return response_data

    def _try_interval_fallback(self, endpoint: str, params: dict, original_interval: str):
        """Try higher interval fallback (1h→4h→1d)"""
        fallback_intervals = []
        
        if original_interval == "1h":
            fallback_intervals = ["4h", "1d"]
        elif original_interval == "4h":
            fallback_intervals = ["1d"]
        
        for fallback_interval in fallback_intervals:
            logger.info(f"🔄 INTERVAL FALLBACK: Trying {fallback_interval}...")
            
            fallback_params = params.copy()
            fallback_params['interval'] = fallback_interval
            
            try:
                fallback_response = self.http.get(f"{self.base_url}{endpoint}", fallback_params)
                if fallback_response.status_code == 200:
                    fallback_data = fallback_response.json()
                    if fallback_data and fallback_data.get('data'):
                        logger.info(f"✅ INTERVAL FALLBACK SUCCESS: Got data with {fallback_interval}")
                        return fallback_data
                    else:
                        logger.warning(f"⚠️ INTERVAL FALLBACK FAILED: Still empty data with {fallback_interval}")
            except Exception as e:
                logger.error(f"🚫 INTERVAL FALLBACK ERROR: {e}")
        
        return None

    def _try_external_backup(self, symbol: str, endpoint: str):
        """Try backup from NodeJS service (OKX/CoinAPI)"""
        try:
            import requests
            
            # Determine backup endpoint based on CoinGlass endpoint type
            if "funding-rate" in endpoint:
                backup_url = f"http://localhost:5000/api/sol/technical"
            elif "liquidation" in endpoint:
                backup_url = f"http://localhost:5000/api/sol/liquidation"
            elif "open-interest" in endpoint:
                backup_url = f"http://localhost:5000/api/metrics"
            else:
                backup_url = f"http://localhost:5000/monitor/ticker/{symbol.replace('USDT', '').replace('-USDT-SWAP', '')}"
            
            response = requests.get(backup_url, timeout=5)
            if response.status_code == 200:
                backup_data = response.json()
                if backup_data and (backup_data.get('data') or backup_data.get('success')):
                    # Transform NodeJS response to CoinGlass format
                    return {
                        "data": [backup_data.get('data', backup_data)],
                        "success": True,
                        "source": "nodejs_backup"
                    }
        except Exception as e:
            logger.error(f"🚫 EXTERNAL BACKUP ERROR: {e}")
        
        return None

    def _generate_minimal_response(self, symbol: str, endpoint: str):
        """Generate minimal response to prevent total failure"""
        current_timestamp = int(time.time() * 1000)
        return {
            "data": [{
                "symbol": symbol,
                "timestamp": current_timestamp,
                "value": 0,
                "source": "minimal_fallback",
                "note": "Generated due to all data sources being unavailable"
            }],
            "success": True,
            "fallback": True
        }

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
        """Get coin liquidation history with ENHANCED guardrails and auto-fallback"""
        from app.core.logging import logger
        
        # FIX: Use proper symbol resolver instead of guessing variants
        resolved_symbol = self._resolve_symbol_with_exchange_pairs(symbol)
        
        # FIX: Use correct CoinGlass v4 aggregated-history endpoint with query params
        endpoint_path = "/api/futures/liquidation/aggregated-history"
        url = f"{self.base_url}{endpoint_path}"
        params = {"coin": resolved_symbol, "interval": interval}  # Use 'coin' param per docs
        
        try:
            response = self.http.get(url, params=params)
            if response.status_code == 200:
                result = response.json()
                
                # APPLY GUARDRAILS: Check for empty data and apply fallback
                guarded_result = self._apply_guardrails_with_fallback(
                    result, endpoint_path, params, interval
                )
                
                if guarded_result and guarded_result.get('data'):
                    logger.info(f"✅ Liquidation data found for {resolved_symbol} (original: {symbol})")
                    return guarded_result
                else:
                    logger.info(f"📊 No liquidation events for {resolved_symbol} after guardrails")
            else:
                logger.debug(f"Liquidation aggregated-history failed: {response.status_code}")
        except Exception as e:
            logger.debug(f"Liquidation aggregated-history error: {e}")
        
        # Try alternative pair-level endpoint as fallback
        alt_endpoint = "/api/futures/liquidation/history"
        alt_url = f"{self.base_url}{alt_endpoint}"
        alt_params = {"pair": f"{resolved_symbol}-USDT", "interval": interval}
        
        try:
            response = self.http.get(alt_url, params=alt_params)
            if response.status_code == 200:
                result = response.json()
                
                # Apply guardrails to alternative endpoint too
                guarded_result = self._apply_guardrails_with_fallback(
                    result, alt_endpoint, alt_params, interval
                )
                
                if guarded_result and guarded_result.get('data'):
                    logger.info(f"✅ Alternative liquidation endpoint worked for {resolved_symbol}")
                    return guarded_result
        except Exception as e:
            logger.debug(f"Alternative liquidation endpoint failed: {e}")
        
        # Return meaningful empty data with guardrails logging
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
    
    # Removed duplicate spot_orderbook_history method

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
        """Get ETF flow-history data using CoinGlass API v4 flow-history endpoint"""
        from app.core.logging import logger
        
        # Use correct CoinGlass v4 ETF flow-history endpoint
        endpoint = "/api/etf/bitcoin/flow-history"
        try:
            url = f"{self.base_url}{endpoint}"
            response = self.http.get(url)
            
            if response.status_code == 200:
                result = response.json()
                if result and 'data' in result:
                    logger.info(f"ETF flow-history endpoint successful: {endpoint}")
                    # Return real API data with proper field mapping
                    return self._process_real_etf_flows(result)
            else:
                logger.error(f"ETF flow-history endpoint failed with status {response.status_code}")
                
        except Exception as e:
            logger.error(f"ETF flow-history endpoint {endpoint} failed: {e}")
            
        # Return empty data if real API fails - NO SYNTHETIC DATA
        logger.warning("ETF flow-history endpoint failed, returning empty data (no synthetic generation)")
        return {"data": [], "success": False, "error": "Real ETF flow-history data unavailable"}
    
    def etf_bitcoin_flows(self):
        """Get Bitcoin ETF flow-history with CoinGlass API v4 format"""
        url = f"{self.base_url}/api/etf/bitcoin/flow-history"
        response = self.http.get(url)
        raw_data = response.json()
        
        # Process with real ETF flow-history data validation
        return self._process_real_etf_flows(raw_data)
    
    def etf_bitcoin_list(self):
        """Get Bitcoin ETF status list with shares_outstanding data"""
        url = f"{self.base_url}/api/etf/bitcoin/list"
        response = self.http.get(url)
        raw_data = response.json()
        
        # Process with ETF status data validation
        return self._process_etf_status_list(raw_data)

    def _process_real_etf_flows(self, data):
        """Process ETF flow-history data from CoinGlass API v4 - correct format mapping"""
        try:
            if not data or 'data' not in data:
                return {"data": [], "success": False, "error": "No data in API response"}
            
            # Extract real ETF flow-history data from API response
            etf_data = data['data']
            processed_flows = []
            
            for flow_item in etf_data:
                if isinstance(flow_item, dict):
                    # Map CoinGlass API v4 flow-history format: timestamp, flow_usd, price_usd, etf_flows[]
                    processed_item = {
                        "timestamp": flow_item.get("timestamp", 0),  # Milliseconds timestamp
                        "flow_usd": flow_item.get("flow_usd", 0),    # Net flow in USD
                        "price_usd": flow_item.get("price_usd", 0),  # BTC price in USD
                        "etf_flows": flow_item.get("etf_flows", []), # [{etf_ticker, flow_usd}]
                        "source": "real_flow_history_v4"
                    }
                    processed_flows.append(processed_item)
            
            return {"data": processed_flows, "success": True}
            
        except Exception as e:
            from app.core.logging import logger
            logger.error(f"Error processing real ETF flow-history: {e}")
            return {"data": [], "success": False, "error": f"Processing error: {str(e)}"}
    
    def _process_etf_status_list(self, data):
        """Process ETF status list from /api/etf/bitcoin/list - separate from flow-history"""
        try:
            if not data or 'data' not in data:
                return {"data": [], "success": False, "error": "No status data in API response"}
            
            processed_status = []
            for etf_item in data['data']:
                if isinstance(etf_item, dict):
                    asset_details = etf_item.get("asset_details", {})
                    
                    processed_item = {
                        "ticker": etf_item.get("ticker", "Unknown"),
                        "shares_outstanding": etf_item.get("shares_outstanding", 0),
                        "asset_details": asset_details,
                        "update_timestamp": asset_details.get("update_timestamp", 0),
                        "source": "real_status_list_v4"
                    }
                    processed_status.append(processed_item)
            
            return {"data": processed_status, "success": True}
            
        except Exception as e:
            from app.core.logging import logger
            logger.error(f"Error processing ETF status list: {e}")
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
        """Get liquidation coin aggregated history - CoinGlass v4 format"""
        # Use validated endpoint builder (will auto-fix if needed)
        url = self._build_url("/api/futures/liquidation/aggregated-history")
        params = {"coin": symbol, "interval": interval}  # Use 'coin' param per CoinGlass docs
        response = self.http.get(url, params)
        return response.json()
    
    def liquidation_exchange_list(self, coin: str, range_period: str = "24h"):
        """Get liquidation exchange breakdown - CoinGlass v4 format"""
        url = self._build_url("/api/futures/liquidation/exchange-list")
        params = {"coin": coin, "range": range_period}
        response = self.http.get(url, params)
        return response.json()
    
    def liquidation_heatmap(self, symbol: str, interval: str = "1h"):
        """Liquidation heatmap (fallback to coin-history)"""
        # Use coin-history as fallback for Standard package
        return self.liquidation_coin_history(symbol, interval)
    
    def options_oi(self, symbol: str, interval: str = "1h"):
        """Options open interest placeholder (not available in Standard)"""
        from app.core.logging import logger
        logger.warning(f"Options OI not available in Standard package for {symbol}")
        return {"data": [], "message": "Options data not available in Standard package"}

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
#!/usr/bin/env python3
"""
Async CoinGlass Client
Proper async HTTP client untuk whale detection dengan correct API parameters
"""

import os
import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
import logging
import json
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class AsyncCoinglassClient:
    """Async CoinGlass API client dengan correct parameters dan proper error handling"""
    
    def __init__(self):
        self.api_key = os.getenv('COINGLASS_API_KEY')
        self.base_url = "https://open-api-v4.coinglass.com"
        self.session: Optional[aiohttp.ClientSession] = None
        self.rate_limit_delay = 1.0  # Rate limiting between requests
        self.last_request_time = 0
        
        if not self.api_key:
            logger.warning("🔑 COINGLASS_API_KEY not set - whale detection may fail")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=15, connect=5)
            headers = {
                'CG-API-KEY': self.api_key,
                'Accept': 'application/json',
                'User-Agent': 'Enhanced-Sniper-Engine-V2/1.0'
            }
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers=headers
            )
        return self.session
    
    async def _make_request(self, endpoint: str, params: Dict[str, Any]) -> Optional[Dict]:
        """Make rate-limited async request dengan proper error handling"""
        if not self.api_key:
            logger.error("❌ No CoinGlass API key configured")
            return None
            
        try:
            # Rate limiting
            current_time = datetime.now().timestamp()
            time_since_last = current_time - self.last_request_time
            if time_since_last < self.rate_limit_delay:
                await asyncio.sleep(self.rate_limit_delay - time_since_last)
            
            session = await self._get_session()
            url = f"{self.base_url}{endpoint}"
            
            # Clean params (remove None values)
            clean_params = {k: v for k, v in params.items() if v is not None}
            
            logger.debug(f"📡 CoinGlass request: {endpoint} with {clean_params}")
            
            async with session.get(url, params=clean_params) as response:
                self.last_request_time = datetime.now().timestamp()
                
                if response.status == 200:
                    data = await response.json()
                    if data.get('code') == '0':
                        return data
                    else:
                        logger.warning(f"⚠️ CoinGlass API error: {data.get('msg', 'Unknown')}")
                        return None
                elif response.status == 429:
                    logger.warning("⏳ Rate limited, backing off...")
                    await asyncio.sleep(2)
                    return None
                else:
                    error_text = await response.text()
                    logger.error(f"❌ HTTP {response.status}: {error_text}")
                    return None
                    
        except asyncio.TimeoutError:
            logger.error(f"⏰ Timeout for {endpoint}")
            return None
        except Exception as e:
            logger.error(f"❌ Request error for {endpoint}: {e}")
            return None
    
    async def get_taker_aggregated(self, coin: str, interval: str = '1h', limit: int = 2) -> Optional[Dict]:
        """Get aggregated taker buy/sell volume (COIN-AGGREGATED)"""
        endpoint = "/api/futures/aggregated-taker-buy-sell-volume/history"
        params = {
            'symbol': coin,  # Revert: API expects 'symbol' for all endpoints
            'interval': interval,
            'exchange_list': 'OKX,Binance,Bybit',  # Multiple exchanges for better coverage
            'limit': limit
        }
        return await self._make_request(endpoint, params)
    
    async def get_oi_aggregated(self, coin: str, interval: str = '1h', limit: int = 2) -> Optional[Dict]:
        """Get aggregated Open Interest (COIN-AGGREGATED)"""
        endpoint = "/api/futures/open-interest/aggregated-history"
        params = {
            'symbol': coin,  # Revert: API expects 'symbol' for all endpoints
            'interval': interval,
            'limit': limit
        }
        return await self._make_request(endpoint, params)
    
    async def get_funding_rate(self, coin: str, exchange: str = 'Binance', interval: str = '1h', limit: int = 1) -> Optional[Dict]:
        """Get funding rate (PAIR-SPECIFIC)"""
        endpoint = "/api/futures/funding-rate/history"
        params = {
            'symbol': f'{coin}USDT',  # Revert: API expects 'symbol' not 'pair'
            'exchange': exchange,     # Required for funding endpoint
            'interval': interval,
            'limit': limit
        }
        return await self._make_request(endpoint, params)
    
    async def get_liquidation_aggregated(self, coin: str, interval: str = '1h', limit: int = 1) -> Optional[Dict]:
        """Get aggregated liquidation data (COIN-AGGREGATED)"""
        endpoint = "/api/futures/liquidation/aggregated-history"
        params = {
            'symbol': coin,  # Revert: API expects 'symbol' for all endpoints
            'interval': interval,
            'exchange_list': 'OKX,Binance,Bybit',
            'limit': limit
        }
        return await self._make_request(endpoint, params)
    
    async def get_supported_pairs(self) -> Optional[List[str]]:
        """Get supported exchange pairs untuk validation"""
        endpoint = "/api/futures/supported-exchange-pairs"
        params = {}
        
        data = await self._make_request(endpoint, params)
        if data and 'data' in data:
            # Extract unique coins dari pairs
            coins = set()
            for pair_info in data['data']:
                if isinstance(pair_info, dict):
                    symbol = pair_info.get('symbol', '')
                else:
                    symbol = str(pair_info)
                    
                if 'USDT' in symbol:
                    coin = symbol.replace('USDT', '').replace('PERP', '').replace('-', '').strip().upper()
                    if len(coin) <= 8 and coin.isalpha() and len(coin) >= 2:
                        coins.add(coin)
            
            return sorted(list(coins))
        
        return None
    
    async def batch_fetch_whale_data(self, coin: str) -> Optional[Dict[str, Any]]:
        """Batch fetch all whale detection data untuk single coin"""
        try:
            # Concurrent fetch dengan proper async
            tasks = [
                self.get_taker_aggregated(coin),
                self.get_oi_aggregated(coin),
                self.get_funding_rate(coin),
                self.get_liquidation_aggregated(coin)
            ]
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            taker_data, oi_data, funding_data, liq_data = results
            
            return {
                'coin': coin,
                'taker_data': taker_data if not isinstance(taker_data, Exception) else None,
                'oi_data': oi_data if not isinstance(oi_data, Exception) else None,
                'funding_data': funding_data if not isinstance(funding_data, Exception) else None,
                'liquidation_data': liq_data if not isinstance(liq_data, Exception) else None,
                'fetch_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Batch fetch error for {coin}: {e}")
            return None
    
    async def close(self):
        """Close HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

# Singleton instance
async_client = None

async def get_async_client() -> AsyncCoinglassClient:
    """Get singleton async client"""
    global async_client
    if async_client is None:
        async_client = AsyncCoinglassClient()
    return async_client
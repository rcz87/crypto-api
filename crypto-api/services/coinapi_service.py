#!/usr/bin/env python3
"""
CoinAPI Service
Comprehensive market data from 100+ exchanges
"""

import requests
import json
import time
import logging
import os
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from dataclasses import dataclass
import re

@dataclass
class CoinAPICoinInfo:
    """Data structure untuk CoinAPI coin info"""
    symbol: str
    name: str
    source: str
    price: Optional[float] = None
    volume_24h: Optional[float] = None
    change_24h: Optional[float] = None
    exchange_id: Optional[str] = None
    symbol_id: Optional[str] = None
    last_updated: Optional[str] = None
    
    def __post_init__(self):
        if self.last_updated is None:
            self.last_updated = datetime.now(timezone.utc).isoformat()

class CoinAPIService:
    """CoinAPI service dengan rate limit handling dan comprehensive data coverage"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.api_key = os.getenv('COINAPI_API_KEY', '')
        self.base_url = 'https://rest.coinapi.io/v1'
        
        # Rate limiting
        self.last_request_time = {}
        self.min_request_interval = 0.1  # 100ms untuk paid tier
        
        # Cache
        self.cache = {}
        self.cache_ttl = 60  # 1 minute untuk real-time data
        
        # Verify API key
        if not self.api_key or self.api_key == 'your_coinapi_key_here':
            self.logger.warning("CoinAPI API key not configured. Please set COINAPI_API_KEY environment variable.")
            self.api_key = None
    
    def _make_request(self, endpoint: str, params: Dict = None, timeout: int = 10) -> requests.Response:
        """Make authenticated request to CoinAPI dengan rate limiting"""
        if not self.api_key:
            raise ValueError("CoinAPI API key not configured")
        
        current_time = time.time()
        
        # Rate limiting
        if 'coinapi' in self.last_request_time:
            time_since_last = current_time - self.last_request_time['coinapi']
            if time_since_last < self.min_request_interval:
                sleep_time = self.min_request_interval - time_since_last
                time.sleep(sleep_time)
        
        self.last_request_time['coinapi'] = time.time()
        
        headers = {
            'X-CoinAPI-Key': self.api_key,
            'Accept': 'application/json'
        }
        
        url = f"{self.base_url}{endpoint}"
        response = requests.get(url, params=params, headers=headers, timeout=timeout)
        
        return response
    
    def get_exchanges(self) -> List[Dict[str, Any]]:
        """Get all supported exchanges"""
        cache_key = "exchanges"
        
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_ttl * 60:  # 1 hour cache
                return cached_data
        
        try:
            response = self._make_request('/exchanges')
            
            if response.status_code == 401:
                self.logger.error("Invalid CoinAPI API key")
                return []
            elif response.status_code == 429:
                self.logger.warning("CoinAPI rate limit hit")
                return []
            elif response.status_code != 200:
                self.logger.error(f"CoinAPI error: {response.status_code} - {response.text}")
                return []
            
            exchanges = response.json()
            
            # Cache hasil
            self.cache[cache_key] = (exchanges, time.time())
            
            self.logger.info(f"Retrieved {len(exchanges)} exchanges from CoinAPI")
            return exchanges
            
        except Exception as e:
            self.logger.error(f"Error getting exchanges from CoinAPI: {str(e)}")
            return []
    
    def get_symbols(self, exchange_id: str = None) -> List[Dict[str, Any]]:
        """Get all trading symbols, optionally filtered by exchange"""
        cache_key = f"symbols_{exchange_id or 'all'}"
        
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_ttl * 30:  # 30 minutes cache
                return cached_data
        
        try:
            params = {}
            if exchange_id:
                params['filter_exchange_id'] = exchange_id
            
            response = self._make_request('/symbols', params)
            
            if response.status_code != 200:
                self.logger.error(f"Error getting symbols: {response.status_code}")
                return []
            
            symbols = response.json()
            
            # Cache hasil
            self.cache[cache_key] = (symbols, time.time())
            
            self.logger.info(f"Retrieved {len(symbols)} symbols from CoinAPI")
            return symbols
            
        except Exception as e:
            self.logger.error(f"Error getting symbols from CoinAPI: {str(e)}")
            return []
    
    def search_coin(self, query: str, limit: int = 20) -> List[CoinAPICoinInfo]:
        """
        Search coin di CoinAPI berdasarkan symbol atau name
        
        Args:
            query: Coin name atau symbol
            limit: Maximum results to return
            
        Returns:
            List of CoinAPICoinInfo objects
        """
        cache_key = f"search_{query}_{limit}"
        
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                return cached_data
        
        results = []
        
        try:
            # Get current quotes untuk semua assets
            response = self._make_request('/quotes/latest', {
                'filter_symbol_id': f'*{query.upper()}*'
            })
            
            if response.status_code != 200:
                self.logger.error(f"Error searching quotes: {response.status_code}")
                return []
            
            quotes = response.json()
            
            # Process quotes
            for quote in quotes[:limit]:
                try:
                    symbol_id = quote.get('symbol_id', '')
                    exchange_id = quote.get('exchange_id', '')
                    
                    # Extract symbol dari symbol_id (format: EXCHANGE_TYPE_BASE_QUOTE)
                    parts = symbol_id.split('_')
                    if len(parts) >= 4:
                        base_symbol = parts[2]
                        quote_symbol = parts[3]
                        
                        # Hanya ambil yang quote-nya USD/USDT/BTC/ETH
                        if quote_symbol in ['USD', 'USDT', 'BTC', 'ETH']:
                            coin_info = CoinAPICoinInfo(
                                symbol=base_symbol,
                                name=f"{base_symbol} ({exchange_id})",
                                source='coinapi',
                                price=quote.get('ask_price') or quote.get('bid_price'),
                                exchange_id=exchange_id,
                                symbol_id=symbol_id,
                                last_updated=quote.get('time_coinapi')
                            )
                            
                            results.append(coin_info)
                
                except Exception as e:
                    self.logger.error(f"Error processing quote: {str(e)}")
                    continue
            
            # Remove duplicates berdasarkan symbol
            unique_results = self._deduplicate_coins(results)
            
            # Cache hasil
            self.cache[cache_key] = (unique_results, time.time())
            
            self.logger.info(f"Found {len(unique_results)} results for '{query}' from CoinAPI")
            return unique_results
            
        except Exception as e:
            self.logger.error(f"Error searching CoinAPI: {str(e)}")
            return []
    
    def get_coin_details(self, symbol_id: str) -> Optional[CoinAPICoinInfo]:
        """Get detailed info untuk specific coin berdasarkan symbol_id"""
        try:
            response = self._make_request('/quotes/latest', {
                'filter_symbol_id': symbol_id
            })
            
            if response.status_code != 200:
                return None
            
            quotes = response.json()
            if not quotes:
                return None
            
            quote = quotes[0]
            exchange_id = quote.get('exchange_id', '')
            
            # Extract symbol
            parts = symbol_id.split('_')
            if len(parts) >= 4:
                base_symbol = parts[2]
                
                coin_info = CoinAPICoinInfo(
                    symbol=base_symbol,
                    name=f"{base_symbol} ({exchange_id})",
                    source='coinapi',
                    price=quote.get('ask_price') or quote.get('bid_price'),
                    exchange_id=exchange_id,
                    symbol_id=symbol_id,
                    last_updated=quote.get('time_coinapi')
                )
                
                return coin_info
            
        except Exception as e:
            self.logger.error(f"Error getting coin details: {str(e)}")
        
        return None
    
    def get_ohlcv_data(self, symbol_id: str, period_id: str = '1DAY', limit: int = 100) -> List[Dict[str, Any]]:
        """Get OHLCV data untuk symbol"""
        try:
            response = self._make_request('/ohlcv/latest', {
                'filter_symbol_id': symbol_id,
                'period_id': period_id,
                'limit': limit
            })
            
            if response.status_code != 200:
                self.logger.error(f"Error getting OHLCV data: {response.status_code}")
                return []
            
            return response.json()
            
        except Exception as e:
            self.logger.error(f"Error getting OHLCV data: {str(e)}")
            return []
    
    def get_trades_latest(self, symbol_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get latest trades untuk symbol"""
        try:
            response = self._make_request('/trades/latest', {
                'filter_symbol_id': symbol_id,
                'limit': limit
            })
            
            if response.status_code != 200:
                self.logger.error(f"Error getting latest trades: {response.status_code}")
                return []
            
            return response.json()
            
        except Exception as e:
            self.logger.error(f"Error getting latest trades: {str(e)}")
            return []
    
    def _deduplicate_coins(self, coins: List[CoinAPICoinInfo]) -> List[CoinAPICoinInfo]:
        """Remove duplicate coins berdasarkan symbol, pilih yang harga terbaru"""
        seen = set()
        unique_coins = []
        
        for coin in coins:
            symbol_key = coin.symbol.upper()
            if symbol_key not in seen:
                seen.add(symbol_key)
                unique_coins.append(coin)
            else:
                # Update jika ada data harga yang lebih baru
                existing_coin = next((c for c in unique_coins if c.symbol.upper() == symbol_key), None)
                if existing_coin and coin.price and (not existing_coin.price or coin.last_updated > existing_coin.last_updated):
                    existing_coin.price = coin.price
                    existing_coin.last_updated = coin.last_updated
                    existing_coin.exchange_id = coin.exchange_id
        
        return unique_coins
    
    def get_exchange_info(self, exchange_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed info untuk specific exchange"""
        try:
            exchanges = self.get_exchanges()
            for exchange in exchanges:
                if exchange.get('exchange_id') == exchange_id:
                    return exchange
        except Exception as e:
            self.logger.error(f"Error getting exchange info: {str(e)}")
        
        return None
    
    def get_popular_exchanges(self) -> List[str]:
        """Get list of popular exchanges"""
        return [
            'BINANCE', 'COINBASE', 'KRAKEN', 'BITSTAMP', 'BITFINEX',
            'HUOBI', 'OKEX', 'BITTREX', 'POLONIEX', 'GEMINI'
        ]
    
    def clear_cache(self):
        """Clear cache"""
        self.cache.clear()
        self.logger.info("CoinAPI cache cleared")
    
    def get_api_status(self) -> Dict[str, Any]:
        """Get API status information"""
        return {
            'api_key_configured': bool(self.api_key),
            'base_url': self.base_url,
            'cache_size': len(self.cache),
            'last_requests': self.last_request_time,
            'rate_limit_interval': self.min_request_interval
        }

# Global instance
coinapi_service = CoinAPIService()

def search_coin(query: str, limit: int = 20) -> List[CoinAPICoinInfo]:
    """Convenience function untuk search coin"""
    return coinapi_service.search_coin(query, limit)

def get_coin_details(symbol_id: str) -> Optional[CoinAPICoinInfo]:
    """Convenience function untuk get coin details"""
    return coinapi_service.get_coin_details(symbol_id)

def get_exchanges() -> List[Dict[str, Any]]:
    """Convenience function untuk get exchanges"""
    return coinapi_service.get_exchanges()

def get_api_status() -> Dict[str, Any]:
    """Get API status"""
    return coinapi_service.get_api_status()

if __name__ == "__main__":
    # Test the service
    logging.basicConfig(level=logging.INFO)
    
    # Print API status
    print("=== CoinAPI Status ===")
    status = get_api_status()
    for key, value in status.items():
        print(f"{key}: {value}")
    
    if not status['api_key_configured']:
        print("\n⚠️  CoinAPI API key not configured. Please set COINAPI_API_KEY environment variable.")
        print("Get your API key from: https://www.coinapi.io/pricing")
        exit(1)
    
    print("\n=== Testing exchanges ===")
    exchanges = get_exchanges()
    print(f"Found {len(exchanges)} exchanges")
    for exchange in exchanges[:5]:
        print(f"- {exchange.get('exchange_id')}: {exchange.get('name')}")
    
    print("\n=== Testing coin search ===")
    results = search_coin("bitcoin")
    
    print(f"Found {len(results)} results:")
    for i, coin in enumerate(results[:5], 1):
        print(f"{i}. {coin.symbol} - {coin.name}")
        print(f"   Price: ${coin.price}" if coin.price else "   Price: N/A")
        print(f"   Exchange: {coin.exchange_id}")
        print()

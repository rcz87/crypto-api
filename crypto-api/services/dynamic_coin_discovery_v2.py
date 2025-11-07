#!/usr/bin/env python3
"""
Dynamic Coin Discovery Service v2
Multi-source coin discovery dengan rate limit handling dan API key support
"""

import requests
import json
import time
import logging
import os
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
import re

# Import CoinAPI service
from services.coinapi_service import CoinAPIService, CoinAPICoinInfo

@dataclass
class CoinInfo:
    """Data structure untuk coin info"""
    symbol: str
    name: str
    source: str
    price: Optional[float] = None
    market_cap: Optional[float] = None
    volume_24h: Optional[float] = None
    change_24h: Optional[float] = None
    rank: Optional[int] = None
    exchanges: List[str] = None
    last_updated: Optional[str] = None
    
    def __post_init__(self):
        if self.exchanges is None:
            self.exchanges = []
        if self.last_updated is None:
            self.last_updated = datetime.now(timezone.utc).isoformat()

class DynamicCoinDiscovery:
    """Multi-source coin discovery service dengan rate limit handling"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes
        
        # Rate limiting
        self.last_request_time = {}
        self.min_request_interval = 1.2  # seconds between requests for free tier
        
        # API configuration
        self.coingecko_api_key = os.getenv('COINGECKO_API_KEY', '')
        self.coingecko_pro = bool(self.coingecko_api_key and self.coingecko_api_key != 'your_coingecko_api_key_here')
        
        # Initialize CoinAPI service
        self.coinapi_service = CoinAPIService()
        
        # API endpoints
        self.apis = {
            'coingecko': {
                'search': 'https://api.coingecko.com/api/v3/search',
                'market': 'https://api.coingecko.com/api/v3/simple/price',
                'coin_detail': 'https://api.coingecko.com/api/v3/coins/{id}'
            },
            'binance': {
                'ticker': 'https://api.binance.com/api/v3/ticker/24hr',
                'price': 'https://api.binance.com/api/v3/ticker/price',
                'exchange_info': 'https://api.binance.com/api/v3/exchangeInfo'
            },
            'okx': {
                'ticker': 'https://www.okx.com/api/v5/market/ticker',
                'instruments': 'https://www.okx.com/api/v5/public/instruments'
            },
            'coinmarketcap': {
                'search': 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map',
                'quotes': 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest'
            }
        }
        
        # Cache untuk discovered coins
        self.discovered_coins = {}
        
    def _rate_limit_request(self, source: str, url: str, params: Dict = None, timeout: int = 10) -> requests.Response:
        """Handle rate limiting untuk API requests"""
        current_time = time.time()
        
        # Check rate limit
        if source in self.last_request_time:
            time_since_last = current_time - self.last_request_time[source]
            if time_since_last < self.min_request_interval:
                sleep_time = self.min_request_interval - time_since_last
                self.logger.debug(f"Rate limiting {source}: sleeping {sleep_time:.2f}s")
                time.sleep(sleep_time)
        
        # Make request
        self.last_request_time[source] = time.time()
        
        headers = {}
        if source == 'coingecko' and self.coingecko_pro:
            headers['x-cg-pro-api-key'] = self.coingecko_api_key
        elif source == 'coinmarketcap':
            cmc_key = os.getenv('COINMARKETCAP_API_KEY', '')
            if cmc_key:
                headers['X-CMC_PRO_API_KEY'] = cmc_key
        
        response = requests.get(url, params=params, headers=headers, timeout=timeout)
        return response
        
    def search_coin(self, query: str, sources: List[str] = None) -> List[CoinInfo]:
        """
        Search coin di multiple sources
        
        Args:
            query: Coin name atau symbol
            sources: List sources to search (default: all)
            
        Returns:
            List of CoinInfo objects
        """
        if sources is None:
            sources = ['coingecko', 'binance', 'okx', 'coinapi']
            
        cache_key = f"search_{query}_{','.join(sources)}"
        
        # Check cache
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                return cached_data
        
        results = []
        
        # Search di multiple sources secara parallel
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_source = {
                executor.submit(self._search_single_source, query, source): source 
                for source in sources
            }
            
            for future in as_completed(future_to_source):
                source = future_to_source[future]
                try:
                    source_results = future.result(timeout=15)
                    results.extend(source_results)
                    self.logger.info(f"Found {len(source_results)} results from {source}")
                except Exception as e:
                    self.logger.error(f"Error searching {source}: {str(e)}")
        
        # Remove duplicates dan sort by relevance
        unique_results = self._deduplicate_coins(results)
        sorted_results = self._sort_by_relevance(unique_results, query)
        
        # Cache results
        self.cache[cache_key] = (sorted_results, time.time())
        
        return sorted_results
    
    def _search_single_source(self, query: str, source: str) -> List[CoinInfo]:
        """Search di single source"""
        try:
            if source == 'coingecko':
                return self._search_coingecko(query)
            elif source == 'binance':
                return self._search_binance(query)
            elif source == 'okx':
                return self._search_okx(query)
            elif source == 'coinapi':
                return self._search_coinapi(query)
            else:
                return []
        except Exception as e:
            self.logger.error(f"Error searching {source}: {str(e)}")
            return []
    
    def _search_coingecko(self, query: str) -> List[CoinInfo]:
        """Search di CoinGecko API dengan rate limit handling"""
        results = []
        
        try:
            # Search endpoint
            search_url = self.apis['coingecko']['search']
            params = {'query': query}
            
            response = self._rate_limit_request('coingecko', search_url, params)
            
            if response.status_code == 429:
                self.logger.warning("CoinGecko rate limit hit, using cached data if available")
                return []
            elif response.status_code != 200:
                self.logger.error(f"CoinGecko API error: {response.status_code}")
                return results
                
            data = response.json()
            coins = data.get('coins', [])
            
            # Limit price requests untuk avoid rate limit
            max_price_requests = 3 if not self.coingecko_pro else 10
            
            for i, coin in enumerate(coins[:10]):  # Top 10 results
                try:
                    coin_info = CoinInfo(
                        symbol=coin.get('symbol', '').upper(),
                        name=coin.get('name', ''),
                        source='coingecko',
                        rank=coin.get('market_cap_rank'),
                        market_cap=coin.get('market_cap_rank')  # Placeholder
                    )
                    
                    # Get price data (limited requests)
                    if coin.get('id') and i < max_price_requests:
                        price_data = self._get_coingecko_price(coin['id'])
                        if price_data:
                            coin_info.price = price_data.get('usd')
                            coin_info.change_24h = price_data.get('usd_24h_change')
                    
                    results.append(coin_info)
                    
                except Exception as e:
                    self.logger.error(f"Error processing CoinGecko result: {str(e)}")
                    continue
            
        except Exception as e:
            self.logger.error(f"Error in CoinGecko search: {str(e)}")
        
        return results
    
    def _search_binance(self, query: str) -> List[CoinInfo]:
        """Search di Binance API"""
        results = []
        
        try:
            # Get all tickers
            ticker_url = self.apis['binance']['ticker']
            response = requests.get(ticker_url, timeout=10)
            
            if response.status_code != 200:
                return results
                
            tickers = response.json()
            
            # Filter tickers yang match dengan query
            query_upper = query.upper()
            for ticker in tickers:
                symbol = ticker.get('symbol', '')
                
                # Check if symbol contains query
                if query_upper in symbol:
                    # Remove USDT, BUSD, etc suffix untuk clean symbol
                    clean_symbol = re.sub(r'USDT$|BUSD$|BTC$|ETH$|BNB$', '', symbol)
                    
                    coin_info = CoinInfo(
                        symbol=clean_symbol,
                        name=f"{clean_symbol} (Binance)",
                        source='binance',
                        price=float(ticker.get('lastPrice', 0)) if ticker.get('lastPrice') else None,
                        volume_24h=float(ticker.get('volume', 0)) if ticker.get('volume') else None,
                        change_24h=float(ticker.get('priceChangePercent', 0)) if ticker.get('priceChangePercent') else None,
                        exchanges=['binance']
                    )
                    
                    results.append(coin_info)
                    
        except Exception as e:
            self.logger.error(f"Error searching Binance: {str(e)}")
        
        return results[:20]  # Limit results
    
    def _search_okx(self, query: str) -> List[CoinInfo]:
        """Search di OKX API"""
        results = []
        
        try:
            # Get all instruments
            instruments_url = self.apis['okx']['instruments']
            params = {'instType': 'SPOT'}
            
            response = requests.get(instruments_url, params=params, timeout=10)
            
            if response.status_code != 200:
                return results
                
            data = response.json()
            instruments = data.get('data', [])
            
            query_upper = query.upper()
            for instrument in instruments:
                symbol = instrument.get('instId', '')
                
                # Check if symbol contains query and ends with USDT
                if query_upper in symbol and symbol.endswith('-USDT'):
                    clean_symbol = symbol.replace('-USDT', '')
                    
                    coin_info = CoinInfo(
                        symbol=clean_symbol,
                        name=f"{clean_symbol} (OKX)",
                        source='okx',
                        exchanges=['okx']
                    )
                    
                    results.append(coin_info)
                    
        except Exception as e:
            self.logger.error(f"Error searching OKX: {str(e)}")
        
        return results[:20]  # Limit results
    
    def _search_coinapi(self, query: str) -> List[CoinInfo]:
        """Search di CoinAPI"""
        results = []
        
        try:
            # Gunakan CoinAPI service untuk search
            coinapi_results = self.coinapi_service.search_coin(query, limit=20)
            
            # Convert CoinAPICoinInfo ke CoinInfo format
            for coinapi_coin in coinapi_results:
                coin_info = CoinInfo(
                    symbol=coinapi_coin.symbol,
                    name=coinapi_coin.name,
                    source='coinapi',
                    price=coinapi_coin.price,
                    volume_24h=coinapi_coin.volume_24h,
                    change_24h=coinapi_coin.change_24h,
                    exchanges=[coinapi_coin.exchange_id] if coinapi_coin.exchange_id else [],
                    last_updated=coinapi_coin.last_updated
                )
                
                results.append(coin_info)
            
            self.logger.info(f"Found {len(results)} results from CoinAPI")
            
        except Exception as e:
            self.logger.error(f"Error searching CoinAPI: {str(e)}")
        
        return results
    
    def _get_coingecko_price(self, coin_id: str) -> Dict[str, Any]:
        """Get price data dari CoinGecko dengan rate limit handling"""
        try:
            price_url = self.apis['coingecko']['market']
            params = {
                'ids': coin_id,
                'vs_currencies': 'usd',
                'include_24hr_change': 'true'
            }
            
            response = self._rate_limit_request('coingecko', price_url, params, timeout=5)
            
            if response.status_code == 429:
                self.logger.warning("CoinGecko price API rate limit hit")
                return {}
            elif response.status_code == 200:
                data = response.json()
                return data.get(coin_id, {})
            else:
                self.logger.error(f"CoinGecko price API error: {response.status_code}")
                
        except Exception as e:
            self.logger.error(f"Error getting CoinGecko price: {str(e)}")
        
        return {}
    
    def _deduplicate_coins(self, coins: List[CoinInfo]) -> List[CoinInfo]:
        """Remove duplicate coins berdasarkan symbol"""
        seen = set()
        unique_coins = []
        
        for coin in coins:
            symbol_key = coin.symbol.upper()
            if symbol_key not in seen:
                seen.add(symbol_key)
                unique_coins.append(coin)
            else:
                # Merge info jika coin sudah ada
                existing_coin = next((c for c in unique_coins if c.symbol.upper() == symbol_key), None)
                if existing_coin:
                    # Merge exchanges
                    existing_coin.exchanges.extend([ex for ex in coin.exchanges if ex not in existing_coin.exchanges])
                    # Use price dari source yang ada data
                    if existing_coin.price is None and coin.price is not None:
                        existing_coin.price = coin.price
                        existing_coin.source = coin.source
        
        return unique_coins
    
    def _sort_by_relevance(self, coins: List[CoinInfo], query: str) -> List[CoinInfo]:
        """Sort coins by relevance ke query"""
        query_lower = query.lower()
        
        def relevance_score(coin: CoinInfo) -> float:
            score = 0.0
            
            # Exact match symbol
            if coin.symbol.lower() == query_lower:
                score += 100
            # Symbol contains query
            elif query_lower in coin.symbol.lower():
                score += 50
            # Exact match name
            elif coin.name.lower() == query_lower:
                score += 80
            # Name contains query
            elif query_lower in coin.name.lower():
                score += 30
            
            # Bonus untuk rank
            if coin.rank and coin.rank <= 100:
                score += 20
            elif coin.rank and coin.rank <= 500:
                score += 10
            
            # Bonus untuk price data
            if coin.price is not None:
                score += 5
            
            # Bonus untuk multiple exchanges
            if len(coin.exchanges) > 1:
                score += len(coin.exchanges)
            
            return score
        
        return sorted(coins, key=relevance_score, reverse=True)
    
    def get_coin_details(self, symbol: str) -> Optional[CoinInfo]:
        """Get detailed info untuk specific coin"""
        # Search untuk coin
        results = self.search_coin(symbol)
        
        if not results:
            return None
        
        # Return most relevant result
        return results[0]
    
    def add_discovered_coin(self, coin_info: CoinInfo) -> bool:
        """Add discovered coin ke cache untuk future use"""
        try:
            symbol_key = coin_info.symbol.upper()
            self.discovered_coins[symbol_key] = coin_info
            
            self.logger.info(f"Added discovered coin: {coin_info.symbol} from {coin_info.source}")
            return True
        except Exception as e:
            self.logger.error(f"Error adding discovered coin: {str(e)}")
            return False
    
    def get_discovered_coins(self) -> Dict[str, CoinInfo]:
        """Get all discovered coins"""
        return self.discovered_coins.copy()
    
    def clear_cache(self):
        """Clear cache"""
        self.cache.clear()
        self.logger.info("Cache cleared")
    
    def get_api_status(self) -> Dict[str, Any]:
        """Get API status information"""
        coinapi_status = self.coinapi_service.get_api_status()
        
        return {
            'coingecko_pro': self.coingecko_pro,
            'coingecko_api_key_configured': bool(self.coingecko_api_key),
            'coinapi_api_key_configured': coinapi_status['api_key_configured'],
            'coinapi_base_url': coinapi_status['base_url'],
            'cache_size': len(self.cache),
            'discovered_coins': len(self.discovered_coins),
            'last_requests': self.last_request_time
        }

# Global instance
coin_discovery = DynamicCoinDiscovery()

def search_coin(query: str, sources: List[str] = None) -> List[CoinInfo]:
    """Convenience function untuk search coin"""
    return coin_discovery.search_coin(query, sources)

def get_coin_details(symbol: str) -> Optional[CoinInfo]:
    """Convenience function untuk get coin details"""
    return coin_discovery.get_coin_details(symbol)

def get_api_status() -> Dict[str, Any]:
    """Get API status"""
    return coin_discovery.get_api_status()

if __name__ == "__main__":
    # Test the service
    logging.basicConfig(level=logging.INFO)
    
    # Print API status
    print("=== API Status ===")
    status = get_api_status()
    for key, value in status.items():
        print(f"{key}: {value}")
    
    print("\n=== Testing coin search ===")
    results = search_coin("bitcoin")
    
    print(f"Found {len(results)} results:")
    for i, coin in enumerate(results[:5], 1):
        print(f"{i}. {coin.symbol} - {coin.name}")
        print(f"   Source: {coin.source}")
        print(f"   Price: ${coin.price}" if coin.price else "   Price: N/A")
        print(f"   24h Change: {coin.change_24h}%" if coin.change_24h else "   24h Change: N/A")
        print(f"   Exchanges: {', '.join(coin.exchanges)}")
        print()

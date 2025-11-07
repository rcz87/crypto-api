#!/usr/bin/env python3
"""
Dynamic Coin Discovery Service
Multi-source coin discovery untuk coin yang tidak ada di sistem utama
"""

import requests
import json
import time
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor, as_completed
import re

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
    """Multi-source coin discovery service"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes
        
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
            sources = ['coingecko', 'binance', 'okx']
            
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
                    source_results = future.result(timeout=10)
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
            else:
                return []
        except Exception as e:
            self.logger.error(f"Error searching {source}: {str(e)}")
            return []
    
    def _search_coingecko(self, query: str) -> List[CoinInfo]:
        """Search di CoinGecko API"""
        results = []
        
        # Search endpoint
        search_url = self.apis['coingecko']['search']
        params = {'query': query}
        
        response = requests.get(search_url, params=params, timeout=10)
        if response.status_code != 200:
            return results
            
        data = response.json()
        coins = data.get('coins', [])
        
        for coin in coins[:10]:  # Top 10 results
            try:
                coin_info = CoinInfo(
                    symbol=coin.get('symbol', '').upper(),
                    name=coin.get('name', ''),
                    source='coingecko',
                    rank=coin.get('market_cap_rank'),
                    market_cap=coin.get('market_cap_rank')  # Placeholder
                )
                
                # Get price data
                if coin.get('id'):
                    price_data = self._get_coingecko_price(coin['id'])
                    if price_data:
                        coin_info.price = price_data.get('usd')
                        coin_info.change_24h = price_data.get('usd_24h_change')
                
                results.append(coin_info)
                
            except Exception as e:
                self.logger.error(f"Error processing CoinGecko result: {str(e)}")
                continue
        
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
    
    def _get_coingecko_price(self, coin_id: str) -> Dict[str, Any]:
        """Get price data dari CoinGecko"""
        try:
            price_url = self.apis['coingecko']['market']
            params = {
                'ids': coin_id,
                'vs_currencies': 'usd',
                'include_24hr_change': 'true'
            }
            
            response = requests.get(price_url, params=params, timeout=5)
            if response.status_code == 200:
                data = response.json()
                return data.get(coin_id, {})
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

# Global instance
coin_discovery = DynamicCoinDiscovery()

def search_coin(query: str, sources: List[str] = None) -> List[CoinInfo]:
    """Convenience function untuk search coin"""
    return coin_discovery.search_coin(query, sources)

def get_coin_details(symbol: str) -> Optional[CoinInfo]:
    """Convenience function untuk get coin details"""
    return coin_discovery.get_coin_details(symbol)

if __name__ == "__main__":
    # Test the service
    logging.basicConfig(level=logging.INFO)
    
    # Test search
    print("Testing coin search...")
    results = search_coin("GIGGLE")
    
    print(f"Found {len(results)} results:")
    for i, coin in enumerate(results[:5], 1):
        print(f"{i}. {coin.symbol} - {coin.name}")
        print(f"   Source: {coin.source}")
        print(f"   Price: ${coin.price}" if coin.price else "   Price: N/A")
        print(f"   Exchanges: {', '.join(coin.exchanges)}")
        print()

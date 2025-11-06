#!/usr/bin/env python3
"""
LunarCrush Social Intelligence Service
Multi-coin social sentiment analysis with mock data support
"""

import requests
import json
import time
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import os
from dataclasses import dataclass

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class SocialMetrics:
    """Social metrics for a cryptocurrency"""
    symbol: str
    galaxy_score: float
    sentiment: float
    social_volume: int
    alt_rank: int
    trending_score: float
    influencers: List[Dict]
    recommendation: str
    confidence: float
    timestamp: str
    price_change_24h: float = 0.0
    reddit_posts: int = 0
    twitter_mentions: int = 0

class LunarCrushService:
    """LunarCrush API service with mock data support"""
    
    def __init__(self):
        self.api_key = os.getenv('LUNARCRUSH_API_KEY', '')
        self.base_url = 'https://lunarcrush.com/api4/public'  # Updated to v4
        self.tier = os.getenv('LUNARCRUSH_TIER', 'free')
        self.mock_mode = not bool(self.api_key)

        # Cache for mock data
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes

        logger.info(f"LunarCrush Service initialized (API v4) - Mode: {'MOCK' if self.mock_mode else 'PRODUCTION'}")
        
    def _get_mock_data(self, symbol: str) -> Dict:
        """Generate realistic mock data for testing"""
        # Use symbol as seed for consistent mock data
        seed = hash(symbol.upper()) % 100
        
        # Base metrics with variation
        base_galaxy = 60 + (seed % 30)  # 60-90
        base_sentiment = 40 + (seed % 40)  # 40-80
        base_volume = 50000 + (seed * 1000)  # 50K-150K
        base_rank = 1 + (seed % 50)  # 1-50
        
        # Add some time-based variation
        time_factor = (datetime.now().hour % 12) / 12.0
        
        return {
            'symbol': symbol.upper(),
            'galaxy_score': round(base_galaxy + time_factor * 10, 1),
            'sentiment': round(base_sentiment + time_factor * 5, 1),
            'social_volume': int(base_volume * (1 + time_factor * 0.3)),
            'alt_rank': base_rank,
            'trending_score': round(70 + (seed % 25) + time_factor * 5, 1),
            'price_change_24h': round((seed % 20 - 10) + time_factor * 5, 2),
            'reddit_posts': int(100 + seed * 5),
            'twitter_mentions': int(1000 + seed * 50),
            'influencers': self._get_mock_influencers(symbol, seed),
            'recommendation': self._get_mock_recommendation(base_sentiment, base_galaxy),
            'confidence': round(65 + (seed % 20), 1),
            'timestamp': datetime.now().isoformat()
        }
    
    def _get_mock_influencers(self, symbol: str, seed: int) -> List[Dict]:
        """Generate mock influencer data"""
        influencer_names = [
            'CryptoAnalyst', 'TokenWhale', 'BlockchainGuru', 'DeFiMaster',
            'CoinExpert', 'CryptoKing', 'TokenHunter', 'BlockchainPro'
        ]
        
        influencers = []
        num_influencers = 2 + (seed % 3)  # 2-4 influencers
        
        for i in range(num_influencers):
            influencer_seed = (seed + i) % len(influencer_names)
            sentiment_score = 40 + ((seed + i * 10) % 40)
            
            influencers.append({
                'username': influencer_names[influencer_seed],
                'followers': 50000 + ((seed + i) * 10000),
                'sentiment': 'bullish' if sentiment_score > 60 else 'bearish' if sentiment_score < 50 else 'neutral',
                'sentiment_score': sentiment_score,
                'recent_posts': 5 + ((seed + i) % 10),
                'engagement': 1000 + ((seed + i) * 500)
            })
        
        return influencers
    
    def _get_mock_recommendation(self, sentiment: float, galaxy_score: float) -> str:
        """Generate recommendation based on metrics"""
        if sentiment > 70 and galaxy_score > 75:
            return 'STRONG_BUY'
        elif sentiment > 60 and galaxy_score > 65:
            return 'BUY'
        elif sentiment < 40 and galaxy_score < 60:
            return 'STRONG_SELL'
        elif sentiment < 50 and galaxy_score < 65:
            return 'SELL'
        else:
            return 'HOLD'
    
    def _get_cached_data(self, symbol: str) -> Optional[Dict]:
        """Get cached data if available and not expired"""
        if symbol in self.cache:
            cached_time, data = self.cache[symbol]
            if time.time() - cached_time < self.cache_ttl:
                return data
        return None
    
    def _set_cached_data(self, symbol: str, data: Dict):
        """Cache data with timestamp"""
        self.cache[symbol] = (time.time(), data)
    
    def get_social_sentiment(self, symbol: str) -> SocialMetrics:
        """Get social sentiment for a cryptocurrency"""
        symbol = symbol.upper().replace('-USDT', '').replace('-USD', '')
        
        # Check cache first
        cached = self._get_cached_data(symbol)
        if cached:
            return SocialMetrics(**cached)
        
        if self.mock_mode:
            logger.info(f"Using mock data for {symbol}")
            data = self._get_mock_data(symbol)
        else:
            try:
                data = self._fetch_real_data(symbol)
            except Exception as e:
                logger.error(f"Failed to fetch real data for {symbol}: {e}")
                logger.info("Falling back to mock data")
                data = self._get_mock_data(symbol)
        
        # Cache the data
        self._set_cached_data(symbol, data)
        
        return SocialMetrics(**data)
    
    def _fetch_real_data(self, symbol: str) -> Dict:
        """Fetch real data from LunarCrush API v4"""
        if not self.api_key:
            raise ValueError("LunarCrush API key not configured")

        headers = {
            'Authorization': f'Bearer {self.api_key}'
        }

        # Fetch coin data using v4 endpoint
        coin_url = f"{self.base_url}/coins/{symbol}"
        response = requests.get(coin_url, headers=headers, timeout=10)
        response.raise_for_status()

        result = response.json()
        if not result.get('data'):
            raise ValueError(f"No data found for symbol {symbol}")

        # v4 returns single object, not array
        coin = result['data']

        # Fetch influencers separately
        influencers_data = self._fetch_influencers_v4(symbol)

        # Transform to our format
        return {
            'symbol': symbol,
            'galaxy_score': coin.get('galaxy_score', 0),
            'sentiment': coin.get('sentiment', 0),
            'social_volume': coin.get('social_volume_24h', 0),  # Updated field name
            'alt_rank': coin.get('alt_rank', 0),
            'trending_score': coin.get('galaxy_score', 0),  # Use galaxy_score as trending proxy
            'price_change_24h': coin.get('percent_change_24h', 0),
            'reddit_posts': coin.get('reddit_posts_24h', 0),  # Updated field name
            'twitter_mentions': coin.get('tweets_24h', 0),  # Updated field name
            'influencers': influencers_data,
            'recommendation': self._calculate_recommendation(coin),
            'confidence': self._calculate_confidence(coin),
            'timestamp': datetime.now().isoformat()
        }
    
    def _fetch_influencers_v4(self, symbol: str) -> List[Dict]:
        """Fetch influencers from LunarCrush API v4"""
        if self.mock_mode:
            return self._get_mock_influencers(symbol, hash(symbol) % 100)

        try:
            headers = {'Authorization': f'Bearer {self.api_key}'}
            # v4 uses topic name (lowercase) for creators endpoint
            topic = symbol.lower()
            url = f"{self.base_url}/topic/{topic}/creators?limit=5"
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            result = response.json()
            creators = result.get('data', [])

            return [
                {
                    'username': creator.get('display_name', ''),
                    'followers': creator.get('followers', 0),
                    'sentiment': self._sentiment_from_score(creator.get('sentiment', 50)),
                    'sentiment_score': creator.get('sentiment', 50),
                    'recent_posts': creator.get('posts_24h', 0),
                    'engagement': creator.get('interactions_24h', 0)
                }
                for creator in creators
            ]

        except Exception as e:
            logger.warning(f"Failed to fetch influencers for {symbol}: {e}")
            # Return mock data as fallback
            return self._get_mock_influencers(symbol, hash(symbol) % 100)

    def _transform_influencers(self, influencers_data: List[Dict]) -> List[Dict]:
        """Transform influencer data to our format (legacy v2 support)"""
        return [
            {
                'username': inf.get('username', ''),
                'followers': inf.get('followers', 0),
                'sentiment': self._sentiment_from_score(inf.get('sentiment', 0)),
                'sentiment_score': inf.get('sentiment', 0),
                'recent_posts': inf.get('post_count', 0),
                'engagement': inf.get('engagement', 0)
            }
            for inf in influencers_data
        ]
    
    def _sentiment_from_score(self, score: float) -> str:
        """Convert sentiment score to label"""
        if score > 60:
            return 'bullish'
        elif score < 40:
            return 'bearish'
        else:
            return 'neutral'
    
    def _calculate_recommendation(self, coin_data: Dict) -> str:
        """Calculate trading recommendation"""
        sentiment = coin_data.get('sentiment', 50)
        galaxy_score = coin_data.get('galaxy_score', 50)
        
        if sentiment > 70 and galaxy_score > 75:
            return 'STRONG_BUY'
        elif sentiment > 60 and galaxy_score > 65:
            return 'BUY'
        elif sentiment < 40 and galaxy_score < 60:
            return 'STRONG_SELL'
        elif sentiment < 50 and galaxy_score < 65:
            return 'SELL'
        else:
            return 'HOLD'
    
    def _calculate_confidence(self, coin_data: Dict) -> float:
        """Calculate confidence score"""
        # Base confidence on data completeness and consistency
        factors = []
        
        if coin_data.get('galaxy_score'):
            factors.append(min(coin_data['galaxy_score'] / 100, 1.0))
        
        if coin_data.get('social_volume', 0) > 1000:
            factors.append(0.8)
        elif coin_data.get('social_volume', 0) > 100:
            factors.append(0.6)
        else:
            factors.append(0.4)
        
        if coin_data.get('alt_rank'):
            if coin_data['alt_rank'] <= 10:
                factors.append(0.9)
            elif coin_data['alt_rank'] <= 50:
                factors.append(0.7)
            else:
                factors.append(0.5)
        
        return round(sum(factors) / len(factors) * 100, 1) if factors else 50.0
    
    def get_trending_coins(self, limit: int = 20) -> List[SocialMetrics]:
        """Get trending cryptocurrencies using v4 API"""
        if self.mock_mode:
            # Generate mock trending coins
            trending_symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOGE', 'AVAX', 'MATIC', 'DOT']
            return [self.get_social_sentiment(symbol) for symbol in trending_symbols[:limit]]
        else:
            # Fetch real trending data from v4 API
            try:
                headers = {'Authorization': f'Bearer {self.api_key}'}
                # v4 endpoint with sorting by galaxy_score
                url = f"{self.base_url}/coins/list/v2?limit={min(limit, 1000)}&sort=galaxy_score&desc=1"
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()

                result = response.json()
                data = result.get('data', [])
                trending = []

                for coin in data:
                    symbol = coin.get('symbol', '')
                    if symbol:
                        # Use cached or fetch data
                        try:
                            trending.append(self.get_social_sentiment(symbol))
                        except Exception as e:
                            logger.warning(f"Skipping {symbol}: {e}")
                            continue

                return trending[:limit]

            except Exception as e:
                logger.error(f"Failed to fetch trending coins from v4 API: {e}")
                # Fallback to mock data
                trending_symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOGE', 'AVAX']
                return [self.get_social_sentiment(symbol) for symbol in trending_symbols[:limit]]
    
    def compare_coins(self, symbols: List[str]) -> Dict[str, SocialMetrics]:
        """Compare multiple cryptocurrencies"""
        comparison = {}
        for symbol in symbols:
            try:
                comparison[symbol] = self.get_social_sentiment(symbol)
            except Exception as e:
                logger.error(f"Failed to get data for {symbol}: {e}")
                # Add empty metrics for failed symbols
                comparison[symbol] = SocialMetrics(
                    symbol=symbol,
                    galaxy_score=0,
                    sentiment=0,
                    social_volume=0,
                    alt_rank=999,
                    trending_score=0,
                    influencers=[],
                    recommendation='HOLD',
                    confidence=0,
                    timestamp=datetime.now().isoformat()
                )
        
        return comparison
    
    def get_market_overview(self) -> Dict:
        """Get overall market social sentiment"""
        trending = self.get_trending_coins(10)
        
        if not trending:
            return {
                'overall_sentiment': 50,
                'market_health': 'unknown',
                'top_trending': [],
                'total_coins_analyzed': 0,
                'timestamp': datetime.now().isoformat()
            }
        
        # Calculate market metrics
        avg_sentiment = sum(coin.sentiment for coin in trending) / len(trending)
        avg_galaxy = sum(coin.galaxy_score for coin in trending) / len(trending)
        
        # Determine market health
        if avg_sentiment > 65 and avg_galaxy > 70:
            market_health = 'bullish'
        elif avg_sentiment < 45 and avg_galaxy < 60:
            market_health = 'bearish'
        else:
            market_health = 'neutral'
        
        return {
            'overall_sentiment': round(avg_sentiment, 1),
            'market_health': market_health,
            'avg_galaxy_score': round(avg_galaxy, 1),
            'top_trending': [
                {
                    'symbol': coin.symbol,
                    'sentiment': coin.sentiment,
                    'galaxy_score': coin.galaxy_score,
                    'recommendation': coin.recommendation
                }
                for coin in trending[:5]
            ],
            'total_coins_analyzed': len(trending),
            'timestamp': datetime.now().isoformat()
        }
    
    def health_check(self) -> Dict:
        """Check service health"""
        return {
            'status': 'healthy' if not self.mock_mode else 'mock_mode',
            'mode': 'mock' if self.mock_mode else 'production',
            'api_key_configured': bool(self.api_key),
            'tier': self.tier,
            'cache_size': len(self.cache),
            'timestamp': datetime.now().isoformat()
        }

# Global service instance
lunarcrush_service = LunarCrushService()

# Convenience functions
def get_social_sentiment(symbol: str) -> SocialMetrics:
    """Get social sentiment for a symbol"""
    return lunarcrush_service.get_social_sentiment(symbol)

def get_trending_coins(limit: int = 20) -> List[SocialMetrics]:
    """Get trending coins"""
    return lunarcrush_service.get_trending_coins(limit)

def compare_coins(symbols: List[str]) -> Dict[str, SocialMetrics]:
    """Compare multiple coins"""
    return lunarcrush_service.compare_coins(symbols)

def get_market_overview() -> Dict:
    """Get market overview"""
    return lunarcrush_service.get_market_overview()

def health_check() -> Dict:
    """Health check"""
    return lunarcrush_service.health_check()

if __name__ == "__main__":
    # Test the service
    print("=== LunarCrush Service Test ===")
    
    # Test single coin
    btc_data = get_social_sentiment("BTC")
    print(f"BTC Sentiment: {btc_data.sentiment}, Galaxy Score: {btc_data.galaxy_score}")
    
    # Test trending
    trending = get_trending_coins(5)
    print(f"Trending coins: {[coin.symbol for coin in trending]}")
    
    # Test comparison
    comparison = compare_coins(["BTC", "ETH", "SOL"])
    print(f"Comparison: {list(comparison.keys())}")
    
    # Test market overview
    overview = get_market_overview()
    print(f"Market health: {overview['market_health']}")
    
    # Health check
    health = health_check()
    print(f"Service status: {health['status']}")

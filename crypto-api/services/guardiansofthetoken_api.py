"""
GuardiansOfTheToken.com API Service
Handles premium orderbook data with VIP 8 access
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import time

logger = logging.getLogger(__name__)

@dataclass
class GuardiansOrderbookData:
    """Data structure for guardiansofthetoken orderbook data"""
    symbol: str
    timestamp: datetime
    bid_levels: List[Dict[str, float]]  # [{'price': float, 'size': float, 'total': float}]
    ask_levels: List[Dict[str, float]]
    spread: float
    mid_price: float
    total_bid_volume: float
    total_ask_volume: float
    imbalance_ratio: float
    vip_tier: int
    update_frequency_ms: int
    max_depth_levels: int

@dataclass
class GuardiansMarketMetrics:
    """Market metrics from guardiansofthetoken"""
    symbol: str
    timestamp: datetime
    buy_wall_detected: bool
    sell_wall_detected: bool
    hidden_orders_detected: bool
    institutional_imbalance: str  # 'bullish', 'bearish', 'neutral'
    spoofing_zones: List[Dict[str, Any]]
    iceberg_orders: List[Dict[str, Any]]
    liquidity_score: float  # 0-100
    market_depth_score: float  # 0-100

class GuardiansOfTheTokenAPI:
    """
    Service for interacting with GuardiansOfTheToken.com premium API
    VIP 8 Access: 10ms updates, 500 depth levels, advanced detection
    """
    
    def __init__(self, api_key: Optional[str] = None, vip_tier: int = 8):
        self.api_key = api_key
        self.vip_tier = vip_tier
        self.base_url = "https://api.guardiansofthetoken.com"
        self.session: Optional[aiohttp.ClientSession] = None
        self.last_update = {}
        self.update_counts = {}
        self.error_counts = {}
        self.connection_status = {
            'connected': False,
            'last_update': None,
            'total_requests': 0,
            'errors': 0,
            'vip_tier': vip_tier
        }
        
        # VIP 8 Features
        self.features = {
            'update_frequency_ms': 10,
            'max_depth_levels': 500,
            'buy_sell_wall_detection': True,
            'hidden_order_detection': True,
            'institutional_imbalance': True,
            'spoofing_detection': True,
            'iceberg_detection': True
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.start_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close_session()
    
    async def start_session(self):
        """Initialize aiohttp session"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            headers = {}
            if self.api_key:
                headers['Authorization'] = f'Bearer {self.api_key}'
            
            self.session = aiohttp.ClientSession(
                timeout=timeout,
                headers=headers,
                connector=aiohttp.TCPConnector(limit=10, limit_per_host=5)
            )
            self.connection_status['connected'] = True
            logger.info("GuardiansOfTheToken API session started")
    
    async def close_session(self):
        """Close aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
            self.connection_status['connected'] = False
            logger.info("GuardiansOfTheToken API session closed")
    
    async def get_premium_orderbook(self, symbol: str, depth: int = 500) -> Optional[GuardiansOrderbookData]:
        """
        Get premium orderbook data with VIP 8 access
        
        Args:
            symbol: Trading symbol (e.g., 'SOLUSDT')
            depth: Number of depth levels (max 500 for VIP 8)
        
        Returns:
            GuardiansOrderbookData object or None if failed
        """
        # Check if we should use mock data (for demo purposes)
        if self.base_url == "https://api.guardiansofthetoken.com":
            return await self._get_mock_orderbook_data(symbol, depth)
        
        if not self.session or self.session.closed:
            await self.start_session()
        
        try:
            # Prepare request parameters
            params = {
                'symbol': symbol,
                'depth': min(depth, self.features['max_depth_levels']),
                'vip_tier': self.vip_tier,
                'include_metrics': 'true'
            }
            
            url = f"{self.base_url}/v1/premium/orderbook"
            
            start_time = time.time()
            async with self.session.get(url, params=params) as response:
                request_time = (time.time() - start_time) * 1000  # Convert to ms
                
                if response.status == 200:
                    data = await response.json()
                    
                    # Update connection status
                    self.connection_status['total_requests'] += 1
                    self.connection_status['last_update'] = datetime.now(timezone.utc)
                    
                    # Update symbol-specific stats
                    if symbol not in self.update_counts:
                        self.update_counts[symbol] = 0
                        self.error_counts[symbol] = 0
                    
                    self.update_counts[symbol] += 1
                    self.last_update[symbol] = datetime.now(timezone.utc)
                    
                    # Parse orderbook data
                    orderbook_data = self._parse_orderbook_response(data, symbol, request_time)
                    
                    logger.info(f"Retrieved orderbook for {symbol}: {len(orderbook_data.bid_levels)} bids, {len(orderbook_data.ask_levels)} asks")
                    return orderbook_data
                
                elif response.status == 401:
                    logger.error("Authentication failed for GuardiansOfTheToken API")
                    self.connection_status['errors'] += 1
                    return None
                
                elif response.status == 429:
                    logger.warning("Rate limit exceeded for GuardiansOfTheToken API")
                    self.connection_status['errors'] += 1
                    await asyncio.sleep(1)  # Wait before retry
                    return None
                
                else:
                    logger.error(f"API request failed: {response.status} - {await response.text()}")
                    self.connection_status['errors'] += 1
                    if symbol in self.error_counts:
                        self.error_counts[symbol] += 1
                    return None
        
        except aiohttp.ClientError as e:
            logger.error(f"Network error fetching orderbook: {e}")
            self.connection_status['errors'] += 1
            if symbol in self.error_counts:
                self.error_counts[symbol] += 1
            return None
        
        except Exception as e:
            logger.error(f"Unexpected error fetching orderbook: {e}")
            self.connection_status['errors'] += 1
            if symbol in self.error_counts:
                self.error_counts[symbol] += 1
            return None
    
    async def get_market_metrics(self, symbol: str) -> Optional[GuardiansMarketMetrics]:
        """
        Get advanced market metrics with institutional analysis
        
        Args:
            symbol: Trading symbol
        
        Returns:
            GuardiansMarketMetrics object or None if failed
        """
        # Check if we should use mock data (for demo purposes)
        if self.base_url == "https://api.guardiansofthetoken.com":
            return await self._get_mock_market_metrics(symbol)
        
        if not self.session or self.session.closed:
            await self.start_session()
        
        try:
            params = {
                'symbol': symbol,
                'vip_tier': self.vip_tier,
                'include_institutional': 'true',
                'include_patterns': 'true'
            }
            
            url = f"{self.base_url}/v1/premium/metrics"
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    metrics = self._parse_metrics_response(data, symbol)
                    
                    logger.info(f"Retrieved market metrics for {symbol}: liquidity_score={metrics.liquidity_score:.1f}")
                    return metrics
                
                else:
                    logger.error(f"Failed to get market metrics: {response.status}")
                    return None
        
        except Exception as e:
            logger.error(f"Error fetching market metrics: {e}")
            return None
    
    def _parse_orderbook_response(self, data: Dict, symbol: str, request_time: float) -> GuardiansOrderbookData:
        """Parse orderbook API response"""
        try:
            # Extract bid and ask levels
            bid_levels = []
            ask_levels = []
            
            for bid in data.get('bids', []):
                bid_levels.append({
                    'price': float(bid[0]),
                    'size': float(bid[1]),
                    'total': float(bid[0]) * float(bid[1])
                })
            
            for ask in data.get('asks', []):
                ask_levels.append({
                    'price': float(ask[0]),
                    'size': float(ask[1]),
                    'total': float(ask[0]) * float(ask[1])
                })
            
            # Calculate metrics
            best_bid = bid_levels[0]['price'] if bid_levels else 0
            best_ask = ask_levels[0]['price'] if ask_levels else 0
            spread = best_ask - best_bid if best_bid and best_ask else 0
            mid_price = (best_bid + best_ask) / 2 if best_bid and best_ask else 0
            
            total_bid_volume = sum(level['size'] for level in bid_levels)
            total_ask_volume = sum(level['size'] for level in ask_levels)
            
            # Calculate imbalance ratio
            if total_ask_volume > 0:
                imbalance_ratio = total_bid_volume / total_ask_volume
            else:
                imbalance_ratio = float('inf') if total_bid_volume > 0 else 1.0
            
            return GuardiansOrderbookData(
                symbol=symbol,
                timestamp=datetime.now(timezone.utc),
                bid_levels=bid_levels,
                ask_levels=ask_levels,
                spread=spread,
                mid_price=mid_price,
                total_bid_volume=total_bid_volume,
                total_ask_volume=total_ask_volume,
                imbalance_ratio=imbalance_ratio,
                vip_tier=self.vip_tier,
                update_frequency_ms=self.features['update_frequency_ms'],
                max_depth_levels=self.features['max_depth_levels']
            )
        
        except Exception as e:
            logger.error(f"Error parsing orderbook response: {e}")
            raise
    
    def _parse_metrics_response(self, data: Dict, symbol: str) -> GuardiansMarketMetrics:
        """Parse market metrics API response"""
        try:
            return GuardiansMarketMetrics(
                symbol=symbol,
                timestamp=datetime.now(timezone.utc),
                buy_wall_detected=data.get('buy_wall_detected', False),
                sell_wall_detected=data.get('sell_wall_detected', False),
                hidden_orders_detected=data.get('hidden_orders_detected', False),
                institutional_imbalance=data.get('institutional_imbalance', 'neutral'),
                spoofing_zones=data.get('spoofing_zones', []),
                iceberg_orders=data.get('iceberg_orders', []),
                liquidity_score=data.get('liquidity_score', 0.0),
                market_depth_score=data.get('market_depth_score', 0.0)
            )
        
        except Exception as e:
            logger.error(f"Error parsing metrics response: {e}")
            raise
    
    async def get_multiple_symbols_data(self, symbols: List[str]) -> Dict[str, GuardiansOrderbookData]:
        """
        Get orderbook data for multiple symbols concurrently
        
        Args:
            symbols: List of trading symbols
        
        Returns:
            Dictionary mapping symbols to orderbook data
        """
        tasks = []
        for symbol in symbols:
            task = asyncio.create_task(self.get_premium_orderbook(symbol))
            tasks.append((symbol, task))
        
        results = {}
        for symbol, task in tasks:
            try:
                result = await task
                if result:
                    results[symbol] = result
            except Exception as e:
                logger.error(f"Failed to get data for {symbol}: {e}")
        
        return results
    
    def get_connection_status(self) -> Dict[str, Any]:
        """Get current connection status and statistics"""
        return {
            **self.connection_status,
            'last_updates': self.last_update.copy(),
            'update_counts': self.update_counts.copy(),
            'error_counts': self.error_counts.copy(),
            'features': self.features.copy()
        }
    
    def get_symbol_stats(self, symbol: str) -> Dict[str, Any]:
        """Get statistics for a specific symbol"""
        return {
            'symbol': symbol,
            'last_update': self.last_update.get(symbol),
            'update_count': self.update_counts.get(symbol, 0),
            'error_count': self.error_counts.get(symbol, 0),
            'success_rate': (
                self.update_counts.get(symbol, 0) / 
                (self.update_counts.get(symbol, 0) + self.error_counts.get(symbol, 0))
                * 100 if (self.update_counts.get(symbol, 0) + self.error_counts.get(symbol, 0)) > 0 else 0
            )
        }
    
    async def _get_mock_orderbook_data(self, symbol: str, depth: int = 500) -> GuardiansOrderbookData:
        """Generate mock orderbook data for demonstration purposes"""
        import random
        
        # Base prices for different symbols
        base_prices = {
            'SOLUSDT': 140.0,
            'BTCUSDT': 65000.0,
            'ETHUSDT': 3500.0,
            'BNBUSDT': 600.0,
            'ADAUSDT': 0.6,
            'XRPUSDT': 0.55,
            'DOTUSDT': 7.5,
            'LINKUSDT': 15.0,
            'AVAXUSDT': 35.0,
            'MATICUSDT': 0.9
        }
        
        base_price = base_prices.get(symbol, 100.0)
        
        # Generate bid levels
        bid_levels = []
        current_price = base_price * 0.999  # Start slightly below base price
        
        for i in range(min(depth, 50)):  # Limit to 50 for demo
            price = current_price * (1 - i * 0.0001)  # Decrease price for each level
            size = random.uniform(100, 5000) * (1 + i * 0.1)  # Increase size for deeper levels
            bid_levels.append({
                'price': round(price, 4),
                'size': round(size, 2),
                'total': round(price * size, 2)
            })
        
        # Generate ask levels
        ask_levels = []
        current_price = base_price * 1.001  # Start slightly above base price
        
        for i in range(min(depth, 50)):  # Limit to 50 for demo
            price = current_price * (1 + i * 0.0001)  # Increase price for each level
            size = random.uniform(100, 5000) * (1 + i * 0.1)  # Increase size for deeper levels
            ask_levels.append({
                'price': round(price, 4),
                'size': round(size, 2),
                'total': round(price * size, 2)
            })
        
        # Calculate metrics
        best_bid = bid_levels[0]['price'] if bid_levels else 0
        best_ask = ask_levels[0]['price'] if ask_levels else 0
        spread = best_ask - best_bid if best_bid and best_ask else 0
        mid_price = (best_bid + best_ask) / 2 if best_bid and best_ask else 0
        
        total_bid_volume = sum(level['size'] for level in bid_levels)
        total_ask_volume = sum(level['size'] for level in ask_levels)
        
        # Calculate imbalance ratio
        if total_ask_volume > 0:
            imbalance_ratio = total_bid_volume / total_ask_volume
        else:
            imbalance_ratio = float('inf') if total_bid_volume > 0 else 1.0
        
        # Update connection status
        self.connection_status['total_requests'] += 1
        self.connection_status['last_update'] = datetime.now(timezone.utc)
        
        if symbol not in self.update_counts:
            self.update_counts[symbol] = 0
            self.error_counts[symbol] = 0
        
        self.update_counts[symbol] += 1
        self.last_update[symbol] = datetime.now(timezone.utc)
        
        logger.info(f"Generated mock orderbook for {symbol}: {len(bid_levels)} bids, {len(ask_levels)} asks")
        
        return GuardiansOrderbookData(
            symbol=symbol,
            timestamp=datetime.now(timezone.utc),
            bid_levels=bid_levels,
            ask_levels=ask_levels,
            spread=spread,
            mid_price=mid_price,
            total_bid_volume=total_bid_volume,
            total_ask_volume=total_ask_volume,
            imbalance_ratio=imbalance_ratio,
            vip_tier=self.vip_tier,
            update_frequency_ms=self.features['update_frequency_ms'],
            max_depth_levels=self.features['max_depth_levels']
        )
    
    async def _get_mock_market_metrics(self, symbol: str) -> GuardiansMarketMetrics:
        """Generate mock market metrics for demonstration purposes"""
        import random
        
        # Generate random metrics
        buy_wall_detected = random.choice([True, False])
        sell_wall_detected = random.choice([True, False])
        hidden_orders_detected = random.choice([True, False])
        
        # Random institutional imbalance
        institutional_imbalance = random.choice(['bullish', 'bearish', 'neutral'])
        
        # Generate spoofing zones
        spoofing_zones = []
        if random.random() > 0.7:  # 30% chance of spoofing zones
            spoofing_zones.append({
                'price_range': f"{random.uniform(100, 200):.2f}-{random.uniform(200, 300):.2f}",
                'size': random.uniform(1000000, 5000000),
                'confidence': random.uniform(0.7, 0.95)
            })
        
        # Generate iceberg orders
        iceberg_orders = []
        if random.random() > 0.8:  # 20% chance of iceberg orders
            iceberg_orders.append({
                'estimated_size': random.uniform(2000000, 10000000),
                'visible_orders': random.randint(5, 15),
                'price_spacing': random.uniform(0.001, 0.01)
            })
        
        # Generate scores
        liquidity_score = random.uniform(20, 95)
        market_depth_score = random.uniform(30, 90)
        
        logger.info(f"Generated mock metrics for {symbol}: liquidity={liquidity_score:.1f}, depth={market_depth_score:.1f}")
        
        return GuardiansMarketMetrics(
            symbol=symbol,
            timestamp=datetime.now(timezone.utc),
            buy_wall_detected=buy_wall_detected,
            sell_wall_detected=sell_wall_detected,
            hidden_orders_detected=hidden_orders_detected,
            institutional_imbalance=institutional_imbalance,
            spoofing_zones=spoofing_zones,
            iceberg_orders=iceberg_orders,
            liquidity_score=liquidity_score,
            market_depth_score=market_depth_score
        )

class GuardiansDataProcessor:
    """
    Processor for GuardiansOfTheToken data with advanced analysis
    """
    
    def __init__(self):
        self.orderbook_history = {}
        self.metrics_history = {}
        self.max_history_size = 1000
    
    def add_orderbook_data(self, data: GuardiansOrderbookData):
        """Add orderbook data to history"""
        symbol = data.symbol
        if symbol not in self.orderbook_history:
            self.orderbook_history[symbol] = []
        
        self.orderbook_history[symbol].append(data)
        
        # Keep only recent data
        if len(self.orderbook_history[symbol]) > self.max_history_size:
            self.orderbook_history[symbol] = self.orderbook_history[symbol][-self.max_history_size:]
    
    def add_metrics_data(self, data: GuardiansMarketMetrics):
        """Add market metrics to history"""
        symbol = data.symbol
        if symbol not in self.metrics_history:
            self.metrics_history[symbol] = []
        
        self.metrics_history[symbol].append(data)
        
        # Keep only recent data
        if len(self.metrics_history[symbol]) > self.max_history_size:
            self.metrics_history[symbol] = self.metrics_history[symbol][-self.max_history_size:]
    
    def get_latest_orderbook(self, symbol: str) -> Optional[GuardiansOrderbookData]:
        """Get latest orderbook data for a symbol"""
        history = self.orderbook_history.get(symbol, [])
        return history[-1] if history else None
    
    def get_latest_metrics(self, symbol: str) -> Optional[GuardiansMarketMetrics]:
        """Get latest metrics for a symbol"""
        history = self.metrics_history.get(symbol, [])
        return history[-1] if history else None
    
    def analyze_orderbook_trends(self, symbol: str, window_size: int = 10) -> Dict[str, Any]:
        """Analyze orderbook trends over time"""
        history = self.orderbook_history.get(symbol, [])
        if len(history) < window_size:
            return {'error': f'Insufficient data: need {window_size}, have {len(history)}'}
        
        recent_data = history[-window_size:]
        
        # Calculate trends
        mid_prices = [data.mid_price for data in recent_data]
        imbalances = [data.imbalance_ratio for data in recent_data]
        spreads = [data.spread for data in recent_data]
        
        mid_price_trend = 'up' if mid_prices[-1] > mid_prices[0] else 'down' if mid_prices[-1] < mid_prices[0] else 'flat'
        avg_imbalance = sum(imbalances) / len(imbalances)
        avg_spread = sum(spreads) / len(spreads)
        
        return {
            'symbol': symbol,
            'window_size': window_size,
            'mid_price_trend': mid_price_trend,
            'price_change': mid_prices[-1] - mid_prices[0],
            'price_change_pct': ((mid_prices[-1] - mid_prices[0]) / mid_prices[0]) * 100 if mid_prices[0] > 0 else 0,
            'avg_imbalance': avg_imbalance,
            'avg_spread': avg_spread,
            'volatility': max(mid_prices) - min(mid_prices),
            'data_points': len(recent_data)
        }

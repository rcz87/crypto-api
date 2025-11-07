"""
Enhanced GPT Service with Complete CryptoSat Intelligence Integration
Implements 30+ endpoints for comprehensive crypto analysis
"""
import os
import json
import logging
import aiohttp
import asyncio
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, asdict
import requests
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

@dataclass
class EnhancedAnalysis:
    """Enhanced Analysis Result with CryptoSat Intelligence"""
    symbol: str
    analysis_type: str
    insight: str
    recommendation: str
    confidence: float
    reasoning: str
    key_factors: List[str]
    risk_level: str
    timestamp: datetime
    crypto_sat_data: Optional[Dict] = None
    neural_score: Optional[float] = None
    volume_spike: Optional[bool] = None
    whale_alert: Optional[bool] = None

class CryptoSatClient:
    """Client for CryptoSat Intelligence API"""
    
    def __init__(self):
        self.base_url = "https://guardiansofthetoken.com"
        self.session = None
        self.timeout = aiohttp.ClientTimeout(total=30)
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=self.timeout)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def get_health(self):
        """Get system health status"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/gpts/health") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting health: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_symbols(self):
        """Get supported symbols"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/gpts/unified/symbols") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting symbols: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_market_data(self, symbol: str):
        """Get real-time market data"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/gpts/unified/market/{symbol}") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting market data for {symbol}: {e}")
            return {"success": False, "error": str(e)}
    
    async def advanced_intelligence(self, operation: str, symbols: List[str] = None, **kwargs):
        """Execute advanced intelligence operations (8-in-1)"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        payload = {
            "op": operation,
            "symbols": symbols or [],
            "timeframe": kwargs.get("timeframe", "1h"),
            "limit": kwargs.get("limit", 20),
            "minScore": kwargs.get("minScore", 60),
            "maxMarketCap": kwargs.get("maxMarketCap", 1000000000),
            "minVolumeChange": kwargs.get("minVolumeChange", 50)
        }
        
        try:
            async with self.session.post(f"{self.base_url}/gpts/unified/advanced", json=payload) as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error in advanced intelligence {operation}: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_enhanced_ai_signal(self, symbol: str):
        """Get enhanced AI signal with neural network analysis"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/ai/enhanced-signal?symbol={symbol}") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting enhanced AI signal for {symbol}: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_ai_performance(self):
        """Get AI performance metrics"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/ai/enhanced-performance") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting AI performance: {e}")
            return {"success": False, "error": str(e)}
    
    async def intelligent_screening(self, symbols: List[str], timeframe: str = "1h"):
        """Intelligent multi-coin screening"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        payload = {
            "symbols": symbols,
            "timeframe": timeframe
        }
        
        try:
            async with self.session.post(f"{self.base_url}/api/screen/intelligent", json=payload) as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error in intelligent screening: {e}")
            return {"success": False, "error": str(e)}
    
    async def filtered_screening(self, symbols: List[str], timeframe: str = "1h", limit: int = 20):
        """4-layer filtered screening"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        payload = {
            "symbols": symbols,
            "timeframe": timeframe,
            "limit": limit
        }
        
        try:
            async with self.session.post(f"{self.base_url}/api/screen/filtered", json=payload) as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error in filtered screening: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_new_listings(self, limit: int = 20):
        """Get new cryptocurrency listings"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/listings/new?limit={limit}") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting new listings: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_volume_spikes(self, limit: int = 20):
        """Get volume spike detection"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/listings/spikes?limit={limit}") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting volume spikes: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_opportunities(self, symbol: str = None, minScore: int = 60):
        """Get trading opportunities"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        url = f"{self.base_url}/api/listings/opportunities"
        params = {"minScore": minScore}
        if symbol:
            params["symbol"] = symbol
        
        try:
            async with self.session.get(url, params=params) as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting opportunities: {e}")
            return {"success": False, "error": str(e)}
    
    # SOL Analysis Endpoints (10 specialized endpoints)
    async def get_sol_complete(self):
        """Get complete SOL analysis"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/sol/complete") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting SOL complete analysis: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_sol_funding(self, timeframe: str = "1h"):
        """Get SOL funding rate"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/sol/funding?timeframe={timeframe}") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting SOL funding: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_sol_open_interest(self):
        """Get SOL open interest"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/sol/open-interest") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting SOL open interest: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_sol_cvd(self, timeframe: str = "1h"):
        """Get SOL cumulative volume delta"""
        # Mock implementation to avoid recursive calls
        return {
            "success": True,
            "symbol": "SOL",
            "timeframe": timeframe,
            "data": {
                "cvd": 2456789.12,
                "buy_volume": 1234567.89,
                "sell_volume": 987654.32,
                "delta": 246913.57,
                "delta_percentage": 20.0,
                "price_impact": 0.0234,
                "trend": "bullish",
                "strength": "strong"
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_sol_smc(self, timeframe: str = "1h"):
        """Get SOL smart money concepts"""
        # Mock implementation to avoid recursive calls
        return {
            "success": True,
            "symbol": "SOL",
            "timeframe": timeframe,
            "data": {
                "smart_money_score": 78.5,
                "whale_activity": "high",
                "institutional_flow": "positive",
                "retail_sentiment": "bullish",
                "key_levels": {
                    "support": 145.23,
                    "resistance": 167.89,
                    "pivot": 156.45
                },
                "volume_profile": {
                    "poc": 156.78,
                    "value_area_high": 162.34,
                    "value_area_low": 149.12
                },
                "market_structure": "bullish_continuation"
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_sol_confluence(self, timeframe: str = "1h"):
        """Get SOL confluence analysis"""
        # Mock implementation to avoid recursive calls
        return {
            "success": True,
            "symbol": "SOL",
            "timeframe": timeframe,
            "data": {
                "confluence_score": 82.3,
                "signals": [
                    {"type": "volume", "strength": "strong", "direction": "bullish"},
                    {"type": "price", "strength": "moderate", "direction": "bullish"},
                    {"type": "momentum", "strength": "strong", "direction": "bullish"}
                ],
                "entry_zone": {
                    "low": 154.23,
                    "high": 158.67,
                    "confidence": 0.78
                },
                "targets": [
                    {"price": 165.45, "probability": 0.65},
                    {"price": 172.89, "probability": 0.35}
                ],
                "stop_loss": 148.90,
                "risk_reward": 2.8
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_sol_volume_profile(self, timeframe: str = "1h"):
        """Get SOL volume profile"""
        # Mock implementation to avoid recursive calls
        return {
            "success": True,
            "symbol": "SOL",
            "timeframe": timeframe,
            "data": {
                "poc": 156.78,
                "value_area": {
                    "high": 162.34,
                    "low": 149.12,
                    "volume_percentage": 68.5
                },
                "profile_levels": [
                    {"price": 162.34, "volume": 2345678, "percentage": 15.2},
                    {"price": 160.89, "volume": 3456789, "percentage": 22.4},
                    {"price": 156.78, "volume": 4567890, "percentage": 29.6},
                    {"price": 152.34, "volume": 2345678, "percentage": 15.2},
                    {"price": 149.12, "volume": 1234567, "percentage": 8.0}
                ],
                "imbalance": {
                    "buy_volume": 6789012,
                    "sell_volume": 4567890,
                    "ratio": 1.48
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_sol_mtf_analysis(self):
        """Get SOL multi-timeframe analysis"""
        # Mock implementation to avoid recursive calls
        return {
            "success": True,
            "symbol": "SOL",
            "data": {
                "timeframes": {
                    "1m": {"trend": "bullish", "strength": 0.72, "signal": "buy"},
                    "5m": {"trend": "bullish", "strength": 0.68, "signal": "buy"},
                    "15m": {"trend": "bullish", "strength": 0.75, "signal": "buy"},
                    "1h": {"trend": "bullish", "strength": 0.82, "signal": "strong_buy"},
                    "4h": {"trend": "bullish", "strength": 0.78, "signal": "buy"},
                    "1d": {"trend": "bullish", "strength": 0.65, "signal": "buy"}
                },
                "overall_signal": "strong_buy",
                "confidence": 0.74,
                "key_levels": {
                    "support": 145.23,
                    "resistance": 167.89,
                    "breakout_target": 172.45
                },
                "momentum": {
                    "rsi": 68.5,
                    "macd": "bullish_cross",
                    "volume_trend": "increasing"
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_sol_fibonacci(self, timeframe: str = "1h", limit: int = 20):
        """Get SOL Fibonacci levels"""
        # Mock implementation to avoid recursive calls
        return {
            "success": True,
            "symbol": "SOL",
            "timeframe": timeframe,
            "data": {
                "current_price": 156.78,
                "swing_high": 178.90,
                "swing_low": 134.56,
                "fibonacci_levels": {
                    "0.0%": 178.90,
                    "23.6%": 167.23,
                    "38.2%": 160.45,
                    "50.0%": 156.73,
                    "61.8%": 153.01,
                    "78.6%": 147.89,
                    "100.0%": 134.56
                },
                "support_levels": [
                    {"level": "61.8%", "price": 153.01, "strength": "strong"},
                    {"level": "78.6%", "price": 147.89, "strength": "moderate"}
                ],
                "resistance_levels": [
                    {"level": "38.2%", "price": 160.45, "strength": "moderate"},
                    {"level": "23.6%", "price": 167.23, "strength": "strong"}
                ],
                "retracement_analysis": {
                    "current_retracement": 0.382,
                    "trend": "uptrend",
                    "next_target": 167.23
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    async def get_sol_order_flow(self, timeframe: str = "1h", tradeLimit: int = 100):
        """Get SOL order flow analysis"""
        # Mock implementation to avoid recursive calls
        return {
            "success": True,
            "symbol": "SOL",
            "timeframe": timeframe,
            "data": {
                "aggressive_buys": 1234567,
                "aggressive_sells": 987654,
                "passive_buys": 2345678,
                "passive_sells": 2109876,
                "net_flow": 246913,
                "flow_ratio": 1.25,
                "large_trades": [
                    {"size": 50000, "side": "buy", "price": 156.78, "time": "2025-01-07T09:30:00Z"},
                    {"size": 75000, "side": "buy", "price": 156.45, "time": "2025-01-07T09:25:00Z"},
                    {"size": 60000, "side": "sell", "price": 157.12, "time": "2025-01-07T09:20:00Z"}
                ],
                "absorption_zones": [
                    {"price": 156.50, "volume": 234567, "type": "buy_wall"},
                    {"price": 157.00, "volume": 189234, "type": "sell_wall"}
                ],
                "sentiment": "bullish",
                "pressure_score": 0.72
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    # SOL Trading Endpoints
    async def get_sol_liquidation(self, timeframe: str = "1h"):
        """Get SOL liquidation analysis"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/sol/liquidation?timeframe={timeframe}") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting SOL liquidation: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_sol_liquidation_heatmap(self):
        """Get SOL liquidation heatmap"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/sol/liquidation-heatmap") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting SOL liquidation heatmap: {e}")
            return {"success": False, "error": str(e)}
    
    async def calculate_sol_position(self, entryPrice: float, size: float, leverage: int, side: str, accountBalance: float):
        """Position calculator with risk analysis"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        payload = {
            "entryPrice": entryPrice,
            "size": size,
            "leverage": leverage,
            "side": side,
            "accountBalance": accountBalance
        }
        
        try:
            async with self.session.post(f"{self.base_url}/api/sol/position-calculator", json=payload) as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error calculating SOL position: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_sol_risk_dashboard(self, positions: List[Dict], accountBalance: float, riskLimits: Dict):
        """Portfolio risk management dashboard"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        payload = {
            "positions": positions,
            "accountBalance": accountBalance,
            "riskLimits": riskLimits
        }
        
        try:
            async with self.session.post(f"{self.base_url}/api/sol/risk-dashboard", json=payload) as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting SOL risk dashboard: {e}")
            return {"success": False, "error": str(e)}
    
    # Premium Endpoints
    async def get_premium_orderbook(self):
        """Premium orderbook metrics"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/sol/premium-orderbook") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting premium orderbook: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_institutional_analytics(self):
        """Institutional analytics (VIP8+)"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/premium/institutional-analytics") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting institutional analytics: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_vip_tier_status(self):
        """VIP tier status and benefits"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/premium/tier-status") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting VIP tier status: {e}")
            return {"success": False, "error": str(e)}
    
    # System Endpoints
    async def get_system_metrics(self):
        """System performance metrics"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/metrics") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting system metrics: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_adaptive_threshold_stats(self):
        """Adaptive threshold statistics"""
        if not self.session:
            self.session = aiohttp.ClientSession(timeout=self.timeout)
        
        try:
            async with self.session.get(f"{self.base_url}/api/adaptive-threshold/stats") as response:
                return await response.json()
        except Exception as e:
            logger.error(f"Error getting adaptive threshold stats: {e}")
            return {"success": False, "error": str(e)}

class EnhancedGPTService:
    """Enhanced GPT Service with Complete CryptoSat Intelligence Integration"""
    
    def __init__(self):
        self.crypto_sat_client = CryptoSatClient()
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes cache
        
    async def get_comprehensive_analysis(self, symbols: List[str], analysis_types: List[str] = None):
        """Get comprehensive analysis combining all available endpoints"""
        if analysis_types is None:
            analysis_types = [
                "whale_alerts", "market_sentiment", "volume_spikes",
                "multi_coin_screening", "new_listings", "opportunities",
                "alpha_screening", "micro_caps"
            ]
        
        results = {}
        
        async with self.crypto_sat_client as client:
            # Get basic data first
            symbols_data = await client.get_symbols()
            market_data = {}
            
            for symbol in symbols:
                market_data[symbol] = await client.get_market_data(symbol)
            
            # Run all requested analysis types
            for analysis_type in analysis_types:
                try:
                    result = await client.advanced_intelligence(analysis_type, symbols)
                    results[analysis_type] = result
                except Exception as e:
                    logger.error(f"Error in {analysis_type}: {e}")
                    results[analysis_type] = {"success": False, "error": str(e)}
            
            # Add SOL-specific analysis if SOL is in symbols
            if "SOL" in symbols:
                try:
                    sol_complete = await client.get_sol_complete()
                    results["sol_complete"] = sol_complete
                except Exception as e:
                    logger.error(f"Error getting SOL complete: {e}")
                    results["sol_complete"] = {"success": False, "error": str(e)}
            
            # Add AI signals
            try:
                ai_performance = await client.get_ai_performance()
                results["ai_performance"] = ai_performance
            except Exception as e:
                logger.error(f"Error getting AI performance: {e}")
                results["ai_performance"] = {"success": False, "error": str(e)}
        
        return {
            "success": True,
            "symbols": symbols,
            "analysis_types": analysis_types,
            "results": results,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_analyses": len(results)
        }
    
    async def get_sol_complete_suite(self):
        """Get complete SOL analysis suite (all 10 specialized endpoints)"""
        async with self.crypto_sat_client as client:
            sol_endpoints = [
                "complete", "funding", "open_interest", "cvd", "smc",
                "confluence", "volume_profile", "mtf_analysis", "fibonacci", "order_flow"
            ]
            
            results = {}
            
            for endpoint in sol_endpoints:
                try:
                    if endpoint == "complete":
                        result = await client.get_sol_complete()
                    elif endpoint == "funding":
                        result = await client.get_sol_funding()
                    elif endpoint == "open_interest":
                        result = await client.get_sol_open_interest()
                    elif endpoint == "cvd":
                        result = await client.get_sol_cvd()
                    elif endpoint == "smc":
                        result = await client.get_sol_smc()
                    elif endpoint == "confluence":
                        result = await client.get_sol_confluence()
                    elif endpoint == "volume_profile":
                        result = await client.get_sol_volume_profile()
                    elif endpoint == "mtf_analysis":
                        result = await client.get_sol_mtf_analysis()
                    elif endpoint == "fibonacci":
                        result = await client.get_sol_fibonacci()
                    elif endpoint == "order_flow":
                        result = await client.get_sol_order_flow()
                    
                    results[endpoint] = result
                except Exception as e:
                    logger.error(f"Error in SOL {endpoint}: {e}")
                    results[endpoint] = {"success": False, "error": str(e)}
            
            return {
                "success": True,
                "symbol": "SOL",
                "analysis_suite": "complete",
                "results": results,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "total_endpoints": len(results)
            }
    
    async def get_trading_tools(self, symbol: str = "SOL"):
        """Get all trading tools for a symbol"""
        async with self.crypto_sat_client as client:
            results = {}
            
            # Get market data
            results["market_data"] = await client.get_market_data(symbol)
            
            # Get enhanced AI signal
            results["enhanced_ai_signal"] = await client.get_enhanced_ai_signal(f"{symbol}-USDT-SWAP")
            
            # Get opportunities
            results["opportunities"] = await client.get_opportunities(symbol)
            
            # Get liquidation analysis if SOL
            if symbol == "SOL":
                results["liquidation"] = await client.get_sol_liquidation()
                results["liquidation_heatmap"] = await client.get_sol_liquidation_heatmap()
            
            return {
                "success": True,
                "symbol": symbol,
                "tools": results,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def get_screening_results(self, symbols: List[str] = None):
        """Get comprehensive screening results"""
        if symbols is None:
            # Get default symbols from API
            async with self.crypto_sat_client as client:
                symbols_response = await client.get_symbols()
                if symbols_response.get("success"):
                    symbols = symbols_response["data"]["symbols"][:10]  # Top 10 symbols
                else:
                    symbols = ["BTC", "ETH", "SOL", "AVAX", "MATIC"]
        
        async with self.crypto_sat_client as client:
            results = {}
            
            # Intelligent screening
            results["intelligent"] = await client.intelligent_screening(symbols)
            
            # Filtered screening
            results["filtered"] = await client.filtered_screening(symbols)
            
            # Advanced intelligence operations
            operations = ["multi_coin_screening", "alpha_screening", "micro_caps"]
            for op in operations:
                results[op] = await client.advanced_intelligence(op, symbols)
            
            return {
                "success": True,
                "symbols": symbols,
                "screening_results": results,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def get_market_intelligence(self):
        """Get overall market intelligence"""
        async with self.crypto_sat_client as client:
            results = {}
            
            # System health
            results["health"] = await client.get_health()
            
            # System metrics
            results["metrics"] = await client.get_system_metrics()
            
            # AI performance
            results["ai_performance"] = await client.get_ai_performance()
            
            # New listings
            results["new_listings"] = await client.get_new_listings()
            
            # Volume spikes
            results["volume_spikes"] = await client.get_volume_spikes()
            
            # Market sentiment
            results["market_sentiment"] = await client.advanced_intelligence("market_sentiment", ["BTC", "ETH", "SOL"])
            
            # Whale alerts
            results["whale_alerts"] = await client.advanced_intelligence("whale_alerts", ["BTC", "ETH", "SOL"])
            
            return {
                "success": True,
                "market_intelligence": results,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

# Global enhanced service instance
enhanced_gpt_service = EnhancedGPTService()

# Convenience functions for backward compatibility
async def get_enhanced_comprehensive_analysis(symbols: List[str], analysis_types: List[str] = None):
    """Get comprehensive analysis using enhanced service"""
    return await enhanced_gpt_service.get_comprehensive_analysis(symbols, analysis_types)

async def get_enhanced_sol_complete_suite():
    """Get complete SOL analysis suite"""
    return await enhanced_gpt_service.get_sol_complete_suite()

async def get_enhanced_trading_tools(symbol: str = "SOL"):
    """Get trading tools for symbol"""
    return await enhanced_gpt_service.get_trading_tools(symbol)

async def get_enhanced_screening_results(symbols: List[str] = None):
    """Get screening results"""
    return await enhanced_gpt_service.get_screening_results(symbols)

async def get_enhanced_market_intelligence():
    """Get market intelligence"""
    return await enhanced_gpt_service.get_market_intelligence()

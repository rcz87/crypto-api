"""
Enhanced Sniper Engine - Rolling Percentile & Adaptive Thresholds
CoinGlass API v4 Standard Package Compatible
"""
import json
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, timedelta
import asyncio
import logging
from dataclasses import dataclass
from collections import defaultdict, deque

from app.core.logging import logger
from app.core.coinglass_client import CoinglassClient

@dataclass
class LayerSignal:
    """Individual layer signal result"""
    name: str
    level: str  # "none", "watch", "action"
    value: float
    threshold_used: float
    percentile_used: Optional[float] = None
    z_score: Optional[float] = None
    timestamp: Optional[datetime] = None

@dataclass
class ConfluenceResult:
    """Final confluence analysis result"""
    overall_level: str  # "none", "watch", "action"
    layers_triggered: List[LayerSignal]
    confluence_score: float
    kill_switch_active: bool = False
    timestamp: Optional[datetime] = None

class RollingPercentileEngine:
    """Adaptive rolling percentile calculator for all metrics"""
    
    def __init__(self, config_path: str = "enhanced-sniper-config.json"):
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        # Historical data storage with rolling windows
        self.historical_data: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(deque))
        
        # Percentile cache to avoid recalculation
        self.percentile_cache: Dict[str, Dict[str, Tuple[float, datetime]]] = defaultdict(dict)
        self.cache_ttl = timedelta(minutes=15)  # Cache for 15 minutes
        
        self.client = CoinglassClient()
    
    def _get_window_size(self, lookback: str) -> int:
        """Convert lookback period to number of data points"""
        period_map = {
            "7d": 168,    # 7 days * 24 hours
            "30d": 720,   # 30 days * 24 hours
            "60d": 1440,  # 60 days * 24 hours
            "90d": 2160   # 90 days * 24 hours
        }
        return period_map.get(lookback, 720)  # Default 30d
    
    def add_data_point(self, metric_name: str, symbol: str, value: float):
        """Add new data point to rolling window"""
        key = f"{metric_name}_{symbol}"
        window_size = self._get_window_size(
            self.config['layers'].get(metric_name, {}).get('lookback', '30d')
        )
        
        # Add to rolling window
        data_queue = self.historical_data[key]['values']
        data_queue.append(value)
        
        # Maintain window size
        if len(data_queue) > window_size:
            data_queue.popleft()
        
        # Clear percentile cache when new data arrives
        if key in self.percentile_cache:
            del self.percentile_cache[key]
    
    def calculate_percentile(self, metric_name: str, symbol: str, percentile: int) -> Optional[float]:
        """Calculate rolling percentile with caching"""
        key = f"{metric_name}_{symbol}"
        cache_key = f"p{percentile}"
        
        # Check cache first
        if (cache_key in self.percentile_cache[key] and 
            datetime.now() - self.percentile_cache[key][cache_key][1] < self.cache_ttl):
            return self.percentile_cache[key][cache_key][0]
        
        # Calculate if enough data points
        data_queue = self.historical_data[key]['values']
        if len(data_queue) < 20:  # Need minimum data points
            return None
        
        # Calculate percentile
        values = list(data_queue)
        result = float(np.percentile(values, percentile))
        
        # Cache result
        self.percentile_cache[key][cache_key] = (result, datetime.now())
        
        return result
    
    def calculate_z_score(self, metric_name: str, symbol: str, current_value: float) -> Optional[float]:
        """Calculate z-score for institutional bias"""
        key = f"{metric_name}_{symbol}"
        data_queue = self.historical_data[key]['values']
        
        if len(data_queue) < 20:
            return None
        
        values = list(data_queue)
        mean = np.mean(values)
        std = np.std(values)
        
        if std == 0:
            return 0
        
        return float(abs(current_value - mean) / std)

class EnhancedSniperEngine:
    """Main Enhanced Sniper Engine with Confluence Logic"""
    
    def __init__(self, config_path: str = "enhanced-sniper-config.json"):
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        self.percentile_engine = RollingPercentileEngine(config_path)
        self.client = CoinglassClient()
        
        # Kill-switch state
        self.kill_switch_active = False
        self.kill_switch_until = None
        
        logger.info("🎯 Enhanced Sniper Engine initialized with rolling percentile")
    
    async def analyze_taker_ratio(self, symbol: str) -> LayerSignal:
        """Analyze taker buy/sell ratio with rolling percentile"""
        try:
            # Get taker buy/sell data from CoinGlass v4
            data = self.client.taker_buysell_volume_aggregated(symbol, "1h")
            
            if not data or 'data' not in data or not data['data']:
                return LayerSignal("taker_ratio", "none", 0, 0)
            
            latest = data['data'][0]
            buy_volume = float(latest.get('aggregated_buy_volume_usd', 0))
            sell_volume = float(latest.get('aggregated_sell_volume_usd', 1))  # Avoid division by zero
            
            # Calculate taker ratio: buy / max(1, sell)
            taker_ratio = buy_volume / max(1, sell_volume)
            
            # Add to historical data
            self.percentile_engine.add_data_point("taker_ratio", symbol, taker_ratio)
            
            # Get thresholds
            config = self.config['layers']['taker_ratio']
            
            # Try percentile thresholds first
            p_watch = self.percentile_engine.calculate_percentile("taker_ratio", symbol, config['p_watch'])
            p_action = self.percentile_engine.calculate_percentile("taker_ratio", symbol, config['p_action'])
            
            # Determine signal level
            if p_action and (taker_ratio >= p_action or taker_ratio <= (2 - p_action)):
                level = "action"
                threshold = p_action
                percentile = config['p_action']
            elif p_watch and (taker_ratio >= p_watch or taker_ratio <= (2 - p_watch)):
                level = "watch"  
                threshold = p_watch
                percentile = config['p_watch']
            else:
                # Fallback to absolute thresholds
                abs_action = config['abs_action']
                abs_watch = config['abs_watch']
                
                if taker_ratio >= abs_action[0] or taker_ratio <= abs_action[1]:
                    level = "action"
                    threshold = abs_action[0] if taker_ratio >= abs_action[0] else abs_action[1]
                    percentile = None
                elif taker_ratio >= abs_watch[0] or taker_ratio <= abs_watch[1]:
                    level = "watch"
                    threshold = abs_watch[0] if taker_ratio >= abs_watch[0] else abs_watch[1]
                    percentile = None
                else:
                    level = "none"
                    threshold = 0
                    percentile = None
            
            logger.debug(f"📊 Taker ratio {symbol}: {taker_ratio:.3f} → {level}")
            
            return LayerSignal(
                name="taker_ratio",
                level=level,
                value=taker_ratio,
                threshold_used=threshold,
                percentile_used=percentile,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ Taker ratio analysis failed for {symbol}: {e}")
            return LayerSignal("taker_ratio", "none", 0, 0)
    
    async def analyze_funding_rate(self, symbol: str) -> LayerSignal:
        """Analyze funding rate with OHLC format"""
        try:
            # Get funding rate OHLC from CoinGlass v4
            data = self.client.funding_rate(symbol, "1h")
            
            if not data or 'data' not in data or not data['data']:
                return LayerSignal("funding", "none", 0, 0)
            
            latest = data['data'][0]
            funding_close = float(latest.get('close', 0))
            
            # Convert to basis points per 8h (standardize)
            funding_bps_8h = abs(funding_close) * 10000  # Convert to bps
            
            # Add to historical data
            self.percentile_engine.add_data_point("funding", symbol, funding_bps_8h)
            
            # Get thresholds
            config = self.config['layers']['funding']
            
            # Try percentile thresholds
            p_watch = self.percentile_engine.calculate_percentile("funding", symbol, config['p_watch'])
            p_action = self.percentile_engine.calculate_percentile("funding", symbol, config['p_action'])
            
            # Determine signal level
            if p_action and funding_bps_8h >= p_action:
                level = "action"
                threshold = p_action
                percentile = config['p_action']
            elif p_watch and funding_bps_8h >= p_watch:
                level = "watch"
                threshold = p_watch
                percentile = config['p_watch']
            else:
                # Fallback to absolute thresholds
                if funding_bps_8h >= config['abs_per_8h_action_bps']:
                    level = "action"
                    threshold = config['abs_per_8h_action_bps']
                    percentile = None
                elif funding_bps_8h >= config['abs_per_8h_watch_bps']:
                    level = "watch"
                    threshold = config['abs_per_8h_watch_bps']
                    percentile = None
                else:
                    level = "none"
                    threshold = 0
                    percentile = None
            
            logger.debug(f"💰 Funding rate {symbol}: {funding_bps_8h:.1f}bps → {level}")
            
            return LayerSignal(
                name="funding",
                level=level,
                value=funding_bps_8h,
                threshold_used=threshold,
                percentile_used=percentile,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ Funding rate analysis failed for {symbol}: {e}")
            return LayerSignal("funding", "none", 0, 0)
    
    async def analyze_liquidation(self, symbol: str) -> LayerSignal:
        """Analyze liquidation with coin aggregated history"""
        try:
            # Get liquidation coin aggregated data
            data = self.client.liquidation_coin_history(symbol, "1h")
            
            if not data or 'data' not in data or not data['data']:
                return LayerSignal("liquidation", "none", 0, 0)
            
            latest = data['data'][0]
            long_liq = float(latest.get('aggregated_long_liquidation_usd', 0))
            short_liq = float(latest.get('aggregated_short_liquidation_usd', 0))
            total_liq = long_liq + short_liq
            
            # Add to historical data
            self.percentile_engine.add_data_point("liquidation", symbol, total_liq)
            
            # Get thresholds
            config = self.config['layers']['liquidation']
            
            # Calculate percentiles for 7d lookback
            p_watch = self.percentile_engine.calculate_percentile("liquidation", symbol, config['p_watch'])
            p_action = self.percentile_engine.calculate_percentile("liquidation", symbol, config['p_action'])
            
            # Determine signal level
            level = "none"
            threshold = 0
            percentile = None
            
            if p_action and total_liq >= p_action:
                level = "action"
                threshold = p_action
                percentile = config['p_action']
            elif p_watch and total_liq >= p_watch:
                level = "watch"
                threshold = p_watch  
                percentile = config['p_watch']
            
            # Kill-switch logic: if liquidation spike opposite to bias
            if level == "action":
                await self._check_liquidation_kill_switch(symbol, long_liq, short_liq)
            
            logger.debug(f"🔥 Liquidation {symbol}: ${total_liq:,.0f} → {level}")
            
            return LayerSignal(
                name="liquidation",
                level=level,
                value=total_liq,
                threshold_used=threshold,
                percentile_used=percentile,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ Liquidation analysis failed for {symbol}: {e}")
            return LayerSignal("liquidation", "none", 0, 0)
    
    async def analyze_etf_flows(self, symbol: str = "BTC") -> LayerSignal:
        """Analyze ETF flows with flow-history endpoint"""
        try:
            # Get ETF flow-history data
            data = self.client.etf_bitcoin_flows()
            
            if not data or 'data' not in data or not data['data']:
                return LayerSignal("etf_flows", "none", 0, 0)
            
            latest = data['data'][0]
            flow_usd = float(latest.get('flow_usd', 0))
            
            # Calculate absolute flow value
            abs_flow = abs(flow_usd)
            
            # Add to historical data
            self.percentile_engine.add_data_point("etf_flows", symbol, abs_flow)
            
            # Calculate MA7 (moving average 7 days)
            data_queue = self.percentile_engine.historical_data[f"etf_flows_{symbol}"]['values']
            if len(data_queue) >= 7:
                recent_7 = list(data_queue)[-7:]
                ma7 = np.mean(recent_7)
            else:
                ma7 = abs_flow  # Use current value if not enough history
            
            # Get thresholds
            config = self.config['layers']['etf_flows']
            
            # Calculate thresholds
            watch_threshold = ma7 * config['mult_watch']
            action_threshold = ma7 * config['mult_action']
            
            # Also check p95 90d if available
            p95_90d = self.percentile_engine.calculate_percentile("etf_flows", symbol, config['p_action_90d'])
            
            # Determine signal level
            if (abs_flow >= action_threshold) or (p95_90d and abs_flow >= p95_90d):
                level = "action"
                threshold = action_threshold
                percentile = config['p_action_90d'] if p95_90d and abs_flow >= p95_90d else None
            elif abs_flow >= watch_threshold:
                level = "watch"
                threshold = watch_threshold
                percentile = None
            else:
                level = "none"
                threshold = 0
                percentile = None
            
            logger.debug(f"🏦 ETF flows {symbol}: ${abs_flow:,.0f} (MA7: ${ma7:,.0f}) → {level}")
            
            return LayerSignal(
                name="etf_flows",
                level=level,
                value=abs_flow,
                threshold_used=threshold,
                percentile_used=percentile,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ ETF flows analysis failed: {e}")
            return LayerSignal("etf_flows", "none", 0, 0)
    
    async def _check_liquidation_kill_switch(self, symbol: str, long_liq: float, short_liq: float):
        """Check for liquidation kill-switch condition"""
        try:
            # Get current institutional bias
            # This would integrate with your existing bias system
            # For now, we'll use a simple heuristic
            
            if long_liq > short_liq * 2:  # Heavy long liquidations
                self.kill_switch_active = True
                self.kill_switch_until = datetime.now() + timedelta(minutes=30)
                logger.warning(f"🚨 Kill-switch activated: Heavy long liquidations detected for {symbol}")
            elif short_liq > long_liq * 2:  # Heavy short liquidations  
                self.kill_switch_active = True
                self.kill_switch_until = datetime.now() + timedelta(minutes=30)
                logger.warning(f"🚨 Kill-switch activated: Heavy short liquidations detected for {symbol}")
            
        except Exception as e:
            logger.error(f"❌ Kill-switch check failed: {e}")
    
    async def run_confluence_analysis(self, symbol: str) -> ConfluenceResult:
        """Run full confluence analysis for symbol"""
        try:
            # Check kill-switch status
            if (self.kill_switch_until and 
                datetime.now() < self.kill_switch_until):
                self.kill_switch_active = True
            else:
                self.kill_switch_active = False
            
            # Run all layer analyses in parallel
            layer_tasks = [
                self.analyze_taker_ratio(symbol),
                self.analyze_funding_rate(symbol),
                self.analyze_liquidation(symbol),
                self.analyze_etf_flows("BTC")  # ETF is always BTC
            ]
            
            layer_results = await asyncio.gather(*layer_tasks)
            
            # Count signals by level
            watch_count = sum(1 for signal in layer_results if signal.level == "watch")
            action_count = sum(1 for signal in layer_results if signal.level == "action")
            
            # Apply confluence rules
            config = self.config['confluence']
            total_signals = watch_count + action_count
            
            # Determine overall level
            if (action_count >= 1 and total_signals >= config['action_min']):
                overall_level = "action"
            elif total_signals >= config['watch_min']:
                overall_level = "watch"
            else:
                overall_level = "none"
            
            # Override with kill-switch
            if self.kill_switch_active and overall_level in ["watch", "action"]:
                overall_level = "none"
                logger.warning(f"🚨 Kill-switch override: {symbol} signals suppressed")
            
            # Calculate confluence score (0-100)
            max_possible = len(layer_results) * 2  # 2 points per action signal
            actual_score = (watch_count * 1) + (action_count * 2)
            confluence_score = (actual_score / max_possible) * 100
            
            logger.info(f"🎯 Confluence {symbol}: {overall_level.upper()} (score: {confluence_score:.1f}%) - Watch: {watch_count}, Action: {action_count}")
            
            return ConfluenceResult(
                overall_level=overall_level,
                layers_triggered=[s for s in layer_results if s.level != "none"],
                confluence_score=confluence_score,
                kill_switch_active=self.kill_switch_active,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ Confluence analysis failed for {symbol}: {e}")
            return ConfluenceResult(
                overall_level="none",
                layers_triggered=[],
                confluence_score=0,
                kill_switch_active=self.kill_switch_active,
                timestamp=datetime.now()
            )

# Global engine instance
sniper_engine = None

def get_enhanced_sniper_engine() -> EnhancedSniperEngine:
    """Get singleton Enhanced Sniper Engine instance"""
    global sniper_engine
    if sniper_engine is None:
        sniper_engine = EnhancedSniperEngine()
    return sniper_engine
"""
SOL-Optimized Enhanced Sniper Engine
Overfitted config with percentile thresholds dan floor protection
"""
import json
import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass

from app.core.logging import logger
from app.core.coinglass_client import CoinglassClient
from app.core.enhanced_sniper_v2 import EnhancedSniperEngineV2, LayerSignal, ConfluenceResult, DataBuffer

class SOLOptimizedConfig:
    """SOL-specific overfitted configuration with percentile thresholds"""
    
    def __init__(self, config_path: str = "sol_overfitted_config.json"):
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        # Extract percentile-based thresholds
        self.funding = self.config['layers']['funding']
        self.taker = self.config['layers']['taker_ratio'] 
        self.oi = self.config['layers']['oi']
        self.liquidation = self.config['layers']['liquidation']
        self.etf = self.config['layers']['etf_flows']
        self.confluence = self.config['confluence']
        
        logger.info("🎯 SOL-Optimized config loaded with overfitted percentile thresholds")

class SOLEnhancedSniperEngine(EnhancedSniperEngineV2):
    """
    SOL-Optimized Enhanced Sniper Engine dengan overfitted thresholds
    
    Features:
    - Percentile-based thresholds (p85/p95/p99) dari real SOL data
    - Floor protection: max(percentile, floor) untuk robustness
    - SOL-specific confluence rules dan kill-switch logic
    """
    
    def __init__(self, config_path: str = "sol_overfitted_config.json"):
        # Initialize base engine
        super().__init__(config_path)
        
        # Load SOL-specific config
        self.sol_config = SOLOptimizedConfig(config_path)
        
        logger.info("🎯 SOL-Enhanced Sniper Engine initialized with overfitted thresholds")
    
    def _apply_threshold_with_floor(self, value: float, threshold: float, floor: float, is_upper: bool = True) -> bool:
        """Apply max(percentile, floor) or min(percentile, floor) logic"""
        if is_upper:
            effective_threshold = max(threshold, floor)
            return value >= effective_threshold
        else:
            effective_threshold = min(threshold, floor)
            return value <= effective_threshold
    
    async def analyze_funding_rate_sol(self, symbol: str = "SOL") -> LayerSignal:
        """SOL-optimized funding rate analysis dengan percentile thresholds"""
        try:
            # Get funding rate OHLC dari CoinGlass v4
            data = self.client.funding_rate(symbol, "1h")
            
            if not data or 'data' not in data or not data['data']:
                return LayerSignal("funding", "none", 0, 0, timestamp=datetime.now())
            
            latest = data['data'][0]
            funding_close = float(latest.get('close', 0))
            
            # Convert to bps per 8h (standardize)
            funding_bps_8h = abs(funding_close) * 10000  # Convert to absolute bps
            
            # SOL-specific thresholds dengan floor protection
            config = self.sol_config.funding
            watch_threshold = max(config['abs_bps_per_8h']['watch'], config['floors_bps_per_8h']['watch'])
            action_threshold = max(config['abs_bps_per_8h']['action'], config['floors_bps_per_8h']['action'])
            extreme_threshold = config['abs_bps_per_8h']['extreme']
            
            # Determine signal level
            if funding_bps_8h >= extreme_threshold:
                level = "action"
                threshold_used = extreme_threshold
                confidence = "extreme"
            elif funding_bps_8h >= action_threshold:
                level = "action"
                threshold_used = action_threshold
                confidence = "high"
            elif funding_bps_8h >= watch_threshold:
                level = "watch"
                threshold_used = watch_threshold
                confidence = "medium"
            else:
                level = "none"
                threshold_used = 0
                confidence = "low"
            
            logger.debug(f"💰 SOL Funding: {funding_bps_8h:.1f}bps → {level} ({confidence})")
            
            return LayerSignal(
                name="funding",
                level=level,
                value=funding_bps_8h,
                threshold_used=threshold_used,
                metadata={
                    "confidence": confidence,
                    "bps_8h": funding_bps_8h,
                    "watch_threshold": watch_threshold,
                    "action_threshold": action_threshold,
                    "method": "sol_overfitted"
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ SOL funding rate analysis failed: {e}")
            return LayerSignal("funding", "none", 0, 0, timestamp=datetime.now())
    
    async def analyze_taker_ratio_sol(self, symbol: str = "SOL") -> LayerSignal:
        """SOL-optimized taker ratio analysis dengan upper/lower percentile thresholds"""
        try:
            # Get taker buy/sell data
            data = self.client.taker_buysell_volume_aggregated(symbol, "1h")
            
            if not data or 'data' not in data or not data['data']:
                return LayerSignal("taker_ratio", "none", 0, 0, timestamp=datetime.now())
            
            latest = data['data'][0]
            buy_volume = float(latest.get('aggregated_buy_volume_usd', 0))
            sell_volume = float(latest.get('aggregated_sell_volume_usd', 1))
            
            # Calculate taker ratio
            taker_ratio = buy_volume / max(1, sell_volume)
            
            # SOL-specific thresholds
            config = self.sol_config.taker
            
            # Upper thresholds (bullish)
            if taker_ratio >= config['hi']['extreme']:
                level = "action"
                threshold_used = config['hi']['extreme']
                direction = "bullish_extreme"
            elif taker_ratio >= config['hi']['action']:
                level = "action"
                threshold_used = config['hi']['action']
                direction = "bullish_strong"
            elif taker_ratio >= config['hi']['watch']:
                level = "watch"
                threshold_used = config['hi']['watch']
                direction = "bullish"
            # Lower thresholds (bearish)
            elif taker_ratio <= config['lo']['extreme']:
                level = "action"
                threshold_used = config['lo']['extreme']
                direction = "bearish_extreme"
            elif taker_ratio <= config['lo']['action']:
                level = "action"
                threshold_used = config['lo']['action']
                direction = "bearish_strong"
            elif taker_ratio <= config['lo']['watch']:
                level = "watch"
                threshold_used = config['lo']['watch']
                direction = "bearish"
            else:
                level = "none"
                threshold_used = 1.0
                direction = "neutral"
            
            logger.debug(f"📊 SOL Taker Ratio: {taker_ratio:.3f} → {level} ({direction})")
            
            return LayerSignal(
                name="taker_ratio",
                level=level,
                value=taker_ratio,
                threshold_used=threshold_used,
                metadata={
                    "direction": direction,
                    "buy_volume_usd": buy_volume,
                    "sell_volume_usd": sell_volume,
                    "method": "sol_overfitted"
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ SOL taker ratio analysis failed: {e}")
            return LayerSignal("taker_ratio", "none", 0, 0, timestamp=datetime.now())
    
    async def analyze_liquidation_sol(self, symbol: str = "SOL") -> LayerSignal:
        """SOL-optimized liquidation analysis dengan percentile thresholds"""
        try:
            # Get liquidation coin aggregated data
            data = self.client.liquidation_coin_history(symbol, "1h")
            
            if not data or 'data' not in data or not data['data']:
                return LayerSignal("liquidation", "none", 0, 0, timestamp=datetime.now())
            
            latest = data['data'][0]
            long_liq = float(latest.get('aggregated_long_liquidation_usd', 0))
            short_liq = float(latest.get('aggregated_short_liquidation_usd', 0))
            total_liq = long_liq + short_liq
            
            # SOL-specific thresholds
            config = self.sol_config.liquidation
            
            if total_liq >= config['coin_agg_usd']['extreme']:
                level = "action"
                threshold_used = config['coin_agg_usd']['extreme']
                intensity = "extreme"
            elif total_liq >= config['coin_agg_usd']['action']:
                level = "action"
                threshold_used = config['coin_agg_usd']['action']
                intensity = "high"
            elif total_liq >= config['coin_agg_usd']['watch']:
                level = "watch"
                threshold_used = config['coin_agg_usd']['watch']
                intensity = "medium"
            else:
                level = "none"
                threshold_used = 0
                intensity = "low"
            
            # Check for kill-switch condition
            await self._check_liquidation_kill_switch(symbol, long_liq, short_liq)
            
            # Determine liquidation bias
            if long_liq > short_liq * 1.5:
                bias = "bearish_pressure"  # Long liquidations = bearish
            elif short_liq > long_liq * 1.5:
                bias = "bullish_pressure"  # Short liquidations = bullish
            else:
                bias = "balanced"
            
            logger.debug(f"🔥 SOL Liquidation: ${total_liq:,.0f} → {level} ({intensity}, {bias})")
            
            return LayerSignal(
                name="liquidation",
                level=level,
                value=total_liq,
                threshold_used=threshold_used,
                metadata={
                    "intensity": intensity,
                    "bias": bias,
                    "long_liquidation_usd": long_liq,
                    "short_liquidation_usd": short_liq,
                    "method": "sol_overfitted"
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ SOL liquidation analysis failed: {e}")
            return LayerSignal("liquidation", "none", 0, 0, timestamp=datetime.now())
    
    async def analyze_etf_flows_sol(self, symbol: str = "BTC") -> LayerSignal:
        """SOL-optimized ETF flows analysis (BTC impact pada SOL)"""
        try:
            # Get ETF flow-history data
            data = self.client.etf_bitcoin_flows()
            
            if not data or 'data' not in data or not data['data']:
                return LayerSignal("etf_flows", "none", 0, 0, timestamp=datetime.now())
            
            latest = data['data'][0]
            flow_usd = float(latest.get('flow_usd', 0))
            abs_flow = abs(flow_usd)
            
            # SOL-specific thresholds
            config = self.sol_config.etf
            
            if abs_flow >= config['abs_usd']['extreme']:
                level = "action"
                threshold_used = config['abs_usd']['extreme']
                magnitude = "extreme"
            elif abs_flow >= config['abs_usd']['action']:
                level = "action"
                threshold_used = config['abs_usd']['action']
                magnitude = "high"
            elif abs_flow >= config['abs_usd']['watch']:
                level = "watch"
                threshold_used = config['abs_usd']['watch']
                magnitude = "medium"
            else:
                level = "none"
                threshold_used = 0
                magnitude = "low"
            
            # Determine flow direction impact
            flow_direction = "inflow" if flow_usd > 0 else "outflow"
            sol_impact = "bullish" if flow_usd > 0 else "bearish"
            
            logger.debug(f"🏦 ETF→SOL Impact: ${abs_flow:,.0f} {flow_direction} → {level} ({magnitude}, {sol_impact})")
            
            return LayerSignal(
                name="etf_flows",
                level=level,
                value=abs_flow,
                threshold_used=threshold_used,
                metadata={
                    "magnitude": magnitude,
                    "flow_direction": flow_direction,
                    "sol_impact": sol_impact,
                    "flow_usd": flow_usd,
                    "method": "sol_overfitted"
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ SOL ETF flows analysis failed: {e}")
            return LayerSignal("etf_flows", "none", 0, 0, timestamp=datetime.now())
    
    async def run_sol_confluence_analysis(self, symbol: str = "SOL") -> ConfluenceResult:
        """Run SOL-optimized confluence analysis dengan overfitted thresholds"""
        try:
            start_time = datetime.now()
            
            # Check kill-switch status
            if (self.kill_switch_until and datetime.now() < self.kill_switch_until):
                self.kill_switch_active = True
            else:
                self.kill_switch_active = False
            
            # Run SOL-optimized layer analyses
            layer_tasks = [
                self.analyze_institutional_bias(symbol),  # Base implementation
                self.analyze_funding_rate_sol(symbol),
                self.analyze_taker_ratio_sol(symbol), 
                self.analyze_liquidation_sol(symbol),
                self.analyze_etf_flows_sol("BTC")
            ]
            
            layer_results = await asyncio.gather(*layer_tasks)
            
            # SOL-specific confluence rules
            confluence_config = self.sol_config.confluence
            triggered_layers = [s for s in layer_results if s.level != "none"]
            watch_count = sum(1 for s in triggered_layers if s.level == "watch")
            action_count = sum(1 for s in triggered_layers if s.level == "action")
            
            # Apply SOL confluence logic
            total_signals = watch_count + action_count
            
            if (action_count >= 1 and total_signals >= confluence_config['action_min']):
                overall_level = "action"
            elif total_signals >= confluence_config['watch_min']:
                overall_level = "watch"
            else:
                overall_level = "none"
            
            # Kill-switch override
            if self.kill_switch_active and overall_level in ["watch", "action"]:
                overall_level = "none"
                logger.warning(f"🚨 SOL Kill-switch override: signals suppressed")
            
            # Calculate SOL confluence score (weighted by signal quality)
            max_possible = len(layer_results) * 2
            actual_score = (watch_count * 1) + (action_count * 2)
            confluence_score = (actual_score / max_possible) * 100
            
            # Performance tracking
            analysis_time = (datetime.now() - start_time).total_seconds()
            
            logger.info(f"🎯 SOL Confluence: {overall_level.upper()} (score: {confluence_score:.1f}%, {analysis_time:.3f}s) - Watch: {watch_count}, Action: {action_count}")
            
            return ConfluenceResult(
                overall_level=overall_level,
                layers_triggered=triggered_layers,
                confluence_score=confluence_score,
                kill_switch_active=self.kill_switch_active,
                metadata={
                    "analysis_time_seconds": analysis_time,
                    "watch_count": watch_count,
                    "action_count": action_count,
                    "config_type": "sol_overfitted",
                    "percentile_based": True
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ SOL confluence analysis failed: {e}")
            return ConfluenceResult(
                overall_level="none",
                layers_triggered=[],
                confluence_score=0,
                kill_switch_active=self.kill_switch_active,
                metadata={"error": str(e), "config_type": "sol_overfitted"},
                timestamp=datetime.now()
            )

# Global SOL-optimized engine instance
sol_sniper_engine = None

def get_sol_enhanced_sniper_engine() -> SOLEnhancedSniperEngine:
    """Get singleton SOL-Enhanced Sniper Engine instance"""
    global sol_sniper_engine
    if sol_sniper_engine is None:
        sol_sniper_engine = SOLEnhancedSniperEngine()
    return sol_sniper_engine
"""
Sniper Timing (5m) Engine - Institutional-grade LONG/SHORT signals
Based on CoinGlass v4 aggregated taker volume + funding + OI + orderbook
"""

import time
from typing import Dict, List, Optional
from .coinglass_client import CoinglassClient


class SniperTimingEngine:
    """5-minute institutional flow analysis for precise entry signals"""
    
    def __init__(self):
        self.client = CoinglassClient()
        
    def calculate_taker_dominance(self, taker_data: List[Dict]) -> float:
        """Calculate TakerDominance = buy_usd / (buy_usd + sell_usd) - Works with pair-level data"""
        if not taker_data:
            return 0.5
            
        latest = taker_data[-1]
        # Handle both aggregated and pair-level taker data formats
        buy_vol = float(latest.get('taker_buy_volume_usd', latest.get('aggregated_buy_volume_usd', 0)))
        sell_vol = float(latest.get('taker_sell_volume_usd', latest.get('aggregated_sell_volume_usd', 0)))
        
        total_vol = buy_vol + sell_vol
        if total_vol == 0:
            return 0.5
            
        return buy_vol / total_vol
    
    def calculate_oi_delta(self, oi_data: List[Dict]) -> float:
        """Calculate OI_Delta = OI_close - OI_open (H1)"""
        if len(oi_data) < 2:
            return 0
            
        latest = oi_data[-1]
        previous = oi_data[-2]
        
        oi_close = float(latest.get('open_interest', 0))
        oi_open = float(previous.get('open_interest', 0))
        
        return oi_close - oi_open
    
    def calculate_ob_imbalance(self, orderbook_data: List[Dict]) -> float:
        """Calculate OB_Imbalance = bids_usd / (bids_usd + asks_usd)"""
        if not orderbook_data:
            return 0.5
            
        latest = orderbook_data[-1]
        bids_usd = float(latest.get('bids_usd', 0))
        asks_usd = float(latest.get('asks_usd', 0))
        
        total_liquidity = bids_usd + asks_usd
        if total_liquidity == 0:
            return 0.5
            
        return bids_usd / total_liquidity
    
    def get_funding_bias(self, funding_data: List[Dict]) -> str:
        """Analyze funding rate bias: neutral, positive, high_positive"""
        if not funding_data:
            return "neutral"
            
        latest = funding_data[-1]
        funding_rate = float(latest.get('funding_rate', 0))
        
        if funding_rate > 0.01:  # >1% (very crowded longs)
            return "high_positive"
        elif funding_rate > 0.005:  # >0.5% (positive)
            return "positive"
        elif funding_rate < -0.005:  # <-0.5% (negative)
            return "negative"
        else:
            return "neutral"
    
    def analyze_sniper_signals(self, coin: str, exchange: str = "Binance") -> Dict:
        """
        Comprehensive 5-minute sniper analysis using WORKING endpoints only
        Returns LONG/SHORT/NEUTRAL signals with confidence scores
        """
        try:
            # Use CONFIRMED WORKING endpoints only
            taker_data = self.client.taker_buysell_volume(coin, exchange, "1h")  # Working: $124M+ data
            funding_data = self.client.funding_rate(f"{coin}USDT", "1h", exchange)  # Working method
            orderbook_data = self.client.futures_orderbook_askbids_history(f"{coin}USDT", exchange)  # Working: $M liquidity
            
            # Extract data arrays (handle both direct data and nested structures)
            taker_array = taker_data.get('data', []) if isinstance(taker_data, dict) else []
            funding_array = funding_data.get('data', []) if isinstance(funding_data, dict) else []
            orderbook_array = orderbook_data.get('data', []) if isinstance(orderbook_data, dict) else []
            
            # Calculate key metrics (simplified for working endpoints)
            taker_dominance = self.calculate_taker_dominance(taker_array)
            ob_imbalance = self.calculate_ob_imbalance(orderbook_array)
            funding_bias = self.get_funding_bias(funding_array)
            
            # LONG Signal Logic (simplified for working data)
            long_score = 0
            long_conditions = []
            
            if taker_dominance > 0.55:
                long_score += 4
                long_conditions.append(f"Strong buyer dominance: {taker_dominance:.3f}")
                
            if funding_bias in ["neutral", "positive"]:
                long_score += 2
                long_conditions.append(f"Funding not overcrowded: {funding_bias}")
                
            if ob_imbalance > 0.52:
                long_score += 3
                long_conditions.append(f"Orderbook bid-heavy: {ob_imbalance:.3f}")
            
            # SHORT Signal Logic (simplified for working data)
            short_score = 0
            short_conditions = []
            
            if taker_dominance < 0.45:
                short_score += 4
                short_conditions.append(f"Strong seller dominance: {taker_dominance:.3f}")
                
            if funding_bias == "high_positive":
                short_score += 3
                short_conditions.append(f"Overcrowded longs: {funding_bias}")
                
            if ob_imbalance < 0.48:
                short_score += 3
                short_conditions.append(f"Orderbook ask-heavy: {ob_imbalance:.3f}")
            
            # Determine signal (adjusted thresholds for working endpoints)
            if long_score >= 5:
                signal = "LONG"
                confidence = min(long_score / 9 * 100, 95)
                conditions = long_conditions
            elif short_score >= 5:
                signal = "SHORT" 
                confidence = min(short_score / 9 * 100, 95)
                conditions = short_conditions
            else:
                signal = "NEUTRAL"
                confidence = max(long_score, short_score) / 9 * 100
                conditions = ["No clear institutional bias detected"]
            
            return {
                "coin": coin,
                "signal": signal,
                "confidence": confidence,
                "conditions": conditions,
                "metrics": {
                    "taker_dominance": taker_dominance,
                    "ob_imbalance": ob_imbalance,
                    "funding_bias": funding_bias,
                    "long_score": long_score,
                    "short_score": short_score
                },
                "timestamp": int(time.time() * 1000),
                "data_quality": {
                    "taker_points": len(taker_array),
                    "funding_points": len(funding_array),
                    "orderbook_points": len(orderbook_array),
                    "working_endpoints": ["taker_volume", "funding_rate", "orderbook"]
                }
            }
            
        except Exception as e:
            return {
                "coin": coin,
                "signal": "ERROR",
                "error": str(e),
                "timestamp": int(time.time() * 1000)
            }
    
    def multi_coin_scan(self, coins: List[str] = ["BTC", "ETH", "SOL"]) -> List[Dict]:
        """Scan multiple coins for sniper signals simultaneously"""
        results = []
        
        for coin in coins:
            # Simplified: skip pre-validation, just try the analysis
            signal_result = self.analyze_sniper_signals(coin)
            results.append(signal_result)
        
        # Sort by confidence (highest first)
        valid_signals = [r for r in results if r.get('confidence', 0) > 0 and r.get('signal') != 'ERROR']
        valid_signals.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        
        return valid_signals + [r for r in results if r.get('confidence', 0) == 0 or r.get('signal') == 'ERROR']
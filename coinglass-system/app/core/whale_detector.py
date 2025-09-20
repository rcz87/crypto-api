#!/usr/bin/env python3
"""
Whale Accumulation/Distribution Detection Engine
Real-time crypto whale monitoring untuk Enhanced Sniper Engine V2
"""

import asyncio
import json
import time
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import logging

from .coinglass_async_client import get_async_client
from .telegram_http import get_telegram_client
from .alert_dedup import is_duplicate_alert

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class WhaleSignal:
    """Whale accumulation/distribution signal"""
    coin: str
    signal_type: str  # 'accumulation' or 'distribution'
    confidence: str   # 'watch' or 'action'
    taker_ratio: float
    oi_roc: float
    funding_bps: Optional[float] = None
    liquidation_spike: Optional[float] = None
    timestamp: Optional[datetime] = None
    message: str = ""
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class MarketData:
    """Market data untuk whale analysis"""
    taker_buy_usd: float
    taker_sell_usd: float
    oi_current: float
    oi_previous: float
    price_current: float
    price_previous: float
    funding_rate: Optional[float] = None
    liquidation_volume: Optional[float] = None

class WhaleDetectionEngine:
    """Core whale detection engine dengan real-time monitoring"""
    
    def __init__(self):
        self.client = None  # Will be set async in get_client()
        self.telegram = get_telegram_client()
        self.last_alerts = {}  # Anti-spam tracking
        self.alert_cooldown = 300  # 5 minutes deduplication
        
        # Detection thresholds (from documentation)
        self.thresholds = {
            'accumulation': {
                'taker_ratio_min': 1.6,
                'oi_roc_min': 0.02,  # +2%
                'action_threshold': 1.8  # Higher confidence
            },
            'distribution': {
                'taker_ratio_max': 0.6,
                'oi_roc_max': -0.02,  # -2%
                'action_threshold': 0.5  # Lower confidence
            },
            'funding': {
                'extreme_bps': 100,  # 100 bps = 1%
                'high_bps': 50       # 50 bps = 0.5%
            }
        }
        
        logger.info("🐋 Whale Detection Engine initialized")
    
    def calculate_taker_ratio(self, buy_usd: float, sell_usd: float) -> float:
        """Calculate taker buy/sell ratio dengan protection"""
        if buy_usd + sell_usd == 0:
            return 1.0  # Neutral
        return buy_usd / max(sell_usd, 1.0)  # Avoid division by zero
    
    def calculate_oi_roc(self, current: float, previous: float) -> float:
        """Calculate Open Interest Rate of Change"""
        if previous == 0:
            return 0.0
        return (current - previous) / previous
    
    def calculate_funding_bps(self, funding_rate: float, interval_hours: float = 8.0) -> float:
        """Convert funding rate to basis points per 8h (PRESERVE SIGN for contrarian analysis)"""
        if funding_rate is None:
            return 0.0
        # Normalize to 8h and convert to bps (keep sign for contrarian signals)
        normalized = funding_rate * (8.0 / interval_hours)
        return normalized * 10000  # Convert to basis points, preserve sign
    
    async def get_client(self):
        """Get async client instance"""
        if self.client is None:
            self.client = await get_async_client()
        return self.client
    
    async def fetch_market_data(self, coin: str) -> Optional[MarketData]:
        """Fetch real-time market data dari CoinGlass v4 dengan correct async calls"""
        try:
            client = await self.get_client()
            
            # Use proper batch fetch method
            batch_data = await client.batch_fetch_whale_data(coin)
            if not batch_data:
                return None
            
            taker_data = batch_data.get('taker_data')
            oi_data = batch_data.get('oi_data')
            funding_data = batch_data.get('funding_data')
            liq_data = batch_data.get('liquidation_data')
            
            # Validate critical data
            if not taker_data or not oi_data:
                logger.error(f"❌ Critical data fetch failed for {coin}")
                return None
            
            # Extract taker data
            if 'data' not in taker_data or not taker_data['data']:
                return None
                
            latest_taker = taker_data['data'][0]
            taker_buy = float(latest_taker.get('taker_buy_volume_usd', 0))
            taker_sell = float(latest_taker.get('taker_sell_volume_usd', 0))
            
            # Extract OI data
            if 'data' not in oi_data or len(oi_data['data']) < 2:
                return None
                
            current_oi = float(oi_data['data'][0].get('open_interest', 0))
            previous_oi = float(oi_data['data'][1].get('open_interest', 0))
            
            # Price data (from OI endpoint)
            current_price = float(oi_data['data'][0].get('close', 0))
            previous_price = float(oi_data['data'][1].get('close', 0))
            
            # Optional data
            funding_rate = None
            if funding_data and 'data' in funding_data and funding_data['data']:
                funding_rate = float(funding_data['data'][0].get('close', 0))
            
            liquidation_vol = None
            if liq_data and 'data' in liq_data and liq_data['data']:
                liquidation_vol = float(liq_data['data'][0].get('quantity', 0))
            
            return MarketData(
                taker_buy_usd=taker_buy,
                taker_sell_usd=taker_sell,
                oi_current=current_oi,
                oi_previous=previous_oi,
                price_current=current_price,
                price_previous=previous_price,
                funding_rate=funding_rate,
                liquidation_volume=liquidation_vol
            )
            
        except Exception as e:
            logger.error(f"❌ Error fetching market data for {coin}: {e}")
            return None
    
    
    def detect_whale_signal(self, coin: str, data: MarketData) -> Optional[WhaleSignal]:
        """Core whale detection logic"""
        
        # Calculate metrics
        taker_ratio = self.calculate_taker_ratio(data.taker_buy_usd, data.taker_sell_usd)
        oi_roc = self.calculate_oi_roc(data.oi_current, data.oi_previous)
        price_change = (data.price_current - data.price_previous) / data.price_previous if data.price_previous > 0 else 0
        
        # Optional metrics
        funding_bps = self.calculate_funding_bps(data.funding_rate) if data.funding_rate else None
        
        # ACCUMULATION DETECTION
        if (taker_ratio >= self.thresholds['accumulation']['taker_ratio_min'] and 
            oi_roc >= self.thresholds['accumulation']['oi_roc_min']):
            
            # Determine confidence level
            confidence = 'action' if taker_ratio >= self.thresholds['accumulation']['action_threshold'] else 'watch'
            
            # Enhanced conditions untuk higher confidence
            enhanced_conditions = []
            if funding_bps and funding_bps < 0:  # Negative funding (contrarian) - FIXED
                enhanced_conditions.append("negative funding")
            if price_change > 0.02:  # Price rising with accumulation
                enhanced_conditions.append("price momentum")
                
            message = f"🟢 Whale Accumulation | {coin} | Taker {taker_ratio:.2f} | OI +{oi_roc*100:.1f}%"
            if enhanced_conditions:
                message += f" | Enhanced: {', '.join(enhanced_conditions)}"
            
            return WhaleSignal(
                coin=coin,
                signal_type='accumulation',
                confidence=confidence,
                taker_ratio=taker_ratio,
                oi_roc=oi_roc,
                funding_bps=funding_bps,
                message=message
            )
        
        # DISTRIBUTION DETECTION
        elif (taker_ratio <= self.thresholds['distribution']['taker_ratio_max'] and 
              (oi_roc <= self.thresholds['distribution']['oi_roc_max'] or 
               (price_change < 0 and oi_roc > 0))):  # Short building
            
            # Determine confidence level
            confidence = 'action' if taker_ratio <= self.thresholds['distribution']['action_threshold'] else 'watch'
            
            # Enhanced conditions
            enhanced_conditions = []
            if funding_bps and abs(funding_bps) >= self.thresholds['funding']['high_bps']:
                enhanced_conditions.append("high funding pressure")
            if price_change < -0.02 and oi_roc > 0:
                enhanced_conditions.append("short building")
                
            message = f"🔴 Whale Distribution | {coin} | Taker {taker_ratio:.2f} | OI {oi_roc*100:+.1f}%"
            if enhanced_conditions:
                message += f" | Risk: {', '.join(enhanced_conditions)}"
            
            return WhaleSignal(
                coin=coin,
                signal_type='distribution',
                confidence=confidence,
                taker_ratio=taker_ratio,
                oi_roc=oi_roc,
                funding_bps=funding_bps,
                message=message
            )
        
        return None
    
    def should_send_alert(self, signal: WhaleSignal) -> bool:
        """Anti-spam filter untuk alerts"""
        alert_key = f"{signal.coin}_{signal.signal_type}"
        current_time = time.time()
        
        # Check if we sent similar alert recently
        if alert_key in self.last_alerts:
            if current_time - self.last_alerts[alert_key] < self.alert_cooldown:
                return False
        
        # Update last alert time
        self.last_alerts[alert_key] = current_time
        return True
    
    async def send_whale_alert(self, signal: WhaleSignal) -> bool:
        """Send formatted whale alert ke Telegram dengan 5-minute deduplication"""
        try:
            # Check for duplicate alerts (5-minute deduplication)
            if is_duplicate_alert(signal.coin, signal.signal_type, interval="1h"):
                logger.info(f"🔁 Duplicate alert skipped: {signal.coin} {signal.signal_type} (5min dedup)")
                return True  # Return True to indicate "handled" (even though skipped)
            
            # Format alert message
            emoji = "🟢" if signal.signal_type == "accumulation" else "🔴"
            confidence_emoji = "🎯" if signal.confidence == "action" else "👀"
            
            alert_text = f"{emoji} {confidence_emoji} WHALE {signal.signal_type.upper()}\n"
            alert_text += f"**{signal.coin}** (1h)\n\n"
            alert_text += f"• Taker Ratio: {signal.taker_ratio:.2f}\n"
            alert_text += f"• OI ROC: {signal.oi_roc*100:+.1f}%\n"
            
            if signal.funding_bps:
                alert_text += f"• Funding: {signal.funding_bps:.1f} bps/8h\n"
            
            alert_text += f"• Confidence: {signal.confidence.upper()}\n"
            alert_text += f"• Time: {signal.timestamp.strftime('%H:%M:%S') if signal.timestamp else 'N/A'}\n\n"
            
            if signal.confidence == "action":
                action_text = "Siapkan entry plan" if signal.signal_type == "accumulation" else "Kurangi eksposur"
                alert_text += f"💡 **Action**: {action_text}"
            else:
                alert_text += f"👁️ **Watch**: Monitor validasi di bar berikutnya"
            
            # Send to Telegram
            result = await self.telegram.send_message(alert_text)
            
            if result and result.get('message_id'):
                logger.info(f"✅ Whale alert sent: {signal.coin} {signal.signal_type} - message_id: {result['message_id']}")
                return True
            else:
                logger.error(f"❌ Failed to send whale alert: {signal.coin}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error sending whale alert: {e}")
            return False
    
    async def scan_single_coin(self, coin: str) -> Optional[WhaleSignal]:
        """Scan single coin untuk whale activity"""
        try:
            # Fetch market data
            data = await self.fetch_market_data(coin)
            if not data:
                return None
            
            # Detect whale signal
            signal = self.detect_whale_signal(coin, data)
            if not signal:
                return None
            
            # Check anti-spam filter
            if not self.should_send_alert(signal):
                logger.debug(f"🔇 Whale alert skipped (cooldown): {coin} {signal.signal_type}")
                return signal  # Return signal but don't send
            
            # Send alert
            await self.send_whale_alert(signal)
            return signal
            
        except Exception as e:
            logger.error(f"❌ Error scanning {coin}: {e}")
            return None
    
    async def scan_multiple_coins(self, coins: List[str], max_concurrent: int = 5) -> List[WhaleSignal]:
        """Scan multiple coins concurrently"""
        logger.info(f"🔍 Scanning {len(coins)} coins for whale activity...")
        
        signals = []
        
        # Process coins in batches to avoid rate limiting
        for i in range(0, len(coins), max_concurrent):
            batch = coins[i:i + max_concurrent]
            
            # Scan batch concurrently
            tasks = [self.scan_single_coin(coin) for coin in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Collect valid signals
            for result in batch_results:
                if isinstance(result, WhaleSignal):
                    signals.append(result)
                elif isinstance(result, Exception):
                    logger.debug(f"Batch scan error: {result}")
            
            # Rate limiting between batches
            if i + max_concurrent < len(coins):
                await asyncio.sleep(1)
        
        logger.info(f"✅ Whale scan complete: {len(signals)} signals detected")
        return signals
    
    def get_detection_stats(self) -> Dict:
        """Get detection statistics"""
        return {
            'alert_cooldown_seconds': self.alert_cooldown,
            'active_cooldowns': len(self.last_alerts),
            'thresholds': self.thresholds,
            'last_scan': datetime.now().isoformat()
        }

# Singleton instance
whale_detector = None

def get_whale_detector() -> WhaleDetectionEngine:
    """Get singleton whale detector instance"""
    global whale_detector
    if whale_detector is None:
        whale_detector = WhaleDetectionEngine()
    return whale_detector
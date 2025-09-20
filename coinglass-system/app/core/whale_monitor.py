#!/usr/bin/env python3
"""
Whale Monitoring Scheduler
Continuous monitoring sistem untuk whale accumulation/distribution
"""

import asyncio
import json
import signal
import sys
from typing import List, Dict, Optional
from datetime import datetime
import logging

from .whale_detector import get_whale_detector, WhaleSignal
from .telegram_http import get_telegram_client
from .alert_dedup import is_duplicate_status

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WhaleMonitor:
    """Continuous whale monitoring service"""
    
    def __init__(self, scan_interval: int = 300):  # 5 minutes default
        self.detector = get_whale_detector()
        self.telegram = get_telegram_client()
        self.scan_interval = scan_interval
        self.running = False
        self.scan_count = 0
        self.total_signals = 0
        
        # Load validated coin list
        self.load_validated_coins()
        
        # Setup graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        logger.info(f"🐋 Whale Monitor initialized - {len(self.coins)} coins, {scan_interval}s interval")
    
    def load_validated_coins(self):
        """Load validated coin list dari validated_coin_list.json"""
        try:
            with open('validated_coin_list.json', 'r') as f:
                data = json.load(f)
            
            # Use Tier 1 + selected Tier 2 coins untuk monitoring
            tier_1 = data.get('tier_1_production_ready', {}).get('coins', [])
            tier_2 = data.get('tier_2_mostly_ready', {}).get('coins', [])
            
            # Extended coverage: All Tier 1 + All Tier 2 (full validated coverage)
            self.coins = tier_1 + tier_2
            
            logger.info(f"📋 Loaded {len(self.coins)} validated coins for monitoring")
            
        except Exception as e:
            logger.warning(f"⚠️ Could not load validated coins, using default: {e}")
            # Fallback to major coins
            self.coins = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'LINK']
    
    def _signal_handler(self, signum, frame):
        """Handle graceful shutdown"""
        logger.info(f"📶 Received signal {signum}, shutting down gracefully...")
        self.running = False
    
    async def send_monitor_status(self, message: str, is_error: bool = False, status_type: str = "general"):
        """Send monitoring status ke Telegram dengan deduplication"""
        try:
            # Check for duplicate status messages
            if is_duplicate_status(status_type):
                logger.debug(f"🔁 Status '{status_type}' already sent recently (skipped)")
                return
                
            await self.telegram.send_monitor_status(message, is_error)
        except Exception as e:
            logger.error(f"Failed to send status update: {e}")
    
    async def run_single_scan(self) -> List[WhaleSignal]:
        """Run single scan cycle"""
        try:
            start_time = datetime.now()
            
            # Scan all coins
            signals = await self.detector.scan_multiple_coins(self.coins)
            
            # Update statistics
            self.scan_count += 1
            self.total_signals += len(signals)
            
            # Log scan results
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"🔍 Scan #{self.scan_count} complete: {len(signals)} signals in {duration:.1f}s")
            
            # Send periodic status (every 10 scans)
            if self.scan_count % 10 == 0:
                avg_signals = self.total_signals / self.scan_count
                status = f"Scan #{self.scan_count}: {len(signals)} signals found\\n"
                status += f"Average: {avg_signals:.1f} signals/scan\\n"
                status += f"Monitoring: {len(self.coins)} coins\\n"
                status += f"Duration: {duration:.1f}s"
                await self.send_monitor_status(status)
            
            return signals
            
        except Exception as e:
            logger.error(f"❌ Scan error: {e}")
            await self.send_monitor_status(f"Scan error: {str(e)}", is_error=True)
            return []
    
    async def start_monitoring(self):
        """Start continuous monitoring"""
        self.running = True
        logger.info(f"🚀 Starting whale monitoring - scanning every {self.scan_interval}s")
        
        # Send startup notification
        startup_msg = f"🐋 **Whale Monitor Started**\\n"
        startup_msg += f"• Coins: {len(self.coins)}\\n"
        startup_msg += f"• Interval: {self.scan_interval}s\\n"
        startup_msg += f"• Mode: Production monitoring"
        await self.send_monitor_status(startup_msg, status_type="started")
        
        try:
            while self.running:
                # Run scan
                await self.run_single_scan()
                
                # Wait for next interval
                if self.running:  # Check if still running after scan
                    await asyncio.sleep(self.scan_interval)
                    
        except Exception as e:
            logger.error(f"❌ Monitoring error: {e}")
            await self.send_monitor_status(f"Critical error: {str(e)}", is_error=True)
        finally:
            # Send shutdown notification
            shutdown_msg = f"🛑 **Whale Monitor Stopped**\\n"
            shutdown_msg += f"• Total scans: {self.scan_count}\\n"
            shutdown_msg += f"• Total signals: {self.total_signals}\\n"
            shutdown_msg += f"• Uptime: {datetime.now().strftime('%H:%M:%S')}"
            await self.send_monitor_status(shutdown_msg, status_type="stopped")
            
            logger.info("🛑 Whale monitoring stopped")
    
    async def test_detection(self, test_coins: Optional[List[str]] = None) -> Dict:
        """Test whale detection untuk specific coins"""
        if test_coins is None:
            test_coins = ['BTC', 'ETH', 'SOL']
        
        logger.info(f"🧪 Testing whale detection for: {test_coins}")
        
        results = {}
        for coin in test_coins:
            try:
                signal = await self.detector.scan_single_coin(coin)
                results[coin] = {
                    'signal_detected': signal is not None,
                    'signal_type': signal.signal_type if signal else None,
                    'confidence': signal.confidence if signal else None,
                    'taker_ratio': signal.taker_ratio if signal else None,
                    'oi_roc': signal.oi_roc if signal else None
                }
                
                status = "✅ SIGNAL" if signal else "⚪ NORMAL"
                logger.info(f"  {coin}: {status}")
                
            except Exception as e:
                results[coin] = {'error': str(e)}
                logger.error(f"  {coin}: ❌ ERROR - {e}")
        
        return results
    
    def get_status(self) -> Dict:
        """Get current monitoring status"""
        return {
            'running': self.running,
            'scan_count': self.scan_count,
            'total_signals': self.total_signals,
            'coins_monitored': len(self.coins),
            'scan_interval': self.scan_interval,
            'avg_signals_per_scan': self.total_signals / max(1, self.scan_count),
            'detector_stats': self.detector.get_detection_stats()
        }

# CLI interface untuk testing
async def main():
    """Main CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Whale Detection Monitor')
    parser.add_argument('--mode', choices=['monitor', 'test'], default='test',
                        help='Run mode: monitor (continuous) or test (single scan)')
    parser.add_argument('--interval', type=int, default=300,
                        help='Scan interval in seconds (default: 300)')
    parser.add_argument('--coins', nargs='+', default=['BTC', 'ETH', 'SOL'],
                        help='Coins to test (test mode only)')
    
    args = parser.parse_args()
    
    monitor = WhaleMonitor(scan_interval=args.interval)
    
    if args.mode == 'monitor':
        logger.info("🚀 Starting continuous monitoring mode...")
        await monitor.start_monitoring()
    else:
        logger.info("🧪 Running test mode...")
        results = await monitor.test_detection(args.coins)
        print("\n📊 Test Results:")
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
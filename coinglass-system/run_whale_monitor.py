#!/usr/bin/env python3
"""
Whale Monitor CLI
Run whale accumulation/distribution monitoring untuk Enhanced Sniper Engine V2
"""

import asyncio
import argparse
import sys
import os
from datetime import datetime

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.whale_monitor import WhaleMonitor
from app.core.telegram_http import get_telegram_client

async def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description='Enhanced Sniper Engine V2 - Whale Monitor')
    parser.add_argument('--mode', choices=['monitor', 'test', 'status'], default='test',
                        help='Run mode: monitor (continuous), test (single scan), status (system check)')
    parser.add_argument('--interval', type=int, default=300,
                        help='Scan interval in seconds (default: 300 = 5 minutes)')
    parser.add_argument('--coins', nargs='+', default=['BTC', 'ETH', 'SOL'],
                        help='Coins to test/monitor')
    parser.add_argument('--ws', action='store_true',
                        help='Enable WebSocket monitoring (future feature)')
    parser.add_argument('--telegram-test', action='store_true',
                        help='Test Telegram connection')
    
    args = parser.parse_args()
    
    print("🐋 Enhanced Sniper Engine V2 - Whale Detection System")
    print("=" * 60)
    print(f"⏰ Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🎯 Mode: {args.mode}")
    
    # Check environment
    api_key = os.getenv('COINGLASS_API_KEY')
    telegram_token = os.getenv('TELEGRAM_BOT_TOKEN')
    telegram_chat = os.getenv('TELEGRAM_CHAT_ID')
    
    print(f"🔑 CoinGlass API: {'✅ SET' if api_key else '❌ MISSING'}")
    print(f"📱 Telegram Bot: {'✅ SET' if telegram_token else '❌ MISSING'}")
    print(f"💬 Telegram Chat: {'✅ SET' if telegram_chat else '❌ MISSING'}")
    
    if not api_key:
        print("❌ COINGLASS_API_KEY environment variable required")
        return 1
    
    # Test Telegram if requested
    if args.telegram_test:
        print("\n📡 Testing Telegram connection...")
        telegram = get_telegram_client()
        if telegram.is_configured():
            test_result = await telegram.test_connection()
            if test_result.get('connection_test'):
                print("✅ Telegram test message sent successfully")
            else:
                print(f"❌ Telegram test failed: {test_result.get('error', 'Unknown error')}")
        else:
            print("❌ Telegram not configured")
    
    # Initialize monitor
    try:
        if args.mode in ['test', 'monitor'] and args.coins and args.coins != ['BTC', 'ETH', 'SOL']:
            # Use custom coin list for test/monitor
            custom_coins = args.coins
            monitor = WhaleMonitor(scan_interval=args.interval)
            monitor.coins = custom_coins  # Override default coins
            print(f"\n✅ Whale monitor initialized: {len(custom_coins)} custom coins")
            print(f"📋 Custom monitoring: {', '.join(custom_coins)}")
        else:
            monitor = WhaleMonitor(scan_interval=args.interval)
            print(f"\n✅ Whale monitor initialized: {len(monitor.coins)} coins")
            print(f"📋 Monitoring: {', '.join(monitor.coins[:10])}{'...' if len(monitor.coins) > 10 else ''}")
        
    except Exception as e:
        print(f"❌ Failed to initialize whale monitor: {e}")
        return 1
    
    # Execute based on mode
    if args.mode == 'status':
        status = monitor.get_status()
        print(f"\n📊 System Status:")
        print(f"  Running: {status['running']}")
        print(f"  Coins monitored: {status['coins_monitored']}")
        print(f"  Scan interval: {status['scan_interval']}s")
        print(f"  Total scans: {status['scan_count']}")
        print(f"  Total signals: {status['total_signals']}")
        
    elif args.mode == 'test':
        print(f"\n🧪 Running single scan test for: {args.coins}")
        try:
            results = await monitor.test_detection(args.coins)
            print("\n📊 Test Results:")
            print("-" * 40)
            
            signal_count = 0
            for coin, result in results.items():
                if 'error' in result:
                    print(f"❌ {coin}: ERROR - {result['error']}")
                else:
                    if result['signal_detected']:
                        signal_count += 1
                        print(f"🟢 {coin}: WHALE SIGNAL")
                        print(f"   Type: {result['signal_type']}")
                        print(f"   Confidence: {result['confidence']}")
                        print(f"   Taker Ratio: {result['taker_ratio']:.2f}")
                        print(f"   OI ROC: {result['oi_roc']*100:+.1f}%")
                    else:
                        print(f"⚪ {coin}: Normal conditions")
            
            print(f"\n📈 Summary: {signal_count}/{len(results)} signals detected")
            
        except Exception as e:
            print(f"❌ Test failed: {e}")
            return 1
        
    elif args.mode == 'monitor':
        print(f"\n🚀 Starting continuous monitoring...")
        print(f"⏱️  Scan interval: {args.interval} seconds")
        if args.ws:
            print(f"🔌 WebSocket mode: ENABLED (future feature)")
        print(f"🛑 Press Ctrl+C to stop")
        
        try:
            await monitor.start_monitoring()
        except KeyboardInterrupt:
            print("\n🛑 Monitoring stopped by user")
        except Exception as e:
            print(f"❌ Monitoring error: {e}")
            return 1
    
    print(f"\n✅ Whale monitor session completed")
    return 0

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n🛑 Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)
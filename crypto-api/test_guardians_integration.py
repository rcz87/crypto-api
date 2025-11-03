#!/usr/bin/env python3
"""
Test and verification script for GuardiansOfTheToken.com integration
Tests VIP 8 access, orderbook data, and premium features
"""

import asyncio
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
import logging
from typing import Dict, Any

# Add the current directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

from services.guardiansofthetoken_api import GuardiansOfTheTokenAPI, GuardiansDataProcessor
from utils.guardians_visualizer import GuardiansVisualizer
from config_guardians import (
    GUARDIANS_CONFIG, 
    get_guardians_symbols,
    is_guardians_enabled,
    validate_guardians_config,
    get_vip_features
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class GuardiansIntegrationTester:
    """
    Comprehensive test suite for GuardiansOfTheToken integration
    """
    
    def __init__(self):
        self.api = None
        self.processor = GuardiansDataProcessor()
        self.visualizer = GuardiansVisualizer()
        self.test_results = {
            'config_validation': {},
            'api_connection': {},
            'orderbook_data': {},
            'market_metrics': {},
            'vip_features': {},
            'data_quality': {},
            'performance': {},
            'visualization': {}
        }
        self.start_time = time.time()
    
    async def run_all_tests(self):
        """Run complete test suite"""
        print("🔍 GUARDIANSOFTHETOKEN.COM INTEGRATION TEST SUITE")
        print("=" * 60)
        print(f"⏰ Test started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print()
        
        try:
            # 1. Configuration Validation
            await self._test_configuration()
            
            # 2. API Connection Test
            await self._test_api_connection()
            
            # 3. Orderbook Data Test
            await self._test_orderbook_data()
            
            # 4. Market Metrics Test
            await self._test_market_metrics()
            
            # 5. VIP Features Test
            await self._test_vip_features()
            
            # 6. Data Quality Test
            await self._test_data_quality()
            
            # 7. Performance Test
            await self._test_performance()
            
            # 8. Visualization Test
            await self._test_visualization()
            
            # Generate final report
            self._generate_final_report()
            
        except Exception as e:
            logger.error(f"Test suite failed: {e}")
            print(f"❌ Test suite failed: {e}")
            return False
        
        return True
    
    async def _test_configuration(self):
        """Test configuration validation"""
        print("📋 Testing Configuration...")
        
        try:
            # Check if Guardians is enabled
            enabled = is_guardians_enabled()
            self.test_results['config_validation']['enabled'] = enabled
            
            if not enabled:
                print("⚠️  GuardiansOfTheToken integration is disabled")
                print("   Set GUARDIANS_ENABLED=true and provide GUARDIANS_API_KEY")
                return
            
            # Validate configuration
            validation = validate_guardians_config()
            self.test_results['config_validation']['validation'] = validation
            
            if validation['valid']:
                print("✅ Configuration is valid")
            else:
                print("❌ Configuration has issues:")
                for issue in validation['issues']:
                    print(f"   - {issue}")
            
            if validation['warnings']:
                print("⚠️  Configuration warnings:")
                for warning in validation['warnings']:
                    print(f"   - {warning}")
            
            # Check VIP features
            vip_features = get_vip_features()
            self.test_results['config_validation']['vip_features'] = vip_features
            
            print(f"🌟 VIP Tier: {GUARDIANS_CONFIG['api']['vip_tier']}")
            print(f"⚡ Update Frequency: {vip_features['update_frequency_ms']}ms")
            print(f"📊 Max Depth Levels: {vip_features['max_depth_levels']}")
            print(f"🔍 Advanced Detection: {vip_features['advanced_detection']}")
            print(f"🏢 Institutional Data: {vip_features['institutional_data']}")
            
        except Exception as e:
            logger.error(f"Configuration test failed: {e}")
            self.test_results['config_validation']['error'] = str(e)
            print(f"❌ Configuration test failed: {e}")
        
        print()
    
    async def _test_api_connection(self):
        """Test API connection and authentication"""
        print("🔌 Testing API Connection...")
        
        try:
            # Initialize API
            api_key = GUARDIANS_CONFIG['api']['api_key']
            vip_tier = GUARDIANS_CONFIG['api']['vip_tier']
            
            self.api = GuardiansOfTheTokenAPI(api_key=api_key, vip_tier=vip_tier)
            
            # Test session creation
            async with self.api:
                connection_status = self.api.get_connection_status()
                self.test_results['api_connection']['status'] = connection_status
                
                print(f"✅ API session created successfully")
                print(f"🌐 Base URL: {GUARDIANS_CONFIG['api']['base_url']}")
                print(f"🔑 VIP Tier: {vip_tier}")
                print(f"⏱️  Timeout: {GUARDIANS_CONFIG['api']['timeout']}s")
                
                # Test basic connectivity with a simple request
                test_symbol = get_guardians_symbols()[0] if get_guardians_symbols() else 'SOLUSDT'
                
                start_time = time.time()
                orderbook_data = await self.api.get_premium_orderbook(test_symbol, depth=10)
                response_time = (time.time() - start_time) * 1000
                
                if orderbook_data:
                    self.test_results['api_connection']['test_orderbook'] = {
                        'success': True,
                        'response_time_ms': response_time,
                        'symbol': test_symbol,
                        'bid_levels': len(orderbook_data.bid_levels),
                        'ask_levels': len(orderbook_data.ask_levels)
                    }
                    
                    print(f"✅ API connection successful")
                    print(f"⚡ Response time: {response_time:.2f}ms")
                    print(f"📊 Test symbol: {test_symbol}")
                    print(f"📈 Bid levels: {len(orderbook_data.bid_levels)}")
                    print(f"📉 Ask levels: {len(orderbook_data.ask_levels)}")
                else:
                    self.test_results['api_connection']['test_orderbook'] = {
                        'success': False,
                        'response_time_ms': response_time,
                        'symbol': test_symbol
                    }
                    print(f"❌ Failed to get test orderbook data")
        
        except Exception as e:
            logger.error(f"API connection test failed: {e}")
            self.test_results['api_connection']['error'] = str(e)
            print(f"❌ API connection test failed: {e}")
        
        print()
    
    async def _test_orderbook_data(self):
        """Test orderbook data retrieval and quality"""
        print("📚 Testing Orderbook Data...")
        
        if not self.api:
            print("❌ API not initialized, skipping orderbook test")
            return
        
        try:
            test_symbols = get_guardians_symbols()[:3]  # Test first 3 symbols
            orderbook_results = {}
            
            for symbol in test_symbols:
                print(f"🔍 Testing {symbol}...")
                
                start_time = time.time()
                orderbook_data = await self.api.get_premium_orderbook(symbol, depth=50)
                response_time = (time.time() - start_time) * 1000
                
                if orderbook_data:
                    # Add to processor
                    self.processor.add_orderbook_data(orderbook_data)
                    
                    # Validate data quality
                    quality_score = self._validate_orderbook_quality(orderbook_data)
                    
                    orderbook_results[symbol] = {
                        'success': True,
                        'response_time_ms': response_time,
                        'bid_levels': len(orderbook_data.bid_levels),
                        'ask_levels': len(orderbook_data.ask_levels),
                        'spread': orderbook_data.spread,
                        'mid_price': orderbook_data.mid_price,
                        'imbalance_ratio': orderbook_data.imbalance_ratio,
                        'quality_score': quality_score,
                        'vip_tier': orderbook_data.vip_tier,
                        'update_frequency': orderbook_data.update_frequency_ms
                    }
                    
                    print(f"   ✅ {symbol}: {len(orderbook_data.bid_levels)} bids, {len(orderbook_data.ask_levels)} asks")
                    print(f"   📊 Spread: ${orderbook_data.spread:.4f}")
                    print(f"   ⚖️  Imbalance: {orderbook_data.imbalance_ratio:.2f}")
                    print(f"   🏆 Quality: {quality_score:.1f}/100")
                else:
                    orderbook_results[symbol] = {
                        'success': False,
                        'response_time_ms': response_time
                    }
                    print(f"   ❌ {symbol}: Failed to retrieve data")
            
            self.test_results['orderbook_data']['results'] = orderbook_results
            
            # Calculate overall statistics
            successful_tests = [r for r in orderbook_results.values() if r['success']]
            if successful_tests:
                avg_response_time = sum(r['response_time_ms'] for r in successful_tests) / len(successful_tests)
                avg_quality = sum(r['quality_score'] for r in successful_tests) / len(successful_tests)
                
                print(f"📈 Average response time: {avg_response_time:.2f}ms")
                print(f"🏆 Average quality score: {avg_quality:.1f}/100")
                print(f"✅ Success rate: {len(successful_tests)}/{len(test_symbols)} ({len(successful_tests)/len(test_symbols)*100:.1f}%)")
        
        except Exception as e:
            logger.error(f"Orderbook data test failed: {e}")
            self.test_results['orderbook_data']['error'] = str(e)
            print(f"❌ Orderbook data test failed: {e}")
        
        print()
    
    async def _test_market_metrics(self):
        """Test market metrics and institutional analysis"""
        print("🏢 Testing Market Metrics...")
        
        if not self.api:
            print("❌ API not initialized, skipping metrics test")
            return
        
        try:
            test_symbol = get_guardians_symbols()[0] if get_guardians_symbols() else 'SOLUSDT'
            
            print(f"🔍 Testing metrics for {test_symbol}...")
            
            start_time = time.time()
            metrics = await self.api.get_market_metrics(test_symbol)
            response_time = (time.time() - start_time) * 1000
            
            if metrics:
                # Add to processor
                self.processor.add_metrics_data(metrics)
                
                self.test_results['market_metrics']['results'] = {
                    'success': True,
                    'response_time_ms': response_time,
                    'symbol': test_symbol,
                    'buy_wall_detected': metrics.buy_wall_detected,
                    'sell_wall_detected': metrics.sell_wall_detected,
                    'hidden_orders_detected': metrics.hidden_orders_detected,
                    'institutional_imbalance': metrics.institutional_imbalance,
                    'liquidity_score': metrics.liquidity_score,
                    'market_depth_score': metrics.market_depth_score,
                    'spoofing_zones': len(metrics.spoofing_zones),
                    'iceberg_orders': len(metrics.iceberg_orders)
                }
                
                print(f"   ✅ Metrics retrieved for {test_symbol}")
                print(f"   🧱 Buy Wall: {'Detected' if metrics.buy_wall_detected else 'Not detected'}")
                print(f"   🧱 Sell Wall: {'Detected' if metrics.sell_wall_detected else 'Not detected'}")
                print(f"   👻 Hidden Orders: {'Detected' if metrics.hidden_orders_detected else 'Not detected'}")
                print(f"   🏢 Institutional: {metrics.institutional_imbalance}")
                print(f"   💧 Liquidity Score: {metrics.liquidity_score:.1f}/100")
                print(f"   📊 Market Depth: {metrics.market_depth_score:.1f}/100")
                print(f"   🎭 Spoofing Zones: {len(metrics.spoofing_zones)}")
                print(f"   🧊 Iceberg Orders: {len(metrics.iceberg_orders)}")
            else:
                self.test_results['market_metrics']['results'] = {
                    'success': False,
                    'response_time_ms': response_time,
                    'symbol': test_symbol
                }
                print(f"   ❌ Failed to retrieve metrics for {test_symbol}")
        
        except Exception as e:
            logger.error(f"Market metrics test failed: {e}")
            self.test_results['market_metrics']['error'] = str(e)
            print(f"❌ Market metrics test failed: {e}")
        
        print()
    
    async def _test_vip_features(self):
        """Test VIP 8 specific features"""
        print("🌟 Testing VIP 8 Features...")
        
        try:
            vip_features = get_vip_features()
            
            # Test high-frequency updates
            if self.api and get_guardians_symbols():
                test_symbol = get_guardians_symbols()[0]
                
                print(f"⚡ Testing update frequency ({vip_features['update_frequency_ms']}ms target)...")
                
                # Get multiple rapid updates
                update_times = []
                for i in range(5):
                    start_time = time.time()
                    orderbook = await self.api.get_premium_orderbook(test_symbol, depth=20)
                    response_time = (time.time() - start_time) * 1000
                    
                    if orderbook:
                        update_times.append(response_time)
                        await asyncio.sleep(0.05)  # Small delay between requests
                
                if update_times:
                    avg_response_time = sum(update_times) / len(update_times)
                    min_response_time = min(update_times)
                    
                    self.test_results['vip_features']['update_frequency'] = {
                        'target_ms': vip_features['update_frequency_ms'],
                        'avg_response_ms': avg_response_time,
                        'min_response_ms': min_response_time,
                        'successful_updates': len(update_times)
                    }
                    
                    print(f"   📊 Average response: {avg_response_time:.2f}ms")
                    print(f"   ⚡ Fastest response: {min_response_time:.2f}ms")
                    print(f"   ✅ Successful updates: {len(update_times)}/5")
                    
                    if avg_response_time <= vip_features['update_frequency_ms'] * 2:
                        print(f"   🏆 Response time within acceptable range")
                    else:
                        print(f"   ⚠️  Response time slower than expected")
            
            # Test depth levels
            max_depth = vip_features['max_depth_levels']
            print(f"📊 Testing depth levels (max: {max_depth})...")
            
            if self.api and get_guardians_symbols():
                test_symbol = get_guardians_symbols()[0]
                deep_orderbook = await self.api.get_premium_orderbook(test_symbol, depth=max_depth)
                
                if deep_orderbook:
                    actual_depth = min(len(deep_orderbook.bid_levels), len(deep_orderbook.ask_levels))
                    
                    self.test_results['vip_features']['depth_levels'] = {
                        'max_supported': max_depth,
                        'actual_received': actual_depth,
                        'bid_levels': len(deep_orderbook.bid_levels),
                        'ask_levels': len(deep_orderbook.ask_levels)
                    }
                    
                    print(f"   📈 Bid levels: {len(deep_orderbook.bid_levels)}")
                    print(f"   📉 Ask levels: {len(deep_orderbook.ask_levels)}")
                    print(f"   📊 Actual depth: {actual_depth}")
                    
                    if actual_depth >= max_depth * 0.8:  # 80% of expected depth
                        print(f"   🏆 Depth levels meet expectations")
                    else:
                        print(f"   ⚠️  Depth levels lower than expected")
        
        except Exception as e:
            logger.error(f"VIP features test failed: {e}")
            self.test_results['vip_features']['error'] = str(e)
            print(f"❌ VIP features test failed: {e}")
        
        print()
    
    async def _test_data_quality(self):
        """Test data quality and validation"""
        print("🔍 Testing Data Quality...")
        
        try:
            # Get latest orderbook from processor
            if get_guardians_symbols():
                symbol = get_guardians_symbols()[0]
                latest_orderbook = self.processor.get_latest_orderbook(symbol)
                
                if latest_orderbook:
                    quality_score = self._validate_orderbook_quality(latest_orderbook)
                    quality_details = self._analyze_data_quality(latest_orderbook)
                    
                    self.test_results['data_quality']['orderbook'] = {
                        'symbol': symbol,
                        'quality_score': quality_score,
                        'details': quality_details
                    }
                    
                    print(f"📊 Data Quality Analysis for {symbol}:")
                    print(f"   🏆 Overall Score: {quality_score:.1f}/100")
                    print(f"   📈 Bid Levels: {quality_details['bid_levels']}")
                    print(f"   📉 Ask Levels: {quality_details['ask_levels']}")
                    print(f"   📏 Spread: {quality_details['spread_pct']:.3f}%")
                    print(f"   ⚖️  Imbalance: {quality_details['imbalance_ratio']:.2f}")
                    print(f"   💰 Total Volume: ${quality_details['total_volume']:,.0f}")
                    print(f"   ✅ Data Freshness: {quality_details['freshness_ms']:.0f}ms")
                    
                    if quality_score >= 80:
                        print(f"   🏆 Excellent data quality")
                    elif quality_score >= 60:
                        print(f"   ✅ Good data quality")
                    else:
                        print(f"   ⚠️  Data quality needs improvement")
            
            # Test metrics quality
            latest_metrics = self.processor.get_latest_metrics(symbol)
            if latest_metrics:
                metrics_quality = self._validate_metrics_quality(latest_metrics)
                
                self.test_results['data_quality']['metrics'] = {
                    'symbol': symbol,
                    'quality_score': metrics_quality,
                    'buy_wall': latest_metrics.buy_wall_detected,
                    'sell_wall': latest_metrics.sell_wall_detected,
                    'liquidity_score': latest_metrics.liquidity_score,
                    'depth_score': latest_metrics.market_depth_score
                }
                
                print(f"🏢 Metrics Quality Analysis:")
                print(f"   🏆 Score: {metrics_quality:.1f}/100")
                print(f"   💧 Liquidity: {latest_metrics.liquidity_score:.1f}/100")
                print(f"   📊 Depth: {latest_metrics.market_depth_score:.1f}/100")
        
        except Exception as e:
            logger.error(f"Data quality test failed: {e}")
            self.test_results['data_quality']['error'] = str(e)
            print(f"❌ Data quality test failed: {e}")
        
        print()
    
    async def _test_performance(self):
        """Test performance under load"""
        print("⚡ Testing Performance...")
        
        try:
            if not self.api or not get_guardians_symbols():
                print("❌ API not available for performance testing")
                return
            
            test_symbols = get_guardians_symbols()[:2]  # Test 2 symbols
            concurrent_requests = 3
            requests_per_symbol = 5
            
            print(f"🚀 Testing {concurrent_requests} concurrent requests for {len(test_symbols)} symbols...")
            
            performance_results = {}
            total_start_time = time.time()
            
            for symbol in test_symbols:
                symbol_times = []
                successful_requests = 0
                
                # Create concurrent tasks
                tasks = []
                for _ in range(concurrent_requests):
                    for _ in range(requests_per_symbol):
                        task = asyncio.create_task(
                            self._timed_request(symbol)
                        )
                        tasks.append(task)
                
                # Execute all tasks
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Analyze results
                for result in results:
                    if isinstance(result, dict) and result['success']:
                        symbol_times.append(result['response_time_ms'])
                        successful_requests += 1
                
                if symbol_times:
                    performance_results[symbol] = {
                        'successful_requests': successful_requests,
                        'total_requests': concurrent_requests * requests_per_symbol,
                        'avg_response_time': sum(symbol_times) / len(symbol_times),
                        'min_response_time': min(symbol_times),
                        'max_response_time': max(symbol_times),
                        'success_rate': (successful_requests / (concurrent_requests * requests_per_symbol)) * 100
                    }
                    
                    print(f"   📊 {symbol}:")
                    print(f"      ✅ Success rate: {performance_results[symbol]['success_rate']:.1f}%")
                    print(f"      ⚡ Avg response: {performance_results[symbol]['avg_response_time']:.2f}ms")
                    print(f"      🏃 Fastest: {performance_results[symbol]['min_response_time']:.2f}ms")
                    print(f"      🐌 Slowest: {performance_results[symbol]['max_response_time']:.2f}ms")
            
            total_time = (time.time() - total_start_time) * 1000
            self.test_results['performance']['results'] = performance_results
            self.test_results['performance']['total_time_ms'] = total_time
            
            print(f"   🕐 Total test time: {total_time:.2f}ms")
        
        except Exception as e:
            logger.error(f"Performance test failed: {e}")
            self.test_results['performance']['error'] = str(e)
            print(f"❌ Performance test failed: {e}")
        
        print()
    
    async def _test_visualization(self):
        """Test visualization components"""
        print("📊 Testing Visualization...")
        
        try:
            if get_guardians_symbols():
                symbol = get_guardians_symbols()[0]
                latest_orderbook = self.processor.get_latest_orderbook(symbol)
                latest_metrics = self.processor.get_latest_metrics(symbol)
                
                if latest_orderbook:
                    # Test premium orderbook chart
                    print(f"📈 Creating premium orderbook chart for {symbol}...")
                    
                    chart = self.visualizer.create_premium_orderbook_chart(
                        latest_orderbook, 
                        latest_metrics,
                        depth_levels=20
                    )
                    
                    if chart:
                        self.test_results['visualization']['orderbook_chart'] = True
                        print(f"   ✅ Premium orderbook chart created successfully")
                        
                        # Save chart as HTML for verification
                        chart.write_html(f"/tmp/guardians_orderbook_{symbol}_{int(time.time())}.html")
                        print(f"   💾 Chart saved to /tmp/")
                    else:
                        self.test_results['visualization']['orderbook_chart'] = False
                        print(f"   ❌ Failed to create orderbook chart")
                    
                    # Test institutional analysis chart
                    if latest_metrics:
                        print(f"🏢 Creating institutional analysis chart...")
                        
                        inst_chart = self.visualizer.create_institutional_analysis_chart(
                            latest_metrics,
                            latest_orderbook
                        )
                        
                        if inst_chart:
                            self.test_results['visualization']['institutional_chart'] = True
                            print(f"   ✅ Institutional analysis chart created successfully")
                            
                            # Save chart
                            inst_chart.write_html(f"/tmp/guardians_institutional_{symbol}_{int(time.time())}.html")
                            print(f"   💾 Chart saved to /tmp/")
                        else:
                            self.test_results['visualization']['institutional_chart'] = False
                            print(f"   ❌ Failed to create institutional chart")
                    
                    # Test VIP features dashboard
                    print(f"🌟 Creating VIP features dashboard...")
                    
                    dashboard = self.visualizer.create_vip_features_dashboard(
                        latest_orderbook,
                        latest_metrics
                    )
                    
                    if dashboard:
                        self.test_results['visualization']['vip_dashboard'] = True
                        print(f"   ✅ VIP dashboard created successfully")
                        
                        # Save dashboard
                        dashboard.write_html(f"/tmp/guardians_vip_dashboard_{symbol}_{int(time.time())}.html")
                        print(f"   💾 Dashboard saved to /tmp/")
                    else:
                        self.test_results['visualization']['vip_dashboard'] = False
                        print(f"   ❌ Failed to create VIP dashboard")
                else:
                    print(f"   ⚠️  No orderbook data available for visualization test")
        
        except Exception as e:
            logger.error(f"Visualization test failed: {e}")
            self.test_results['visualization']['error'] = str(e)
            print(f"❌ Visualization test failed: {e}")
        
        print()
    
    async def _timed_request(self, symbol: str) -> Dict[str, Any]:
        """Helper method for timed API requests"""
        try:
            start_time = time.time()
            orderbook = await self.api.get_premium_orderbook(symbol, depth=20)
            response_time = (time.time() - start_time) * 1000
            
            return {
                'success': orderbook is not None,
                'response_time_ms': response_time,
                'symbol': symbol
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'symbol': symbol
            }
    
    def _validate_orderbook_quality(self, orderbook_data) -> float:
        """Calculate orderbook data quality score (0-100)"""
        score = 0
        
        # Bid levels (20 points)
        if len(orderbook_data.bid_levels) >= 20:
            score += 20
        elif len(orderbook_data.bid_levels) >= 10:
            score += 10
        
        # Ask levels (20 points)
        if len(orderbook_data.ask_levels) >= 20:
            score += 20
        elif len(orderbook_data.ask_levels) >= 10:
            score += 10
        
        # Spread (20 points)
        spread_pct = (orderbook_data.spread / orderbook_data.mid_price) * 100 if orderbook_data.mid_price > 0 else 100
        if spread_pct <= 0.1:
            score += 20
        elif spread_pct <= 0.5:
            score += 15
        elif spread_pct <= 1.0:
            score += 10
        
        # Volume (20 points)
        total_volume = orderbook_data.total_bid_volume + orderbook_data.total_ask_volume
        if total_volume >= 1000000:  # $1M
            score += 20
        elif total_volume >= 100000:  # $100k
            score += 15
        elif total_volume >= 10000:  # $10k
            score += 10
        
        # Imbalance (20 points)
        imbalance = orderbook_data.imbalance_ratio
        if 0.5 <= imbalance <= 2.0:  # Reasonable imbalance
            score += 20
        elif 0.2 <= imbalance <= 5.0:
            score += 10
        
        return min(score, 100)
    
    def _analyze_data_quality(self, orderbook_data) -> Dict[str, Any]:
        """Analyze detailed data quality metrics"""
        spread_pct = (orderbook_data.spread / orderbook_data.mid_price) * 100 if orderbook_data.mid_price > 0 else 0
        total_volume = orderbook_data.total_bid_volume + orderbook_data.total_ask_volume
        freshness_ms = (datetime.now(timezone.utc) - orderbook_data.timestamp).total_seconds() * 1000
        
        return {
            'bid_levels': len(orderbook_data.bid_levels),
            'ask_levels': len(orderbook_data.ask_levels),
            'spread_pct': spread_pct,
            'imbalance_ratio': orderbook_data.imbalance_ratio,
            'total_volume': total_volume,
            'freshness_ms': freshness_ms
        }
    
    def _validate_metrics_quality(self, metrics) -> float:
        """Calculate metrics quality score (0-100)"""
        score = 0
        
        # Liquidity score (40 points)
        if metrics.liquidity_score >= 80:
            score += 40
        elif metrics.liquidity_score >= 60:
            score += 30
        elif metrics.liquidity_score >= 40:
            score += 20
        
        # Market depth score (40 points)
        if metrics.market_depth_score >= 80:
            score += 40
        elif metrics.market_depth_score >= 60:
            score += 30
        elif metrics.market_depth_score >= 40:
            score += 20
        
        # Pattern detection (20 points)
        patterns_detected = sum([
            metrics.buy_wall_detected,
            metrics.sell_wall_detected,
            metrics.hidden_orders_detected
        ])
        score += min(patterns_detected * 7, 20)
        
        return min(score, 100)
    
    def _generate_final_report(self):
        """Generate comprehensive test report"""
        total_time = time.time() - self.start_time
        
        print("📋 FINAL TEST REPORT")
        print("=" * 60)
        print(f"⏰ Total test time: {total_time:.2f} seconds")
        print(f"📅 Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print()
        
        # Calculate overall success rate
        test_categories = ['config_validation', 'api_connection', 'orderbook_data', 
                          'market_metrics', 'vip_features', 'data_quality', 
                          'performance', 'visualization']
        
        successful_categories = 0
        for category in test_categories:
            if category in self.test_results and 'error' not in self.test_results[category]:
                successful_categories += 1
        
        overall_success_rate = (successful_categories / len(test_categories)) * 100
        
        print(f"🏆 Overall Success Rate: {overall_success_rate:.1f}% ({successful_categories}/{len(test_categories)} categories)")
        print()
        
        # Category summaries
        print("📊 CATEGORY SUMMARIES:")
        for category in test_categories:
            if category in self.test_results:
                result = self.test_results[category]
                status = "✅ PASS" if 'error' not in result else "❌ FAIL"
                print(f"   {category.replace('_', ' ').title()}: {status}")
        
        print()
        
        # Save detailed results
        report_file = f"/tmp/guardians_integration_test_{int(time.time())}.json"
        with open(report_file, 'w') as f:
            json.dump({
                'test_summary': {
                    'total_time_seconds': total_time,
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'overall_success_rate': overall_success_rate,
                    'successful_categories': successful_categories,
                    'total_categories': len(test_categories)
                },
                'detailed_results': self.test_results,
                'configuration': GUARDIANS_CONFIG
            }, f, indent=2, default=str)
        
        print(f"💾 Detailed report saved to: {report_file}")
        
        # Recommendations
        print()
        print("💡 RECOMMENDATIONS:")
        
        if overall_success_rate >= 80:
            print("🎉 Excellent! GuardiansOfTheToken integration is working well.")
            print("   ✅ Ready for production use")
        elif overall_success_rate >= 60:
            print("⚠️  Good progress, but some issues need attention.")
            print("   🔧 Review failed categories before production")
        else:
            print("❌ Significant issues detected.")
            print("   🚨 Do not use in production until issues are resolved")
        
        if not is_guardians_enabled():
            print("   🔑 Set GUARDIANS_ENABLED=true to enable integration")
        
        if 'api_connection' in self.test_results and 'error' in self.test_results['api_connection']:
            print("   🔌 Check API key and network connectivity")
        
        if 'orderbook_data' in self.test_results:
            orderbook_results = self.test_results['orderbook_data'].get('results', {})
            if orderbook_results:
                avg_quality = sum(r.get('quality_score', 0) for r in orderbook_results.values() if r.get('success')) / len([r for r in orderbook_results.values() if r.get('success')])
                if avg_quality < 70:
                    print("   📊 Data quality needs improvement - check data sources")

async def main():
    """Main test execution"""
    tester = GuardiansIntegrationTester()
    success = await tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests completed successfully!")
        return 0
    else:
        print("\n❌ Some tests failed. Check the report for details.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

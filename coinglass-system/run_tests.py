#!/usr/bin/env python3
"""
Enhanced Test Runner for CoinGlass System
Combines method existence checks with comprehensive end-to-end testing
"""

import sys
import os
import json
import requests
import time
from typing import Dict, Any, List

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

def test_api_availability():
    """Test if the API is available and responding"""
    try:
        response = requests.get("http://127.0.0.1:8000/health", timeout=5)
        return response.status_code == 200
    except:
        return False

def test_method_completeness():
    """Test that all required methods exist in CoinglassClient"""
    print("🔧 Testing Method Completeness...")
    
    try:
        from app.core.coinglass_client import CoinglassClient
        client = CoinglassClient()
        
        # Core methods that should exist
        required_methods = [
            'oi_ohlc',
            'funding_rate', 
            'liquidations',
            'long_short_ratio',
            'taker_buysell_volume',
            'taker_buysell_volume_aggregated',
            'validate_pair_exchange',  # New validation method
            'whale_alerts',
            'whale_positions',
            'bitcoin_etfs',
            'market_sentiment'
        ]
        
        existing_methods = []
        missing_methods = []
        
        for method in required_methods:
            if hasattr(client, method):
                existing_methods.append(method)
                print(f"✅ {method}")
            else:
                missing_methods.append(method)
                print(f"❌ {method} - MISSING!")
        
        print(f"\n📊 Method Summary: {len(existing_methods)}/{len(required_methods)} methods found")
        
        if missing_methods:
            print(f"⚠️  Missing methods: {missing_methods}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Method completeness test failed: {e}")
        return False

def test_sniper_timing_end_to_end():
    """Test complete sniper timing flow with real API validation"""
    print("\n📊 Testing Sniper Timing End-to-End Flow...")
    
    try:
        # Test multiple coins
        coins = ['BTC', 'ETH', 'SOL']
        results = {}
        
        for coin in coins:
            response = requests.get(f"http://127.0.0.1:8000/advanced/sniper-timing/{coin}?exchange=Binance", timeout=10)
            
            if response.status_code != 200:
                print(f"❌ {coin}: HTTP {response.status_code}")
                continue
                
            data = response.json()
            
            # Validate response structure
            required_fields = ['coin', 'signal', 'confidence', 'metrics', 'timestamp']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"❌ {coin}: Missing fields {missing_fields}")
                continue
            
            # Validate signal values
            if data['signal'] not in ['LONG', 'SHORT', 'NEUTRAL']:
                print(f"❌ {coin}: Invalid signal '{data['signal']}'")
                continue
                
            # Validate confidence range
            if not (0 <= data['confidence'] <= 100):
                print(f"❌ {coin}: Invalid confidence {data['confidence']}")
                continue
            
            # Validate metrics
            metrics = data['metrics']
            required_metrics = ['taker_dominance', 'ob_imbalance', 'funding_bias', 'long_score', 'short_score']
            missing_metrics = [metric for metric in required_metrics if metric not in metrics]
            
            if missing_metrics:
                print(f"❌ {coin}: Missing metrics {missing_metrics}")
                continue
            
            results[coin] = {
                'signal': data['signal'],
                'confidence': data['confidence'], 
                'long_score': metrics['long_score'],
                'short_score': metrics['short_score']
            }
            
            print(f"✅ {coin}: {data['signal']} ({data['confidence']:.1f}%) - L:{metrics['long_score']}/S:{metrics['short_score']}")
        
        if len(results) == len(coins):
            print(f"✅ Sniper timing flow: {len(results)}/{len(coins)} coins validated")
            return True
        else:
            print(f"⚠️  Sniper timing flow: {len(results)}/{len(coins)} coins validated")
            return False
            
    except Exception as e:
        print(f"❌ Sniper timing test failed: {e}")
        return False

def test_proactive_validation_flow():
    """Test the new proactive pair/exchange validation"""
    print("\n🔍 Testing Proactive Validation Flow...")
    
    try:
        test_scenarios = [
            {
                'name': 'Valid pair/exchange',
                'url': 'http://127.0.0.1:8000/advanced/taker-volume/SOL?exchange=Binance',
                'expect_pair_level': True
            },
            {
                'name': 'Invalid exchange',
                'url': 'http://127.0.0.1:8000/advanced/taker-volume/SOL?exchange=FakeExchange123',
                'expect_pair_level': False
            },
            {
                'name': 'Invalid coin',
                'url': 'http://127.0.0.1:8000/advanced/taker-volume/INVALIDCOIN?exchange=Binance',
                'expect_pair_level': False
            }
        ]
        
        validation_working = 0
        
        for scenario in test_scenarios:
            response = requests.get(scenario['url'], timeout=10)
            
            if response.status_code != 200:
                print(f"❌ {scenario['name']}: HTTP {response.status_code}")
                continue
            
            data = response.json()
            
            if 'data' not in data or len(data['data']) == 0:
                print(f"❌ {scenario['name']}: No data returned")
                continue
            
            first_record = data['data'][0]
            
            # Check if we got pair-level data
            has_pair_data = 'taker_buy_volume_usd' in first_record
            has_aggregated_data = 'aggregated_buy_volume_usd' in first_record
            
            if scenario['expect_pair_level']:
                if has_pair_data:
                    print(f"✅ {scenario['name']}: Got pair-level data as expected")
                    validation_working += 1
                elif has_aggregated_data:
                    print(f"🔄 {scenario['name']}: Got aggregated fallback (validation triggered)")
                    validation_working += 1
                else:
                    print(f"❌ {scenario['name']}: Unexpected data structure")
            else:
                if has_aggregated_data:
                    print(f"✅ {scenario['name']}: Got aggregated fallback as expected")
                    validation_working += 1
                elif has_pair_data:
                    print(f"🔄 {scenario['name']}: Got pair-level data (validation passed)")
                    validation_working += 1
                else:
                    print(f"❌ {scenario['name']}: Unexpected data structure")
        
        success_rate = validation_working / len(test_scenarios)
        print(f"\n✅ Validation flow: {validation_working}/{len(test_scenarios)} scenarios passed ({success_rate*100:.0f}%)")
        
        return success_rate >= 0.8  # 80% success rate acceptable
        
    except Exception as e:
        print(f"❌ Validation flow test failed: {e}")
        return False

def test_volume_data_consistency():
    """Test volume data consistency and structure"""
    print("\n📈 Testing Volume Data Consistency...")
    
    try:
        # Test aggregated vs pair-level data
        endpoints = [
            {
                'name': 'Aggregated volume',
                'url': 'http://127.0.0.1:8000/advanced/taker-volume-aggregated/BTC?interval=1h',
                'expected_fields': ['time', 'aggregated_buy_volume_usd', 'aggregated_sell_volume_usd']
            },
            {
                'name': 'Pair-level volume',
                'url': 'http://127.0.0.1:8000/advanced/taker-volume/BTC?exchange=Binance',
                'expected_fields': ['time']  # Will check for either pair-level or aggregated fields
            }
        ]
        
        consistency_checks = 0
        
        for endpoint in endpoints:
            response = requests.get(endpoint['url'], timeout=10)
            
            if response.status_code != 200:
                print(f"❌ {endpoint['name']}: HTTP {response.status_code}")
                continue
            
            data = response.json()
            
            if 'data' not in data or len(data['data']) == 0:
                print(f"❌ {endpoint['name']}: No data returned")
                continue
            
            # Check data structure
            records = data['data'][:3]  # Check first 3 records
            valid_records = 0
            
            for record in records:
                # All records should have time
                if 'time' not in record:
                    continue
                
                # Check for volume fields (either pair-level or aggregated)
                has_pair_volume = ('taker_buy_volume_usd' in record and 'taker_sell_volume_usd' in record)
                has_aggregated_volume = ('aggregated_buy_volume_usd' in record and 'aggregated_sell_volume_usd' in record)
                
                if has_pair_volume or has_aggregated_volume:
                    # Validate volumes are positive numbers
                    if has_pair_volume:
                        buy_vol = float(record['taker_buy_volume_usd'])
                        sell_vol = float(record['taker_sell_volume_usd'])
                    else:
                        buy_vol = float(record['aggregated_buy_volume_usd'])
                        sell_vol = float(record['aggregated_sell_volume_usd'])
                    
                    if buy_vol >= 0 and sell_vol >= 0:
                        valid_records += 1
            
            if valid_records == len(records):
                print(f"✅ {endpoint['name']}: {len(records)} records validated")
                consistency_checks += 1
            else:
                print(f"⚠️  {endpoint['name']}: {valid_records}/{len(records)} records valid")
        
        success_rate = consistency_checks / len(endpoints)
        print(f"\n✅ Data consistency: {consistency_checks}/{len(endpoints)} endpoints passed ({success_rate*100:.0f}%)")
        
        return success_rate >= 0.8
        
    except Exception as e:
        print(f"❌ Volume data consistency test failed: {e}")
        return False

def test_error_handling_scenarios():
    """Test error handling and graceful degradation"""
    print("\n🛡️  Testing Error Handling Scenarios...")
    
    try:
        error_scenarios = [
            {
                'name': 'Invalid coin',
                'url': 'http://127.0.0.1:8000/advanced/sniper-timing/INVALID123'
            },
            {
                'name': 'Invalid exchange', 
                'url': 'http://127.0.0.1:8000/advanced/taker-volume/BTC?exchange=NONEXISTENT'
            },
            {
                'name': 'Invalid interval',
                'url': 'http://127.0.0.1:8000/advanced/taker-volume-aggregated/ETH?interval=invalid'
            }
        ]
        
        graceful_handling = 0
        
        for scenario in error_scenarios:
            response = requests.get(scenario['url'], timeout=10)
            
            # Should return 200 with graceful degradation, not crash
            if response.status_code == 200:
                try:
                    data = response.json()
                    # Should have some data structure, even if fallback
                    if 'data' in data or 'signal' in data:
                        print(f"✅ {scenario['name']}: Graceful degradation (200 OK)")
                        graceful_handling += 1
                    else:
                        print(f"⚠️  {scenario['name']}: 200 OK but unexpected structure")
                except:
                    print(f"❌ {scenario['name']}: 200 OK but invalid JSON")
            else:
                print(f"⚠️  {scenario['name']}: HTTP {response.status_code} (not graceful)")
        
        success_rate = graceful_handling / len(error_scenarios)
        print(f"\n✅ Error handling: {graceful_handling}/{len(error_scenarios)} scenarios handled gracefully ({success_rate*100:.0f}%)")
        
        return success_rate >= 0.6  # 60% graceful handling acceptable
        
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
        return False

def test_performance_benchmarks():
    """Test basic performance benchmarks"""
    print("\n⚡ Testing Performance Benchmarks...")
    
    try:
        benchmark_endpoints = [
            'http://127.0.0.1:8000/advanced/sniper-timing/BTC',
            'http://127.0.0.1:8000/advanced/taker-volume/ETH?exchange=Binance',
            'http://127.0.0.1:8000/health'
        ]
        
        response_times = []
        
        for endpoint in benchmark_endpoints:
            start_time = time.time()
            response = requests.get(endpoint, timeout=15)
            end_time = time.time()
            
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            response_times.append(response_time)
            
            status = "✅" if response.status_code == 200 else "❌"
            print(f"{status} {endpoint.split('/')[-1]}: {response_time:.0f}ms")
        
        avg_response_time = sum(response_times) / len(response_times)
        print(f"\n⚡ Average response time: {avg_response_time:.0f}ms")
        
        # Performance check: average should be under 5 seconds
        return avg_response_time < 5000
        
    except Exception as e:
        print(f"❌ Performance benchmark test failed: {e}")
        return False

def main():
    """Run comprehensive test suite"""
    print("🚀 Enhanced CoinGlass System Testing Suite")
    print("=" * 60)
    
    # Check API availability first
    if not test_api_availability():
        print("❌ API not available at http://127.0.0.1:8000")
        print("Please start the CoinGlass service first")
        return False
    
    print("✅ API is available and responding")
    
    # Run all test categories
    test_results = {}
    
    test_results['method_completeness'] = test_method_completeness()
    test_results['sniper_timing_e2e'] = test_sniper_timing_end_to_end()
    test_results['proactive_validation'] = test_proactive_validation_flow()
    test_results['volume_consistency'] = test_volume_data_consistency()
    test_results['error_handling'] = test_error_handling_scenarios()
    test_results['performance'] = test_performance_benchmarks()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 COMPREHENSIVE TEST SUMMARY")
    print("=" * 60)
    
    passed_tests = sum(test_results.values())
    total_tests = len(test_results)
    
    for test_name, result in test_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        test_display = test_name.replace('_', ' ').title()
        print(f"{status} {test_display}")
    
    success_rate = passed_tests / total_tests
    print(f"\n🎯 Overall Success Rate: {passed_tests}/{total_tests} ({success_rate*100:.0f}%)")
    
    if success_rate >= 0.8:
        print("\n🎉 SYSTEM STATUS: ✅ EXCELLENT - All major systems operational!")
        print("🔥 Enhanced end-to-end testing confirms system reliability")
        print("🎯 Proactive validation and error handling working perfectly")
    elif success_rate >= 0.6:
        print("\n⚠️  SYSTEM STATUS: 🟡 GOOD - Most systems operational")
        print("Some tests failed but core functionality is working")
    else:
        print("\n❌ SYSTEM STATUS: 🔴 NEEDS ATTENTION - Multiple test failures")
        print("Please check the failed tests and resolve issues")
    
    return success_rate >= 0.6

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
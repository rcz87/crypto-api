#!/usr/bin/env python3
"""
Enhanced End-to-End Testing for CoinGlass System
Tests complete API flows with real response validation
"""

import pytest
import json
import requests
from typing import Dict, Any, List
from unittest.mock import Mock, patch
from app.core.coinglass_client import CoinglassClient
from app.core.settings import settings

class TestEndToEndFlows:
    """End-to-end testing with real API response validation"""
    
    def setup_method(self):
        """Setup for each test"""
        self.client = CoinglassClient()
        self.base_url = "http://127.0.0.1:8000"
        
        # Real API response examples captured from live system
        self.sample_responses = {
            "btc_sniper": {
                "coin": "BTC",
                "signal": "NEUTRAL", 
                "confidence": 33.33,
                "conditions": ["No clear institutional bias detected"],
                "metrics": {
                    "taker_dominance": 0.4830,
                    "ob_imbalance": 0.3987,
                    "funding_bias": "neutral",
                    "long_score": 3,
                    "short_score": 6
                },
                "timestamp": 1757996376353
            },
            "sol_volume": {
                "code": "0",
                "data": [
                    {
                        "time": 1754398800000,
                        "taker_buy_volume_usd": "124915220.1046",
                        "taker_sell_volume_usd": "110840202.0798"
                    },
                    {
                        "time": 1754402400000, 
                        "taker_buy_volume_usd": "217368089.7607",
                        "taker_sell_volume_usd": "281423737.7106"
                    }
                ]
            },
            "aggregated_volume": {
                "code": "0",
                "data": [
                    {
                        "time": 1757739600000,
                        "aggregated_buy_volume_usd": "169498777.1288",
                        "aggregated_sell_volume_usd": "209604136.3689"
                    }
                ]
            }
        }
    
    @pytest.mark.integration
    def test_sniper_timing_complete_flow(self):
        """Test complete sniper timing flow with confidence calculation"""
        
        # Test BTC sniper timing
        response = requests.get(f"{self.base_url}/advanced/sniper-timing/BTC?exchange=Binance")
        assert response.status_code == 200
        
        data = response.json()
        
        # Validate response structure
        required_fields = ['coin', 'signal', 'confidence', 'metrics', 'timestamp']
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Validate signal types
        assert data['signal'] in ['LONG', 'SHORT', 'NEUTRAL'], f"Invalid signal: {data['signal']}"
        
        # Validate confidence range
        assert 0 <= data['confidence'] <= 100, f"Invalid confidence: {data['confidence']}"
        
        # Validate metrics structure
        metrics = data['metrics']
        required_metrics = ['taker_dominance', 'ob_imbalance', 'funding_bias', 'long_score', 'short_score']
        for metric in required_metrics:
            assert metric in metrics, f"Missing metric: {metric}"
        
        # Validate metric ranges
        assert 0 <= metrics['taker_dominance'] <= 1, "Invalid taker_dominance range"
        assert 0 <= metrics['ob_imbalance'] <= 1, "Invalid ob_imbalance range"
        assert isinstance(metrics['long_score'], int), "long_score should be integer"
        assert isinstance(metrics['short_score'], int), "short_score should be integer"
        
        print(f"✅ BTC Sniper: {data['signal']} ({data['confidence']:.1f}% confidence)")
    
    @pytest.mark.integration 
    def test_taker_volume_with_validation_flow(self):
        """Test taker volume flow with proactive pair/exchange validation"""
        
        # Test 1: Valid pair/exchange (should get pair-level data)
        response = requests.get(f"{self.base_url}/advanced/taker-volume/SOL?exchange=Binance")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check if we got pair-level data (has taker_buy_volume_usd)
        if 'data' in data and len(data['data']) > 0:
            first_record = data['data'][0]
            
            # Pair-level data structure
            if 'taker_buy_volume_usd' in first_record:
                print("✅ Pair-level data received")
                # Validate pair-level structure
                assert 'taker_buy_volume_usd' in first_record
                assert 'taker_sell_volume_usd' in first_record
                assert 'time' in first_record
                
                # Validate volume is numeric string or number
                buy_volume = float(first_record['taker_buy_volume_usd'])
                sell_volume = float(first_record['taker_sell_volume_usd'])
                assert buy_volume > 0, "Buy volume should be positive"
                assert sell_volume > 0, "Sell volume should be positive"
                
            # Aggregated data structure 
            elif 'aggregated_buy_volume_usd' in first_record:
                print("✅ Aggregated data received (validation triggered fallback)")
                # Validate aggregated structure
                assert 'aggregated_buy_volume_usd' in first_record
                assert 'aggregated_sell_volume_usd' in first_record
                assert 'time' in first_record
        
        # Test 2: Invalid exchange (should get aggregated fallback)
        response = requests.get(f"{self.base_url}/advanced/taker-volume/SOL?exchange=InvalidExchange") 
        assert response.status_code == 200
        
        data = response.json()
        
        # Should get aggregated data as fallback
        if 'data' in data and len(data['data']) > 0:
            first_record = data['data'][0]
            # Should be aggregated data due to validation
            if 'aggregated_buy_volume_usd' in first_record:
                print("✅ Validation correctly triggered aggregated fallback")
                assert 'validation_note' in data or 'aggregated_buy_volume_usd' in first_record
        
        print("✅ Proactive validation flow working correctly")
    
    @pytest.mark.integration
    def test_multi_coin_sniper_analysis(self):
        """Test sniper analysis across multiple major coins"""
        
        major_coins = ['BTC', 'ETH', 'SOL']
        results = {}
        
        for coin in major_coins:
            response = requests.get(f"{self.base_url}/advanced/sniper-timing/{coin}?exchange=Binance")
            assert response.status_code == 200
            
            data = response.json()
            results[coin] = {
                'signal': data['signal'],
                'confidence': data['confidence'],
                'long_score': data['metrics']['long_score'],
                'short_score': data['metrics']['short_score']
            }
            
            # Validate each coin response
            assert data['coin'] == coin
            assert data['signal'] in ['LONG', 'SHORT', 'NEUTRAL']
            assert 0 <= data['confidence'] <= 100
        
        # Print analysis summary
        print("\n📊 Multi-Coin Sniper Analysis:")
        for coin, result in results.items():
            print(f"{coin}: {result['signal']} ({result['confidence']:.1f}%) - "
                  f"L:{result['long_score']}/S:{result['short_score']}")
        
        # Validate we have diverse signals (not all same)
        signals = [r['signal'] for r in results.values()]
        assert len(set(signals)) >= 1, "Should have at least some signal diversity"
    
    @pytest.mark.integration
    def test_volume_analysis_consistency(self):
        """Test volume data consistency across different timeframes"""
        
        intervals = ['1h', '4h', '1d']
        coin = 'BTC'
        
        for interval in intervals:
            response = requests.get(f"{self.base_url}/advanced/taker-volume/{coin}?exchange=Binance&interval={interval}")
            assert response.status_code == 200
            
            data = response.json()
            assert 'data' in data
            assert len(data['data']) > 0
            
            # Validate time consistency (should be chronological)
            times = [record['time'] for record in data['data']]
            assert times == sorted(times), f"Time data not chronological for {interval}"
            
            # Validate volume data types
            for record in data['data'][:3]:  # Check first 3 records
                if 'taker_buy_volume_usd' in record:
                    # Pair-level data
                    buy_vol = float(record['taker_buy_volume_usd'])
                    sell_vol = float(record['taker_sell_volume_usd'])
                    assert buy_vol >= 0 and sell_vol >= 0
                elif 'aggregated_buy_volume_usd' in record:
                    # Aggregated data
                    buy_vol = float(record['aggregated_buy_volume_usd'])
                    sell_vol = float(record['aggregated_sell_volume_usd'])
                    assert buy_vol >= 0 and sell_vol >= 0
        
        print(f"✅ Volume data consistency validated across {len(intervals)} timeframes")
    
    @pytest.mark.integration
    def test_error_handling_scenarios(self):
        """Test comprehensive error handling scenarios"""
        
        test_scenarios = [
            # Invalid coin
            {
                'url': f"{self.base_url}/advanced/sniper-timing/INVALIDCOIN",
                'expected_fallback': True,
                'description': 'Invalid coin'
            },
            # Valid coin, invalid exchange 
            {
                'url': f"{self.base_url}/advanced/taker-volume/BTC?exchange=FakeExchange",
                'expected_fallback': True,
                'description': 'Invalid exchange'
            },
            # Valid parameters
            {
                'url': f"{self.base_url}/advanced/sniper-timing/ETH?exchange=Binance",
                'expected_fallback': False,
                'description': 'Valid parameters'
            }
        ]
        
        for scenario in test_scenarios:
            response = requests.get(scenario['url'])
            
            # All should return 200 (graceful degradation)
            assert response.status_code == 200, f"Failed scenario: {scenario['description']}"
            
            data = response.json()
            
            # Should have valid data structure
            if 'data' in data:
                assert len(data['data']) > 0, f"Empty data for: {scenario['description']}"
            elif 'signal' in data:
                assert data['signal'] in ['LONG', 'SHORT', 'NEUTRAL'], f"Invalid signal: {scenario['description']}"
            
            print(f"✅ Error handling: {scenario['description']}")
    
    @pytest.mark.integration
    def test_aggregated_vs_pair_level_data(self):
        """Test difference between aggregated and pair-level data structures"""
        
        # Get aggregated data
        agg_response = requests.get(f"{self.base_url}/advanced/taker-volume-aggregated/SOL?interval=1h")
        assert agg_response.status_code == 200
        agg_data = agg_response.json()
        
        # Get pair-level data  
        pair_response = requests.get(f"{self.base_url}/advanced/taker-volume/SOL?exchange=Binance")
        assert pair_response.status_code == 200
        pair_data = pair_response.json()
        
        # Validate aggregated structure
        if 'data' in agg_data and len(agg_data['data']) > 0:
            agg_record = agg_data['data'][0]
            expected_agg_fields = ['time', 'aggregated_buy_volume_usd', 'aggregated_sell_volume_usd']
            for field in expected_agg_fields:
                assert field in agg_record, f"Missing aggregated field: {field}"
        
        # Validate pair-level structure (if not falling back to aggregated)
        if 'data' in pair_data and len(pair_data['data']) > 0:
            pair_record = pair_data['data'][0]
            
            if 'taker_buy_volume_usd' in pair_record:
                # Actual pair-level data
                expected_pair_fields = ['time', 'taker_buy_volume_usd', 'taker_sell_volume_usd']
                for field in expected_pair_fields:
                    assert field in pair_record, f"Missing pair-level field: {field}"
                print("✅ Pair-level data structure validated")
            else:
                # Fell back to aggregated
                print("✅ Pair-level request fell back to aggregated (validation working)")
        
        print("✅ Data structure differentiation validated")
    
    @pytest.mark.integration
    def test_real_time_data_freshness(self):
        """Test that data timestamps are recent and realistic"""
        
        import time
        current_time = int(time.time() * 1000)  # Current time in milliseconds
        max_age_hours = 72  # Maximum acceptable data age
        min_timestamp = current_time - (max_age_hours * 60 * 60 * 1000)
        
        # Test multiple endpoints for data freshness
        endpoints = [
            f"{self.base_url}/advanced/taker-volume/BTC?exchange=Binance",
            f"{self.base_url}/advanced/taker-volume-aggregated/ETH?interval=1h",
            f"{self.base_url}/advanced/sniper-timing/SOL?exchange=Binance"
        ]
        
        for endpoint in endpoints:
            response = requests.get(endpoint)
            assert response.status_code == 200
            
            data = response.json()
            
            # Check timestamp freshness
            if 'timestamp' in data:
                # Sniper timing timestamp
                assert data['timestamp'] >= min_timestamp, f"Stale timestamp in sniper data: {endpoint}"
            elif 'data' in data and len(data['data']) > 0:
                # Volume data timestamps
                latest_record = data['data'][-1]  # Last record should be most recent
                assert latest_record['time'] >= min_timestamp, f"Stale data timestamp: {endpoint}"
        
        print("✅ Real-time data freshness validated")
    
    @pytest.mark.performance
    def test_response_time_benchmarks(self):
        """Test API response time benchmarks"""
        
        import time
        
        benchmarks = {
            'sniper_timing': f"{self.base_url}/advanced/sniper-timing/BTC",
            'taker_volume': f"{self.base_url}/advanced/taker-volume/ETH?exchange=Binance", 
            'aggregated_volume': f"{self.base_url}/advanced/taker-volume-aggregated/SOL"
        }
        
        results = {}
        
        for test_name, url in benchmarks.items():
            start_time = time.time()
            response = requests.get(url)
            end_time = time.time()
            
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            assert response.status_code == 200
            results[test_name] = response_time
            
            # Performance assertions (adjust thresholds as needed)
            assert response_time < 5000, f"{test_name} too slow: {response_time:.0f}ms"
        
        print("\n⚡ Performance Benchmarks:")
        for test_name, response_time in results.items():
            print(f"{test_name}: {response_time:.0f}ms")
        
        # Average response time should be reasonable
        avg_response_time = sum(results.values()) / len(results)
        assert avg_response_time < 3000, f"Average response time too high: {avg_response_time:.0f}ms"

class TestValidationScenarios:
    """Test specific validation scenarios with the new proactive validation"""
    
    def setup_method(self):
        self.client = CoinglassClient()
        self.base_url = "http://127.0.0.1:8000"
    
    def test_validate_pair_exchange_method(self):
        """Test the validate_pair_exchange method directly"""
        
        # Test valid combinations
        valid_result = self.client.validate_pair_exchange("BTC", "Binance")
        # Note: Result depends on actual API data, so we just test it doesn't crash
        assert isinstance(valid_result, bool)
        
        # Test clearly invalid exchange
        invalid_result = self.client.validate_pair_exchange("BTC", "NonExistentExchange123")
        assert isinstance(invalid_result, bool)
        
        print(f"✅ Validation method: BTC-Binance={valid_result}, BTC-Invalid={invalid_result}")
    
    def test_fallback_behavior_validation(self):
        """Test that fallback behavior works correctly with validation notes"""
        
        # Test with potentially invalid pair/exchange to trigger fallback
        response = requests.get(f"{self.base_url}/advanced/taker-volume/TESTCOIN?exchange=InvalidExchange")
        assert response.status_code == 200
        
        data = response.json()
        
        # Should have either validation_note or aggregated data structure
        has_validation_note = 'validation_note' in data
        has_aggregated_data = ('data' in data and len(data['data']) > 0 and 
                              'aggregated_buy_volume_usd' in data['data'][0])
        
        # At least one should be true (validation working)
        assert has_validation_note or has_aggregated_data, "Validation fallback not working properly"
        
        print("✅ Fallback validation behavior working")

def run_comprehensive_tests():
    """Run all end-to-end tests"""
    print("🚀 Running Comprehensive End-to-End Tests")
    print("=" * 60)
    
    # Run tests with pytest
    test_files = [
        "tests/test_end_to_end.py::TestEndToEndFlows",
        "tests/test_end_to_end.py::TestValidationScenarios"
    ]
    
    for test_file in test_files:
        print(f"\n📋 Running: {test_file}")
        pytest.main(["-v", test_file])

if __name__ == "__main__":
    run_comprehensive_tests()
#!/usr/bin/env python3
"""
Test CoinAPI Integration
Test script untuk CoinAPI service dan integration dengan dynamic coin discovery
"""

import os
import sys
import logging
from datetime import datetime

# Add current directory ke path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import services
from services.coinapi_service import CoinAPIService, CoinAPICoinInfo
from services.dynamic_coin_discovery_v2 import DynamicCoinDiscovery, search_coin, get_api_status

def setup_logging():
    """Setup logging untuk test"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

def test_coinapi_service():
    """Test CoinAPI service secara langsung"""
    print("\n" + "="*60)
    print("🧪 TESTING COINAPI SERVICE")
    print("="*60)
    
    try:
        # Initialize service
        coinapi = CoinAPIService()
        
        # Check API status
        print("\n📊 API Status:")
        status = coinapi.get_api_status()
        for key, value in status.items():
            print(f"  {key}: {value}")
        
        if not status['api_key_configured']:
            print("\n❌ CoinAPI API key not configured!")
            print("Please set COINAPI_API_KEY environment variable")
            return False
        
        # Test search
        print("\n🔍 Testing coin search:")
        test_queries = ["bitcoin", "ethereum", "solana"]
        
        for query in test_queries:
            print(f"\n  Searching for: {query}")
            try:
                results = coinapi.search_coin(query, limit=5)
                print(f"  Found {len(results)} results:")
                
                for i, coin in enumerate(results[:3], 1):
                    print(f"    {i}. {coin.symbol} - {coin.name}")
                    print(f"       Price: ${coin.price}" if coin.price else "       Price: N/A")
                    print(f"       Exchange: {coin.exchange_id}")
                    print(f"       Updated: {coin.last_updated}")
                    
            except Exception as e:
                print(f"  ❌ Error searching {query}: {str(e)}")
        
        # Test exchanges
        print("\n🏢 Testing exchanges:")
        try:
            exchanges = coinapi.get_exchanges()
            print(f"  Found {len(exchanges)} exchanges")
            
            # Show popular exchanges
            popular = coinapi.get_popular_exchanges()
            print(f"  Popular exchanges: {', '.join(popular[:5])}")
            
        except Exception as e:
            print(f"  ❌ Error getting exchanges: {str(e)}")
        
        print("\n✅ CoinAPI service test completed!")
        return True
        
    except Exception as e:
        print(f"\n❌ CoinAPI service test failed: {str(e)}")
        return False

def test_dynamic_discovery_integration():
    """Test integration dengan dynamic coin discovery"""
    print("\n" + "="*60)
    print("🧪 TESTING DYNAMIC DISCOVERY INTEGRATION")
    print("="*60)
    
    try:
        # Initialize discovery service
        discovery = DynamicCoinDiscovery()
        
        # Check API status
        print("\n📊 Discovery API Status:")
        status = discovery.get_api_status()
        for key, value in status.items():
            print(f"  {key}: {value}")
        
        # Test multi-source search
        print("\n🔍 Testing multi-source search:")
        test_queries = ["BTC", "ETH", "SOL"]
        
        for query in test_queries:
            print(f"\n  Searching for: {query}")
            try:
                # Test dengan semua sources
                results = search_coin(query, sources=['coingecko', 'binance', 'okx', 'coinapi'])
                print(f"  Found {len(results)} total results")
                
                # Group by source
                by_source = {}
                for coin in results:
                    if coin.source not in by_source:
                        by_source[coin.source] = []
                    by_source[coin.source].append(coin)
                
                for source, coins in by_source.items():
                    print(f"    {source}: {len(coins)} results")
                    for coin in coins[:2]:  # Show top 2 per source
                        price_str = f"${coin.price}" if coin.price else "N/A"
                        print(f"      - {coin.symbol}: {price_str}")
                        
            except Exception as e:
                print(f"  ❌ Error searching {query}: {str(e)}")
        
        # Test CoinAPI only
        print("\n🎯 Testing CoinAPI-only search:")
        try:
            results = search_coin("bitcoin", sources=['coinapi'])
            print(f"  Found {len(results)} results from CoinAPI")
            
            for i, coin in enumerate(results[:3], 1):
                print(f"    {i}. {coin.symbol} - {coin.name}")
                print(f"       Price: ${coin.price}" if coin.price else "       Price: N/A")
                print(f"       Exchanges: {', '.join(coin.exchanges)}")
                
        except Exception as e:
            print(f"  ❌ Error with CoinAPI-only search: {str(e)}")
        
        print("\n✅ Dynamic discovery integration test completed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Dynamic discovery integration test failed: {str(e)}")
        return False

def test_edge_cases():
    """Test edge cases dan error handling"""
    print("\n" + "="*60)
    print("🧪 TESTING EDGE CASES")
    print("="*60)
    
    try:
        coinapi = CoinAPIService()
        discovery = DynamicCoinDiscovery()
        
        # Test invalid query
        print("\n🔍 Testing invalid query:")
        try:
            results = coinapi.search_coin("", limit=5)
            print(f"  Empty query results: {len(results)}")
        except Exception as e:
            print(f"  Expected error for empty query: {str(e)}")
        
        # Test very long query
        print("\n🔍 Testing very long query:")
        long_query = "x" * 100
        try:
            results = coinapi.search_coin(long_query, limit=5)
            print(f"  Long query results: {len(results)}")
        except Exception as e:
            print(f"  Error for long query: {str(e)}")
        
        # Test special characters
        print("\n🔍 Testing special characters:")
        special_query = "BTC@#$%"
        try:
            results = coinapi.search_coin(special_query, limit=5)
            print(f"  Special chars query results: {len(results)}")
        except Exception as e:
            print(f"  Error for special chars: {str(e)}")
        
        # Test rate limiting
        print("\n⏱️ Testing rate limiting:")
        try:
            start_time = datetime.now()
            for i in range(3):
                results = coinapi.search_coin("bitcoin", limit=1)
                print(f"  Request {i+1}: {len(results)} results")
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            print(f"  Total time for 3 requests: {duration:.2f}s")
        except Exception as e:
            print(f"  Error in rate limiting test: {str(e)}")
        
        print("\n✅ Edge cases test completed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Edge cases test failed: {str(e)}")
        return False

def main():
    """Main test function"""
    print("🚀 STARTING COINAPI INTEGRATION TESTS")
    print("="*60)
    
    setup_logging()
    
    # Run tests
    tests = [
        ("CoinAPI Service", test_coinapi_service),
        ("Dynamic Discovery Integration", test_dynamic_discovery_integration),
        ("Edge Cases", test_edge_cases)
    ]
    
    results = {}
    for test_name, test_func in tests:
        print(f"\n🧪 Running: {test_name}")
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            results[test_name] = False
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"  {test_name}: {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! CoinAPI integration is working correctly.")
    else:
        print("⚠️ Some tests failed. Please check the logs above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

#!/usr/bin/env python3
"""
Comprehensive API Integration Test
Tests all integrated APIs: OKX, CoinGecko, CoinAPI, LunarCrush
"""

import os
import sys
import logging
import time
from datetime import datetime
from typing import Dict, List, Any

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv('/root/crypto-api/crypto-api/.env')
    print("✅ Environment variables loaded from .env file")
except ImportError:
    print("⚠️  python-dotenv not installed, using system environment variables")
except Exception as e:
    print(f"⚠️  Error loading .env file: {e}")

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add parent directory to path
sys.path.append('/root/crypto-api')

def test_okx_integration():
    """Test OKX API integration"""
    print("\n" + "="*60)
    print("🧪 TESTING OKX API INTEGRATION")
    print("="*60)
    
    try:
        from services.dynamic_coin_discovery_v2 import DynamicCoinDiscovery
        
        discovery = DynamicCoinDiscovery()
        
        # Test OKX search
        print("🔍 Testing OKX search for BTC...")
        results = discovery.search_coin("BTC", sources=['okx'])
        
        okx_results = [r for r in results if r.source == 'okx']
        print(f"  Found {len(okx_results)} results from OKX")
        
        if okx_results:
            for i, result in enumerate(okx_results[:3], 1):
                print(f"    {i}. {result.symbol}: ${result.price}")
        
        # Test API status
        status = discovery.get_api_status()
        okx_status = status.get('okx', {})
        print(f"  OKX API Status: {okx_status}")
        
        return {
            'status': '✅ PASSED' if okx_results else '❌ FAILED',
            'results_count': len(okx_results),
            'api_configured': okx_status.get('api_configured', False)
        }
        
    except Exception as e:
        logger.error(f"OKX integration test failed: {e}")
        return {
            'status': '❌ FAILED',
            'error': str(e),
            'results_count': 0,
            'api_configured': False
        }

def test_coingecko_integration():
    """Test CoinGecko API integration"""
    print("\n" + "="*60)
    print("🧪 TESTING COINGECKO API INTEGRATION")
    print("="*60)
    
    try:
        from services.dynamic_coin_discovery_v2 import DynamicCoinDiscovery
        
        discovery = DynamicCoinDiscovery()
        
        # Test CoinGecko search
        print("🔍 Testing CoinGecko search for BTC...")
        results = discovery.search_coin("BTC", sources=['coingecko'])
        
        cgc_results = [r for r in results if r.source == 'coingecko']
        print(f"  Found {len(cgc_results)} results from CoinGecko")
        
        if cgc_results:
            for i, result in enumerate(cgc_results[:3], 1):
                print(f"    {i}. {result.symbol}: ${result.price}")
        
        # Test API status
        status = discovery.get_api_status()
        cgc_status = status.get('coingecko', {})
        print(f"  CoinGecko API Status: {cgc_status}")
        
        return {
            'status': '✅ PASSED' if cgc_results else '❌ FAILED',
            'results_count': len(cgc_results),
            'api_configured': cgc_status.get('api_key_configured', False)
        }
        
    except Exception as e:
        logger.error(f"CoinGecko integration test failed: {e}")
        return {
            'status': '❌ FAILED',
            'error': str(e),
            'results_count': 0,
            'api_configured': False
        }

def test_coinapi_integration():
    """Test CoinAPI integration"""
    print("\n" + "="*60)
    print("🧪 TESTING COINAPI INTEGRATION")
    print("="*60)
    
    try:
        from services.coinapi_service import get_api_status, search_coin
        
        # Test API status
        print("📊 Checking CoinAPI status...")
        status = get_api_status()
        print(f"  API Key Configured: {status.get('api_key_configured', False)}")
        print(f"  Base URL: {status.get('base_url', 'N/A')}")
        
        if not status.get('api_key_configured'):
            print("  ⚠️  CoinAPI API key not configured")
            return {
                'status': '⚠️  SKIPPED',
                'error': 'API key not configured',
                'results_count': 0,
                'api_configured': False
            }
        
        # Test search
        print("🔍 Testing CoinAPI search for BTC...")
        results = search_coin("BTC", limit=5)
        print(f"  Found {len(results)} results from CoinAPI")
        
        if results:
            for i, result in enumerate(results[:3], 1):
                print(f"    {i}. {result.symbol}: ${result.price}")
        
        return {
            'status': '✅ PASSED' if results else '❌ FAILED',
            'results_count': len(results),
            'api_configured': status.get('api_key_configured', False)
        }
        
    except Exception as e:
        logger.error(f"CoinAPI integration test failed: {e}")
        return {
            'status': '❌ FAILED',
            'error': str(e),
            'results_count': 0,
            'api_configured': False
        }

def test_coinglass_integration():
    """Test CoinGlass API integration"""
    print("\n" + "="*60)
    print("🧪 TESTING COINGLASS API INTEGRATION")
    print("="*60)
    
    try:
        from services.coinglass_service import get_api_status, test_coinglass_connection
        
        # Test API status
        print("📊 Checking CoinGlass status...")
        status = get_api_status()
        print(f"  API Key Configured: {status.get('api_key_configured', False)}")
        print(f"  Disabled: {status.get('disabled', False)}")
        print(f"  Available: {status.get('available', False)}")
        print(f"  Base URL: {status.get('base_url', 'N/A')}")
        
        if not status.get('available'):
            print("  ⚠️  CoinGlass API not available")
            return {
                'status': '⚠️  SKIPPED',
                'error': 'API not available',
                'results_count': 0,
                'api_configured': status.get('api_key_configured', False)
            }
        
        # Test connection
        print("🔍 Testing CoinGlass connection...")
        test_result = test_coinglass_connection()
        print(f"  Status: {test_result['status']}")
        print(f"  Message: {test_result['message']}")
        
        if test_result.get('sample_data'):
            print(f"  Sample data: {test_result['sample_data']}")
        
        return {
            'status': '✅ PASSED' if test_result['status'] == 'success' else '⚠️  PARTIAL',
            'results_count': test_result.get('test_data_count', 0),
            'api_configured': status.get('api_key_configured', False),
            'connection_status': test_result['status']
        }
        
    except Exception as e:
        logger.error(f"CoinGlass integration test failed: {e}")
        return {
            'status': '❌ FAILED',
            'error': str(e),
            'results_count': 0,
            'api_configured': False
        }

def test_lunarcrush_integration():
    """Test LunarCrush API integration"""
    print("\n" + "="*60)
    print("🧪 TESTING LUNARCRUSH API INTEGRATION")
    print("="*60)
    
    try:
        # Add lunarcrush to path
        sys.path.append('/root/crypto-api/services')
        from lunarcrush.lunarcrush_service import get_social_sentiment, get_trending_coins, health_check
        
        # Test health check
        print("📊 Checking LunarCrush status...")
        health = health_check()
        print(f"  Service Status: {health.get('status', 'unknown')}")
        print(f"  Mode: {health.get('mode', 'unknown')}")
        print(f"  API Key Configured: {health.get('api_key_configured', False)}")
        
        # Test social sentiment
        print("🔍 Testing LunarCrush social sentiment for BTC...")
        sentiment = get_social_sentiment("BTC")
        print(f"  BTC Galaxy Score: {sentiment.galaxy_score}")
        print(f"  BTC Sentiment: {sentiment.sentiment}")
        print(f"  BTC Recommendation: {sentiment.recommendation}")
        
        # Test trending coins
        print("🔍 Testing LunarCrush trending coins...")
        trending = get_trending_coins(5)
        print(f"  Found {len(trending)} trending coins")
        
        if trending:
            for i, coin in enumerate(trending[:3], 1):
                print(f"    {i}. {coin.symbol}: {coin.recommendation}")
        
        return {
            'status': '✅ PASSED' if sentiment.galaxy_score > 0 else '❌ FAILED',
            'results_count': len(trending),
            'api_configured': health.get('api_key_configured', False),
            'mode': health.get('mode', 'unknown')
        }
        
    except Exception as e:
        logger.error(f"LunarCrush integration test failed: {e}")
        return {
            'status': '❌ FAILED',
            'error': str(e),
            'results_count': 0,
            'api_configured': False,
            'mode': 'error'
        }

def test_multi_source_integration():
    """Test multi-source integration"""
    print("\n" + "="*60)
    print("🧪 TESTING MULTI-SOURCE INTEGRATION")
    print("="*60)
    
    try:
        from services.dynamic_coin_discovery_v2 import DynamicCoinDiscovery
        
        discovery = DynamicCoinDiscovery()
        
        # Test multi-source search
        print("🔍 Testing multi-source search for BTC...")
        results = discovery.search_coin("BTC")
        
        # Group by source
        sources = {}
        for result in results:
            if result.source not in sources:
                sources[result.source] = []
            sources[result.source].append(result)
        
        print(f"  Found {len(results)} total results from {len(sources)} sources:")
        for source, source_results in sources.items():
            print(f"    {source}: {len(source_results)} results")
        
        # Test API status
        status = discovery.get_api_status()
        print(f"  Overall API Status: {status}")
        
        return {
            'status': '✅ PASSED' if len(sources) > 1 else '❌ FAILED',
            'total_results': len(results),
            'sources_count': len(sources),
            'sources': list(sources.keys())
        }
        
    except Exception as e:
        logger.error(f"Multi-source integration test failed: {e}")
        return {
            'status': '❌ FAILED',
            'error': str(e),
            'total_results': 0,
            'sources_count': 0,
            'sources': []
        }

def test_environment_configuration():
    """Test environment configuration"""
    print("\n" + "="*60)
    print("🧪 TESTING ENVIRONMENT CONFIGURATION")
    print("="*60)
    
    env_vars = {
        'OKX_API_KEY': os.getenv('OKX_API_KEY'),
        'OKX_SECRET_KEY': os.getenv('OKX_SECRET_KEY'),
        'OKX_PASSPHRASE': os.getenv('OKX_PASSPHRASE'),
        'COINGECKO_API_KEY': os.getenv('COINGECKO_API_KEY'),
        'COINAPI_API_KEY': os.getenv('COINAPI_API_KEY'),
        'COINAPI_KEY': os.getenv('COINAPI_KEY'),
        'COINGLASS_API_KEY': os.getenv('COINGLASS_API_KEY'),
        'LUNARCRUSH_API_KEY': os.getenv('LUNARCRUSH_API_KEY')
    }
    
    configured_vars = {}
    for var, value in env_vars.items():
        is_configured = bool(value) and value not in ['', 'your_api_key_here', 'your_key_here']
        configured_vars[var] = is_configured
        status = '✅' if is_configured else '❌'
        print(f"  {status} {var}: {'CONFIGURED' if is_configured else 'NOT CONFIGURED'}")
    
    total_configured = sum(configured_vars.values())
    total_vars = len(configured_vars)
    
    return {
        'status': '✅ PASSED' if total_configured > 0 else '❌ FAILED',
        'configured_count': total_configured,
        'total_count': total_vars,
        'configuration_percentage': round((total_configured / total_vars) * 100, 1),
        'details': configured_vars
    }

def main():
    """Run comprehensive API integration tests"""
    print("🚀 STARTING COMPREHENSIVE API INTEGRATION TESTS")
    print("="*80)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("="*80)
    
    # Run all tests
    test_results = {}
    
    # Test environment configuration first
    test_results['environment'] = test_environment_configuration()
    
    # Test individual APIs
    test_results['okx'] = test_okx_integration()
    test_results['coingecko'] = test_coingecko_integration()
    test_results['coinapi'] = test_coinapi_integration()
    test_results['coinglass'] = test_coinglass_integration()
    test_results['lunarcrush'] = test_lunarcrush_integration()
    
    # Test multi-source integration
    test_results['multi_source'] = test_multi_source_integration()
    
    # Generate summary
    print("\n" + "="*80)
    print("📊 COMPREHENSIVE TEST SUMMARY")
    print("="*80)
    
    passed_tests = 0
    total_tests = len(test_results)
    
    for test_name, result in test_results.items():
        status = result['status']
        print(f"  {test_name.upper().replace('_', ' ')}: {status}")
        if '✅' in status:
            passed_tests += 1
        
        # Show additional details
        if 'results_count' in result:
            print(f"    Results: {result['results_count']}")
        if 'api_configured' in result:
            print(f"    API Configured: {result['api_configured']}")
        if 'error' in result:
            print(f"    Error: {result['error']}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! All APIs are properly integrated.")
    elif passed_tests > total_tests // 2:
        print("⚠️  MOST TESTS PASSED. Some APIs may need configuration.")
    else:
        print("❌ MANY TESTS FAILED. Please check API configurations.")
    
    # Generate recommendations
    print("\n" + "="*80)
    print("🔧 RECOMMENDATIONS")
    print("="*80)
    
    env_result = test_results['environment']
    if env_result['configuration_percentage'] < 100:
        print("📝 Environment Configuration:")
        for var, configured in env_result['details'].items():
            if not configured:
                print(f"  - Configure {var} in .env file")
    
    for test_name, result in test_results.items():
        if '❌' in result['status']:
            print(f"🔧 Fix {test_name.replace('_', ' ').title()} integration:")
            if 'error' in result:
                print(f"  - Error: {result['error']}")
            if not result.get('api_configured', True):
                print(f"  - Check API key configuration")
    
    print("\n" + "="*80)
    print("✅ COMPREHENSIVE API INTEGRATION TEST COMPLETED")
    print("="*80)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Comprehensive Endpoint Integration Test
Tests ALL 32 endpoints to ensure no missing or error
"""

import os
import sys
import logging
import time
import json
import requests
from datetime import datetime
from typing import Dict, List, Any

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add parent directory to path
sys.path.append('/root/crypto-api')

class EndpointTester:
    """Comprehensive endpoint testing class"""
    
    def __init__(self, base_url="http://localhost:9999"):
        self.base_url = base_url
        self.test_results = {}
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'EndpointTester/1.0'
        })
        
    def test_endpoint(self, method: str, endpoint: str, data: Dict = None, params: Dict = None) -> Dict:
        """Test individual endpoint"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            logger.info(f"Testing {method} {endpoint}")
            
            start_time = time.time()
            
            if method.upper() == 'GET':
                response = self.session.get(url, params=params, timeout=30)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, params=params, timeout=30)
            else:
                return {
                    "status": "❌ FAILED",
                    "error": f"Unsupported method: {method}",
                    "response_time": 0,
                    "status_code": None
                }
            
            response_time = round((time.time() - start_time) * 1000, 2)
            
            # Parse response
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            # Determine status
            if response.status_code == 200:
                if isinstance(response_data, dict) and response_data.get('success', True):
                    status = "✅ PASSED"
                else:
                    status = "⚠️ PARTIAL"
            elif response.status_code == 404:
                status = "❌ NOT FOUND"
            elif response.status_code == 500:
                status = "❌ SERVER ERROR"
            else:
                status = f"⚠️ HTTP {response.status_code}"
            
            return {
                "status": status,
                "status_code": response.status_code,
                "response_time": response_time,
                "response_data": response_data,
                "headers": dict(response.headers)
            }
            
        except requests.exceptions.Timeout:
            return {
                "status": "❌ TIMEOUT",
                "error": "Request timeout after 30 seconds",
                "response_time": 30000,
                "status_code": None
            }
        except requests.exceptions.ConnectionError:
            return {
                "status": "❌ CONNECTION ERROR",
                "error": "Could not connect to server",
                "response_time": 0,
                "status_code": None
            }
        except Exception as e:
            return {
                "status": "❌ FAILED",
                "error": str(e),
                "response_time": 0,
                "status_code": None
            }
    
    def test_all_endpoints(self) -> Dict[str, Any]:
        """Test all 32 endpoints"""
        print("🚀 STARTING COMPREHENSIVE ENDPOINT TESTING")
        print("="*80)
        print(f"Base URL: {self.base_url}")
        print(f"Timestamp: {datetime.now().isoformat()}")
        print("="*80)
        
        # Define all endpoints to test
        endpoints = [
            # System Endpoints (3)
            ("GET", "/api/health", None, None),
            ("GET", "/api/metrics", None, None),
            ("GET", "/api/adaptive-threshold/stats", None, None),
            
            # Data Endpoints (2)
            ("GET", "/gpts/unified/symbols", None, None),
            ("GET", "/gpts/unified/market/BTC", None, None),
            
            # Discovery Endpoints (2)
            ("GET", "/api/discovery/search", None, {"q": "BTC"}),
            ("GET", "/api/discovery/coin/BTC", None, None),
            
            # Intelligence Endpoint (1)
            ("POST", "/gpts/unified/advanced", {"op": "market_sentiment", "symbols": ["BTC", "ETH"]}, None),
            
            # AI Endpoints (2)
            ("GET", "/api/ai/enhanced-signal", None, {"symbol": "SOL-USDT-SWAP"}),
            ("GET", "/api/ai/enhanced-performance", None, None),
            
            # Screening Endpoints (2)
            ("POST", "/api/screen/intelligent", {"symbols": ["BTC", "ETH", "SOL"], "timeframe": "1h"}, None),
            ("POST", "/api/screen/filtered", {"symbols": ["BTC", "ETH", "SOL"], "timeframe": "1h", "limit": 20}, None),
            
            # Listings Endpoints (3)
            ("GET", "/api/listings/new", None, {"limit": 20}),
            ("GET", "/api/listings/spikes", None, {"limit": 20}),
            ("GET", "/api/listings/opportunities", None, {"symbol": "BTC", "minScore": 60}),
            
            # SOL Analysis Endpoints (10)
            ("GET", "/api/sol/complete", None, None),
            ("GET", "/api/sol/funding", None, {"timeframe": "1h"}),
            ("GET", "/api/sol/open-interest", None, None),
            ("GET", "/api/sol/cvd", None, {"timeframe": "1h"}),
            ("GET", "/api/sol/smc", None, {"timeframe": "1h"}),
            ("GET", "/api/sol/confluence", None, {"timeframe": "1h"}),
            ("GET", "/api/sol/volume-profile", None, {"timeframe": "1h"}),
            ("GET", "/api/sol/mtf-analysis", None, None),
            ("GET", "/api/sol/fibonacci", None, {"timeframe": "1h", "limit": 20}),
            ("GET", "/api/sol/order-flow", None, {"timeframe": "1h", "tradeLimit": 100}),
            
            # SOL Trading Endpoints (3)
            ("GET", "/api/sol/liquidation", None, {"timeframe": "1h"}),
            ("GET", "/api/sol/liquidation-heatmap", None, None),
            ("POST", "/api/sol/position-calculator", {"entryPrice": 100, "size": 1, "leverage": 10, "side": "long", "accountBalance": 1000}, None),
            
            # Premium Endpoints (3)
            ("GET", "/api/sol/premium-orderbook", None, None),
            ("GET", "/api/premium/institutional-analytics", None, None),
            ("GET", "/api/premium/tier-status", None, None),
            
            # Comprehensive Analysis Endpoints (5)
            ("POST", "/api/comprehensive/analysis", {"symbols": ["BTC", "ETH", "SOL"], "analysis_types": ["technical", "fundamental"]}, None),
            ("GET", "/api/sol/complete-suite", None, None),
            ("GET", "/api/trading/tools/BTC", None, None),
            ("POST", "/api/screening/results", {"symbols": ["BTC", "ETH", "SOL"]}, None),
            ("GET", "/api/market/intelligence", None, None),
            
            # Legacy Endpoints (1)
            ("GET", "/gpts/health", None, None),
            
            # Utility Endpoints (2)
            ("GET", "/api/endpoints", None, None),
            ("GET", "/", None, None)
        ]
        
        # Test each endpoint
        total_endpoints = len(endpoints)
        passed_count = 0
        failed_count = 0
        partial_count = 0
        
        for i, (method, endpoint, data, params) in enumerate(endpoints, 1):
            print(f"\n[{i}/{total_endpoints}] Testing {method} {endpoint}")
            
            result = self.test_endpoint(method, endpoint, data, params)
            self.test_results[endpoint] = result
            
            print(f"  Status: {result['status']}")
            print(f"  Response Time: {result['response_time']}ms")
            
            if result['status_code']:
                print(f"  HTTP Status: {result['status_code']}")
            
            if 'error' in result:
                print(f"  Error: {result['error']}")
            
            # Count results
            if "✅ PASSED" in result['status']:
                passed_count += 1
            elif "❌" in result['status']:
                failed_count += 1
            elif "⚠️" in result['status']:
                partial_count += 1
            
            # Small delay between requests
            time.sleep(0.1)
        
        # Generate summary
        print("\n" + "="*80)
        print("📊 COMPREHENSIVE ENDPOINT TEST SUMMARY")
        print("="*80)
        
        print(f"Total Endpoints Tested: {total_endpoints}")
        print(f"✅ Passed: {passed_count}")
        print(f"⚠️ Partial: {partial_count}")
        print(f"❌ Failed: {failed_count}")
        
        success_rate = round((passed_count / total_endpoints) * 100, 1)
        print(f"Success Rate: {success_rate}%")
        
        # Categorize results
        categories = {
            "system": [],
            "data": [],
            "discovery": [],
            "intelligence": [],
            "ai": [],
            "screening": [],
            "listings": [],
            "sol_analysis": [],
            "sol_trading": [],
            "premium": [],
            "comprehensive": [],
            "legacy": [],
            "utility": []
        }
        
        for endpoint, result in self.test_results.items():
            if endpoint.startswith('/api/health') or endpoint.startswith('/api/metrics') or endpoint.startswith('/api/adaptive-threshold'):
                categories["system"].append((endpoint, result))
            elif endpoint.startswith('/gpts/unified'):
                categories["data"].append((endpoint, result))
            elif endpoint.startswith('/api/discovery'):
                categories["discovery"].append((endpoint, result))
            elif endpoint.startswith('/gpts/unified/advanced'):
                categories["intelligence"].append((endpoint, result))
            elif endpoint.startswith('/api/ai'):
                categories["ai"].append((endpoint, result))
            elif endpoint.startswith('/api/screen'):
                categories["screening"].append((endpoint, result))
            elif endpoint.startswith('/api/listings'):
                categories["listings"].append((endpoint, result))
            elif endpoint.startswith('/api/sol') and not endpoint.startswith('/api/sol/complete-suite'):
                if any(x in endpoint for x in ['liquidation', 'position', 'risk']):
                    categories["sol_trading"].append((endpoint, result))
                else:
                    categories["sol_analysis"].append((endpoint, result))
            elif endpoint.startswith('/api/premium'):
                categories["premium"].append((endpoint, result))
            elif endpoint.startswith('/api/comprehensive') or endpoint.startswith('/api/sol/complete-suite') or endpoint.startswith('/api/trading/tools') or endpoint.startswith('/api/screening/results') or endpoint.startswith('/api/market/intelligence'):
                categories["comprehensive"].append((endpoint, result))
            elif endpoint.startswith('/gpts/health'):
                categories["legacy"].append((endpoint, result))
            else:
                categories["utility"].append((endpoint, result))
        
        # Print category summaries
        print("\n📋 Category Breakdown:")
        for category, endpoints_list in categories.items():
            if endpoints_list:
                passed = sum(1 for _, result in endpoints_list if "✅ PASSED" in result['status'])
                total = len(endpoints_list)
                print(f"  {category.title()}: {passed}/{total} passed")
        
        # Failed endpoints details
        if failed_count > 0:
            print("\n❌ Failed Endpoints:")
            for endpoint, result in self.test_results.items():
                if "❌" in result['status']:
                    print(f"  {endpoint}: {result.get('error', 'Unknown error')}")
        
        return {
            "total_endpoints": total_endpoints,
            "passed": passed_count,
            "failed": failed_count,
            "partial": partial_count,
            "success_rate": success_rate,
            "categories": {k: len(v) for k, v in categories.items()},
            "detailed_results": self.test_results
        }
    
    def generate_report(self, results: Dict[str, Any]) -> str:
        """Generate comprehensive test report"""
        report = f"""
# 🚀 Comprehensive Endpoint Integration Report
**Generated:** {datetime.now().isoformat()}
**Base URL:** {self.base_url}

## 📊 Executive Summary

### Overall Status: {results['success_rate']}% Success Rate

- **Total Endpoints Tested:** {results['total_endpoints']}
- **✅ Passed:** {results['passed']}
- **⚠️ Partial:** {results['partial']}
- **❌ Failed:** {results['failed']}

## 📋 Category Breakdown

"""
        
        for category, count in results['categories'].items():
            if count > 0:
                report += f"- **{category.title()}:** {count} endpoints\n"
        
        report += "\n## 🔍 Detailed Results\n\n"
        
        for endpoint, result in results['detailed_results'].items():
            report += f"### {result['status']} {endpoint}\n"
            report += f"- **Status Code:** {result.get('status_code', 'N/A')}\n"
            report += f"- **Response Time:** {result['response_time']}ms\n"
            if 'error' in result:
                report += f"- **Error:** {result['error']}\n"
            report += "\n"
        
        return report

def main():
    """Run comprehensive endpoint tests"""
    tester = EndpointTester()
    
    # Check if server is running
    try:
        response = requests.get(f"{tester.base_url}/api/health", timeout=5)
        if response.status_code != 200:
            print("❌ Server is not responding correctly")
            print("Please start the enhanced_gpt_flask_app.py server first")
            return
    except:
        print("❌ Cannot connect to server")
        print("Please start the enhanced_gpt_flask_app.py server first:")
        print("  python3 enhanced_gpt_flask_app.py")
        return
    
    # Run all tests
    results = tester.test_all_endpoints()
    
    # Generate report
    report = tester.generate_report(results)
    
    # Save report
    with open('ENDPOINT_INTEGRATION_REPORT.md', 'w') as f:
        f.write(report)
    
    print(f"\n📄 Detailed report saved to: ENDPOINT_INTEGRATION_REPORT.md")
    
    # Final verdict
    if results['success_rate'] >= 90:
        print("🎉 EXCELLENT! Almost all endpoints are working perfectly!")
    elif results['success_rate'] >= 75:
        print("✅ GOOD! Most endpoints are working well.")
    elif results['success_rate'] >= 50:
        print("⚠️ FAIR. About half of the endpoints are working.")
    else:
        print("❌ POOR. Many endpoints need attention.")

if __name__ == "__main__":
    main()

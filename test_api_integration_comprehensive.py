#!/usr/bin/env python3
"""
Comprehensive API Integration Test
Tests all API endpoints and their integration with external services
"""

import os
import sys
import json
import time
import requests
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from collections import defaultdict

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not installed. Using system env vars only.")

# Configuration
BASE_URLS = {
    'node': os.getenv('BASE_URL_NODE', 'http://localhost:5000'),
    'python': os.getenv('BASE_URL_PYTHON', 'http://localhost:8000'),
    'flask': os.getenv('BASE_URL_FLASK', 'http://localhost:9999')
}

API_KEYS = {
    'COINAPI_KEY': os.getenv('COINAPI_KEY', ''),
    'COINGLASS_API_KEY': os.getenv('COINGLASS_API_KEY', ''),
    'COINGECKO_API_KEY': os.getenv('COINGECKO_API_KEY', ''),
    'LUNARCRUSH_API_KEY': os.getenv('LUNARCRUSH_API_KEY', ''),
    'OKX_API_KEY': os.getenv('OKX_API_KEY', ''),
    'GUARDIANS_API_KEY': os.getenv('GUARDIANS_API_KEY', '')
}

TIMEOUT = 15

class APIIntegrationTester:
    """Comprehensive API integration testing"""

    def __init__(self):
        self.results = defaultdict(list)
        self.summary = {
            'total_tests': 0,
            'passed': 0,
            'failed': 0,
            'warnings': 0,
            'start_time': datetime.now().isoformat()
        }
        self.api_status = {}

    def print_header(self):
        """Print test header"""
        print("\n" + "=" * 80)
        print("🧪 COMPREHENSIVE API INTEGRATION TEST")
        print("=" * 80)
        print(f"Started: {self.summary['start_time']}")
        print(f"Testing: {len(BASE_URLS)} server(s)")
        print(f"API Keys Configured: {sum(1 for k, v in API_KEYS.items() if v)}/{len(API_KEYS)}")
        print("=" * 80)

    def test_server_availability(self) -> Dict[str, bool]:
        """Test if servers are running"""
        print("\n📡 STEP 1: Testing Server Availability")
        print("-" * 80)

        availability = {}
        for name, url in BASE_URLS.items():
            try:
                response = requests.get(f"{url}/health", timeout=5)
                available = response.status_code in [200, 404]  # 404 means server is up
                availability[name] = available
                status = "✅ UP" if available else "❌ DOWN"
                print(f"  {name:10s} ({url:30s}) → {status}")
            except Exception as e:
                availability[name] = False
                print(f"  {name:10s} ({url:30s}) → ❌ DOWN ({type(e).__name__})")

        return availability

    def test_api_key_configuration(self):
        """Test API key configuration"""
        print("\n🔑 STEP 2: API Key Configuration")
        print("-" * 80)

        for api_name, api_key in API_KEYS.items():
            configured = bool(api_key)
            status = "✅" if configured else "❌"
            masked = f"{api_key[:8]}...{api_key[-4:]}" if len(api_key) > 12 else "NOT SET"
            print(f"  {status} {api_name:20s} → {masked if configured else '❌ NOT CONFIGURED'}")

            self.api_status[api_name] = {
                'configured': configured,
                'key_length': len(api_key) if api_key else 0
            }

    def test_endpoint(self, name: str, url: str, method: str = 'GET',
                     expected_status: int = 200, data: Optional[Dict] = None,
                     required_api: Optional[str] = None) -> Dict[str, Any]:
        """Test a single endpoint"""

        result = {
            'name': name,
            'url': url,
            'method': method,
            'expected_status': expected_status,
            'required_api': required_api,
            'success': False,
            'status_code': None,
            'response_time_ms': 0,
            'error': None,
            'has_data': False,
            'api_integrated': False
        }

        try:
            start = time.time()
            if method == 'GET':
                response = requests.get(url, timeout=TIMEOUT)
            else:
                response = requests.post(url, json=data, timeout=TIMEOUT)

            result['response_time_ms'] = int((time.time() - start) * 1000)
            result['status_code'] = response.status_code

            # Check success
            if response.status_code == expected_status:
                result['success'] = True

                # Parse response
                try:
                    json_data = response.json()
                    result['has_data'] = bool(json_data)

                    # Check if API is actually integrated (has real data)
                    if isinstance(json_data, dict):
                        # Check for common success indicators
                        if json_data.get('success') or json_data.get('data') or json_data.get('results'):
                            result['api_integrated'] = True

                        # Check for error indicators
                        if json_data.get('error') or json_data.get('message', '').lower().find('error') >= 0:
                            result['api_integrated'] = False
                            result['error'] = json_data.get('error') or json_data.get('message')

                    elif isinstance(json_data, list) and len(json_data) > 0:
                        result['api_integrated'] = True

                except Exception as e:
                    result['has_data'] = False

            elif response.status_code == 403:
                result['error'] = 'Forbidden - Check API key'
            elif response.status_code == 404:
                result['error'] = 'Endpoint not found'
            elif response.status_code == 429:
                result['error'] = 'Rate limit exceeded'
            elif response.status_code >= 500:
                result['error'] = f'Server error: {response.status_code}'
            else:
                result['error'] = f'Unexpected status: {response.status_code}'

        except requests.exceptions.Timeout:
            result['error'] = 'Request timeout'
        except requests.exceptions.ConnectionError:
            result['error'] = 'Connection failed'
        except Exception as e:
            result['error'] = f'{type(e).__name__}: {str(e)[:100]}'

        return result

    def test_coingecko_integration(self, base_url: str):
        """Test CoinGecko API integration"""
        print("\n🦎 STEP 3: Testing CoinGecko Integration")
        print("-" * 80)

        endpoints = [
            {
                'name': 'CoinGecko - Market Data',
                'url': f'{base_url}/api/coingecko/market',
                'expected': 200
            },
            {
                'name': 'CoinGecko - Trending Coins',
                'url': f'{base_url}/api/coingecko/trending',
                'expected': 200
            },
            {
                'name': 'CoinGecko - Coin Info',
                'url': f'{base_url}/api/coingecko/coin/bitcoin',
                'expected': 200
            }
        ]

        for endpoint in endpoints:
            result = self.test_endpoint(
                endpoint['name'],
                endpoint['url'],
                expected_status=endpoint['expected'],
                required_api='COINGECKO_API_KEY'
            )
            self.results['coingecko'].append(result)
            self._print_test_result(result)

    def test_coinapi_integration(self, base_url: str):
        """Test CoinAPI integration"""
        print("\n💰 STEP 4: Testing CoinAPI Integration")
        print("-" * 80)

        if not API_KEYS['COINAPI_KEY']:
            print("  ⚠️  COINAPI_KEY not configured - skipping tests")
            return

        endpoints = [
            {
                'name': 'CoinAPI - Exchanges',
                'url': 'https://rest.coinapi.io/v1/exchanges',
                'expected': 200
            },
            {
                'name': 'CoinAPI - BTC/USD Rate',
                'url': 'https://rest.coinapi.io/v1/exchangerate/BTC/USD',
                'expected': 200
            }
        ]

        headers = {'X-CoinAPI-Key': API_KEYS['COINAPI_KEY']}

        for endpoint in endpoints:
            try:
                start = time.time()
                response = requests.get(endpoint['url'], headers=headers, timeout=TIMEOUT)
                response_time = int((time.time() - start) * 1000)

                result = {
                    'name': endpoint['name'],
                    'url': endpoint['url'],
                    'method': 'GET',
                    'success': response.status_code == 200,
                    'status_code': response.status_code,
                    'response_time_ms': response_time,
                    'api_integrated': response.status_code == 200,
                    'has_data': response.status_code == 200,
                    'required_api': 'COINAPI_KEY'
                }

                if response.status_code == 403:
                    result['error'] = 'Invalid API key'
                elif response.status_code == 429:
                    result['error'] = 'Rate limit exceeded'

                self.results['coinapi'].append(result)
                self._print_test_result(result)

            except Exception as e:
                result = {
                    'name': endpoint['name'],
                    'url': endpoint['url'],
                    'success': False,
                    'error': str(e)[:100]
                }
                self.results['coinapi'].append(result)
                self._print_test_result(result)

    def test_okx_integration(self, base_url: str):
        """Test OKX API integration"""
        print("\n🟦 STEP 5: Testing OKX Integration")
        print("-" * 80)

        endpoints = [
            {
                'name': 'OKX - Market Data',
                'url': f'{base_url}/api/okx/ticker/BTC-USDT',
                'expected': 200
            },
            {
                'name': 'OKX - Orderbook',
                'url': f'{base_url}/api/okx/orderbook/BTC-USDT',
                'expected': 200
            }
        ]

        for endpoint in endpoints:
            result = self.test_endpoint(
                endpoint['name'],
                endpoint['url'],
                expected_status=endpoint['expected'],
                required_api='OKX_API_KEY'
            )
            self.results['okx'].append(result)
            self._print_test_result(result)

    def test_coinglass_integration(self, base_url: str):
        """Test CoinGlass API integration"""
        print("\n🔍 STEP 6: Testing CoinGlass Integration")
        print("-" * 80)

        if not API_KEYS['COINGLASS_API_KEY']:
            print("  ⚠️  COINGLASS_API_KEY not configured - skipping tests")
            return

        endpoints = [
            {
                'name': 'CoinGlass - Open Interest',
                'url': f'{base_url}/api/coinglass/open-interest/BTC',
                'expected': 200
            },
            {
                'name': 'CoinGlass - Funding Rate',
                'url': f'{base_url}/api/coinglass/funding-rate/BTC',
                'expected': 200
            }
        ]

        for endpoint in endpoints:
            result = self.test_endpoint(
                endpoint['name'],
                endpoint['url'],
                expected_status=endpoint['expected'],
                required_api='COINGLASS_API_KEY'
            )
            self.results['coinglass'].append(result)
            self._print_test_result(result)

    def test_lunarcrush_integration(self, base_url: str):
        """Test LunarCrush API integration"""
        print("\n🌙 STEP 7: Testing LunarCrush Integration")
        print("-" * 80)

        endpoints = [
            {
                'name': 'LunarCrush - Social Sentiment',
                'url': f'{base_url}/api/lunarcrush/sentiment/BTC',
                'expected': 200
            },
            {
                'name': 'LunarCrush - Trending',
                'url': f'{base_url}/api/lunarcrush/trending',
                'expected': 200
            }
        ]

        for endpoint in endpoints:
            result = self.test_endpoint(
                endpoint['name'],
                endpoint['url'],
                expected_status=endpoint['expected'],
                required_api='LUNARCRUSH_API_KEY'
            )
            self.results['lunarcrush'].append(result)
            self._print_test_result(result)

    def test_guardians_integration(self, base_url: str):
        """Test Guardians API integration"""
        print("\n🛡️  STEP 8: Testing Guardians Integration")
        print("-" * 80)

        endpoints = [
            {
                'name': 'Guardians - Token Analysis',
                'url': f'{base_url}/api/guardians/analyze/SOL',
                'expected': 200
            },
            {
                'name': 'Guardians - Orderbook Premium',
                'url': f'{base_url}/api/guardians/orderbook/SOLUSDT',
                'expected': 200
            }
        ]

        for endpoint in endpoints:
            result = self.test_endpoint(
                endpoint['name'],
                endpoint['url'],
                expected_status=endpoint['expected'],
                required_api='GUARDIANS_API_KEY'
            )
            self.results['guardians'].append(result)
            self._print_test_result(result)

    def _print_test_result(self, result: Dict[str, Any]):
        """Print formatted test result"""
        if result['success']:
            icon = "✅"
            status = "PASS"
        elif result.get('error'):
            icon = "❌"
            status = "FAIL"
        else:
            icon = "⚠️"
            status = "WARN"

        time_str = f"{result['response_time_ms']}ms" if result.get('response_time_ms') else "N/A"
        api_status = "🔗 Integrated" if result.get('api_integrated') else "⚠️  No Data"

        print(f"  {icon} {result['name']:40s} | {time_str:8s} | {api_status}")

        if result.get('error'):
            print(f"     ↳ Error: {result['error']}")

        # Update summary
        self.summary['total_tests'] += 1
        if result['success']:
            if result.get('api_integrated'):
                self.summary['passed'] += 1
            else:
                self.summary['warnings'] += 1
        else:
            self.summary['failed'] += 1

    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n" + "=" * 80)
        print("📊 INTEGRATION TEST SUMMARY")
        print("=" * 80)

        # Overall stats
        print(f"\n📈 Overall Statistics:")
        print(f"  Total Tests: {self.summary['total_tests']}")
        print(f"  ✅ Passed: {self.summary['passed']}")
        print(f"  ⚠️  Warnings: {self.summary['warnings']}")
        print(f"  ❌ Failed: {self.summary['failed']}")

        success_rate = (self.summary['passed'] / self.summary['total_tests'] * 100) if self.summary['total_tests'] > 0 else 0
        print(f"  Success Rate: {success_rate:.1f}%")

        # API-specific results
        print(f"\n🔍 API Integration Status:")
        for api_name, tests in self.results.items():
            if not tests:
                continue

            passed = sum(1 for t in tests if t.get('success') and t.get('api_integrated'))
            total = len(tests)
            status = "✅" if passed == total else "⚠️" if passed > 0 else "❌"

            print(f"  {status} {api_name.upper():15s} → {passed}/{total} tests passed")

        # Recommendations
        print(f"\n💡 Recommendations:")

        not_configured = [k for k, v in API_KEYS.items() if not v]
        if not_configured:
            print(f"  📝 Configure API keys for: {', '.join(not_configured)}")

        if self.summary['failed'] > 0:
            print(f"  🔧 Fix {self.summary['failed']} failed endpoint(s)")

        if self.summary['warnings'] > 0:
            print(f"  ⚠️  Investigate {self.summary['warnings']} endpoint(s) with no data")

        print("\n" + "=" * 80)

        # Save JSON report
        report = {
            'summary': self.summary,
            'api_status': self.api_status,
            'results': {k: v for k, v in self.results.items()},
            'timestamp': datetime.now().isoformat()
        }

        with open('api_integration_test_results.json', 'w') as f:
            json.dump(report, f, indent=2)

        print(f"💾 Detailed report saved to: api_integration_test_results.json")

        return success_rate >= 70  # 70% success rate threshold

    def run_all_tests(self):
        """Run all integration tests"""
        self.print_header()

        # Test server availability first
        availability = self.test_server_availability()

        # Test API key configuration
        self.test_api_key_configuration()

        # Find an available server
        available_server = None
        for name, available in availability.items():
            if available:
                available_server = BASE_URLS[name]
                break

        if not available_server:
            print("\n❌ ERROR: No servers are running!")
            print("Please start a server first:")
            print("  - Node: npm start (port 5000)")
            print("  - Python: python app.py (port 8000)")
            print("  - Flask: python enhanced_gpt_flask_app.py (port 9999)")
            return False

        print(f"\n✅ Using server: {available_server}")

        # Run API-specific tests
        self.test_coingecko_integration(available_server)
        self.test_coinapi_integration(available_server)
        self.test_okx_integration(available_server)
        self.test_coinglass_integration(available_server)
        self.test_lunarcrush_integration(available_server)
        self.test_guardians_integration(available_server)

        # Generate report
        return self.generate_report()

def main():
    """Main execution"""
    tester = APIIntegrationTester()
    success = tester.run_all_tests()

    return 0 if success else 1

if __name__ == '__main__':
    exit(main())

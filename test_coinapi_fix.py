#!/usr/bin/env python3
"""
CoinAPI Integration Fix & Test Script
Tests CoinAPI connection and provides detailed diagnostics
"""

import os
import requests
import json
from datetime import datetime
from typing import Dict, Any, Optional

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not installed. Install with: pip install python-dotenv")

class CoinAPITester:
    """Test and diagnose CoinAPI integration issues"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('COINAPI_KEY', '')
        self.base_url = 'https://rest.coinapi.io/v1'
        self.headers = {
            'X-CoinAPI-Key': self.api_key,
            'Accept': 'application/json'
        }

    def test_connection(self) -> Dict[str, Any]:
        """Test basic CoinAPI connection"""
        print("\n🔍 Testing CoinAPI Connection...")
        print("=" * 60)

        result = {
            'success': False,
            'api_key_configured': bool(self.api_key),
            'api_key_length': len(self.api_key) if self.api_key else 0,
            'tests': []
        }

        # Check 1: API Key Configuration
        print(f"1️⃣  API Key Configured: {'✅ YES' if self.api_key else '❌ NO'}")
        if self.api_key:
            masked_key = self.api_key[:8] + '...' + self.api_key[-4:] if len(self.api_key) > 12 else '***'
            print(f"   API Key (masked): {masked_key}")
            print(f"   Key Length: {len(self.api_key)} characters")
        else:
            print("   ❌ ERROR: COINAPI_KEY not set in .env file")
            print("   📝 To fix: Get a free API key from https://www.coinapi.io/")
            result['error'] = 'API key not configured'
            return result

        # Check 2: Test Metadata Endpoint (lightweight test)
        print(f"\n2️⃣  Testing Metadata Endpoint...")
        try:
            response = requests.get(
                f'{self.base_url}/exchanges',
                headers=self.headers,
                timeout=10
            )

            test_result = {
                'endpoint': '/v1/exchanges',
                'status_code': response.status_code,
                'success': response.status_code == 200,
                'response_time_ms': int(response.elapsed.total_seconds() * 1000)
            }

            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ SUCCESS - Status: {response.status_code}")
                print(f"   ⚡ Response Time: {test_result['response_time_ms']}ms")
                print(f"   📊 Exchanges Found: {len(data)}")
                test_result['data_count'] = len(data)
                result['success'] = True

            elif response.status_code == 403:
                print(f"   ❌ FAILED - Status: 403 Forbidden")
                print(f"   🔑 ERROR: API key is invalid or expired")
                print(f"   📝 Solutions:")
                print(f"      1. Verify your API key at https://www.coinapi.io/")
                print(f"      2. Check if your key has expired")
                print(f"      3. Ensure you're using the correct key (not API Secret)")
                print(f"      4. Get a new free API key if needed")
                test_result['error'] = 'Invalid or expired API key'

            elif response.status_code == 429:
                print(f"   ⚠️  WARNING - Status: 429 Rate Limit")
                print(f"   ⏱️  You've exceeded your API quota")
                print(f"   💡 Free tier: 100 requests/day")
                print(f"   📝 Consider upgrading your plan")
                test_result['error'] = 'Rate limit exceeded'

            elif response.status_code == 401:
                print(f"   ❌ FAILED - Status: 401 Unauthorized")
                print(f"   🔑 ERROR: Missing or incorrect API key")
                test_result['error'] = 'Unauthorized - check API key'

            else:
                print(f"   ❌ FAILED - Status: {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                test_result['error'] = f'Unexpected status code: {response.status_code}'

            result['tests'].append(test_result)

        except requests.exceptions.Timeout:
            print(f"   ❌ TIMEOUT - Request took too long")
            result['tests'].append({
                'endpoint': '/v1/exchanges',
                'error': 'Request timeout',
                'success': False
            })

        except requests.exceptions.ConnectionError as e:
            print(f"   ❌ CONNECTION ERROR")
            print(f"   Network issue: {str(e)[:100]}")
            result['tests'].append({
                'endpoint': '/v1/exchanges',
                'error': 'Connection error',
                'success': False
            })

        except Exception as e:
            print(f"   ❌ UNEXPECTED ERROR: {type(e).__name__}")
            print(f"   {str(e)[:200]}")
            result['tests'].append({
                'endpoint': '/v1/exchanges',
                'error': str(e),
                'success': False
            })

        # Check 3: Test Quote Endpoint (if basic test passed)
        if result.get('success'):
            print(f"\n3️⃣  Testing Quote Endpoint (BTC/USD)...")
            try:
                response = requests.get(
                    f'{self.base_url}/exchangerate/BTC/USD',
                    headers=self.headers,
                    timeout=10
                )

                if response.status_code == 200:
                    data = response.json()
                    print(f"   ✅ SUCCESS - BTC/USD Rate: ${data.get('rate', 0):,.2f}")
                    result['tests'].append({
                        'endpoint': '/v1/exchangerate/BTC/USD',
                        'status_code': 200,
                        'success': True,
                        'rate': data.get('rate')
                    })
                else:
                    print(f"   ⚠️  Status: {response.status_code}")

            except Exception as e:
                print(f"   ⚠️  Could not test quote endpoint: {str(e)[:100]}")

        return result

    def get_api_key_instructions(self):
        """Print instructions for getting a CoinAPI key"""
        print("\n" + "=" * 60)
        print("📝 HOW TO GET A FREE COINAPI KEY")
        print("=" * 60)
        print("""
1. Visit: https://www.coinapi.io/

2. Click "Get Free API Key"

3. Fill in:
   - Email address
   - Password
   - Your use case (select "Personal/Learning")

4. Verify your email

5. Copy your API key from the dashboard

6. Add to .env file:
   COINAPI_KEY=your-actual-api-key-here

7. Free tier includes:
   ✓ 100 requests per day
   ✓ Access to all endpoints
   ✓ Real-time data
   ✓ Historical data

8. For production, consider:
   - Startup Plan: $79/month (100,000 requests/month)
   - Streamer Plan: $299/month (1,000,000 requests/month)
        """)

    def generate_report(self, result: Dict[str, Any]):
        """Generate detailed test report"""
        print("\n" + "=" * 60)
        print("📊 COINAPI INTEGRATION TEST REPORT")
        print("=" * 60)
        print(f"Timestamp: {datetime.now().isoformat()}")
        print(f"Overall Status: {'✅ PASSED' if result.get('success') else '❌ FAILED'}")
        print(f"API Key Configured: {'✅ YES' if result.get('api_key_configured') else '❌ NO'}")

        if result.get('tests'):
            print(f"\nTests Run: {len(result['tests'])}")
            print(f"Passed: {sum(1 for t in result['tests'] if t.get('success'))}")
            print(f"Failed: {sum(1 for t in result['tests'] if not t.get('success'))}")

        if not result.get('success'):
            print("\n🔧 RECOMMENDED ACTIONS:")
            if not result.get('api_key_configured'):
                print("   1. Get a free API key from https://www.coinapi.io/")
                print("   2. Add it to .env file: COINAPI_KEY=your-key-here")
                print("   3. Restart your application")
            else:
                print("   1. Verify your API key is correct")
                print("   2. Check if your API key has expired")
                print("   3. Ensure you haven't exceeded rate limits")
                print("   4. Try generating a new API key")
        else:
            print("\n✅ COINAPI integration is working correctly!")
            print("   Your application can now use CoinAPI for:")
            print("   - Real-time crypto prices")
            print("   - Historical OHLCV data")
            print("   - Exchange rates")
            print("   - Market data")

        print("=" * 60)

def main():
    """Main test execution"""
    print("\n🚀 CoinAPI Integration Fix & Test")
    print("=" * 60)

    # Initialize tester
    tester = CoinAPITester()

    # Run tests
    result = tester.test_connection()

    # Generate report
    tester.generate_report(result)

    # Show instructions if needed
    if not result.get('success'):
        tester.get_api_key_instructions()

    # Save results
    try:
        with open('coinapi_test_results.json', 'w') as f:
            json.dump(result, f, indent=2)
        print(f"\n💾 Results saved to: coinapi_test_results.json")
    except Exception as e:
        print(f"\n⚠️  Could not save results: {e}")

    # Exit code
    exit_code = 0 if result.get('success') else 1
    return exit_code

if __name__ == '__main__':
    exit(main())

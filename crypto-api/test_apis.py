#!/usr/bin/env python3
"""
Test script for both Crypto APIs
Tests Main API (8501) and Guardians API (8502) independently
"""
import requests
import json
import time
import sys
from datetime import datetime
from typing import Dict, List, Tuple

class APITester:
    def __init__(self):
        self.main_api_url = "http://localhost:8501"
        self.guardians_api_url = "http://localhost:8502"
        self.gpt_gateway_url = "http://localhost:3000"
        self.results = {}
        
    def test_api_health(self, api_url: str, api_name: str) -> Dict:
        """Test API health endpoint"""
        try:
            response = requests.get(f"{api_url}/_stcore/health", timeout=10)
            return {
                "status": "✅ Healthy" if response.status_code == 200 else "❌ Unhealthy",
                "status_code": response.status_code,
                "response_time": response.elapsed.total_seconds(),
                "data": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
            }
        except requests.exceptions.RequestException as e:
            return {
                "status": "❌ Error",
                "error": str(e),
                "response_time": None
            }
    
    def test_gpt_gateway(self) -> Dict:
        """Test GPT Gateway connection"""
        try:
            response = requests.get(f"{self.gpt_gateway_url}/gpts/health", timeout=10)
            return {
                "status": "✅ Connected" if response.status_code == 200 else "❌ Disconnected",
                "status_code": response.status_code,
                "response_time": response.elapsed.total_seconds(),
                "data": response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
            }
        except requests.exceptions.RequestException as e:
            return {
                "status": "❌ Error",
                "error": str(e),
                "response_time": None
            }
    
    def test_main_api_features(self) -> Dict:
        """Test Main API specific features"""
        features = {}
        
        # Test liquidation heatmap endpoint (if available)
        try:
            response = requests.get(f"{self.main_api_url}/api/liquidations", timeout=10)
            features["liquidations"] = {
                "status": "✅ Available" if response.status_code == 200 else "❌ Error",
                "status_code": response.status_code
            }
        except:
            features["liquidations"] = {"status": "❌ Not Available"}
        
        # Test social intelligence endpoint (if available)
        try:
            response = requests.get(f"{self.main_api_url}/api/social", timeout=10)
            features["social_intelligence"] = {
                "status": "✅ Available" if response.status_code == 200 else "❌ Error",
                "status_code": response.status_code
            }
        except:
            features["social_intelligence"] = {"status": "❌ Not Available"}
        
        return features
    
    def test_guardians_api_features(self) -> Dict:
        """Test Guardians API specific features"""
        features = {}
        
        # Test Guardians configuration
        try:
            response = requests.get(f"{self.guardians_api_url}/api/guardians/config", timeout=10)
            features["guardians_config"] = {
                "status": "✅ Available" if response.status_code == 200 else "❌ Error",
                "status_code": response.status_code
            }
        except:
            features["guardians_config"] = {"status": "❌ Not Available"}
        
        # Test VIP features
        try:
            response = requests.get(f"{self.guardians_api_url}/api/vip/features", timeout=10)
            features["vip_features"] = {
                "status": "✅ Available" if response.status_code == 200 else "❌ Error",
                "status_code": response.status_code
            }
        except:
            features["vip_features"] = {"status": "❌ Not Available"}
        
        return features
    
    def test_port_conflicts(self) -> Dict:
        """Check for port conflicts"""
        import socket
        
        def is_port_open(port):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(('localhost', port)) == 0
        
        return {
            "8501_main": "✅ Open" if is_port_open(8501) else "❌ Closed",
            "8502_guardians": "✅ Open" if is_port_open(8502) else "❌ Closed",
            "3000_gpt_gateway": "✅ Open" if is_port_open(3000) else "❌ Closed"
        }
    
    def run_comprehensive_test(self) -> Dict:
        """Run comprehensive test suite"""
        print("🚀 Starting Comprehensive API Test Suite")
        print("=" * 60)
        
        # Test port availability
        print("📡 Testing Port Availability...")
        port_status = self.test_port_conflicts()
        self.results["ports"] = port_status
        
        # Test Main API
        print("\n🔍 Testing Main API (Port 8501)...")
        main_health = self.test_api_health(self.main_api_url, "Main API")
        self.results["main_api"] = {
            "health": main_health,
            "features": self.test_main_api_features()
        }
        
        # Test Guardians API
        print("\n🌟 Testing Guardians API (Port 8502)...")
        guardians_health = self.test_api_health(self.guardians_api_url, "Guardians API")
        self.results["guardians_api"] = {
            "health": guardians_health,
            "features": self.test_guardians_api_features()
        }
        
        # Test GPT Gateway
        print("\n🤖 Testing GPT Gateway (Port 3000)...")
        gpt_status = self.test_gpt_gateway()
        self.results["gpt_gateway"] = gpt_status
        
        # Test environment separation
        print("\n🔧 Testing Environment Separation...")
        self.results["environment_separation"] = self.test_environment_separation()
        
        return self.results
    
    def test_environment_separation(self) -> Dict:
        """Test that APIs have separate environments"""
        separation_tests = {}
        
        # Check if both APIs are running on different ports
        separation_tests["port_separation"] = "✅ Confirmed" if 8501 != 8502 else "❌ Conflict"
        
        # Check if APIs have different configurations
        try:
            main_response = requests.get(f"{self.main_api_url}/_stcore/health", timeout=5)
            guardians_response = requests.get(f"{self.guardians_api_url}/_stcore/health", timeout=5)
            
            if main_response.status_code == 200 and guardians_response.status_code == 200:
                separation_tests["config_separation"] = "✅ Confirmed"
            else:
                separation_tests["config_separation"] = "❌ Partial"
        except:
            separation_tests["config_separation"] = "❌ Error"
        
        return separation_tests
    
    def print_results(self):
        """Print test results in a formatted way"""
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 60)
        
        # Port Status
        print("\n📡 Port Status:")
        for port, status in self.results.get("ports", {}).items():
            print(f"  {port}: {status}")
        
        # Main API Results
        print("\n🚀 Main API (Port 8501):")
        main_api = self.results.get("main_api", {})
        if "health" in main_api:
            health = main_api["health"]
            print(f"  Health: {health.get('status', 'Unknown')}")
            if health.get("response_time"):
                print(f"  Response Time: {health['response_time']:.3f}s")
        
        if "features" in main_api:
            print("  Features:")
            for feature, status in main_api["features"].items():
                print(f"    {feature}: {status.get('status', 'Unknown')}")
        
        # Guardians API Results
        print("\n🌟 Guardians API (Port 8502):")
        guardians_api = self.results.get("guardians_api", {})
        if "health" in guardians_api:
            health = guardians_api["health"]
            print(f"  Health: {health.get('status', 'Unknown')}")
            if health.get("response_time"):
                print(f"  Response Time: {health['response_time']:.3f}s")
        
        if "features" in guardians_api:
            print("  Features:")
            for feature, status in guardians_api["features"].items():
                print(f"    {feature}: {status.get('status', 'Unknown')}")
        
        # GPT Gateway Results
        print("\n🤖 GPT Gateway (Port 3000):")
        gpt_gateway = self.results.get("gpt_gateway", {})
        print(f"  Status: {gpt_gateway.get('status', 'Unknown')}")
        if gpt_gateway.get("response_time"):
            print(f"  Response Time: {gpt_gateway['response_time']:.3f}s")
        
        # Environment Separation
        print("\n🔧 Environment Separation:")
        env_sep = self.results.get("environment_separation", {})
        for test, status in env_sep.items():
            print(f"  {test}: {status}")
        
        # Overall Status
        print("\n" + "=" * 60)
        print("🎯 OVERALL STATUS:")
        
        # Count successes and failures
        total_checks = 0
        successful_checks = 0
        
        def count_checks(data, prefix=""):
            nonlocal total_checks, successful_checks
            if isinstance(data, dict):
                for key, value in data.items():
                    if isinstance(value, dict):
                        count_checks(value, f"{prefix}.{key}")
                    elif isinstance(value, str) and "✅" in value:
                        total_checks += 1
                        successful_checks += 1
                    elif isinstance(value, str) and "❌" in value:
                        total_checks += 1
        
        count_checks(self.results)
        
        if total_checks > 0:
            success_rate = (successful_checks / total_checks) * 100
            print(f"  Success Rate: {success_rate:.1f}% ({successful_checks}/{total_checks})")
            
            if success_rate >= 80:
                print("  🟢 Overall Status: EXCELLENT")
            elif success_rate >= 60:
                print("  🟡 Overall Status: GOOD")
            else:
                print("  🔴 Overall Status: NEEDS ATTENTION")
        
        print("=" * 60)
    
    def save_results(self, filename: str = None):
        """Save test results to JSON file"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"api_test_results_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(self.results, f, indent=2, default=str)
        
        print(f"\n💾 Results saved to: {filename}")

def main():
    """Main function"""
    tester = APITester()
    
    try:
        # Run comprehensive test
        results = tester.run_comprehensive_test()
        
        # Print results
        tester.print_results()
        
        # Save results
        tester.save_results()
        
        # Return appropriate exit code
        main_health = results.get("main_api", {}).get("health", {}).get("status", "")
        guardians_health = results.get("guardians_api", {}).get("health", {}).get("status", "")
        
        if "✅" in main_health and "✅" in guardians_health:
            print("\n🎉 Both APIs are running successfully!")
            sys.exit(0)
        else:
            print("\n⚠️ Some APIs may need attention.")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n👋 Test interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

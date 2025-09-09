import asyncio
import time
import statistics
from concurrent.futures import ThreadPoolExecutor
import requests
from typing import List, Dict, Any

class LoadTester:
    """Load testing for API performance"""
    
    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url
        self.test_api_key = None
        self.results = []
    
    def setup_auth(self):
        """Setup authentication for load testing"""
        # Create test API key
        response = requests.post(f"{self.base_url}/auth/api-key", json={
            "user_id": "load_test_user",
            "tier": "enterprise"
        })
        
        if response.status_code == 200:
            self.test_api_key = response.json()["data"]["api_key"]
            return True
        return False
    
    def make_request(self, endpoint: str, method: str = "GET", **kwargs) -> Dict[str, Any]:
        """Make a single request and measure performance"""
        headers = {"Authorization": f"Bearer {self.test_api_key}"} if self.test_api_key else {}
        start_time = time.time()
        
        try:
            if method == "GET":
                response = requests.get(f"{self.base_url}{endpoint}", headers=headers, **kwargs)
            elif method == "POST":
                response = requests.post(f"{self.base_url}{endpoint}", headers=headers, **kwargs)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # ms
            
            return {
                "endpoint": endpoint,
                "method": method,
                "status_code": response.status_code,
                "response_time_ms": response_time,
                "success": 200 <= response.status_code < 300,
                "error": None
            }
        
        except Exception as e:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000
            
            return {
                "endpoint": endpoint,
                "method": method,
                "status_code": 0,
                "response_time_ms": response_time,
                "success": False,
                "error": str(e)
            }
    
    def run_concurrent_load_test(self, 
                                endpoint: str, 
                                concurrent_users: int = 10,
                                requests_per_user: int = 10,
                                method: str = "GET",
                                **kwargs) -> Dict[str, Any]:
        """Run concurrent load test"""
        print(f"Running load test: {concurrent_users} users, {requests_per_user} requests each")
        
        def user_requests():
            user_results = []
            for _ in range(requests_per_user):
                result = self.make_request(endpoint, method, **kwargs)
                user_results.append(result)
                time.sleep(0.1)  # Small delay between requests
            return user_results
        
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
            futures = [executor.submit(user_requests) for _ in range(concurrent_users)]
            all_results = []
            
            for future in futures:
                all_results.extend(future.result())
        
        end_time = time.time()
        total_duration = end_time - start_time
        
        return self.analyze_results(all_results, total_duration)
    
    def analyze_results(self, results: List[Dict[str, Any]], total_duration: float) -> Dict[str, Any]:
        """Analyze load test results"""
        if not results:
            return {"error": "No results to analyze"}
        
        successful_requests = [r for r in results if r["success"]]
        failed_requests = [r for r in results if not r["success"]]
        
        response_times = [r["response_time_ms"] for r in successful_requests]
        
        analysis = {
            "test_summary": {
                "total_requests": len(results),
                "successful_requests": len(successful_requests),
                "failed_requests": len(failed_requests),
                "success_rate": len(successful_requests) / len(results) * 100,
                "total_duration_seconds": total_duration,
                "requests_per_second": len(results) / total_duration
            },
            "response_times": {
                "min_ms": min(response_times) if response_times else 0,
                "max_ms": max(response_times) if response_times else 0,
                "mean_ms": statistics.mean(response_times) if response_times else 0,
                "median_ms": statistics.median(response_times) if response_times else 0,
                "p95_ms": self.percentile(response_times, 95) if response_times else 0,
                "p99_ms": self.percentile(response_times, 99) if response_times else 0
            },
            "errors": {}
        }
        
        # Analyze errors
        if failed_requests:
            error_counts = {}
            for request in failed_requests:
                error_key = f"{request['status_code']}_{request.get('error', 'unknown')}"
                error_counts[error_key] = error_counts.get(error_key, 0) + 1
            analysis["errors"] = error_counts
        
        return analysis
    
    def percentile(self, data: List[float], percentile: float) -> float:
        """Calculate percentile"""
        if not data:
            return 0
        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)
        if index.is_integer():
            return sorted_data[int(index)]
        else:
            lower = sorted_data[int(index)]
            upper = sorted_data[int(index) + 1]
            return lower + (upper - lower) * (index - int(index))
    
    def run_stress_test(self) -> Dict[str, Any]:
        """Run comprehensive stress test"""
        if not self.setup_auth():
            return {"error": "Authentication setup failed"}
        
        test_scenarios = [
            {
                "name": "Health Check Load",
                "endpoint": "/health/live",
                "concurrent_users": 50,
                "requests_per_user": 20
            },
            {
                "name": "Heatmap Data Load",
                "endpoint": "/heatmap/BTC",
                "concurrent_users": 20,
                "requests_per_user": 10
            },
            {
                "name": "Replay Data Load",
                "endpoint": "/replay/oi/ETH",
                "concurrent_users": 15,
                "requests_per_user": 8
            },
            {
                "name": "Mixed Endpoint Load",
                "endpoint": "/health/ready",
                "concurrent_users": 30,
                "requests_per_user": 15
            }
        ]
        
        stress_results = {}
        
        for scenario in test_scenarios:
            print(f"\nRunning scenario: {scenario['name']}")
            result = self.run_concurrent_load_test(
                scenario["endpoint"],
                scenario["concurrent_users"],
                scenario["requests_per_user"]
            )
            stress_results[scenario["name"]] = result
            
            # Print summary
            summary = result["test_summary"]
            times = result["response_times"]
            print(f"  Success Rate: {summary['success_rate']:.1f}%")
            print(f"  RPS: {summary['requests_per_second']:.1f}")
            print(f"  Mean Response Time: {times['mean_ms']:.1f}ms")
            print(f"  95th Percentile: {times['p95_ms']:.1f}ms")
        
        return stress_results
    
    def run_endurance_test(self, duration_minutes: int = 10) -> Dict[str, Any]:
        """Run endurance test over specified duration"""
        if not self.setup_auth():
            return {"error": "Authentication setup failed"}
        
        print(f"Running endurance test for {duration_minutes} minutes...")
        
        start_time = time.time()
        end_time = start_time + (duration_minutes * 60)
        
        results = []
        request_count = 0
        
        while time.time() < end_time:
            # Rotate between different endpoints
            endpoints = ["/health/live", "/heatmap/BTC", "/replay/oi/ETH"]
            endpoint = endpoints[request_count % len(endpoints)]
            
            result = self.make_request(endpoint)
            results.append(result)
            request_count += 1
            
            time.sleep(1)  # 1 request per second
            
            # Print progress every minute
            if request_count % 60 == 0:
                elapsed_minutes = (time.time() - start_time) / 60
                print(f"  Progress: {elapsed_minutes:.1f}/{duration_minutes} minutes")
        
        total_duration = time.time() - start_time
        return self.analyze_results(results, total_duration)

def run_performance_tests():
    """Main function to run all performance tests"""
    tester = LoadTester()
    
    print("=" * 50)
    print("COINGLASS SYSTEM PERFORMANCE TESTING")
    print("=" * 50)
    
    # Stress test
    print("\n1. Running Stress Tests...")
    stress_results = tester.run_stress_test()
    
    if "error" not in stress_results:
        print("\nStress Test Results Summary:")
        for scenario_name, result in stress_results.items():
            summary = result["test_summary"]
            print(f"  {scenario_name}:")
            print(f"    Success Rate: {summary['success_rate']:.1f}%")
            print(f"    RPS: {summary['requests_per_second']:.1f}")
            print(f"    Mean Response: {result['response_times']['mean_ms']:.1f}ms")
    
    # Endurance test
    print("\n2. Running Endurance Test...")
    endurance_result = tester.run_endurance_test(duration_minutes=5)
    
    if "error" not in endurance_result:
        print("\nEndurance Test Results:")
        summary = endurance_result["test_summary"]
        times = endurance_result["response_times"]
        print(f"  Duration: {summary['total_duration_seconds']:.1f} seconds")
        print(f"  Total Requests: {summary['total_requests']}")
        print(f"  Success Rate: {summary['success_rate']:.1f}%")
        print(f"  Average RPS: {summary['requests_per_second']:.1f}")
        print(f"  Mean Response Time: {times['mean_ms']:.1f}ms")
        print(f"  95th Percentile: {times['p95_ms']:.1f}ms")
    
    print("\n" + "=" * 50)
    print("PERFORMANCE TESTING COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    run_performance_tests()
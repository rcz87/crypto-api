#!/usr/bin/env python3
"""
GPT Environment Check Script
A comprehensive diagnostic tool for CryptoSat GPT integration.
Performs sanity checks to help diagnose why a CryptoSat API deployment isn't working with GPT.
"""

import os
import sys
import yaml
import requests
from pathlib import Path
from typing import List, Optional, Dict, Any

# ANSI color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

# Configuration from environment variables
OPENAPI_PATH = os.getenv('OPENAPI_PATH', 'public/openapi-4.0.1-gpts-compat.yaml')
PY_BASE = os.getenv('PY_BASE', 'http://127.0.0.1:8000')
GATEWAY_BASE = os.getenv('GATEWAY_BASE')

# Required API keys
REQUIRED_ENV_VARS = [
    'COINAPI_KEY',
    'COINGLASS_API_KEY',
    'OKX_API_KEY',
    'LUNARCRUSH_API_KEY'
]

# Required GPT endpoints in OpenAPI spec
REQUIRED_GPT_ENDPOINTS = [
    '/gpts/unified/advanced',
    '/gpts/brain/analysis',
    '/gpts/health'
]


def print_success(message: str) -> None:
    """Print a success message with green checkmark."""
    print(f"{GREEN}✅ {message}{RESET}")


def print_error(message: str) -> None:
    """Print an error message with red X."""
    print(f"{RED}❌ {message}{RESET}")


def print_warning(message: str) -> None:
    """Print a warning message with yellow icon."""
    print(f"{YELLOW}⚠️  {message}{RESET}")


def print_header(message: str) -> None:
    """Print a section header."""
    print(f"\n{message}")


def check_openapi_spec() -> bool:
    """Check if the OpenAPI specification contains all required GPT endpoints."""
    print_header(f"Checking OpenAPI specification at {OPENAPI_PATH} …")

    # Check if file exists
    if not Path(OPENAPI_PATH).exists():
        print_error(f"OpenAPI file not found: {OPENAPI_PATH}")
        return False

    try:
        # Load YAML file
        with open(OPENAPI_PATH, 'r') as f:
            spec = yaml.safe_load(f)

        # Get all paths from the spec
        paths = spec.get('paths', {})

        # Check for required endpoints
        missing_endpoints = []
        for endpoint in REQUIRED_GPT_ENDPOINTS:
            if endpoint not in paths:
                missing_endpoints.append(endpoint)

        if missing_endpoints:
            print_error("The following endpoints are missing from the OpenAPI spec:")
            for endpoint in missing_endpoints:
                print(f"    - {endpoint}")
            return False
        else:
            print_success("Required GPT endpoints are present in the OpenAPI spec.")
            return True

    except yaml.YAMLError as e:
        print_error(f"Error parsing OpenAPI YAML file: {e}")
        return False
    except Exception as e:
        print_error(f"Unexpected error reading OpenAPI file: {e}")
        return False


def check_environment_variables() -> bool:
    """Check if all required environment variables are set."""
    print_header("Checking environment variables …")

    all_set = True

    # Check if PY_BASE is set (needed for service testing)
    if PY_BASE:
        print_success("PY_BASE is set.")
    else:
        print_error("PY_BASE is not set.")
        all_set = False

    # Check required API keys
    for var in REQUIRED_ENV_VARS:
        value = os.getenv(var)
        if value:
            print_success(f"{var} is set.")
        else:
            print_error(f"{var} is not set.")
            all_set = False

    return all_set


def test_endpoint(url: str, timeout: int = 5) -> Dict[str, Any]:
    """Test a single HTTP endpoint."""
    try:
        response = requests.get(url, timeout=timeout)
        return {
            'success': True,
            'status_code': response.status_code,
            'url': url
        }
    except requests.exceptions.ConnectionError:
        return {
            'success': False,
            'error': 'Connection refused',
            'url': url
        }
    except requests.exceptions.Timeout:
        return {
            'success': False,
            'error': 'Request timeout',
            'url': url
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'url': url
        }


def test_python_service() -> bool:
    """Test Python service (FastAPI) health endpoints."""
    if not PY_BASE:
        print_warning("PY_BASE not set, skipping Python service checks.")
        return True

    print_header(f"Testing Python service (FastAPI) at {PY_BASE} …")

    # Endpoints to test
    python_paths = [
        "/gpts/health",
        "/health",
        "/api/health"
    ]

    all_passed = True
    at_least_one_success = False

    for path in python_paths:
        result = test_endpoint(f"{PY_BASE}{path}")

        if result['success']:
            if result['status_code'] == 200:
                print_success(f"Python service (FastAPI) responded at {result['url']} (HTTP {result['status_code']})")
                at_least_one_success = True
            else:
                print_warning(f"Python service responded at {result['url']} with HTTP {result['status_code']}")
                at_least_one_success = True
        else:
            # Only print error for the first endpoint, warnings for others
            if path == python_paths[0]:
                print_error(f"Error connecting to {result['url']}: {result['error']}")
                all_passed = False

    # If at least one endpoint responded, consider it a pass
    return at_least_one_success


def test_gateway_service() -> bool:
    """Test Node/Express gateway endpoints."""
    if not GATEWAY_BASE:
        print_warning("GATEWAY_BASE not set, skipping gateway checks.")
        return True

    print_header(f"Testing Node/Express gateway at {GATEWAY_BASE} …")

    # Endpoints to test
    gateway_paths = [
        "/gpts/health",
        "/gpts/unified/advanced"
    ]

    at_least_one_success = False

    for path in gateway_paths:
        result = test_endpoint(f"{GATEWAY_BASE}{path}")

        if result['success']:
            if result['status_code'] == 200:
                print_success(f"Gateway responded at {result['url']} (HTTP {result['status_code']})")
                at_least_one_success = True
            else:
                print_warning(f"Gateway responded at {result['url']} with HTTP {result['status_code']}")
                at_least_one_success = True
        else:
            print_error(f"Error connecting to {result['url']}: {result['error']}")

    return at_least_one_success


def main() -> int:
    """Main entry point for the script."""
    print("=" * 80)
    print("GPT Environment Check Script")
    print("=" * 80)

    # Track overall success
    all_checks_passed = True

    # 1. Check OpenAPI specification
    if not check_openapi_spec():
        all_checks_passed = False

    # 2. Check environment variables
    if not check_environment_variables():
        all_checks_passed = False

    # 3. Test Python service
    if not test_python_service():
        all_checks_passed = False

    # 4. Test Gateway service (optional)
    if GATEWAY_BASE:
        if not test_gateway_service():
            all_checks_passed = False

    # Print summary
    print_header("Environment checks complete.")

    if all_checks_passed:
        print_success("All checks passed! ✨")
        return 0
    else:
        print_error("Some checks failed. Please review the output above.")
        return 1


if __name__ == '__main__':
    sys.exit(main())

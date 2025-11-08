# GPT Environment Check Script Usage Guide

## Overview

The `gpt_env_check.py` script is a comprehensive diagnostic tool for CryptoSat GPT integration. It performs sanity checks to help diagnose why a CryptoSat API deployment isn't working with GPT.

## Features

- 🔍 **OpenAPI Schema Validation**: Checks for required GPT endpoints
- 🔧 **Environment Variable Verification**: Validates critical API keys and configuration
- 🌐 **Service Health Checks**: Tests HTTP endpoints for Python service and Node gateway
- 📊 **Comprehensive Reporting**: Clear pass/fail indicators with actionable feedback

## Installation

### Prerequisites

Ensure you have the required Python dependencies:

```bash
pip install pyyaml requests
```

### Setup

1. The script is already executable in your crypto-api directory
2. Make sure your Python service is running (typically on port 8000)

## Usage

### Basic Usage

```bash
python3 gpt_env_check.py
```

### With Custom Environment Variables

```bash
OPENAPI_PATH=../public/openapi-4.0.1-gpts-compat.yaml \
PY_BASE=http://localhost:8000 \
GATEWAY_BASE=http://localhost:3000 \
python3 gpt_env_check.py
```

### Environment Variables

The script reads the following environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OPENAPI_PATH` | Path to OpenAPI YAML file | `public/openapi-4.0.1-gpts-compat.yaml` | No |
| `PY_BASE` | Base URL for Python service (FastAPI) | `http://127.0.0.1:8000` | Yes |
| `GATEWAY_BASE` | Base URL for Node/Express gateway | None | No |
| `COINAPI_KEY` | CoinAPI API key | None | Yes |
| `COINGLASS_API_KEY` | Coinglass API key | None | Yes |
| `OKX_API_KEY` | OKX API key | None | Yes |
| `LUNARCRUSH_API_KEY` | LunarCrush API key | None | Yes |

## What the Script Checks

### 1. OpenAPI Specification Validation

✅ **Required Endpoints Checked:**
- `/gpts/unified/advanced`
- `/gpts/brain/analysis`
- `/gpts/health`

❌ **Common Issues:**
- Missing OpenAPI file
- Malformed YAML syntax
- Missing required endpoints

### 2. Environment Variables

✅ **Validates:**
- All required API keys are present
- PY_BASE is configured for service testing

❌ **Common Issues:**
- Missing API keys in `.env` file
- Incorrect variable names
- Empty values

### 3. Service Health Checks

✅ **Python Service Tests:**
- `/gpts/health` - GPT-specific health endpoint
- `/health` - General health endpoint
- `/api/health` - Alternative health endpoint

✅ **Node Gateway Tests** (if GATEWAY_BASE is set):
- `/gpts/health` - Gateway health check
- `/gpts/unified/advanced` - Main GPT endpoint

## Example Output

### Successful Run
```
Checking OpenAPI specification at ../public/openapi-4.0.1-gpts-compat.yaml …
✅ Required GPT endpoints are present in the OpenAPI spec.

Checking environment variables …
✅ PY_BASE is set.
✅ COINAPI_KEY is set.
✅ COINGLASS_API_KEY is set.
✅ OKX_API_KEY is set.
✅ LUNARCRUSH_API_KEY is set.

Testing Python service (FastAPI) at http://127.0.0.1:8000 …
✅ Python service (FastAPI) responded at http://127.0.0.1:8000/gpts/health (HTTP 200)
✅ Python service (FastAPI) responded at http://127.0.0.1:8000/health (HTTP 200)

Environment checks complete.
```

### Issues Detected
```
Checking OpenAPI specification at ../public/openapi-4.0.1-gpts-compat.yaml …
❌ The following endpoints are missing from the OpenAPI spec:
    - /gpts/brain/analysis

Checking environment variables …
❌ COINAPI_KEY is not set.
❌ COINGLASS_API_KEY is not set.

Testing Python service (FastAPI) at http://127.0.0.1:8000 …
❌ Error connecting to http://127.0.0.1:8000/gpts/health: Connection refused
```

## Troubleshooting

### Common Issues and Solutions

#### 1. OpenAPI File Not Found
**Problem**: `❌ OpenAPI file not found: public/openapi-4.0.1-gpts-compat.yaml`

**Solution**:
```bash
# Use the correct path
OPENAPI_PATH=../public/openapi-4.0.1-gpts-compat.yaml python3 gpt_env_check.py
```

#### 2. Missing Environment Variables
**Problem**: `❌ COINAPI_KEY is not set.`

**Solution**:
- Add missing keys to your `.env` file
- Or export them directly:
```bash
export COINAPI_KEY="your_api_key_here"
python3 gpt_env_check.py
```

#### 3. Service Connection Refused
**Problem**: `❌ Error connecting to http://127.0.0.1:8000/gpts/health: Connection refused`

**Solution**:
- Start your Python service:
```bash
python3 app.py
# or
python3 run_production.py
```
- Check if service is running on correct port:
```bash
netstat -tlnp | grep :8000
```

#### 4. Missing Endpoints
**Problem**: `❌ The following endpoints are missing from the OpenAPI spec:`

**Solution**:
- Update your OpenAPI YAML file to include missing endpoints
- Or implement the missing endpoints in your service

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: GPT Environment Check
on: [push, pull_request]

jobs:
  env-check:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.9'
    - name: Install dependencies
      run: pip install pyyaml requests
    - name: Run environment check
      env:
        OPENAPI_PATH: ../public/openapi-4.0.1-gpts-compat.yaml
        PY_BASE: http://localhost:8000
        COINAPI_KEY: ${{ secrets.COINAPI_KEY }}
        COINGLASS_API_KEY: ${{ secrets.COINGLASS_API_KEY }}
        OKX_API_KEY: ${{ secrets.OKX_API_KEY }}
        LUNARCRUSH_API_KEY: ${{ secrets.LUNARCRUSH_API_KEY }}
      run: python3 gpt_env_check.py
```

## Advanced Usage

### Custom Health Endpoints
To test additional endpoints, modify the `python_paths` list in the script:

```python
python_paths = [
    "/gpts/health",
    "/health",
    "/api/health",
    "/custom/health"  # Add your custom endpoint
]
```

### Different OpenAPI Files
Test against different OpenAPI specifications:

```bash
# Test with final GPT spec
OPENAPI_PATH=../public/openapi-gpts-final.yaml python3 gpt_env_check.py

# Test with compact spec
OPENAPI_PATH=../public/openapi-ultra-compact.json python3 gpt_env_check.py
```

## Contributing

To extend the script with additional checks:

1. Add new check functions following the existing pattern
2. Update the `main()` function to call your new checks
3. Update this documentation

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the script output for specific error messages
3. Ensure all dependencies are installed correctly
4. Verify your service is running and accessible

---

**Last Updated**: 2025-11-08
**Version**: 1.0
**Compatible**: Python 3.7+

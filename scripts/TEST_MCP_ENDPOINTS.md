# MCP Backend Endpoints Test Suite

Comprehensive testing suite for verifying all 18 MCP backend endpoints before using the MCP server with Claude Desktop.

---

## 📋 Overview

The MCP server acts as a **wrapper** around your Express.js API endpoints. Before using MCP tools with Claude Desktop, you should verify that all backend endpoints are working correctly.

**Test Coverage:**
- ✅ 18 MCP tools (all endpoints)
- ✅ GuardiansOfTheToken endpoints (3)
- ✅ Trading Intelligence endpoints (10)
- ✅ Brain Orchestrator endpoints (5)
- ✅ Health check endpoints (2)

---

## 🚀 Quick Start

### Option 1: Quick Test (~5 seconds)

**Tests only critical endpoints for fast sanity check:**

```bash
# Using npm script (recommended)
npm run test:mcp

# Or directly
bash scripts/quick-mcp-test.sh
```

**Tests:**
- Health endpoint
- Symbols endpoint
- Market data endpoint
- Whale alerts endpoint
- Brain analysis endpoint

---

### Option 2: Full Test Suite (~30-60 seconds)

**Tests all 18 MCP endpoints comprehensively:**

```bash
# Using npm script (recommended)
npm run test:mcp-full

# With verbose output (shows response data)
npm run test:mcp-verbose

# Or directly
bash scripts/test-mcp-endpoints.sh

# With verbose output
bash scripts/test-mcp-endpoints.sh --verbose
```

**Tests all 18 tools:**
- GuardiansOfTheToken: 3 endpoints
- Trading Intelligence: 10 endpoints
- Brain Orchestrator: 5 endpoints

---

## 📊 Expected Output

### Quick Test Output

```
Quick MCP Backend Test

Testing critical endpoints...

Testing Health... ✓
Testing Symbols... ✓
Testing Market Data... ✓
Testing Whale Alerts... ✓
Testing Brain Analysis... ✓

Results: 5 passed, 0 failed
✓ Quick test PASSED! Backend is operational.
```

---

### Full Test Output

```
╔════════════════════════════════════════════════════════════════╗
║  MCP Backend Endpoints Verification - 18 Tools Test Suite    ║
╚════════════════════════════════════════════════════════════════╝

Base URL: http://localhost:5000
Timeout: 10s
Date: 2025-11-06 12:00:00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 Health Check Endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing: get_gpts_health - Overall GPT Actions health... ✓ PASS (120ms)
Testing: get_coinapi_health - CoinAPI WebSocket health... ✓ PASS (95ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐋 GuardiansOfTheToken Endpoints (3 tools)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing: get_whale_data - Whale accumulation detection... ✓ PASS (450ms)
Testing: get_live_template - Professional signal templates... ✓ PASS (230ms)
Testing: get_institutional_bias - Smart money positioning... ✓ PASS (380ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Trading Intelligence Endpoints (10 tools)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing: get_symbols - List 71+ supported symbols... ✓ PASS (85ms)
Testing: get_market_data - Real-time market data for BTC... ✓ PASS (320ms)
Testing: whale_alerts - Large order detection... ✓ PASS (1200ms)
Testing: market_sentiment - Funding + order flow analysis... ✓ PASS (890ms)
Testing: multi_coin_screening - 8-layer confluence analysis... ✓ PASS (2100ms)
Testing: new_listings - New token discovery... ✓ PASS (1500ms)
Testing: volume_spikes - Volume anomaly detection... ✓ PASS (980ms)
Testing: opportunities - AI opportunity scoring... ✓ PASS (1800ms)
Testing: alpha_screening - Fundamental analysis... ✓ PASS (750ms)
Testing: micro_caps - Micro-cap gems finder... ✓ PASS (1600ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Brain Orchestrator Endpoints (5 tools)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing: get_brain_analysis - AI-powered market intelligence... ✓ PASS (3200ms)
Testing: get_brain_insights - Historical AI insights... ✓ PASS (150ms)
Testing: get_brain_stats - Performance statistics... ✓ PASS (85ms)

╔════════════════════════════════════════════════════════════════╗
║                         TEST SUMMARY                          ║
╚════════════════════════════════════════════════════════════════╝

Total Tests:   18
Passed:        18
Failed:        0
Skipped:       0
Pass Rate:     100%

Slow Endpoints (>3s):
  ⚠ get_brain_analysis: 3200ms

✓ ALL TESTS PASSED! MCP Backend is Production Ready!
```

---

## 🎯 What Each Test Verifies

### GuardiansOfTheToken Tools

| Tool | Endpoint | What It Tests |
|------|----------|---------------|
| `get_whale_data` | `/gpts/coinglass/whale-data` | CoinGlass API integration, whale detection logic |
| `get_live_template` | `/gpts/coinglass/live-template` | Signal template generation |
| `get_institutional_bias` | `/gpts/institutional/bias` | Smart money positioning analysis |

### Trading Intelligence Tools

| Tool | Endpoint | What It Tests |
|------|----------|---------------|
| `get_symbols` | `/gpts/unified/symbols` | Symbol list retrieval |
| `get_market_data` | `/gpts/unified/market/:symbol` | Real-time price data |
| `whale_alerts` | `/gpts/unified/advanced` (op=whale_alerts) | Large order detection |
| `market_sentiment` | `/gpts/unified/advanced` (op=market_sentiment) | Funding rate + order flow |
| `multi_coin_screening` | `/gpts/unified/advanced` (op=multi_coin_screening) | 8-layer confluence |
| `new_listings` | `/gpts/unified/advanced` (op=new_listings) | New token discovery |
| `volume_spikes` | `/gpts/unified/advanced` (op=volume_spikes) | Volume anomaly detection |
| `opportunities` | `/gpts/unified/advanced` (op=opportunities) | AI scoring engine |
| `alpha_screening` | `/gpts/unified/advanced` (op=alpha_screening) | Fundamental analysis |
| `micro_caps` | `/gpts/unified/advanced` (op=micro_caps) | Micro-cap finder |

### Brain Orchestrator Tools

| Tool | Endpoint | What It Tests |
|------|----------|---------------|
| `get_brain_analysis` | `/gpts/brain/analysis` | AI orchestrator, market intelligence |
| `get_brain_insights` | `/gpts/brain/insights` | Historical insights retrieval |
| `get_brain_stats` | `/gpts/brain/stats` | Performance metrics |
| `get_coinapi_health` | `/gpts/health/coinapi` | CoinAPI WebSocket status |
| `get_gpts_health` | `/gpts/health` | Overall system health |

---

## 🛠️ Advanced Usage

### Test Remote API

```bash
# Test production API
npm run test:mcp-full -- --url https://api.yourdomain.com

# Or with environment variable
BASE_URL=https://api.yourdomain.com npm run test:mcp-full
```

### Custom Timeout

```bash
# Increase timeout for slow connections
npm run test:mcp-full -- --timeout 30

# Or with environment variable
TIMEOUT=30 npm run test:mcp-full
```

### Verbose Mode

```bash
# Show full response data
npm run test:mcp-verbose

# Or directly
bash scripts/test-mcp-endpoints.sh --verbose
```

### Command Line Options

```bash
bash scripts/test-mcp-endpoints.sh [OPTIONS]

Options:
  -v, --verbose     Show detailed response output
  -u, --url URL     Base URL (default: http://localhost:5000)
  -t, --timeout N   Request timeout in seconds (default: 10)
  -h, --help        Show help message
```

---

## 📋 Prerequisites

### Required

1. **Express.js API must be running:**
   ```bash
   npm run dev
   # or in production
   npm start
   ```

2. **curl must be installed:**
   ```bash
   # Check if installed
   curl --version

   # Install if needed (Ubuntu/Debian)
   sudo apt-get install curl
   ```

### Optional but Recommended

3. **jq for JSON pretty-printing:**
   ```bash
   # Check if installed
   jq --version

   # Install if needed (Ubuntu/Debian)
   sudo apt-get install jq
   ```

---

## 🔍 Troubleshooting

### Test Fails: "Express.js API is not running"

**Problem:** Backend API is not accessible

**Solution:**
```bash
# Start the API
npm run dev

# Verify it's running
curl http://localhost:5000/gpts/health

# Check if port is in use
sudo lsof -i :5000
```

---

### Test Fails: HTTP 500 errors

**Problem:** Backend API is running but endpoints are failing

**Solution:**
```bash
# Check API logs
npm run dev

# Check if Python service is running (required for some endpoints)
curl http://localhost:8000/health

# Check environment variables
grep -E "COINGLASS_API_KEY|COINAPI_KEY|OPENAI_API_KEY" .env
```

---

### Test Fails: Timeout errors

**Problem:** API is too slow or hanging

**Solution:**
```bash
# Increase timeout
npm run test:mcp-full -- --timeout 30

# Check API health
curl http://localhost:5000/gpts/health

# Check system resources
free -h
top -bn1 | head -20
```

---

### Slow Endpoints Warning

**Problem:** Some endpoints take >3 seconds

**This is often normal for:**
- `get_brain_analysis` - AI processing
- `multi_coin_screening` - Multiple coins analysis
- `opportunities` - Complex scoring

**If consistently slow:**
```bash
# Check Python service
curl http://localhost:8000/health

# Check database connection
npm run db:studio

# Check external API rate limits
# (CoinGlass, CoinAPI, etc.)
```

---

## 🎯 Integration with CI/CD

### GitHub Actions Example

```yaml
name: MCP Backend Tests

on: [push, pull_request]

jobs:
  test-mcp-endpoints:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Start services
        run: |
          npm run dev &
          sleep 5  # Wait for API to start

      - name: Test MCP endpoints
        run: npm run test:mcp-full

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

## 📊 Exit Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed |
| 2 | Prerequisites not met (e.g., API not running) |

**Use in scripts:**
```bash
#!/bin/bash

if npm run test:mcp; then
    echo "✓ MCP backend ready, proceeding with deployment"
    npm run deploy
else
    echo "✗ MCP backend tests failed, aborting deployment"
    exit 1
fi
```

---

## 🔄 When to Run Tests

### Development

```bash
# Before committing changes to API
npm run test:mcp

# After modifying endpoints
npm run test:mcp-full
```

### Pre-Deployment

```bash
# Full test before deploying
npm run test:mcp-full

# Test production API after deployment
BASE_URL=https://api.production.com npm run test:mcp-full
```

### Production Monitoring

```bash
# Add to crontab for periodic health checks
*/15 * * * * cd /root/crypto-api && npm run test:mcp >> /var/log/mcp-health.log 2>&1
```

---

## 📚 Related Documentation

- **MCP Integration Guide:** [../MCP_INTEGRATION.md](../MCP_INTEGRATION.md)
- **MCP Production Status:** [../MCP_PRODUCTION_STATUS.md](../MCP_PRODUCTION_STATUS.md)
- **Production Setup:** [../PRODUCTION_SETUP_GUIDE.md](../PRODUCTION_SETUP_GUIDE.md)
- **API Documentation:** [../docs/GPT_ACTIONS_DOCUMENTATION.md](../docs/GPT_ACTIONS_DOCUMENTATION.md)

---

## 🎉 Success Criteria

**Your MCP backend is ready when:**

✅ All 18 endpoint tests pass
✅ Pass rate is 100%
✅ No critical errors in logs
✅ Response times are acceptable (<3s for most endpoints)
✅ Health check endpoints return OK

**After successful tests, you can:**
1. Configure Claude Desktop with MCP server
2. Start using MCP tools
3. Deploy to production with confidence

---

## 🆘 Getting Help

If tests fail and you can't resolve the issue:

1. **Check logs:**
   ```bash
   npm run dev  # See API logs
   ```

2. **Test individual endpoints:**
   ```bash
   curl http://localhost:5000/gpts/health
   ```

3. **Verify environment variables:**
   ```bash
   cat .env | grep -E "API_KEY|SERVICE_URL"
   ```

4. **Check service status:**
   ```bash
   sudo systemctl status crypto_node.service python_service.service
   ```

---

*Last Updated: 2025-11-06*
*Version: 1.0.0*

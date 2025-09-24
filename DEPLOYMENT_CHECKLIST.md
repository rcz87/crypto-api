# 🔒 GPTs Deployment Checklist

## 🚨 MANDATORY PRE-DEPLOY VALIDATION

**CRITICAL:** These checks MUST pass before any production deployment.

### ✅ 1. Smoke Tests (REQUIRED)

```bash
# Run comprehensive smoke test
./scripts/gpts-smoke-test.sh
```

**Expected Results:**
- All tests show ✅ PASS status
- HTTP response codes: 200 for all endpoints
- Valid JSON responses with `"success": true`
- Performance: < 5 seconds response time

**Critical Endpoints:**
- `/gpts/health` → ✅ HTTP 200
- `/gpts/unified/symbols` → ✅ HTTP 200  
- `/gpts/unified/advanced` (market_sentiment) → ✅ HTTP 200
- `/gpts/unified/advanced` (ticker BTC) → ✅ HTTP 200

### ✅ 2. System Health Check

```bash
# Check system health
curl -s "https://guardiansofthegreentoken.com/health" | jq .
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "services": {
      "okx": "connected",
      "api": "operational", 
      "coinglass": "connected"
    }
  }
}
```

### ✅ 3. Enhanced Sniper Engine Status

**Check logs for:**
- ✅ ETF module: SUCCESS
- ✅ Whale module: SUCCESS  
- ✅ Heatmap module: SUCCESS
- ✅ Spot Orderbook module: SUCCESS

**Verify:** Enhanced Sniper showing "4 modules active, 0 soft-fails"

## 🔄 DEPLOYMENT PROCESS

### Step 1: Pre-Deploy Validation
```bash
# Navigate to project
cd /path/to/project

# Run smoke tests
./scripts/gpts-smoke-test.sh

# Check if all tests pass
if [ $? -eq 0 ]; then
    echo "✅ Pre-deploy validation PASSED"
else
    echo "❌ Pre-deploy validation FAILED - STOP DEPLOYMENT"
    exit 1
fi
```

### Step 2: Deploy Application
```bash
# Your deployment command here
# (This would be replaced with your actual deployment process)

# Example for Replit:
# git add -A
# git commit -m "Deploy with GPTs validation"
# git push origin main
```

### Step 3: Post-Deploy Validation
```bash
# Wait for deployment to complete (30s)
sleep 30

# Run smoke tests again
./scripts/gpts-smoke-test.sh

# Verify Enhanced Sniper is running
curl -s "https://guardiansofthegreentoken.com/gpts/health" | jq '.data.services'
```

### Step 4: Start Monitoring (Optional)
```bash
# Start continuous monitoring in background
nohup ./scripts/gpts-monitor.sh > /tmp/gpts-monitor-output.log 2>&1 &

echo "🚨 Monitoring started - PID: $!"
```

## 🚫 DEPLOYMENT BLOCKERS

**STOP deployment if any of these occur:**

1. **Smoke Test Failures**
   - Any endpoint returning non-200 status
   - JSON parsing errors
   - Response time > 5 seconds

2. **System Health Issues**
   - CoinGlass API disconnected
   - OKX API disconnected  
   - Enhanced Sniper not running

3. **Critical Errors in Logs**
   - Python service connection failures
   - Database connection issues
   - Rate limiting errors

## 📊 MONITORING SETUP

### Continuous Monitoring
```bash
# Check if monitoring is running
ps aux | grep gpts-monitor

# View monitoring logs
tail -f /tmp/gpts-monitor.log

# View alerts
tail -f /tmp/gpts-alerts.log
```

### Manual Health Checks
```bash
# Quick health check command
check_gpts() {
    echo "🔍 Quick GPTs Health Check..."
    curl -s "https://guardiansofthegreentoken.com/gpts/health" | jq '.data.status'
    curl -s "https://guardiansofthegreentoken.com/gpts/unified/symbols" | jq '.data.total_count'
}
```

## 🔧 TROUBLESHOOTING

### Common Issues:

**1. 404 Not Found on /gpts/ endpoints**
- Check if `registerGptsRoutes(app)` is called in server/routes.ts
- Verify routes are registered before Vite middleware

**2. Python Service Connection Failed**
- Check if Python service is running on port 8000
- Verify `PY_BASE` environment variable

**3. Slow Response Times**
- Check Enhanced Sniper Engine status
- Verify CoinGlass API rate limits
- Monitor system resources

### Emergency Rollback
If critical issues occur:
```bash
# Stop current deployment
# Rollback to previous stable version
# Run smoke tests on rolled-back version
./scripts/gpts-smoke-test.sh
```

## 📋 POST-DEPLOYMENT CHECKLIST

- [ ] All smoke tests passed ✅
- [ ] System health shows "operational" ✅
- [ ] Enhanced Sniper Engine running (4 modules) ✅
- [ ] Private GPT integration working ✅
- [ ] Monitoring active (optional) ✅
- [ ] Performance within acceptable limits ✅

## 🎯 SUCCESS CRITERIA

**Deployment is successful when:**
1. **All smoke tests pass** (scripts/gpts-smoke-test.sh returns exit code 0)
2. **Private GPT can access data** via /gpts/unified/advanced
3. **System health shows operational status**
4. **Enhanced Sniper Engine shows 4 active modules**
5. **Response times < 5 seconds**

---

**⚠️ IMPORTANT:** Never deploy without running smoke tests. The `/gpts/` endpoints are critical for private GPT integration and must remain stable.
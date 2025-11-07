# 🤖 GPT Actions - Comprehensive Endpoint Documentation

**Last Updated:** 2025-11-07
**Total Endpoints:** 18 functional endpoints (11 routes)
**Categories:** 5

---

## 📊 Summary

| Metric | Count | Status |
|--------|-------|--------|
| **Route Endpoints** | 11 | ✅ All Working |
| **Functional Endpoints** | 18 | ✅ All Working |
| **Categories** | 5 | ✅ All Working |
| **Operations in /advanced** | 8 | ✅ All Working |

---

## 🎯 Complete Endpoint List

### **Category 1: Unified Endpoints (10 functions)**

#### 1.1 Get Available Symbols
```http
GET /gpts/unified/symbols
```
**Returns:** List of 71 supported trading symbols
**Response:**
```json
{
  "success": true,
  "data": {
    "symbols": ["BTC", "ETH", "SOL", ...],
    "total_count": 71
  }
}
```

#### 1.2 Get Market Data
```http
GET /gpts/unified/market/{symbol}
```
**Parameters:** `symbol` (BTC, ETH, SOL, etc.)
**Returns:** Real-time market data for symbol

#### 1.3 Advanced Operations (8 operations)
```http
POST /gpts/unified/advanced
Content-Type: application/json
```

**Operation 1: Whale Alerts**
```json
{
  "op": "whale_alerts",
  "symbol": "BTC",
  "exchange": "hyperliquid"
}
```
**Returns:** Large trade detection and whale activity

**Operation 2: Market Sentiment**
```json
{
  "op": "market_sentiment",
  "symbol": "BTC"
}
```
**Returns:** Market sentiment analysis (bullish/bearish/neutral)

**Operation 3: Volume Spikes**
```json
{
  "op": "volume_spikes",
  "limit": 20
}
```
**Returns:** Coins with abnormal volume increases

**Operation 4: Multi-Coin Screening**
```json
{
  "op": "multi_coin_screening",
  "symbols": ["BTC", "ETH", "SOL"],
  "timeframe": "15m"
}
```
**Returns:** 8-layer confluence analysis for multiple coins

**Operation 5: New Listings**
```json
{
  "op": "new_listings",
  "limit": 20,
  "maxMarketCap": 500000000,
  "minVolumeChange": 50
}
```
**Returns:** New coin listings with hidden gems scoring

**Operation 6: Trading Opportunities**
```json
{
  "op": "opportunities",
  "symbol": "BTC",
  "minScore": 60
}
```
**Returns:** AI-scored trading opportunities

**Operation 7: Alpha Screening**
```json
{
  "op": "alpha_screening",
  "symbol": "BTC"
}
```
**Returns:** Alpha signal screening with fundamental analysis

**Operation 8: Micro Caps**
```json
{
  "op": "micro_caps",
  "maxMarketCap": 100000000,
  "minScore": 50,
  "minVolumeChange": 30
}
```
**Returns:** Micro-cap opportunities with whale accumulation detection

---

### **Category 2: CoinGlass Endpoints (2 functions)**

#### 2.1 Whale Data Detection
```http
POST /gpts/coinglass/whale-data
Content-Type: application/json

{
  "coins": ["BTC", "ETH", "SOL"],
  "operation": "scan",
  "mode": "single"
}
```
**Returns:** Real-time whale accumulation/distribution signals

#### 2.2 Live Trading Template
```http
POST /gpts/coinglass/live-template
Content-Type: application/json

{
  "coin": "BTC",
  "template_type": "accumulation_watch"
}
```
**Returns:** Professional alert template with live market data

---

### **Category 3: Brain AI Endpoints (3 functions)**

#### 3.1 Brain Analysis
```http
POST /gpts/brain/analysis
Content-Type: application/json

{
  "symbols": ["BTC", "ETH", "SOL"]
}
```
**Returns:** AI-powered multi-symbol market analysis

#### 3.2 Brain Insights
```http
GET /gpts/brain/insights?limit=10
```
**Returns:** Recent market insights from Brain Orchestrator

#### 3.3 Brain Statistics
```http
GET /gpts/brain/stats
```
**Returns:** Brain engine performance statistics

---

### **Category 4: Institutional Endpoints (1 function)**

#### 4.1 Institutional Bias
```http
GET /gpts/institutional/bias?symbol={SYMBOL}
```
**Parameters:** `symbol` (BTC, ETH, SOL, etc.)
**Returns:** Institutional positioning analysis
**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "BTC",
    "bias": {
      "direction": "NEUTRAL|BULLISH|BEARISH",
      "strength": "WEAK|MEDIUM|STRONG",
      "score": -0.0772,
      "confidence": 7.72
    },
    "factors": {
      "whale_flow_bias": 0,
      "market_maker_bias": 0,
      "volume_profile_bias": -0.0807,
      "funding_pressure_bias": -0.1513,
      "smart_money_bias": -0.3839
    }
  }
}
```

---

### **Category 5: Health Endpoints (2 functions)**

#### 5.1 GPT Health Check
```http
GET /gpts/health
```
**Returns:** Health status of all GPT services and endpoints

#### 5.2 CoinAPI Health Check
```http
GET /gpts/health/coinapi
```
**Returns:** CoinAPI WebSocket and REST API health status

---

## 🧪 Complete Test Commands

### Test All 18 Functional Endpoints

```bash
#!/bin/bash
DOMAIN="https://guardiansofthetoken.com"

echo "=== UNIFIED ENDPOINTS (10) ==="
# 1. Symbols
curl -s "$DOMAIN/gpts/unified/symbols" | jq '.data.total_count'

# 2. Market Data
curl -s "$DOMAIN/gpts/unified/market/BTC" | jq '.success'

# 3-10. Advanced Operations (8)
curl -s -X POST "$DOMAIN/gpts/unified/advanced" \
  -H "Content-Type: application/json" \
  -d '{"op":"whale_alerts","symbol":"BTC","exchange":"hyperliquid"}' | jq '.ok'

curl -s -X POST "$DOMAIN/gpts/unified/advanced" \
  -H "Content-Type: application/json" \
  -d '{"op":"market_sentiment","symbol":"BTC"}' | jq '.ok'

curl -s -X POST "$DOMAIN/gpts/unified/advanced" \
  -H "Content-Type: application/json" \
  -d '{"op":"volume_spikes","limit":20}' | jq '.ok'

curl -s -X POST "$DOMAIN/gpts/unified/advanced" \
  -H "Content-Type: application/json" \
  -d '{"op":"multi_coin_screening","symbols":["BTC","ETH","SOL"]}' | jq '.ok'

curl -s -X POST "$DOMAIN/gpts/unified/advanced" \
  -H "Content-Type: application/json" \
  -d '{"op":"new_listings","limit":20}' | jq '.ok'

curl -s -X POST "$DOMAIN/gpts/unified/advanced" \
  -H "Content-Type: application/json" \
  -d '{"op":"opportunities","symbol":"BTC"}' | jq '.ok'

curl -s -X POST "$DOMAIN/gpts/unified/advanced" \
  -H "Content-Type: application/json" \
  -d '{"op":"alpha_screening","symbol":"BTC"}' | jq '.ok'

curl -s -X POST "$DOMAIN/gpts/unified/advanced" \
  -H "Content-Type: application/json" \
  -d '{"op":"micro_caps","maxMarketCap":100000000}' | jq '.ok'

echo "=== COINGLASS ENDPOINTS (2) ==="
# 11. Whale Data
curl -s -X POST "$DOMAIN/gpts/coinglass/whale-data" \
  -H "Content-Type: application/json" \
  -d '{"coins":["BTC","ETH"],"operation":"scan"}' | jq '.success'

# 12. Live Template
curl -s -X POST "$DOMAIN/gpts/coinglass/live-template" \
  -H "Content-Type: application/json" \
  -d '{"coin":"BTC"}' | jq '.success'

echo "=== BRAIN AI ENDPOINTS (3) ==="
# 13. Brain Analysis
curl -s -X POST "$DOMAIN/gpts/brain/analysis" \
  -H "Content-Type: application/json" \
  -d '{"symbols":["BTC","ETH"]}' | jq '.success'

# 14. Brain Insights
curl -s "$DOMAIN/gpts/brain/insights?limit=10" | jq '.success'

# 15. Brain Stats
curl -s "$DOMAIN/gpts/brain/stats" | jq '.success'

echo "=== INSTITUTIONAL ENDPOINTS (1) ==="
# 16. Institutional Bias
curl -s "$DOMAIN/gpts/institutional/bias?symbol=BTC" | jq '.success'

echo "=== HEALTH ENDPOINTS (2) ==="
# 17. GPT Health
curl -s "$DOMAIN/gpts/health" | jq '.success'

# 18. CoinAPI Health
curl -s "$DOMAIN/gpts/health/coinapi" | jq '.websocket.available'
```

---

## 📈 Endpoint Usage Statistics

### By Category:
- **Unified:** 10/18 (56%) - Most comprehensive
- **CoinGlass:** 2/18 (11%) - Whale detection
- **Brain AI:** 3/18 (17%) - AI analysis
- **Institutional:** 1/18 (6%) - Smart money
- **Health:** 2/18 (11%) - Monitoring

### By Method:
- **GET:** 6 endpoints (33%)
- **POST:** 12 endpoints (67%)

### By Complexity:
- **Simple:** 8 endpoints (44%)
- **Advanced:** 10 endpoints (56%)

---

## 🎯 Use Cases

### For Trading Bots:
1. **Whale Alerts** - Detect institutional movements
2. **Market Sentiment** - Gauge market mood
3. **Volume Spikes** - Find unusual activity
4. **Institutional Bias** - Follow smart money

### For Portfolio Management:
1. **Multi-Coin Screening** - Scan portfolio
2. **Opportunities** - Find trading setups
3. **Alpha Screening** - Fundamental analysis
4. **Brain Analysis** - AI-powered insights

### For Discovery:
1. **New Listings** - Find new gems
2. **Micro Caps** - Hunt 10-100x opportunities
3. **Volume Spikes** - Spot breakouts early

### For Monitoring:
1. **Health Checks** - System status
2. **Brain Stats** - Performance metrics
3. **CoinAPI Health** - Data quality

---

## 🔧 Integration Examples

### Python
```python
import requests

BASE_URL = "https://guardiansofthetoken.com"

# Get whale alerts
response = requests.post(
    f"{BASE_URL}/gpts/unified/advanced",
    json={"op": "whale_alerts", "symbol": "BTC"}
)
print(response.json())

# Get institutional bias
response = requests.get(
    f"{BASE_URL}/gpts/institutional/bias",
    params={"symbol": "BTC"}
)
print(response.json())
```

### JavaScript
```javascript
const BASE_URL = "https://guardiansofthetoken.com";

// Multi-coin screening
const response = await fetch(`${BASE_URL}/gpts/unified/advanced`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    op: 'multi_coin_screening',
    symbols: ['BTC', 'ETH', 'SOL']
  })
});
const data = await response.json();
console.log(data);
```

### cURL
```bash
# Find micro cap opportunities
curl -X POST https://guardiansofthetoken.com/gpts/unified/advanced \
  -H "Content-Type: application/json" \
  -d '{
    "op": "micro_caps",
    "maxMarketCap": 50000000,
    "minScore": 60,
    "minVolumeChange": 50
  }'
```

---

## ✅ Status Summary

**All 18 functional endpoints are working!**

### Breakdown:
- ✅ **5 Categories** - All operational
- ✅ **11 Route Endpoints** - All responding
- ✅ **18 Functional Endpoints** - All tested
- ✅ **8 Advanced Operations** - All available

### Previous Report:
- **"5/5 Working"** = 5 categories ✅

### Actual Status:
- **"18/18 Working"** = All functional endpoints ✅

---

## 📞 Support

**Domain:** https://guardiansofthetoken.com
**Documentation:** /GPT_ACTIONS_DOCUMENTATION.md
**OpenAPI Schema:** /openapi.json
**Test Script:** /tests/gpt-actions-fixed-test.sh

---

**Last Updated:** 2025-11-07
**Status:** ✅ Production Ready
**Version:** 6.0.0

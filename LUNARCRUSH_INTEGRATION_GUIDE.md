# 🌟 LunarCrush Social Intelligence Integration Guide

## Overview

The LunarCrush Social Intelligence service provides real-time social sentiment analysis for cryptocurrencies, tracking social media mentions, influencer activity, and market sentiment across multiple platforms.

## ⚡ API Version

**Current Version**: LunarCrush API v4
**Base URL**: `https://lunarcrush.com/api4/public`
**Updated**: 2025-11-06

> ✅ **Fully updated to v4** - Ready for API key subscription!

## 🚀 Service Status

✅ **ACTIVE** - LunarCrush API service is running on port 8001
📍 **Endpoint**: `http://212.85.26.253:8001`
🔧 **Mode**: Mock (waiting for API key configuration)
📊 **API Compatibility**: v4 Ready
🔑 **Next Step**: Subscribe to LunarCrush API and configure API key  

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

### Social Sentiment Analysis
```bash
GET /sentiment/{symbol}
```
**Example**: `GET /sentiment/BTC`

### Trending Cryptocurrencies
```bash
GET /trending?limit={N}
```
**Example**: `GET /trending?limit=10`

### Compare Multiple Coins
```bash
POST /compare
Content-Type: application/json

{
  "symbols": ["BTC", "ETH", "SOL"]
}
```

### Market Overview
```bash
GET /market-overview
```

### Influencer Analysis
```bash
GET /influencers/{symbol}
```
**Example**: `GET /influencers/SOL`

## 📊 Response Data Structure

### Social Sentiment Response
```json
{
  "success": true,
  "data": {
    "symbol": "BTC",
    "galaxy_score": 78.7,
    "sentiment": 47.8,
    "social_volume": 101850,
    "alt_rank": 48,
    "trending_score": 92.8,
    "price_change_24h": -2.17,
    "reddit_posts": 335,
    "twitter_mentions": 3350,
    "influencers": [...],
    "recommendation": "HOLD",
    "confidence": 72,
    "timestamp": "2025-11-03T14:12:57.998005"
  },
  "timestamp": "2025-11-03T14:12:57.998037"
}
```

### Key Metrics Explained

- **Galaxy Score**: Overall social performance score (0-100)
- **Sentiment**: Social sentiment score (0-100, higher = more bullish)
- **Social Volume**: Total social media mentions
- **Alt Rank**: Ranking among all cryptocurrencies
- **Trending Score**: Current trending momentum (0-100)
- **Confidence**: AI confidence in the recommendation (0-100)
- **Recommendation**: BUY/HOLD/SELL based on social sentiment

## 🔧 Configuration

### Environment Variables
```bash
LUNARCRUSH_API_KEY="your_api_key_here"
LUNARCRUSH_PORT=8001
LUNARCRUSH_HOST="0.0.0.0"
```

> **Note**: LunarCrush API v4 only requires API key (no separate secret needed)

### Getting Your API Key

1. Sign up at [LunarCrush](https://lunarcrush.com)
2. Navigate to API settings
3. Generate your v4 API key
4. Add to `.env` file: `LUNARCRUSH_API_KEY="your_key_here"`
5. Restart service: `sudo systemctl restart lunarcrush.service`

**Documentation**: https://lunarcrush.com/faq/how-do-i-generate-an-api-token

### Service Management
```bash
# Start service
sudo systemctl start lunarcrush.service

# Stop service
sudo systemctl stop lunarcrush.service

# Check status
sudo systemctl status lunarcrush.service

# View logs
sudo journalctl -u lunarcrush.service -f
```

## 📈 Usage Examples

### 1. Get Bitcoin Sentiment
```bash
curl -s http://212.85.26.253:8001/sentiment/BTC | jq .
```

### 2. Get Top 5 Trending Coins
```bash
curl -s http://212.85.26.253:8001/trending?limit=5 | jq .
```

### 3. Compare Multiple Coins
```bash
curl -s -X POST http://212.85.26.253:8001/compare \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["BTC", "ETH", "SOL"]}' | jq .
```

### 4. Get Influencer Data for SOL
```bash
curl -s http://212.85.26.253:8001/influencers/SOL | jq .
```

## 🎯 Integration with Trading Signals

The LunarCrush service can be integrated with trading algorithms to:

1. **Validate Trading Signals**: Use social sentiment to confirm technical analysis
2. **Market Timing**: Identify optimal entry/exit points based on social momentum
3. **Risk Management**: Monitor social sentiment for early warning signals
4. **Trend Confirmation**: Verify price trends with social volume data

### Example Integration Logic
```python
def should_buy_symbol(symbol):
    # Get technical signal
    technical_signal = get_technical_analysis(symbol)
    
    # Get social sentiment
    social_data = get_social_sentiment(symbol)
    
    # Combine signals
    if (technical_signal == 'BUY' and 
        social_data['sentiment'] > 60 and 
        social_data['confidence'] > 70):
        return True
    
    return False
```

## 🔍 Monitoring & Alerts

### Health Monitoring
```bash
# Check service health
curl -s http://212.85.26.253:8001/health | jq '.status'
```

### Key Metrics to Monitor
- API response time
- Social sentiment changes
- Trending score movements
- Influencer activity spikes

## 🚨 Error Handling

The API returns structured error responses:
```json
{
  "success": false,
  "error": "Symbol not found",
  "timestamp": "2025-11-03T14:18:00.000000"
}
```

Common error codes:
- `400`: Bad request (invalid parameters)
- `404`: Symbol not found
- `500`: Internal server error

## 📚 Advanced Features

### Caching
The service implements intelligent caching to reduce API calls and improve response times.

### Rate Limiting
Built-in rate limiting prevents abuse and ensures fair usage.

### Mock Mode
When API keys are not configured, the service operates in mock mode with realistic sample data.

## 🔐 Security Considerations

- API keys are stored securely in environment variables
- Service runs with minimal privileges
- All endpoints are CORS-enabled for web integration
- Input validation prevents injection attacks

## 📞 Support

For issues or questions about the LunarCrush integration:

1. Check service logs: `sudo journalctl -u lunarcrush.service -n 50`
2. Verify API key configuration in `.env`
3. Test basic connectivity with health endpoint
4. Check network connectivity to `http://212.85.26.253:8001`

## 🔄 Updates & Maintenance

The service automatically restarts on failures and can be updated without downtime:

```bash
# Update service configuration
sudo cp /root/crypto-api/systemd/lunarcrush.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart lunarcrush.service
```

## 🆕 v4 Migration Complete

**Migration Date**: 2025-11-06

### What Changed:
- ✅ Base URL updated to `https://lunarcrush.com/api4/public`
- ✅ All endpoints migrated to v4 format
- ✅ Response parsing updated for v4 structure
- ✅ Influencer fetching updated to use topic creators endpoint
- ✅ Trending coins now uses `coins/list/v2` with sorting
- ✅ Full backward compatibility with existing API endpoints
- ✅ Mock mode still functional for testing without API key

### Benefits:
- 🚀 Latest features from LunarCrush
- 📊 Better data quality and coverage
- 🔧 Improved API reliability
- 📈 Long-term support and updates

### Migration Guide:
For detailed migration information, see: `LUNARCRUSH_V4_MIGRATION.md`

---

**Last Updated**: 2025-11-06
**Service Version**: 2.0.0 (v4)
**API Version**: LunarCrush v4
**Status**: ✅ Ready for Production (API key required)

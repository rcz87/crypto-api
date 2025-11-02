# 🌙 LunarCrush Setup Instructions

## Quick Start (5 Minutes)

### ✅ Status: READY TO USE

Struktur integrasi LunarCrush sudah **LENGKAP** dan siap digunakan. Tinggal tambahkan API key.

---

## 📋 Files Created

```
✅ server/clients/lunarcrush.ts          - LunarCrush API client
✅ server/services/socialSentiment.ts    - Social sentiment aggregator
✅ server/services/unifiedSentimentService.ts - Updated (includes social)
✅ server/routes/social.ts               - Social API endpoints
✅ .env.example                          - Updated with LunarCrush config
✅ docs/LUNARCRUSH_INTEGRATION.md        - Complete documentation
✅ LUNARCRUSH_SETUP_INSTRUCTIONS.md      - This file
```

---

## 🚀 Activation Steps

### Step 1: Get LunarCrush API Key

1. **Sign up** di [LunarCrush.com](https://lunarcrush.com/)
2. **Login** → Go to **Account → API Access**
3. **Generate API Key** (Free tier: 300 requests/day)
4. **Copy** API key (format: `lc_xxxxx...`)

**Pricing:**
- Free: 300 req/day (cukup untuk testing)
- Pro: $99/month, 10,000 req/day (production)

### Step 2: Add API Key

```bash
# Open .env file
nano .env

# Add these lines:
LUNARCRUSH_API_KEY="lc_your_actual_api_key_here"
LUNARCRUSH_TIER="free"
```

**IMPORTANT:**
- ✅ Jangan commit ke git (sudah di .gitignore)
- ✅ Keep it secret
- ✅ Ganti "free" ke "pro" jika upgrade

### Step 3: Register Routes

Add to `server/routes.ts`:

```typescript
// Import social routes
import socialRoutes from './routes/social';

// Register routes (add after existing routes)
router.use('/api/social', socialRoutes);
```

### Step 4: Restart Server

```bash
# Development
npm run dev

# Production
pm2 restart crypto-api

# Docker
docker-compose restart
```

### Step 5: Verify

```bash
# Test endpoint
curl http://localhost:5000/api/social/health

# Should return:
{
  "success": true,
  "status": "healthy",
  "lunarcrush_enabled": true,
  "message": "Social sentiment service is operational"
}

# Test real data
curl http://localhost:5000/api/social/sentiment/BTC
```

---

## 🎯 API Endpoints Available

Once activated, these endpoints are ready:

```bash
# Social sentiment for coin
GET /api/social/sentiment/:symbol

# Raw LunarCrush data
GET /api/social/lunarcrush/:symbol

# Top influencers
GET /api/social/influencers/:symbol

# Trending coins
GET /api/social/trending

# Compare multiple coins
GET /api/social/compare?symbols=BTC,ETH,SOL

# Rate limit status
GET /api/social/rate-limit

# Health check
GET /api/social/health
```

---

## 📊 Unified Sentiment Integration

Social sentiment is automatically integrated into unified sentiment:

```bash
# Get complete sentiment analysis (includes social at 15% weight)
curl http://localhost:5000/api/sentiment/unified/BTC

# Response includes:
{
  "data_sources": {
    "fear_greed": { "score": 75, "weight": 0.25 },
    "fomo": { "score": 60, "weight": 0.15 },
    "etf": { "score": 80, "weight": 0.20 },
    "social": { "score": 70, "weight": 0.15 },  ← NEW!
    "whale": { "score": 65, "weight": 0.15 },
    "funding": { "score": 55, "weight": 0.10 }
  }
}
```

---

## ⚙️ Configuration Options

### Rate Limiting

```bash
# Free tier (default)
LUNARCRUSH_TIER="free"        # 300 requests/day

# Pro tier
LUNARCRUSH_TIER="pro"         # 10,000 requests/day

# Enterprise
LUNARCRUSH_TIER="enterprise"  # 100,000+ requests/day
```

### Caching

Built-in caching (5 minutes TTL) to optimize API usage:
- Social sentiment: 5 min cache
- LunarCrush raw data: 5 min cache
- Unified sentiment: 2 min cache

### Fallback Behavior

If LunarCrush is not enabled:
- ✅ Social endpoints return graceful errors
- ✅ Unified sentiment works without social data
- ✅ No crashes or breaking changes

---

## 🔍 Testing

### Test 1: Health Check

```bash
curl http://localhost:5000/api/social/health
```

Expected: `"status": "healthy"` if configured

### Test 2: Social Sentiment

```bash
curl http://localhost:5000/api/social/sentiment/BTC
```

Expected: Sentiment score, alerts, recommendations

### Test 3: Unified Sentiment

```bash
curl http://localhost:5000/api/sentiment/unified/ETH
```

Expected: Confluence score with social data included

### Test 4: Rate Limits

```bash
curl http://localhost:5000/api/social/rate-limit
```

Expected: Current usage stats

---

## 🐛 Troubleshooting

### Issue: "LunarCrush is not enabled"

**Solution:**
```bash
# Check .env
cat .env | grep LUNARCRUSH

# Should show your API key
# If not, add it and restart server
```

### Issue: "Rate limit exceeded"

**Solution:**
```bash
# Check usage
curl /api/social/rate-limit

# If at limit:
# Option 1: Wait 24h for reset
# Option 2: Upgrade to Pro tier
# Option 3: Increase cache TTL (edit socialSentiment.ts)
```

### Issue: "No data for symbol"

**Cause:** LunarCrush only supports ~2000 major coins

**Solution:**
```bash
# Test dengan major coin
curl /api/social/sentiment/BTC  # Should work

# Jika altcoin tidak ada data, normal
```

---

## 📖 Documentation

Complete guide: `docs/LUNARCRUSH_INTEGRATION.md`

Includes:
- Architecture overview
- All API endpoints
- Data structures
- Usage examples
- Best practices
- Advanced features

---

## ✅ Integration Checklist

Before going live:

- [ ] API key added to `.env`
- [ ] Routes registered in `server/routes.ts`
- [ ] Server restarted
- [ ] Health check passes
- [ ] Test endpoint returns data
- [ ] Rate limits monitored
- [ ] Fallback behavior tested
- [ ] Documentation reviewed
- [ ] Frontend updated (optional)

---

## 🎯 Next Steps

After activation:

1. **Monitor Performance**
   ```bash
   # Check cache hit rates
   # Optimize TTL if needed
   ```

2. **Adjust Weights**
   ```typescript
   // Edit server/services/unifiedSentimentService.ts
   const WEIGHTS = {
     SOCIAL: 0.15,  // Adjust based on backtesting
   };
   ```

3. **Add to Frontend**
   ```typescript
   // Display social metrics in dashboard
   // Show trending coins
   // Alert on viral activity
   ```

4. **Backtest Signals**
   ```bash
   # Validate social sentiment accuracy
   # Compare with historical price moves
   ```

---

## 🆘 Support

**Documentation:**
- LunarCrush Docs: https://lunarcrush.com/developers/docs
- Internal Guide: `docs/LUNARCRUSH_INTEGRATION.md`

**Issues:**
- LunarCrush Support: support@lunarcrush.com
- Check logs: `pm2 logs crypto-api`
- Debug mode: `LOG_LEVEL=DEBUG`

**Code Locations:**
- Client: `server/clients/lunarcrush.ts`
- Service: `server/services/socialSentiment.ts`
- Routes: `server/routes/social.ts`

---

## 💡 Tips

1. **Start with Free Tier** - Test first before upgrading
2. **Monitor Rate Limits** - Set alerts at 80% usage
3. **Cache Aggressively** - Use 5+ min TTL in production
4. **Don't Trust Social Alone** - Always combine with on-chain data
5. **Watch for Pumps** - High social volume + low confidence = warning

---

**Status:** ✅ Ready to activate - Tunggu API key!

**Created:** November 2025
**Author:** Claude Code Assistant

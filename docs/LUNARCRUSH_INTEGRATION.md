# 🌙 LunarCrush Integration Guide

## 📋 Table of Contents
- [Overview](#overview)
- [Why LunarCrush?](#why-lunarcrush)
- [Getting API Key](#getting-api-key)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [Data Structure](#data-structure)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

LunarCrush provides **social intelligence** for cryptocurrency markets by analyzing millions of social media posts, influencer activity, and community engagement across:

- 🐦 **Twitter/X** - Tweets, mentions, sentiment
- 🤖 **Reddit** - Posts, comments, upvotes
- 📺 **YouTube** - Videos, views, engagement
- 📰 **News Sites** - Articles, coverage
- 📱 **Other platforms** - Discord, Telegram, etc.

### Integration Status

✅ **READY TO USE** - Struktur sudah lengkap, tinggal tambahkan API key

### Architecture

```
LunarCrush Integration
├── Client Layer
│   └── server/clients/lunarcrush.ts
│       ├── API communication
│       ├── Rate limiting
│       ├── Caching
│       └── Data normalization
│
├── Service Layer
│   └── server/services/socialSentiment.ts
│       ├── Sentiment aggregation
│       ├── Alert generation
│       └── Recommendation engine
│
└── Unified Layer
    └── server/services/unifiedSentimentService.ts
        └── Combines social data with:
            ├── Fear & Greed Index (25%)
            ├── FOMO Detection (15%)
            ├── ETF Flows (20%)
            ├── Social Sentiment (15%) ← NEW!
            ├── Whale Activity (15%)
            └── Funding Rates (10%)
```

---

## 💡 Why LunarCrush?

### Problems It Solves

| Problem | LunarCrush Solution |
|---------|-------------------|
| 📊 **Price moves without on-chain signal** | Social sentiment often leads price |
| 🐋 **Missing retail FOMO detection** | Twitter/Reddit activity shows retail interest |
| 🚨 **Pump & dump warnings** | Sudden social spike = potential manipulation |
| 📈 **Early trend detection** | Influencer mentions can predict pumps |
| 🤝 **Community health** | Engaged community = sustainable growth |

### Data You Get

```javascript
{
  // Overall Health Scores
  "galaxy_score": 75,          // 0-100 overall health
  "alt_rank": 42,              // LunarCrush ranking (1 = best)
  "sentiment_score": 65,       // -100 to 100 sentiment

  // Social Metrics
  "social_volume_24h": 15420,  // Total mentions
  "social_dominance": 2.5,     // % of all crypto talk
  "unique_contributors": 1200, // Real people talking

  // Platform Breakdown
  "twitter_mentions_24h": 8500,
  "reddit_posts_24h": 340,
  "news_articles_24h": 15,

  // Trend Analysis
  "trending_score": 82,        // How hot is it?
  "momentum": "rising"         // rising/stable/falling
}
```

---

## 🔑 Getting API Key

### Step 1: Create Account

1. Go to [LunarCrush.com](https://lunarcrush.com/)
2. Click **Sign Up** (email atau Google)
3. Verify email

### Step 2: Get API Key

#### Option 1: Free Tier ✅ Recommended untuk testing
```
Pricing: FREE
Requests: 300/day
Perfect for: Development, testing, small projects
```

1. Login ke dashboard
2. Navigate to: **Account → API Access**
3. Click **Generate API Key**
4. Copy key (format: `lc_xxxxxxxxxxxxxxxxxxxxxxxx`)

#### Option 2: Pro Tier 💰 For production
```
Pricing: $99/month
Requests: 10,000/day
Perfect for: Production apps, high traffic
```

1. Login → **Upgrade to Pro**
2. Subscribe ($99/month)
3. Generate new API key with higher limits

#### Option 3: Enterprise 🏢
```
Pricing: Custom
Requests: 100,000+/day
Contact: sales@lunarcrush.com
```

### API Key Example

```bash
lc_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd
```

---

## ⚙️ Setup Instructions

### Step 1: Add API Key to Environment

```bash
# Open .env file
nano .env

# Add LunarCrush configuration
LUNARCRUSH_API_KEY="lc_your_actual_api_key_here"
LUNARCRUSH_TIER="free"  # or "pro" or "enterprise"
```

**IMPORTANT:**
- ✅ DO: Add to `.env` (gitignored)
- ❌ DON'T: Commit API key to git
- ❌ DON'T: Share API key publicly

### Step 2: Restart Server

```bash
# Development
npm run dev

# Production
pm2 restart crypto-api

# Docker
docker-compose restart
```

### Step 3: Verify Integration

```bash
# Check logs for confirmation
# You should see:
# ✅ LunarCrush client initialized

# Test endpoint
curl http://localhost:5000/api/social/sentiment/BTC
```

### Step 4: Monitor Rate Limits

```bash
# Check rate limit status
curl http://localhost:5000/api/social/rate-limit

# Response:
{
  "enabled": true,
  "requests_used": 45,
  "requests_remaining": 255,
  "daily_limit": 300,
  "reset_time": 1699564800000
}
```

---

## 🚀 API Endpoints

### 1. Social Sentiment for Coin

```http
GET /api/social/sentiment/:symbol
```

**Example:**
```bash
curl http://localhost:5000/api/social/sentiment/BTC
```

**Response:**
```json
{
  "ok": true,
  "symbol": "BTC",
  "metrics": {
    "sentiment_score": 65,
    "sentiment_label": "bullish",
    "confidence": 85,
    "social_volume_24h": 25000,
    "trending_score": 75,
    "galaxy_score": 80,
    "alt_rank": 1
  },
  "alerts": [
    {
      "type": "viral",
      "severity": "high",
      "message": "25,000 mentions in 24h - Going viral!"
    }
  ],
  "recommendations": [
    "🟢 Strong bullish social sentiment - Consider long positions",
    "⚠️ Watch for sentiment reversal as it may be overheated"
  ],
  "summary": "BTC shows bullish social sentiment (65/100) with 25,000 mentions and high trending activity."
}
```

### 2. Unified Sentiment (Includes Social)

```http
GET /api/sentiment/unified/:symbol
```

**Example:**
```bash
curl http://localhost:5000/api/sentiment/unified/ETH
```

**Response includes social data weighted at 15%:**
```json
{
  "confluence_score": 72,
  "trading_signal": "BUY",
  "data_sources": {
    "fear_greed": { "score": 75, "weight": 0.25 },
    "fomo": { "score": 60, "weight": 0.15 },
    "etf": { "score": 80, "weight": 0.20 },
    "social": { "score": 70, "weight": 0.15 },  // ← NEW!
    "whale": { "score": 65, "weight": 0.15 },
    "funding": { "score": 55, "weight": 0.10 }
  }
}
```

### 3. LunarCrush Raw Data

```http
GET /api/social/lunarcrush/:symbol
```

**Get raw LunarCrush metrics:**
```bash
curl http://localhost:5000/api/social/lunarcrush/SOL
```

### 4. Rate Limit Status

```http
GET /api/social/rate-limit
```

**Monitor your usage:**
```bash
curl http://localhost:5000/api/social/rate-limit
```

---

## 📊 Data Structure

### SocialSentimentData

```typescript
interface SocialMetrics {
  // Core Metrics
  sentiment_score: number;       // -100 to 100
  sentiment_label: 'bearish' | 'neutral' | 'bullish';
  confidence: number;            // 0-100

  // Volume & Engagement
  social_volume_24h: number;
  social_volume_trend: 'increasing' | 'decreasing' | 'stable';
  engagement_rate: number;
  unique_contributors: number;

  // Sentiment Breakdown
  positive_ratio: number;        // 0-1
  negative_ratio: number;        // 0-1
  neutral_ratio: number;         // 0-1

  // Platform Breakdown
  twitter_sentiment: number;
  reddit_sentiment: number;
  news_sentiment: number;

  // Quality Scores
  galaxy_score: number;          // LunarCrush overall health
  alt_rank: number;              // LunarCrush ranking
  trending_score: number;        // 0-100

  // Metadata
  data_sources: string[];
  timestamp: number;
}
```

---

## 💻 Usage Examples

### Example 1: Check Before Trade

```typescript
// Get social sentiment before entering trade
const response = await fetch('/api/social/sentiment/AVAX');
const { metrics, recommendations } = await response.json();

if (metrics.sentiment_score > 50 && metrics.confidence > 70) {
  console.log('✅ Social sentiment supports long position');
  // Place trade
} else {
  console.log('⚠️ Weak social sentiment, wait for confirmation');
}
```

### Example 2: Pump Detection

```typescript
// Detect potential pumps
const { metrics, alerts } = await getSocialSentiment('MEME');

const isPump =
  metrics.social_volume_trend === 'increasing' &&
  metrics.trending_score > 80 &&
  alerts.some(a => a.type === 'viral');

if (isPump && metrics.confidence < 40) {
  console.log('🚨 Possible pump & dump - High risk!');
}
```

### Example 3: Unified Analysis

```typescript
// Get complete sentiment picture
const unified = await fetch('/api/sentiment/unified/BTC');
const { confluence_score, data_sources } = await unified.json();

console.log('On-chain sentiment:', data_sources.whale.score);
console.log('Social sentiment:', data_sources.social.score);
console.log('Overall confluence:', confluence_score);

// Make decision based on all factors
if (confluence_score > 70) {
  console.log('🟢 High confidence trade setup');
}
```

### Example 4: Compare Platforms

```typescript
// See which platform is most bullish
const { metrics } = await getSocialSentiment('ETH');

const platforms = {
  'Twitter': metrics.twitter_sentiment,
  'Reddit': metrics.reddit_sentiment,
  'News': metrics.news_sentiment
};

const mostBullish = Object.entries(platforms)
  .sort((a, b) => b[1] - a[1])[0];

console.log(`Most bullish platform: ${mostBullish[0]}`);
```

---

## 🔧 Troubleshooting

### Problem: "LunarCrush not enabled"

**Cause:** API key tidak dikonfigurasi

**Solution:**
```bash
# Check .env file
cat .env | grep LUNARCRUSH

# Should show:
LUNARCRUSH_API_KEY=lc_actual_key_here

# If empty, add key and restart
```

### Problem: Rate Limit Exceeded

**Cause:** Sudah mencapai daily limit

**Solution:**
```bash
# Check current usage
curl /api/social/rate-limit

# Wait for reset (24h) or upgrade to Pro
```

**Temporary workaround:**
```bash
# Disable LunarCrush temporarily
# Comment out in .env:
# LUNARCRUSH_API_KEY=""

# System akan fallback ke default metrics
```

### Problem: "No data returned"

**Possible causes:**
1. **Invalid symbol** - LunarCrush hanya support major coins
2. **API down** - Check LunarCrush status
3. **Rate limited** - Check usage

**Debug:**
```bash
# Test dengan major coin dulu
curl /api/social/sentiment/BTC

# Jika berhasil, berarti symbol issue
# Jika gagal, berarti API/key issue
```

### Problem: Data quality low

**Symptoms:** `confidence < 30`, alerts about spam

**Causes:**
- Small/new coin dengan low social volume
- Bot activity / manipulation
- Insufficient data

**Recommendations:**
```typescript
if (metrics.confidence < 40) {
  // Don't rely on social sentiment alone
  // Focus on on-chain and derivatives data
  console.log('⚠️ Use technical analysis instead');
}
```

---

## 📈 Best Practices

### 1. Don't Rely on Social Alone

```typescript
// ❌ BAD: Only social sentiment
if (social.sentiment_score > 70) {
  trade();
}

// ✅ GOOD: Confluence approach
if (
  social.sentiment_score > 70 &&
  onChain.whale_activity === 'accumulation' &&
  technical.rsi < 70
) {
  trade();
}
```

### 2. Watch for Manipulation

```typescript
// High social volume but low quality = red flag
if (
  metrics.social_volume_24h > 10000 &&
  metrics.confidence < 40
) {
  console.log('🚨 Possible coordinated pump');
}
```

### 3. Platform-Specific Analysis

```typescript
// Different platforms, different audiences
if (metrics.twitter_sentiment > 50) {
  console.log('Retail bullish');
}

if (metrics.news_sentiment > 50) {
  console.log('Media coverage increasing');
}
```

### 4. Monitor Rate Limits

```typescript
// Check before making many requests
const { requests_remaining } = await getRateLimitStatus();

if (requests_remaining < 50) {
  console.log('⚠️ Rate limit running low');
  // Increase cache TTL or reduce polling
}
```

---

## 🎯 Integration Checklist

Before going to production:

- [ ] API key added to `.env`
- [ ] API key NOT committed to git
- [ ] Tier configured correctly (`free`/`pro`/`enterprise`)
- [ ] Server restarted after config
- [ ] Test endpoint returns data
- [ ] Rate limit monitoring enabled
- [ ] Fallback behavior tested (when API down)
- [ ] Cache TTL optimized for your traffic
- [ ] Unified sentiment includes social data
- [ ] Frontend updated to show social metrics

---

## 📞 Support

### LunarCrush Support
- Docs: https://lunarcrush.com/developers/docs
- Support: support@lunarcrush.com
- Discord: https://discord.gg/lunarcrush

### Internal Support
- Check logs: `pm2 logs crypto-api`
- Debug mode: Set `LOG_LEVEL=DEBUG`
- Issues: Review `server/clients/lunarcrush.ts`

---

## 🔄 What's Next?

After integration:
1. **Monitor performance** - Track cache hit rates
2. **Optimize weights** - Adjust SOCIAL weight in unified sentiment
3. **Add frontend** - Display social metrics in dashboard
4. **Backtest signals** - Validate social sentiment accuracy
5. **Consider upgrade** - If hitting free tier limits

---

**Status:** ✅ Ready to integrate - Just add API key!

**Last Updated:** November 2025

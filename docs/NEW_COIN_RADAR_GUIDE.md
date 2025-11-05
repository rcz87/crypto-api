# 🚨 New Coin Radar + Early Smart Money Detection

## 📋 OVERVIEW

Modul ini secara otomatis mendeteksi **newly listed cryptocurrency coins** SEBELUM retail mengetahui, lalu menganalisa menggunakan AI Signal & Market Engine (Phase 1-6) untuk mengirim alert ke Telegram Bot Anda.

---

## ✅ FITUR UTAMA

### 1. **Multi-Exchange Scanner**
- ✅ Binance Spot (GET /api/v3/exchangeInfo)
- ✅ OKX Spot (GET /api/v5/public/instruments?instType=SPOT)
- ✅ Coingecko (GET /coins/list?new_listings=true)
- ⚪ DexScreener (optional)

### 2. **Smart Validation**
- ✅ Volume 24h > $200K (konfigurabel)
- ✅ Whale activity detection (TX > $50K)
- ✅ Liquidity & volume real-time check
- ✅ No shitcoin filter

### 3. **AI Analysis Integration**
- ✅ Enhanced AI Signal Engine (25-feature neural network)
- ✅ Market context (funding, CVD, OI, volume)
- ✅ Smart money detection
- ✅ Confidence scoring (60%+ threshold)

### 4. **Telegram Alerts**
- ✅ Early listing alert (immediate)
- ✅ AI signal alert (if valid)
- ✅ Interactive format dengan market data
- ✅ Rate limiting & cooldown protection

---

## 🏗️ ARSITEKTUR

```
┌──────────────────────────────────────────────────────────┐
│                    NEW COIN RADAR                         │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  newCoinScanner.ts (Service)                             │
│  • Scan Binance, OKX, Coingecko                          │
│  • Cache comparison (detect NEW only)                    │
│  • Volume & whale validation                             │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  earlyAnalysisEngine.ts (Service)                        │
│  • Validate coin (volume + whales)                       │
│  • Run Enhanced AI analysis                              │
│  • Filter by confidence (60%+)                           │
│  • Send Telegram alerts                                  │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  newCoinJob.ts (Scheduler)                               │
│  • Runs every 60 seconds (configurable)                  │
│  • Concurrency guard (prevent overlap)                   │
│  • Batch processing with rate limits                     │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  Telegram Signal Bot                                      │
│  • Early alert + AI signal (if valid)                    │
│  • Phase 6 format dengan entry/SL/TP                     │
└──────────────────────────────────────────────────────────┘
```

---

## ⚙️ KONFIGURASI

### 1. **Update .env File**

Copy dari `.env.example` dan tambahkan:

```bash
# ============================================
# NEW COIN RADAR CONFIGURATION
# ============================================

# Enable/disable new coin scanner
ENABLE_NEW_COIN_SCANNER=true

# Scan interval in seconds (default: 60s = 1 minute)
NEW_COIN_SCAN_INTERVAL=60

# Minimum 24h volume threshold (USD)
MIN_NEW_COIN_VOLUME=200000

# Minimum whale transaction amount (USD)  
MIN_WHALE_TX_AMOUNT=50000

# Minimum AI confidence threshold for signals (0-1)
MIN_NEW_COIN_CONFIDENCE=0.6

# Enable specific exchanges
USE_BINANCE=true
USE_OKX=true
USE_COINGECKO=true
```

### 2. **Telegram Bot Configuration**

Pastikan Telegram Signal Bot sudah configured di `.env`:

```bash
# Signal Bot (untuk trading signals only)
TELEGRAM_SIGNAL_BOT_TOKEN=your_bot_token_here
TELEGRAM_SIGNAL_CHAT_ID=your_chat_id_here
```

---

## 🚀 CARA MENGGUNAKAN

### 1. **Enable Module**

```bash
# Edit .env
nano .env

# Set ENABLE_NEW_COIN_SCANNER=true
```

### 2. **Restart PM2**

```bash
pm2 restart crypto-api
pm2 save
```

### 3. **Verify Logs**

```bash
# Check if scanner started
pm2 logs crypto-api | grep NewCoinJob

# Expected output:
# 🚀 [NewCoinJob] Starting New Coin Radar + Early Smart Money Detection
# 📊 [NewCoinJob] Scan interval: 60 seconds
# ✅ [NewCoinJob] New Coin Scanner started
```

### 4. **Monitor Scans**

```bash
# Real-time monitoring
pm2 logs crypto-api --lines 0

# Look for:
# 🔍 [NewCoinScanner] Starting scan for new listings...
# 🆕 [NewCoinScanner] Found X new listings!
# 🔬 [EarlyAnalysis] Starting analysis for SYMBOL...
# ✅ [EarlyAnalysis] VALID SIGNAL DETECTED: SYMBOL LONG 85%
```

---

## 📱 TELEGRAM ALERT FORMAT

### **Example 1: Early Listing Alert**

```
⚠ EARLY LISTING DETECTED — RENDER/USDT

Exchange  : Binance Spot
Listed    : 2 menit lalu
Volume 5m : $1.2M
Whale TXs : 3 wallets > $50K

⏳ Running AI Smart Money Analysis...
```

### **Example 2: AI Signal Alert (if valid)**

```
🚀 AI SIGNAL DETECTED — RENDER/USDT

🟢 LONG SIGNAL ACTIVE
Entry      : 4.8500
Stop Loss  : 4.8000
Take Profit: 4.9500 / 5.1000
R/R Ratio  : 1:2.5

📊 Smart Money Insight:
• CVD +2.3M (buyer aggression)
• Funding -0.010% (shorts pay longs)
• OI +9.8% (fresh leverage entering)

💡 Reason:
Whale accumulation + negative funding + liquidity grab

Time: 24/10/2025 13:08 WIB
```

---

## 🔧 TUNING & OPTIMIZATION

### **Adjust Scan Frequency**

```bash
# Faster scans (30 seconds) - more API calls
NEW_COIN_SCAN_INTERVAL=30

# Slower scans (5 minutes) - less API calls
NEW_COIN_SCAN_INTERVAL=300
```

### **Adjust Volume Threshold**

```bash
# Higher threshold (only high volume coins)
MIN_NEW_COIN_VOLUME=500000

# Lower threshold (more coins, but include low volume)
MIN_NEW_COIN_VOLUME=100000
```

### **Adjust Confidence Threshold**

```bash
# Stricter (fewer but higher quality signals)
MIN_NEW_COIN_CONFIDENCE=0.75

# Looser (more signals, but lower quality)
MIN_NEW_COIN_CONFIDENCE=0.50
```

---

## 📊 PERFORMANCE METRICS

### **Expected Behavior**

| Metric | Value |
|--------|-------|
| Scan Frequency | 60 seconds |
| New Listings per Day | 1-5 (varies) |
| Valid Signals per Day | 0-2 (high quality) |
| False Positives | <10% |
| API Calls per Hour | ~180 (3 exchanges × 60) |
| Memory Usage | +20-30MB |

### **Alert Volume**

```
LOW ACTIVITY DAY:
- 0-1 new listings detected
- 0-1 alerts sent

MEDIUM ACTIVITY DAY:
- 2-3 new listings detected
- 1-2 alerts sent

HIGH ACTIVITY DAY:
- 4+ new listings detected
- 2-3 alerts sent
```

---

## 🐛 TROUBLESHOOTING

### **Issue 1: Scanner Not Running**

**Symptoms:**
```
⏸️ [NewCoinJob] DISABLED
```

**Solution:**
```bash
# Check .env
grep ENABLE_NEW_COIN_SCANNER .env

# Should be: ENABLE_NEW_COIN_SCANNER=true
# If not, edit and restart:
pm2 restart crypto-api
```

### **Issue 2: No New Coins Detected**

**Symptoms:**
```
✅ [NewCoinJob] Scan complete - no new coins found
```

**Explanation:**
- Normal behavior if no new listings
- Cache file tracks known coins
- Only truly NEW coins trigger alerts

**To Reset Cache (for testing):**
```bash
rm -f data/known_coins_cache.json
pm2 restart crypto-api
```

### **Issue 3: Volume Too Low**

**Symptoms:**
```
⚠️ [NewCoinScanner] SYMBOL volume too low: $150K < $200K
```

**Solution:**
```bash
# Lower threshold in .env
MIN_NEW_COIN_VOLUME=100000

# Restart
pm2 restart crypto-api
```

### **Issue 4: No Whale Activity**

**Symptoms:**
```
⚠️ [NewCoinScanner] SYMBOL no whale activity detected
```

**Solution:**
```bash
# Lower whale TX threshold
MIN_WHALE_TX_AMOUNT=25000

# Or disable whale requirement (not recommended)
```

### **Issue 5: Telegram Alerts Not Sent**

**Check:**
```bash
# Verify bot token
grep TELEGRAM_SIGNAL_BOT_TOKEN .env

# Test manually
curl http://localhost:5000/api/test/telegram-signal
```

---

## 📈 MONITORING & LOGS

### **Key Log Messages**

```bash
# Scanner Status
🚀 [NewCoinJob] Starting New Coin Radar
⏸️ [NewCoinJob] DISABLED
✅ [NewCoinJob] Scanner started

# Scan Activity
🔍 [NewCoinScanner] Starting scan for new listings...
📦 [NewCoinScanner] Cache loaded: X coins tracked
🆕 [NewCoinScanner] Found X new listings!
✅ [NewCoinScanner] No new coins detected

# Validation
⚠️ [NewCoinScanner] SYMBOL volume too low
⚠️ [NewCoinScanner] SYMBOL no whale activity
✅ [NewCoinScanner] SYMBOL passed validation

# Analysis
🔬 [EarlyAnalysis] Starting analysis for SYMBOL
🤖 [EarlyAnalysis] Running AI smart money analysis
📊 [EarlyAnalysis] SYMBOL AI Result: LONG (85% confidence)
✅ [EarlyAnalysis] VALID SIGNAL DETECTED
❌ [EarlyAnalysis] Signal too weak

# Alerts
📱 [EarlyAnalysis] Early alert sent for SYMBOL
📱 [EarlyAnalysis] Full trading alert sent for SYMBOL
```

### **Stats Endpoint (Future)**

```bash
# Get scanner stats
curl http://localhost:5000/api/new-coin/stats

# Expected response:
{
  "success": true,
  "data": {
    "isRunning": true,
    "scanCount": 1440,
    "coinsTracked": 250,
    "newListingsToday": 3,
    "validSignalsToday": 2
  }
}
```

---

## 🔒 SECURITY & RATE LIMITS

### **API Rate Limits**

| Exchange | Limit | Our Usage |
|----------|-------|-----------|
| Binance | 2400/min | ~1/min |
| OKX | 20/2s | ~1/min |
| Coingecko | 50/min | ~1/min |

**Status: ✅ SAFE** - Well below limits

### **Telegram Rate Limits**

- Max: 30 messages/second
- Our usage: ~1 message per new listing
- With cooldown: Max 12 messages/hour

**Status: ✅ SAFE**

---

## 💡 BEST PRACTICES

### 1. **Start Conservative**

```bash
# Use default settings first
MIN_NEW_COIN_VOLUME=200000
MIN_NEW_COIN_CONFIDENCE=0.6
NEW_COIN_SCAN_INTERVAL=60
```

### 2. **Monitor for 24 Hours**

```bash
# Check alert quality
pm2 logs crypto-api | grep "VALID SIGNAL"

# Adjust thresholds based on results
```

### 3. **Review Cache Periodically**

```bash
# View tracked coins
cat data/known_coins_cache.json | jq '.

 | keys | length'

# Should be 200-300 coins after a few days
```

### 4. **Test Telegram Integration**

```bash
# Manual test
curl -X POST http://localhost:5000/api/test/new-coin-alert

# Should receive test alert in Telegram
```

---

## 🎯 ROADMAP & IMPROVEMENTS

### **Phase 1: Current Implementation** ✅
- Multi-exchange scanning
- Volume & whale validation
- AI signal integration
- Telegram alerts

### **Phase 2: Planned** 📋
- DexScreener integration
- Historical performance tracking
- Alert quality metrics
- Auto-adjustment of thresholds

### **Phase 3: Advanced** 🚀
- Social sentiment analysis
- Founder/team validation
- Token metrics analysis
- Risk scoring system

---

## 📚 RELATED DOCUMENTATION

- [PHASE_6_AUTO_SIGNAL_DELIVERY_COMPLETE.md](./PHASE_6_AUTO_SIGNAL_DELIVERY_COMPLETE.md) - Telegram signal format
- [PHASE_1_2_3_COMPLETE.md](./PHASE_1_2_3_COMPLETE.md) - AI Signal Engine
- [DUAL_TELEGRAM_BOT_SETUP.md](./DUAL_TELEGRAM_BOT_SETUP.md) - Telegram bot setup

---

## ✅ SUMMARY

**New Coin Radar** adalah sistem otomatis yang:

1. ✅ **Scan** exchanges setiap 60 detik
2. ✅ **Detect** new listings BEFORE retail
3. ✅ **Validate** volume & whale activity
4. ✅ **Analyze** dengan Enhanced AI (Phase 1-6)
5. ✅ **Alert** ke Telegram jika confidence ≥60%

**Result:** Early entry opportunities dengan AI-validated signals!

---

## 📞 SUPPORT

Jika ada masalah:
1. Check logs: `pm2 logs crypto-api`
2. Verify .env configuration
3. Test endpoints manually
4. Review this documentation

**Happy Trading! 🚀**

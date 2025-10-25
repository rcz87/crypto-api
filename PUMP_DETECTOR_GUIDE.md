# Pump Detector Engine - Complete Guide

## Overview

The **Pump Detector Engine** is a sophisticated early-warning system that identifies potential cryptocurrency pumps **BEFORE** explosive candles occur. Unlike traditional momentum indicators that react to price movement, this system detects accumulation patterns and smart money positioning that typically precede major price moves.

## Core Philosophy

**Detect pumps before retail FOMO, not after.**

The Pump Detector focuses on detecting:
1. **Smart money positioning** (via OI spikes)
2. **Stealth accumulation** (via CVD/volume analysis)
3. **Pre-breakout consolidation** (before explosive candles)
4. **Funding rate neutrality** (retail hasn't entered yet)
5. **Whale activity** (large order flow)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              PUMP DETECTOR ENGINE                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  OI Spike    │  │    CVD       │  │ Funding  │ │
│  │  Detection   │  │  Analysis    │  │  Rate    │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐                │
│  │Consolidation │  │    Whale     │                │
│  │  Detection   │  │   Activity   │                │
│  └──────────────┘  └──────────────┘                │
│                                                     │
│              ↓                                      │
│      ┌──────────────┐                              │
│      │  Confidence  │                              │
│      │   Scoring    │                              │
│      └──────────────┘                              │
│              ↓                                      │
│      ┌──────────────┐                              │
│      │   Telegram   │                              │
│      │    Alert     │                              │
│      └──────────────┘                              │
└─────────────────────────────────────────────────────┘
```

## Detection Factors (5-Factor System)

### 1. OI Spike Detection

**What it detects:** Sudden increase in Open Interest (derivatives positioning)

**Signal:**
- OI increase > 3% in recent period
- Indicates smart money/whales opening positions
- Precedes actual price movement

**Why it matters:**
- OI spikes = large players positioning
- Usually happens BEFORE retail notices
- Strong predictor of upcoming volatility

**Implementation:**
```typescript
const oiChange = ((currentOI - previousOI) / previousOI) * 100;
const oiSpike = oiChange > config.oiSpikeThreshold; // 3%
```

### 2. CVD (Cumulative Volume Delta) Analysis

**What it detects:** Net buying/selling pressure

**Signal:**
- Positive CVD = more buy volume than sell volume
- Indicates accumulation phase
- Smart money building position

**Why it matters:**
- Price may not move yet, but buying is happening
- Stealth accumulation before breakout
- Volume confirms OI spike

**Implementation:**
```typescript
const cvd = buyVolume - sellVolume;
const cvdPositive = cvd > 0;
```

### 3. Funding Rate Neutrality

**What it detects:** Whether retail traders have entered

**Signal:**
- Funding rate < 0.01% (neutral)
- Low greed/fear in market
- Retail hasn't FOMO'd in yet

**Why it matters:**
- Neutral funding = pump hasn't started yet
- You're early, not late
- Best risk/reward zone

**Implementation:**
```typescript
const fundingNeutral = Math.abs(fundingRate) < config.fundingMaxNeutral; // 0.01
```

### 4. Price Consolidation Detection

**What it detects:** Tight price range before breakout

**Signal:**
- ATR (volatility) decreasing
- Price trading in narrow range
- Compression before expansion

**Why it matters:**
- Consolidation = energy building
- Breakouts from consolidation are powerful
- Classic accumulation pattern

**Implementation:**
```typescript
const volatility = (high - low) / close;
const consolidating = volatility < 0.02; // 2% range
```

### 5. Whale Activity (Optional)

**What it detects:** Large order flow, significant trades

**Signal:**
- Large bid/ask orders
- Significant single trades
- Whale accumulation patterns

**Why it matters:**
- Whales move markets
- Their positioning predicts direction
- Additional confirmation factor

**Implementation:**
```typescript
const whaleActivity = largeOrders.length > whaleThreshold;
```

## Confidence Scoring System

The Pump Detector uses a **multi-factor confidence score**:

### Score Calculation

```typescript
Total Score = Sum of present factors (0-5)
Confidence = Total Score / 5

Examples:
- 5/5 factors = 1.00 confidence (100%)
- 4/5 factors = 0.80 confidence (80%)
- 3/5 factors = 0.60 confidence (60%)
- 2/5 factors = 0.40 confidence (40%)
```

### Signal Strength Levels

| Strength | Confidence | Factors | Action |
|----------|-----------|---------|--------|
| **STRONG** | > 0.8 | 4-5 factors | High conviction, consider entry |
| **MEDIUM** | 0.6-0.8 | 3 factors | Monitor closely, wait for confirmation |
| **WEAK** | < 0.6 | 1-2 factors | Interesting but insufficient evidence |

### Detection Threshold

```typescript
// Pump detected if confidence >= 0.6 (3+ factors present)
detected: totalScore >= 3
```

## API Endpoints

### 1. Detect Pumps

**Endpoint:** `POST /api/brain/pump/detect`

**Request:**
```json
{
  "symbols": ["BTC", "ETH", "SOL"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "signals": [
      {
        "symbol": "BTC",
        "detected": true,
        "confidence": 0.8,
        "strength": "strong",
        "timestamp": 1698765432000,
        "factors": {
          "oiSpike": true,
          "cvdPositive": true,
          "fundingNeutral": true,
          "consolidating": true,
          "whaleActivity": false
        },
        "metrics": {
          "oiChange": 4.5,
          "cvd": 125000,
          "fundingRate": 0.005,
          "volatility": 0.015,
          "volume24h": 1500000000
        },
        "reasoning": [
          "OI spike: +4.5% (smart money positioning)",
          "Positive CVD: +125k (accumulation detected)",
          "Neutral funding: 0.005% (retail not in yet)",
          "Low volatility: 1.5% (consolidation phase)"
        ],
        "recommendation": {
          "action": "LONG",
          "entry": "Current market price",
          "stopLoss": 45000,
          "takeProfits": [47000, 49000, 52000],
          "riskReward": "1:3",
          "positionSize": "2-3% of portfolio"
        }
      }
    ],
    "detected": 1,
    "summary": "Found 1 pump signal(s): BTC (strong)"
  },
  "meta": {
    "version": "pump-detector-v1",
    "timestamp": "2024-10-31T12:00:00.000Z"
  }
}
```

### 2. Unified Analysis (Fusion + Pump)

**Endpoint:** `POST /api/brain/unified`

**Description:** Combines Meta-Brain Fusion Engine (11 rules) with Pump Detector

**Request:**
```json
{
  "symbols": ["BTC", "ETH", "SOL"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fusion": {
      "final_signal": "LONG",
      "confidence": 0.75,
      "triggered_rules": [1, 3, 7]
      // ... full fusion signal
    },
    "pumps": [
      {
        "symbol": "BTC",
        "detected": true,
        "strength": "strong"
        // ... full pump signal
      }
    ],
    "summary": {
      "fusionSignal": "LONG",
      "fusionConfidence": "75.0%",
      "pumpsDetected": 1,
      "strongPumps": 1,
      "recommendation": "PRIORITY: Strong pump detected on BTC"
    }
  },
  "meta": {
    "version": "unified-v1",
    "providers": ["coinapi", "coinglass", "pump-detector"],
    "timestamp": "2024-10-31T12:00:00.000Z"
  }
}
```

### 3. Pump Detector Statistics

**Endpoint:** `GET /api/brain/pump/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalScans": 150,
    "pumpsDetected": 12,
    "detectionRate": 8.0,
    "byStrength": {
      "strong": 5,
      "medium": 4,
      "weak": 3
    },
    "avgConfidence": 0.72,
    "alertsSent": 12,
    "lastScan": 1698765432000
  }
}
```

## Configuration

### Default Configuration

```typescript
export const DEFAULT_CONFIG: PumpDetectorConfig = {
  // OI Analysis
  oiSpikeThreshold: 3,              // 3% OI increase required

  // Volume/CVD
  cvdPositiveRequired: true,        // Must have buy pressure
  volumeSpikeThreshold: 50,         // 50% volume increase

  // Funding Rate
  fundingMaxNeutral: 0.01,          // Max 0.01% funding for "neutral"

  // Consolidation
  consolidationRequired: true,       // Price must be consolidating

  // Whale Tracking
  checkWhaleActivity: false,         // Optional (can be expensive)

  // Alerts
  alertOnDetection: true,            // Send Telegram alerts
  minTimeBetweenAlerts: 15 * 60 * 1000  // 15 min cooldown
};
```

### Customizing Configuration

```typescript
import { pumpDetector } from './server/brain/pumpDetector';

// More aggressive detection (lower threshold)
pumpDetector.updateConfig({
  oiSpikeThreshold: 2,        // 2% instead of 3%
  fundingMaxNeutral: 0.015    // More lenient
});

// More conservative (higher threshold)
pumpDetector.updateConfig({
  oiSpikeThreshold: 5,        // 5% required
  cvdPositiveRequired: true,  // Must have CVD
  consolidationRequired: true // Must be consolidating
});
```

## Integration with Brain Orchestrator

The Pump Detector is fully integrated into the Brain Orchestrator:

### Method 1: Standalone Pump Detection

```typescript
const pumpSignals = await brainOrchestrator.runPumpDetection(['BTC', 'ETH', 'SOL']);

const detected = pumpSignals.filter(s => s.detected);
console.log(`Found ${detected.length} pumps`);
```

### Method 2: Unified Analysis (Recommended)

```typescript
// Combines Fusion Engine + Pump Detector
const analysis = await brainOrchestrator.runUnifiedAnalysis(['BTC', 'ETH', 'SOL']);

// Priority logic: Strong pumps > Fusion signals
const strongPumps = analysis.pumps.filter(p => p.detected && p.strength === 'strong');

if (strongPumps.length > 0) {
  console.log('PRIORITY: Strong pump detected');
  // Use pump signal
} else {
  console.log('Follow fusion signal');
  // Use fusion signal
}
```

### Method 3: Get Statistics

```typescript
const stats = brainOrchestrator.getPumpStats();
console.log(`Detection rate: ${stats.detectionRate}%`);
```

## Telegram Alerts

When a pump is detected, the system automatically sends Telegram alerts:

### Alert Format

```
🚀 PUMP SIGNAL DETECTED

Symbol: BTC
Strength: STRONG
Confidence: 80.0%

📊 Metrics:
• OI Change: +4.5%
• CVD: +125,000
• Funding Rate: 0.005%
• Volatility: 1.5%
• Volume 24h: $1.5B

💡 Reasoning:
✅ OI spike: +4.5% (smart money positioning)
✅ Positive CVD: +125k (accumulation detected)
✅ Neutral funding: 0.005% (retail not in yet)
✅ Low volatility: 1.5% (consolidation phase)

📈 Trading Recommendation:
Action: LONG
Entry: Current market price
Stop Loss: $45,000
Take Profits:
  TP1: $47,000
  TP2: $49,000
  TP3: $52,000
Risk/Reward: 1:3
Position Size: 2-3% of portfolio

⚠️ This is an early-stage signal. Monitor closely.
```

### Alert Types

1. **Pump Detection Alert** - Sent when pump detected
2. **Pump Exit Alert** - Sent when conditions change
3. **Pump Update Alert** - Position tracking updates

### Alert Cooldown

- Minimum 15 minutes between alerts per symbol
- Prevents spam during choppy markets
- Configurable via `minTimeBetweenAlerts`

## Trading Strategy Recommendations

### Entry Strategy

**For STRONG signals (4-5 factors, >80% confidence):**
1. Enter at current market price
2. Use 2-3% of portfolio
3. Set stop loss at recent swing low
4. Scale in if price consolidates further

**For MEDIUM signals (3 factors, 60-80% confidence):**
1. Wait for price confirmation (small move in direction)
2. Use 1-2% of portfolio
3. Tighter stop loss
4. Monitor for additional factors

**For WEAK signals (<60% confidence):**
1. Do NOT trade
2. Monitor for factor confirmation
3. Wait for signal strength to increase

### Risk Management

```
Position Sizing:
- Strong signal: 2-3% of portfolio
- Medium signal: 1-2% of portfolio
- Weak signal: No position

Stop Loss:
- Place below recent swing low (LONG)
- Place above recent swing high (SHORT)
- Typically 2-3% from entry

Take Profits:
- TP1: 1:1.5 R:R (take 50% off)
- TP2: 1:2.5 R:R (take 30% off)
- TP3: 1:3.5 R:R (let run with trailing stop)
```

### Exit Strategy

**Exit immediately if:**
1. Stop loss hit
2. Funding rate spikes (>0.05%) - retail has entered
3. OI drops significantly - smart money exiting
4. CVD turns negative - distribution starting
5. Reverse signal detected

**Scale out at:**
1. TP1 (50% position)
2. TP2 (30% position)
3. TP3 (20% position, trail remaining)

## Performance Tracking

### Key Metrics

```typescript
{
  totalScans: 150,           // Total pump scans run
  pumpsDetected: 12,         // Total pumps detected
  detectionRate: 8.0,        // % of scans with pump

  byStrength: {
    strong: 5,               // High conviction signals
    medium: 4,               // Moderate signals
    weak: 3                  // Low conviction signals
  },

  avgConfidence: 0.72,       // Average confidence score
  alertsSent: 12,            // Telegram alerts sent
  lastScan: 1698765432000    // Last scan timestamp
}
```

### Monitoring Performance

```bash
# Get current stats
curl -X GET http://localhost:5000/api/brain/pump/stats

# Run detection
curl -X POST http://localhost:5000/api/brain/pump/detect \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["BTC", "ETH", "SOL"]}'
```

## Backtesting

The Pump Detector can be backtested using historical data:

### Backtest Setup

```typescript
import { backtestEngine } from './server/backtest/backtestEngine';

const config = {
  symbol: 'BTC',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-10-01'),
  initialCapital: 10000,
  riskPerTradePercent: 2,
  minConfidence: 0.6  // Only trade medium+ signals
};

const results = await backtestEngine.runPumpDetectorBacktest(config);
```

### Backtest Metrics

```typescript
{
  winrate: 0.68,              // 68% win rate
  profitFactor: 2.4,          // $2.40 made per $1 lost
  avgRMultiple: 2.1,          // Average 2.1:1 R:R
  maxDrawdown: -12.5,         // Max drawdown 12.5%
  totalPnl: 3450,             // Total profit $3,450
  sharpeRatio: 1.8            // Risk-adjusted return
}
```

## Best Practices

### 1. Use in Conjunction with Fusion Engine

Don't use Pump Detector in isolation. Combine with Fusion Engine:

```typescript
const analysis = await brainOrchestrator.runUnifiedAnalysis(symbols);

// Check both signals
const pumpDetected = analysis.pumps.some(p => p.detected);
const fusionBullish = analysis.fusion.final_signal === 'LONG';

if (pumpDetected && fusionBullish) {
  console.log('✅ Confirmed: Both pump and fusion bullish');
}
```

### 2. Monitor Funding Rate Post-Entry

After entering a pump signal, watch funding rate:

```typescript
// If funding spikes above 0.05%, consider taking profits
if (fundingRate > 0.05) {
  console.log('⚠️ Retail FOMO - consider scaling out');
}
```

### 3. Set Alerts but Verify

Telegram alerts are useful but always verify:
- Check the reasoning factors
- Confirm on charts
- Validate with other indicators
- Don't blindly follow alerts

### 4. Adjust Configuration Per Market

Different market conditions need different thresholds:

```typescript
// Bull market: More lenient
pumpDetector.updateConfig({
  oiSpikeThreshold: 2,
  fundingMaxNeutral: 0.015
});

// Bear market: More strict
pumpDetector.updateConfig({
  oiSpikeThreshold: 4,
  fundingMaxNeutral: 0.005
});
```

### 5. Track Your Results

Keep a journal of pump signals:
- Which factors were present
- Entry/exit prices
- What worked/didn't work
- Refine configuration based on results

## Troubleshooting

### No Pumps Detected

**Possible causes:**
- Thresholds too strict
- Market in consolidation phase
- Data source issues

**Solutions:**
```typescript
// Lower thresholds
pumpDetector.updateConfig({
  oiSpikeThreshold: 2
});

// Check data health
const health = await coinGlassBridge.healthCheck();
console.log('CoinGlass health:', health);
```

### Too Many False Signals

**Possible causes:**
- Thresholds too lenient
- Choppy market conditions
- Need more confirmation factors

**Solutions:**
```typescript
// Increase minimum confidence
// Only trade strong signals (4-5 factors)
const strongSignals = signals.filter(s => s.confidence > 0.8);

// Require consolidation
pumpDetector.updateConfig({
  consolidationRequired: true
});
```

### Alerts Not Sending

**Check:**
1. Telegram bot configured: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`
2. Alert cooldown not active (15 min default)
3. `alertOnDetection: true` in config

**Debug:**
```typescript
import { sendTelegramPumpAlert } from './server/services/telegramNotifier';

// Test alert
await sendTelegramPumpAlert(testSignal);
```

## Advanced Usage

### Custom Factor Weighting

Assign different weights to factors based on backtesting:

```typescript
const weights = {
  oiSpike: 0.3,        // 30% weight
  cvdPositive: 0.25,   // 25% weight
  fundingNeutral: 0.2, // 20% weight
  consolidating: 0.15, // 15% weight
  whaleActivity: 0.1   // 10% weight
};

// Calculate weighted confidence
const weightedConfidence =
  (factors.oiSpike ? weights.oiSpike : 0) +
  (factors.cvdPositive ? weights.cvdPositive : 0) +
  (factors.fundingNeutral ? weights.fundingNeutral : 0) +
  (factors.consolidating ? weights.consolidating : 0) +
  (factors.whaleActivity ? weights.whaleActivity : 0);
```

### Time-of-Day Filtering

Pumps often occur during specific hours:

```typescript
const hour = new Date().getUTCHours();

// Only trade during high-liquidity hours
if (hour >= 8 && hour <= 16) { // 8 AM - 4 PM UTC
  const signals = await pumpDetector.detectPump('BTC');
}
```

### Multi-Timeframe Confirmation

Check pump signals across multiple timeframes:

```typescript
// Check if pump confirmed on multiple timeframes
const [tf1h, tf4h] = await Promise.all([
  pumpDetector.detectPump('BTC', '1h'),
  pumpDetector.detectPump('BTC', '4h')
]);

if (tf1h.detected && tf4h.detected) {
  console.log('✅ Multi-timeframe confirmation');
}
```

## Example Workflow

### Complete Trading Workflow

```typescript
// 1. Run unified analysis
const analysis = await brainOrchestrator.runUnifiedAnalysis(['BTC', 'ETH', 'SOL']);

// 2. Filter strong pump signals
const strongPumps = analysis.pumps.filter(
  p => p.detected && p.strength === 'strong' && p.confidence > 0.8
);

// 3. Check fusion alignment
for (const pump of strongPumps) {
  const fusionAligned =
    (pump.recommendation.action === 'LONG' && analysis.fusion.final_signal === 'LONG') ||
    (pump.recommendation.action === 'SHORT' && analysis.fusion.final_signal === 'SHORT');

  if (fusionAligned) {
    console.log(`✅ ${pump.symbol}: Pump + Fusion aligned`);

    // 4. Enter position
    const entry = {
      symbol: pump.symbol,
      side: pump.recommendation.action,
      entry: pump.metrics.currentPrice,
      stopLoss: pump.recommendation.stopLoss,
      takeProfits: pump.recommendation.takeProfits,
      size: calculatePositionSize(0.02) // 2% of portfolio
    };

    // 5. Monitor position
    monitorPumpPosition(entry, pump);
  }
}
```

## Conclusion

The Pump Detector Engine is a powerful tool for early-stage pump detection. When used correctly with proper risk management and in conjunction with the Fusion Engine, it can provide significant edge in cryptocurrency trading.

**Remember:**
- No system is 100% accurate
- Always use stop losses
- Never risk more than 2-3% per trade
- Backtest configuration before live trading
- Monitor and adjust based on market conditions

For questions or issues, refer to the main documentation or raise an issue in the repository.

---

**Related Documentation:**
- [Meta-Brain Fusion Engine Guide](./META_BRAIN_FUSION_IMPLEMENTATION.md)
- [Backtesting Framework Guide](./BACKTESTING_FRAMEWORK_SUMMARY.md)
- [CoinAPI & CoinGlass Status Report](./COINAPI_COINGLASS_STATUS_REPORT.md)

# 🚀 Unified Gateway Implementation Guide

## 📋 Overview

Strategi **Unified Gateway** dirancang untuk mengatasi batasan GPT Actions yang **maksimal 30 operasi** dengan menggabungkan 70+ endpoint sistem menjadi 20 operasi menggunakan parameter routing.

## 🎯 Konsep

Alih-alih:
```
GET /api/btc/smc
GET /api/eth/smc
GET /api/sol/smc
... (70+ endpoints)
```

Menjadi:
```
POST /api/unified/analysis
{
  "pair": "BTC",
  "analysis_type": "smc"
}
```

---

## 📊 Mapping Unified Endpoints

### 1. `/api/unified/market` (Market Data Gateway)

**Maps to:**
- `GET /api/{pair}/complete` → action: "complete"
- `GET /api/{pair}/ticker` → action: "ticker"  
- `GET /api/{pair}/orderbook` → action: "orderbook"
- `GET /api/{pair}/trades` → action: "trades"
- `GET /api/{pair}/candles` → action: "candles"

**Implementation:**
```typescript
app.post('/api/unified/market', async (req, res) => {
  const { pair, action, timeframe, limit } = req.body;
  
  switch(action) {
    case 'complete':
      // Route to existing /api/{pair}/complete logic
      return await getCompleteAnalysis(pair);
    case 'ticker':
      return await getTicker(pair);
    case 'orderbook':
      return await getOrderbook(pair);
    case 'trades':
      return await getRecentTrades(pair, limit);
    case 'candles':
      return await getCandles(pair, timeframe, limit);
  }
});
```

---

### 2. `/api/unified/analysis` (Technical Analysis Gateway)

**Maps to:**
- `GET /api/{pair}/smc` → analysis_type: "smc"
- `GET /api/{pair}/cvd` → analysis_type: "cvd"
- `GET /api/{pair}/technical` → analysis_type: "technical"
- `GET /api/sol/confluence` → analysis_type: "confluence"
- `GET /api/sol/fibonacci` → analysis_type: "fibonacci"
- `GET /api/sol/order-flow` → analysis_type: "orderflow"
- `GET /api/sol/volume-profile` → analysis_type: "volume_profile"
- `GET /api/sol/mtf-analysis` → analysis_type: "mtf"

**Implementation:**
```typescript
app.post('/api/unified/analysis', async (req, res) => {
  const { pair, analysis_type, timeframe } = req.body;
  
  switch(analysis_type) {
    case 'smc':
      return await getSmartMoneyConcepts(pair, timeframe);
    case 'cvd':
      return await getCVDAnalysis(pair, timeframe);
    case 'technical':
      return await getTechnicalIndicators(pair, timeframe);
    case 'confluence':
      return await getConfluenceAnalysis(pair, timeframe);
    case 'fibonacci':
      return await getFibonacciAnalysis(pair, timeframe);
    case 'orderflow':
      return await getOrderFlowAnalysis(pair, timeframe);
    case 'volume_profile':
      return await getVolumeProfile(pair, timeframe);
    case 'mtf':
      return await getMultiTimeframeAnalysis(pair);
  }
});
```

---

### 3. `/api/unified/derivatives` (Derivatives Gateway)

**Maps to:**
- `GET /api/{pair}/funding` → data_type: "funding"
- `GET /api/{pair}/open-interest` → data_type: "open_interest"
- `GET /api/{pair}/liquidation` → data_type: "liquidation"
- `GET /api/sol/liquidation-heatmap` → data_type: "liquidation_heatmap"
- `POST /api/sol/position-calculator` → data_type: "position_calculator"

**Implementation:**
```typescript
app.post('/api/unified/derivatives', async (req, res) => {
  const { pair, data_type, start, end, limit } = req.body;
  
  switch(data_type) {
    case 'funding':
      return await getFundingRates(pair, { start, end, limit });
    case 'open_interest':
      return await getOpenInterest(pair, { start, end, limit });
    case 'liquidation':
      return await getLiquidationAnalysis(pair);
    case 'liquidation_heatmap':
      return await getLiquidationHeatmap(pair);
    case 'position_calculator':
      return await calculatePosition(req.body);
  }
});
```

---

### 4. `/api/unified/ai` (AI Signals Gateway)

**Maps to:**
- `GET /api/ai/signal` → action: "signal"
- `GET /api/ai/enhanced-signal` → action: "enhanced_signal"
- `GET /api/ai/enhanced-performance` → action: "performance"
- `POST /api/ai/tracking/execution` → action: "track_execution"
- `POST /api/ai/tracking/outcome` → action: "track_outcome"
- `POST /api/screen/intelligent` → action: "screen_intelligent"

**Implementation:**
```typescript
app.post('/api/unified/ai', async (req, res) => {
  const { action, symbol, symbols, timeframe, signal_id, entry_price, position_size, exit_price, exit_reason } = req.body;
  
  switch(action) {
    case 'signal':
      return await getAISignal(symbol);
    case 'enhanced_signal':
      return await getEnhancedAISignal(symbol);
    case 'performance':
      return await getEnhancedPerformance();
    case 'track_execution':
      return await recordExecution(signal_id, { entry_price, position_size });
    case 'track_outcome':
      return await recordOutcome(signal_id, { exit_price, exit_reason });
    case 'screen_intelligent':
      return await intelligentScreening({ symbols, timeframe });
  }
});
```

---

### 5. `/api/unified/coinglass` (CoinGlass Gateway)

**Maps to:**
- `GET /health?days=30` → feature: "etf_flows"
- `GET /py/advanced/etf/bitcoin` → feature: "etf_bitcoin"
- `GET /py/advanced/market/sentiment` → feature: "sentiment"
- `GET /py/advanced/market/coins` → feature: "coins"
- `GET /py/advanced/technical/atr` → feature: "atr"
- `GET /py/advanced/ticker/{symbol}` → feature: "ticker"
- `GET /py/advanced/liquidation/heatmap/{symbol}` → feature: "liquidation_heatmap"
- `GET /py/advanced/spot/orderbook/{symbol}` → feature: "spot_orderbook"
- `GET /py/advanced/options/oi/{symbol}` → feature: "options_oi"

**Implementation:**
```typescript
app.post('/api/unified/coinglass', async (req, res) => {
  const { feature, symbol, days, asset, timeframe, period, range, depth, expiry } = req.body;
  
  // Proxy to Python service
  const PY_BASE = process.env.PY_BASE || 'http://127.0.0.1:8000';
  
  switch(feature) {
    case 'etf_flows':
      return await fetch(`${PY_BASE}/advanced/etf/flows?days=${days}&asset=${asset}`);
    case 'etf_bitcoin':
      return await fetch(`${PY_BASE}/advanced/etf/bitcoin`);
    case 'sentiment':
      return await fetch(`${PY_BASE}/advanced/market/sentiment`);
    case 'coins':
      return await fetch(`${PY_BASE}/advanced/market/coins`);
    case 'atr':
      return await fetch(`${PY_BASE}/advanced/technical/atr?symbol=${symbol}&timeframe=${timeframe}&period=${period}`);
    case 'ticker':
      return await fetch(`${PY_BASE}/advanced/ticker/${symbol}`);
    case 'liquidation_heatmap':
      return await fetch(`${PY_BASE}/advanced/liquidation/heatmap/${symbol}?range=${range}`);
    case 'spot_orderbook':
      return await fetch(`${PY_BASE}/advanced/spot/orderbook/${symbol}?depth=${depth}`);
    case 'options_oi':
      return await fetch(`${PY_BASE}/advanced/options/oi/${symbol}?expiry=${expiry}`);
  }
});
```

---

### 6. `/api/unified/screening` (Screening Gateway)

**Maps to:**
- `POST /api/screen/filtered` → mode: "filtered"
- `POST /api/screen/intelligent` → mode: "intelligent"
- `POST /api/backtest/filtered` → mode: "backtest"

**Implementation:**
```typescript
app.post('/api/unified/screening', async (req, res) => {
  const { mode, symbols, timeframe, limit, start_date, end_date, initial_balance, use_filters } = req.body;
  
  switch(mode) {
    case 'filtered':
      return await filteredScreening({ symbols, timeframe, limit });
    case 'intelligent':
      return await intelligentScreening({ symbols, timeframe });
    case 'backtest':
      return await backtestScreening({
        symbols,
        timeframe,
        start_date,
        end_date,
        initial_balance,
        use_filters
      });
  }
});
```

---

### 7. `/api/unified/listings` (New Listings Gateway)

**Maps to:**
- `GET /api/listings/new` → action: "new"
- `GET /api/listings/spikes` → action: "spikes"
- `GET /api/listings/opportunities` → action: "opportunities"
- `POST /api/listings/scan` → action: "scan"

**Implementation:**
```typescript
app.post('/api/unified/listings', async (req, res) => {
  const { action, limit, symbol, minScore } = req.body;
  
  switch(action) {
    case 'new':
      return await getNewListings(limit);
    case 'spikes':
      return await getVolumeSpikes(limit);
    case 'opportunities':
      return await getOpportunities(symbol, minScore);
    case 'scan':
      return await triggerManualScan();
  }
});
```

---

### 8. `/api/unified/premium` (Premium Features Gateway)

**Maps to:**
- `GET /api/premium/institutional-analytics` → feature: "institutional_analytics"
- `GET /api/premium/market-intelligence` → feature: "market_intelligence"
- `GET /api/premium/tier-status` → feature: "tier_status"
- `GET /api/sol/premium-orderbook` → feature: "premium_orderbook"

**Implementation:**
```typescript
app.post('/api/unified/premium', async (req, res) => {
  const { feature, symbol } = req.body;
  
  switch(feature) {
    case 'institutional_analytics':
      return await getInstitutionalAnalytics();
    case 'market_intelligence':
      return await getMarketIntelligence();
    case 'tier_status':
      return await getTierStatus();
    case 'premium_orderbook':
      return await getPremiumOrderbook(symbol);
  }
});
```

---

### 9. `/api/unified/system` (System Monitoring Gateway)

**Maps to:**
- `GET /health` → feature: "health"
- `GET /api/metrics` → feature: "metrics"
- `GET /api/security/metrics` → feature: "security"
- `GET /api/alerting/health` → feature: "alerting"
- `GET /api/adaptive-threshold/stats` → feature: "adaptive_stats"
- `POST /api/adaptive-threshold/update-outcome` → feature: "adaptive_update"
- `POST /api/adaptive-threshold/evaluate` → feature: "adaptive_evaluate"
- `GET /api/debug/memory/components` → feature: "memory_analysis"

**Implementation:**
```typescript
app.post('/api/unified/system', async (req, res) => {
  const { feature, signal_id, outcome, pnl_pct, symbol, confidence } = req.body;
  
  switch(feature) {
    case 'health':
      return await getSystemHealth();
    case 'metrics':
      return await getSystemMetrics();
    case 'security':
      return await getSecurityMetrics();
    case 'alerting':
      return await getAlertingStatus();
    case 'adaptive_stats':
      return await getAdaptiveStats();
    case 'adaptive_update':
      return await updateAdaptiveOutcome({ signal_id, outcome, pnl_pct, symbol, confidence });
    case 'adaptive_evaluate':
      return await evaluateAdaptiveThreshold();
    case 'memory_analysis':
      return await getMemoryAnalysis();
  }
});
```

---

### 10. `/api/unified/sol` (SOL-Specific Gateway)

**Maps to:**
- `GET /api/sol/multi-exchange-orderbook` → feature: "multi_exchange_orderbook"
- `GET /api/sol/multi-exchange-stats` → feature: "multi_exchange_stats"
- `GET /api/sol/funding/enhanced` → feature: "enhanced_funding"
- `POST /api/sol/position-calculator` → feature: "position_calculator"
- `POST /api/sol/risk-dashboard` → feature: "risk_dashboard"

**Implementation:**
```typescript
app.post('/api/unified/sol', async (req, res) => {
  const { feature, symbol, accountBalance, entryPrice, size, leverage, side, positions, riskLimits } = req.body;
  
  switch(feature) {
    case 'multi_exchange_orderbook':
      return await getMultiExchangeOrderbook(symbol);
    case 'multi_exchange_stats':
      return await getMultiExchangeStats();
    case 'enhanced_funding':
      return await getEnhancedFunding();
    case 'position_calculator':
      return await calculatePosition({ entryPrice, size, leverage, side, accountBalance });
    case 'risk_dashboard':
      return await generateRiskDashboard({ positions, accountBalance, riskLimits });
  }
});
```

---

### 11. `/api/unified/testing` (Testing Gateway)

**Maps to:**
- `GET /api/test/bybit` → test_type: "bybit"
- `GET /api/test/bybit-ws` → test_type: "bybit_ws"
- `POST /api/telegram/test/institutional` → test_type: "telegram_institutional"
- `POST /api/telegram/test/sniper` → test_type: "telegram_sniper"
- `POST /api/listings/test-telegram` → test_type: "telegram_listing"

**Implementation:**
```typescript
app.post('/api/unified/testing', async (req, res) => {
  const { test_type, symbol, bias, entry, stopLoss, takeProfit, confidence } = req.body;
  
  switch(test_type) {
    case 'bybit':
      return await testBybitConnection();
    case 'bybit_ws':
      return await testBybitWebSocket();
    case 'telegram_institutional':
      return await testTelegramInstitutional({ symbol, bias, confidence });
    case 'telegram_sniper':
      return await testTelegramSniper({ symbol, entry, stopLoss, takeProfit, confidence });
    case 'telegram_listing':
      return await testTelegramListing();
  }
});
```

---

## 📝 Implementation Checklist

### Phase 1: Create Gateway Routes
- [ ] Add `/api/unified/market` endpoint
- [ ] Add `/api/unified/analysis` endpoint
- [ ] Add `/api/unified/derivatives` endpoint
- [ ] Add `/api/unified/ai` endpoint
- [ ] Add `/api/unified/coinglass` endpoint
- [ ] Add `/api/unified/screening` endpoint
- [ ] Add `/api/unified/listings` endpoint
- [ ] Add `/api/unified/premium` endpoint
- [ ] Add `/api/unified/system` endpoint
- [ ] Add `/api/unified/sol` endpoint
- [ ] Add `/api/unified/testing` endpoint

### Phase 2: Update routes.ts
```typescript
// Add to server/routes.ts

// Import unified gateway handler
import { unifiedGatewayHandler } from './routes/unifiedGateway';

// Register unified routes
app.post('/api/unified/market', unifiedGatewayHandler.market);
app.post('/api/unified/analysis', unifiedGatewayHandler.analysis);
app.post('/api/unified/derivatives', unifiedGatewayHandler.derivatives);
app.post('/api/unified/ai', unifiedGatewayHandler.ai);
app.post('/api/unified/coinglass', unifiedGatewayHandler.coinglass);
app.post('/api/unified/screening', unifiedGatewayHandler.screening);
app.post('/api/unified/listings', unifiedGatewayHandler.listings);
app.post('/api/unified/premium', unifiedGatewayHandler.premium);
app.post('/api/unified/system', unifiedGatewayHandler.system);
app.post('/api/unified/sol', unifiedGatewayHandler.sol);
app.post('/api/unified/testing', unifiedGatewayHandler.testing);
```

### Phase 3: Create Gateway Handler
Create `server/routes/unifiedGateway.ts`:

```typescript
import { Request, Response } from 'express';

export const unifiedGatewayHandler = {
  market: async (req: Request, res: Response) => {
    // Implementation for market gateway
  },
  
  analysis: async (req: Request, res: Response) => {
    // Implementation for analysis gateway
  },
  
  // ... other handlers
};
```

### Phase 4: Update OpenAPI Serving
```typescript
// Update server/routes.ts
app.get('/openapi.json', (_req: Request, res: Response) => {
  const schemaPath = path.join(process.cwd(), 'public', 'openapi-ultra-compact-v2.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  res.json(schema);
});
```

---

## ✅ Benefits

1. **GPT Actions Compatible**: Exactly 20 operationIds (under 30 limit)
2. **Full System Access**: All 70+ features available via parameter routing
3. **Maintainable**: Single endpoint per feature category
4. **Backward Compatible**: Existing endpoints remain functional
5. **Scalable**: Easy to add new features within existing gateways

---

## 🚀 Next Steps

1. Implement gateway routes di `server/routes/unifiedGateway.ts`
2. Test each gateway dengan sample requests
3. Update `openapi.json` endpoint untuk serve v2 file
4. Deploy dan test di GPT Actions
5. Monitor performance dan error rates

---

## 📞 Support

Untuk pertanyaan atau bantuan implementasi, hubungi tim development.

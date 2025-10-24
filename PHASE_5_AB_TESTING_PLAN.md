# Phase 5: A/B Testing & Backtest Metrics Implementation Plan

**Objective:** Validate AI Signal Engine sharpness through rigorous backtesting and A/B comparison

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│          PHASE 5 BACKTESTING FRAMEWORK             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────┐      ┌─────────────────┐     │
│  │  Strategy A     │      │  Strategy B     │     │
│  │  (Pre-Phase 4)  │      │  (Phase 4)      │     │
│  │                 │      │                 │     │
│  │ • No validation │      │ • With validation│    │
│  │ • All patterns  │      │ • Filtered      │     │
│  │ • Lower bar     │      │ • Higher bar    │     │
│  └────────┬────────┘      └────────┬────────┘     │
│           │                        │              │
│           └────────┬───────────────┘              │
│                    │                              │
│            ┌───────▼────────┐                     │
│            │  Backtest      │                     │
│            │  Engine        │                     │
│            │                │                     │
│            │ • Execute both │                     │
│            │ • Track trades │                     │
│            │ • Calc metrics │                     │
│            └───────┬────────┘                     │
│                    │                              │
│            ┌───────▼────────┐                     │
│            │  Performance   │                     │
│            │  Comparison    │                     │
│            │                │                     │
│            │ • Win rate     │                     │
│            │ • RR ratio     │                     │
│            │ • Drawdown     │                     │
│            │ • Sharpe       │                     │
│            │ • Trade count  │                     │
│            └───────┬────────┘                     │
│                    │                              │
│            ┌───────▼────────┐                     │
│            │  Statistical   │                     │
│            │  Significance  │                     │
│            │                │                     │
│            │ • T-test       │                     │
│            │ • Chi-square   │                     │
│            │ • Confidence   │                     │
│            └────────────────┘                     │
└─────────────────────────────────────────────────────┘
```

---

## Key Metrics to Track

### 1. Win Rate (Hit Rate)
```typescript
win_rate = successful_trades / total_trades
```
**Target:** Strategy B > 60% (vs Strategy A baseline)

### 2. Risk/Reward Ratio
```typescript
rr_ratio = avg_winning_trade / avg_losing_trade
```
**Target:** Strategy B > 2.0:1

### 3. Maximum Drawdown
```typescript
max_drawdown = max((peak - trough) / peak)
```
**Target:** Strategy B < 15% (lower is better)

### 4. Sharpe Ratio
```typescript
sharpe = (mean_return - risk_free_rate) / std_dev_return
```
**Target:** Strategy B > 1.5

### 5. Profit Factor
```typescript
profit_factor = gross_profit / gross_loss
```
**Target:** Strategy B > 1.8

### 6. Total Trades
```typescript
total_trades = signals_generated
```
**Expected:** Strategy B < Strategy A (more selective)

---

## Implementation Components

### 1. Backtest Engine
**File:** `server/services/backtestEngine.ts`

```typescript
interface BacktestConfig {
  strategy: 'A' | 'B';
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  positionSize: number;
}

interface BacktestResult {
  strategy: string;
  metrics: {
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    avg_win: number;
    avg_loss: number;
    rr_ratio: number;
    total_return: number;
    max_drawdown: number;
    sharpe_ratio: number;
    profit_factor: number;
    calmar_ratio: number;
  };
  trades: Trade[];
  equity_curve: EquityPoint[];
}
```

### 2. Strategy Definitions
**Strategy A (Pre-Phase 4):**
- No pattern validation
- Accept all detected patterns
- Lower confidence thresholds
- More frequent signals

**Strategy B (Phase 4):**
- Full pattern validation
- Minimum 20 trades, 30 occurrences
- 30-day recency requirement
- Win rate > 50% filter
- More selective signals

### 3. Trade Simulator
**File:** `server/services/tradeSimulator.ts`

Simulates trade execution:
- Entry price (market order)
- Stop loss execution
- Take profit levels
- Slippage modeling
- Fee calculation
- Position sizing

### 4. Statistical Analysis
**File:** `server/services/statisticalAnalysis.ts`

Performs:
- T-test for mean differences
- Chi-square for win rate
- Confidence intervals (95%)
- Statistical significance (p < 0.05)
- Effect size (Cohen's d)

### 5. Comparison Dashboard
**Endpoint:** `GET /api/backtest/compare`

Returns:
```json
{
  "period": "2024-10-01 to 2024-10-24",
  "strategy_a": {
    "name": "Pre-Phase 4 (No Validation)",
    "metrics": {...},
    "summary": "Aggressive approach"
  },
  "strategy_b": {
    "name": "Phase 4 (With Validation)",
    "metrics": {...},
    "summary": "Selective approach"
  },
  "comparison": {
    "win_rate_improvement": "+15.3%",
    "rr_improvement": "+0.8",
    "drawdown_reduction": "-8.2%",
    "statistical_significance": {
      "win_rate": "p=0.001 (highly significant)",
      "returns": "p=0.023 (significant)"
    },
    "recommendation": "Strategy B superior"
  }
}
```

---

## Implementation Steps

### Step 1: Build Backtest Engine
```bash
1. Create backtestEngine.ts
2. Implement historical data fetching
3. Build signal generation replay
4. Add trade execution simulation
5. Calculate performance metrics
```

### Step 2: Implement Strategy Variants
```bash
1. Create strategyA.ts (no validation)
2. Reuse aiSignalEngine.ts (Strategy B)
3. Add strategy switch parameter
4. Ensure fair comparison (same data)
```

### Step 3: Run Historical Tests
```bash
1. Fetch 30 days of historical data
2. Run both strategies simultaneously
3. Record all trades and metrics
4. Generate equity curves
```

### Step 4: Statistical Analysis
```bash
1. Compare win rates (chi-square)
2. Compare returns (t-test)
3. Calculate confidence intervals
4. Determine significance
```

### Step 5: Build Comparison API
```bash
1. Create /api/backtest/compare endpoint
2. Return comprehensive comparison
3. Include statistical tests
4. Provide recommendations
```

### Step 6: Visualization
```bash
1. Add equity curve charts
2. Show drawdown comparison
3. Display trade distribution
4. Create performance dashboard
```

---

## Success Criteria

### Statistical Significance
- Win rate improvement: p < 0.05 ✓
- Return improvement: p < 0.05 ✓
- Confidence: 95% CI ✓

### Performance Targets
- Strategy B win rate: > 60% ✓
- Strategy B RR ratio: > 2.0:1 ✓
- Strategy B drawdown: < 15% ✓
- Strategy B Sharpe: > 1.5 ✓

### Trade Quality
- Lower trade count (more selective) ✓
- Higher avg trade quality ✓
- Fewer false signals ✓
- Better risk management ✓

---

## Timeline

**Day 1-2:** Backtest engine & trade simulator  
**Day 3:** Strategy implementations  
**Day 4:** Historical data & execution  
**Day 5:** Statistical analysis & reporting  
**Day 6:** Dashboard & visualization  
**Day 7:** Documentation & review  

---

## Files to Create

1. `server/services/backtestEngine.ts` - Core backtesting logic
2. `server/services/tradeSimulator.ts` - Trade execution simulation
3. `server/services/strategyA.ts` - Pre-Phase 4 strategy
4. `server/services/statisticalAnalysis.ts` - Statistical tests
5. `server/routes/backtest.ts` - Backtest API endpoints
6. `server/utils/historicalData.ts` - Historical data fetcher
7. `tests/backtest.test.ts` - Unit tests

---

## Expected Results

Based on Phase 4 improvements, we expect:

**Strategy A (Baseline):**
- Win rate: ~45-50%
- RR ratio: ~1.5:1
- Max drawdown: ~20-25%
- Sharpe: ~0.8
- Trades: 100+

**Strategy B (Phase 4):**
- Win rate: ~60-65% (+15%)
- RR ratio: ~2.3:1 (+0.8)
- Max drawdown: ~12-15% (-8%)
- Sharpe: ~1.6 (+0.8)
- Trades: 40-60 (more selective)

---

## Risk Considerations

1. **Overfitting Risk**
   - Use out-of-sample testing
   - Walk-forward validation
   - Cross-validation periods

2. **Data Quality**
   - Ensure clean historical data
   - Handle missing data properly
   - Account for slippage/fees

3. **Market Regime Changes**
   - Test across different regimes
   - Trending vs ranging markets
   - High vs low volatility

4. **Execution Reality**
   - Model realistic slippage
   - Include trading fees
   - Account for latency

---

## Next Actions

Ready to implement Phase 5. Shall we proceed with:

1. **Build backtest engine first** (core infrastructure)
2. **Implement Strategy A** (baseline without validation)
3. **Run historical comparison** (30-day backtest)
4. **Generate statistical report** (prove Phase 4 superiority)

Confirm to start implementation.

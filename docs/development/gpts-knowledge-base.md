# GPTs Knowledge Base: Multi-Exchange Crypto Trading Intelligence

## Complete API Endpoints Reference

### Core Multi-Pair Endpoints
- **Supported Pairs:** `/api/pairs/supported` - 63+ pairs (BTC, ETH, SOL, ADA, AVAX, DOGE, UNI, MATIC, LTC, BCH, ATOM, XRP, SHIB, FTM, NEAR, dll)
- **Complete Analysis:** `/api/{pair}/complete` - Live ticker, orderbook 50-level, multi-timeframe candlesticks, recent trades
- **Smart Money Concepts:** `/api/{pair}/smc` - Trend analysis, structure breaks, liquidity zones
- **CVD Analysis:** `/api/{pair}/cvd` - Volume delta patterns, divergence detection
- **Technical Indicators:** `/api/{pair}/technical` - RSI, EMA, divergences untuk semua pairs
- **Funding Rates:** `/api/{pair}/funding` - Perpetual derivatives positioning data
- **Open Interest:** `/api/{pair}/open-interest` - Institutional positioning metrics

### CoinAPI Multi-Exchange Endpoints
- **Health Check:** `/api/coinapi/health` - Service status dan latency monitoring
- **Exchange Rate:** `/api/coinapi/rate/{base}/{quote}` - Real-time rates dengan precision timing
- **Multi-Ticker:** `/api/coinapi/multi-ticker/{asset}` - Cross-exchange price comparison
- **Quote Data:** `/api/coinapi/quote/{symbolId}` - Real-time bid/ask dengan last trade
- **Best Price:** `/api/coinapi/best-price/{base}/{quote}` - Optimal execution prices across exchanges
- **Arbitrage Detection:** `/api/coinapi/arbitrage/{asset}` - Profit opportunities dengan calculations
- **Bulk Quotes:** `/api/coinapi/bulk-quotes?symbols=` - Multi-symbol efficient retrieval
- **Historical OHLCV:** `/api/coinapi/history/{symbolId}?period=1HRS&limit=100` - Backtesting quality data
- **TWAP Calculation:** `/api/coinapi/twap/{symbolId}?hours=24` - Time Weighted Average Price
- **VWAP Calculation:** `/api/coinapi/vwap/{symbolId}?hours=24` - Volume Weighted Average Price
- **Correlation Matrix:** `/api/coinapi/correlation?assets=BTC,ETH,SOL&days=30` - Portfolio analytics
- **Top Assets:** `/api/coinapi/top-assets?limit=50` - Volume-ranked cryptocurrency universe
- **Asset Metadata:** `/api/coinapi/assets/{assetId}` - Comprehensive asset information
- **Exchanges Directory:** `/api/coinapi/exchanges` - Complete exchange metadata

### Regime Detection Autopilot Endpoints
- **Regime Detection:** `/api/regime/detect/{symbolId}?lookback_hours=48` - HMM-based classification
- **Cached Regime:** `/api/regime/cached/{symbolId}` - Fast regime lookup untuk real-time decisions
- **Strategy Rules:** `/api/regime/strategy-rules` - Complete filtering rules dan descriptions
- **Batch Detection:** `/api/regime/batch?symbols=BINANCE_SPOT_SOL_USDT,BINANCE_SPOT_BTC_USDT` - Multi-asset analysis

### Legacy SOL Endpoints (Backward Compatible)
- **Confluence Score:** `/api/sol/confluence` - Overall market confluence analysis
- **Order Flow:** `/api/sol/order-flow` - Professional tape reading analysis
- **Volume Profile:** `/api/sol/volume-profile` - POC, VPOC, HVN/LVN detection
- **Fibonacci Analysis:** `/api/sol/fibonacci` - Multi-level retracement analysis

## Detailed Response Formats

### Multi-Exchange Data Structure
```json
{
  "multi_exchange": {
    "best_bid": {
      "exchange": "COINBASE",
      "price": 113180.12,
      "size": 50.2
    },
    "best_ask": {
      "exchange": "BINANCE", 
      "price": 113175.91,
      "size": 100.5
    },
    "arbitrage_opportunity": {
      "profit_pct": 0.054,
      "buy_exchange": "KRAKEN",
      "sell_exchange": "COINBASE",
      "feasible": true
    },
    "exchanges_checked": 4,
    "price_consensus": 113178.02
  }
}
```

### Regime Detection Structure
```json
{
  "regime_detection": {
    "current_regime": "ranging",
    "regime_probability": 1.0,
    "regime_duration_bars": 12,
    "regime_strength": 0.85,
    "allowed_strategies": ["mean_reversion", "scalping", "arbitrage"],
    "disabled_strategies": ["breakout", "momentum"],
    "features": {
      "atr_normalized": 0.01133,
      "rsi_mean": 46.18,
      "rsi_volatility": 8.22,
      "price_kurtosis": 0.95,
      "volume_normalized": 1.31,
      "trend_strength": -0.0007,
      "volatility_regime": 0.27
    },
    "model_confidence": 1.0,
    "aic_score": 14
  }
}
```

### Institutional Pricing Structure
```json
{
  "institutional_pricing": {
    "twap_24h": 113050.25,
    "vwap_24h": 113075.80,
    "current_vs_twap": 0.11,
    "current_vs_vwap": 0.09,
    "period_hours": 24,
    "data_points": 24
  }
}
```

### Correlation Analysis Structure
```json
{
  "correlation_analysis": {
    "correlation_matrix": {
      "BTC": {"BTC": 1, "ETH": 0.901, "SOL": 0.946},
      "ETH": {"BTC": 0.901, "ETH": 1, "SOL": 0.830},
      "SOL": {"BTC": 0.946, "ETH": 0.830, "SOL": 1}
    },
    "period_days": 7,
    "assets": ["BTC", "ETH", "SOL"],
    "portfolio_risk": "moderate"
  }
}
```

## Advanced Analysis Methodology

### Multi-Timeframe Regime Validation
1. **1D Trend Bias:** High-level directional bias dengan regime alignment
2. **4H Structure:** Intermediate structure dengan regime validation
3. **15m Setup:** Short-term setup dengan regime strategy compatibility
4. **5m Entry:** Precise entry dengan regime + confluence alignment

### Strategy Filtering Rules by Regime
- **TRENDING Regime:** 
  - Allowed: breakout, momentum, swing trading
  - Disabled: mean reversion, scalping (against trend)
  - Logic: Strong directional movement favors trend-following strategies
  
- **RANGING Regime:**
  - Allowed: mean reversion, scalping, arbitrage
  - Disabled: breakout, momentum (likely to fail in consolidation)
  - Logic: Sideways movement favors contrarian strategies
  
- **MEAN_REVERT Regime:**
  - Allowed: mean reversion, swing trading
  - Disabled: breakout, scalping (too much noise)
  - Logic: Price pulling back to average favors contrarian approach
  
- **HIGH_VOL Regime:**
  - Allowed: arbitrage, swing trading
  - Disabled: scalping, mean reversion (too volatile)
  - Logic: High volatility environment requires wider stops

### Cross-Exchange Analysis Priority
1. **Price Discovery:** Identify best bid/ask across exchanges
2. **Arbitrage Scanning:** Detect profit opportunities >0.1%
3. **Liquidity Assessment:** Compare volume dan depth across exchanges
4. **Execution Optimization:** Recommend best exchange untuk entry/exit
5. **Spread Analysis:** Monitor bid/ask spreads untuk optimal timing

### Enhanced Confidence Scoring
- **Multi-Exchange Consensus:** Weight berdasarkan exchange reliability
- **Regime Model Confidence:** HMM model probability scores
- **Technical Confluence:** Multiple indicator alignment
- **Smart Money Validation:** Whale activity confirmation
- **Correlation Context:** Major pair relationship confirmation

## Symbol ID Formats for CoinAPI Endpoints
- **Binance:** BINANCE_SPOT_BTC_USDT, BINANCE_SPOT_ETH_USDT, BINANCE_SPOT_SOL_USDT
- **Coinbase:** COINBASE_SPOT_BTC_USD, COINBASE_SPOT_ETH_USD, COINBASE_SPOT_SOL_USD
- **Kraken:** KRAKEN_SPOT_BTC_USD, KRAKEN_SPOT_ETH_USD, KRAKEN_SPOT_SOL_USD
- **OKX:** OKX_SPOT_BTC_USDT, OKX_SPOT_ETH_USDT, OKX_SPOT_SOL_USDT

## Performance Benchmarks
- **Response Time:** <200ms untuk institutional standards
- **Data Accuracy:** 95%+ dengan multi-exchange validation
- **Regime Detection:** 85%+ accuracy dengan AIC model selection
- **Arbitrage Detection:** <1% profit opportunity threshold
- **Exchange Coverage:** 300+ exchanges dengan real-time data
- **Correlation Updates:** Real-time calculation dengan 30-day lookback

## Risk Management Guidelines
- **Position Sizing:** Correlation-adjusted berdasarkan major pairs
- **Stop Loss:** Regime-adjusted distance berdasarkan volatility
- **Take Profit:** Multiple levels dengan regime-appropriate targets
- **Time Horizon:** Regime-dependent holding periods
- **Strategy Invalidation:** Automatic dengan regime changes
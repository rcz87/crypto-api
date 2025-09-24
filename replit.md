# Enhanced Intelligent Screening System

## Overview
The Enhanced Intelligent Screening System is an institutional-grade perpetual futures trading data gateway supporting over 65 crypto assets (SOL, BTC, ETH) through an 8-layer SharpSignalEngine. It provides advanced derivatives trading intelligence with real-time whale detection, smart money analysis, CVD analysis, and GPT integration. The system targets institutional standards with sub-50ms response times and 99.5%+ uptime, offering 21+ API endpoints for comprehensive market analysis and real-time data, complemented by a professional UI and TradingView integration. Its business vision is to be a leading data provider for institutional and high-tier retail traders, leveraging AI-enhanced signal processing for superior market insights.

## User Preferences
- **Preferred Communication Style**: Simple, everyday language (Indonesian/Bahasa Indonesia)
- **Primary Language**: Indonesian (Bahasa Indonesia)  
- **Technical Approach**: Advanced institutional features over simple implementations
- **System Preference**: Real-time data accuracy with professional trading standards
- **Focus**: Institutional-grade trading systems dengan monitoring 24/7

## System Architecture

### Core Architectural Decisions
The system employs a modular architecture with clear separation of concerns, comprehensive testing, automated production deployment, and full observability. The frontend is built with React 18 (TypeScript, Vite), utilizing `shadcn/ui` and Tailwind CSS for a professional dark-themed dashboard. The backend uses Node.js/Express.js (TypeScript) with a RESTful API. Data persistence involves PostgreSQL with Drizzle ORM (Neon Database) for primary data, TimescaleDB for time-series data, and Redis for caching and rate limiting.

### GPT Actions Integration (✅ PRODUCTION READY)
**Status: FULLY OPERATIONAL** - GPT Actions providing real-time institutional data

**Verified Working Operations (September 24, 2025):**
- **Single Operations**: `{"op":"whale_alerts","params":{"exchange":"hyperliquid"}}` - Active whale positions & liquidations
- **Batch Operations**: `{"ops":[{"op":"ticker","params":{"symbol":"BTC"}},{"op":"market_sentiment","params":{}}]}` - Multi-operation support
- **Real Data Validation**: BTC $112,441.1, ETH $4,166, SOL $209.59 (live prices confirmed)
- **Market Intelligence**: 100+ cryptocurrencies with volume, market cap, dominance data
- **Institutional Data**: ETF flows, whale positions, liquidation heatmaps, sentiment analysis

**Active Endpoints:**
- `/gpts/unified/advanced` - ✅ Multi-operation gateway (primary endpoint for private GPT)
- `/gpts/health` - ✅ System health monitoring  
- `/gpts/unified/symbols` - ✅ Symbol mapping reference
- **OpenAPI Specification**: Complete 4.0.1 GPT-compatible spec at `public/openapi-4.0.1-gpts-compat.yaml`

**Supported Operations:** whale_alerts, whale_positions, etf_flows, market_sentiment, market_coins, ticker, liquidation_heatmap, spot_orderbook, atr, options_oi

### UI/UX Decisions
The frontend features a modern, professional dark-themed dashboard using `shadcn/ui` and Tailwind CSS for a consistent design system. Key UI components include an AI Signal Dashboard, CVD Analysis, Confluence Scoring, Multi-timeframe Analysis, Fibonacci Visualization, Funding Rate, Liquidity Heatmap, Live Trading Signals, Multi-Coin Screener, Open Interest Charts, Order Flow Analysis, SMC Analysis, Technical Indicators, and TradingView widget integration.

### Feature Specifications
The **SharpSignalEngine** employs an 8-layer detection system analyzing SMC (market structure, BOS/CHoCH, liquidity sweeps), CVD (order flow divergence with AI filtering), and Multi-timeframe analysis. It performs real-time whale detection, smart money tracking, incorporates ATR-based stops and position sizing, and uses a 25-feature vector neural network for advanced confluence scoring. The **AI Trading System** utilizes backpropagation-trained neural network models with 25-feature vectors, adaptive learning, and genetic algorithm-based parameter tuning. The **Multi-Coin Screening Module** conducts 8-Layer analysis with high-performance metrics. **CoinGlass Integration** provides real-time streaming liquidations, funding rates, open interest, heatmap analytics via TimescaleDB, and automated Telegram alerts. **API Resilience & Performance** features auto-batching, exponential backoff retries, multi-provider fallbacks, circuit breaker protection, WebSocket auto-reconnection, and adaptive throttling, aiming for average response times under 50ms. An advanced alert system includes interactive Telegram features, robust risk management integration (position sizing, stop loss, take profit, risk-reward), and specific trigger conditions for whale activity, ETF flows, and smart money.

## External Dependencies

### Data Providers
- **OKX API**: Live pricing, order flow, funding rates.
- **CoinAPI**: 65+ cryptocurrency data, VWAP calculations.
- **CoinGlass v4 API**: Institutional data, ETF flows, whale alerts.

### Infrastructure
- **Neon Database**: PostgreSQL database.
- **TimescaleDB**: Time-series data storage.
- **Redis**: Caching and performance optimization.
- **OpenAI API**: GPT-4o compatible AI integration.
- **Replit**: Development hosting.
- **Prometheus, Grafana**: Monitoring and visualization (ready for deployment).

### Frontend Assets
- **Google Fonts**: (Inter, DM Sans, Fira Code, Geist Mono).
- **Lucide React**: Icons.
- **TradingView**: Charting widget integration.
- **shadcn/ui with Tailwind CSS**: UI framework.
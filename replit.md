# Enhanced Intelligent Screening System

## Overview
The Enhanced Intelligent Screening System is an institutional-grade perpetual futures trading data gateway supporting over 65 crypto assets. It features an 8-layer SharpSignalEngine providing advanced derivatives trading intelligence with real-time whale detection, smart money analysis, CVD analysis, and GPT integration. The system aims for institutional standards with sub-50ms response times and 99.5%+ uptime, offering 21+ API endpoints for comprehensive market analysis and real-time data, complemented by a professional UI and TradingView integration. Its business vision is to be a leading data provider for institutional and high-tier retail traders, leveraging AI-enhanced signal processing for superior market insights.

## User Preferences
- **Preferred Communication Style**: Simple, everyday language (Indonesian/Bahasa Indonesia)
- **Primary Language**: Indonesian (Bahasa Indonesia)
- **Technical Approach**: Advanced institutional features over simple implementations
- **System Preference**: Real-time data accuracy with professional trading standards
- **Focus**: Institutional-grade trading systems dengan monitoring 24/7

## System Architecture

### Core Architectural Decisions
The system employs a modular architecture with clear separation of concerns, comprehensive testing, automated production deployment, and full observability. The frontend uses React 18 (TypeScript, Vite) with `shadcn/ui` and Tailwind CSS for a professional dark-themed dashboard. The backend utilizes Node.js/Express.js (TypeScript) with a RESTful API. Data persistence is managed with PostgreSQL via Drizzle ORM (Neon Database) for primary data, TimescaleDB for time-series data, and Redis for caching and rate limiting.

### GPT Actions Integration
The system fully integrates GPT Actions, providing real-time institutional data through a multi-operation gateway (`/gpts/unified/advanced`). It supports operations like `whale_alerts`, `whale_positions`, `etf_flows`, `market_sentiment`, `ticker`, `liquidation_heatmap`, **`new_listings`** (crypto new listings detection), **`volume_spikes`** (volume spikes with whale & order flow analysis), and **`opportunities`** (AI-scored trading opportunities), covering over 100 cryptocurrencies with enhanced real-time monitoring.

### UI/UX Decisions
The frontend features a modern, professional dark-themed dashboard using `shadcn/ui` and Tailwind CSS. Key UI components include an AI Signal Dashboard, CVD Analysis, Confluence Scoring, Liquidity Heatmap, Live Trading Signals, Multi-Coin Screener, and TradingView widget integration.

### Feature Specifications
The **SharpSignalEngine** employs an 8-layer detection system analyzing SMC, CVD, and Multi-timeframe analysis. It performs real-time whale detection, smart money tracking, incorporates ATR-based stops and position sizing, and uses a 25-feature vector neural network for advanced confluence scoring. The **AI Trading System** utilizes backpropagation-trained neural network models with adaptive learning and genetic algorithm-based parameter tuning. The **Multi-Coin Screening Module** conducts 8-Layer analysis with high-performance metrics. **CoinGlass Integration** provides real-time streaming liquidations, funding rates, open interest, and heatmap analytics. **API Resilience & Performance** features auto-batching, exponential backoff retries, multi-provider fallbacks, circuit breaker protection, WebSocket auto-reconnection, and adaptive throttling, aiming for average response times under 50ms. An advanced alert system includes interactive Telegram features and robust risk management integration. A **New Listing Detection System** provides real-time monitoring, volume spike detection, AI-powered opportunity scoring, and enhanced Telegram alerts with BUY/SHORT directional signals, analyzing buy/sell pressure, CVD, whale direction, and funding rates.

## External Dependencies

### Data Providers
- **OKX API**: Live pricing, order flow, funding rates.
- **CoinAPI**: Cryptocurrency data, VWAP calculations.
- **CoinGlass v4 API**: Institutional data, ETF flows, whale alerts.

### Infrastructure
- **Neon Database**: PostgreSQL database.
- **TimescaleDB**: Time-series data storage.
- **Redis**: Caching and performance optimization.
- **OpenAI API**: GPT-4o compatible AI integration.
- **Replit**: Development hosting.
- **Prometheus, Grafana**: Monitoring and visualization.

### Frontend Assets
- **Google Fonts**: (Inter, DM Sans, Fira Code, Geist Mono).
- **Lucide React**: Icons.
- **TradingView**: Charting widget integration.
- **shadcn/ui with Tailwind CSS**: UI framework.
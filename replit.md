# Overview

This project is an institutional-grade perpetual futures trading data gateway designed to support multiple assets (SOL, BTC, ETH) through an 8-layer SharpSignalEngine. It delivers advanced derivatives trading intelligence, including real-time whale detection, smart money analysis, CVD analysis, and GPT integration. The system aims for institutional standards with sub-50ms response times and 99.5%+ uptime, offering over 21 API endpoints for comprehensive market analysis and real-time data, complemented by a professional UI with TradingView integration. The business vision is to become a leading data provider for institutional and high-tier retail traders, leveraging AI-enhanced signal processing for superior market insights.

# User Preferences

Preferred communication style: Simple, everyday language.
Primary language: Indonesian (Bahasa Indonesia)
Technical approach: Advanced institutional features over simple implementations
System preference: Real-time data accuracy with professional trading standards

# System Architecture

## Core Architectural Decisions
The system employs a modular architecture with a clear separation of concerns, comprehensive testing, automated production deployment, and full observability. The frontend is built with React 18 (TypeScript, Vite), utilizing `shadcn/ui` and Tailwind CSS for a professional dark-themed dashboard. The backend uses Node.js/Express.js (TypeScript) to provide a RESTful API. Data persistence relies on PostgreSQL with Drizzle ORM (Neon Database) for primary data, TimescaleDB for time-series data, and Redis for caching and rate limiting.

## UI/UX Decisions
The frontend features a modern, professional dark-themed dashboard using `shadcn/ui` and Tailwind CSS for a consistent design system. Key components include AI Signal Dashboard, CVD Analysis, Confluence Scoring, Multi-timeframe Analysis, Fibonacci Visualization, Funding Rate, Liquidity Heatmap, Live Trading Signals, Multi-Coin Screener, Open Interest Charts, Order Flow Analysis, SMC Analysis, Technical Indicators, and a TradingView widget integration.

## Feature Specifications
### SharpSignalEngine (8-Layer Detection)
Analyzes SMC (market structure, BOS/CHoCH, liquidity sweeps), CVD (order flow divergence with AI filtering), and Multi-timeframe analysis. It performs real-time whale detection, smart money tracking, incorporates ATR-based stops and position sizing, and uses a 25-feature vector neural network for advanced confluence scoring.

### AI Trading System
Utilizes backpropagation-trained neural network models with 25-feature vectors, adaptive learning, and genetic algorithm-based parameter tuning. Includes a backtesting framework with historical simulation capabilities.

### Multi-Coin Screening Module
Performs an 8-Layer analysis (SMC, Price Action, EMA, RSI/MACD, Funding, OI, CVD, Fibonacci) with high-performance metrics (sub-220ms for 5 symbols, sub-2s for 50 symbols) requiring a minimum 10% confidence score.

### CoinGlass Integration System
Provides real-time streaming liquidations, funding rates, open interest, heatmap analytics via TimescaleDB, and automated alerts for critical market events via Telegram.

### API Resilience & Performance
Features auto-batching, exponential backoff retries, multi-provider fallbacks, circuit breaker protection, WebSocket auto-reconnection, and adaptive throttling. Achieves average response times under 50ms with a TTL Cache (70%+ hit ratio), WebSocket backpressure control, and Zod schema validation for data quality.

# External Dependencies

- **Crypto Data**: OKX exchange API, CoinAPI.
- **Institutional Data**: CoinGlass v4 API.
- **Database**: Neon Database (PostgreSQL), TimescaleDB.
- **AI Integration**: OpenAI API (GPT-4o compatible).
- **Hosting**: Replit (development), VPS (production).
- **Monitoring**: Prometheus, Grafana.
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono).
- **Icons**: Lucide React.
- **Charting**: TradingView widget.
# Overview

This project delivers an institutional-grade perpetual futures trading data gateway supporting multiple assets (SOL, BTC, ETH) through an 8-layer SharpSignalEngine. It provides advanced derivatives trading intelligence, including real-time whale detection, smart money analysis, CVD analysis, and GPT integration, aiming for institutional standards with sub-50ms response times and 99.5%+ uptime. The system offers 21+ API endpoints for comprehensive market analysis and real-time data, complemented by a professional UI with TradingView integration. The business vision is to become a leading data provider for institutional and high-tier retail traders, leveraging AI-enhanced signal processing.

# User Preferences

Preferred communication style: Simple, everyday language.
Primary language: Indonesian (Bahasa Indonesia)
Technical approach: Advanced institutional features over simple implementations
System preference: Real-time data accuracy with professional trading standards

# System Architecture

## Frontend
- **Framework**: React 18 with TypeScript (Vite).
- **UI**: shadcn/ui (Radix UI), Tailwind CSS.
- **State Management**: TanStack Query (React Query).
- **Routing**: Wouter.
- **Design**: Modern dashboard with real-time data visualization, professional dark theme, SVG market depth charts, and TradingView integration.

## Backend
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript (ES modules).
- **API**: RESTful, structured JSON.
- **Middleware**: Custom rate limiting, CORS, request logging.
- **Error Handling**: Centralized with proper HTTP status codes.

## Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM (Neon Database).
- **Time-series Database**: TimescaleDB for historical data (CoinGlass system).
- **Cache Layer**: Redis for session management and rate limiting.
- **Schema**: System metrics, logs, structured crypto data models.

## Core Features & Modules

### SharpSignalEngine (8-Layer Detection)
- **Analysis**: SMC (market structure, BOS/CHoCH, liquidity sweeps), CVD (order flow divergence with AI filtering), Multi-timeframe analysis (7-timeframe correlation).
- **Detection**: Real-time whale detection, smart money tracking.
- **Risk Management**: ATR-based stops, position sizing.
- **Advanced Confluence**: 25-feature vector neural network scoring.

### AI Trading System
- **Engine**: Backpropagation-trained neural network models with 25-feature vectors.
- **Optimization**: Adaptive learning, genetic algorithm-based parameter tuning.
- **Framework**: Backtesting framework with historical simulation.
- **Future Enhancements**: DL+RL hybrid for real-time decision making, model quantization, LSTM-CNN for CVD analysis.

### Multi-Coin Screening Module
- **Analysis**: 8-Layer analysis (SMC, Price Action, EMA, RSI/MACD, Funding, OI, CVD, Fibonacci).
- **Performance**: Sub-220ms for 5 symbols, <2s for 50 symbols.
- **Confidence Scoring**: Minimum 10% confidence.

### CoinGlass Integration System
- **Data**: Real-time streaming liquidations, funding rates, open interest.
- **Analytics**: Heatmap analytics via TimescaleDB.
- **Alerting**: Automated liquidation cascade, funding anomaly detection, Telegram alerts, real-time whale alert system.

### Premium Analytics & Indicators
- **Indicators**: CCI, Parabolic SAR, Ichimoku Cloud, OBV, Williams %R, ADX, ATR.
- **Order Flow**: Real-time trades with buy/sell indicators and whale alerts.
- **Market Depth**: Binance-style SVG rendering with 1000-level depth.

### GPT Actions Integration (21 Endpoints)
- **API**: Unified API for CoinGlass premium endpoints.
- **Resilience**: Rate budget management, circuit breaker protection, Zod schema validation.

## API Resilience & Performance
- **Resilience**: Auto-batching, exponential backoff retries, multi-provider fallbacks, circuit breaker, WebSocket auto-reconnection, adaptive throttling.
- **Performance**: TTL Cache with single-flight pattern (70%+ hit ratio), WebSocket backpressure control, adaptive throttling based on volatility, average response time <50ms.
- **Quality Assurance**: Zod schema validation, data quality monitoring, health check system, Prometheus metrics, structured logging.

## Deployment & Infrastructure
- **Production Readiness**: Docker deployment, VPS automation with PM2, Nginx for reverse proxy/SSL, PostgreSQL with TimescaleDB.
- **Monitoring**: Prometheus and Grafana stack.

# External Dependencies

- **Crypto Data**: OKX exchange API, CoinAPI (300+ exchanges).
- **Institutional Data**: CoinGlass v4 API (21 exchanges).
- **Database**: Neon Database (PostgreSQL), TimescaleDB.
- **AI Integration**: OpenAI API (GPT-4o compatible).
- **Hosting**: Replit (development), VPS (production).
- **Monitoring**: Prometheus, Grafana.
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono).
- **Icons**: Lucide React.
- **Charting**: TradingView widget.
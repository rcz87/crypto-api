# Overview

This project is an institutional-grade perpetual futures trading data gateway, supporting multiple assets (SOL, BTC, ETH) through an 8-layer SharpSignalEngine. It provides advanced derivatives trading intelligence, including real-time whale detection, smart money analysis, CVD analysis, and GPT integration. The system aims for institutional standards with sub-50ms response times and 99.5%+ uptime, offering over 21 API endpoints for comprehensive market analysis and real-time data, complemented by a professional UI with TradingView integration. The business vision is to become a leading data provider for institutional and high-tier retail traders, leveraging AI-enhanced signal processing.

# User Preferences

Preferred communication style: Simple, everyday language.
Primary language: Indonesian (Bahasa Indonesia)
Technical approach: Advanced institutional features over simple implementations
System preference: Real-time data accuracy with professional trading standards

# System Architecture

## Core Architectural Decisions
The system employs a clear separation of concerns with a modular architecture for scalability, comprehensive testing for reliability, automated production deployment, and full observability for monitoring. It utilizes a React 18 (TypeScript, Vite) frontend with shadcn/ui and Tailwind CSS for a modern, professional dark-themed dashboard. The backend is built with Node.js/Express.js (TypeScript) providing a RESTful API. Data storage involves PostgreSQL with Drizzle ORM (Neon Database) as the primary database, TimescaleDB for historical time-series data, and Redis for caching and rate limiting.

## Feature Specifications
### SharpSignalEngine (8-Layer Detection)
Analyzes SMC (market structure, BOS/CHoCH, liquidity sweeps), CVD (order flow divergence with AI filtering), and Multi-timeframe analysis. It performs real-time whale detection and smart money tracking, incorporates ATR-based stops and position sizing for risk management, and uses a 25-feature vector neural network for advanced confluence scoring.

### AI Trading System
Features backpropagation-trained neural network models with 25-feature vectors, adaptive learning, and genetic algorithm-based parameter tuning. Includes a backtesting framework with historical simulation.

### Multi-Coin Screening Module
Performs an 8-Layer analysis (SMC, Price Action, EMA, RSI/MACD, Funding, OI, CVD, Fibonacci) with sub-220ms performance for 5 symbols and sub-2s for 50 symbols, requiring a minimum 10% confidence score.

### CoinGlass Integration System
Provides real-time streaming liquidations, funding rates, open interest, heatmap analytics via TimescaleDB, and automated alerts for liquidation cascades, funding anomalies, and whale alerts via Telegram.

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
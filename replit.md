# Enhanced Intelligent Screening System

## Overview
The Enhanced Intelligent Screening System is an institutional-grade perpetual futures trading data gateway for over 68+ crypto assets. It leverages an 8-layer SharpSignalEngine with advanced derivatives trading intelligence, including real-time whale detection, smart money analysis, CVD analysis, and GPT integration. The system aims for institutional standards with sub-50ms response times and 99.5%+ uptime, providing 21+ API endpoints for comprehensive market analysis, real-time data, a professional UI, and TradingView integration. Its vision is to be a leading data provider for institutional and high-tier retail traders, using AI-enhanced signal processing for superior market insights and providing 24/7 monitoring.

## User Preferences
- **Preferred Communication Style**: Simple, everyday language (Indonesian/Bahasa Indonesia)
- **Primary Language**: Indonesian (Bahasa Indonesia)
- **Technical Approach**: Advanced institutional features over simple implementations
- **System Preference**: Real-time data accuracy with professional trading standards
- **Focus**: Institutional-grade trading systems dengan monitoring 24/7

## System Architecture

### Core Architectural Decisions
The system employs a modular architecture with clear separation of concerns, comprehensive testing, automated deployment, and full observability. The frontend uses React 18 (TypeScript, Vite) with `shadcn/ui` and Tailwind CSS for a dark-themed dashboard. The backend is built with Node.js/Express.js (TypeScript) exposing a RESTful API. Data is managed with PostgreSQL via Drizzle ORM (Neon Database) for primary data, TimescaleDB for time-series data, and Redis for caching and rate limiting. GPT Actions are integrated via a multi-operation gateway, providing real-time institutional data with robust parameter validation to prevent GPT errors and hallucination.

### UI/UX Decisions
The frontend provides a modern, professional dark-themed dashboard utilizing `shadcn/ui` and Tailwind CSS. Key UI components include an AI Signal Dashboard, CVD Analysis, Confluence Scoring, Liquidity Heatmap, Live Trading Signals, Multi-Coin Screener, and TradingView widget integration. The dashboard is branded as **CRYPTOSATX** - displayed consistently in the header and browser title across all pages.

### Feature Specifications
The **SharpSignalEngine** employs an 8-layer detection system analyzing SMC, CVD, and Multi-timeframe analysis, performing real-time whale detection, smart money tracking, ATR-based stops, position sizing, and a 25-feature vector neural network for confluence scoring. The **AI Trading System** uses backpropagation-trained neural networks with adaptive learning and genetic algorithm-based parameter tuning. The **Multi-Coin Screening Module** conducts 8-Layer analysis with high-performance metrics. **CoinGlass Integration** provides real-time streaming liquidations, funding rates, open interest, and heatmap analytics. **API Resilience & Performance** features auto-batching, exponential backoff, multi-provider fallbacks, circuit breaker protection, WebSocket auto-reconnection, and adaptive throttling, aiming for sub-50ms response times. An advanced alert system includes interactive Telegram features and robust risk management. A **New Listing Detection System** offers real-time monitoring, volume spike detection, AI-powered opportunity scoring, and enhanced Telegram alerts with directional signals. The system has been enhanced with 5 additional analytical layers, including Volatility Scoring (ATR-based), Liquidity Filtering, Momentum Divergence Detection, and AI Sentiment Analysis, with timeframe-based weight adjustments for optimized signal generation.

The system features **institutional-grade GPT reasoning** with deep market intelligence analysis, receiving comprehensive context including a 25-Feature Vector, Enhanced Market Context (liquidity heatmap, orderbook imbalance, liquidation zones), and a Validation Layer to prevent GPT hallucinations. Every conclusion is evidence-based, supported by market data, and tracked via a database-backed feedback loop for confidence auto-adjustment. It uses **100% real market data** with multi-layer validation to cross-check GPT output against real market conditions, ensuring accuracy and preventing hallucinations. Recent enhancements include **Market Context Calibration** for AI Signal Intelligence, **Institutional-Grade Resilience Hardening** for Telegram payload checks, rate limiting, and graceful error handling, and an **Adaptive Threshold Auto-Tuning System** that self-optimizes confidence filters based on 7-day performance. An **Event-Driven Enhanced AI Signal Monitor** provides alerts only when valid signals are detected, moving away from continuous loop screening for efficiency.

## External Dependencies

### Data Providers
- **OKX API**: Live pricing, order flow, funding rates.
- **CoinAPI**: Cryptocurrency data, VWAP calculations.
- **CoinGlass v4 API**: Institutional data, ETF flows, whale alerts.
- **CoinMarketCap API**: Multi-exchange aggregation, market cap data, tokenomics analysis, micro-cap screening.

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
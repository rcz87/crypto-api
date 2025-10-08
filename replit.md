# Enhanced Intelligent Screening System

## Overview
The Enhanced Intelligent Screening System is an institutional-grade perpetual futures trading data gateway for over 65 crypto assets. It leverages an 8-layer SharpSignalEngine with advanced derivatives trading intelligence, including real-time whale detection, smart money analysis, CVD analysis, and GPT integration. The system aims for institutional standards with sub-50ms response times and 99.5%+ uptime, providing 21+ API endpoints for comprehensive market analysis, real-time data, a professional UI, and TradingView integration. Its vision is to be a leading data provider for institutional and high-tier retail traders, using AI-enhanced signal processing for superior market insights.

## User Preferences
- **Preferred Communication Style**: Simple, everyday language (Indonesian/Bahasa Indonesia)
- **Primary Language**: Indonesian (Bahasa Indonesia)
- **Technical Approach**: Advanced institutional features over simple implementations
- **System Preference**: Real-time data accuracy with professional trading standards
- **Focus**: Institutional-grade trading systems dengan monitoring 24/7

## System Architecture

### Core Architectural Decisions
The system features a modular architecture with clear separation of concerns, comprehensive testing, automated deployment, and full observability. The frontend uses React 18 (TypeScript, Vite) with `shadcn/ui` and Tailwind CSS for a dark-themed dashboard. The backend is built with Node.js/Express.js (TypeScript) exposing a RESTful API. Data is managed with PostgreSQL via Drizzle ORM (Neon Database) for primary data, TimescaleDB for time-series data, and Redis for caching and rate limiting.

### GPT Actions Integration
GPT Actions are fully integrated via a multi-operation gateway (`/gpts/unified/advanced`), providing real-time institutional data. The OpenAPI schema supports operations like `whale_alerts`, `whale_positions`, `etf_flows`, `market_sentiment`, `ticker`, `liquidation_heatmap`, `alpha_screening` (CoinMarketCap 4-layer alpha analysis with real-time prices), `new_listings` (crypto new listings detection), `volume_spikes` (volume spikes with whale & order flow analysis), `opportunities` (AI-scored trading opportunities), `micro_caps` (micro-cap gems discovery with tokenomics scoring), and `atr` (real-time ATR volatility from OKX). Parameters are explicitly defined with examples and enum constraints to prevent GPT format errors and hallucination.

### UI/UX Decisions
The frontend provides a modern, professional dark-themed dashboard utilizing `shadcn/ui` and Tailwind CSS. Key UI components include an AI Signal Dashboard, CVD Analysis, Confluence Scoring, Liquidity Heatmap, Live Trading Signals, Multi-Coin Screener, and TradingView widget integration.

### Feature Specifications
The **SharpSignalEngine** employs an 8-layer detection system analyzing SMC, CVD, and Multi-timeframe analysis, performing real-time whale detection, smart money tracking, ATR-based stops, position sizing, and a 25-feature vector neural network for confluence scoring. The **AI Trading System** uses backpropagation-trained neural networks with adaptive learning and genetic algorithm-based parameter tuning. The **Multi-Coin Screening Module** conducts 8-Layer analysis with high-performance metrics. **CoinGlass Integration** provides real-time streaming liquidations, funding rates, open interest, and heatmap analytics. **API Resilience & Performance** features auto-batching, exponential backoff, multi-provider fallbacks, circuit breaker protection, WebSocket auto-reconnection, and adaptive throttling, aiming for sub-50ms response times. An advanced alert system includes interactive Telegram features and robust risk management. A **New Listing Detection System** offers real-time monitoring, volume spike detection, AI-powered opportunity scoring, and enhanced Telegram alerts with directional signals. The system has been enhanced with 5 additional analytical layers, including Volatility Scoring (ATR-based), Liquidity Filtering, Momentum Divergence Detection, and AI Sentiment Analysis, with timeframe-based weight adjustments for optimized signal generation.

## External Dependencies

### Data Providers
- **OKX API**: Live pricing, order flow, funding rates.
- **CoinAPI**: Cryptocurrency data, VWAP calculations.
- **CoinGlass v4 API**: Institutional data, ETF flows, whale alerts.
- **CoinMarketCap API**: Multi-exchange aggregation (300+ exchanges), market cap data, tokenomics analysis, micro-cap screening.

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
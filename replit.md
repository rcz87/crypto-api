# Overview

This project provides an institutional-grade perpetual futures trading data gateway for SOL-USDT-SWAP, powered by an 8-layer SharpSignalEngine. It offers advanced derivatives trading intelligence, including real-time whale detection, smart money analysis, and GPT integration, aiming for institutional trading standards with a target response time of <200ms and high data accuracy. The system features 16 API endpoints for comprehensive market analysis, order flow, and real-time data, complemented by a professional UI with TradingView and Binance-style market depth charts. The business vision is to become a leading data provider for institutional and high-tier retail traders, delivering unparalleled trading intelligence.

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
- **Middleware**: Custom rate limiting (100 requests/minute), CORS, request logging.
- **Error Handling**: Centralized with proper HTTP status codes.

## Data Storage
- **Database**: PostgreSQL with Drizzle ORM (Neon Database).
- **Schema**: System metrics, logs, structured crypto data models.
- **Migrations**: Drizzle Kit.

## Core Features
- **SharpSignalEngine**: 8-layer detection for whale scoring, CVD analysis, multi-timeframe smart money.
- **Premium Orderbook**: VIP tier-based analysis, 1000-level depth, market maker detection.
- **Real-Time Data**: WebSocket streaming for OKX (Level 2 tick-by-tick, 6 channels, 7-timeframe candlesticks).
- **VIP Tier Management**: 4-tier subscription system.
- **Market Depth Chart**: Binance-style SVG rendering.
- **Order Flow**: Real-time trades with buy/sell indicators and whale alerts.
- **Premium Analytics**: Liquidity prediction, institutional signals, market maker flow.
- **AI Trading System**: Neural network-based AI Signal Engine, genetic algorithm-based Strategy Optimization, Backtesting Framework, Reinforcement Learning, Market Intelligence, Performance Analytics.
- **Enhanced Indicators**: CCI, Parabolic SAR, Ichimoku Cloud, OBV, Williams %R.
- **GPT Actions Integration**: Unified endpoint for 11 CoinGlass premium endpoints, supporting single/batch operations with smart parameter defaults.

## API Resilience & Performance
- **Auto-Batching**: Automatically batches requests for efficiency (e.g., Screener >15 symbols, Regime >10 symbols).
- **Retry Mechanisms**: Exponential backoff, intelligent 429 rate limit handling, server error recovery, WebSocket auto-reconnection.
- **Fallback Strategies**: Multi-provider cascade (CoinAPI → OKX → Last-good cache), exchange-specific fallbacks (OKX to Binance for funding rates), circuit breaker protection.
- **Circuit Breaker**: Symbol-level and service-level protection to prevent cascading failures.
- **Performance**: Target <200ms response time (achieved <50ms average), <2s for 50-symbol batches.
- **Data Quality**: Zod schema validation, runtime quality checks, transparent degradation notices.

# External Dependencies

- **Crypto Data**: OKX exchange API.
- **Multi-Exchange Data**: CoinAPI (300+ exchanges).
- **Institutional Data**: CoinGlass v4 API (21 exchanges).
- **Database**: Neon Database (PostgreSQL).
- **AI Integration**: OpenAI GPT-5 API.
- **Hosting**: Replit.
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono).
- **Icons**: Lucide React.
- **Charting**: TradingView widget.
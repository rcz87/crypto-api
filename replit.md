# Overview

This project delivers an institutional-grade perpetual futures trading data gateway for SOL-USDT-SWAP, featuring an 8-layer SharpSignalEngine. It provides advanced derivatives trading intelligence, including real-time whale detection, smart money analysis, and GPT integration, prioritizing institutional trading standards with target response time <200ms (tested avg 250ms) and high data accuracy. Key capabilities include 16 API endpoints for comprehensive market analysis, order flow, smart money concepts, and real-time data, complemented by a professional UI with TradingView and Binance-style market depth charts. The business vision is to provide unparalleled trading intelligence and become a leading data provider for institutional and high-tier retail traders, with the ambition to compete in institutional-grade trading, serving both retail traders and hedge funds.

# User Preferences

Preferred communication style: Simple, everyday language.
Primary language: Indonesian (Bahasa Indonesia)
Technical approach: Advanced institutional features over simple implementations
System preference: Real-time data accuracy with professional trading standards

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite.
- **UI Library**: shadcn/ui built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables.
- **State Management**: TanStack Query (React Query).
- **Routing**: Wouter for lightweight client-side routing.
- **Design System**: Modern dashboard interface with real-time data visualization, professional dark theme, SVG-based smooth curves for market depth, and TradingView widget integration.

## Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful architecture with structured JSON responses.
- **Middleware**: Custom rate limiting (100 requests/minute per IP), CORS, request logging.
- **Error Handling**: Centralized error handling with proper HTTP status codes.

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM.
- **Provider**: Neon Database (serverless PostgreSQL).
- **Schema**: System metrics, logs, and structured crypto data models.
- **Migrations**: Drizzle Kit.

## Authentication and Authorization
- **Rate Limiting**: IP-based rate limiting.

## Core Feature Specifications
- **SharpSignalEngine**: 8-layer detection algorithms including 5-factor whale scoring, advanced CVD analysis, and multi-timeframe smart money detection.
- **Premium Orderbook System**: VIP tier-based analysis with up to 1000-level depth, institutional-grade analytics, and market maker detection.
- **Real-Time Data**: WebSocket streaming for OKX data (Level 2 tick-by-tick orderbook, 6 channels, premium feeds, 7-timeframe candlestick data).
- **VIP Tier Management**: 4-tier subscription system (Standard, VIP1, VIP8, Institutional) with progressive feature unlocking.
- **Market Depth Chart**: Binance-style professional chart with SVG rendering and interactive hover points.
- **Order Flow**: Real-time trades table with buy/sell indicators and whale trade alerts.
- **Premium Analytics**: Enhanced metrics including liquidity prediction, institutional signals, and market maker flow detection.
- **AI Trading System**: Neural network-based AI Signal Engine, genetic algorithm-based Strategy Optimization, comprehensive Backtesting Framework, Reinforcement Learning, Market Intelligence, and Performance Analytics.
- **Enhanced Indicators**: CCI, Parabolic SAR, Ichimoku Cloud, OBV, and Williams %R integrated for comprehensive signal generation and trend analysis.
- **GPT Actions Integration**: Unified endpoint (`/py/gpts/advanced`) consolidates all 11 CoinGlass premium endpoints into a single interface, supporting both single and batch operations with smart parameter defaults for seamless AI integration.

# External Dependencies

- **Crypto Data**: OKX exchange API for real-time SOL trading data and premium feeds.
- **Multi-Exchange Data**: CoinAPI integration with 300+ exchanges for institutional-grade coverage.
- **CoinGlass v4 API**: Real institutional-grade data with 21 exchanges support (Binance, OKX, Bybit+).
- **Database**: Neon Database for PostgreSQL hosting.
- **AI Integration**: OpenAI GPT-5 API for enhanced reasoning and analysis.
- **Hosting**: Replit with custom domain (guardiansofthegreentoken.com).
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono).
- **Icons**: Lucide React.
- **Charting**: TradingView embedded widget.

# Future Development Plans

## Phase 1: Event-Driven Signal Notifier
**Target**: Q1 2025 implementation of autonomous Telegram alert system for high-quality trading signals.

**Core Features:**
- **Event-Driven Architecture**: WebSocket-triggered analysis (no polling loops) with real-time OKX data integration
- **Signal Quality Gating**: Multi-layer filtering system requiring confluence ≥0.75, p_win ≥threshold per regime, RR ≥1.5
- **Anti-Spam Protection**: Intelligent cooldown (8min per symbol), zone deduplication (ATR×0.2), auto-expiry (30-45min)
- **Dual Output Format**: Human-friendly Telegram messages + structured JSON for automation
- **Integration Points**: Leverages existing SharpSignalEngine, enhanced services, and OKXFetcher without modifications

**Technical Specifications:**
- **Microservice Design**: Isolated from core system to ensure zero disruption to current 79% resilience score
- **Trigger Criteria**: Sniper 5m confirmations, spread ≤0.08%, regime-specific probability thresholds
- **Observability**: p95 latency ≤350ms, error rate <1%, comprehensive logging for signal outcomes

## Phase 2: Self-Learning Framework  
**Target**: Q2 2025 implementation of autonomous model improvement and optimization system.

**Machine Learning Pipeline:**
- **L1 Calibration**: Probability accuracy optimization with Isotonic Regression and regime-specific threshold tuning
- **L2 Contextual Bandit**: Dynamic 8-layer weight optimization per market regime and timeframe
- **L3 Meta Learning**: Advanced timing optimization and adaptive position sizing through reinforcement learning

**Core Components:**
- **ExecutionRecorder**: Comprehensive signal and outcome logging with MFE/MAE tracking, time-to-fill analysis
- **Champion-Challenger System**: Automated model promotion/demotion based on PR-AUC, Brier score, and P&L metrics
- **Risk Management**: Circuit breakers (3 SL pause), adaptive sizing, drawdown protection with auto-scaling
- **Feedback Loop**: Telegram inline feedback integration for rapid human-in-the-loop labeling

**Safety Mechanisms:**
- **Paper Trading**: 10% exploration allocation for safe model testing without capital risk
- **Auto-Rollback**: Automatic reversion to previous model if performance degrades beyond thresholds
- **Data Validation**: Comprehensive outcome labeling with win/lose classification, realized RR tracking

**Integration Strategy:**
- **Non-Invasive Design**: Add-on architecture preserving all existing functionality and performance
- **Database Expansion**: New tables (ai_signals, ai_outcomes) without touching current schema
- **API Extension**: New endpoints (/api/ai/*) supplementing existing trading infrastructure

## Implementation Priorities
1. **Immediate**: Event-driven notifier as standalone microservice (Phase 1)
2. **Medium-term**: Self-learning data collection and basic L1 calibration (Phase 2A)  
3. **Long-term**: Advanced bandit optimization and meta-learning capabilities (Phase 2B)

## Success Metrics
- **Phase 1**: Signal quality improvement (reduce false positives by 60%), user satisfaction via Telegram feedback
- **Phase 2**: Model performance gains (15-25% improvement in risk-adjusted returns), automated optimization cycles
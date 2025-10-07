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
- **CoinMarketCap API**: Multi-exchange aggregation (300+ exchanges), market cap data, tokenomics analysis, micro-cap screening (Free tier: 10K credits/month).

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

## Future Development Roadmap

### Advanced Alpha Screening System for Micro-Cap Hidden Gems
Implementation of systematic 4-layer scoring methodology for identifying high-potential micro-cap crypto projects (<$100M market cap) in pre-retail phase.

#### Scoring Framework (100% Total Score)

**Layer 1: Fundamental & Credibility Analysis (35%)**
- **Team Quality Assessment**: 
  - Founder track record, leadership skills, industry expertise
  - Resilience and pivot capability evaluation
  - "People First" investment thesis
- **VC Tier-1 Validation Signal**:
  - Investment from top-tier VCs ($250k-$40M rounds)
  - Proxy for institutional due diligence validation
  - Firms: a16z, Paradigm, Sequoia, Pantera, etc.
- **Product Vision & Infrastructure**:
  - Technical implementation (speed, scalability, security)
  - Consensus mechanism analysis (PoW/PoS)
  - Innovation level and interoperability
  - Real-world problem solving capability

**Layer 2: Tokenomics & Value Accrual (30%)**
- **Supply Structure & Dilution Metrics**:
  - Circulating supply ratio analysis (ideal: 80-90% at TGE)
  - Total supply vs circulating supply comparison
  - Future dilution risk assessment
- **Vesting Schedule Analysis** (Critical):
  - **Vesting cliff duration**: ≥12 months (ideal), ≥6 months (minimum)
  - Team/VC token release timeline
  - Alignment with long-term protocol success
- **Dilution Risk Matrix**:
  | Circulating Supply | Vesting Cliff | Risk Level | Score |
  |-------------------|---------------|------------|-------|
  | 80-90% | ≥6 months | Low | High |
  | 30-40% | 12 months | Medium | Medium |
  | <20% | <6 months | Very High | Reject |
- **Advanced Value Accrual Mechanisms**:
  - **veLocker (Vote Escrow)**: Long-term token locking for governance power, liquidity sink creation, progressive exit tax
  - **Gauges System**: Emission allocation mechanism, efficient capital distribution

**Layer 3: Technical Traction & Resilience (25%)**
- **Security Audit Requirements**:
  - Minimum: 1 audit from Tier-1 firm (Certik, Hashlock, ConsenSys Diligence, Cyfrin, Hacken)
  - Ideal: 2+ audits from reputable firms
  - Smart contract immutability risk mitigation
- **Developer Activity Metrics**:
  - GitHub activity monitoring (commits, merges)
  - High & consistent development activity indicator
  - Ghost chain risk mitigation
- **User Adoption & Stickiness**:
  - **DAU/MAU Ratio**: Target ≥20% (DeFi/Finance benchmark: 22%)
  - Indicates 6+ days usage per month
  - Organic utility vs token incentive differentiation
  - Product-Market Fit (PMF) validation
- **Quality Adoption Benchmarks**:
  | Metric | Engagement Level | Ideal Benchmark | Pre-Retail Significance |
  |--------|-----------------|-----------------|------------------------|
  | DAU/MAU | Stickiness | 20-22%+ | PMF proven |
  | On-chain Activity | Transaction sustainability | Increasing trend/wallet | Organic growth |
  | GitHub Activity | Project health | Stable & increasing | Active development |

**Layer 4: Strategic Narrative Sectors (10%)**
- **Real World Assets (RWA) - Institutional Alpha**:
  - Market size: $12B+ tokenized assets
  - **ERC-3643 Compliance**: Permissioned token standard for qualified users, TradFi capital gateway
  - TVL growth: $0 → $5M → $70M trajectory analysis
  - Regulatory readiness for institutional adoption
- **DePIN (Decentralized Physical Infrastructure Networks)**:
  - Physical infrastructure utilization metrics
  - **Node Count Growth**: Network provider participation
  - **Bandwidth Utilization**: Actual capacity usage measurement
  - On-chain identity verification for integrity
  - Growth rate: Node count & bandwidth >> price growth = alpha signal

#### Red Flags (Automatic Rejection Criteria)
1. **Documentation Issues**: Poor/absent whitepaper, lack of transparency
2. **Team Credibility**: Unverified team, scam history
3. **Security Gaps**: No smart contract audit from reputable firm
4. **Bad Tokenomics**: Team/VC dominated supply without transparent vesting

#### Implementation Strategy
- **Entry Timing**: "Building phase" with high dev activity, pre-retail hype
- **Risk Mitigation**: Vesting cliff ≥12 months + veLocker mechanisms
- **Sector Focus**: RWA (ERC-3643 compliant) + DePIN (explosive node growth)
- **Validation Signals**: VC Tier-1 backing + Security audits + DAU/MAU ≥20%

#### Technical Implementation Status
✅ **CoinMarketCap Integration Complete** (October 2025):
1. **API Service**: `server/services/coinmarketcap.ts`
   - Rate limiting: 10K/month, 333/day, 30/min (Free tier)
   - Auto-reset daily/monthly counters
   - Credit tracking & usage stats
2. **Alpha Screening Endpoints** (`server/routes/alpha.ts`):
   - `GET /api/alpha/screen/:symbol` - Full 4-layer alpha analysis
   - `GET /api/alpha/micro-caps` - Micro-cap opportunities (<$100M market cap)
   - `GET /api/alpha/new-listings` - Recent listings with tokenomics scoring
   - `GET /api/alpha/market-metrics` - Global crypto market metrics (BTC dominance, DeFi market cap, etc.)
   - `GET /api/alpha/stats` - CMC API usage statistics
3. **Enhanced Listing Scorer** (`server/services/listing-scorer.ts`):
   - Market Cap scoring (10%): Micro-cap premium (<$100M)
   - Tokenomics scoring (10%): Circulating ratio, FDV dilution risk
   - Narrative scoring (5%): RWA, DePIN sector detection
   - Multi-exchange data from 300+ exchanges (Binance, OKX, Coinbase, etc.)
4. **Telegram Integration** (`server/services/telegram-listing-alerts.ts`):
   - Alpha opportunity alerts with market cap, tokenomics, and cross-exchange validation
   - Enhanced formatting with CMC fundamental data

**Pending Implementation**:
- GitHub API for developer activity metrics
- On-chain analytics for DAU/MAU ratio
- Audit database for security verification
- VC backing database for Tier-1 validation

#### Expected Outcomes
- Systematic identification of micro-cap gems before retail discovery
- Multi-dimensional risk assessment (35-30-25-10 framework)
- Alpha generation through market inefficiency exploitation
- Institutional-grade due diligence automation
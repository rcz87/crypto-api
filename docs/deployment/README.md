# 🚀 Crypto API - Enhanced Intelligent Screening System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://typescriptlang.org/)

An institutional-grade perpetual futures trading data gateway supporting 65+ crypto assets with advanced derivatives trading intelligence. Features real-time whale detection, smart money analysis, CVD analysis, and GPT integration with sub-50ms response times and 99.5%+ uptime.

## ✨ Features

### 🐋 Real-Time Market Intelligence
- **Whale Detection**: Track large position movements and institutional activity
- **Smart Money Analysis**: Follow institutional flow patterns and market makers
- **CVD Analysis**: Cumulative Volume Delta with AI-enhanced filtering
- **ETF Flows**: Real-time institutional Bitcoin and Ethereum ETF tracking

### 📊 Advanced Analytics
- **8-Layer SharpSignalEngine**: Institutional-grade signal processing
- **Multi-timeframe Analysis**: 1m to 1W comprehensive market structure
- **Liquidity Heatmaps**: Real-time liquidation and support/resistance levels  
- **Order Flow Analysis**: Deep order book insights and market microstructure

### 🤖 AI Integration
- **GPT Actions**: Complete OpenAI GPT integration for trading insights
- **Neural Network Models**: 25-feature vector analysis with backpropagation
- **Adaptive Learning**: Genetic algorithm-based parameter optimization
- **Confluence Scoring**: AI-enhanced multi-factor analysis

### 📈 Trading Tools
- **TradingView Integration**: Professional charting and technical analysis
- **Risk Management**: Position sizing, stop loss, and take profit automation
- **Fibonacci Analysis**: Automated retracement and extension levels
- **ATR-based Stops**: Volatility-adjusted risk management

## 🏗️ Architecture

### Microservices Design
```
┌─────────────────────────────────────┐
│  Node.js Gateway (Port 5000)        │ ← Public API, WebSocket
│  - Express TypeScript               │
│  - CORS, Auth, Rate Limiting        │
│  - Frontend (React)                 │
└─────────┬───────────────────────────┘
          │ Internal Proxy
          ▼
┌─────────────────────────────────────┐
│  Python Service (Port 8000)         │ ← Internal Only
│  - FastAPI                          │
│  - CoinGlass Integration            │
│  - Heavy Computation, AI/ML         │
└─────────────────────────────────────┘
```

### Frontend Stack
- **React 18** with TypeScript and Vite
- **shadcn/ui** + Tailwind CSS for professional dark-themed UI
- **TanStack Query** for data fetching and caching
- **Radix UI** components for accessibility
- **Lucide React** icons

### Backend Stack
- **Node.js/Express** TypeScript gateway (Port 5000)
- **Python FastAPI** core engine (Port 8000)
- **PostgreSQL** with Drizzle ORM (Neon Database)
- **TimescaleDB** for time-series data
- **Redis** for caching and rate limiting

### Process Management
- **Systemd** services for auto-restart and monitoring
- **Nginx** reverse proxy for SSL/TLS termination
- **Environment-based** configuration (no hardcoded values)

### Data Sources
- **OKX API**: Live pricing and order flow
- **CoinAPI**: 65+ cryptocurrency data and VWAP
- **CoinGlass v4**: Institutional data and whale alerts
- **Multiple Exchanges**: Binance, Bybit, Hyperliquid aggregation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL database
- Redis instance

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/rcz87/crypto-api.git
cd crypto-api
```

2. **Install dependencies**
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies  
pip install -r requirements-dev.txt
```

3. **Environment Setup**
```bash
# Copy environment template
cp .env.example .env

# Configure your API keys and database URLs
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
COINGLASS_API_KEY="your_key"
COINAPI_KEY="your_key"
```

4. **Database Setup**
```bash
# Push database schema
npm run db:push
```

5. **Start the Application**
```bash
# Development mode (starts both Node.js and Python services)
npm run dev
```

The application will be available at `http://localhost:5000`

## 📖 API Documentation

### GPT Actions Endpoint
The system provides a unified GPT-compatible API for institutional trading data:

```bash
POST /gpts/unified/advanced
Content-Type: application/json

{
  "op": "whale_alerts",
  "params": {
    "exchange": "hyperliquid",
    "symbol": "BTC"
  }
}
```

### Supported Operations
- `whale_alerts` - Large position movements and liquidations
- `whale_positions` - Current institutional positions
- `etf_flows` - Bitcoin/Ethereum ETF activity
- `market_sentiment` - AI-powered sentiment analysis
- `market_coins` - 100+ cryptocurrency market data
- `ticker` - Real-time price and volume data
- `liquidation_heatmap` - Liquidation level analysis
- `spot_orderbook` - Order book depth analysis
- `atr` - Average True Range volatility
- `options_oi` - Options open interest

### Response Format
```json
{
  "ok": true,
  "op": "whale_alerts",
  "data": {
    "alerts": [
      {
        "exchange": "hyperliquid",
        "symbol": "BTC",
        "side": "buy",
        "position_size": 25.7,
        "notional_value": 1250000,
        "timestamp": 1695123456789,
        "meta": {
          "confidence": "high",
          "source": "institutional"
        }
      }
    ]
  }
}
```

## 🔧 Configuration

### Core Services
The system runs multiple coordinated services:

1. **Node.js Gateway** (`:5000`) - API routing and frontend
2. **Python Engine** (`:8000`) - Core analytics and data processing
3. **PostgreSQL** - Primary data storage
4. **Redis** - Caching and session management

### Performance Tuning
- **Response Times**: Target <50ms average
- **Uptime**: 99.5%+ availability
- **Rate Limiting**: Adaptive throttling
- **Circuit Breakers**: Auto-failover protection
- **WebSocket**: Auto-reconnection for real-time data

## 📊 Monitoring

### Health Checks
```bash
# System health status
GET /gpts/health

# Service diagnostics  
GET /api/status
```

### Metrics
- Real-time performance monitoring
- Prometheus-compatible metrics export
- Grafana dashboard templates included
- Alert system for critical issues

## 🧪 Testing

```bash
# Run full test suite
npm test

# Python backend tests
cd coinglass-system && python -m pytest

# API integration tests
npm run test:api
```

## 📁 Project Structure

```
crypto-api/
├── client/                 # React frontend
├── server/                 # Node.js gateway
├── coinglass-system/      # Python FastAPI engine
├── shared/                # Shared types and schemas
├── public/                # Static assets
├── scripts/               # Deployment and utility scripts
└── docs/                  # API documentation
```

## 🔐 Security

- Environment-based secret management
- Rate limiting and DDoS protection
- Input validation and sanitization
- SQL injection prevention
- CORS configuration
- API key authentication

## 🚢 Deployment

### VPS Deployment (Recommended for Production)

This application is **optimized for VPS deployment** (tested on Hostinger VPS).

#### Quick Deploy
```bash
# Automated deployment with health checks
./deploy-vps-quick.sh
```

#### Manual VPS Setup
```bash
# Initial setup
./deploy-to-vps.sh

# Or follow comprehensive guide
# See REPLIT_TO_VPS_MIGRATION.md for detailed instructions
```

**VPS Documentation:**
- 📖 [VPS Deployment Guide](./VPS-DEPLOYMENT-GUIDE.md) - Complete VPS setup
- 📖 [Replit to VPS Migration](./REPLIT_TO_VPS_MIGRATION.md) - Migration guide
- 📖 [Cleanup Summary](./REPLIT_CLEANUP_SUMMARY.md) - Recent optimizations

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Environment Variables
See `.env.example` for required configuration variables.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/rcz87/crypto-api/issues)
- **Documentation**: [API Docs](./docs/)
- **Email**: [Support Contact](mailto:your-email@domain.com)

## 🎯 Roadmap

- [ ] Mobile application development
- [ ] Advanced ML model integration
- [ ] Multi-language support
- [ ] Enhanced TradingView integration
- [ ] Automated trading execution
- [ ] Portfolio management tools

---

**Built for institutional traders and sophisticated retail investors who demand professional-grade crypto market intelligence.**
# CoinGlass Full System

Sistem perdagangan kripto lengkap dengan data real-time dari CoinGlass API, WebSocket feeds, dan analytics tingkat institusional.

## Fitur Utama

- **Data Real-time**: Streaming liquidations, funding rates, dan open interest
- **Heatmap Analytics**: Visualisasi liquidation heatmaps dengan TimescaleDB
- **Signal Generation**: Deteksi otomatis untuk liquidation cascades dan anomali funding
- **Telegram Alerts**: Notifikasi otomatis untuk signal penting
- **Monitoring**: Dashboard Grafana dengan metrics Prometheus
- **WebSocket Feeds**: Koneksi real-time ke feeds CoinGlass

## Quick Start

1. **Setup Environment**
   ```bash
   cp .env.example .env
   # Edit .env dan isi CG_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
   ```

2. **Start dengan Docker**
   ```bash
   docker compose up -d --build
   ```

3. **Akses Services**
   - API: http://localhost:8080/health/live
   - Heatmap: http://localhost:8080/heatmap/BTC
   - Metrics: http://localhost:8080/metrics
   - Grafana: http://localhost:3000

## API Endpoints

### Health Checks
- `GET /health/live` - Basic health check
- `GET /health/ready` - Dependency health check

### Data Endpoints
- `GET /replay/oi/{symbol}` - Open Interest data
- `GET /heatmap/{symbol}` - Liquidation heatmap tiles

### Metrics
- `GET /metrics` - Prometheus metrics

## Configuration

Konfigurasi melalui environment variables di `.env`:

```ini
# API Keys
CG_API_KEY=your_coinglass_api_key

# Database
DB_URL=postgresql://postgres:postgres@postgres:5432/trading
REDIS_URL=redis://redis:6379/0

# Telegram Alerts
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Trading Configuration
SYMBOLS=BTC,ETH,SOL
EXCHANGES=Binance,OKX,Bybit
FETCH_INTERVAL_SECONDS=30
WS_RECONNECT_SECONDS=5
API_PORT=8080
ENV=prod
```

## Architecture

### Services
- **app**: FastAPI application dengan scheduler dan workers
- **postgres**: TimescaleDB untuk time-series data
- **redis**: Cache dan message queue
- **prometheus**: Metrics collection
- **grafana**: Dashboard dan visualisasi

### Data Flow
1. **REST Fetching**: Worker mengambil data historical dari CoinGlass API
2. **WebSocket Streaming**: Real-time feeds untuk liquidations dan funding
3. **Data Processing**: Workers memproses dan menyimpan data ke TimescaleDB
4. **Heatmap Building**: Agregasi data liquidation menjadi heatmap tiles
5. **Signal Generation**: Deteksi pattern dan anomali untuk alerts
6. **Telegram Alerts**: Notifikasi untuk signal high-severity

### Database Schema
- `futures_oi_ohlc`: Open Interest OHLC data
- `funding_rate`: Funding rate per exchange
- `liquidations`: Liquidation events dengan metadata
- `liquidation_heatmap`: Agregated heatmap data
- `composite_heatmap`: Multi-factor heatmap scoring
- `alert_history`: System alerts and notifications (including whale alerts)

### Whale Data Handling
**Important**: Whale data (large positions >$1M) is designed for real-time alerting, not historical persistence:

- **Whale Alerts**: Fetched from CoinGlass whale endpoints and processed in real-time
- **Alert Generation**: Significant positions (>$1M notional) trigger system alerts
- **Storage Strategy**: Stored as alerts in `alert_history` table, not as separate whale entities
- **Data Retention**: Alerts are retained based on alert retention policy, not as historical whale data
- **API Access**: Live whale data available via `/advanced/whale/alerts` and `/advanced/whale/positions` endpoints
- **Exchange Support**: Supports multiple exchanges via parameterized API calls (default: hyperliquid)

This design optimizes for alerting efficiency while avoiding unnecessary historical data accumulation.

## Development

### Running Tests
```bash
pytest
```

### Code Quality
```bash
ruff check .
```

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run application
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

## Monitoring

### Grafana Dashboard
Dashboard mencakup:
- API request rates
- Response time percentiles
- WebSocket connection counts
- Data processing rates

### Custom Metrics
- `api_requests_total`: Total API requests by endpoint
- `api_response_time_seconds`: Response time histogram
- `websocket_connections_active`: Active WebSocket connections
- `data_points_processed_total`: Data points processed by source

## Deployment

### Production Setup
1. Siapkan environment variables production
2. Scale services sesuai kebutuhan
3. Setup backup untuk PostgreSQL
4. Configure monitoring alerts

### Docker Scaling
```bash
# Scale workers
docker compose up -d --scale app=3

# Monitor logs
docker compose logs -f app
```

## Troubleshooting

### Common Issues

1. **API Rate Limits**: Adjust `FETCH_INTERVAL_SECONDS` untuk mengurangi rate
2. **WebSocket Disconnects**: Monitor `WS_RECONNECT_SECONDS` setting
3. **Database Connection**: Pastikan PostgreSQL service running
4. **Redis Connection**: Check Redis service dan connection string

### Logs
```bash
# Application logs
docker compose logs app

# Database logs
docker compose logs postgres

# All services
docker compose logs
```

## Integration dengan Sistem Utama

Sistem ini dirancang sebagai modul independen yang dapat diintegrasikan dengan platform trading utama melalui:

1. **API Integration**: Consume endpoints untuk data dan signals
2. **Database Sharing**: Share TimescaleDB instance
3. **Message Queue**: Integrasi melalui Redis channels
4. **Grafana Dashboards**: Merge dengan monitoring utama
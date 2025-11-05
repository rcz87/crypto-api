# Crypto Data Gateway - Deployment Guide

## Quick Start dengan Docker

### 1. Setup Environment
```bash
# Clone atau copy semua file ke VPS
# Buat file .env dari template
cp .env.example .env

# Edit file .env dengan API keys OKX Anda:
nano .env
```

### 2. Deploy dengan Docker Compose
```bash
# Build dan jalankan
docker-compose up -d

# Cek status
docker-compose logs -f crypto-gateway
```

### 3. Manual Install (tanpa Docker)

#### Persyaratan:
- Node.js 20+
- npm atau yarn

#### Langkah-langkah:
```bash
# Install dependencies
npm install

# Build aplikasi
npm run build

# Set environment variables
export OKX_API_KEY="your_api_key"
export OKX_SECRET_KEY="your_secret_key"
export OKX_PASSPHRASE="your_passphrase"
export NODE_ENV="production"
export PORT="5000"

# Jalankan aplikasi
npm start
```

### 4. Nginx Configuration (opsional)

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name your-domain.com;

    # SSL configuration (gunakan certbot)
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## API Endpoints

### Primary Endpoint untuk GPT 5:
- **URL**: `https://your-domain.com/api/sol/complete`
- **Method**: GET
- **Response**: JSON dengan data SOL lengkap

### WebSocket:
- **URL**: `wss://your-domain.com/ws`
- **Real-time**: Data ticker, order book, trades

### Monitoring:
- **Health**: `https://your-domain.com/health`
- **Metrics**: `https://your-domain.com/api/metrics`
- **Logs**: `https://your-domain.com/api/logs`

## Features Terintegrasi:

✅ **Real-time SOL Trading Data**
- Ticker (price, volume, 24h change)
- Order book dengan bid/ask
- Recent trades
- Candlestick data (1H, 4H, 1D)

✅ **WebSocket Streaming**
- Live updates dari OKX
- Auto-reconnect
- Client broadcast

✅ **System Monitoring**
- Health checks
- Performance metrics
- Request logs
- Rate limiting

✅ **Production Ready**
- Error handling
- CORS support
- SSL ready
- Docker deployment
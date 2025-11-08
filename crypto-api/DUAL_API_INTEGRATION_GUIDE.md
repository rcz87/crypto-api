# 🚀 Dual Crypto API Integration Guide

## 📋 Overview

Repository ini sekarang memiliki **2 Crypto API yang terpisah** dengan fungsi dan konfigurasi yang berbeda:

1. **Main API** (Port 8501) - Liquidation Heatmap System
2. **Guardians API** (Port 8502) - Premium Orderbook Analytics

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Main API      │    │ Guardians API   │
│   Port 8501     │    │   Port 8502     │
│                 │    │                 │
│ • Liquidation   │    │ • Orderbook     │
│ • Heatmap       │    │ • VIP Features  │
│ • Social Intel  │    │ • Institutional │
│ • Multi-Exchange│    │ • Advanced      │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
          ┌─────────────────┐
          │  GPT Gateway    │
          │   Port 3000     │
          │                 │
          │ • AI Analysis   │
          │ • Intelligence  │
          │ • Processing    │
          └─────────────────┘
```

## 🔧 Quick Start

### 1. Environment Setup

```bash
# Load environment for Main API
source env_main_api.sh

# Load environment for Guardians API
source env_guardians_api.sh
```

### 2. Run APIs Individually

```bash
# Start Main API (Liquidation Heatmap)
python run_main_api.py

# Start Guardians API (Premium Analytics)
python run_guardians_api.py
```

### 3. Run with Docker

```bash
# Build and run both APIs
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Test Both APIs

```bash
# Run comprehensive test suite
python test_apis.py
```

## 📊 API Comparison

| Feature | Main API (8501) | Guardians API (8502) |
|---------|-----------------|----------------------|
| **Primary Focus** | Liquidation Analysis | Orderbook Analytics |
| **Data Sources** | Binance, OKX, Bybit | GuardiansOfTheToken |
| **Update Frequency** | 5000ms | 100ms (VIP) |
| **Social Intelligence** | ✅ | ❌ |
| **VIP Features** | ❌ | ✅ |
| **Institutional Data** | ❌ | ✅ |
| **Wall Detection** | ❌ | ✅ |
| **Spoofing Detection** | ❌ | ✅ |
| **Multi-Exchange** | ✅ | ❌ |

## 🌐 Access Points

### Main API - Liquidation Heatmap System
- **Local:** http://localhost:8501
- **Health:** http://localhost:8501/_stcore/health
- **Features:**
  - Liquidation heatmap visualization
  - Multi-exchange aggregation
  - Social sentiment analysis
  - GPT assistant integration

### Guardians API - Premium Analytics
- **Local:** http://localhost:8502
- **Health:** http://localhost:8502/_stcore/health
- **Features:**
  - Premium orderbook analysis
  - VIP institutional features
  - Advanced pattern detection
  - Real-time wall detection

### GPT Gateway (Shared)
- **Local:** http://localhost:3000
- **Health:** http://localhost:3000/gpts/health
- **Purpose:** AI intelligence for both APIs

## 🔒 Security Configuration

### Environment Variables

```bash
# Main API Security
export RATE_LIMIT_REQUESTS_PER_MINUTE="100"
export API_KEY_VALIDATION=true

# Guardians API Security (Higher limits for VIP)
export RATE_LIMIT_REQUESTS_PER_MINUTE="500"
export INSTITUTIONAL_AUTH_ENABLED=true
```

### SSL Configuration

```bash
# Enable SSL for production
export SSL_ENABLED=true
export SSL_CERT_PATH="/path/to/cert.pem"
export SSL_KEY_PATH="/path/to/key.pem"
```

## 📁 File Structure

```
crypto-api/
├── 📄 README_MAIN_API.md              # Main API documentation
├── 📄 README_GUARDIANS_API.md         # Guardians API documentation
├── 📄 DUAL_API_INTEGRATION_GUIDE.md   # This file
├── 🚀 run_main_api.py                 # Main API launcher
├── 🌟 run_guardians_api.py            # Guardians API launcher
├── 🔧 env_main_api.sh                  # Main API environment
├── 🔧 env_guardians_api.sh            # Guardians API environment
├── 🐳 Dockerfile.main                  # Main API Docker
├── 🐳 Dockerfile.guardians             # Guardians API Docker
├── 🐳 docker-compose.yml              # Both APIs together
├── 🧪 test_apis.py                    # Test suite
├── 📊 app.py                          # Main API application
├── 📊 app.py (Guardians)              # Guardians API application
├── 📁 services/                       # Shared services
│   ├── guardiansofthetoken_api.py    # Guardians API client
│   ├── coinglass/                     # Coinglass integration
│   └── coinapi_service.py            # CoinAPI service
├── 📁 utils/                          # Utilities
│   └── guardians_visualizer.py       # Guardians visualization
└── 📁 public/                         # Public files
    └── openapi-4.0.1-gpts-compat.yaml # OpenAPI schema
```

## 🔄 Deployment Options

### Option 1: Individual Deployment

```bash
# Terminal 1 - Main API
source env_main_api.sh
python run_main_api.py

# Terminal 2 - Guardians API
source env_guardians_api.sh
python run_guardians_api.py

# Terminal 3 - GPT Gateway (if needed)
cd ../server && npm start
```

### Option 2: Docker Compose

```bash
# Start all services
docker-compose up -d

# Monitor logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 3: Production with Systemd

```bash
# Install services
sudo cp *.service /etc/systemd/system/
sudo systemctl daemon-reload

# Start services
sudo systemctl start crypto-main-api
sudo systemctl start crypto-guardians-api
sudo systemctl enable crypto-main-api
sudo systemctl enable crypto-guardians-api
```

## 🧪 Testing & Validation

### Health Checks

```bash
# Check Main API
curl http://localhost:8501/_stcore/health

# Check Guardians API
curl http://localhost:8502/_stcore/health

# Check GPT Gateway
curl http://localhost:3000/gpts/health
```

### Comprehensive Testing

```bash
# Run full test suite
python test_apis.py

# Test specific API
curl -X GET http://localhost:8501/api/liquidations
curl -X GET http://localhost:8502/api/guardians/config
```

### Performance Testing

```bash
# Load test Main API
ab -n 1000 -c 10 http://localhost:8501/_stcore/health

# Load test Guardians API
ab -n 1000 -c 10 http://localhost:8502/_stcore/health
```

## 🔧 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using ports
   lsof -i :8501
   lsof -i :8502
   lsof -i :3000
   ```

2. **Environment Issues**
   ```bash
   # Verify environment loading
   source env_main_api.sh && env | grep API_
   source env_guardians_api.sh && env | grep GUARDIANS_
   ```

3. **Docker Issues**
   ```bash
   # Rebuild containers
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

4. **GPT Gateway Connection**
   ```bash
   # Test connection manually
   curl http://localhost:3000/gpts/health
   ```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=true
export GUARDIANS_DEBUG=true

# Run with verbose output
python run_main_api.py --debug
python run_guardians_api.py --debug
```

## 📈 Monitoring

### Health Monitoring

```bash
# Check all services
python test_apis.py

# Monitor logs
tail -f logs/main_api.log
tail -f logs/guardians_api.log
```

### Performance Metrics

```bash
# Check response times
curl -w "@curl-format.txt" http://localhost:8501/_stcore/health
curl -w "@curl-format.txt" http://localhost:8502/_stcore/health
```

## 🚀 Production Best Practices

### 1. Environment Separation
- Use separate environment files
- Different Redis databases
- Separate log files

### 2. Security
- Enable rate limiting
- Use API key authentication
- Implement SSL/TLS

### 3. Performance
- Enable Redis caching
- Use connection pooling
- Monitor resource usage

### 4. Reliability
- Implement health checks
- Use automatic restarts
- Monitor error rates

## 📞 Support

### Documentation
- Main API: `README_MAIN_API.md`
- Guardians API: `README_GUARDIANS_API.md`
- Integration: `DUAL_API_INTEGRATION_GUIDE.md`

### Testing
- Test Suite: `test_apis.py`
- Individual Tests: `test_*.py`

### Configuration
- Main API: `env_main_api.sh`
- Guardians API: `env_guardians_api.sh`
- Docker: `docker-compose.yml`

---

## 🎯 Summary

Repository ini sekarang memiliki **2 Crypto API yang terpisah dan independen**:

1. **Main API (8501)** - Fokus pada liquidation heatmap dan multi-exchange aggregation
2. **Guardians API (8502)** - Fokus pada premium orderbook analytics dan VIP features

Kedua API dapat berjalan secara bersamaan tanpa konflik, dengan environment yang terpisah, dan dapat di-deploy secara independen atau bersama-sama menggunakan Docker Compose.

**Last Updated:** 2025-11-08  
**Version:** 2.0.0  
**Status:** ✅ Production Ready

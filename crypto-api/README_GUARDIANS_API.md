# 🌟 GuardiansOfTheToken API - Premium Analytics

## 📋 Overview

**Port:** 8502  
**Type:** Streamlit Web Application  
**Purpose:** Premium Orderbook Analysis with Institutional Data

## 🎯 Key Features

### 📚 Premium Orderbook Analysis
- Real-time orderbook depth analysis
- Multi-level order flow visualization
- Advanced price impact calculations
- Liquidity assessment tools

### 🏢 Institutional Intelligence
- Buy/Sell wall detection
- Spoofing pattern identification
- Iceberg order detection
- Hidden order analysis

### 🌟 VIP Features
- High-frequency data updates (100ms)
- Advanced pattern recognition
- Institutional-grade analytics
- Custom alert systems

### 🤖 GPT Gateway Integration
- AI-powered market analysis
- Advanced intelligence operations
- Whale alerts and sentiment analysis
- Multi-coin screening capabilities

## 🚀 Quick Start

### Prerequisites
```bash
pip install -r requirements.txt
```

### Configuration Setup
```bash
# Set Guardians API credentials
export GUARDIANS_ENABLED=true
export GUARDIANS_API_KEY="your_api_key_here"
export GUARDIANS_VIP_TIER="premium"  # or "enterprise"
```

### Launch the API
```bash
# Method 1: Using the launcher script
python run_guardians_api.py

# Method 2: Direct Streamlit
streamlit run app.py --server.port 8502
```

### Access
- **Local:** http://localhost:8502
- **Network:** http://YOUR_IP:8502

## 🔧 Configuration

### Environment Variables
```bash
export API_TYPE=guardians
export API_NAME="GuardiansOfTheToken Premium Analytics"
export API_PORT=8502
export API_DESCRIPTION="Premium Orderbook Analysis with Institutional Data"

# GuardiansOfTheToken Configuration
export GUARDIANS_ENABLED=true
export GUARDIANS_API_KEY="your_api_key"
export GUARDIANS_VIP_TIER="premium"
export GUARDIANS_UPDATE_FREQUENCY=100  # milliseconds
```

### Required Services
- **GuardiansOfTheToken API:** Premium data source
- **GPT Gateway:** AI intelligence (port 3000)
- **Redis:** Caching layer (optional)

## 📁 Project Structure

```
./
├── app.py                           # Main Guardians application
├── config_guardians.py             # Configuration management
├── services/
│   ├── guardiansofthetoken_api.py  # API client
│   └── coinglass/                  # Additional data sources
├── utils/
│   └── guardians_visualizer.py    # Visualization utilities
├── requirements.txt
└── run_guardians_api.py           # Launcher script
```

## 🔌 API Endpoints

### GuardiansOfTheToken Integration
- **Premium Orderbook:** Real-time orderbook data
- **Market Metrics:** Advanced market statistics
- **Institutional Data:** Wall detection, spoofing alerts
- **VIP Features:** High-frequency updates

### GPT Gateway Operations
- **Whale Alerts:** Large transaction detection
- **Market Sentiment:** AI-powered sentiment analysis
- **Volume Spikes:** Anomaly detection
- **Multi-Coin Screening:** Parallel analysis
- **Alpha Screening:** Advanced opportunity detection

## 🛠️ Troubleshooting

### Common Issues

1. **Guardians API Connection**
   ```bash
   # Check API key validity
   python -c "from config_guardians import validate_guardians_config; print(validate_guardians_config())"
   
   # Test API connection
   python test_guardians_integration.py
   ```

2. **Port Already in Use**
   ```bash
   # Check what's using port 8502
   lsof -i :8502
   
   # Kill the process
   kill -9 <PID>
   ```

3. **VIP Features Not Working**
   ```bash
   # Verify VIP tier configuration
   python -c "from config_guardians import get_vip_features; print(get_vip_features())"
   ```

4. **GPT Gateway Connection**
   ```bash
   # Check GPT Gateway status
   curl http://localhost:3000/gpts/health
   ```

### Debug Mode
Enable debug logging:
```bash
export DEBUG=true
export GUARDIANS_DEBUG=true
```

## 🔒 Security Considerations

- Store API keys in environment variables
- Use HTTPS in production
- Implement rate limiting
- Monitor API usage and costs
- Regular key rotation

## 📊 Performance

### Resource Requirements
- **Memory:** 4GB minimum (8GB recommended)
- **CPU:** 4 cores minimum
- **Network:** Low-latency connection required
- **Storage:** SSD for caching

### Optimization Tips
- Enable Redis caching for frequent queries
- Use WebSocket connections for real-time data
- Monitor API rate limits carefully
- Implement data compression for large datasets

## 🔄 VIP Features

### Premium Tiers
- **Standard:** Basic orderbook analysis
- **Premium:** Advanced institutional features
- **Enterprise:** Custom algorithms and support

### Feature Comparison

| Feature | Standard | Premium | Enterprise |
|---------|----------|---------|------------|
| Update Frequency | 1000ms | 100ms | 50ms |
| Orderbook Depth | 50 levels | 100 levels | 200 levels |
| Wall Detection | ❌ | ✅ | ✅ |
| Spoofing Detection | ❌ | ✅ | ✅ |
| Custom Alerts | ❌ | ✅ | ✅ |
| API Support | ❌ | ✅ | ✅ |

## 🚀 Production Deployment

### Docker Support
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8502
CMD ["streamlit", "run", "app.py", "--server.port", "8502"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  guardians-api:
    build: .
    ports:
      - "8502:8502"
    environment:
      - GUARDIANS_ENABLED=true
      - GUARDIANS_API_KEY=${GUARDIANS_API_KEY}
      - GUARDIANS_VIP_TIER=premium
    depends_on:
      - redis
      - gpt-gateway
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
  
  gpt-gateway:
    image: gpt-gateway:latest
    ports:
      - "3000:3000"
```

### Systemd Service
```ini
[Unit]
Description=GuardiansOfTheToken API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/root/crypto-api/crypto-api
ExecStart=/usr/bin/python3 /root/crypto-api/crypto-api/run_guardians_api.py
Restart=always
Environment=GUARDIANS_ENABLED=true
Environment=GUARDIANS_API_KEY=your_api_key
Environment=GUARDIANS_VIP_TIER=premium

[Install]
WantedBy=multi-user.target
```

## 📈 Monitoring & Analytics

### Key Metrics
- API response times
- Data update frequency
- Memory usage patterns
- Error rates
- VIP feature usage

### Health Checks
```bash
# Application health
curl http://localhost:8502/_stcore/health

# Guardians API status
python -c "from services.guardiansofthetoken_api import GuardiansOfTheTokenAPI; print('API OK')"

# GPT Gateway status
curl http://localhost:3000/gpts/health
```

## 🔧 Advanced Configuration

### Custom Alert Settings
```python
# In config_guardians.py
GUARDIANS_CONFIG = {
    'alerts': {
        'enabled': True,
        'buy_wall_threshold': 1000000,  # $1M
        'sell_wall_threshold': 1000000,
        'imbalance_alert': 0.7,  # 70% imbalance
        'liquidity_alert': 0.3   # 30% liquidity drop
    }
}
```

### Performance Tuning
```python
# VIP performance settings
VIP_CONFIG = {
    'update_frequency_ms': 100,
    'max_depth_levels': 100,
    'cache_ttl_seconds': 30,
    'batch_size': 50
}
```

## 📞 Support

### Technical Support
- **Documentation:** Check this README first
- **Logs:** Monitor application logs for errors
- **Health Checks:** Run regular health checks
- **Performance:** Monitor resource usage

### GuardiansOfTheToken Support
- **API Documentation:** Available in their portal
- **Support Team:** Contact through their dashboard
- **Status Page:** Check for service outages

---

**Last Updated:** 2025-11-08  
**Version:** 2.0.0  
**Maintainer:** Crypto API Team  
**API Tier:** Premium/Enterprise

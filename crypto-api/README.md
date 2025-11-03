# 🌟 GuardiansOfTheToken Premium Crypto Analytics

A comprehensive cryptocurrency analytics platform integrating GuardiansOfTheToken.com VIP 8 premium orderbook data with advanced institutional analysis, pattern detection, and real-time market insights.

## 🚀 Features

### VIP 8 Premium Access
- **10ms Update Frequency**: Real-time orderbook updates
- **500 Depth Levels**: Deep market visibility
- **Advanced Pattern Detection**: Buy/sell walls, spoofing, iceberg orders
- **Institutional Analysis**: Hidden order flow, imbalance detection
- **Risk Assessment**: Market quality scoring and volatility analysis

### Key Components
- **📚 Premium Orderbook Analysis**: Deep orderbook visualization with institutional insights
- **🏢 Institutional Data**: Advanced pattern recognition and market manipulation detection
- **🌟 VIP Dashboard**: Comprehensive VIP features overview
- **📊 Market Overview**: Multi-symbol comparison and analysis
- **🔍 Real-time Alerts**: Configurable alerts for market events

## 📋 Prerequisites

- Python 3.8+
- GuardiansOfTheToken.com VIP 8 API key
- Redis (for caching)
- PostgreSQL (optional, for data persistence)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd crypto-api
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Configuration
Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Enable GuardiansOfTheToken integration
GUARDIANS_ENABLED=true

# API Configuration
GUARDIANS_API_KEY=your_vip_8_api_key_here
GUARDIANS_VIP_TIER=8
GUARDIANS_API_URL=https://api.guardiansofthetoken.com

# Additional configuration options...
```

## 🎯 Quick Start

### 1. Run the Application
```bash
streamlit run app.py
```

### 2. Access the Dashboard
Open your browser and navigate to `http://localhost:8501`

### 3. Configure API Key
- Click on the sidebar controls
- Ensure GuardiansOfTheToken integration is enabled
- Refresh data to start receiving premium orderbook data

## 📊 Usage Guide

### Main Features

#### 📚 Orderbook Analysis
- Real-time orderbook depth visualization
- Bid/ask spread analysis
- Volume imbalance detection
- Price level analysis

#### 🏢 Institutional Analysis
- Buy/sell wall detection
- Hidden order identification
- Spoofing zone detection
- Iceberg order analysis

#### 🌟 VIP Dashboard
- VIP tier status and features
- Update frequency monitoring
- Market quality scoring
- Risk level assessment

#### 📊 Market Overview
- Multi-symbol comparison
- Liquidity analysis
- Market depth comparison
- Real-time metrics

### Configuration Options

#### VIP Tiers
| Tier | Update Frequency | Max Depth | Advanced Detection |
|------|------------------|------------|-------------------|
| 1-4  | 100ms           | 50         | ❌                |
| 5-7  | 50ms            | 200        | ✅                |
| 8-10 | 10ms            | 500        | ✅                |

#### Alert Thresholds
- **Buy Wall Alert**: $5M default
- **Sell Wall Alert**: $5M default
- **Imbalance Alert**: 2.0 ratio
- **Liquidity Alert**: 30.0 score

## 🧪 Testing

### Run Integration Tests
```bash
python test_guardians_integration.py
```

### Test Categories
1. **Configuration Validation**: Verify settings and API credentials
2. **API Connection**: Test connectivity and authentication
3. **Orderbook Data**: Validate data quality and completeness
4. **Market Metrics**: Test institutional analysis features
5. **VIP Features**: Verify high-frequency updates and depth levels
6. **Performance**: Test response times and concurrent requests
7. **Visualization**: Validate chart generation

## 📁 Project Structure

```
crypto-api/
├── app.py                          # Main Streamlit application
├── config_guardians.py             # GuardiansOfTheToken configuration
├── requirements.txt                # Python dependencies
├── test_guardians_integration.py   # Integration test suite
├── GUARDIANS_INTEGRATION_GUIDE.md  # Comprehensive integration guide
├── README.md                       # This file
├── services/
│   └── guardiansofthetoken_api.py  # Core API service and data models
└── utils/
    └── guardians_visualizer.py     # Advanced visualization components
```

## 🔧 Configuration

### Environment Variables

#### Core Settings
- `GUARDIANS_ENABLED`: Enable/disable integration (true/false)
- `GUARDIANS_API_KEY`: Your VIP 8 API key
- `GUARDIANS_VIP_TIER`: VIP tier level (1-10)
- `GUARDIANS_API_URL`: API endpoint URL

#### Data Processing
- `GUARDIANS_MAX_HISTORY`: Maximum history entries (default: 1000)
- `GUARDIANS_TREND_WINDOW`: Trend analysis window (default: 10)
- `GUARDIANS_IMBALANCE_THRESHOLD`: Imbalance alert threshold (default: 1.5)
- `GUARDIANS_LIQUIDITY_THRESHOLD`: Liquidity alert threshold (default: 50.0)

#### Alerts
- `GUARDIANS_ALERTS_ENABLED`: Enable alerts (true/false)
- `GUARDIANS_BUY_WALL_THRESHOLD`: Buy wall detection threshold
- `GUARDIANS_SELL_WALL_THRESHOLD`: Sell wall detection threshold
- `GUARDIANS_SPOOFING_ALERTS`: Enable spoofing alerts (true/false)
- `GUARDIANS_ICEBERG_ALERTS`: Enable iceberg alerts (true/false)

#### Performance
- `GUARDIANS_UPDATE_INTERVAL`: Data refresh interval (seconds)
- `GUARDIANS_CONCURRENT_REQUESTS`: Max concurrent requests
- `GUARDIANS_RATE_LIMIT_DELAY`: Delay between requests (seconds)

## 📈 Performance Metrics

### Response Time Targets
- **VIP 8**: ≤10ms for orderbook updates
- **VIP 5-7**: ≤50ms for orderbook updates
- **VIP 1-4**: ≤100ms for orderbook updates

### Data Quality Metrics
- **Success Rate**: Should be ≥95%
- **Data Freshness**: Updates should be ≤100ms old
- **Quality Score**: Should be ≥80/100
- **Error Rate**: Should be ≤5%

## 🚨 Troubleshooting

### Common Issues

#### Authentication Failed
- Verify API key validity
- Check VIP tier access
- Ensure `GUARDIANS_ENABLED=true`

#### Slow Response Times
- Check network connectivity
- Verify VIP tier limits
- Reduce concurrent requests

#### Missing Data
- Check symbol availability
- Verify API permissions
- Check rate limits

#### Visualization Errors
- Ensure data quality
- Check Plotly version
- Verify data format

### Debug Mode
Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Health Check
```python
async def health_check():
    api = GuardiansOfTheTokenAPI()
    async with api:
        orderbook = await api.get_premium_orderbook("SOLUSDT", depth=1)
        return orderbook is not None
```

## 🔒 Security Considerations

- Store API keys securely using environment variables
- Rotate API keys regularly
- Use HTTPS for all API communications
- Implement rate limiting to prevent abuse
- Monitor for unusual API usage patterns

## 📞 Support

### For Issues Related To:
- **API Access**: Contact GuardiansOfTheToken support
- **Integration**: Check this guide and test suite
- **Performance**: Monitor metrics and adjust configuration
- **Data Quality**: Run validation tests and check alerts

### Documentation
- [GUARDIANS_INTEGRATION_GUIDE.md](GUARDIANS_INTEGRATION_GUIDE.md) - Comprehensive integration guide
- [test_guardians_integration.py](test_guardians_integration.py) - Test suite with examples

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📊 Version History

- **v1.0.0**: Initial VIP 8 integration
- **v1.1.0**: Added advanced visualization
- **v1.2.0**: Enhanced error handling and retry logic
- **v1.3.0**: Performance optimizations and caching

---

**Last updated**: October 30, 2025  
**VIP Tier**: 8  
**Integration Status**: Production Ready  
**API Version**: GuardiansOfTheToken.com Premium

---

⚡ **Powered by GuardiansOfTheToken.com VIP 8**  
🌟 **Premium Orderbook Analytics & Institutional Insights**

# 🚀 Main Crypto API - Liquidation Heatmap System

## 📋 Overview

**Port:** 8501  
**Type:** Streamlit Web Application  
**Purpose:** Cryptocurrency Liquidation Heatmap with Multi-Exchange Aggregation

## 🎯 Key Features

### 📊 Liquidation Analysis
- Real-time liquidation monitoring across multiple exchanges
- Binance, OKX, Bybit integration
- Pump detection algorithms
- Leverage analysis

### 🧠 Social Intelligence
- LunarCrush social sentiment integration
- Social media trend analysis
- Market sentiment indicators

### 🤖 GPT Personal Assistant
- AI-powered trading insights
- Natural language queries
- Market analysis recommendations

### 📈 Advanced Visualizations
- Interactive heatmaps
- Real-time charts
- Multi-timeframe analysis

## 🚀 Quick Start

### Prerequisites
```bash
pip install -r requirements.txt
```

### Launch the API
```bash
# Method 1: Using the launcher script
python run_main_api.py

# Method 2: Direct Streamlit
streamlit run ../app.py --server.port 8501
```

### Access
- **Local:** http://localhost:8501
- **Network:** http://YOUR_IP:8501

## 🔧 Configuration

### Environment Variables
```bash
export API_TYPE=main
export API_NAME="Liquidation Heatmap System"
export API_PORT=8501
export API_DESCRIPTION="Cryptocurrency Liquidation Heatmap with Multi-Exchange Aggregation"
```

### Required Services
- **Binance API:** For liquidation data
- **OKX API:** For additional exchange data
- **Bybit API:** For comprehensive coverage
- **LunarCrush API:** For social intelligence
- **GPT Gateway:** For AI assistance (port 3000)

## 📁 Project Structure

```
../
├── app.py                    # Main application file
├── services/
│   ├── lunarcrush/
│   │   └── lunarcrush_api.py
│   └── gpt_service.py
├── requirements.txt
└── run_main_api.py          # Launcher script
```

## 🔌 API Endpoints

### Internal Services
- **LunarCrush Service:** Social sentiment data
- **GPT Service:** AI-powered insights
- **Exchange Connectors:** Real-time liquidation data

### External Dependencies
- **GPT Gateway:** http://localhost:3000
- **Exchange APIs:** Binance, OKX, Bybit

## 🛠️ Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using port 8501
   lsof -i :8501
   
   # Kill the process
   kill -9 <PID>
   ```

2. **Missing Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **API Connection Issues**
   - Verify GPT Gateway is running on port 3000
   - Check exchange API credentials
   - Ensure network connectivity

### Logs
- **Application Logs:** Check Streamlit console output
- **Error Logs:** Monitor terminal for error messages

## 🔒 Security Considerations

- API keys should be stored in environment variables
- Use HTTPS in production
- Implement rate limiting
- Monitor for unusual activity

## 📊 Performance

### Resource Requirements
- **Memory:** 2GB minimum
- **CPU:** 2 cores minimum
- **Network:** Stable internet connection

### Optimization Tips
- Use WebSocket connections for real-time data
- Implement caching for frequently accessed data
- Monitor memory usage with large datasets

## 🔄 Updates & Maintenance

### Regular Tasks
- Update exchange API credentials
- Monitor API rate limits
- Update dependencies regularly
- Backup configuration files

### Version Control
- Track changes in Git
- Use semantic versioning
- Document breaking changes

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review application logs
3. Verify all services are running
4. Check network connectivity

## 🚀 Production Deployment

### Docker Support
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8501
CMD ["streamlit", "run", "../app.py", "--server.port", "8501"]
```

### Systemd Service
Create a systemd service for automatic startup:
```ini
[Unit]
Description=Main Crypto API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/root/crypto-api
ExecStart=/usr/bin/python3 /root/crypto-api/run_main_api.py
Restart=always

[Install]
WantedBy=multi-user.target
```

---

**Last Updated:** 2025-11-08  
**Version:** 1.0.0  
**Maintainer:** Crypto API Team

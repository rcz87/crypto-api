# GuardiansOfTheToken.com Integration Guide

## Overview

This guide covers the integration of GuardiansOfTheToken.com premium orderbook data with VIP 8 access into the crypto API system. The integration provides real-time orderbook data with advanced institutional analysis, pattern detection, and market insights.

## Features

### VIP 8 Access Benefits
- **Update Frequency**: 10ms real-time updates
- **Depth Levels**: Up to 500 orderbook levels
- **Advanced Detection**: Buy/sell walls, hidden orders, spoofing zones
- **Institutional Analysis**: Imbalance detection, flow analysis
- **Pattern Recognition**: Iceberg orders, spoofing detection
- **Market Metrics**: Liquidity scoring, depth analysis

### Key Components

1. **GuardiansOfTheTokenAPI** - Core API service
2. **GuardiansDataProcessor** - Data processing and analysis
3. **GuardiansVisualizer** - Advanced visualization components
4. **Configuration System** - Comprehensive settings management

## Installation & Setup

### 1. Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# Enable GuardiansOfTheToken integration
GUARDIANS_ENABLED=true

# API Configuration
GUARDIANS_API_URL=https://api.guardiansofthetoken.com
GUARDIANS_API_KEY=your_vip_8_api_key_here
GUARDIANS_VIP_TIER=8
GUARDIANS_TIMEOUT=30
GUARDIANS_MAX_RETRIES=3
GUARDIANS_RATE_LIMIT_DELAY=0.1

# Data Processing
GUARDIANS_MAX_HISTORY=1000
GUARDIANS_TREND_WINDOW=10
GUARDIANS_IMBALANCE_THRESHOLD=1.5
GUARDIANS_LIQUIDITY_THRESHOLD=50.0
GUARDIANS_WALL_MIN_SIZE=1000000

# Alerts
GUARDIANS_ALERTS_ENABLED=true
GUARDIANS_BUY_WALL_THRESHOLD=5000000
GUARDIANS_SELL_WALL_THRESHOLD=5000000
GUARDIANS_IMBALANCE_ALERT=2.0
GUARDIANS_LIQUIDITY_ALERT=30.0
GUARDIANS_SPOOFING_ALERTS=true
GUARDIANS_ICEBERG_ALERTS=true

# Integration
GUARDIANS_UPDATE_INTERVAL=5
GUARDIANS_BATCH_SIZE=5
GUARDIANS_CONCURRENT_REQUESTS=3
GUARDIANS_FALLBACK_BINANCE=true
GUARDIANS_DATA_VALIDATION=true

# Visualization
GUARDIANS_CHART_LEVELS=20
GUARDIANS_SHOW_INSTITUTIONAL=true
GUARDIANS_HIGHLIGHT_WALLS=true
GUARDIANS_SHOW_HIDDEN=true
GUARDIANS_COLOR_SCHEME=dark
```

### 2. Dependencies

Install required packages:

```bash
pip install aiohttp plotly pandas numpy
```

### 3. Import Statements

```python
from services.guardiansofthetoken_api import GuardiansOfTheTokenAPI, GuardiansDataProcessor
from utils.guardians_visualizer import GuardiansVisualizer
from config_guardians import (
    GUARDIANS_CONFIG, 
    get_guardians_symbols,
    is_guardians_enabled,
    validate_guardians_config
)
```

## Usage Examples

### Basic Orderbook Data Retrieval

```python
import asyncio
from services.guardiansofthetoken_api import GuardiansOfTheTokenAPI

async def get_orderbook_example():
    api = GuardiansOfTheTokenAPI(api_key="your_api_key", vip_tier=8)
    
    async with api:
        # Get premium orderbook data
        orderbook = await api.get_premium_orderbook("SOLUSDT", depth=100)
        
        if orderbook:
            print(f"Symbol: {orderbook.symbol}")
            print(f"Mid Price: ${orderbook.mid_price:.2f}")
            print(f"Spread: ${orderbook.spread:.4f}")
            print(f"Imbalance Ratio: {orderbook.imbalance_ratio:.2f}")
            print(f"Bid Levels: {len(orderbook.bid_levels)}")
            print(f"Ask Levels: {len(orderbook.ask_levels)}")
            print(f"Update Frequency: {orderbook.update_frequency_ms}ms")
            print(f"VIP Tier: {orderbook.vip_tier}")

asyncio.run(get_orderbook_example())
```

### Market Metrics and Institutional Analysis

```python
async def get_market_metrics_example():
    api = GuardiansOfTheTokenAPI(api_key="your_api_key", vip_tier=8)
    
    async with api:
        # Get institutional market metrics
        metrics = await api.get_market_metrics("SOLUSDT")
        
        if metrics:
            print(f"Buy Wall Detected: {metrics.buy_wall_detected}")
            print(f"Sell Wall Detected: {metrics.sell_wall_detected}")
            print(f"Hidden Orders: {metrics.hidden_orders_detected}")
            print(f"Institutional Imbalance: {metrics.institutional_imbalance}")
            print(f"Liquidity Score: {metrics.liquidity_score:.1f}/100")
            print(f"Market Depth Score: {metrics.market_depth_score:.1f}/100")
            print(f"Spoofing Zones: {len(metrics.spoofing_zones)}")
            print(f"Iceberg Orders: {len(metrics.iceberg_orders)}")

asyncio.run(get_market_metrics_example())
```

### Data Processing and Analysis

```python
from services.guardiansofthetoken_api import GuardiansDataProcessor

async def data_processing_example():
    api = GuardiansOfTheTokenAPI(api_key="your_api_key", vip_tier=8)
    processor = GuardiansDataProcessor()
    
    async with api:
        # Get multiple data points
        symbols = ["SOLUSDT", "BTCUSDT", "ETHUSDT"]
        
        for symbol in symbols:
            orderbook = await api.get_premium_orderbook(symbol)
            metrics = await api.get_market_metrics(symbol)
            
            if orderbook:
                processor.add_orderbook_data(orderbook)
            if metrics:
                processor.add_metrics_data(metrics)
        
        # Analyze trends
        for symbol in symbols:
            latest_orderbook = processor.get_latest_orderbook(symbol)
            if latest_orderbook:
                trends = processor.analyze_orderbook_trends(symbol, window_size=10)
                print(f"{symbol} trends: {trends}")

asyncio.run(data_processing_example())
```

### Advanced Visualization

```python
from utils.guardians_visualizer import GuardiansVisualizer
import plotly.graph_objects as go

async def visualization_example():
    api = GuardiansOfTheTokenAPI(api_key="your_api_key", vip_tier=8)
    visualizer = GuardiansVisualizer()
    
    async with api:
        # Get data
        orderbook = await api.get_premium_orderbook("SOLUSDT", depth=50)
        metrics = await api.get_market_metrics("SOLUSDT")
        
        if orderbook and metrics:
            # Create premium orderbook chart
            chart = visualizer.create_premium_orderbook_chart(
                orderbook, 
                metrics,
                depth_levels=20
            )
            
            # Create institutional analysis
            inst_chart = visualizer.create_institutional_analysis_chart(
                metrics,
                orderbook
            )
            
            # Create VIP features dashboard
            dashboard = visualizer.create_vip_features_dashboard(
                orderbook,
                metrics
            )
            
            # Save charts
            chart.write_html("orderbook_chart.html")
            inst_chart.write_html("institutional_chart.html")
            dashboard.write_html("vip_dashboard.html")

asyncio.run(visualization_example())
```

## Configuration Options

### VIP Tiers

| Tier | Update Frequency | Max Depth | Advanced Detection | Institutional Data |
|------|------------------|------------|-------------------|-------------------|
| 1-4  | 100ms           | 50         | ❌                | ❌                |
| 5-7  | 50ms            | 200        | ✅                | ❌                |
| 8-10 | 10ms            | 500        | ✅                | ✅                |

### Risk Levels

- **Low** (0-30): Normal market conditions
- **Medium** (30-60): Moderate volatility
- **High** (60-80): High volatility risk
- **Extreme** (80-100): Extreme market conditions

### Pattern Detection

- **Buy/Sell Walls**: Large order concentrations
- **Spoofing**: Manipulative order placement
- **Iceberg Orders**: Hidden large orders
- **Hidden Orders**: Non-visible order flow

## Testing

### Run Integration Tests

```bash
python test_guardians_integration.py
```

The test suite includes:
- Configuration validation
- API connection testing
- Orderbook data quality
- Market metrics verification
- VIP features testing
- Performance benchmarking
- Visualization testing

### Test Categories

1. **Configuration Validation**: Verify settings and API credentials
2. **API Connection**: Test connectivity and authentication
3. **Orderbook Data**: Validate data quality and completeness
4. **Market Metrics**: Test institutional analysis features
5. **VIP Features**: Verify high-frequency updates and depth levels
6. **Data Quality**: Assess data freshness and accuracy
7. **Performance**: Test response times and concurrent requests
8. **Visualization**: Validate chart generation

## Performance Considerations

### Response Time Targets

- **VIP 8**: ≤10ms for orderbook updates
- **VIP 5-7**: ≤50ms for orderbook updates
- **VIP 1-4**: ≤100ms for orderbook updates

### Concurrent Requests

- **Maximum**: 10 concurrent requests per API key
- **Recommended**: 3-5 concurrent requests for stability
- **Rate Limiting**: Built-in delay between requests

### Memory Usage

- **Orderbook History**: 1000 snapshots per symbol
- **Metrics History**: 1000 entries per symbol
- **Visualization**: Temporary memory during chart generation

## Error Handling

### Common Error Codes

- **401**: Invalid API key or authentication failed
- **429**: Rate limit exceeded
- **500**: Internal server error
- **503**: Service temporarily unavailable

### Retry Strategy

```python
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
async def get_orderbook_with_retry(symbol: str):
    api = GuardiansOfTheTokenAPI(api_key="your_api_key")
    async with api:
        return await api.get_premium_orderbook(symbol)
```

### Fallback Mechanisms

When GuardiansOfTheToken is unavailable, the system can fall back to:
- Binance API for basic orderbook data
- Cached data for recent snapshots
- Estimated values based on market conditions

## Monitoring & Alerts

### Key Metrics to Monitor

1. **API Response Time**: Should be ≤50ms for VIP 8
2. **Success Rate**: Should be ≥95%
3. **Data Freshness**: Updates should be ≤100ms old
4. **Quality Score**: Should be ≥80/100
5. **Error Rate**: Should be ≤5%

### Alert Conditions

- **Buy Wall Detected**: Orders >$5M at single price level
- **Sell Wall Detected**: Orders >$5M at single price level
- **Imbalance Alert**: Bid/ask ratio >2.0 or <0.5
- **Liquidity Alert**: Score <30/100
- **Spoofing Detected**: Manipulative patterns identified

## Integration with Main Application

### Adding to Existing Streamlit App

```python
# In your main app.py
import asyncio
from services.guardiansofthetoken_api import GuardiansOfTheTokenAPI
from utils.guardians_visualizer import GuardiansVisualizer

# Initialize in session state
if 'guardians_api' not in st.session_state:
    st.session_state.guardians_api = GuardiansOfTheTokenAPI(
        api_key=os.getenv('GUARDIANS_API_KEY'),
        vip_tier=8
    )

if 'guardians_visualizer' not in st.session_state:
    st.session_state.guardians_visualizer = GuardiansVisualizer()

# Add new tab for Guardians data
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "🔥 Liquidation Heatmaps", 
    "📚 Order Book", 
    "⚖️ Leverage Analysis", 
    "📊 Market Overview",
    "🌟 Guardians Premium"
])

with tab5:
    st.subheader("🌟 GuardiansOfTheToken Premium Data")
    
    # Symbol selector
    symbol = st.selectbox("Select symbol:", get_guardians_symbols())
    
    # Get data
    if st.button("Refresh Guardians Data"):
        with st.spinner("Fetching premium data..."):
            # Run async operation
            orderbook = asyncio.run(
                st.session_state.guardians_api.get_premium_orderbook(symbol)
            )
            metrics = asyncio.run(
                st.session_state.guardians_api.get_market_metrics(symbol)
            )
            
            if orderbook and metrics:
                # Display charts
                chart = st.session_state.guardians_visualizer.create_premium_orderbook_chart(
                    orderbook, metrics
                )
                st.plotly_chart(chart, use_container_width=True)
                
                # Display metrics
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Liquidity Score", f"{metrics.liquidity_score:.1f}/100")
                with col2:
                    st.metric("Market Depth", f"{metrics.market_depth_score:.1f}/100")
                with col3:
                    st.metric("Imbalance", f"{orderbook.imbalance_ratio:.2f}")
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check API key validity
   - Verify VIP tier access
   - Ensure GUARDIANS_ENABLED=true

2. **Slow Response Times**
   - Check network connectivity
   - Verify VIP tier limits
   - Reduce concurrent requests

3. **Missing Data**
   - Check symbol availability
   - Verify API permissions
   - Check rate limits

4. **Visualization Errors**
   - Ensure data quality
   - Check Plotly version
   - Verify data format

### Debug Mode

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Health Check Endpoint

```python
async def health_check():
    api = GuardiansOfTheTokenAPI()
    async with api:
        orderbook = await api.get_premium_orderbook("SOLUSDT", depth=1)
        return orderbook is not None
```

## Best Practices

1. **Connection Management**: Use async context managers
2. **Error Handling**: Implement retry logic with exponential backoff
3. **Rate Limiting**: Respect API limits and implement delays
4. **Data Validation**: Always validate data quality before use
5. **Monitoring**: Track performance metrics and set up alerts
6. **Fallbacks**: Have backup data sources for critical operations
7. **Caching**: Cache recent data to reduce API calls
8. **Security**: Store API keys securely and rotate regularly

## Support

For issues related to:
- **API Access**: Contact GuardiansOfTheToken support
- **Integration**: Check this guide and test suite
- **Performance**: Monitor metrics and adjust configuration
- **Data Quality**: Run validation tests and check alerts

## Version History

- **v1.0.0**: Initial VIP 8 integration
- **v1.1.0**: Added advanced visualization
- **v1.2.0**: Enhanced error handling and retry logic
- **v1.3.0**: Performance optimizations and caching

---

*Last updated: October 30, 2025*
*VIP Tier: 8*
*Integration Status: Production Ready*

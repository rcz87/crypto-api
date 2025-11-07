# CoinAPI Integration Guide

## Overview

CoinAPI adalah comprehensive market data API yang menyediakan akses ke 100+ exchanges dengan real-time data. Integration ini telah ditambahkan ke crypto-api system untuk meningkatkan coverage dan akurasi data.

## Features

### 🚀 Core Capabilities
- **100+ Exchanges**: Akses ke data dari mayoritas crypto exchanges
- **Real-time Data**: Quotes, trades, dan OHLCV data secara real-time
- **Comprehensive Coverage**: 10,000+ trading pairs
- **Rate Limiting**: Built-in rate limiting untuk menghindari API limits
- **Caching**: Intelligent caching untuk optimasi performance
- **Error Handling**: Robust error handling dengan fallback mechanisms

### 📊 Data Types
- **Market Quotes**: Real-time price data
- **OHLCV Data**: Historical price data
- **Trade Data**: Recent trades information
- **Exchange Info**: Exchange metadata dan capabilities
- **Symbol Mapping**: Standardized symbol mapping

## Installation & Setup

### 1. Dependencies
```bash
pip install requests
```

### 2. Environment Configuration
Tambahkan ke `.env` file:
```bash
# CoinAPI Configuration
COINAPI_API_KEY="your_coinapi_api_key_here"
```

### 3. API Key Setup
1. Daftar di [CoinAPI](https://www.coinapi.io/)
2. Pilih subscription plan (Free tier tersedia)
3. Copy API key dari dashboard
4. Set environment variable

## Usage

### Basic Usage

```python
from services.coinapi_service import CoinAPIService, search_coin

# Initialize service
coinapi = CoinAPIService()

# Search coin
results = search_coin("bitcoin", limit=10)
for coin in results:
    print(f"{coin.symbol}: ${coin.price}")
```

### Advanced Usage

```python
from services.dynamic_coin_discovery_v2 import search_coin

# Multi-source search dengan CoinAPI
results = search_coin("BTC", sources=['coinapi', 'binance', 'coingecko'])

# CoinAPI-only search
coinapi_results = search_coin("ETH", sources=['coinapi'])
```

### Service Methods

#### CoinAPIService Class

```python
class CoinAPIService:
    def __init__(self):
        """Initialize CoinAPI service dengan environment configuration"""
    
    def get_exchanges(self) -> List[Dict[str, Any]]:
        """Get all supported exchanges"""
    
    def get_symbols(self, exchange_id: str = None) -> List[Dict[str, Any]]:
        """Get trading symbols, optional exchange filter"""
    
    def search_coin(self, query: str, limit: int = 20) -> List[CoinAPICoinInfo]:
        """Search coin berdasarkan symbol atau name"""
    
    def get_coin_details(self, symbol_id: str) -> Optional[CoinAPICoinInfo]:
        """Get detailed info untuk specific symbol"""
    
    def get_ohlcv_data(self, symbol_id: str, period_id: str = '1DAY', limit: int = 100) -> List[Dict[str, Any]]:
        """Get OHLCV historical data"""
    
    def get_trades_latest(self, symbol_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get latest trades data"""
```

#### Data Structures

```python
@dataclass
class CoinAPICoinInfo:
    symbol: str                    # Trading symbol (BTC, ETH, etc)
    name: str                      # Full name dengan exchange info
    source: str                    # 'coinapi'
    price: Optional[float]         # Current price
    volume_24h: Optional[float]    # 24h volume
    change_24h: Optional[float]    # 24h price change
    exchange_id: Optional[str]     # Exchange identifier
    symbol_id: Optional[str]       # Full symbol identifier
    last_updated: Optional[str]    # Last update timestamp
```

## Integration with Dynamic Discovery

CoinAPI telah terintegrasi secara seamless dengan `DynamicCoinDiscovery` service:

### Multi-Source Search
```python
from services.dynamic_coin_discovery_v2 import search_coin

# Search dari semua sources termasuk CoinAPI
results = search_coin("bitcoin")
# Akan mencari di: CoinGecko, Binance, OKX, CoinAPI
```

### Source-Specific Search
```python
# Hanya dari CoinAPI
coinapi_results = search_coin("BTC", sources=['coinapi'])

# Kombinasi sources
mixed_results = search_coin("ETH", sources=['coinapi', 'binance'])
```

### Data Deduplication
System otomatis mendeduplikasi hasil berdasarkan symbol dan memilih data terbaik:
- Prioritaskan data dengan harga terbaru
- Merge exchange information
- Handle naming conflicts

## API Limits & Rate Limiting

### Free Tier Limits
- **Requests**: 100 requests/day
- **Data Points**: 100,000 data points/month
- **Real-time**: Limited real-time access

### Rate Limiting Implementation
```python
# Automatic rate limiting
self.min_request_interval = 0.1  # 100ms untuk paid tier
# Untuk free tier, disarankan 1-2 seconds
```

### Best Practices
1. **Use Caching**: Data di-cache untuk mengurangi API calls
2. **Batch Requests**: Gunakan batch requests saat possible
3. **Monitor Usage**: Track API usage untuk avoid limits
4. **Graceful Degradation**: Fallback ke other sources jika limit exceeded

## Error Handling

### Common Error Codes
- **401**: Invalid API key
- **403**: Quota exceeded
- **429**: Rate limit exceeded
- **500**: Server error

### Error Response Example
```json
{
  "title": "Forbidden",
  "status": 403,
  "detail": "Quota exceeded: Insufficient Usage Credits or Subscription.",
  "QuotaKey": "BA",
  "QuotaName": "Insufficient Usage Credits or Subscription",
  "QuotaType": "Organization Limit",
  "QuotaValueCurrentUsage": 2506,
  "QuotaValue": 2500,
  "QuotaValueUnit": "$"
}
```

### Handling Strategies
```python
try:
    results = coinapi.search_coin("bitcoin")
except ValueError as e:
    # API key not configured
    logger.error(f"CoinAPI configuration error: {e}")
except requests.exceptions.RequestException as e:
    # Network error
    logger.warning(f"CoinAPI network error: {e}")
    # Fallback ke other sources
```

## Testing

### Run Integration Tests
```bash
# Set environment variable
export COINAPI_API_KEY="your_api_key_here"

# Run tests
python3 test_coinapi_integration.py
```

### Test Coverage
- ✅ API connectivity
- ✅ Search functionality
- ✅ Multi-source integration
- ✅ Error handling
- ✅ Rate limiting
- ✅ Edge cases

## Performance Optimization

### Caching Strategy
- **Exchange List**: 1 hour cache
- **Symbol List**: 30 minutes cache
- **Search Results**: 1 minute cache
- **Quotes**: Real-time (no cache)

### Rate Limiting
- **Paid Tier**: 100ms between requests
- **Free Tier**: 1-2 seconds between requests
- **Burst Handling**: Automatic backoff on rate limit

### Memory Management
- **Cache Size Limits**: Automatic cache cleanup
- **Data Deduplication**: Efficient memory usage
- **Lazy Loading**: Load data hanya saat needed

## Monitoring & Debugging

### API Status Check
```python
from services.coinapi_service import get_api_status

status = get_api_status()
print(f"API Key Configured: {status['api_key_configured']}")
print(f"Cache Size: {status['cache_size']}")
print(f"Last Requests: {status['last_requests']}")
```

### Logging
```python
import logging
logging.basicConfig(level=logging.INFO)

# CoinAPI service akan log:
# - API requests
# - Rate limiting
# - Cache hits/misses
# - Errors
```

### Debug Mode
```python
# Enable debug logging
import logging
logging.getLogger('services.coinapi_service').setLevel(logging.DEBUG)
```

## Troubleshooting

### Common Issues

#### 1. API Key Not Working
```bash
# Check environment variable
echo $COINAPI_API_KEY

# Verify key format (should be UUID)
python3 -c "import uuid; uuid.UUID('your_key_here')"
```

#### 2. Quota Exceeded
- Check usage di CoinAPI dashboard
- Upgrade subscription jika needed
- Implement better caching
- Use other sources sebagai fallback

#### 3. Rate Limit Issues
- Increase request interval
- Implement exponential backoff
- Use batch requests
- Cache aggressively

#### 4. Connection Issues
```python
# Test connectivity
import requests
response = requests.get('https://rest.coinapi.io/v1/exchanges')
print(response.status_code)
```

## Production Deployment

### Environment Variables
```bash
# Production configuration
COINAPI_API_KEY="${COINAPI_API_KEY}"
# Optional: Custom rate limiting
COINAPI_RATE_LIMIT="${COINAPI_RATE_LIMIT:-0.1}"
```

### Monitoring Setup
```python
# Add to your monitoring
from services.coinapi_service import get_api_status

def health_check():
    status = get_api_status()
    return {
        'coinapi_healthy': status['api_key_configured'],
        'cache_size': status['cache_size']
    }
```

### Alerting
- Monitor API usage
- Alert on quota exceeded
- Track error rates
- Monitor response times

## API Reference

### Endpoints Used
- `/v1/exchanges` - Get all exchanges
- `/v1/symbols` - Get trading symbols
- `/v1/quotes/latest` - Get latest quotes
- `/v1/ohlcv/latest` - Get OHLCV data
- `/v1/trades/latest` - Get latest trades

### Response Format
```json
{
  "symbol_id": "BINANCE_SPOT_BTC_USDT",
  "exchange_id": "BINANCE",
  "ask_price": 50000.0,
  "bid_price": 49999.0,
  "time_coinapi": "2024-01-01T00:00:00.0000000Z"
}
```

## Comparison with Other APIs

| Feature | CoinAPI | CoinGecko | Binance | OKX |
|---------|---------|-----------|---------|-----|
| Exchanges | 100+ | 1 (aggregated) | 1 | 1 |
| Real-time | ✅ | ✅ | ✅ | ✅ |
| Free Tier | ✅ | ✅ | ✅ | ✅ |
| Historical Data | ✅ | ✅ | ✅ | ✅ |
| Rate Limits | Medium | High | High | High |
| Documentation | ✅ | ✅ | ✅ | ✅ |

## Future Enhancements

### Planned Features
- [ ] WebSocket support untuk real-time data
- [ ] Advanced filtering options
- [ ] Custom symbol mapping
- [ ] Enhanced error recovery
- [ ] Performance analytics

### Integration Opportunities
- [ ] Trading algorithm integration
- [ ] Portfolio tracking
- [ ] Arbitrage detection
- [ ] Market making
- [ ] Risk management

## Support

### Documentation
- [CoinAPI Official Docs](https://docs.coinapi.io/)
- [API Reference](https://rest.coinapi.io/)

### Community
- [Discord Community](https://discord.gg/coinapi)
- [GitHub Issues](https://github.com/coinapi/coinapi-sdk/issues)

### Contact
- Email: support@coinapi.io
- Twitter: @coinapi_io

---

## Summary

CoinAPI integration telah berhasil ditambahkan ke crypto-api system dengan:

✅ **Comprehensive Coverage**: 100+ exchanges  
✅ **Robust Implementation**: Error handling, rate limiting, caching  
✅ **Seamless Integration**: Works dengan existing discovery service  
✅ **Production Ready**: Monitoring, logging, health checks  
✅ **Well Documented**: Complete API reference and examples  

Integration ini meningkatkan kemampuan crypto-api untuk menyediakan comprehensive market data dari multiple sources dengan reliability dan performance yang optimal.

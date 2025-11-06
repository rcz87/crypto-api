# 🚀 LunarCrush API v4 Migration Guide

## 📋 Overview

Dokumen ini menjelaskan migrasi dari LunarCrush API v2 (implementasi saat ini) ke API v4 (versi terbaru).

## ⚠️ Mengapa Harus Migrasi?

- **API v2**: Sudah deprecated dan tidak lagi didukung
- **API v4**: Versi terbaru dengan fitur lebih lengkap dan support jangka panjang
- **Compatibility**: API key yang Anda subscribe hanya akan bekerja dengan v4

## 🔄 Perubahan Utama

### 1. Base URL

```diff
- OLD (v2): https://api.lunarcrush.com/v2
+ NEW (v4): https://lunarcrush.com/api4
```

### 2. Authentication

✅ **TIDAK BERUBAH** - Masih menggunakan Bearer Token

```python
headers = {
    'Authorization': f'Bearer {API_KEY}'
}
```

### 3. Endpoint Mapping

#### Implementasi Saat Ini (v2) → Target (v4)

| Fungsi | v2 Endpoint | v4 Endpoint | Status |
|--------|-------------|-------------|--------|
| **Get Coin Data** | `GET /v2/data?symbol={symbol}` | `GET /api4/public/coins/{coin}` | 🔄 Needs Update |
| **Trending Coins** | `GET /v2/trending?limit={N}` | `GET /api4/public/coins/list/v2` | 🔄 Needs Update |
| **Influencers** | `GET /v2/influencers?symbol={symbol}` | `GET /api4/public/topic/{topic}/creators` | 🔄 Needs Update |
| **Market Overview** | Custom aggregation | `GET /api4/public/coins/list/v2` | 🔄 Needs Update |

### 4. Response Structure Changes

#### v2 Response Format:
```json
{
  "data": [{
    "symbol": "BTC",
    "galaxy_score": 78.5,
    "alt_rank": 1,
    ...
  }]
}
```

#### v4 Response Format:
```json
{
  "config": {
    "generated": 1699123456,
    "limit": 10,
    ...
  },
  "data": [{
    "symbol": "BTC",
    "galaxy_score": 78.5,
    "alt_rank": 1,
    ...
  }]
}
```

### 5. Sentiment Scale Changes

| Metric | v2 Format | v4 Format |
|--------|-----------|-----------|
| **Sentiment** | 0-100 (percentage) | 0-100 (percentage) ✅ Same |
| **Post Sentiment** | Not available | 1-5 scale (1=very negative, 3=neutral, 5=very positive) |

## 📡 API v4 Endpoint Details

### 1. Get Single Coin Data

**Endpoint:** `GET /api4/public/coins/{coin}`

**Parameters:**
- `{coin}` - Coin ID (numeric) or symbol (e.g., "BTC", "ETH")

**Response Fields:**
```json
{
  "config": { ... },
  "data": {
    "id": 1,
    "symbol": "BTC",
    "name": "Bitcoin",
    "price": 67890.50,
    "market_cap": 1234567890000,
    "galaxy_score": 78.5,
    "alt_rank": 1,
    "sentiment": 65.3,
    "social_volume_24h": 45678,
    "interactions_24h": 2345678,
    "num_contributors": 12345,
    "percent_change_24h": 2.5,
    "market_dominance": 45.2,
    "social_dominance": 38.7
  }
}
```

### 2. Get Coins List (Trending)

**Endpoint:** `GET /api4/public/coins/list/v2`

**Query Parameters:**
- `limit` - Max 1000 (default: 10)
- `page` - Pagination starting at 0
- `sort` - Sort by field (e.g., "galaxy_score", "alt_rank", "interactions_24h")
- `desc` - Set to 1 for descending order

**Example:**
```
GET /api4/public/coins/list/v2?limit=20&sort=galaxy_score&desc=1
```

### 3. Get Creators/Influencers for a Topic

**Endpoint:** `GET /api4/public/topic/{topic}/creators`

**Parameters:**
- `{topic}` - Topic name (e.g., "bitcoin", "ethereum")
- `limit` - Number of results (default: 10)

**Response Fields:**
```json
{
  "config": { ... },
  "data": [
    {
      "display_name": "CryptoWhale",
      "followers": 125000,
      "interactions_24h": 45678,
      "posts_24h": 12,
      "sentiment": 72.5
    }
  ]
}
```

### 4. Get Time Series Data

**Endpoint:** `GET /api4/public/coins/{coin}/time-series/v2`

**Query Parameters:**
- `bucket` - "hour" or "day"
- `interval` - Time range (e.g., "1w" for 1 week, "1m" for 1 month)
- `start` - Unix timestamp (seconds)
- `end` - Unix timestamp (seconds)

**Example:**
```
GET /api4/public/coins/BTC/time-series/v2?bucket=day&interval=1w
```

## 🛠️ Implementation Changes Needed

### File: `services/lunarcrush/lunarcrush_service.py`

#### Change 1: Update Base URL

```python
# Line 42
# OLD:
self.base_url = 'https://api.lunarcrush.com/v2'

# NEW:
self.base_url = 'https://lunarcrush.com/api4/public'
```

#### Change 2: Update `_fetch_real_data()` method

```python
def _fetch_real_data(self, symbol: str) -> Dict:
    """Fetch real data from LunarCrush API v4"""
    if not self.api_key:
        raise ValueError("LunarCrush API key not configured")

    headers = {
        'Authorization': f'Bearer {self.api_key}'
    }

    # NEW v4 endpoint
    coin_url = f"{self.base_url}/coins/{symbol}"
    response = requests.get(coin_url, headers=headers, timeout=10)
    response.raise_for_status()

    result = response.json()
    if not result.get('data'):
        raise ValueError(f"No data found for symbol {symbol}")

    coin = result['data']  # v4 returns single object, not array

    # Transform to our format
    return {
        'symbol': symbol,
        'galaxy_score': coin.get('galaxy_score', 0),
        'sentiment': coin.get('sentiment', 0),
        'social_volume': coin.get('social_volume_24h', 0),
        'alt_rank': coin.get('alt_rank', 0),
        'trending_score': coin.get('galaxy_score', 0),  # Use galaxy_score as trending
        'price_change_24h': coin.get('percent_change_24h', 0),
        'reddit_posts': coin.get('reddit_posts_24h', 0),
        'twitter_mentions': coin.get('tweets_24h', 0),
        'influencers': [],  # Will fetch separately
        'recommendation': self._calculate_recommendation(coin),
        'confidence': self._calculate_confidence(coin),
        'timestamp': datetime.now().isoformat()
    }
```

#### Change 3: Update `get_trending_coins()` method

```python
def get_trending_coins(self, limit: int = 20) -> List[SocialMetrics]:
    """Get trending cryptocurrencies from v4 API"""
    if self.mock_mode:
        # Keep existing mock implementation
        trending_symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP', 'DOGE', 'AVAX', 'MATIC', 'DOT']
        return [self.get_social_sentiment(symbol) for symbol in trending_symbols[:limit]]
    else:
        try:
            headers = {'Authorization': f'Bearer {self.api_key}'}
            # NEW v4 endpoint with sorting
            url = f"{self.base_url}/coins/list/v2?limit={limit}&sort=galaxy_score&desc=1"
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()

            result = response.json()
            data = result.get('data', [])
            trending = []

            for coin in data:
                symbol = coin.get('symbol', '')
                if symbol:
                    # Use cached data if available, otherwise fetch
                    trending.append(self.get_social_sentiment(symbol))

            return trending[:limit]

        except Exception as e:
            logger.error(f"Failed to fetch trending coins: {e}")
            # Fallback to mock data
            trending_symbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA']
            return [self.get_social_sentiment(symbol) for symbol in trending_symbols[:limit]]
```

#### Change 4: Update Influencers Fetching

```python
def _fetch_influencers(self, symbol: str) -> List[Dict]:
    """Fetch influencers from v4 API"""
    if self.mock_mode:
        return self._get_mock_influencers(symbol, hash(symbol) % 100)

    try:
        headers = {'Authorization': f'Bearer {self.api_key}'}
        # NEW v4 endpoint - use topic name (lowercase)
        topic = symbol.lower()
        url = f"{self.base_url}/topic/{topic}/creators?limit=5"
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        result = response.json()
        creators = result.get('data', [])

        return [
            {
                'username': creator.get('display_name', ''),
                'followers': creator.get('followers', 0),
                'sentiment': self._sentiment_from_score(creator.get('sentiment', 50)),
                'sentiment_score': creator.get('sentiment', 50),
                'recent_posts': creator.get('posts_24h', 0),
                'engagement': creator.get('interactions_24h', 0)
            }
            for creator in creators
        ]

    except Exception as e:
        logger.error(f"Failed to fetch influencers for {symbol}: {e}")
        return []
```

## 🔑 Environment Variables

Tidak ada perubahan untuk environment variables:

```bash
LUNARCRUSH_API_KEY="your_api_key_here"
LUNARCRUSH_PORT=8001
LUNARCRUSH_HOST="0.0.0.0"
```

## 📝 Testing Checklist

Setelah implementasi v4, test hal-hal berikut:

- [ ] Health check endpoint
- [ ] Get sentiment untuk single coin (BTC)
- [ ] Get trending coins list
- [ ] Compare multiple coins
- [ ] Get influencers untuk specific coin
- [ ] Market overview
- [ ] Error handling (symbol tidak ditemukan)
- [ ] Cache functionality
- [ ] Mock mode fallback

## 🚨 Breaking Changes

1. **Response Structure**: Tambahan `config` object di response
2. **Endpoint Paths**: Semua path berubah dari `/v2/*` ke `/api4/public/*`
3. **Some Field Names**: Beberapa field mungkin berubah nama (perlu validasi saat testing)
4. **Topic Creators**: Sekarang perlu reference by topic name (lowercase)

## 📚 Resources

- **Official Docs**: https://lunarcrush.com/developers/api/authentication
- **GitHub Repo**: https://github.com/lunarcrush/api
- **Get API Key**: https://lunarcrush.com/faq/how-do-i-generate-an-api-token

## ⏭️ Next Steps

1. ✅ Review migration guide ini
2. ⏳ Update implementasi `lunarcrush_service.py`
3. ⏳ Test dengan mock mode
4. ⏳ Subscribe API key di LunarCrush
5. ⏳ Configure API key di `.env`
6. ⏳ Test dengan real API
7. ⏳ Deploy ke production

---

**Created**: 2025-11-06
**Status**: 📝 Draft - Ready for Implementation

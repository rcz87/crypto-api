# 🤖 GPT CoinAPI Integration Examples

## Endpoint Base URL
```
POST http://localhost:5000/gpts/unified/advanced
Content-Type: application/json
```

## 1. Single Ticker Request
**Request:**
```json
{
  "op": "ticker",
  "symbol": "BTC"
}
```

**GPT Prompt Example:**
> "Get current price and 24h volume for Bitcoin"

## 2. Batch Multiple Coins
**Request:**
```json
{
  "ops": [
    {"op": "ticker", "symbol": "BTC"},
    {"op": "ticker", "symbol": "ETH"},
    {"op": "ticker", "symbol": "SOL"}
  ]
}
```

**GPT Prompt Example:**
> "Compare current prices of Bitcoin, Ethereum, and Solana with their 24h changes"

## 3. Historical OHLCV Data
**Request:**
```json
{
  "op": "ohlcv",
  "symbol": "SOL", 
  "period_id": "1HRS",
  "limit": 24
}
```

**GPT Prompt Example:**
> "Show me Solana's hourly price movement for the last 24 hours"

## 4. Real-time Quotes
**Request:**
```json
{
  "op": "quotes",
  "symbol": "BTC"
}
```

**GPT Prompt Example:**
> "What's the current bid/ask spread for Bitcoin across different exchanges?"

## 5. Market Sentiment Analysis
**Request:**
```json
{
  "op": "market_sentiment",
  "symbol": "ETH"
}
```

**GPT Prompt Example:**
> "Analyze current market sentiment for Ethereum based on funding rates and volume"

## 6. Whale Alerts
**Request:**
```json
{
  "op": "whale_alerts",
  "symbol": "BTC",
  "min_usd": 1000000
}
```

**GPT Prompt Example:**
> "Show me any large Bitcoin transactions over $1M in the last hour"

## 7. Advanced Multi-Operation Analysis
**Request:**
```json
{
  "ops": [
    {"op": "ticker", "symbol": "BTC"},
    {"op": "market_sentiment", "symbol": "BTC"},
    {"op": "whale_alerts", "symbol": "BTC"},
    {"op": "ohlcv", "symbol": "BTC", "period_id": "1HRS", "limit": 6}
  ]
}
```

**GPT Prompt Example:**
> "Give me a complete analysis of Bitcoin: current price, market sentiment, whale activity, and 6-hour price trend"

## GPT Actions Schema Configuration

For GPT Actions, use this OpenAPI schema:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "CoinAPI Trading Intelligence",
    "version": "1.0.0"
  },
  "servers": [
    {"url": "http://localhost:5000"}
  ],
  "paths": {
    "/gpts/unified/advanced": {
      "post": {
        "summary": "Advanced cryptocurrency analysis",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [
                  {
                    "type": "object",
                    "properties": {
                      "op": {"type": "string", "enum": ["ticker", "ohlcv", "quotes", "market_sentiment", "whale_alerts"]},
                      "symbol": {"type": "string"},
                      "period_id": {"type": "string"},
                      "limit": {"type": "integer"}
                    }
                  },
                  {
                    "type": "object", 
                    "properties": {
                      "ops": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "op": {"type": "string"},
                            "symbol": {"type": "string"}
                          }
                        }
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    }
  }
}
```

## Available Operations:
- `ticker` - Current price, volume, 24h change
- `ohlcv` - Historical candlestick data
- `quotes` - Real-time bid/ask quotes
- `market_sentiment` - Sentiment analysis with drivers
- `whale_alerts` - Large transaction detection
- `funding_rate` - Perpetual swap funding rates
- `open_interest` - Derivatives open interest data

## Supported Symbols:
- BTC, ETH, SOL, ADA, DOT, LINK, UNI, AAVE, SUSHI, CRV
- Format: Use ticker symbol (BTC) not full pair (BTC-USDT-SWAP)
- System automatically converts to proper exchange format

## Response Format:
All responses include:
- `ok`: Boolean success status
- `op`: Operation performed  
- `data`: Analysis results
- `used_sources`: Data sources used
- `summary`: Human-readable summary
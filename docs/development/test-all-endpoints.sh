#!/bin/bash

# Script untuk test semua endpoint dari OpenAPI schema
# Base URL
BASE_URL="https://guardiansofthetoken.com"

echo "================================"
echo "TESTING ALL API ENDPOINTS"
echo "================================"
echo ""

# Counter
TOTAL=0
SUCCESS=0
FAILED=0

test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    TOTAL=$((TOTAL + 1))
    echo "[$TOTAL] Testing: $method $endpoint"
    echo "Description: $description"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n-1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | head -n-1)
    fi
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "✅ SUCCESS (HTTP $http_code)"
        SUCCESS=$((SUCCESS + 1))
        echo "$body" | jq -C '.' 2>/dev/null | head -20
    else
        echo "❌ FAILED (HTTP $http_code)"
        FAILED=$((FAILED + 1))
        echo "$body" | jq -C '.' 2>/dev/null
    fi
    echo ""
    echo "---"
    echo ""
}

echo "=== PUBLIC ENDPOINTS (No Auth) ==="
echo ""

# 1. Health Check
test_endpoint "GET" "/health" "System health check"

# 2. GPT Health
test_endpoint "GET" "/gpts/health" "GPT Actions health check"

# 3. Supported Pairs
test_endpoint "GET" "/api/pairs/supported" "Get all supported trading pairs"

# 4. GPT Unified Symbols
test_endpoint "GET" "/gpts/unified/symbols" "Get GPT supported symbols"

echo ""
echo "=== GPT ACTIONS UNIFIED ENDPOINT ==="
echo ""

# 5. GPT Unified Advanced - Ticker BTC
test_endpoint "POST" "/gpts/unified/advanced" "Get BTC ticker" '{"op":"ticker","params":{"symbol":"BTC"}}'

# 6. GPT Unified Advanced - Ticker ETH
test_endpoint "POST" "/gpts/unified/advanced" "Get ETH ticker" '{"op":"ticker","params":{"symbol":"ETH"}}'

# 7. GPT Unified Advanced - Ticker SOL
test_endpoint "POST" "/gpts/unified/advanced" "Get SOL ticker" '{"op":"ticker","params":{"symbol":"SOL"}}'

# 8. GPT Unified Advanced - Market Sentiment
test_endpoint "POST" "/gpts/unified/advanced" "Get market sentiment" '{"op":"market_sentiment"}'

# 9. GPT Unified Advanced - Whale Alerts
test_endpoint "POST" "/gpts/unified/advanced" "Get whale alerts" '{"op":"whale_alerts","params":{"symbol":"BTC","exchange":"hyperliquid"}}'

# 10. GPT Unified Advanced - ETF Flows
test_endpoint "POST" "/gpts/unified/advanced" "Get ETF flows" '{"op":"etf_flows","params":{"days":30}}'

# 11. GPT Unified Advanced - Bitcoin ETFs
test_endpoint "POST" "/gpts/unified/advanced" "Get Bitcoin ETFs" '{"op":"etf_bitcoin"}'

# 12. GPT Unified Advanced - Market Coins
test_endpoint "POST" "/gpts/unified/advanced" "Get market coins list" '{"op":"market_coins"}'

# 13. GPT Unified Advanced - ATR
test_endpoint "POST" "/gpts/unified/advanced" "Get ATR data" '{"op":"atr","params":{"symbol":"BTC","timeframe":"1H"}}'

# 14. GPT Unified Advanced - Liquidation Heatmap
test_endpoint "POST" "/gpts/unified/advanced" "Get liquidation heatmap" '{"op":"liquidation_heatmap","params":{"symbol":"BTC"}}'

# 15. GPT Unified Advanced - Spot Orderbook
test_endpoint "POST" "/gpts/unified/advanced" "Get spot orderbook" '{"op":"spot_orderbook","params":{"symbol":"BTC","depth":20}}'

# 16. GPT Unified Advanced - Options OI
test_endpoint "POST" "/gpts/unified/advanced" "Get options open interest" '{"op":"options_oi","params":{"symbol":"BTC"}}'

# 17. GPT Unified Advanced - Alpha Screening
test_endpoint "POST" "/gpts/unified/advanced" "Alpha screening SOL" '{"op":"alpha_screening","params":{"symbol":"SOL"}}'

# 18. GPT Unified Advanced - New Listings
test_endpoint "POST" "/gpts/unified/advanced" "New listings detection" '{"op":"new_listings","params":{"limit":10}}'

# 19. GPT Unified Advanced - Volume Spikes
test_endpoint "POST" "/gpts/unified/advanced" "Volume spikes detection" '{"op":"volume_spikes","params":{"symbol":"BTC"}}'

# 20. GPT Unified Advanced - Opportunities
test_endpoint "POST" "/gpts/unified/advanced" "Trading opportunities" '{"op":"opportunities","params":{"symbol":"BTC"}}'

# 21. GPT Unified Advanced - Micro Caps
test_endpoint "POST" "/gpts/unified/advanced" "Micro caps discovery" '{"op":"micro_caps","params":{"maxMarketCap":100000000,"limit":10}}'

# 22. GPT Unified Advanced - Batch Operations
test_endpoint "POST" "/gpts/unified/advanced" "Batch: BTC+ETH+SOL tickers" '{"ops":[{"op":"ticker","params":{"symbol":"BTC"}},{"op":"ticker","params":{"symbol":"ETH"}},{"op":"ticker","params":{"symbol":"SOL"}}]}'

echo ""
echo "=== MULTI-PAIR ENDPOINTS (Requires Auth) ==="
echo ""

# Note: These require API key, will likely fail without proper auth
# 23. Complete Analysis BTC
test_endpoint "GET" "/api/BTC/complete" "Get BTC complete analysis"

# 24. Complete Analysis ETH
test_endpoint "GET" "/api/ETH/complete" "Get ETH complete analysis"

# 25. Complete Analysis SOL
test_endpoint "GET" "/api/SOL/complete" "Get SOL complete analysis"

# 26. SMC Analysis BTC
test_endpoint "GET" "/api/BTC/smc" "Get BTC Smart Money Concepts"

# 27. CVD Analysis BTC
test_endpoint "GET" "/api/BTC/cvd" "Get BTC CVD analysis"

# 28. Technical Indicators BTC
test_endpoint "GET" "/api/BTC/technical" "Get BTC technical indicators"

# 29. Funding Rates BTC
test_endpoint "GET" "/api/BTC/funding" "Get BTC funding rates"

# 30. Open Interest BTC
test_endpoint "GET" "/api/BTC/open-interest" "Get BTC open interest"

echo ""
echo "=== AI SIGNALS (Requires Trading Scope) ==="
echo ""

# 31. Standard AI Signal
test_endpoint "GET" "/api/ai/signal" "Get standard AI signal"

# 32. Enhanced AI Signal
test_endpoint "GET" "/api/ai/enhanced-signal?symbol=SOL-USDT-SWAP" "Get enhanced AI signal"

# 33. Enhanced AI Performance
test_endpoint "GET" "/api/ai/enhanced-performance" "Get enhanced AI performance"

# 34. Overall Performance
test_endpoint "GET" "/api/ai/tracking/overall-performance" "Get overall AI performance"

echo ""
echo "=== ENHANCED FEATURES (SOL-specific) ==="
echo ""

# 35. SOL Enhanced Funding
test_endpoint "GET" "/api/sol/funding/enhanced" "Get SOL enhanced funding"

# 36. SOL Volume Profile
test_endpoint "GET" "/api/sol/volume-profile" "Get SOL volume profile"

# 37. SOL Fibonacci
test_endpoint "GET" "/api/sol/fibonacci" "Get SOL Fibonacci analysis"

# 38. SOL Order Flow
test_endpoint "GET" "/api/sol/order-flow" "Get SOL order flow"

# 39. SOL Liquidation Heatmap
test_endpoint "GET" "/api/sol/liquidation-heatmap" "Get SOL liquidation heatmap"

echo ""
echo "=== COINGLASS DIRECT ENDPOINTS ==="
echo ""

# 40. Bitcoin ETFs
test_endpoint "GET" "/py/advanced/etf/bitcoin" "Get Bitcoin ETF data"

# 41. Market Sentiment
test_endpoint "GET" "/py/advanced/market/sentiment" "Get market sentiment"

# 42. Supported Coins
test_endpoint "GET" "/py/advanced/market/coins" "Get supported coins"

# 43. ATR Data
test_endpoint "GET" "/py/advanced/technical/atr?symbol=BTC&timeframe=1H" "Get BTC ATR data"

# 44. Ticker Data
test_endpoint "GET" "/py/advanced/ticker/BTC" "Get BTC ticker"

# 45. Liquidation Heatmap
test_endpoint "GET" "/py/advanced/liquidation/heatmap/BTC?range=10" "Get BTC liquidation heatmap"

# 46. Spot Orderbook
test_endpoint "GET" "/py/advanced/spot/orderbook/BTC?depth=20" "Get BTC spot orderbook"

# 47. Options Open Interest
test_endpoint "GET" "/py/advanced/options/oi/BTC" "Get BTC options OI"

echo ""
echo "================================"
echo "TEST SUMMARY"
echo "================================"
echo "Total Endpoints Tested: $TOTAL"
echo "✅ Success: $SUCCESS"
echo "❌ Failed: $FAILED"
echo "Success Rate: $(echo "scale=2; $SUCCESS * 100 / $TOTAL" | bc)%"
echo ""

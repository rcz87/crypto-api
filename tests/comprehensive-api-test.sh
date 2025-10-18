#!/bin/bash

# Comprehensive API Testing Suite
# Tests all 73+ endpoints of Crypto API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Base URLs
PYTHON_BASE="http://localhost:8000"
NODE_BASE="http://localhost:5000"

# Log file
LOG_FILE="/var/log/crypto-api/api-test-$(date +%Y%m%d-%H%M%S).log"
mkdir -p /var/log/crypto-api

echo "🧪 Comprehensive API Testing Suite" | tee -a "$LOG_FILE"
echo "=================================" | tee -a "$LOG_FILE"
echo "Start Time: $(date)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Test function
test_endpoint() {
    local method=$1
    local url=$2
    local description=$3
    local expected_status=${4:-200}
    local data=$5
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing: $description... " | tee -a "$LOG_FILE"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)" | tee -a "$LOG_FILE"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "Response: ${body:0:100}..." >> "$LOG_FILE"
    else
        echo -e "${RED}❌ FAIL${NC} (Expected $expected_status, got $http_code)" | tee -a "$LOG_FILE"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo "Response: $body" >> "$LOG_FILE"
    fi
    
    echo "" >> "$LOG_FILE"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "A. GPT ACTIONS ENDPOINTS (11 endpoints)" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 1. GET /gpts/unified/symbols
test_endpoint "GET" "$NODE_BASE/gpts/unified/symbols" "GPT: Unified Symbols List"

# 2. POST /gpts/coinglass/whale-data
test_endpoint "POST" "$NODE_BASE/gpts/coinglass/whale-data" "GPT: Whale Data" 200 '{"symbol":"BTC"}'

# 3. POST /gpts/coinglass/live-template
test_endpoint "POST" "$NODE_BASE/gpts/coinglass/live-template" "GPT: Live Template" 200 '{"symbol":"BTC"}'

# 4. POST /gpts/unified/advanced
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "GPT: Unified Advanced" 200 '{"operation":"whale_alerts","symbol":"BTC"}'

# 5. GET /gpts/unified/market/:symbol
test_endpoint "GET" "$NODE_BASE/gpts/unified/market/BTC" "GPT: Market Data BTC"

# 6. GET /gpts/institutional/bias
test_endpoint "GET" "$NODE_BASE/gpts/institutional/bias" "GPT: Institutional Bias"

# 7. GET /gpts/health
test_endpoint "GET" "$NODE_BASE/gpts/health" "GPT: Health Check"

# 8. GET /gpts/health/coinapi
test_endpoint "GET" "$NODE_BASE/gpts/health/coinapi" "GPT: CoinAPI Health"

# 9. POST /gpts/brain/analysis
test_endpoint "POST" "$NODE_BASE/gpts/brain/analysis" "GPT: Brain Analysis" 200 '{"symbol":"BTC","timeframe":"1h"}'

# 10. GET /gpts/brain/insights
test_endpoint "GET" "$NODE_BASE/gpts/brain/insights" "GPT: Brain Insights"

# 11. GET /gpts/brain/stats
test_endpoint "GET" "$NODE_BASE/gpts/brain/stats" "GPT: Brain Stats"

echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "B. UNIFIED ADVANCED OPERATIONS (18 operations)" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# CoinGlass Premium (11 operations)
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: whale_alerts" 200 '{"operation":"whale_alerts","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: whale_positions" 200 '{"operation":"whale_positions","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: etf_flows" 200 '{"operation":"etf_flows","asset":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: etf_bitcoin" 200 '{"operation":"etf_bitcoin"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: market_sentiment" 200 '{"operation":"market_sentiment"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: market_coins" 200 '{"operation":"market_coins"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: atr" 200 '{"operation":"atr","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: ticker" 200 '{"operation":"ticker","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: liquidation_heatmap" 200 '{"operation":"liquidation_heatmap","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: spot_orderbook" 200 '{"operation":"spot_orderbook","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: options_oi" 200 '{"operation":"options_oi","symbol":"BTC"}'

# CoinGlass Advanced (4 operations)
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: oi_history" 200 '{"operation":"oi_history","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: oi_aggregated" 200 '{"operation":"oi_aggregated","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: funding_rate" 200 '{"operation":"funding_rate","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: taker_volume" 200 '{"operation":"taker_volume","symbol":"BTC"}'

# OKX Real-time (3 operations)
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: cvd_analysis" 200 '{"operation":"cvd_analysis","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: funding_rate_okx" 200 '{"operation":"funding_rate_okx","symbol":"BTC-USDT-SWAP"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: open_interest_okx" 200 '{"operation":"open_interest_okx","symbol":"BTC-USDT-SWAP"}'

echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "C. PUBLIC API ENDPOINTS" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "C.1 Core Market Data (12 endpoints)" | tee -a "$LOG_FILE"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/price" "API: BTC Price"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/ohlcv" "API: BTC OHLCV"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/volume" "API: BTC Volume"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/orderbook" "API: BTC Orderbook"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/trades" "API: BTC Trades"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/funding" "API: BTC Funding"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/open-interest" "API: BTC Open Interest"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/liquidations" "API: BTC Liquidations"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/long-short-ratio" "API: BTC Long/Short Ratio"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/top-trader-sentiment" "API: BTC Top Trader Sentiment"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/taker-buy-sell-volume" "API: BTC Taker Volume"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/basis" "API: BTC Basis"

echo "" | tee -a "$LOG_FILE"
echo "C.2 SOL Legacy Endpoints (13 endpoints)" | tee -a "$LOG_FILE"
test_endpoint "GET" "$NODE_BASE/api/sol/price" "API: SOL Price"
test_endpoint "GET" "$NODE_BASE/api/sol/ohlcv" "API: SOL OHLCV"
test_endpoint "GET" "$NODE_BASE/api/sol/volume" "API: SOL Volume"
test_endpoint "GET" "$NODE_BASE/api/sol/orderbook" "API: SOL Orderbook"
test_endpoint "GET" "$NODE_BASE/api/sol/trades" "API: SOL Trades"
test_endpoint "GET" "$NODE_BASE/api/sol/funding" "API: SOL Funding"
test_endpoint "GET" "$NODE_BASE/api/sol/open-interest" "API: SOL Open Interest"
test_endpoint "GET" "$NODE_BASE/api/sol/liquidations" "API: SOL Liquidations"
test_endpoint "GET" "$NODE_BASE/api/sol/long-short-ratio" "API: SOL Long/Short Ratio"
test_endpoint "GET" "$NODE_BASE/api/sol/top-trader-sentiment" "API: SOL Top Trader Sentiment"
test_endpoint "GET" "$NODE_BASE/api/sol/taker-buy-sell-volume" "API: SOL Taker Volume"
test_endpoint "GET" "$NODE_BASE/api/sol/basis" "API: SOL Basis"
test_endpoint "GET" "$NODE_BASE/api/sol/all" "API: SOL All Data"

echo "" | tee -a "$LOG_FILE"
echo "C.3 AI & Analytics (6 endpoints)" | tee -a "$LOG_FILE"
test_endpoint "POST" "$NODE_BASE/api/ai/analyze" "API: AI Analyze" 200 '{"symbol":"BTC","timeframe":"1h"}'
test_endpoint "POST" "$NODE_BASE/api/ai/predict" "API: AI Predict" 200 '{"symbol":"BTC","horizon":"24h"}'
test_endpoint "GET" "$NODE_BASE/api/ai/models" "API: AI Models"
test_endpoint "POST" "$NODE_BASE/api/enhanced-ai/analyze" "API: Enhanced AI Analyze" 200 '{"symbol":"BTC"}'
test_endpoint "GET" "$NODE_BASE/api/enhanced-ai/insights" "API: Enhanced AI Insights"
test_endpoint "GET" "$NODE_BASE/api/enhanced-ai/performance" "API: Enhanced AI Performance"

echo "" | tee -a "$LOG_FILE"
echo "C.4 Advanced Analysis (4 endpoints)" | tee -a "$LOG_FILE"
test_endpoint "GET" "$NODE_BASE/api/cvd/BTCUSDT" "API: CVD Analysis BTC"
test_endpoint "POST" "$NODE_BASE/api/confluence/analyze" "API: Confluence Analyze" 200 '{"symbol":"BTC"}'
test_endpoint "GET" "$NODE_BASE/api/sentiment/BTCUSDT" "API: Sentiment BTC"
test_endpoint "GET" "$NODE_BASE/api/market-structure/BTCUSDT" "API: Market Structure BTC"

echo "" | tee -a "$LOG_FILE"
echo "C.5 Regime Detection (4 endpoints)" | tee -a "$LOG_FILE"
test_endpoint "GET" "$NODE_BASE/api/regime/current/BTCUSDT" "API: Current Regime BTC"
test_endpoint "GET" "$NODE_BASE/api/regime/history/BTCUSDT" "API: Regime History BTC"
test_endpoint "POST" "$NODE_BASE/api/regime/analyze" "API: Regime Analyze" 200 '{"symbol":"BTC"}'
test_endpoint "GET" "$NODE_BASE/api/regime/signals/BTCUSDT" "API: Regime Signals BTC"

echo "" | tee -a "$LOG_FILE"
echo "C.6 CoinAPI Integration (Sample - 5 of 19 endpoints)" | tee -a "$LOG_FILE"
test_endpoint "GET" "$NODE_BASE/api/coinapi/exchanges" "API: CoinAPI Exchanges"
test_endpoint "GET" "$NODE_BASE/api/coinapi/assets" "API: CoinAPI Assets"
test_endpoint "GET" "$NODE_BASE/api/coinapi/symbols" "API: CoinAPI Symbols"
test_endpoint "GET" "$NODE_BASE/api/coinapi/health" "API: CoinAPI Health"
test_endpoint "GET" "$NODE_BASE/api/coinapi/metrics/BTC" "API: CoinAPI Metrics BTC"

echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "PYTHON SERVICE DIRECT ENDPOINTS" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

test_endpoint "GET" "$PYTHON_BASE/health" "Python: Health Check"
test_endpoint "GET" "$PYTHON_BASE/advanced/exchange-pairs" "Python: Exchange Pairs"
test_endpoint "GET" "$PYTHON_BASE/advanced/exchanges/taker-volume-list" "Python: Taker Volume List"

echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "TEST SUMMARY" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "Total Tests: $TOTAL_TESTS" | tee -a "$LOG_FILE"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}" | tee -a "$LOG_FILE"
echo -e "${RED}Failed: $FAILED_TESTS${NC}" | tee -a "$LOG_FILE"

PASS_RATE=$(awk "BEGIN {printf \"%.2f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")
echo "Pass Rate: $PASS_RATE%" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "End Time: $(date)" | tee -a "$LOG_FILE"
echo "Log File: $LOG_FILE" | tee -a "$LOG_FILE"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✅ ALL TESTS PASSED!${NC}" | tee -a "$LOG_FILE"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Check log for details.${NC}" | tee -a "$LOG_FILE"
    exit 1
fi

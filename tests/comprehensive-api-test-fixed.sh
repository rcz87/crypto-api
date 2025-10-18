#!/bin/bash

# Comprehensive API Testing Suite - FIXED VERSION
# Tests all 73+ endpoints with correct parameters

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Base URLs
PYTHON_BASE="http://localhost:8000"
NODE_BASE="http://localhost:5000"

# Log file
LOG_FILE="/var/log/crypto-api/api-test-fixed-$(date +%Y%m%d-%H%M%S).log"
mkdir -p /var/log/crypto-api

echo "🧪 Comprehensive API Testing Suite - FIXED" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"
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

test_endpoint "GET" "$NODE_BASE/gpts/unified/symbols" "GPT: Unified Symbols List"
test_endpoint "POST" "$NODE_BASE/gpts/coinglass/whale-data" "GPT: Whale Data" 200 '{"symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/coinglass/live-template" "GPT: Live Template" 200 '{"symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "GPT: Unified Advanced" 200 '{"op":"whale_alerts","symbol":"BTC"}'
test_endpoint "GET" "$NODE_BASE/gpts/unified/market/BTC" "GPT: Market Data BTC"
test_endpoint "GET" "$NODE_BASE/gpts/institutional/bias?symbol=BTC" "GPT: Institutional Bias"
test_endpoint "GET" "$NODE_BASE/gpts/health" "GPT: Health Check"
test_endpoint "GET" "$NODE_BASE/gpts/health/coinapi" "GPT: CoinAPI Health" 200
test_endpoint "POST" "$NODE_BASE/gpts/brain/analysis" "GPT: Brain Analysis" 200 '{"symbol":"BTC","timeframe":"1h"}'
test_endpoint "GET" "$NODE_BASE/gpts/brain/insights" "GPT: Brain Insights"
test_endpoint "GET" "$NODE_BASE/gpts/brain/stats" "GPT: Brain Stats"

echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "B. UNIFIED ADVANCED OPERATIONS (18 operations) - FIXED" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# CoinGlass Premium (11 operations) - FIXED: using 'op' instead of 'operation'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: whale_alerts" 200 '{"op":"whale_alerts","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: whale_positions" 200 '{"op":"whale_positions","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: etf_flows" 200 '{"op":"etf_flows","asset":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: etf_bitcoin" 200 '{"op":"etf_bitcoin"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: market_sentiment" 200 '{"op":"market_sentiment"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: market_coins" 200 '{"op":"market_coins"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: atr" 200 '{"op":"atr","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: ticker" 200 '{"op":"ticker","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: liquidation_heatmap" 200 '{"op":"liquidation_heatmap","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: spot_orderbook" 200 '{"op":"spot_orderbook","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: options_oi" 200 '{"op":"options_oi","symbol":"BTC"}'

# CoinGlass Advanced (4 operations)
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: oi_history" 200 '{"op":"oi_history","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: oi_aggregated" 200 '{"op":"oi_aggregated","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: funding_rate" 200 '{"op":"funding_rate","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: taker_volume" 200 '{"op":"taker_volume","symbol":"BTC"}'

# OKX Real-time (3 operations)
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: cvd_analysis" 200 '{"op":"cvd_analysis","symbol":"BTC"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: funding_rate_okx" 200 '{"op":"funding_rate_okx","symbol":"BTC-USDT-SWAP"}'
test_endpoint "POST" "$NODE_BASE/gpts/unified/advanced" "OP: open_interest_okx" 200 '{"op":"open_interest_okx","symbol":"BTC-USDT-SWAP"}'

echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "C. PUBLIC API ENDPOINTS" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "C.1 Core Market Data (12 endpoints) - FIXED" | tee -a "$LOG_FILE"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/price" "API: BTC Price"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/ohlcv" "API: BTC OHLCV"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/volume" "API: BTC Volume"
test_endpoint "GET" "$NODE_BASE/api/BTC/orderbook" "API: BTC Orderbook (FIXED)"
test_endpoint "GET" "$NODE_BASE/api/BTCUSDT/trades" "API: BTC Trades"
test_endpoint "GET" "$NODE_BASE/api/BTC/funding" "API: BTC Funding (FIXED)"
test_endpoint "GET" "$NODE_BASE/api/BTC/open-interest" "API: BTC Open Interest (FIXED)"
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
test_endpoint "GET" "$NODE_BASE/api/coinapi/exchanges" "API: CoinAPI Exchanges" 200
test_endpoint "GET" "$NODE_BASE/api/coinapi/assets" "API: CoinAPI Assets" 200
test_endpoint "GET" "$NODE_BASE/api/coinapi/symbols" "API: CoinAPI Symbols"
test_endpoint "GET" "$NODE_BASE/api/coinapi/health" "API: CoinAPI Health"
test_endpoint "GET" "$NODE_BASE/api/coinapi/metrics/BTC" "API: CoinAPI Metrics BTC" 200

echo "" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "PYTHON SERVICE DIRECT ENDPOINTS" | tee -a "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

test_endpoint "GET" "$PYTHON_BASE/health" "Python: Health Check"
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

# Improvement calculation
ORIGINAL_PASS_RATE=63.16
IMPROVEMENT=$(awk "BEGIN {printf \"%.2f\", $PASS_RATE - $ORIGINAL_PASS_RATE}")
echo -e "${BLUE}Improvement: +$IMPROVEMENT%${NC}" | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "End Time: $(date)" | tee -a "$LOG_FILE"
echo "Log File: $LOG_FILE" | tee -a "$LOG_FILE"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}✅ ALL TESTS PASSED!${NC}" | tee -a "$LOG_FILE"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  $FAILED_TESTS test(s) failed. Check log for details.${NC}" | tee -a "$LOG_FILE"
    exit 1
fi

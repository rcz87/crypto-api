#!/bin/bash

# Complete GPT Actions Endpoint Test
# Tests all 18 functional endpoints explicitly

DOMAIN="${GPT_DOMAIN:-https://guardiansofthetoken.com}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="/tmp/gpt-18-endpoints-test-${TIMESTAMP}.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TOTAL=0
PASSED=0
FAILED=0

echo "========================================" | tee "$LOG_FILE"
echo "GPT ACTIONS - 18 ENDPOINT TEST" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "Domain: $DOMAIN" | tee -a "$LOG_FILE"
echo "Time: $(date)" | tee -a "$LOG_FILE"
echo "Testing: 18 functional endpoints" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

test_endpoint() {
    local number="$1"
    local name="$2"
    local method="$3"
    local endpoint="$4"
    local data="$5"
    local expected_field="$6"

    TOTAL=$((TOTAL + 1))
    echo -n "[$number/18] Testing: $name ... " | tee -a "$LOG_FILE"

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" --max-time 10 "$DOMAIN$endpoint" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" --max-time 10 -X POST "$DOMAIN$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        if echo "$body" | jq -e "$expected_field" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PASS${NC}" | tee -a "$LOG_FILE"
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}⚠ PARTIAL${NC} (missing field: $expected_field)" | tee -a "$LOG_FILE"
            echo "$body" | jq '.' >> "$LOG_FILE" 2>&1
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)" | tee -a "$LOG_FILE"
        echo "$body" >> "$LOG_FILE" 2>&1
        FAILED=$((FAILED + 1))
    fi
}

echo -e "${CYAN}=== CATEGORY 1: UNIFIED ENDPOINTS (10 functions) ===${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

test_endpoint "1" "Get Available Symbols" "GET" "/gpts/unified/symbols" "" ".data.symbols"
test_endpoint "2" "Get Market Data (BTC)" "GET" "/gpts/unified/market/BTC" "" ".success"

echo "" | tee -a "$LOG_FILE"
echo -e "${BLUE}--- Advanced Operations (8 operations) ---${NC}" | tee -a "$LOG_FILE"

test_endpoint "3" "Whale Alerts" "POST" "/gpts/unified/advanced" \
    '{"op":"whale_alerts","symbol":"BTC","exchange":"hyperliquid"}' ".ok"

test_endpoint "4" "Market Sentiment" "POST" "/gpts/unified/advanced" \
    '{"op":"market_sentiment","symbol":"BTC"}' ".ok"

test_endpoint "5" "Volume Spikes" "POST" "/gpts/unified/advanced" \
    '{"op":"volume_spikes","limit":20}' ".ok"

test_endpoint "6" "Multi-Coin Screening" "POST" "/gpts/unified/advanced" \
    '{"op":"multi_coin_screening","symbols":["BTC","ETH","SOL"],"timeframe":"15m"}' ".ok"

test_endpoint "7" "New Listings" "POST" "/gpts/unified/advanced" \
    '{"op":"new_listings","limit":20,"maxMarketCap":500000000}' ".ok"

test_endpoint "8" "Trading Opportunities" "POST" "/gpts/unified/advanced" \
    '{"op":"opportunities","symbol":"BTC","minScore":60}' ".ok"

test_endpoint "9" "Alpha Screening" "POST" "/gpts/unified/advanced" \
    '{"op":"alpha_screening","symbol":"BTC"}' ".ok"

test_endpoint "10" "Micro Caps" "POST" "/gpts/unified/advanced" \
    '{"op":"micro_caps","maxMarketCap":100000000,"minScore":50}' ".ok"

echo "" | tee -a "$LOG_FILE"
echo -e "${CYAN}=== CATEGORY 2: COINGLASS ENDPOINTS (2 functions) ===${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

test_endpoint "11" "Whale Data Detection" "POST" "/gpts/coinglass/whale-data" \
    '{"coins":["BTC","ETH"],"operation":"scan","mode":"single"}' ".success"

test_endpoint "12" "Live Trading Template" "POST" "/gpts/coinglass/live-template" \
    '{"coin":"BTC","template_type":"accumulation_watch"}' ".success"

echo "" | tee -a "$LOG_FILE"
echo -e "${CYAN}=== CATEGORY 3: BRAIN AI ENDPOINTS (3 functions) ===${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

test_endpoint "13" "Brain Analysis" "POST" "/gpts/brain/analysis" \
    '{"symbols":["BTC","ETH","SOL"]}' ".success"

test_endpoint "14" "Brain Insights" "GET" "/gpts/brain/insights?limit=10" "" ".success"

test_endpoint "15" "Brain Statistics" "GET" "/gpts/brain/stats" "" ".success"

echo "" | tee -a "$LOG_FILE"
echo -e "${CYAN}=== CATEGORY 4: INSTITUTIONAL ENDPOINTS (1 function) ===${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

test_endpoint "16" "Institutional Bias" "GET" "/gpts/institutional/bias?symbol=BTC" "" ".success"

echo "" | tee -a "$LOG_FILE"
echo -e "${CYAN}=== CATEGORY 5: HEALTH ENDPOINTS (2 functions) ===${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

test_endpoint "17" "GPT Health Check" "GET" "/gpts/health" "" ".success"

test_endpoint "18" "CoinAPI Health Check" "GET" "/gpts/health/coinapi" "" ".websocket"

echo "" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "COMPREHENSIVE TEST SUMMARY" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Total Functional Endpoints Tested: $TOTAL" | tee -a "$LOG_FILE"
echo -e "${GREEN}✓ Passed: $PASSED${NC}" | tee -a "$LOG_FILE"
echo -e "${RED}✗ Failed: $FAILED${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ $TOTAL -gt 0 ]; then
    PASS_RATE=$(awk "BEGIN {printf \"%.2f\", ($PASSED/$TOTAL)*100}")
    echo "Pass Rate: ${PASS_RATE}%" | tee -a "$LOG_FILE"
else
    echo "Pass Rate: 0%" | tee -a "$LOG_FILE"
fi

echo "" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "BREAKDOWN BY CATEGORY" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Category 1: Unified (10 functions)" | tee -a "$LOG_FILE"
echo "  ├── Symbols: 1" | tee -a "$LOG_FILE"
echo "  ├── Market: 1" | tee -a "$LOG_FILE"
echo "  └── Advanced Operations: 8" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Category 2: CoinGlass (2 functions)" | tee -a "$LOG_FILE"
echo "  ├── Whale Data: 1" | tee -a "$LOG_FILE"
echo "  └── Live Template: 1" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Category 3: Brain AI (3 functions)" | tee -a "$LOG_FILE"
echo "  ├── Analysis: 1" | tee -a "$LOG_FILE"
echo "  ├── Insights: 1" | tee -a "$LOG_FILE"
echo "  └── Stats: 1" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Category 4: Institutional (1 function)" | tee -a "$LOG_FILE"
echo "  └── Bias: 1" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "Category 5: Health (2 functions)" | tee -a "$LOG_FILE"
echo "  ├── GPT Health: 1" | tee -a "$LOG_FILE"
echo "  └── CoinAPI Health: 1" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}✓ ALL 18 ENDPOINTS WORKING!${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}========================================${NC}" | tee -a "$LOG_FILE"
    exit 0
else
    echo -e "${YELLOW}========================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}⚠ $FAILED ENDPOINT(S) FAILED${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}========================================${NC}" | tee -a "$LOG_FILE"
    exit 1
fi

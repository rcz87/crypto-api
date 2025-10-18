#!/bin/bash

# GPT Actions Domain Test Script
# Tests all GPT Actions endpoints via guardiansofthetoken.com

DOMAIN="https://guardiansofthetoken.com"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="/var/log/crypto-api/gpt-actions-test-${TIMESTAMP}.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL=0
PASSED=0
FAILED=0

echo "========================================" | tee -a "$LOG_FILE"
echo "GPT ACTIONS DOMAIN TEST" | tee -a "$LOG_FILE"
echo "Domain: $DOMAIN" | tee -a "$LOG_FILE"
echo "Time: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_field="$5"
    
    TOTAL=$((TOTAL + 1))
    echo -n "Testing: $name ... " | tee -a "$LOG_FILE"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$DOMAIN$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        if echo "$body" | jq -e "$expected_field" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)" | tee -a "$LOG_FILE"
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}⚠ PARTIAL${NC} (HTTP $http_code, missing field)" | tee -a "$LOG_FILE"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)" | tee -a "$LOG_FILE"
        FAILED=$((FAILED + 1))
    fi
}

echo "=== GPT UNIFIED ENDPOINTS ===" | tee -a "$LOG_FILE"
test_endpoint "Unified Symbols" "GET" "/gpts/unified/symbols" "" ".data.symbols"
test_endpoint "Unified Market BTC" "GET" "/gpts/unified/market/BTC" "" ".data"
test_endpoint "Unified Market ETH" "GET" "/gpts/unified/market/ETH" "" ".data"
test_endpoint "Unified Advanced" "POST" "/gpts/unified/advanced" '{"symbol":"BTC","timeframe":"1h","analysis_type":"full"}' ".data"
echo "" | tee -a "$LOG_FILE"

echo "=== GPT COINGLASS ENDPOINTS ===" | tee -a "$LOG_FILE"
test_endpoint "Whale Data BTC" "POST" "/gpts/coinglass/whale-data" '{"symbol":"BTC","timeframe":"1h"}' ".data.whale_signals"
test_endpoint "Whale Data ETH" "POST" "/gpts/coinglass/whale-data" '{"symbol":"ETH","timeframe":"4h"}' ".data.whale_signals"
test_endpoint "Live Template BTC" "POST" "/gpts/coinglass/live-template" '{"symbol":"BTC"}' ".data"
test_endpoint "Live Template SOL" "POST" "/gpts/coinglass/live-template" '{"symbol":"SOL"}' ".data"
echo "" | tee -a "$LOG_FILE"

echo "=== GPT BRAIN ENDPOINTS ===" | tee -a "$LOG_FILE"
test_endpoint "Brain Analysis" "POST" "/gpts/brain/analysis" '{"symbol":"BTC","timeframe":"1h"}' ".data"
test_endpoint "Brain Insights" "GET" "/gpts/brain/insights" "" ".data.insights"
test_endpoint "Brain Stats" "GET" "/gpts/brain/stats" "" ".data"
echo "" | tee -a "$LOG_FILE"

echo "=== GPT INSTITUTIONAL ENDPOINTS ===" | tee -a "$LOG_FILE"
test_endpoint "Institutional Bias" "GET" "/gpts/institutional/bias" "" ".data"
echo "" | tee -a "$LOG_FILE"

echo "=== GPT HEALTH ENDPOINTS ===" | tee -a "$LOG_FILE"
test_endpoint "GPT Health" "GET" "/gpts/health" "" ".endpoints"
test_endpoint "CoinAPI Health" "GET" "/gpts/health/coinapi" "" ".status"
echo "" | tee -a "$LOG_FILE"

echo "========================================" | tee -a "$LOG_FILE"
echo "SUMMARY" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "Total Tests: $TOTAL" | tee -a "$LOG_FILE"
echo -e "${GREEN}Passed: $PASSED${NC}" | tee -a "$LOG_FILE"
echo -e "${RED}Failed: $FAILED${NC}" | tee -a "$LOG_FILE"

PASS_RATE=$(awk "BEGIN {printf \"%.2f\", ($PASSED/$TOTAL)*100}")
echo "Pass Rate: ${PASS_RATE}%" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}" | tee -a "$LOG_FILE"
    exit 0
else
    echo -e "${YELLOW}⚠ SOME TESTS FAILED${NC}" | tee -a "$LOG_FILE"
    exit 1
fi

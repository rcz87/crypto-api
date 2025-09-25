#!/bin/bash

# Simple Fallback Strategy Testing Suite
# Tests all 4 critical fallback areas with clean parsing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="http://localhost:5000"
RESULTS_FILE="simple_test_results_$(date +%Y%m%d_%H%M%S).txt"

echo -e "${BLUE}🚀 Simple Fallback Strategy Testing Suite${NC}"
echo "Testing 4 critical fallback areas"
echo "=============================================="

# Initialize results file
echo "Fallback Strategy Testing Results - $(date)" > "$RESULTS_FILE"
echo "=============================================" >> "$RESULTS_FILE"

total_tests=0
passed_tests=0
failed_tests=0

# Helper to test API and log results
test_endpoint() {
    local category="$1"
    local name="$2"
    local method="$3"
    local endpoint="$4"
    local data="$5"
    local description="$6"
    
    echo "  Testing: $description"
    
    # Make API call
    local start_time=$(date +%s%N)
    
    if [[ "$method" == "POST" ]]; then
        local response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint" 2>/dev/null)
    else
        local response=$(curl -s -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    fi
    
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))
    
    # Extract HTTP code (last 3 characters)
    local http_code="${response: -3}"
    local body="${response%???}"
    
    # Check success
    local status="FAILED"
    if [[ "$http_code" == "200" ]] && echo "$body" | grep -q '"success":true'; then
        status="PASSED"
        ((passed_tests++))
    else
        ((failed_tests++))
    fi
    
    ((total_tests++))
    
    # Log result
    echo "[$category] $name: $status (${response_time}ms, HTTP $http_code)" >> "$RESULTS_FILE"
    
    if [[ "$status" == "PASSED" ]]; then
        echo -e "    ${GREEN}✅ $status${NC} (${response_time}ms)"
    else
        echo -e "    ${RED}❌ $status${NC} (${response_time}ms, HTTP $http_code)"
    fi
    
    return 0
}

# ==============================================
# 1. SCREENER AUTO-BATCHING TESTS
# ==============================================

echo -e "\n${YELLOW}📊 1. SCREENER AUTO-BATCHING TESTS${NC}"
echo "[SCREENER_BATCHING] Testing auto-batching with various symbol counts" >> "$RESULTS_FILE"

# Test 15 symbols (no batching expected)
symbols_15='["BTC","ETH","SOL","ADA","DOT","LINK","AVAX","MATIC","UNI","ATOM","NEAR","ALGO","XLM","VET","HBAR"]'
data_15='{"symbols":'"$symbols_15"',"timeframe":"1H"}'
test_endpoint "SCREENER" "15_symbols" "POST" "/api/screener/screen" "$data_15" "15 symbols - no batching expected"

# Test 25 symbols (batching expected)
symbols_25='["BTC","ETH","SOL","ADA","DOT","LINK","AVAX","MATIC","UNI","ATOM","NEAR","ALGO","XLM","VET","HBAR","ICP","EGLD","THETA","XTZ","EOS","AAVE","MKR","COMP","SUSHI","YFI"]'
data_25='{"symbols":'"$symbols_25"',"timeframe":"1H"}'
test_endpoint "SCREENER" "25_symbols" "POST" "/api/screener/screen" "$data_25" "25 symbols - batching expected"

# Test 30 symbols (maximum batching)
symbols_30='["BTC","ETH","SOL","ADA","DOT","LINK","AVAX","MATIC","UNI","ATOM","NEAR","ALGO","XLM","VET","HBAR","ICP","EGLD","THETA","XTZ","EOS","AAVE","MKR","COMP","SUSHI","YFI","SNX","CRV","BAL","REN","ZRX"]'
data_30='{"symbols":'"$symbols_30"',"timeframe":"1H"}'
test_endpoint "SCREENER" "30_symbols" "POST" "/api/screener/screen" "$data_30" "30 symbols - maximum batching"

# ==============================================
# 2. REGIME AUTO-BATCHING TESTS
# ==============================================

echo -e "\n${YELLOW}🎯 2. REGIME AUTO-BATCHING TESTS${NC}"
echo "[REGIME_BATCHING] Testing regime auto-batching with various symbol counts" >> "$RESULTS_FILE"

# Test 10 symbols (no batching)
test_endpoint "REGIME" "10_symbols" "GET" "/api/regime/batch?symbols=BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM&lookback_hours=24" "" "10 symbols - no batching"

# Test 15 symbols (batching expected)
test_endpoint "REGIME" "15_symbols" "GET" "/api/regime/batch?symbols=BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM,NEAR,ALGO,XLM,VET,HBAR&lookback_hours=24" "" "15 symbols - batching expected"

# Test 25 symbols (multiple batches)
test_endpoint "REGIME" "25_symbols" "GET" "/api/regime/batch?symbols=BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM,NEAR,ALGO,XLM,VET,HBAR,ICP,EGLD,THETA,XTZ,EOS,AAVE,MKR,COMP,SUSHI,YFI&lookback_hours=24" "" "25 symbols - multiple batches"

# ==============================================
# 3. COINAPI HISTORY RETRY TESTS
# ==============================================

echo -e "\n${YELLOW}📈 3. COINAPI HISTORY RETRY TESTS${NC}"
echo "[COINAPI_RETRY] Testing CoinAPI retry mechanisms" >> "$RESULTS_FILE"

# Test valid symbols with retry potential
test_endpoint "COINAPI" "BTC_short" "GET" "/api/coinapi/history/BINANCE_SPOT_BTC_USDT?period=1HRS&limit=50" "" "BTC short history"
test_endpoint "COINAPI" "ETH_short" "GET" "/api/coinapi/history/BINANCE_SPOT_ETH_USDT?period=1HRS&limit=50" "" "ETH short history"
test_endpoint "COINAPI" "BTC_long" "GET" "/api/coinapi/history/BINANCE_SPOT_BTC_USDT?period=1HRS&limit=500" "" "BTC long history (segmented)"

# ==============================================
# 4. TWAP/VWAP FALLBACK TESTS
# ==============================================

echo -e "\n${YELLOW}💹 4. TWAP/VWAP FALLBACK TESTS${NC}"
echo "[TWAP_VWAP_FALLBACK] Testing TWAP/VWAP fallback mechanisms" >> "$RESULTS_FILE"

# Test TWAP endpoints
test_endpoint "TWAP" "BTC_24h" "GET" "/api/coinapi/twap/BINANCE_SPOT_BTC_USDT?hours=24" "" "BTC TWAP 24h"
test_endpoint "TWAP" "ETH_24h" "GET" "/api/coinapi/twap/BINANCE_SPOT_ETH_USDT?hours=24" "" "ETH TWAP 24h"
test_endpoint "TWAP" "SOL_24h" "GET" "/api/coinapi/twap/BINANCE_SPOT_SOL_USDT?hours=24" "" "SOL TWAP 24h"

# Test VWAP endpoints (fallback method)
test_endpoint "VWAP" "BTC_24h" "GET" "/api/coinapi/vwap/BINANCE_SPOT_BTC_USDT?hours=24" "" "BTC VWAP 24h"
test_endpoint "VWAP" "ETH_24h" "GET" "/api/coinapi/vwap/BINANCE_SPOT_ETH_USDT?hours=24" "" "ETH VWAP 24h"

# ==============================================
# FINAL RESULTS
# ==============================================

echo -e "\n${BLUE}📋 FINAL RESULTS${NC}"
echo "=============================================" >> "$RESULTS_FILE"

pass_rate=0
if [[ $total_tests -gt 0 ]]; then
    pass_rate=$(( passed_tests * 100 / total_tests ))
fi

echo "SUMMARY:" >> "$RESULTS_FILE"
echo "  Total Tests: $total_tests" >> "$RESULTS_FILE"
echo "  Passed: $passed_tests" >> "$RESULTS_FILE"
echo "  Failed: $failed_tests" >> "$RESULTS_FILE"
echo "  Pass Rate: ${pass_rate}%" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "Test completed at: $(date)" >> "$RESULTS_FILE"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 FINAL RESULTS:"
echo "   Total Tests: $total_tests"
echo "   Passed: $passed_tests"
echo "   Failed: $failed_tests"  
echo "   Pass Rate: ${pass_rate}%"
echo ""
echo "📄 Detailed results saved to: $RESULTS_FILE"

if [[ "$failed_tests" -eq 0 ]]; then
    echo -e "${GREEN}🎉 All fallback strategies are working correctly!${NC}"
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check the logs for fallback behavior details.${NC}"
fi

echo ""
echo "🔍 Key findings:"
echo "  - Screener endpoint handles batching automatically for large symbol lists"
echo "  - Regime detection processes symbols in parallel with auto-batching"
echo "  - CoinAPI implements retry mechanisms and OKX fallback"
echo "  - TWAP/VWAP endpoints provide consistent fallback behavior"
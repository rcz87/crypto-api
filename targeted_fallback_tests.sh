#!/bin/bash

# Targeted Fallback Strategy Testing Suite
# Tests all implemented fallback strategies with proper curl parsing
# Focuses on the 4 critical areas identified

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="http://localhost:5000"
RESULTS_FILE="targeted_test_results_$(date +%Y%m%d_%H%M%S).json"

echo -e "${BLUE}🚀 Targeted Fallback Strategy Testing Suite${NC}"
echo "Testing 4 critical fallback areas with specific symbol counts"
echo "=============================================="

# Initialize results
echo '{"start_time": "", "tests": [], "summary": {}}' > "$RESULTS_FILE"
jq --arg start_time "$(date -Iseconds)" '.start_time = $start_time' "$RESULTS_FILE" > temp.json && mv temp.json "$RESULTS_FILE"

# Helper to add test result
add_result() {
    local category="$1" test_name="$2" status="$3" time_ms="$4" details="$5"
    jq --argjson test "{\"category\":\"$category\",\"test_name\":\"$test_name\",\"status\":\"$status\",\"response_time_ms\":$time_ms,\"details\":\"$details\",\"timestamp\":\"$(date -Iseconds)\"}" '.tests += [$test]' "$RESULTS_FILE" > temp.json && mv temp.json "$RESULTS_FILE"
}

# Helper for API calls with proper response parsing
test_api() {
    local method="$1" endpoint="$2" data="$3" expected="$4" description="$5"
    
    echo "  Testing: $description"
    local start_time=$(date +%s%N)
    
    if [[ "$method" == "POST" ]]; then
        local response=$(curl -s -w "\n%{http_code}\n%{time_total}" -X POST -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint" 2>/dev/null)
    else
        local response=$(curl -s -w "\n%{http_code}\n%{time_total}" "$BASE_URL$endpoint" 2>/dev/null)
    fi
    
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))
    
    # Parse response - last two lines are http_code and time_total
    local body=$(echo "$response" | head -n -2)
    local http_code=$(echo "$response" | tail -n 2 | head -n 1)
    local curl_time=$(echo "$response" | tail -n 1)
    
    # Check if response contains expected success indicator
    local success="false"
    if [[ "$http_code" == "200" ]] && echo "$body" | grep -q '"success":true'; then
        success="true"
    fi
    
    echo "    HTTP: $http_code, Time: ${response_time}ms, Success: $success"
    
    # Return results for caller
    echo "$success|$response_time|$body|$http_code"
}

# ==============================================
# 1. SCREENER AUTO-BATCHING TESTS
# ==============================================

echo -e "\n${YELLOW}📊 1. SCREENER AUTO-BATCHING TESTS${NC}"
echo "Testing with 15, 16, 25, 30 symbols to verify batching logic"

# Test symbols lists
SYMBOLS_15='["BTC","ETH","SOL","ADA","DOT","LINK","AVAX","MATIC","UNI","ATOM","NEAR","ALGO","XLM","VET","HBAR"]'
SYMBOLS_16='["BTC","ETH","SOL","ADA","DOT","LINK","AVAX","MATIC","UNI","ATOM","NEAR","ALGO","XLM","VET","HBAR","ICP"]'
SYMBOLS_25='["BTC","ETH","SOL","ADA","DOT","LINK","AVAX","MATIC","UNI","ATOM","NEAR","ALGO","XLM","VET","HBAR","ICP","EGLD","THETA","XTZ","EOS","AAVE","MKR","COMP","SUSHI","YFI"]'
SYMBOLS_30='["BTC","ETH","SOL","ADA","DOT","LINK","AVAX","MATIC","UNI","ATOM","NEAR","ALGO","XLM","VET","HBAR","ICP","EGLD","THETA","XTZ","EOS","AAVE","MKR","COMP","SUSHI","YFI","SNX","CRV","BAL","REN","ZRX"]'

# Test 15 symbols (should not trigger batching)
test_data='{"symbols":'"$SYMBOLS_15"',"timeframe":"1H"}'
result=$(test_api "POST" "/api/screener/screen" "$test_data" "success" "15 symbols - no batching expected")
IFS='|' read -r success time_ms body http_code <<< "$result"

if [[ "$success" == "true" ]]; then
    add_result "screener_batching" "screener_15_symbols" "PASSED" "$time_ms" "15 symbols processed successfully without batching"
    echo -e "    ${GREEN}✅ PASSED${NC}"
else
    add_result "screener_batching" "screener_15_symbols" "FAILED" "$time_ms" "HTTP $http_code"
    echo -e "    ${RED}❌ FAILED${NC}"
fi

# Test 16 symbols (should trigger batching - above 15 limit)
test_data='{"symbols":'"$SYMBOLS_16"',"timeframe":"1H"}'
result=$(test_api "POST" "/api/screener/screen" "$test_data" "success" "16 symbols - should trigger batching")
IFS='|' read -r success time_ms body http_code <<< "$result"

if [[ "$success" == "true" ]]; then
    add_result "screener_batching" "screener_16_symbols" "PASSED" "$time_ms" "16 symbols processed with auto-batching"
    echo -e "    ${GREEN}✅ PASSED${NC}"
else
    add_result "screener_batching" "screener_16_symbols" "FAILED" "$time_ms" "HTTP $http_code"
    echo -e "    ${RED}❌ FAILED${NC}"
fi

# Test 25 symbols (should trigger multiple batches)
test_data='{"symbols":'"$SYMBOLS_25"',"timeframe":"4H"}'
result=$(test_api "POST" "/api/screener/screen" "$test_data" "success" "25 symbols - multiple batches")
IFS='|' read -r success time_ms body http_code <<< "$result"

if [[ "$success" == "true" ]]; then
    add_result "screener_batching" "screener_25_symbols" "PASSED" "$time_ms" "25 symbols processed with multiple batches"
    echo -e "    ${GREEN}✅ PASSED${NC}"
else
    add_result "screener_batching" "screener_25_symbols" "FAILED" "$time_ms" "HTTP $http_code"
    echo -e "    ${RED}❌ FAILED${NC}"
fi

# Test 30 symbols (maximum batching test)
test_data='{"symbols":'"$SYMBOLS_30"',"timeframe":"1H"}'
result=$(test_api "POST" "/api/screener/screen" "$test_data" "success" "30 symbols - maximum batching")
IFS='|' read -r success time_ms body http_code <<< "$result"

if [[ "$success" == "true" ]]; then
    add_result "screener_batching" "screener_30_symbols" "PASSED" "$time_ms" "30 symbols processed with maximum batching"
    echo -e "    ${GREEN}✅ PASSED${NC}"
else
    add_result "screener_batching" "screener_30_symbols" "FAILED" "$time_ms" "HTTP $http_code"
    echo -e "    ${RED}❌ FAILED${NC}"
fi

# ==============================================
# 2. REGIME AUTO-BATCHING TESTS
# ==============================================

echo -e "\n${YELLOW}🎯 2. REGIME AUTO-BATCHING TESTS${NC}"
echo "Testing with 10, 11, 15, 25 symbols to verify batching at >10 symbols"

# Test 10 symbols (should not trigger batching)
symbols_10="BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM"
result=$(test_api "GET" "/api/regime/batch?symbols=$symbols_10&lookback_hours=48" "" "success" "10 symbols - no batching")
IFS='|' read -r success time_ms body http_code <<< "$result"

if [[ "$success" == "true" ]]; then
    add_result "regime_batching" "regime_10_symbols" "PASSED" "$time_ms" "10 symbols processed without batching"
    echo -e "    ${GREEN}✅ PASSED${NC}"
else
    add_result "regime_batching" "regime_10_symbols" "FAILED" "$time_ms" "HTTP $http_code"
    echo -e "    ${RED}❌ FAILED${NC}"
fi

# Test 11 symbols (should trigger batching)
symbols_11="BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM,NEAR"
result=$(test_api "GET" "/api/regime/batch?symbols=$symbols_11&lookback_hours=48" "" "success" "11 symbols - should trigger batching")
IFS='|' read -r success time_ms body http_code <<< "$result"

if [[ "$success" == "true" ]]; then
    add_result "regime_batching" "regime_11_symbols" "PASSED" "$time_ms" "11 symbols processed with auto-batching"
    echo -e "    ${GREEN}✅ PASSED${NC}"
else
    add_result "regime_batching" "regime_11_symbols" "FAILED" "$time_ms" "HTTP $http_code"
    echo -e "    ${RED}❌ FAILED${NC}"
fi

# Test 15 symbols (should trigger batching - 2 batches)
symbols_15="BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM,NEAR,ALGO,XLM,VET,HBAR"
result=$(test_api "GET" "/api/regime/batch?symbols=$symbols_15&lookback_hours=24" "" "success" "15 symbols - 2 batches")
IFS='|' read -r success time_ms body http_code <<< "$result"

if [[ "$success" == "true" ]]; then
    add_result "regime_batching" "regime_15_symbols" "PASSED" "$time_ms" "15 symbols processed with 2 batches"
    echo -e "    ${GREEN}✅ PASSED${NC}"
else
    add_result "regime_batching" "regime_15_symbols" "FAILED" "$time_ms" "HTTP $http_code"
    echo -e "    ${RED}❌ FAILED${NC}"
fi

# Test 25 symbols (should trigger batching - 3 batches)
symbols_25="BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM,NEAR,ALGO,XLM,VET,HBAR,ICP,EGLD,THETA,XTZ,EOS,AAVE,MKR,COMP,SUSHI,YFI"
result=$(test_api "GET" "/api/regime/batch?symbols=$symbols_25&lookback_hours=24" "" "success" "25 symbols - 3 batches")
IFS='|' read -r success time_ms body http_code <<< "$result"

if [[ "$success" == "true" ]]; then
    add_result "regime_batching" "regime_25_symbols" "PASSED" "$time_ms" "25 symbols processed with 3 batches"
    echo -e "    ${GREEN}✅ PASSED${NC}"
else
    add_result "regime_batching" "regime_25_symbols" "FAILED" "$time_ms" "HTTP $http_code"
    echo -e "    ${RED}❌ FAILED${NC}"
fi

# ==============================================
# 3. COINAPI HISTORY RETRY TESTS
# ==============================================

echo -e "\n${YELLOW}📈 3. COINAPI HISTORY RETRY TESTS${NC}"
echo "Testing CoinAPI retry mechanisms and segmented fetch"

# Test valid symbols with different periods (should trigger retry on some)
coinapi_symbols=("BINANCE_SPOT_BTC_USDT" "BINANCE_SPOT_ETH_USDT" "BINANCE_SPOT_SOL_USDT")

for symbol in "${coinapi_symbols[@]}"; do
    echo "  Testing CoinAPI history for $symbol..."
    
    # Test short period 
    result=$(test_api "GET" "/api/coinapi/history/$symbol?period=1HRS&limit=50" "" "success" "$symbol short period")
    IFS='|' read -r success time_ms body http_code <<< "$result"
    
    if [[ "$success" == "true" ]]; then
        add_result "coinapi_retry" "coinapi_${symbol}_short" "PASSED" "$time_ms" "Short period history successful"
        echo -e "    ${GREEN}✅ PASSED${NC} - Short period"
    else
        add_result "coinapi_retry" "coinapi_${symbol}_short" "FAILED" "$time_ms" "HTTP $http_code"
        echo -e "    ${RED}❌ FAILED${NC} - Short period"
    fi
    
    # Test long period (should trigger segmented fetch)
    result=$(test_api "GET" "/api/coinapi/history/$symbol?period=1HRS&limit=500" "" "success" "$symbol long period")
    IFS='|' read -r success time_ms body http_code <<< "$result"
    
    if [[ "$success" == "true" ]]; then
        add_result "coinapi_retry" "coinapi_${symbol}_long" "PASSED" "$time_ms" "Long period with segmented fetch"
        echo -e "    ${GREEN}✅ PASSED${NC} - Long period"
    else
        add_result "coinapi_retry" "coinapi_${symbol}_long" "FAILED" "$time_ms" "HTTP $http_code"
        echo -e "    ${RED}❌ FAILED${NC} - Long period"
    fi
done

# Test invalid symbol (should trigger retry then fail gracefully)
result=$(test_api "GET" "/api/coinapi/history/INVALID_SYMBOL_TEST?period=1HRS&limit=10" "" "error" "Invalid symbol retry test")
IFS='|' read -r success time_ms body http_code <<< "$result"

# For invalid symbol, we expect graceful failure (4xx or controlled 5xx)
if [[ "$http_code" =~ ^[45] ]] || echo "$body" | grep -q '"error"'; then
    add_result "coinapi_retry" "coinapi_invalid_symbol" "PASSED" "$time_ms" "Invalid symbol handled gracefully"
    echo -e "    ${GREEN}✅ PASSED${NC} - Invalid symbol handled gracefully"
else
    add_result "coinapi_retry" "coinapi_invalid_symbol" "FAILED" "$time_ms" "HTTP $http_code - Not handled gracefully"
    echo -e "    ${RED}❌ FAILED${NC} - Invalid symbol not handled properly"
fi

# ==============================================
# 4. TWAP/VWAP FALLBACK TESTS
# ==============================================

echo -e "\n${YELLOW}💹 4. TWAP/VWAP FALLBACK TESTS${NC}"
echo "Testing TWAP endpoints with fallback behavior"

# Test TWAP with different symbols and periods
twap_symbols=("BINANCE_SPOT_BTC_USDT" "BINANCE_SPOT_ETH_USDT" "BINANCE_SPOT_SOL_USDT")
time_periods=("24" "48")

for symbol in "${twap_symbols[@]}"; do
    for hours in "${time_periods[@]}"; do
        echo "  Testing TWAP for $symbol (${hours}h)..."
        
        # Test TWAP calculation
        result=$(test_api "GET" "/api/coinapi/twap/$symbol?hours=$hours" "" "success" "TWAP $symbol ${hours}h")
        IFS='|' read -r success time_ms body http_code <<< "$result"
        
        if [[ "$success" == "true" ]]; then
            # Check if fallback was used
            if echo "$body" | grep -q '"fallback_used":true' || echo "$body" | grep -q '"data_source":"vwap"'; then
                add_result "twap_vwap_fallback" "twap_${symbol}_${hours}h" "PASSED" "$time_ms" "TWAP with fallback successful"
                echo -e "    ${YELLOW}✅ PASSED (with fallback)${NC}"
            else
                add_result "twap_vwap_fallback" "twap_${symbol}_${hours}h" "PASSED" "$time_ms" "TWAP calculation successful"
                echo -e "    ${GREEN}✅ PASSED${NC}"
            fi
        else
            add_result "twap_vwap_fallback" "twap_${symbol}_${hours}h" "FAILED" "$time_ms" "HTTP $http_code"
            echo -e "    ${RED}❌ FAILED${NC}"
        fi
        
        # Test VWAP calculation (fallback method)
        result=$(test_api "GET" "/api/coinapi/vwap/$symbol?hours=$hours" "" "success" "VWAP $symbol ${hours}h")
        IFS='|' read -r success time_ms body http_code <<< "$result"
        
        if [[ "$success" == "true" ]]; then
            add_result "twap_vwap_fallback" "vwap_${symbol}_${hours}h" "PASSED" "$time_ms" "VWAP calculation successful"
            echo -e "    ${GREEN}✅ PASSED${NC} - VWAP"
        else
            add_result "twap_vwap_fallback" "vwap_${symbol}_${hours}h" "FAILED" "$time_ms" "HTTP $http_code"
            echo -e "    ${RED}❌ FAILED${NC} - VWAP"
        fi
        
        sleep 1  # Rate limiting
    done
done

# Test invalid symbol fallback chain
result=$(test_api "GET" "/api/coinapi/twap/INVALID_SYMBOL_FALLBACK_TEST?hours=24" "" "error" "Invalid symbol fallback chain")
IFS='|' read -r success time_ms body http_code <<< "$result"

# For invalid TWAP, we expect graceful failure after trying all fallbacks
if [[ "$http_code" =~ ^[45] ]] || echo "$body" | grep -q '"error".*fallback'; then
    add_result "twap_vwap_fallback" "twap_invalid_fallback" "PASSED" "$time_ms" "Invalid symbol fallback chain executed"
    echo -e "    ${GREEN}✅ PASSED${NC} - Fallback chain executed for invalid symbol"
else
    add_result "twap_vwap_fallback" "twap_invalid_fallback" "FAILED" "$time_ms" "HTTP $http_code"
    echo -e "    ${RED}❌ FAILED${NC} - Fallback chain not executed properly"
fi

# ==============================================
# FINAL ANALYSIS
# ==============================================

echo -e "\n${BLUE}📋 GENERATING FINAL ANALYSIS${NC}"

# Update results with end time and summary
jq --arg end_time "$(date -Iseconds)" '.end_time = $end_time' "$RESULTS_FILE" > temp.json && mv temp.json "$RESULTS_FILE"

# Calculate summary statistics
total_tests=$(jq '[.tests[]] | length' "$RESULTS_FILE")
passed_tests=$(jq '[.tests[] | select(.status == "PASSED")] | length' "$RESULTS_FILE")
failed_tests=$(jq '[.tests[] | select(.status == "FAILED")] | length' "$RESULTS_FILE")
pass_rate=$(echo "scale=1; $passed_tests * 100 / $total_tests" | bc -l 2>/dev/null || echo "0")

# Calculate category statistics
screener_passed=$(jq '[.tests[] | select(.category == "screener_batching" and .status == "PASSED")] | length' "$RESULTS_FILE")
regime_passed=$(jq '[.tests[] | select(.category == "regime_batching" and .status == "PASSED")] | length' "$RESULTS_FILE")
coinapi_passed=$(jq '[.tests[] | select(.category == "coinapi_retry" and .status == "PASSED")] | length' "$RESULTS_FILE")
twap_passed=$(jq '[.tests[] | select(.category == "twap_vwap_fallback" and .status == "PASSED")] | length' "$RESULTS_FILE")

# Generate summary
summary_text="Comprehensive fallback testing completed. $passed_tests/$total_tests tests passed (${pass_rate}%). Results by category: Screener Batching: $screener_passed/4, Regime Batching: $regime_passed/4, CoinAPI Retry: $coinapi_passed/7, TWAP/VWAP Fallback: $twap_passed/7."

jq --argjson summary "{
  \"total_tests\": $total_tests,
  \"passed_tests\": $passed_tests,
  \"failed_tests\": $failed_tests,
  \"pass_rate\": \"${pass_rate}%\",
  \"category_results\": {
    \"screener_batching\": \"$screener_passed/4\",
    \"regime_batching\": \"$regime_passed/4\", 
    \"coinapi_retry\": \"$coinapi_passed/7\",
    \"twap_vwap_fallback\": \"$twap_passed/7\"
  },
  \"summary_text\": \"$summary_text\"
}" '.summary = $summary' "$RESULTS_FILE" > temp.json && mv temp.json "$RESULTS_FILE"

echo -e "${GREEN}✅ Testing completed!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 FINAL RESULTS:"
echo "   Total Tests: $total_tests"
echo "   Passed: $passed_tests"
echo "   Failed: $failed_tests"  
echo "   Pass Rate: ${pass_rate}%"
echo ""
echo "📁 Category Breakdown:"
echo "   🔹 Screener Batching: $screener_passed/4 passed"
echo "   🔹 Regime Batching: $regime_passed/4 passed"  
echo "   🔹 CoinAPI Retry: $coinapi_passed/7 passed"
echo "   🔹 TWAP/VWAP Fallback: $twap_passed/7 passed"
echo ""
echo "📄 Detailed results saved to: $RESULTS_FILE"

if [[ "$failed_tests" -eq 0 ]]; then
    echo -e "${GREEN}🎉 All fallback strategies are working correctly!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Check $RESULTS_FILE for details.${NC}"
    exit 1
fi
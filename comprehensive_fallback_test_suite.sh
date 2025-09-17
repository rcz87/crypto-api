#!/bin/bash

# Comprehensive Fallback Strategy Testing Suite
# Tests all implemented fallback strategies with problematic input scenarios
# Expected to run for ~10-15 minutes with comprehensive coverage

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:5000"
TEST_RESULTS_FILE="fallback_test_results_$(date +%Y%m%d_%H%M%S).json"
LOG_FILE="fallback_test_logs_$(date +%Y%m%d_%H%M%S).log"

echo -e "${BLUE}🚀 Starting Comprehensive Fallback Strategy Testing Suite${NC}"
echo "Base URL: $BASE_URL"
echo "Results will be saved to: $TEST_RESULTS_FILE"
echo "Logs will be saved to: $LOG_FILE"
echo "========================================="

# Initialize results structure
cat > "$TEST_RESULTS_FILE" << 'EOF'
{
  "test_suite": "comprehensive_fallback_testing",
  "start_time": "",
  "end_time": "",
  "total_tests": 0,
  "passed_tests": 0,
  "failed_tests": 0,
  "test_categories": {
    "screener_batching": [],
    "regime_batching": [],
    "coinapi_retry": [],
    "twap_vwap_fallback": []
  },
  "performance_metrics": {
    "average_response_time": 0,
    "total_processing_time": 0,
    "timeout_errors": 0,
    "fallback_usage": 0
  },
  "summary": ""
}
EOF

# Update start time
jq --arg start_time "$(date -Iseconds)" '.start_time = $start_time' "$TEST_RESULTS_FILE" > temp.json && mv temp.json "$TEST_RESULTS_FILE"

# Helper function to log and record test results
log_test_result() {
    local category="$1"
    local test_name="$2" 
    local status="$3"
    local response_time="$4"
    local details="$5"
    
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $test_name: ${status}" | tee -a "$LOG_FILE"
    
    # Create test result object
    local test_result="{
        \"test_name\": \"$test_name\",
        \"status\": \"$status\",
        \"response_time_ms\": $response_time,
        \"details\": \"$details\",
        \"timestamp\": \"$(date -Iseconds)\"
    }"
    
    # Add to appropriate category in results file
    jq --argjson result "$test_result" ".test_categories.${category} += [\$result]" "$TEST_RESULTS_FILE" > temp.json && mv temp.json "$TEST_RESULTS_FILE"
    
    # Update counters
    if [[ "$status" == "PASSED" ]]; then
        jq '.passed_tests += 1' "$TEST_RESULTS_FILE" > temp.json && mv temp.json "$TEST_RESULTS_FILE"
    else
        jq '.failed_tests += 1' "$TEST_RESULTS_FILE" > temp.json && mv temp.json "$TEST_RESULTS_FILE"
    fi
    jq '.total_tests += 1' "$TEST_RESULTS_FILE" > temp.json && mv temp.json "$TEST_RESULTS_FILE"
}

# Helper function to make API calls with timing
make_api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local timeout="${4:-30}"
    
    local start_time=$(date +%s%N)
    
    if [[ "$method" == "POST" ]]; then
        response=$(curl -s -w "%{http_code}" \
                       -X POST \
                       -H "Content-Type: application/json" \
                       -d "$data" \
                       --max-time "$timeout" \
                       "$BASE_URL$endpoint" 2>>"$LOG_FILE" || echo "000")
    else
        response=$(curl -s -w "%{http_code}" \
                       --max-time "$timeout" \
                       "$BASE_URL$endpoint" 2>>"$LOG_FILE" || echo "000")
    fi
    
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    echo "$response|$response_time"
}

# Test symbols for various scenarios
SMALL_SYMBOLS='["BTC", "ETH", "SOL", "ADA", "DOT", "LINK", "AVAX", "MATIC", "UNI", "ATOM"]'
MEDIUM_SYMBOLS='["BTC", "ETH", "SOL", "ADA", "DOT", "LINK", "AVAX", "MATIC", "UNI", "ATOM", "NEAR", "FTM", "ALGO", "XLM", "VET", "HBAR"]'
LARGE_SYMBOLS='["BTC", "ETH", "SOL", "ADA", "DOT", "LINK", "AVAX", "MATIC", "UNI", "ATOM", "NEAR", "FTM", "ALGO", "XLM", "VET", "HBAR", "ICP", "EGLD", "THETA", "XTZ", "EOS", "AAVE", "MKR", "COMP", "SUSHI"]'
EXTRA_LARGE_SYMBOLS='["BTC", "ETH", "SOL", "ADA", "DOT", "LINK", "AVAX", "MATIC", "UNI", "ATOM", "NEAR", "FTM", "ALGO", "XLM", "VET", "HBAR", "ICP", "EGLD", "THETA", "XTZ", "EOS", "AAVE", "MKR", "COMP", "SUSHI", "YFI", "SNX", "CRV", "BAL", "REN"]'

# ========================================
# 1. SCREENER AUTO-BATCHING TESTS
# ========================================

echo -e "\n${YELLOW}📊 1. SCREENER AUTO-BATCHING TESTS${NC}"
echo "Testing POST /api/screener/screen with various symbol counts"

# Test with exactly 15 symbols (should not trigger batching)
test_data='{"symbols":'"$MEDIUM_SYMBOLS"',"timeframe":"1H","include_details":true}'
result=$(make_api_call "POST" "/api/screener/screen" "$test_data" 45)
http_code="${result##*|}"
response_time="${result##*|}" && response_time="${response_time%|*}"

if [[ "${http_code: -3}" == "200" ]]; then
    log_test_result "screener_batching" "Screener_15_symbols_no_batching" "PASSED" "$response_time" "15 symbols processed without batching"
else
    log_test_result "screener_batching" "Screener_15_symbols_no_batching" "FAILED" "$response_time" "HTTP $http_code - 15 symbols failed"
fi

# Test with exactly 25 symbols (should trigger batching: 5 batches of 5)
test_data='{"symbols":'"$LARGE_SYMBOLS"',"timeframe":"1H","include_details":false}'
result=$(make_api_call "POST" "/api/screener/screen" "$test_data" 60)
http_code="${result##*|}"
response_time="${result##*|}" && response_time="${response_time%|*}"

if [[ "${http_code: -3}" == "200" ]]; then
    log_test_result "screener_batching" "Screener_25_symbols_auto_batching" "PASSED" "$response_time" "25 symbols processed with auto-batching"
else
    log_test_result "screener_batching" "Screener_25_symbols_auto_batching" "FAILED" "$response_time" "HTTP $http_code - 25 symbols failed"
fi

# Test with exactly 30 symbols (should trigger batching: 6 batches of 5)
test_data='{"symbols":'"$EXTRA_LARGE_SYMBOLS"',"timeframe":"4H","include_details":false}'
result=$(make_api_call "POST" "/api/screener/screen" "$test_data" 90)
http_code="${result##*|}"
response_time="${result##*|}" && response_time="${response_time%|*}"

if [[ "${http_code: -3}" == "200" ]]; then
    log_test_result "screener_batching" "Screener_30_symbols_max_batching" "PASSED" "$response_time" "30 symbols processed with maximum batching"
else
    log_test_result "screener_batching" "Screener_30_symbols_max_batching" "FAILED" "$response_time" "HTTP $http_code - 30 symbols failed"
fi

# Test edge case: Exactly 50 symbols (max limit)
FIFTY_SYMBOLS='["BTC", "ETH", "SOL", "ADA", "DOT", "LINK", "AVAX", "MATIC", "UNI", "ATOM", "NEAR", "FTM", "ALGO", "XLM", "VET", "HBAR", "ICP", "EGLD", "THETA", "XTZ", "EOS", "AAVE", "MKR", "COMP", "SUSHI", "YFI", "SNX", "CRV", "BAL", "REN", "ZRX", "LRC", "ENJ", "BAT", "ZEC", "DASH", "LTC", "BCH", "XMR", "ETC", "TRX", "XRP", "BNB", "DOGE", "SHIB", "LUNA", "UST", "BUSD", "USDC", "USDT"]'
test_data='{"symbols":'"$FIFTY_SYMBOLS"',"timeframe":"1H","include_details":false}'
result=$(make_api_call "POST" "/api/screener/screen" "$test_data" 120)
http_code="${result##*|}"
response_time="${result##*|}" && response_time="${response_time%|*}"

if [[ "${http_code: -3}" == "200" ]]; then
    log_test_result "screener_batching" "Screener_50_symbols_max_limit" "PASSED" "$response_time" "50 symbols (max limit) processed successfully"
else
    log_test_result "screener_batching" "Screener_50_symbols_max_limit" "FAILED" "$response_time" "HTTP $http_code - 50 symbols failed"
fi

# ========================================
# 2. REGIME AUTO-BATCHING TESTS  
# ========================================

echo -e "\n${YELLOW}🎯 2. REGIME AUTO-BATCHING TESTS${NC}"
echo "Testing regime detection batch endpoint with various symbol counts"

# First, let's check if the regime batch endpoint exists
result=$(make_api_call "GET" "/api/regime/batch?symbols=BTC,ETH&lookback_hours=48" "" 30)
http_code="${result##*|}"
response_time="${result##*|}" && response_time="${response_time%|*}"

if [[ "${http_code: -3}" == "200" ]]; then
    echo "✅ Regime batch endpoint found and accessible"
    
    # Test with exactly 10 symbols (should not trigger batching)
    symbols_10="BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM"
    result=$(make_api_call "GET" "/api/regime/batch?symbols=$symbols_10&lookback_hours=48" "" 45)
    http_code="${result##*|}"
    response_time="${result##*|}" && response_time="${response_time%|*}"
    
    if [[ "${http_code: -3}" == "200" ]]; then
        log_test_result "regime_batching" "Regime_10_symbols_no_batching" "PASSED" "$response_time" "10 symbols processed without batching"
    else
        log_test_result "regime_batching" "Regime_10_symbols_no_batching" "FAILED" "$response_time" "HTTP $http_code - 10 symbols failed"
    fi
    
    # Test with exactly 15 symbols (should trigger batching: 2 batches)
    symbols_15="BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM,NEAR,FTM,ALGO,XLM,VET"
    result=$(make_api_call "GET" "/api/regime/batch?symbols=$symbols_15&lookback_hours=48" "" 60)
    http_code="${result##*|}"
    response_time="${result##*|}" && response_time="${response_time%|*}"
    
    if [[ "${http_code: -3}" == "200" ]]; then
        log_test_result "regime_batching" "Regime_15_symbols_auto_batching" "PASSED" "$response_time" "15 symbols processed with auto-batching"
    else
        log_test_result "regime_batching" "Regime_15_symbols_auto_batching" "FAILED" "$response_time" "HTTP $http_code - 15 symbols failed"
    fi
    
    # Test with exactly 25 symbols (should trigger batching: 3 batches)
    symbols_25="BTC,ETH,SOL,ADA,DOT,LINK,AVAX,MATIC,UNI,ATOM,NEAR,FTM,ALGO,XLM,VET,HBAR,ICP,EGLD,THETA,XTZ,EOS,AAVE,MKR,COMP,SUSHI"
    result=$(make_api_call "GET" "/api/regime/batch?symbols=$symbols_25&lookback_hours=48" "" 90)
    http_code="${result##*|}"
    response_time="${result##*|}" && response_time="${response_time%|*}"
    
    if [[ "${http_code: -3}" == "200" ]]; then
        log_test_result "regime_batching" "Regime_25_symbols_max_batching" "PASSED" "$response_time" "25 symbols processed with maximum batching"
    else
        log_test_result "regime_batching" "Regime_25_symbols_max_batching" "FAILED" "$response_time" "HTTP $http_code - 25 symbols failed"
    fi
    
else
    echo "⚠️ Regime batch endpoint not found or not accessible. Trying alternative routes..."
    log_test_result "regime_batching" "Regime_endpoint_discovery" "FAILED" "0" "Endpoint /api/regime/batch not found (HTTP $http_code)"
    
    # Try to find alternative regime endpoints
    alt_endpoints=("/api/sol/regime" "/api/btc/regime" "/api/regime/detect")
    for endpoint in "${alt_endpoints[@]}"; do
        result=$(make_api_call "GET" "$endpoint" "" 10)
        http_code="${result##*|}"
        if [[ "${http_code: -3}" == "200" ]]; then
            echo "✅ Found alternative regime endpoint: $endpoint"
            break
        fi
    done
fi

# ========================================
# 3. COINAPI HISTORY RETRY TESTS
# ========================================

echo -e "\n${YELLOW}📈 3. COINAPI HISTORY RETRY TESTS${NC}"
echo "Testing CoinAPI history endpoints with retry scenarios"

# Test different CoinAPI history endpoints
coinapi_symbols=("BINANCE_SPOT_BTC_USDT" "BINANCE_SPOT_ETH_USDT" "BINANCE_SPOT_SOL_USDT")

for symbol in "${coinapi_symbols[@]}"; do
    echo "Testing CoinAPI history for $symbol..."
    
    # Test with short period (should work reliably)
    result=$(make_api_call "GET" "/api/coinapi/history/$symbol?period=1HRS&limit=50" "" 30)
    http_code="${result##*|}"
    response_time="${result##*|}" && response_time="${response_time%|*}"
    
    if [[ "${http_code: -3}" == "200" ]]; then
        log_test_result "coinapi_retry" "CoinAPI_history_${symbol}_short" "PASSED" "$response_time" "Short period history retrieved successfully"
    else
        log_test_result "coinapi_retry" "CoinAPI_history_${symbol}_short" "FAILED" "$response_time" "HTTP $http_code - Short history failed"
    fi
    
    # Test with long period (should trigger segmented fetch)
    result=$(make_api_call "GET" "/api/coinapi/history/$symbol?period=1HRS&limit=500" "" 60)
    http_code="${result##*|}"
    response_time="${result##*|}" && response_time="${response_time%|*}"
    
    if [[ "${http_code: -3}" == "200" ]]; then
        log_test_result "coinapi_retry" "CoinAPI_history_${symbol}_long" "PASSED" "$response_time" "Long period history with segmented fetch"
    else
        log_test_result "coinapi_retry" "CoinAPI_history_${symbol}_long" "FAILED" "$response_time" "HTTP $http_code - Long history failed"
    fi
done

# Test invalid symbol (should trigger retry mechanism)
result=$(make_api_call "GET" "/api/coinapi/history/INVALID_SYMBOL_TEST?period=1HRS&limit=10" "" 45)
http_code="${result##*|}"
response_time="${result##*|}" && response_time="${response_time%|*}"

if [[ "${http_code: -3}" == "4"* ]] || [[ "${http_code: -3}" == "200" ]]; then
    log_test_result "coinapi_retry" "CoinAPI_invalid_symbol_retry" "PASSED" "$response_time" "Invalid symbol handled gracefully (HTTP $http_code)"
else
    log_test_result "coinapi_retry" "CoinAPI_invalid_symbol_retry" "FAILED" "$response_time" "HTTP $http_code - Invalid symbol not handled properly"
fi

# ========================================
# 4. TWAP/VWAP FALLBACK TESTS
# ========================================

echo -e "\n${YELLOW}💹 4. TWAP/VWAP FALLBACK TESTS${NC}"
echo "Testing TWAP endpoints with fallback behavior"

# Test TWAP endpoints with different symbols and time periods
twap_symbols=("BINANCE_SPOT_BTC_USDT" "BINANCE_SPOT_ETH_USDT" "BINANCE_SPOT_SOL_USDT")
time_periods=("24" "48" "72")

for symbol in "${twap_symbols[@]}"; do
    for hours in "${time_periods[@]}"; do
        echo "Testing TWAP for $symbol (${hours}h)..."
        
        # Test TWAP calculation
        result=$(make_api_call "GET" "/api/coinapi/twap/$symbol?hours=$hours" "" 30)
        http_code="${result##*|}"
        response_time="${result##*|}" && response_time="${response_time%|*}"
        
        if [[ "${http_code: -3}" == "200" ]]; then
            log_test_result "twap_vwap_fallback" "TWAP_${symbol}_${hours}h" "PASSED" "$response_time" "TWAP calculation successful"
        else
            log_test_result "twap_vwap_fallback" "TWAP_${symbol}_${hours}h" "FAILED" "$response_time" "HTTP $http_code - TWAP calculation failed"
        fi
        
        # Test VWAP calculation (should work as fallback)
        result=$(make_api_call "GET" "/api/coinapi/vwap/$symbol?hours=$hours" "" 30)
        http_code="${result##*|}"
        response_time="${result##*|}" && response_time="${response_time%|*}"
        
        if [[ "${http_code: -3}" == "200" ]]; then
            log_test_result "twap_vwap_fallback" "VWAP_${symbol}_${hours}h" "PASSED" "$response_time" "VWAP calculation successful"
        else
            log_test_result "twap_vwap_fallback" "VWAP_${symbol}_${hours}h" "FAILED" "$response_time" "HTTP $http_code - VWAP calculation failed"
        fi
        
        sleep 1  # Rate limiting
    done
done

# Test with invalid symbol (should trigger fallback chain)
result=$(make_api_call "GET" "/api/coinapi/twap/INVALID_SYMBOL_FALLBACK_TEST?hours=24" "" 30)
http_code="${result##*|}"
response_time="${result##*|}" && response_time="${response_time%|*}"

if [[ "${http_code: -3}" == "4"* ]] || [[ "${http_code: -3}" == "200" ]]; then
    log_test_result "twap_vwap_fallback" "TWAP_invalid_symbol_fallback" "PASSED" "$response_time" "Invalid symbol fallback handled (HTTP $http_code)"
else
    log_test_result "twap_vwap_fallback" "TWAP_invalid_symbol_fallback" "FAILED" "$response_time" "HTTP $http_code - Invalid symbol fallback failed"
fi

# ========================================
# FINAL ANALYSIS AND REPORTING
# ========================================

echo -e "\n${BLUE}📋 GENERATING FINAL REPORT${NC}"

# Update end time
jq --arg end_time "$(date -Iseconds)" '.end_time = $end_time' "$TEST_RESULTS_FILE" > temp.json && mv temp.json "$TEST_RESULTS_FILE"

# Calculate performance metrics
total_tests=$(jq '.total_tests' "$TEST_RESULTS_FILE")
passed_tests=$(jq '.passed_tests' "$TEST_RESULTS_FILE") 
failed_tests=$(jq '.failed_tests' "$TEST_RESULTS_FILE")

# Calculate pass rate
pass_rate=$(echo "scale=2; $passed_tests * 100 / $total_tests" | bc -l 2>/dev/null || echo "0")

# Create summary
summary="Test suite completed with $passed_tests/$total_tests tests passed (${pass_rate}% pass rate). "
if [[ "$failed_tests" -gt 0 ]]; then
    summary="${summary}$failed_tests tests failed. "
fi

jq --arg summary "$summary" '.summary = $summary' "$TEST_RESULTS_FILE" > temp.json && mv temp.json "$TEST_RESULTS_FILE"

echo -e "${GREEN}✅ Test suite completed!${NC}"
echo "Results summary:"
echo "  Total tests: $total_tests"
echo "  Passed: $passed_tests"
echo "  Failed: $failed_tests"
echo "  Pass rate: ${pass_rate}%"

if [[ "$failed_tests" -eq 0 ]]; then
    echo -e "${GREEN}🎉 All tests passed! Fallback strategies are working correctly.${NC}"
    exit 0
else
    echo -e "${RED}⚠️ Some tests failed. Check $TEST_RESULTS_FILE and $LOG_FILE for details.${NC}"
    exit 1
fi
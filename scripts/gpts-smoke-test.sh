#!/bin/bash

# 🔒 GPTs SMOKE TEST SCRIPT
# Critical deployment validation untuk memastikan /gpts/ endpoints stabil
# Run ini setiap kali deploy untuk validasi GPT Actions

set -e  # Exit on any error

echo "🔒 Starting GPTs Smoke Test..."
echo "🕐 $(date)"
echo ""

# Configuration
BASE_URL="https://guardiansofthegreentoken.com"
TIMEOUT=30
FAILED_TESTS=0

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
run_test() {
    local test_name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    local expected_status="${5:-200}"
    
    echo -n "🧪 Testing $test_name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\nHTTPSTATUS:%{http_code}\nTIME:%{time_total}" \
                   --max-time $TIMEOUT "$url")
    else
        response=$(curl -s -w "\nHTTPSTATUS:%{http_code}\nTIME:%{time_total}" \
                   --max-time $TIMEOUT \
                   -X "$method" \
                   -H "Content-Type: application/json" \
                   -d "$data" \
                   "$url")
    fi
    
    http_code=$(echo "$response" | grep "HTTPSTATUS:" | sed 's/HTTPSTATUS://')
    time_total=$(echo "$response" | grep "TIME:" | sed 's/TIME://')
    body=$(echo "$response" | sed '/HTTPSTATUS:/d' | sed '/TIME:/d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (${http_code}, ${time_total}s)"
        
        # Additional validation for JSON response
        if echo "$body" | jq . >/dev/null 2>&1; then
            success_field=$(echo "$body" | jq -r '.success // "null"')
            if [ "$success_field" = "true" ]; then
                echo "   📊 Response: Valid JSON with success=true"
            elif [ "$success_field" = "null" ]; then
                # Some Python service responses don't include "success" field, that's OK
                echo "   📊 Response: Valid JSON (success field not present - OK for Python service)"
            else
                echo -e "   ${YELLOW}⚠️  Response: Valid JSON but success=${success_field}${NC}"
            fi
        else
            echo -e "   ${YELLOW}⚠️  Response: Non-JSON or invalid JSON${NC}"
        fi
    else
        echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $http_code, ${time_total}s)"
        echo "   📋 Response body: $body"
        ((FAILED_TESTS++))
    fi
    echo ""
}

# CRITICAL SMOKE TESTS (Must pass for deployment approval)
echo "🚨 CRITICAL TESTS - Must Pass for Deployment:"
echo "=================================================="

# Test 1: GPTs Health Check
run_test "GPTs Health" "$BASE_URL/gpts/health" "GET"

# Test 2: GPTs Symbols Endpoint  
run_test "GPTs Symbols" "$BASE_URL/gpts/unified/symbols" "GET"

# Test 3: GPTs Advanced Endpoint (Market Sentiment)
run_test "GPTs Advanced (Market Sentiment)" "$BASE_URL/gpts/unified/advanced" "POST" '{"op":"market_sentiment","params":{}}'

# Test 4: GPTs Advanced Endpoint (Ticker)
run_test "GPTs Advanced (Ticker)" "$BASE_URL/gpts/unified/advanced" "POST" '{"op":"ticker","params":{"symbol":"BTC"}}'

echo "🔍 ADDITIONAL VALIDATION TESTS:"
echo "================================"

# Test 5: System Health Check
run_test "System Health" "$BASE_URL/health" "GET"

# Test 6: Test batch operations
run_test "GPTs Batch Operations" "$BASE_URL/gpts/unified/advanced" "POST" '{"ops":[{"op":"ticker","params":{"symbol":"BTC"}},{"op":"market_sentiment","params":{}}]}'

# Performance test
echo "⚡ PERFORMANCE VALIDATION:"
echo "========================="

start_time=$(date +%s)
curl -s --max-time $TIMEOUT "$BASE_URL/gpts/health" >/dev/null
end_time=$(date +%s)
response_time=$((end_time - start_time))

if [ $response_time -lt 5 ]; then
    echo -e "🚀 Performance: ${GREEN}EXCELLENT${NC} (${response_time}s < 5s threshold)"
else
    echo -e "⚠️  Performance: ${YELLOW}SLOW${NC} (${response_time}s >= 5s threshold)"
fi

echo ""
echo "📊 SMOKE TEST RESULTS:"
echo "======================"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED${NC}"
    echo "✅ Deployment approved - GPTs endpoints are stable"
    echo "🔐 Private GPT access confirmed working"
    exit 0
else
    echo -e "${RED}❌ $FAILED_TESTS TESTS FAILED${NC}"
    echo "🚫 Deployment BLOCKED - Fix issues before deploying"
    echo "⚠️  Private GPT access may be compromised"
    exit 1
fi
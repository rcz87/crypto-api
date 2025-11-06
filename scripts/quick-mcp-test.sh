#!/bin/bash

###############################################################################
# Quick MCP Backend Test - Fast sanity check for MCP endpoints
# Tests critical endpoints only (takes ~5 seconds)
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

BASE_URL="${BASE_URL:-http://localhost:5000}"

echo -e "${BOLD}${CYAN}Quick MCP Backend Test${NC}\n"

# Test counter
PASSED=0
FAILED=0

test_quick() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"

    echo -ne "${CYAN}Testing${NC} $name... "

    local response
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            --max-time 5 \
            -d "$data" \
            "$BASE_URL$url" 2>&1)
    else
        response=$(curl -s -w "%{http_code}" \
            --max-time 5 \
            "$BASE_URL$url" 2>&1)
    fi

    local http_code="${response: -3}"

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ (HTTP $http_code)${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# Run quick tests
echo -e "${YELLOW}Testing critical endpoints...${NC}\n"

test_quick "Health" "/gpts/health"
test_quick "Symbols" "/gpts/unified/symbols"
test_quick "Market Data" "/gpts/unified/market/BTC"
test_quick "Whale Alerts" "/gpts/unified/advanced" "POST" '{"op":"whale_alerts","symbol":"BTC"}'
test_quick "Brain Analysis" "/gpts/brain/analysis" "POST" '{"symbols":["BTC"]}'

echo ""
echo -e "${BOLD}Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ Quick test PASSED! Backend is operational.${NC}"
    exit 0
else
    echo -e "${RED}${BOLD}✗ Quick test FAILED! Run full test: npm run test:mcp-endpoints${NC}"
    exit 1
fi

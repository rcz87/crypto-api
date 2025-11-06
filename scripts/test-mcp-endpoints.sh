#!/bin/bash

###############################################################################
# MCP Backend Endpoints Verification Script
# Tests all 18 backend endpoints used by MCP tools
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
BASE_URL="${BASE_URL:-http://localhost:5000}"
TIMEOUT="${TIMEOUT:-10}"
VERBOSE="${VERBOSE:-false}"

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Results storage
declare -a FAILED_ENDPOINTS
declare -a SLOW_ENDPOINTS

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BOLD}${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║  MCP Backend Endpoints Verification - 18 Tools Test Suite    ║${NC}"
    echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}\n"
    echo -e "${BLUE}Base URL:${NC} $BASE_URL"
    echo -e "${BLUE}Timeout:${NC} ${TIMEOUT}s"
    echo -e "${BLUE}Date:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

print_section() {
    echo -e "\n${BOLD}${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${YELLOW}$1${NC}"
    echo -e "${BOLD}${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

test_endpoint() {
    local tool_name="$1"
    local method="$2"
    local endpoint="$3"
    local payload="$4"
    local description="$5"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -ne "${CYAN}Testing:${NC} ${BOLD}$tool_name${NC} - $description... "

    local start_time=$(date +%s%3N)
    local response
    local http_code
    local duration

    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -X POST \
            -H "Content-Type: application/json" \
            -H "User-Agent: MCP-Test-Script/1.0" \
            --max-time "$TIMEOUT" \
            -d "$payload" \
            "$BASE_URL$endpoint" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" \
            -H "Accept: application/json" \
            -H "User-Agent: MCP-Test-Script/1.0" \
            --max-time "$TIMEOUT" \
            "$BASE_URL$endpoint" 2>&1)
    fi

    local end_time=$(date +%s%3N)
    duration=$((end_time - start_time))

    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')

    # Check if response is valid
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ PASS${NC} (${duration}ms)"
        PASSED_TESTS=$((PASSED_TESTS + 1))

        # Check for slow endpoints (>3s)
        if [ "$duration" -gt 3000 ]; then
            SLOW_ENDPOINTS+=("$tool_name: ${duration}ms")
        fi

        if [ "$VERBOSE" = "true" ]; then
            echo -e "  ${BLUE}Response:${NC} $(echo "$response_body" | jq -r '.' 2>/dev/null || echo "$response_body" | head -c 100)"
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_ENDPOINTS+=("$tool_name ($endpoint): HTTP $http_code")

        if [ "$VERBOSE" = "true" ]; then
            echo -e "  ${RED}Error:${NC} $response_body"
        fi
    fi
}

check_prerequisites() {
    echo -e "${CYAN}Checking prerequisites...${NC}"

    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}✗ curl is not installed${NC}"
        exit 1
    fi

    # Check if jq is available (optional but recommended)
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠ jq is not installed (JSON pretty-printing disabled)${NC}"
    fi

    # Check if Express.js API is running
    echo -ne "${CYAN}Checking if Express.js API is running...${NC} "
    if curl -s --max-time 5 "$BASE_URL/gpts/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        echo -e "${RED}ERROR: Express.js API is not running at $BASE_URL${NC}"
        echo -e "${YELLOW}Please start the API first: npm run dev${NC}"
        exit 1
    fi

    echo ""
}

print_summary() {
    echo -e "\n${BOLD}${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║                         TEST SUMMARY                          ║${NC}"
    echo -e "${BOLD}${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}\n"

    echo -e "${BLUE}Total Tests:${NC}   $TOTAL_TESTS"
    echo -e "${GREEN}Passed:${NC}        $PASSED_TESTS"
    echo -e "${RED}Failed:${NC}        $FAILED_TESTS"
    echo -e "${YELLOW}Skipped:${NC}       $SKIPPED_TESTS"

    local pass_rate=0
    if [ "$TOTAL_TESTS" -gt 0 ]; then
        pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    echo -e "${BLUE}Pass Rate:${NC}     ${pass_rate}%"

    # Show failed endpoints
    if [ ${#FAILED_ENDPOINTS[@]} -gt 0 ]; then
        echo -e "\n${RED}${BOLD}Failed Endpoints:${NC}"
        for endpoint in "${FAILED_ENDPOINTS[@]}"; do
            echo -e "  ${RED}✗${NC} $endpoint"
        done
    fi

    # Show slow endpoints
    if [ ${#SLOW_ENDPOINTS[@]} -gt 0 ]; then
        echo -e "\n${YELLOW}${BOLD}Slow Endpoints (>3s):${NC}"
        for endpoint in "${SLOW_ENDPOINTS[@]}"; do
            echo -e "  ${YELLOW}⚠${NC} $endpoint"
        done
    fi

    echo ""

    # Final verdict
    if [ "$FAILED_TESTS" -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✓ ALL TESTS PASSED! MCP Backend is Production Ready!${NC}\n"
        return 0
    else
        echo -e "${RED}${BOLD}✗ SOME TESTS FAILED! Please review the errors above.${NC}\n"
        return 1
    fi
}

###############################################################################
# Test Categories
###############################################################################

test_health_endpoints() {
    print_section "🏥 Health Check Endpoints"

    test_endpoint \
        "get_gpts_health" \
        "GET" \
        "/gpts/health" \
        "" \
        "Overall GPT Actions health"

    test_endpoint \
        "get_coinapi_health" \
        "GET" \
        "/gpts/health/coinapi" \
        "" \
        "CoinAPI WebSocket health"
}

test_guardians_endpoints() {
    print_section "🐋 GuardiansOfTheToken Endpoints (3 tools)"

    test_endpoint \
        "get_whale_data" \
        "POST" \
        "/gpts/coinglass/whale-data" \
        '{"symbol":"BTC","timeframe":"1h","operation":"scan","mode":"single"}' \
        "Whale accumulation detection"

    test_endpoint \
        "get_live_template" \
        "POST" \
        "/gpts/coinglass/live-template" \
        '{"coin":"BTC","template_type":"accumulation_watch"}' \
        "Professional signal templates"

    test_endpoint \
        "get_institutional_bias" \
        "GET" \
        "/gpts/institutional/bias?symbol=BTC-USDT-SWAP" \
        "" \
        "Smart money positioning"
}

test_trading_endpoints() {
    print_section "📈 Trading Intelligence Endpoints (10 tools)"

    test_endpoint \
        "get_symbols" \
        "GET" \
        "/gpts/unified/symbols" \
        "" \
        "List 71+ supported symbols"

    test_endpoint \
        "get_market_data" \
        "GET" \
        "/gpts/unified/market/BTC" \
        "" \
        "Real-time market data for BTC"

    test_endpoint \
        "whale_alerts" \
        "POST" \
        "/gpts/unified/advanced" \
        '{"op":"whale_alerts","symbol":"BTC","exchange":"hyperliquid"}' \
        "Large order detection"

    test_endpoint \
        "market_sentiment" \
        "POST" \
        "/gpts/unified/advanced" \
        '{"op":"market_sentiment","symbol":"BTC"}' \
        "Funding + order flow analysis"

    test_endpoint \
        "multi_coin_screening" \
        "POST" \
        "/gpts/unified/advanced" \
        '{"op":"multi_coin_screening","symbols":["BTC","ETH","SOL"],"timeframe":"15m"}' \
        "8-layer confluence analysis"

    test_endpoint \
        "new_listings" \
        "POST" \
        "/gpts/unified/advanced" \
        '{"op":"new_listings","limit":10,"maxMarketCap":500000000}' \
        "New token discovery"

    test_endpoint \
        "volume_spikes" \
        "POST" \
        "/gpts/unified/advanced" \
        '{"op":"volume_spikes","limit":10}' \
        "Volume anomaly detection"

    test_endpoint \
        "opportunities" \
        "POST" \
        "/gpts/unified/advanced" \
        '{"op":"opportunities","minScore":60}' \
        "AI opportunity scoring"

    test_endpoint \
        "alpha_screening" \
        "POST" \
        "/gpts/unified/advanced" \
        '{"op":"alpha_screening","symbol":"BTC"}' \
        "Fundamental analysis"

    test_endpoint \
        "micro_caps" \
        "POST" \
        "/gpts/unified/advanced" \
        '{"op":"micro_caps","maxMarketCap":100000000,"minScore":50,"limit":10}' \
        "Micro-cap gems finder"
}

test_brain_endpoints() {
    print_section "🧠 Brain Orchestrator Endpoints (5 tools)"

    test_endpoint \
        "get_brain_analysis" \
        "POST" \
        "/gpts/brain/analysis" \
        '{"symbols":["BTC","ETH","SOL"]}' \
        "AI-powered market intelligence"

    test_endpoint \
        "get_brain_insights" \
        "GET" \
        "/gpts/brain/insights?limit=5" \
        "" \
        "Historical AI insights"

    test_endpoint \
        "get_brain_stats" \
        "GET" \
        "/gpts/brain/stats" \
        "" \
        "Performance statistics"
}

###############################################################################
# Main Execution
###############################################################################

main() {
    print_header
    check_prerequisites

    # Run all test categories
    test_health_endpoints
    test_guardians_endpoints
    test_trading_endpoints
    test_brain_endpoints

    # Print summary
    print_summary

    # Return exit code based on results
    if [ "$FAILED_TESTS" -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose     Show detailed response output"
            echo "  -u, --url URL     Base URL (default: http://localhost:5000)"
            echo "  -t, --timeout N   Request timeout in seconds (default: 10)"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  BASE_URL          Base URL for API (default: http://localhost:5000)"
            echo "  TIMEOUT           Request timeout in seconds (default: 10)"
            echo "  VERBOSE           Show verbose output (default: false)"
            echo ""
            echo "Examples:"
            echo "  $0                              # Run with defaults"
            echo "  $0 -v                           # Run with verbose output"
            echo "  $0 -u http://api.example.com    # Test remote API"
            echo "  BASE_URL=http://localhost:3000 $0  # Use environment variable"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main

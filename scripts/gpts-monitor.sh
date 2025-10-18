#!/bin/bash

# 🚨 GPTs MONITORING SCRIPT
# Continuous monitoring untuk /gpts/ endpoints dengan alert system
# Dijalankan di background untuk monitoring 24/7

set -e

# Configuration
BASE_URL="https://guardiansofthegreentoken.com"
MONITOR_INTERVAL=${MONITOR_INTERVAL:-300}  # 5 minutes default
MAX_FAILURES=${MAX_FAILURES:-3}            # Alert after 3 consecutive failures
LOG_FILE="/tmp/gpts-monitor.log"
ALERT_FILE="/tmp/gpts-alerts.log"

# Endpoint list to monitor (critical endpoints only)
ENDPOINTS=(
    "/gpts/health"
    "/gpts/unified/symbols"  
)

# Advanced endpoints require POST data
declare -A POST_ENDPOINTS
POST_ENDPOINTS["/gpts/unified/advanced"]='{"op":"market_sentiment","params":{}}'

# Failure counters
declare -A FAILURE_COUNT

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Initialize log
echo "🚨 GPTs Monitor Started: $(date)" | tee -a "$LOG_FILE"
echo "📊 Monitoring endpoints every ${MONITOR_INTERVAL}s" | tee -a "$LOG_FILE"

# Function to check endpoint health
check_endpoint() {
    local endpoint="$1"
    local method="GET"
    local data=""
    
    # Check if this is a POST endpoint
    if [[ -v POST_ENDPOINTS["$endpoint"] ]]; then
        method="POST"
        data="${POST_ENDPOINTS[$endpoint]}"
    fi
    
    local url="${BASE_URL}${endpoint}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time 30 "$url" 2>/dev/null || echo "HTTPSTATUS:000")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time 30 \
                   -X "$method" -H "Content-Type: application/json" \
                   -d "$data" "$url" 2>/dev/null || echo "HTTPSTATUS:000")
    fi
    
    http_code=$(echo "$response" | grep "HTTPSTATUS:" | sed 's/HTTPSTATUS://')
    
    if [ "$http_code" = "200" ]; then
        # Reset failure count on success
        FAILURE_COUNT["$endpoint"]=0
        return 0
    else
        # Increment failure count
        local current_failures=${FAILURE_COUNT["$endpoint"]:-0}
        FAILURE_COUNT["$endpoint"]=$((current_failures + 1))
        return 1
    fi
}

# Function to send alert
send_alert() {
    local endpoint="$1"
    local failures="$2"
    local timestamp=$(date)
    
    local alert_msg="🚨 ALERT: $endpoint FAILED $failures consecutive times at $timestamp"
    
    # Log to alert file
    echo "$alert_msg" >> "$ALERT_FILE"
    
    # Log to main log
    echo -e "${RED}$alert_msg${NC}" | tee -a "$LOG_FILE"
    
    # Try to restart the application workflow (if available)
    if [ $failures -ge $MAX_FAILURES ]; then
        echo "🔄 Attempting to restart application workflow..." | tee -a "$LOG_FILE"
        # This would be replaced with actual restart command in production
        echo "   ⚠️ Auto-restart not implemented in this version" | tee -a "$LOG_FILE"
    fi
}

# Function to send recovery notification
send_recovery() {
    local endpoint="$1"
    local timestamp=$(date)
    
    local recovery_msg="✅ RECOVERY: $endpoint is back online at $timestamp"
    
    echo "$recovery_msg" >> "$ALERT_FILE"
    echo -e "${GREEN}$recovery_msg${NC}" | tee -a "$LOG_FILE"
}

# Main monitoring loop
echo "🔄 Starting monitoring loop..."

while true; do
    echo "🕐 $(date) - Checking endpoints..." >> "$LOG_FILE"
    
    all_healthy=true
    
    # Check GET endpoints
    for endpoint in "${ENDPOINTS[@]}"; do
        if check_endpoint "$endpoint"; then
            # Check if this endpoint was previously failing
            local prev_failures=${FAILURE_COUNT["$endpoint"]:-0}
            if [ $prev_failures -gt 0 ]; then
                send_recovery "$endpoint"
            fi
            echo -e "   ✅ $endpoint: ${GREEN}OK${NC}"
        else
            all_healthy=false
            local current_failures=${FAILURE_COUNT["$endpoint"]}
            echo -e "   ❌ $endpoint: ${RED}FAILED${NC} ($current_failures failures)"
            
            if [ $current_failures -ge $MAX_FAILURES ]; then
                send_alert "$endpoint" "$current_failures"
            fi
        fi
    done
    
    # Check POST endpoints
    for endpoint in "${!POST_ENDPOINTS[@]}"; do
        if check_endpoint "$endpoint"; then
            local prev_failures=${FAILURE_COUNT["$endpoint"]:-0}
            if [ $prev_failures -gt 0 ]; then
                send_recovery "$endpoint"
            fi
            echo -e "   ✅ $endpoint: ${GREEN}OK${NC}"
        else
            all_healthy=false
            local current_failures=${FAILURE_COUNT["$endpoint"]}
            echo -e "   ❌ $endpoint: ${RED}FAILED${NC} ($current_failures failures)"
            
            if [ $current_failures -ge $MAX_FAILURES ]; then
                send_alert "$endpoint" "$current_failures"
            fi
        fi
    done
    
    if $all_healthy; then
        echo "🟢 All GPTs endpoints healthy" | tee -a "$LOG_FILE"
    else
        echo "🔴 Some GPTs endpoints failing" | tee -a "$LOG_FILE"
    fi
    
    echo "" | tee -a "$LOG_FILE"
    
    # Wait for next check
    sleep "$MONITOR_INTERVAL"
done
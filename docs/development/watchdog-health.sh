#!/bin/bash

# 🐕 CRYPTO API - HEALTH WATCHDOG WITH AUTO-RESTART
# Monitors system health and automatically restarts services on critical failures

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/crypto-api-watchdog.log"
STATE_FILE="/tmp/crypto-api-watchdog-state"
MAX_CONSECUTIVE_FAILURES=3
RESTART_COOLDOWN=300  # 5 minutes cooldown between restarts

# ============================================================================
# LOGGING
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" | tee -a "$LOG_FILE"
}

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

get_failure_count() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE" | jq -r '.failure_count // 0' 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

get_last_restart() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE" | jq -r '.last_restart // 0' 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

update_state() {
    local failure_count=$1
    local last_restart=$2
    
    cat > "$STATE_FILE" <<EOF
{
  "failure_count": $failure_count,
  "last_restart": $last_restart,
  "last_check": $(date +%s)
}
EOF
}

reset_state() {
    update_state 0 0
}

# ============================================================================
# HEALTH CHECKS
# ============================================================================

check_api_health() {
    local port=$1
    local response=$(curl -s -w "\n%{http_code}" "http://localhost:$port/health" 2>/dev/null)
    local http_code=$(echo "$response" | tail -1)
    
    if [ "$http_code" = "200" ]; then
        return 0
    else
        log_error "API health check failed on port $port (HTTP $http_code)"
        return 1
    fi
}

check_python_service() {
    if ! ss -tulpn 2>/dev/null | grep -q ":8000 "; then
        log_error "Python service port 8000 not listening"
        return 1
    fi
    
    local response=$(curl -s -w "\n%{http_code}" "http://localhost:8000/health" 2>/dev/null)
    local http_code=$(echo "$response" | tail -1)
    
    if [ "$http_code" = "200" ]; then
        return 0
    else
        log_error "Python service health check failed (HTTP $http_code)"
        return 1
    fi
}

check_pm2_processes() {
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 not installed"
        return 1
    fi
    
    local pm2_list=$(pm2 jlist 2>/dev/null)
    
    if [ -z "$pm2_list" ] || [ "$pm2_list" = "[]" ]; then
        log_error "No PM2 processes running"
        return 1
    fi
    
    local stopped_count=$(echo "$pm2_list" | jq '[.[] | select(.pm2_env.status != "online")] | length' 2>/dev/null || echo "1")
    
    if [ "$stopped_count" -gt 0 ]; then
        log_error "$stopped_count PM2 process(es) are not online"
        return 1
    fi
    
    return 0
}

check_memory_usage() {
    local total_mem=$(free -m | awk 'NR==2{print $2}')
    local used_mem=$(free -m | awk 'NR==2{print $3}')
    local mem_percent=$(awk "BEGIN {printf \"%.0f\", ($used_mem/$total_mem)*100}")
    
    if [ "$mem_percent" -gt 95 ]; then
        log_error "Critical memory usage: ${mem_percent}%"
        return 1
    fi
    
    return 0
}

# ============================================================================
# RESTART FUNCTIONS
# ============================================================================

send_telegram_alert() {
    local message="$1"
    
    if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
        return 0
    fi
    
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" \
        > /dev/null 2>&1
}

restart_services() {
    log "🔄 Initiating service restart..."
    
    # Send pre-restart alert
    send_telegram_alert "🚨 <b>WATCHDOG ALERT</b>%0A%0AHealth check failed $MAX_CONSECUTIVE_FAILURES times consecutively.%0AInitiating automatic service restart...%0A%0ATimestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    
    # Restart PM2 processes
    if command -v pm2 &> /dev/null; then
        log "Restarting PM2 processes..."
        pm2 restart all >> "$LOG_FILE" 2>&1
        
        # Wait for services to stabilize
        sleep 10
        
        log_success "PM2 processes restarted"
    else
        log_error "PM2 not available for restart"
        send_telegram_alert "❌ <b>RESTART FAILED</b>%0A%0APM2 not available. Manual intervention required!"
        return 1
    fi
    
    # Verify restart was successful
    sleep 5
    
    local restart_successful=true
    
    # Check if services are back online
    if ss -tulpn 2>/dev/null | grep -q ":8080 "; then
        if ! check_api_health 8080; then
            restart_successful=false
        fi
    elif ss -tulpn 2>/dev/null | grep -q ":5000 "; then
        if ! check_api_health 5000; then
            restart_successful=false
        fi
    else
        restart_successful=false
    fi
    
    if [ "$restart_successful" = true ]; then
        log_success "Service restart successful - all health checks passed"
        send_telegram_alert "✅ <b>RESTART SUCCESSFUL</b>%0A%0AAll services are back online and healthy.%0A%0ATimestamp: $(date '+%Y-%m-%d %H:%M:%S')"
        
        # Reset failure count
        update_state 0 $(date +%s)
        return 0
    else
        log_error "Service restart completed but health checks still failing"
        send_telegram_alert "⚠️ <b>RESTART COMPLETED</b>%0A%0AServices restarted but health checks still failing.%0AManual investigation required.%0A%0ATimestamp: $(date '+%Y-%m-%d %H:%M:%S')"
        
        # Update last restart time but keep failure count
        local current_failures=$(get_failure_count)
        update_state "$current_failures" $(date +%s)
        return 1
    fi
}

# ============================================================================
# MAIN WATCHDOG LOGIC
# ============================================================================

main() {
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "🐕 Watchdog health check started"
    
    # Get current state
    local failure_count=$(get_failure_count)
    local last_restart=$(get_last_restart)
    local current_time=$(date +%s)
    local time_since_restart=$((current_time - last_restart))
    
    log "Current failure count: $failure_count"
    log "Time since last restart: ${time_since_restart}s"
    
    # Check if we're in cooldown period
    if [ "$time_since_restart" -lt "$RESTART_COOLDOWN" ] && [ "$last_restart" -gt 0 ]; then
        local remaining=$((RESTART_COOLDOWN - time_since_restart))
        log "⏳ In restart cooldown period. ${remaining}s remaining."
        exit 0
    fi
    
    # Run health checks
    local health_ok=true
    
    log "Running health checks..."
    
    # Check API (port 8080 or 5000)
    if ss -tulpn 2>/dev/null | grep -q ":8080 "; then
        if ! check_api_health 8080; then
            health_ok=false
        else
            log "✅ API health check passed (port 8080)"
        fi
    elif ss -tulpn 2>/dev/null | grep -q ":5000 "; then
        if ! check_api_health 5000; then
            health_ok=false
        else
            log "✅ API health check passed (port 5000)"
        fi
    else
        log_error "API not listening on port 8080 or 5000"
        health_ok=false
    fi
    
    # Check Python service
    if ! check_python_service; then
        health_ok=false
    else
        log "✅ Python service health check passed"
    fi
    
    # Check PM2 processes
    if ! check_pm2_processes; then
        health_ok=false
    else
        log "✅ PM2 processes check passed"
    fi
    
    # Check memory usage
    if ! check_memory_usage; then
        health_ok=false
    else
        log "✅ Memory usage check passed"
    fi
    
    # Evaluate health status
    if [ "$health_ok" = true ]; then
        log_success "All health checks passed"
        
        # Reset failure count if we had failures before
        if [ "$failure_count" -gt 0 ]; then
            log "Resetting failure count (was: $failure_count)"
            reset_state
        fi
        
        exit 0
    else
        # Health check failed
        failure_count=$((failure_count + 1))
        log_error "Health check failed. Failure count: $failure_count/$MAX_CONSECUTIVE_FAILURES"
        
        # Update state
        update_state "$failure_count" "$last_restart"
        
        # Check if we should restart
        if [ "$failure_count" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
            log "⚠️  Failure threshold reached ($failure_count >= $MAX_CONSECUTIVE_FAILURES)"
            
            # Attempt restart
            if restart_services; then
                exit 0
            else
                exit 1
            fi
        else
            log "Failure count below threshold. Will retry on next check."
            exit 1
        fi
    fi
}

# ============================================================================
# ENTRY POINT
# ============================================================================

# Create log file if it doesn't exist
touch "$LOG_FILE"

# Run main function
main

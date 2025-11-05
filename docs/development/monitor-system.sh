#!/bin/bash

# 🔍 CRYPTO API - ENHANCED SYSTEM MONITORING SCRIPT
# Comprehensive monitoring dengan Telegram bot check, Python service, dan auto-restart

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/crypto-api-monitor.log"
ALERT_THRESHOLD=3  # Jumlah kegagalan sebelum auto-restart
FAILURE_COUNT=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" >> "$LOG_FILE"
}

# ============================================================================
# HEADER
# ============================================================================

print_header() {
    clear
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}🔍 CRYPTO API - ENHANCED SYSTEM MONITORING${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📅 Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "🖥️  Hostname: $(hostname)"
    echo ""
}

# ============================================================================
# CHECK FUNCTIONS
# ============================================================================

# 1. Check Port Status
check_port() {
    local port=$1
    local service=$2
    
    echo -e "\n${BLUE}━━━ Checking Port $port ($service) ━━━${NC}"
    
    if ss -tulpn 2>/dev/null | grep -q ":$port "; then
        log_success "Port $port - $service is LISTENING"
        
        # Show process details
        local process_info=$(ss -tulpn 2>/dev/null | grep ":$port " | head -1)
        echo -e "${CYAN}Process:${NC} $process_info"
        return 0
    else
        log_error "Port $port - $service is NOT LISTENING"
        ((FAILURE_COUNT++))
        return 1
    fi
}

# 2. Check API Health Endpoint
check_api_health() {
    local url=$1
    local name=$2
    
    echo -e "\n${BLUE}━━━ Checking $name Health Endpoint ━━━${NC}"
    
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        log_success "$name - HTTP $http_code (${response_time}ms)"
        
        # Parse and display key information
        if command -v jq &> /dev/null; then
            echo -e "${CYAN}Status:${NC} $(echo "$body" | jq -r '.status // .data.status // "N/A"' 2>/dev/null || echo "N/A")"
            echo -e "${CYAN}Uptime:${NC} $(echo "$body" | jq -r '.uptime // .data.metrics.uptime // "N/A"' 2>/dev/null || echo "N/A")"
        fi
        return 0
    else
        log_error "$name - HTTP $http_code (${response_time}ms)"
        ((FAILURE_COUNT++))
        return 1
    fi
}

# 3. Check Python Service (Port 8000)
check_python_service() {
    echo -e "\n${BLUE}━━━ Checking Python FastAPI Service (Port 8000) ━━━${NC}"
    
    # Check if port is listening
    if ! ss -tulpn 2>/dev/null | grep -q ":8000 "; then
        log_error "Python service port 8000 is NOT LISTENING"
        ((FAILURE_COUNT++))
        return 1
    fi
    
    log_success "Python service port 8000 is LISTENING"
    
    # Check health endpoint
    local PY_BASE="${PY_BASE:-http://127.0.0.1:8000}"
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "\n%{http_code}" "$PY_BASE/health" 2>/dev/null)
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        log_success "Python health endpoint - HTTP $http_code (${response_time}ms)"
        
        if command -v jq &> /dev/null; then
            echo -e "${CYAN}CoinGlass Status:${NC} $(echo "$body" | jq -r '.coinglass.status // "N/A"' 2>/dev/null || echo "N/A")"
            echo -e "${CYAN}Has API Key:${NC} $(echo "$body" | jq -r '.coinglass.has_key // "N/A"' 2>/dev/null || echo "N/A")"
        fi
        return 0
    else
        log_error "Python health endpoint - HTTP $http_code"
        ((FAILURE_COUNT++))
        return 1
    fi
}

# 4. Check Telegram Bot Status
check_telegram_bot() {
    echo -e "\n${BLUE}━━━ Checking Telegram Bot Status ━━━${NC}"
    
    # Check if Telegram is configured
    if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
        log_warn "Telegram bot not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)"
        echo -e "${YELLOW}ℹ️  Set environment variables to enable Telegram monitoring${NC}"
        return 0  # Not a critical failure
    fi
    
    # Test Telegram API connectivity
    local response=$(curl -s -w "\n%{http_code}" \
        "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" 2>/dev/null)
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        local bot_name=$(echo "$body" | jq -r '.result.username // "N/A"' 2>/dev/null || echo "N/A")
        log_success "Telegram bot connected: @$bot_name"
        
        # Test sending a test message (optional, commented out to avoid spam)
        # send_telegram_message "✅ Monitoring system check - Bot is operational"
        
        return 0
    else
        log_error "Telegram bot connection failed - HTTP $http_code"
        return 1
    fi
}

# 5. Check RAM Usage
check_ram_usage() {
    echo -e "\n${BLUE}━━━ Checking RAM Usage ━━━${NC}"
    
    local total_mem=$(free -m | awk 'NR==2{print $2}')
    local used_mem=$(free -m | awk 'NR==2{print $3}')
    local free_mem=$(free -m | awk 'NR==2{print $4}')
    local mem_percent=$(awk "BEGIN {printf \"%.1f\", ($used_mem/$total_mem)*100}")
    
    echo -e "${CYAN}Total:${NC} ${total_mem}MB"
    echo -e "${CYAN}Used:${NC} ${used_mem}MB (${mem_percent}%)"
    echo -e "${CYAN}Free:${NC} ${free_mem}MB"
    
    if (( $(echo "$mem_percent < 70" | bc -l) )); then
        log_success "RAM usage is healthy (${mem_percent}%)"
    elif (( $(echo "$mem_percent < 85" | bc -l) )); then
        log_warn "RAM usage is elevated (${mem_percent}%)"
    else
        log_error "RAM usage is CRITICAL (${mem_percent}%)"
        ((FAILURE_COUNT++))
    fi
    
    # Show top memory consumers
    echo -e "\n${CYAN}Top 5 Memory Consumers:${NC}"
    ps aux --sort=-%mem | head -6 | tail -5 | awk '{printf "  %-20s %6s%%  %s\n", $11, $4, $2}'
}

# 6. Check Disk Space
check_disk_space() {
    echo -e "\n${BLUE}━━━ Checking Disk Space ━━━${NC}"
    
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    local disk_avail=$(df -h / | awk 'NR==2{print $4}')
    
    echo -e "${CYAN}Usage:${NC} ${disk_usage}%"
    echo -e "${CYAN}Available:${NC} ${disk_avail}"
    
    if [ "$disk_usage" -lt 70 ]; then
        log_success "Disk space is healthy (${disk_usage}%)"
    elif [ "$disk_usage" -lt 85 ]; then
        log_warn "Disk space is elevated (${disk_usage}%)"
    else
        log_error "Disk space is CRITICAL (${disk_usage}%)"
        ((FAILURE_COUNT++))
    fi
}

# 7. Check PM2 Processes
check_pm2_processes() {
    echo -e "\n${BLUE}━━━ Checking PM2 Processes ━━━${NC}"
    
    if ! command -v pm2 &> /dev/null; then
        log_warn "PM2 not installed or not in PATH"
        return 0
    fi
    
    local pm2_list=$(pm2 jlist 2>/dev/null)
    
    if [ -z "$pm2_list" ] || [ "$pm2_list" = "[]" ]; then
        log_warn "No PM2 processes running"
        return 0
    fi
    
    echo "$pm2_list" | jq -r '.[] | "\(.name): \(.pm2_env.status) (CPU: \(.monit.cpu)%, MEM: \(.monit.memory / 1024 / 1024 | floor)MB)"' 2>/dev/null || {
        log_warn "Could not parse PM2 process list"
        pm2 list
    }
    
    # Check if any process is stopped
    local stopped_count=$(echo "$pm2_list" | jq '[.[] | select(.pm2_env.status != "online")] | length' 2>/dev/null || echo "0")
    
    if [ "$stopped_count" -gt 0 ]; then
        log_error "$stopped_count PM2 process(es) are not online"
        ((FAILURE_COUNT++))
        return 1
    else
        log_success "All PM2 processes are online"
        return 0
    fi
}

# ============================================================================
# AUTO-RESTART FUNCTION
# ============================================================================

auto_restart_services() {
    echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}⚠️  CRITICAL: $FAILURE_COUNT failures detected!${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ "$FAILURE_COUNT" -ge "$ALERT_THRESHOLD" ]; then
        log_error "Failure threshold reached ($FAILURE_COUNT >= $ALERT_THRESHOLD)"
        log_info "Initiating auto-restart sequence..."
        
        # Send Telegram alert before restart
        send_telegram_message "🚨 ALERT: System health check failed ($FAILURE_COUNT failures). Initiating auto-restart..."
        
        # Restart PM2 processes
        if command -v pm2 &> /dev/null; then
            log_info "Restarting PM2 processes..."
            pm2 restart all
            sleep 5
            
            log_success "PM2 processes restarted"
            send_telegram_message "✅ PM2 processes have been restarted. Monitoring will continue..."
        else
            log_error "PM2 not available for restart"
            send_telegram_message "❌ PM2 not available. Manual intervention required!"
        fi
        
        # Reset failure count after restart
        FAILURE_COUNT=0
    else
        log_warn "Failures detected but below threshold ($FAILURE_COUNT < $ALERT_THRESHOLD)"
        log_info "Will auto-restart if failures reach $ALERT_THRESHOLD"
    fi
}

# ============================================================================
# TELEGRAM NOTIFICATION
# ============================================================================

send_telegram_message() {
    local message="$1"
    
    if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
        return 0  # Silently skip if not configured
    fi
    
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" \
        > /dev/null 2>&1
}

# ============================================================================
# DOMAIN CHECK (OPTIONAL)
# ============================================================================

check_domain_access() {
    local domain="$1"
    
    echo -e "\n${BLUE}━━━ Checking Domain Access: $domain ━━━${NC}"
    
    local response=$(curl -s -w "\n%{http_code}" "https://$domain/health" 2>/dev/null)
    local http_code=$(echo "$response" | tail -1)
    
    if [ "$http_code" = "200" ]; then
        log_success "Domain $domain is accessible - HTTP $http_code"
        return 0
    else
        log_error "Domain $domain returned HTTP $http_code"
        return 1
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    print_header
    
    # Reset failure count
    FAILURE_COUNT=0
    
    # Run all checks
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${MAGENTA}📡 NETWORK & PORTS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_port 8080 "Node.js API (Production)"
    check_port 8000 "Python FastAPI"
    check_port 80 "NGINX HTTP"
    check_port 443 "NGINX HTTPS"
    
    echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${MAGENTA}🏥 HEALTH ENDPOINTS${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_api_health "http://localhost:8080/health" "Node.js API"
    check_python_service
    
    echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${MAGENTA}📱 TELEGRAM BOT${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_telegram_bot
    
    echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${MAGENTA}💾 SYSTEM RESOURCES${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_ram_usage
    check_disk_space
    
    echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${MAGENTA}🔄 PROCESS MANAGEMENT${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_pm2_processes
    
    # Optional: Check domain if provided
    if [ -n "${DOMAIN:-}" ]; then
        echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${MAGENTA}🌐 DOMAIN ACCESS${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        check_domain_access "$DOMAIN"
    fi
    
    # Summary and auto-restart decision
    echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${MAGENTA}📊 SUMMARY${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$FAILURE_COUNT" -eq 0 ]; then
        echo -e "\n${GREEN}✅ ALL SYSTEMS OPERATIONAL${NC}"
        echo -e "${GREEN}🎉 No issues detected!${NC}\n"
        exit 0
    else
        echo -e "\n${YELLOW}⚠️  ISSUES DETECTED: $FAILURE_COUNT failure(s)${NC}\n"
        
        # Check if auto-restart is needed
        if [ "$FAILURE_COUNT" -ge "$ALERT_THRESHOLD" ]; then
            auto_restart_services
        fi
        
        exit 1
    fi
}

# ============================================================================
# SCRIPT ENTRY POINT
# ============================================================================

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --no-restart)
            ALERT_THRESHOLD=999  # Disable auto-restart
            shift
            ;;
        --threshold)
            ALERT_THRESHOLD="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --domain DOMAIN       Check domain accessibility"
            echo "  --no-restart          Disable auto-restart on failures"
            echo "  --threshold N         Set failure threshold for auto-restart (default: 3)"
            echo "  --help                Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  TELEGRAM_BOT_TOKEN    Telegram bot token for notifications"
            echo "  TELEGRAM_CHAT_ID      Telegram chat ID for notifications"
            echo "  DOMAIN                Domain to check (alternative to --domain)"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main

#!/bin/bash

# 🔍 CRYPTO API - SYSTEM HEALTH CHECK SCRIPT
# Quick diagnostic tool untuk cek status sistem

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 CRYPTO API - SYSTEM HEALTH CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📅 Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local name=$2
    local expected_status=${3:-200}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ $name${NC} - HTTP $response"
        return 0
    else
        echo -e "${RED}❌ $name${NC} - HTTP $response (expected $expected_status)"
        return 1
    fi
}

# Function to check process
check_process() {
    local process_name=$1
    local display_name=$2
    
    if pgrep -f "$process_name" > /dev/null; then
        echo -e "${GREEN}✅ $display_name${NC} - Running"
        return 0
    else
        echo -e "${RED}❌ $display_name${NC} - Not Running"
        return 1
    fi
}

# Function to check port
check_port() {
    local port=$1
    local service=$2
    
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo -e "${GREEN}✅ Port $port${NC} - $service listening"
        return 0
    elif ss -tuln 2>/dev/null | grep -q ":$port "; then
        echo -e "${GREEN}✅ Port $port${NC} - $service listening"
        return 0
    else
        echo -e "${RED}❌ Port $port${NC} - $service not listening"
        return 1
    fi
}

# Counter for issues
ISSUES=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 1. NETWORK & PORTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check production port (8080) or development port (5000)
if netstat -tuln 2>/dev/null | grep -q ":8080 " || ss -tuln 2>/dev/null | grep -q ":8080 "; then
    check_port 8080 "Node.js API (Production)" || ((ISSUES++))
elif netstat -tuln 2>/dev/null | grep -q ":5000 " || ss -tuln 2>/dev/null | grep -q ":5000 "; then
    check_port 5000 "Node.js Gateway (Development)" || ((ISSUES++))
else
    echo -e "${RED}❌ Node.js API${NC} - Neither port 8080 nor 5000 is listening"
    ((ISSUES++))
fi

check_port 8000 "Python FastAPI" || ((ISSUES++))
check_port 80 "NGINX HTTP" || ((ISSUES++))
check_port 443 "NGINX HTTPS" || ((ISSUES++))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 2. PROCESSES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

check_process "node.*server/index" "Node.js Server" || ((ISSUES++))
check_process "python.*uvicorn" "Python FastAPI" || ((ISSUES++))
check_process "nginx" "NGINX" || ((ISSUES++))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏥 3. HEALTH ENDPOINTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check localhost endpoints (try production port first, then development)
if netstat -tuln 2>/dev/null | grep -q ":8080 " || ss -tuln 2>/dev/null | grep -q ":8080 "; then
    check_endpoint "http://localhost:8080/health" "Node.js Health" || ((ISSUES++))
else
    check_endpoint "http://localhost:5000/health" "Node.js Health" || ((ISSUES++))
fi

check_endpoint "http://localhost:8000/health" "Python Health" || ((ISSUES++))

# Check GPTs health (try both ports)
if netstat -tuln 2>/dev/null | grep -q ":8080 " || ss -tuln 2>/dev/null | grep -q ":8080 "; then
    check_endpoint "http://localhost:8080/gpts/health" "GPTs Health" || ((ISSUES++))
else
    check_endpoint "http://localhost:5000/gpts/health" "GPTs Health" || ((ISSUES++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 4. MEMORY STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check memory endpoint (try production port first)
if netstat -tuln 2>/dev/null | grep -q ":8080 " || ss -tuln 2>/dev/null | grep -q ":8080 "; then
    memory_response=$(curl -s "http://localhost:8080/api/debug/memory" 2>/dev/null)
else
    memory_response=$(curl -s "http://localhost:5000/api/debug/memory" 2>/dev/null)
fi

if [ $? -eq 0 ]; then
    heap_percent=$(echo "$memory_response" | grep -o '"percent":"[^"]*"' | cut -d'"' -f4 | head -1)
    heap_used=$(echo "$memory_response" | grep -o '"used":"[^"]*"' | cut -d'"' -f4 | head -1)
    heap_total=$(echo "$memory_response" | grep -o '"total":"[^"]*"' | cut -d'"' -f4 | head -1)
    
    if [ -n "$heap_percent" ]; then
        heap_num=$(echo "$heap_percent" | sed 's/%//')
        
        if (( $(echo "$heap_num < 70" | bc -l) )); then
            echo -e "${GREEN}✅ Heap Usage${NC}: $heap_percent ($heap_used / $heap_total)"
        elif (( $(echo "$heap_num < 85" | bc -l) )); then
            echo -e "${YELLOW}⚠️  Heap Usage${NC}: $heap_percent ($heap_used / $heap_total)"
            ((ISSUES++))
        else
            echo -e "${RED}❌ Heap Usage${NC}: $heap_percent ($heap_used / $heap_total) - CRITICAL"
            ((ISSUES++))
        fi
    else
        echo -e "${YELLOW}⚠️  Could not parse memory data${NC}"
    fi
else
    echo -e "${RED}❌ Memory endpoint unavailable${NC}"
    ((ISSUES++))
fi

# System memory
total_mem=$(free -m | awk 'NR==2{print $2}')
used_mem=$(free -m | awk 'NR==2{print $3}')
mem_percent=$(awk "BEGIN {printf \"%.1f\", ($used_mem/$total_mem)*100}")

echo ""
echo "System Memory: ${used_mem}MB / ${total_mem}MB (${mem_percent}%)"

if (( $(echo "$mem_percent < 80" | bc -l) )); then
    echo -e "${GREEN}✅ System memory OK${NC}"
else
    echo -e "${YELLOW}⚠️  System memory high${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💿 5. DISK SPACE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')

if [ "$disk_usage" -lt 80 ]; then
    echo -e "${GREEN}✅ Disk Usage${NC}: ${disk_usage}%"
elif [ "$disk_usage" -lt 90 ]; then
    echo -e "${YELLOW}⚠️  Disk Usage${NC}: ${disk_usage}%"
    ((ISSUES++))
else
    echo -e "${RED}❌ Disk Usage${NC}: ${disk_usage}% - CRITICAL"
    ((ISSUES++))
fi

df -h / | awk 'NR==2{print "Available: " $4 " / " $2}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 6. EXTERNAL SERVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we can reach external APIs
if curl -s --max-time 5 "https://api.okx.com/api/v5/public/time" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OKX API${NC} - Reachable"
else
    echo -e "${RED}❌ OKX API${NC} - Unreachable"
    ((ISSUES++))
fi

if curl -s --max-time 5 "https://rest.coinapi.io/v1/time" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ CoinAPI${NC} - Reachable"
else
    echo -e "${RED}❌ CoinAPI${NC} - Unreachable"
    ((ISSUES++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 7. SERVICE STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check main health endpoint for service status (more detailed)
if netstat -tuln 2>/dev/null | grep -q ":8080 " || ss -tuln 2>/dev/null | grep -q ":8080 "; then
    main_health=$(curl -s "http://localhost:8080/health" 2>/dev/null)
else
    main_health=$(curl -s "http://localhost:5000/health" 2>/dev/null)
fi

if [ $? -eq 0 ]; then
    # Parse service status
    if echo "$main_health" | grep -q '"status":"operational"'; then
        echo -e "${GREEN}✅ System Status${NC}: Operational"
    else
        echo -e "${YELLOW}⚠️  System Status${NC}: Degraded"
        ((ISSUES++))
    fi
    
    # Check individual services
    if echo "$main_health" | grep -q '"okx":"connected"'; then
        echo -e "${GREEN}✅ OKX Service${NC}: Connected"
    else
        echo -e "${RED}❌ OKX Service${NC}: Disconnected"
        ((ISSUES++))
    fi
    
    if echo "$main_health" | grep -q '"coinglass":"connected"'; then
        echo -e "${GREEN}✅ CoinGlass Service${NC}: Connected"
    else
        echo -e "${RED}❌ CoinGlass Service${NC}: Disconnected"
        ((ISSUES++))
    fi
    
    # Show uptime if available
    uptime=$(echo "$main_health" | grep -o '"uptime":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$uptime" ]; then
        echo ""
        echo "System Uptime: $uptime"
    fi
else
    echo -e "${RED}❌ Could not fetch service status${NC}"
    ((ISSUES++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 8. TELEGRAM BOT STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if Telegram is configured
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    # Test Telegram API connectivity
    telegram_response=$(curl -s -w "\n%{http_code}" "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" 2>/dev/null)
    telegram_code=$(echo "$telegram_response" | tail -1)
    
    if [ "$telegram_code" = "200" ]; then
        telegram_body=$(echo "$telegram_response" | head -n -1)
        bot_name=$(echo "$telegram_body" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Telegram Bot${NC} - Connected (@$bot_name)"
    else
        echo -e "${RED}❌ Telegram Bot${NC} - Connection failed (HTTP $telegram_code)"
        ((ISSUES++))
    fi
else
    echo -e "${YELLOW}⚠️  Telegram Bot${NC} - Not configured"
    echo "   Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 9. RECENT LOGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for recent errors in logs
if [ -f "/var/log/pm2/sol-trading-error.log" ]; then
    error_count=$(tail -100 /var/log/pm2/sol-trading-error.log 2>/dev/null | grep -i "error" | wc -l)
    
    if [ "$error_count" -eq 0 ]; then
        echo -e "${GREEN}✅ No recent errors${NC} in logs"
    elif [ "$error_count" -lt 5 ]; then
        echo -e "${YELLOW}⚠️  ${error_count} errors${NC} in last 100 log lines"
    else
        echo -e "${RED}❌ ${error_count} errors${NC} in last 100 log lines - Check logs!"
        ((ISSUES++))
    fi
else
    echo -e "${YELLOW}⚠️  Log file not found${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📈 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ ALL SYSTEMS OPERATIONAL${NC}"
    echo ""
    echo "🎉 No issues detected!"
    exit 0
elif [ $ISSUES -lt 3 ]; then
    echo -e "${YELLOW}⚠️  MINOR ISSUES DETECTED${NC}"
    echo ""
    echo "Found $ISSUES issue(s). Review the report above."
    exit 1
else
    echo -e "${RED}❌ CRITICAL ISSUES DETECTED${NC}"
    echo ""
    echo "Found $ISSUES issue(s). Immediate attention required!"
    exit 2
fi

#!/bin/bash

# 🐕 Setup Crypto API Health Watchdog
# Installs and configures the health watchdog with systemd timer

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🐕 Crypto API Health Watchdog Setup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (use sudo)${NC}"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================================================
# 1. Make scripts executable
# ============================================================================

echo -e "${BLUE}[1/6]${NC} Making scripts executable..."

chmod +x "$SCRIPT_DIR/watchdog-health.sh"
chmod +x "$SCRIPT_DIR/monitor-system.sh"
chmod +x "$SCRIPT_DIR/check-system-health.sh"

echo -e "${GREEN}✅ Scripts are now executable${NC}"
echo ""

# ============================================================================
# 2. Create log directory
# ============================================================================

echo -e "${BLUE}[2/6]${NC} Setting up log directory..."

touch /var/log/crypto-api-watchdog.log
touch /var/log/crypto-api-monitor.log
chmod 644 /var/log/crypto-api-watchdog.log
chmod 644 /var/log/crypto-api-monitor.log

echo -e "${GREEN}✅ Log files created${NC}"
echo ""

# ============================================================================
# 3. Configure Telegram (optional)
# ============================================================================

echo -e "${BLUE}[3/6]${NC} Telegram Bot Configuration"
echo ""

read -p "Do you want to configure Telegram notifications? (y/n): " configure_telegram

if [ "$configure_telegram" = "y" ] || [ "$configure_telegram" = "Y" ]; then
    echo ""
    read -p "Enter your Telegram Bot Token: " bot_token
    read -p "Enter your Telegram Chat ID: " chat_id
    
    # Update systemd service file with Telegram credentials
    sed -i "s|Environment=\"TELEGRAM_BOT_TOKEN=\"|Environment=\"TELEGRAM_BOT_TOKEN=$bot_token\"|g" \
        "$SCRIPT_DIR/systemd/crypto-api-watchdog.service"
    sed -i "s|Environment=\"TELEGRAM_CHAT_ID=\"|Environment=\"TELEGRAM_CHAT_ID=$chat_id\"|g" \
        "$SCRIPT_DIR/systemd/crypto-api-watchdog.service"
    
    # Also add to user's bashrc for manual script runs
    if ! grep -q "TELEGRAM_BOT_TOKEN" ~/.bashrc; then
        echo "" >> ~/.bashrc
        echo "# Crypto API Telegram Bot" >> ~/.bashrc
        echo "export TELEGRAM_BOT_TOKEN=\"$bot_token\"" >> ~/.bashrc
        echo "export TELEGRAM_CHAT_ID=\"$chat_id\"" >> ~/.bashrc
    fi
    
    echo -e "${GREEN}✅ Telegram configured${NC}"
    
    # Test Telegram connection
    echo ""
    echo "Testing Telegram connection..."
    response=$(curl -s "https://api.telegram.org/bot${bot_token}/getMe")
    if echo "$response" | grep -q '"ok":true'; then
        bot_name=$(echo "$response" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}✅ Telegram bot connected: @$bot_name${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not verify Telegram bot. Please check your credentials.${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping Telegram configuration${NC}"
fi

echo ""

# ============================================================================
# 4. Install systemd service and timer
# ============================================================================

echo -e "${BLUE}[4/6]${NC} Installing systemd service and timer..."

# Copy service and timer files
cp "$SCRIPT_DIR/systemd/crypto-api-watchdog.service" /etc/systemd/system/
cp "$SCRIPT_DIR/systemd/crypto-api-watchdog.timer" /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

echo -e "${GREEN}✅ Systemd files installed${NC}"
echo ""

# ============================================================================
# 5. Enable and start the timer
# ============================================================================

echo -e "${BLUE}[5/6]${NC} Enabling and starting watchdog timer..."

# Enable timer (auto-start on boot)
systemctl enable crypto-api-watchdog.timer

# Start timer
systemctl start crypto-api-watchdog.timer

echo -e "${GREEN}✅ Watchdog timer is now active${NC}"
echo ""

# ============================================================================
# 6. Verify installation
# ============================================================================

echo -e "${BLUE}[6/6]${NC} Verifying installation..."
echo ""

# Check timer status
if systemctl is-active --quiet crypto-api-watchdog.timer; then
    echo -e "${GREEN}✅ Timer is active${NC}"
else
    echo -e "${RED}❌ Timer is not active${NC}"
fi

# Check timer schedule
echo ""
echo "Timer schedule:"
systemctl list-timers crypto-api-watchdog.timer --no-pager

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Watchdog Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary:"
echo "  • Watchdog will check system health every 3 minutes"
echo "  • Auto-restart will trigger after 3 consecutive failures"
echo "  • Logs: /var/log/crypto-api-watchdog.log"
echo ""
echo "🔧 Useful Commands:"
echo "  • Check timer status:    systemctl status crypto-api-watchdog.timer"
echo "  • View logs:             tail -f /var/log/crypto-api-watchdog.log"
echo "  • Manual health check:   bash $SCRIPT_DIR/watchdog-health.sh"
echo "  • Stop watchdog:         systemctl stop crypto-api-watchdog.timer"
echo "  • Disable watchdog:      systemctl disable crypto-api-watchdog.timer"
echo ""
echo "📱 Telegram Notifications:"
if [ "$configure_telegram" = "y" ] || [ "$configure_telegram" = "Y" ]; then
    echo "  • Enabled ✅"
    echo "  • You will receive alerts for:"
    echo "    - Health check failures"
    echo "    - Auto-restart events"
    echo "    - Service recovery confirmations"
else
    echo "  • Not configured"
    echo "  • Run this script again to configure"
fi
echo ""
echo "🚀 Next Steps:"
echo "  1. Test the watchdog: bash $SCRIPT_DIR/watchdog-health.sh"
echo "  2. Monitor logs: tail -f /var/log/crypto-api-watchdog.log"
echo "  3. Review full guide: cat $SCRIPT_DIR/PANDUAN_MONITORING_SISTEM.md"
echo ""

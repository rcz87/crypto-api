#!/bin/bash

# Setup script for production cron job deployment
# Usage: ./setup-cron.sh

echo "🔧 Setting up Enhanced Intelligent Screening System Health Monitor for production..."

# Make health monitor executable
chmod +x scripts/health-monitor.js

# Create logs directory
mkdir -p logs

# Create example crontab entry
cat << 'EOF' > health-monitor-cron-example.txt
# Enhanced Intelligent Screening System Health Monitor
# Runs every 5 minutes and logs results
*/5 * * * * cd /path/to/project && node scripts/health-monitor.js >> logs/cron.log 2>&1

# Alternative: Run every hour during business hours
# 0 9-17 * * 1-5 cd /path/to/project && node scripts/health-monitor.js

# Example with environment variables:
# */5 * * * * cd /path/to/project && SENDGRID_API_KEY=your_key TELEGRAM_BOT_TOKEN=your_token TELEGRAM_CHAT_ID=your_id node scripts/health-monitor.js
EOF

echo "✅ Setup completed!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Set environment variables:"
echo "   export SENDGRID_API_KEY=your_sendgrid_api_key"
echo "   export TELEGRAM_BOT_TOKEN=your_bot_token"  
echo "   export TELEGRAM_CHAT_ID=your_chat_id"
echo ""
echo "2. Test manually:"
echo "   node scripts/health-monitor.js"
echo ""
echo "3. Add to crontab:"
echo "   crontab -e"
echo "   # Then add line from health-monitor-cron-example.txt"
echo ""
echo "4. Monitor logs:"
echo "   tail -f logs/health-monitor.log"
echo ""
echo "🎯 Exit codes:"
echo "   0 = All systems healthy (GREEN)"
echo "   1 = Warnings detected (YELLOW)" 
echo "   2 = Critical errors (RED)"
#!/bin/bash

# Make all monitoring scripts executable

echo "🔧 Making monitoring scripts executable..."

chmod +x monitor-system.sh
chmod +x check-system-health.sh
chmod +x watchdog-health.sh
chmod +x setup-watchdog.sh

echo "✅ All scripts are now executable!"
echo ""
echo "Available scripts:"
echo "  • monitor-system.sh      - Enhanced monitoring with auto-restart"
echo "  • check-system-health.sh - Comprehensive health check"
echo "  • watchdog-health.sh     - Health watchdog daemon"
echo "  • setup-watchdog.sh      - Automated watchdog setup"
echo ""
echo "Quick start:"
echo "  bash monitor-system.sh"

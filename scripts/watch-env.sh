#!/bin/bash

# Crypto API Environment File Watcher
# Monitors .env file and triggers service reload on changes

ENV_FILE="/root/crypto-api/.env"
LOG_FILE="/var/log/crypto-api/env-watcher.log"
CHECK_INTERVAL=5

# Create log directory if it doesn't exist
mkdir -p /var/log/crypto-api

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to get file modification time
get_mtime() {
    stat -c %Y "$ENV_FILE" 2>/dev/null || echo "0"
}

log_message "🔍 Environment file watcher started"
log_message "📁 Monitoring: $ENV_FILE"
log_message "⏱️  Check interval: ${CHECK_INTERVAL}s"

# Get initial modification time
LAST_MTIME=$(get_mtime)

while true; do
    sleep "$CHECK_INTERVAL"
    
    # Check if file exists
    if [ ! -f "$ENV_FILE" ]; then
        log_message "⚠️  Warning: .env file not found!"
        continue
    fi
    
    # Get current modification time
    CURRENT_MTIME=$(get_mtime)
    
    # Check if file was modified
    if [ "$CURRENT_MTIME" != "$LAST_MTIME" ]; then
        log_message "🔄 .env file changed detected!"
        log_message "📝 Old mtime: $LAST_MTIME"
        log_message "📝 New mtime: $CURRENT_MTIME"
        
        # Wait a moment to ensure file write is complete
        sleep 1
        
        # Reload services
        log_message "🔄 Reloading Python service..."
        systemctl reload-or-restart python_service.service
        
        log_message "🔄 Reloading Node service..."
        systemctl reload-or-restart node_service.service
        
        log_message "✅ Services reloaded successfully"
        
        # Update last modification time
        LAST_MTIME="$CURRENT_MTIME"
    fi
done

#!/bin/bash

# Setup log rotation for Crypto API services
# This script configures logrotate for both systemd journal and custom logs

set -e

echo "🔧 Setting up log rotation for Crypto API..."

# Create log directory
sudo mkdir -p /var/log/crypto-api
sudo chown root:root /var/log/crypto-api
sudo chmod 755 /var/log/crypto-api

# Create logrotate configuration
cat > /tmp/crypto-api-logrotate << 'EOF'
# Crypto API Log Rotation Configuration

# Custom application logs
/var/log/crypto-api/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    create 0644 root root
    sharedscripts
    postrotate
        # Reload services to reopen log files
        systemctl reload python_service.service 2>/dev/null || true
        systemctl reload node_service.service 2>/dev/null || true
    endscript
}

# Environment watcher logs
/var/log/crypto-api/env-*.log {
    weekly
    rotate 4
    compress
    delaycompress
    notifempty
    missingok
    create 0644 root root
}
EOF

# Install logrotate configuration
sudo mv /tmp/crypto-api-logrotate /etc/logrotate.d/crypto-api
sudo chmod 644 /etc/logrotate.d/crypto-api

echo "✅ Logrotate configuration installed"

# Configure journald for systemd logs
cat > /tmp/journald-crypto-api.conf << 'EOF'
# Crypto API Journald Configuration
[Journal]
# Keep logs for 30 days
MaxRetentionSec=30d

# Limit journal size to 500MB
SystemMaxUse=500M
RuntimeMaxUse=100M

# Compress logs older than 1 day
MaxFileSec=1day

# Forward to syslog
ForwardToSyslog=no
ForwardToKMsg=no
ForwardToConsole=no
EOF

sudo mv /tmp/journald-crypto-api.conf /etc/systemd/journald.conf.d/crypto-api.conf
sudo chmod 644 /etc/systemd/journald.conf.d/crypto-api.conf

echo "✅ Journald configuration installed"

# Restart journald to apply changes
sudo systemctl restart systemd-journald

echo "✅ Log rotation setup complete!"
echo ""
echo "📊 Log locations:"
echo "  - Application logs: /var/log/crypto-api/"
echo "  - Systemd journal: journalctl -u python_service -u node_service"
echo ""
echo "🔄 Log rotation schedule:"
echo "  - Application logs: Daily, keep 14 days"
echo "  - Environment logs: Weekly, keep 4 weeks"
echo "  - Journal logs: Keep 30 days, max 500MB"

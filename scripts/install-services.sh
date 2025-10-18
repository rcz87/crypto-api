#!/bin/bash

# Crypto API Services Installation Script
# Installs and configures all systemd services for production deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SYSTEMD_DIR="$PROJECT_ROOT/systemd"

echo "🚀 Installing Crypto API Services..."
echo "📁 Project root: $PROJECT_ROOT"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Create log directory
echo "📁 Creating log directory..."
mkdir -p /var/log/crypto-api
chown root:root /var/log/crypto-api
chmod 755 /var/log/crypto-api

# Create journald config directory
mkdir -p /etc/systemd/journald.conf.d

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x "$SCRIPT_DIR/watch-env.sh"
chmod +x "$SCRIPT_DIR/setup-logrotate.sh"

# Stop existing services if running
echo "🛑 Stopping existing services..."
systemctl stop python_service.service 2>/dev/null || true
systemctl stop node_service.service 2>/dev/null || true
systemctl stop env-watcher.service 2>/dev/null || true
systemctl stop env-watcher.path 2>/dev/null || true

# Install service files
echo "📦 Installing service files..."
cp "$SYSTEMD_DIR/python_service.service" /etc/systemd/system/
cp "$SYSTEMD_DIR/node_service.service" /etc/systemd/system/
cp "$SYSTEMD_DIR/env-watcher.service" /etc/systemd/system/
cp "$SYSTEMD_DIR/env-watcher.path" /etc/systemd/system/
cp "$SYSTEMD_DIR/env-reload.service" /etc/systemd/system/

# Set correct permissions
chmod 644 /etc/systemd/system/python_service.service
chmod 644 /etc/systemd/system/node_service.service
chmod 644 /etc/systemd/system/env-watcher.service
chmod 644 /etc/systemd/system/env-watcher.path
chmod 644 /etc/systemd/system/env-reload.service

# Reload systemd
echo "🔄 Reloading systemd daemon..."
systemctl daemon-reload

# Enable services
echo "✅ Enabling services..."
systemctl enable python_service.service
systemctl enable node_service.service
systemctl enable env-watcher.path

# Setup log rotation
echo "📊 Setting up log rotation..."
bash "$SCRIPT_DIR/setup-logrotate.sh"

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Available commands:"
echo "  Start services:    sudo systemctl start python_service node_service"
echo "  Stop services:     sudo systemctl stop python_service node_service"
echo "  Restart services:  sudo systemctl restart python_service node_service"
echo "  Check status:      sudo systemctl status python_service node_service"
echo "  View logs:         sudo journalctl -u python_service -u node_service -f"
echo ""
echo "🔄 Environment auto-reload:"
echo "  Enable:            sudo systemctl start env-watcher.path"
echo "  Status:            sudo systemctl status env-watcher.path"
echo ""
echo "📊 Log locations:"
echo "  Application logs:  /var/log/crypto-api/"
echo "  Systemd journal:   journalctl -u python_service -u node_service"
echo ""
echo "🎯 Next steps:"
echo "  1. Verify .env file exists: ls -la $PROJECT_ROOT/.env"
echo "  2. Build the application: cd $PROJECT_ROOT && npm run build"
echo "  3. Start services: sudo systemctl start python_service node_service"
echo "  4. Enable env watcher: sudo systemctl start env-watcher.path"

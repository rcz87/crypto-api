#!/bin/bash

# 🔄 Sync Latest Changes to VPS Hostinger
# Script untuk sync perubahan terbaru ke VPS yang sudah partial deploy

set -e

# Configuration
VPS_IP="${1:-your-vps-ip}"
VPS_USER="${2:-root}"
VPS_PATH="/var/www/crypto-trading"
APP_NAME="crypto-trading-dashboard"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

echo "🔄 Syncing latest changes to VPS..."
echo "VPS: $VPS_USER@$VPS_IP"
echo "Path: $VPS_PATH"
echo "======================================"

# Check if dist folder exists
if [ ! -d "dist" ]; then
    print_info "Building application first..."
    npm run build
fi

print_status "Step 1: Syncing built application..."
rsync -avz --progress dist/ $VPS_USER@$VPS_IP:$VPS_PATH/dist/

print_status "Step 2: Syncing client build..."
if [ -d "client/dist" ]; then
    rsync -avz --progress client/dist/ $VPS_USER@$VPS_IP:$VPS_PATH/client/dist/
fi

print_status "Step 3: Syncing configuration files..."
scp package.json $VPS_USER@$VPS_IP:$VPS_PATH/
scp ecosystem.config.js $VPS_USER@$VPS_IP:$VPS_PATH/

print_status "Step 4: Syncing deployment guides..."
scp VPS-DEPLOYMENT-GUIDE.md $VPS_USER@$VPS_IP:$VPS_PATH/
scp deploy-to-vps.sh $VPS_USER@$VPS_IP:$VPS_PATH/

print_status "Step 5: Restarting application on VPS..."
ssh $VPS_USER@$VPS_IP << 'EOF'
cd /var/www/crypto-trading

# Install any new dependencies
npm install --only=production

# Restart PM2 application
pm2 restart crypto-trading-dashboard || pm2 start ecosystem.config.js --env production

# Check status
pm2 status
pm2 logs crypto-trading-dashboard --lines 10
EOF

print_status "Sync completed! 🎉"
echo ""
echo "🔧 Check VPS status:"
echo "ssh $VPS_USER@$VPS_IP 'pm2 status'"
echo ""
echo "📊 View logs:"
echo "ssh $VPS_USER@$VPS_IP 'pm2 logs crypto-trading-dashboard'"
echo ""
echo "🌐 Test endpoints:"
echo "curl https://yourdomain.com/health"
echo "curl https://yourdomain.com/api/sol/complete"
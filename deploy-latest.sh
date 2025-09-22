#!/bin/bash

# 🚀 Deploy Latest Multi-Coin Features to VPS 212.85.26.253
# Complete deployment script dengan SSH key authentication

set -e

VPS_IP="212.85.26.253"
VPS_USER="root"
VPS_PATH="/var/www/crypto-trading"
APP_NAME="crypto-trading-dashboard"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🚀 Deploying Multi-Coin Dashboard to VPS..."
echo "VPS: $VPS_USER@$VPS_IP"
echo "======================================"

# Test SSH connection first
print_info "Testing SSH connection..."
if ssh -o ConnectTimeout=10 $VPS_USER@$VPS_IP 'echo "SSH Connected!"' 2>/dev/null; then
    print_status "SSH key authentication working!"
else
    print_error "SSH key authentication failed. Please setup SSH key first!"
    echo "Run: ./setup-ssh-vps.sh"
    exit 1
fi

# Upload update package
print_status "Step 1: Uploading latest build to VPS..."
scp vps-update.tar.gz $VPS_USER@$VPS_IP:$VPS_PATH/

# Deploy on VPS
print_status "Step 2: Deploying application on VPS..."
ssh $VPS_USER@$VPS_IP << EOF
set -e
cd $VPS_PATH

echo "📦 Extracting latest build..."
tar -xzf vps-update.tar.gz

echo "📦 Installing dependencies..."
npm install --only=production

echo "🔄 Checking current PM2 status..."
pm2 status || echo "PM2 app not running yet"

echo "🚀 Starting/Restarting application..."
pm2 restart $APP_NAME || pm2 start ecosystem.config.js --env production --name $APP_NAME

echo "✅ Application deployed successfully!"
echo ""
echo "📊 Current Status:"
pm2 status

echo ""
echo "📝 Recent Logs:"
pm2 logs $APP_NAME --lines 10

echo ""
echo "🌐 Application Info:"
echo "- Internal URL: http://localhost:5000"
echo "- External URL: http://$VPS_IP:5000 (if firewall allows)"
echo "- Health Check: curl http://localhost:5000/health"
echo "- API Endpoint: curl http://localhost:5000/api/sol/complete"
EOF

print_status "Step 3: Testing deployment..."
ssh $VPS_USER@$VPS_IP 'curl -s http://localhost:5000/health | head -5'

print_status "Deployment completed! 🎉"
echo ""
echo "🎯 Multi-Coin Features Now Active:"
echo "✅ SOL/BTC/ETH support"
echo "✅ Real-time WebSocket streaming"
echo "✅ Enhanced AI Signal Engine"
echo "✅ TradingView widget integration"
echo "✅ JSON parsing errors fixed"
echo ""
echo "🔧 Management Commands:"
echo "- Check status: ssh $VPS_USER@$VPS_IP 'pm2 status'"
echo "- View logs: ssh $VPS_USER@$VPS_IP 'pm2 logs $APP_NAME'"
echo "- Restart app: ssh $VPS_USER@$VPS_IP 'pm2 restart $APP_NAME'"
echo ""
echo "🌐 Test Endpoints:"
echo "ssh $VPS_USER@$VPS_IP 'curl http://localhost:5000/health'"
echo "ssh $VPS_USER@$VPS_IP 'curl http://localhost:5000/api/sol/complete'"
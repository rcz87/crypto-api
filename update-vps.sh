#!/bin/bash

# 🚀 Quick Update VPS Hostinger dengan Multi-Coin Features
# Update aplikasi yang sudah running di VPS

echo "🔄 Updating VPS Hostinger dengan latest multi-coin features..."

# Kompres build files untuk upload cepat
echo "📦 Creating update package..."
tar -czf vps-update.tar.gz \
    dist/ \
    package.json \
    ecosystem.config.js \
    --exclude=node_modules \
    --exclude=.git

echo "✅ Update package created: vps-update.tar.gz"
echo ""
echo "🚀 Untuk update VPS, jalankan command berikut:"
echo ""
echo "# 1. Upload ke VPS (ganti YOUR_VPS_IP dengan IP actual)"
echo "scp vps-update.tar.gz root@YOUR_VPS_IP:/var/www/crypto-trading/"
echo ""
echo "# 2. SSH ke VPS dan extract"
echo "ssh root@YOUR_VPS_IP"
echo "cd /var/www/crypto-trading"
echo "tar -xzf vps-update.tar.gz"
echo ""
echo "# 3. Update dependencies dan restart"
echo "npm install --only=production"
echo "pm2 restart crypto-trading-dashboard"
echo ""
echo "# 4. Check status"
echo "pm2 status"
echo "pm2 logs crypto-trading-dashboard --lines 10"
echo ""
echo "🌐 Test updated application:"
echo "curl https://yourdomain.com/api/sol/complete"
echo "curl https://yourdomain.com/health"
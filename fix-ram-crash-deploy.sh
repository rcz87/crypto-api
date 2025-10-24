#!/bin/bash

# 🔧 Fix RAM Crash & Server Error - Deployment Script
# Fixes: (void 0) is not a function, require is not defined, Dynamic require errors

set -e  # Exit on error

echo "=========================================="
echo "🔧 FIX RAM CRASH & SERVER ERROR"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Clean old build
echo -e "${YELLOW}📦 Step 1: Cleaning old build...${NC}"
rm -rf dist/
echo -e "${GREEN}✅ Old build cleaned${NC}"
echo ""

# Step 2: Build with new config
echo -e "${YELLOW}🔨 Step 2: Building with new CJS config...${NC}"
npm run build

if [ ! -f "dist/index.cjs" ]; then
    echo -e "${RED}❌ Error: dist/index.cjs not created!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful - dist/index.cjs created${NC}"
echo ""

# Step 3: Verify file size (should be reasonable, not bloated)
FILE_SIZE=$(du -h dist/index.cjs | cut -f1)
echo -e "${GREEN}📊 File size: ${FILE_SIZE}${NC}"
echo ""

# Step 4: Deploy to production
echo -e "${YELLOW}🚀 Step 3: Deploying to /var/www/sol-trading...${NC}"

# Create backup of old deployment
if [ -d "/var/www/sol-trading/dist" ]; then
    echo "Creating backup..."
    sudo cp -r /var/www/sol-trading/dist /var/www/sol-trading/dist.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy new build
sudo mkdir -p /var/www/sol-trading/dist
sudo cp dist/index.cjs /var/www/sol-trading/dist/
echo -e "${GREEN}✅ dist/index.cjs deployed${NC}"

# Copy .env if exists
if [ -f ".env" ]; then
    sudo cp .env /var/www/sol-trading/
    echo -e "${GREEN}✅ .env deployed${NC}"
fi

# Copy package.json with updated config
sudo cp package.json /var/www/sol-trading/
echo -e "${GREEN}✅ package.json deployed${NC}"

# Copy ecosystem config
sudo cp ecosystem.config.cjs /var/www/sol-trading/
echo -e "${GREEN}✅ ecosystem.config.cjs deployed${NC}"

# Copy node_modules (if needed)
if [ ! -d "/var/www/sol-trading/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing node_modules in production...${NC}"
    cd /var/www/sol-trading
    sudo npm install --production
    cd -
else
    echo -e "${GREEN}✅ node_modules already exists${NC}"
fi

echo ""

# Step 5: Restart PM2
echo -e "${YELLOW}🔄 Step 4: Restarting PM2...${NC}"

# Check if process exists
if sudo pm2 list | grep -q "sol-trading-platform"; then
    echo "Stopping old process..."
    sudo pm2 stop sol-trading-platform || true
    sudo pm2 delete sol-trading-platform || true
fi

# Start with new config
echo "Starting with new config..."
cd /var/www/sol-trading
sudo pm2 start ecosystem.config.cjs
sudo pm2 save

echo -e "${GREEN}✅ PM2 restarted${NC}"
echo ""

# Step 6: Wait and check logs
echo -e "${YELLOW}📋 Step 5: Checking logs (waiting 5 seconds for startup)...${NC}"
sleep 5

echo ""
echo "=========================================="
echo "📊 RECENT LOGS:"
echo "=========================================="
sudo pm2 logs sol-trading-platform --lines 30 --nostream

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "🔍 To monitor logs in real-time:"
echo "   sudo pm2 logs sol-trading-platform"
echo ""
echo "📊 To check status:"
echo "   sudo pm2 status"
echo ""
echo "🎯 Expected Results:"
echo "   ✅ No '(void 0) is not a function' error"
echo "   ✅ No 'require is not defined' error"
echo "   ✅ No 'Dynamic require of path' error"
echo "   ✅ RAM stays below 50% (not 94%)"
echo "   ✅ Server runs stable"
echo ""

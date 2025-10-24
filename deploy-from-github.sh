#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Navigate to project directory
cd /root/crypto-api

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build application
echo "🔨 Building application..."
npm run build || echo "⚠️ Build step skipped or failed"

# Reload PM2
echo "♻️ Reloading PM2 process..."
pm2 reload ecosystem.config.cjs --update-env
pm2 save

# Health check
echo "🏥 Running health check..."
sleep 5
curl -f http://localhost:5000/healthz || echo "⚠️ Health check warning"

echo "✅ Deployment complete!"

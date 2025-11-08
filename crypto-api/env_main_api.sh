#!/bin/bash
# Environment Configuration for Main Crypto API - Liquidation Heatmap System
# Port: 8501

# API Identification
export API_TYPE="main"
export API_NAME="Liquidation Heatmap System"
export API_PORT="8501"
export API_DESCRIPTION="Cryptocurrency Liquidation Heatmap with Multi-Exchange Aggregation"

# Main API Specific Configuration
export LIQUIDATION_HEATMAP_ENABLED=true
export MULTI_EXCHANGE_AGGREGATION=true
export SOCIAL_INTELLIGENCE_ENABLED=true
export GPT_ASSISTANT_ENABLED=true

# Exchange API Configuration
export BINANCE_API_KEY="${BINANCE_API_KEY:-}"
export BINANCE_API_SECRET="${BINANCE_API_SECRET:-}"
export OKX_API_KEY="${OKX_API_KEY:-}"
export OKX_API_SECRET="${OKX_API_SECRET:-}"
export OKX_API_PASSPHRASE="${OKX_API_PASSPHRASE:-}"
export BYBIT_API_KEY="${BYBIT_API_KEY:-}"
export BYBIT_API_SECRET="${BYBIT_API_SECRET:-}"

# LunarCrush Configuration
export LUNARCRUSH_API_KEY="${LUNARCRUSH_API_KEY:-}"
export LUNARCRUSH_ENABLED=true

# GPT Gateway Configuration
export GPT_GATEWAY_URL="http://localhost:3000"
export GPT_GATEWAY_ENABLED=true

# Performance Settings
export UPDATE_FREQUENCY="5000"  # milliseconds
export MAX_CONCURRENT_REQUESTS="10"
export CACHE_TTL="300"  # seconds

# Visualization Settings
export HEATMAP_RESOLUTION="high"
export CHART_ANIMATION_ENABLED=true
export REAL_TIME_UPDATES=true

# Security Settings
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_REQUESTS_PER_MINUTE="100"
export API_KEY_VALIDATION=true

# Logging Configuration
export LOG_LEVEL="INFO"
export LOG_FILE="logs/main_api.log"
export DEBUG_MODE=false

# Database Configuration (if needed)
export DATABASE_URL="${DATABASE_URL:-sqlite:///main_api.db}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"

# Feature Flags
export PUMP_DETECTION_ENABLED=true
export LEVERAGE_ANALYSIS_ENABLED=true
export SOCIAL_SENTIMENT_ENABLED=true
export ADVANCED_CHARTS_ENABLED=true

# WebSocket Configuration
export WEBSOCKET_ENABLED=true
export WEBSOCKET_PORT="8501"
export WEBSOCKET_PATH="/ws"

# Monitoring Configuration
export METRICS_ENABLED=true
export HEALTH_CHECK_ENABLED=true
export PERFORMANCE_MONITORING=true

echo "✅ Main API Environment Loaded"
echo "🚀 Liquidation Heatmap System - Port 8501"
echo "📊 Features: Liquidation Analysis, Social Intelligence, GPT Assistant"
echo "🔗 Exchanges: Binance, OKX, Bybit"
echo "🤖 GPT Gateway: $GPT_GATEWAY_URL"

#!/bin/bash
# Environment Configuration for GuardiansOfTheToken API - Premium Analytics
# Port: 8502

# API Identification
export API_TYPE="guardians"
export API_NAME="GuardiansOfTheToken Premium Analytics"
export API_PORT="8502"
export API_DESCRIPTION="Premium Orderbook Analysis with Institutional Data"

# GuardiansOfTheToken Configuration
export GUARDIANS_ENABLED=true
export GUARDIANS_API_KEY="${GUARDIANS_API_KEY:-}"
export GUARDIANS_VIP_TIER="${GUARDIANS_VIP_TIER:-premium}"
export GUARDIANS_UPDATE_FREQUENCY="100"  # milliseconds
export GUARDIANS_MAX_DEPTH_LEVELS="100"

# VIP Features Configuration
export GUARDIANS_VIP_FEATURES_ENABLED=true
export ADVANCED_DETECTION_ENABLED=true
export INSTITUTIONAL_DATA_ENABLED=true
export CUSTOM_ALERTS_ENABLED=true

# Alert Configuration
export GUARDIANS_ALERTS_ENABLED=true
export BUY_WALL_THRESHOLD="1000000"  # $1M
export SELL_WALL_THRESHOLD="1000000"
export IMBALANCE_ALERT="0.7"  # 70% imbalance
export LIQUIDITY_ALERT="0.3"  # 30% liquidity drop

# GPT Gateway Configuration
export GPT_GATEWAY_URL="http://localhost:3000"
export GPT_GATEWAY_ENABLED=true
export GPT_ADVANCED_OPERATIONS_ENABLED=true

# Performance Settings
export UPDATE_FREQUENCY="100"  # milliseconds (VIP)
export MAX_CONCURRENT_REQUESTS="50"
export CACHE_TTL="30"  # seconds
export BATCH_SIZE="50"

# Visualization Settings
export PREMIUM_CHARTS_ENABLED=true
export INSTITUTIONAL_VISUALIZATION_ENABLED=true
export REAL_TIME_ORDERBOOK_ENABLED=true
export ADVANCED_ANALYTICS_CHARTS=true

# Security Settings
export RATE_LIMIT_ENABLED=true
export RATE_LIMIT_REQUESTS_PER_MINUTE="500"  # Higher for VIP
export API_KEY_VALIDATION=true
export INSTITUTIONAL_AUTH_ENABLED=true

# Logging Configuration
export LOG_LEVEL="INFO"
export LOG_FILE="logs/guardians_api.log"
export DEBUG_MODE="${GUARDIANS_DEBUG:-false}"
export PERFORMANCE_LOGGING=true

# Database Configuration
export DATABASE_URL="${DATABASE_URL:-sqlite:///guardians_api.db}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/1}"  # Different DB
export CACHE_ENABLED=true

# Feature Flags
export WALL_DETECTION_ENABLED=true
export SPOOFING_DETECTION_ENABLED=true
export ICEBERG_DETECTION_ENABLED=true
export HIDDEN_ORDERS_DETECTION=true
export MARKET_DEPTH_ANALYSIS=true
export LIQUIDITY_ANALYSIS=true

# WebSocket Configuration
export WEBSOCKET_ENABLED=true
export WEBSOCKET_PORT="8502"
export WEBSOCKET_PATH="/ws"
export WEBSOCKET_REAL_TIME_UPDATES=true

# Monitoring Configuration
export METRICS_ENABLED=true
export HEALTH_CHECK_ENABLED=true
export PERFORMANCE_MONITORING=true
export VIP_METRICS_ENABLED=true

# Institutional Features
export INSTITUTIONAL_DATA_FEED=true
export WHALE_ALERTS_ENABLED=true
export MARKET_MAKER_DETECTION=true
export LARGE_ORDER_TRACKING=true

# Advanced Analytics
export PATTERN_RECOGNITION_ENABLED=true
export MACHINE_LEARNING_INSIGHTS=true
export PREDICTIVE_ANALYTICS=true
export RISK_ASSESSMENT_ENABLED=true

# Data Sources
export COINGLASS_ENABLED=true
export COINAPI_ENABLED=true
export ALTERNATIVE_DATA_SOURCES=true

# Quality Settings
export DATA_QUALITY_CHECKS=true
export VALIDATION_ENABLED=true
export ERROR_CORRECTION_ENABLED=true
export DATA_FAILOVER_ENABLED=true

# Integration Settings
export EXTERNAL_APIS_ENABLED=true
export THIRD_PARTY_ANALYTICS=true
export CUSTOM_INTEGRATIONS=true

echo "✅ Guardians API Environment Loaded"
echo "🌟 GuardiansOfTheToken Premium Analytics - Port 8502"
echo "📊 Features: Premium Orderbook, Institutional Analysis, VIP Features"
echo "🏢 VIP Tier: $GUARDIANS_VIP_TIER"
echo "🤖 GPT Gateway: $GPT_GATEWAY_URL"
echo "⚡ Update Frequency: ${GUARDIANS_UPDATE_FREQUENCY}ms"
echo "🔔 Alerts: $GUARDIANS_ALERTS_ENABLED"

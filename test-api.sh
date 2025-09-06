#!/usr/bin/env bash
# CryptoSat Intelligence - Quick API Test Script
API_URL="https://guardiansofthegreentoken.com"
API_KEY="${API_KEY:-test-api-key}"
PAIR="${PAIR:-BTC}"

echo "🛰️ CryptoSat Intelligence API Test"
echo "=================================="
echo "API_URL: ${API_URL}"
echo "Testing Pair: ${PAIR}"
echo ""

# Test without API key (should work as currently public)
echo "📡 Testing /api/pairs/supported (no auth)..."
curl -s "${API_URL}/api/pairs/supported" | jq -r '.success'

echo ""
echo "🔐 Testing with X-API-Key header..."

# Test with API key
echo "📊 Testing /api/${PAIR}/complete..."
response=$(curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/complete")
success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
    echo "✅ Complete analysis: SUCCESS"
    echo "$response" | jq -r '.data | keys[]' | head -5
else
    echo "❌ Complete analysis: FAILED"
fi

echo ""
echo "📈 Testing /api/${PAIR}/smc..."
response=$(curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/smc")
success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
    echo "✅ SMC analysis: SUCCESS"
    trend=$(echo "$response" | jq -r '.data.trend')
    echo "   Trend: $trend"
else
    echo "❌ SMC analysis: FAILED"
fi

echo ""
echo "💹 Testing /api/${PAIR}/cvd..."
response=$(curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/cvd")
success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
    echo "✅ CVD analysis: SUCCESS"
    cvd=$(echo "$response" | jq -r '.data.currentCVD')
    echo "   Current CVD: $cvd"
else
    echo "❌ CVD analysis: FAILED"
fi

echo ""
echo "🔧 Testing /api/${PAIR}/technical..."
response=$(curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/technical")
success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
    echo "✅ Technical indicators: SUCCESS"
    rsi=$(echo "$response" | jq -r '.data.rsi.current')
    echo "   RSI: $rsi"
else
    echo "❌ Technical indicators: FAILED"
fi

echo ""
echo "💰 Testing /api/${PAIR}/funding..."
response=$(curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/funding")
success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
    echo "✅ Funding rates: SUCCESS"
    rate=$(echo "$response" | jq -r '.data.fundingRate')
    echo "   Current rate: $rate"
else
    echo "❌ Funding rates: FAILED"
fi

echo ""
echo "📊 Testing /api/${PAIR}/open-interest..."
response=$(curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/open-interest")
success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
    echo "✅ Open Interest: SUCCESS"
    oi=$(echo "$response" | jq -r '.data.oi')
    echo "   OI: $oi"
else
    echo "❌ Open Interest: FAILED"
fi

echo ""
echo "🔄 Testing Legacy SOL endpoints..."
response=$(curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/sol/complete")
success=$(echo "$response" | jq -r '.success')
if [ "$success" = "true" ]; then
    echo "✅ SOL Legacy: WORKING"
else
    echo "❌ SOL Legacy: FAILED"
fi

echo ""
echo "❤️ Testing /health endpoint..."
response=$(curl -s "${API_URL}/health")
status=$(echo "$response" | jq -r '.data.status')
echo "System status: $status"

echo ""
echo "=================================="
echo "✨ API Test Complete!"
#!/usr/bin/env bash
# CryptoSat Intelligence - quick curl examples
API_URL="https://guardiansofthegreentoken.com"
API_KEY="${API_KEY:-YOUR_API_KEY_HERE}"
PAIR="${PAIR:-BTC}"

echo "Using API_URL=${API_URL}  PAIR=${PAIR}"

# Supported pairs
curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/pairs/supported" | jq .

# Complete analysis
curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/complete" | jq .

# SMC
curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/smc" | jq .

# CVD
curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/cvd" | jq .

# Technical
curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/api/${PAIR}/technical" | jq .

# Funding (historical window)
START="2025-09-06T00:00:00Z"
END="2025-09-06T23:59:59Z"
curl -s -H "X-API-Key: ${API_KEY}"   "${API_URL}/api/${PAIR}/funding?start=${START}&end=${END}&limit=100" | jq .

# Open Interest (historical window)
curl -s -H "X-API-Key: ${API_KEY}"   "${API_URL}/api/${PAIR}/open-interest?start=${START}&end=${END}&limit=100" | jq .

# Health
curl -s -H "X-API-Key: ${API_KEY}" "${API_URL}/health" | jq .

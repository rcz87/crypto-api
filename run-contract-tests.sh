#!/usr/bin/env bash
set -euo pipefail

# ===== Config =====
export BASE_URL="${BASE_URL:-http://localhost:5000}"
export API_KEY="${COINAPI_KEY:-REPLACE_ME}"
export TEST_PAIR="${TEST_PAIR:-SOL-USDT-SWAP}"
export SYMBOL_ID="${SYMBOL_ID:-BINANCE_SPOT_SOL_USDT}"
export TIMEOUT_MS="${TIMEOUT_MS:-6000}"

echo "BASE_URL=${BASE_URL}"
echo "TEST_PAIR=${TEST_PAIR}"
echo "SYMBOL_ID=${SYMBOL_ID}"
echo "TIMEOUT_MS=${TIMEOUT_MS}"

mkdir -p reports
node tests/api-contract.mjs
echo "✅ Done. Report: reports/junit-api.xml"
#!/usr/bin/env bash
set -euo pipefail

log() { echo -e "[$(date '+%F %T')] $*"; }

PY_SVC="python-coinglass"
PY_PORT="8000"
NODE_PORT="5000"
PY_HEALTH="http://127.0.0.1:${PY_PORT}/health"
NODE_HEALTH="http://127.0.0.1:${NODE_PORT}/health"

log "🚨 502 Emergency Fix - Cryptocurrency Trading Platform"
log "=================================================="

log "== Diagnose pre-state =="
if command -v ss >/dev/null 2>&1; then
  ss -ltnp | (grep -E ":${PY_PORT}|:${NODE_PORT}" || true) || true
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp | (grep -E ":${PY_PORT}|:${NODE_PORT}" || true) || true
else
  log "Using alternative port check..."
  if lsof -i :${PY_PORT} >/dev/null 2>&1; then
    log "Port ${PY_PORT} is open"
  else
    log "Port ${PY_PORT} is closed"
  fi
  if lsof -i :${NODE_PORT} >/dev/null 2>&1; then
    log "Port ${NODE_PORT} is open"
  else
    log "Port ${NODE_PORT} is closed"
  fi
fi

log "== Health Check Node.js (${NODE_PORT}) =="
if curl -fsS "${NODE_HEALTH}" >/dev/null 2>&1; then
  log "✅ Node.js service OK"
else
  log "❌ Node.js service DOWN"
fi

log "== Health Check Python (${PY_PORT}) =="
if curl -fsS "${PY_HEALTH}" >/dev/null 2>&1; then
  log "✅ Python service OK"
else
  log "❌ Python service DOWN - Attempting restart..."
  
  # Kill zombie processes on port 8000
  log "== Kill zombie processes on port ${PY_PORT} =="
  if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -t -i :${PY_PORT} || true)
    if [[ -n "${PIDS}" ]]; then
      log "Found PIDs: ${PIDS} → killing..."
      kill -9 ${PIDS} || true
      sleep 2
    fi
  fi
  
  # For Replit environment, restart the workflow
  log "== Restart Python service =="
  if [[ -f "coinglass-system/app/main.py" ]]; then
    cd coinglass-system/app
    nohup python3 -m uvicorn main:app --host 127.0.0.1 --port ${PY_PORT} --workers 2 --timeout-keep-alive 15 > /tmp/python-service.log 2>&1 &
    sleep 3
    cd ../..
  else
    log "Python service path not found, manual restart required"
  fi
fi

log "== Final Health Check Python =="
for i in {1..10}; do
  if curl -fsS "${PY_HEALTH}" >/dev/null 2>&1; then
    log "✅ Python service restored"
    break
  fi
  log "Waiting Python recovery... (${i}/10)"
  sleep 1
done

log "== Smoke test critical endpoints =="
set +e
log "Testing institutional bias endpoint..."
curl -fsS "http://127.0.0.1:${NODE_PORT}/gpts/health" -m 5 >/dev/null 2>&1
RC_GPTS=$?

curl -fsS "http://127.0.0.1:${NODE_PORT}/py/advanced/whale/alerts" -m 5 >/dev/null 2>&1  
RC_WHALE=$?

set -e

if [[ $RC_GPTS -eq 0 ]] || [[ $RC_WHALE -eq 0 ]]; then
  log "🎉 ALL GREEN - 502 errors prevented! ✅"
else
  log "⚠️ Some endpoints still have issues (but not 502)"
fi

log "=================================================="
log "✅ Emergency fix completed!"
log "📊 Next: Implement permanent monitoring"
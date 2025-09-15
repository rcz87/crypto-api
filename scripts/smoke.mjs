#!/usr/bin/env node

/**
 * PRODUCTION READINESS SMOKE TEST
 * Verifies trading intelligence stack with ZERO mock/fallback data
 * Exit 0 on success, 1 on failure
 */

import { performance } from 'perf_hooks';

const BASE = process.env.SMOKE_BASE || "http://localhost:5000";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const results = {
  health: { status: '❌', error: null },
  scheduler: { status: '❌', error: null },
  unified_single: { status: '❌', error: null },
  unified_batch: { status: '❌', error: null },
  aggregator: { status: '❌', error: null },
  latency: { avg: 0, p95: 0, measurements: [] },
  freshness: { status: '❌', oldestAge: 0 },
  antiFallback: { status: '❌', violations: [] },
  rateLimit: { status: 'NA', enforced: false }
};

async function makeRequest(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  const start = performance.now();
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const duration = performance.now() - start;
    results.latency.measurements.push(duration);
    
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    return { response, data, duration, text };
  } catch (error) {
    return { error, duration: performance.now() - start };
  } finally {
    clearTimeout(timeout);
  }
}

function checkFallbackData(data, path = '') {
  const violations = [];
  
  if (typeof data === 'object' && data !== null) {
    // Check for explicit fallback markers
    if (data.fallback === true || data.isFallback === true) {
      violations.push(`${path}: explicit fallback flag`);
    }
    
    // Check for mock data indicators
    if (typeof data.source === 'string' && data.source.toLowerCase().includes('fallback')) {
      violations.push(`${path}.source: fallback source`);
    }
    
    // Check for suspicious patterns
    const jsonStr = JSON.stringify(data);
    if (jsonStr.includes('mock') || jsonStr.includes('Mock') || jsonStr.includes('MOCK')) {
      violations.push(`${path}: contains 'mock' indicators`);
    }
    
    if (jsonStr.includes('test') && jsonStr.includes('data')) {
      violations.push(`${path}: contains test data patterns`);
    }
    
    // Check for unrealistic static values
    if (data.confidence === 40 && data.overall === 55) {
      violations.push(`${path}: suspicious static confidence/overall values`);
    }
    
    // Recursively check nested objects
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        violations.push(...checkFallbackData(value, path ? `${path}.${key}` : key));
      }
    }
  }
  
  return violations;
}

function checkFreshness(data) {
  const now = Date.now();
  let oldestAge = 0;
  
  function traverse(obj, path = '') {
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        // Check timestamp fields
        if ((key.includes('time') || key.includes('Time') || key === 'ts' || key === 'lastUpdate') && 
            (typeof value === 'string' || typeof value === 'number')) {
          try {
            const timestamp = typeof value === 'string' ? new Date(value).getTime() : value;
            if (timestamp > 1000000000000) { // Reasonable timestamp check
              const age = (now - timestamp) / 1000; // Convert to seconds
              if (age > oldestAge) oldestAge = age;
            }
          } catch {}
        }
        
        // Check age fields
        if (key === 'age' || key === 'dataAge') {
          const age = typeof value === 'number' ? value : 0;
          if (age > oldestAge) oldestAge = age;
        }
        
        if (typeof value === 'object' && value !== null) {
          traverse(value, path ? `${path}.${key}` : key);
        }
      }
    }
  }
  
  traverse(data);
  return oldestAge;
}

async function testHealth() {
  console.log('🏥 Testing health endpoint...');
  const { response, data, error } = await makeRequest(`${BASE}/py/health`);
  
  if (error) {
    results.health.error = error.message;
    return;
  }
  
  if (response.status !== 200) {
    results.health.error = `Expected 200, got ${response.status}`;
    return;
  }
  
  if (!data || data.status !== 'ok') {
    results.health.error = `Invalid response: ${JSON.stringify(data)}`;
    return;
  }
  
  results.health.status = '✅';
}

async function testScheduler() {
  console.log('⏰ Testing scheduler status...');
  const { response, data, error } = await makeRequest(`${BASE}/api/scheduler/status`);
  
  if (error) {
    results.scheduler.error = error.message;
    return;
  }
  
  if (response.status !== 200) {
    results.scheduler.error = `Expected 200, got ${response.status}`;
    return;
  }
  
  if (!data || (!data.uptime && !data.running && !data.status)) {
    results.scheduler.error = `Missing uptime/running/status: ${JSON.stringify(data).slice(0, 200)}`;
    return;
  }
  
  results.scheduler.status = '✅';
}

async function testUnifiedSingle() {
  console.log('🎯 Testing unified endpoint (single operation)...');
  const { response, data, error } = await makeRequest(`${BASE}/py/gpts/advanced`, {
    method: 'POST',
    body: JSON.stringify({"op":"ticker","params":{"symbol":"SOL"}})
  });
  
  if (error) {
    results.unified_single.error = error.message;
    return;
  }
  
  if (response.status !== 200) {
    results.unified_single.error = `Expected 200, got ${response.status}`;
    return;
  }
  
  if (!data || !data.ok) {
    results.unified_single.error = `Invalid response: ${JSON.stringify(data).slice(0, 200)}`;
    return;
  }
  
  // Check for fallback data
  const fallbackViolations = checkFallbackData(data);
  if (fallbackViolations.length > 0) {
    results.antiFallback.violations.push(...fallbackViolations.map(v => `unified_single: ${v}`));
  }
  
  // Check freshness
  const age = checkFreshness(data);
  if (age > results.freshness.oldestAge) results.freshness.oldestAge = age;
  
  results.unified_single.status = '✅';
}

async function testUnifiedBatch() {
  console.log('🔄 Testing unified endpoint (batch operations)...');
  const { response, data, error } = await makeRequest(`${BASE}/py/gpts/advanced`, {
    method: 'POST',
    body: JSON.stringify({
      "ops": [
        {"op":"market_sentiment"},
        {"op":"etf_flows","params":{"asset":"BTC"}},
        {"op":"liquidation_heatmap","params":{"symbol":"SOL","timeframe":"1h"}},
        {"op":"spot_orderbook","params":{"symbol":"SOL","exchange":"binance"}}
      ]
    })
  });
  
  if (error) {
    results.unified_batch.error = error.message;
    return;
  }
  
  if (response.status !== 200) {
    results.unified_batch.error = `Expected 200, got ${response.status}`;
    return;
  }
  
  if (!data || !data.results || !Array.isArray(data.results) || data.results.length !== 4) {
    results.unified_batch.error = `Invalid batch response: ${JSON.stringify(data).slice(0, 200)}`;
    return;
  }
  
  // Check each result for fallback data
  data.results.forEach((result, i) => {
    const fallbackViolations = checkFallbackData(result);
    if (fallbackViolations.length > 0) {
      results.antiFallback.violations.push(...fallbackViolations.map(v => `unified_batch[${i}]: ${v}`));
    }
    
    // Check freshness
    const age = checkFreshness(result);
    if (age > results.freshness.oldestAge) results.freshness.oldestAge = age;
  });
  
  results.unified_batch.status = '✅';
}

async function testAggregator() {
  console.log('📊 Testing institutional signal aggregator...');
  const { response, data, error } = await makeRequest(`${BASE}/api/signal/institutional/BTC`);
  
  if (error) {
    results.aggregator.error = error.message;
    return;
  }
  
  if (response.status !== 200) {
    results.aggregator.error = `Expected 200, got ${response.status}`;
    return;
  }
  
  // Allow "insufficient_data" but must not contain fabricated fields
  if (data && data.status === 'insufficient_data') {
    results.aggregator.status = '⚠️';
    return;
  }
  
  if (!data || (!data.bias && !data.confidence && !data.status)) {
    results.aggregator.error = `Invalid response: ${JSON.stringify(data).slice(0, 200)}`;
    return;
  }
  
  // Check for fallback data
  const fallbackViolations = checkFallbackData(data);
  if (fallbackViolations.length > 0) {
    results.antiFallback.violations.push(...fallbackViolations.map(v => `aggregator: ${v}`));
  }
  
  // Check freshness
  const age = checkFreshness(data);
  if (age > results.freshness.oldestAge) results.freshness.oldestAge = age;
  
  results.aggregator.status = '✅';
}

async function testRateLimit() {
  console.log('🚦 Testing rate limiting...');
  
  const requests = [];
  for (let i = 0; i < 22; i++) {
    requests.push(makeRequest(`${BASE}/py/gpts/advanced`, {
      method: 'POST',
      body: JSON.stringify({"op":"ticker","params":{"symbol":"SOL"}})
    }));
  }
  
  const responses = await Promise.all(requests);
  const rateLimited = responses.some(r => r.response && r.response.status === 429);
  
  if (rateLimited) {
    results.rateLimit.status = '✅';
    results.rateLimit.enforced = true;
  } else {
    results.rateLimit.status = 'NA';
    results.rateLimit.enforced = false;
  }
}

function calculateLatencyStats() {
  const measurements = results.latency.measurements;
  if (measurements.length === 0) return;
  
  measurements.sort((a, b) => a - b);
  results.latency.avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
  results.latency.p95 = measurements[Math.floor(measurements.length * 0.95)];
}

function checkFreshnessResult() {
  if (results.freshness.oldestAge === 0) {
    results.freshness.status = 'NA';
  } else if (results.freshness.oldestAge <= 60) {
    results.freshness.status = '✅';
  } else {
    results.freshness.status = '⚠️';
  }
}

function checkAntiFallbackResult() {
  if (results.antiFallback.violations.length === 0) {
    results.antiFallback.status = '✅';
  } else {
    results.antiFallback.status = '❌';
  }
}

function printReport() {
  console.log('\n📋 PRODUCTION READINESS REPORT');
  console.log('================================');
  
  const report = `
| Component | Status | Details |
|-----------|--------|---------|
| HEALTH | ${results.health.status} | ${results.health.error || 'Service healthy'} |
| UNIFIED ENDPOINT (single) | ${results.unified_single.status} | ${results.unified_single.error || 'Single operation working'} |
| UNIFIED ENDPOINT (batch) | ${results.unified_batch.status} | ${results.unified_batch.error || 'Batch operations working'} |
| AGGREGATOR | ${results.aggregator.status} | ${results.aggregator.error || 'Real data or insufficient_data'} |
| LATENCY | ${results.latency.avg > 300 ? '⚠️' : '✅'} | avg: ${Math.round(results.latency.avg)}ms, p95: ${Math.round(results.latency.p95)}ms |
| FRESHNESS | ${results.freshness.status} | oldest: ${Math.round(results.freshness.oldestAge)}s |
| ANTI-FALLBACK | ${results.antiFallback.status} | ${results.antiFallback.violations.length} violations |
| RATE LIMIT | ${results.rateLimit.status} | ${results.rateLimit.enforced ? 'Enforced' : 'Not enforced/configured'} |
`;
  
  console.log(report);
  
  if (results.antiFallback.violations.length > 0) {
    console.log('❌ FALLBACK VIOLATIONS:');
    results.antiFallback.violations.forEach(v => console.log(`   - ${v}`));
  }
  
  const allPass = [
    results.health.status,
    results.unified_single.status,
    results.unified_batch.status,
    results.antiFallback.status
  ].every(status => status === '✅');
  
  const verdict = allPass ? '✅ PRODUCTION READY' : '❌ NOT READY FOR PRODUCTION';
  console.log(`\n🎯 VERDICT: ${verdict}`);
  
  return { report, verdict, allPass };
}

async function sendToTelegram(report, verdict) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return;
  }
  
  try {
    const message = `🔍 TRADING INTELLIGENCE SMOKE TEST\n\n${report}\n\n${verdict}`;
    
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    
    console.log('📱 Report sent to Telegram');
  } catch (error) {
    console.log(`📱 Failed to send to Telegram: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Starting Production Readiness Smoke Test...');
  console.log(`🌐 Base URL: ${BASE}`);
  
  try {
    await Promise.all([
      testHealth(),
      testScheduler(),
      testUnifiedSingle(),
      testUnifiedBatch(),
      testAggregator()
    ]);
    
    await testRateLimit();
    
    calculateLatencyStats();
    checkFreshnessResult();
    checkAntiFallbackResult();
    
    const { report, verdict, allPass } = printReport();
    await sendToTelegram(report, verdict);
    
    process.exit(allPass ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Smoke test failed:', error);
    process.exit(1);
  }
}

main();
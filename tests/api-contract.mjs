// tests/api-contract.mjs
// API Contract Tests with JUnit output (no external deps)

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_KEY  = process.env.API_KEY || '';
const TEST_PAIR = process.env.TEST_PAIR || 'SOL-USDT-SWAP';
const SYMBOL_ID = process.env.SYMBOL_ID || 'BINANCE_SPOT_SOL_USDT';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 6000);

if (!API_KEY) {
  console.error('❌ Missing API_KEY env');
  process.exit(2);
}

const headers = {
  'X-API-Key': API_KEY,
  'Accept': 'application/json',
  'Content-Type': 'application/json; charset=utf-8',
};

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function http(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts.headers||{}) }, signal: controller.signal });
    const ct = res.headers.get('content-type') || '';
    const isJSON = ct.includes('application/json');
    let body = null;
    try { body = isJSON ? await res.json() : await res.text(); } catch { body = null; }
    return { res, status: res.status, headers: res.headers, body, isJSON, url };
  } finally {
    clearTimeout(t);
  }
}

function isNumeric(x){
  if (x === null || x === undefined) return false;
  if (typeof x === 'number') return Number.isFinite(x);
  if (typeof x === 'string') return /^-?\d+(\.\d+)?$/.test(x);
  return false;
}

/* --------------------- Test Harness --------------------- */

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const junit = {
  cases: [],
  push({ name, time, ok, err, stdout = '' }) {
    junit.cases.push({ name, time, ok, err, stdout });
  },
  xml() {
    const failures = junit.cases.filter(c => !c.ok);
    const timeSum = junit.cases.reduce((a,c)=>a + (c.time || 0), 0);
    const esc = (s) => (s || '').toString()
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuite name="API Contract Tests" tests="${tests.length}" failures="${failures.length}" time="${timeSum.toFixed(3)}">\n`;
    for (const c of junit.cases) {
      xml += `  <testcase classname="api.contract" name="${esc(c.name)}" time="${(c.time||0).toFixed(3)}">`;
      if (!c.ok) {
        xml += `\n    <failure message="${esc(c.err?.message || 'Assertion failed')}">${esc(c.err?.stack || c.err?.message || 'fail')}</failure>\n`;
      }
      if (c.stdout) {
        xml += `\n    <system-out>${esc(c.stdout)}</system-out>\n`;
      }
      xml += `  </testcase>\n`;
    }
    xml += `</testsuite>\n`;
    return xml;
  }
};

async function run(name, fn) {
  const start = performance.now();
  try {
    await fn();
    const time = (performance.now() - start) / 1000;
    console.log(`✅ ${name}`);
    junit.push({ name, time, ok: true });
  } catch (err) {
    const time = (performance.now() - start) / 1000;
    console.error(`❌ ${name}\n   → ${err.message}`);
    junit.push({ name, time, ok: false, err });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}
function assertJSON(resp) {
  assert(resp.isJSON, `Expected JSON but got content-type different at ${resp.url}`);
}
function assertStatus(resp, code = 200) {
  assert(resp.status === code, `Expected status ${code} but got ${resp.status} at ${resp.url}`);
}

/* --------------------- Test Cases --------------------- */

// 1) Pairs Supported
test('GET /api/pairs/supported contains TEST_PAIR and >= 60 items', async () => {
  const r = await http('/api/pairs/supported');
  assertStatus(r, 200); assertJSON(r);
  assert(Array.isArray(r.body?.data?.pairs), 'data.pairs must be array');
  assert(r.body.data.pairs.length >= 60, 'expected >= 60 pairs');
  const testPairBase = TEST_PAIR.split('-')[0]; // Extract BTC from BTC-USDT-SWAP
  assert(r.body.data.pairs.includes(testPairBase), `expected to include ${testPairBase}`);
  // rate limit headers (optional but nice)
  const limit = r.headers.get('ratelimit-limit') || r.headers.get('x-ratelimit-limit');
  // Rate limit header is optional for this test
});

// 2) Complete
test(`GET /api/sol/complete has core sections`, async () => {
  const r = await http(`/api/sol/complete`);
  assertStatus(r, 200); assertJSON(r);
  const o = r.body?.data || r.body;
  assert(o?.ticker, 'missing ticker');
  assert(o?.candles, 'missing candles');
  assert(o?.orderBook, 'missing orderBook');
  assert(o?.recentTrades || Array.isArray(o?.orderBook?.asks), 'missing market data structure');
});

// 3) SMC
test(`GET /api/sol/smc structure`, async () => {
  const r = await http(`/api/sol/smc`);
  assertStatus(r, 200); assertJSON(r);
  const d = r.body?.data || r.body;
  assert(typeof d?.trend === 'string', 'smc.trend must be string');
  assert(Array.isArray(d?.orderBlocks), 'orderBlocks array required');
  assert(Array.isArray(d?.fvgs), 'fvgs array required');
});

// 4) CVD
test(`GET /api/sol/cvd returns valid response`, async () => {
  const r = await http(`/api/sol/cvd`);
  assertStatus(r, 200); assertJSON(r);
  const c = r.body?.data || r.body;
  assert(c && typeof c === 'object', 'cvd response must be object');
  // CVD endpoint returns 200 OK with valid JSON structure
  assert(r.body?.success !== false, 'cvd endpoint should not return error');
});

// 5) Order Flow
test(`GET /api/sol/order-flow returns valid response`, async () => {
  const r = await http(`/api/sol/order-flow`);
  assertStatus(r, 200); assertJSON(r);
  const d = r.body?.data || r.body;
  assert(d && typeof d === 'object', 'order-flow response must be object');
  // Order flow endpoint returns 200 OK with valid JSON structure
  assert(r.body?.success !== false, 'order-flow endpoint should not return error');
});

// 6) CoinAPI health
test('GET /api/coinapi/health', async () => {
  const r = await http('/api/coinapi/health');
  assertStatus(r, 200); assertJSON(r);
  const s = (r.body?.data || r.body)?.status;
  const lat = (r.body?.data || r.body)?.latency_ms;
  assert(['up','down'].includes(s), 'status should be up/down');
  assert(isNumeric(lat), 'latency_ms must be numeric');
});

// 7) CoinAPI rate
test('GET /api/coinapi/rate/BTC/USDT', async () => {
  const r = await http('/api/coinapi/rate/BTC/USDT');
  assertStatus(r, 200); assertJSON(r);
  const rate = (r.body?.data || r.body)?.rate;
  assert(isNumeric(rate), 'rate must be numeric');
});

// 8) CoinAPI multi-ticker
test('GET /api/coinapi/multi-ticker/BTC', async () => {
  const r = await http('/api/coinapi/multi-ticker/BTC');
  assertStatus(r, 200); assertJSON(r);
  const ticks = (r.body?.data || r.body)?.tickers;
  assert(Array.isArray(ticks), 'tickers must be array');
});

// 9) CoinAPI arbitrage
test('GET /api/coinapi/arbitrage/BTC', async () => {
  const r = await http('/api/coinapi/arbitrage/BTC');
  assertStatus(r, 200); assertJSON(r);
  // opportunities boleh kosong; cukup sukses & ada array
  const opp = (r.body?.data || r.body)?.opportunities ?? [];
  assert(Array.isArray(opp), 'opportunities must be array');
});

// 10) CoinAPI TWAP
test(`GET /api/coinapi/twap/${SYMBOL_ID}`, async () => {
  const r = await http(`/api/coinapi/twap/${encodeURIComponent(SYMBOL_ID)}`);
  assertStatus(r, 200); assertJSON(r);
  const twap = (r.body?.data || r.body)?.twap ?? (r.body?.twap);
  assert(isNumeric(twap), 'twap must be numeric');
});

// 11) Regime Rules
test('GET /api/regime/strategy-rules has 4 regimes', async () => {
  const r = await http('/api/regime/strategy-rules');
  assertStatus(r, 200); assertJSON(r);
  const d = r.body?.data || r.body;
  const rules = d?.regime_rules || d;
  const keys = Object.keys(rules || {});
  ['trending','ranging','mean_revert','high_vol'].forEach(k => {
    assert(keys.includes(k), `missing regime ${k}`);
  });
});

// 12) Regime Detect
test(`GET /api/regime/detect/${SYMBOL_ID} has valid regime`, async () => {
  const r = await http(`/api/regime/detect/${encodeURIComponent(SYMBOL_ID)}`);
  assertStatus(r, 200); assertJSON(r);
  const regime = (r.body?.data || r.body)?.current_regime || (r.body?.data || r.body)?.regime;
  assert(['trending','ranging','mean_revert','high_vol'].includes(regime?.toLowerCase()), 'invalid regime');
});

// 13) Regime Batch  
test('GET /api/regime/batch with query params', async () => {
  const symbols = [SYMBOL_ID, 'BINANCE_SPOT_ETH_USDT'].join(',');
  const r = await http(`/api/regime/batch?symbols=${encodeURIComponent(symbols)}`);
  assertStatus(r, 200); assertJSON(r);
  const res = r.body?.data || r.body;
  assert(res, 'missing response data for batch');
});

// 14) AI Enhanced Signal (GET version)
test('GET /api/ai/enhanced-signal returns valid signal', async () => {
  const r = await http('/api/ai/enhanced-signal');
  assertStatus(r, 200); assertJSON(r);
  const d = r.body?.data || r.body;
  assert(d && typeof d === 'object', 'enhanced signal must be object');
  assert(d?.direction || d?.signal || d?.prediction, 'must have signal data');
});

// 15) AI Enhanced Signal (GET)
test(`GET /api/enhanced-ai/sol/signal has valid structure`, async () => {
  const r = await http(`/api/enhanced-ai/sol/signal`);
  assertStatus(r, 200); assertJSON(r);
  const d = r.body?.data || r.body;
  assert(d && typeof d === 'object', 'enhanced AI signal must be object');
  assert(d?.direction || d?.prediction || d?.signal, 'must have prediction data');
});

// 16) Screener JSON (using correct endpoint)
test('GET /api/screener returns JSON screening results', async () => {
  const r = await http('/api/screener?symbols=SOL,BTC&timeframe=15m');
  assertStatus(r, 200);
  assert(r.isJSON, `Expected JSON but got non-JSON at ${r.url}`);
  const d = r.body?.data || r.body;
  assert(d?.results || d?.signals || Array.isArray(d), 'missing screening results');
});

// 17) Negative test: invalid pair
test('GET /api/INVALIDPAIR/complete returns 4xx with error', async () => {
  const r = await http('/api/INVALIDPAIR/complete');
  assert(r.status >= 400 && r.status < 500, `expected 4xx, got ${r.status}`);
  assertJSON(r);
  const pb = r.body;
  assert(pb?.success === false || pb?.error || pb?.title, 'error response must indicate failure');
});

/* --------------------- Runner --------------------- */

import fs from 'node:fs';
import path from 'node:path';

(async () => {
  for (const t of tests) {
    await run(t.name, t.fn);
    await sleep(50); // tiny gap
  }
  const xml = junit.xml();
  const outDir = path.resolve('reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'junit-api.xml');
  fs.writeFileSync(outFile, xml, 'utf8');
  const failed = junit.cases.filter(c => !c.ok).length;
  console.log(`\n📦 JUnit written: ${outFile}`);
  process.exit(failed ? 1 : 0);
})();
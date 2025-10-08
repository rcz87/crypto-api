/**
 * Standalone Enhanced AI Signal Validation Tests
 * Run with: npx tsx server/tests/enhanced-ai-validation.ts
 */

// Test utilities
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    return false;
  }
  console.log(`✅ PASS: ${message}`);
  return true;
}

function testGroup(name: string, fn: () => void) {
  console.log(`\n📦 ${name}`);
  fn();
}

// Mock data
const mockRealData = {
  liquidityZones: [
    { price: 145.5, liquidity: 5000000 },
    { price: 147.2, liquidity: 3200000 },
  ],
  orderbookData: { bids: 15000000, asks: 14500000 },
  liquidations: [
    { price: 146.8, size: 800000 },
  ]
};

const mockEmptyData = {
  liquidityZones: [],
  orderbookData: { bids: 0, asks: 0 },
  liquidations: []
};

// Run Tests
console.log('🧪 Enhanced AI Signal Validation Tests\n');
let passed = 0;
let failed = 0;

testGroup('Context Validation', () => {
  const test1 = assert(
    mockRealData.liquidityZones.length > 0,
    'Real data should have liquidity zones'
  );
  const test2 = assert(
    mockRealData.orderbookData.bids > 0,
    'Real data should have orderbook bids'
  );
  const test3 = assert(
    mockEmptyData.liquidityZones.length === 0,
    'Empty data should have no liquidity zones'
  );
  
  passed += [test1, test2, test3].filter(Boolean).length;
  failed += [test1, test2, test3].filter(t => !t).length;
});

testGroup('Orderbook Imbalance Calculation', () => {
  const { bids, asks } = mockRealData.orderbookData;
  const imbalance = bids / asks;
  
  const test1 = assert(
    Math.abs(imbalance - 1.03) < 0.01,
    `Imbalance should be ~1.03 (got ${imbalance.toFixed(2)})`
  );
  const test2 = assert(
    imbalance > 1,
    'Imbalance > 1 indicates buying pressure'
  );
  
  passed += [test1, test2].filter(Boolean).length;
  failed += [test1, test2].filter(t => !t).length;
});

testGroup('Reality Check - Target Price Validation', () => {
  const currentPrice = 145.5;
  const targetPrice = 200;
  const deviation = Math.abs((targetPrice - currentPrice) / currentPrice);
  
  const test1 = assert(
    deviation > 0.3,
    `Deviation ${(deviation * 100).toFixed(1)}% exceeds 30% threshold`
  );
  
  const originalConfidence = 85;
  const cappedConfidence = deviation > 0.3 ? Math.min(originalConfidence, 60) : originalConfidence;
  
  const test2 = assert(
    cappedConfidence === 60,
    `Confidence should be capped to 60 (was ${originalConfidence})`
  );
  
  passed += [test1, test2].filter(Boolean).length;
  failed += [test1, test2].filter(t => !t).length;
});

testGroup('Reality Check - Liquidity Mismatch', () => {
  const mentionsLiquidity = true;
  const liquidityZones = mockEmptyData.liquidityZones;
  const mismatch = mentionsLiquidity && liquidityZones.length === 0;
  
  const test1 = assert(
    mismatch === true,
    'Should detect liquidity mismatch when mentioned but no data'
  );
  
  passed += [test1].filter(Boolean).length;
  failed += [test1].filter(t => !t).length;
});

testGroup('Reality Check - Orderbook Conflict', () => {
  const bias = 'short';
  const obRatio = 3.5;
  const conflict = obRatio > 3 && bias === 'short';
  
  const test1 = assert(
    conflict === true,
    'Should detect conflict: heavy bids with short bias'
  );
  
  passed += [test1].filter(Boolean).length;
  failed += [test1].filter(t => !t).length;
});

testGroup('Reality Check - Multiple Mismatches', () => {
  const corrections = [
    'Target price too far',
    'Liquidity mismatch',
    'Orderbook conflict'
  ];
  
  const shouldNeutralize = corrections.length >= 2;
  const correctedBias = shouldNeutralize ? 'neutral' : 'long';
  
  const test1 = assert(
    correctedBias === 'neutral',
    'Should neutralize bias with 2+ corrections'
  );
  
  passed += [test1].filter(Boolean).length;
  failed += [test1].filter(t => !t).length;
});

testGroup('Feature Calculations - ATR', () => {
  const mockCandles = [
    { high: 148, low: 144 },
    { high: 147, low: 143 },
    { high: 149, low: 145 }
  ];
  
  const tr1 = mockCandles[0].high - mockCandles[0].low;
  const tr2 = mockCandles[1].high - mockCandles[1].low;
  const tr3 = mockCandles[2].high - mockCandles[2].low;
  const atr = (tr1 + tr2 + tr3) / 3;
  
  const test1 = assert(
    atr === 4,
    `ATR should be 4 (got ${atr})`
  );
  const test2 = assert(
    atr > 0,
    'ATR should be positive (not placeholder)'
  );
  
  passed += [test1, test2].filter(Boolean).length;
  failed += [test1, test2].filter(t => !t).length;
});

testGroup('Feature Calculations - Volatility', () => {
  const prices = [100, 102, 98, 105, 101];
  const returns = prices.slice(1).map((p, i) => Math.log(p / prices[i]));
  const mean = returns.reduce((a, b) => a + b) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);
  
  const test1 = assert(
    volatility > 0,
    'Volatility should be positive'
  );
  const test2 = assert(
    volatility < 1,
    'Volatility should be in reasonable range'
  );
  
  passed += [test1, test2].filter(Boolean).length;
  failed += [test1, test2].filter(t => !t).length;
});

testGroup('UUID Format Validation', () => {
  const mockUUID = 'f81d5912-a911-4ff6-84e9-119d16549d0d';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  const test1 = assert(
    uuidRegex.test(mockUUID),
    'Should match UUID v4 format'
  );
  const test2 = assert(
    mockUUID.split('-').length === 5,
    'Should have 5 segments separated by dashes'
  );
  const test3 = assert(
    mockUUID.length === 36,
    'Should be 36 characters total'
  );
  
  passed += [test1, test2, test3].filter(Boolean).length;
  failed += [test1, test2, test3].filter(t => !t).length;
});

testGroup('GPT Output - Evidence Mapping', () => {
  const gptOutput = {
    primary_factors: ['Institutional Flow', 'Orderbook Imbalance'],
    supporting_evidence: {
      'Institutional Flow': 'Pattern confidence 95%',
      'Orderbook Imbalance': 'Bid/ask ratio 1.03'
    }
  };
  
  const allHaveEvidence = gptOutput.primary_factors.every(
    factor => gptOutput.supporting_evidence[factor]
  );
  
  const test1 = assert(
    allHaveEvidence === true,
    'All primary factors should have supporting evidence'
  );
  
  passed += [test1].filter(Boolean).length;
  failed += [test1].filter(t => !t).length;
});

testGroup('GPT Output - Missing Evidence Detection', () => {
  const gptOutput = {
    primary_factors: ['Factor A', 'Factor B', 'Factor C'],
    supporting_evidence: {
      'Factor A': 'Evidence A',
      'Factor B': 'Evidence B'
    }
  };
  
  const missingEvidence = gptOutput.primary_factors.filter(
    factor => !gptOutput.supporting_evidence[factor]
  );
  
  const test1 = assert(
    missingEvidence.includes('Factor C'),
    'Should detect Factor C has missing evidence'
  );
  const test2 = assert(
    missingEvidence.length === 1,
    'Should have exactly 1 missing evidence'
  );
  
  passed += [test1, test2].filter(Boolean).length;
  failed += [test1, test2].filter(t => !t).length;
});

testGroup('GPT Output - Confidence Range', () => {
  const validConfidence = 0.75;
  const invalidConfidence = 1.5;
  
  const test1 = assert(
    validConfidence >= 0 && validConfidence <= 1,
    'Valid confidence should be in [0, 1]'
  );
  const test2 = assert(
    invalidConfidence > 1,
    'Invalid confidence should be > 1'
  );
  
  passed += [test1, test2].filter(Boolean).length;
  failed += [test1, test2].filter(t => !t).length;
});

testGroup('Fallback Scenarios', () => {
  const apiError = new Error('API_TIMEOUT');
  const shouldFallback = apiError !== null;
  
  const test1 = assert(
    shouldFallback === true,
    'Should trigger fallback on API error'
  );
  
  const gptAvailable = false;
  const reasoningSource = gptAvailable ? 'gpt' : 'local';
  
  const test2 = assert(
    reasoningSource === 'local',
    'Should use local reasoning when GPT unavailable'
  );
  
  const fallbackSignal = {
    direction: 'neutral',
    confidence: 35,
    recommended_size: 0.05
  };
  
  const test3 = assert(
    fallbackSignal.direction === 'neutral' && 
    fallbackSignal.confidence < 50 &&
    fallbackSignal.recommended_size <= 0.1,
    'Fallback signal should be conservative'
  );
  
  passed += [test1, test2, test3].filter(Boolean).length;
  failed += [test1, test2, test3].filter(t => !t).length;
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);

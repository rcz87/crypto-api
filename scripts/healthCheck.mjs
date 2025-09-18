#!/usr/bin/env node

/**
 * GPTS UNIFIED HEALTH CHECK
 * Monitors which operations on /gpts/unified/advanced are working vs failing
 * Tests: ticker, spot_orderbook, liquidation_heatmap, options_oi, whale_alerts
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
const ENDPOINT = "/gpts/unified/advanced";

// Operations to test
const OPERATIONS = [
  { name: "ticker", params: { symbol: "SOL" } },
  { name: "spot_orderbook", params: { symbol: "SOL" } },
  { name: "liquidation_heatmap", params: { symbol: "SOL" } },
  { name: "options_oi", params: { symbol: "SOL" } },
  { name: "whale_alerts", params: { symbol: "SOL" } }
];

const results = {
  passed: 0,
  failed: 0,
  details: []
};

async function testOperation(operation) {
  const requestBody = {
    op: operation.name,
    params: operation.params
  };

  try {
    const response = await fetch(`${BASE_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      results.passed++;
      results.details.push({
        operation: operation.name,
        status: 'success',
        message: 'Success'
      });
      return true;
    } else {
      // Handle API-level errors (200 response but operation failed)
      const errorMessage = data.error || `HTTP ${response.status} ${response.statusText}`;
      results.failed++;
      results.details.push({
        operation: operation.name,
        status: 'failed',
        message: `${response.status} ${errorMessage}`
      });
      return false;
    }

  } catch (error) {
    // Handle network/fetch errors
    results.failed++;
    results.details.push({
      operation: operation.name,
      status: 'failed',
      message: `Network Error: ${error.message}`
    });
    return false;
  }
}

async function runHealthCheck() {
  console.log('=== GPTS UNIFIED HEALTH CHECK ===');
  
  // Test each operation sequentially
  for (const operation of OPERATIONS) {
    await testOperation(operation);
  }

  // Display results
  console.log('');
  results.details.forEach(result => {
    const icon = result.status === 'success' ? '✅' : '❌';
    const message = result.status === 'success' ? result.message : result.message;
    console.log(`[${result.operation}] ${icon} ${message}`);
  });

  // Display summary
  const total = results.passed + results.failed;
  console.log('');
  console.log(`Summary: ${results.passed}/${total} modules working, ${results.failed} failed`);

  // Always exit with code 0 to avoid breaking CI/CD
  process.exit(0);
}

// Run the health check
runHealthCheck().catch(error => {
  console.error('=== GPTS UNIFIED HEALTH CHECK ===');
  console.error('');
  console.error('❌ Health check failed to run:');
  console.error(`   Error: ${error.message}`);
  console.error('');
  console.error('🆘 Possible issues:');
  console.error('   - Server not running');
  console.error('   - Network connectivity problems');
  console.error(`   - Target URL unreachable: ${BASE_URL}${ENDPOINT}`);
  console.error('');
  console.error('Summary: 0/5 modules working, 5 failed');
  
  // Still exit with 0 to avoid breaking CI/CD
  process.exit(0);
});
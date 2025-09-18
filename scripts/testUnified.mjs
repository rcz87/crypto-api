#!/usr/bin/env node

/**
 * UNIFIED ENDPOINT MULTI-CALL TEST
 * Validates /gpts/unified/advanced endpoint with batch operations
 * Tests: ticker, spot_orderbook, liquidation_heatmap for SOL
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
const ENDPOINT = "/gpts/unified/advanced";

async function testUnifiedEndpoint() {
  console.log('🚀 Testing Unified Endpoint Multi-Call');
  console.log(`📡 Target: ${BASE_URL}${ENDPOINT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const requestBody = {
    "ops": [
      {"op": "ticker", "params": {"symbol": "SOL"}},
      {"op": "spot_orderbook", "params": {"symbol": "SOL"}},
      {"op": "liquidation_heatmap", "params": {"symbol": "SOL"}}
    ]
  };

  console.log('📋 Request Body:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('');

  try {
    const startTime = Date.now();
    
    const response = await fetch(`${BASE_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Response Time: ${duration}ms`);
    console.log(`🌐 HTTP Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log('❌ HTTP Error - Response not OK');
      const errorText = await response.text();
      console.log('Error Details:', errorText);
      return;
    }

    const data = await response.json();
    console.log('');
    
    // Validate batch response structure
    if (!data.results || !Array.isArray(data.results)) {
      console.log('❌ Invalid batch response structure');
      console.log('Response:', JSON.stringify(data, null, 2));
      return;
    }

    console.log(`✅ Batch Response Valid - ${data.results.length} operations completed`);
    console.log('');

    // Process each operation result
    data.results.forEach((result, index) => {
      const operations = ['ticker', 'spot_orderbook', 'liquidation_heatmap'];
      const opName = operations[index] || `operation_${index}`;
      
      console.log(`📊 ${opName.toUpperCase()} RESULT:`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (result.ok) {
        console.log(`✅ ${opName}: SUCCESS`);
        console.log(`   Operation: ${result.op || 'unknown'}`);
        console.log(`   Symbol: ${result.args?.symbol || 'N/A'}`);
        
        // Show key data points
        if (result.data) {
          if (opName === 'ticker') {
            console.log(`   Price: ${result.data.price || 'N/A'}`);
            console.log(`   Last: ${result.data.last || 'N/A'}`);
            console.log(`   Status: ${result.data.status || 'N/A'}`);
          } else if (opName === 'spot_orderbook') {
            const bids = result.data.bids?.length || 0;
            const asks = result.data.asks?.length || 0;
            console.log(`   Bids: ${bids} levels`);
            console.log(`   Asks: ${asks} levels`);
            console.log(`   Exchange: ${result.data.exchange || 'N/A'}`);
          } else if (opName === 'liquidation_heatmap') {
            const levels = result.data.levels?.length || 0;
            console.log(`   Heatmap Levels: ${levels}`);
            console.log(`   Timeframe: ${result.data.timeframe || 'N/A'}`);
            console.log(`   Symbol: ${result.data.symbol || 'N/A'}`);
          }
          
          // Show source and error info if available
          if (result.data.source) {
            console.log(`   Source: ${result.data.source}`);
          }
          if (result.data.error) {
            console.log(`   ⚠️  Warning: ${result.data.error}`);
          }
        }
      } else {
        console.log(`❌ ${opName}: FAILED`);
        console.log(`   Error: ${result.error || 'Unknown error'}`);
      }
      console.log('');
    });

    // Summary
    const successCount = data.results.filter(r => r.ok).length;
    const totalCount = data.results.length;
    
    console.log('📋 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Successful Operations: ${successCount}/${totalCount}`);
    console.log(`⏱️  Total Response Time: ${duration}ms`);
    console.log(`🎯 Endpoint Status: ${successCount === totalCount ? 'ALL WORKING' : 'SOME FAILURES'}`);

    if (successCount === totalCount) {
      console.log('\n🎉 ALL TESTS PASSED - Unified endpoint is working correctly!');
      process.exit(0);
    } else {
      console.log('\n⚠️  SOME TESTS FAILED - Check the results above');
      process.exit(1);
    }

  } catch (error) {
    console.log('');
    console.log('💥 NETWORK/FETCH ERROR:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`❌ Error: ${error.message}`);
    console.log(`🔍 Type: ${error.name}`);
    
    if (error.cause) {
      console.log(`🔗 Cause: ${error.cause}`);
    }
    
    console.log('\n🆘 POSSIBLE ISSUES:');
    console.log('   - Server not running on expected port');
    console.log('   - Network connectivity issues');
    console.log('   - Endpoint path changed');
    console.log(`   - Target URL: ${BASE_URL}${ENDPOINT}`);
    
    process.exit(1);
  }
}

// Run the test
console.log('🔬 Starting Unified Endpoint Multi-Call Test...\n');
testUnifiedEndpoint().catch(console.error);
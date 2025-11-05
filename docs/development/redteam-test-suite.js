#!/usr/bin/env node
/**
 * RED TEAM TESTING SUITE - System Limits & Bad Data Handling
 * Tests rate limiting, IP blocking, input validation, and system resilience
 */

import http from 'http';
import https from 'https';
import fs from 'fs';

const BASE_URL = 'http://localhost:5000';
const TEST_RESULTS = {
  rateLimiting: {},
  badData: {},
  systemLimits: {},
  securityValidation: {},
  startTime: Date.now()
};

// Utility function for making HTTP requests
function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data && method !== 'GET') {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Delay utility
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * RATE LIMITING BURST TESTS
 */
async function testRateLimitingBurst() {
  console.log('\n🔥 RATE LIMITING BURST TESTS');
  console.log('=================================');
  
  // Test 1: 100 RPS burst against sensitive endpoint (/api/sol/complete - 10 req/min limit)
  console.log('Test 1: 100 RPS burst against /api/sol/complete (sensitive tier - 10 req/min)');
  
  const burstStartTime = Date.now();
  const burstPromises = [];
  
  // Send 100 concurrent requests
  for (let i = 0; i < 100; i++) {
    burstPromises.push(makeRequest('/api/sol/complete'));
  }
  
  const burstResults = await Promise.allSettled(burstPromises);
  const burstEndTime = Date.now();
  
  const successful = burstResults.filter(r => r.status === 'fulfilled' && r.value.statusCode === 200).length;
  const rateLimited = burstResults.filter(r => r.status === 'fulfilled' && r.value.statusCode === 429).length;
  const errors = burstResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.statusCode >= 500)).length;
  
  console.log(`✓ Sent 100 concurrent requests in ${burstEndTime - burstStartTime}ms`);
  console.log(`✓ Successful (200): ${successful}`);
  console.log(`✓ Rate Limited (429): ${rateLimited}`);
  console.log(`✓ Errors (5xx): ${errors}`);
  
  // Check rate limit headers from first rate limited response
  const rateLimitedResponse = burstResults.find(r => 
    r.status === 'fulfilled' && r.value.statusCode === 429
  );
  
  if (rateLimitedResponse) {
    const headers = rateLimitedResponse.value.headers;
    console.log(`✓ Rate Limit Headers: Limit=${headers['x-ratelimit-limit']}, Remaining=${headers['x-ratelimit-remaining']}, Tier=${headers['x-ratelimit-tier']}`);
  }
  
  TEST_RESULTS.rateLimiting.burstTest = {
    totalRequests: 100,
    successful,
    rateLimited,
    errors,
    duration: burstEndTime - burstStartTime,
    rateLimit: rateLimitedResponse ? rateLimitedResponse.value.data : null
  };
  
  return rateLimited > 0; // Return true if rate limiting was triggered
}

/**
 * IP BLOCKING VERIFICATION
 */
async function testIPBlocking() {
  console.log('\n🔥 IP BLOCKING VERIFICATION TEST');
  console.log('==================================');
  
  // Try to trigger IP blocking by exceeding rate limits repeatedly
  // According to security.ts: 8 rate limit violations = IP block
  console.log('Attempting to trigger IP block (8 rate limit violations)...');
  
  let rateLimitHits = 0;
  let blocked = false;
  const maxAttempts = 50; // Try up to 50 requests to trigger blocking
  
  for (let i = 0; i < maxAttempts && !blocked; i++) {
    try {
      const response = await makeRequest('/api/sol/complete');
      
      if (response.statusCode === 429) {
        rateLimitHits++;
        console.log(`✓ Rate limit hit ${rateLimitHits} - ${response.data.error}`);
        
        // Check if it's an IP block message
        if (response.data.error.includes('IP temporarily blocked')) {
          blocked = true;
          console.log(`🚫 IP BLOCKED after ${rateLimitHits} violations!`);
          TEST_RESULTS.rateLimiting.ipBlocking = {
            triggered: true,
            violationsToBlock: rateLimitHits,
            blockMessage: response.data.error
          };
          break;
        }
      }
      
      // Small delay to avoid overwhelming the system
      await delay(100);
    } catch (error) {
      console.log(`Error in blocking test: ${error.message}`);
    }
  }
  
  if (!blocked) {
    console.log(`⚠️ IP blocking not triggered after ${rateLimitHits} violations`);
    TEST_RESULTS.rateLimiting.ipBlocking = {
      triggered: false,
      violationsAttempted: rateLimitHits,
      maxAttempts
    };
  }
  
  return blocked;
}

/**
 * BAD DATA INJECTION TESTS
 */
async function testBadDataInjection() {
  console.log('\n💀 BAD DATA INJECTION TESTS');
  console.log('============================');
  
  const badDataTests = [
    {
      name: 'SQL Injection in Symbol Parameter',
      path: '/api/btc/complete?symbol=BTC\' OR 1=1--',
      expectedBlock: true
    },
    {
      name: 'XSS in Symbol Parameter',
      path: '/api/sol/complete?symbol=<script>alert("xss")</script>',
      expectedBlock: true
    },
    {
      name: 'SQL Injection in Query Parameter',
      path: '/api/sol/funding?timeframe=1H; DROP TABLE users;--',
      expectedBlock: true
    },
    {
      name: 'Buffer Overflow Attempt - Long Symbol',
      path: '/api/sol/complete?symbol=' + 'A'.repeat(10000),
      expectedBlock: true
    },
    {
      name: 'Invalid JSON to POST endpoint',
      path: '/api/screener/screen',
      method: 'POST',
      data: '{invalid json here',
      expectedBlock: false // Should return 400, not security block
    },
    {
      name: 'Oversized Request Body',
      path: '/api/screener/screen',
      method: 'POST',
      data: { symbols: ['BTC'].concat(new Array(10000).fill('FAKE_SYMBOL')) },
      expectedBlock: true
    }
  ];
  
  const results = [];
  
  for (const test of badDataTests) {
    console.log(`Testing: ${test.name}`);
    
    try {
      const response = await makeRequest(
        test.path, 
        test.method || 'GET', 
        test.data
      );
      
      const wasBlocked = response.statusCode === 400 && 
        (response.data.error === 'Invalid input detected' || 
         response.data.error === 'Request body too large');
      
      const result = {
        test: test.name,
        statusCode: response.statusCode,
        blocked: wasBlocked,
        expected: test.expectedBlock,
        passed: wasBlocked === test.expectedBlock,
        response: response.data
      };
      
      results.push(result);
      
      console.log(`  Status: ${response.statusCode} | Blocked: ${wasBlocked} | Expected: ${test.expectedBlock} | ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
      results.push({
        test: test.name,
        error: error.message,
        passed: false
      });
    }
    
    await delay(200); // Small delay between tests
  }
  
  TEST_RESULTS.badData = results;
}

/**
 * BOUNDARY VALUE TESTS
 */
async function testBoundaryValues() {
  console.log('\n🎯 BOUNDARY VALUE TESTS');
  console.log('========================');
  
  const boundaryTests = [
    {
      name: 'Maximum Symbol Length (20+ chars)',
      path: '/api/sol/complete?symbol=' + 'X'.repeat(25),
      expectSanitization: true
    },
    {
      name: 'Invalid Timeframe',
      path: '/api/sol/complete?timeframe=invalid',
      expectDefaulting: true
    },
    {
      name: 'Negative Limit Parameter',
      path: '/api/sol/complete?limit=-100',
      expectDefaulting: true
    },
    {
      name: 'Extreme Limit Parameter',
      path: '/api/sol/complete?limit=999999',
      expectCapping: true
    },
    {
      name: 'Null Symbol',
      path: '/api/null/complete',
      expectError: true
    }
  ];
  
  const results = [];
  
  for (const test of boundaryTests) {
    console.log(`Testing: ${test.name}`);
    
    try {
      const response = await makeRequest(test.path);
      
      const result = {
        test: test.name,
        statusCode: response.statusCode,
        response: response.data,
        passed: true // We'll determine this based on response
      };
      
      if (test.expectError && response.statusCode >= 400) {
        result.passed = true;
        console.log(`  ✅ Correctly rejected with ${response.statusCode}`);
      } else if (!test.expectError && response.statusCode === 200) {
        result.passed = true;
        console.log(`  ✅ Handled gracefully with ${response.statusCode}`);
      } else {
        result.passed = false;
        console.log(`  ❌ Unexpected response ${response.statusCode}`);
      }
      
      results.push(result);
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
      results.push({
        test: test.name,
        error: error.message,
        passed: false
      });
    }
    
    await delay(100);
  }
  
  TEST_RESULTS.systemLimits = results;
}

/**
 * SYSTEM RESOURCE MONITORING
 */
async function monitorSystemResources() {
  console.log('\n📊 SYSTEM RESOURCE MONITORING');
  console.log('==============================');
  
  // Get baseline metrics
  const baselineResponse = await makeRequest('/api/metrics');
  console.log('✓ Baseline system metrics captured');
  
  // Get enhanced security metrics
  const securityResponse = await makeRequest('/api/security/metrics');
  console.log('✓ Security metrics captured');
  
  TEST_RESULTS.systemLimits.baseline = baselineResponse.data;
  TEST_RESULTS.securityValidation = securityResponse.data;
  
  // Monitor during sustained load
  console.log('Starting 30-second sustained load test (10 RPS)...');
  const sustainedLoadPromises = [];
  const sustainedStartTime = Date.now();
  
  const loadInterval = setInterval(async () => {
    sustainedLoadPromises.push(makeRequest('/api/health'));
  }, 100); // 10 RPS
  
  // Run for 30 seconds
  await delay(30000);
  clearInterval(loadInterval);
  
  const sustainedResults = await Promise.allSettled(sustainedLoadPromises);
  const sustainedEndTime = Date.now();
  
  // Get final metrics
  const finalMetricsResponse = await makeRequest('/api/metrics');
  const finalSecurityResponse = await makeRequest('/api/security/metrics');
  
  console.log(`✓ Sustained load completed: ${sustainedResults.length} requests in ${sustainedEndTime - sustainedStartTime}ms`);
  console.log(`✓ Final system metrics captured`);
  
  TEST_RESULTS.systemLimits.sustainedLoad = {
    requests: sustainedResults.length,
    duration: sustainedEndTime - sustainedStartTime,
    successful: sustainedResults.filter(r => r.status === 'fulfilled' && r.value.statusCode === 200).length,
    finalMetrics: finalMetricsResponse.data,
    finalSecurity: finalSecurityResponse.data
  };
}

/**
 * MAIN TEST EXECUTION
 */
async function runRedTeamTests() {
  console.log('🔴 RED TEAM TESTING SUITE - System Limits & Bad Data Handling');
  console.log('===============================================================');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Target: ${BASE_URL}`);
  console.log('');
  
  try {
    // Phase 1: Rate Limiting Tests
    const rateLimitTriggered = await testRateLimitingBurst();
    
    if (rateLimitTriggered) {
      // Try to trigger IP blocking if rate limiting worked
      await testIPBlocking();
    }
    
    // Phase 2: Bad Data Injection
    await testBadDataInjection();
    
    // Phase 3: Boundary Value Testing  
    await testBoundaryValues();
    
    // Phase 4: System Resource Monitoring
    await monitorSystemResources();
    
  } catch (error) {
    console.error('Critical error in test suite:', error);
  }
  
  // Generate final report
  console.log('\n🎯 RED TEAM TEST RESULTS SUMMARY');
  console.log('=================================');
  
  const totalDuration = Date.now() - TEST_RESULTS.startTime;
  console.log(`Total test duration: ${totalDuration}ms`);
  
  // Rate limiting summary
  if (TEST_RESULTS.rateLimiting.burstTest) {
    const burst = TEST_RESULTS.rateLimiting.burstTest;
    console.log(`\nRate Limiting: ${burst.rateLimited > 0 ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`  - Burst test: ${burst.successful}/${burst.totalRequests} successful, ${burst.rateLimited} rate limited`);
  }
  
  if (TEST_RESULTS.rateLimiting.ipBlocking) {
    const blocking = TEST_RESULTS.rateLimiting.ipBlocking;
    console.log(`IP Blocking: ${blocking.triggered ? '✅ TRIGGERED' : '⚠️ NOT TRIGGERED'}`);
  }
  
  // Bad data injection summary
  if (TEST_RESULTS.badData.length > 0) {
    const passed = TEST_RESULTS.badData.filter(t => t.passed).length;
    console.log(`\nBad Data Injection: ${passed}/${TEST_RESULTS.badData.length} tests passed`);
  }
  
  // System limits summary  
  if (TEST_RESULTS.systemLimits.sustainedLoad) {
    const load = TEST_RESULTS.systemLimits.sustainedLoad;
    console.log(`\nSustained Load: ${load.successful}/${load.requests} successful requests`);
  }
  
  console.log(`\nFull results saved to: redteam-results-${Date.now()}.json`);
  
  // Save detailed results
  fs.writeFileSync(
    `redteam-results-${Date.now()}.json`, 
    JSON.stringify(TEST_RESULTS, null, 2)
  );
}

// Run the tests
runRedTeamTests().then(() => {
  console.log('\n✅ Red team testing completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Red team testing failed:', error);
  process.exit(1);
});
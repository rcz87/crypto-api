#!/usr/bin/env node
/**
 * ADVANCED RED TEAM TESTING SUITE - Focused Security Investigation
 * Investigates specific vulnerabilities found in initial testing
 */

import http from 'http';
import fs from 'fs';

const BASE_URL = 'http://localhost:5000';

// HTTP request utility
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
        'User-Agent': 'RedTeam-Advanced-Tests',
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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * INVESTIGATE RATE LIMITING BYPASS
 */
async function investigateRateLimitBypass() {
  console.log('\n🔍 INVESTIGATING RATE LIMITING BYPASS');
  console.log('=====================================');
  
  // Test different endpoints with different rate limit tiers
  const endpoints = [
    { path: '/api/health', tier: 'general', limit: 100 },
    { path: '/api/sol/complete', tier: 'sensitive', limit: 10 },
    { path: '/api/screener/screen', tier: 'ai_analysis', limit: 5, method: 'POST', data: {symbols: ['BTC']} },
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\nTesting ${endpoint.path} (${endpoint.tier} tier, ${endpoint.limit} req/min limit):`);
    
    const requests = [];
    const testCount = endpoint.limit + 5; // Test beyond the limit
    
    // Send requests rapidly
    for (let i = 0; i < testCount; i++) {
      requests.push(makeRequest(
        endpoint.path, 
        endpoint.method || 'GET', 
        endpoint.data
      ));
    }
    
    const results = await Promise.allSettled(requests);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.statusCode === 200).length;
    const rateLimited = results.filter(r => r.status === 'fulfilled' && r.value.statusCode === 429).length;
    const blocked = results.filter(r => 
      r.status === 'fulfilled' && 
      r.value.statusCode === 429 && 
      r.value.data.error?.includes('IP temporarily blocked')
    ).length;
    
    console.log(`  Sent: ${testCount} requests`);
    console.log(`  Success (200): ${successful}`);
    console.log(`  Rate Limited (429): ${rateLimited}`);
    console.log(`  IP Blocked: ${blocked}`);
    
    // Check for rate limit headers
    const firstResponse = results.find(r => r.status === 'fulfilled');
    if (firstResponse && firstResponse.value.headers) {
      const headers = firstResponse.value.headers;
      console.log(`  Rate Limit Headers: Limit=${headers['x-ratelimit-limit']}, Remaining=${headers['x-ratelimit-remaining']}, Tier=${headers['x-ratelimit-tier']}`);
    }
    
    if (rateLimited === 0 && successful === testCount) {
      console.log(`  ❌ CRITICAL: Rate limiting completely bypassed for ${endpoint.tier} tier!`);
    } else if (rateLimited > 0) {
      console.log(`  ✅ Rate limiting working: ${rateLimited} requests blocked`);
    }
    
    await delay(1000); // Wait between endpoint tests
  }
}

/**
 * COMPREHENSIVE XSS VULNERABILITY TESTING
 */
async function testXSSVulnerabilities() {
  console.log('\n🕷️ COMPREHENSIVE XSS VULNERABILITY TESTING');
  console.log('============================================');
  
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert("xss")>',
    'javascript:alert("xss")',
    '<svg onload=alert("xss")>',
    '"><script>alert("xss")</script>',
    "'><script>alert('xss')</script>",
    '<iframe src="javascript:alert(\'xss\')">',
    '${alert("xss")}',
    '{{alert("xss")}}',
    '<script>fetch("/api/security/metrics").then(r=>r.json()).then(console.log)</script>'
  ];
  
  const testEndpoints = [
    '/api/sol/complete?symbol=',
    '/api/btc/complete?timeframe=',
    '/api/sol/funding?symbol=',
  ];
  
  console.log(`Testing ${xssPayloads.length} XSS payloads across ${testEndpoints.length} endpoints:`);
  
  const results = [];
  
  for (const endpoint of testEndpoints) {
    for (const payload of xssPayloads) {
      try {
        const testUrl = endpoint + encodeURIComponent(payload);
        const response = await makeRequest(testUrl);
        
        const blocked = response.statusCode === 400 && 
          response.data.error === 'Invalid input detected';
        
        const result = {
          endpoint,
          payload: payload.substring(0, 50) + '...',
          statusCode: response.statusCode,
          blocked,
          dangerous: response.statusCode === 200 // XSS succeeded
        };
        
        results.push(result);
        
        if (result.dangerous) {
          console.log(`  🚨 CRITICAL XSS: ${endpoint} + "${payload.substring(0, 30)}..." returned 200`);
        } else if (result.blocked) {
          console.log(`  ✅ Blocked: ${endpoint} + "${payload.substring(0, 30)}..."`);
        }
        
        await delay(100); // Avoid overwhelming the system
        
      } catch (error) {
        console.log(`  Error testing ${endpoint}: ${error.message}`);
      }
    }
  }
  
  const dangerous = results.filter(r => r.dangerous).length;
  const blocked = results.filter(r => r.blocked).length;
  
  console.log(`\nXSS Test Results:`);
  console.log(`  Total tests: ${results.length}`);
  console.log(`  Dangerous (200): ${dangerous}`);
  console.log(`  Blocked (400): ${blocked}`);
  console.log(`  Other responses: ${results.length - dangerous - blocked}`);
  
  if (dangerous > 0) {
    console.log(`  🚨 ${dangerous} XSS vulnerabilities found!`);
  }
  
  return results;
}

/**
 * MEMORY AND RESOURCE STRESS TESTING
 */
async function stressTestResources() {
  console.log('\n💥 MEMORY AND RESOURCE STRESS TESTING');
  console.log('======================================');
  
  // Test 1: Memory stress with large payloads
  console.log('Test 1: Large payload stress test');
  const largePayload = {
    symbols: new Array(1000).fill('BTC-USDT-SWAP'),
    metadata: 'X'.repeat(100000), // 100KB of data
    nested: {
      data: new Array(500).fill({ key: 'X'.repeat(1000) })
    }
  };
  
  try {
    const response = await makeRequest('/api/screener/screen', 'POST', largePayload);
    console.log(`  Large payload result: ${response.statusCode} - ${response.data.error || 'Success'}`);
  } catch (error) {
    console.log(`  Large payload error: ${error.message}`);
  }
  
  // Test 2: Concurrent connection stress
  console.log('Test 2: Concurrent connection stress (50 simultaneous)');
  const concurrentPromises = [];
  
  for (let i = 0; i < 50; i++) {
    concurrentPromises.push(makeRequest('/api/health'));
  }
  
  const concurrentResults = await Promise.allSettled(concurrentPromises);
  const successful = concurrentResults.filter(r => r.status === 'fulfilled' && r.value.statusCode === 200).length;
  console.log(`  Concurrent connections: ${successful}/50 successful`);
  
  // Test 3: Resource metrics monitoring
  console.log('Test 3: Resource metrics during stress');
  const beforeMetrics = await makeRequest('/api/metrics');
  
  // Generate load for 10 seconds
  const loadPromises = [];
  const loadInterval = setInterval(() => {
    loadPromises.push(makeRequest('/api/sol/complete'));
  }, 50); // 20 RPS
  
  await delay(10000);
  clearInterval(loadInterval);
  
  await Promise.allSettled(loadPromises);
  const afterMetrics = await makeRequest('/api/metrics');
  
  console.log('  Memory usage:');
  console.log(`    Before: ${beforeMetrics.data.data.memory.used}/${beforeMetrics.data.data.memory.total} MB`);
  console.log(`    After: ${afterMetrics.data.data.memory.used}/${afterMetrics.data.data.memory.total} MB`);
  console.log(`    Change: ${afterMetrics.data.data.memory.used - beforeMetrics.data.data.memory.used} MB`);
  
  return {
    beforeMetrics: beforeMetrics.data.data,
    afterMetrics: afterMetrics.data.data,
    loadRequests: loadPromises.length
  };
}

/**
 * TEST IP BLOCK RECOVERY
 */
async function testIPBlockRecovery() {
  console.log('\n🔄 IP BLOCK RECOVERY TESTING');
  console.log('=============================');
  
  // Check if currently blocked
  const currentStatus = await makeRequest('/api/sol/complete');
  if (currentStatus.statusCode === 429 && currentStatus.data.error?.includes('temporarily blocked')) {
    console.log('✅ Currently blocked - testing block status');
    console.log(`Block message: ${currentStatus.data.error}`);
    return true;
  } else {
    console.log('ℹ️ Not currently blocked - block may have expired or not triggered');
    return false;
  }
}

/**
 * MAIN EXECUTION
 */
async function runAdvancedRedTeamTests() {
  console.log('🔴 ADVANCED RED TEAM TESTING - Security Investigation');
  console.log('======================================================');
  console.log(`Started at: ${new Date().toISOString()}`);
  
  const results = {
    rateLimitInvestigation: null,
    xssVulnerabilities: null,
    resourceStress: null,
    ipBlockRecovery: null,
    timestamp: new Date().toISOString()
  };
  
  try {
    // Investigate rate limiting bypass
    results.rateLimitInvestigation = await investigateRateLimitBypass();
    
    // Test XSS vulnerabilities comprehensively
    results.xssVulnerabilities = await testXSSVulnerabilities();
    
    // Stress test system resources
    results.resourceStress = await stressTestResources();
    
    // Test IP block recovery
    results.ipBlockRecovery = await testIPBlockRecovery();
    
    console.log('\n📋 ADVANCED RED TEAM SUMMARY');
    console.log('=============================');
    
    // Save results
    const filename = `advanced-redteam-results-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`Results saved to: ${filename}`);
    
  } catch (error) {
    console.error('Error in advanced testing:', error);
  }
  
  return results;
}

// Execute the advanced tests
runAdvancedRedTeamTests().then((results) => {
  console.log('\n✅ Advanced red team testing completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Advanced red team testing failed:', error);
  process.exit(1);
});
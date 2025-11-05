#!/usr/bin/env node

/**
 * Critical Security Test Suite
 * Tests for Rate Limiting and XSS Protection
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = 'http://localhost:5000';
const TEST_TIMEOUT = 30000;

// Color output for better readability
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SecurityTestSuite/1.0'
      },
      timeout: 5000
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testRateLimiting() {
  log('cyan', '\n=== TESTING RATE LIMITING ===');
  
  const results = {
    total: 0,
    blocked: 0,
    success: 0,
    errors: 0
  };

  try {
    // Test 1: Rapid requests to general endpoint
    log('blue', 'Test 1: Rapid requests to /api/metrics (general tier - 100 req/min)');
    
    const promises = [];
    for (let i = 0; i < 15; i++) {
      promises.push(makeRequest(`${BASE_URL}/api/metrics`));
    }

    const responses = await Promise.allSettled(promises);
    
    responses.forEach((result, index) => {
      results.total++;
      if (result.status === 'fulfilled') {
        const res = result.value;
        if (res.statusCode === 200) {
          results.success++;
          log('green', `  Request ${index + 1}: ✓ 200 OK`);
        } else if (res.statusCode === 429) {
          results.blocked++;
          log('yellow', `  Request ${index + 1}: ⚠ 429 Rate Limited`);
        } else {
          results.errors++;
          log('red', `  Request ${index + 1}: ✗ ${res.statusCode}`);
        }
      } else {
        results.errors++;
        log('red', `  Request ${index + 1}: ✗ ${result.reason.message}`);
      }
    });

    // Test 2: Rapid requests to AI endpoint (stricter limits)
    log('blue', '\nTest 2: Rapid requests to /api/sol/complete (AI tier - 5 req/min)');
    
    const aiPromises = [];
    for (let i = 0; i < 8; i++) {
      aiPromises.push(makeRequest(`${BASE_URL}/api/sol/complete`));
    }

    const aiResponses = await Promise.allSettled(aiPromises);
    
    aiResponses.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const res = result.value;
        if (res.statusCode === 200) {
          log('green', `  AI Request ${index + 1}: ✓ 200 OK`);
        } else if (res.statusCode === 429) {
          log('yellow', `  AI Request ${index + 1}: ⚠ 429 Rate Limited`);
        } else {
          log('red', `  AI Request ${index + 1}: ✗ ${res.statusCode}`);
        }
      } else {
        log('red', `  AI Request ${index + 1}: ✗ ${result.reason.message}`);
      }
    });

    log('magenta', '\n--- Rate Limiting Test Results ---');
    log('white', `Total Requests: ${results.total}`);
    log('green', `Successful: ${results.success}`);
    log('yellow', `Rate Limited: ${results.blocked}`);
    log('red', `Errors: ${results.errors}`);
    
    if (results.blocked > 0) {
      log('green', '✅ PASS: Rate limiting is working correctly');
      return true;
    } else {
      log('red', '❌ FAIL: No requests were rate limited - bypass may still exist');
      return false;
    }
    
  } catch (error) {
    log('red', `Rate limiting test failed: ${error.message}`);
    return false;
  }
}

async function testXSSProtection() {
  log('cyan', '\n=== TESTING XSS PROTECTION ===');
  
  const xssPayloads = [
    // Script-based XSS
    '<script>alert("xss")</script>',
    '<script src="javascript:alert(1)">',
    '<img src="x" onerror="alert(1)">',
    '<svg onload="alert(1)">',
    '<iframe src="javascript:alert(1)">',
    
    // Event handler XSS
    '<div onclick="alert(1)">',
    '<input onfocus="alert(1)" autofocus>',
    '<body onload="alert(1)">',
    
    // URL-based XSS
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    
    // Expression-based XSS
    'expression(alert(1))',
    'eval(alert(1))',
    
    // Encoded XSS
    '%3Cscript%3Ealert%281%29%3C%2Fscript%3E',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
  ];

  let blocked = 0;
  let passed = 0;
  let total = 0;

  // Test XSS in query parameters
  log('blue', 'Testing XSS payloads in query parameters...');
  
  for (const payload of xssPayloads) {
    total++;
    try {
      const encodedPayload = encodeURIComponent(payload);
      const response = await makeRequest(`${BASE_URL}/api/sol/complete?symbol=${encodedPayload}`);
      
      if (response.statusCode === 400) {
        blocked++;
        log('green', `  ✓ Blocked: ${payload.slice(0, 50)}...`);
      } else if (response.statusCode === 200 && response.body.includes(payload)) {
        passed++;
        log('red', `  ✗ XSS Passed: ${payload.slice(0, 50)}...`);
      } else {
        // Request may have been processed but payload sanitized
        log('yellow', `  ? Processed: ${payload.slice(0, 50)}... (${response.statusCode})`);
      }
    } catch (error) {
      log('yellow', `  ? Error testing: ${payload.slice(0, 50)}... - ${error.message}`);
    }
  }

  // Test XSS in request body
  log('blue', '\nTesting XSS payloads in request body...');
  
  for (let i = 0; i < 5; i++) {
    const payload = xssPayloads[i];
    total++;
    try {
      const response = await makeRequest(`${BASE_URL}/api/sol/complete`, 'POST', {
        symbol: 'SOL-USDT',
        maliciousData: payload
      });
      
      if (response.statusCode === 400) {
        blocked++;
        log('green', `  ✓ Blocked body XSS: ${payload.slice(0, 30)}...`);
      } else if (response.statusCode === 200 && response.body.includes(payload)) {
        passed++;
        log('red', `  ✗ Body XSS Passed: ${payload.slice(0, 30)}...`);
      } else {
        log('yellow', `  ? Body processed: ${payload.slice(0, 30)}... (${response.statusCode})`);
      }
    } catch (error) {
      log('yellow', `  ? Error testing body: ${payload.slice(0, 30)}... - ${error.message}`);
    }
  }

  // Test Content-Type headers
  log('blue', '\nTesting Content-Type headers...');
  try {
    const response = await makeRequest(`${BASE_URL}/api/sol/complete`);
    const contentType = response.headers['content-type'];
    
    if (contentType && contentType.includes('application/json')) {
      log('green', '  ✓ Proper Content-Type: application/json');
    } else {
      log('red', `  ✗ Wrong Content-Type: ${contentType}`);
    }
  } catch (error) {
    log('yellow', `  ? Error checking headers: ${error.message}`);
  }

  log('magenta', '\n--- XSS Protection Test Results ---');
  log('white', `Total XSS Tests: ${total}`);
  log('green', `Blocked: ${blocked}`);
  log('red', `Passed Through: ${passed}`);
  log('yellow', `Other: ${total - blocked - passed}`);
  
  const blockRate = (blocked / total) * 100;
  if (blockRate >= 80) {
    log('green', `✅ PASS: XSS protection is working (${blockRate.toFixed(1)}% blocked)`);
    return true;
  } else {
    log('red', `❌ FAIL: XSS protection insufficient (${blockRate.toFixed(1)}% blocked)`);
    return false;
  }
}

async function testSecurityHeaders() {
  log('cyan', '\n=== TESTING SECURITY HEADERS ===');
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/metrics`);
    const headers = response.headers;
    
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options', 
      'x-xss-protection',
      'content-security-policy',
      'strict-transport-security'
    ];
    
    let passed = 0;
    securityHeaders.forEach(header => {
      if (headers[header]) {
        log('green', `  ✓ ${header}: ${headers[header]}`);
        passed++;
      } else {
        log('red', `  ✗ Missing: ${header}`);
      }
    });
    
    if (passed === securityHeaders.length) {
      log('green', '✅ PASS: All security headers present');
      return true;
    } else {
      log('red', `❌ FAIL: ${securityHeaders.length - passed} security headers missing`);
      return false;
    }
  } catch (error) {
    log('red', `Security headers test failed: ${error.message}`);
    return false;
  }
}

async function runSecurityTests() {
  log('magenta', '🔒 CRITICAL SECURITY TEST SUITE STARTING 🔒');
  log('white', `Testing server at: ${BASE_URL}`);
  
  const results = {};
  
  // Wait a moment for server to fully start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    results.rateLimiting = await testRateLimiting();
    results.xssProtection = await testXSSProtection();  
    results.securityHeaders = await testSecurityHeaders();
    
    log('cyan', '\n=== FINAL SECURITY TEST RESULTS ===');
    log('white', `Rate Limiting: ${results.rateLimiting ? '✅ PASS' : '❌ FAIL'}`);
    log('white', `XSS Protection: ${results.xssProtection ? '✅ PASS' : '❌ FAIL'}`);
    log('white', `Security Headers: ${results.securityHeaders ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = results.rateLimiting && results.xssProtection && results.securityHeaders;
    
    if (allPassed) {
      log('green', '\n🎉 ALL SECURITY TESTS PASSED - PRODUCTION READY 🎉');
      process.exit(0);
    } else {
      log('red', '\n💥 SECURITY TESTS FAILED - NOT PRODUCTION READY 💥');
      process.exit(1);
    }
    
  } catch (error) {
    log('red', `Critical error during testing: ${error.message}`);
    process.exit(1);
  }
}

// Handle script termination
process.on('SIGINT', () => {
  log('yellow', '\nSecurity test suite interrupted');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log('red', `Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Start the test suite
runSecurityTests().catch(error => {
  log('red', `Failed to run security tests: ${error.message}`);
  process.exit(1);
});
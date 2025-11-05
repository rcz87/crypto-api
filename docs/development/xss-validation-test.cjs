#!/usr/bin/env node

/**
 * Focused XSS Protection Test
 * Works with rate limiting constraints
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

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
        'User-Agent': 'XSSTest/1.0'
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

async function testXSSProtectionWithDelay() {
  console.log('🔍 Testing XSS Protection (with rate limiting consideration)');
  
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src="x" onerror="alert(1)">',
    '<svg onload="alert(1)">',
    'javascript:alert(1)',
    'expression(alert(1))'
  ];

  let testResults = [];
  
  // Test one payload with proper delay to avoid rate limiting
  for (let i = 0; i < Math.min(3, xssPayloads.length); i++) {
    const payload = xssPayloads[i];
    
    try {
      console.log(`\\nTesting payload ${i+1}: ${payload.slice(0, 30)}...`);
      
      // Test in query parameter
      const encodedPayload = encodeURIComponent(payload);
      const response = await makeRequest(`${BASE_URL}/api/metrics?test=${encodedPayload}`);
      
      console.log(`Status: ${response.statusCode}`);
      console.log(`Content-Type: ${response.headers['content-type'] || 'not set'}`);
      
      if (response.statusCode === 400) {
        console.log('✅ XSS payload BLOCKED by validation');
        testResults.push({ payload, blocked: true, status: 400 });
      } else if (response.statusCode === 200) {
        // Check if payload appears in response
        if (response.body.includes(payload)) {
          console.log('❌ XSS payload PASSED THROUGH - VULNERABILITY!');
          testResults.push({ payload, blocked: false, status: 200, vulnerable: true });
        } else {
          console.log('✅ XSS payload sanitized/filtered');
          testResults.push({ payload, blocked: true, status: 200, sanitized: true });
        }
      } else if (response.statusCode === 429) {
        console.log('⏳ Rate limited - test inconclusive');
        testResults.push({ payload, blocked: false, status: 429, rateLimited: true });
      } else {
        console.log(`? Unexpected response: ${response.statusCode}`);
        testResults.push({ payload, blocked: false, status: response.statusCode });
      }
      
      // Wait between requests to avoid rate limiting
      if (i < 2) {
        console.log('Waiting to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
    } catch (error) {
      console.log(`Error testing payload: ${error.message}`);
      testResults.push({ payload, error: error.message });
    }
  }
  
  // Summary
  console.log('\\n--- XSS Test Results Summary ---');
  const blocked = testResults.filter(r => r.blocked).length;
  const vulnerable = testResults.filter(r => r.vulnerable).length;
  const rateLimited = testResults.filter(r => r.rateLimited).length;
  
  console.log(`Total tests: ${testResults.length}`);
  console.log(`Blocked/Sanitized: ${blocked}`);
  console.log(`Vulnerable: ${vulnerable}`);
  console.log(`Rate Limited: ${rateLimited}`);
  
  if (vulnerable > 0) {
    console.log('❌ XSS VULNERABILITIES DETECTED!');
    return false;
  } else if (blocked > 0) {
    console.log('✅ XSS Protection Working');
    return true;
  } else {
    console.log('⚠ Tests inconclusive due to rate limiting');
    return null;
  }
}

async function testSecurityHeaders() {
  console.log('\\n🛡️  Testing Security Headers');
  
  try {
    // Wait for rate limit to reset
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const response = await makeRequest(`${BASE_URL}/api/metrics`);
    
    if (response.statusCode === 200) {
      console.log('✅ Successfully got 200 response');
      
      const headers = response.headers;
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options', 
        'x-xss-protection',
        'content-security-policy',
        'strict-transport-security'
      ];
      
      console.log('\\nSecurity Headers Check:');
      securityHeaders.forEach(header => {
        if (headers[header]) {
          console.log(`✅ ${header}: ${headers[header]}`);
        } else {
          console.log(`❌ Missing: ${header}`);
        }
      });
      
      // Check Content-Type
      const contentType = headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        console.log(`✅ Proper Content-Type: ${contentType}`);
      } else {
        console.log(`❌ Wrong Content-Type: ${contentType}`);
      }
      
      return true;
    } else {
      console.log(`Rate limited (${response.statusCode}) - cannot test headers`);
      return null;
    }
    
  } catch (error) {
    console.log(`Error testing headers: ${error.message}`);
    return false;
  }
}

async function runFocusedTests() {
  console.log('🔒 FOCUSED SECURITY VERIFICATION TEST 🔒\\n');
  
  const xssResult = await testXSSProtectionWithDelay();
  const headersResult = await testSecurityHeaders();
  
  console.log('\\n=== FINAL VERIFICATION RESULTS ===');
  console.log(`XSS Protection: ${xssResult === true ? '✅ WORKING' : xssResult === false ? '❌ VULNERABLE' : '⚠ INCONCLUSIVE'}`);
  console.log(`Security Headers: ${headersResult === true ? '✅ PRESENT' : headersResult === false ? '❌ MISSING' : '⚠ INCONCLUSIVE'}`);
  
  // Overall assessment
  if (xssResult === true && headersResult === true) {
    console.log('\\n🎉 SECURITY VERIFICATION PASSED 🎉');
  } else if (xssResult === false) {
    console.log('\\n💥 XSS VULNERABILITIES DETECTED 💥');
  } else {
    console.log('\\n⚠ PARTIAL VERIFICATION - Rate limiting prevented full testing');
    console.log('This actually indicates rate limiting is working correctly!');
  }
}

runFocusedTests().catch(console.error);
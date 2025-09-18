/**
 * Contract Tests: JSON-Only Response Validation
 * 
 * These tests verify that all API endpoints return JSON responses
 * instead of HTML error pages, preventing client-side parsing errors.
 */

import http from 'http';
import { URL } from 'url';

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_ENDPOINTS = [
  // Intentionally test non-existent endpoints to trigger 404s
  '/api/nonexistent',
  '/api/invalid-endpoint',
  '/api/missing/resource',
  // Test existing endpoints that might error
  '/api/screener?symbols=INVALID',
  '/api/ai/enhanced-signal',
  '/api/ai/enhanced-performance',
  // Test static/non-API routes that should still be JSON for API calls
  '/nonexistent-route',
  '/api/health/fake'
];

/**
 * Make HTTP request and return response details
 */
function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          contentType: res.headers['content-type'] || ''
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Test if response is JSON-only (not HTML)
 */
function validateJSONResponse(response, endpoint) {
  const { statusCode, contentType, body } = response;
  const results = {
    endpoint,
    statusCode,
    contentType,
    passed: true,
    errors: []
  };

  // Check 1: Content-Type should be application/json for API endpoints
  if (endpoint.startsWith('/api/') && !contentType.includes('application/json')) {
    results.passed = false;
    results.errors.push(`Expected application/json, got: ${contentType}`);
  }

  // Check 2: Response should not be HTML
  if (contentType.includes('text/html')) {
    results.passed = false;
    results.errors.push('Response is HTML instead of JSON');
  }

  // Check 3: For API endpoints, body should be parseable JSON
  if (endpoint.startsWith('/api/')) {
    try {
      const parsed = JSON.parse(body);
      
      // Check 4: Error responses should have consistent structure
      if (statusCode >= 400) {
        if (!parsed.ok === false && !parsed.error && !parsed.message) {
          results.errors.push('Error response missing ok:false, error, or message field');
        }
      }
    } catch (parseError) {
      results.passed = false;
      results.errors.push(`Response is not valid JSON: ${parseError.message}`);
      
      // Check if it looks like HTML
      if (body.trim().startsWith('<') || body.includes('<html>') || body.includes('</html>')) {
        results.errors.push('Response appears to be HTML content');
      }
    }
  }

  return results;
}

/**
 * Run contract tests
 */
async function runContractTests() {
  console.log('🧪 Running JSON-Only Contract Tests...\n');
  
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const endpoint of TEST_ENDPOINTS) {
    try {
      const url = BASE_URL + endpoint;
      console.log(`Testing: ${endpoint}`);
      
      const response = await makeRequest(url);
      const validation = validateJSONResponse(response, endpoint);
      
      results.push(validation);
      
      if (validation.passed) {
        console.log(`  ✅ PASS (${response.statusCode})`);
        passed++;
      } else {
        console.log(`  ❌ FAIL (${response.statusCode})`);
        validation.errors.forEach(error => {
          console.log(`     - ${error}`);
        });
        failed++;
      }
      
    } catch (error) {
      console.log(`  ⚠️  ERROR: ${error.message}`);
      results.push({
        endpoint,
        passed: false,
        errors: [error.message]
      });
      failed++;
    }
    
    console.log(''); // Empty line
  }

  // Summary
  console.log('📊 Test Summary:');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%\n`);

  // Detailed results for failures
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('❌ Failed Tests Details:');
    failures.forEach(failure => {
      console.log(`  ${failure.endpoint}:`);
      failure.errors.forEach(error => console.log(`    - ${error}`));
    });
    console.log('');
  }

  return {
    passed,
    failed,
    successRate: passed / (passed + failed),
    details: results
  };
}

/**
 * Export for use in other test frameworks
 */
// Run directly if this is the main module
runContractTests()
  .then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Contract test error:', error);
    process.exit(1);
  });
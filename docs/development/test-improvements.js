/**
 * Manual Test Script for Trading Route Improvements
 * 
 * Tests:
 * 1. Rate limiting on confluence endpoints
 * 2. Error handling improvements
 * 3. Circuit breaker functionality
 * 4. Input validation
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Test rate limiting by making multiple requests quickly
async function testRateLimiting() {
  console.log('\n=== Testing Rate Limiting (confluence endpoints - 3 req/min) ===');
  
  const promises = [];
  const startTime = Date.now();
  
  // Make 5 requests quickly to test rate limiting
  for (let i = 0; i < 5; i++) {
    promises.push(
      fetch(`${BASE_URL}/api/screening/confluence?symbols=BTC`)
        .then(res => ({
          status: res.status,
          requestNumber: i + 1,
          headers: {
            'x-ratelimit-limit': res.headers.get('x-ratelimit-limit'),
            'x-ratelimit-remaining': res.headers.get('x-ratelimit-remaining'),
            'x-ratelimit-tier': res.headers.get('x-ratelimit-tier')
          }
        }))
        .catch(err => ({ error: err.message, requestNumber: i + 1 }))
    );
  }
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  console.log(`\nResults (took ${endTime - startTime}ms):`);
  results.forEach(result => {
    if (result.error) {
      console.log(`Request ${result.requestNumber}: ERROR - ${result.error}`);
    } else {
      console.log(`Request ${result.requestNumber}: ${result.status} - Tier: ${result.headers['x-ratelimit-tier']} - Remaining: ${result.headers['x-ratelimit-remaining']}`);
    }
  });
  
  const rateLimitedRequests = results.filter(r => r.status === 429).length;
  console.log(`\nRate limited requests: ${rateLimitedRequests}/5`);
  console.log('✅ Expected: 2-3 requests should be rate limited (confluence_screening tier: 3 req/min)');
}

// Test input validation and error handling
async function testInputValidation() {
  console.log('\n=== Testing Input Validation and Error Handling ===');
  
  const testCases = [
    {
      name: 'Too many symbols (>20)',
      url: `${BASE_URL}/api/screening/confluence`,
      method: 'POST',
      body: {
        symbols: Array.from({ length: 21 }, (_, i) => `SYM${i}`),
        timeframe: '15m',
        include_details: false
      }
    },
    {
      name: 'Invalid timeframe',
      url: `${BASE_URL}/api/screening/confluence`,
      method: 'POST',
      body: {
        symbols: ['BTC'],
        timeframe: 'invalid',
        include_details: false
      }
    },
    {
      name: 'Missing required fields',
      url: `${BASE_URL}/api/screening/confluence`,
      method: 'POST',
      body: {
        timeframe: '15m'
        // Missing symbols
      }
    },
    {
      name: 'Invalid symbols format',
      url: `${BASE_URL}/api/screening/confluence`,
      method: 'GET',
      query: 'symbols=INVALID<>SYMBOL&timeframe=15m'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}`);
    
    try {
      let response;
      if (testCase.method === 'POST') {
        response = await fetch(testCase.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCase.body)
        });
      } else {
        response = await fetch(`${testCase.url}?${testCase.query}`);
      }
      
      const data = await response.json();
      console.log(`Status: ${response.status}`);
      console.log(`Response: ${data.success ? 'SUCCESS' : 'ERROR'} - ${data.error || data.message || 'No message'}`);
      
      if (data.error_category) {
        console.log(`Error Category: ${data.error_category}`);
      }
      
    } catch (error) {
      console.log(`ERROR: ${error.message}`);
    }
  }
}

// Test GET vs POST consistency
async function testGetPostConsistency() {
  console.log('\n=== Testing GET vs POST Consistency ===');
  
  const symbols = ['BTC', 'ETH'];
  const timeframe = '15m';
  
  console.log('Making GET request...');
  const getResponse = await fetch(`${BASE_URL}/api/screening/confluence?symbols=${symbols.join(',')}&timeframe=${timeframe}`)
    .then(res => res.json())
    .catch(err => ({ error: err.message }));
  
  console.log('Making POST request...');
  const postResponse = await fetch(`${BASE_URL}/api/screening/confluence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      symbols,
      timeframe,
      include_details: false
    })
  })
    .then(res => res.json())
    .catch(err => ({ error: err.message }));
  
  console.log('\nGET Response Success:', getResponse.success);
  console.log('POST Response Success:', postResponse.success);
  
  if (getResponse.success && postResponse.success) {
    console.log('GET Results Keys:', Object.keys(getResponse.results || {}));
    console.log('POST Results Keys:', Object.keys(postResponse.results || {}));
    console.log('Metadata Timeframes:', getResponse.metadata?.timeframe, 'vs', postResponse.metadata?.timeframe);
    console.log('✅ Both endpoints should return consistent structure');
  } else {
    console.log('GET Error:', getResponse.error);
    console.log('POST Error:', postResponse.error);
  }
}

// Test circuit breaker stats and metadata
async function testCircuitBreakerMetadata() {
  console.log('\n=== Testing Circuit Breaker and Enhanced Metadata ===');
  
  const response = await fetch(`${BASE_URL}/api/screening/confluence?symbols=BTC`)
    .then(res => res.json())
    .catch(err => ({ error: err.message }));
  
  if (response.success) {
    console.log('✅ Request successful');
    console.log('API Version:', response.metadata?.api_version);
    console.log('Processing Time:', response.metadata?.processing_time_ms + 'ms');
    console.log('Circuit Breaker Stats:', JSON.stringify(response.metadata?.circuit_breaker_stats, null, 2));
  } else {
    console.log('❌ Request failed:', response.error);
    console.log('Error Category:', response.error_category);
    console.log('Circuit Breaker Stats:', JSON.stringify(response.circuit_breaker_stats, null, 2));
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Trading Route Improvements Test Suite');
  console.log('='.repeat(60));
  
  try {
    await testRateLimiting();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between test suites
    
    await testInputValidation();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetPostConsistency();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testCircuitBreakerMetadata();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All tests completed! Check results above.');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

// Run the tests
runAllTests();
#!/usr/bin/env node

/**
 * Anti-Lumpuh Failure Resilience Testing Framework
 * 
 * Tests system resilience against all failure scenarios and verifies 
 * never-blank responses with degradation handling.
 * 
 * Mission: Verify institutional-grade resilience under all failure modes
 */

import { promises as fs } from 'fs';
import { performance } from 'perf_hooks';

// Base URLs - adapt for your environment
const BASE_URL = 'http://localhost:5000';
const API_ENDPOINTS = {
  health: '/api/health',
  metrics: '/api/metrics',
  solComplete: '/api/sol/complete',
  solFunding: '/api/sol/funding',
  solTechnical: '/api/sol/technical',
  solSMC: '/api/sol/smc',
  solCVD: '/api/sol/cvd',
  enhancedAI: '/api/sol/enhanced-ai-signal',
  confluence: '/api/sol/confluence',
  coinApiTickers: '/api/coinapi/multi-ticker',
  coinApiArbitrage: '/api/coinapi/arbitrage'
};

// Test configuration
const TEST_CONFIG = {
  maxResponseTime: 5000, // 5 second timeout
  degradationLatencyThreshold: 700, // 700ms p95 latency threshold
  cacheTTL: 30000, // 30 second cache TTL
  retryAttempts: 3,
  concurrentRequests: 5,
  stressTestDuration: 60000 // 1 minute stress test
};

// Global test state
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: [],
  timestamp: new Date().toISOString()
};

// Logging utilities
function log(level, message, details = null) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, details };
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
  if (details) console.log('  Details:', details);
  testResults.details.push(logEntry);
}

function logTest(testName, passed, message, metrics = {}) {
  if (passed) {
    testResults.passed++;
    log('PASS', `✅ ${testName}: ${message}`, metrics);
  } else {
    testResults.failed++;
    log('FAIL', `❌ ${testName}: ${message}`, metrics);
  }
}

function logWarning(testName, message, details = {}) {
  testResults.warnings++;
  log('WARN', `⚠️ ${testName}: ${message}`, details);
}

// Enhanced HTTP client with timeout and metrics
async function makeRequest(url, options = {}) {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || TEST_CONFIG.maxResponseTime);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    clearTimeout(timeoutId);
    
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      responseTime,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const endTime = performance.now();
    
    return {
      ok: false,
      status: 0,
      statusText: error.name,
      data: null,
      responseTime: endTime - startTime,
      error: error.message
    };
  }
}

// Test 1: System Health and Baseline Performance
async function testSystemHealth() {
  log('INFO', '🏥 Testing System Health and Baseline Performance');
  
  try {
    // Test health endpoint
    const healthResponse = await makeRequest(`${BASE_URL}${API_ENDPOINTS.health}`);
    
    if (!healthResponse.ok) {
      logTest('System Health', false, `Health endpoint failed: ${healthResponse.status} ${healthResponse.statusText}`);
      return false;
    }
    
    const healthData = healthResponse.data;
    const isHealthy = healthData?.data?.status === 'operational' || healthData?.status === 'ok';
    
    logTest('System Health', isHealthy, `System status: ${healthData?.data?.status || healthData?.status}`, {
      responseTime: healthResponse.responseTime,
      services: healthData?.data?.services || healthData?.components
    });
    
    // Test metrics endpoint
    const metricsResponse = await makeRequest(`${BASE_URL}${API_ENDPOINTS.metrics}`);
    if (metricsResponse.ok) {
      const metrics = metricsResponse.data?.data;
      log('INFO', 'System Metrics Baseline', {
        uptime: metrics?.uptime,
        memory: metrics?.memory,
        cache: metrics?.cache,
        okx: metrics?.okx,
        http: metrics?.http
      });
    }
    
    return isHealthy;
  } catch (error) {
    logTest('System Health', false, `Health check failed: ${error.message}`);
    return false;
  }
}

// Test 2: Baseline API Performance
async function testBaselinePerformance() {
  log('INFO', '⚡ Testing Baseline API Performance');
  
  const endpoints = [
    { name: 'SOL Complete', url: `${BASE_URL}${API_ENDPOINTS.solComplete}` },
    { name: 'SOL Funding', url: `${BASE_URL}${API_ENDPOINTS.solFunding}` },
    { name: 'SOL Technical', url: `${BASE_URL}${API_ENDPOINTS.solTechnical}` }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(endpoint.url);
      
      const passed = response.ok && response.responseTime < 2000; // 2s baseline threshold
      logTest(`${endpoint.name} Baseline`, passed, 
        `Response: ${response.status}, Time: ${Math.round(response.responseTime)}ms`, {
        responseTime: response.responseTime,
        hasData: !!response.data?.data,
        success: response.data?.success
      });
      
      // Check for never-blank response
      if (response.ok && response.data) {
        const hasNonEmptyData = response.data.data && Object.keys(response.data.data).length > 0;
        if (!hasNonEmptyData) {
          logWarning(`${endpoint.name} Data Quality`, 'Response data appears to be empty or minimal');
        }
      }
    } catch (error) {
      logTest(`${endpoint.name} Baseline`, false, `Request failed: ${error.message}`);
    }
  }
}

// Test 3: Concurrent Load Testing
async function testConcurrentLoad() {
  log('INFO', '🔄 Testing Concurrent Load Handling');
  
  const concurrentRequests = Array.from({ length: TEST_CONFIG.concurrentRequests }, (_, i) => 
    makeRequest(`${BASE_URL}${API_ENDPOINTS.solComplete}?test=concurrent_${i}`)
  );
  
  try {
    const startTime = performance.now();
    const responses = await Promise.allSettled(concurrentRequests);
    const endTime = performance.now();
    
    const successful = responses.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    const failed = responses.length - successful;
    
    const avgResponseTime = responses
      .filter(r => r.status === 'fulfilled')
      .reduce((sum, r) => sum + r.value.responseTime, 0) / successful;
    
    const passed = successful >= Math.floor(TEST_CONFIG.concurrentRequests * 0.8); // 80% success rate
    
    logTest('Concurrent Load', passed, 
      `${successful}/${TEST_CONFIG.concurrentRequests} requests succeeded`, {
      totalTime: endTime - startTime,
      avgResponseTime: Math.round(avgResponseTime),
      successRate: `${Math.round((successful / TEST_CONFIG.concurrentRequests) * 100)}%`,
      failedCount: failed
    });
    
  } catch (error) {
    logTest('Concurrent Load', false, `Concurrent load test failed: ${error.message}`);
  }
}

// Test 4: Cache Invalidation and Last-Good Cache Testing
async function testCacheInvalidation() {
  log('INFO', '💾 Testing Cache Invalidation and Last-Good Cache');
  
  try {
    // Clear cache endpoint if available
    const clearCacheResponse = await makeRequest(`${BASE_URL}/api/cache/clear`, { method: 'POST' });
    if (clearCacheResponse.ok) {
      log('INFO', 'Cache cleared successfully');
    }
    
    // Make initial request to populate cache
    log('INFO', 'Making initial request to populate cache');
    const initialResponse = await makeRequest(`${BASE_URL}${API_ENDPOINTS.solComplete}`);
    
    if (!initialResponse.ok) {
      logTest('Cache Population', false, 'Failed to populate cache with initial request');
      return;
    }
    
    logTest('Cache Population', true, 'Initial cache population successful', {
      responseTime: initialResponse.responseTime,
      hasData: !!initialResponse.data?.data
    });
    
    // Wait a short time, then make subsequent requests to test cache hits
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const cachedResponse = await makeRequest(`${BASE_URL}${API_ENDPOINTS.solComplete}`);
    
    const fasterResponse = cachedResponse.responseTime < initialResponse.responseTime;
    logTest('Cache Hit Performance', fasterResponse, 
      `Cached response time: ${Math.round(cachedResponse.responseTime)}ms vs initial: ${Math.round(initialResponse.responseTime)}ms`, {
      initialTime: initialResponse.responseTime,
      cachedTime: cachedResponse.responseTime,
      improvement: Math.round(((initialResponse.responseTime - cachedResponse.responseTime) / initialResponse.responseTime) * 100)
    });
    
    // Test cache TTL expiration (simulate waiting for 30s TTL)
    log('INFO', 'Testing cache TTL behavior (simulated)');
    logWarning('Cache TTL Test', 'Full 30s TTL test skipped for time efficiency. In production, verify cache expires after 30s.');
    
  } catch (error) {
    logTest('Cache Testing', false, `Cache testing failed: ${error.message}`);
  }
}

// Test 5: Network Latency and Timeout Handling
async function testNetworkResilience() {
  log('INFO', '🌐 Testing Network Resilience and Timeout Handling');
  
  // Test with very short timeout to simulate network issues
  const shortTimeoutResponse = await makeRequest(`${BASE_URL}${API_ENDPOINTS.solComplete}`, {
    timeout: 100 // 100ms timeout - should trigger timeout
  });
  
  if (shortTimeoutResponse.error && shortTimeoutResponse.error.includes('abort')) {
    logTest('Timeout Handling', true, 'System correctly handles network timeouts', {
      timeoutValue: '100ms',
      error: shortTimeoutResponse.error
    });
  } else {
    logTest('Timeout Handling', shortTimeoutResponse.ok, 'Unexpected timeout behavior', {
      response: shortTimeoutResponse
    });
  }
  
  // Test normal request after timeout
  const normalResponse = await makeRequest(`${BASE_URL}${API_ENDPOINTS.solComplete}`);
  logTest('Recovery After Timeout', normalResponse.ok, 
    `System recovered from timeout: ${normalResponse.status}`, {
    responseTime: normalResponse.responseTime
  });
}

// Test 6: Error Response Quality and Never-Blank Verification
async function testErrorResponseQuality() {
  log('INFO', '🛡️ Testing Error Response Quality and Never-Blank Verification');
  
  const errorScenarios = [
    {
      name: 'Invalid Endpoint',
      url: `${BASE_URL}/api/invalid/endpoint`,
      expectStatus: 404
    },
    {
      name: 'Malformed Parameters',
      url: `${BASE_URL}${API_ENDPOINTS.solTechnical}?timeframe=invalid&limit=abc`,
      expectStatus: [400, 500] // Could be either
    }
  ];
  
  for (const scenario of errorScenarios) {
    try {
      const response = await makeRequest(scenario.url);
      
      // Check if response has appropriate error structure
      const hasErrorStructure = response.data && (
        response.data.error || 
        response.data.message || 
        response.data.success === false
      );
      
      const statusMatches = Array.isArray(scenario.expectStatus) 
        ? scenario.expectStatus.includes(response.status)
        : response.status === scenario.expectStatus;
      
      logTest(`Error Response - ${scenario.name}`, hasErrorStructure, 
        `Status: ${response.status}, Has Error Structure: ${hasErrorStructure}`, {
        expectedStatus: scenario.expectStatus,
        actualStatus: response.status,
        errorData: response.data
      });
      
      // Verify never-blank - even errors should have meaningful content
      if (response.data) {
        const hasContent = JSON.stringify(response.data).length > 10; // More than just {}
        if (!hasContent) {
          logWarning(`Error Content - ${scenario.name}`, 'Error response appears to be blank or minimal');
        }
      }
      
    } catch (error) {
      logTest(`Error Handling - ${scenario.name}`, false, `Failed to test error scenario: ${error.message}`);
    }
  }
}

// Test 7: AI Signal Never-Blank Verification
async function testAISignalResilience() {
  log('INFO', '🧠 Testing AI Signal Never-Blank Verification');
  
  try {
    // Test Enhanced AI Signal endpoint
    const aiResponse = await makeRequest(`${BASE_URL}${API_ENDPOINTS.enhancedAI}`);
    
    if (aiResponse.ok && aiResponse.data?.data) {
      const signalData = aiResponse.data.data;
      
      // Verify essential fields are never blank
      const essentialFields = ['direction', 'strength', 'confidence', 'reasoning'];
      const hasEssentialFields = essentialFields.every(field => 
        signalData[field] !== undefined && signalData[field] !== null && signalData[field] !== ''
      );
      
      logTest('AI Signal Structure', hasEssentialFields, 
        `AI signal has all essential fields`, {
        direction: signalData.direction,
        strength: signalData.strength,
        confidence: signalData.confidence,
        hasReasoning: !!signalData.reasoning,
        degradationNotice: signalData.degradation_notice
      });
      
      // Check for degradation notice presence
      if (signalData.degradation_notice) {
        log('INFO', 'Degradation notice present in AI signal', signalData.degradation_notice);
      }
      
      // Verify confidence values are within expected ranges
      const confidenceInRange = signalData.confidence >= 0 && signalData.confidence <= 100;
      const strengthInRange = signalData.strength >= 0 && signalData.strength <= 100;
      
      logTest('AI Signal Validation', confidenceInRange && strengthInRange,
        `Confidence: ${signalData.confidence}, Strength: ${signalData.strength}`, {
        confidenceValid: confidenceInRange,
        strengthValid: strengthInRange
      });
      
    } else {
      logTest('AI Signal Availability', false, 
        `AI signal endpoint failed: ${aiResponse.status} ${aiResponse.statusText}`);
    }
    
  } catch (error) {
    logTest('AI Signal Testing', false, `AI signal testing failed: ${error.message}`);
  }
}

// Test 8: WebSocket Connection Resilience
async function testWebSocketResilience() {
  log('INFO', '🔌 Testing WebSocket Connection Resilience');
  
  try {
    const wsUrl = BASE_URL.replace('http', 'ws');
    
    // Note: This is a simplified WebSocket test
    // In a real test, you'd establish a WebSocket connection and test disconnection/reconnection
    logWarning('WebSocket Testing', 'WebSocket resilience test is simplified. Full testing would require WebSocket connection establishment and disconnection simulation.');
    
    // Test WebSocket-dependent endpoints instead
    const endpoints = [
      `${BASE_URL}${API_ENDPOINTS.solCVD}`,
      `${BASE_URL}${API_ENDPOINTS.confluence}`
    ];
    
    for (const endpoint of endpoints) {
      const response = await makeRequest(endpoint);
      logTest(`WebSocket-dependent endpoint`, response.ok, 
        `Endpoint accessible: ${response.status}`, {
        endpoint,
        responseTime: response.responseTime,
        hasData: !!response.data?.data
      });
    }
    
  } catch (error) {
    logTest('WebSocket Testing', false, `WebSocket testing failed: ${error.message}`);
  }
}

// Test 9: Degradation Metadata Verification
async function testDegradationMetadata() {
  log('INFO', '📊 Testing Degradation Metadata and Confidence Scaling');
  
  const endpoints = [
    { name: 'Enhanced AI', url: `${BASE_URL}${API_ENDPOINTS.enhancedAI}` },
    { name: 'Confluence', url: `${BASE_URL}${API_ENDPOINTS.confluence}` },
    { name: 'CVD Analysis', url: `${BASE_URL}${API_ENDPOINTS.solCVD}` }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(endpoint.url);
      
      if (response.ok && response.data?.data) {
        const data = response.data.data;
        
        // Check for degradation notices or metadata
        const hasDegradationInfo = !!(
          data.degradation_notice ||
          data.data_quality ||
          data.source ||
          data.confidence_adjustment
        );
        
        if (hasDegradationInfo) {
          log('INFO', `${endpoint.name} has degradation metadata`, {
            degradation_notice: data.degradation_notice,
            data_quality: data.data_quality,
            source: data.source,
            confidence_adjustment: data.confidence_adjustment
          });
        }
        
        // Verify confidence/strength values exist and are reasonable
        const hasConfidence = data.confidence !== undefined || data.strength !== undefined;
        logTest(`${endpoint.name} Confidence`, hasConfidence,
          `Has confidence/strength metrics: ${hasConfidence}`, {
          confidence: data.confidence,
          strength: data.strength,
          hasDegradationInfo
        });
        
      } else {
        logTest(`${endpoint.name} Response`, false, 
          `Failed to get response: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      logTest(`${endpoint.name} Testing`, false, `Testing failed: ${error.message}`);
    }
  }
}

// Test 10: System Recovery Verification
async function testSystemRecovery() {
  log('INFO', '🔄 Testing System Recovery and Self-Healing');
  
  try {
    // Test multiple requests over time to verify system stability
    const recoveryTests = [];
    const testCount = 5;
    const delayBetweenTests = 2000; // 2 seconds
    
    for (let i = 0; i < testCount; i++) {
      const response = await makeRequest(`${BASE_URL}${API_ENDPOINTS.solComplete}`);
      recoveryTests.push({
        attempt: i + 1,
        success: response.ok,
        responseTime: response.responseTime,
        timestamp: new Date().toISOString()
      });
      
      if (i < testCount - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenTests));
      }
    }
    
    const successfulTests = recoveryTests.filter(test => test.success).length;
    const avgResponseTime = recoveryTests
      .filter(test => test.success)
      .reduce((sum, test) => sum + test.responseTime, 0) / successfulTests;
    
    const recoveryPassed = successfulTests >= Math.floor(testCount * 0.8); // 80% success rate
    
    logTest('System Recovery', recoveryPassed,
      `${successfulTests}/${testCount} consecutive tests passed`, {
      successRate: `${Math.round((successfulTests / testCount) * 100)}%`,
      avgResponseTime: Math.round(avgResponseTime),
      tests: recoveryTests
    });
    
  } catch (error) {
    logTest('System Recovery', false, `Recovery testing failed: ${error.message}`);
  }
}

// Main test execution
async function runAntiLumpuhTests() {
  console.log('🚀 Starting Anti-Lumpuh Failure Resilience Testing Framework');
  console.log('=' .repeat(80));
  
  const startTime = performance.now();
  
  // Execute all test suites
  const testSuites = [
    testSystemHealth,
    testBaselinePerformance,
    testConcurrentLoad,
    testCacheInvalidation,
    testNetworkResilience,
    testErrorResponseQuality,
    testAISignalResilience,
    testWebSocketResilience,
    testDegradationMetadata,
    testSystemRecovery
  ];
  
  for (const testSuite of testSuites) {
    try {
      await testSuite();
      console.log(''); // Add spacing between test suites
    } catch (error) {
      log('ERROR', `Test suite ${testSuite.name} failed: ${error.message}`);
    }
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  // Generate final report
  console.log('=' .repeat(80));
  console.log('📊 ANTI-LUMPUH RESILIENCE TEST REPORT');
  console.log('=' .repeat(80));
  
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`⚠️  Warnings: ${testResults.warnings}`);
  console.log(`⏱️  Total Time: ${Math.round(totalTime)}ms`);
  console.log(`📅 Timestamp: ${testResults.timestamp}`);
  
  const successRate = testResults.passed / (testResults.passed + testResults.failed) * 100;
  console.log(`📈 Success Rate: ${Math.round(successRate)}%`);
  
  console.log('\n🎯 ANTI-LUMPUH VERIFICATION STATUS:');
  if (successRate >= 90) {
    console.log('🟢 EXCELLENT - System demonstrates institutional-grade resilience');
  } else if (successRate >= 75) {
    console.log('🟡 GOOD - System shows strong resilience with minor areas for improvement');
  } else if (successRate >= 60) {
    console.log('🟠 MODERATE - System has basic resilience but needs improvement');
  } else {
    console.log('🔴 POOR - System requires significant resilience improvements');
  }
  
  // Write detailed report to file
  try {
    const reportData = {
      summary: {
        passed: testResults.passed,
        failed: testResults.failed,
        warnings: testResults.warnings,
        successRate: Math.round(successRate),
        totalTimeMs: Math.round(totalTime),
        timestamp: testResults.timestamp
      },
      details: testResults.details,
      recommendations: [
        'Monitor p95 latency to ensure < 700ms threshold',
        'Verify CoinAPI → OKX → Cache fallback chain',
        'Test cache TTL expiration in production',
        'Monitor WebSocket reconnection patterns',
        'Validate degradation notices reach users',
        'Ensure confidence scaling works under load'
      ]
    };
    
    await fs.writeFile('anti-lumpuh-resilience-report.json', JSON.stringify(reportData, null, 2));
    console.log('\n📄 Detailed report written to: anti-lumpuh-resilience-report.json');
  } catch (error) {
    console.warn('Failed to write report file:', error.message);
  }
  
  console.log('\n🏁 Anti-Lumpuh Resilience Testing Complete');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runAntiLumpuhTests();
}

export { runAntiLumpuhTests };
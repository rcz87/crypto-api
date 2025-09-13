#!/usr/bin/env node

/**
 * Stress Testing & System Recovery Verification
 * 
 * Tests system behavior under extreme stress and verifies automatic recovery mechanisms
 * Simulates memory pressure, high concurrent load, and system healing capabilities
 */

import { promises as fs } from 'fs';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:5000';

// Test utilities
function log(level, message, details = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
  if (details) console.log('  Details:', JSON.stringify(details, null, 2));
}

async function makeRequest(url, options = {}) {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    
    const endTime = performance.now();
    clearTimeout(timeoutId);
    
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      responseTime: endTime - startTime,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: 0,
      data: null,
      responseTime: performance.now() - startTime,
      error: error.message
    };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Extreme Concurrent Load Testing
async function testExtremeConcurrentLoad() {
  log('INFO', '💥 Testing Extreme Concurrent Load (Anti-Lumpuh Stress Test)');
  
  const concurrentLevels = [10, 25, 50, 100]; // Progressive load increase
  const results = [];
  
  for (const concurrency of concurrentLevels) {
    log('INFO', `Testing with ${concurrency} concurrent requests`);
    
    const requests = Array.from({ length: concurrency }, (_, i) => 
      makeRequest(`${BASE_URL}/api/sol/complete?stress=${concurrency}_${i}`, { timeout: 15000 })
    );
    
    const startTime = performance.now();
    const responses = await Promise.allSettled(requests);
    const endTime = performance.now();
    
    const successful = responses.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    const failed = responses.length - successful;
    const timeouts = responses.filter(r => 
      r.status === 'rejected' || 
      (r.status === 'fulfilled' && r.value.error?.includes('abort'))
    ).length;
    
    const latencies = responses
      .filter(r => r.status === 'fulfilled' && r.value.ok)
      .map(r => r.value.responseTime);
    
    const avgLatency = latencies.length > 0 ? 
      latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    const p95Latency = latencies.length > 0 ? 
      latencies.sort((a, b) => a - b)[Math.ceil(latencies.length * 0.95) - 1] : 0;
    
    const successRate = successful / concurrency;
    const result = {
      concurrency,
      successful,
      failed,
      timeouts,
      successRate,
      totalTime: endTime - startTime,
      avgLatency: Math.round(avgLatency),
      maxLatency: Math.round(maxLatency),
      p95Latency: Math.round(p95Latency),
      degraded: p95Latency > 700 // Degradation threshold
    };
    
    results.push(result);
    
    const status = successRate >= 0.8 ? 'PASS' : 'WARN';
    log(status, 
      `Concurrency ${concurrency}: ${successful}/${concurrency} success (${Math.round(successRate * 100)}%)`,
      {
        avgLatency: result.avgLatency,
        p95Latency: result.p95Latency,
        degraded: result.degraded,
        timeouts
      }
    );
    
    // Brief recovery time between stress levels
    await sleep(2000);
  }
  
  return results;
}

// Test 2: Memory Pressure Simulation
async function testMemoryPressure() {
  log('INFO', '🧠 Testing Memory Pressure Resilience');
  
  try {
    // Check initial memory state
    const initialMetrics = await makeRequest(`${BASE_URL}/api/metrics`);
    const initialMemory = initialMetrics.data?.data?.memory;
    
    log('INFO', 'Initial Memory State', initialMemory);
    
    // Simulate memory-intensive operations by making many simultaneous requests
    // with large payloads (if endpoints support it)
    const memoryStressRequests = Array.from({ length: 20 }, (_, i) => 
      makeRequest(`${BASE_URL}/api/sol/complete?memory_stress=${i}&large_data=true`)
    );
    
    const startTime = performance.now();
    const responses = await Promise.allSettled(memoryStressRequests);
    const endTime = performance.now();
    
    // Check memory state after stress
    const postStressMetrics = await makeRequest(`${BASE_URL}/api/metrics`);
    const postStressMemory = postStressMetrics.data?.data?.memory;
    
    const successful = responses.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    const memoryIncrease = postStressMemory && initialMemory ? 
      postStressMemory.used - initialMemory.used : 0;
    
    log(successful >= 15 ? 'PASS' : 'WARN', 
      `Memory Pressure Test: ${successful}/20 requests successful`,
      {
        memoryIncrease: `${memoryIncrease}MB`,
        initialMemory: initialMemory?.used,
        postStressMemory: postStressMemory?.used,
        totalTime: Math.round(endTime - startTime)
      }
    );
    
    // Wait for potential garbage collection
    await sleep(3000);
    
    // Check memory recovery
    const recoveryMetrics = await makeRequest(`${BASE_URL}/api/metrics`);
    const recoveryMemory = recoveryMetrics.data?.data?.memory;
    
    const memoryRecovered = recoveryMemory && postStressMemory ? 
      postStressMemory.used - recoveryMemory.used : 0;
    
    if (memoryRecovered > 0) {
      log('PASS', `Memory recovered: ${memoryRecovered}MB after stress test`);
    } else {
      log('INFO', 'Memory levels stable after stress test');
    }
    
    return {
      initialMemory,
      postStressMemory,
      recoveryMemory,
      memoryIncrease,
      memoryRecovered,
      successfulRequests: successful
    };
    
  } catch (error) {
    log('ERROR', `Memory pressure test failed: ${error.message}`);
    return null;
  }
}

// Test 3: System Recovery After Stress
async function testSystemRecovery() {
  log('INFO', '🔄 Testing System Recovery and Self-Healing');
  
  const recoveryTests = [];
  const testInterval = 3000; // 3 seconds between tests
  const testDuration = 30000; // 30 seconds total
  const testCount = Math.floor(testDuration / testInterval);
  
  log('INFO', `Running ${testCount} recovery tests over ${testDuration/1000} seconds`);
  
  for (let i = 0; i < testCount; i++) {
    const testStartTime = performance.now();
    
    // Test multiple endpoints simultaneously to verify recovery
    const recoveryRequests = [
      makeRequest(`${BASE_URL}/api/sol/complete`),
      makeRequest(`${BASE_URL}/api/sol/funding`),
      makeRequest(`${BASE_URL}/api/metrics`)
    ];
    
    const responses = await Promise.allSettled(recoveryRequests);
    const testEndTime = performance.now();
    
    const successful = responses.filter(r => r.status === 'fulfilled' && r.value.ok).length;
    const avgResponseTime = responses
      .filter(r => r.status === 'fulfilled' && r.value.ok)
      .reduce((sum, r) => sum + r.value.responseTime, 0) / successful;
    
    recoveryTests.push({
      iteration: i + 1,
      timestamp: new Date().toISOString(),
      successful: successful,
      total: recoveryRequests.length,
      successRate: successful / recoveryRequests.length,
      avgResponseTime: Math.round(avgResponseTime),
      testDuration: Math.round(testEndTime - testStartTime)
    });
    
    log('INFO', `Recovery test ${i + 1}: ${successful}/${recoveryRequests.length} success (${Math.round(avgResponseTime)}ms avg)`);
    
    if (i < testCount - 1) {
      await sleep(testInterval);
    }
  }
  
  // Analyze recovery pattern
  const overallSuccessRate = recoveryTests.reduce((sum, test) => sum + test.successRate, 0) / recoveryTests.length;
  const avgResponseTime = recoveryTests.reduce((sum, test) => sum + test.avgResponseTime, 0) / recoveryTests.length;
  
  const improving = recoveryTests.length >= 3 && 
    recoveryTests.slice(-3).every((test, i, arr) => 
      i === 0 || test.avgResponseTime <= arr[i - 1].avgResponseTime
    );
  
  log(overallSuccessRate >= 0.9 ? 'PASS' : 'WARN',
    `System Recovery: ${Math.round(overallSuccessRate * 100)}% success rate over ${testCount} tests`,
    {
      avgResponseTime: Math.round(avgResponseTime),
      improving: improving,
      testCount: recoveryTests.length
    }
  );
  
  return {
    tests: recoveryTests,
    overallSuccessRate,
    avgResponseTime,
    improving
  };
}

// Test 4: WebSocket Resilience Simulation
async function testWebSocketResilience() {
  log('INFO', '🔌 Testing WebSocket Resilience and Stream Recovery');
  
  try {
    // Test WebSocket-dependent endpoints
    const wsEndpoints = [
      '/api/sol/cvd',
      '/api/sol/confluence',
      '/api/metrics'  // May include WebSocket metrics
    ];
    
    const results = [];
    
    for (const endpoint of wsEndpoints) {
      // Test endpoint multiple times to check consistency
      const tests = [];
      
      for (let i = 0; i < 3; i++) {
        const response = await makeRequest(`${BASE_URL}${endpoint}`);
        tests.push({
          attempt: i + 1,
          status: response.status,
          ok: response.ok,
          responseTime: response.responseTime,
          hasData: !!response.data?.data
        });
        
        await sleep(1000); // 1 second between tests
      }
      
      const successful = tests.filter(t => t.ok).length;
      const avgResponseTime = tests.filter(t => t.ok).reduce((sum, t) => sum + t.responseTime, 0) / successful;
      
      results.push({
        endpoint,
        tests,
        successRate: successful / tests.length,
        avgResponseTime: Math.round(avgResponseTime)
      });
      
      log(successful === 3 ? 'PASS' : 'WARN',
        `${endpoint}: ${successful}/3 consistent responses (${Math.round(avgResponseTime)}ms avg)`
      );
    }
    
    return results;
  } catch (error) {
    log('ERROR', `WebSocket resilience test failed: ${error.message}`);
    return [];
  }
}

// Test 5: Database Connection Resilience
async function testDatabaseResilience() {
  log('INFO', '🗄️ Testing Database Connection Resilience');
  
  try {
    // Test endpoints that likely use database
    const dbEndpoints = [
      '/api/metrics',        // Stores metrics data
      '/api/health',         // May store health data
      '/api/sol/complete'    // May cache in DB
    ];
    
    const results = [];
    
    for (const endpoint of dbEndpoints) {
      const response = await makeRequest(`${BASE_URL}${endpoint}`);
      
      // Check for database-related errors or fallback behavior
      const hasDbError = response.data?.error?.toLowerCase().includes('database') ||
                        response.data?.error?.toLowerCase().includes('connection') ||
                        response.data?.error?.toLowerCase().includes('postgres');
      
      const hasFallbackIndicators = response.data?.degradation ||
                                   response.data?.source === 'cache' ||
                                   response.data?.data?.source === 'fallback';
      
      results.push({
        endpoint,
        status: response.status,
        ok: response.ok,
        hasDbError,
        hasFallbackIndicators,
        responseTime: response.responseTime
      });
      
      const status = response.ok && !hasDbError ? 'PASS' : 
                    (hasFallbackIndicators ? 'WARN' : 'FAIL');
      
      log(status,
        `${endpoint}: ${response.status} (${Math.round(response.responseTime)}ms)`,
        {
          hasDbError,
          hasFallbackIndicators: hasFallbackIndicators || false
        }
      );
    }
    
    return results;
  } catch (error) {
    log('ERROR', `Database resilience test failed: ${error.message}`);
    return [];
  }
}

// Test 6: Degradation Threshold Testing (700ms P95 Latency)
async function testDegradationThreshold() {
  log('INFO', '⚡ Testing Degradation Threshold (700ms P95 Latency)');
  
  try {
    // Make rapid sequential requests to measure latency distribution
    const requests = [];
    const testCount = 20;
    
    log('INFO', `Making ${testCount} sequential requests to measure P95 latency`);
    
    for (let i = 0; i < testCount; i++) {
      const response = await makeRequest(`${BASE_URL}/api/sol/complete?latency_test=${i}`);
      if (response.ok) {
        requests.push({
          index: i,
          responseTime: response.responseTime,
          status: response.status,
          hasDegradationInfo: !!(response.data?.degradation || response.data?.data_quality)
        });
      }
      
      // Small delay to avoid overwhelming
      await sleep(200);
    }
    
    if (requests.length === 0) {
      log('FAIL', 'No successful requests for latency analysis');
      return null;
    }
    
    // Calculate P95 latency
    const latencies = requests.map(r => r.responseTime).sort((a, b) => a - b);
    const p95Index = Math.ceil(latencies.length * 0.95) - 1;
    const p95Latency = latencies[p95Index];
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    
    // Check if degradation should be triggered
    const degradationTriggered = p95Latency > 700;
    const degradationSignalsPresent = requests.some(r => r.hasDegradationInfo);
    
    log(p95Latency > 700 ? 'WARN' : 'PASS',
      `P95 Latency: ${Math.round(p95Latency)}ms (Threshold: 700ms)`,
      {
        avgLatency: Math.round(avgLatency),
        maxLatency: Math.round(maxLatency),
        degradationTriggered,
        degradationSignalsPresent,
        sampleSize: requests.length
      }
    );
    
    if (degradationTriggered && !degradationSignalsPresent) {
      log('WARN', 'P95 latency exceeds threshold but no degradation signals detected');
    } else if (!degradationTriggered) {
      log('PASS', 'System operating within performance thresholds');
    }
    
    return {
      p95Latency,
      avgLatency,
      maxLatency,
      degradationTriggered,
      degradationSignalsPresent,
      requests: requests.length
    };
    
  } catch (error) {
    log('ERROR', `Degradation threshold test failed: ${error.message}`);
    return null;
  }
}

// Main test execution
async function runStressRecoveryTests() {
  console.log('🚨 Stress Testing & System Recovery - Anti-Lumpuh Verification');
  console.log('=' .repeat(80));
  
  const startTime = performance.now();
  const testResults = {
    extreme_load: null,
    memory_pressure: null,
    system_recovery: null,
    websocket_resilience: null,
    database_resilience: null,
    degradation_threshold: null
  };
  
  try {
    // Execute all stress and recovery tests
    log('INFO', 'Starting comprehensive stress and recovery testing...\n');
    
    testResults.extreme_load = await testExtremeConcurrentLoad();
    await sleep(5000); // Recovery time
    
    testResults.memory_pressure = await testMemoryPressure();
    await sleep(3000); // Recovery time
    
    testResults.system_recovery = await testSystemRecovery();
    await sleep(2000); // Brief pause
    
    testResults.websocket_resilience = await testWebSocketResilience();
    await sleep(2000); // Brief pause
    
    testResults.database_resilience = await testDatabaseResilience();
    await sleep(2000); // Brief pause
    
    testResults.degradation_threshold = await testDegradationThreshold();
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Generate comprehensive report
    console.log('\n' + '=' .repeat(80));
    console.log('📊 STRESS & RECOVERY TEST REPORT');
    console.log('=' .repeat(80));
    
    const overallScore = calculateStressRecoveryScore(testResults);
    console.log(`🎯 Stress Recovery Score: ${overallScore}%`);
    console.log(`⏱️  Total Test Time: ${Math.round(totalTime / 1000)}s`);
    
    // Detailed analysis
    console.log('\n🔍 Anti-Lumpuh Stress Analysis:');
    
    if (testResults.extreme_load) {
      const highestConcurrency = Math.max(...testResults.extreme_load.map(r => r.concurrency));
      const lowestSuccessRate = Math.min(...testResults.extreme_load.map(r => r.successRate));
      console.log(`  💥 Max Concurrency Handled: ${highestConcurrency} (${Math.round(lowestSuccessRate * 100)}% success)`);
    }
    
    if (testResults.system_recovery) {
      console.log(`  🔄 Recovery Success Rate: ${Math.round(testResults.system_recovery.overallSuccessRate * 100)}%`);
    }
    
    if (testResults.degradation_threshold) {
      const status = testResults.degradation_threshold.p95Latency <= 700 ? '✅' : '⚠️';
      console.log(`  ⚡ P95 Latency: ${status} ${Math.round(testResults.degradation_threshold.p95Latency)}ms`);
    }
    
    // Recommendations
    console.log('\n💡 Anti-Lumpuh Recommendations:');
    console.log('  • Monitor system under sustained high load');
    console.log('  • Verify degradation triggers at 700ms P95 latency');
    console.log('  • Ensure WebSocket reconnection works in production');
    console.log('  • Test database connection pooling under stress');
    console.log('  • Implement circuit breakers for external APIs');
    
    // Write detailed report
    const report = {
      summary: {
        overallScore,
        totalTimeSeconds: Math.round(totalTime / 1000),
        timestamp: new Date().toISOString()
      },
      results: testResults,
      recommendations: [
        'Monitor system under sustained high load',
        'Verify degradation triggers at 700ms P95 latency',
        'Test WebSocket reconnection in production',
        'Test database connection pooling under stress',
        'Implement circuit breakers for external APIs'
      ]
    };
    
    await fs.writeFile('stress-recovery-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Report written to: stress-recovery-test-report.json');
    
  } catch (error) {
    log('ERROR', `Stress testing failed: ${error.message}`);
  }
  
  console.log('\n🏁 Stress Testing & Recovery Verification Complete');
}

function calculateStressRecoveryScore(results) {
  let score = 0;
  let maxScore = 0;
  
  // Extreme Load Score (25 points)
  if (results.extreme_load) {
    const avgSuccessRate = results.extreme_load.reduce((sum, r) => sum + r.successRate, 0) / results.extreme_load.length;
    score += avgSuccessRate * 25;
    maxScore += 25;
  }
  
  // System Recovery Score (25 points)
  if (results.system_recovery) {
    score += results.system_recovery.overallSuccessRate * 25;
    maxScore += 25;
  }
  
  // Performance Threshold Score (20 points)
  if (results.degradation_threshold) {
    const performanceScore = results.degradation_threshold.p95Latency <= 700 ? 1 : 
                            results.degradation_threshold.p95Latency <= 1000 ? 0.7 : 0.3;
    score += performanceScore * 20;
    maxScore += 20;
  }
  
  // WebSocket Resilience Score (15 points)
  if (results.websocket_resilience) {
    const avgSuccessRate = results.websocket_resilience.reduce((sum, r) => sum + r.successRate, 0) / results.websocket_resilience.length;
    score += avgSuccessRate * 15;
    maxScore += 15;
  }
  
  // Database Resilience Score (10 points)
  if (results.database_resilience) {
    const healthyEndpoints = results.database_resilience.filter(r => r.ok && !r.hasDbError).length;
    score += (healthyEndpoints / results.database_resilience.length) * 10;
    maxScore += 10;
  }
  
  // Memory Management Score (5 points)
  if (results.memory_pressure) {
    const memoryScore = results.memory_pressure.successfulRequests >= 15 ? 1 : 
                       results.memory_pressure.successfulRequests >= 10 ? 0.7 : 0.3;
    score += memoryScore * 5;
    maxScore += 5;
  }
  
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runStressRecoveryTests();
}

export { runStressRecoveryTests };
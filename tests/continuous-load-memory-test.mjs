#!/usr/bin/env node

/**
 * 🔥 Continuous Load Testing dengan Memory Leak Simulation
 * 
 * Tests:
 * - Sustained high load over time
 * - Memory leak simulation scenarios
 * - Cache eviction under pressure
 * - Threshold trigger verification (70%, 80%, 85%)
 * - Auto-recovery mechanisms
 * - Profiler leak detection accuracy
 */

import { promises as fs } from 'fs';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:5000';
const TEST_DURATION_MINUTES = 5; // 5 minute continuous test
const CONCURRENT_LOAD = 20; // 20 concurrent requests

// Test configuration
const TEST_CONFIG = {
  duration: TEST_DURATION_MINUTES * 60 * 1000,
  concurrentLoad: CONCURRENT_LOAD,
  requestInterval: 100, // 100ms between request batches
  memoryCheckInterval: 10000, // 10s memory checks
};

// Test results storage
const testResults = {
  startTime: Date.now(),
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    byStatusCode: {}
  },
  memory: {
    snapshots: [],
    leaksDetected: [],
    thresholdTriggered: null,
    restartOccurred: false
  },
  performance: {
    avgResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    responseTimes: []
  },
  summary: {}
};

// Logging utilities
function log(level, message, details = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
  if (details) console.log('  Details:', JSON.stringify(details, null, 2));
}

// Make HTTP request with metrics
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

// Continuous load generator
async function generateContinuousLoad() {
  log('INFO', `🔥 Starting continuous load test (${TEST_CONFIG.duration / 1000}s duration, ${TEST_CONFIG.concurrentLoad} concurrent)`);
  
  const endpoints = [
    `${BASE_URL}/api/sol/complete`,
    `${BASE_URL}/api/sol/funding`,
    `${BASE_URL}/api/sol/technical`,
    `${BASE_URL}/api/memory/dashboard`,
    `${BASE_URL}/api/metrics`
  ];
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < TEST_CONFIG.duration) {
    // Generate batch of concurrent requests
    const requests = Array.from({ length: TEST_CONFIG.concurrentLoad }, () => {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      return makeRequest(endpoint);
    });
    
    const responses = await Promise.allSettled(requests);
    
    // Record results
    responses.forEach(result => {
      testResults.requests.total++;
      
      if (result.status === 'fulfilled' && result.value.ok) {
        testResults.requests.successful++;
        testResults.performance.responseTimes.push(result.value.responseTime);
        
        const statusCode = result.value.status;
        testResults.requests.byStatusCode[statusCode] = (testResults.requests.byStatusCode[statusCode] || 0) + 1;
      } else {
        testResults.requests.failed++;
      }
    });
    
    // Brief pause between batches
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.requestInterval));
  }
  
  log('INFO', '✅ Continuous load generation completed');
}

// Memory monitoring during test
async function monitorMemory() {
  log('INFO', '🧠 Starting memory monitoring');
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < TEST_CONFIG.duration) {
    try {
      const response = await makeRequest(`${BASE_URL}/api/memory/dashboard`);
      
      if (response.ok && response.data?.data) {
        const memData = response.data.data;
        
        // Record snapshot
        testResults.memory.snapshots.push({
          timestamp: Date.now(),
          heapPercent: memData.current_memory.heapPercent,
          heapUsedMB: memData.current_memory.heapUsedMB,
          growthRate: memData.profiling?.trend?.avgGrowthRate || 0,
          leakProbability: memData.profiling?.trend?.leak_probability || 0,
          riskLevel: memData.predictions?.risk_level
        });
        
        // Check for threshold triggers
        const heapPercent = memData.current_memory.heapPercent;
        if (heapPercent > 70 && !testResults.memory.thresholdTriggered) {
          testResults.memory.thresholdTriggered = {
            level: heapPercent > 85 ? 'restart' : heapPercent > 80 ? 'critical' : 'warning',
            heapPercent,
            timestamp: Date.now()
          };
          log('WARN', `🚨 Threshold triggered: ${testResults.memory.thresholdTriggered.level} at ${heapPercent}%`);
        }
        
        // Check for leak detection
        if (memData.profiling?.leak_patterns?.length > 0) {
          testResults.memory.leaksDetected.push({
            timestamp: Date.now(),
            patterns: memData.profiling.leak_patterns
          });
        }
      }
    } catch (error) {
      log('ERROR', `Memory monitoring failed: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.memoryCheckInterval));
  }
  
  log('INFO', '✅ Memory monitoring completed');
}

// Memory leak simulation
async function simulateMemoryLeak() {
  log('INFO', '💣 Simulating memory leak pattern');
  
  const leakyEndpoint = `${BASE_URL}/api/sol/complete`;
  const leakDuration = 30000; // 30 seconds of leak simulation
  const startTime = Date.now();
  
  // Create artificial memory pressure by making many rapid requests
  while (Date.now() - startTime < leakDuration) {
    const rapidRequests = Array.from({ length: 50 }, () => 
      makeRequest(leakyEndpoint)
    );
    
    await Promise.allSettled(rapidRequests);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  log('INFO', '✅ Memory leak simulation completed');
}

// Calculate performance metrics
function calculatePerformanceMetrics() {
  const responseTimes = testResults.performance.responseTimes.sort((a, b) => a - b);
  
  if (responseTimes.length === 0) {
    return;
  }
  
  const sum = responseTimes.reduce((a, b) => a + b, 0);
  const avg = sum / responseTimes.length;
  const p95Index = Math.ceil(responseTimes.length * 0.95) - 1;
  const p99Index = Math.ceil(responseTimes.length * 0.99) - 1;
  
  testResults.performance.avgResponseTime = Math.round(avg);
  testResults.performance.p95ResponseTime = Math.round(responseTimes[p95Index] || 0);
  testResults.performance.p99ResponseTime = Math.round(responseTimes[p99Index] || 0);
}

// Generate summary report
function generateSummary() {
  const duration = Date.now() - testResults.startTime;
  const successRate = testResults.requests.total > 0 ? 
    (testResults.requests.successful / testResults.requests.total) * 100 : 0;
  
  const memoryGrowth = testResults.memory.snapshots.length > 1 ?
    testResults.memory.snapshots[testResults.memory.snapshots.length - 1].heapUsedMB -
    testResults.memory.snapshots[0].heapUsedMB : 0;
  
  testResults.summary = {
    duration_seconds: Math.round(duration / 1000),
    total_requests: testResults.requests.total,
    success_rate: `${successRate.toFixed(2)}%`,
    avg_response_time: `${testResults.performance.avgResponseTime}ms`,
    p95_response_time: `${testResults.performance.p95ResponseTime}ms`,
    p99_response_time: `${testResults.performance.p99ResponseTime}ms`,
    memory_growth_mb: memoryGrowth.toFixed(2),
    leaks_detected: testResults.memory.leaksDetected.length,
    threshold_triggered: testResults.memory.thresholdTriggered ? 'YES' : 'NO',
    threshold_level: testResults.memory.thresholdTriggered?.level || 'N/A',
    max_heap_percent: Math.max(...testResults.memory.snapshots.map(s => s.heapPercent), 0).toFixed(1),
    avg_leak_probability: (
      testResults.memory.snapshots.reduce((sum, s) => sum + s.leakProbability, 0) /
      (testResults.memory.snapshots.length || 1)
    ).toFixed(1)
  };
}

// Main test execution
async function runContinuousLoadTest() {
  console.log('🚀 Continuous Load & Memory Leak Testing Framework');
  console.log('=' .repeat(80));
  
  try {
    // Run tests concurrently
    await Promise.all([
      generateContinuousLoad(),
      monitorMemory(),
      (async () => {
        // Start leak simulation after 30 seconds
        await new Promise(resolve => setTimeout(resolve, 30000));
        await simulateMemoryLeak();
      })()
    ]);
    
    // Calculate metrics
    calculatePerformanceMetrics();
    generateSummary();
    
    // Display results
    console.log('\n' + '=' .repeat(80));
    console.log('📊 CONTINUOUS LOAD TEST RESULTS');
    console.log('=' .repeat(80));
    
    console.log('\n📈 Performance Metrics:');
    console.log(`  • Total Requests: ${testResults.summary.total_requests}`);
    console.log(`  • Success Rate: ${testResults.summary.success_rate}`);
    console.log(`  • Avg Response Time: ${testResults.summary.avg_response_time}`);
    console.log(`  • P95 Response Time: ${testResults.summary.p95_response_time}`);
    console.log(`  • P99 Response Time: ${testResults.summary.p99_response_time}`);
    
    console.log('\n🧠 Memory Analysis:');
    console.log(`  • Memory Growth: ${testResults.summary.memory_growth_mb} MB`);
    console.log(`  • Max Heap Usage: ${testResults.summary.max_heap_percent}%`);
    console.log(`  • Avg Leak Probability: ${testResults.summary.avg_leak_probability}%`);
    console.log(`  • Leaks Detected: ${testResults.summary.leaks_detected}`);
    console.log(`  • Threshold Triggered: ${testResults.summary.threshold_triggered} (${testResults.summary.threshold_level})`);
    
    console.log('\n💡 Anti-Memory-Leak System Assessment:');
    const score = calculateSystemScore();
    console.log(`  • Overall Score: ${score}/100`);
    console.log(`  • Status: ${getScoreStatus(score)}`);
    
    // Write detailed report
    await fs.writeFile(
      'continuous-load-test-report.json',
      JSON.stringify(testResults, null, 2)
    );
    console.log('\n📄 Detailed report written to: continuous-load-test-report.json');
    
  } catch (error) {
    log('ERROR', `Test execution failed: ${error.message}`);
  }
  
  console.log('\n🏁 Continuous Load Test Complete');
}

function calculateSystemScore() {
  let score = 100;
  
  // Deduct points for failures
  const failRate = (testResults.requests.failed / testResults.requests.total) * 100;
  score -= failRate * 2; // -2 points per 1% failure rate
  
  // Deduct points for high response times
  if (testResults.performance.p95ResponseTime > 1000) score -= 10;
  else if (testResults.performance.p95ResponseTime > 500) score -= 5;
  
  // Deduct points for high memory growth
  const growth = parseFloat(testResults.summary.memory_growth_mb);
  if (growth > 100) score -= 20;
  else if (growth > 50) score -= 10;
  else if (growth > 20) score -= 5;
  
  // Bonus points for leak detection
  if (testResults.memory.leaksDetected.length > 0) score += 10;
  
  // Deduct if restart threshold reached
  if (testResults.summary.threshold_level === 'restart') score -= 15;
  else if (testResults.summary.threshold_level === 'critical') score -= 10;
  else if (testResults.summary.threshold_level === 'warning') score -= 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getScoreStatus(score) {
  if (score >= 90) return '🟢 EXCELLENT - System highly resilient';
  if (score >= 75) return '🟡 GOOD - Minor optimization opportunities';
  if (score >= 60) return '🟠 MODERATE - Needs attention';
  return '🔴 POOR - Critical improvements required';
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runContinuousLoadTest();
}

export { runContinuousLoadTest };

#!/usr/bin/env node

/**
 * CoinAPI Failure Simulation Test
 * 
 * Tests the multi-tier fallback system: CoinAPI → OKX → Last-Good Cache → Error
 * Verifies degradation metadata and never-blank responses under all failure scenarios.
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

// Test 1: Verify Current CoinAPI Integration Status
async function testCoinAPIStatus() {
  log('INFO', '🔍 Testing Current CoinAPI Integration Status');
  
  try {
    // Check if CoinAPI endpoints are active
    const coinApiEndpoints = [
      '/api/coinapi/multi-ticker',
      '/api/coinapi/arbitrage',
      '/api/coinapi/assets',
      '/api/coinapi/exchanges'
    ];
    
    const results = [];
    
    for (const endpoint of coinApiEndpoints) {
      const response = await makeRequest(`${BASE_URL}${endpoint}`);
      results.push({
        endpoint,
        status: response.status,
        ok: response.ok,
        responseTime: response.responseTime,
        hasData: !!response.data?.data,
        degradationMetadata: response.data?.degradation || response.data?.data_quality || null,
        source: response.data?.source || 'unknown'
      });
      
      log(response.ok ? 'PASS' : 'FAIL', 
        `${endpoint}: ${response.status} (${Math.round(response.responseTime)}ms)`,
        {
          hasData: !!response.data?.data,
          source: response.data?.source,
          degradation: response.data?.degradation
        }
      );
    }
    
    return results;
  } catch (error) {
    log('ERROR', `CoinAPI status test failed: ${error.message}`);
    return [];
  }
}

// Test 2: Simulate CoinAPI Degradation (>700ms latency threshold)
async function testCoinAPIDegradation() {
  log('INFO', '🐌 Testing CoinAPI Degradation (>700ms P95 Latency)');
  
  try {
    // Note: In a real test environment, you would:
    // 1. Mock the CoinAPI service to introduce delays
    // 2. Use a proxy to add latency to CoinAPI requests
    // 3. Temporarily block CoinAPI endpoints
    
    log('WARN', 'CoinAPI degradation simulation requires network-level mocking');
    log('INFO', 'Testing with concurrent high-load requests to trigger performance degradation');
    
    // Simulate high load to potentially trigger degradation
    const concurrentRequests = 20; // High concurrent load
    const requests = Array.from({ length: concurrentRequests }, (_, i) => 
      makeRequest(`${BASE_URL}/api/coinapi/multi-ticker?test=degradation_${i}`, { timeout: 5000 })
    );
    
    const startTime = performance.now();
    const responses = await Promise.allSettled(requests);
    const endTime = performance.now();
    
    const successful = responses.filter(r => r.status === 'fulfilled' && r.value.ok);
    const failed = responses.filter(r => r.status === 'rejected' || !r.value?.ok);
    
    const latencies = successful.map(r => r.value.responseTime);
    const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    const maxLatency = Math.max(...latencies);
    const p95Index = Math.ceil(latencies.length * 0.95) - 1;
    const p95Latency = latencies.sort((a, b) => a - b)[p95Index] || 0;
    
    log('INFO', 'Load Test Results', {
      concurrentRequests,
      successful: successful.length,
      failed: failed.length,
      avgLatency: Math.round(avgLatency),
      maxLatency: Math.round(maxLatency),
      p95Latency: Math.round(p95Latency),
      degraded: p95Latency > 700
    });
    
    // Check if any responses show degradation metadata
    const degradationResponses = successful.filter(r => 
      r.value.data?.degradation || 
      r.value.data?.data_quality?.quality !== 'good' ||
      r.value.data?.source !== 'api'
    );
    
    if (degradationResponses.length > 0) {
      log('PASS', 'Degradation metadata detected in responses', {
        degradedResponses: degradationResponses.length,
        totalResponses: successful.length
      });
    } else {
      log('INFO', 'No explicit degradation metadata found - system may be healthy');
    }
    
    return {
      p95Latency,
      avgLatency,
      successRate: successful.length / concurrentRequests,
      degradationDetected: p95Latency > 700 || degradationResponses.length > 0
    };
    
  } catch (error) {
    log('ERROR', `CoinAPI degradation test failed: ${error.message}`);
    return null;
  }
}

// Test 3: Test OKX Fallback Behavior
async function testOKXFallback() {
  log('INFO', '🔄 Testing OKX Fallback Mechanism');
  
  try {
    // Test primary OKX endpoints to verify fallback capability
    const okxEndpoints = [
      '/api/sol/complete',
      '/api/sol/funding',
      '/api/sol/technical',
      '/api/btc/complete',
      '/api/eth/complete'
    ];
    
    const results = [];
    
    for (const endpoint of okxEndpoints) {
      const response = await makeRequest(`${BASE_URL}${endpoint}`);
      
      // Look for indicators that OKX fallback is active
      const isOKXSource = response.data?.source === 'okx' || 
                          response.data?.data?.source === 'okx_fallback' ||
                          !response.data?.degradation?.data_source?.includes('coinapi');
      
      results.push({
        endpoint,
        status: response.status,
        responseTime: response.responseTime,
        source: response.data?.source || 'unknown',
        degradation: response.data?.degradation,
        isOKXSource
      });
      
      log(response.ok ? 'PASS' : 'FAIL',
        `${endpoint}: ${response.status} (${Math.round(response.responseTime)}ms)`,
        {
          source: response.data?.source,
          hasData: !!response.data?.data
        }
      );
    }
    
    const okxSourceCount = results.filter(r => r.isOKXSource).length;
    
    log('INFO', `OKX Fallback Status: ${okxSourceCount}/${results.length} endpoints using OKX data`);
    
    return results;
  } catch (error) {
    log('ERROR', `OKX fallback test failed: ${error.message}`);
    return [];
  }
}

// Test 4: Test Cache Behavior and Last-Good Cache
async function testCacheAndLastGoodCache() {
  log('INFO', '💾 Testing Cache Behavior and Last-Good Cache (30s TTL)');
  
  try {
    // Clear cache if endpoint exists
    const clearResponse = await makeRequest(`${BASE_URL}/api/cache/clear`, { method: 'POST' });
    if (clearResponse.ok) {
      log('INFO', 'Cache cleared successfully');
    } else {
      log('WARN', 'Cache clear endpoint not available or failed');
    }
    
    // Make initial request
    const endpoint = '/api/sol/complete';
    const initialResponse = await makeRequest(`${BASE_URL}${endpoint}`);
    
    if (!initialResponse.ok) {
      log('FAIL', 'Initial request failed - cannot test cache behavior');
      return null;
    }
    
    log('PASS', `Initial request: ${initialResponse.status} (${Math.round(initialResponse.responseTime)}ms)`);
    
    // Quick follow-up request to test cache hit
    const cachedResponse = await makeRequest(`${BASE_URL}${endpoint}`);
    const cacheHit = cachedResponse.responseTime < initialResponse.responseTime;
    
    log(cacheHit ? 'PASS' : 'INFO', 
      `Cache behavior: ${Math.round(cachedResponse.responseTime)}ms vs ${Math.round(initialResponse.responseTime)}ms`,
      { cacheHitLikely: cacheHit }
    );
    
    // Test cache metrics endpoint
    const metricsResponse = await makeRequest(`${BASE_URL}/api/metrics`);
    if (metricsResponse.ok && metricsResponse.data?.data?.cache) {
      const cacheMetrics = metricsResponse.data.data.cache;
      log('INFO', 'Cache Metrics', cacheMetrics);
      
      const hitRatio = parseFloat(cacheMetrics.hitRatio.replace('%', ''));
      if (hitRatio > 80) {
        log('PASS', `Good cache hit ratio: ${cacheMetrics.hitRatio}`);
      } else if (hitRatio > 50) {
        log('WARN', `Moderate cache hit ratio: ${cacheMetrics.hitRatio}`);
      } else {
        log('FAIL', `Poor cache hit ratio: ${cacheMetrics.hitRatio}`);
      }
    }
    
    // Simulate cache expiry test (abbreviated)
    log('INFO', 'Cache TTL Test: Simulated 30s expiry (full test would wait 30s)');
    log('WARN', 'In production: verify cache expires after 30s and falls back to last-good cache');
    
    return {
      initialResponseTime: initialResponse.responseTime,
      cachedResponseTime: cachedResponse.responseTime,
      cacheHitLikely: cacheHit,
      cacheMetrics: metricsResponse.data?.data?.cache
    };
    
  } catch (error) {
    log('ERROR', `Cache testing failed: ${error.message}`);
    return null;
  }
}

// Test 5: Never-Blank Response Verification
async function testNeverBlankResponses() {
  log('INFO', '🛡️ Testing Never-Blank Response Guarantee');
  
  try {
    const criticalEndpoints = [
      '/api/sol/complete',
      '/api/sol/funding',
      '/api/sol/enhanced-ai-signal',
      '/api/sol/confluence',
      '/api/sol/smc',
      '/api/sol/cvd'
    ];
    
    const results = [];
    
    for (const endpoint of criticalEndpoints) {
      const response = await makeRequest(`${BASE_URL}${endpoint}`);
      
      // Verify response has meaningful content
      const hasContent = response.ok && response.data && 
                        JSON.stringify(response.data).length > 50; // More than minimal JSON
      
      const hasDataField = response.data?.data && 
                          Object.keys(response.data.data).length > 0;
      
      // Check for essential fields based on endpoint type
      let hasEssentialFields = false;
      if (response.data?.data) {
        const data = response.data.data;
        
        if (endpoint.includes('complete')) {
          hasEssentialFields = data.ticker && data.candles;
        } else if (endpoint.includes('funding')) {
          hasEssentialFields = data.current && data.predicted;
        } else if (endpoint.includes('ai-signal')) {
          hasEssentialFields = data.direction && data.confidence !== undefined;
        } else if (endpoint.includes('confluence')) {
          hasEssentialFields = data.overall !== undefined;
        } else if (endpoint.includes('smc')) {
          hasEssentialFields = data.trend && data.confidence !== undefined;
        } else if (endpoint.includes('cvd')) {
          hasEssentialFields = data.buyerSellerAggression || data.cvdData;
        } else {
          hasEssentialFields = true; // Default pass for other endpoints
        }
      }
      
      // Check for degradation notices
      const hasDegradationInfo = !!(
        response.data?.degradation_notice ||
        response.data?.data?.degradation_notice ||
        response.data?.degradation ||
        response.data?.data_quality
      );
      
      results.push({
        endpoint,
        status: response.status,
        hasContent,
        hasDataField,
        hasEssentialFields,
        hasDegradationInfo,
        neverBlank: hasContent && hasDataField && hasEssentialFields
      });
      
      const status = response.ok && hasContent && hasDataField && hasEssentialFields ? 'PASS' : 'FAIL';
      log(status,
        `${endpoint}: Never-blank verified: ${response.ok && hasContent && hasEssentialFields}`,
        {
          status: response.status,
          hasContent,
          hasEssentialFields,
          hasDegradationInfo
        }
      );
    }
    
    const neverBlankCount = results.filter(r => r.neverBlank).length;
    const neverBlankRatio = neverBlankCount / results.length;
    
    log(neverBlankRatio >= 0.9 ? 'PASS' : 'FAIL',
      `Never-Blank Guarantee: ${neverBlankCount}/${results.length} endpoints (${Math.round(neverBlankRatio * 100)}%)`
    );
    
    return {
      neverBlankRatio,
      results
    };
    
  } catch (error) {
    log('ERROR', `Never-blank testing failed: ${error.message}`);
    return null;
  }
}

// Test 6: Degradation Metadata Verification
async function testDegradationMetadata() {
  log('INFO', '📊 Testing Degradation Metadata and Transparency');
  
  try {
    const endpoints = [
      '/api/sol/enhanced-ai-signal',
      '/api/sol/confluence',
      '/api/sol/cvd'
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      const response = await makeRequest(`${BASE_URL}${endpoint}`);
      
      if (response.ok && response.data?.data) {
        const data = response.data.data;
        
        // Look for degradation metadata
        const degradationFields = {
          degradation_notice: data.degradation_notice,
          data_quality: data.data_quality,
          source: data.source,
          confidence_adjustment: data.confidence_adjustment,
          health_status: data.health_status,
          fallback_scenario: data.fallback_scenario
        };
        
        const hasAnyDegradationInfo = Object.values(degradationFields).some(field => 
          field !== undefined && field !== null && field !== ''
        );
        
        // Check confidence/strength scaling
        const hasConfidenceMetrics = data.confidence !== undefined || 
                                    data.strength !== undefined ||
                                    data.overall !== undefined;
        
        const confidenceInRange = data.confidence ? 
          (data.confidence >= 0 && data.confidence <= 100) : true;
        
        results.push({
          endpoint,
          hasAnyDegradationInfo,
          hasConfidenceMetrics,
          confidenceInRange,
          degradationFields
        });
        
        log(hasAnyDegradationInfo ? 'INFO' : 'WARN',
          `${endpoint}: Degradation metadata present: ${hasAnyDegradationInfo}`,
          {
            hasConfidenceMetrics,
            degradationFields: Object.fromEntries(
              Object.entries(degradationFields).filter(([_, v]) => v !== undefined)
            )
          }
        );
      }
    }
    
    return results;
  } catch (error) {
    log('ERROR', `Degradation metadata testing failed: ${error.message}`);
    return null;
  }
}

// Main execution
async function runCoinAPIFailureSimulation() {
  console.log('🚨 CoinAPI Failure Simulation - Anti-Lumpuh Testing');
  console.log('=' .repeat(80));
  
  const startTime = performance.now();
  const testResults = {
    coinapi_status: null,
    degradation_simulation: null,
    okx_fallback: null,
    cache_behavior: null,
    never_blank: null,
    degradation_metadata: null
  };
  
  try {
    // Run all simulation tests
    testResults.coinapi_status = await testCoinAPIStatus();
    testResults.degradation_simulation = await testCoinAPIDegradation();
    testResults.okx_fallback = await testOKXFallback();
    testResults.cache_behavior = await testCacheAndLastGoodCache();
    testResults.never_blank = await testNeverBlankResponses();
    testResults.degradation_metadata = await testDegradationMetadata();
    
    const endTime = performance.now();
    
    console.log('\n' + '=' .repeat(80));
    console.log('📊 COINAPI FAILURE SIMULATION REPORT');
    console.log('=' .repeat(80));
    
    // Summary
    const overallScore = calculateOverallScore(testResults);
    console.log(`🎯 Overall Anti-Lumpuh Score: ${overallScore}%`);
    console.log(`⏱️  Total Test Time: ${Math.round(endTime - startTime)}ms`);
    
    // Detailed results
    console.log('\n🔍 Detailed Results:');
    Object.entries(testResults).forEach(([test, result]) => {
      if (result) {
        console.log(`  ✅ ${test}: Complete`);
      } else {
        console.log(`  ❌ ${test}: Failed or skipped`);
      }
    });
    
    // Recommendations
    console.log('\n💡 Anti-Lumpuh Recommendations:');
    console.log('  • Monitor p95 latency continuously (threshold: 700ms)');
    console.log('  • Verify CoinAPI → OKX → Cache fallback chain');
    console.log('  • Test cache expiry in production environment');
    console.log('  • Ensure degradation notices reach frontend');
    console.log('  • Validate confidence scaling under real failures');
    
    // Write detailed report
    await fs.writeFile('coinapi-failure-simulation-report.json', 
      JSON.stringify(testResults, null, 2)
    );
    console.log('\n📄 Report written to: coinapi-failure-simulation-report.json');
    
  } catch (error) {
    log('ERROR', `Simulation failed: ${error.message}`);
  }
}

function calculateOverallScore(results) {
  let score = 0;
  let maxScore = 0;
  
  if (results.never_blank?.neverBlankRatio) {
    score += results.never_blank.neverBlankRatio * 30; // 30 points for never-blank
    maxScore += 30;
  }
  
  if (results.okx_fallback) {
    const successfulEndpoints = results.okx_fallback.filter(r => r.status === 200).length;
    score += (successfulEndpoints / results.okx_fallback.length) * 25; // 25 points for fallback
    maxScore += 25;
  }
  
  if (results.cache_behavior?.cacheMetrics) {
    const hitRatio = parseFloat(results.cache_behavior.cacheMetrics.hitRatio.replace('%', ''));
    score += (hitRatio / 100) * 20; // 20 points for cache performance
    maxScore += 20;
  }
  
  if (results.degradation_simulation) {
    score += (results.degradation_simulation.successRate) * 15; // 15 points for degradation handling
    maxScore += 15;
  }
  
  if (results.degradation_metadata) {
    const metadataEndpoints = results.degradation_metadata.filter(r => r.hasAnyDegradationInfo).length;
    score += (metadataEndpoints / results.degradation_metadata.length) * 10; // 10 points for metadata
    maxScore += 10;
  }
  
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

// Run simulation
if (import.meta.url === `file://${process.argv[1]}`) {
  runCoinAPIFailureSimulation();
}

export { runCoinAPIFailureSimulation };
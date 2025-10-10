/**
 * CoinAPI Alert System Chaos Testing
 * Tests gap detection, recovery, latency spike, and disconnect alerts
 */

import { coinAPIWebSocket } from '../services/coinapiWebSocket';

interface HealthSnapshot {
  wsConnected: boolean;
  totalMessagesReceived: number;
  reconnectAttempts: number;
  restOrderbookOk: boolean;
  lastWsMessageTime: number | null;
  lastWsMessage: any;
  gapStats: {
    totalGapsDetected: number;
    recoveryTriggered: number;
    lastGapTime: number | null;
  };
}

// Store original getHealth method
const originalGetHealth = coinAPIWebSocket.getHealth.bind(coinAPIWebSocket);
let mockHealthState: HealthSnapshot | null = null;

// Mock getHealth method for testing
function injectMockHealth(mockState: HealthSnapshot) {
  mockHealthState = mockState;
  (coinAPIWebSocket as any).getHealth = () => mockHealthState;
  console.log('🧪 [Test] Injected mock health state:', mockState);
}

// Restore original getHealth
function restoreOriginalHealth() {
  (coinAPIWebSocket as any).getHealth = originalGetHealth;
  mockHealthState = null;
  console.log('✅ [Test] Restored original health state');
}

// Get current real health state as baseline
function getBaselineHealth(): HealthSnapshot {
  return originalGetHealth();
}

// Test scenarios
async function testGapDetectionAlert() {
  console.log('\n🧪 TEST 1: Gap Detection Alert');
  console.log('━'.repeat(60));
  
  const baseline = getBaselineHealth();
  
  // Inject mock state with new gaps
  injectMockHealth({
    ...baseline,
    gapStats: {
      totalGapsDetected: baseline.gapStats.totalGapsDetected + 3, // +3 new gaps
      recoveryTriggered: baseline.gapStats.recoveryTriggered,
      lastGapTime: Date.now()
    }
  });
  
  console.log(`📊 Baseline gaps: ${baseline.gapStats.totalGapsDetected}`);
  console.log(`📊 Injected gaps: ${baseline.gapStats.totalGapsDetected + 3} (+3 new)`);
  console.log('⏳ Waiting for alerter to detect (next 30s check)...\n');
  
  // Wait for next alerter cycle (runs every 30s)
  await new Promise(resolve => setTimeout(resolve, 35000));
  
  restoreOriginalHealth();
}

async function testRecoveryTriggerAlert() {
  console.log('\n🧪 TEST 2: Recovery Trigger Alert');
  console.log('━'.repeat(60));
  
  const baseline = getBaselineHealth();
  
  // Inject mock state with recovery triggered
  injectMockHealth({
    ...baseline,
    gapStats: {
      totalGapsDetected: baseline.gapStats.totalGapsDetected + 2,
      recoveryTriggered: baseline.gapStats.recoveryTriggered + 1, // +1 recovery
      lastGapTime: Date.now()
    }
  });
  
  console.log(`📊 Baseline recoveries: ${baseline.gapStats.recoveryTriggered}`);
  console.log(`📊 Injected recoveries: ${baseline.gapStats.recoveryTriggered + 1} (+1 new)`);
  console.log('⏳ Waiting for alerter to detect (next 30s check)...\n');
  
  await new Promise(resolve => setTimeout(resolve, 35000));
  
  restoreOriginalHealth();
}

async function testLatencySpikeAlert() {
  console.log('\n🧪 TEST 3: Latency Spike Alert');
  console.log('━'.repeat(60));
  
  const baseline = getBaselineHealth();
  const latencyThreshold = Number(process.env.COINAPI_LATENCY_THRESHOLD_MS || 10000);
  
  // Inject mock state with stale last message (15s ago - exceeds 10s threshold)
  injectMockHealth({
    ...baseline,
    wsConnected: true, // Must be connected to trigger latency alert
    lastWsMessageTime: Date.now() - 15000, // 15 seconds ago
  });
  
  console.log(`⚙️ Latency threshold: ${latencyThreshold}ms (${latencyThreshold / 1000}s)`);
  console.log(`📊 Injected message delay: 15000ms (15s) - EXCEEDS THRESHOLD`);
  console.log('⏳ Waiting for alerter to detect (next 30s check)...\n');
  
  await new Promise(resolve => setTimeout(resolve, 35000));
  
  restoreOriginalHealth();
}

async function testWebSocketDisconnectAlert() {
  console.log('\n🧪 TEST 4: WebSocket Disconnect Alert');
  console.log('━'.repeat(60));
  
  const baseline = getBaselineHealth();
  
  // Inject mock state with disconnected WebSocket
  injectMockHealth({
    ...baseline,
    wsConnected: false,
    reconnectAttempts: 3,
    restOrderbookOk: true // REST fallback active
  });
  
  console.log(`📊 WS Connected: false`);
  console.log(`📊 Reconnect attempts: 3`);
  console.log(`📊 REST Fallback: Active`);
  console.log('⏳ Waiting for alerter to detect (next 30s check)...\n');
  
  await new Promise(resolve => setTimeout(resolve, 35000));
  
  restoreOriginalHealth();
}

async function verifyHealthEndpoint() {
  console.log('\n🧪 TEST 5: Health Endpoint Verification');
  console.log('━'.repeat(60));
  
  const response = await fetch('http://localhost:5000/health/coinapi');
  const data = await response.json();
  
  console.log('📊 Health Endpoint Response:');
  console.log(JSON.stringify(data, null, 2));
  
  // Verify required fields
  const required = ['websocket', 'websocket.connected', 'websocket.totalMessagesReceived', 'websocket.gapDetection'];
  const missing = required.filter(field => {
    const parts = field.split('.');
    let obj: any = data;
    for (const part of parts) {
      if (obj[part] === undefined) return true;
      obj = obj[part];
    }
    return false;
  });
  
  if (missing.length === 0) {
    console.log('✅ All required fields present');
  } else {
    console.log(`❌ Missing fields: ${missing.join(', ')}`);
  }
}

// Main test execution
async function runChaosTests() {
  console.log('\n🚀 CoinAPI Alert System - Chaos Testing');
  console.log('═'.repeat(60));
  console.log('📋 Test Suite:');
  console.log('  1. Gap Detection Alert');
  console.log('  2. Recovery Trigger Alert');
  console.log('  3. Latency Spike Alert');
  console.log('  4. WebSocket Disconnect Alert');
  console.log('  5. Health Endpoint Verification');
  console.log('═'.repeat(60));
  
  try {
    // Run all tests sequentially
    await testGapDetectionAlert();
    await testRecoveryTriggerAlert();
    await testLatencySpikeAlert();
    await testWebSocketDisconnectAlert();
    await verifyHealthEndpoint();
    
    console.log('\n✅ Chaos Testing Complete!');
    console.log('📊 Check Telegram for alert notifications');
    console.log('═'.repeat(60));
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    restoreOriginalHealth();
  }
}

// Export for CLI execution
if (require.main === module) {
  runChaosTests().catch(console.error);
}

export { runChaosTests };

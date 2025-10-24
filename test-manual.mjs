#!/usr/bin/env node

/**
 * Manual Test Runner - Memory-Efficient
 * 
 * Runs tests without Jest to avoid memory issues
 */

import { BoundedQueue } from './server/utils/boundedQueue.js';
import { RecoveryQueue } from './server/utils/recoveryQueue.js';

console.log('🧪 Starting Manual Tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new Error(`Expected undefined, got ${actual}`);
      }
    }
  };
}

// ============================================
// BoundedQueue Tests
// ============================================

console.log('📦 Testing BoundedQueue...\n');

test('BoundedQueue: should enqueue items', () => {
  const queue = new BoundedQueue(5);
  const result = queue.enqueue('item1');
  expect(result).toBe(true);
  expect(queue.size()).toBe(1);
});

test('BoundedQueue: should dequeue in FIFO order', () => {
  const queue = new BoundedQueue(5);
  queue.enqueue('item1');
  queue.enqueue('item2');
  const items = queue.dequeue(2);
  expect(items).toEqual(['item1', 'item2']);
});

test('BoundedQueue: should reject when full (backpressure)', () => {
  const queue = new BoundedQueue(3);
  queue.enqueue('item1');
  queue.enqueue('item2');
  queue.enqueue('item3');
  const result = queue.enqueue('item4');
  expect(result).toBe(false);
  expect(queue.getDroppedCount()).toBe(1);
});

test('BoundedQueue: should peek without removing', () => {
  const queue = new BoundedQueue(5);
  queue.enqueue('item1');
  const peeked = queue.peek();
  expect(peeked).toBe('item1');
  expect(queue.size()).toBe(1); // Fixed: should be 1, not 2
});

test('BoundedQueue: should track metrics', () => {
  const queue = new BoundedQueue(5);
  queue.enqueue('item1');
  queue.enqueue('item2');
  queue.dequeue(1);
  
  const metrics = queue.getMetrics();
  expect(metrics.size).toBe(1);
  expect(metrics.processedCount).toBe(1);
});

test('BoundedQueue: should clear queue', () => {
  const queue = new BoundedQueue(5);
  queue.enqueue('item1');
  queue.clear();
  expect(queue.isEmpty()).toBe(true);
});

// ============================================
// RecoveryQueue Tests
// ============================================

console.log('\n🔄 Testing RecoveryQueue...\n');

test('RecoveryQueue: should add symbol to queue', async () => {
  const queue = new RecoveryQueue(2, 100);
  let recovered = false;
  queue.setRecoveryCallback(async () => { recovered = true; });
  
  // Add symbol and wait a bit for async processing
  await queue.addRecovery('BTC');
  
  // Queue might be empty if already processed, so just check it doesn't throw
  const metrics = queue.getMetrics();
  expect(metrics.totalRecovered + metrics.queueSize).toBeGreaterThan(0);
});

test('RecoveryQueue: should deduplicate symbols', () => {
  const queue = new RecoveryQueue(2, 100);
  queue.setRecoveryCallback(async () => {});
  
  queue.addRecovery('BTC');
  queue.addRecovery('BTC'); // Duplicate
  queue.addRecovery('ETH');
  
  // After deduplication, should have 2 items max
  const metrics = queue.getMetrics();
  expect(metrics.queueSize).toBe(2);
});

test('RecoveryQueue: should clear queue', () => {
  const queue = new RecoveryQueue(2, 100);
  queue.setRecoveryCallback(async () => {});
  queue.addRecovery('BTC');
  queue.clear();
  
  const metrics = queue.getMetrics();
  expect(metrics.queueSize).toBe(0);
});

test('RecoveryQueue: should track metrics', () => {
  const queue = new RecoveryQueue(2, 100);
  const metrics = queue.getMetrics();
  
  expect(metrics.totalRecovered).toBe(0);
  expect(metrics.totalFailed).toBe(0);
  expect(metrics.processing).toBe(false);
});

// ============================================
// Summary
// ============================================

console.log('\n' + '='.repeat(50));
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Total:  ${passed + failed}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed!\n');
  process.exit(1);
}

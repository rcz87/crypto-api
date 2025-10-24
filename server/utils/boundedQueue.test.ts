/**
 * Unit Tests for BoundedQueue
 * 
 * Tests:
 * 1. Basic enqueue/dequeue operations
 * 2. Backpressure when queue is full
 * 3. Batch processing
 * 4. Metrics tracking
 */

import { BoundedQueue } from './boundedQueue';

describe('BoundedQueue', () => {
  let queue: BoundedQueue<string>;
  
  beforeEach(() => {
    queue = new BoundedQueue<string>(5); // Small queue for testing
  });
  
  afterEach(() => {
    queue.clear();
  });
  
  describe('Basic Operations', () => {
    test('should enqueue items successfully', () => {
      const result = queue.enqueue('item1');
      
      expect(result).toBe(true);
      expect(queue.size()).toBe(1);
    });
    
    test('should dequeue items in FIFO order', () => {
      queue.enqueue('item1');
      queue.enqueue('item2');
      queue.enqueue('item3');
      
      const items = queue.dequeue(2);
      
      expect(items).toEqual(['item1', 'item2']);
      expect(queue.size()).toBe(1);
    });
    
    test('should peek at next item without removing', () => {
      queue.enqueue('item1');
      queue.enqueue('item2');
      
      const peeked = queue.peek();
      
      expect(peeked).toBe('item1');
      expect(queue.size()).toBe(2); // Size unchanged
    });
    
    test('should check if queue is empty', () => {
      expect(queue.isEmpty()).toBe(true);
      
      queue.enqueue('item1');
      expect(queue.isEmpty()).toBe(false);
    });
    
    test('should check if queue is full', () => {
      expect(queue.isFull()).toBe(false);
      
      // Fill queue to max (5 items)
      for (let i = 0; i < 5; i++) {
        queue.enqueue(`item${i}`);
      }
      
      expect(queue.isFull()).toBe(true);
    });
  });
  
  describe('Backpressure', () => {
    test('should reject items when queue is full', () => {
      // Fill queue to max (5 items)
      for (let i = 0; i < 5; i++) {
        const result = queue.enqueue(`item${i}`);
        expect(result).toBe(true);
      }
      
      // Try to add one more (should be rejected)
      const result = queue.enqueue('item6');
      
      expect(result).toBe(false);
      expect(queue.size()).toBe(5);
      expect(queue.getDroppedCount()).toBe(1);
    });
    
    test('should track dropped items count', () => {
      // Fill queue
      for (let i = 0; i < 5; i++) {
        queue.enqueue(`item${i}`);
      }
      
      // Try to add 3 more items (all should be dropped)
      queue.enqueue('item6');
      queue.enqueue('item7');
      queue.enqueue('item8');
      
      expect(queue.getDroppedCount()).toBe(3);
    });
  });
  
  describe('Batch Processing', () => {
    test('should dequeue in batches', () => {
      // Add 10 items
      for (let i = 0; i < 5; i++) {
        queue.enqueue(`item${i}`);
      }
      
      // Dequeue batch of 2
      const batch1 = queue.dequeue(2);
      expect(batch1).toEqual(['item0', 'item1']);
      expect(queue.size()).toBe(3);
      
      // Dequeue batch of 2 again
      const batch2 = queue.dequeue(2);
      expect(batch2).toEqual(['item2', 'item3']);
      expect(queue.size()).toBe(1);
    });
    
    test('should handle batch size larger than queue', () => {
      queue.enqueue('item1');
      queue.enqueue('item2');
      
      const batch = queue.dequeue(10); // Request 10, but only 2 available
      
      expect(batch).toEqual(['item1', 'item2']);
      expect(queue.isEmpty()).toBe(true);
    });
  });
  
  describe('Metrics', () => {
    test('should track processed count', () => {
      queue.enqueue('item1');
      queue.enqueue('item2');
      queue.enqueue('item3');
      
      queue.dequeue(2);
      
      expect(queue.getProcessedCount()).toBe(2);
      
      queue.dequeue(1);
      
      expect(queue.getProcessedCount()).toBe(3);
    });
    
    test('should provide comprehensive metrics', () => {
      // Add 3 items
      queue.enqueue('item1');
      queue.enqueue('item2');
      queue.enqueue('item3');
      
      // Process 1 item
      queue.dequeue(1);
      
      // Try to add when full (will be dropped)
      queue.enqueue('item4');
      queue.enqueue('item5');
      queue.enqueue('item6'); // This will be dropped
      
      const metrics = queue.getMetrics();
      
      expect(metrics.size).toBe(4); // 3 - 1 + 2
      expect(metrics.maxSize).toBe(5);
      expect(metrics.processedCount).toBe(1);
      expect(metrics.droppedCount).toBe(1);
      expect(metrics.utilizationPercent).toBe(80); // 4/5 * 100
    });
  });
  
  describe('Clear and Reset', () => {
    test('should clear all items', () => {
      queue.enqueue('item1');
      queue.enqueue('item2');
      queue.enqueue('item3');
      
      queue.clear();
      
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });
    
    test('should reset metrics', () => {
      queue.enqueue('item1');
      queue.dequeue(1);
      
      // Try to add when full to trigger drop
      for (let i = 0; i < 10; i++) {
        queue.enqueue(`item${i}`);
      }
      
      expect(queue.getDroppedCount()).toBeGreaterThan(0);
      expect(queue.getProcessedCount()).toBeGreaterThan(0);
      
      queue.resetMetrics();
      
      expect(queue.getDroppedCount()).toBe(0);
      expect(queue.getProcessedCount()).toBe(0);
    });
  });
  
  describe('Edge Cases', () => {
    test('should throw error for invalid max size', () => {
      expect(() => new BoundedQueue(0)).toThrow('maxSize must be positive');
      expect(() => new BoundedQueue(-1)).toThrow('maxSize must be positive');
    });
    
    test('should handle empty queue dequeue', () => {
      const items = queue.dequeue(5);
      
      expect(items).toEqual([]);
      expect(queue.isEmpty()).toBe(true);
    });
    
    test('should handle peek on empty queue', () => {
      const peeked = queue.peek();
      
      expect(peeked).toBeUndefined();
    });
  });
});

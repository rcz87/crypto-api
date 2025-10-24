/**
 * Unit Tests for RecoveryQueue
 * 
 * Tests:
 * 1. Queue management and deduplication
 * 2. Rate limiting (max 2 concurrent)
 * 3. Delay between batches
 * 4. Metrics tracking
 */

import { RecoveryQueue } from './recoveryQueue';

describe('RecoveryQueue', () => {
  let queue: RecoveryQueue;
  let mockRecoveryFn: jest.Mock;
  
  beforeEach(() => {
    queue = new RecoveryQueue(2, 100); // 2 concurrent, 100ms delay for fast tests
    mockRecoveryFn = jest.fn().mockResolvedValue(undefined);
    queue.setRecoveryCallback(mockRecoveryFn);
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    queue.clear();
    jest.useRealTimers();
  });
  
  describe('Basic Operations', () => {
    test('should add symbol to recovery queue', async () => {
      const promise = queue.addRecovery('BTC');
      
      const metrics = queue.getMetrics();
      expect(metrics.queueSize).toBe(1);
      expect(metrics.processing).toBe(true);
      
      // Fast-forward timers to complete processing
      await jest.runAllTimersAsync();
      await promise;
    });
    
    test('should deduplicate symbols', async () => {
      const promise1 = queue.addRecovery('BTC');
      const promise2 = queue.addRecovery('BTC'); // Duplicate
      const promise3 = queue.addRecovery('ETH');
      
      const metrics = queue.getMetrics();
      expect(metrics.queueSize).toBe(2); // Only BTC and ETH, no duplicate
      
      await jest.runAllTimersAsync();
      await Promise.all([promise1, promise2, promise3]);
    });
    
    test('should process queue automatically', async () => {
      const promise = queue.addRecovery('BTC');
      
      expect(mockRecoveryFn).not.toHaveBeenCalled();
      
      await jest.runAllTimersAsync();
      await promise;
      
      expect(mockRecoveryFn).toHaveBeenCalledWith('BTC');
      expect(mockRecoveryFn).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Rate Limiting', () => {
    test('should process max 2 symbols concurrently', async () => {
      // Add 5 symbols
      const promises = [
        queue.addRecovery('BTC'),
        queue.addRecovery('ETH'),
        queue.addRecovery('SOL'),
        queue.addRecovery('ADA'),
        queue.addRecovery('DOT')
      ];
      
      // Advance timers to start first batch
      await jest.advanceTimersByTimeAsync(0);
      
      // Should process first 2 symbols
      expect(mockRecoveryFn).toHaveBeenCalledTimes(2);
      expect(mockRecoveryFn).toHaveBeenCalledWith('BTC');
      expect(mockRecoveryFn).toHaveBeenCalledWith('ETH');
      
      // Advance to next batch (after 100ms delay)
      await jest.advanceTimersByTimeAsync(100);
      
      // Should process next 2 symbols
      expect(mockRecoveryFn).toHaveBeenCalledTimes(4);
      
      // Advance to final batch
      await jest.advanceTimersByTimeAsync(100);
      
      // Should process last symbol
      expect(mockRecoveryFn).toHaveBeenCalledTimes(5);
      
      await Promise.all(promises);
    });
    
    test('should wait between batches', async () => {
      const promise1 = queue.addRecovery('BTC');
      const promise2 = queue.addRecovery('ETH');
      const promise3 = queue.addRecovery('SOL');
      
      // Process first batch
      await jest.advanceTimersByTimeAsync(0);
      expect(mockRecoveryFn).toHaveBeenCalledTimes(2);
      
      // Should NOT process third symbol yet (waiting for delay)
      expect(mockRecoveryFn).not.toHaveBeenCalledWith('SOL');
      
      // Advance by delay time
      await jest.advanceTimersByTimeAsync(100);
      
      // Now third symbol should be processed
      expect(mockRecoveryFn).toHaveBeenCalledWith('SOL');
      
      await Promise.all([promise1, promise2, promise3]);
    });
  });
  
  describe('Error Handling', () => {
    test('should track failed recoveries', async () => {
      mockRecoveryFn.mockRejectedValueOnce(new Error('Recovery failed'));
      
      const promise = queue.addRecovery('BTC');
      
      await jest.runAllTimersAsync();
      await promise;
      
      const metrics = queue.getMetrics();
      expect(metrics.totalFailed).toBe(1);
      expect(metrics.totalRecovered).toBe(0);
    });
    
    test('should continue processing after failure', async () => {
      mockRecoveryFn
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce(undefined);
      
      const promise1 = queue.addRecovery('BTC');
      const promise2 = queue.addRecovery('ETH');
      
      await jest.runAllTimersAsync();
      await Promise.all([promise1, promise2]);
      
      const metrics = queue.getMetrics();
      expect(metrics.totalFailed).toBe(1);
      expect(metrics.totalRecovered).toBe(1);
    });
    
    test('should throw error if callback not set', async () => {
      const queueWithoutCallback = new RecoveryQueue();
      
      await expect(queueWithoutCallback.addRecovery('BTC')).rejects.toThrow('Recovery callback not set');
    });
  });
  
  describe('Metrics', () => {
    test('should track total recovered', async () => {
      const promise1 = queue.addRecovery('BTC');
      const promise2 = queue.addRecovery('ETH');
      
      await jest.runAllTimersAsync();
      await Promise.all([promise1, promise2]);
      
      const metrics = queue.getMetrics();
      expect(metrics.totalRecovered).toBe(2);
    });
    
    test('should track average recovery time', async () => {
      mockRecoveryFn.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 50))
      );
      
      const promise = queue.addRecovery('BTC');
      
      await jest.runAllTimersAsync();
      await promise;
      
      const metrics = queue.getMetrics();
      expect(metrics.averageRecoveryTimeMs).toBeGreaterThan(0);
    });
    
    test('should show processing status', async () => {
      const promise = queue.addRecovery('BTC');
      
      let metrics = queue.getMetrics();
      expect(metrics.processing).toBe(true);
      
      await jest.runAllTimersAsync();
      await promise;
      
      metrics = queue.getMetrics();
      expect(metrics.processing).toBe(false);
    });
  });
  
  describe('Clear and Reset', () => {
    test('should clear queue', async () => {
      queue.addRecovery('BTC');
      queue.addRecovery('ETH');
      
      queue.clear();
      
      const metrics = queue.getMetrics();
      expect(metrics.queueSize).toBe(0);
    });
    
    test('should reset metrics', async () => {
      const promise = queue.addRecovery('BTC');
      
      await jest.runAllTimersAsync();
      await promise;
      
      let metrics = queue.getMetrics();
      expect(metrics.totalRecovered).toBe(1);
      
      queue.resetMetrics();
      
      metrics = queue.getMetrics();
      expect(metrics.totalRecovered).toBe(0);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.averageRecoveryTimeMs).toBe(0);
    });
  });
});

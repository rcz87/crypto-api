import { describe, test, expect, beforeEach } from '@jest/globals';
import { CVDService } from '../../../server/services/cvd';

describe('CVD Analysis Performance Benchmarks', () => {
  let cvdService: CVDService;

  // Generate high-volume realistic test data for load testing
  const generateLargeDataSet = (size: number) => {
    const candles = Array(size).fill(null).map((_, i) => ({
      timestamp: (1756950000000 + i * 3600000).toString(), // Hourly candles
      open: (206.50 + Math.random() * 4 - 2).toFixed(2),
      high: (207.50 + Math.random() * 4 - 2).toFixed(2),
      low: (205.50 + Math.random() * 4 - 2).toFixed(2),
      close: (206.80 + Math.random() * 4 - 2).toFixed(2),
      volume: (15000 + Math.random() * 10000).toFixed(2)
    }));

    const trades = Array(size * 50).fill(null).map((_, i) => ({
      timestamp: (1756950000000 + i * 1000).toString(), // Every second
      price: (206.50 + Math.random() * 4 - 2).toFixed(2),
      size: (Math.random() * 100 + 1).toFixed(2),
      side: Math.random() > 0.5 ? 'buy' as const : 'sell' as const
    }));

    return { candles, trades };
  };

  beforeEach(() => {
    cvdService = new CVDService();
  });

  describe('Sub-200ms Latency Validation', () => {
    test('CVD calculation should complete under 200ms with 100 candles', async () => {
      const { candles, trades } = generateLargeDataSet(100);
      
      const startTime = performance.now();
      const result = cvdService.calculateVolumeDeltaBars(candles, trades, '1H');
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      
      console.log(`✅ CVD Analysis (100 candles): ${executionTime.toFixed(2)}ms`);
    });

    test('CVD calculation should complete under 200ms with 500 candles', async () => {
      const { candles, trades } = generateLargeDataSet(500);
      
      const startTime = performance.now();
      const result = cvdService.calculateVolumeDeltaBars(candles, trades, '1H');
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      
      console.log(`✅ CVD Analysis (500 candles): ${executionTime.toFixed(2)}ms`);
    });

    test('Divergence detection should complete under 200ms', async () => {
      const { candles } = generateLargeDataSet(200);
      
      // Generate CVD bars
      const cvdBars = Array(200).fill(null).map((_, i) => ({
        timestamp: (1756950000000 + i * 3600000).toString(),
        buyVolume: 8000 + Math.random() * 4000,
        sellVolume: 6000 + Math.random() * 4000,
        netVolume: (2000 + Math.random() * 2000 - 1000),
        cumulativeDelta: (i * 500).toString(),
        aggressionRatio: 0.4 + Math.random() * 0.2,
        pattern: null,
        volumeProfile: null,
        timeframe: '1H'
      }));
      
      const startTime = performance.now();
      const result = cvdService.detectDivergences(candles, cvdBars);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toBeDefined();
      expect(result.activeDivergences).toBeDefined();
      expect(result.recentDivergences).toBeDefined();
      
      console.log(`✅ Divergence Detection: ${executionTime.toFixed(2)}ms`);
    });

    test('Smart money signals should complete under 200ms with large dataset', async () => {
      // Generate large CVD history
      const cvdHistory = Array(500).fill(null).map((_, i) => ({
        timestamp: (1756950000000 + i * 3600000).toString(),
        buyVolume: 8000 + Math.random() * 4000,
        sellVolume: 6000 + Math.random() * 4000,
        netVolume: (2000 + Math.random() * 2000 - 1000),
        cumulativeDelta: (i * 500).toString(),
        aggressionRatio: 0.4 + Math.random() * 0.2,
        pattern: null,
        volumeProfile: null,
        timeframe: '1H'
      }));

      const absorptionPatterns = Array(10).fill(null).map((_, i) => ({
        timestamp: (1756950000000 + i * 7200000).toString(),
        type: Math.random() > 0.5 ? 'buy_absorption' as const : 'sell_absorption' as const,
        strength: 'strong' as const,
        volume: 15000 + Math.random() * 10000,
        priceLevel: '206.90',
        confidence: 80 + Math.random() * 15
      }));

      const flowAnalysis = {
        trend: 'accumulation' as const,
        strength: 'strong' as const,
        dominantSide: 'buy' as const,
        confidence: 85
      };

      const startTime = performance.now();
      const result = cvdService.detectSmartMoneySignals(cvdHistory, absorptionPatterns, flowAnalysis);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toBeDefined();
      expect(result.accumulation).toBeDefined();
      expect(result.distribution).toBeDefined();
      expect(result.manipulation).toBeDefined();
      
      console.log(`✅ Smart Money Signals: ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Validation', () => {
    test('CVD analysis should not leak memory with repeated calls', () => {
      const { candles, trades } = generateLargeDataSet(100);
      
      // Measure initial memory
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run multiple iterations
      for (let i = 0; i < 10; i++) {
        cvdService.calculateVolumeDeltaBars(candles, trades, '1H');
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024); // MB
      
      // Memory growth should be minimal (< 10MB for 10 iterations)
      expect(memoryGrowth).toBeLessThan(10);
      
      console.log(`✅ Memory Growth: ${memoryGrowth.toFixed(2)}MB after 10 iterations`);
    });
  });

  describe('Concurrent Performance', () => {
    test('CVD analysis should handle concurrent requests under 200ms', async () => {
      const { candles, trades } = generateLargeDataSet(100);
      
      const startTime = performance.now();
      
      // Simulate 5 concurrent requests
      const promises = Array(5).fill(null).map(() => 
        Promise.resolve(cvdService.calculateVolumeDeltaBars(candles, trades, '1H'))
      );
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });
      
      console.log(`✅ Concurrent CVD Analysis (5 requests): ${executionTime.toFixed(2)}ms`);
    });
  });
});
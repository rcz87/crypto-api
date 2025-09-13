import { describe, test, expect, beforeEach } from '@jest/globals';
import { OrderFlowService } from '../../../server/services/orderFlow';

describe('Order Flow Analysis Performance Benchmarks', () => {
  let orderFlowService: OrderFlowService;

  // Generate high-volume test data for load testing
  const generateLargeTradeSet = (size: number) => {
    return Array(size).fill(null).map((_, i) => ({
      px: (206.50 + Math.random() * 4 - 2).toString(),
      sz: (Math.random() * 200 + 1).toString(),
      side: Math.random() > 0.5 ? 'buy' as const : 'sell' as const,
      ts: (1756950000000 + i * 1000).toString(),
      tradeId: (1000 + i).toString(),
      count: Math.floor(Math.random() * 5 + 1).toString()
    }));
  };

  const generateClassifiedTrades = (size: number) => {
    return Array(size).fill(null).map((_, i) => {
      const size_val = Math.random() * 200 + 1;
      const price = 206.50 + Math.random() * 4 - 2;
      return {
        id: `trade_${i}`,
        timestamp: (1756950000000 + i * 1000).toString(),
        price,
        size: size_val,
        side: Math.random() > 0.5 ? 'buy' as const : 'sell' as const,
        isAggressive: Math.random() > 0.6,
        isLarge: size_val > 50,
        value: price * size_val,
        type: size_val > 200 ? 'whale' as const : 
              size_val > 100 ? 'institutional' as const :
              size_val > 50 ? 'market_taker' as const : 'retail' as const,
        confidence: 70 + Math.random() * 25
      };
    });
  };

  beforeEach(() => {
    orderFlowService = new OrderFlowService();
  });

  describe('Target-200ms Latency Validation', () => {
    test('Trade classification should complete under 200ms with 1000 trades', () => {
      const trades = generateLargeTradeSet(1000);
      
      const startTime = performance.now();
      const result = orderFlowService.classifyTrades(trades);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toHaveLength(1000);
      expect(result[0]).toHaveProperty('type');
      expect(result[0]).toHaveProperty('confidence');
      
      console.log(`✅ Trade Classification (1000 trades): ${executionTime.toFixed(2)}ms`);
    });

    test('Trade classification should complete under 200ms with 5000 trades', () => {
      const trades = generateLargeTradeSet(5000);
      
      const startTime = performance.now();
      const result = orderFlowService.classifyTrades(trades);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toHaveLength(5000);
      
      console.log(`✅ Trade Classification (5000 trades): ${executionTime.toFixed(2)}ms`);
    });

    test('Flow type analysis should complete under 200ms', () => {
      const trades = generateClassifiedTrades(1000);
      
      const startTime = performance.now();
      const result = orderFlowService.analyzeFlowTypes(trades);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toBeDefined();
      expect(result.dominantFlow).toBeDefined();
      expect(result.makerTakerRatio).toBeDefined();
      
      console.log(`✅ Flow Type Analysis: ${executionTime.toFixed(2)}ms`);
    });

    test('Tape reading should complete under 200ms with large dataset', () => {
      const trades = generateClassifiedTrades(2000);
      
      const startTime = performance.now();
      const result = orderFlowService.performTapeReading(trades);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toBeDefined();
      expect(result.momentum).toBeDefined();
      expect(result.velocity).toBeDefined();
      expect(result.consistency).toBeDefined();
      expect(result.predictionConfidence).toBeGreaterThanOrEqual(0);
      
      console.log(`✅ Tape Reading Analysis: ${executionTime.toFixed(2)}ms`);
    });

    test('Volume profile analysis should complete under 200ms', () => {
      const trades = generateClassifiedTrades(1500);
      
      const startTime = performance.now();
      const result = orderFlowService.analyzeAdvancedVolumeProfile(trades, '206.90');
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toBeDefined();
      expect(result.vpoc).toBeGreaterThan(0);
      expect(result.volumeProfile).toBeDefined();
      expect(result.highVolumeNodes).toBeDefined();
      
      console.log(`✅ Volume Profile Analysis: ${executionTime.toFixed(2)}ms`);
    });

    test('Whale detection should complete under 200ms', () => {
      const trades = generateClassifiedTrades(1000);
      
      const startTime = performance.now();
      const result = orderFlowService.detectWhaleActivity(trades);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(result).toBeDefined();
      expect(result.direction).toBeDefined();
      expect(result.strength).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      
      console.log(`✅ Whale Detection Analysis: ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Throughput Validation', () => {
    test('Order flow should process 10,000 trades per second', () => {
      const trades = generateLargeTradeSet(10000);
      
      const startTime = performance.now();
      const result = orderFlowService.classifyTrades(trades);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      const throughput = 10000 / (executionTime / 1000); // trades per second
      
      expect(throughput).toBeGreaterThan(10000);
      expect(result).toHaveLength(10000);
      
      console.log(`✅ Throughput: ${throughput.toFixed(0)} trades/second`);
    });
  });

  describe('Memory Efficiency', () => {
    test('Order flow analysis should not leak memory', () => {
      const trades = generateLargeTradeSet(1000);
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run multiple iterations
      for (let i = 0; i < 20; i++) {
        orderFlowService.classifyTrades(trades);
        orderFlowService.analyzeFlowTypes(generateClassifiedTrades(100));
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024);
      
      expect(memoryGrowth).toBeLessThan(15);
      
      console.log(`✅ Memory Growth: ${memoryGrowth.toFixed(2)}MB after 20 iterations`);
    });
  });

  describe('Stress Testing', () => {
    test('Order flow should handle burst traffic under 200ms', async () => {
      const trades = generateLargeTradeSet(500);
      
      const startTime = performance.now();
      
      // Simulate 10 concurrent burst requests
      const promises = Array(10).fill(null).map(() => 
        Promise.resolve(orderFlowService.classifyTrades(trades))
      );
      
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveLength(500);
      });
      
      console.log(`✅ Burst Traffic (10 concurrent): ${executionTime.toFixed(2)}ms`);
    });

    test('Complex analysis pipeline should complete under 200ms', () => {
      const rawTrades = generateLargeTradeSet(800);
      
      const startTime = performance.now();
      
      // Full pipeline: classify → analyze flows → tape reading → whale detection
      const classified = orderFlowService.classifyTrades(rawTrades);
      const flows = orderFlowService.analyzeFlowTypes(classified);
      const tapeReading = orderFlowService.performTapeReading(classified);
      const whales = orderFlowService.detectWhaleActivity(classified);
      
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(executionTime).toBeLessThan(200);
      expect(classified).toBeDefined();
      expect(flows).toBeDefined();
      expect(tapeReading).toBeDefined();
      expect(whales).toBeDefined();
      
      console.log(`✅ Full Analysis Pipeline: ${executionTime.toFixed(2)}ms`);
    });
  });
});
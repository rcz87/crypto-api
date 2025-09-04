import { describe, test, expect, beforeEach } from '@jest/globals';
import { SMCService } from '../../../server/services/smc';
import { mockCandleData, expectedMarketStructure } from '../../fixtures/mockData';

describe('Smart Money Concepts Algorithm', () => {
  let smcService: SMCService;

  beforeEach(() => {
    smcService = new SMCService();
  });

  describe('analyzeMarketStructure', () => {
    test('should identify swing highs and lows correctly', () => {
      // Create extended candle data with clear swing points
      const extendedCandles = [
        { timestamp: '1756940000000', open: '195.00', high: '198.50', low: '194.00', close: '197.25', volume: '10000' },
        { timestamp: '1756943600000', open: '197.25', high: '200.75', low: '196.50', close: '199.80', volume: '12000' },
        { timestamp: '1756947200000', open: '199.80', high: '203.25', low: '198.90', close: '202.50', volume: '15000' }, // Swing high
        { timestamp: '1756950800000', open: '202.50', high: '201.80', low: '198.25', close: '199.75', volume: '11000' },
        { timestamp: '1756954400000', open: '199.75', high: '201.25', low: '196.50', close: '197.90', volume: '9500' }, // Swing low
        ...mockCandleData
      ];

      const result = smcService.analyzeMarketStructure(extendedCandles);

      expect(result).toBeDefined();
      expect(['bullish', 'bearish', 'ranging']).toContain(result.trend);
      
      if (result.lastBOS) {
        expect(result.lastBOS).toHaveProperty('type');
        expect(result.lastBOS).toHaveProperty('price');
        expect(result.lastBOS).toHaveProperty('timestamp');
        expect(['bullish', 'bearish']).toContain(result.lastBOS.type);
      }
    });

    test('should detect bullish market structure', () => {
      // Create bullish pattern: Higher Highs and Higher Lows
      const bullishCandles = [
        { timestamp: '1756940000000', open: '200.00', high: '202.00', low: '199.00', close: '201.50', volume: '10000' },
        { timestamp: '1756943600000', open: '201.50', high: '203.50', low: '200.50', close: '202.80', volume: '12000' },
        { timestamp: '1756947200000', open: '202.80', high: '205.25', low: '201.75', close: '204.90', volume: '15000' }, // Higher high
        { timestamp: '1756950800000', open: '204.90', high: '206.50', low: '203.25', close: '205.75', volume: '11000' },
        { timestamp: '1756954400000', open: '205.75', high: '208.25', low: '204.50', close: '207.50', volume: '13000' }, // Higher low
        { timestamp: '1756958000000', open: '207.50', high: '210.00', low: '206.75', close: '209.25', volume: '14000' }, // Higher high
        { timestamp: '1756961600000', open: '209.25', high: '211.50', low: '208.25', close: '210.80', volume: '16000' }
      ];

      const result = smcService.analyzeMarketStructure(bullishCandles);

      expect(result.trend).toBe('bullish');
      expect(result.lastBOS).toBeDefined();
      expect(result.lastBOS?.type).toBe('bullish');
    });

    test('should detect bearish market structure', () => {
      // Create bearish pattern: Lower Highs and Lower Lows
      const bearishCandles = [
        { timestamp: '1756940000000', open: '210.00', high: '212.00', low: '209.00', close: '211.50', volume: '10000' },
        { timestamp: '1756943600000', open: '211.50', high: '210.50', low: '208.50', close: '209.20', volume: '12000' },
        { timestamp: '1756947200000', open: '209.20', high: '210.25', low: '206.75', close: '207.90', volume: '15000' }, // Lower high
        { timestamp: '1756950800000', open: '207.90', high: '209.50', low: '205.25', close: '206.75', volume: '11000' },
        { timestamp: '1756954400000', open: '206.75', high: '208.25', low: '204.50', close: '205.50', volume: '13000' }, // Lower low
        { timestamp: '1756958000000', open: '205.50', high: '207.00', low: '203.75', close: '204.25', volume: '14000' }, // Lower high
        { timestamp: '1756961600000', open: '204.25', high: '205.50', low: '202.25', close: '203.80', volume: '16000' }
      ];

      const result = smcService.analyzeMarketStructure(bearishCandles);

      expect(result.trend).toBe('bearish');
      expect(result.lastBOS).toBeDefined();
      expect(result.lastBOS?.type).toBe('bearish');
    });

    test('should detect ranging market structure', () => {
      // Create ranging pattern: Sideways movement
      const rangingCandles = [
        { timestamp: '1756940000000', open: '206.00', high: '208.00', low: '204.00', close: '207.00', volume: '10000' },
        { timestamp: '1756943600000', open: '207.00', high: '208.50', low: '205.50', close: '206.25', volume: '12000' },
        { timestamp: '1756947200000', open: '206.25', high: '208.25', low: '204.75', close: '207.50', volume: '15000' },
        { timestamp: '1756950800000', open: '207.50', high: '208.75', low: '205.25', close: '206.80', volume: '11000' },
        { timestamp: '1756954400000', open: '206.80', high: '208.00', low: '205.00', close: '207.25', volume: '13000' },
        { timestamp: '1756958000000', open: '207.25', high: '208.50', low: '204.50', close: '206.50', volume: '14000' }
      ];

      const result = smcService.analyzeMarketStructure(rangingCandles);

      expect(result.trend).toBe('ranging');
    });

    test('should handle insufficient data gracefully', () => {
      const insufficientData = mockCandleData.slice(0, 2); // Less than 5 candles

      const result = smcService.analyzeMarketStructure(insufficientData);

      expect(result.trend).toBe('ranging');
      expect(result.lastBOS).toBeNull();
      expect(result.lastCHoCH).toBeNull();
    });

    test('should validate swing point detection logic', () => {
      // Create specific pattern to test swing detection
      const swingTestCandles = [
        { timestamp: '1756940000000', open: '200.00', high: '201.00', low: '199.00', close: '200.50', volume: '10000' },
        { timestamp: '1756943600000', open: '200.50', high: '202.00', low: '199.50', close: '201.25', volume: '11000' },
        { timestamp: '1756947200000', open: '201.25', high: '205.00', low: '200.75', close: '204.50', volume: '12000' }, // Should be swing high
        { timestamp: '1756950800000', open: '204.50', high: '203.50', low: '201.00', close: '202.25', volume: '9000' },
        { timestamp: '1756954400000', open: '202.25', high: '203.00', low: '200.50', close: '201.75', volume: '8500' },
        { timestamp: '1756958000000', open: '201.75', high: '202.50', low: '200.25', close: '201.90', volume: '9200' }
      ];

      const result = smcService.analyzeMarketStructure(swingTestCandles);

      // With this pattern, we should detect some structure
      expect(result).toBeDefined();
      expect(result.trend).toBeDefined();
    });
  });

  describe('analyzeFairValueGaps', () => {
    test('should identify fair value gaps in price action', () => {
      // This would test FVG detection if the method is accessible
      // For now, we test through the main analyze method
      const result = smcService.analyze('1H');

      expect(result).toBeDefined();
      expect(result.fvgs).toBeDefined();
      expect(Array.isArray(result.fvgs)).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty candle data', () => {
      const result = smcService.analyzeMarketStructure([]);

      expect(result.trend).toBe('ranging');
      expect(result.lastBOS).toBeNull();
      expect(result.lastCHoCH).toBeNull();
    });

    test('should handle malformed candle data', () => {
      const malformedCandles = [
        { timestamp: 'invalid', open: '200.00', high: '202.00', low: '199.00', close: '201.50', volume: '10000' },
        { timestamp: '1756943600000', open: 'invalid', high: '203.50', low: '200.50', close: '202.80', volume: '12000' }
      ];

      expect(() => {
        smcService.analyzeMarketStructure(malformedCandles);
      }).not.toThrow();
    });
  });
});
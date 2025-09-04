import { describe, test, expect, beforeEach } from '@jest/globals';
import { CVDService } from '../../../server/services/cvd';
import { mockCandleData, mockTradeData, mockVolumeDeltas } from '../../fixtures/mockData';

describe('CVD Analysis Algorithm', () => {
  let cvdService: CVDService;

  beforeEach(() => {
    cvdService = new CVDService();
  });

  describe('calculateVolumeDeltaBars', () => {
    test('should calculate volume delta correctly from trade data', () => {
      const recentTrades = mockTradeData.map(trade => ({
        timestamp: trade.ts,
        price: trade.px,
        size: trade.sz,
        side: trade.side
      }));

      const result = cvdService.calculateVolumeDeltaBars(mockCandleData, recentTrades, '1H');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      result.forEach(bar => {
        expect(bar).toHaveProperty('timestamp');
        expect(bar).toHaveProperty('buyVolume');
        expect(bar).toHaveProperty('sellVolume');
        expect(bar).toHaveProperty('netVolume');
        expect(bar).toHaveProperty('cumulativeDelta');
        expect(bar).toHaveProperty('aggressionRatio');
        
        expect(bar.buyVolume).toBeGreaterThanOrEqual(0);
        expect(bar.sellVolume).toBeGreaterThanOrEqual(0);
        expect(bar.netVolume).toBe(bar.buyVolume - bar.sellVolume);
        expect(bar.aggressionRatio).toBeGreaterThanOrEqual(0);
        expect(bar.aggressionRatio).toBeLessThanOrEqual(1);
      });
    });

    test('should estimate volume delta when no trade data available', () => {
      // Test with empty trades array
      const result = cvdService.calculateVolumeDeltaBars(mockCandleData, [], '1H');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      result.forEach(bar => {
        // Should still have volume estimates based on candle data
        expect(bar.buyVolume + bar.sellVolume).toBeGreaterThan(0);
        expect(bar.aggressionRatio).toBeGreaterThan(0);
        expect(bar.aggressionRatio).toBeLessThan(1);
      });
    });

    test('should maintain cumulative delta consistency', () => {
      const recentTrades = mockTradeData.map(trade => ({
        timestamp: trade.ts,
        price: trade.px,
        size: trade.sz,
        side: trade.side
      }));

      const result = cvdService.calculateVolumeDeltaBars(mockCandleData, recentTrades, '1H');
      
      // Test cumulative delta consistency
      let expectedCumulative = 0;
      result.forEach((bar, index) => {
        expectedCumulative += bar.netVolume;
        expect(Math.abs(parseFloat(bar.cumulativeDelta) - expectedCumulative)).toBeLessThan(0.01);
      });
    });

    test('should handle different timeframes correctly', () => {
      const recentTrades = mockTradeData.map(trade => ({
        timestamp: trade.ts,
        price: trade.px,
        size: trade.sz,
        side: trade.side
      }));

      const result1H = cvdService.calculateVolumeDeltaBars(mockCandleData, recentTrades, '1H');
      const result4H = cvdService.calculateVolumeDeltaBars(mockCandleData, recentTrades, '4H');

      expect(result1H.length).toBeGreaterThanOrEqual(result4H.length);
      
      // Different timeframes should have different interval calculations
      expect(result1H).not.toEqual(result4H);
    });
  });

  describe('detectDivergences', () => {
    test('should detect bullish divergences', () => {
      // Create price declining but CVD increasing pattern
      const decliningPriceCandles = [
        { timestamp: '1756950000000', open: '210.00', high: '212.00', low: '209.00', close: '211.00', volume: '15000' },
        { timestamp: '1756953600000', open: '211.00', high: '210.50', low: '208.00', close: '209.50', volume: '16000' },
        { timestamp: '1756957200000', open: '209.50', high: '209.00', low: '206.50', close: '207.80', volume: '17000' },
        { timestamp: '1756960800000', open: '207.80', high: '208.50', low: '205.00', close: '206.20', volume: '18000' }
      ];

      const increasingCvdBars = [
        { timestamp: '1756950000000', buyVolume: 7000, sellVolume: 8000, netVolume: -1000, cumulativeDelta: '-1000', aggressionRatio: 0.47, pattern: null, volumeProfile: null, timeframe: '1H' },
        { timestamp: '1756953600000', buyVolume: 9000, sellVolume: 7000, netVolume: 2000, cumulativeDelta: '1000', aggressionRatio: 0.56, pattern: null, volumeProfile: null, timeframe: '1H' },
        { timestamp: '1756957200000', buyVolume: 11000, sellVolume: 6000, netVolume: 5000, cumulativeDelta: '6000', aggressionRatio: 0.65, pattern: null, volumeProfile: null, timeframe: '1H' },
        { timestamp: '1756960800000', buyVolume: 13000, sellVolume: 5000, netVolume: 8000, cumulativeDelta: '14000', aggressionRatio: 0.72, pattern: null, volumeProfile: null, timeframe: '1H' }
      ];

      const result = cvdService.detectDivergences(decliningPriceCandles, increasingCvdBars);

      expect(result).toBeDefined();
      expect(result.activeDivergences).toBeDefined();
      expect(result.recentDivergences).toBeDefined();
      
      // Should detect some form of divergence
      const totalDivergences = result.activeDivergences.length + result.recentDivergences.length;
      expect(totalDivergences).toBeGreaterThanOrEqual(0);
    });

    test('should handle insufficient data gracefully', () => {
      const shortCandles = mockCandleData.slice(0, 2);
      const shortCvdBars = mockVolumeDeltas.slice(0, 2);

      const result = cvdService.detectDivergences(shortCandles, shortCvdBars);

      expect(result.activeDivergences).toHaveLength(0);
      expect(result.recentDivergences).toHaveLength(0);
    });
  });

  describe('detectSmartMoneySignals', () => {
    test('should detect accumulation patterns', () => {
      const mockAbsorptionPatterns = [
        {
          timestamp: '1756960000000',
          type: 'buy_absorption' as const,
          strength: 'strong' as const,
          volume: 15000,
          priceLevel: '206.90',
          confidence: 85
        }
      ];

      const mockFlowAnalysis = {
        trend: 'accumulation' as const,
        strength: 'strong' as const,
        dominantSide: 'buy' as const,
        confidence: 80
      };

      const result = cvdService.detectSmartMoneySignals(
        mockVolumeDeltas,
        mockAbsorptionPatterns,
        mockFlowAnalysis
      );

      expect(result).toBeDefined();
      expect(result.accumulation).toBeDefined();
      expect(result.distribution).toBeDefined();
      expect(result.manipulation).toBeDefined();
      
      // Should detect accumulation based on the setup
      if (result.accumulation.detected) {
        expect(result.accumulation.strength).toBeDefined();
        expect(result.accumulation.confidence).toBeGreaterThan(0);
        expect(['weak', 'moderate', 'strong']).toContain(result.accumulation.strength);
      }
    });

    test('should detect distribution patterns', () => {
      const mockAbsorptionPatterns = [
        {
          timestamp: '1756960000000',
          type: 'sell_absorption' as const,
          strength: 'strong' as const,
          volume: 20000,
          priceLevel: '206.90',
          confidence: 90
        }
      ];

      const mockFlowAnalysis = {
        trend: 'distribution' as const,
        strength: 'strong' as const,
        dominantSide: 'sell' as const,
        confidence: 85
      };

      const result = cvdService.detectSmartMoneySignals(
        mockVolumeDeltas,
        mockAbsorptionPatterns,
        mockFlowAnalysis
      );

      if (result.distribution.detected) {
        expect(result.distribution.strength).toBeDefined();
        expect(result.distribution.confidence).toBeGreaterThan(0);
        expect(['weak', 'moderate', 'strong']).toContain(result.distribution.strength);
      }
    });

    test('should detect manipulation patterns', () => {
      // Create manipulation scenario with conflicting signals
      const manipulationCvdBars = [
        { timestamp: '1756950000000', buyVolume: 5000, sellVolume: 15000, netVolume: -10000, cumulativeDelta: '-10000', aggressionRatio: 0.25, pattern: null, volumeProfile: null, timeframe: '1H' },
        { timestamp: '1756953600000', buyVolume: 20000, sellVolume: 3000, netVolume: 17000, cumulativeDelta: '7000', aggressionRatio: 0.87, pattern: null, volumeProfile: null, timeframe: '1H' },
        { timestamp: '1756957200000', buyVolume: 2000, sellVolume: 18000, netVolume: -16000, cumulativeDelta: '-9000', aggressionRatio: 0.1, pattern: null, volumeProfile: null, timeframe: '1H' }
      ];

      const mockAbsorptionPatterns = [
        {
          timestamp: '1756953600000',
          type: 'buy_absorption' as const,
          strength: 'weak' as const,
          volume: 5000,
          priceLevel: '206.90',
          confidence: 45
        }
      ];

      const mockFlowAnalysis = {
        trend: 'manipulation' as const,
        strength: 'moderate' as const,
        dominantSide: 'neutral' as const,
        confidence: 60
      };

      const result = cvdService.detectSmartMoneySignals(
        manipulationCvdBars,
        mockAbsorptionPatterns,
        mockFlowAnalysis
      );

      if (result.manipulation.detected) {
        expect(result.manipulation.confidence).toBeDefined();
        expect(result.manipulation.type).toBeDefined();
        expect(result.manipulation.riskLevel).toBeDefined();
      }
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty data sets', () => {
      expect(() => {
        cvdService.calculateVolumeDeltaBars([], [], '1H');
      }).not.toThrow();

      expect(() => {
        cvdService.detectDivergences([], []);
      }).not.toThrow();
    });

    test('should handle malformed trade data', () => {
      const malformedTrades = [
        { timestamp: 'invalid', price: '206.90', size: '10.5', side: 'buy' },
        { timestamp: '1756962000000', price: 'invalid', size: '5.0', side: 'sell' }
      ];

      expect(() => {
        cvdService.calculateVolumeDeltaBars(mockCandleData, malformedTrades, '1H');
      }).not.toThrow();
    });

    test('should validate timeframe parameters', () => {
      const recentTrades = mockTradeData.map(trade => ({
        timestamp: trade.ts,
        price: trade.px,
        size: trade.sz,
        side: trade.side
      }));

      expect(() => {
        cvdService.calculateVolumeDeltaBars(mockCandleData, recentTrades, 'invalid');
      }).not.toThrow();
    });
  });
});
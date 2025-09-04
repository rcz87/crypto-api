import { describe, test, expect, beforeEach } from '@jest/globals';
import { OrderFlowService } from '../../../server/services/orderFlow';
import { mockTradeData, mockClassifiedTrades } from '../../fixtures/mockData';

describe('Order Flow Analysis Algorithm', () => {
  let orderFlowService: OrderFlowService;

  beforeEach(() => {
    orderFlowService = new OrderFlowService();
  });

  describe('analyzeFlowTypes', () => {
    test('should analyze maker vs taker flow correctly', () => {
      const result = orderFlowService.analyzeFlowTypes(mockClassifiedTrades);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('makerBuyVolume');
      expect(result).toHaveProperty('makerSellVolume');
      expect(result).toHaveProperty('takerBuyVolume');
      expect(result).toHaveProperty('takerSellVolume');
      expect(result).toHaveProperty('makerTakerRatio');
      expect(result).toHaveProperty('dominantFlow');
      expect(result).toHaveProperty('flowStrength');

      // Validate numeric properties
      expect(result.makerBuyVolume).toBeGreaterThanOrEqual(0);
      expect(result.makerSellVolume).toBeGreaterThanOrEqual(0);
      expect(result.takerBuyVolume).toBeGreaterThanOrEqual(0);
      expect(result.takerSellVolume).toBeGreaterThanOrEqual(0);
      expect(result.makerTakerRatio).toBeGreaterThanOrEqual(0);
      expect(result.makerTakerRatio).toBeLessThanOrEqual(1);

      // Validate enum values
      expect(['maker_dominated', 'taker_dominated', 'balanced']).toContain(result.dominantFlow);
      expect(['weak', 'moderate', 'strong']).toContain(result.flowStrength);
    });

    test('should detect taker dominated flow', () => {
      const takerDominatedTrades = [
        {
          id: 'taker_1', timestamp: 1756962000000, price: 206.90, size: 50.0, side: 'buy' as const,
          isAggressive: true, isLarge: true, value: 10345.0, type: 'market_taker' as const, confidence: 80
        },
        {
          id: 'taker_2', timestamp: 1756962001000, price: 206.88, size: 75.0, side: 'sell' as const,
          isAggressive: true, isLarge: true, value: 15516.0, type: 'market_taker' as const, confidence: 85
        },
        {
          id: 'maker_1', timestamp: 1756962002000, price: 206.92, size: 10.0, side: 'buy' as const,
          isAggressive: false, isLarge: false, value: 2069.2, type: 'market_maker' as const, confidence: 70
        }
      ];

      const result = orderFlowService.analyzeFlowTypes(takerDominatedTrades);

      expect(result.dominantFlow).toBe('taker_dominated');
      expect(result.makerTakerRatio).toBeGreaterThan(0.65);
    });

    test('should detect maker dominated flow', () => {
      const makerDominatedTrades = [
        {
          id: 'maker_1', timestamp: 1756962000000, price: 206.90, size: 100.0, side: 'buy' as const,
          isAggressive: false, isLarge: true, value: 20690.0, type: 'market_maker' as const, confidence: 75
        },
        {
          id: 'maker_2', timestamp: 1756962001000, price: 206.88, size: 80.0, side: 'sell' as const,
          isAggressive: false, isLarge: true, value: 16550.4, type: 'market_maker' as const, confidence: 78
        },
        {
          id: 'taker_1', timestamp: 1756962002000, price: 206.92, size: 5.0, side: 'buy' as const,
          isAggressive: true, isLarge: false, value: 1034.6, type: 'market_taker' as const, confidence: 65
        }
      ];

      const result = orderFlowService.analyzeFlowTypes(makerDominatedTrades);

      expect(result.dominantFlow).toBe('maker_dominated');
      expect(result.makerTakerRatio).toBeLessThan(0.35);
    });

    test('should detect balanced flow', () => {
      const balancedTrades = [
        {
          id: 'maker_1', timestamp: 1756962000000, price: 206.90, size: 25.0, side: 'buy' as const,
          isAggressive: false, isLarge: false, value: 5172.5, type: 'market_maker' as const, confidence: 70
        },
        {
          id: 'taker_1', timestamp: 1756962001000, price: 206.88, size: 25.0, side: 'sell' as const,
          isAggressive: true, isLarge: false, value: 5172.0, type: 'market_taker' as const, confidence: 72
        }
      ];

      const result = orderFlowService.analyzeFlowTypes(balancedTrades);

      expect(result.dominantFlow).toBe('balanced');
      expect(result.makerTakerRatio).toBeGreaterThanOrEqual(0.35);
      expect(result.makerTakerRatio).toBeLessThanOrEqual(0.65);
    });
  });

  describe('performTapeReading', () => {
    test('should analyze momentum correctly', () => {
      const result = orderFlowService.performTapeReading(mockClassifiedTrades);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('momentum');
      expect(result).toHaveProperty('velocity');
      expect(result).toHaveProperty('consistency');
      expect(result).toHaveProperty('largeOrderActivity');
      expect(result).toHaveProperty('marketSentiment');
      expect(result).toHaveProperty('predictionConfidence');

      // Validate enum values
      expect(['bullish', 'bearish', 'neutral']).toContain(result.momentum);
      expect(['slow', 'moderate', 'fast']).toContain(result.velocity);
      expect(['inconsistent', 'consistent', 'very_consistent']).toContain(result.consistency);
      expect(['increasing', 'decreasing', 'stable']).toContain(result.largeOrderActivity);
      expect(['bullish', 'bearish', 'neutral']).toContain(result.marketSentiment);

      // Validate numeric values
      expect(result.predictionConfidence).toBeGreaterThanOrEqual(0);
      expect(result.predictionConfidence).toBeLessThanOrEqual(95);
    });

    test('should detect bullish momentum', () => {
      const bullishTrades = Array(20).fill(null).map((_, i) => ({
        id: `bullish_${i}`,
        timestamp: 1756962000000 + i * 1000,
        price: 206.90 + (i * 0.01), // Slightly increasing prices
        size: 10.0,
        side: 'buy' as const,
        isAggressive: true,
        isLarge: false,
        value: 2069.0 + (i * 0.1),
        type: 'market_taker' as const,
        confidence: 75
      }));

      const result = orderFlowService.performTapeReading(bullishTrades);

      expect(result.momentum).toBe('bullish');
      expect(result.marketSentiment).toBe('bullish');
      expect(result.predictionConfidence).toBeGreaterThan(50);
    });

    test('should detect bearish momentum', () => {
      const bearishTrades = Array(20).fill(null).map((_, i) => ({
        id: `bearish_${i}`,
        timestamp: 1756962000000 + i * 1000,
        price: 206.90 - (i * 0.01), // Slightly decreasing prices
        size: 10.0,
        side: 'sell' as const,
        isAggressive: true,
        isLarge: false,
        value: 2069.0 - (i * 0.1),
        type: 'market_taker' as const,
        confidence: 75
      }));

      const result = orderFlowService.performTapeReading(bearishTrades);

      expect(result.momentum).toBe('bearish');
      expect(result.marketSentiment).toBe('bearish');
      expect(result.predictionConfidence).toBeGreaterThan(50);
    });

    test('should detect trading velocity correctly', () => {
      // Fast trading - many trades in short time
      const fastTrades = Array(30).fill(null).map((_, i) => ({
        id: `fast_${i}`,
        timestamp: 1756962000000 + i * 100, // 100ms intervals = very fast
        price: 206.90,
        size: 5.0,
        side: (i % 2 === 0 ? 'buy' : 'sell') as const,
        isAggressive: true,
        isLarge: false,
        value: 1034.5,
        type: 'market_taker' as const,
        confidence: 70
      }));

      const result = orderFlowService.performTapeReading(fastTrades);

      expect(result.velocity).toBe('fast');
    });

    test('should handle insufficient data gracefully', () => {
      const fewTrades = mockClassifiedTrades.slice(0, 5);

      const result = orderFlowService.performTapeReading(fewTrades);

      expect(result.momentum).toBe('neutral');
      expect(result.velocity).toBe('slow');
      expect(result.consistency).toBe('inconsistent');
      expect(result.largeOrderActivity).toBe('stable');
      expect(result.marketSentiment).toBe('neutral');
      expect(result.predictionConfidence).toBe(0);
    });
  });

  describe('analyzeAdvancedVolumeProfile', () => {
    test('should calculate Point of Control (POC) correctly', () => {
      const result = orderFlowService.analyzeAdvancedVolumeProfile(mockClassifiedTrades, '206.90');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('vpoc');
      expect(result).toHaveProperty('valueAreaHigh');
      expect(result).toHaveProperty('valueAreaLow');
      expect(result).toHaveProperty('volumeProfile');
      expect(result).toHaveProperty('volumeDistribution');
      expect(result).toHaveProperty('highVolumeNodes');
      expect(result).toHaveProperty('lowVolumeNodes');
      expect(result).toHaveProperty('supportResistanceLevels');

      // Validate numeric values
      expect(result.vpoc).toBeGreaterThan(0);
      expect(result.valueAreaHigh).toBeGreaterThanOrEqual(result.vpoc);
      expect(result.valueAreaLow).toBeLessThanOrEqual(result.vpoc);

      // Validate arrays
      expect(Array.isArray(result.volumeProfile)).toBe(true);
      expect(Array.isArray(result.highVolumeNodes)).toBe(true);
      expect(Array.isArray(result.lowVolumeNodes)).toBe(true);
    });

    test('should identify high and low volume nodes', () => {
      // Create trades concentrated at specific price levels
      const concentratedTrades = [
        // High volume at 206.90
        ...Array(20).fill(null).map((_, i) => ({
          id: `concentrated_${i}`,
          timestamp: 1756962000000 + i * 1000,
          price: 206.90,
          size: 10.0,
          side: (i % 2 === 0 ? 'buy' : 'sell') as const,
          isAggressive: true,
          isLarge: false,
          value: 2069.0,
          type: 'retail' as const,
          confidence: 70
        })),
        // Low volume at 207.50
        {
          id: 'sparse_1',
          timestamp: 1756962020000,
          price: 207.50,
          size: 1.0,
          side: 'buy' as const,
          isAggressive: false,
          isLarge: false,
          value: 207.5,
          type: 'retail' as const,
          confidence: 60
        }
      ];

      const result = orderFlowService.analyzeAdvancedVolumeProfile(concentratedTrades, '206.90');

      expect(result.highVolumeNodes).toContain(206.90);
      expect(result.vpoc).toBe(206.90);
      
      // Volume profile should have entries
      expect(result.volumeProfile.length).toBeGreaterThan(0);
      
      // Point of Control should be the highest volume level
      const pocEntry = result.volumeProfile.find(entry => entry.priceLevel === result.vpoc);
      expect(pocEntry).toBeDefined();
      expect(pocEntry?.type).toBe('point_of_control');
    });

    test('should calculate value area correctly', () => {
      const result = orderFlowService.analyzeAdvancedVolumeProfile(mockClassifiedTrades, '206.90');

      // Value area high should be >= POC >= value area low
      expect(result.valueAreaHigh).toBeGreaterThanOrEqual(result.vpoc);
      expect(result.vpoc).toBeGreaterThanOrEqual(result.valueAreaLow);

      // Volume distribution should add up
      expect(result.volumeDistribution).toBeDefined();
      expect(result.volumeDistribution.aboveVpoc).toBeGreaterThanOrEqual(0);
      expect(result.volumeDistribution.belowVpoc).toBeGreaterThanOrEqual(0);
      expect(result.volumeDistribution.imbalance).toBeGreaterThanOrEqual(-1);
      expect(result.volumeDistribution.imbalance).toBeLessThanOrEqual(1);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty trades array', () => {
      expect(() => {
        orderFlowService.analyzeFlowTypes([]);
      }).not.toThrow();

      expect(() => {
        orderFlowService.performTapeReading([]);
      }).not.toThrow();

      expect(() => {
        orderFlowService.analyzeAdvancedVolumeProfile([], '206.90');
      }).not.toThrow();
    });

    test('should handle single trade', () => {
      const singleTrade = [mockClassifiedTrades[0]];

      const flowResult = orderFlowService.analyzeFlowTypes(singleTrade);
      expect(flowResult.dominantFlow).toBeDefined();

      const tapeResult = orderFlowService.performTapeReading(singleTrade);
      expect(tapeResult.momentum).toBeDefined();

      const profileResult = orderFlowService.analyzeAdvancedVolumeProfile(singleTrade, '206.90');
      expect(profileResult.vpoc).toBeDefined();
    });

    test('should validate input parameters', () => {
      // Test with invalid current price for volume profile
      const result = orderFlowService.analyzeAdvancedVolumeProfile(mockClassifiedTrades, '0');
      
      expect(result).toBeDefined();
      expect(result.vpoc).toBeGreaterThan(0);
    });
  });
});
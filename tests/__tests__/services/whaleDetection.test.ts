import { describe, test, expect, beforeEach } from '@jest/globals';
import { OrderFlowService } from '../../../server/services/orderFlow';
import { mockTradeData, mockClassifiedTrades, expectedWhaleActivity } from '../../fixtures/mockData';

describe('Whale Detection Algorithm', () => {
  let orderFlowService: OrderFlowService;

  beforeEach(() => {
    orderFlowService = new OrderFlowService();
  });

  describe('detectWhaleActivity', () => {
    test('should detect whale activity from large trades', () => {
      const result = orderFlowService.detectWhaleActivity(mockClassifiedTrades);

      expect(result.detected).toBe(true);
      expect(result.direction).toBe('accumulation');
      expect(result.strength).toBe('strong');
      expect(result.volume).toBeGreaterThan(300);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
      expect(result.trades).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'whale'
          })
        ])
      );
    });

    test('should return neutral when no whale trades present', () => {
      const retailTrades = mockClassifiedTrades.filter(t => t.type === 'retail');
      const result = orderFlowService.detectWhaleActivity(retailTrades);

      expect(result.detected).toBe(false);
      expect(result.direction).toBe('neutral');
      expect(result.strength).toBe('weak');
      expect(result.volume).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.trades).toHaveLength(0);
    });

    test('should correctly calculate whale imbalance ratios', () => {
      const buyHeavyTrades = [
        ...mockClassifiedTrades.filter(t => t.type === 'whale' && t.side === 'buy'),
        {
          id: 'whale_buy_1',
          timestamp: '1756962007000',
          price: 207.00,
          size: 150.0,
          side: 'buy' as const,
          isAggressive: true,
          isLarge: true,
          value: 31050.0,
          type: 'whale' as const,
          confidence: 85
        }
      ];

      const result = orderFlowService.detectWhaleActivity(buyHeavyTrades);

      expect(result.direction).toBe('accumulation');
      expect(result.strength).toBe('strong');
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    test('should handle edge cases gracefully', () => {
      // Test with empty array
      const emptyResult = orderFlowService.detectWhaleActivity([]);
      expect(emptyResult.detected).toBe(false);

      // Test with single whale trade
      const singleWhale = [mockClassifiedTrades.find(t => t.type === 'whale')!];
      const singleResult = orderFlowService.detectWhaleActivity(singleWhale);
      expect(singleResult.detected).toBe(true);
      expect(singleResult.trades).toHaveLength(1);
    });

    test('should calculate confidence scores based on trade count and imbalance', () => {
      const manyWhaleTrades = Array(5).fill(null).map((_, i) => ({
        id: `whale_${i}`,
        timestamp: (1756962000000 + i * 1000).toString(),
        price: 207.00,
        size: 100.0,
        side: 'buy' as const,
        isAggressive: true,
        isLarge: true,
        value: 20700.0,
        type: 'whale' as const,
        confidence: 80
      }));

      const result = orderFlowService.detectWhaleActivity(manyWhaleTrades);
      
      // With 5 whale trades and strong imbalance, confidence should be high
      expect(result.confidence).toBeGreaterThanOrEqual(90);
      expect(result.confidence).toBeLessThanOrEqual(95); // Capped at 95
    });
  });

  describe('classifyTrades', () => {
    test('should correctly classify trades by size', () => {
      const result = orderFlowService.classifyTrades(mockTradeData);

      expect(result).toHaveLength(mockTradeData.length);
      
      // Should have different trade types
      const types = result.map(t => t.type);
      expect(types).toContain('retail');
      expect(types).toContain('whale');
      expect(types).toContain('institutional');
    });

    test('should calculate dynamic thresholds correctly', () => {
      const result = orderFlowService.classifyTrades(mockTradeData);
      
      // Verify institutional trades have highest values
      const institutionalTrades = result.filter(t => t.type === 'institutional');
      const whaleTrades = result.filter(t => t.type === 'whale');
      
      institutionalTrades.forEach(institutional => {
        whaleTrades.forEach(whale => {
          expect(institutional.value).toBeGreaterThanOrEqual(whale.value);
        });
      });
    });

    test('should handle malformed trade data', () => {
      const malformedData = [
        { px: 'invalid', sz: '10.5', side: 'buy', ts: '1756962000000' },
        { px: '206.90', sz: 'invalid', side: 'sell', ts: '1756962001000' },
        { px: '206.88', sz: '5.0', side: 'invalid', ts: '1756962002000' }
      ];

      const result = orderFlowService.classifyTrades(malformedData);
      
      expect(result).toHaveLength(malformedData.length);
      // Should handle invalid data gracefully without throwing
      result.forEach(trade => {
        expect(trade.price).toBeGreaterThanOrEqual(0);
        expect(trade.size).toBeGreaterThanOrEqual(0);
        expect(['buy', 'sell']).toContain(trade.side);
      });
    });
  });
});
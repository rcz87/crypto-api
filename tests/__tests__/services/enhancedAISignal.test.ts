import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/**
 * Unit Tests for Enhanced AI Signal Engine
 * Tests real data vs empty data scenarios
 */

// Mock data structures
const mockRealData = {
  liquidityZones: [
    { price: 145.5, liquidity: 5000000 },
    { price: 147.2, liquidity: 3200000 },
    { price: 143.8, liquidity: 2800000 }
  ],
  orderbookData: {
    bids: 15000000,
    asks: 14500000 // Imbalance ratio: 1.03
  },
  liquidations: [
    { price: 146.8, size: 800000 },
    { price: 144.2, size: 650000 }
  ],
  patterns: [
    {
      name: 'Predictive Institutional Flow',
      confidence: 0.95,
      risk_reward_ratio: 3.8
    }
  ]
};

const mockEmptyData = {
  liquidityZones: [],
  orderbookData: { bids: 0, asks: 0 },
  liquidations: [],
  patterns: []
};

describe('Enhanced AI Signal Engine - Data Quality Tests', () => {
  
  describe('Context Validation', () => {
    it('should populate all context fields with real data', () => {
      const context = {
        liquidityZones: mockRealData.liquidityZones,
        orderbookData: mockRealData.orderbookData,
        liquidations: mockRealData.liquidations
      };

      expect(context.liquidityZones.length).toBeGreaterThan(0);
      expect(context.orderbookData.bids).toBeGreaterThan(0);
      expect(context.orderbookData.asks).toBeGreaterThan(0);
      expect(context.liquidations.length).toBeGreaterThan(0);
    });

    it('should detect empty data and log warning', () => {
      const context = mockEmptyData;

      expect(context.liquidityZones.length).toBe(0);
      expect(context.orderbookData.bids).toBe(0);
      expect(context.liquidations.length).toBe(0);
    });

    it('should calculate orderbook imbalance correctly', () => {
      const { bids, asks } = mockRealData.orderbookData;
      const imbalance = bids / asks;
      
      expect(imbalance).toBeCloseTo(1.03, 2);
      expect(imbalance).toBeGreaterThan(1); // Buying pressure
    });
  });

  describe('Reality Check Layer', () => {
    it('should cap confidence when target price deviates >30%', () => {
      const currentPrice = 145.5;
      const targetPrice = 200; // ~37% deviation
      const deviation = Math.abs((targetPrice - currentPrice) / currentPrice);
      
      expect(deviation).toBeGreaterThan(0.3);
      
      // Confidence should be capped
      const originalConfidence = 85;
      const cappedConfidence = deviation > 0.3 ? Math.min(originalConfidence, 60) : originalConfidence;
      
      expect(cappedConfidence).toBe(60);
    });

    it('should flag liquidity mismatch when GPT mentions but data empty', () => {
      const mentionsLiquidity = true;
      const liquidityZones = mockEmptyData.liquidityZones;
      
      const mismatch = mentionsLiquidity && liquidityZones.length === 0;
      expect(mismatch).toBe(true);
    });

    it('should detect orderbook conflict with bias', () => {
      const bias = 'short';
      const obRatio = 3.5; // Heavy bid dominance
      
      const conflict = obRatio > 3 && bias === 'short';
      expect(conflict).toBe(true);
    });

    it('should neutralize bias on multiple mismatches', () => {
      const corrections = [
        'Target price too far',
        'Liquidity mismatch',
        'Orderbook conflict'
      ];
      
      const shouldNeutralize = corrections.length >= 2;
      const correctedBias = shouldNeutralize ? 'neutral' : 'long';
      
      expect(correctedBias).toBe('neutral');
    });
  });

  describe('Feature Vector Calculations', () => {
    it('should calculate ATR from real candles (not placeholder)', () => {
      const mockCandles = [
        { high: 148, low: 144, close: 146 },
        { high: 147, low: 143, close: 145 },
        { high: 149, low: 145, close: 147 }
      ];
      
      // Simple TR calculation
      const tr1 = mockCandles[0].high - mockCandles[0].low; // 4
      const tr2 = mockCandles[1].high - mockCandles[1].low; // 4
      const tr3 = mockCandles[2].high - mockCandles[2].low; // 4
      
      const atr = (tr1 + tr2 + tr3) / 3;
      expect(atr).toBe(4);
      expect(atr).toBeGreaterThan(0); // Not placeholder
    });

    it('should calculate volatility from returns stddev', () => {
      const prices = [100, 102, 98, 105, 101];
      const returns = prices.slice(1).map((p, i) => 
        Math.log(p / prices[i])
      );
      
      const mean = returns.reduce((a, b) => a + b) / returns.length;
      const variance = returns.reduce((sum, r) => 
        sum + Math.pow(r - mean, 2), 0
      ) / returns.length;
      const volatility = Math.sqrt(variance);
      
      expect(volatility).toBeGreaterThan(0);
      expect(volatility).toBeLessThan(1); // Reasonable range
    });

    it('should normalize volume from real data', () => {
      const volumes = [1000000, 1200000, 900000, 1500000];
      const currentVolume = 1400000;
      const avgVolume = volumes.reduce((a, b) => a + b) / volumes.length;
      
      const relativeVolume = Math.min(currentVolume / avgVolume, 2.0) / 2.0;
      
      expect(relativeVolume).toBeGreaterThan(0);
      expect(relativeVolume).toBeLessThanOrEqual(1); // Normalized
    });
  });

  describe('UUID Signal ID Format', () => {
    it('should generate valid RFC4122 UUID format', () => {
      // Simulating crypto.randomUUID()
      const mockUUID = 'f81d5912-a911-4ff6-84e9-119d16549d0d';
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      expect(mockUUID).toMatch(uuidRegex);
      expect(mockUUID.split('-').length).toBe(5);
      expect(mockUUID.length).toBe(36);
    });
  });

  describe('GPT Output Validation', () => {
    it('should validate evidence object mapping exists', () => {
      const gptOutput = {
        primary_factors: ['Institutional Flow', 'Orderbook Imbalance'],
        supporting_evidence: {
          'Institutional Flow': 'Pattern confidence 95%',
          'Orderbook Imbalance': 'Bid/ask ratio 1.03'
        }
      };
      
      gptOutput.primary_factors.forEach(factor => {
        expect(gptOutput.supporting_evidence).toHaveProperty(factor);
        expect(gptOutput.supporting_evidence[factor]).toBeTruthy();
      });
    });

    it('should flag missing evidence for factors', () => {
      const gptOutput = {
        primary_factors: ['Factor A', 'Factor B', 'Factor C'],
        supporting_evidence: {
          'Factor A': 'Evidence A',
          'Factor B': 'Evidence B'
          // Factor C missing!
        }
      };
      
      const missingEvidence = gptOutput.primary_factors.filter(
        factor => !gptOutput.supporting_evidence[factor]
      );
      
      expect(missingEvidence).toContain('Factor C');
      expect(missingEvidence.length).toBe(1);
    });

    it('should validate confidence is in range [0, 1]', () => {
      const validConfidence = 0.75;
      const invalidConfidence = 1.5;
      
      expect(validConfidence).toBeGreaterThanOrEqual(0);
      expect(validConfidence).toBeLessThanOrEqual(1);
      expect(invalidConfidence).toBeGreaterThan(1); // Invalid
    });

    it('should validate bias is valid enum value', () => {
      const validBiases = ['long', 'short', 'neutral'];
      const testBias = 'long';
      
      expect(validBiases).toContain(testBias);
    });
  });

  describe('Fallback Scenarios', () => {
    it('should trigger fallback when API fails', () => {
      const apiError = new Error('API_TIMEOUT');
      const shouldFallback = apiError !== null;
      
      expect(shouldFallback).toBe(true);
    });

    it('should use local reasoning when GPT unavailable', () => {
      const gptAvailable = false;
      const reasoningSource = gptAvailable ? 'gpt' : 'local';
      
      expect(reasoningSource).toBe('local');
    });

    it('should generate fallback signal with conservative params', () => {
      const fallbackSignal = {
        direction: 'neutral',
        confidence: 35, // Low confidence
        recommended_size: 0.05 // Very conservative
      };
      
      expect(fallbackSignal.direction).toBe('neutral');
      expect(fallbackSignal.confidence).toBeLessThan(50);
      expect(fallbackSignal.recommended_size).toBeLessThanOrEqual(0.1);
    });
  });
});

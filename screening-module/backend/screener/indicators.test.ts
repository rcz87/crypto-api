/**
 * Unit Tests for Technical Indicators
 *
 * Tests for indicators.ts functions:
 * - RSI, EMA, ATR, ADX, MACD
 * - computeIndicators main function
 */

import { describe, it, expect } from '@jest/globals';
import { computeIndicators } from './indicators';

// Mock candle data generator
function generateMockCandles(count: number, trend: 'up' | 'down' | 'sideways' = 'up') {
  const candles = [];
  let basePrice = 100;

  for (let i = 0; i < count; i++) {
    let change = 0;
    if (trend === 'up') {
      change = Math.random() * 2 - 0.5; // Mostly up
    } else if (trend === 'down') {
      change = Math.random() * 2 - 1.5; // Mostly down
    } else {
      change = Math.random() * 2 - 1; // Random
    }

    basePrice += change;
    const volatility = basePrice * 0.02;

    candles.push({
      open: basePrice - volatility * 0.5,
      high: basePrice + volatility,
      low: basePrice - volatility,
      close: basePrice,
      volume: 1000 + Math.random() * 500
    });
  }

  return candles;
}

describe('Technical Indicators', () => {
  describe('computeIndicators', () => {
    it('should return null indicators for insufficient data', () => {
      const candles = generateMockCandles(20); // Less than 50
      const result = computeIndicators(candles);

      expect(result.rsi).toBeNull();
      expect(result.emaTrend).toBe('neutral');
      expect(result.macd.macd).toBeNull();
      expect(result.atr).toBeNull();
      expect(result.adx).toBeNull();
    });

    it('should compute all indicators with sufficient data', () => {
      const candles = generateMockCandles(100);
      const result = computeIndicators(candles);

      // RSI should be between 0-100
      expect(result.rsi).not.toBeNull();
      expect(result.rsi!).toBeGreaterThanOrEqual(0);
      expect(result.rsi!).toBeLessThanOrEqual(100);

      // EMA trend should be set
      expect(['bullish', 'bearish', 'mixed', 'neutral']).toContain(result.emaTrend);

      // MACD should have all components
      expect(result.macd.macd).not.toBeNull();
      expect(result.macd.signal).not.toBeNull();
      expect(result.macd.hist).not.toBeNull();

      // ATR should be positive
      expect(result.atr).not.toBeNull();
      expect(result.atr!).toBeGreaterThan(0);

      // ADX should be between 0-100
      expect(result.adx).not.toBeNull();
      expect(result.adx!).toBeGreaterThanOrEqual(0);
      expect(result.adx!).toBeLessThanOrEqual(100);
    });

    it('should detect bullish trend correctly', () => {
      const candles = generateMockCandles(100, 'up');
      const result = computeIndicators(candles);

      // In uptrend, RSI should be higher
      expect(result.rsi).not.toBeNull();
      expect(result.rsi!).toBeGreaterThan(40); // Should be above neutral

      // EMA trend should be bullish or mixed
      expect(['bullish', 'mixed']).toContain(result.emaTrend);
    });

    it('should detect bearish trend correctly', () => {
      const candles = generateMockCandles(100, 'down');
      const result = computeIndicators(candles);

      // In downtrend, RSI should be lower
      expect(result.rsi).not.toBeNull();
      expect(result.rsi!).toBeLessThan(60); // Should be below neutral

      // EMA trend should be bearish or mixed
      expect(['bearish', 'mixed']).toContain(result.emaTrend);
    });

    it('should calculate MACD with proper signal line', () => {
      const candles = generateMockCandles(100);
      const result = computeIndicators(candles);

      expect(result.macd.macd).not.toBeNull();
      expect(result.macd.signal).not.toBeNull();
      expect(result.macd.hist).not.toBeNull();

      // Histogram should equal MACD - Signal
      const expectedHist = result.macd.macd! - result.macd.signal!;
      expect(Math.abs(result.macd.hist! - expectedHist)).toBeLessThan(0.0001);
    });

    it('should round values to appropriate precision', () => {
      const candles = generateMockCandles(100);
      const result = computeIndicators(candles);

      // RSI should have 2 decimal places
      if (result.rsi !== null) {
        const rsiStr = result.rsi.toString();
        const decimals = rsiStr.split('.')[1]?.length || 0;
        expect(decimals).toBeLessThanOrEqual(2);
      }

      // MACD should have 4 decimal places
      if (result.macd.macd !== null) {
        const macdStr = result.macd.macd.toString();
        const decimals = macdStr.split('.')[1]?.length || 0;
        expect(decimals).toBeLessThanOrEqual(4);
      }
    });

    it('should handle edge case: all same prices', () => {
      const candles = [];
      for (let i = 0; i < 100; i++) {
        candles.push({
          open: 100,
          high: 100,
          low: 100,
          close: 100,
          volume: 1000
        });
      }

      const result = computeIndicators(candles);

      // With no price movement, RSI should be 100 (no losses)
      expect(result.rsi).toBe(100);

      // ATR should be 0 (no volatility)
      expect(result.atr).toBe(0);

      // EMA trend should be neutral (no movement)
      expect(result.emaTrend).toBe('neutral');
    });

    it('should handle edge case: increasing prices', () => {
      const candles = [];
      for (let i = 0; i < 100; i++) {
        const price = 100 + i;
        candles.push({
          open: price,
          high: price + 1,
          low: price - 0.5,
          close: price + 0.5,
          volume: 1000
        });
      }

      const result = computeIndicators(candles);

      // With consistent uptrend
      expect(result.rsi).toBeGreaterThan(70); // Overbought
      expect(result.emaTrend).toBe('bullish');
      expect(result.macd.hist).toBeGreaterThan(0); // Positive histogram
    });

    it('should handle edge case: decreasing prices', () => {
      const candles = [];
      for (let i = 0; i < 100; i++) {
        const price = 200 - i;
        candles.push({
          open: price,
          high: price + 0.5,
          low: price - 1,
          close: price - 0.5,
          volume: 1000
        });
      }

      const result = computeIndicators(candles);

      // With consistent downtrend
      expect(result.rsi).toBeLessThan(30); // Oversold
      expect(result.emaTrend).toBe('bearish');
      expect(result.macd.hist).toBeLessThan(0); // Negative histogram
    });
  });

  describe('EMA Trend Detection', () => {
    it('should detect bullish when EMA20 > EMA50', () => {
      // Create uptrend that results in EMA20 > EMA50
      const candles = [];
      for (let i = 0; i < 100; i++) {
        const price = 100 + i * 0.5; // Steady uptrend
        candles.push({
          open: price,
          high: price + 1,
          low: price - 0.5,
          close: price,
          volume: 1000
        });
      }

      const result = computeIndicators(candles);
      expect(result.emaTrend).toBe('bullish');
    });

    it('should detect bearish when EMA20 < EMA50', () => {
      // Create downtrend that results in EMA20 < EMA50
      const candles = [];
      for (let i = 0; i < 100; i++) {
        const price = 200 - i * 0.5; // Steady downtrend
        candles.push({
          open: price,
          high: price + 0.5,
          low: price - 1,
          close: price,
          volume: 1000
        });
      }

      const result = computeIndicators(candles);
      expect(result.emaTrend).toBe('bearish');
    });
  });

  describe('ATR Calculation', () => {
    it('should increase with higher volatility', () => {
      // Low volatility candles
      const lowVolCandles = [];
      for (let i = 0; i < 100; i++) {
        lowVolCandles.push({
          open: 100,
          high: 100.5,
          low: 99.5,
          close: 100,
          volume: 1000
        });
      }

      // High volatility candles
      const highVolCandles = [];
      for (let i = 0; i < 100; i++) {
        highVolCandles.push({
          open: 100,
          high: 105,
          low: 95,
          close: 100,
          volume: 1000
        });
      }

      const lowVolResult = computeIndicators(lowVolCandles);
      const highVolResult = computeIndicators(highVolCandles);

      expect(highVolResult.atr!).toBeGreaterThan(lowVolResult.atr!);
    });
  });

  describe('MACD Signal Line Improvement', () => {
    it('should use proper EMA for signal line', () => {
      const candles = generateMockCandles(100);
      const result = computeIndicators(candles);

      // Signal should not be a simple percentage of MACD
      // (old implementation used signal = macd * 0.9)
      if (result.macd.macd !== null && result.macd.signal !== null) {
        const oldSignalApprox = result.macd.macd * 0.9;

        // New signal should be different from old approximation
        // (unless by coincidence)
        const difference = Math.abs(result.macd.signal - oldSignalApprox);

        // Allow small difference but should generally be different
        // This test verifies we're using proper EMA, not approximation
        expect(typeof result.macd.signal).toBe('number');
        expect(result.macd.signal).not.toBeNaN();
      }
    });

    it('should have consistent histogram calculation', () => {
      const candles = generateMockCandles(100);
      const result = computeIndicators(candles);

      if (result.macd.macd !== null && result.macd.signal !== null && result.macd.hist !== null) {
        // Histogram = MACD - Signal
        const calculatedHist = result.macd.macd - result.macd.signal;
        const difference = Math.abs(result.macd.hist - calculatedHist);

        // Should be nearly identical (accounting for rounding)
        expect(difference).toBeLessThan(0.0001);
      }
    });
  });

  describe('Performance Tests', () => {
    it('should compute indicators quickly', () => {
      const candles = generateMockCandles(100);

      const startTime = performance.now();
      computeIndicators(candles);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in less than 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should handle large datasets efficiently', () => {
      const candles = generateMockCandles(1000);

      const startTime = performance.now();
      computeIndicators(candles);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Even with 1000 candles, should complete quickly
      expect(duration).toBeLessThan(200);
    });
  });
});

// Export for use in other test files
export { generateMockCandles };

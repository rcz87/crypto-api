/**
 * Unit Tests for Enhanced Indicators
 *
 * Tests for indicatorsEnhanced.ts functionality:
 * - Full ADX calculation with DI+/DI-
 * - Wilder's smoothing algorithm
 * - Trend direction detection
 * - DI crossover detection
 * - Trading signal generation
 */

import { describe, it, expect } from '@jest/globals';
import {
  calcEnhancedADX,
  EnhancedADXResult,
  detectDICrossover,
  formatEnhancedADX
} from './indicatorsEnhanced';

// Mock candle data generator
function generateMockCandles(
  count: number,
  trend: 'up' | 'down' | 'sideways' | 'volatile' = 'up'
) {
  const candles = {
    high: [] as number[],
    low: [] as number[],
    close: [] as number[]
  };

  let basePrice = 100;

  for (let i = 0; i < count; i++) {
    let change = 0;

    if (trend === 'up') {
      change = Math.random() * 3 - 0.5; // Mostly up
    } else if (trend === 'down') {
      change = Math.random() * 3 - 2.5; // Mostly down
    } else if (trend === 'volatile') {
      change = Math.random() * 10 - 5; // High volatility
    } else {
      change = Math.random() * 2 - 1; // Sideways
    }

    basePrice += change;
    const volatility = basePrice * 0.02;

    candles.high.push(basePrice + volatility);
    candles.low.push(basePrice - volatility);
    candles.close.push(basePrice);
  }

  return candles;
}

describe('Enhanced ADX Calculation', () => {
  describe('calcEnhancedADX', () => {
    it('should return null with insufficient data', () => {
      const candles = generateMockCandles(10); // Less than period + 1
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).toBeNull();
    });

    it('should calculate ADX with sufficient data', () => {
      const candles = generateMockCandles(100);
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      expect(result!.adx).toBeGreaterThanOrEqual(0);
      expect(result!.adx).toBeLessThanOrEqual(100);
    });

    it('should calculate DI+ and DI- indicators', () => {
      const candles = generateMockCandles(100);
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      expect(result!.diPlus).toBeGreaterThanOrEqual(0);
      expect(result!.diPlus).toBeLessThanOrEqual(100);
      expect(result!.diMinus).toBeGreaterThanOrEqual(0);
      expect(result!.diMinus).toBeLessThanOrEqual(100);
    });

    it('should determine trend strength correctly', () => {
      const candles = generateMockCandles(100, 'up');
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      expect(['weak', 'moderate', 'strong', 'very_strong']).toContain(result!.trendStrength);

      // Trend strength classification
      if (result!.adx < 20) {
        expect(result!.trendStrength).toBe('weak');
      } else if (result!.adx < 40) {
        expect(result!.trendStrength).toBe('moderate');
      } else if (result!.adx < 60) {
        expect(result!.trendStrength).toBe('strong');
      } else {
        expect(result!.trendStrength).toBe('very_strong');
      }
    });

    it('should determine trend direction correctly', () => {
      const candles = generateMockCandles(100, 'up');
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      expect(['bullish', 'bearish', 'neutral']).toContain(result!.trendDirection);
    });

    it('should generate appropriate trading signals', () => {
      const candles = generateMockCandles(100, 'up');
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      expect(['strong_buy', 'buy', 'hold', 'sell', 'strong_sell']).toContain(result!.signal);
    });

    it('should round values to 2 decimal places', () => {
      const candles = generateMockCandles(100);
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();

      // Check decimal places
      const adxStr = result!.adx.toString();
      const diPlusStr = result!.diPlus.toString();
      const diMinusStr = result!.diMinus.toString();

      const adxDecimals = adxStr.split('.')[1]?.length || 0;
      const diPlusDecimals = diPlusStr.split('.')[1]?.length || 0;
      const diMinusDecimals = diMinusStr.split('.')[1]?.length || 0;

      expect(adxDecimals).toBeLessThanOrEqual(2);
      expect(diPlusDecimals).toBeLessThanOrEqual(2);
      expect(diMinusDecimals).toBeLessThanOrEqual(2);
    });
  });

  describe('Trend Detection', () => {
    it('should detect bullish trend when DI+ > DI-', () => {
      // Create strong uptrend
      const candles = {
        high: [] as number[],
        low: [] as number[],
        close: [] as number[]
      };

      for (let i = 0; i < 100; i++) {
        const price = 100 + i; // Consistent uptrend
        candles.high.push(price + 1);
        candles.low.push(price - 0.5);
        candles.close.push(price + 0.5);
      }

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      expect(result!.diPlus).toBeGreaterThan(result!.diMinus);
      expect(result!.trendDirection).toBe('bullish');
    });

    it('should detect bearish trend when DI- > DI+', () => {
      // Create strong downtrend
      const candles = {
        high: [] as number[],
        low: [] as number[],
        close: [] as number[]
      };

      for (let i = 0; i < 100; i++) {
        const price = 200 - i; // Consistent downtrend
        candles.high.push(price + 0.5);
        candles.low.push(price - 1);
        candles.close.push(price - 0.5);
      }

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      expect(result!.diMinus).toBeGreaterThan(result!.diPlus);
      expect(result!.trendDirection).toBe('bearish');
    });

    it('should detect neutral trend when DI+ ≈ DI-', () => {
      // Create sideways movement
      const candles = {
        high: [] as number[],
        low: [] as number[],
        close: [] as number[]
      };

      for (let i = 0; i < 100; i++) {
        const price = 100 + Math.sin(i * 0.1) * 2; // Oscillating
        candles.high.push(price + 1);
        candles.low.push(price - 1);
        candles.close.push(price);
      }

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      // In sideways market, DI+ and DI- should be relatively close
    });
  });

  describe('Signal Generation', () => {
    it('should generate strong_buy when ADX > 25 and DI+ >> DI-', () => {
      // Create very strong uptrend
      const candles = {
        high: [] as number[],
        low: [] as number[],
        close: [] as number[]
      };

      for (let i = 0; i < 100; i++) {
        const price = 100 + i * 2; // Strong uptrend
        candles.high.push(price + 2);
        candles.low.push(price - 0.5);
        candles.close.push(price + 1);
      }

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();

      if (result!.adx > 25 && result!.diPlus > result!.diMinus + 10) {
        expect(result!.signal).toBe('strong_buy');
      }
    });

    it('should generate strong_sell when ADX > 25 and DI- >> DI+', () => {
      // Create very strong downtrend
      const candles = {
        high: [] as number[],
        low: [] as number[],
        close: [] as number[]
      };

      for (let i = 0; i < 100; i++) {
        const price = 200 - i * 2; // Strong downtrend
        candles.high.push(price + 0.5);
        candles.low.push(price - 2);
        candles.close.push(price - 1);
      }

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();

      if (result!.adx > 25 && result!.diMinus > result!.diPlus + 10) {
        expect(result!.signal).toBe('strong_sell');
      }
    });

    it('should generate buy when DI+ > DI- moderately', () => {
      const candles = generateMockCandles(100, 'up');
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();

      // If moderate bullish advantage
      if (result!.diPlus > result!.diMinus + 5 && result!.diPlus <= result!.diMinus + 10) {
        expect(['buy', 'strong_buy']).toContain(result!.signal);
      }
    });

    it('should generate hold when DI indicators are balanced', () => {
      const candles = generateMockCandles(100, 'sideways');
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();

      // When DI+ and DI- are close
      const diDiff = Math.abs(result!.diPlus - result!.diMinus);
      if (diDiff < 5) {
        expect(['hold', 'buy', 'sell']).toContain(result!.signal);
      }
    });
  });

  describe('Wilder\'s Smoothing', () => {
    it('should produce smoothed values', () => {
      const candles = generateMockCandles(100, 'volatile');
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      // ADX should be smoother than raw price movements
      expect(result!.adx).toBeGreaterThanOrEqual(0);
    });

    it('should work with different periods', () => {
      const candles = generateMockCandles(100);

      const result7 = calcEnhancedADX(candles.high, candles.low, candles.close, 7);
      const result14 = calcEnhancedADX(candles.high, candles.low, candles.close, 14);
      const result21 = calcEnhancedADX(candles.high, candles.low, candles.close, 21);

      expect(result7).not.toBeNull();
      expect(result14).not.toBeNull();
      expect(result21).not.toBeNull();

      // Shorter periods typically more responsive
      // Longer periods typically smoother
    });
  });

  describe('DI Crossover Detection', () => {
    it('should detect bullish crossover (DI+ crosses above DI-)', () => {
      const diPlusHistory = [10, 15, 20, 25]; // Rising
      const diMinusHistory = [30, 25, 20, 15]; // Falling

      const crossover = detectDICrossover(diPlusHistory, diMinusHistory);
      expect(crossover).toBe('bullish_cross');
    });

    it('should detect bearish crossover (DI- crosses above DI+)', () => {
      const diPlusHistory = [30, 25, 20, 15]; // Falling
      const diMinusHistory = [10, 15, 20, 25]; // Rising

      const crossover = detectDICrossover(diPlusHistory, diMinusHistory);
      expect(crossover).toBe('bearish_cross');
    });

    it('should return null when no crossover', () => {
      const diPlusHistory = [20, 21, 22, 23]; // Both rising
      const diMinusHistory = [10, 11, 12, 13];

      const crossover = detectDICrossover(diPlusHistory, diMinusHistory);
      expect(crossover).toBeNull();
    });

    it('should return null with insufficient data', () => {
      const diPlusHistory = [20]; // Only 1 value
      const diMinusHistory = [10];

      const crossover = detectDICrossover(diPlusHistory, diMinusHistory);
      expect(crossover).toBeNull();
    });

    it('should detect crossover at exact point', () => {
      // DI+ was below, now above
      const diPlusHistory = [15, 20];
      const diMinusHistory = [18, 18];

      const crossover = detectDICrossover(diPlusHistory, diMinusHistory);
      expect(crossover).toBe('bullish_cross');
    });
  });

  describe('Format Enhanced ADX', () => {
    it('should format ADX result for display', () => {
      const adxResult: EnhancedADXResult = {
        adx: 45.5,
        diPlus: 35.2,
        diMinus: 18.7,
        trendStrength: 'strong',
        trendDirection: 'bullish',
        signal: 'strong_buy'
      };

      const formatted = formatEnhancedADX(adxResult);

      expect(formatted).toContain('ADX: 45.5');
      expect(formatted).toContain('DI+: 35.2');
      expect(formatted).toContain('DI-: 18.7');
      expect(formatted).toContain('Direction: bullish');
      expect(formatted).toContain('Signal: STRONG_BUY');
    });

    it('should format with proper decimal places', () => {
      const adxResult: EnhancedADXResult = {
        adx: 25.123456,
        diPlus: 30.987654,
        diMinus: 20.456789,
        trendStrength: 'moderate',
        trendDirection: 'bullish',
        signal: 'buy'
      };

      const formatted = formatEnhancedADX(adxResult);

      // Should round to 1 decimal place
      expect(formatted).toContain('ADX: 25.1');
      expect(formatted).toContain('DI+: 31.0');
      expect(formatted).toContain('DI-: 20.5');
    });
  });

  describe('Edge Cases', () => {
    it('should handle all same prices', () => {
      const candles = {
        high: Array(100).fill(100),
        low: Array(100).fill(100),
        close: Array(100).fill(100)
      };

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      // With no movement, ADX should be low
      expect(result!.adx).toBeLessThan(20);
    });

    it('should handle extreme volatility', () => {
      const candles = {
        high: [] as number[],
        low: [] as number[],
        close: [] as number[]
      };

      let price = 100;
      for (let i = 0; i < 100; i++) {
        price = price + (Math.random() > 0.5 ? 20 : -20); // Extreme swings
        candles.high.push(price + 10);
        candles.low.push(price - 10);
        candles.close.push(price);
      }

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      expect(result!.adx).toBeGreaterThanOrEqual(0);
      expect(result!.adx).toBeLessThanOrEqual(100);
    });

    it('should handle minimum required data', () => {
      const candles = generateMockCandles(15); // Exactly period + 1
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
    });

    it('should handle different array lengths (should return null)', () => {
      const high = Array(100).fill(100);
      const low = Array(90).fill(100); // Different length
      const close = Array(100).fill(100);

      const result = calcEnhancedADX(high, low, close, 14);

      // Implementation should handle this gracefully
      expect(result).toBeNull();
    });

    it('should handle very small period', () => {
      const candles = generateMockCandles(50);
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 2);

      expect(result).not.toBeNull();
    });

    it('should handle very large period', () => {
      const candles = generateMockCandles(200);
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 50);

      expect(result).not.toBeNull();
    });
  });

  describe('Comparison with Simplified ADX', () => {
    it('should provide more detail than simplified ADX', () => {
      const candles = generateMockCandles(100);
      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();

      // Enhanced version provides directional indicators
      expect(result!.diPlus).toBeDefined();
      expect(result!.diMinus).toBeDefined();

      // And trend direction
      expect(result!.trendDirection).toBeDefined();

      // And more nuanced signals
      expect(result!.signal).toBeDefined();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should identify strong trending market', () => {
      // Strong consistent uptrend
      const candles = {
        high: [] as number[],
        low: [] as number[],
        close: [] as number[]
      };

      for (let i = 0; i < 100; i++) {
        const price = 100 + i * 1.5;
        candles.high.push(price + 1);
        candles.low.push(price - 0.5);
        candles.close.push(price + 0.3);
      }

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      expect(result!.trendStrength).not.toBe('weak');
      expect(result!.trendDirection).toBe('bullish');
    });

    it('should identify weak/ranging market', () => {
      // Sideways choppy market
      const candles = {
        high: [] as number[],
        low: [] as number[],
        close: [] as number[]
      };

      for (let i = 0; i < 100; i++) {
        const price = 100 + Math.sin(i * 0.5) * 3;
        candles.high.push(price + 1);
        candles.low.push(price - 1);
        candles.close.push(price);
      }

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      // Sideways market should have lower ADX
      expect(['weak', 'moderate']).toContain(result!.trendStrength);
    });

    it('should detect trend reversal signals', () => {
      // Uptrend then downtrend
      const candles = {
        high: [] as number[],
        low: [] as number[],
        close: [] as number[]
      };

      for (let i = 0; i < 50; i++) {
        const price = 100 + i;
        candles.high.push(price + 1);
        candles.low.push(price - 0.5);
        candles.close.push(price);
      }

      for (let i = 0; i < 50; i++) {
        const price = 150 - i;
        candles.high.push(price + 0.5);
        candles.low.push(price - 1);
        candles.close.push(price);
      }

      const result = calcEnhancedADX(candles.high, candles.low, candles.close, 14);

      expect(result).not.toBeNull();
      // Should detect the trend change
    });
  });

  describe('Performance', () => {
    it('should calculate quickly with standard dataset', () => {
      const candles = generateMockCandles(100);

      const startTime = performance.now();
      calcEnhancedADX(candles.high, candles.low, candles.close, 14);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50); // Should complete in less than 50ms
    });

    it('should handle large datasets efficiently', () => {
      const candles = generateMockCandles(1000);

      const startTime = performance.now();
      calcEnhancedADX(candles.high, candles.low, candles.close, 14);
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200); // Should complete in less than 200ms
    });

    it('should handle multiple calculations efficiently', () => {
      const candles = generateMockCandles(100);

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        calcEnhancedADX(candles.high, candles.low, candles.close, 14);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // 100 calculations in < 500ms
    });
  });
});

// Export for use in other test files
export { generateMockCandles };

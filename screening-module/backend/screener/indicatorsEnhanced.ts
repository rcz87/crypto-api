/**
 * Enhanced ADX Calculation with DI+ and DI-
 *
 * This module provides full ADX implementation with directional indicators
 * for more accurate trend analysis and directional bias detection.
 */

/**
 * Full ADX result with directional indicators
 */
export interface EnhancedADXResult {
  adx: number;        // Average Directional Index (0-100)
  diPlus: number;     // Positive Directional Indicator (0-100)
  diMinus: number;    // Negative Directional Indicator (0-100)
  trendStrength: 'weak' | 'moderate' | 'strong' | 'very_strong';
  trendDirection: 'bullish' | 'bearish' | 'neutral';
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
}

/**
 * Calculate full ADX with DI+ and DI- indicators
 *
 * ADX with directional indicators provides:
 * - ADX: Trend strength (0-100)
 * - DI+: Bullish pressure (0-100)
 * - DI-: Bearish pressure (0-100)
 *
 * Trading signals:
 * - DI+ crosses above DI- + ADX > 25: Strong buy signal
 * - DI- crosses above DI+ + ADX > 25: Strong sell signal
 * - ADX rising: Trend strengthening
 * - ADX falling: Trend weakening
 *
 * @param high - Array of high prices
 * @param low - Array of low prices
 * @param close - Array of close prices
 * @param period - ADX period (default: 14)
 * @returns EnhancedADXResult with full ADX analysis
 *
 * @example
 * ```typescript
 * const adx = calcEnhancedADX(highs, lows, closes, 14);
 *
 * if (adx.signal === 'strong_buy') {
 *   console.log(`Strong buy: ADX=${adx.adx}, DI+=${adx.diPlus} > DI-=${adx.diMinus}`);
 * }
 *
 * if (adx.trendStrength === 'strong' && adx.trendDirection === 'bullish') {
 *   console.log('Strong bullish trend detected');
 * }
 * ```
 */
export function calcEnhancedADX(
  high: number[],
  low: number[],
  close: number[],
  period: number = 14
): EnhancedADXResult | null {
  if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) {
    return null;
  }

  // Step 1: Calculate True Range (TR)
  const tr: number[] = [];
  for (let i = 1; i < high.length; i++) {
    const trValue = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    tr.push(trValue);
  }

  // Step 2: Calculate Directional Movement (+DM and -DM)
  const dmPlus: number[] = [];
  const dmMinus: number[] = [];

  for (let i = 1; i < high.length; i++) {
    const upMove = high[i] - high[i - 1];
    const downMove = low[i - 1] - low[i];

    if (upMove > downMove && upMove > 0) {
      dmPlus.push(upMove);
      dmMinus.push(0);
    } else if (downMove > upMove && downMove > 0) {
      dmPlus.push(0);
      dmMinus.push(downMove);
    } else {
      dmPlus.push(0);
      dmMinus.push(0);
    }
  }

  // Step 3: Smooth TR, +DM, and -DM using Wilder's smoothing (EMA-like)
  const smoothedTR = smoothWilder(tr, period);
  const smoothedDMPlus = smoothWilder(dmPlus, period);
  const smoothedDMMinus = smoothWilder(dmMinus, period);

  if (!smoothedTR || !smoothedDMPlus || !smoothedDMMinus) {
    return null;
  }

  // Step 4: Calculate +DI and -DI (Directional Indicators)
  const diPlusArray: number[] = [];
  const diMinusArray: number[] = [];

  for (let i = 0; i < smoothedTR.length; i++) {
    if (smoothedTR[i] > 0) {
      diPlusArray.push((smoothedDMPlus[i] / smoothedTR[i]) * 100);
      diMinusArray.push((smoothedDMMinus[i] / smoothedTR[i]) * 100);
    } else {
      diPlusArray.push(0);
      diMinusArray.push(0);
    }
  }

  // Step 5: Calculate DX (Directional Movement Index)
  const dx: number[] = [];

  for (let i = 0; i < diPlusArray.length; i++) {
    const diSum = diPlusArray[i] + diMinusArray[i];
    if (diSum > 0) {
      const diDiff = Math.abs(diPlusArray[i] - diMinusArray[i]);
      dx.push((diDiff / diSum) * 100);
    } else {
      dx.push(0);
    }
  }

  // Step 6: Calculate ADX (smoothed DX)
  const adxArray = smoothWilder(dx, period);

  if (!adxArray || adxArray.length === 0) {
    return null;
  }

  // Get current values (last in arrays)
  const currentADX = adxArray[adxArray.length - 1];
  const currentDIPlus = diPlusArray[diPlusArray.length - 1];
  const currentDIMinus = diMinusArray[diMinusArray.length - 1];

  // Determine trend strength
  let trendStrength: EnhancedADXResult['trendStrength'];
  if (currentADX < 20) trendStrength = 'weak';
  else if (currentADX < 40) trendStrength = 'moderate';
  else if (currentADX < 60) trendStrength = 'strong';
  else trendStrength = 'very_strong';

  // Determine trend direction
  let trendDirection: EnhancedADXResult['trendDirection'];
  const diDifference = currentDIPlus - currentDIMinus;
  if (Math.abs(diDifference) < 5) {
    trendDirection = 'neutral';
  } else if (diDifference > 0) {
    trendDirection = 'bullish';
  } else {
    trendDirection = 'bearish';
  }

  // Generate trading signal
  let signal: EnhancedADXResult['signal'];
  if (currentADX > 25 && currentDIPlus > currentDIMinus + 10) {
    signal = 'strong_buy';
  } else if (currentADX > 25 && currentDIMinus > currentDIPlus + 10) {
    signal = 'strong_sell';
  } else if (currentDIPlus > currentDIMinus + 5) {
    signal = 'buy';
  } else if (currentDIMinus > currentDIPlus + 5) {
    signal = 'sell';
  } else {
    signal = 'hold';
  }

  return {
    adx: Math.round(currentADX * 100) / 100,
    diPlus: Math.round(currentDIPlus * 100) / 100,
    diMinus: Math.round(currentDIMinus * 100) / 100,
    trendStrength,
    trendDirection,
    signal
  };
}

/**
 * Wilder's smoothing method (similar to EMA but with different weighting)
 *
 * Wilder's smoothing formula:
 * Current = ((Previous × (period - 1)) + Current Value) / period
 *
 * @param values - Array of values to smooth
 * @param period - Smoothing period
 * @returns Array of smoothed values or null if insufficient data
 */
function smoothWilder(values: number[], period: number): number[] | null {
  if (values.length < period) return null;

  const smoothed: number[] = [];

  // First value is simple average
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  smoothed.push(sum / period);

  // Subsequent values use Wilder's smoothing
  for (let i = period; i < values.length; i++) {
    const prevSmoothed = smoothed[smoothed.length - 1];
    const current = ((prevSmoothed * (period - 1)) + values[i]) / period;
    smoothed.push(current);
  }

  return smoothed;
}

/**
 * Format enhanced ADX for display
 */
export function formatEnhancedADX(adx: EnhancedADXResult): string {
  const lines = [
    `ADX: ${adx.adx.toFixed(1)} (${adx.trendStrength})`,
    `DI+: ${adx.diPlus.toFixed(1)}`,
    `DI-: ${adx.diMinus.toFixed(1)}`,
    `Direction: ${adx.trendDirection}`,
    `Signal: ${adx.signal.toUpperCase()}`
  ];

  return lines.join(' | ');
}

/**
 * Helper: Check for DI+ and DI- crossover
 *
 * Detects when DI+ crosses above or below DI- which are strong trend signals
 *
 * @param diPlusHistory - Last N DI+ values
 * @param diMinusHistory - Last N DI- values
 * @returns Crossover type or null
 */
export function detectDICrossover(
  diPlusHistory: number[],
  diMinusHistory: number[]
): 'bullish_cross' | 'bearish_cross' | null {
  if (diPlusHistory.length < 2 || diMinusHistory.length < 2) return null;

  const currentDIPlus = diPlusHistory[diPlusHistory.length - 1];
  const prevDIPlus = diPlusHistory[diPlusHistory.length - 2];
  const currentDIMinus = diMinusHistory[diMinusHistory.length - 1];
  const prevDIMinus = diMinusHistory[diMinusHistory.length - 2];

  // Bullish crossover: DI+ crosses above DI-
  if (prevDIPlus <= prevDIMinus && currentDIPlus > currentDIMinus) {
    return 'bullish_cross';
  }

  // Bearish crossover: DI- crosses above DI+
  if (prevDIPlus >= prevDIMinus && currentDIPlus < currentDIMinus) {
    return 'bearish_cross';
  }

  return null;
}

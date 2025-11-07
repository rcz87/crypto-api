// Enhanced Indicators with ATR/ADX Support
import { IndicatorsResult } from "../../shared/schemas";

/**
 * Calculate Exponential Moving Average (EMA)
 *
 * @param values - Array of price values
 * @param period - EMA period (e.g., 12, 26, 50)
 * @returns Array of EMA values
 *
 * @example
 * ```typescript
 * const closes = [100, 102, 101, 103, 105];
 * const ema12 = calcEMA(closes, 12);
 * ```
 */
function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let ema: number[] = [];
  values.forEach((v, i) => {
    if (i === 0) ema.push(v);
    else ema.push(v * k + ema[i - 1] * (1 - k));
  });
  return ema;
}

/**
 * Calculate Relative Strength Index (RSI) using Wilder's method
 *
 * RSI measures momentum on a scale of 0-100:
 * - RSI > 70: Overbought
 * - RSI < 30: Oversold
 * - 40-60: Neutral
 *
 * @param values - Array of price values
 * @param period - RSI period (default: 14)
 * @returns RSI value (0-100) or null if insufficient data
 *
 * @example
 * ```typescript
 * const closes = [...]; // 50 candles
 * const rsi = calcRSI(closes, 14); // 65.5
 * ```
 */
function calcRSI(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate Average True Range (ATR)
 *
 * ATR measures market volatility:
 * - True Range = max(high-low, |high-prevClose|, |low-prevClose|)
 * - ATR = average of True Range over period
 *
 * Used for:
 * - Stop loss placement: Entry ± (ATR × multiplier)
 * - Position sizing: Risk / ATR
 * - Volatility filtering
 *
 * @param high - Array of high prices
 * @param low - Array of low prices
 * @param close - Array of close prices
 * @param period - ATR period (default: 14)
 * @returns ATR value or null if insufficient data
 *
 * @example
 * ```typescript
 * const atr = calcATR(highs, lows, closes, 14);
 * const stopLoss = entry - (atr * 1.5);
 * ```
 */
function calcATR(high: number[], low: number[], close: number[], period = 14): number | null {
  if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) return null;
  const trs: number[] = [];

  for (let i = 1; i < high.length; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    trs.push(tr);
  }

  if (trs.length < period) return null;
  const slice = trs.slice(-period);
  const atr = slice.reduce((a, b) => a + b, 0) / period;
  return atr;
}

/**
 * Calculate Average Directional Index (ADX)
 *
 * ADX measures trend strength (0-100):
 * - ADX < 20: Weak trend (range-bound)
 * - ADX 20-40: Moderate trend
 * - ADX > 40: Strong trend
 *
 * Note: This is a simplified implementation optimized for screening.
 * Full ADX includes DI+ and DI- for directional bias.
 *
 * @param high - Array of high prices
 * @param low - Array of low prices
 * @param close - Array of close prices
 * @param period - ADX period (default: 14)
 * @returns ADX value (0-100) or null if insufficient data
 *
 * @example
 * ```typescript
 * const adx = calcADX(highs, lows, closes, 14);
 * if (adx > 25) {
 *   // Strong trend detected
 * }
 * ```
 */
function calcADX(high: number[], low: number[], close: number[], period = 14): number | null {
  if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) return null;

  // Simplified ADX calculation for screening purposes
  const atr = calcATR(high, low, close, period);
  if (atr == null) return null;

  // Calculate directional movement
  let dmPlus = 0, dmMinus = 0;
  for (let i = 1; i < high.length && i <= period; i++) {
    const highDiff = high[i] - high[i - 1];
    const lowDiff = low[i - 1] - low[i];

    if (highDiff > lowDiff && highDiff > 0) dmPlus += highDiff;
    if (lowDiff > highDiff && lowDiff > 0) dmMinus += lowDiff;
  }

  const lastClose = close[close.length - 1];
  if (lastClose <= 0) return null;

  // Normalize and return as ADX approximation
  const adx = Math.min(100, Math.max(0, ((dmPlus + dmMinus) / (period * lastClose)) * 100 * 10));
  return Math.round(adx * 100) / 100;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 *
 * MACD components:
 * - MACD Line: EMA(12) - EMA(26)
 * - Signal Line: EMA(MACD, 9)
 * - Histogram: MACD - Signal
 *
 * Interpretation:
 * - MACD > Signal: Bullish momentum
 * - MACD < Signal: Bearish momentum
 * - Histogram crossing 0: Trend change
 *
 * @param values - Array of price values (minimum 35 for proper signal)
 * @returns Object with macd, signal, and histogram values
 *
 * @example
 * ```typescript
 * const closes = [...]; // 50 candles
 * const { macd, signal, hist } = calcMACD(closes);
 * if (macd > signal) {
 *   // Bullish signal
 * }
 * ```
 */
function calcMACD(values: number[]) {
  if (values.length < 35) return { macd: null, signal: null, hist: null };

  const ema12 = calcEMA(values, 12);
  const ema26 = calcEMA(values, 26);

  if (ema12.length < 26 || ema26.length < 26) return { macd: null, signal: null, hist: null };

  // Calculate MACD line (EMA12 - EMA26)
  const macdLine: number[] = [];
  for (let i = 0; i < ema12.length; i++) {
    macdLine.push(ema12[i] - ema26[i]);
  }

  // Calculate signal line (EMA of MACD with period 9) - IMPROVED!
  const signalLine = calcEMA(macdLine, 9);

  if (signalLine.length === 0) return { macd: null, signal: null, hist: null };

  // Get current values
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  const hist = macd - signal;

  return { macd, signal, hist };
}

/**
 * Compute comprehensive technical indicators from OHLCV candle data
 *
 * Calculates all major technical indicators used for screening:
 * - RSI (14): Momentum indicator
 * - EMA Trend: 20/50 crossover detection
 * - MACD: Trend following momentum
 * - ATR (14): Volatility measurement
 * - ADX (14): Trend strength
 *
 * @param candles - Array of OHLCV candles (minimum 50 recommended)
 * @returns IndicatorsResult with all computed indicators
 *
 * @example
 * ```typescript
 * const candles = await okxService.getCandles('BTC-USDT', '1h', 100);
 * const indicators = computeIndicators(candles);
 *
 * console.log(indicators.rsi);        // 65.5
 * console.log(indicators.emaTrend);   // "bullish"
 * console.log(indicators.macd.hist);  // 0.05
 * console.log(indicators.atr);        // 250.50
 * console.log(indicators.adx);        // 45
 * ```
 */
export function computeIndicators(candles: {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}[]): IndicatorsResult {
  if (candles.length < 50) {
    // Insufficient data for reliable indicators
    return {
      rsi: null,
      emaTrend: "neutral",
      macd: { hist: null, signal: null, macd: null },
      atr: null,
      adx: null
    };
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // Calculate EMAs
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  
  // Determine EMA trend
  let emaTrend: "bullish" | "bearish" | "mixed" | "neutral" = "neutral";
  if (ema20.length >= 2 && ema50.length >= 2) {
    const ema20Current = ema20[ema20.length - 1];
    const ema50Current = ema50[ema50.length - 1];
    const ema20Prev = ema20[ema20.length - 2];
    const ema50Prev = ema50[ema50.length - 2];
    
    if (ema20Current > ema50Current && ema20Prev > ema50Prev) {
      emaTrend = "bullish";
    } else if (ema20Current < ema50Current && ema20Prev < ema50Prev) {
      emaTrend = "bearish";
    } else {
      emaTrend = "mixed";
    }
  }

  // Calculate other indicators
  const rsi = calcRSI(closes, 14);
  const atr = calcATR(highs, lows, closes, 14);
  const adx = calcADX(highs, lows, closes, 14);
  const macd = calcMACD(closes);

  return {
    rsi: rsi !== null ? Math.round(rsi * 100) / 100 : null,
    emaTrend,
    macd: {
      hist: macd.hist !== null ? Math.round(macd.hist * 10000) / 10000 : null,
      signal: macd.signal !== null ? Math.round(macd.signal * 10000) / 10000 : null,
      macd: macd.macd !== null ? Math.round(macd.macd * 10000) / 10000 : null
    },
    atr: atr !== null ? Math.round(atr * 10000) / 10000 : null,
    adx: adx !== null ? Math.round(adx * 100) / 100 : null
  };
}
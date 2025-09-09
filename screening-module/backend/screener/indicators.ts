// Enhanced Indicators with ATR/ADX Support
import { IndicatorsResult } from "../../shared/schemas";

// EMA calculation
function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let ema: number[] = [];
  values.forEach((v, i) => {
    if (i === 0) ema.push(v);
    else ema.push(v * k + ema[i - 1] * (1 - k));
  });
  return ema;
}

// RSI calculation  
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

// ATR (Average True Range) calculation
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

// ADX (Average Directional Index) calculation
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

// MACD calculation (simplified)
function calcMACD(values: number[]) {
  if (values.length < 26) return { macd: null, signal: null, hist: null };
  
  const ema12 = calcEMA(values, 12);
  const ema26 = calcEMA(values, 26);
  
  if (ema12.length < 26 || ema26.length < 26) return { macd: null, signal: null, hist: null };
  
  const macd = ema12[ema12.length - 1] - ema26[ema26.length - 1];
  // Simplified signal line (would typically be EMA of MACD)
  const signal = macd * 0.9; // approximation
  const hist = macd - signal;
  
  return { macd, signal, hist };
}

// Main indicators computation function
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
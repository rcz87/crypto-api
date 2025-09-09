/**
 * Technical Indicators Module untuk Screening System
 * Implementasi indicator-indicator teknikal untuk analisis confluence
 */

export type Candle = { 
  time: number; 
  open: number; 
  high: number; 
  low: number; 
  close: number; 
  volume: number;
};

/**
 * Exponential Moving Average (EMA)
 */
export function ema(src: number[], period: number): number[] {
  if (src.length === 0 || period <= 0) return [];
  
  const k = 2 / (period + 1);
  let prev = src[0];
  
  return src.map((value, index) => {
    if (index === 0) return value;
    prev = value * k + prev * (1 - k);
    return prev;
  });
}

/**
 * Relative Strength Index (RSI)
 */
export function rsi(close: number[], period = 14): number[] {
  if (close.length <= period) return new Array(close.length).fill(50);
  
  const changes = close.slice(1).map((price, i) => price - close[i]);
  const gains = changes.map(change => Math.max(0, change));
  const losses = changes.map(change => Math.max(0, -change));
  
  // Initial average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  const rsiValues = new Array(period + 1).fill(50);
  
  // Calculate RSI values
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsiValue = 100 - (100 / (1 + rs));
    rsiValues.push(rsiValue);
  }
  
  return rsiValues;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function macd(close: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = ema(close, fastPeriod);
  const slowEMA = ema(close, slowPeriod);
  
  const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
  const signalLine = ema(macdLine.slice(slowPeriod - 1), signalPeriod);
  
  // Pad signal line dengan nilai awal
  const paddedSignal = new Array(slowPeriod - 1).fill(0).concat(signalLine);
  const histogram = macdLine.map((macd, i) => macd - (paddedSignal[i] || 0));
  
  return {
    macd: macdLine,
    signal: paddedSignal,
    histogram
  };
}

/**
 * Bollinger Bands
 */
export function bollingerBands(close: number[], period = 20, stdDev = 2) {
  const sma = simpleMovingAverage(close, period);
  const bands = close.map((price, index) => {
    if (index < period - 1) {
      return { upper: price, middle: price, lower: price };
    }
    
    const slice = close.slice(index - period + 1, index + 1);
    const mean = slice.reduce((a, b) => a + b) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma[index] + (standardDeviation * stdDev),
      middle: sma[index],
      lower: sma[index] - (standardDeviation * stdDev)
    };
  });
  
  return bands;
}

/**
 * Simple Moving Average (SMA)
 */
export function simpleMovingAverage(src: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < src.length; i++) {
    if (i < period - 1) {
      result.push(src[i]);
    } else {
      const sum = src.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  
  return result;
}

/**
 * Average True Range (ATR)
 */
export function atr(candles: Candle[], period = 14): number[] {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    
    const prevClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose)
    );
  });
  
  return ema(trueRanges, period);
}

/**
 * Stochastic Oscillator
 */
export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): { k: number[], d: number[] } {
  const kValues: number[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(50);
      continue;
    }
    
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...slice.map(c => c.high));
    const lowestLow = Math.min(...slice.map(c => c.low));
    const currentClose = candles[i].close;
    
    const kValue = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    kValues.push(kValue);
  }
  
  const dValues = simpleMovingAverage(kValues, dPeriod);
  
  return { k: kValues, d: dValues };
}

/**
 * Volume Weighted Average Price (VWAP)
 */
export function vwap(candles: Candle[]): number[] {
  let cumulativeVolumePrice = 0;
  let cumulativeVolume = 0;
  
  return candles.map(candle => {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeVolumePrice += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;
    
    return cumulativeVolume > 0 ? cumulativeVolumePrice / cumulativeVolume : typicalPrice;
  });
}

/**
 * Divergence Detection untuk RSI dan MACD
 */
export function detectDivergence(prices: number[], indicator: number[], lookback = 5): {
  type: 'bullish' | 'bearish' | 'none';
  strength: number;
  confirmation: boolean;
} {
  if (prices.length < lookback * 2) {
    return { type: 'none', strength: 0, confirmation: false };
  }
  
  const recentPrices = prices.slice(-lookback);
  const recentIndicator = indicator.slice(-lookback);
  
  const priceDirection = recentPrices[recentPrices.length - 1] - recentPrices[0];
  const indicatorDirection = recentIndicator[recentIndicator.length - 1] - recentIndicator[0];
  
  // Bullish divergence: price down, indicator up
  if (priceDirection < 0 && indicatorDirection > 0) {
    const strength = Math.abs(indicatorDirection) / Math.abs(priceDirection);
    return {
      type: 'bullish',
      strength: Math.min(strength, 1),
      confirmation: strength > 0.5
    };
  }
  
  // Bearish divergence: price up, indicator down
  if (priceDirection > 0 && indicatorDirection < 0) {
    const strength = Math.abs(indicatorDirection) / Math.abs(priceDirection);
    return {
      type: 'bearish',
      strength: Math.min(strength, 1),
      confirmation: strength > 0.5
    };
  }
  
  return { type: 'none', strength: 0, confirmation: false };
}

/**
 * EMA Confluence Analysis
 */
export function analyzeEMAConfluence(close: number[]): {
  score: number;
  reasons: string[];
  trend: 'bullish' | 'bearish' | 'neutral';
} {
  const ema20 = ema(close, 20);
  const ema50 = ema(close, 50);
  const ema200 = ema(close, 200);
  
  const lastIndex = close.length - 1;
  const currentPrice = close[lastIndex];
  const current20 = ema20[lastIndex];
  const current50 = ema50[lastIndex];
  const current200 = ema200[lastIndex];
  
  let score = 0;
  const reasons: string[] = [];
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  
  // EMA alignment (Golden Cross pattern)
  if (current20 > current50 && current50 > current200) {
    score += 6;
    reasons.push("Bullish EMA alignment");
    trend = 'bullish';
    
    // Bonus jika price di atas semua EMA
    if (currentPrice > current20) {
      score += 2;
      reasons.push("Price above all EMAs");
    }
  } else if (current20 < current50 && current50 < current200) {
    score -= 6;
    reasons.push("Bearish EMA alignment");
    trend = 'bearish';
    
    // Penalty jika price di bawah semua EMA
    if (currentPrice < current20) {
      score -= 2;
      reasons.push("Price below all EMAs");
    }
  }
  
  // EMA bounce/rejection
  const priceToEMA20Distance = Math.abs(currentPrice - current20) / current20;
  if (priceToEMA20Distance < 0.01) { // Within 1% of EMA20
    if (trend === 'bullish' && currentPrice > current20) {
      score += 1;
      reasons.push("EMA20 support bounce");
    } else if (trend === 'bearish' && currentPrice < current20) {
      score -= 1;
      reasons.push("EMA20 resistance rejection");
    }
  }
  
  return { score, reasons, trend };
}

/**
 * RSI dan MACD Momentum Analysis
 */
export function analyzeMomentum(candles: Candle[]): {
  score: number;
  reasons: string[];
} {
  const close = candles.map(c => c.close);
  const rsiValues = rsi(close, 14);
  const macdData = macd(close);
  
  let score = 0;
  const reasons: string[] = [];
  
  const currentRSI = rsiValues[rsiValues.length - 1];
  const currentMACD = macdData.macd[macdData.macd.length - 1];
  const currentSignal = macdData.signal[macdData.signal.length - 1];
  const currentHistogram = macdData.histogram[macdData.histogram.length - 1];
  
  // RSI Analysis
  if (currentRSI > 50 && currentRSI < 70) {
    score += 3;
    reasons.push("RSI bullish momentum");
  } else if (currentRSI < 50 && currentRSI > 30) {
    score -= 3;
    reasons.push("RSI bearish momentum");
  } else if (currentRSI >= 70) {
    score -= 1;
    reasons.push("RSI overbought");
  } else if (currentRSI <= 30) {
    score += 1;
    reasons.push("RSI oversold");
  }
  
  // MACD Analysis
  if (currentMACD > currentSignal && currentHistogram > 0) {
    score += 3;
    reasons.push("MACD bullish crossover");
  } else if (currentMACD < currentSignal && currentHistogram < 0) {
    score -= 3;
    reasons.push("MACD bearish crossover");
  }
  
  // Divergence Analysis
  const rsiDivergence = detectDivergence(close.slice(-10), rsiValues.slice(-10));
  if (rsiDivergence.type === 'bullish' && rsiDivergence.confirmation) {
    score += 2;
    reasons.push("RSI bullish divergence");
  } else if (rsiDivergence.type === 'bearish' && rsiDivergence.confirmation) {
    score -= 2;
    reasons.push("RSI bearish divergence");
  }
  
  return { score, reasons };
}
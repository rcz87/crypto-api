import { CandleData } from "@shared/schema";

export interface RSIResult {
  value: number;
  signal: 'oversold' | 'overbought' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  divergence: boolean;
  timestamp: string;
}

export interface EMAResult {
  period: number;
  value: number;
  timestamp: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  slope: number;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  crossover: 'bullish' | 'bearish' | 'neutral';
  timestamp: string;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number; // SMA
  lower: number;
  bandwidth: number;
  squeeze: boolean;
  position: 'above' | 'below' | 'inside';
  signal: 'overbought' | 'oversold' | 'neutral';
  timestamp: string;
}

export interface StochasticResult {
  k: number; // %K (fast stochastic)
  d: number; // %D (slow stochastic)
  signal: 'overbought' | 'oversold' | 'neutral';
  crossover: 'bullish' | 'bearish' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  timestamp: string;
}

export interface CCIResult {
  value: number;
  signal: 'overbought' | 'oversold' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  trend: 'bullish' | 'bearish' | 'neutral';
  extremeLevel: boolean; // Beyond +/-200
  timestamp: string;
}

export interface ParabolicSARResult {
  sar: number;
  trend: 'bullish' | 'bearish';
  reversal: boolean;
  acceleration: number;
  signal: 'buy' | 'sell' | 'hold';
  strength: 'weak' | 'moderate' | 'strong';
  timestamp: string;
}

export interface IchimokuResult {
  tenkanSen: number; // Conversion Line (9-period)
  kijunSen: number; // Base Line (26-period)
  senkouSpanA: number; // Leading Span A
  senkouSpanB: number; // Leading Span B
  chikouSpan: number; // Lagging Span
  cloud: {
    color: 'bullish' | 'bearish' | 'neutral';
    thickness: number;
    support: number;
    resistance: number;
  };
  signal: 'strong_buy' | 'buy' | 'sell' | 'strong_sell' | 'neutral';
  trend: 'bullish' | 'bearish' | 'neutral';
  timestamp: string;
}

export interface OBVResult {
  value: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  divergence: boolean;
  signal: 'accumulation' | 'distribution' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  timestamp: string;
}

export interface WilliamsRResult {
  value: number;
  signal: 'overbought' | 'oversold' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  momentum: 'increasing' | 'decreasing' | 'stable';
  extremeLevel: boolean; // Beyond -80/+80
  timestamp: string;
}

export interface TechnicalSignal {
  type: 'rsi_oversold' | 'rsi_overbought' | 'ema_crossover' | 'ema_divergence' | 'momentum_shift' | 'macd_crossover' | 'bollinger_squeeze' | 'stochastic_signal' | 'cci_extreme' | 'parabolic_sar_reversal' | 'ichimoku_signal' | 'obv_divergence' | 'williams_r_extreme';
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number;
  timestamp: string;
  description: string;
  timeframe: string;
}

export interface TechnicalIndicatorsAnalysis {
  timeframe: string;
  
  // RSI Analysis
  rsi: {
    current: number;
    period: number;
    signal: 'oversold' | 'overbought' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    trend: 'bullish' | 'bearish' | 'neutral';
    divergence: {
      detected: boolean;
      type?: 'bullish' | 'bearish';
      strength?: 'weak' | 'moderate' | 'strong';
    };
    historical: RSIResult[];
  };
  
  // EMA Analysis
  ema: {
    fast: EMAResult; // 12-period
    slow: EMAResult; // 26-period
    signal: EMAResult; // 9-period signal line
    crossover: {
      status: 'golden_cross' | 'death_cross' | 'neutral';
      strength: 'weak' | 'moderate' | 'strong';
      timestamp: string;
      confidence: number;
    };
    trend: {
      direction: 'bullish' | 'bearish' | 'neutral';
      strength: 'weak' | 'moderate' | 'strong';
      duration: string;
      consistency: number; // 0-100
    };
  };

  // MACD Analysis
  macd: {
    current: MACDResult;
    signal: 'bullish' | 'bearish' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    crossover: {
      detected: boolean;
      type: 'bullish' | 'bearish' | 'neutral';
      strength: 'weak' | 'moderate' | 'strong';
      timestamp: string;
    };
    divergence: {
      detected: boolean;
      type?: 'bullish' | 'bearish';
    };
    historical: MACDResult[];
  };

  // Bollinger Bands Analysis
  bollingerBands: {
    current: BollingerBandsResult;
    squeeze: {
      active: boolean;
      duration: number;
      strength: 'weak' | 'moderate' | 'strong';
    };
    breakout: {
      detected: boolean;
      direction: 'bullish' | 'bearish' | 'neutral';
      strength: 'weak' | 'moderate' | 'strong';
    };
    meanReversion: {
      signal: 'buy' | 'sell' | 'neutral';
      confidence: number;
    };
    historical: BollingerBandsResult[];
  };

  // Stochastic Analysis
  stochastic: {
    current: StochasticResult;
    signal: 'overbought' | 'oversold' | 'neutral';
    crossover: {
      detected: boolean;
      type: 'bullish' | 'bearish' | 'neutral';
      strength: 'weak' | 'moderate' | 'strong';
    };
    divergence: {
      detected: boolean;
      type?: 'bullish' | 'bearish';
    };
    historical: StochasticResult[];
  };

  // Enhanced Indicators (Phase 1 Roadmap)
  
  // CCI Analysis  
  cci: {
    current: CCIResult;
    signal: 'overbought' | 'oversold' | 'neutral';
    extremeLevel: {
      active: boolean;
      type: 'extreme_overbought' | 'extreme_oversold' | 'normal';
      strength: 'weak' | 'moderate' | 'strong';
    };
    trend: {
      direction: 'bullish' | 'bearish' | 'neutral';
      consistency: number;
    };
    historical: CCIResult[];
  };

  // Parabolic SAR Analysis
  parabolicSAR: {
    current: ParabolicSARResult;
    trend: 'bullish' | 'bearish';
    reversal: {
      detected: boolean;
      strength: 'weak' | 'moderate' | 'strong';
      confidence: number;
    };
    acceleration: {
      current: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
    historical: ParabolicSARResult[];
  };

  // Ichimoku Cloud Analysis
  ichimoku: {
    current: IchimokuResult;
    cloud: {
      position: 'above' | 'below' | 'inside';
      color: 'bullish' | 'bearish' | 'neutral';
      thickness: number;
      strength: 'weak' | 'moderate' | 'strong';
    };
    signals: {
      tkCross: 'bullish' | 'bearish' | 'neutral';
      priceCloud: 'bullish' | 'bearish' | 'neutral';
      chikouSpan: 'bullish' | 'bearish' | 'neutral';
      overall: 'strong_buy' | 'buy' | 'sell' | 'strong_sell' | 'neutral';
    };
    historical: IchimokuResult[];
  };

  // OBV Analysis
  obv: {
    current: OBVResult;
    trend: 'bullish' | 'bearish' | 'neutral';
    divergence: {
      detected: boolean;
      type?: 'bullish' | 'bearish';
      strength?: 'weak' | 'moderate' | 'strong';
    };
    institutionalFlow: {
      signal: 'accumulation' | 'distribution' | 'neutral';
      strength: 'weak' | 'moderate' | 'strong';
      confidence: number;
    };
    historical: OBVResult[];
  };

  // Williams %R Analysis
  williamsR: {
    current: WilliamsRResult;
    signal: 'overbought' | 'oversold' | 'neutral';
    momentum: {
      direction: 'increasing' | 'decreasing' | 'stable';
      strength: 'weak' | 'moderate' | 'strong';
    };
    extremeLevel: {
      active: boolean;
      type: 'extreme_overbought' | 'extreme_oversold' | 'normal';
    };
    historical: WilliamsRResult[];
  };
  
  // Combined Signals
  signals: TechnicalSignal[];
  
  // Momentum Analysis
  momentum: {
    overall: 'bullish' | 'bearish' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    rsiContribution: number; // 0-100
    emaContribution: number; // 0-100
    confluenceScore: number; // 0-100
  };
  
  // Confidence and Quality
  confidence: {
    overall: number;
    rsiQuality: number;
    emaQuality: number;
    dataPoints: number;
    timeframeSynergy: number;
  };
  
  // Alerts and Recommendations
  alerts: {
    type: 'entry' | 'exit' | 'warning' | 'confirmation';
    priority: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
    actionRequired: boolean;
  }[];
  
  // Metadata
  lastUpdate: string;
  dataAge: number;
  calculationTime: number;
}

export class TechnicalIndicatorsService {
  
  /**
   * Calculate RSI (Relative Strength Index) with advanced analysis
   */
  calculateRSI(candles: CandleData[], period: number = 14): RSIResult[] {
    if (candles.length < period + 1) {
      return [];
    }

    const closes = candles.map(c => parseFloat(c.close));
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const results: RSIResult[] = [];
    
    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
    
    for (let i = period; i < candles.length; i++) {
      // Smoothed moving average
      if (i > period) {
        avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
      }
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      
      // Determine signal
      let signal: 'oversold' | 'overbought' | 'neutral';
      let strength: 'weak' | 'moderate' | 'strong';
      
      if (rsi <= 30) {
        signal = 'oversold';
        strength = rsi <= 20 ? 'strong' : rsi <= 25 ? 'moderate' : 'weak';
      } else if (rsi >= 70) {
        signal = 'overbought';
        strength = rsi >= 80 ? 'strong' : rsi >= 75 ? 'moderate' : 'weak';
      } else {
        signal = 'neutral';
        strength = Math.abs(rsi - 50) > 15 ? 'moderate' : 'weak';
      }
      
      results.push({
        value: Math.round(rsi * 100) / 100,
        signal,
        strength,
        divergence: false, // Will be calculated separately
        timestamp: candles[i].timestamp
      });
    }
    
    return results;
  }
  
  /**
   * Calculate EMA (Exponential Moving Average)
   */
  calculateEMA(candles: CandleData[], period: number): EMAResult[] {
    if (candles.length < period) {
      return [];
    }

    const closes = candles.map(c => parseFloat(c.close));
    const multiplier = 2 / (period + 1);
    const results: EMAResult[] = [];
    
    // Start with SMA for first value
    let ema = closes.slice(0, period).reduce((sum, close) => sum + close, 0) / period;
    
    for (let i = period - 1; i < candles.length; i++) {
      if (i > period - 1) {
        ema = (closes[i] * multiplier) + (ema * (1 - multiplier));
      }
      
      // Calculate slope (trend direction)
      let slope = 0;
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      
      if (results.length > 0) {
        const prevEma = results[results.length - 1].value;
        slope = ((ema - prevEma) / prevEma) * 100;
        
        if (slope > 0.1) trend = 'bullish';
        else if (slope < -0.1) trend = 'bearish';
      }
      
      results.push({
        period,
        value: Math.round(ema * 100) / 100,
        timestamp: candles[i].timestamp,
        trend,
        slope: Math.round(slope * 1000) / 1000
      });
    }
    
    return results;
  }
  
  /**
   * Detect EMA crossovers
   */
  detectEMACrossover(fastEMA: EMAResult[], slowEMA: EMAResult[]): {
    status: 'golden_cross' | 'death_cross' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    timestamp: string;
    confidence: number;
  } {
    if (fastEMA.length < 2 || slowEMA.length < 2) {
      return {
        status: 'neutral',
        strength: 'weak',
        timestamp: new Date().toISOString(),
        confidence: 0
      };
    }
    
    const latestFast = fastEMA[fastEMA.length - 1];
    const latestSlow = slowEMA[slowEMA.length - 1];
    const prevFast = fastEMA[fastEMA.length - 2];
    const prevSlow = slowEMA[slowEMA.length - 2];
    
    const currentCross = latestFast.value > latestSlow.value;
    const previousCross = prevFast.value > prevSlow.value;
    
    let status: 'golden_cross' | 'death_cross' | 'neutral' = 'neutral';
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    let confidence = 0;
    
    // Detect crossover
    if (currentCross && !previousCross) {
      status = 'golden_cross';
      const separation = Math.abs(latestFast.value - latestSlow.value);
      const percentage = (separation / latestSlow.value) * 100;
      
      if (percentage > 2) strength = 'strong';
      else if (percentage > 1) strength = 'moderate';
      
      confidence = Math.min(95, 50 + (percentage * 20));
    } else if (!currentCross && previousCross) {
      status = 'death_cross';
      const separation = Math.abs(latestFast.value - latestSlow.value);
      const percentage = (separation / latestSlow.value) * 100;
      
      if (percentage > 2) strength = 'strong';
      else if (percentage > 1) strength = 'moderate';
      
      confidence = Math.min(95, 50 + (percentage * 20));
    }
    
    return {
      status,
      strength,
      timestamp: latestFast.timestamp,
      confidence: Math.round(confidence)
    };
  }
  
  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  calculateMACD(candles: CandleData[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDResult[] {
    if (candles.length < slowPeriod + signalPeriod) {
      return [];
    }

    const fastEMA = this.calculateEMA(candles, fastPeriod);
    const slowEMA = this.calculateEMA(candles, slowPeriod);
    
    if (fastEMA.length === 0 || slowEMA.length === 0) {
      return [];
    }

    // Calculate MACD line (fast EMA - slow EMA)
    const macdLine: { value: number; timestamp: string }[] = [];
    const startIndex = Math.max(0, fastEMA.length - slowEMA.length);
    
    for (let i = 0; i < slowEMA.length; i++) {
      const fastIndex = startIndex + i;
      if (fastIndex < fastEMA.length) {
        macdLine.push({
          value: fastEMA[fastIndex].value - slowEMA[i].value,
          timestamp: slowEMA[i].timestamp
        });
      }
    }

    // Calculate Signal line (EMA of MACD line)
    const signalLine: number[] = [];
    if (macdLine.length >= signalPeriod) {
      const multiplier = 2 / (signalPeriod + 1);
      let ema = macdLine.slice(0, signalPeriod).reduce((sum, val) => sum + val.value, 0) / signalPeriod;
      
      for (let i = signalPeriod - 1; i < macdLine.length; i++) {
        if (i > signalPeriod - 1) {
          ema = (macdLine[i].value * multiplier) + (ema * (1 - multiplier));
        }
        signalLine.push(ema);
      }
    }

    const results: MACDResult[] = [];
    const signalStartIndex = macdLine.length - signalLine.length;

    for (let i = 0; i < signalLine.length; i++) {
      const macdIndex = signalStartIndex + i;
      const macdValue = macdLine[macdIndex].value;
      const signalValue = signalLine[i];
      const histogram = macdValue - signalValue;

      // Determine trend and crossover
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      let crossover: 'bullish' | 'bearish' | 'neutral' = 'neutral';

      if (histogram > 0) trend = 'bullish';
      else if (histogram < 0) trend = 'bearish';

      // Detect crossover
      if (i > 0) {
        const prevMacd = macdLine[signalStartIndex + i - 1].value;
        const prevSignal = signalLine[i - 1];
        const prevHistogram = prevMacd - prevSignal;

        if (histogram > 0 && prevHistogram <= 0) crossover = 'bullish';
        else if (histogram < 0 && prevHistogram >= 0) crossover = 'bearish';
      }

      results.push({
        macd: Math.round(macdValue * 10000) / 10000,
        signal: Math.round(signalValue * 10000) / 10000,
        histogram: Math.round(histogram * 10000) / 10000,
        trend,
        crossover,
        timestamp: macdLine[macdIndex].timestamp
      });
    }

    return results;
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(candles: CandleData[], period: number = 20, standardDeviations: number = 2): BollingerBandsResult[] {
    if (candles.length < period) {
      return [];
    }

    const closes = candles.map(c => parseFloat(c.close));
    const results: BollingerBandsResult[] = [];

    for (let i = period - 1; i < candles.length; i++) {
      const slice = closes.slice(i - period + 1, i + 1);
      const sma = slice.reduce((sum, close) => sum + close, 0) / period;
      
      // Calculate standard deviation
      const variance = slice.reduce((sum, close) => sum + Math.pow(close - sma, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      
      const upperBand = sma + (stdDev * standardDeviations);
      const lowerBand = sma - (stdDev * standardDeviations);
      const bandwidth = ((upperBand - lowerBand) / sma) * 100;
      const currentPrice = closes[i];

      // Determine position and signals
      let position: 'above' | 'below' | 'inside' = 'inside';
      let signal: 'overbought' | 'oversold' | 'neutral' = 'neutral';
      
      if (currentPrice > upperBand) {
        position = 'above';
        signal = 'overbought';
      } else if (currentPrice < lowerBand) {
        position = 'below';
        signal = 'oversold';
      }

      // Detect squeeze (narrow bands)
      const squeeze = bandwidth < 10; // Threshold for squeeze

      results.push({
        upper: Math.round(upperBand * 100) / 100,
        middle: Math.round(sma * 100) / 100,
        lower: Math.round(lowerBand * 100) / 100,
        bandwidth: Math.round(bandwidth * 100) / 100,
        squeeze,
        position,
        signal,
        timestamp: candles[i].timestamp
      });
    }

    return results;
  }

  /**
   * Calculate CCI (Commodity Channel Index)
   */
  calculateCCI(candles: CandleData[], period: number = 20): CCIResult[] {
    if (candles.length < period) {
      return [];
    }

    const results: CCIResult[] = [];
    
    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);
      
      // Calculate typical prices (HLC/3)
      const typicalPrices = slice.map(candle => 
        (parseFloat(candle.high) + parseFloat(candle.low) + parseFloat(candle.close)) / 3
      );
      
      // Calculate simple moving average of typical prices
      const sma = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;
      
      // Calculate mean deviation
      const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
      
      // Calculate CCI
      const currentTypicalPrice = typicalPrices[typicalPrices.length - 1];
      const cci = (currentTypicalPrice - sma) / (0.015 * meanDeviation);
      
      // Determine signals
      let signal: 'overbought' | 'oversold' | 'neutral' = 'neutral';
      let strength: 'weak' | 'moderate' | 'strong' = 'weak';
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      
      if (cci > 100) {
        signal = 'overbought';
        strength = cci > 200 ? 'strong' : cci > 150 ? 'moderate' : 'weak';
        trend = 'bullish';
      } else if (cci < -100) {
        signal = 'oversold';
        strength = cci < -200 ? 'strong' : cci < -150 ? 'moderate' : 'weak';
        trend = 'bearish';
      } else if (cci > 0) {
        trend = 'bullish';
      } else if (cci < 0) {
        trend = 'bearish';
      }
      
      const extremeLevel = Math.abs(cci) > 200;
      
      results.push({
        value: Math.round(cci * 100) / 100,
        signal,
        strength,
        trend,
        extremeLevel,
        timestamp: candles[i].timestamp
      });
    }
    
    return results;
  }

  /**
   * Calculate Parabolic SAR
   */
  calculateParabolicSAR(candles: CandleData[], initialAF: number = 0.02, maxAF: number = 0.2): ParabolicSARResult[] {
    if (candles.length < 2) {
      return [];
    }

    const results: ParabolicSARResult[] = [];
    let isUpTrend = parseFloat(candles[1].close) > parseFloat(candles[0].close);
    let sar = parseFloat(candles[0][isUpTrend ? 'low' : 'high']);
    let extremePoint = parseFloat(candles[0][isUpTrend ? 'high' : 'low']);
    let af = initialAF;

    for (let i = 1; i < candles.length; i++) {
      const high = parseFloat(candles[i].high);
      const low = parseFloat(candles[i].low);
      const close = parseFloat(candles[i].close);
      
      // Calculate next SAR
      const nextSAR = sar + af * (extremePoint - sar);
      
      let reversal = false;
      let signal: 'buy' | 'sell' | 'hold' = 'hold';
      
      if (isUpTrend) {
        // Check for trend reversal
        if (low <= nextSAR) {
          isUpTrend = false;
          sar = extremePoint;
          extremePoint = low;
          af = initialAF;
          reversal = true;
          signal = 'sell';
        } else {
          sar = nextSAR;
          if (high > extremePoint) {
            extremePoint = high;
            af = Math.min(af + initialAF, maxAF);
          }
        }
      } else {
        // Check for trend reversal
        if (high >= nextSAR) {
          isUpTrend = true;
          sar = extremePoint;
          extremePoint = high;
          af = initialAF;
          reversal = true;
          signal = 'buy';
        } else {
          sar = nextSAR;
          if (low < extremePoint) {
            extremePoint = low;
            af = Math.min(af + initialAF, maxAF);
          }
        }
      }
      
      // Determine strength based on distance and acceleration
      let strength: 'weak' | 'moderate' | 'strong' = 'weak';
      const distance = Math.abs(close - sar) / close;
      
      if (distance > 0.05) strength = 'strong';
      else if (distance > 0.02) strength = 'moderate';
      
      results.push({
        sar: Math.round(sar * 100) / 100,
        trend: isUpTrend ? 'bullish' : 'bearish',
        reversal,
        acceleration: Math.round(af * 10000) / 10000,
        signal,
        strength,
        timestamp: candles[i].timestamp
      });
    }
    
    return results;
  }

  /**
   * Calculate Williams %R
   */
  calculateWilliamsR(candles: CandleData[], period: number = 14): WilliamsRResult[] {
    if (candles.length < period) {
      return [];
    }

    const results: WilliamsRResult[] = [];
    
    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);
      const highs = slice.map(c => parseFloat(c.high));
      const lows = slice.map(c => parseFloat(c.low));
      const currentClose = parseFloat(candles[i].close);
      
      const highestHigh = Math.max(...highs);
      const lowestLow = Math.min(...lows);
      
      // Williams %R formula: (Highest High - Close) / (Highest High - Lowest Low) * -100
      const williamsR = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
      
      // Determine signals
      let signal: 'overbought' | 'oversold' | 'neutral' = 'neutral';
      let strength: 'weak' | 'moderate' | 'strong' = 'weak';
      
      if (williamsR > -20) {
        signal = 'overbought';
        strength = williamsR > -10 ? 'strong' : williamsR > -15 ? 'moderate' : 'weak';
      } else if (williamsR < -80) {
        signal = 'oversold';
        strength = williamsR < -90 ? 'strong' : williamsR < -85 ? 'moderate' : 'weak';
      }
      
      // Determine momentum
      let momentum: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (results.length > 0) {
        const prevValue = results[results.length - 1].value;
        if (williamsR > prevValue + 2) momentum = 'increasing';
        else if (williamsR < prevValue - 2) momentum = 'decreasing';
      }
      
      const extremeLevel = williamsR > -10 || williamsR < -90;
      
      results.push({
        value: Math.round(williamsR * 100) / 100,
        signal,
        strength,
        momentum,
        extremeLevel,
        timestamp: candles[i].timestamp
      });
    }
    
    return results;
  }

  /**
   * Calculate OBV (On Balance Volume)
   */
  calculateOBV(candles: CandleData[]): OBVResult[] {
    if (candles.length < 2) {
      return [];
    }

    const results: OBVResult[] = [];
    let obvValue = 0;
    
    for (let i = 1; i < candles.length; i++) {
      const currentClose = parseFloat(candles[i].close);
      const prevClose = parseFloat(candles[i - 1].close);
      const volume = parseFloat(candles[i].volume || '1'); // Default volume if not available
      
      // OBV calculation
      if (currentClose > prevClose) {
        obvValue += volume;
      } else if (currentClose < prevClose) {
        obvValue -= volume;
      }
      // If prices are equal, OBV remains unchanged
      
      // Determine trend
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      let signal: 'accumulation' | 'distribution' | 'neutral' = 'neutral';
      let strength: 'weak' | 'moderate' | 'strong' = 'weak';
      
      if (results.length > 5) {
        const recentOBV = results.slice(-5).map(r => r.value);
        const obvTrend = obvValue - recentOBV[0];
        const priceChange = currentClose - parseFloat(candles[i - 5].close);
        
        // Determine trend and signals
        if (obvTrend > 0) {
          trend = 'bullish';
          signal = 'accumulation';
          strength = obvTrend > recentOBV[0] * 0.1 ? 'strong' : obvTrend > recentOBV[0] * 0.05 ? 'moderate' : 'weak';
        } else if (obvTrend < 0) {
          trend = 'bearish';
          signal = 'distribution';
          strength = Math.abs(obvTrend) > Math.abs(recentOBV[0]) * 0.1 ? 'strong' : Math.abs(obvTrend) > Math.abs(recentOBV[0]) * 0.05 ? 'moderate' : 'weak';
        }
        
        // Check for divergence (simplified)
        const divergence = (obvTrend > 0 && priceChange < 0) || (obvTrend < 0 && priceChange > 0);
        
        results.push({
          value: Math.round(obvValue),
          trend,
          divergence,
          signal,
          strength,
          timestamp: candles[i].timestamp
        });
      } else {
        results.push({
          value: Math.round(obvValue),
          trend,
          divergence: false,
          signal,
          strength,
          timestamp: candles[i].timestamp
        });
      }
    }
    
    return results;
  }

  /**
   * Calculate Ichimoku Cloud
   */
  calculateIchimoku(candles: CandleData[], conversionPeriod: number = 9, basePeriod: number = 26, spanBPeriod: number = 52): IchimokuResult[] {
    if (candles.length < Math.max(conversionPeriod, basePeriod, spanBPeriod) + 26) {
      return [];
    }

    const results: IchimokuResult[] = [];
    
    for (let i = spanBPeriod - 1; i < candles.length; i++) {
      // Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
      const conversionSlice = candles.slice(i - conversionPeriod + 1, i + 1);
      const conversionHigh = Math.max(...conversionSlice.map(c => parseFloat(c.high)));
      const conversionLow = Math.min(...conversionSlice.map(c => parseFloat(c.low)));
      const tenkanSen = (conversionHigh + conversionLow) / 2;

      // Kijun-sen (Base Line): (26-period high + 26-period low) / 2
      const baseSlice = candles.slice(i - basePeriod + 1, i + 1);
      const baseHigh = Math.max(...baseSlice.map(c => parseFloat(c.high)));
      const baseLow = Math.min(...baseSlice.map(c => parseFloat(c.low)));
      const kijunSen = (baseHigh + baseLow) / 2;

      // Senkou Span A (Leading Span A): (Tenkan-sen + Kijun-sen) / 2 projected 26 periods ahead
      const senkouSpanA = (tenkanSen + kijunSen) / 2;

      // Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2 projected 26 periods ahead
      const spanBSlice = candles.slice(i - spanBPeriod + 1, i + 1);
      const spanBHigh = Math.max(...spanBSlice.map(c => parseFloat(c.high)));
      const spanBLow = Math.min(...spanBSlice.map(c => parseFloat(c.low)));
      const senkouSpanB = (spanBHigh + spanBLow) / 2;

      // Chikou Span (Lagging Span): Current close projected 26 periods back
      const chikouIndex = i - 26;
      const chikouSpan = chikouIndex >= 0 ? parseFloat(candles[i].close) : parseFloat(candles[i].close);

      // Cloud analysis
      const cloudTop = Math.max(senkouSpanA, senkouSpanB);
      const cloudBottom = Math.min(senkouSpanA, senkouSpanB);
      const cloudThickness = Math.abs(senkouSpanA - senkouSpanB);
      const cloudColor: 'bullish' | 'bearish' | 'neutral' = 
        senkouSpanA > senkouSpanB ? 'bullish' : senkouSpanA < senkouSpanB ? 'bearish' : 'neutral';

      const currentPrice = parseFloat(candles[i].close);

      // Determine signals based on Ichimoku conditions
      let signal: 'strong_buy' | 'buy' | 'sell' | 'strong_sell' | 'neutral' = 'neutral';
      let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';

      // Price position relative to cloud
      const priceAboveCloud = currentPrice > cloudTop;
      const priceBelowCloud = currentPrice < cloudBottom;
      const priceInCloud = !priceAboveCloud && !priceBelowCloud;

      // TK Cross (Tenkan-Kijun Cross)
      const tkBullish = tenkanSen > kijunSen;
      const tkBearish = tenkanSen < kijunSen;

      // Chikou Span analysis
      const chikouAbovePrice = chikouIndex >= 0 ? chikouSpan > parseFloat(candles[chikouIndex].close) : false;
      const chikouBelowPrice = chikouIndex >= 0 ? chikouSpan < parseFloat(candles[chikouIndex].close) : false;

      // Signal determination (simplified Ichimoku strategy)
      if (priceAboveCloud && tkBullish && cloudColor === 'bullish') {
        signal = chikouAbovePrice ? 'strong_buy' : 'buy';
        trend = 'bullish';
      } else if (priceBelowCloud && tkBearish && cloudColor === 'bearish') {
        signal = chikouBelowPrice ? 'strong_sell' : 'sell';
        trend = 'bearish';
      } else if (priceAboveCloud) {
        trend = 'bullish';
      } else if (priceBelowCloud) {
        trend = 'bearish';
      }

      results.push({
        tenkanSen: Math.round(tenkanSen * 100) / 100,
        kijunSen: Math.round(kijunSen * 100) / 100,
        senkouSpanA: Math.round(senkouSpanA * 100) / 100,
        senkouSpanB: Math.round(senkouSpanB * 100) / 100,
        chikouSpan: Math.round(chikouSpan * 100) / 100,
        cloud: {
          color: cloudColor,
          thickness: Math.round(cloudThickness * 100) / 100,
          support: Math.round(cloudBottom * 100) / 100,
          resistance: Math.round(cloudTop * 100) / 100
        },
        signal,
        trend,
        timestamp: candles[i].timestamp
      });
    }

    return results;
  }

  /**
   * Calculate Stochastic Oscillator
   */
  calculateStochastic(candles: CandleData[], kPeriod: number = 14, dPeriod: number = 3): StochasticResult[] {
    if (candles.length < kPeriod + dPeriod) {
      return [];
    }

    const highs = candles.map(c => parseFloat(c.high));
    const lows = candles.map(c => parseFloat(c.low));
    const closes = candles.map(c => parseFloat(c.close));
    
    // Calculate %K values
    const kValues: number[] = [];
    
    for (let i = kPeriod - 1; i < candles.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
      const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
      const currentClose = closes[i];
      
      const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      kValues.push(k);
    }

    // Calculate %D values (SMA of %K)
    const results: StochasticResult[] = [];
    
    for (let i = dPeriod - 1; i < kValues.length; i++) {
      const kSlice = kValues.slice(i - dPeriod + 1, i + 1);
      const d = kSlice.reduce((sum, k) => sum + k, 0) / dPeriod;
      const k = kValues[i];

      // Determine signals
      let signal: 'overbought' | 'oversold' | 'neutral' = 'neutral';
      let strength: 'weak' | 'moderate' | 'strong' = 'weak';
      
      if (k > 80) {
        signal = 'overbought';
        strength = k > 90 ? 'strong' : k > 85 ? 'moderate' : 'weak';
      } else if (k < 20) {
        signal = 'oversold';
        strength = k < 10 ? 'strong' : k < 15 ? 'moderate' : 'weak';
      }

      // Detect crossover
      let crossover: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (i > 0) {
        const prevK = kValues[i - 1];
        const prevDSlice = kValues.slice(i - dPeriod, i);
        const prevD = prevDSlice.reduce((sum, k) => sum + k, 0) / dPeriod;

        if (k > d && prevK <= prevD) crossover = 'bullish';
        else if (k < d && prevK >= prevD) crossover = 'bearish';
      }

      const candleIndex = kPeriod - 1 + i;
      results.push({
        k: Math.round(k * 100) / 100,
        d: Math.round(d * 100) / 100,
        signal,
        crossover,
        strength,
        timestamp: candles[candleIndex].timestamp
      });
    }

    return results;
  }

  /**
   * Detect RSI divergences
   */
  detectRSIDivergence(rsiData: RSIResult[], priceData: CandleData[]): void {
    if (rsiData.length < 20 || priceData.length < 20) return;
    
    // Look for divergence in last 10 periods
    const recentRSI = rsiData.slice(-10);
    const recentPrices = priceData.slice(-10).map(c => parseFloat(c.close));
    
    // Find local peaks and troughs
    for (let i = 2; i < recentRSI.length - 2; i++) {
      const rsiCurrent = recentRSI[i].value;
      const priceCurrent = recentPrices[i];
      
      // Check for bullish divergence (price lower low, RSI higher low)
      if (rsiCurrent < 50) {
        const priceIsLowerLow = priceCurrent < Math.min(...recentPrices.slice(0, i));
        const rsiIsHigherLow = rsiCurrent > Math.min(...recentRSI.slice(0, i).map(r => r.value));
        
        if (priceIsLowerLow && rsiIsHigherLow) {
          recentRSI[i].divergence = true;
        }
      }
      
      // Check for bearish divergence (price higher high, RSI lower high)
      if (rsiCurrent > 50) {
        const priceIsHigherHigh = priceCurrent > Math.max(...recentPrices.slice(0, i));
        const rsiIsLowerHigh = rsiCurrent < Math.max(...recentRSI.slice(0, i).map(r => r.value));
        
        if (priceIsHigherHigh && rsiIsLowerHigh) {
          recentRSI[i].divergence = true;
        }
      }
    }
  }
  
  /**
   * Generate trading signals
   */
  generateSignals(rsi: RSIResult[], ema: any, timeframe: string): TechnicalSignal[] {
    const signals: TechnicalSignal[] = [];
    const timestamp = new Date().toISOString();
    
    if (rsi.length === 0) return signals;
    
    const latestRSI = rsi[rsi.length - 1];
    
    // RSI Oversold Signal
    if (latestRSI.signal === 'oversold' && latestRSI.strength !== 'weak') {
      signals.push({
        type: 'rsi_oversold',
        strength: latestRSI.strength,
        confidence: latestRSI.strength === 'strong' ? 85 : 70,
        timestamp,
        description: `RSI at ${latestRSI.value} indicates ${latestRSI.strength} oversold condition`,
        timeframe
      });
    }
    
    // RSI Overbought Signal
    if (latestRSI.signal === 'overbought' && latestRSI.strength !== 'weak') {
      signals.push({
        type: 'rsi_overbought',
        strength: latestRSI.strength,
        confidence: latestRSI.strength === 'strong' ? 85 : 70,
        timestamp,
        description: `RSI at ${latestRSI.value} indicates ${latestRSI.strength} overbought condition`,
        timeframe
      });
    }
    
    // EMA Crossover Signal
    if (ema.crossover.status !== 'neutral') {
      signals.push({
        type: 'ema_crossover',
        strength: ema.crossover.strength,
        confidence: ema.crossover.confidence,
        timestamp,
        description: `${ema.crossover.status.replace('_', ' ')} detected with ${ema.crossover.strength} strength`,
        timeframe
      });
    }
    
    return signals;
  }
  
  /**
   * Main analysis function
   */
  async analyzeTechnicalIndicators(
    candles: CandleData[], 
    timeframe: string = '1H'
  ): Promise<TechnicalIndicatorsAnalysis> {
    const startTime = Date.now();
    
    // Calculate RSI
    const rsiResults = this.calculateRSI(candles, 14);
    const currentRSI = rsiResults[rsiResults.length - 1];
    
    // Detect RSI divergences
    this.detectRSIDivergence(rsiResults, candles);
    
    // Calculate EMAs
    const fastEMA = this.calculateEMA(candles, 12);
    const slowEMA = this.calculateEMA(candles, 26);
    const signalEMA = this.calculateEMA(candles, 9);
    
    // Detect crossover
    const crossover = this.detectEMACrossover(fastEMA, slowEMA);

    // Calculate new indicators
    const macdResults = this.calculateMACD(candles, 12, 26, 9);
    const currentMACD = macdResults[macdResults.length - 1];
    
    const bollingerResults = this.calculateBollingerBands(candles, 20, 2);
    const currentBollinger = bollingerResults[bollingerResults.length - 1];
    
    const stochasticResults = this.calculateStochastic(candles, 14, 3);
    const currentStochastic = stochasticResults[stochasticResults.length - 1];
    
    // Calculate Enhanced Indicators (Phase 1 roadmap)
    const cciResults = this.calculateCCI(candles, 20);
    const currentCCI = cciResults[cciResults.length - 1];
    
    const parabolicSARResults = this.calculateParabolicSAR(candles, 0.02, 0.2);
    const currentParabolicSAR = parabolicSARResults[parabolicSARResults.length - 1];
    
    const ichimokuResults = this.calculateIchimoku(candles, 9, 26, 52);
    const currentIchimoku = ichimokuResults[ichimokuResults.length - 1];
    
    const obvResults = this.calculateOBV(candles);
    const currentOBV = obvResults[obvResults.length - 1];
    
    const williamsRResults = this.calculateWilliamsR(candles, 14);
    const currentWilliamsR = williamsRResults[williamsRResults.length - 1];
    
    // Generate signals
    const emaData = {
      fast: fastEMA[fastEMA.length - 1] || { period: 12, value: 0, timestamp: new Date().toISOString(), trend: 'neutral' as const, slope: 0 },
      slow: slowEMA[slowEMA.length - 1] || { period: 26, value: 0, timestamp: new Date().toISOString(), trend: 'neutral' as const, slope: 0 },
      signal: signalEMA[signalEMA.length - 1] || { period: 9, value: 0, timestamp: new Date().toISOString(), trend: 'neutral' as const, slope: 0 },
      crossover
    };
    
    const signals = this.generateSignals(rsiResults, { crossover }, timeframe);
    
    // Calculate momentum and confluence with new indicators
    const rsiContribution = currentRSI ? 
      (currentRSI.signal === 'oversold' ? 80 : currentRSI.signal === 'overbought' ? 20 : 50) : 50;
    
    const emaContribution = crossover.status === 'golden_cross' ? 80 : 
                           crossover.status === 'death_cross' ? 20 : 50;

    const macdContribution = currentMACD ? 
      (currentMACD.trend === 'bullish' ? 70 : currentMACD.trend === 'bearish' ? 30 : 50) : 50;

    const bollingerContribution = currentBollinger ?
      (currentBollinger.signal === 'oversold' ? 75 : currentBollinger.signal === 'overbought' ? 25 : 50) : 50;

    const stochasticContribution = currentStochastic ?
      (currentStochastic.signal === 'oversold' ? 75 : currentStochastic.signal === 'overbought' ? 25 : 50) : 50;

    // Enhanced indicators contributions
    const cciContribution = currentCCI ?
      (currentCCI.signal === 'oversold' ? 80 : currentCCI.signal === 'overbought' ? 20 : 50) : 50;

    const parabolicSARContribution = currentParabolicSAR ?
      (currentParabolicSAR.trend === 'bullish' ? 75 : 25) : 50;

    const ichimokuContribution = currentIchimoku ?
      (currentIchimoku.signal === 'strong_buy' ? 90 : 
       currentIchimoku.signal === 'buy' ? 70 :
       currentIchimoku.signal === 'sell' ? 30 :
       currentIchimoku.signal === 'strong_sell' ? 10 : 50) : 50;

    const obvContribution = currentOBV ?
      (currentOBV.signal === 'accumulation' ? 75 : currentOBV.signal === 'distribution' ? 25 : 50) : 50;

    const williamsRContribution = currentWilliamsR ?
      (currentWilliamsR.signal === 'oversold' ? 80 : currentWilliamsR.signal === 'overbought' ? 20 : 50) : 50;
    
    const confluenceScore = Math.round((rsiContribution + emaContribution + macdContribution + bollingerContribution + stochasticContribution + 
       cciContribution + parabolicSARContribution + ichimokuContribution + obvContribution + williamsRContribution) / 10);
    
    let overallMomentum: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let momentumStrength: 'weak' | 'moderate' | 'strong' = 'weak';
    
    if (confluenceScore > 70) {
      overallMomentum = 'bullish';
      momentumStrength = confluenceScore > 80 ? 'strong' : 'moderate';
    } else if (confluenceScore < 30) {
      overallMomentum = 'bearish';
      momentumStrength = confluenceScore < 20 ? 'strong' : 'moderate';
    }
    
    // Generate alerts
    const alerts: TechnicalIndicatorsAnalysis['alerts'] = [];
    
    if (currentRSI?.signal === 'oversold' && currentRSI.strength === 'strong') {
      alerts.push({
        type: 'entry',
        priority: 'high',
        message: 'Strong oversold condition detected - potential buying opportunity',
        timestamp: new Date().toISOString(),
        actionRequired: true
      });
    }
    
    if (crossover.status === 'golden_cross' && crossover.strength !== 'weak') {
      alerts.push({
        type: 'confirmation',
        priority: 'medium',
        message: `Golden cross confirmed with ${crossover.strength} strength`,
        timestamp: new Date().toISOString(),
        actionRequired: false
      });
    }
    
    const calculationTime = Date.now() - startTime;
    
    // Detect RSI trend
    let rsiTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (rsiResults.length >= 3) {
      const recent = rsiResults.slice(-3);
      const isRising = recent[2].value > recent[1].value && recent[1].value > recent[0].value;
      const isFalling = recent[2].value < recent[1].value && recent[1].value < recent[0].value;
      
      if (isRising) rsiTrend = 'bullish';
      else if (isFalling) rsiTrend = 'bearish';
    }
    
    return {
      timeframe,
      rsi: {
        current: currentRSI?.value || 50,
        period: 14,
        signal: currentRSI?.signal || 'neutral',
        strength: currentRSI?.strength || 'weak',
        trend: rsiTrend,
        divergence: {
          detected: currentRSI?.divergence || false,
          type: currentRSI?.divergence ? (currentRSI.value < 50 ? 'bullish' : 'bearish') : undefined,
          strength: currentRSI?.divergence ? 'moderate' : undefined,
        },
        historical: rsiResults.slice(-20) // Last 20 periods
      },
      ema: {
        ...emaData,
        trend: {
          direction: emaData.fast.trend,
          strength: Math.abs(emaData.fast.slope) > 1 ? 'strong' : Math.abs(emaData.fast.slope) > 0.5 ? 'moderate' : 'weak',
          duration: '1-3 periods', // Simplified
          consistency: Math.round(Math.abs(emaData.fast.slope) * 10)
        }
      },
      macd: {
        current: currentMACD || {
          macd: 0,
          signal: 0,
          histogram: 0,
          trend: 'neutral' as const,
          crossover: 'neutral' as const,
          timestamp: new Date().toISOString()
        },
        signal: currentMACD?.trend || 'neutral',
        strength: currentMACD ? (Math.abs(currentMACD.histogram) > 0.5 ? 'strong' : Math.abs(currentMACD.histogram) > 0.2 ? 'moderate' : 'weak') : 'weak',
        crossover: {
          detected: currentMACD?.crossover !== 'neutral',
          type: currentMACD?.crossover || 'neutral',
          strength: currentMACD?.crossover !== 'neutral' ? 'moderate' : 'weak',
          timestamp: currentMACD?.timestamp || new Date().toISOString()
        },
        divergence: {
          detected: false, // Will implement divergence detection later
          type: undefined
        },
        historical: macdResults.slice(-20)
      },
      bollingerBands: {
        current: currentBollinger || {
          upper: 0,
          middle: 0,
          lower: 0,
          bandwidth: 0,
          squeeze: false,
          position: 'inside' as const,
          signal: 'neutral' as const,
          timestamp: new Date().toISOString()
        },
        squeeze: {
          active: currentBollinger?.squeeze || false,
          duration: 1, // Simplified
          strength: currentBollinger?.squeeze ? 'moderate' : 'weak'
        },
        breakout: {
          detected: currentBollinger?.position !== 'inside',
          direction: currentBollinger?.position === 'above' ? 'bullish' : currentBollinger?.position === 'below' ? 'bearish' : 'neutral',
          strength: currentBollinger?.signal !== 'neutral' ? 'moderate' : 'weak'
        },
        meanReversion: {
          signal: currentBollinger?.signal === 'oversold' ? 'buy' : currentBollinger?.signal === 'overbought' ? 'sell' : 'neutral',
          confidence: currentBollinger?.signal !== 'neutral' ? 75 : 50
        },
        historical: bollingerResults.slice(-20)
      },
      stochastic: {
        current: currentStochastic || {
          k: 50,
          d: 50,
          signal: 'neutral' as const,
          crossover: 'neutral' as const,
          strength: 'weak' as const,
          timestamp: new Date().toISOString()
        },
        signal: currentStochastic?.signal || 'neutral',
        crossover: {
          detected: currentStochastic?.crossover !== 'neutral',
          type: currentStochastic?.crossover || 'neutral',
          strength: currentStochastic?.strength || 'weak'
        },
        divergence: {
          detected: false, // Will implement divergence detection later
          type: undefined
        },
        historical: stochasticResults.slice(-20)
      },

      // Enhanced Indicators Analysis (Phase 1 roadmap)
      cci: {
        current: currentCCI || {
          value: 0,
          signal: 'neutral' as const,
          strength: 'weak' as const,
          trend: 'neutral' as const,
          extremeLevel: false,
          timestamp: new Date().toISOString()
        },
        signal: currentCCI?.signal || 'neutral',
        extremeLevel: {
          active: currentCCI?.extremeLevel || false,
          type: currentCCI?.extremeLevel 
            ? (currentCCI.value > 200 ? 'extreme_overbought' : 'extreme_oversold')
            : 'normal',
          strength: currentCCI?.strength || 'weak'
        },
        trend: {
          direction: currentCCI?.trend || 'neutral',
          consistency: currentCCI ? Math.min(95, Math.abs(currentCCI.value) / 2) : 50
        },
        historical: cciResults.slice(-20)
      },

      parabolicSAR: {
        current: currentParabolicSAR || {
          sar: 0,
          trend: 'bullish' as const,
          reversal: false,
          acceleration: 0.02,
          signal: 'hold' as const,
          strength: 'weak' as const,
          timestamp: new Date().toISOString()
        },
        trend: currentParabolicSAR?.trend || 'bullish',
        reversal: {
          detected: currentParabolicSAR?.reversal || false,
          strength: currentParabolicSAR?.strength || 'weak',
          confidence: currentParabolicSAR?.reversal ? 80 : 50
        },
        acceleration: {
          current: currentParabolicSAR?.acceleration || 0.02,
          trend: 'stable' as const // Will implement acceleration trend detection
        },
        historical: parabolicSARResults.slice(-20)
      },

      ichimoku: {
        current: currentIchimoku || {
          tenkanSen: 0,
          kijunSen: 0,
          senkouSpanA: 0,
          senkouSpanB: 0,
          chikouSpan: 0,
          cloud: {
            color: 'neutral' as const,
            thickness: 0,
            support: 0,
            resistance: 0
          },
          signal: 'neutral' as const,
          trend: 'neutral' as const,
          timestamp: new Date().toISOString()
        },
        cloud: {
          position: currentIchimoku 
            ? (parseFloat(candles[candles.length - 1].close) > Math.max(currentIchimoku.senkouSpanA, currentIchimoku.senkouSpanB) ? 'above' 
               : parseFloat(candles[candles.length - 1].close) < Math.min(currentIchimoku.senkouSpanA, currentIchimoku.senkouSpanB) ? 'below' 
               : 'inside')
            : 'inside',
          color: currentIchimoku?.cloud.color || 'neutral',
          thickness: currentIchimoku?.cloud.thickness || 0,
          strength: currentIchimoku?.cloud.thickness > 1 ? 'strong' : currentIchimoku?.cloud.thickness > 0.5 ? 'moderate' : 'weak'
        },
        signals: {
          tkCross: currentIchimoku?.tenkanSen > currentIchimoku?.kijunSen ? 'bullish' : 'bearish',
          priceCloud: currentIchimoku?.trend || 'neutral',
          chikouSpan: 'neutral' as const, // Simplified
          overall: currentIchimoku?.signal || 'neutral'
        },
        historical: ichimokuResults.slice(-20)
      },

      obv: {
        current: currentOBV || {
          value: 0,
          trend: 'neutral' as const,
          divergence: false,
          signal: 'neutral' as const,
          strength: 'weak' as const,
          timestamp: new Date().toISOString()
        },
        trend: currentOBV?.trend || 'neutral',
        divergence: {
          detected: currentOBV?.divergence || false,
          type: currentOBV?.divergence ? (currentOBV.trend === 'bullish' ? 'bearish' : 'bullish') : undefined,
          strength: currentOBV?.strength
        },
        institutionalFlow: {
          signal: currentOBV?.signal || 'neutral',
          strength: currentOBV?.strength || 'weak',
          confidence: currentOBV?.signal !== 'neutral' ? 75 : 50
        },
        historical: obvResults.slice(-20)
      },

      williamsR: {
        current: currentWilliamsR || {
          value: -50,
          signal: 'neutral' as const,
          strength: 'weak' as const,
          momentum: 'stable' as const,
          extremeLevel: false,
          timestamp: new Date().toISOString()
        },
        signal: currentWilliamsR?.signal || 'neutral',
        momentum: {
          direction: currentWilliamsR?.momentum || 'stable',
          strength: currentWilliamsR?.strength || 'weak'
        },
        extremeLevel: {
          active: currentWilliamsR?.extremeLevel || false,
          type: currentWilliamsR?.extremeLevel 
            ? (currentWilliamsR.value > -10 ? 'extreme_overbought' : 'extreme_oversold')
            : 'normal'
        },
        historical: williamsRResults.slice(-20)
      },

      signals,
      momentum: {
        overall: overallMomentum,
        strength: momentumStrength,
        rsiContribution,
        emaContribution,
        confluenceScore
      },
      confidence: {
        overall: Math.round((85 + Math.min(95, candles.length * 2)) / 2),
        rsiQuality: Math.min(95, rsiResults.length * 3),
        emaQuality: Math.min(95, fastEMA.length * 3),
        dataPoints: candles.length,
        timeframeSynergy: 75
      },
      alerts,
      lastUpdate: new Date().toISOString(),
      dataAge: 0,
      calculationTime
    };
  }
}
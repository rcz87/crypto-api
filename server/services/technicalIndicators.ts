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

export interface TechnicalSignal {
  type: 'rsi_oversold' | 'rsi_overbought' | 'ema_crossover' | 'ema_divergence' | 'momentum_shift';
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
    
    // Generate signals
    const emaData = {
      fast: fastEMA[fastEMA.length - 1] || { period: 12, value: 0, timestamp: new Date().toISOString(), trend: 'neutral' as const, slope: 0 },
      slow: slowEMA[slowEMA.length - 1] || { period: 26, value: 0, timestamp: new Date().toISOString(), trend: 'neutral' as const, slope: 0 },
      signal: signalEMA[signalEMA.length - 1] || { period: 9, value: 0, timestamp: new Date().toISOString(), trend: 'neutral' as const, slope: 0 },
      crossover
    };
    
    const signals = this.generateSignals(rsiResults, { crossover }, timeframe);
    
    // Calculate momentum and confluence
    const rsiContribution = currentRSI ? 
      (currentRSI.signal === 'oversold' ? 80 : currentRSI.signal === 'overbought' ? 20 : 50) : 50;
    
    const emaContribution = crossover.status === 'golden_cross' ? 80 : 
                           crossover.status === 'death_cross' ? 20 : 50;
    
    const confluenceScore = Math.round((rsiContribution + emaContribution) / 2);
    
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
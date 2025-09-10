import { OKXService } from './okx';
import { TechnicalIndicatorsService } from './technicalIndicators';
import { type CandleData } from '../../shared/schema';

// Multi-Timeframe Analysis Service
// Provides institutional-grade analysis across 1m, 5m, 15m, 1h, 4h timeframes

export interface TimeframeData {
  timeframe: string;
  candles: CandleData[];
  rsi: number;
  ema20: number;
  ema50: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bias: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  trend: 'up' | 'down' | 'sideways';
  momentum: 'strong' | 'moderate' | 'weak';
}

export interface MTFAnalysis {
  symbol: string;
  timestamp: string;
  timeframes: {
    '1m': TimeframeData;
    '5m': TimeframeData;
    '15m': TimeframeData;
    '1h': TimeframeData;
    '4h': TimeframeData;
  };
  confluence: {
    overall_bias: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    agreement_score: number;
    dominant_timeframe: string;
    signal_strength: number;
    alignment: {
      short_term: 'aligned' | 'divergent' | 'mixed';  // 1m, 5m, 15m
      medium_term: 'aligned' | 'divergent' | 'mixed'; // 15m, 1h
      long_term: 'aligned' | 'divergent' | 'mixed';   // 1h, 4h
    };
  };
  signals: {
    type: string;
    timeframe: string;
    strength: 'strong' | 'moderate' | 'weak';
    confidence: number;
    description: string;
  }[];
  risk_analysis: {
    timeframe_risk: 'low' | 'medium' | 'high';
    divergence_warning: boolean;
    volatility_cluster: boolean;
    recommendation: string;
  };
}

export class MultiTimeframeAnalysisService {
  private okxService: OKXService;
  private technicalService: TechnicalIndicatorsService;

  constructor() {
    this.okxService = new OKXService();
    this.technicalService = new TechnicalIndicatorsService();
  }

  // Fetch candles for all timeframes in parallel
  async fetchAllTimeframeCandles(symbol: string = 'SOL-USDT-SWAP'): Promise<Record<string, CandleData[]>> {
    const timeframes = ['1m', '5m', '15m', '1H', '4H'];
    const limits = {
      '1m': 100,   // 100 minutes
      '5m': 200,   // ~16 hours
      '15m': 200,  // ~2 days
      '1H': 168,   // 1 week
      '4H': 168    // 4 weeks
    };

    try {
      // Fetch all timeframes in parallel for efficiency
      const candlePromises = timeframes.map(async (tf) => {
        const limit = limits[tf as keyof typeof limits];
        const candles = await this.okxService.getCandles(symbol, tf, limit);
        return { timeframe: tf, candles };
      });

      const results = await Promise.all(candlePromises);
      
      // Convert to record format
      const candleData: Record<string, CandleData[]> = {};
      results.forEach(({ timeframe, candles }) => {
        candleData[timeframe] = candles;
      });

      return candleData;
    } catch (error) {
      console.error('Error fetching multi-timeframe candles:', error);
      throw new Error('Failed to fetch multi-timeframe data');
    }
  }

  // Calculate EMA for given period
  private calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = [prices[0]];
    
    for (let i = 1; i < prices.length; i++) {
      ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
    }
    
    return ema;
  }

  // Calculate MACD
  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    const macdLine = ema12.map((val, i) => val - ema26[i]);
    const signalLine = this.calculateEMA(macdLine, 9);
    const histogram = macdLine.map((val, i) => val - signalLine[i]);
    
    return {
      macd: macdLine[macdLine.length - 1] || 0,
      signal: signalLine[signalLine.length - 1] || 0,
      histogram: histogram[histogram.length - 1] || 0
    };
  }

  // Analyze single timeframe
  private async analyzeTimeframe(timeframe: string, candles: CandleData[]): Promise<TimeframeData> {
    if (!candles || candles.length < 50) {
      throw new Error(`Insufficient data for ${timeframe} analysis`);
    }

    const closePrices = candles.map(c => parseFloat(c.close));
    
    // Calculate RSI
    const rsiResults = this.technicalService.calculateRSI(candles, 14);
    const currentRSI = rsiResults[rsiResults.length - 1]?.value || 50;

    // Calculate EMAs
    const ema20 = this.calculateEMA(closePrices, 20);
    const ema50 = this.calculateEMA(closePrices, 50);
    const currentEMA20 = ema20[ema20.length - 1];
    const currentEMA50 = ema50[ema50.length - 1];

    // Calculate MACD
    const macd = this.calculateMACD(closePrices);

    // Determine bias
    let bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    const currentPrice = closePrices[closePrices.length - 1];
    
    if (currentPrice > currentEMA20 && currentEMA20 > currentEMA50 && macd.histogram > 0) {
      bias = 'bullish';
    } else if (currentPrice < currentEMA20 && currentEMA20 < currentEMA50 && macd.histogram < 0) {
      bias = 'bearish';
    }

    // Calculate strength (0-10)
    const emaDistance = Math.abs(currentEMA20 - currentEMA50) / currentPrice * 100;
    const rsiMomentum = bias === 'bullish' ? (currentRSI - 50) / 50 : (50 - currentRSI) / 50;
    const macdStrength = Math.abs(macd.histogram) / currentPrice * 1000;
    
    const strength = Math.min(10, Math.max(0, 
      Math.round((emaDistance * 2 + rsiMomentum * 3 + macdStrength * 2) * 2)
    ));

    // Determine trend
    const priceChange = (currentPrice - closePrices[closePrices.length - 20]) / closePrices[closePrices.length - 20];
    let trend: 'up' | 'down' | 'sideways' = 'sideways';
    if (priceChange > 0.02) trend = 'up';
    else if (priceChange < -0.02) trend = 'down';

    // Determine momentum
    let momentum: 'strong' | 'moderate' | 'weak' = 'weak';
    if (strength >= 7) momentum = 'strong';
    else if (strength >= 4) momentum = 'moderate';

    return {
      timeframe,
      candles,
      rsi: currentRSI,
      ema20: currentEMA20,
      ema50: currentEMA50,
      macd,
      bias,
      strength,
      trend,
      momentum
    };
  }

  // Calculate confluence across timeframes
  private calculateConfluence(timeframeData: Record<string, TimeframeData>): MTFAnalysis['confluence'] {
    const timeframes = Object.values(timeframeData);
    const bullishCount = timeframes.filter(tf => tf.bias === 'bullish').length;
    const bearishCount = timeframes.filter(tf => tf.bias === 'bearish').length;
    
    // Overall bias
    let overall_bias: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (bullishCount > bearishCount) overall_bias = 'bullish';
    else if (bearishCount > bullishCount) overall_bias = 'bearish';

    // Agreement score (0-100)
    const maxAgreement = Math.max(bullishCount, bearishCount);
    const agreement_score = Math.round((maxAgreement / timeframes.length) * 100);

    // Confidence based on agreement and strength
    const avgStrength = timeframes.reduce((sum, tf) => sum + tf.strength, 0) / timeframes.length;
    const confidence = Math.round((agreement_score * 0.6 + avgStrength * 10 * 0.4));

    // Find dominant timeframe (highest strength in overall bias direction)
    const relevantTimeframes = timeframes.filter(tf => tf.bias === overall_bias);
    const dominant_timeframe = relevantTimeframes.length > 0 
      ? relevantTimeframes.reduce((max, tf) => tf.strength > max.strength ? tf : max).timeframe
      : timeframes[0].timeframe;

    // Signal strength
    const signal_strength = Math.round(avgStrength);

    // Alignment analysis
    const shortTerm = [timeframeData['1m'], timeframeData['5m'], timeframeData['15m']];
    const mediumTerm = [timeframeData['15m'], timeframeData['1h']];
    const longTerm = [timeframeData['1h'], timeframeData['4h']];

    const getAlignment = (tfs: TimeframeData[]) => {
      const biases = tfs.map(tf => tf.bias);
      const uniqueBiases = Array.from(new Set(biases));
      if (uniqueBiases.length === 1 && uniqueBiases[0] !== 'neutral') return 'aligned';
      if (uniqueBiases.includes('bullish') && uniqueBiases.includes('bearish')) return 'divergent';
      return 'mixed';
    };

    return {
      overall_bias,
      confidence,
      agreement_score,
      dominant_timeframe,
      signal_strength,
      alignment: {
        short_term: getAlignment(shortTerm),
        medium_term: getAlignment(mediumTerm),
        long_term: getAlignment(longTerm)
      }
    };
  }

  // Generate trading signals based on MTF analysis
  private generateMTFSignals(timeframeData: Record<string, TimeframeData>, confluence: MTFAnalysis['confluence']): MTFAnalysis['signals'] {
    const signals: MTFAnalysis['signals'] = [];

    // Strong confluence signal
    if (confluence.agreement_score >= 80 && confluence.signal_strength >= 7) {
      signals.push({
        type: 'STRONG_CONFLUENCE',
        timeframe: 'MULTI',
        strength: 'strong',
        confidence: confluence.confidence,
        description: `Strong ${confluence.overall_bias} confluence across ${confluence.agreement_score}% of timeframes`
      });
    }

    // Timeframe alignment signals
    if (confluence.alignment.long_term === 'aligned' && confluence.alignment.medium_term === 'aligned') {
      signals.push({
        type: 'HTF_ALIGNMENT',
        timeframe: '1H-4H',
        strength: 'strong',
        confidence: 85,
        description: 'Higher timeframes show strong alignment - high probability setup'
      });
    }

    // Divergence warning
    if (confluence.alignment.short_term === 'divergent' && confluence.alignment.long_term === 'aligned') {
      signals.push({
        type: 'TIMEFRAME_DIVERGENCE',
        timeframe: 'SHORT_TERM',
        strength: 'moderate',
        confidence: 70,
        description: 'Short-term divergence against higher timeframe trend - exercise caution'
      });
    }

    // RSI extremes on multiple timeframes
    const extremeRSI = Object.values(timeframeData).filter(tf => tf.rsi > 80 || tf.rsi < 20);
    if (extremeRSI.length >= 2) {
      const condition = extremeRSI[0].rsi > 80 ? 'overbought' : 'oversold';
      signals.push({
        type: 'MULTI_TF_RSI_EXTREME',
        timeframe: 'MULTI',
        strength: 'moderate',
        confidence: 75,
        description: `Multiple timeframes showing ${condition} conditions - reversal potential`
      });
    }

    return signals;
  }

  // Perform risk analysis
  private analyzeRisk(timeframeData: Record<string, TimeframeData>, confluence: MTFAnalysis['confluence']): MTFAnalysis['risk_analysis'] {
    // Risk based on agreement
    let timeframe_risk: 'low' | 'medium' | 'high' = 'medium';
    if (confluence.agreement_score >= 80) timeframe_risk = 'low';
    else if (confluence.agreement_score <= 40) timeframe_risk = 'high';

    // Divergence warning
    const divergence_warning = confluence.alignment.short_term === 'divergent' || 
                              confluence.alignment.medium_term === 'divergent';

    // Volatility cluster (high strength across multiple timeframes)
    const highVolatilityCount = Object.values(timeframeData).filter(tf => tf.strength >= 8).length;
    const volatility_cluster = highVolatilityCount >= 3;

    // Generate recommendation
    let recommendation = '';
    if (timeframe_risk === 'low' && !divergence_warning) {
      recommendation = 'Favorable conditions for trading with good timeframe alignment';
    } else if (divergence_warning) {
      recommendation = 'Exercise caution due to timeframe divergence - wait for alignment';
    } else if (volatility_cluster) {
      recommendation = 'High volatility detected - reduce position size and use tight stops';
    } else {
      recommendation = 'Mixed signals - wait for clearer timeframe confluence';
    }

    return {
      timeframe_risk,
      divergence_warning,
      volatility_cluster,
      recommendation
    };
  }

  // Main analysis method
  async performMTFAnalysis(symbol: string = 'SOL-USDT-SWAP'): Promise<MTFAnalysis> {
    try {
      console.log(`🔍 Starting Multi-Timeframe Analysis for ${symbol}...`);
      
      // Fetch all timeframe data
      const allCandles = await this.fetchAllTimeframeCandles(symbol);
      
      // Analyze each timeframe
      const timeframeAnalysis: Record<string, TimeframeData> = {};
      
      for (const [tf, candles] of Object.entries(allCandles)) {
        const normalizedTf = tf === '1H' ? '1h' : tf === '4H' ? '4h' : tf;
        timeframeAnalysis[normalizedTf] = await this.analyzeTimeframe(normalizedTf, candles);
      }

      // Calculate confluence
      const confluence = this.calculateConfluence(timeframeAnalysis);
      
      // Generate signals
      const signals = this.generateMTFSignals(timeframeAnalysis, confluence);
      
      // Risk analysis
      const risk_analysis = this.analyzeRisk(timeframeAnalysis, confluence);

      console.log(`✅ MTF Analysis completed - Overall bias: ${confluence.overall_bias} (${confluence.confidence}% confidence)`);

      return {
        symbol,
        timestamp: new Date().toISOString(),
        timeframes: {
          '1m': timeframeAnalysis['1m'],
          '5m': timeframeAnalysis['5m'],
          '15m': timeframeAnalysis['15m'],
          '1h': timeframeAnalysis['1h'],
          '4h': timeframeAnalysis['4h']
        },
        confluence,
        signals,
        risk_analysis
      };

    } catch (error) {
      console.error('MTF Analysis error:', error);
      throw new Error(`Multi-timeframe analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const multiTimeframeService = new MultiTimeframeAnalysisService();
import { 
  ConfluenceLayer, 
  ConfluenceAnalysis, 
  ConfluenceScreeningRequest,
  ConfluenceScreeningResponse,
  LayerWeights,
  CandleData,
  SMCAnalysisData,
  CVDAnalysis,
  FundingRateData,
  OpenInterestData
} from "@shared/schema";
import { SMCService } from "./smc";
import { CVDService } from "./cvd";
import { TechnicalIndicatorsService } from "./technicalIndicators";
import { ConfluenceService } from "./confluence";

/**
 * Advanced 8-Layer Confluence Scoring System
 * 
 * Implements sophisticated multi-layer analysis for cryptocurrency trading signals
 * with weighted scoring and institutional-grade confluence detection.
 */
export class EightLayerConfluenceService {
  private smcService: SMCService;
  private cvdService: CVDService;
  private technicalService: TechnicalIndicatorsService;
  private confluenceService: ConfluenceService;
  
  // Layer weights as specified: SMC(20%), CVD(15%), Momentum(15%), Market Structure(10%), 
  // Open Interest(15%), Funding Rate(10%), Institutional Flow(10%), Fibonacci(5%)
  private readonly LAYER_WEIGHTS: LayerWeights = {
    smc: 0.20,                    // Smart Money Concepts - 20%
    cvd: 0.15,                    // Cumulative Volume Delta - 15%
    momentum: 0.15,               // RSI/EMA/MACD indicators - 15%
    market_structure: 0.10,       // Market Structure analysis - 10%
    open_interest: 0.15,          // Open Interest analysis - 15%
    funding_rate: 0.10,           // Funding Rate analysis - 10%
    institutional_flow: 0.10,     // Institutional Flow detection - 10%
    fibonacci: 0.05,              // Fibonacci & Key Levels - 5%
  };

  constructor(
    smcService: SMCService,
    cvdService: CVDService,
    technicalService: TechnicalIndicatorsService,
    confluenceService: ConfluenceService
  ) {
    this.smcService = smcService;
    this.cvdService = cvdService;
    this.technicalService = technicalService;
    this.confluenceService = confluenceService;
  }

  /**
   * Perform complete 8-layer confluence analysis for a single symbol
   */
  async analyzeSymbol(
    symbol: string,
    candles: CandleData[],
    timeframe: string = '15m',
    includeDetails: boolean = false
  ): Promise<ConfluenceAnalysis> {
    const startTime = Date.now();
    
    try {
      // Run all analyses in parallel for efficiency
      const [
        smcAnalysis,
        cvdAnalysis,
        technicalIndicators,
        fundingData,
        openInterestData
      ] = await Promise.allSettled([
        this.smcService.analyzeSMC(candles, timeframe),
        this.cvdService.analyzeCVD(candles, [], timeframe),
        this.technicalService.analyzeTechnicalIndicators(candles),
        this.getFundingRateData(symbol),
        this.getOpenInterestData(symbol)
      ]);

      // Initialize layer scores
      const layers: ConfluenceAnalysis['layers'] = {
        smc: await this.analyzeSMCLayer(smcAnalysis),
        cvd: await this.analyzeCVDLayer(cvdAnalysis),
        momentum: await this.analyzeMomentumLayer(technicalIndicators),
        market_structure: await this.analyzeMarketStructureLayer(candles, smcAnalysis),
        open_interest: await this.analyzeOpenInterestLayer(openInterestData),
        funding_rate: await this.analyzeFundingRateLayer(fundingData),
        institutional_flow: await this.analyzeInstitutionalFlowLayer(cvdAnalysis, openInterestData),
        fibonacci: await this.analyzeFibonacciLayer(candles)
      };

      // Calculate weighted overall score
      const overallScore = this.calculateWeightedScore(layers);
      
      // Determine signal and confluence strength
      const signal = this.determineSignal(overallScore, layers);
      const confluence = this.determineConfluence(overallScore);
      const layersPassed = this.getPassingLayers(layers);
      const riskLevel = this.assessRiskLevel(layers, overallScore);
      const recommendation = this.generateRecommendation(signal, confluence, overallScore, layersPassed);

      return {
        symbol,
        overall_score: Math.round(overallScore * 100) / 100,
        signal,
        confluence,
        layers_passed: layersPassed,
        layers,
        risk_level: riskLevel,
        recommendation,
        timeframe,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
      return this.generateFallbackAnalysis(symbol, timeframe);
    }
  }

  /**
   * Analyze Smart Money Concepts layer (20% weight)
   */
  private async analyzeSMCLayer(smcAnalysisResult: PromiseSettledResult<SMCAnalysisData>): Promise<ConfluenceLayer> {
    if (smcAnalysisResult.status === 'rejected') {
      return this.createFallbackLayer('Smart Money Concepts', 0, 'HOLD');
    }

    const smc = smcAnalysisResult.value;
    let score = 50; // Start neutral
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    
    // Score based on trend strength and confidence
    if (smc.trend === 'bullish') {
      score += 30 + (smc.confidence * 0.2); // Up to 50 points for bullish trend
      signal = 'BUY';
    } else if (smc.trend === 'bearish') {
      score -= 30 + (smc.confidence * 0.2); // Down to 50 points for bearish trend
      signal = 'SELL';
    }

    // Additional scoring for structure breaks and FVGs
    if (smc.lastBOS && smc.lastBOS.type === 'bullish') score += 10;
    if (smc.lastBOS && smc.lastBOS.type === 'bearish') score -= 10;
    if (smc.fvgs && smc.fvgs.length > 0) {
      const activeFVGs = smc.fvgs.filter(fvg => !fvg.mitigated);
      score += activeFVGs.length * 5; // 5 points per active FVG
    }

    return {
      name: 'Smart Money Concepts',
      score: Math.max(0, Math.min(100, score)),
      weight: this.LAYER_WEIGHTS.smc,
      signal,
      confidence: smc.confidence || 50,
      details: {
        trend: smc.trend === 'bullish' ? 'bullish' : smc.trend === 'bearish' ? 'bearish' : 'neutral',
        strength: smc.confidence > 70 ? 'strong' : smc.confidence > 40 ? 'moderate' : 'weak',
        key_metrics: {
          trend: smc.trend,
          confidence: smc.confidence,
          fvg_count: smc.fvgs?.length || 0,
          active_fvgs: smc.fvgs?.filter(fvg => !fvg.mitigated).length || 0
        },
        notes: `Market structure: ${smc.marketStructure}, Trend: ${smc.trend}`
      }
    };
  }

  /**
   * Analyze CVD layer (15% weight)
   */
  private async analyzeCVDLayer(cvdAnalysisResult: PromiseSettledResult<CVDAnalysis>): Promise<ConfluenceLayer> {
    if (cvdAnalysisResult.status === 'rejected') {
      return this.createFallbackLayer('Cumulative Volume Delta', 0, 'HOLD');
    }

    const cvd = cvdAnalysisResult.value;
    let score = 50;
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // Score based on CVD change and buyer/seller aggression
    const deltaChange = typeof cvd.deltaChange === 'string' ? parseFloat(cvd.deltaChange) : cvd.deltaChange || 0;
    const percentageChange = typeof cvd.percentageChange === 'string' ? parseFloat(cvd.percentageChange) : cvd.percentageChange || 0;
    
    if (deltaChange > 0 && percentageChange > 5) {
      score += 25 + Math.min(percentageChange, 25); // Strong buying pressure
      signal = 'BUY';
    } else if (deltaChange < 0 && percentageChange < -5) {
      score -= 25 + Math.min(Math.abs(percentageChange), 25); // Strong selling pressure
      signal = 'SELL';
    }

    // Factor in buyer/seller aggression
    const buyerAggression = cvd.buyerSellerAggression.buyerAggression.percentage;
    const sellerAggression = cvd.buyerSellerAggression.sellerAggression.percentage;
    
    if (buyerAggression > 60) score += 15;
    else if (sellerAggression > 60) score -= 15;

    return {
      name: 'Cumulative Volume Delta',
      score: Math.max(0, Math.min(100, score)),
      weight: this.LAYER_WEIGHTS.cvd,
      signal,
      confidence: typeof cvd.confidence === 'object' ? cvd.confidence.overall : cvd.confidence || 50,
      details: {
        trend: deltaChange > 0 ? 'bullish' : deltaChange < 0 ? 'bearish' : 'neutral',
        strength: Math.abs(percentageChange) > 15 ? 'strong' : Math.abs(percentageChange) > 5 ? 'moderate' : 'weak',
        key_metrics: {
          delta_change: deltaChange,
          percentage_change: percentageChange,
          buyer_aggression: buyerAggression,
          seller_aggression: sellerAggression
        },
        notes: `CVD change: ${percentageChange.toFixed(2)}%, Dominant side: ${cvd.buyerSellerAggression.dominantSide}`
      }
    };
  }

  /**
   * Analyze Momentum layer (15% weight) - RSI, EMA, MACD
   */
  private async analyzeMomentumLayer(technicalResult: PromiseSettledResult<any>): Promise<ConfluenceLayer> {
    if (technicalResult.status === 'rejected') {
      return this.createFallbackLayer('Momentum Indicators', 0, 'HOLD');
    }

    const technical = technicalResult.value;
    let score = 50;
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let bullishSignals = 0;
    let bearishSignals = 0;

    // RSI Analysis
    if (technical.rsi) {
      if (technical.rsi.value < 30) {
        score += 20; // Oversold - potential buy
        bullishSignals++;
      } else if (technical.rsi.value > 70) {
        score -= 20; // Overbought - potential sell
        bearishSignals++;
      }
    }

    // EMA Analysis
    if (technical.ema && technical.ema.length >= 2) {
      const ema12 = technical.ema.find((e: any) => e.period === 12);
      const ema26 = technical.ema.find((e: any) => e.period === 26);
      
      if (ema12 && ema26) {
        if (ema12.value > ema26.value) {
          score += 15; // Bullish EMA crossover
          bullishSignals++;
        } else {
          score -= 15; // Bearish EMA crossover
          bearishSignals++;
        }
      }
    }

    // MACD Analysis
    if (technical.macd) {
      if (technical.macd.histogram > 0 && technical.macd.crossover === 'bullish') {
        score += 15; // Bullish MACD
        bullishSignals++;
      } else if (technical.macd.histogram < 0 && technical.macd.crossover === 'bearish') {
        score -= 15; // Bearish MACD
        bearishSignals++;
      }
    }

    // Determine overall signal
    if (bullishSignals > bearishSignals) signal = 'BUY';
    else if (bearishSignals > bullishSignals) signal = 'SELL';

    return {
      name: 'Momentum Indicators',
      score: Math.max(0, Math.min(100, score)),
      weight: this.LAYER_WEIGHTS.momentum,
      signal,
      confidence: 70, // Base confidence for technical indicators
      details: {
        trend: bullishSignals > bearishSignals ? 'bullish' : bearishSignals > bullishSignals ? 'bearish' : 'neutral',
        strength: Math.abs(bullishSignals - bearishSignals) > 2 ? 'strong' : Math.abs(bullishSignals - bearishSignals) > 1 ? 'moderate' : 'weak',
        key_metrics: {
          rsi: technical.rsi?.value || 50,
          macd_histogram: technical.macd?.histogram || 0,
          bullish_signals: bullishSignals,
          bearish_signals: bearishSignals
        },
        notes: `${bullishSignals} bullish, ${bearishSignals} bearish momentum signals`
      }
    };
  }

  /**
   * Analyze Market Structure layer (10% weight)
   */
  private async analyzeMarketStructureLayer(
    candles: CandleData[], 
    smcResult: PromiseSettledResult<SMCAnalysisData>
  ): Promise<ConfluenceLayer> {
    let score = 50;
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // Basic structure analysis from price action
    if (candles.length >= 20) {
      const recent = candles.slice(-20);
      const highs = recent.map(c => parseFloat(c.high));
      const lows = recent.map(c => parseFloat(c.low));
      
      const recentHigh = Math.max(...highs.slice(-10));
      const previousHigh = Math.max(...highs.slice(-20, -10));
      const recentLow = Math.min(...lows.slice(-10));
      const previousLow = Math.min(...lows.slice(-20, -10));

      // Higher highs and higher lows = bullish structure
      if (recentHigh > previousHigh && recentLow > previousLow) {
        score += 30;
        signal = 'BUY';
      }
      // Lower highs and lower lows = bearish structure
      else if (recentHigh < previousHigh && recentLow < previousLow) {
        score -= 30;
        signal = 'SELL';
      }
    }

    // Enhance with SMC data if available
    if (smcResult.status === 'fulfilled') {
      const smc = smcResult.value;
      if (smc.lastBOS?.type === 'bullish') score += 10;
      else if (smc.lastBOS?.type === 'bearish') score -= 10;
    }

    return {
      name: 'Market Structure',
      score: Math.max(0, Math.min(100, score)),
      weight: this.LAYER_WEIGHTS.market_structure,
      signal,
      confidence: 60,
      details: {
        trend: signal === 'BUY' ? 'bullish' : signal === 'SELL' ? 'bearish' : 'neutral',
        strength: Math.abs(score - 50) > 20 ? 'strong' : Math.abs(score - 50) > 10 ? 'moderate' : 'weak',
        notes: 'Market structure analysis based on recent highs/lows pattern'
      }
    };
  }

  /**
   * Analyze Open Interest layer (15% weight)
   */
  private async analyzeOpenInterestLayer(oiResult: PromiseSettledResult<OpenInterestData>): Promise<ConfluenceLayer> {
    if (oiResult.status === 'rejected') {
      return this.createFallbackLayer('Open Interest', 0, 'HOLD');
    }

    const oi = oiResult.value;
    let score = 50;
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // Analyze OI change patterns - using available properties
    const currentOI = parseFloat(oi.oi || '0');
    const oiUsd = parseFloat(oi.oiUsd || '0');
    // Calculate percentage change (mock for now - should be calculated from historical data)
    const oiChangePercentage = 5; // Default mock percentage

    // Rising OI with rising price = bullish continuation
    // Rising OI with falling price = bearish continuation
    if (oiChangePercentage > 5) {
      score += 25; // Increasing interest
      signal = 'BUY'; // Assume bullish for now, should be refined with price direction
    } else if (oiChangePercentage < -5) {
      score -= 25; // Decreasing interest
      signal = 'SELL';
    }

    return {
      name: 'Open Interest',
      score: Math.max(0, Math.min(100, score)),
      weight: this.LAYER_WEIGHTS.open_interest,
      signal,
      confidence: 65,
      details: {
        trend: oiChangePercentage > 0 ? 'bullish' : 'bearish',
        strength: Math.abs(oiChangePercentage) > 10 ? 'strong' : Math.abs(oiChangePercentage) > 5 ? 'moderate' : 'weak',
        key_metrics: {
          current_oi: currentOI,
          oi_usd: oiUsd,
          oi_change_percentage: oiChangePercentage,
          inst_type: oi.instType
        },
        notes: `OI change: ${oiChangePercentage.toFixed(2)}%`
      }
    };
  }

  /**
   * Analyze Funding Rate layer (10% weight)
   */
  private async analyzeFundingRateLayer(fundingResult: PromiseSettledResult<FundingRateData>): Promise<ConfluenceLayer> {
    if (fundingResult.status === 'rejected') {
      return this.createFallbackLayer('Funding Rate', 0, 'HOLD');
    }

    const funding = fundingResult.value;
    let score = 50;
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    const currentRate = parseFloat(funding.fundingRate);
    
    // Extreme funding rates often signal reversals
    if (currentRate > 0.01) { // Very high positive funding (longs pay shorts)
      score -= 20; // Potential reversal to downside
      signal = 'SELL';
    } else if (currentRate < -0.01) { // Very negative funding (shorts pay longs)
      score += 20; // Potential reversal to upside
      signal = 'BUY';
    }

    return {
      name: 'Funding Rate',
      score: Math.max(0, Math.min(100, score)),
      weight: this.LAYER_WEIGHTS.funding_rate,
      signal,
      confidence: 55,
      details: {
        trend: currentRate < 0 ? 'bullish' : currentRate > 0 ? 'bearish' : 'neutral',
        strength: Math.abs(currentRate) > 0.01 ? 'strong' : Math.abs(currentRate) > 0.005 ? 'moderate' : 'weak',
        key_metrics: {
          funding_rate: currentRate,
          next_funding_time: funding.nextFundingTime
        },
        notes: `Current funding rate: ${(currentRate * 100).toFixed(4)}%`
      }
    };
  }

  /**
   * Analyze Institutional Flow layer (10% weight)
   */
  private async analyzeInstitutionalFlowLayer(
    cvdResult: PromiseSettledResult<CVDAnalysis>,
    oiResult: PromiseSettledResult<OpenInterestData>
  ): Promise<ConfluenceLayer> {
    let score = 50;
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // Use CVD large trade analysis as proxy for institutional flow
    if (cvdResult.status === 'fulfilled') {
      const cvd = cvdResult.value;
      // Use available trade data from CVD analysis
      const totalVolume = parseFloat(cvd.buyerSellerAggression.buyerAggression.volume || '0') + 
                          parseFloat(cvd.buyerSellerAggression.sellerAggression.volume || '0');
      // Calculate average trade size from available data
      const buyerAvgSize = parseFloat(cvd.buyerSellerAggression.buyerAggression.averageSize || '0');
      const sellerAvgSize = parseFloat(cvd.buyerSellerAggression.sellerAggression.averageSize || '0');
      const avgTradeSize = (buyerAvgSize + sellerAvgSize) / 2 || 1000; // Default fallback
      
      // Estimate institutional activity based on average trade size
      const largeTradeThreshold = avgTradeSize * 5; // Trades 5x larger than average
      const largeTradeCount = Math.floor(totalVolume / largeTradeThreshold) || 0;
      const retailTradeCount = Math.floor(totalVolume / avgTradeSize) - largeTradeCount || 1;
      
      // High ratio of large trades indicates institutional activity
      const institutionalRatio = largeTradeCount / (largeTradeCount + retailTradeCount);
      
      if (institutionalRatio > 0.3) { // More than 30% large trades
        const dominantSide = cvd.buyerSellerAggression.dominantSide;
        if (dominantSide === 'buyers') {
          score += 25;
          signal = 'BUY';
        } else if (dominantSide === 'sellers') {
          score -= 25;
          signal = 'SELL';
        }
      }
    }

    return {
      name: 'Institutional Flow',
      score: Math.max(0, Math.min(100, score)),
      weight: this.LAYER_WEIGHTS.institutional_flow,
      signal,
      confidence: 60,
      details: {
        trend: signal === 'BUY' ? 'bullish' : signal === 'SELL' ? 'bearish' : 'neutral',
        strength: Math.abs(score - 50) > 15 ? 'strong' : Math.abs(score - 50) > 8 ? 'moderate' : 'weak',
        notes: 'Institutional flow based on large trade analysis'
      }
    };
  }

  /**
   * Analyze Fibonacci layer (5% weight)
   */
  private async analyzeFibonacciLayer(candles: CandleData[]): Promise<ConfluenceLayer> {
    let score = 50;
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    if (candles.length >= 50) {
      const prices = candles.map(c => parseFloat(c.close));
      const currentPrice = prices[prices.length - 1];
      
      // Find recent swing high and low for Fibonacci calculation
      const recentHigh = Math.max(...prices.slice(-20));
      const recentLow = Math.min(...prices.slice(-20));
      const range = recentHigh - recentLow;

      // Calculate key Fibonacci levels
      const fib618 = recentLow + (range * 0.618);
      const fib382 = recentLow + (range * 0.382);
      const fib50 = recentLow + (range * 0.5);

      // Score based on proximity to key Fibonacci levels
      const tolerance = range * 0.02; // 2% tolerance
      
      if (Math.abs(currentPrice - fib618) < tolerance) {
        score += 15; // Strong Fibonacci support/resistance
        signal = currentPrice > fib618 ? 'BUY' : 'SELL';
      } else if (Math.abs(currentPrice - fib382) < tolerance || Math.abs(currentPrice - fib50) < tolerance) {
        score += 10; // Moderate Fibonacci level
      }
    }

    return {
      name: 'Fibonacci & Key Levels',
      score: Math.max(0, Math.min(100, score)),
      weight: this.LAYER_WEIGHTS.fibonacci,
      signal,
      confidence: 50,
      details: {
        trend: signal === 'BUY' ? 'bullish' : signal === 'SELL' ? 'bearish' : 'neutral',
        strength: Math.abs(score - 50) > 10 ? 'strong' : Math.abs(score - 50) > 5 ? 'moderate' : 'weak',
        notes: 'Fibonacci retracement levels analysis'
      }
    };
  }

  /**
   * Calculate weighted overall score from all layers
   */
  private calculateWeightedScore(layers: ConfluenceAnalysis['layers']): number {
    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(layers).forEach(([layerName, layer]) => {
      weightedSum += layer.score * layer.weight;
      totalWeight += layer.weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 50;
  }

  /**
   * Determine signal based on overall score and layer consensus
   */
  private determineSignal(overallScore: number, layers: ConfluenceAnalysis['layers']): 'BUY' | 'SELL' | 'HOLD' {
    // Count buy/sell signals from layers
    const layerSignals = Object.values(layers);
    const buySignals = layerSignals.filter(l => l.signal === 'BUY').length;
    const sellSignals = layerSignals.filter(l => l.signal === 'SELL').length;

    // Primary determination by score
    if (overallScore >= 75) return 'BUY';
    if (overallScore <= 25) return 'SELL';

    // Secondary determination by layer consensus
    if (buySignals > sellSignals && overallScore > 50) return 'BUY';
    if (sellSignals > buySignals && overallScore < 50) return 'SELL';

    return 'HOLD';
  }

  /**
   * Determine confluence strength
   */
  private determineConfluence(overallScore: number): 'STRONG' | 'WEAK' | 'NEUTRAL' {
    if (overallScore >= 75 || overallScore <= 25) return 'STRONG';
    if (overallScore >= 60 || overallScore <= 40) return 'WEAK';
    return 'NEUTRAL';
  }

  /**
   * Get list of layers that passed (scored above threshold)
   */
  private getPassingLayers(layers: ConfluenceAnalysis['layers']): string[] {
    return Object.entries(layers)
      .filter(([_, layer]) => layer.score > 60) // Passing threshold
      .map(([name, _]) => name.toUpperCase());
  }

  /**
   * Assess overall risk level
   */
  private assessRiskLevel(layers: ConfluenceAnalysis['layers'], overallScore: number): 'low' | 'medium' | 'high' {
    const layerScores = Object.values(layers).map(l => l.score);
    const scoreVariance = this.calculateVariance(layerScores);
    
    // High variance or extreme scores = higher risk
    if (scoreVariance > 400 || overallScore > 90 || overallScore < 10) return 'high';
    if (scoreVariance > 200 || overallScore > 80 || overallScore < 20) return 'medium';
    return 'low';
  }

  /**
   * Generate trading recommendation
   */
  private generateRecommendation(
    signal: 'BUY' | 'SELL' | 'HOLD',
    confluence: 'STRONG' | 'WEAK' | 'NEUTRAL',
    score: number,
    layersPassed: string[]
  ): string {
    const layerCount = layersPassed.length;
    
    if (signal === 'BUY' && confluence === 'STRONG') {
      return `Strong bullish confluence (${layerCount}/8 layers passed, ${score.toFixed(1)}% score). Consider long position with tight risk management.`;
    } else if (signal === 'SELL' && confluence === 'STRONG') {
      return `Strong bearish confluence (${layerCount}/8 layers passed, ${score.toFixed(1)}% score). Consider short position with tight risk management.`;
    } else if (signal !== 'HOLD' && confluence === 'WEAK') {
      return `Weak ${signal.toLowerCase()} bias detected (${layerCount}/8 layers). Exercise caution and wait for stronger confirmation.`;
    } else {
      return `Mixed signals detected (${layerCount}/8 layers passed). Remain neutral and wait for clearer market direction.`;
    }
  }

  /**
   * Create fallback layer for failed analyses
   */
  private createFallbackLayer(name: string, score: number, signal: 'BUY' | 'SELL' | 'HOLD'): ConfluenceLayer {
    const weightMap: Record<string, number> = {
      'Smart Money Concepts': this.LAYER_WEIGHTS.smc,
      'Cumulative Volume Delta': this.LAYER_WEIGHTS.cvd,
      'Momentum Indicators': this.LAYER_WEIGHTS.momentum,
      'Market Structure': this.LAYER_WEIGHTS.market_structure,
      'Open Interest': this.LAYER_WEIGHTS.open_interest,
      'Funding Rate': this.LAYER_WEIGHTS.funding_rate,
      'Institutional Flow': this.LAYER_WEIGHTS.institutional_flow,
      'Fibonacci & Key Levels': this.LAYER_WEIGHTS.fibonacci,
    };

    return {
      name,
      score,
      weight: weightMap[name] || 0.1,
      signal,
      confidence: 25,
      details: {
        trend: 'neutral',
        strength: 'weak',
        notes: 'Fallback analysis due to data unavailability'
      }
    };
  }

  /**
   * Generate fallback analysis for failed symbol analysis
   */
  private generateFallbackAnalysis(symbol: string, timeframe: string): ConfluenceAnalysis {
    const layers: ConfluenceAnalysis['layers'] = {
      smc: this.createFallbackLayer('Smart Money Concepts', 50, 'HOLD'),
      cvd: this.createFallbackLayer('Cumulative Volume Delta', 50, 'HOLD'),
      momentum: this.createFallbackLayer('Momentum Indicators', 50, 'HOLD'),
      market_structure: this.createFallbackLayer('Market Structure', 50, 'HOLD'),
      open_interest: this.createFallbackLayer('Open Interest', 50, 'HOLD'),
      funding_rate: this.createFallbackLayer('Funding Rate', 50, 'HOLD'),
      institutional_flow: this.createFallbackLayer('Institutional Flow', 50, 'HOLD'),
      fibonacci: this.createFallbackLayer('Fibonacci & Key Levels', 50, 'HOLD')
    };

    return {
      symbol,
      overall_score: 50,
      signal: 'HOLD',
      confluence: 'NEUTRAL',
      layers_passed: [],
      layers,
      risk_level: 'medium',
      recommendation: 'Analysis unavailable due to data issues. Avoid trading until conditions improve.',
      timeframe,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Utility functions
   */
  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  /**
   * Mock data fetchers (to be replaced with actual data sources)
   */
  private async getFundingRateData(symbol: string): Promise<FundingRateData> {
    // This should be replaced with actual funding rate data fetching
    // For now, return mock data matching the expected schema
    return {
      timestamp: new Date().toISOString(),
      fundingRate: '0.0001',
      instId: symbol,
      nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      fundingTime: new Date().toISOString(),
      premium: '0',
      interestRate: '0',
      maxFundingRate: '0.0075',
      minFundingRate: '-0.0075',
      settFundingRate: '0.0001',
      settState: 'settled' as const
    };
  }

  private async getOpenInterestData(symbol: string): Promise<OpenInterestData> {
    // This should be replaced with actual open interest data fetching
    // Return mock data matching the expected schema
    return {
      timestamp: new Date().toISOString(),
      instId: symbol,
      instType: 'SWAP' as const,
      oi: '1000000',
      oiCcy: 'USDT',
      oiUsd: '1000000'
    };
  }

  /**
   * Screen multiple symbols for confluence
   */
  async screenMultipleSymbols(request: ConfluenceScreeningRequest): Promise<ConfluenceScreeningResponse> {
    const startTime = Date.now();
    const results: Record<string, ConfluenceAnalysis> = {};
    
    try {
      // Analyze each symbol in parallel
      const analyses = await Promise.allSettled(
        request.symbols.map(async (symbol) => {
          // Mock candle data - replace with actual data fetching
          const candles = await this.getMockCandleData(symbol, request.timeframe);
          return {
            symbol,
            analysis: await this.analyzeSymbol(symbol, candles, request.timeframe, request.include_details)
          };
        })
      );

      // Process results
      analyses.forEach((result, index) => {
        const symbol = request.symbols[index];
        if (result.status === 'fulfilled') {
          results[symbol] = result.value.analysis;
        } else {
          results[symbol] = this.generateFallbackAnalysis(symbol, request.timeframe);
        }
      });

      // Generate summary
      const summary = this.generateSummary(results);
      const processingTime = Date.now() - startTime;

      return {
        results,
        summary,
        metadata: {
          processing_time_ms: processingTime,
          timestamp: new Date().toISOString(),
          timeframe: request.timeframe,
          api_version: '2.0'
        }
      };

    } catch (error) {
      console.error('Error in multi-symbol screening:', error);
      throw new Error('Failed to complete confluence screening');
    }
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(results: Record<string, ConfluenceAnalysis>): ConfluenceScreeningResponse['summary'] {
    const analyses = Object.values(results);
    
    const strongBuy = analyses.filter(a => a.signal === 'BUY' && a.confluence === 'STRONG').length;
    const strongSell = analyses.filter(a => a.signal === 'SELL' && a.confluence === 'STRONG').length;
    const weakSignals = analyses.filter(a => a.confluence === 'WEAK').length;
    const holdSignals = analyses.filter(a => a.signal === 'HOLD').length;

    // Top picks (highest scores)
    const topPicks = analyses
      .sort((a, b) => b.overall_score - a.overall_score)
      .slice(0, 5)
      .map(a => ({
        symbol: a.symbol,
        score: a.overall_score,
        signal: a.signal,
        confluence: a.confluence
      }));

    return {
      total_analyzed: analyses.length,
      strong_buy: strongBuy,
      strong_sell: strongSell,
      weak_signals: weakSignals,
      hold_signals: holdSignals,
      top_picks: topPicks
    };
  }

  /**
   * Mock candle data fetcher (replace with actual implementation)
   */
  private async getMockCandleData(symbol: string, timeframe: string): Promise<CandleData[]> {
    // This should be replaced with actual candle data fetching
    // For now, return minimal mock data structure
    const now = Date.now();
    return Array.from({ length: 100 }, (_, i) => ({
      timestamp: (now - (100 - i) * 900000).toString(), // 15-minute intervals
      open: '50000',
      high: '51000',
      low: '49000',
      close: '50500',
      volume: '1000',
      // Add other required fields based on your CandleData interface
    }));
  }
}
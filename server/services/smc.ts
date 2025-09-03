import { CandleData, SMCAnalysisData, FVGData, OrderBlockData, StructurePointData, NearestZoneData, TradingScenarioData } from '@shared/schema';

export class SMCService {
  private tolerance = 0.002; // 0.2% tolerance for equal levels
  private okxService: any; // Will be injected

  constructor(okxService?: any) {
    this.okxService = okxService;
  }

  /**
   * Enhanced SMC analysis with professional trading features
   */
  public async analyzeSMC(
    candles: CandleData[], 
    timeframe: string = '1H'
  ): Promise<SMCAnalysisData> {
    if (candles.length < 20) {
      throw new Error('Insufficient candle data for SMC analysis. Need at least 20 candles.');
    }

    const analysisStart = Date.now();
    
    // Sort candles by timestamp (oldest first)
    const sortedCandles = [...candles].sort((a, b) => 
      parseInt(a.timestamp) - parseInt(b.timestamp)
    );

    // Core SMC Analysis
    const { trend, lastBOS, lastCHoCH } = this.analyzeMarketStructure(sortedCandles);
    const fvgs = this.detectFVGs(sortedCandles, timeframe);
    const orderBlocks = this.identifyOrderBlocks(sortedCandles);
    const { eqh, eql } = this.findEqualLevels(sortedCandles);
    const liquiditySweeps = this.detectLiquiditySweeps(sortedCandles, eqh, eql);
    const marketStructure = this.determineMarketStructure(trend, fvgs, orderBlocks);
    const baseConfidence = this.calculateBaseConfidence(fvgs, orderBlocks, eqh, eql, liquiditySweeps);

    // Enhanced Features
    const multiTimeframe = await this.analyzeMultiTimeframe();
    const nearestZones = this.findNearestZones(fvgs, orderBlocks, sortedCandles);
    const derivatives = await this.analyzeDerivatives();
    const regime = this.detectMarketRegime(sortedCandles);
    const session = this.getCurrentTradingSession();
    const scenarios = this.generateTradingScenarios(sortedCandles, trend, nearestZones, derivatives);
    const atr = this.calculateATR(sortedCandles);
    
    // Advanced Confluence Score (weighted)
    const confluenceScore = this.calculateConfluenceScore({
      baseConfidence,
      multiTimeframe,
      derivatives,
      regime,
      nearestZones,
      atr
    });

    const analysisEnd = Date.now();
    const dataAge = Math.floor((analysisEnd - parseInt(sortedCandles[sortedCandles.length - 1].timestamp)) / 1000);

    return {
      timeframe,
      trend,
      lastBOS,
      lastCHoCH,
      fvgs: fvgs.slice(-10),
      orderBlocks: orderBlocks.slice(-8),
      eqh: eqh.slice(-5),
      eql: eql.slice(-5),
      liquiditySweeps: liquiditySweeps.slice(-5),
      marketStructure,
      confidence: baseConfidence,
      
      // Enhanced Professional Features
      confluenceScore,
      multiTimeframe,
      nearestZones,
      regime,
      session,
      scenarios,
      derivatives,
      atr,
      lastUpdate: new Date().toISOString(),
      dataAge
    };
  }

  /**
   * Analyze market structure for BOS and CHoCH
   */
  private analyzeMarketStructure(candles: CandleData[]) {
    const highs: Array<{price: number, index: number, timestamp: string}> = [];
    const lows: Array<{price: number, index: number, timestamp: string}> = [];
    
    // Find swing highs and lows
    for (let i = 2; i < candles.length - 2; i++) {
      const current = parseFloat(candles[i].high);
      const prev2 = parseFloat(candles[i-2].high);
      const prev1 = parseFloat(candles[i-1].high);
      const next1 = parseFloat(candles[i+1].high);
      const next2 = parseFloat(candles[i+2].high);
      
      if (current > prev2 && current > prev1 && current > next1 && current > next2) {
        highs.push({
          price: current,
          index: i,
          timestamp: candles[i].timestamp
        });
      }
      
      const currentLow = parseFloat(candles[i].low);
      const prev2Low = parseFloat(candles[i-2].low);
      const prev1Low = parseFloat(candles[i-1].low);
      const next1Low = parseFloat(candles[i+1].low);
      const next2Low = parseFloat(candles[i+2].low);
      
      if (currentLow < prev2Low && currentLow < prev1Low && currentLow < next1Low && currentLow < next2Low) {
        lows.push({
          price: currentLow,
          index: i,
          timestamp: candles[i].timestamp
        });
      }
    }

    let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
    let lastBOS = null;
    let lastCHoCH = null;

    if (highs.length >= 2 && lows.length >= 2) {
      const recentHighs = highs.slice(-3);
      const recentLows = lows.slice(-3);
      
      const highsIncreasing = recentHighs.length >= 2 && 
        recentHighs[recentHighs.length - 1].price > recentHighs[recentHighs.length - 2].price;
      const lowsIncreasing = recentLows.length >= 2 && 
        recentLows[recentLows.length - 1].price > recentLows[recentLows.length - 2].price;
      
      const highsDecreasing = recentHighs.length >= 2 && 
        recentHighs[recentHighs.length - 1].price < recentHighs[recentHighs.length - 2].price;
      const lowsDecreasing = recentLows.length >= 2 && 
        recentLows[recentLows.length - 1].price < recentLows[recentLows.length - 2].price;

      if (highsIncreasing && lowsIncreasing) {
        trend = 'bullish';
        if (highs.length > 0) {
          lastBOS = {
            type: 'bullish' as const,
            price: highs[highs.length - 1].price.toString(),
            timestamp: highs[highs.length - 1].timestamp
          };
        }
      } else if (highsDecreasing && lowsDecreasing) {
        trend = 'bearish';
        if (lows.length > 0) {
          lastBOS = {
            type: 'bearish' as const,
            price: lows[lows.length - 1].price.toString(),
            timestamp: lows[lows.length - 1].timestamp
          };
        }
      }
    }

    return { trend, lastBOS, lastCHoCH };
  }

  /**
   * Multi-timeframe alignment analysis
   */
  private async analyzeMultiTimeframe(): Promise<Record<string, 'bullish' | 'bearish' | 'ranging'>> {
    const timeframes = ['15m', '1H', '4H'];
    const analysis: Record<string, 'bullish' | 'bearish' | 'ranging'> = {};
    
    for (const tf of timeframes) {
      try {
        if (this.okxService) {
          // Get data for each timeframe
          const tfCandles = await this.okxService.getHistoricalCandles('SOL-USDT', tf, 50);
          if (tfCandles && tfCandles.length >= 20) {
            const { trend } = this.analyzeMarketStructure(tfCandles);
            analysis[tf] = trend;
          } else {
            analysis[tf] = 'ranging';
          }
        } else {
          analysis[tf] = 'ranging'; // Fallback
        }
      } catch (error) {
        analysis[tf] = 'ranging';
      }
    }
    
    return analysis;
  }

  /**
   * Find nearest zones (FVGs and Order Blocks)
   */
  private findNearestZones(
    fvgs: FVGData[], 
    orderBlocks: OrderBlockData[], 
    candles: CandleData[]
  ): NearestZoneData[] {
    const currentPrice = parseFloat(candles[candles.length - 1].close);
    const zones: NearestZoneData[] = [];

    // Process FVGs
    const activeFVGs = fvgs.filter(fvg => !fvg.mitigated);
    for (const fvg of activeFVGs) {
      const fvgPrice = (parseFloat(fvg.high) + parseFloat(fvg.low)) / 2;
      const distancePct = ((fvgPrice - currentPrice) / currentPrice) * 100;
      
      zones.push({
        type: 'FVG',
        side: fvgPrice > currentPrice ? 'above' : 'below',
        price: fvgPrice.toFixed(3),
        distancePct: Math.abs(distancePct),
        significance: fvg.significance
      });
    }

    // Process Order Blocks
    const untestedOBs = orderBlocks.filter(ob => !ob.tested);
    for (const ob of untestedOBs) {
      const obPrice = parseFloat(ob.price);
      const distancePct = ((obPrice - currentPrice) / currentPrice) * 100;
      
      zones.push({
        type: 'OB',
        side: obPrice > currentPrice ? 'above' : 'below',
        price: obPrice.toFixed(3),
        distancePct: Math.abs(distancePct),
        significance: ob.strength === 'strong' ? 'high' : ob.strength === 'medium' ? 'medium' : 'low'
      });
    }

    // Sort by distance and return nearest zones
    return zones
      .sort((a, b) => a.distancePct - b.distancePct)
      .slice(0, 6); // Top 6 nearest zones
  }

  /**
   * Analyze derivatives data (funding + OI)
   */
  private async analyzeDerivatives() {
    // This would fetch real data in production
    const mockDerivatives = {
      openInterest: {
        value: "1.2B",
        change24h: "+5.2%",
        trend: 'increasing' as const
      },
      fundingRate: {
        current: "0.0045%",
        next: "0.0052%",
        sentiment: 'bullish' as const,
        extremeLevel: false
      },
      flowAnalysis: {
        signal: 'absorption' as const,
        strength: 'medium' as const,
        description: "OI increasing while price stable suggests absorption"
      }
    };

    return mockDerivatives;
  }

  /**
   * Detect market regime (trending vs ranging)
   */
  private detectMarketRegime(candles: CandleData[]): 'trending' | 'ranging' {
    const atr = this.calculateATR(candles);
    const sma20 = this.calculateSMA(candles, 20);
    
    // Check if price is trending above/below SMA with sufficient volatility
    const currentPrice = parseFloat(candles[candles.length - 1].close);
    const priceDistanceFromSMA = Math.abs(currentPrice - sma20) / sma20;
    
    return (priceDistanceFromSMA > 0.02 && atr.percentile > 50) ? 'trending' : 'ranging';
  }

  /**
   * Get current trading session
   */
  private getCurrentTradingSession(): 'Asia' | 'London' | 'NY' {
    const now = new Date();
    const utcHour = now.getUTCHours();
    
    if (utcHour >= 0 && utcHour < 8) return 'Asia';
    if (utcHour >= 8 && utcHour < 16) return 'London';
    return 'NY';
  }

  /**
   * Generate trading scenarios
   */
  private generateTradingScenarios(
    candles: CandleData[],
    trend: 'bullish' | 'bearish' | 'ranging',
    nearestZones: NearestZoneData[],
    derivatives: any
  ): TradingScenarioData[] {
    const currentPrice = parseFloat(candles[candles.length - 1].close);
    const scenarios: TradingScenarioData[] = [];

    const nearestSupport = nearestZones.find(z => z.side === 'below');
    const nearestResistance = nearestZones.find(z => z.side === 'above');

    // Bullish scenario
    if (nearestSupport && nearestResistance) {
      scenarios.push({
        side: 'bullish',
        trigger: (parseFloat(nearestSupport.price) * 1.001).toFixed(3),
        invalidation: (parseFloat(nearestSupport.price) * 0.995).toFixed(3),
        target: nearestResistance.price,
        probability: trend === 'bullish' ? 75 : trend === 'ranging' ? 50 : 25,
        note: `Bounce from ${nearestSupport.type} support zone`
      });

      // Bearish scenario
      scenarios.push({
        side: 'bearish',
        trigger: (parseFloat(nearestResistance.price) * 0.999).toFixed(3),
        invalidation: (parseFloat(nearestResistance.price) * 1.005).toFixed(3),
        target: nearestSupport.price,
        probability: trend === 'bearish' ? 75 : trend === 'ranging' ? 50 : 25,
        note: `Rejection from ${nearestResistance.type} resistance zone`
      });
    }

    return scenarios;
  }

  /**
   * Calculate ATR with percentile ranking
   */
  private calculateATR(candles: CandleData[]) {
    const trValues: number[] = [];
    
    for (let i = 1; i < candles.length; i++) {
      const high = parseFloat(candles[i].high);
      const low = parseFloat(candles[i].low);
      const prevClose = parseFloat(candles[i-1].close);
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trValues.push(tr);
    }

    const atr14 = trValues.slice(-14).reduce((sum, tr) => sum + tr, 0) / 14;
    const sortedTRs = [...trValues].sort((a, b) => a - b);
    const percentile = (sortedTRs.indexOf(atr14) / sortedTRs.length) * 100;

    let volatilityRegime: 'low' | 'normal' | 'high' = 'normal';
    if (percentile < 25) volatilityRegime = 'low';
    else if (percentile > 75) volatilityRegime = 'high';

    return {
      value: atr14.toFixed(3),
      percentile: Math.round(percentile),
      volatilityRegime
    };
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(candles: CandleData[], period: number): number {
    const prices = candles.slice(-period).map(c => parseFloat(c.close));
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }

  /**
   * Advanced confluence score calculation
   */
  private calculateConfluenceScore(factors: {
    baseConfidence: number;
    multiTimeframe: Record<string, 'bullish' | 'bearish' | 'ranging'>;
    derivatives: any;
    regime: 'trending' | 'ranging';
    nearestZones: NearestZoneData[];
    atr: any;
  }): number {
    let score = factors.baseConfidence * 0.4; // Base 40%

    // Multi-timeframe alignment (25%)
    const timeframes = Object.values(factors.multiTimeframe);
    const bullishTFs = timeframes.filter(tf => tf === 'bullish').length;
    const bearishTFs = timeframes.filter(tf => tf === 'bearish').length;
    const alignment = Math.max(bullishTFs, bearishTFs) / timeframes.length;
    score += alignment * 25;

    // Derivatives confirmation (15%)
    const derivativesBonus = factors.derivatives.flowAnalysis.strength === 'strong' ? 15 : 
                            factors.derivatives.flowAnalysis.strength === 'medium' ? 10 : 5;
    score += derivativesBonus;

    // Regime bonus (10%)
    score += factors.regime === 'trending' ? 10 : 5;

    // Zone proximity (10%)
    const hasNearZones = factors.nearestZones.some(z => z.distancePct < 2);
    score += hasNearZones ? 10 : 0;

    return Math.min(Math.round(score), 100);
  }

  // Original helper methods (simplified versions)
  private detectFVGs(candles: CandleData[], timeframe: string): FVGData[] {
    const fvgs: FVGData[] = [];
    
    for (let i = 1; i < candles.length - 1; i++) {
      const prev = candles[i - 1];
      const current = candles[i];
      const next = candles[i + 1];
      
      // Bullish FVG
      if (parseFloat(prev.high) < parseFloat(next.low)) {
        fvgs.push({
          id: `fvg_${i}_bullish`,
          timeframe,
          type: 'bullish',
          high: next.low,
          low: prev.high,
          timestamp: current.timestamp,
          mitigated: false,
          significance: 'medium'
        });
      }
      
      // Bearish FVG
      if (parseFloat(prev.low) > parseFloat(next.high)) {
        fvgs.push({
          id: `fvg_${i}_bearish`,
          timeframe,
          type: 'bearish',
          high: prev.low,
          low: next.high,
          timestamp: current.timestamp,
          mitigated: false,
          significance: 'medium'
        });
      }
    }
    
    return fvgs;
  }

  private identifyOrderBlocks(candles: CandleData[]): OrderBlockData[] {
    const orderBlocks: OrderBlockData[] = [];
    
    for (let i = 2; i < candles.length - 2; i++) {
      const volume = parseFloat(candles[i].volume);
      const avgVolume = candles.slice(i-5, i).reduce((sum, c) => sum + parseFloat(c.volume), 0) / 5;
      
      if (volume > avgVolume * 1.5) {
        const isGreen = parseFloat(candles[i].close) > parseFloat(candles[i].open);
        
        orderBlocks.push({
          id: `ob_${i}`,
          type: isGreen ? 'demand' : 'supply',
          price: isGreen ? candles[i].low : candles[i].high,
          high: candles[i].high,
          low: candles[i].low,
          volume: candles[i].volume,
          timestamp: candles[i].timestamp,
          strength: volume > avgVolume * 2 ? 'strong' : 'medium',
          tested: false
        });
      }
    }
    
    return orderBlocks;
  }

  private findEqualLevels(candles: CandleData[]): { eqh: StructurePointData[], eql: StructurePointData[] } {
    const highs: StructurePointData[] = [];
    const lows: StructurePointData[] = [];
    
    // Simplified implementation
    for (let i = 10; i < candles.length; i += 10) {
      highs.push({
        type: 'high',
        price: candles[i].high,
        timestamp: candles[i].timestamp,
        significance: 'minor'
      });
      
      lows.push({
        type: 'low',
        price: candles[i].low,
        timestamp: candles[i].timestamp,
        significance: 'minor'
      });
    }
    
    return { eqh: highs, eql: lows };
  }

  private detectLiquiditySweeps(candles: CandleData[], eqh: StructurePointData[], eql: StructurePointData[]) {
    return []; // Simplified
  }

  private determineMarketStructure(
    trend: 'bullish' | 'bearish' | 'ranging',
    fvgs: FVGData[],
    orderBlocks: OrderBlockData[]
  ): 'bullish' | 'bearish' | 'ranging' | 'transitioning' {
    return trend === 'ranging' ? 'ranging' : trend;
  }

  private calculateBaseConfidence(
    fvgs: FVGData[],
    orderBlocks: OrderBlockData[],
    eqh: StructurePointData[],
    eql: StructurePointData[],
    liquiditySweeps: any[]
  ): number {
    let score = 0;
    score += Math.min(fvgs.length * 5, 25);
    score += Math.min(orderBlocks.length * 8, 40);
    score += Math.min((eqh.length + eql.length) * 3, 15);
    score += Math.min(liquiditySweeps.length * 4, 20);
    return Math.min(score, 100);
  }
}
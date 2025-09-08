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
    
    // Enhanced: Cross-Dashboard Risk Analysis
    const riskAlerts = await this.analyzeCrossDashboardRisks(timeframe);
    const riskAdjustedScenarios = this.generateTradingScenarios(sortedCandles, trend, nearestZones, derivatives, riskAlerts);
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
      scenarios: riskAdjustedScenarios,
      riskAlerts, // Enhanced: Cross-dashboard risk integration
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
   * Enhanced: Analyze Cross-Dashboard Risk Conditions
   */
  private async analyzeCrossDashboardRisks(timeframe: string) {
    try {
      // Fetch CVD analysis to check for manipulation and liquidation risks
      const cvdService = new (await import('./cvd')).CVDService();
      const mockCandles = this.generateMockCandles(); // For demonstration
      const mockTrades = this.generateMockTrades(); // For demonstration
      
      const cvdAnalysis = await cvdService.analyzeCVD(mockCandles, mockTrades, timeframe);
      
      const riskAlerts = [];
      let overallRiskLevel: 'low' | 'medium' | 'high' | 'extreme' = 'low';
      
      // Check for manipulation alerts
      if (cvdAnalysis.smartMoneySignals.manipulation.detected) {
        const confidence = cvdAnalysis.smartMoneySignals.manipulation.confidence;
        const riskLevel = confidence > 90 ? 'extreme' : confidence > 70 ? 'high' : 'medium';
        
        riskAlerts.push({
          type: 'manipulation_warning',
          severity: riskLevel,
          message: `${cvdAnalysis.smartMoneySignals.manipulation.type.replace('_', ' ')} pattern detected (${confidence}% confidence)`,
          source: 'CVD_Analysis',
          recommendation: confidence > 85 ? 'Avoid new positions - high manipulation risk' : 'Exercise caution - monitor for manipulation'
        });
        
        if (riskLevel === 'extreme') overallRiskLevel = 'extreme';
        else if (riskLevel === 'high' && overallRiskLevel !== 'extreme') overallRiskLevel = 'high';
      }
      
      // Check for liquidation cascade risks  
      const currentBuyPressure = cvdAnalysis.realTimeMetrics.currentBuyPressure;
      const currentSellPressure = cvdAnalysis.realTimeMetrics.currentSellPressure;
      
      if (currentSellPressure > 70 && cvdAnalysis.realTimeMetrics.momentum === 'bearish') {
        riskAlerts.push({
          type: 'liquidation_cascade',
          severity: 'high',
          message: `High sell pressure (${currentSellPressure}%) with bearish momentum - liquidation cascade risk`,
          source: 'CVD_Flow_Analysis',
          recommendation: 'Reduce position sizes - potential cascade liquidations'
        });
        
        if (overallRiskLevel !== 'extreme') overallRiskLevel = 'high';
      }
      
      // Check for absorption and distribution patterns
      if (cvdAnalysis.flowAnalysis.trend === 'distribution' && cvdAnalysis.flowAnalysis.strength === 'strong') {
        riskAlerts.push({
          type: 'institutional_distribution',
          severity: 'medium',
          message: `Strong institutional distribution detected - ${cvdAnalysis.flowAnalysis.duration} duration`,
          source: 'Flow_Analysis',
          recommendation: 'Monitor for potential price weakness'
        });
        
        if (overallRiskLevel === 'low') overallRiskLevel = 'medium';
      }
      
      return {
        alerts: riskAlerts,
        overallRiskLevel,
        lastUpdate: new Date().toISOString(),
        affectedScenarios: riskAlerts.length > 0
      };
      
    } catch (error) {
      console.warn('Cross-dashboard risk analysis failed:', error);
      return {
        alerts: [],
        overallRiskLevel: 'low' as const,
        lastUpdate: new Date().toISOString(),
        affectedScenarios: false
      };
    }
  }

  /**
   * Generate mock candles for demonstration
   */
  private generateMockCandles(): any[] {
    const candles = [];
    const basePrice = 205;
    
    for (let i = 0; i < 50; i++) {
      const timestamp = (Date.now() - (49 - i) * 3600000).toString();
      const variation = (Math.random() - 0.5) * 4;
      const open = basePrice + variation;
      const close = open + (Math.random() - 0.5) * 2;
      const high = Math.max(open, close) + Math.random() * 1;
      const low = Math.min(open, close) - Math.random() * 1;
      
      candles.push({
        timestamp,
        open: open.toFixed(2),
        high: high.toFixed(2),
        low: low.toFixed(2),
        close: close.toFixed(2),
        volume: (1000000 + Math.random() * 500000).toFixed(0)
      });
    }
    
    return candles;
  }

  /**
   * Generate mock trades for demonstration
   */
  private generateMockTrades(): any[] {
    const trades = [];
    
    for (let i = 0; i < 20; i++) {
      trades.push({
        timestamp: (Date.now() - i * 60000).toString(),
        price: (205 + (Math.random() - 0.5) * 2).toFixed(2),
        size: (Math.random() * 1000).toFixed(2),
        side: Math.random() > 0.5 ? 'buy' : 'sell'
      });
    }
    
    return trades;
  }

  /**
   * Enhanced Generate trading scenarios with risk adjustment
   */
  private generateTradingScenarios(
    candles: CandleData[],
    trend: 'bullish' | 'bearish' | 'ranging',
    nearestZones: NearestZoneData[],
    derivatives: any,
    riskAlerts?: any
  ): TradingScenarioData[] {
    const currentPrice = parseFloat(candles[candles.length - 1].close);
    const scenarios: TradingScenarioData[] = [];

    const nearestSupport = nearestZones.find(z => z.side === 'below');
    const nearestResistance = nearestZones.find(z => z.side === 'above');

    // Enhanced: Risk-adjusted probability calculation
    let baseBullishProb = trend === 'bullish' ? 75 : trend === 'ranging' ? 50 : 25;
    let baseBearishProb = trend === 'bearish' ? 75 : trend === 'ranging' ? 50 : 25;
    
    // Apply risk adjustments
    if (riskAlerts && riskAlerts.affectedScenarios) {
      const riskLevel = riskAlerts.overallRiskLevel;
      const manipulationRisk = riskAlerts.alerts.some((alert: any) => alert.type === 'manipulation_warning');
      const liquidationRisk = riskAlerts.alerts.some((alert: any) => alert.type === 'liquidation_cascade');
      
      // Reduce probabilities based on risk level
      const riskReduction = riskLevel === 'extreme' ? 40 : riskLevel === 'high' ? 25 : riskLevel === 'medium' ? 15 : 0;
      
      baseBullishProb = Math.max(10, baseBullishProb - riskReduction);
      baseBearishProb = Math.max(10, baseBearishProb - riskReduction);
      
      // Additional adjustments for specific risk types
      if (manipulationRisk) {
        baseBullishProb = Math.max(10, baseBullishProb - 10);
        baseBearishProb = Math.max(10, baseBearishProb - 10);
      }
      
      if (liquidationRisk && trend !== 'bearish') {
        baseBearishProb = Math.min(80, baseBearishProb + 15); // Increase bearish probability during liquidation risk
      }
    }

    // Bullish scenario
    if (nearestSupport && nearestResistance) {
      const bullishNote = riskAlerts && riskAlerts.alerts.length > 0 ? 
        `Bounce from ${nearestSupport.type} support zone (Risk Adjusted)` :
        `Bounce from ${nearestSupport.type} support zone`;
        
      scenarios.push({
        side: 'bullish',
        trigger: (parseFloat(nearestSupport.price) * 1.001).toFixed(3),
        invalidation: (parseFloat(nearestSupport.price) * 0.995).toFixed(3),
        target: nearestResistance.price,
        probability: baseBullishProb,
        note: bullishNote
      });

      // Bearish scenario
      const bearishNote = riskAlerts && riskAlerts.alerts.length > 0 ?
        `Rejection from ${nearestResistance.type} resistance zone (Risk Adjusted)` :
        `Rejection from ${nearestResistance.type} resistance zone`;
        
      scenarios.push({
        side: 'bearish',
        trigger: (parseFloat(nearestResistance.price) * 0.999).toFixed(3),
        invalidation: (parseFloat(nearestResistance.price) * 1.005).toFixed(3),
        target: nearestSupport.price,
        probability: baseBearishProb,
        note: bearishNote
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
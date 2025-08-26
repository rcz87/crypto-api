import { CandleData, SMCAnalysisData, FVGData, OrderBlockData, StructurePointData } from '@shared/schema';

export class SMCService {
  private tolerance = 0.002; // 0.2% tolerance for equal levels
  
  /**
   * Perform comprehensive SMC analysis on candlestick data
   */
  public async analyzeSMC(
    candles: CandleData[], 
    timeframe: string = '1H'
  ): Promise<SMCAnalysisData> {
    if (candles.length < 20) {
      throw new Error('Insufficient candle data for SMC analysis. Need at least 20 candles.');
    }

    // Sort candles by timestamp (oldest first)
    const sortedCandles = [...candles].sort((a, b) => 
      parseInt(a.timestamp) - parseInt(b.timestamp)
    );

    // 1. Detect Market Structure (BOS/CHoCH)
    const { trend, lastBOS, lastCHoCH } = this.analyzeMarketStructure(sortedCandles);
    
    // 2. Identify Fair Value Gaps (FVGs)
    const fvgs = this.detectFVGs(sortedCandles, timeframe);
    
    // 3. Find Order Blocks
    const orderBlocks = this.identifyOrderBlocks(sortedCandles);
    
    // 4. Detect Equal Highs/Lows
    const { eqh, eql } = this.findEqualLevels(sortedCandles);
    
    // 5. Identify Liquidity Sweeps
    const liquiditySweeps = this.detectLiquiditySweeps(sortedCandles, eqh, eql);
    
    // 6. Determine overall market structure
    const marketStructure = this.determineMarketStructure(trend, fvgs, orderBlocks);
    
    // 7. Calculate confidence score
    const confidence = this.calculateConfidence(fvgs, orderBlocks, eqh, eql, liquiditySweeps);

    return {
      timeframe,
      trend,
      lastBOS,
      lastCHoCH,
      fvgs: fvgs.slice(-10), // Keep only last 10 FVGs
      orderBlocks: orderBlocks.slice(-8), // Keep only last 8 order blocks
      eqh: eqh.slice(-5), // Keep only last 5 equal highs
      eql: eql.slice(-5), // Keep only last 5 equal lows
      liquiditySweeps: liquiditySweeps.slice(-5), // Keep only last 5 sweeps
      marketStructure,
      confidence
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
      
      // Swing high detection
      if (current > prev2 && current > prev1 && current > next1 && current > next2) {
        highs.push({
          price: current,
          index: i,
          timestamp: candles[i].timestamp
        });
      }
      
      // Swing low detection
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

    // Analyze for BOS/CHoCH
    let trend: 'bullish' | 'bearish' | 'ranging' = 'ranging';
    let lastBOS = null;
    let lastCHoCH = null;

    // Simple trend determination
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
   * Detect Fair Value Gaps (FVGs)
   */
  private detectFVGs(candles: CandleData[], timeframe: string): FVGData[] {
    const fvgs: FVGData[] = [];
    
    for (let i = 1; i < candles.length - 1; i++) {
      const prev = candles[i - 1];
      const current = candles[i];
      const next = candles[i + 1];
      
      const prevHigh = parseFloat(prev.high);
      const prevLow = parseFloat(prev.low);
      const currentHigh = parseFloat(current.high);
      const currentLow = parseFloat(current.low);
      const nextHigh = parseFloat(next.high);
      const nextLow = parseFloat(next.low);
      
      // Bullish FVG: Previous high < Next low (gap up)
      if (prevHigh < nextLow) {
        const gapSize = nextLow - prevHigh;
        const significance = gapSize > (currentHigh - currentLow) * 2 ? 'high' : 
                           gapSize > (currentHigh - currentLow) ? 'medium' : 'low';
        
        fvgs.push({
          id: `fvg_bull_${i}_${timeframe}`,
          timeframe,
          type: 'bullish',
          high: nextLow.toString(),
          low: prevHigh.toString(),
          timestamp: current.timestamp,
          mitigated: false,
          significance: significance as 'low' | 'medium' | 'high'
        });
      }
      
      // Bearish FVG: Previous low > Next high (gap down)
      if (prevLow > nextHigh) {
        const gapSize = prevLow - nextHigh;
        const significance = gapSize > (currentHigh - currentLow) * 2 ? 'high' : 
                           gapSize > (currentHigh - currentLow) ? 'medium' : 'low';
        
        fvgs.push({
          id: `fvg_bear_${i}_${timeframe}`,
          timeframe,
          type: 'bearish',
          high: prevLow.toString(),
          low: nextHigh.toString(),
          timestamp: current.timestamp,
          mitigated: false,
          significance: significance as 'low' | 'medium' | 'high'
        });
      }
    }
    
    return fvgs;
  }

  /**
   * Identify Order Blocks (demand and supply zones)
   */
  private identifyOrderBlocks(candles: CandleData[]): OrderBlockData[] {
    const orderBlocks: OrderBlockData[] = [];
    
    for (let i = 5; i < candles.length - 5; i++) {
      const current = candles[i];
      const currentHigh = parseFloat(current.high);
      const currentLow = parseFloat(current.low);
      const currentClose = parseFloat(current.close);
      const currentOpen = parseFloat(current.open);
      const currentVolume = parseFloat(current.volume);
      
      // Check for strong rejection candles
      const bodySize = Math.abs(currentClose - currentOpen);
      const totalSize = currentHigh - currentLow;
      const upperWick = currentHigh - Math.max(currentClose, currentOpen);
      const lowerWick = Math.min(currentClose, currentOpen) - currentLow;
      
      // Supply zone (bearish order block) - strong upper wick rejection
      if (upperWick > bodySize * 1.5 && upperWick > totalSize * 0.4) {
        const avgVolume = candles.slice(Math.max(0, i-10), i)
          .reduce((sum, c) => sum + parseFloat(c.volume), 0) / 10;
        
        const strength = currentVolume > avgVolume * 2 ? 'strong' : 
                        currentVolume > avgVolume * 1.5 ? 'medium' : 'weak';
        
        orderBlocks.push({
          id: `ob_supply_${i}`,
          type: 'supply',
          price: currentHigh.toString(),
          high: currentHigh.toString(),
          low: Math.max(currentClose, currentOpen).toString(),
          volume: currentVolume.toString(),
          timestamp: current.timestamp,
          strength: strength as 'weak' | 'medium' | 'strong',
          tested: false
        });
      }
      
      // Demand zone (bullish order block) - strong lower wick rejection
      if (lowerWick > bodySize * 1.5 && lowerWick > totalSize * 0.4) {
        const avgVolume = candles.slice(Math.max(0, i-10), i)
          .reduce((sum, c) => sum + parseFloat(c.volume), 0) / 10;
        
        const strength = currentVolume > avgVolume * 2 ? 'strong' : 
                        currentVolume > avgVolume * 1.5 ? 'medium' : 'weak';
        
        orderBlocks.push({
          id: `ob_demand_${i}`,
          type: 'demand',
          price: currentLow.toString(),
          high: Math.min(currentClose, currentOpen).toString(),
          low: currentLow.toString(),
          volume: currentVolume.toString(),
          timestamp: current.timestamp,
          strength: strength as 'weak' | 'medium' | 'strong',
          tested: false
        });
      }
    }
    
    return orderBlocks;
  }

  /**
   * Find Equal Highs and Equal Lows
   */
  private findEqualLevels(candles: CandleData[]) {
    const eqh: StructurePointData[] = [];
    const eql: StructurePointData[] = [];
    
    const highs: Array<{price: number, timestamp: string}> = [];
    const lows: Array<{price: number, timestamp: string}> = [];
    
    // Extract swing highs and lows
    for (let i = 2; i < candles.length - 2; i++) {
      const currentHigh = parseFloat(candles[i].high);
      const currentLow = parseFloat(candles[i].low);
      
      // Check if it's a swing high
      if (currentHigh > parseFloat(candles[i-1].high) && 
          currentHigh > parseFloat(candles[i-2].high) &&
          currentHigh > parseFloat(candles[i+1].high) && 
          currentHigh > parseFloat(candles[i+2].high)) {
        highs.push({
          price: currentHigh,
          timestamp: candles[i].timestamp
        });
      }
      
      // Check if it's a swing low
      if (currentLow < parseFloat(candles[i-1].low) && 
          currentLow < parseFloat(candles[i-2].low) &&
          currentLow < parseFloat(candles[i+1].low) && 
          currentLow < parseFloat(candles[i+2].low)) {
        lows.push({
          price: currentLow,
          timestamp: candles[i].timestamp
        });
      }
    }
    
    // Find equal highs
    for (let i = 0; i < highs.length; i++) {
      for (let j = i + 1; j < highs.length; j++) {
        const priceDiff = Math.abs(highs[i].price - highs[j].price);
        const tolerance = highs[i].price * this.tolerance;
        
        if (priceDiff <= tolerance) {
          eqh.push({
            type: 'high',
            price: highs[j].price.toString(),
            timestamp: highs[j].timestamp,
            significance: 'major' // All equal levels are considered significant
          });
        }
      }
    }
    
    // Find equal lows
    for (let i = 0; i < lows.length; i++) {
      for (let j = i + 1; j < lows.length; j++) {
        const priceDiff = Math.abs(lows[i].price - lows[j].price);
        const tolerance = lows[i].price * this.tolerance;
        
        if (priceDiff <= tolerance) {
          eql.push({
            type: 'low',
            price: lows[j].price.toString(),
            timestamp: lows[j].timestamp,
            significance: 'major'
          });
        }
      }
    }
    
    return { eqh, eql };
  }

  /**
   * Detect Liquidity Sweeps
   */
  private detectLiquiditySweeps(
    candles: CandleData[], 
    eqh: StructurePointData[], 
    eql: StructurePointData[]
  ) {
    const sweeps = [];
    
    // Check for buy-side liquidity sweeps (breaking above equal highs)
    for (const high of eqh) {
      const highPrice = parseFloat(high.price);
      
      for (let i = 1; i < candles.length; i++) {
        const candleHigh = parseFloat(candles[i].high);
        const candleClose = parseFloat(candles[i].close);
        
        // Price breaks above the level but closes back below
        if (candleHigh > highPrice && candleClose < highPrice) {
          sweeps.push({
            type: 'buy_side' as const,
            level: high.price,
            timestamp: candles[i].timestamp,
            confirmed: true
          });
          break; // Only count first sweep of each level
        }
      }
    }
    
    // Check for sell-side liquidity sweeps (breaking below equal lows)
    for (const low of eql) {
      const lowPrice = parseFloat(low.price);
      
      for (let i = 1; i < candles.length; i++) {
        const candleLow = parseFloat(candles[i].low);
        const candleClose = parseFloat(candles[i].close);
        
        // Price breaks below the level but closes back above
        if (candleLow < lowPrice && candleClose > lowPrice) {
          sweeps.push({
            type: 'sell_side' as const,
            level: low.price,
            timestamp: candles[i].timestamp,
            confirmed: true
          });
          break; // Only count first sweep of each level
        }
      }
    }
    
    return sweeps;
  }

  /**
   * Determine overall market structure
   */
  private determineMarketStructure(
    trend: 'bullish' | 'bearish' | 'ranging',
    fvgs: FVGData[],
    orderBlocks: OrderBlockData[]
  ): 'bullish' | 'bearish' | 'ranging' | 'transitioning' {
    
    // Count recent bullish vs bearish signals
    const recentFVGs = fvgs.slice(-5);
    const recentOBs = orderBlocks.slice(-5);
    
    const bullishSignals = recentFVGs.filter(f => f.type === 'bullish').length +
                          recentOBs.filter(ob => ob.type === 'demand').length;
    
    const bearishSignals = recentFVGs.filter(f => f.type === 'bearish').length +
                          recentOBs.filter(ob => ob.type === 'supply').length;
    
    if (Math.abs(bullishSignals - bearishSignals) <= 1) {
      return trend === 'ranging' ? 'ranging' : 'transitioning';
    }
    
    return bullishSignals > bearishSignals ? 'bullish' : 'bearish';
  }

  /**
   * Calculate confidence score based on signal confluence
   */
  private calculateConfidence(
    fvgs: FVGData[],
    orderBlocks: OrderBlockData[],
    eqh: StructurePointData[],
    eql: StructurePointData[],
    liquiditySweeps: any[]
  ): number {
    let score = 0;
    
    // Base score for having signals
    score += Math.min(fvgs.length * 5, 25); // Max 25 points for FVGs
    score += Math.min(orderBlocks.length * 8, 40); // Max 40 points for order blocks
    score += Math.min((eqh.length + eql.length) * 3, 15); // Max 15 points for equal levels
    score += Math.min(liquiditySweeps.length * 4, 20); // Max 20 points for sweeps
    
    // Bonus for high significance signals
    const highSigFVGs = fvgs.filter(f => f.significance === 'high').length;
    const strongOBs = orderBlocks.filter(ob => ob.strength === 'strong').length;
    
    score += highSigFVGs * 3;
    score += strongOBs * 5;
    
    return Math.min(score, 100);
  }
}
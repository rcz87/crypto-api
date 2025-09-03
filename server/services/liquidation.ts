import { CandleData, OrderBookData, OpenInterestData, FundingRateData } from '@shared/schema';

export interface LiquidationLevel {
  price: string;
  leverage: number;
  volumeUSD: string;
  side: 'long' | 'short';
  distance: string;
  distancePercent: number;
  significance: 'minor' | 'major' | 'critical';
}

export interface LiquidationHeatmap {
  levels: LiquidationLevel[];
  maxLiquidation: {
    price: string;
    volumeUSD: string;
    side: 'long' | 'short';
  };
  currentPrice: string;
  nearestLiquidations: {
    above: LiquidationLevel[];
    below: LiquidationLevel[];
  };
  totalOpenInterest: string;
  liquidationRisk: 'low' | 'moderate' | 'high' | 'extreme';
}

export interface LiquidationAnalysis {
  timeframe: string;
  heatmap: LiquidationHeatmap;
  riskMetrics: {
    liquidationPressure: 'low' | 'moderate' | 'high' | 'extreme';
    cascadeRisk: number; // 0-100
    volatilityImpact: number; // Expected price impact from liquidations
    timeToLiquidation: string; // Estimated time to major liquidations
  };
  recommendations: {
    entryZones: string[];
    avoidZones: string[];
    stopLossGuidance: string;
  };
  lastUpdate: string;
}

/**
 * LiquidationService - Advanced futures liquidation analysis
 * 
 * Provides comprehensive liquidation level detection and risk analysis
 * for SOL perpetual futures trading, helping identify:
 * - Liquidation clusters and potential cascade zones
 * - Entry opportunities around major liquidation levels
 * - Risk management guidance for leveraged positions
 */
export class LiquidationService {
  
  // Standard leverage ratios used in futures trading
  private readonly COMMON_LEVERAGES = [2, 3, 5, 10, 20, 25, 50, 100];
  private readonly WHALE_THRESHOLD_USD = 100000; // $100k+ positions
  private readonly MAJOR_THRESHOLD_USD = 50000;  // $50k+ positions
  
  /**
   * Analyze liquidation levels from market data
   */
  async analyzeLiquidations(
    currentPrice: number,
    orderBook: OrderBookData,
    openInterest: OpenInterestData,
    fundingRate: FundingRateData,
    recentCandles: CandleData[],
    timeframe: string = '1H'
  ): Promise<LiquidationAnalysis> {
    
    // 1. Calculate theoretical liquidation levels
    const liquidationLevels = this.calculateLiquidationLevels(currentPrice, openInterest);
    
    // 2. Enhance with order book clustering
    const enhancedLevels = this.enhanceWithOrderBookData(liquidationLevels, orderBook, currentPrice);
    
    // 3. Build liquidation heatmap
    const heatmap = this.buildLiquidationHeatmap(enhancedLevels, currentPrice, openInterest);
    
    // 4. Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(heatmap, recentCandles, fundingRate);
    
    // 5. Generate trading recommendations
    const recommendations = this.generateRecommendations(heatmap, riskMetrics, currentPrice);
    
    return {
      timeframe,
      heatmap,
      riskMetrics,
      recommendations,
      lastUpdate: new Date().toISOString()
    };
  }
  
  /**
   * Calculate theoretical liquidation levels based on common leverage ratios
   */
  private calculateLiquidationLevels(currentPrice: number, openInterest: OpenInterestData): LiquidationLevel[] {
    const levels: LiquidationLevel[] = [];
    const oiUSD = parseFloat(openInterest.oiUsd || '0');
    
    // Long liquidation levels (below current price)
    this.COMMON_LEVERAGES.forEach(leverage => {
      // Liquidation occurs at ~95% of entry for long positions
      // Due to maintenance margin requirements
      const liquidationPrice = currentPrice * (1 - (0.95 / leverage));
      const estimatedVolume = (oiUSD * 0.6) / this.COMMON_LEVERAGES.length; // Assume 60% long positions
      
      levels.push({
        price: liquidationPrice.toFixed(4),
        leverage,
        volumeUSD: estimatedVolume.toFixed(0),
        side: 'long',
        distance: (currentPrice - liquidationPrice).toFixed(4),
        distancePercent: ((currentPrice - liquidationPrice) / currentPrice * 100),
        significance: this.getSignificance(estimatedVolume)
      });
    });
    
    // Short liquidation levels (above current price)  
    this.COMMON_LEVERAGES.forEach(leverage => {
      // Liquidation occurs at ~105% of entry for short positions
      const liquidationPrice = currentPrice * (1 + (0.95 / leverage));
      const estimatedVolume = (oiUSD * 0.4) / this.COMMON_LEVERAGES.length; // Assume 40% short positions
      
      levels.push({
        price: liquidationPrice.toFixed(4),
        leverage,
        volumeUSD: estimatedVolume.toFixed(0),
        side: 'short',
        distance: (liquidationPrice - currentPrice).toFixed(4),
        distancePercent: ((liquidationPrice - currentPrice) / currentPrice * 100),
        significance: this.getSignificance(estimatedVolume)
      });
    });
    
    return levels.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  }
  
  /**
   * Enhance liquidation levels with order book clustering data
   */
  private enhanceWithOrderBookData(
    levels: LiquidationLevel[], 
    orderBook: OrderBookData, 
    currentPrice: number
  ): LiquidationLevel[] {
    
    const enhanced: LiquidationLevel[] = [];
    
    levels.forEach(level => {
      const levelPrice = parseFloat(level.price);
      
      // Find nearby order book levels (within 0.5% of liquidation level)
      const nearbyOrders = [
        ...orderBook.bids.filter(bid => {
          const bidPrice = parseFloat(bid.price);
          return Math.abs(bidPrice - levelPrice) / levelPrice < 0.005;
        }),
        ...orderBook.asks.filter(ask => {
          const askPrice = parseFloat(ask.price);
          return Math.abs(askPrice - levelPrice) / levelPrice < 0.005;
        })
      ];
      
      // Aggregate nearby volume
      const nearbyVolume = nearbyOrders.reduce((sum, order) => 
        sum + (parseFloat(order.size) * levelPrice), 0
      );
      
      // Enhance volume estimate with order book data
      const enhancedVolume = parseFloat(level.volumeUSD) + nearbyVolume;
      
      enhanced.push({
        ...level,
        volumeUSD: enhancedVolume.toFixed(0),
        significance: this.getSignificance(enhancedVolume)
      });
    });
    
    return enhanced;
  }
  
  /**
   * Build comprehensive liquidation heatmap
   */
  private buildLiquidationHeatmap(
    levels: LiquidationLevel[], 
    currentPrice: number, 
    openInterest: OpenInterestData
  ): LiquidationHeatmap {
    
    // Find maximum liquidation level
    const maxLevel = levels.reduce((max, level) => 
      parseFloat(level.volumeUSD) > parseFloat(max.volumeUSD) ? level : max
    );
    
    // Separate levels above and below current price
    const above = levels.filter(l => parseFloat(l.price) > currentPrice).slice(0, 10);
    const below = levels.filter(l => parseFloat(l.price) < currentPrice).slice(-10);
    
    // Calculate liquidation risk
    const totalVolume = levels.reduce((sum, l) => sum + parseFloat(l.volumeUSD), 0);
    const criticalVolume = levels
      .filter(l => l.significance === 'critical')
      .reduce((sum, l) => sum + parseFloat(l.volumeUSD), 0);
    
    const riskRatio = criticalVolume / totalVolume;
    const liquidationRisk = riskRatio > 0.4 ? 'extreme' :
                           riskRatio > 0.25 ? 'high' :
                           riskRatio > 0.15 ? 'moderate' : 'low';
    
    return {
      levels,
      maxLiquidation: {
        price: maxLevel.price,
        volumeUSD: maxLevel.volumeUSD,
        side: maxLevel.side
      },
      currentPrice: currentPrice.toFixed(4),
      nearestLiquidations: {
        above: above.slice(0, 5),
        below: below.slice(0, 5)
      },
      totalOpenInterest: openInterest.oiUsd,
      liquidationRisk
    };
  }
  
  /**
   * Calculate comprehensive risk metrics
   */
  private calculateRiskMetrics(
    heatmap: LiquidationHeatmap, 
    recentCandles: CandleData[], 
    fundingRate: FundingRateData
  ) {
    
    // Calculate average volatility from recent candles
    const volatility = this.calculateVolatility(recentCandles);
    
    // Estimate cascade risk based on liquidation clustering
    const cascadeRisk = this.calculateCascadeRisk(heatmap);
    
    // Estimate volatility impact from liquidations
    const volatilityImpact = this.calculateVolatilityImpact(heatmap, volatility);
    
    // Estimate time to major liquidations based on funding rate and volatility
    const timeToLiquidation = this.estimateTimeToLiquidation(
      heatmap, 
      volatility, 
      parseFloat(fundingRate.fundingRate)
    );
    
    const liquidationPressure: 'low' | 'moderate' | 'high' | 'extreme' = 
                               cascadeRisk > 75 ? 'extreme' :
                               cascadeRisk > 50 ? 'high' :
                               cascadeRisk > 25 ? 'moderate' : 'low';
    
    return {
      liquidationPressure,
      cascadeRisk,
      volatilityImpact,
      timeToLiquidation
    };
  }
  
  /**
   * Generate trading recommendations based on liquidation analysis
   */
  private generateRecommendations(
    heatmap: LiquidationHeatmap, 
    riskMetrics: any, 
    currentPrice: number
  ) {
    const entryZones: string[] = [];
    const avoidZones: string[] = [];
    let stopLossGuidance = '';
    
    // Entry zones: Areas with high liquidation clusters (liquidity)
    const majorLiquidations = heatmap.levels.filter(l => l.significance === 'critical');
    majorLiquidations.forEach(liq => {
      if (Math.abs(parseFloat(liq.price) - currentPrice) / currentPrice > 0.02) {
        entryZones.push(`$${parseFloat(liq.price).toFixed(2)} (${liq.side} liquidations)`);
      }
    });
    
    // Avoid zones: Areas with extreme liquidation risk
    if (heatmap.liquidationRisk === 'extreme' || heatmap.liquidationRisk === 'high') {
      const riskZones = heatmap.nearestLiquidations.above
        .concat(heatmap.nearestLiquidations.below)
        .filter(l => l.significance === 'critical');
      
      riskZones.forEach(zone => {
        avoidZones.push(`$${parseFloat(zone.price).toFixed(2)} (High liquidation risk)`);
      });
    }
    
    // Stop loss guidance
    const nearestMajorLiq = [...heatmap.nearestLiquidations.above, ...heatmap.nearestLiquidations.below]
      .filter(l => l.significance === 'major' || l.significance === 'critical')
      .sort((a, b) => Math.abs(parseFloat(a.price) - currentPrice) - Math.abs(parseFloat(b.price) - currentPrice))[0];
    
    if (nearestMajorLiq) {
      const distance = Math.abs(parseFloat(nearestMajorLiq.price) - currentPrice);
      const safeDistance = distance * 0.8; // 20% buffer
      stopLossGuidance = `Keep stops ${safeDistance.toFixed(2)} points away from major liquidation at $${nearestMajorLiq.price}`;
    } else {
      stopLossGuidance = 'No major liquidation clusters detected nearby - standard risk management applies';
    }
    
    return {
      entryZones: entryZones.slice(0, 3),
      avoidZones: avoidZones.slice(0, 3),
      stopLossGuidance
    };
  }
  
  // Helper methods
  private getSignificance(volumeUSD: number): 'minor' | 'major' | 'critical' {
    if (volumeUSD >= this.WHALE_THRESHOLD_USD) return 'critical';
    if (volumeUSD >= this.MAJOR_THRESHOLD_USD) return 'major';
    return 'minor';
  }
  
  private calculateVolatility(candles: CandleData[]): number {
    if (candles.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < candles.length; i++) {
      const prev = parseFloat(candles[i-1].close);
      const curr = parseFloat(candles[i].close);
      returns.push((curr - prev) / prev);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * 100; // Return as percentage
  }
  
  private calculateCascadeRisk(heatmap: LiquidationHeatmap): number {
    const clusteredLiquidations = heatmap.levels.filter(l => l.significance === 'critical').length;
    const totalLevels = heatmap.levels.length;
    
    // Risk increases exponentially with clustering
    const clusteringRatio = clusteredLiquidations / totalLevels;
    return Math.min(100, clusteringRatio * 200);
  }
  
  private calculateVolatilityImpact(heatmap: LiquidationHeatmap, baseVolatility: number): number {
    const totalLiquidationVolume = heatmap.levels
      .reduce((sum, l) => sum + parseFloat(l.volumeUSD), 0);
    
    // Estimate price impact based on liquidation volume
    // Higher volume = higher potential volatility spike
    const volumeImpact = Math.min(50, totalLiquidationVolume / 1000000); // $1M = 1% impact
    return baseVolatility + volumeImpact;
  }
  
  private estimateTimeToLiquidation(
    heatmap: LiquidationHeatmap, 
    volatility: number, 
    fundingRate: number
  ): string {
    const nearestLevel = [...heatmap.nearestLiquidations.above, ...heatmap.nearestLiquidations.below][0];
    if (!nearestLevel) return 'No immediate liquidation risk';
    
    const distance = Math.abs(parseFloat(nearestLevel.price) - parseFloat(heatmap.currentPrice));
    const distancePercent = (distance / parseFloat(heatmap.currentPrice)) * 100;
    
    // Estimate based on current volatility
    const hoursToReach = distancePercent / (volatility / 24); // Assuming daily volatility
    
    if (hoursToReach < 1) return '< 1 hour';
    if (hoursToReach < 24) return `~${Math.round(hoursToReach)} hours`;
    if (hoursToReach < 168) return `~${Math.round(hoursToReach / 24)} days`;
    return '> 1 week';
  }
}
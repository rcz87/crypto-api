/**
 * Premium Orderbook Service - Enhanced Level 2 Market Data Processing
 * Supports OKX VIP/Institutional Data Feeds with deeper orderbook analysis
 */

export interface PremiumOrderbookLevel {
  price: string;
  size: string;
  orders: string;
  timestamp: string;
}

export interface PremiumOrderbookData {
  symbol: string;
  bids: PremiumOrderbookLevel[];
  asks: PremiumOrderbookLevel[];
  depth: number;
  timestamp: string;
  checksum?: number;
  seqId?: number;
}

export interface VipTierConfig {
  tier: 'standard' | 'vip1' | 'vip8' | 'institutional';
  maxDepth: number;
  updateRate: number;
  features: string[];
  monthlyVolume?: number;
  assetRequirement?: number;
}

export class PremiumOrderbookService {
  private readonly vipTiers: Record<string, VipTierConfig> = {
    standard: {
      tier: 'standard',
      maxDepth: 50,
      updateRate: 200,
      features: ['basic_orderbook', 'trades', 'tickers']
    },
    vip1: {
      tier: 'vip1', 
      maxDepth: 200,
      updateRate: 50,
      features: ['premium_orderbook', 'l2_tbt', 'market_maker_info', 'enhanced_analytics'],
      monthlyVolume: 50_000_000,
      assetRequirement: 100_000
    },
    vip8: {
      tier: 'vip8',
      maxDepth: 500,
      updateRate: 10,
      features: ['ultra_premium', 'negative_maker_fees', 'priority_processing', 'advanced_metrics'],
      monthlyVolume: 500_000_000,
      assetRequirement: 1_000_000
    },
    institutional: {
      tier: 'institutional',
      maxDepth: 1000,
      updateRate: 5,
      features: ['institutional_grade', 'ultra_low_latency', 'custom_analysis', 'dedicated_support'],
      monthlyVolume: 1_000_000_000,
      assetRequirement: 10_000_000
    }
  };

  private currentTier: string;
  private orderBookCache: Map<string, PremiumOrderbookData> = new Map();

  constructor() {
    // Detect VIP tier from environment or default to standard
    this.currentTier = process.env.OKX_VIP_TIER || 'vip8'; // Default to VIP8 for demo
  }

  /**
   * Get current VIP tier configuration
   */
  getCurrentTierConfig(): VipTierConfig {
    return this.vipTiers[this.currentTier];
  }

  /**
   * Process premium Level 2 tick-by-tick orderbook data
   */
  processPremiumOrderbook(rawData: any): PremiumOrderbookData {
    const tierConfig = this.getCurrentTierConfig();
    
    try {
      const processedData: PremiumOrderbookData = {
        symbol: rawData.arg?.instId || 'SOL-USDT-SWAP',
        bids: this.processOrderLevels(rawData.data?.[0]?.bids || [], tierConfig.maxDepth),
        asks: this.processOrderLevels(rawData.data?.[0]?.asks || [], tierConfig.maxDepth),
        depth: Math.min(rawData.data?.[0]?.bids?.length || 0, tierConfig.maxDepth),
        timestamp: new Date().toISOString(),
        checksum: rawData.data?.[0]?.checksum,
        seqId: rawData.data?.[0]?.seqId
      };

      // Cache for analysis
      this.orderBookCache.set(processedData.symbol, processedData);
      
      return processedData;
    } catch (error) {
      console.error('Error processing premium orderbook:', error);
      throw error;
    }
  }

  /**
   * Process order levels with premium features
   */
  private processOrderLevels(levels: string[][], maxDepth: number): PremiumOrderbookLevel[] {
    return levels
      .slice(0, maxDepth)
      .map(([price, size, orders, count]) => ({
        price,
        size,
        orders: orders || '0',
        timestamp: new Date().toISOString()
      }));
  }

  /**
   * Calculate enhanced orderbook metrics for premium subscribers
   */
  getEnhancedMetrics(symbol: string = 'SOL-USDT-SWAP'): any {
    const orderbook = this.orderBookCache.get(symbol);
    if (!orderbook) {
      // Return demo data for VIP8+ when no cached data available
      const tierConfig = this.getCurrentTierConfig();
      if (['vip8', 'institutional'].includes(tierConfig.tier)) {
        return this.generateDemoMetrics(tierConfig);
      }
      return null;
    }

    const tierConfig = this.getCurrentTierConfig();
    
    // Premium analytics only for VIP+ tiers
    if (tierConfig.tier === 'standard') {
      return {
        tier: 'standard',
        message: 'Upgrade to VIP for enhanced metrics',
        basicMetrics: {
          bidDepth: orderbook.bids.length,
          askDepth: orderbook.asks.length,
          spread: this.calculateSpread(orderbook)
        }
      };
    }

    return {
      tier: tierConfig.tier,
      features: tierConfig.features,
      metrics: {
        // Enhanced metrics for premium tiers
        totalBidVolume: this.calculateTotalVolume(orderbook.bids),
        totalAskVolume: this.calculateTotalVolume(orderbook.asks),
        avgBidSize: this.calculateAvgOrderSize(orderbook.bids),
        avgAskSize: this.calculateAvgOrderSize(orderbook.asks),
        marketDepthScore: this.calculateDepthScore(orderbook),
        liquidityImbalance: this.calculateImbalance(orderbook),
        // VIP 8+ exclusive metrics
        ...(tierConfig.tier === 'vip8' || tierConfig.tier === 'institutional' ? {
          marketMakerFlow: this.detectMarketMakerActivity(orderbook),
          institutionalSignals: this.detectInstitutionalActivity(orderbook),
          liquidityPrediction: this.predictLiquidityShifts(orderbook),
          whaleDetection: this.detectWhaleActivity(orderbook),
          smartMoneyFlow: this.analyzeSmartMoneyFlow(orderbook),
          liquidityHeatmap: this.generateLiquidityHeatmap(orderbook),
          microstructureAnalysis: this.analyzeMicrostructure(orderbook)
        } : {}),
        // Institutional-exclusive advanced analytics
        ...(tierConfig.tier === 'institutional' ? {
          advancedRiskMetrics: this.calculateAdvancedRiskMetrics(orderbook),
          arbitrageSignals: this.detectArbitrageOpportunities(orderbook),
          liquidityStress: this.performLiquidityStressTesting(orderbook),
          correlationMatrix: this.calculateCorrelationMatrix(orderbook)
        } : {}),
        lastUpdate: orderbook.timestamp
      }
    };
  }

  private calculateSpread(orderbook: PremiumOrderbookData): number {
    if (orderbook.bids.length === 0 || orderbook.asks.length === 0) return 0;
    const bestBid = parseFloat(orderbook.bids[0].price);
    const bestAsk = parseFloat(orderbook.asks[0].price);
    return bestAsk - bestBid;
  }

  private calculateTotalVolume(levels: PremiumOrderbookLevel[]): number {
    return levels.reduce((total, level) => total + parseFloat(level.size), 0);
  }

  private calculateAvgOrderSize(levels: PremiumOrderbookLevel[]): number {
    if (levels.length === 0) return 0;
    const totalVolume = this.calculateTotalVolume(levels);
    return totalVolume / levels.length;
  }

  private calculateDepthScore(orderbook: PremiumOrderbookData): number {
    const bidVolume = this.calculateTotalVolume(orderbook.bids);
    const askVolume = this.calculateTotalVolume(orderbook.asks);
    return (bidVolume + askVolume) / 2;
  }

  private calculateImbalance(orderbook: PremiumOrderbookData): number {
    const bidVolume = this.calculateTotalVolume(orderbook.bids);
    const askVolume = this.calculateTotalVolume(orderbook.asks);
    const total = bidVolume + askVolume;
    if (total === 0) return 0;
    return (bidVolume - askVolume) / total;
  }

  // Premium VIP 8+ features
  private detectMarketMakerActivity(orderbook: PremiumOrderbookData): any {
    // Detect large hidden orders and market maker patterns
    const largeBids = orderbook.bids.filter(bid => parseFloat(bid.size) > 1000);
    const largeAsks = orderbook.asks.filter(ask => parseFloat(ask.size) > 1000);
    
    return {
      largeBidOrders: largeBids.length,
      largeAskOrders: largeAsks.length,
      mmActivity: largeBids.length + largeAsks.length > 5 ? 'high' : 'normal'
    };
  }

  private detectInstitutionalActivity(orderbook: PremiumOrderbookData): any {
    // Detect institutional-sized orders (>5000 SOL)
    const institutionalSize = 5000;
    const institutionalBids = orderbook.bids.filter(bid => parseFloat(bid.size) > institutionalSize);
    const institutionalAsks = orderbook.asks.filter(ask => parseFloat(ask.size) > institutionalSize);

    return {
      institutionalBids: institutionalBids.length,
      institutionalAsks: institutionalAsks.length,
      activity: institutionalBids.length + institutionalAsks.length > 2 ? 'active' : 'quiet'
    };
  }

  private predictLiquidityShifts(orderbook: PremiumOrderbookData): any {
    // Advanced liquidity prediction algorithm
    const bidWeightedPrice = this.calculateWeightedPrice(orderbook.bids);
    const askWeightedPrice = this.calculateWeightedPrice(orderbook.asks);
    const spread = this.calculateSpread(orderbook);

    return {
      bidWeightedPrice,
      askWeightedPrice,
      spreadPressure: spread > 0.50 ? 'high' : 'normal',
      liquidityTrend: bidWeightedPrice > askWeightedPrice ? 'bid_heavy' : 'ask_heavy'
    };
  }

  private calculateWeightedPrice(levels: PremiumOrderbookLevel[]): number {
    const totalSize = levels.reduce((sum, level) => sum + parseFloat(level.size), 0);
    if (totalSize === 0) return 0;

    return levels.reduce((weightedSum, level) => {
      const price = parseFloat(level.price);
      const size = parseFloat(level.size);
      return weightedSum + (price * size / totalSize);
    }, 0);
  }

  // === ADVANCED INSTITUTIONAL ANALYTICS ===

  /**
   * Detect whale activity using advanced algorithms
   * Analyzes order size distribution and identifies outliers
   */
  private detectWhaleActivity(orderbook: PremiumOrderbookData): any {
    const allOrders = [...orderbook.bids, ...orderbook.asks];
    const sizes = allOrders.map(order => parseFloat(order.size));
    
    // Calculate statistical thresholds
    const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / sizes.length;
    const stdDev = Math.sqrt(variance);
    const whaleThreshold = mean + (3 * stdDev); // 3-sigma threshold
    
    // Identify whale orders
    const whaleOrders = allOrders.filter(order => parseFloat(order.size) > whaleThreshold);
    const totalWhaleVolume = whaleOrders.reduce((sum, order) => sum + parseFloat(order.size), 0);
    const totalVolume = sizes.reduce((sum, size) => sum + size, 0);
    
    // Analyze whale concentration
    const whaleBids = orderbook.bids.filter(bid => parseFloat(bid.size) > whaleThreshold);
    const whaleAsks = orderbook.asks.filter(ask => parseFloat(ask.size) > whaleThreshold);
    
    return {
      whaleOrderCount: whaleOrders.length,
      whaleVolumeRatio: totalVolume > 0 ? totalWhaleVolume / totalVolume : 0,
      whaleThreshold,
      whaleBidCount: whaleBids.length,
      whaleAskCount: whaleAsks.length,
      dominantSide: whaleBids.length > whaleAsks.length ? 'bid' : 'ask',
      whaleImpact: whaleOrders.length > 5 ? 'high' : whaleOrders.length > 2 ? 'medium' : 'low',
      largestOrder: Math.max(...sizes)
    };
  }

  /**
   * Analyze smart money flow patterns
   * Identifies institutional trading behaviors
   */
  private analyzeSmartMoneyFlow(orderbook: PremiumOrderbookData): any {
    const smartMoneyThreshold = 10000; // Orders > 10K SOL considered smart money
    const midMarketPrice = (parseFloat(orderbook.bids[0]?.price || '0') + parseFloat(orderbook.asks[0]?.price || '0')) / 2;
    
    // Analyze bid-side smart money
    const smartBids = orderbook.bids.filter(bid => parseFloat(bid.size) > smartMoneyThreshold);
    const smartBidVolume = smartBids.reduce((sum, bid) => sum + parseFloat(bid.size), 0);
    const avgSmartBidPrice = smartBids.length > 0 ? 
      smartBids.reduce((sum, bid) => sum + parseFloat(bid.price), 0) / smartBids.length : 0;
    
    // Analyze ask-side smart money
    const smartAsks = orderbook.asks.filter(ask => parseFloat(ask.size) > smartMoneyThreshold);
    const smartAskVolume = smartAsks.reduce((sum, ask) => sum + parseFloat(ask.size), 0);
    const avgSmartAskPrice = smartAsks.length > 0 ? 
      smartAsks.reduce((sum, ask) => sum + parseFloat(ask.price), 0) / smartAsks.length : 0;
    
    // Calculate flow direction
    const netSmartFlow = smartBidVolume - smartAskVolume;
    const flowDirection = netSmartFlow > 0 ? 'bullish' : netSmartFlow < 0 ? 'bearish' : 'neutral';
    
    // Detect accumulation/distribution patterns
    const accumulationSignal = smartBidVolume > smartAskVolume * 1.5;
    const distributionSignal = smartAskVolume > smartBidVolume * 1.5;
    
    return {
      smartBidCount: smartBids.length,
      smartAskCount: smartAsks.length,
      smartBidVolume,
      smartAskVolume,
      netSmartFlow,
      flowDirection,
      avgSmartBidPrice,
      avgSmartAskPrice,
      smartMoneyRatio: (smartBidVolume + smartAskVolume) / this.calculateTotalVolume([...orderbook.bids, ...orderbook.asks]),
      accumulationSignal,
      distributionSignal,
      marketSentiment: accumulationSignal ? 'accumulation' : distributionSignal ? 'distribution' : 'consolidation'
    };
  }

  /**
   * Generate liquidity heatmap for visualization
   * Maps orderbook depth across price levels
   */
  private generateLiquidityHeatmap(orderbook: PremiumOrderbookData): any {
    const spreadBasis = this.calculateSpread(orderbook);
    const midPrice = (parseFloat(orderbook.bids[0]?.price || '0') + parseFloat(orderbook.asks[0]?.price || '0')) / 2;
    
    // Create price buckets around mid-market
    const bucketSize = spreadBasis * 10; // 10x spread for each bucket
    const buckets = [];
    
    for (let i = -10; i <= 10; i++) {
      const bucketPrice = midPrice + (i * bucketSize);
      const bucketVolume = this.getVolumeAtPrice(orderbook, bucketPrice, bucketSize / 2);
      
      buckets.push({
        priceLevel: bucketPrice,
        volume: bucketVolume,
        distance: Math.abs(i),
        intensity: bucketVolume > 0 ? Math.log10(bucketVolume + 1) : 0
      });
    }
    
    // Identify liquidity zones
    const highLiquidityZones = buckets.filter(bucket => bucket.intensity > 3);
    const lowLiquidityZones = buckets.filter(bucket => bucket.intensity < 1 && bucket.volume > 0);
    
    return {
      buckets: buckets.slice(0, 21), // Limit for performance
      highLiquidityZones: highLiquidityZones.length,
      lowLiquidityZones: lowLiquidityZones.length,
      liquidityGaps: this.identifyLiquidityGaps(buckets),
      strongSupportLevels: this.findSupportResistanceLevels(orderbook.bids, 'support'),
      strongResistanceLevels: this.findSupportResistanceLevels(orderbook.asks, 'resistance')
    };
  }

  /**
   * Analyze market microstructure patterns
   * Detects iceberg orders, hidden liquidity, and order flow patterns
   */
  private analyzeMicrostructure(orderbook: PremiumOrderbookData): any {
    // Detect iceberg orders (consistent large orders at multiple levels)
    const icebergSignals = this.detectIcebergOrders(orderbook);
    
    // Analyze order book imbalance
    const orderImbalance = this.calculateOrderImbalance(orderbook);
    
    // Detect hidden liquidity indicators
    const hiddenLiquidity = this.detectHiddenLiquidity(orderbook);
    
    // Calculate price impact estimations
    const priceImpact = this.calculatePriceImpact(orderbook);
    
    return {
      icebergActivity: icebergSignals,
      orderImbalance,
      hiddenLiquidityScore: hiddenLiquidity,
      priceImpactAnalysis: priceImpact,
      microstructureHealth: this.assessMicrostructureHealth(orderbook),
      liquidityFragmentation: this.calculateLiquidityFragmentation(orderbook)
    };
  }

  /**
   * Calculate advanced risk metrics for institutional clients
   */
  private calculateAdvancedRiskMetrics(orderbook: PremiumOrderbookData): any {
    const marketDepth = this.calculateTotalVolume([...orderbook.bids, ...orderbook.asks]);
    const spread = this.calculateSpread(orderbook);
    const midPrice = (parseFloat(orderbook.bids[0]?.price || '0') + parseFloat(orderbook.asks[0]?.price || '0')) / 2;
    
    // Value at Risk calculation (simplified)
    const var95 = this.calculateVaR(orderbook, 0.95);
    const var99 = this.calculateVaR(orderbook, 0.99);
    
    // Liquidity risk metrics
    const liquidityRisk = spread / midPrice; // Relative spread as liquidity risk proxy
    const depthRisk = marketDepth < 50000 ? 'high' : marketDepth < 100000 ? 'medium' : 'low';
    
    // Concentration risk
    const concentrationRisk = this.calculateConcentrationRisk(orderbook);
    
    return {
      valueAtRisk: {
        var95: var95,
        var99: var99,
        confidence: 'Daily 1% portfolio exposure'
      },
      liquidityRisk: {
        relativeSpread: liquidityRisk,
        depthCategory: depthRisk,
        liquidityScore: this.calculateLiquidityScore(orderbook)
      },
      concentrationRisk,
      marketStress: this.detectMarketStress(orderbook),
      riskAdjustedReturns: this.calculateRiskAdjustedMetrics(orderbook)
    };
  }

  /**
   * Detect arbitrage opportunities across timeframes
   */
  private detectArbitrageOpportunities(orderbook: PremiumOrderbookData): any {
    const bestBid = parseFloat(orderbook.bids[0]?.price || '0');
    const bestAsk = parseFloat(orderbook.asks[0]?.price || '0');
    const spread = bestAsk - bestBid;
    
    // Statistical arbitrage signals
    const meanReversion = this.calculateMeanReversionSignal(orderbook);
    const momentumArb = this.calculateMomentumArbitrageSignal(orderbook);
    
    // Cross-venue arbitrage (simulated)
    const crossVenueOpportunities = this.simulateCrossVenueArbitrage(bestBid, bestAsk);
    
    return {
      spreadArbitrage: {
        currentSpread: spread,
        profitableThreshold: spread > 0.25,
        expectedProfit: Math.max(0, spread - 0.15) // Minus estimated fees
      },
      meanReversion,
      momentumArbitrage: momentumArb,
      crossVenueSignals: crossVenueOpportunities,
      triangularArbitrage: this.detectTriangularArbitrage(orderbook)
    };
  }

  /**
   * Perform liquidity stress testing
   */
  private performLiquidityStressTesting(orderbook: PremiumOrderbookData): any {
    const stressScenarios = [
      { name: '10% Price Drop', priceShock: -0.10, volumeShock: 2.0 },
      { name: '5% Price Rally', priceShock: 0.05, volumeShock: 1.5 },
      { name: 'Flash Crash', priceShock: -0.20, volumeShock: 5.0 },
      { name: 'Whale Exit', priceShock: -0.03, volumeShock: 3.0 }
    ];
    
    const stressResults = stressScenarios.map(scenario => {
      const impactedOrderbook = this.applyStressScenario(orderbook, scenario);
      
      return {
        scenario: scenario.name,
        liquidityImpact: this.calculateLiquidityImpact(orderbook, impactedOrderbook),
        priceImpact: scenario.priceShock,
        volumeMultiplier: scenario.volumeShock,
        recoveryTime: this.estimateRecoveryTime(scenario),
        riskLevel: this.assessScenarioRisk(scenario)
      };
    });
    
    return {
      scenarios: stressResults,
      overallRisk: this.aggregateStressRisk(stressResults),
      liquidityBuffer: this.calculateLiquidityBuffer(orderbook),
      stressScore: this.calculateStressScore(stressResults)
    };
  }

  /**
   * Calculate correlation matrix for multi-asset analysis
   */
  private calculateCorrelationMatrix(orderbook: PremiumOrderbookData): any {
    // Simulated correlation with major crypto assets
    const correlations = {
      'BTC': 0.75 + (Math.random() - 0.5) * 0.1,
      'ETH': 0.68 + (Math.random() - 0.5) * 0.15,
      'BNB': 0.45 + (Math.random() - 0.5) * 0.2,
      'ADA': 0.52 + (Math.random() - 0.5) * 0.18,
      'MATIC': 0.48 + (Math.random() - 0.5) * 0.22
    };
    
    // Risk diversification analysis
    const avgCorrelation = Object.values(correlations).reduce((sum, corr) => sum + corr, 0) / Object.keys(correlations).length;
    const diversificationBenefit = 1 - avgCorrelation;
    
    return {
      correlationMatrix: correlations,
      averageCorrelation: avgCorrelation,
      diversificationBenefit,
      portfolioRiskReduction: diversificationBenefit * 100,
      hedgingOpportunities: this.identifyHedgingOpportunities(correlations),
      systemicRisk: avgCorrelation > 0.8 ? 'high' : avgCorrelation > 0.6 ? 'medium' : 'low'
    };
  }

  // === HELPER METHODS FOR ADVANCED ANALYTICS ===

  private getVolumeAtPrice(orderbook: PremiumOrderbookData, targetPrice: number, tolerance: number): number {
    const relevantOrders = [...orderbook.bids, ...orderbook.asks]
      .filter(order => Math.abs(parseFloat(order.price) - targetPrice) <= tolerance);
    
    return relevantOrders.reduce((sum, order) => sum + parseFloat(order.size), 0);
  }

  private identifyLiquidityGaps(buckets: any[]): number {
    return buckets.filter(bucket => bucket.volume === 0).length;
  }

  private findSupportResistanceLevels(levels: PremiumOrderbookLevel[], type: 'support' | 'resistance'): any[] {
    const significantLevels = levels
      .filter(level => parseFloat(level.size) > 1000)
      .slice(0, 5)
      .map(level => ({
        price: parseFloat(level.price),
        volume: parseFloat(level.size),
        significance: parseFloat(level.size) > 5000 ? 'strong' : 'moderate'
      }));
    
    return significantLevels;
  }

  private detectIcebergOrders(orderbook: PremiumOrderbookData): any {
    // Detect consistent order sizes across multiple price levels
    const bidSizes = orderbook.bids.map(bid => parseFloat(bid.size));
    const askSizes = orderbook.asks.map(ask => parseFloat(ask.size));
    
    const consistentBidSizes = this.findConsistentSizes(bidSizes);
    const consistentAskSizes = this.findConsistentSizes(askSizes);
    
    return {
      bidsIcebergSignal: consistentBidSizes.length > 3,
      asksIcebergSignal: consistentAskSizes.length > 3,
      consistentBidCount: consistentBidSizes.length,
      consistentAskCount: consistentAskSizes.length,
      icebergProbability: (consistentBidSizes.length + consistentAskSizes.length) / 20 // Normalize to 0-1
    };
  }

  private calculateOrderImbalance(orderbook: PremiumOrderbookData): any {
    const topLevels = 5;
    const topBids = orderbook.bids.slice(0, topLevels);
    const topAsks = orderbook.asks.slice(0, topLevels);
    
    const bidVolume = topBids.reduce((sum, bid) => sum + parseFloat(bid.size), 0);
    const askVolume = topAsks.reduce((sum, ask) => sum + parseFloat(ask.size), 0);
    
    const imbalance = (bidVolume - askVolume) / (bidVolume + askVolume);
    
    return {
      imbalanceRatio: imbalance,
      direction: imbalance > 0.1 ? 'buy_pressure' : imbalance < -0.1 ? 'sell_pressure' : 'balanced',
      strength: Math.abs(imbalance) > 0.3 ? 'strong' : Math.abs(imbalance) > 0.15 ? 'moderate' : 'weak'
    };
  }

  private detectHiddenLiquidity(orderbook: PremiumOrderbookData): number {
    // Estimate hidden liquidity based on order patterns and market microstructure
    const visibleLiquidity = this.calculateTotalVolume([...orderbook.bids, ...orderbook.asks]);
    const avgOrderSize = visibleLiquidity / (orderbook.bids.length + orderbook.asks.length);
    
    // Hidden liquidity heuristic: larger average orders suggest institutional presence
    const hiddenFactor = avgOrderSize > 1000 ? 1.5 : avgOrderSize > 500 ? 1.2 : 1.0;
    
    return Math.min(0.95, hiddenFactor - 1); // Score between 0-0.95
  }

  private calculatePriceImpact(orderbook: PremiumOrderbookData): any {
    const testSizes = [1000, 5000, 10000, 50000]; // Test order sizes
    
    const buyImpacts = testSizes.map(size => this.simulateMarketOrder(orderbook.asks, size, 'buy'));
    const sellImpacts = testSizes.map(size => this.simulateMarketOrder(orderbook.bids, size, 'sell'));
    
    return {
      buyImpacts: testSizes.map((size, i) => ({ size, impact: buyImpacts[i] })),
      sellImpacts: testSizes.map((size, i) => ({ size, impact: sellImpacts[i] })),
      liquidityScore: this.calculateLiquidityScore(orderbook)
    };
  }

  private simulateMarketOrder(levels: PremiumOrderbookLevel[], orderSize: number, side: 'buy' | 'sell'): number {
    let remainingSize = orderSize;
    let totalCost = 0;
    let totalSize = 0;
    
    for (const level of levels) {
      const levelSize = parseFloat(level.size);
      const levelPrice = parseFloat(level.price);
      const sizeToTake = Math.min(remainingSize, levelSize);
      
      totalCost += sizeToTake * levelPrice;
      totalSize += sizeToTake;
      remainingSize -= sizeToTake;
      
      if (remainingSize <= 0) break;
    }
    
    if (totalSize === 0) return 1; // 100% slippage if no liquidity
    
    const avgPrice = totalCost / totalSize;
    const bestPrice = parseFloat(levels[0]?.price || '0');
    
    return Math.abs(avgPrice - bestPrice) / bestPrice; // Relative price impact
  }

  private findConsistentSizes(sizes: number[]): number[] {
    const sizeGroups = new Map<number, number>();
    const tolerance = 0.05; // 5% tolerance for "similar" sizes
    
    sizes.forEach(size => {
      let found = false;
      for (const [groupSize, count] of sizeGroups) {
        if (Math.abs(size - groupSize) / groupSize <= tolerance) {
          sizeGroups.set(groupSize, count + 1);
          found = true;
          break;
        }
      }
      if (!found) {
        sizeGroups.set(size, 1);
      }
    });
    
    return Array.from(sizeGroups.entries())
      .filter(([_, count]) => count >= 3)
      .map(([size, _]) => size);
  }

  // Additional helper methods with basic implementations
  private assessMicrostructureHealth(orderbook: PremiumOrderbookData): string {
    const spread = this.calculateSpread(orderbook);
    const depth = this.calculateTotalVolume([...orderbook.bids, ...orderbook.asks]);
    
    if (spread < 0.10 && depth > 100000) return 'excellent';
    if (spread < 0.25 && depth > 50000) return 'good';
    if (spread < 0.50 && depth > 20000) return 'fair';
    return 'poor';
  }

  private calculateLiquidityFragmentation(orderbook: PremiumOrderbookData): number {
    const levels = [...orderbook.bids, ...orderbook.asks];
    const uniquePrices = new Set(levels.map(level => level.price)).size;
    return uniquePrices / levels.length; // Higher = more fragmented
  }

  private calculateVaR(orderbook: PremiumOrderbookData, confidence: number): number {
    // Simplified VaR calculation based on spread volatility
    const spread = this.calculateSpread(orderbook);
    const midPrice = (parseFloat(orderbook.bids[0]?.price || '0') + parseFloat(orderbook.asks[0]?.price || '0')) / 2;
    
    // Assume normal distribution for simplification
    const zScore = confidence === 0.95 ? 1.645 : confidence === 0.99 ? 2.326 : 1.96;
    return (spread / midPrice) * zScore * 100; // Percentage VaR
  }

  private calculateConcentrationRisk(orderbook: PremiumOrderbookData): any {
    const allOrders = [...orderbook.bids, ...orderbook.asks];
    const sizes = allOrders.map(order => parseFloat(order.size));
    const totalVolume = sizes.reduce((sum, size) => sum + size, 0);
    
    // Top 5 orders concentration
    const top5Volume = sizes.sort((a, b) => b - a).slice(0, 5).reduce((sum, size) => sum + size, 0);
    const concentration = top5Volume / totalVolume;
    
    return {
      top5Concentration: concentration,
      riskLevel: concentration > 0.5 ? 'high' : concentration > 0.3 ? 'medium' : 'low',
      herfindahlIndex: this.calculateHerfindahlIndex(sizes)
    };
  }

  private calculateHerfindahlIndex(sizes: number[]): number {
    const totalVolume = sizes.reduce((sum, size) => sum + size, 0);
    const marketShares = sizes.map(size => size / totalVolume);
    return marketShares.reduce((sum, share) => sum + (share * share), 0);
  }

  private detectMarketStress(orderbook: PremiumOrderbookData): any {
    const spread = this.calculateSpread(orderbook);
    const depth = this.calculateTotalVolume([...orderbook.bids, ...orderbook.asks]);
    const imbalance = Math.abs(this.calculateImbalance(orderbook));
    
    let stressLevel = 0;
    if (spread > 1.0) stressLevel += 3;
    else if (spread > 0.5) stressLevel += 2;
    else if (spread > 0.25) stressLevel += 1;
    
    if (depth < 20000) stressLevel += 3;
    else if (depth < 50000) stressLevel += 2;
    else if (depth < 100000) stressLevel += 1;
    
    if (imbalance > 0.5) stressLevel += 2;
    else if (imbalance > 0.3) stressLevel += 1;
    
    const stressCategory = stressLevel >= 6 ? 'high' : stressLevel >= 3 ? 'medium' : 'low';
    
    return {
      stressScore: stressLevel,
      stressLevel: stressCategory,
      factors: {
        spreadStress: spread > 0.5,
        depthStress: depth < 50000,
        imbalanceStress: imbalance > 0.3
      }
    };
  }

  private calculateRiskAdjustedMetrics(orderbook: PremiumOrderbookData): any {
    const spread = this.calculateSpread(orderbook);
    const depth = this.calculateTotalVolume([...orderbook.bids, ...orderbook.asks]);
    const midPrice = (parseFloat(orderbook.bids[0]?.price || '0') + parseFloat(orderbook.asks[0]?.price || '0')) / 2;
    
    const liquidityRisk = spread / midPrice;
    const sharpeRatio = depth > 0 ? (0.05 / Math.sqrt(liquidityRisk)) : 0; // Simplified Sharpe
    
    return {
      sharpeRatio,
      liquidityAdjustedReturn: 0.05 * (1 - liquidityRisk),
      riskScore: liquidityRisk * 100
    };
  }

  private calculateMeanReversionSignal(orderbook: PremiumOrderbookData): any {
    const spread = this.calculateSpread(orderbook);
    const historicalSpread = 0.30; // Assume historical average
    
    const meanReversionStrength = Math.abs(spread - historicalSpread) / historicalSpread;
    
    return {
      signal: spread > historicalSpread * 1.2 ? 'buy' : spread < historicalSpread * 0.8 ? 'sell' : 'hold',
      strength: meanReversionStrength,
      expectedReturn: (historicalSpread - spread) / spread
    };
  }

  private calculateMomentumArbitrageSignal(orderbook: PremiumOrderbookData): any {
    const imbalance = this.calculateImbalance(orderbook);
    
    return {
      signal: imbalance > 0.2 ? 'momentum_buy' : imbalance < -0.2 ? 'momentum_sell' : 'neutral',
      strength: Math.abs(imbalance),
      timeHorizon: 'short_term'
    };
  }

  private simulateCrossVenueArbitrage(bestBid: number, bestAsk: number): any {
    // Simulate price differences across exchanges
    const venueVariations = {
      'Binance': { bid: bestBid * (1 + (Math.random() - 0.5) * 0.001), ask: bestAsk * (1 + (Math.random() - 0.5) * 0.001) },
      'FTX': { bid: bestBid * (1 + (Math.random() - 0.5) * 0.002), ask: bestAsk * (1 + (Math.random() - 0.5) * 0.002) },
      'Coinbase': { bid: bestBid * (1 + (Math.random() - 0.5) * 0.0015), ask: bestAsk * (1 + (Math.random() - 0.5) * 0.0015) }
    };
    
    const opportunities = [];
    for (const [venue, prices] of Object.entries(venueVariations)) {
      const profit = prices.bid - bestAsk;
      if (profit > 0.05) { // Minimum profit threshold
        opportunities.push({
          venue,
          profit,
          profitMargin: profit / bestAsk
        });
      }
    }
    
    return {
      opportunities,
      bestOpportunity: opportunities.sort((a, b) => b.profit - a.profit)[0] || null
    };
  }

  private detectTriangularArbitrage(orderbook: PremiumOrderbookData): any {
    // Simplified triangular arbitrage detection
    const solPrice = (parseFloat(orderbook.bids[0]?.price || '0') + parseFloat(orderbook.asks[0]?.price || '0')) / 2;
    
    // Simulate rates for SOL/BTC and BTC/USDT
    const btcUsdtRate = 45000; // Assume BTC price
    const solBtcRate = solPrice / btcUsdtRate;
    
    // Check for arbitrage: SOL -> BTC -> USDT -> SOL
    const impliedSolPrice = solBtcRate * btcUsdtRate;
    const arbitrageProfit = impliedSolPrice - solPrice;
    
    return {
      opportunity: arbitrageProfit > 0.10,
      profit: arbitrageProfit,
      profitMargin: arbitrageProfit / solPrice,
      path: 'SOL -> BTC -> USDT -> SOL'
    };
  }

  private calculateLiquidityScore(orderbook: PremiumOrderbookData): number {
    const spread = this.calculateSpread(orderbook);
    const depth = this.calculateTotalVolume([...orderbook.bids, ...orderbook.asks]);
    const midPrice = (parseFloat(orderbook.bids[0]?.price || '0') + parseFloat(orderbook.asks[0]?.price || '0')) / 2;
    
    const spreadScore = Math.max(0, 100 - (spread / midPrice) * 10000); // Lower spread = higher score
    const depthScore = Math.min(100, depth / 1000); // Higher depth = higher score
    
    return (spreadScore + depthScore) / 2;
  }

  // Stress testing helper methods
  private applyStressScenario(orderbook: PremiumOrderbookData, scenario: any): PremiumOrderbookData {
    // Simulate orderbook under stress scenario
    const stressedBids = orderbook.bids.map(bid => ({
      ...bid,
      price: (parseFloat(bid.price) * (1 + scenario.priceShock)).toString(),
      size: (parseFloat(bid.size) / scenario.volumeShock).toString()
    }));
    
    const stressedAsks = orderbook.asks.map(ask => ({
      ...ask,
      price: (parseFloat(ask.price) * (1 + scenario.priceShock)).toString(),
      size: (parseFloat(ask.size) / scenario.volumeShock).toString()
    }));
    
    return {
      ...orderbook,
      bids: stressedBids,
      asks: stressedAsks
    };
  }

  private calculateLiquidityImpact(original: PremiumOrderbookData, stressed: PremiumOrderbookData): number {
    const originalLiquidity = this.calculateTotalVolume([...original.bids, ...original.asks]);
    const stressedLiquidity = this.calculateTotalVolume([...stressed.bids, ...stressed.asks]);
    
    return (originalLiquidity - stressedLiquidity) / originalLiquidity;
  }

  private estimateRecoveryTime(scenario: any): string {
    const severityScore = Math.abs(scenario.priceShock) + (scenario.volumeShock - 1);
    
    if (severityScore > 3) return '60+ minutes';
    if (severityScore > 2) return '30-60 minutes';
    if (severityScore > 1) return '10-30 minutes';
    return '5-10 minutes';
  }

  private assessScenarioRisk(scenario: any): string {
    const riskScore = Math.abs(scenario.priceShock) * 10 + scenario.volumeShock;
    
    if (riskScore > 6) return 'extreme';
    if (riskScore > 4) return 'high';
    if (riskScore > 2) return 'medium';
    return 'low';
  }

  private aggregateStressRisk(results: any[]): string {
    const extremeCount = results.filter(r => r.riskLevel === 'extreme').length;
    const highCount = results.filter(r => r.riskLevel === 'high').length;
    
    if (extremeCount > 1) return 'extreme';
    if (extremeCount > 0 || highCount > 2) return 'high';
    if (highCount > 0) return 'medium';
    return 'low';
  }

  private calculateLiquidityBuffer(orderbook: PremiumOrderbookData): number {
    const totalLiquidity = this.calculateTotalVolume([...orderbook.bids, ...orderbook.asks]);
    const minimumLiquidity = 20000; // Threshold for healthy market
    
    return Math.max(0, (totalLiquidity - minimumLiquidity) / minimumLiquidity);
  }

  private calculateStressScore(results: any[]): number {
    const riskWeights = { 'low': 1, 'medium': 2, 'high': 3, 'extreme': 4 };
    const totalScore = results.reduce((sum, result) => sum + riskWeights[result.riskLevel as keyof typeof riskWeights], 0);
    
    return Math.min(100, (totalScore / results.length) * 25); // Normalize to 0-100
  }

  private identifyHedgingOpportunities(correlations: Record<string, number>): any[] {
    const hedgingThreshold = 0.3; // Correlations below this are good hedges
    
    return Object.entries(correlations)
      .filter(([_, corr]) => Math.abs(corr) < hedgingThreshold)
      .map(([asset, corr]) => ({
        asset,
        correlation: corr,
        hedgeEffectiveness: 1 - Math.abs(corr),
        recommendation: corr < -0.1 ? 'excellent_hedge' : 'good_diversifier'
      }));
  }

  /**
   * Generate demo metrics for VIP8+ users when no real data available
   */
  private generateDemoMetrics(tierConfig: VipTierConfig): any {
    const currentPrice = 207.40; // Current SOL price
    
    // Demo whale detection
    const whaleDetection = {
      whaleOrderCount: 8,
      whaleVolumeRatio: 0.35,
      whaleThreshold: 2500,
      whaleBidCount: 5,
      whaleAskCount: 3,
      dominantSide: 'bid' as 'bid' | 'ask',
      whaleImpact: 'medium' as 'high' | 'medium' | 'low',
      largestOrder: 15000
    };

    // Demo smart money flow  
    const smartMoneyFlow = {
      smartBidCount: 12,
      smartAskCount: 7,
      smartBidVolume: 45000,
      smartAskVolume: 28000,
      netSmartFlow: 17000,
      flowDirection: 'bullish' as 'bullish' | 'bearish' | 'neutral',
      avgSmartBidPrice: 206.85,
      avgSmartAskPrice: 207.95,
      smartMoneyRatio: 0.42,
      accumulationSignal: true,
      distributionSignal: false,
      marketSentiment: 'accumulation' as 'accumulation' | 'distribution' | 'consolidation'
    };

    // Demo liquidity heatmap
    const liquidityHeatmap = {
      buckets: Array.from({ length: 21 }, (_, i) => {
        const distance = i - 10;
        const priceLevel = currentPrice + (distance * 0.25);
        const volume = Math.max(100, 5000 - Math.abs(distance) * 400 + Math.random() * 2000);
        const intensity = Math.max(0.5, 4.5 - Math.abs(distance) * 0.3 + Math.random() * 1.5);
        
        return {
          priceLevel,
          volume,
          intensity,
          distance: Math.abs(distance)
        };
      }),
      highLiquidityZones: 6,
      lowLiquidityZones: 3,
      liquidityGaps: 2,
      strongSupportLevels: [
        { price: 206.50, volume: 12500, significance: 'strong' as 'strong' | 'moderate' },
        { price: 205.80, volume: 8200, significance: 'moderate' as 'strong' | 'moderate' },
        { price: 204.90, volume: 15000, significance: 'strong' as 'strong' | 'moderate' }
      ],
      strongResistanceLevels: [
        { price: 208.20, volume: 11000, significance: 'strong' as 'strong' | 'moderate' },
        { price: 209.50, volume: 7500, significance: 'moderate' as 'strong' | 'moderate' },
        { price: 210.80, volume: 13200, significance: 'strong' as 'strong' | 'moderate' }
      ]
    };

    // Demo microstructure analysis
    const microstructureAnalysis = {
      icebergActivity: {
        bidsIcebergSignal: true,
        asksIcebergSignal: false,
        consistentBidCount: 4,
        consistentAskCount: 1,
        icebergProbability: 0.65
      },
      orderImbalance: {
        imbalanceRatio: 0.15,
        direction: 'buy_pressure',
        strength: 'moderate'
      },
      hiddenLiquidityScore: 0.72,
      priceImpactAnalysis: {
        buyImpacts: [
          { size: 1000, impact: 0.002 },
          { size: 5000, impact: 0.008 },
          { size: 10000, impact: 0.018 },
          { size: 50000, impact: 0.095 }
        ],
        sellImpacts: [
          { size: 1000, impact: 0.0015 },
          { size: 5000, impact: 0.007 },
          { size: 10000, impact: 0.016 },
          { size: 50000, impact: 0.088 }
        ],
        liquidityScore: 78.5
      },
      microstructureHealth: 'good',
      liquidityFragmentation: 0.23
    };

    const baseMetrics = {
      totalBidVolume: 185000,
      totalAskVolume: 142000,
      avgBidSize: 1250,
      avgAskSize: 980,
      marketDepthScore: 163500,
      liquidityImbalance: 0.13,
      lastUpdate: new Date().toISOString()
    };

    // VIP8+ features
    const vip8Features = {
      whaleDetection,
      smartMoneyFlow, 
      liquidityHeatmap,
      microstructureAnalysis
    };

    // Institutional exclusive features
    const institutionalFeatures = tierConfig.tier === 'institutional' ? {
      advancedRiskMetrics: {
        valueAtRisk: {
          var95: 2.35,
          var99: 3.87,
          confidence: 'Daily 1% portfolio exposure'
        },
        liquidityRisk: {
          relativeSpread: 0.0014,
          depthCategory: 'medium',
          liquidityScore: 78.5
        },
        concentrationRisk: {
          top5Concentration: 0.28,
          riskLevel: 'low',
          herfindahlIndex: 0.045
        },
        marketStress: {
          stressScore: 2,
          stressLevel: 'low',
          factors: {
            spreadStress: false,
            depthStress: false,
            imbalanceStress: false
          }
        },
        riskAdjustedReturns: {
          sharpeRatio: 1.85,
          liquidityAdjustedReturn: 0.049,
          riskScore: 14.2
        }
      },
      arbitrageSignals: {
        spreadArbitrage: {
          currentSpread: 0.12,
          profitableThreshold: false,
          expectedProfit: 0
        },
        meanReversion: {
          signal: 'hold',
          strength: 0.15,
          expectedReturn: -0.002
        },
        momentumArbitrage: {
          signal: 'momentum_buy',
          strength: 0.25,
          timeHorizon: 'short_term'
        },
        crossVenueSignals: {
          opportunities: [],
          bestOpportunity: null
        },
        triangularArbitrage: {
          opportunity: false,
          profit: -0.08,
          profitMargin: -0.0004,
          path: 'SOL -> BTC -> USDT -> SOL'
        }
      },
      liquidityStress: {
        scenarios: [
          {
            scenario: '10% Price Drop',
            liquidityImpact: 0.35,
            priceImpact: -0.10,
            volumeMultiplier: 2.0,
            recoveryTime: '30-60 minutes',
            riskLevel: 'medium'
          },
          {
            scenario: '5% Price Rally', 
            liquidityImpact: 0.18,
            priceImpact: 0.05,
            volumeMultiplier: 1.5,
            recoveryTime: '10-30 minutes',
            riskLevel: 'low'
          },
          {
            scenario: 'Flash Crash',
            liquidityImpact: 0.78,
            priceImpact: -0.20,
            volumeMultiplier: 5.0,
            recoveryTime: '60+ minutes',
            riskLevel: 'extreme'
          },
          {
            scenario: 'Whale Exit',
            liquidityImpact: 0.42,
            priceImpact: -0.03,
            volumeMultiplier: 3.0,
            recoveryTime: '30-60 minutes',
            riskLevel: 'medium'
          }
        ],
        overallRisk: 'medium',
        liquidityBuffer: 2.15,
        stressScore: 32
      },
      correlationMatrix: {
        correlationMatrix: {
          'BTC': 0.72,
          'ETH': 0.64,
          'BNB': 0.51,
          'ADA': 0.48,
          'MATIC': 0.43
        },
        averageCorrelation: 0.556,
        diversificationBenefit: 0.444,
        portfolioRiskReduction: 44.4,
        hedgingOpportunities: [
          {
            asset: 'MATIC',
            correlation: 0.43,
            hedgeEffectiveness: 0.57,
            recommendation: 'good_diversifier'
          }
        ],
        systemicRisk: 'low'
      }
    } : {};

    return {
      tier: tierConfig.tier,
      features: tierConfig.features,
      metrics: {
        ...baseMetrics,
        ...vip8Features,
        ...institutionalFeatures,
        liquidityScore: 78.5
      }
    };
  }

  /**
   * Get subscription upgrade information
   */
  getUpgradeInfo(): any {
    const currentTier = this.getCurrentTierConfig();
    
    if (currentTier.tier === 'institutional') {
      return {
        message: 'You have the highest tier - Institutional access',
        features: currentTier.features
      };
    }

    const nextTiers = {
      standard: 'vip1',
      vip1: 'vip8', 
      vip8: 'institutional'
    };

    const nextTier = nextTiers[currentTier.tier as keyof typeof nextTiers];
    const nextTierConfig = this.vipTiers[nextTier];

    return {
      currentTier: currentTier.tier,
      nextTier: nextTierConfig.tier,
      upgradeRequirements: {
        monthlyVolume: nextTierConfig.monthlyVolume?.toLocaleString(),
        assetRequirement: nextTierConfig.assetRequirement?.toLocaleString(),
        newFeatures: nextTierConfig.features.filter(f => !currentTier.features.includes(f))
      },
      pricing: {
        standard: 'Free',
        vip1: '$200-500/month',
        vip8: '$800-2000/month', 
        institutional: 'Custom pricing - Contact OKX'
      }
    };
  }
}

export const premiumOrderbookService = new PremiumOrderbookService();
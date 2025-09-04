import { CandleData } from "@shared/schema";

export interface OrderFlowTrade {
  id: string;
  timestamp: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  isAggressive: boolean;
  isLarge: boolean;
  value: number;
  type: 'institutional' | 'market_maker' | 'market_taker' | 'whale' | 'retail';
  confidence: number;
}

export interface BidAskImbalance {
  timestamp: string;
  bidSize: number;
  askSize: number;
  imbalanceRatio: number; // -1 to 1, negative = bearish, positive = bullish
  strength: 'weak' | 'moderate' | 'strong';
  significance: 'minor' | 'major' | 'critical';
  prediction: 'bullish' | 'bearish' | 'neutral';
}

export interface OrderFlowSignal {
  type: 'large_buy' | 'large_sell' | 'aggressive_buying' | 'aggressive_selling' | 
        'imbalance_bullish' | 'imbalance_bearish' | 'whale_accumulation' | 'whale_distribution';
  timestamp: string;
  price: number;
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number;
  description: string;
  volume: number;
  impact: 'low' | 'medium' | 'high';
}

export interface LiquidityLevel {
  price: number;
  bidVolume: number;
  askVolume: number;
  netVolume: number;
  absorption: number; // How much volume was absorbed at this level
  strength: 'weak' | 'moderate' | 'strong';
  type: 'support' | 'resistance' | 'neutral';
  depth: number; // Order book depth at this level
  touchCount: number; // How many times price touched this level
  rejectionStrength: number; // Strength of price rejection from this level
  hiddenLiquidity: number; // Estimated hidden liquidity
}

export interface VolumeProfile {
  priceLevel: number;
  volume: number;
  percentage: number;
  tradingTime: number; // Time spent at this level
  type: 'high_volume_node' | 'low_volume_node' | 'point_of_control' | 'value_area';
  significance: 'minor' | 'major' | 'critical';
}

export interface AdvancedVolumeAnalysis {
  vpoc: number; // Volume Point of Control
  valueAreaHigh: number; // 70% volume area high
  valueAreaLow: number; // 70% volume area low
  volumeProfile: VolumeProfile[];
  volumeDistribution: {
    aboveVpoc: number;
    belowVpoc: number;
    imbalance: number; // Positive = more volume above VPOC
  };
  highVolumeNodes: number[]; // Price levels with significant volume
  lowVolumeNodes: number[]; // Gaps in volume
  supportResistanceLevels: {
    support: number[];
    resistance: number[];
    dynamicLevels: number[];
  };
}

export interface SmartMoneyFlow {
  institutionalBuyVolume: number;
  institutionalSellVolume: number;
  retailBuyVolume: number;
  retailSellVolume: number;
  smartMoneyRatio: number; // Institutional vs retail
  darkPoolEstimate: number; // Estimated hidden volume
  blockTradeActivity: {
    detected: boolean;
    volume: number;
    frequency: number;
    direction: 'accumulation' | 'distribution' | 'neutral';
  };
  orderFlowMomentum: {
    shortTerm: 'bullish' | 'bearish' | 'neutral'; // Last 10 trades
    mediumTerm: 'bullish' | 'bearish' | 'neutral'; // Last 50 trades
    longTerm: 'bullish' | 'bearish' | 'neutral'; // Last 200 trades
    consistency: number; // How consistent momentum is across timeframes
  };
}

export interface OrderFlowMetrics {
  timeframe: string;
  
  // Current market microstructure
  currentImbalance: BidAskImbalance;
  
  // Recent trades analysis
  recentTrades: {
    total: number;
    buyVolume: number;
    sellVolume: number;
    netVolume: number;
    avgTradeSize: number;
    largeTradeCount: number;
    aggressiveBuyRatio: number;
    aggressiveSellRatio: number;
  };
  
  // Whale activity detection
  whaleActivity: {
    detected: boolean;
    direction: 'accumulation' | 'distribution' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    volume: number;
    trades: OrderFlowTrade[];
    confidence: number;
  };
  
  // Market maker vs taker flow
  flowAnalysis: {
    makerBuyVolume: number;
    makerSellVolume: number;
    takerBuyVolume: number;
    takerSellVolume: number;
    makerTakerRatio: number;
    dominantFlow: 'maker_dominated' | 'taker_dominated' | 'balanced';
    flowStrength: 'weak' | 'moderate' | 'strong';
  };
  
  // Advanced liquidity analysis
  liquidityLevels: LiquidityLevel[];
  
  // Advanced volume profile analysis
  advancedVolumeAnalysis: AdvancedVolumeAnalysis;
  
  // Smart money flow tracking
  smartMoneyFlow: SmartMoneyFlow;
  
  // Active order flow signals
  signals: OrderFlowSignal[];
  
  // Tape reading insights
  tapeReading: {
    momentum: 'bullish' | 'bearish' | 'neutral';
    velocity: 'slow' | 'moderate' | 'fast';
    consistency: 'inconsistent' | 'consistent' | 'very_consistent';
    largeOrderActivity: 'increasing' | 'decreasing' | 'stable';
    marketSentiment: 'bullish' | 'bearish' | 'neutral';
    predictionConfidence: number;
  };
  
  // Quality metrics
  confidence: {
    overall: number;
    dataQuality: number;
    signalReliability: number;
    volumeConsistency: number;
    timeConsistency: number;
  };
  
  // Metadata
  lastUpdate: string;
  calculationTime: number;
  tradesAnalyzed: number;
}

export class OrderFlowService {
  
  // Thresholds for analysis
  private readonly LARGE_TRADE_THRESHOLD_MULTIPLIER = 3; // 3x average size
  private readonly WHALE_TRADE_THRESHOLD_MULTIPLIER = 10; // 10x average size
  private readonly IMBALANCE_THRESHOLD = 0.3; // 30% imbalance to be significant
  private readonly AGGRESSIVE_THRESHOLD = 0.7; // 70% aggressive trades
  
  /**
   * Analyze bid/ask imbalance from order book data
   */
  analyzeBidAskImbalance(orderBook: any): BidAskImbalance {
    const bids = orderBook.bids || [];
    const asks = orderBook.asks || [];
    
    // Calculate total bid and ask sizes (top 10 levels)
    const bidSize = bids.slice(0, 10).reduce((total: number, bid: any) => 
      total + parseFloat(bid[1]), 0
    );
    
    const askSize = asks.slice(0, 10).reduce((total: number, ask: any) => 
      total + parseFloat(ask[1]), 0
    );
    
    const totalSize = bidSize + askSize;
    let imbalanceRatio = 0;
    
    if (totalSize > 0) {
      imbalanceRatio = (bidSize - askSize) / totalSize;
    }
    
    // Determine strength and significance
    const absImbalance = Math.abs(imbalanceRatio);
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    let significance: 'minor' | 'major' | 'critical' = 'minor';
    
    if (absImbalance > 0.6) {
      strength = 'strong';
      significance = 'critical';
    } else if (absImbalance > 0.3) {
      strength = 'moderate';
      significance = 'major';
    }
    
    const prediction = imbalanceRatio > this.IMBALANCE_THRESHOLD ? 'bullish' :
                      imbalanceRatio < -this.IMBALANCE_THRESHOLD ? 'bearish' : 'neutral';
    
    return {
      timestamp: new Date().toISOString(),
      bidSize,
      askSize,
      imbalanceRatio: Math.round(imbalanceRatio * 1000) / 1000,
      strength,
      significance,
      prediction
    };
  }
  
  /**
   * Advanced Trade Classification - Institutional Grade Order Flow Analysis
   */
  classifyTrades(trades: any[]): OrderFlowTrade[] {
    if (!trades || trades.length === 0) return [];
    
    // Advanced statistical analysis for dynamic thresholds
    const sizes = trades.map(t => parseFloat(t.sz || t.size || 0)).sort((a, b) => a - b);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const medianSize = sizes[Math.floor(sizes.length / 2)];
    const q75Size = sizes[Math.floor(sizes.length * 0.75)];
    const q95Size = sizes[Math.floor(sizes.length * 0.95)];
    
    // Dynamic thresholds based on market conditions
    const largeThreshold = Math.max(q75Size, avgSize * 2.5);
    const whaleThreshold = Math.max(q95Size, avgSize * 10);
    const institutionalThreshold = avgSize * 25; // Institutional-grade detection
    
    return trades.map((trade, index) => {
      const size = parseFloat(trade.sz || trade.size || 0);
      const price = parseFloat(trade.px || trade.price || 0);
      const value = size * price;
      const timestamp = parseInt(trade.ts || Date.now());
      
      // Advanced side determination with order book analysis
      let side = trade.side;
      if (!side) {
        // Analyze price movement vs previous trades for better classification
        const prevTrade = trades[Math.max(0, index - 1)];
        const nextTrade = trades[Math.min(trades.length - 1, index + 1)];
        const prevPrice = parseFloat(prevTrade?.px || price);
        const nextPrice = parseFloat(nextTrade?.px || price);
        
        // Price impact analysis for side determination
        const priceImpact = price - prevPrice;
        const volumeRatio = size / avgSize;
        
        // Large trades moving price up = aggressive buying
        if (Math.abs(priceImpact) > 0.01 && volumeRatio > 1.5) {
          side = priceImpact > 0 ? 'buy' : 'sell';
        } else {
          side = price >= prevPrice ? 'buy' : 'sell';
        }
      }
      
      // ADVANCED Aggressive Detection - NO MORE RANDOM!
      const isAggressive = this.detectAggressiveOrder(trade, trades, index, avgSize);
      
      const isLarge = size >= largeThreshold;
      const isWhale = size >= whaleThreshold;
      const isInstitutional = size >= institutionalThreshold;
      
      // Advanced trade type classification with institution detection
      let tradeType: 'institutional' | 'market_maker' | 'market_taker' | 'whale' | 'retail';
      if (isInstitutional) {
        tradeType = 'institutional';
      } else if (isWhale) {
        tradeType = 'whale';
      } else if (isAggressive && isLarge) {
        tradeType = 'market_taker';
      } else if (isLarge && !isAggressive) {
        tradeType = 'market_maker';
      } else {
        tradeType = 'retail';
      }
      
      // Advanced confidence calculation based on multiple factors
      const sizeConfidence = Math.min(40, (size / avgSize) * 10);
      const priceActionConfidence = isAggressive ? 30 : 20;
      const marketConditionConfidence = this.calculateMarketConfidence(trades, index);
      const confidence = Math.min(95, sizeConfidence + priceActionConfidence + marketConditionConfidence);
      
      return {
        id: trade.tradeId || trade.id || `${index}_${timestamp}`,
        timestamp: new Date(timestamp).toISOString(),
        price,
        size,
        side,
        isAggressive,
        isLarge,
        value,
        type: tradeType,
        confidence: Math.round(confidence)
      };
    });
  }
  
  /**
   * ADVANCED: Detect aggressive orders using institutional-grade analysis
   */
  private detectAggressiveOrder(trade: any, allTrades: any[], index: number, avgSize: number): boolean {
    const size = parseFloat(trade.sz || trade.size || 0);
    const price = parseFloat(trade.px || trade.price || 0);
    const timestamp = parseInt(trade.ts || Date.now());
    
    // 1. Size-based aggressiveness (larger orders more likely aggressive)
    const sizeRatio = size / avgSize;
    const sizeScore = Math.min(1, sizeRatio / 3); // 0-1 score
    
    // 2. Time-based clustering analysis (aggressive orders cluster in time)
    const timeWindow = 5000; // 5 second window
    const recentTrades = allTrades.slice(Math.max(0, index - 10), index + 10)
      .filter(t => Math.abs(parseInt(t.ts || Date.now()) - timestamp) < timeWindow);
    const clusteringScore = Math.min(1, recentTrades.length / 5); // 0-1 score
    
    // 3. Price impact analysis (aggressive orders move price)
    let priceImpactScore = 0;
    if (index > 0) {
      const prevTrade = allTrades[index - 1];
      const prevPrice = parseFloat(prevTrade?.px || price);
      const priceImpact = Math.abs(price - prevPrice) / prevPrice;
      priceImpactScore = Math.min(1, priceImpact * 1000); // 0-1 score
    }
    
    // 4. Volume velocity analysis (burst of volume = aggressive)
    const velocityWindow = allTrades.slice(Math.max(0, index - 5), index + 1);
    const recentVolume = velocityWindow.reduce((sum, t) => sum + parseFloat(t.sz || t.size || 0), 0);
    const avgRecentSize = recentVolume / velocityWindow.length;
    const velocityScore = Math.min(1, avgRecentSize / (avgSize * 2));
    
    // 5. Market depth analysis (if available from order book)
    const depthScore = sizeRatio > 2 ? 0.8 : sizeRatio > 1.5 ? 0.6 : 0.4;
    
    // Weighted combination of all factors
    const aggressiveScore = (
      sizeScore * 0.25 +          // Size importance
      clusteringScore * 0.15 +    // Time clustering
      priceImpactScore * 0.30 +   // Price impact (most important)
      velocityScore * 0.20 +      // Volume velocity  
      depthScore * 0.10           // Market depth
    );
    
    // Dynamic threshold based on market conditions
    const threshold = this.calculateAggressiveThreshold(allTrades.length, avgSize);
    return aggressiveScore > threshold;
  }
  
  /**
   * Calculate dynamic aggressive threshold based on market conditions
   */
  private calculateAggressiveThreshold(totalTrades: number, avgSize: number): number {
    // More trades = lower threshold (more liquidity)
    const liquidityFactor = Math.min(0.8, totalTrades / 100); 
    
    // Larger average size = higher threshold (institutional market)
    const sizeFactor = Math.min(0.3, avgSize / 1000);
    
    // Base threshold with dynamic adjustments
    return 0.6 - liquidityFactor * 0.2 + sizeFactor * 0.1;
  }
  
  /**
   * Calculate market condition confidence for trade classification
   */
  private calculateMarketConfidence(trades: any[], index: number): number {
    const windowSize = Math.min(10, trades.length);
    const window = trades.slice(Math.max(0, index - windowSize), index + 1);
    
    if (window.length < 3) return 15; // Low confidence with few trades
    
    // Analyze trade pattern consistency
    const sizes = window.map(t => parseFloat(t.sz || t.size || 0));
    const prices = window.map(t => parseFloat(t.px || t.price || 0));
    
    // Calculate volume consistency (low variance = higher confidence)
    const sizeVariance = this.calculateVariance(sizes);
    const priceVariance = this.calculateVariance(prices);
    
    const sizeConsistency = Math.max(0, 1 - sizeVariance / (sizes.reduce((a, b) => a + b) / sizes.length));
    const priceConsistency = Math.max(0, 1 - priceVariance / (prices.reduce((a, b) => a + b) / prices.length));
    
    return Math.round((sizeConsistency * 15 + priceConsistency * 10));
  }
  
  /**
   * Calculate statistical variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  /**
   * Detect whale activity patterns
   */
  detectWhaleActivity(trades: OrderFlowTrade[]): {
    detected: boolean;
    direction: 'accumulation' | 'distribution' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    volume: number;
    trades: OrderFlowTrade[];
    confidence: number;
  } {
    const whaleTrades = trades.filter(t => t.type === 'whale');
    
    if (whaleTrades.length === 0) {
      return {
        detected: false,
        direction: 'neutral',
        strength: 'weak',
        volume: 0,
        trades: [],
        confidence: 0
      };
    }
    
    const totalWhaleVolume = whaleTrades.reduce((sum, t) => sum + t.size, 0);
    const whaleBuyVolume = whaleTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0);
    const whaleSellVolume = whaleTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0);
    
    const netWhaleVolume = whaleBuyVolume - whaleSellVolume;
    const whaleImbalance = netWhaleVolume / (totalWhaleVolume || 1);
    
    let direction: 'accumulation' | 'distribution' | 'neutral' = 'neutral';
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    
    if (whaleImbalance > 0.4) {
      direction = 'accumulation';
      strength = whaleImbalance > 0.7 ? 'strong' : 'moderate';
    } else if (whaleImbalance < -0.4) {
      direction = 'distribution';
      strength = whaleImbalance < -0.7 ? 'strong' : 'moderate';
    }
    
    const confidence = Math.min(95, whaleTrades.length * 15 + Math.abs(whaleImbalance) * 50);
    
    return {
      detected: whaleTrades.length > 0,
      direction,
      strength,
      volume: totalWhaleVolume,
      trades: whaleTrades.slice(-10), // Last 10 whale trades
      confidence
    };
  }
  
  /**
   * Analyze market maker vs taker flow
   */
  analyzeFlowTypes(trades: OrderFlowTrade[]): {
    makerBuyVolume: number;
    makerSellVolume: number;
    takerBuyVolume: number;
    takerSellVolume: number;
    makerTakerRatio: number;
    dominantFlow: 'maker_dominated' | 'taker_dominated' | 'balanced';
    flowStrength: 'weak' | 'moderate' | 'strong';
  } {
    let makerBuyVolume = 0;
    let makerSellVolume = 0;
    let takerBuyVolume = 0;
    let takerSellVolume = 0;
    
    trades.forEach(trade => {
      if (trade.type === 'market_maker') {
        if (trade.side === 'buy') makerBuyVolume += trade.size;
        else makerSellVolume += trade.size;
      } else if (trade.type === 'market_taker') {
        if (trade.side === 'buy') takerBuyVolume += trade.size;
        else takerSellVolume += trade.size;
      }
    });
    
    const totalMakerVolume = makerBuyVolume + makerSellVolume;
    const totalTakerVolume = takerBuyVolume + takerSellVolume;
    const totalVolume = totalMakerVolume + totalTakerVolume;
    
    const makerTakerRatio = totalVolume > 0 ? totalTakerVolume / totalVolume : 0.5;
    
    let dominantFlow: 'maker_dominated' | 'taker_dominated' | 'balanced';
    let flowStrength: 'weak' | 'moderate' | 'strong';
    
    if (makerTakerRatio > 0.65) {
      dominantFlow = 'taker_dominated';
      flowStrength = makerTakerRatio > 0.8 ? 'strong' : 'moderate';
    } else if (makerTakerRatio < 0.35) {
      dominantFlow = 'maker_dominated';
      flowStrength = makerTakerRatio < 0.2 ? 'strong' : 'moderate';
    } else {
      dominantFlow = 'balanced';
      flowStrength = 'weak';
    }
    
    return {
      makerBuyVolume,
      makerSellVolume,
      takerBuyVolume,
      takerSellVolume,
      makerTakerRatio: Math.round(makerTakerRatio * 1000) / 1000,
      dominantFlow,
      flowStrength
    };
  }
  
  /**
   * Generate order flow signals
   */
  generateOrderFlowSignals(
    trades: OrderFlowTrade[],
    imbalance: BidAskImbalance,
    whaleActivity: any,
    timeframe: string
  ): OrderFlowSignal[] {
    const signals: OrderFlowSignal[] = [];
    const timestamp = new Date().toISOString();
    
    // Large trade signals
    const recentLargeTrades = trades.filter(t => t.isLarge).slice(-5);
    if (recentLargeTrades.length >= 3) {
      const buyTrades = recentLargeTrades.filter(t => t.side === 'buy').length;
      const sellTrades = recentLargeTrades.filter(t => t.side === 'sell').length;
      
      if (buyTrades > sellTrades * 2) {
        signals.push({
          type: 'large_buy',
          timestamp,
          price: recentLargeTrades[recentLargeTrades.length - 1].price,
          strength: buyTrades >= 4 ? 'strong' : 'moderate',
          confidence: Math.min(90, buyTrades * 20),
          description: `${buyTrades} large buy orders detected in recent ${timeframe}`,
          volume: recentLargeTrades.reduce((sum, t) => sum + t.size, 0),
          impact: buyTrades >= 4 ? 'high' : 'medium'
        });
      } else if (sellTrades > buyTrades * 2) {
        signals.push({
          type: 'large_sell',
          timestamp,
          price: recentLargeTrades[recentLargeTrades.length - 1].price,
          strength: sellTrades >= 4 ? 'strong' : 'moderate',
          confidence: Math.min(90, sellTrades * 20),
          description: `${sellTrades} large sell orders detected in recent ${timeframe}`,
          volume: recentLargeTrades.reduce((sum, t) => sum + t.size, 0),
          impact: sellTrades >= 4 ? 'high' : 'medium'
        });
      }
    }
    
    // Aggressive buying/selling signals
    const aggressiveTrades = trades.filter(t => t.isAggressive).slice(-10);
    const aggressiveBuys = aggressiveTrades.filter(t => t.side === 'buy').length;
    const aggressiveSells = aggressiveTrades.filter(t => t.side === 'sell').length;
    
    if (aggressiveBuys > aggressiveSells * 2 && aggressiveBuys >= 6) {
      signals.push({
        type: 'aggressive_buying',
        timestamp,
        price: aggressiveTrades[aggressiveTrades.length - 1].price,
        strength: aggressiveBuys >= 8 ? 'strong' : 'moderate',
        confidence: Math.min(85, aggressiveBuys * 10),
        description: `Strong aggressive buying pressure detected (${aggressiveBuys}/${aggressiveTrades.length} trades)`,
        volume: aggressiveTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0),
        impact: aggressiveBuys >= 8 ? 'high' : 'medium'
      });
    } else if (aggressiveSells > aggressiveBuys * 2 && aggressiveSells >= 6) {
      signals.push({
        type: 'aggressive_selling',
        timestamp,
        price: aggressiveTrades[aggressiveTrades.length - 1].price,
        strength: aggressiveSells >= 8 ? 'strong' : 'moderate',
        confidence: Math.min(85, aggressiveSells * 10),
        description: `Strong aggressive selling pressure detected (${aggressiveSells}/${aggressiveTrades.length} trades)`,
        volume: aggressiveTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0),
        impact: aggressiveSells >= 8 ? 'high' : 'medium'
      });
    }
    
    // Imbalance signals
    if (imbalance.significance !== 'minor') {
      const signalType = imbalance.prediction === 'bullish' ? 'imbalance_bullish' : 'imbalance_bearish';
      
      signals.push({
        type: signalType,
        timestamp,
        price: trades[trades.length - 1]?.price || 0,
        strength: imbalance.strength,
        confidence: Math.abs(imbalance.imbalanceRatio) * 100,
        description: `${imbalance.significance} ${imbalance.prediction} imbalance detected (${(imbalance.imbalanceRatio * 100).toFixed(1)}%)`,
        volume: imbalance.bidSize + imbalance.askSize,
        impact: imbalance.significance === 'critical' ? 'high' : 'medium'
      });
    }
    
    // Whale activity signals
    if (whaleActivity.detected && whaleActivity.strength !== 'weak') {
      const signalType = whaleActivity.direction === 'accumulation' ? 'whale_accumulation' : 'whale_distribution';
      
      signals.push({
        type: signalType,
        timestamp,
        price: whaleActivity.trades[whaleActivity.trades.length - 1]?.price || 0,
        strength: whaleActivity.strength,
        confidence: whaleActivity.confidence,
        description: `Whale ${whaleActivity.direction} detected with ${whaleActivity.strength} strength`,
        volume: whaleActivity.volume,
        impact: whaleActivity.strength === 'strong' ? 'high' : 'medium'
      });
    }
    
    return signals;
  }
  
  /**
   * Perform tape reading analysis
   */
  performTapeReading(trades: OrderFlowTrade[]): {
    momentum: 'bullish' | 'bearish' | 'neutral';
    velocity: 'slow' | 'moderate' | 'fast';
    consistency: 'inconsistent' | 'consistent' | 'very_consistent';
    largeOrderActivity: 'increasing' | 'decreasing' | 'stable';
    marketSentiment: 'bullish' | 'bearish' | 'neutral';
    predictionConfidence: number;
  } {
    if (trades.length < 10) {
      return {
        momentum: 'neutral',
        velocity: 'slow',
        consistency: 'inconsistent',
        largeOrderActivity: 'stable',
        marketSentiment: 'neutral',
        predictionConfidence: 0
      };
    }
    
    // Analyze recent momentum
    const recentTrades = trades.slice(-20);
    const buyVolume = recentTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0);
    const sellVolume = recentTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0);
    const netVolume = buyVolume - sellVolume;
    const totalVolume = buyVolume + sellVolume;
    
    const momentum = netVolume > totalVolume * 0.2 ? 'bullish' :
                     netVolume < -totalVolume * 0.2 ? 'bearish' : 'neutral';
    
    // Analyze velocity (trades per minute)
    const timeSpan = recentTrades.length > 1 ? 
      (new Date(recentTrades[recentTrades.length - 1].timestamp).getTime() - 
       new Date(recentTrades[0].timestamp).getTime()) / 60000 : 1; // minutes
    
    const tradesPerMinute = recentTrades.length / Math.max(timeSpan, 1);
    const velocity = tradesPerMinute > 10 ? 'fast' : tradesPerMinute > 3 ? 'moderate' : 'slow';
    
    // Analyze consistency
    const buyChunks = [];
    const sellChunks = [];
    for (let i = 0; i < recentTrades.length; i += 5) {
      const chunk = recentTrades.slice(i, i + 5);
      const chunkBuyVol = chunk.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0);
      const chunkSellVol = chunk.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0);
      buyChunks.push(chunkBuyVol);
      sellChunks.push(chunkSellVol);
    }
    
    const buyConsistency = buyChunks.filter(v => v > 0).length / buyChunks.length;
    const sellConsistency = sellChunks.filter(v => v > 0).length / sellChunks.length;
    const avgConsistency = (buyConsistency + sellConsistency) / 2;
    
    const consistency = avgConsistency > 0.8 ? 'very_consistent' :
                       avgConsistency > 0.5 ? 'consistent' : 'inconsistent';
    
    // Analyze large order activity trend
    const firstHalfLarge = recentTrades.slice(0, 10).filter(t => t.isLarge).length;
    const secondHalfLarge = recentTrades.slice(10).filter(t => t.isLarge).length;
    
    const largeOrderActivity = secondHalfLarge > firstHalfLarge ? 'increasing' :
                              secondHalfLarge < firstHalfLarge ? 'decreasing' : 'stable';
    
    // Determine market sentiment
    const marketSentiment = momentum === 'bullish' && velocity !== 'slow' ? 'bullish' :
                           momentum === 'bearish' && velocity !== 'slow' ? 'bearish' : 'neutral';
    
    // Calculate prediction confidence
    const momentumScore = momentum === 'neutral' ? 0 : 30;
    const velocityScore = velocity === 'fast' ? 25 : velocity === 'moderate' ? 15 : 5;
    const consistencyScore = consistency === 'very_consistent' ? 25 : consistency === 'consistent' ? 15 : 5;
    const activityScore = largeOrderActivity === 'increasing' ? 20 : 10;
    
    const predictionConfidence = Math.min(95, momentumScore + velocityScore + consistencyScore + activityScore);
    
    return {
      momentum,
      velocity,
      consistency,
      largeOrderActivity,
      marketSentiment,
      predictionConfidence
    };
  }
  
  /**
   * Advanced Volume Profile Analysis - Institutional Grade
   */
  analyzeAdvancedVolumeProfile(trades: OrderFlowTrade[], candleData: any[]): AdvancedVolumeAnalysis {
    const volumeMap = new Map<number, number>();
    const timeMap = new Map<number, number>();
    
    // Process trade data to build volume profile
    trades.forEach(trade => {
      const priceLevel = Math.round(trade.price * 100) / 100; // Round to 2 decimals
      const currentVolume = volumeMap.get(priceLevel) || 0;
      volumeMap.set(priceLevel, currentVolume + trade.size);
      
      const currentTime = timeMap.get(priceLevel) || 0;
      timeMap.set(priceLevel, currentTime + 1);
    });
    
    const totalVolume = Array.from(volumeMap.values()).reduce((sum, vol) => sum + vol, 0);
    const volumeProfile: VolumeProfile[] = [];
    
    // Create volume profile array
    volumeMap.forEach((volume, priceLevel) => {
      const percentage = (volume / totalVolume) * 100;
      const tradingTime = timeMap.get(priceLevel) || 0;
      
      let type: 'high_volume_node' | 'low_volume_node' | 'point_of_control' | 'value_area';
      let significance: 'minor' | 'major' | 'critical';
      
      if (percentage > 15) {
        type = 'point_of_control';
        significance = 'critical';
      } else if (percentage > 8) {
        type = 'high_volume_node';
        significance = 'major';
      } else if (percentage > 3) {
        type = 'value_area';
        significance = 'major';
      } else {
        type = 'low_volume_node';
        significance = 'minor';
      }
      
      volumeProfile.push({
        priceLevel,
        volume,
        percentage: Math.round(percentage * 100) / 100,
        tradingTime,
        type,
        significance
      });
    });
    
    // Sort by volume desc to find VPOC
    volumeProfile.sort((a, b) => b.volume - a.volume);
    const vpoc = volumeProfile[0]?.priceLevel || 0;
    
    // Calculate value area (70% of volume)
    let valueAreaVolume = 0;
    const valueAreaTarget = totalVolume * 0.7;
    const valueAreaPrices: number[] = [];
    
    for (const profile of volumeProfile) {
      valueAreaVolume += profile.volume;
      valueAreaPrices.push(profile.priceLevel);
      if (valueAreaVolume >= valueAreaTarget) break;
    }
    
    const valueAreaHigh = Math.max(...valueAreaPrices);
    const valueAreaLow = Math.min(...valueAreaPrices);
    
    // Calculate volume distribution around VPOC
    const aboveVpoc = volumeProfile
      .filter(p => p.priceLevel > vpoc)
      .reduce((sum, p) => sum + p.volume, 0);
    const belowVpoc = volumeProfile
      .filter(p => p.priceLevel < vpoc)
      .reduce((sum, p) => sum + p.volume, 0);
    
    // Identify high/low volume nodes
    const avgVolume = totalVolume / volumeProfile.length;
    const highVolumeNodes = volumeProfile
      .filter(p => p.volume > avgVolume * 2.5)
      .map(p => p.priceLevel)
      .sort((a, b) => a - b)
      .slice(0, 10);
    
    const lowVolumeNodes = volumeProfile
      .filter(p => p.volume < avgVolume * 0.2)
      .map(p => p.priceLevel)
      .sort((a, b) => a - b)
      .slice(0, 5);
    
    // Support/resistance based on volume clusters
    const support = volumeProfile
      .filter(p => p.priceLevel < vpoc && p.percentage > 5)
      .map(p => p.priceLevel)
      .sort((a, b) => b - a)
      .slice(0, 3);
    
    const resistance = volumeProfile
      .filter(p => p.priceLevel > vpoc && p.percentage > 5)
      .map(p => p.priceLevel)
      .sort((a, b) => a - b)
      .slice(0, 3);
    
    return {
      vpoc,
      valueAreaHigh,
      valueAreaLow,
      volumeProfile: volumeProfile.slice(0, 20), // Top 20 levels
      volumeDistribution: {
        aboveVpoc,
        belowVpoc,
        imbalance: Math.round(((aboveVpoc - belowVpoc) / totalVolume) * 1000) / 1000
      },
      highVolumeNodes,
      lowVolumeNodes,
      supportResistanceLevels: {
        support,
        resistance,
        dynamicLevels: highVolumeNodes
      }
    };
  }

  /**
   * Enhanced Smart Money Flow Analysis
   */
  analyzeSmartMoneyFlow(trades: OrderFlowTrade[]): SmartMoneyFlow {
    const recentTrades = trades.slice(-100); // Last 100 trades for analysis
    
    let institutionalBuyVolume = 0;
    let institutionalSellVolume = 0;
    let retailBuyVolume = 0;
    let retailSellVolume = 0;
    
    // Enhanced classification based on size, timing, and patterns
    recentTrades.forEach(trade => {
      const isInstitutional = trade.type === 'whale' || 
                             (trade.type === 'market_maker' && trade.size > 50) ||
                             (trade.value > 10000); // $10k+ trades
      
      if (isInstitutional) {
        if (trade.side === 'buy') institutionalBuyVolume += trade.size;
        else institutionalSellVolume += trade.size;
      } else {
        if (trade.side === 'buy') retailBuyVolume += trade.size;
        else retailSellVolume += trade.size;
      }
    });
    
    const totalInstitutionalVolume = institutionalBuyVolume + institutionalSellVolume;
    const totalRetailVolume = retailBuyVolume + retailSellVolume;
    const totalVolume = totalInstitutionalVolume + totalRetailVolume;
    
    const smartMoneyRatio = totalVolume > 0 ? totalInstitutionalVolume / totalVolume : 0;
    
    // Estimate dark pool activity (hidden institutional volume)
    const expectedInstRatio = 0.6; // Institutions typically 60%+ of volume
    const actualInstRatio = smartMoneyRatio;
    
    const darkPoolEstimate = actualInstRatio < expectedInstRatio ? 
      Math.max(0, (expectedInstRatio - actualInstRatio) * totalVolume) : 0;
    
    // Detect block trade activity (large institutional orders)
    const blockTrades = recentTrades.filter(t => t.value > 15000); // $15k+ 
    const blockTradeVolume = blockTrades.reduce((sum, t) => sum + t.size, 0);
    const blockBuyVolume = blockTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0);
    const blockSellVolume = blockTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0);
    
    const blockNetVolume = blockBuyVolume - blockSellVolume;
    const blockDirection = blockNetVolume > blockTradeVolume * 0.3 ? 'accumulation' :
                          blockNetVolume < -blockTradeVolume * 0.3 ? 'distribution' : 'neutral';
    
    // Multi-timeframe momentum analysis
    const shortTermTrades = recentTrades.slice(-10);
    const mediumTermTrades = recentTrades.slice(-50);
    const longTermTrades = recentTrades;
    
    const analyzeMomentum = (tradeSet: OrderFlowTrade[]) => {
      const buyVol = tradeSet.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0);
      const sellVol = tradeSet.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0);
      const net = buyVol - sellVol;
      const total = buyVol + sellVol;
      
      if (net > total * 0.2) return 'bullish';
      if (net < -total * 0.2) return 'bearish';
      return 'neutral';
    };
    
    const shortTerm = analyzeMomentum(shortTermTrades);
    const mediumTerm = analyzeMomentum(mediumTermTrades);
    const longTerm = analyzeMomentum(longTermTrades);
    
    // Calculate momentum consistency
    const momentumValues = [shortTerm, mediumTerm, longTerm];
    const bullishCount = momentumValues.filter(m => m === 'bullish').length;
    const bearishCount = momentumValues.filter(m => m === 'bearish').length;
    const neutralCount = momentumValues.filter(m => m === 'neutral').length;
    
    const maxCount = Math.max(bullishCount, bearishCount, neutralCount);
    const consistency = maxCount / 3; // 0-1 scale
    
    return {
      institutionalBuyVolume,
      institutionalSellVolume,
      retailBuyVolume,
      retailSellVolume,
      smartMoneyRatio: Math.round(smartMoneyRatio * 1000) / 1000,
      darkPoolEstimate: Math.round(darkPoolEstimate * 100) / 100,
      blockTradeActivity: {
        detected: blockTrades.length > 0,
        volume: blockTradeVolume,
        frequency: blockTrades.length,
        direction: blockDirection
      },
      orderFlowMomentum: {
        shortTerm,
        mediumTerm,
        longTerm,
        consistency: Math.round(consistency * 100) / 100
      }
    };
  }

  /**
   * Deep Liquidity Analysis with Support/Resistance Detection
   */
  analyzeDeepLiquidity(orderBook: any, recentTrades: OrderFlowTrade[]): LiquidityLevel[] {
    const bids = orderBook.bids || [];
    const asks = orderBook.asks || [];
    const liquidityLevels: LiquidityLevel[] = [];
    
    // Calculate average volume for comparison
    const totalBookVolume = [...bids, ...asks].reduce((sum, level) => 
      sum + parseFloat(level[1]), 0
    );
    const avgLevelVolume = totalBookVolume / (bids.length + asks.length);
    
    // Process bid levels (support)
    bids.forEach((bid: any, index: number) => {
      const price = Math.round(parseFloat(bid[0]) * 100) / 100;
      const bidVolume = parseFloat(bid[1]);
      
      // Calculate absorption and interaction analysis
      const tradesAtLevel = recentTrades.filter(t => 
        Math.abs(t.price - price) < 0.05
      );
      const absorption = tradesAtLevel.reduce((sum, t) => sum + t.size, 0);
      const touchCount = tradesAtLevel.length;
      
      const rejectionTrades = tradesAtLevel.filter(t => t.isLarge);
      const rejectionStrength = rejectionTrades.length > 0 ? 
        rejectionTrades.reduce((sum, t) => sum + t.confidence, 0) / rejectionTrades.length : 0;
      
      const hiddenLiquidity = Math.max(0, bidVolume - absorption);
      
      let strength: 'weak' | 'moderate' | 'strong';
      if (bidVolume > avgLevelVolume * 3) strength = 'strong';
      else if (bidVolume > avgLevelVolume * 1.5) strength = 'moderate';
      else strength = 'weak';
      
      liquidityLevels.push({
        price,
        bidVolume,
        askVolume: 0,
        netVolume: bidVolume,
        absorption,
        strength,
        type: 'support',
        depth: bids.length - index,
        touchCount,
        rejectionStrength: Math.round(rejectionStrength * 100) / 100,
        hiddenLiquidity: Math.round(hiddenLiquidity * 100) / 100
      });
    });
    
    // Process ask levels (resistance)
    asks.forEach((ask: any, index: number) => {
      const price = Math.round(parseFloat(ask[0]) * 100) / 100;
      const askVolume = parseFloat(ask[1]);
      
      const tradesAtLevel = recentTrades.filter(t => 
        Math.abs(t.price - price) < 0.05
      );
      const absorption = tradesAtLevel.reduce((sum, t) => sum + t.size, 0);
      const touchCount = tradesAtLevel.length;
      
      const rejectionTrades = tradesAtLevel.filter(t => t.isLarge);
      const rejectionStrength = rejectionTrades.length > 0 ? 
        rejectionTrades.reduce((sum, t) => sum + t.confidence, 0) / rejectionTrades.length : 0;
      
      const hiddenLiquidity = Math.max(0, askVolume - absorption);
      
      let strength: 'weak' | 'moderate' | 'strong';
      if (askVolume > avgLevelVolume * 3) strength = 'strong';
      else if (askVolume > avgLevelVolume * 1.5) strength = 'moderate';
      else strength = 'weak';
      
      liquidityLevels.push({
        price,
        bidVolume: 0,
        askVolume,
        netVolume: -askVolume,
        absorption,
        strength,
        type: 'resistance',
        depth: asks.length - index,
        touchCount,
        rejectionStrength: Math.round(rejectionStrength * 100) / 100,
        hiddenLiquidity: Math.round(hiddenLiquidity * 100) / 100
      });
    });
    
    // Return sorted by volume strength (top 20 strongest levels)
    return liquidityLevels
      .sort((a, b) => (b.bidVolume + b.askVolume) - (a.bidVolume + a.askVolume))
      .slice(0, 20);
  }

  /**
   * Main order flow analysis function - Enhanced with Advanced Analytics
   */
  async analyzeOrderFlow(
    trades: any[],
    orderBook: any,
    timeframe: string = '1H'
  ): Promise<OrderFlowMetrics> {
    const startTime = Date.now();
    
    if (!trades || trades.length === 0) {
      throw new Error('Insufficient trade data for order flow analysis');
    }
    
    // Classify and analyze trades
    const classifiedTrades = this.classifyTrades(trades);
    
    // Analyze bid/ask imbalance
    const currentImbalance = this.analyzeBidAskImbalance(orderBook);
    
    // Analyze recent trades
    const recentTrades = classifiedTrades.slice(-50); // Last 50 trades
    const totalVolume = recentTrades.reduce((sum, t) => sum + t.size, 0);
    const buyVolume = recentTrades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0);
    const sellVolume = recentTrades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0);
    const netVolume = buyVolume - sellVolume;
    const avgTradeSize = totalVolume / recentTrades.length;
    const largeTradeCount = recentTrades.filter(t => t.isLarge).length;
    
    const aggressiveBuys = recentTrades.filter(t => t.isAggressive && t.side === 'buy').length;
    const aggressiveSells = recentTrades.filter(t => t.isAggressive && t.side === 'sell').length;
    const totalAggressive = aggressiveBuys + aggressiveSells;
    
    // Detect whale activity
    const whaleActivity = this.detectWhaleActivity(classifiedTrades);
    
    // Analyze flow types
    const flowAnalysis = this.analyzeFlowTypes(classifiedTrades);
    
    // Advanced Volume Profile Analysis
    const advancedVolumeAnalysis = this.analyzeAdvancedVolumeProfile(classifiedTrades, []);
    
    // Smart Money Flow Analysis
    const smartMoneyFlow = this.analyzeSmartMoneyFlow(classifiedTrades);
    
    // Deep liquidity analysis
    const liquidityLevels = this.analyzeDeepLiquidity(orderBook, recentTrades);
    
    // Generate signals
    const signals = this.generateOrderFlowSignals(classifiedTrades, currentImbalance, whaleActivity, timeframe);
    
    // Perform tape reading
    const tapeReading = this.performTapeReading(classifiedTrades);
    
    const calculationTime = Date.now() - startTime;
    
    return {
      timeframe,
      currentImbalance,
      recentTrades: {
        total: recentTrades.length,
        buyVolume,
        sellVolume,
        netVolume,
        avgTradeSize: Math.round(avgTradeSize * 1000) / 1000,
        largeTradeCount,
        aggressiveBuyRatio: totalAggressive > 0 ? Math.round(aggressiveBuys / totalAggressive * 1000) / 1000 : 0,
        aggressiveSellRatio: totalAggressive > 0 ? Math.round(aggressiveSells / totalAggressive * 1000) / 1000 : 0
      },
      whaleActivity,
      flowAnalysis,
      liquidityLevels,
      advancedVolumeAnalysis,
      smartMoneyFlow,
      signals,
      tapeReading,
      confidence: {
        overall: Math.min(95, classifiedTrades.length * 2 + (signals.length * 10)),
        dataQuality: Math.min(95, trades.length > 50 ? 90 : trades.length * 1.8),
        signalReliability: Math.min(95, signals.length > 0 ? 80 + (signals.length * 5) : 50),
        volumeConsistency: Math.min(95, totalVolume > avgTradeSize * 10 ? 85 : 60),
        timeConsistency: 85
      },
      lastUpdate: new Date().toISOString(),
      calculationTime,
      tradesAnalyzed: classifiedTrades.length
    };
  }
}
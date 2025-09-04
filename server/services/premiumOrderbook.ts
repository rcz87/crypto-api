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
    this.currentTier = process.env.OKX_VIP_TIER || 'standard';
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
    if (!orderbook) return null;

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
          liquidityPrediction: this.predictLiquidityShifts(orderbook)
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
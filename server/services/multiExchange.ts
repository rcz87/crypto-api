import { okxService } from './okx.js';
import { BybitTestService } from './bybit-test.js';

interface OrderbookLevel {
  price: number;
  size: number;
  exchange: string;
  count?: number;
}

interface AggregatedOrderbook {
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
  totalDepth: number;
  exchanges: string[];
  spreadAnalysis: {
    bestBid: number;
    bestAsk: number;
    spread: number;
    spreadPercentage: number;
  };
  liquidityAnalysis: {
    totalBidLiquidity: number;
    totalAskLiquidity: number;
    liquidityImbalance: number;
    top10BidLiquidity: number;
    top10AskLiquidity: number;
  };
  marketDepthScore: number;
}

interface MultiExchangeStats {
  activeExchanges: string[];
  failedExchanges: string[];
  totalLevels: number;
  aggregationTime: number;
  dataQuality: 'excellent' | 'good' | 'limited' | 'poor';
}

export class MultiExchangeService {
  private bybitService: BybitTestService;
  
  constructor() {
    this.bybitService = new BybitTestService();
  }

  /**
   * Get aggregated orderbook dari multiple exchanges dengan enhanced depth analysis
   */
  async getAggregatedOrderbook(symbol: string = 'SOL-USDT'): Promise<{
    data: AggregatedOrderbook;
    stats: MultiExchangeStats;
  }> {
    const startTime = Date.now();
    const activeExchanges: string[] = [];
    const failedExchanges: string[] = [];
    
    // Fetch data dari multiple exchanges secara parallel
    const [okxResult, bybitResult] = await Promise.allSettled([
      this.getOKXOrderbook(symbol),
      this.getBybitOrderbook(symbol)
    ]);

    let allBids: OrderbookLevel[] = [];
    let allAsks: OrderbookLevel[] = [];

    // Process OKX data
    if (okxResult.status === 'fulfilled' && okxResult.value) {
      activeExchanges.push('OKX');
      allBids.push(...okxResult.value.bids);
      allAsks.push(...okxResult.value.asks);
    } else {
      failedExchanges.push('OKX');
    }

    // Process Bybit data 
    if (bybitResult.status === 'fulfilled' && bybitResult.value) {
      activeExchanges.push('Bybit');
      allBids.push(...bybitResult.value.bids);
      allAsks.push(...bybitResult.value.asks);
    } else {
      failedExchanges.push('Bybit');
    }

    // Merge dan sort orderbook levels
    const mergedOrderbook = this.mergeOrderbooks(allBids, allAsks);
    
    // Calculate advanced analytics
    const spreadAnalysis = this.calculateSpreadAnalysis(mergedOrderbook.bids, mergedOrderbook.asks);
    const liquidityAnalysis = this.calculateLiquidityAnalysis(mergedOrderbook.bids, mergedOrderbook.asks);
    const marketDepthScore = this.calculateMarketDepthScore(mergedOrderbook.bids, mergedOrderbook.asks, activeExchanges.length);
    
    const aggregationTime = Date.now() - startTime;
    
    const aggregatedData: AggregatedOrderbook = {
      symbol,
      bids: mergedOrderbook.bids,
      asks: mergedOrderbook.asks,
      timestamp: Date.now(),
      totalDepth: mergedOrderbook.bids.length + mergedOrderbook.asks.length,
      exchanges: activeExchanges,
      spreadAnalysis,
      liquidityAnalysis,
      marketDepthScore
    };

    const stats: MultiExchangeStats = {
      activeExchanges,
      failedExchanges,
      totalLevels: aggregatedData.totalDepth,
      aggregationTime,
      dataQuality: this.assessDataQuality(activeExchanges.length, aggregatedData.totalDepth)
    };

    return {
      data: aggregatedData,
      stats
    };
  }

  /**
   * Get OKX orderbook data
   */
  private async getOKXOrderbook(symbol: string): Promise<{
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
  } | null> {
    try {
      const orderbook = await okxService.getEnhancedOrderBook(symbol, 100); // Get 100 levels
      
      return {
        bids: orderbook.bids.map((bid: any) => ({
          price: parseFloat(bid.price),
          size: parseFloat(bid.size),
          exchange: 'OKX'
        })),
        asks: orderbook.asks.map((ask: any) => ({
          price: parseFloat(ask.price),
          size: parseFloat(ask.size),
          exchange: 'OKX'
        }))
      };
    } catch (error) {
      console.error('Failed to fetch OKX orderbook:', error);
      return null;
    }
  }

  /**
   * Get Bybit orderbook data (fallback atau simulasi untuk development)
   */
  private async getBybitOrderbook(symbol: string): Promise<{
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
  } | null> {
    try {
      // Dalam production, ini akan menggunakan authenticated Bybit API
      // Untuk development, kita return null karena IP restrictions
      // Struktur sudah siap untuk production implementation
      
      // PRODUCTION CODE (uncomment when running in production environment):
      /*
      const bybitSymbol = this.convertToBybitSymbol(symbol);
      const orderbook = await this.bybitService.getOrderbook(bybitSymbol);
      
      return {
        bids: orderbook.result.b.map(([price, size]) => ({
          price: parseFloat(price),
          size: parseFloat(size),
          exchange: 'Bybit'
        })),
        asks: orderbook.result.a.map(([price, size]) => ({
          price: parseFloat(price),
          size: parseFloat(size),
          exchange: 'Bybit'
        }))
      };
      */
      
      // Development fallback
      return null;
      
    } catch (error) {
      console.error('Failed to fetch Bybit orderbook:', error);
      return null;
    }
  }

  /**
   * Merge multiple orderbooks intelligently
   */
  private mergeOrderbooks(allBids: OrderbookLevel[], allAsks: OrderbookLevel[]): {
    bids: OrderbookLevel[];
    asks: OrderbookLevel[];
  } {
    // Sort bids by price (highest first)
    const sortedBids = allBids.sort((a, b) => b.price - a.price);
    
    // Sort asks by price (lowest first)  
    const sortedAsks = allAsks.sort((a, b) => a.price - b.price);
    
    // Remove duplicate prices, keep largest size
    const uniqueBids = this.removeDuplicatePrices(sortedBids);
    const uniqueAsks = this.removeDuplicatePrices(sortedAsks);
    
    return {
      bids: uniqueBids.slice(0, 100), // Limit to top 100 levels
      asks: uniqueAsks.slice(0, 100)  // Limit to top 100 levels
    };
  }

  /**
   * Remove duplicate prices, keeping the level with largest size
   */
  private removeDuplicatePrices(levels: OrderbookLevel[]): OrderbookLevel[] {
    const priceMap = new Map<number, OrderbookLevel>();
    
    for (const level of levels) {
      const existing = priceMap.get(level.price);
      if (!existing || level.size > existing.size) {
        priceMap.set(level.price, level);
      }
    }
    
    return Array.from(priceMap.values());
  }

  /**
   * Calculate spread analysis
   */
  private calculateSpreadAnalysis(bids: OrderbookLevel[], asks: OrderbookLevel[]): {
    bestBid: number;
    bestAsk: number;
    spread: number;
    spreadPercentage: number;
  } {
    const bestBid = bids.length > 0 ? bids[0].price : 0;
    const bestAsk = asks.length > 0 ? asks[0].price : 0;
    const spread = bestAsk - bestBid;
    const spreadPercentage = bestBid > 0 ? (spread / bestBid) * 100 : 0;

    return {
      bestBid,
      bestAsk,
      spread,
      spreadPercentage
    };
  }

  /**
   * Calculate liquidity analysis
   */
  private calculateLiquidityAnalysis(bids: OrderbookLevel[], asks: OrderbookLevel[]): {
    totalBidLiquidity: number;
    totalAskLiquidity: number;
    liquidityImbalance: number;
    top10BidLiquidity: number;
    top10AskLiquidity: number;
  } {
    const totalBidLiquidity = bids.reduce((sum, bid) => sum + (bid.price * bid.size), 0);
    const totalAskLiquidity = asks.reduce((sum, ask) => sum + (ask.price * ask.size), 0);
    const liquidityImbalance = totalBidLiquidity - totalAskLiquidity;
    
    const top10BidLiquidity = bids.slice(0, 10).reduce((sum, bid) => sum + (bid.price * bid.size), 0);
    const top10AskLiquidity = asks.slice(0, 10).reduce((sum, ask) => sum + (ask.price * ask.size), 0);

    return {
      totalBidLiquidity,
      totalAskLiquidity,
      liquidityImbalance,
      top10BidLiquidity,
      top10AskLiquidity
    };
  }

  /**
   * Calculate market depth score
   */
  private calculateMarketDepthScore(bids: OrderbookLevel[], asks: OrderbookLevel[], exchangeCount: number): number {
    const depthFactor = Math.min((bids.length + asks.length) / 100, 1); // 0-1 based on depth
    const exchangeFactor = Math.min(exchangeCount / 2, 1); // 0-1 based on exchange count
    const liquidityFactor = Math.min(bids.length / 50 + asks.length / 50, 2) / 2; // 0-1 based on liquidity
    
    return Math.round((depthFactor * 0.4 + exchangeFactor * 0.3 + liquidityFactor * 0.3) * 100);
  }

  /**
   * Assess data quality based on active exchanges and depth
   */
  private assessDataQuality(exchangeCount: number, totalLevels: number): 'excellent' | 'good' | 'limited' | 'poor' {
    if (exchangeCount >= 2 && totalLevels >= 100) return 'excellent';
    if (exchangeCount >= 1 && totalLevels >= 50) return 'good';
    if (exchangeCount >= 1 && totalLevels >= 20) return 'limited';
    return 'poor';
  }

  /**
   * Convert symbol format untuk Bybit
   */
  private convertToBybitSymbol(symbol: string): string {
    // Convert SOL-USDT to SOLUSDT format untuk Bybit
    return symbol.replace('-', '');
  }

  /**
   * Get multi-exchange statistics
   */
  async getMultiExchangeStats(): Promise<{
    exchanges: { name: string; status: 'online' | 'offline'; latency?: number }[];
    aggregation: { totalDepth: number; dataQuality: string };
  }> {
    const stats = {
      exchanges: [
        { name: 'OKX', status: 'online' as const, latency: 0 },
        { name: 'Bybit', status: 'offline' as const }
      ],
      aggregation: { totalDepth: 0, dataQuality: 'good' }
    };

    // Test OKX connectivity
    try {
      const startTime = Date.now();
      await okxService.getEnhancedOrderBook('SOL-USDT', 5);
      stats.exchanges[0].latency = Date.now() - startTime;
    } catch (error) {
      stats.exchanges[0].status = 'offline';
    }

    return stats;
  }
}

// Create singleton instance
export const multiExchangeService = new MultiExchangeService();
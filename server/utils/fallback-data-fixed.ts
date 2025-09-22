import { TickerData, CandleData, OrderBookData, RecentTradeData, SolCompleteData, FundingRateData, OpenInterestData, EnhancedOrderBookData, VolumeProfileData, SMCAnalysisData } from '@shared/schema';

// Mock data untuk fallback ketika OKX tidak tersedia
export class FallbackDataProvider {
  private static instance: FallbackDataProvider;
  private lastKnownPrice = 180.50; // SOL price baseline
  private priceVariation = 0.02; // 2% variation

  static getInstance(): FallbackDataProvider {
    if (!FallbackDataProvider.instance) {
      FallbackDataProvider.instance = new FallbackDataProvider();
    }
    return FallbackDataProvider.instance;
  }

  // Generate realistic price with small variations
  private generatePrice(basePrice: number, variation: number = this.priceVariation): number {
    const change = (Math.random() - 0.5) * 2 * variation;
    return parseFloat((basePrice * (1 + change)).toFixed(4));
  }

  // Generate realistic volume
  private generateVolume(): string {
    return (Math.random() * 1000000 + 500000).toFixed(0);
  }

  // Generate realistic timestamp
  private generateTimestamp(offsetMinutes: number = 0): string {
    return (Date.now() - offsetMinutes * 60000).toString();
  }

  getMockTicker(): TickerData {
    const currentPrice = this.generatePrice(this.lastKnownPrice);
    const openPrice = this.generatePrice(this.lastKnownPrice, 0.01);
    const high24h = this.generatePrice(Math.max(currentPrice, openPrice), 0.005);
    const low24h = this.generatePrice(Math.min(currentPrice, openPrice), -0.005);
    const volume = this.generateVolume();
    
    const change24h = ((currentPrice - openPrice) / openPrice * 100).toFixed(2);
    
    return {
      symbol: 'SOL-USDT-SWAP',
      price: currentPrice.toString(),
      change24h: `${change24h}%`,
      high24h: high24h.toString(),
      low24h: low24h.toString(),
      volume: volume,
      tradingVolume24h: (currentPrice * parseFloat(volume)).toFixed(0),
    };
  }

  getMockCandles(timeframe: string = '1H', limit: number = 24): CandleData[] {
    const candles: CandleData[] = [];
    let basePrice = this.lastKnownPrice;
    
    for (let i = limit - 1; i >= 0; i--) {
      const timestamp = this.generateTimestamp(i * this.getTimeframeMinutes(timeframe));
      const open = this.generatePrice(basePrice, 0.005);
      const close = this.generatePrice(open, 0.01);
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      const volume = this.generateVolume();
      
      candles.push({
        timestamp,
        open: open.toString(),
        high: high.toString(),
        low: low.toString(),
        close: close.toString(),
        volume,
      });
      
      basePrice = close; // Use close as next base price for continuity
    }
    
    return candles.reverse(); // Return in chronological order
  }

  private getTimeframeMinutes(timeframe: string): number {
    const timeframes: { [key: string]: number } = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1H': 60,
      '4H': 240,
      '1D': 1440,
      '1W': 10080,
    };
    return timeframes[timeframe] || 60;
  }

  getMockOrderBook(): OrderBookData {
    const midPrice = this.generatePrice(this.lastKnownPrice);
    const spread = midPrice * 0.0001; // 0.01% spread
    
    const asks = [];
    const bids = [];
    
    // Generate 20 levels each side
    for (let i = 0; i < 20; i++) {
      const askPrice = midPrice + spread/2 + (i * spread * 0.1);
      const bidPrice = midPrice - spread/2 - (i * spread * 0.1);
      const askSize = (Math.random() * 1000 + 100).toFixed(0);
      const bidSize = (Math.random() * 1000 + 100).toFixed(0);
      
      asks.push({
        price: askPrice.toFixed(4),
        size: askSize,
      });
      
      bids.push({
        price: bidPrice.toFixed(4),
        size: bidSize,
      });
    }
    
    return {
      asks,
      bids,
      spread: spread.toFixed(4),
    };
  }

  getMockRecentTrades(limit: number = 20): RecentTradeData[] {
    const trades: RecentTradeData[] = [];
    const basePrice = this.generatePrice(this.lastKnownPrice);
    
    for (let i = 0; i < limit; i++) {
      const price = this.generatePrice(basePrice, 0.001);
      const size = (Math.random() * 100 + 10).toFixed(2);
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const timestamp = this.generateTimestamp(i);
      
      trades.push({
        price: price.toString(),
        size,
        side,
        timestamp,
      });
    }
    
    return trades;
  }

  getMockCompleteSOLData(): SolCompleteData {
    return {
      ticker: this.getMockTicker(),
      candles: {
        '5m': this.getMockCandles('5m', 100),
        '15m': this.getMockCandles('15m', 96),
        '30m': this.getMockCandles('30m', 48),
        '1H': this.getMockCandles('1H', 72),
        '4H': this.getMockCandles('4H', 42),
        '1D': this.getMockCandles('1D', 90),
        '1W': this.getMockCandles('1W', 52),
      },
      orderBook: this.getMockOrderBook(),
      recentTrades: this.getMockRecentTrades(30),
      lastUpdate: new Date().toISOString(),
    };
  }

  getMockFundingRate(): FundingRateData {
    const fundingRate = (Math.random() - 0.5) * 0.0002; // -0.01% to +0.01%
    const nextFundingTime = Date.now() + 8 * 60 * 60 * 1000; // Next 8 hours
    
    return {
      instId: 'SOL-USDT-SWAP',
      fundingRate: fundingRate.toFixed(6),
      nextFundingRate: (fundingRate * 1.1).toFixed(6),
      nextFundingTime: nextFundingTime.toString(),
      fundingTime: Date.now().toString(),
      premium: (fundingRate * 0.8).toFixed(6),
      interestRate: '0.000100',
      maxFundingRate: '0.003750',
      minFundingRate: '-0.003750',
      settFundingRate: fundingRate.toFixed(6),
      settState: 'settled',
      timestamp: Date.now().toString(),
    };
  }

  getMockOpenInterest(): OpenInterestData {
    const oi = (Math.random() * 1000000 + 5000000).toFixed(0);
    const oiUsd = (parseFloat(oi) * this.lastKnownPrice).toFixed(0);
    
    return {
      instId: 'SOL-USDT-SWAP',
      instType: 'SWAP',
      oi,
      oiCcy: 'SOL',
      oiUsd,
      timestamp: Date.now().toString(),
    };
  }

  getMockEnhancedOrderBook(): EnhancedOrderBookData {
    const orderBook = this.getMockOrderBook();
    const midPrice = parseFloat(orderBook.bids[0].price);
    
    // Generate walls (large orders)
    const askWalls = [
      { price: (midPrice * 1.002).toFixed(4), size: '5000', isLarge: true },
      { price: (midPrice * 1.005).toFixed(4), size: '3000', isLarge: false },
    ];
    
    const bidWalls = [
      { price: (midPrice * 0.998).toFixed(4), size: '4500', isLarge: true },
      { price: (midPrice * 0.995).toFixed(4), size: '2800', isLarge: false },
    ];
    
    // Calculate imbalance
    const totalBidVolume = orderBook.bids.slice(0, 10).reduce((sum, bid) => sum + parseFloat(bid.size), 0);
    const totalAskVolume = orderBook.asks.slice(0, 10).reduce((sum, ask) => sum + parseFloat(ask.size), 0);
    const imbalance = ((totalBidVolume - totalAskVolume) / (totalBidVolume + totalAskVolume) * 100).toFixed(2);
    
    return {
      asks: orderBook.asks.slice(0, 50),
      bids: orderBook.bids.slice(0, 50),
      spread: orderBook.spread,
      askWalls,
      bidWalls,
      imbalance,
      lastUpdate: new Date().toISOString(),
    };
  }

  getMockVolumeProfile(): VolumeProfileData {
    const currentPrice = this.generatePrice(this.lastKnownPrice);
    const high = currentPrice * 1.05;
    const low = currentPrice * 0.95;
    const poc = (currentPrice * (0.99 + Math.random() * 0.02)).toFixed(2);
    
    const hvnLevels = [
      { price: poc, volume: '150000', percentage: '12.5' },
      { price: (currentPrice * 1.01).toFixed(2), volume: '120000', percentage: '10.0' },
      { price: (currentPrice * 0.99).toFixed(2), volume: '110000', percentage: '9.2' },
      { price: (currentPrice * 1.02).toFixed(2), volume: '95000', percentage: '7.9' },
      { price: (currentPrice * 0.98).toFixed(2), volume: '88000', percentage: '7.3' },
    ];
    
    const lvnLevels = [
      { price: (high * 0.99).toFixed(2), volume: '15000', percentage: '1.2' },
      { price: (low * 1.01).toFixed(2), volume: '18000', percentage: '1.5' },
      { price: (currentPrice * 1.04).toFixed(2), volume: '12000', percentage: '1.0' },
      { price: (currentPrice * 0.96).toFixed(2), volume: '14000', percentage: '1.1' },
      { price: (high * 0.98).toFixed(2), volume: '16000', percentage: '1.3' },
    ];
    
    return {
      poc,
      hvnLevels,
      lvnLevels,
      totalVolume: '1200000',
      valueArea: {
        high: (currentPrice * 1.03).toFixed(2),
        low: (currentPrice * 0.97).toFixed(2),
        percentage: '70',
      },
      profileRange: {
        high: high.toFixed(2),
        low: low.toFixed(2),
        timeframe: '1H',
      },
      lastUpdate: new Date().toISOString(),
    };
  }

  getMockSMCAnalysis(): SMCAnalysisData {
    const currentPrice = this.generatePrice(this.lastKnownPrice);
    const timestamp = Date.now().toString();
    
    return {
      timeframe: '1H',
      trend: Math.random() > 0.5 ? 'bullish' : 'bearish',
      lastBOS: {
        type: 'bullish',
        price: (currentPrice * 0.98).toFixed(2),
        timestamp: (Date.now() - 3600000).toString(),
      },
      lastCHoCH: null,
      fvgs: [
        {
          id: 'fvg_1',
          timeframe: '1H',
          type: 'bullish',
          high: (currentPrice * 1.01).toFixed(2),
          low: (currentPrice * 0.995).toFixed(2),
          timestamp: (Date.now() - 1800000).toString(),
          mitigated: false,
          significance: 'medium',
        },
      ],
      orderBlocks: [
        {
          id: 'ob_1',
          type: 'demand',
          price: (currentPrice * 0.98).toFixed(2),
          high: (currentPrice * 0.99).toFixed(2),
          low: (currentPrice * 0.97).toFixed(2),
          volume: '50000',
          timestamp: (Date.now() - 7200000).toString(),
          strength: 'strong',
          tested: false,
        },
        {
          id: 'ob_2',
          type: 'supply',
          price: (currentPrice * 1.02).toFixed(2),
          high: (currentPrice * 1.03).toFixed(2),
          low: (currentPrice * 1.01).toFixed(2),
          volume: '45000',
          timestamp: (Date.now() - 5400000).toString(),
          strength: 'medium',
          tested: false,
        },
      ],
      eqh: [
        {
          type: 'high',
          price: (currentPrice * 1.05).toFixed(2),
          timestamp: (Date.now() - 3600000).toString(),
          significance: 'major',
        },
      ],
      eql: [
        {
          type: 'low',
          price: (currentPrice * 0.95).toFixed(2),
          timestamp: (Date.now() - 7200000).toString(),
          significance: 'major',
        },
      ],
      liquiditySweeps: [
        {
          type: 'buy_side',
          level: (currentPrice * 1.04).toFixed(2),
          timestamp: (Date.now() - 1800000).toString(),
          confirmed: true,
        },
      ],
      marketStructure: Math.random() > 0.5 ? 'bullish' : 'bearish',
      confidence: Math.floor(Math.random() * 40) + 60,
      confluenceScore: Math.floor(Math.random() * 30) + 70,
      multiTimeframe: {
        '15m': 'bullish',
        '1H': 'bullish',
        '4H': 'ranging',
        '1D': 'bearish',
      },
      nearestZones: [
        {
          type: 'OB',
          side: 'below',
          price: (currentPrice * 0.98).toFixed(2),
          distancePct: 2.0,
          significance: 'high',
        },
      ],
      regime: 'trending',
      session: 'NY',
      scenarios: [
        {
          side: 'bullish',
          trigger: (currentPrice * 0.98).toFixed(2),
          invalidation: (currentPrice * 0.95).toFixed(2),
          target: (currentPrice * 1.05).toFixed(2),
          note: 'Demand zone reaction expected',
          probability: 75,
        },
      ],
      derivatives: {
        openInterest: {
          value: '5000000',
          change24h: '+2.5%',
          trend: 'increasing',
        },
        fundingRate: {
          current: '0.0001',
          next: '0.00015',
          sentiment: 'neutral',
          extremeLevel: false,
        },
        flowAnalysis: {
          signal: 'absorption',
          strength: 'medium',
          description: 'Institutional absorption detected at key levels',
        },
      },
      atr: {
        value: (currentPrice * 0.02).toFixed(2),
        percentile: 65,
        volatilityRegime: 'normal',
      },
      lastUpdate: new Date().toISOString(),
      dataAge: 30,
    };
  }

  // Update the baseline price for more realistic mock data
  updateBaselinePrice(newPrice: number): void {
    this.lastKnownPrice = newPrice;
  }
}

export const fallbackDataProvider = FallbackDataProvider.getInstance();

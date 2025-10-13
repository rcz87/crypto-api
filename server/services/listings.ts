import { db } from '../db';
import { newListings, volumeSpikes, NewListing, InsertNewListing, InsertVolumeSpike } from '@shared/schema';
import { okxInstrumentsService } from './okx-instruments';
import { OKXService } from './okx';
import { sql, desc, and, eq, gte } from 'drizzle-orm';

interface VolumeData {
  symbol: string;
  currentVolume: number;
  avgVolume: number;
  spikePercentage: number;
}

interface WhaleActivityData {
  detected: boolean;
  buyOrders: number;
  sellOrders: number;
  totalUSD: number;
  averageSize: number;
}

export class ListingsService {
  private okxService: OKXService;
  private monitoredSymbols: Set<string>;
  private initialized: boolean;

  constructor() {
    this.okxService = new OKXService();
    this.monitoredSymbols = new Set();
    this.initialized = false;
  }

  async initializeMonitoredSymbols(): Promise<void> {
    if (this.initialized) {
      console.log(`Already initialized with ${this.monitoredSymbols.size} symbols, skipping...`);
      return;
    }

    // 🔧 PATCH 8: DRASTICALLY REDUCE SYMBOLS (memory optimization)
    // Old: 259 symbols (consumed ~50MB+), New: 20 priority symbols
    const prioritySymbols = [
      'BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP',
      'BNB-USDT-SWAP', 'XRP-USDT-SWAP', 'ADA-USDT-SWAP',
      'DOGE-USDT-SWAP', 'MATIC-USDT-SWAP', 'DOT-USDT-SWAP',
      'AVAX-USDT-SWAP', 'LINK-USDT-SWAP', 'UNI-USDT-SWAP',
      'ATOM-USDT-SWAP', 'LTC-USDT-SWAP', 'BCH-USDT-SWAP',
      'NEAR-USDT-SWAP', 'FTM-USDT-SWAP', 'ALGO-USDT-SWAP',
      'APT-USDT-SWAP', 'ARB-USDT-SWAP'
    ];
    
    this.monitoredSymbols = new Set(prioritySymbols);
    this.initialized = true;
    console.log(`✅ Initialized ${this.monitoredSymbols.size} priority symbols for monitoring (memory-optimized)`);
  }

  async scanNewListings(): Promise<NewListing[]> {
    const newInstruments = await okxInstrumentsService.detectNewListings(this.monitoredSymbols);
    const newListingsData: NewListing[] = [];

    for (const instrument of newInstruments) {
      try {
        const price = await this.getCurrentPrice(instrument.instId);
        
        const listingData: InsertNewListing = {
          symbol: instrument.instId,
          exchange: 'OKX',
          listingTime: new Date(instrument.listTime),
          initialPrice: price.toString(),
          currentPrice: price.toString(),
          status: 'active',
          alertSent: false,
          metadata: {
            baseCcy: instrument.baseCcy,
            quoteCcy: instrument.quoteCcy,
            instType: instrument.instType,
          },
        };

        const [inserted] = await db.insert(newListings).values(listingData).returning();
        newListingsData.push(inserted);

        this.monitoredSymbols.add(instrument.instId);
        
        console.log(`New listing detected: ${instrument.instId} at $${price}`);
      } catch (error) {
        console.error(`Error processing new listing ${instrument.instId}:`, error);
      }
    }

    return newListingsData;
  }

  async detectVolumeSpikes(): Promise<any[]> {
    const recentListings = await db
      .select()
      .from(newListings)
      .where(
        and(
          eq(newListings.status, 'active'),
          gte(newListings.listingTime, sql`NOW() - INTERVAL '24 hours'`)
        )
      )
      .orderBy(desc(newListings.listingTime))
      .limit(50);

    const spikes: any[] = [];

    for (const listing of recentListings) {
      try {
        const recentSpike = await db
          .select()
          .from(volumeSpikes)
          .where(
            and(
              eq(volumeSpikes.symbol, listing.symbol),
              gte(volumeSpikes.detectedAt, sql`NOW() - INTERVAL '1 hour'`)
            )
          )
          .limit(1);

        if (recentSpike.length > 0) {
          console.log(`Spike cooldown active for ${listing.symbol}, skipping...`);
          continue;
        }

        const volumeData = await this.checkVolumeSpike(listing.symbol);
        
        if (volumeData && volumeData.spikePercentage >= 150) {
          const [oiData, whaleData, fundingData, buySellData] = await Promise.all([
            this.getOpenInterestChange(listing.symbol),
            this.detectWhaleActivity(listing.symbol),
            this.getFundingRateChange(listing.symbol),
            this.calculateBuySellVolume(listing.symbol),
          ]);

          const spikeData: InsertVolumeSpike = {
            symbol: listing.symbol,
            exchange: 'OKX',
            normalVolume: volumeData.avgVolume.toString(),
            spikeVolume: volumeData.currentVolume.toString(),
            spikePercentage: volumeData.spikePercentage.toString(),
            openInterestChange: oiData?.change.toString(),
            whaleCount: whaleData.buyOrders + whaleData.sellOrders,
            whaleTotalUsd: whaleData.totalUSD.toString(),
            fundingRateChange: fundingData?.change.toString(),
            signal: this.determineSignal(whaleData, oiData),
            confidence: this.calculateConfidence(volumeData, whaleData, oiData),
            alertSent: false,
            metadata: {
              buyVolume: buySellData?.buyVolume.toString() || '0',
              sellVolume: buySellData?.sellVolume.toString() || '0',
              cvd: buySellData?.cvd.toString() || '0',
              whaleBuyOrders: whaleData.buyOrders,
              whaleSellOrders: whaleData.sellOrders,
            },
          };

          const [inserted] = await db.insert(volumeSpikes).values(spikeData).returning();
          spikes.push(inserted);

          console.log(`Volume spike detected: ${listing.symbol} +${volumeData.spikePercentage.toFixed(0)}% (Buy: $${buySellData?.buyVolume.toFixed(0)}, Sell: $${buySellData?.sellVolume.toFixed(0)})`);
        }
      } catch (error) {
        console.error(`Error checking volume spike for ${listing.symbol}:`, error);
      }
    }

    return spikes;
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const ticker = await this.okxService.getTicker(symbol);
      return parseFloat(ticker.price);
    } catch {
      return 0;
    }
  }

  private async checkVolumeSpike(symbol: string): Promise<VolumeData | null> {
    try {
      const candles = await this.okxService.getCandles(symbol, '1H', 24);
      
      if (candles.length < 2) return null;

      const latestVolume = parseFloat(candles[0].volume);
      const avgVolume = candles.slice(1, 24).reduce((sum, candle) => {
        return sum + parseFloat(candle.volume);
      }, 0) / Math.min(23, candles.length - 1);

      const spikePercentage = ((latestVolume - avgVolume) / avgVolume) * 100;

      return {
        symbol,
        currentVolume: latestVolume,
        avgVolume,
        spikePercentage,
      };
    } catch {
      return null;
    }
  }

  private async getOpenInterestChange(symbol: string): Promise<{ current: number; change: number } | null> {
    try {
      const oi = await this.okxService.getOpenInterest(symbol);
      return {
        current: parseFloat(oi.oiUsd),
        change: 0,
      };
    } catch {
      return null;
    }
  }

  private async detectWhaleActivity(symbol: string): Promise<WhaleActivityData> {
    try {
      const trades = await this.okxService.getRecentTrades(symbol);
      
      const WHALE_THRESHOLD = 10000;
      const whaleTrades = trades.filter(trade => parseFloat(trade.size) * parseFloat(trade.price) >= WHALE_THRESHOLD);
      
      const buyOrders = whaleTrades.filter(t => t.side === 'buy').length;
      const sellOrders = whaleTrades.filter(t => t.side === 'sell').length;
      const totalUSD = whaleTrades.reduce((sum, t) => sum + (parseFloat(t.size) * parseFloat(t.price)), 0);
      
      return {
        detected: whaleTrades.length > 0,
        buyOrders,
        sellOrders,
        totalUSD,
        averageSize: whaleTrades.length > 0 ? totalUSD / whaleTrades.length : 0,
      };
    } catch {
      return {
        detected: false,
        buyOrders: 0,
        sellOrders: 0,
        totalUSD: 0,
        averageSize: 0,
      };
    }
  }

  private async calculateBuySellVolume(symbol: string): Promise<{ buyVolume: number; sellVolume: number; cvd: number } | null> {
    try {
      const trades = await this.okxService.getRecentTrades(symbol);
      
      const buyVolume = trades
        .filter(t => t.side === 'buy')
        .reduce((sum, t) => sum + (parseFloat(t.size) * parseFloat(t.price)), 0);
      
      const sellVolume = trades
        .filter(t => t.side === 'sell')
        .reduce((sum, t) => sum + (parseFloat(t.size) * parseFloat(t.price)), 0);
      
      const cvd = buyVolume - sellVolume;
      
      return {
        buyVolume,
        sellVolume,
        cvd,
      };
    } catch {
      return null;
    }
  }

  private async getFundingRateChange(symbol: string): Promise<{ current: number; change: number } | null> {
    try {
      const funding = await this.okxService.getFundingRate(symbol);
      return {
        current: parseFloat(funding.fundingRate),
        change: 0,
      };
    } catch {
      return null;
    }
  }

  private determineSignal(whaleData: WhaleActivityData, oiData: any): string {
    if (!whaleData.detected) return 'neutral';
    
    if (whaleData.buyOrders > whaleData.sellOrders * 1.5) {
      return 'buy';
    } else if (whaleData.sellOrders > whaleData.buyOrders * 1.5) {
      return 'sell';
    }
    
    return 'neutral';
  }

  private calculateConfidence(volumeData: VolumeData, whaleData: WhaleActivityData, oiData: any): number {
    let confidence = 0;

    if (volumeData.spikePercentage >= 150) confidence += 30;
    if (volumeData.spikePercentage >= 300) confidence += 20;
    
    if (whaleData.detected) confidence += 25;
    if (whaleData.totalUSD >= 1000000) confidence += 15;
    
    if (oiData && oiData.change > 100) confidence += 10;

    return Math.min(confidence, 100);
  }

  async getActiveListings(limit: number = 20): Promise<NewListing[]> {
    return await db
      .select()
      .from(newListings)
      .where(eq(newListings.status, 'active'))
      .orderBy(desc(newListings.listingTime))
      .limit(limit);
  }

  async getRecentSpikes(limit: number = 20): Promise<any[]> {
    return await db
      .select()
      .from(volumeSpikes)
      .orderBy(desc(volumeSpikes.detectedAt))
      .limit(limit);
  }

  async updateListingPrice(symbol: string, price: number): Promise<void> {
    await db
      .update(newListings)
      .set({ 
        currentPrice: price.toString(),
        updatedAt: new Date(),
      })
      .where(eq(newListings.symbol, symbol));
  }
}

export const listingsService = new ListingsService();

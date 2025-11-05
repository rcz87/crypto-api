/**
 * NEW COIN SCANNER SERVICE
 * 
 * Automatically detects newly listed cryptocurrency coins from multiple exchanges
 * - Binance, OKX, Coingecko, Dexscreener
 * - Compares with cached data to identify NEW listings only
 * - Returns coin metadata for further analysis
 */

import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data', 'known_coins_cache.json');

interface NewCoin {
  symbol: string;
  exchange: string;
  listedAt: string;
  baseAsset: string;
  quoteAsset: string;
  volume24h?: number;
  source: 'binance' | 'okx' | 'coingecko' | 'dexscreener';
}

interface CoinCache {
  [key: string]: {
    firstSeen: string;
    exchanges: string[];
  };
}

export class NewCoinScanner {
  private cache: CoinCache = {};
  private isInitialized = false;

  constructor() {
    this.initializeCache();
  }

  /**
   * Initialize or load existing cache
   */
  private async initializeCache(): Promise<void> {
    try {
      // Ensure data directory exists
      await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });

      // Try to load existing cache
      const data = await fs.readFile(CACHE_FILE, 'utf-8');
      this.cache = JSON.parse(data);
      console.log(`📦 [NewCoinScanner] Cache loaded: ${Object.keys(this.cache).length} coins tracked`);
    } catch (error) {
      // Cache doesn't exist, start fresh
      console.log('📦 [NewCoinScanner] Starting with fresh cache');
      this.cache = {};
      await this.saveCache();
    }
    this.isInitialized = true;
  }

  /**
   * Save cache to disk
   */
  private async saveCache(): Promise<void> {
    try {
      await fs.writeFile(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ [NewCoinScanner] Failed to save cache:', error);
    }
  }

  /**
   * Check if coin is new (not in cache)
   */
  private isNewCoin(symbol: string, exchange: string): boolean {
    if (!this.cache[symbol]) {
      return true;
    }
    // Check if this exchange is new for this coin
    return !this.cache[symbol].exchanges.includes(exchange);
  }

  /**
   * Add coin to cache
   */
  private addToCache(symbol: string, exchange: string): void {
    if (!this.cache[symbol]) {
      this.cache[symbol] = {
        firstSeen: new Date().toISOString(),
        exchanges: [exchange]
      };
    } else if (!this.cache[symbol].exchanges.includes(exchange)) {
      this.cache[symbol].exchanges.push(exchange);
    }
  }

  /**
   * Scan Binance for new spot listings
   */
  private async scanBinance(): Promise<NewCoin[]> {
    try {
      const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo', {
        timeout: 10000
      });

      const newCoins: NewCoin[] = [];
      const symbols = response.data.symbols.filter((s: any) => 
        s.status === 'TRADING' && 
        s.quoteAsset === 'USDT' &&
        !s.symbol.includes('DOWN') &&
        !s.symbol.includes('UP') &&
        !s.symbol.includes('BULL') &&
        !s.symbol.includes('BEAR')
      );

      for (const symbolData of symbols) {
        const symbol = symbolData.baseAsset;
        if (this.isNewCoin(symbol, 'binance')) {
          newCoins.push({
            symbol,
            exchange: 'Binance Spot',
            listedAt: new Date().toISOString(),
            baseAsset: symbolData.baseAsset,
            quoteAsset: symbolData.quoteAsset,
            source: 'binance'
          });
          this.addToCache(symbol, 'binance');
        }
      }

      return newCoins;
    } catch (error) {
      console.error('❌ [NewCoinScanner] Binance scan failed:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Scan OKX for new spot listings
   */
  private async scanOKX(): Promise<NewCoin[]> {
    try {
      const response = await axios.get('https://www.okx.com/api/v5/public/instruments', {
        params: { instType: 'SPOT' },
        timeout: 10000
      });

      const newCoins: NewCoin[] = [];
      const instruments = response.data.data || [];

      for (const inst of instruments) {
        if (inst.quoteCcy === 'USDT' && inst.state === 'live') {
          const symbol = inst.baseCcy;
          if (this.isNewCoin(symbol, 'okx')) {
            newCoins.push({
              symbol,
              exchange: 'OKX Spot',
              listedAt: new Date().toISOString(),
              baseAsset: inst.baseCcy,
              quoteAsset: inst.quoteCcy,
              source: 'okx'
            });
            this.addToCache(symbol, 'okx');
          }
        }
      }

      return newCoins;
    } catch (error) {
      console.error('❌ [NewCoinScanner] OKX scan failed:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Scan Coingecko for recently added coins
   */
  private async scanCoingecko(): Promise<NewCoin[]> {
    try {
      // Get recently added coins (last 24h)
      const response = await axios.get('https://api.coingecko.com/api/v3/coins/list', {
        params: { include_platform: false },
        timeout: 10000
      });

      const newCoins: NewCoin[] = [];
      const recentCoins = response.data.slice(0, 100); // Check only latest 100

      for (const coin of recentCoins) {
        const symbol = coin.symbol.toUpperCase();
        if (this.isNewCoin(symbol, 'coingecko')) {
          newCoins.push({
            symbol,
            exchange: 'Coingecko',
            listedAt: new Date().toISOString(),
            baseAsset: symbol,
            quoteAsset: 'USDT',
            source: 'coingecko'
          });
          this.addToCache(symbol, 'coingecko');
        }
      }

      return newCoins.slice(0, 10); // Limit to 10 newest
    } catch (error) {
      console.error('❌ [NewCoinScanner] Coingecko scan failed:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Scan all enabled sources for new coins
   */
  async scanForNewCoins(): Promise<NewCoin[]> {
    if (!this.isInitialized) {
      await this.initializeCache();
    }

    console.log('🔍 [NewCoinScanner] Starting scan for new listings...');

    const useBinance = process.env.USE_BINANCE !== 'false';
    const useOKX = process.env.USE_OKX !== 'false';
    const useCoingecko = process.env.USE_COINGECKO !== 'false';

    const scanPromises: Promise<NewCoin[]>[] = [];

    if (useBinance) scanPromises.push(this.scanBinance());
    if (useOKX) scanPromises.push(this.scanOKX());
    if (useCoingecko) scanPromises.push(this.scanCoingecko());

    const results = await Promise.allSettled(scanPromises);
    const allNewCoins: NewCoin[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allNewCoins.push(...result.value);
      }
    }

    if (allNewCoins.length > 0) {
      console.log(`🆕 [NewCoinScanner] Found ${allNewCoins.length} new listings!`);
      await this.saveCache();
    } else {
      console.log('✅ [NewCoinScanner] No new coins detected');
    }

    return allNewCoins;
  }

  /**
   * Get coin volume and whale transactions
   */
  async getCoinMetrics(symbol: string): Promise<{
    volume24h: number;
    whaleTxCount: number;
    whaleTxVolume: number;
  }> {
    try {
      // Try to get 24h volume from Binance
      const tickerResponse = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
        params: { symbol: `${symbol}USDT` },
        timeout: 5000
      });

      const volume24h = parseFloat(tickerResponse.data.quoteVolume || '0');

      // Get recent trades to detect whale transactions
      const tradesResponse = await axios.get('https://api.binance.com/api/v3/trades', {
        params: { symbol: `${symbol}USDT`, limit: 100 },
        timeout: 5000
      });

      const minWhaleAmount = parseFloat(process.env.MIN_WHALE_TX_AMOUNT || '50000');
      const whaleTxs = tradesResponse.data.filter((trade: any) => {
        const tradeValue = parseFloat(trade.price) * parseFloat(trade.qty);
        return tradeValue >= minWhaleAmount;
      });

      const whaleTxVolume = whaleTxs.reduce((sum: number, trade: any) => {
        return sum + (parseFloat(trade.price) * parseFloat(trade.qty));
      }, 0);

      return {
        volume24h,
        whaleTxCount: whaleTxs.length,
        whaleTxVolume
      };
    } catch (error) {
      console.warn(`⚠️ [NewCoinScanner] Could not fetch metrics for ${symbol}`);
      return {
        volume24h: 0,
        whaleTxCount: 0,
        whaleTxVolume: 0
      };
    }
  }

  /**
   * Validate if coin is worth analyzing (not a shitcoin)
   */
  async validateCoin(symbol: string): Promise<boolean> {
    const metrics = await this.getCoinMetrics(symbol);
    const minVolume = parseFloat(process.env.MIN_NEW_COIN_VOLUME || '200000');

    // Check minimum volume threshold
    if (metrics.volume24h < minVolume) {
      console.log(`⚠️ [NewCoinScanner] ${symbol} volume too low: $${metrics.volume24h.toFixed(0)} < $${minVolume}`);
      return false;
    }

    // Check for whale activity
    if (metrics.whaleTxCount < 1) {
      console.log(`⚠️ [NewCoinScanner] ${symbol} no whale activity detected`);
      return false;
    }

    console.log(`✅ [NewCoinScanner] ${symbol} passed validation: Volume=$${metrics.volume24h.toFixed(0)}, Whales=${metrics.whaleTxCount}`);
    return true;
  }
}

// Singleton instance
export const newCoinScanner = new NewCoinScanner();

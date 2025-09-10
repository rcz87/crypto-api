import axios, { AxiosInstance } from 'axios';
import { TickerData } from '@shared/schema';
import { cache, TTL_CONFIG } from '../utils/cache';
import { metricsCollector } from '../utils/metrics';

export interface CoinAPIQuote {
  symbol_id: string;
  time_exchange: string;
  time_coinapi: string;
  ask_price?: number;
  ask_size?: number;
  bid_price?: number;
  bid_size?: number;
  last_trade?: {
    time_exchange: string;
    time_coinapi: string;
    uuid: string;
    price: number;
    size: number;
    taker_side: 'BUY' | 'SELL';
  };
}

export interface CoinAPIExchangeRate {
  time: string;
  asset_id_base: string;
  asset_id_quote: string;
  rate: number;
}

export interface CoinAPITicker {
  symbol_id: string;
  time_exchange: string;
  time_coinapi: string;
  price_last?: number;
  price_high_24h?: number;
  price_low_24h?: number;
  price_open_24h?: number;
  volume_24h?: number;
  volume_24h_usd?: number;
}

export class CoinAPIService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseURL = 'https://rest.coinapi.io/v1';
  private timeout: number;

  constructor() {
    this.apiKey = process.env.COINAPI_KEY || '';
    this.timeout = parseInt(process.env.COINAPI_TIMEOUT_MS || '8000');

    if (!this.apiKey) {
      console.warn('COINAPI_KEY not found in environment variables');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'X-CoinAPI-Key': this.apiKey,
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🪙 CoinAPI Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        // Update external API status (using generic method)
        return response;
      },
      (error) => {
        console.error('🚨 CoinAPI Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Cache helper method
  private getCacheKey(method: string, params?: any): string {
    return `coinapi:${method}:${JSON.stringify(params || {})}`;
  }

  /**
   * Get current quote for a specific symbol
   * Example: BINANCE_SPOT_SOL_USDT, COINBASE_SPOT_BTC_USD
   */
  async getQuote(symbolId: string): Promise<CoinAPIQuote> {
    const cacheKey = this.getCacheKey('quote', { symbolId });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get(`/quotes/${encodeURIComponent(symbolId)}/current`);
        return response.data;
      } catch (error) {
        console.error(`Error fetching quote for ${symbolId}:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Failed to fetch quote for ${symbolId}`);
      }
    }, TTL_CONFIG.TICKER); // Use same TTL as ticker
  }

  /**
   * Get current exchange rate between two assets
   * Example: BTC/USD, ETH/USD, SOL/USD
   */
  async getExchangeRate(assetIdBase: string, assetIdQuote: string = 'USD'): Promise<CoinAPIExchangeRate> {
    const cacheKey = this.getCacheKey('rate', { assetIdBase, assetIdQuote });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get(`/exchangerate/${assetIdBase}/${assetIdQuote}`);
        return response.data;
      } catch (error) {
        console.error(`Error fetching exchange rate for ${assetIdBase}/${assetIdQuote}:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Failed to fetch exchange rate for ${assetIdBase}/${assetIdQuote}`);
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Get ticker data for multiple exchanges for a specific asset
   * Returns aggregated view across multiple exchanges
   */
  async getMultiExchangeTicker(asset: string = 'SOL'): Promise<TickerData[]> {
    const cacheKey = this.getCacheKey('multi_ticker', { asset });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        // Define major exchanges for the asset
        const exchangeSymbols = [
          `BINANCE_SPOT_${asset}_USDT`,
          `COINBASE_SPOT_${asset}_USD`,
          `KRAKEN_SPOT_${asset}_USD`,
          `KUCOIN_SPOT_${asset}_USDT`,
        ];

        const promises = exchangeSymbols.map(async (symbolId) => {
          try {
            const quote = await this.getQuote(symbolId);
            const [exchange, type, base, quote_asset] = symbolId.split('_');
            
            // Convert to our TickerData format
            const ticker: TickerData = {
              symbol: symbolId,
              price: quote.last_trade?.price?.toString() || '0',
              change24h: '0%', // CoinAPI doesn't provide 24h change in quotes
              high24h: '0',
              low24h: '0',
              volume: '0',
              tradingVolume24h: '0',
            };
            
            return ticker;
          } catch (error) {
            console.warn(`Failed to fetch ${symbolId}, skipping:`, error instanceof Error ? error.message : 'Unknown error');
            return null;
          }
        });

        const results = await Promise.all(promises);
        return results.filter((ticker): ticker is TickerData => ticker !== null);
      } catch (error) {
        console.error(`Error fetching multi-exchange ticker for ${asset}:`, error);
        throw new Error(`Failed to fetch multi-exchange ticker for ${asset}`);
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Get best price across multiple exchanges
   */
  async getBestPrice(asset: string = 'SOL', quoteAsset: string = 'USDT'): Promise<{
    best_bid: { exchange: string; price: number; symbol: string };
    best_ask: { exchange: string; price: number; symbol: string };
    spread: number;
    spread_percentage: number;
  }> {
    const cacheKey = this.getCacheKey('best_price', { asset, quoteAsset });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const exchangeSymbols = [
          `BINANCE_SPOT_${asset}_${quoteAsset}`,
          `KUCOIN_SPOT_${asset}_${quoteAsset}`,
          `GATE_SPOT_${asset}_${quoteAsset}`,
        ];

        const quotes = await Promise.all(
          exchangeSymbols.map(async (symbolId) => {
            try {
              const quote = await this.getQuote(symbolId);
              const [exchange] = symbolId.split('_');
              return {
                exchange,
                symbol: symbolId,
                bid_price: quote.bid_price || 0,
                ask_price: quote.ask_price || 0,
              };
            } catch (error) {
              console.warn(`Failed to fetch ${symbolId} for best price`);
              return null;
            }
          })
        );

        const validQuotes = quotes.filter(q => q && q.bid_price > 0 && q.ask_price > 0);
        
        if (validQuotes.length === 0) {
          throw new Error('No valid quotes found for best price calculation');
        }

        // Find best bid (highest) and best ask (lowest)
        const bestBid = validQuotes.reduce((max, quote) => 
          quote && max && quote.bid_price > max.bid_price ? quote : max
        );
        
        const bestAsk = validQuotes.reduce((min, quote) => 
          quote && min && quote.ask_price < min.ask_price ? quote : min
        );

        if (!bestBid || !bestAsk) {
          throw new Error('Unable to determine best bid/ask prices');
        }

        const spread = bestAsk.ask_price - bestBid.bid_price;
        const spreadPercentage = (spread / bestBid.bid_price) * 100;

        return {
          best_bid: {
            exchange: bestBid.exchange,
            price: bestBid.bid_price,
            symbol: bestBid.symbol,
          },
          best_ask: {
            exchange: bestAsk.exchange,
            price: bestAsk.ask_price,
            symbol: bestAsk.symbol,
          },
          spread,
          spread_percentage: spreadPercentage,
        };
      } catch (error) {
        console.error(`Error calculating best price for ${asset}/${quoteAsset}:`, error);
        throw new Error(`Failed to calculate best price for ${asset}/${quoteAsset}`);
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Get arbitrage opportunities across exchanges
   */
  async getArbitrageOpportunities(asset: string = 'SOL'): Promise<{
    opportunities: Array<{
      buy_exchange: string;
      sell_exchange: string;
      buy_price: number;
      sell_price: number;
      profit_percentage: number;
      profit_usd: number;
    }>;
    best_opportunity: {
      buy_exchange: string;
      sell_exchange: string;
      profit_percentage: number;
    } | null;
  }> {
    const cacheKey = this.getCacheKey('arbitrage', { asset });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const tickers = await this.getMultiExchangeTicker(asset);
        const opportunities = [];

        // Compare prices across exchanges
        for (let i = 0; i < tickers.length; i++) {
          for (let j = i + 1; j < tickers.length; j++) {
            const ticker1 = tickers[i];
            const ticker2 = tickers[j];
            
            const price1 = parseFloat(ticker1.price);
            const price2 = parseFloat(ticker2.price);
            
            if (price1 > 0 && price2 > 0) {
              const [exchange1] = ticker1.symbol.split('_');
              const [exchange2] = ticker2.symbol.split('_');
              
              // Calculate arbitrage opportunity
              if (price1 > price2) {
                const profitPercentage = ((price1 - price2) / price2) * 100;
                const profitUsd = price1 - price2;
                
                opportunities.push({
                  buy_exchange: exchange2,
                  sell_exchange: exchange1,
                  buy_price: price2,
                  sell_price: price1,
                  profit_percentage: profitPercentage,
                  profit_usd: profitUsd,
                });
              } else if (price2 > price1) {
                const profitPercentage = ((price2 - price1) / price1) * 100;
                const profitUsd = price2 - price1;
                
                opportunities.push({
                  buy_exchange: exchange1,
                  sell_exchange: exchange2,
                  buy_price: price1,
                  sell_price: price2,
                  profit_percentage: profitPercentage,
                  profit_usd: profitUsd,
                });
              }
            }
          }
        }

        // Sort by profit percentage
        opportunities.sort((a, b) => b.profit_percentage - a.profit_percentage);

        const bestOpportunity = opportunities.length > 0 ? {
          buy_exchange: opportunities[0].buy_exchange,
          sell_exchange: opportunities[0].sell_exchange,
          profit_percentage: opportunities[0].profit_percentage,
        } : null;

        return {
          opportunities: opportunities.slice(0, 10), // Top 10 opportunities
          best_opportunity: bestOpportunity,
        };
      } catch (error) {
        console.error(`Error finding arbitrage opportunities for ${asset}:`, error);
        throw new Error(`Failed to find arbitrage opportunities for ${asset}`);
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Health check for CoinAPI service
   */
  async healthCheck(): Promise<{ status: 'up' | 'down'; latency_ms: number }> {
    try {
      const start = Date.now();
      await this.getExchangeRate('BTC', 'USD');
      const latency = Date.now() - start;
      
      return {
        status: 'up',
        latency_ms: latency,
      };
    } catch (error) {
      return {
        status: 'down',
        latency_ms: -1,
      };
    }
  }
}

// Export singleton instance
export const coinAPIService = new CoinAPIService();
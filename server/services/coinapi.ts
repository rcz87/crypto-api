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

export interface CoinAPIHistoricalData {
  time_period_start: string;
  time_period_end: string;
  time_open: string;
  time_close: string;
  price_open: number;
  price_high: number;
  price_low: number;
  price_close: number;
  volume_traded: number;
  trades_count: number;
}

export interface CoinAPIAsset {
  asset_id: string;
  name: string;
  type_is_crypto: number;
  data_start: string;
  data_end: string;
  data_quote_start?: string;
  data_quote_end?: string;
  data_orderbook_start?: string;
  data_orderbook_end?: string;
  data_trade_start?: string;
  data_trade_end?: string;
  data_symbols_count: number;
  volume_1hrs_usd?: number;
  volume_1day_usd?: number;
  volume_1mth_usd?: number;
  price_usd?: number;
  id_icon?: string;
}

export interface CoinAPIExchange {
  exchange_id: string;
  website: string;
  name: string;
  data_start: string;
  data_end: string;
  data_quote_start: string;
  data_quote_end: string;
  data_orderbook_start: string;
  data_orderbook_end: string;
  data_trade_start: string;
  data_trade_end: string;
  data_symbols_count: number;
  volume_1hrs_usd: number;
  volume_1day_usd: number;
  volume_1mth_usd: number;
}

export interface CoinAPIIndex {
  index_id: string;
  name: string;
  description: string;
  time_start: string;
  time_end: string;
}

export interface CoinAPIMetrics {
  symbol_id: string;
  time: string;
  sma_10: number;
  sma_20: number;
  sma_50: number;
  ema_10: number;
  ema_20: number;
  ema_50: number;
  rsi_14: number;
  macd_12_26: number;
  macd_signal_9: number;
  bb_upper_20: number;
  bb_middle_20: number;
  bb_lower_20: number;
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
   * Get historical OHLCV data for any symbol
   * Supports multiple timeframes: 1MIN, 5MIN, 15MIN, 30MIN, 1HRS, 2HRS, 4HRS, 6HRS, 8HRS, 12HRS, 1DAY, 2DAY, 3DAY, 7DAY, 1MTH
   */
  async getHistoricalData(
    symbolId: string,
    period: string = '1HRS',
    timeStart?: string,
    timeEnd?: string,
    limit: number = 100
  ): Promise<CoinAPIHistoricalData[]> {
    const cacheKey = this.getCacheKey('history', { symbolId, period, timeStart, timeEnd, limit });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        let url = `/ohlcv/${encodeURIComponent(symbolId)}/history?period_id=${period}&limit=${limit}`;
        if (timeStart) url += `&time_start=${timeStart}`;
        if (timeEnd) url += `&time_end=${timeEnd}`;
        
        const response = await this.client.get(url);
        return response.data;
      } catch (error) {
        console.error(`Error fetching historical data for ${symbolId}:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Failed to fetch historical data for ${symbolId}`);
      }
    }, TTL_CONFIG.CANDLES); // Use candles TTL for historical data
  }

  /**
   * Get all available assets with metadata
   */
  async getAssets(): Promise<CoinAPIAsset[]> {
    const cacheKey = this.getCacheKey('assets');
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get('/assets');
        return response.data;
      } catch (error) {
        console.error('Error fetching assets:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to fetch assets');
      }
    }, 3600000); // Cache for 1 hour - assets don't change often
  }

  /**
   * Get specific asset information
   */
  async getAsset(assetId: string): Promise<CoinAPIAsset> {
    const cacheKey = this.getCacheKey('asset', { assetId });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get(`/assets/${assetId}`);
        return response.data;
      } catch (error) {
        console.error(`Error fetching asset ${assetId}:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Failed to fetch asset ${assetId}`);
      }
    }, 3600000);
  }

  /**
   * Get all available exchanges with metadata
   */
  async getExchanges(): Promise<CoinAPIExchange[]> {
    const cacheKey = this.getCacheKey('exchanges');
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get('/exchanges');
        return response.data;
      } catch (error) {
        console.error('Error fetching exchanges:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to fetch exchanges');
      }
    }, 3600000); // Cache for 1 hour
  }

  /**
   * Get specific exchange information
   */
  async getExchange(exchangeId: string): Promise<CoinAPIExchange> {
    const cacheKey = this.getCacheKey('exchange', { exchangeId });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get(`/exchanges/${exchangeId}`);
        return response.data;
      } catch (error) {
        console.error(`Error fetching exchange ${exchangeId}:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Failed to fetch exchange ${exchangeId}`);
      }
    }, 3600000);
  }

  /**
   * Get market indices
   */
  async getIndices(): Promise<CoinAPIIndex[]> {
    const cacheKey = this.getCacheKey('indices');
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get('/indices');
        return response.data;
      } catch (error) {
        console.error('Error fetching indices:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to fetch indices');
      }
    }, 3600000);
  }

  /**
   * Get current index value
   */
  async getIndexValue(indexId: string): Promise<{ index_id: string; time: string; value: number }> {
    const cacheKey = this.getCacheKey('index_value', { indexId });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get(`/indices/${indexId}/current`);
        return response.data;
      } catch (error) {
        console.error(`Error fetching index value for ${indexId}:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Failed to fetch index value for ${indexId}`);
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Get technical analysis metrics
   */
  async getTechnicalMetrics(symbolId: string): Promise<CoinAPIMetrics> {
    const cacheKey = this.getCacheKey('metrics', { symbolId });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get(`/metrics/${encodeURIComponent(symbolId)}/current`);
        return response.data;
      } catch (error) {
        console.error(`Error fetching metrics for ${symbolId}:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Failed to fetch metrics for ${symbolId}`);
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Get global market overview
   */
  async getMarketOverview(): Promise<{
    total_market_cap_usd: number;
    total_volume_24h_usd: number;
    bitcoin_dominance_percentage: number;
    cryptocurrencies_number: number;
    exchanges_number: number;
    icos_number: number;
    market_cap_change_24h_percentage: number;
    volume_change_24h_percentage: number;
  }> {
    const cacheKey = this.getCacheKey('market_overview');
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const response = await this.client.get('/overview');
        return response.data;
      } catch (error) {
        console.error('Error fetching market overview:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to fetch market overview');
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Calculate TWAP (Time Weighted Average Price) from historical data
   */
  async calculateTWAP(symbolId: string, hours: number = 24): Promise<{
    twap: number;
    period_hours: number;
    data_points: number;
    time_start: string;
    time_end: string;
  }> {
    const cacheKey = this.getCacheKey('twap', { symbolId, hours });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const timeEnd = new Date().toISOString();
        const timeStart = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        
        const historicalData = await this.getHistoricalData(symbolId, '1HRS', timeStart, timeEnd);
        
        if (historicalData.length === 0) {
          throw new Error('No historical data available for TWAP calculation');
        }

        // Calculate TWAP = Sum(Price * Volume) / Sum(Volume)
        let totalValue = 0;
        let totalVolume = 0;
        
        historicalData.forEach(candle => {
          const avgPrice = (candle.price_high + candle.price_low + candle.price_close) / 3;
          totalValue += avgPrice * candle.volume_traded;
          totalVolume += candle.volume_traded;
        });

        const twap = totalVolume > 0 ? totalValue / totalVolume : 0;

        return {
          twap,
          period_hours: hours,
          data_points: historicalData.length,
          time_start: timeStart,
          time_end: timeEnd,
        };
      } catch (error) {
        console.error(`Error calculating TWAP for ${symbolId}:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Failed to calculate TWAP for ${symbolId}`);
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Calculate VWAP (Volume Weighted Average Price) from historical data
   */
  async calculateVWAP(symbolId: string, hours: number = 24): Promise<{
    vwap: number;
    period_hours: number;
    data_points: number;
    time_start: string;
    time_end: string;
  }> {
    const cacheKey = this.getCacheKey('vwap', { symbolId, hours });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const timeEnd = new Date().toISOString();
        const timeStart = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        
        const historicalData = await this.getHistoricalData(symbolId, '1HRS', timeStart, timeEnd);
        
        if (historicalData.length === 0) {
          throw new Error('No historical data available for VWAP calculation');
        }

        // Calculate VWAP = Sum(Typical Price * Volume) / Sum(Volume)
        let totalValue = 0;
        let totalVolume = 0;
        
        historicalData.forEach(candle => {
          const typicalPrice = (candle.price_high + candle.price_low + candle.price_close) / 3;
          totalValue += typicalPrice * candle.volume_traded;
          totalVolume += candle.volume_traded;
        });

        const vwap = totalVolume > 0 ? totalValue / totalVolume : 0;

        return {
          vwap,
          period_hours: hours,
          data_points: historicalData.length,
          time_start: timeStart,
          time_end: timeEnd,
        };
      } catch (error) {
        console.error(`Error calculating VWAP for ${symbolId}:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Failed to calculate VWAP for ${symbolId}`);
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Get correlation matrix for multiple assets
   */
  async getCorrelationMatrix(assets: string[], days: number = 30): Promise<{
    correlation_matrix: { [key: string]: { [key: string]: number } };
    period_days: number;
    assets: string[];
    calculation_time: string;
  }> {
    const cacheKey = this.getCacheKey('correlation', { assets: assets.sort(), days });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const timeEnd = new Date().toISOString();
        const timeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        
        // Get historical data for all assets
        const assetData: { [key: string]: number[] } = {};
        
        for (const asset of assets) {
          try {
            const data = await this.getHistoricalData(`BINANCE_SPOT_${asset}_USDT`, '1DAY', timeStart, timeEnd);
            assetData[asset] = data.map(d => d.price_close);
          } catch (error) {
            console.warn(`Failed to get data for ${asset}, skipping from correlation`);
          }
        }

        // Calculate correlation matrix
        const correlationMatrix: { [key: string]: { [key: string]: number } } = {};
        
        for (const asset1 of Object.keys(assetData)) {
          correlationMatrix[asset1] = {};
          for (const asset2 of Object.keys(assetData)) {
            if (asset1 === asset2) {
              correlationMatrix[asset1][asset2] = 1.0;
            } else {
              const correlation = this.calculateCorrelation(assetData[asset1], assetData[asset2]);
              correlationMatrix[asset1][asset2] = correlation;
            }
          }
        }

        return {
          correlation_matrix: correlationMatrix,
          period_days: days,
          assets: Object.keys(assetData),
          calculation_time: new Date().toISOString(),
        };
      } catch (error) {
        console.error(`Error calculating correlation matrix:`, error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to calculate correlation matrix');
      }
    }, TTL_CONFIG.CANDLES); // Use longer cache for correlation data
  }

  /**
   * Bulk get quotes for multiple symbols
   */
  async getBulkQuotes(symbolIds: string[]): Promise<CoinAPIQuote[]> {
    const cacheKey = this.getCacheKey('bulk_quotes', { symbols: symbolIds.sort() });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const promises = symbolIds.map(symbolId => 
          this.getQuote(symbolId).catch(error => {
            console.warn(`Failed to get quote for ${symbolId}:`, error.message);
            return null;
          })
        );
        
        const results = await Promise.all(promises);
        return results.filter((quote): quote is CoinAPIQuote => quote !== null);
      } catch (error) {
        console.error('Error fetching bulk quotes:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to fetch bulk quotes');
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Get top assets by volume
   */
  async getTopAssetsByVolume(limit: number = 50): Promise<CoinAPIAsset[]> {
    const cacheKey = this.getCacheKey('top_assets', { limit });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const assets = await this.getAssets();
        
        // Filter crypto assets and sort by 24h volume
        const cryptoAssets = assets
          .filter(asset => asset.type_is_crypto === 1 && asset.volume_1day_usd)
          .sort((a, b) => (b.volume_1day_usd || 0) - (a.volume_1day_usd || 0))
          .slice(0, limit);

        return cryptoAssets;
      } catch (error) {
        console.error('Error fetching top assets:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error('Failed to fetch top assets');
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
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
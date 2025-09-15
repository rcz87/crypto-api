import axios, { AxiosInstance } from 'axios';
import { TickerData } from '@shared/schema';
import { cache, TTL_CONFIG } from '../utils/cache';
import { metricsCollector } from '../utils/metrics';
import { OKXService } from './okx';
import { getSymbolFor, logSymbolMapping } from '@shared/symbolMapping';
import { consumeQuota, checkQuota } from '../services/rateBudget';

// Health monitoring interfaces
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  p95_latency: number;
  avg_latency: number;
  last_check: string;
  error_rate: number;
  degradation_reason?: string;
}

export interface DataQuality {
  is_valid: boolean;
  quality: 'good' | 'bad' | 'unknown';
  validation_errors: string[];
  timestamp: string;
}

export interface CachedDataWithQuality<T> {
  data: T;
  quality: DataQuality;
  timestamp: string;
  source: 'api' | 'cache' | 'fallback';
}

// Enhanced interfaces for data quality validation
export interface ValidatedTickerData extends TickerData {
  data_quality: DataQuality;
  source: 'api' | 'cache' | 'fallback';
}

export interface ValidatedQuoteData extends CoinAPIQuote {
  data_quality: DataQuality;
  source: 'api' | 'cache' | 'fallback';
}

export interface ValidatedHistoricalData {
  data: CoinAPIHistoricalData[];
  data_quality: DataQuality;
  source: 'api' | 'cache' | 'fallback';
}

// Enhanced interfaces with degradation metadata
export interface DegradationMetadata {
  degraded: boolean;
  fallback_reason?: string;
  data_source: 'coinapi' | 'okx_fallback' | 'last_good_cache' | 'degraded_coinapi';
  health_status: HealthStatus;
}

export interface EnhancedMultiExchangeResponse {
  tickers: ValidatedTickerData[];
  degradation: DegradationMetadata;
}

export interface EnhancedArbitrageResponse {
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
  degradation: DegradationMetadata;
}

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
  private okxService: OKXService;
  
  // Health monitoring properties
  private latencyHistory: number[] = [];
  private maxLatencyHistory = 100; // Rolling window size
  private currentHealthStatus: HealthStatus;
  private lastHealthCheck: number = 0;
  private healthCheckInterval = 30000; // 30 seconds
  private degradationThreshold = 700; // 700ms as specified
  private errorCount = 0;
  private requestCount = 0;
  
  // Last-good cache for critical data
  private lastGoodCache = new Map<string, CachedDataWithQuality<any>>();
  private lastGoodCacheTTL = 30000; // 30 seconds as specified
  
  // Request timing tracking (alternative to axios metadata)
  private requestTimings = new Map<string, number>();

  constructor() {
    this.apiKey = process.env.COINAPI_KEY || '';
    this.timeout = parseInt(process.env.COINAPI_TIMEOUT_MS || '8000');
    this.okxService = new OKXService();

    if (!this.apiKey) {
      console.warn('COINAPI_KEY not found in environment variables');
    }
    
    // Initialize health status
    this.currentHealthStatus = {
      status: 'healthy',
      p95_latency: 0,
      avg_latency: 0,
      last_check: new Date().toISOString(),
      error_rate: 0
    };

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'X-CoinAPI-Key': this.apiKey,
        'Accept': 'application/json',
      },
    });

    // Add request interceptor for latency tracking
    this.client.interceptors.request.use(
      (config) => {
        // Store start time using request URL as key
        const requestKey = `${config.method}-${config.url}-${Date.now()}`;
        this.requestTimings.set(requestKey, Date.now());
        // Store the key in the config for retrieval in response
        (config as any).__requestKey = requestKey;
        console.log(`🪙 CoinAPI Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.updateErrorCount();
        return Promise.reject(error);
      }
    );

    // Add response interceptor for latency and error tracking
    this.client.interceptors.response.use(
      (response) => {
        const endTime = Date.now();
        const requestKey = (response.config as any).__requestKey;
        const startTime = requestKey ? this.requestTimings.get(requestKey) || endTime : endTime;
        const latency = endTime - startTime;
        
        if (requestKey) {
          this.requestTimings.delete(requestKey);
        }
        
        this.updateLatencyHistory(latency);
        this.updateRequestCount();
        
        return response;
      },
      (error) => {
        const endTime = Date.now();
        const requestKey = (error.config as any)?.__requestKey;
        const startTime = requestKey ? this.requestTimings.get(requestKey) || endTime : endTime;
        const latency = endTime - startTime;
        
        if (requestKey) {
          this.requestTimings.delete(requestKey);
        }
        
        this.updateLatencyHistory(latency);
        this.updateErrorCount();
        
        console.error('🚨 CoinAPI Error:', error.response?.data || error.message);
        
        return Promise.reject(error);
      }
    );
  }

  // Cache helper method
  private getCacheKey(method: string, params?: any): string {
    return `coinapi:${method}:${JSON.stringify(params || {})}`;
  }
  
  // Last-good cache helper methods
  private getLastGoodCacheKey(method: string, params?: any): string {
    return `coinapi_lastgood:${method}:${JSON.stringify(params || {})}`;
  }
  
  private setLastGoodCache<T>(key: string, data: T, quality: DataQuality): void {
    const cachedItem: CachedDataWithQuality<T> = {
      data,
      quality,
      timestamp: new Date().toISOString(),
      source: 'api'
    };
    this.lastGoodCache.set(key, cachedItem);
  }
  
  private getLastGoodCache<T>(key: string): CachedDataWithQuality<T> | null {
    const cached = this.lastGoodCache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - new Date(cached.timestamp).getTime();
    if (age > this.lastGoodCacheTTL) {
      this.lastGoodCache.delete(key);
      return null;
    }
    
    return cached as CachedDataWithQuality<T>;
  }
  
  // Health monitoring methods
  private updateLatencyHistory(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }
  }
  
  private updateRequestCount(): void {
    this.requestCount++;
  }
  
  private updateErrorCount(): void {
    this.errorCount++;
    this.requestCount++;
  }
  
  private calculateP95Latency(): number {
    if (this.latencyHistory.length === 0) return 0;
    
    const sorted = [...this.latencyHistory].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index] || 0;
  }
  
  private calculateAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    
    const sum = this.latencyHistory.reduce((acc, val) => acc + val, 0);
    return sum / this.latencyHistory.length;
  }
  
  private calculateErrorRate(): number {
    if (this.requestCount === 0) return 0;
    return (this.errorCount / this.requestCount) * 100;
  }
  
  /**
   * Enhanced health check with p95 latency monitoring
   */
  async healthCheck(): Promise<HealthStatus> {
    const now = Date.now();
    
    // Only perform health check if enough time has passed
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.currentHealthStatus;
    }
    
    this.lastHealthCheck = now;
    
    const p95Latency = this.calculateP95Latency();
    const avgLatency = this.calculateAverageLatency();
    const errorRate = this.calculateErrorRate();
    
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    let degradationReason: string | undefined;
    
    // Determine health status based on metrics
    if (errorRate > 50) {
      status = 'down';
      degradationReason = `High error rate: ${errorRate.toFixed(1)}%`;
    } else if (p95Latency > this.degradationThreshold) {
      status = 'degraded';
      degradationReason = `High p95 latency: ${p95Latency}ms (threshold: ${this.degradationThreshold}ms)`;
    } else if (errorRate > 20) {
      status = 'degraded';
      degradationReason = `Elevated error rate: ${errorRate.toFixed(1)}%`;
    }
    
    this.currentHealthStatus = {
      status,
      p95_latency: p95Latency,
      avg_latency: avgLatency,
      last_check: new Date().toISOString(),
      error_rate: errorRate,
      degradation_reason: degradationReason
    };
    
    console.log(`🏥 CoinAPI Health Check: ${status} (p95: ${p95Latency}ms, avg: ${avgLatency.toFixed(1)}ms, errors: ${errorRate.toFixed(1)}%)`);
    
    return this.currentHealthStatus;
  }
  
  /**
   * Build degradation metadata from health status and source information
   */
  private async buildDegradationMetadata(
    source: 'api' | 'cache' | 'fallback',
    healthStatus?: HealthStatus
  ): Promise<DegradationMetadata> {
    const currentHealth = healthStatus || await this.healthCheck();
    
    // Determine if system is degraded
    const isDegraded = currentHealth.status !== 'healthy' || source !== 'api';
    
    // Map fallback reason based on health status and source
    let fallbackReason: string | undefined;
    let dataSource: 'coinapi' | 'okx_fallback' | 'last_good_cache' | 'degraded_coinapi';
    
    if (source === 'api') {
      if (currentHealth.status === 'healthy') {
        dataSource = 'coinapi';
      } else {
        dataSource = 'degraded_coinapi';
        fallbackReason = currentHealth.degradation_reason || 
          (currentHealth.status === 'degraded' ? 'api_degraded' : 'api_down');
      }
    } else if (source === 'fallback') {
      dataSource = 'okx_fallback';
      fallbackReason = currentHealth.degradation_reason || 'coinapi_unavailable';
    } else { // source === 'cache'
      dataSource = 'last_good_cache';
      fallbackReason = 'using_cached_data';
    }
    
    return {
      degraded: isDegraded,
      fallback_reason: isDegraded ? fallbackReason : undefined,
      data_source: dataSource,
      health_status: currentHealth
    };
  }
  
  /**
   * OKX Response Mapping Functions for Anti-Lumpuh Fallback
   */
  private mapOKXTickerToCoinAPI(okxTicker: any, symbolId: string): CoinAPIQuote {
    const now = new Date().toISOString();
    
    return {
      symbol_id: symbolId,
      time_exchange: now,
      time_coinapi: now,
      ask_price: parseFloat(okxTicker.askPx) || undefined,
      ask_size: parseFloat(okxTicker.askSz) || undefined,
      bid_price: parseFloat(okxTicker.bidPx) || undefined,
      bid_size: parseFloat(okxTicker.bidSz) || undefined,
      last_trade: {
        time_exchange: now,
        time_coinapi: now,
        uuid: `okx_${Date.now()}`,
        price: parseFloat(okxTicker.last) || 0,
        size: parseFloat(okxTicker.volCcy24h) || 0,
        taker_side: 'BUY' // Default since OKX doesn't provide this in ticker
      }
    };
  }

  private mapOKXTickerToMultiExchange(okxTicker: any, asset: string): TickerData {
    return {
      symbol: `OKX_SPOT_${asset}_USDT`,
      price: okxTicker.last || '0',
      change24h: okxTicker.changeRate ? (parseFloat(okxTicker.changeRate) * 100).toFixed(2) + '%' : '0%',
      high24h: okxTicker.high24h || '0',
      low24h: okxTicker.low24h || '0',
      volume: okxTicker.vol24h || '0',
      tradingVolume24h: okxTicker.volCcy24h || '0'
    };
  }

  private mapOKXCandlesToHistorical(okxCandles: any[], symbolId: string): CoinAPIHistoricalData[] {
    return okxCandles.map((candle: any[]) => ({
      time_period_start: new Date(parseInt(candle[0])).toISOString(),
      time_period_end: new Date(parseInt(candle[0]) + 3600000).toISOString(), // +1 hour
      time_open: new Date(parseInt(candle[0])).toISOString(),
      time_close: new Date(parseInt(candle[0]) + 3600000).toISOString(),
      price_open: parseFloat(candle[1]) || 0,
      price_high: parseFloat(candle[2]) || 0,
      price_low: parseFloat(candle[3]) || 0,
      price_close: parseFloat(candle[4]) || 0,
      volume_traded: parseFloat(candle[5]) || 0,
      trades_count: parseInt(candle[6]) || 0
    }));
  }

  private mapOKXExchangeRate(okxTicker: any, assetIdBase: string, assetIdQuote: string): CoinAPIExchangeRate {
    return {
      time: new Date().toISOString(),
      asset_id_base: assetIdBase,
      asset_id_quote: assetIdQuote,
      rate: parseFloat(okxTicker.last) || 0
    };
  }

  /**
   * Enhanced Data quality validation helper with critical checks
   */
  private validateDataQuality(data: any, dataType: string): DataQuality {
    const errors: string[] = [];
    let isValid = true;
    
    try {
      // Common validations
      if (!data) {
        errors.push('Data is null or undefined');
        isValid = false;
      }
      
      // Type-specific validations
      switch (dataType) {
        case 'quote':
          if (data.last_trade?.price && (isNaN(data.last_trade.price) || data.last_trade.price <= 0)) {
            errors.push('Invalid last trade price');
            isValid = false;
          }
          if (data.bid_price && data.ask_price && data.bid_price > data.ask_price) {
            errors.push('Bid price higher than ask price');
            isValid = false;
          }
          break;
          
        case 'ticker':
          if (data.price_last && (isNaN(data.price_last) || data.price_last <= 0)) {
            errors.push('Invalid ticker price');
            isValid = false;
          }
          if (data.volume_24h && data.volume_24h < 0) {
            errors.push('Negative 24h volume');
            isValid = false;
          }
          break;
          
        case 'historical':
          if (Array.isArray(data)) {
            data.forEach((candle, index) => {
              if (candle.price_close <= 0 || isNaN(candle.price_close)) {
                errors.push(`Invalid close price at index ${index}`);
                isValid = false;
              }
              if (candle.volume_traded < 0) {
                errors.push(`Negative volume at index ${index}`);
                isValid = false;
              }
            });
          }
          break;
          
        // PRIORITY 2: Enhanced validation for critical financial data
        case 'open_interest':
          if (data.oi && (isNaN(parseFloat(data.oi)) || parseFloat(data.oi) < 0)) {
            errors.push('Invalid or negative open interest value');
            isValid = false;
          }
          if (data.oiUsd && (isNaN(parseFloat(data.oiUsd)) || parseFloat(data.oiUsd) < 0)) {
            errors.push('Invalid or negative open interest USD value');
            isValid = false;
          }
          break;
          
        case 'funding_rate':
          if (data.fundingRate && (isNaN(parseFloat(data.fundingRate)) || Math.abs(parseFloat(data.fundingRate)) > 1)) {
            errors.push('Invalid funding rate: NaN or unrealistic value (>100%)');
            isValid = false;
          }
          if (data.nextFundingRate && (isNaN(parseFloat(data.nextFundingRate)) || Math.abs(parseFloat(data.nextFundingRate)) > 1)) {
            errors.push('Invalid next funding rate: NaN or unrealistic value');
            isValid = false;
          }
          if (data.premium && isNaN(parseFloat(data.premium))) {
            errors.push('Invalid premium: NaN value');
            isValid = false;
          }
          break;
          
        case 'enhanced_orderbook':
          // Validate spread calculations
          if (data.spread && (isNaN(parseFloat(data.spread)) || parseFloat(data.spread) < 0)) {
            errors.push('Invalid spread: negative or NaN');
            isValid = false;
          }
          // Check for bid > ask violations
          if (data.asks?.[0] && data.bids?.[0]) {
            const bestAsk = parseFloat(data.asks[0].price);
            const bestBid = parseFloat(data.bids[0].price);
            if (bestBid > bestAsk) {
              errors.push('Critical: Bid price higher than ask price - market data corrupted');
              isValid = false;
            }
          }
          // Validate order book structure
          if (!data.asks?.length || !data.bids?.length) {
            errors.push('Empty order book: no asks or bids available');
            isValid = false;
          }
          break;
          
        case 'multi_ticker':
          if (Array.isArray(data)) {
            data.forEach((ticker, index) => {
              if (!ticker.symbol || !ticker.price) {
                errors.push(`Ticker at index ${index} missing symbol or price`);
                isValid = false;
              }
              if (ticker.price && (isNaN(parseFloat(ticker.price)) || parseFloat(ticker.price) <= 0)) {
                errors.push(`Invalid price for ticker ${ticker.symbol || index}`);
                isValid = false;
              }
            });
          }
          break;
      }
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isValid = false;
    }
    
    return {
      is_valid: isValid,
      quality: isValid ? 'good' : 'bad',
      validation_errors: errors,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * PRIORITY 1: Enhanced Safe CoinAPI wrapper with true OKX secondary fallback
   * Implements fallback sequence: CoinAPI → OKX → Last-Good Cache
   */
  private async safeCoinAPI<T>(
    fn: () => Promise<T>,
    okxFallbackFn?: () => Promise<T>,
    cacheKey?: string,
    dataType: string = 'generic'
  ): Promise<CachedDataWithQuality<T>> {
    const healthStatus = await this.healthCheck();
    
    // Try main CoinAPI function if healthy or degraded
    if (healthStatus.status === 'healthy' || healthStatus.status === 'degraded') {
      try {
        const data = await fn();
        const quality = this.validateDataQuality(data, dataType);
        
        // Cache good data for fallback
        if (cacheKey && quality.is_valid) {
          this.setLastGoodCache(cacheKey, data, quality);
        }
        
        console.log(`✅ CoinAPI success: ${dataType} data retrieved (${quality.quality})`);
        return {
          data,
          quality,
          timestamp: new Date().toISOString(),
          source: 'api'
        };
      } catch (error) {
        console.warn(`🚨 CoinAPI main function failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // PRIORITY 1: Try OKX as true secondary provider
    if (okxFallbackFn) {
      try {
        console.log('🔄 Attempting OKX secondary fallback...');
        const data = await okxFallbackFn();
        const quality = this.validateDataQuality(data, dataType);
        
        // Cache OKX data as good fallback if valid
        if (cacheKey && quality.is_valid) {
          this.setLastGoodCache(cacheKey, data, quality);
        }
        
        console.log(`✅ OKX fallback success: ${dataType} data retrieved (${quality.quality})`);
        return {
          data,
          quality,
          timestamp: new Date().toISOString(),
          source: 'fallback'
        };
      } catch (error) {
        console.warn(`🚨 OKX fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Try last-good cache
    if (cacheKey) {
      const cached = this.getLastGoodCache<T>(cacheKey);
      if (cached) {
        console.log('📦 Using last-good CoinAPI cache data');
        return {
          ...cached,
          source: 'cache'
        };
      }
    }
    
    // Last resort: throw error
    throw new Error('All CoinAPI fallback mechanisms exhausted');
  }
  
  /**
   * Public method to get current health status (for external monitoring)
   */
  async getHealthStatus(): Promise<HealthStatus> {
    return await this.healthCheck();
  }
  
  /**
   * Force a health status refresh
   */
  async forceHealthCheck(): Promise<HealthStatus> {
    this.lastHealthCheck = 0; // Reset to force new check
    return await this.healthCheck();
  }
  
  /**
   * Get health metrics summary
   */
  getHealthMetrics(): {
    latency_history_size: number;
    current_p95: number;
    current_avg: number;
    current_error_rate: number;
    total_requests: number;
    total_errors: number;
    cache_size: number;
  } {
    return {
      latency_history_size: this.latencyHistory.length,
      current_p95: this.calculateP95Latency(),
      current_avg: this.calculateAverageLatency(),
      current_error_rate: this.calculateErrorRate(),
      total_requests: this.requestCount,
      total_errors: this.errorCount,
      cache_size: this.lastGoodCache.size
    };
  }

  /**
   * Get current quote for a specific symbol (Enhanced with OKX fallback)
   * Example: BINANCE_SPOT_SOL_USDT, COINBASE_SPOT_BTC_USD
   */
  async getQuote(symbolId: string): Promise<ValidatedQuoteData> {
    const cacheKey = this.getCacheKey('quote', { symbolId });
    const lastGoodKey = this.getLastGoodCacheKey('quote', { symbolId });
    
    return cache.getSingleFlight(cacheKey, async () => {
      const result = await this.safeCoinAPI<CoinAPIQuote>(
        // Main CoinAPI function
        async () => {
          const response = await this.client.get(`/quotes/${encodeURIComponent(symbolId)}/current`);
          return response.data;
        },
        // PRIORITY 1: OKX secondary fallback
        async () => {
          console.log(`🔄 Using OKX fallback for quote: ${symbolId}`);
          // Convert symbolId to OKX format (e.g., BINANCE_SPOT_SOL_USDT -> SOL-USDT-SWAP)
          const okxSymbol = this.convertSymbolToOKX(symbolId);
          const okxTicker = await this.okxService.getTicker(okxSymbol);
          
          // Map OKX ticker response to CoinAPI quote format
          return this.mapOKXTickerToCoinAPI(okxTicker, symbolId);
        },
        lastGoodKey,
        'quote'
      );
      
      return {
        ...result.data,
        data_quality: result.quality,
        source: result.source
      };
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Helper function to convert CoinAPI symbol format to OKX format
   */
  private convertSymbolToOKX(symbolId: string): string {
    // Extract asset from various symbol formats
    // BINANCE_SPOT_SOL_USDT -> SOL-USDT-SWAP
    // COINBASE_SPOT_BTC_USD -> BTC-USDT-SWAP
    const parts = symbolId.split('_');
    if (parts.length >= 4) {
      const asset = parts[2]; // SOL, BTC, etc.
      const quote = parts[3] === 'USD' ? 'USDT' : parts[3]; // Convert USD to USDT for OKX
      return `${asset}-${quote}-SWAP`;
    }
    
    // Fallback: assume it's already in correct format or default to SOL-USDT-SWAP
    return symbolId.includes('-') ? symbolId : 'SOL-USDT-SWAP';
  }

  /**
   * Helper function to convert CoinAPI period format to OKX timeframe format
   */
  private convertPeriodToOKX(period: string): string {
    // CoinAPI periods -> OKX timeframes mapping
    const periodMap: { [key: string]: string } = {
      '1MIN': '1m',
      '5MIN': '5m', 
      '15MIN': '15m',
      '30MIN': '30m',
      '1HRS': '1H',
      '2HRS': '2H',
      '4HRS': '4H',
      '6HRS': '6H',
      '8HRS': '8H',
      '12HRS': '12H',
      '1DAY': '1D',
      '2DAY': '2D',
      '3DAY': '3D',
      '7DAY': '1W',
      '1MTH': '1M'
    };
    
    return periodMap[period] || '1H'; // Default to 1H if period not found
  }

  /**
   * Get current exchange rate between two assets (Enhanced with OKX fallback)
   * Example: BTC/USD, ETH/USD, SOL/USD
   */
  async getExchangeRate(assetIdBase: string, assetIdQuote: string = 'USD'): Promise<CoinAPIExchangeRate & { data_quality: DataQuality; source: string }> {
    const cacheKey = this.getCacheKey('rate', { assetIdBase, assetIdQuote });
    const lastGoodKey = this.getLastGoodCacheKey('rate', { assetIdBase, assetIdQuote });
    
    return cache.getSingleFlight(cacheKey, async () => {
      const result = await this.safeCoinAPI<CoinAPIExchangeRate>(
        // Main CoinAPI function
        async () => {
          const response = await this.client.get(`/exchangerate/${assetIdBase}/${assetIdQuote}`);
          return response.data;
        },
        // PRIORITY 1: OKX secondary fallback
        async () => {
          console.log(`🔄 Using OKX fallback for exchange rate: ${assetIdBase}/${assetIdQuote}`);
          // Use OKX ticker to get exchange rate
          const okxSymbol = `${assetIdBase}-${assetIdQuote === 'USD' ? 'USDT' : assetIdQuote}-SWAP`;
          const okxTicker = await this.okxService.getTicker(okxSymbol);
          
          // Map OKX ticker to exchange rate format
          return this.mapOKXExchangeRate(okxTicker, assetIdBase, assetIdQuote);
        },
        lastGoodKey,
        'rate'
      );
      
      return {
        ...result.data,
        data_quality: result.quality,
        source: result.source
      };
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Get ticker data for multiple exchanges for a specific asset (Enhanced with fallback mechanisms)
   * Returns aggregated view across multiple exchanges with degradation metadata
   */
  async getMultiExchangeTicker(asset: string = 'SOL'): Promise<EnhancedMultiExchangeResponse> {
    const cacheKey = this.getCacheKey('multi_ticker', { asset });
    const lastGoodKey = this.getLastGoodCacheKey('multi_ticker', { asset });
    
    return cache.getSingleFlight(cacheKey, async () => {
      const result = await this.safeCoinAPI<TickerData[]>(
        // Main function
        async () => {
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
        },
        // PRIORITY 1: OKX secondary fallback for multi-exchange data
        async () => {
          console.log(`🔄 Using OKX fallback for multi-exchange ticker: ${asset}`);
          try {
            // Get OKX ticker data for the asset
            const okxSymbol = `${asset}-USDT-SWAP`;
            const okxTicker = await this.okxService.getTicker(okxSymbol);
            
            // Map OKX ticker to multi-exchange format
            const okxTickerData = this.mapOKXTickerToMultiExchange(okxTicker, asset);
            
            // Return as array to match expected format
            return [okxTickerData];
          } catch (error) {
            console.warn(`🚨 OKX fallback failed for ${asset}:`, error instanceof Error ? error.message : 'Unknown error');
            
            // Ultimate fallback: return empty array
            return [];
          }
        },
        lastGoodKey,
        'ticker'
      );
      
      // Build degradation metadata
      const degradation = await this.buildDegradationMetadata(result.source);
      
      // Return enhanced response with validated ticker data and degradation metadata
      const validatedTickers: ValidatedTickerData[] = result.data.map(ticker => ({
        ...ticker,
        data_quality: result.quality,
        source: result.source
      }));
      
      return {
        tickers: validatedTickers,
        degradation
      };
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
   * Get arbitrage opportunities across exchanges with degradation metadata
   */
  async getArbitrageOpportunities(asset: string = 'SOL'): Promise<EnhancedArbitrageResponse> {
    const cacheKey = this.getCacheKey('arbitrage', { asset });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        const multiExchangeResponse = await this.getMultiExchangeTicker(asset);
        const tickers = multiExchangeResponse.tickers;
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
          degradation: multiExchangeResponse.degradation // Pass through degradation metadata
        };
      } catch (error) {
        console.error(`Error finding arbitrage opportunities for ${asset}:`, error);
        throw new Error(`Failed to find arbitrage opportunities for ${asset}`);
      }
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Get historical OHLCV data for any symbol (Enhanced with fallback mechanisms)
   * Supports multiple timeframes: 1MIN, 5MIN, 15MIN, 30MIN, 1HRS, 2HRS, 4HRS, 6HRS, 8HRS, 12HRS, 1DAY, 2DAY, 3DAY, 7DAY, 1MTH
   */
  async getHistoricalData(
    symbolId: string,
    period: string = '1HRS',
    timeStart?: string,
    timeEnd?: string,
    limit: number = 100
  ): Promise<ValidatedHistoricalData> {
    const cacheKey = this.getCacheKey('history', { symbolId, period, timeStart, timeEnd, limit });
    const lastGoodKey = this.getLastGoodCacheKey('history', { symbolId, period, timeStart, timeEnd, limit });
    
    return cache.getSingleFlight(cacheKey, async () => {
      const result = await this.safeCoinAPI<CoinAPIHistoricalData[]>(
        // Main function
        async () => {
          let url = `/ohlcv/${encodeURIComponent(symbolId)}/history?period_id=${period}&limit=${limit}`;
          if (timeStart) url += `&time_start=${timeStart}`;
          if (timeEnd) url += `&time_end=${timeEnd}`;
          
          const response = await this.client.get(url);
          return response.data;
        },
        // PRIORITY 1: OKX secondary fallback for historical data
        async () => {
          console.log(`🔄 Using OKX fallback for historical data: ${symbolId} (${period})`);
          try {
            // Convert symbolId to OKX format and map period
            const okxSymbol = this.convertSymbolToOKX(symbolId);
            const okxPeriod = this.convertPeriodToOKX(period);
            
            // Get historical data from OKX
            const okxCandles = await this.okxService.getCandles(okxSymbol, okxPeriod, limit);
            
            // Map OKX candles to CoinAPI historical format
            return this.mapOKXCandlesToHistorical(okxCandles, symbolId);
          } catch (error) {
            console.warn(`🚨 OKX historical fallback failed:`, error instanceof Error ? error.message : 'Unknown error');
            throw new Error('OKX historical fallback exhausted');
          }
        },
        lastGoodKey,
        'historical'
      );
      
      return {
        data: result.data,
        data_quality: result.quality,
        source: result.source
      };
    }, TTL_CONFIG.CANDLES);
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
        
        if (historicalData.data.length === 0) {
          throw new Error('No historical data available for TWAP calculation');
        }

        // Calculate TWAP = Sum(Price * Volume) / Sum(Volume)
        let totalValue = 0;
        let totalVolume = 0;
        
        historicalData.data.forEach((candle: CoinAPIHistoricalData) => {
          const avgPrice = (candle.price_high + candle.price_low + candle.price_close) / 3;
          totalValue += avgPrice * candle.volume_traded;
          totalVolume += candle.volume_traded;
        });

        const twap = totalVolume > 0 ? totalValue / totalVolume : 0;

        return {
          twap,
          period_hours: hours,
          data_points: historicalData.data.length,
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
        
        if (historicalData.data.length === 0) {
          throw new Error('No historical data available for VWAP calculation');
        }

        // Calculate VWAP = Sum(Typical Price * Volume) / Sum(Volume)
        let totalValue = 0;
        let totalVolume = 0;
        
        historicalData.data.forEach((candle: CoinAPIHistoricalData) => {
          const typicalPrice = (candle.price_high + candle.price_low + candle.price_close) / 3;
          totalValue += typicalPrice * candle.volume_traded;
          totalVolume += candle.volume_traded;
        });

        const vwap = totalVolume > 0 ? totalValue / totalVolume : 0;

        return {
          vwap,
          period_hours: hours,
          data_points: historicalData.data.length,
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
            assetData[asset] = data.data.map((d: CoinAPIHistoricalData) => d.price_close);
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
  async getBulkQuotes(symbolIds: string[]): Promise<ValidatedQuoteData[]> {
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
        return results.filter((quote): quote is ValidatedQuoteData => quote !== null);
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
   * Simple health check for external monitoring
   */
  async simpleHealthCheck(): Promise<{ status: 'up' | 'down'; latency_ms: number }> {
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
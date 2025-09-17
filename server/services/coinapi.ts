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
  
  // Circuit breaker for per-symbol failure tracking
  private symbolFailures = new Map<string, { count: number; lastFailure: number; disabled: boolean }>();
  private circuitBreakerThreshold = 3; // Fail 3 times before circuit opens
  private circuitBreakerResetTime = 300000; // 5 minutes before retry
  private circuitBreakerCooldownTime = 60000; // 1 minute cool-down after each failure

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
        
        // Track circuit breaker failures for symbol-specific errors
        this.trackCircuitBreakerError(error);
        
        console.error('🚨 CoinAPI Error:', error.response?.data || error.message);
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Circuit breaker: Track failures per symbol and disable problematic symbols
   */
  private trackCircuitBreakerError(error: any): void {
    const url = error.config?.url || '';
    
    // Extract symbol from URL for tracking
    const symbolMatch = url.match(/\/ohlcv\/([^/]+)\/history|quotes\/([^?]+)|exchangerate\/([^/]+)/);
    if (!symbolMatch) return;
    
    const symbol = symbolMatch[1] || symbolMatch[2] || symbolMatch[3];
    if (!symbol) return;
    
    // Only track 400-level errors that indicate invalid symbols
    if (error.response?.status >= 400 && error.response?.status < 500) {
      this.recordSymbolFailure(decodeURIComponent(symbol));
    }
  }
  
  /**
   * Record a failure for a specific symbol
   */
  private recordSymbolFailure(symbol: string): void {
    const now = Date.now();
    const existing = this.symbolFailures.get(symbol);
    
    if (existing) {
      existing.count++;
      existing.lastFailure = now;
      
      // Open circuit if threshold exceeded
      if (existing.count >= this.circuitBreakerThreshold) {
        existing.disabled = true;
        console.warn(`🚫 [CoinAPI] Circuit breaker OPENED for symbol ${symbol} (${existing.count} failures)`);
      }
    } else {
      this.symbolFailures.set(symbol, {
        count: 1,
        lastFailure: now,
        disabled: false
      });
    }
  }
  
  /**
   * Check if a symbol should be skipped due to circuit breaker
   */
  private shouldSkipSymbolDueToCircuitBreaker(symbol: string): boolean {
    const failure = this.symbolFailures.get(symbol);
    if (!failure || !failure.disabled) return false;
    
    const now = Date.now();
    const timeSinceLastFailure = now - failure.lastFailure;
    
    // Reset circuit breaker after reset time
    if (timeSinceLastFailure > this.circuitBreakerResetTime) {
      console.log(`🔄 [CoinAPI] Circuit breaker RESET for symbol ${symbol} after ${Math.round(timeSinceLastFailure / 1000)}s`);
      failure.disabled = false;
      failure.count = 0;
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if we're in cooldown period for a symbol
   */
  private isSymbolInCooldown(symbol: string): boolean {
    const failure = this.symbolFailures.get(symbol);
    if (!failure) return false;
    
    const now = Date.now();
    const timeSinceLastFailure = now - failure.lastFailure;
    
    return timeSinceLastFailure < this.circuitBreakerCooldownTime;
  }

  // Cache helper method
  private getCacheKey(method: string, params?: any): string {
    return `coinapi:${method}:${JSON.stringify(params || {})}`;
  }
  
  /**
   * Check if an error is retryable (temporary network/server issues)
   */
  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }
    if (error.response?.status >= 500) {
      return true;
    }
    if (error.message?.includes('timeout')) {
      return true;
    }
    return false;
  }
  
  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Check if we should use segmented fetching for large date ranges
   */
  private shouldUseSegmentedFetch(timeStart?: string, timeEnd?: string, limit?: number): boolean {
    if (!timeStart || !timeEnd) return false;
    
    const start = new Date(timeStart);
    const end = new Date(timeEnd);
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    // Use segmented fetch for requests spanning more than 48 hours
    return diffHours > 48 || Boolean(limit && limit > 100);
  }
  
  /**
   * Get historical data using segmented fetching for large date ranges
   */
  private async getHistoricalDataSegmented(
    symbolId: string,
    period: string,
    timeStart: string,
    timeEnd: string,
    limit: number
  ): Promise<ValidatedHistoricalData> {
    const start = new Date(timeStart);
    const end = new Date(timeEnd);
    const segments: CoinAPIHistoricalData[] = [];
    
    // Split into 24-hour chunks
    const chunkHours = 24;
    let currentStart = start;
    
    while (currentStart < end) {
      const chunkEnd = new Date(Math.min(
        currentStart.getTime() + (chunkHours * 60 * 60 * 1000),
        end.getTime()
      ));
      
      try {
        console.log(`📊 [CoinAPI] Fetching segment: ${currentStart.toISOString()} to ${chunkEnd.toISOString()}`);
        
        const segmentData = await this.getHistoricalData(
          symbolId,
          period,
          currentStart.toISOString(),
          chunkEnd.toISOString(),
          50 // Smaller limit per segment
        );
        
        if (segmentData.data && Array.isArray(segmentData.data)) {
          segments.push(...segmentData.data);
        }
        
        // Small delay between segments to avoid rate limiting
        await this.sleep(100);
        
      } catch (error) {
        console.warn(`⚠️ [CoinAPI] Segment failed: ${currentStart.toISOString()} to ${chunkEnd.toISOString()}`, error instanceof Error ? error.message : 'Unknown error');
      }
      
      currentStart = chunkEnd;
    }
    
    // Sort by timestamp and remove duplicates
    const uniqueSegments = segments
      .sort((a, b) => new Date(a.time_open).getTime() - new Date(b.time_open).getTime())
      .filter((item, index, arr) => 
        index === 0 || item.time_open !== arr[index - 1].time_open
      );
    
    console.log(`✅ [CoinAPI] Segmented fetch completed: ${uniqueSegments.length} candles total`);
    
    return {
      data: uniqueSegments.slice(0, limit), // Respect original limit
      data_quality: {
        is_valid: true,
        quality: 'good',
        validation_errors: [],
        timestamp: new Date().toISOString()
      },
      source: 'api'
    };
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

  /**
   * Robust timestamp parsing utility that handles multiple formats
   * @param timestamp - Can be string, number, or already a Date object
   * @returns Valid Date object or null if parsing fails
   */
  private parseTimestampSafely(timestamp: any): Date | null {
    if (!timestamp) return null;
    
    let date: Date;
    
    try {
      // Handle different timestamp formats from OKX
      if (typeof timestamp === 'string') {
        // Try as milliseconds first
        const ms = parseInt(timestamp, 10);
        if (!isNaN(ms)) {
          date = new Date(ms);
        } else {
          // Try as ISO string
          date = new Date(timestamp);
        }
      } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        console.warn(`🚨 [CoinAPI] Unknown timestamp format:`, typeof timestamp, timestamp);
        return null;
      }
      
      // Validate that the Date is valid
      if (isNaN(date.getTime())) {
        console.warn(`🚨 [CoinAPI] Invalid timestamp result:`, timestamp, '->', date);
        return null;
      }
      
      return date;
    } catch (error) {
      console.error(`🚨 [CoinAPI] Timestamp parsing error for ${timestamp}:`, error);
      return null;
    }
  }

  /**
   * Calculate period duration in milliseconds based on CoinAPI period format
   */
  private getPeriodDurationMs(period: string): number {
    const periodMap: { [key: string]: number } = {
      '1MIN': 60000,        // 1 minute
      '5MIN': 300000,       // 5 minutes
      '15MIN': 900000,      // 15 minutes
      '30MIN': 1800000,     // 30 minutes
      '1HRS': 3600000,      // 1 hour
      '2HRS': 7200000,      // 2 hours
      '4HRS': 14400000,     // 4 hours
      '6HRS': 21600000,     // 6 hours
      '8HRS': 28800000,     // 8 hours
      '12HRS': 43200000,    // 12 hours
      '1DAY': 86400000,     // 1 day
      '2DAY': 172800000,    // 2 days
      '3DAY': 259200000,    // 3 days
      '7DAY': 604800000,    // 7 days
      '1MTH': 2592000000    // 30 days (approximate)
    };
    
    return periodMap[period] || 3600000; // Default to 1 hour
  }

  private mapOKXCandlesToHistorical(okxCandles: any[], symbolId: string, period: string = '1HRS'): CoinAPIHistoricalData[] {
    if (!Array.isArray(okxCandles) || okxCandles.length === 0) {
      console.warn(`🚨 [CoinAPI] Empty or invalid OKX candles data for ${symbolId}`);
      return [];
    }

    const periodDurationMs = this.getPeriodDurationMs(period);
    const validCandles: CoinAPIHistoricalData[] = [];
    
    for (let i = 0; i < okxCandles.length; i++) {
      const candle = okxCandles[i];
      
      // Handle both array format [timestamp, open, high, low, close, volume] 
      // and object format {timestamp, open, high, low, close, volume}
      let timestamp, priceOpen, priceHigh, priceLow, priceClose, volumeTraded, tradesCount;
      
      if (Array.isArray(candle) && candle.length >= 6) {
        // OKX standard array format
        [timestamp, priceOpen, priceHigh, priceLow, priceClose, volumeTraded, tradesCount] = candle;
      } else if (candle && typeof candle === 'object') {
        // OKX object format (fallback or alternative format)
        timestamp = candle.timestamp || candle.ts || candle[0];
        priceOpen = candle.open || candle.o || candle[1];
        priceHigh = candle.high || candle.h || candle[2];
        priceLow = candle.low || candle.l || candle[3];
        priceClose = candle.close || candle.c || candle[4];
        volumeTraded = candle.volume || candle.vol || candle.v || candle[5];
        tradesCount = candle.trades || candle.count || candle[6] || 0;
      } else {
        console.warn(`🚨 [CoinAPI] Unsupported candle format at index ${i} for ${symbolId}:`, typeof candle, candle);
        continue;
      }
      
      const openTime = this.parseTimestampSafely(timestamp);
      if (!openTime) {
        console.warn(`🚨 [CoinAPI] Failed to parse timestamp for candle ${i}:`, timestamp);
        continue;
      }
      
      const closeTime = new Date(openTime.getTime() + periodDurationMs);
      const openTimeIso = openTime.toISOString();
      const closeTimeIso = closeTime.toISOString();
      
      // Parse and validate numeric values
      const numOpen = parseFloat(String(priceOpen));
      const numHigh = parseFloat(String(priceHigh));
      const numLow = parseFloat(String(priceLow));
      const numClose = parseFloat(String(priceClose));
      const numVolume = parseFloat(String(volumeTraded)) || 0;
      const numTrades = parseInt(String(tradesCount), 10) || 0;
      
      if (isNaN(numOpen) || isNaN(numHigh) || isNaN(numLow) || isNaN(numClose)) {
        console.warn(`🚨 [CoinAPI] Invalid price data for candle ${i}:`, {
          open: priceOpen, high: priceHigh, low: priceLow, close: priceClose
        });
        continue;
      }
      
      // Validate price relationships (basic sanity check)
      if (numHigh < numLow || numOpen < 0 || numClose < 0) {
        console.warn(`🚨 [CoinAPI] Illogical price relationships for candle ${i}:`, {
          open: numOpen, high: numHigh, low: numLow, close: numClose
        });
        continue;
      }
      
      validCandles.push({
        time_period_start: openTimeIso,
        time_period_end: closeTimeIso,
        time_open: openTimeIso,
        time_close: closeTimeIso,
        price_open: numOpen,
        price_high: numHigh,
        price_low: numLow,
        price_close: numClose,
        volume_traded: numVolume,
        trades_count: numTrades
      });
    }
    
    console.log(`✅ [CoinAPI] Mapped ${validCandles.length}/${okxCandles.length} valid candles for ${symbolId} (${period})`);
    return validCandles;
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
   * Now includes timestamp and date validation for historical data
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
      
      // Additional null/undefined checks
      if (data === null || data === undefined) {
        errors.push('Data is explicitly null or undefined');
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
            if (data.length === 0) {
              errors.push('Empty historical data array');
              isValid = false;
            }
            
            data.forEach((candle, index) => {
              // Validate required fields exist
              if (!candle || typeof candle !== 'object') {
                errors.push(`Invalid candle data at index ${index}`);
                isValid = false;
                return;
              }
              
              // Validate timestamp fields for date parsing issues
              const timeFields = ['time_period_start', 'time_period_end', 'time_open', 'time_close'];
              timeFields.forEach(field => {
                if (candle[field]) {
                  const date = new Date(candle[field]);
                  if (isNaN(date.getTime())) {
                    errors.push(`Invalid timestamp ${field} at index ${index}: ${candle[field]}`);
                    isValid = false;
                  }
                }
              });
              
              // Validate price data
              if (candle.price_close <= 0 || isNaN(candle.price_close)) {
                errors.push(`Invalid close price at index ${index}: ${candle.price_close}`);
                isValid = false;
              }
              if (candle.price_open <= 0 || isNaN(candle.price_open)) {
                errors.push(`Invalid open price at index ${index}: ${candle.price_open}`);
                isValid = false;
              }
              if (candle.price_high < candle.price_low) {
                errors.push(`High price lower than low price at index ${index}`);
                isValid = false;
              }
              
              // Validate volume data
              if (candle.volume_traded < 0) {
                errors.push(`Negative volume at index ${index}: ${candle.volume_traded}`);
                isValid = false;
              }
            });
          } else {
            errors.push('Historical data is not an array');
            isValid = false;
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
    dataType: string = 'generic',
    symbolForCircuitBreaker?: string
  ): Promise<CachedDataWithQuality<T>> {
    // Circuit breaker: Skip CoinAPI if symbol is problematic
    let skipCoinAPI = false;
    if (symbolForCircuitBreaker) {
      if (this.shouldSkipSymbolDueToCircuitBreaker(symbolForCircuitBreaker)) {
        console.log(`🚫 [CoinAPI] Circuit breaker ACTIVE for ${symbolForCircuitBreaker}, skipping to OKX fallback`);
        skipCoinAPI = true;
      } else if (this.isSymbolInCooldown(symbolForCircuitBreaker)) {
        console.log(`⏳ [CoinAPI] Symbol ${symbolForCircuitBreaker} in cooldown, skipping to OKX fallback`);
        skipCoinAPI = true;
      }
    }

    if (!skipCoinAPI) {
      const healthStatus = await this.healthCheck();
      
      // Try main CoinAPI function with retry mechanism (max 3 attempts)
      if (healthStatus.status === 'healthy' || healthStatus.status === 'degraded') {
        const maxRetries = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🔄 [CoinAPI] Attempt ${attempt}/${maxRetries} for ${symbolForCircuitBreaker || 'unknown'} (${dataType})`);
            
            const data = await fn();
            const quality = this.validateDataQuality(data, dataType);
            
            if (quality.is_valid) {
              // Cache good data for fallback
              if (cacheKey) {
                this.setLastGoodCache(cacheKey, data, quality);
              }
              
              console.log(`✅ [CoinAPI] Success on attempt ${attempt}/${maxRetries} for ${symbolForCircuitBreaker || 'unknown'}`);
              return {
                data,
                quality,
                timestamp: new Date().toISOString(),
                source: 'api'
              };
            } else {
              console.warn(`🚨 [CoinAPI] Data quality validation failed on attempt ${attempt} for ${dataType}:`, quality.validation_errors);
              lastError = new Error(`Data quality validation failed: ${quality.validation_errors.join(', ')}`);
              // Don't retry on data quality issues - these are usually permanent
              break;
            }
            
          } catch (error: any) {
            lastError = error;
            console.error(`🚨 CoinAPI Error (attempt ${attempt}/${maxRetries}):`, error.response?.data || error.message);
            
            // If the error suggests an invalid symbol, don't retry
            if (error.response?.status === 400) {
              if (symbolForCircuitBreaker) {
                this.recordSymbolFailure(symbolForCircuitBreaker);
              }
              break;
            }
            
            // For temporary errors (500, timeout, network), add exponential backoff
            if (attempt < maxRetries && this.isRetryableError(error)) {
              const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 second backoff
              console.log(`⏳ [CoinAPI] Retrying in ${backoffMs}ms after error: ${error.message}`);
              await this.sleep(backoffMs);
              continue;
            }
          }
        }
        
        console.warn(`🚨 CoinAPI main function failed after ${maxRetries} attempts:`, lastError?.message);
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
        'quote',
        symbolId
      );
      
      return {
        ...result.data,
        data_quality: result.quality,
        source: result.source
      };
    }, TTL_CONFIG.TICKER);
  }

  /**
   * Enhanced symbol mapping: Convert CoinAPI symbol formats to OKX format
   * Handles multiple CoinAPI naming conventions robustly
   */
  private convertSymbolToOKX(symbolId: string): string {
    if (!symbolId || typeof symbolId !== 'string') {
      console.warn(`🚨 [CoinAPI] Invalid symbol ID:`, symbolId);
      return 'SOL-USDT-SWAP'; // Safe default
    }

    try {
      // Already in OKX format (e.g., SOL-USDT-SWAP)
      if (symbolId.match(/^[A-Z]+-[A-Z]+-SWAP$/)) {
        return symbolId;
      }
      
      // CoinAPI exchange-specific formats:
      // BINANCE_SPOT_SOL_USDT, COINBASE_SPOT_BTC_USD, etc.
      const exchangeParts = symbolId.split('_');
      if (exchangeParts.length >= 4) {
        const [exchange, type, base, quote] = exchangeParts;
        
        // Validate parts
        if (!base || !quote) {
          console.warn(`🚨 [CoinAPI] Invalid symbol parts for ${symbolId}:`, exchangeParts);
          return 'SOL-USDT-SWAP';
        }
        
        // Normalize quote currency (USD -> USDT for OKX)
        const normalizedQuote = quote === 'USD' ? 'USDT' : quote;
        return `${base}-${normalizedQuote}-SWAP`;
      }
      
      // Simple pair format: SOL/USDT, BTC/USD, etc.
      if (symbolId.includes('/')) {
        const [base, quote] = symbolId.split('/');
        if (base && quote) {
          const normalizedQuote = quote === 'USD' ? 'USDT' : quote;
          return `${base}-${normalizedQuote}-SWAP`;
        }
      }
      
      // Dash-separated format: SOL-USDT, BTC-USD, etc.
      if (symbolId.includes('-') && !symbolId.includes('SWAP')) {
        const parts = symbolId.split('-');
        if (parts.length >= 2) {
          const base = parts[0];
          const quote = parts[1] === 'USD' ? 'USDT' : parts[1];
          return `${base}-${quote}-SWAP`;
        }
      }
      
      // Asset-only format: SOL, BTC, ETH, etc.
      if (symbolId.match(/^[A-Z]{2,6}$/)) {
        return `${symbolId}-USDT-SWAP`;
      }
      
      // Fallback for unknown formats
      console.warn(`🚨 [CoinAPI] Unknown symbol format: ${symbolId}, using default`);
      return 'SOL-USDT-SWAP';
      
    } catch (error) {
      console.error(`🚨 [CoinAPI] Error converting symbol ${symbolId}:`, error);
      return 'SOL-USDT-SWAP'; // Safe fallback
    }
  }
  
  /**
   * Validate if a symbol ID looks valid for CoinAPI
   */
  private isValidCoinAPISymbol(symbolId: string): boolean {
    if (!symbolId || typeof symbolId !== 'string') return false;
    
    // Valid patterns for CoinAPI symbols:
    // 1. Exchange format: BINANCE_SPOT_SOL_USDT
    // 2. Simple format: SOL/USDT, BTC-USD
    // 3. Asset only: SOL, BTC
    const validPatterns = [
      /^[A-Z]+_[A-Z]+_[A-Z]{2,6}_[A-Z]{3,6}$/, // Exchange format
      /^[A-Z]{2,6}[\/\-][A-Z]{3,6}$/,           // Pair format  
      /^[A-Z]{2,6}$/                            // Asset only
    ];
    
    return validPatterns.some(pattern => pattern.test(symbolId));
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
        'rate',
        `${assetIdBase}/${assetIdQuote}`
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
      // Implement segmented fetching for large date ranges
      const shouldUseSegmentedFetch = this.shouldUseSegmentedFetch(timeStart, timeEnd, limit);
      
      if (shouldUseSegmentedFetch && timeStart && timeEnd) {
        console.log(`📊 [CoinAPI] Using segmented fetch for ${symbolId} (${timeStart} to ${timeEnd})`);
        return this.getHistoricalDataSegmented(symbolId, period, timeStart, timeEnd, limit);
      }
      
      const result = await this.safeCoinAPI<CoinAPIHistoricalData[]>(
        // Main function
        async () => {
          let url = `/ohlcv/${encodeURIComponent(symbolId)}/history?period_id=${period}&limit=${limit}`;
          if (timeStart) url += `&time_start=${timeStart}`;
          if (timeEnd) url += `&time_end=${timeEnd}`;
          
          const response = await this.client.get(url);
          
          // Ensure we always return an array
          const data = response.data;
          if (!Array.isArray(data)) {
            console.warn(`🚨 [CoinAPI] Non-array response for ${symbolId}:`, typeof data, data);
            return [];
          }
          
          return data;
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
            const mappedData = this.mapOKXCandlesToHistorical(okxCandles, symbolId, period);
            
            // Ensure we always return an array
            if (!Array.isArray(mappedData)) {
              console.warn(`🚨 [CoinAPI] OKX mapping returned non-array for ${symbolId}:`, typeof mappedData);
              return [];
            }
            
            return mappedData;
          } catch (error) {
            console.warn(`🚨 OKX historical fallback failed:`, error instanceof Error ? error.message : 'Unknown error');
            throw new Error('OKX historical fallback exhausted');
          }
        },
        lastGoodKey,
        'historical',
        symbolId
      );
      
      // Final safety check - ensure result.data is always an array
      const finalData = Array.isArray(result.data) ? result.data : [];
      
      if (finalData.length === 0) {
        console.warn(`⚠️ [CoinAPI] No valid historical data returned for ${symbolId} (${period})`);
      }
      
      return {
        data: finalData,
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
   * Validate TWAP calculation results
   * Returns true if TWAP data is complete and valid
   */
  private validateTWAPData(twapResult: any, symbolId: string, expectedHours: number): boolean {
    // Check if result exists and has all required fields
    if (!twapResult || typeof twapResult !== 'object') {
      console.warn(`[TWAP Validation] ${symbolId}: No result object`);
      return false;
    }
    
    // Check for missing or invalid TWAP value
    if (!twapResult.twap || twapResult.twap <= 0 || !isFinite(twapResult.twap)) {
      console.warn(`[TWAP Validation] ${symbolId}: Invalid TWAP value:`, twapResult.twap);
      return false;
    }
    
    // Check if we have sufficient data points (at least 50% of expected hours)
    const minimumDataPoints = Math.max(1, Math.floor(expectedHours * 0.5));
    if (!twapResult.data_points || twapResult.data_points < minimumDataPoints) {
      console.warn(`[TWAP Validation] ${symbolId}: Insufficient data points: ${twapResult.data_points} < ${minimumDataPoints}`);
      return false;
    }
    
    // Check if time range makes sense
    if (!twapResult.time_start || !twapResult.time_end) {
      console.warn(`[TWAP Validation] ${symbolId}: Missing time range`);
      return false;
    }
    
    const startTime = new Date(twapResult.time_start);
    const endTime = new Date(twapResult.time_end);
    const actualHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    // Allow some tolerance (e.g., at least 80% of expected period)
    if (actualHours < expectedHours * 0.8) {
      console.warn(`[TWAP Validation] ${symbolId}: Insufficient time range: ${actualHours}h < ${expectedHours * 0.8}h`);
      return false;
    }
    
    console.log(`[TWAP Validation] ${symbolId}: Valid TWAP data - value: ${twapResult.twap}, points: ${twapResult.data_points}, hours: ${actualHours}`);
    return true;
  }

  /**
   * Calculate TWAP (Time Weighted Average Price) from historical data with VWAP fallback
   * Automatically falls back to VWAP calculation if TWAP data is incomplete or invalid
   */
  async calculateTWAP(symbolId: string, hours: number = 24): Promise<{
    twap: number;
    period_hours: number;
    data_points: number;
    time_start: string;
    time_end: string;
    fallback_used?: 'vwap' | 'multi_ticker';
    fallback_reason?: string;
    data_source: 'twap' | 'vwap_fallback' | 'multi_ticker_fallback';
  }> {
    const cacheKey = this.getCacheKey('twap', { symbolId, hours });
    
    return cache.getSingleFlight(cacheKey, async () => {
      const startTime = Date.now();
      
      try {
        // Step 1: Attempt primary TWAP calculation
        console.log(`[TWAP] Starting calculation for ${symbolId} (${hours}h period)`);
        
        const timeEnd = new Date().toISOString();
        const timeStart = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        
        let historicalData;
        try {
          historicalData = await this.getHistoricalData(symbolId, '1HRS', timeStart, timeEnd);
        } catch (error) {
          console.warn(`[TWAP] Failed to get historical data for ${symbolId}:`, error instanceof Error ? error.message : 'Unknown error');
          // Immediate fallback to VWAP if we can't get historical data
          return await this.performVWAPFallback(symbolId, hours, 'historical_data_unavailable');
        }
        
        if (!historicalData || !historicalData.data || historicalData.data.length === 0) {
          console.warn(`[TWAP] No historical data available for ${symbolId}`);
          return await this.performVWAPFallback(symbolId, hours, 'no_historical_data');
        }

        // Calculate TWAP = Sum(Price * Volume) / Sum(Volume)
        let totalValue = 0;
        let totalVolume = 0;
        let validCandles = 0;
        
        historicalData.data.forEach((candle: CoinAPIHistoricalData) => {
          // Validate candle data
          if (candle && candle.price_high && candle.price_low && candle.price_close && candle.volume_traded) {
            const avgPrice = (candle.price_high + candle.price_low + candle.price_close) / 3;
            if (avgPrice > 0 && candle.volume_traded > 0) {
              totalValue += avgPrice * candle.volume_traded;
              totalVolume += candle.volume_traded;
              validCandles++;
            }
          }
        });

        const twap = totalVolume > 0 ? totalValue / totalVolume : 0;
        
        const twapResult = {
          twap,
          period_hours: hours,
          data_points: validCandles,
          time_start: timeStart,
          time_end: timeEnd,
          data_source: 'twap' as const
        };
        
        // Step 2: Validate TWAP result
        if (this.validateTWAPData(twapResult, symbolId, hours)) {
          const processingTime = Date.now() - startTime;
          console.log(`[TWAP] ✅ Valid TWAP calculated for ${symbolId}: ${twap} (${validCandles} points, ${processingTime}ms)`);
          return twapResult;
        }
        
        // Step 3: TWAP validation failed, fallback to VWAP
        console.warn(`[TWAP] ❌ TWAP validation failed for ${symbolId}, attempting VWAP fallback`);
        return await this.performVWAPFallback(symbolId, hours, 'twap_validation_failed');
        
      } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`[TWAP] ❌ Error calculating TWAP for ${symbolId} (${processingTime}ms):`, error instanceof Error ? error.message : 'Unknown error');
        
        // Step 4: Error occurred, attempt fallback
        try {
          return await this.performVWAPFallback(symbolId, hours, 'twap_calculation_error');
        } catch (fallbackError) {
          console.error(`[TWAP] ❌ Both TWAP and fallback failed for ${symbolId}:`, fallbackError instanceof Error ? fallbackError.message : 'Unknown error');
          throw new Error(`Failed to calculate TWAP for ${symbolId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }, TTL_CONFIG.TICKER);
  }
  
  /**
   * Perform VWAP fallback when TWAP calculation fails or returns invalid data
   */
  private async performVWAPFallback(symbolId: string, hours: number, reason: string): Promise<{
    twap: number;
    period_hours: number;
    data_points: number;
    time_start: string;
    time_end: string;
    fallback_used: 'vwap' | 'multi_ticker';
    fallback_reason: string;
    data_source: 'vwap_fallback' | 'multi_ticker_fallback';
  }> {
    const fallbackStartTime = Date.now();
    
    console.log(`[TWAP] 🔄 Initiating VWAP fallback for ${symbolId}. Reason: ${reason}`);
    
    try {
      // Step 1: Try direct VWAP calculation
      const vwapResult = await this.calculateVWAP(symbolId, hours);
      
      // Validate VWAP result
      if (vwapResult && vwapResult.vwap && vwapResult.vwap > 0 && vwapResult.data_points > 0) {
        const processingTime = Date.now() - fallbackStartTime;
        console.log(`[TWAP] ✅ VWAP fallback successful for ${symbolId}: ${vwapResult.vwap} (${vwapResult.data_points} points, ${processingTime}ms)`);
        
        return {
          twap: vwapResult.vwap, // Return as 'twap' to maintain API consistency
          period_hours: vwapResult.period_hours,
          data_points: vwapResult.data_points,
          time_start: vwapResult.time_start,
          time_end: vwapResult.time_end,
          fallback_used: 'vwap',
          fallback_reason: reason,
          data_source: 'vwap_fallback'
        };
      }
      
      console.warn(`[TWAP] ⚠️ VWAP fallback returned invalid data for ${symbolId}`, vwapResult);
      
    } catch (vwapError) {
      console.warn(`[TWAP] ⚠️ VWAP fallback failed for ${symbolId}:`, vwapError instanceof Error ? vwapError.message : 'Unknown error');
    }
    
    // Step 2: Try multi-ticker fallback as last resort
    console.log(`[TWAP] 🔄 Attempting multi-ticker fallback for ${symbolId}`);
    
    try {
      // Extract asset from symbolId (e.g., BINANCE_SPOT_SOL_USDT -> SOL)
      const asset = this.extractAssetFromSymbolId(symbolId);
      const multiTickerData = await this.getMultiExchangeTicker(asset);
      
      if (multiTickerData && multiTickerData.tickers && multiTickerData.tickers.length > 0) {
        // Calculate simple average price from multi-ticker data
        const validPrices = multiTickerData.tickers
          .map(ticker => parseFloat(ticker.price))
          .filter(price => price > 0 && isFinite(price));
          
        if (validPrices.length > 0) {
          const averagePrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
          const processingTime = Date.now() - fallbackStartTime;
          
          console.log(`[TWAP] ✅ Multi-ticker fallback successful for ${symbolId}: ${averagePrice} (${validPrices.length} tickers, ${processingTime}ms)`);
          
          return {
            twap: averagePrice,
            period_hours: hours,
            data_points: validPrices.length,
            time_start: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
            time_end: new Date().toISOString(),
            fallback_used: 'multi_ticker',
            fallback_reason: reason,
            data_source: 'multi_ticker_fallback'
          };
        }
      }
      
      console.error(`[TWAP] ❌ Multi-ticker fallback failed for ${symbolId}: no valid price data`);
      
    } catch (multiTickerError) {
      console.error(`[TWAP] ❌ Multi-ticker fallback error for ${symbolId}:`, multiTickerError instanceof Error ? multiTickerError.message : 'Unknown error');
    }
    
    // All fallback methods failed
    const processingTime = Date.now() - fallbackStartTime;
    throw new Error(`All TWAP fallback methods exhausted for ${symbolId} after ${processingTime}ms. Original reason: ${reason}`);
  }
  
  /**
   * Extract asset symbol from CoinAPI symbolId format
   * Examples: BINANCE_SPOT_SOL_USDT -> SOL, COINBASE_SPOT_BTC_USD -> BTC
   */
  private extractAssetFromSymbolId(symbolId: string): string {
    const parts = symbolId.split('_');
    if (parts.length >= 3) {
      return parts[2]; // Third part is typically the asset (BINANCE_SPOT_SOL_USDT)
    }
    // Fallback: try to extract asset from the symbolId itself
    if (symbolId.includes('SOL')) return 'SOL';
    if (symbolId.includes('BTC')) return 'BTC';
    if (symbolId.includes('ETH')) return 'ETH';
    if (symbolId.includes('ADA')) return 'ADA';
    
    // Default fallback
    console.warn(`[TWAP] Could not extract asset from symbolId: ${symbolId}, defaulting to SOL`);
    return 'SOL';
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
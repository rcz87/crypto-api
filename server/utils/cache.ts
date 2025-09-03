import { metricsCollector } from './metrics';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface SingleFlightEntry<T> {
  promise: Promise<T>;
  timestamp: number;
}

class TTLCache {
  private cache = new Map<string, CacheEntry<any>>();
  private singleFlight = new Map<string, SingleFlightEntry<any>>();
  private readonly cleanupInterval = 60000; // 1 minute
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  // Get cached data with TTL check
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      metricsCollector.recordCacheMiss();
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      metricsCollector.recordCacheMiss();
      return null;
    }

    metricsCollector.recordCacheHit();
    return entry.data;
  }

  // Set data with TTL
  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
    metricsCollector.updateCacheSize(this.cache.size);
  }

  // Single-flight pattern: ensure only one request for the same key is in-flight
  async getSingleFlight<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttlMs: number
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if already in-flight
    const inFlight = this.singleFlight.get(key);
    if (inFlight) {
      // Return existing promise
      return inFlight.promise;
    }

    // Create new in-flight request
    const promise = fetcher()
      .then(data => {
        this.set(key, data, ttlMs);
        return data;
      })
      .finally(() => {
        // Remove from in-flight map
        this.singleFlight.delete(key);
      });

    this.singleFlight.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  // Manual cleanup for expired entries
  private cleanup(): void {
    const now = Date.now();
    
    // Clean cache entries
    const cacheEntries = Array.from(this.cache.entries());
    for (const [key, entry] of cacheEntries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // Clean old in-flight requests (safety cleanup - shouldn't happen often)
    const flightEntries = Array.from(this.singleFlight.entries());
    for (const [key, entry] of flightEntries) {
      if (now - entry.timestamp > 30000) { // 30s timeout for in-flight
        this.singleFlight.delete(key);
      }
    }

    metricsCollector.updateCacheSize(this.cache.size);
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      inFlight: this.singleFlight.size
    };
  }

  // Clear all cache (for testing/debugging)
  clear(): void {
    this.cache.clear();
    this.singleFlight.clear();
    metricsCollector.updateCacheSize(0);
  }

  // Destroy cache and cleanup timer
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// TTL configurations
export const TTL_CONFIG = {
  TICKER: 2500,     // 2.5s - high frequency data
  TRADES: 2500,     // 2.5s - real-time trades
  ORDERBOOK: 1500,  // 1.5s - order book updates
  CANDLES: 90000,   // 90s - candlestick data
  FUNDING: 30000,   // 30s - funding rates
  OI: 30000,        // 30s - open interest
  VOLUME: 30000,    // 30s - volume profile
  SMC: 10000,       // 10s - SMC analysis
  HEALTH: 5000      // 5s - health checks
};

export const cache = new TTLCache();
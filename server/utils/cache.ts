import { metricsCollector } from './metrics';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessedAt: number;
  accessCount: number;
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

    // Update access tracking for LRU
    entry.accessedAt = Date.now();
    entry.accessCount++;
    
    metricsCollector.recordCacheHit();
    return entry.data;
  }

  // Set data with TTL
  set<T>(key: string, data: T, ttlMs: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttlMs,
      accessedAt: now,
      accessCount: 0
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

  // Enhanced cleanup with LRU eviction
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

    // LRU eviction if cache gets too large (memory optimization)
    if (this.cache.size > 1000) {
      this.evictLRU();
    }

    metricsCollector.updateCacheSize(this.cache.size);
  }

  // LRU eviction for memory optimization
  private evictLRU(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].accessedAt - b[1].accessedAt);
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
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

// Optimized TTL configurations for better cache hit ratio
export const TTL_CONFIG = {
  TICKER: 3000,     // 3s - high frequency data (increased for better hits)
  TRADES: 3000,     // 3s - real-time trades 
  ORDERBOOK: 2000,  // 2s - order book updates
  CANDLES: 120000,  // 2min - candlestick data (increased)
  FUNDING: 60000,   // 60s - funding rates (increased)
  OI: 45000,        // 45s - open interest (increased)
  VOLUME: 45000,    // 45s - volume profile (increased)
  SMC: 30000,       // 30s - SMC analysis (increased significantly)
  HEALTH: 10000,    // 10s - health checks (increased)
  AI_FEATURES: 180000,  // 3min - AI feature extraction
  AI_PREDICTION: 120000, // 2min - AI predictions
  TECHNICAL: 60000,      // 60s - technical analysis
  PATTERNS: 300000       // 5min - pattern analysis
};

export const cache = new TTLCache();
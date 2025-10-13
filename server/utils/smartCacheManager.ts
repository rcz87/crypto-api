/**
 * 🗄️ Smart Cache Manager dengan LRU Eviction Policy
 * 
 * Features:
 * - LRU (Least Recently Used) eviction strategy
 * - Configurable size limits (item count & memory size)
 * - TTL support per item
 * - Auto-cleanup untuk prevent memory buildup
 * - Cache hit/miss metrics
 * - Memory-aware eviction (evicts when heap high)
 * - Prometheus metrics integration
 */

import client from "prom-client";

interface CacheEntry<T> {
  value: T;
  expires: number; // timestamp
  size: number; // estimated size in bytes
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  itemCount: number;
  hitRate: number;
  oldestItemAge: number;
}

interface CacheConfig {
  maxItems?: number;
  maxSizeMB?: number;
  defaultTTL?: number; // milliseconds
  cleanupInterval?: number; // milliseconds
}

export class SmartCacheManager<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = []; // LRU tracking
  
  private maxItems: number;
  private maxSizeBytes: number;
  private defaultTTL: number;
  private cleanupInterval: number;
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    currentSize: 0
  };

  // Prometheus metrics
  private gaugeCacheSize: client.Gauge;
  private gaugeCacheItems: client.Gauge;
  private counterCacheHits: client.Counter;
  private counterCacheMisses: client.Counter;
  private counterCacheEvictions: client.Counter;
  private gaugeHitRate: client.Gauge;

  constructor(
    private name: string,
    config: CacheConfig = {}
  ) {
    this.maxItems = config.maxItems || 1000;
    this.maxSizeBytes = (config.maxSizeMB || 50) * 1024 * 1024; // Default 50MB
    this.defaultTTL = config.defaultTTL || 30 * 60 * 1000; // 30 minutes
    this.cleanupInterval = config.cleanupInterval || 60 * 1000; // 1 minute

    // Initialize Prometheus metrics
    this.gaugeCacheSize = this.getOrCreateGauge(
      `cache_${name}_size_bytes`,
      `Cache size in bytes for ${name}`
    );
    this.gaugeCacheItems = this.getOrCreateGauge(
      `cache_${name}_items`,
      `Number of items in cache for ${name}`
    );
    this.counterCacheHits = this.getOrCreateCounter(
      `cache_${name}_hits_total`,
      `Total cache hits for ${name}`
    );
    this.counterCacheMisses = this.getOrCreateCounter(
      `cache_${name}_misses_total`,
      `Total cache misses for ${name}`
    );
    this.counterCacheEvictions = this.getOrCreateCounter(
      `cache_${name}_evictions_total`,
      `Total cache evictions for ${name}`
    );
    this.gaugeHitRate = this.getOrCreateGauge(
      `cache_${name}_hit_rate`,
      `Cache hit rate percentage for ${name}`
    );

    this.startAutoCleanup();
    console.log(`🗄️ Smart Cache [${name}]: Initialized (max: ${this.maxItems} items, ${config.maxSizeMB}MB)`);
  }

  private getOrCreateGauge(name: string, help: string): client.Gauge {
    const existing = client.register.getSingleMetric(name);
    if (existing && existing instanceof client.Gauge) {
      return existing as client.Gauge;
    }
    return new client.Gauge({ name, help });
  }

  private getOrCreateCounter(name: string, help: string): client.Counter {
    const existing = client.register.getSingleMetric(name);
    if (existing && existing instanceof client.Counter) {
      return existing as client.Counter;
    }
    return new client.Counter({ name, help });
  }

  public set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiryTTL = ttl || this.defaultTTL;
    const estimatedSize = this.estimateSize(value);

    // Check if adding this would exceed size limit
    if (this.stats.currentSize + estimatedSize > this.maxSizeBytes) {
      this.evictUntilFit(estimatedSize);
    }

    // Check if we need to evict due to item count
    if (this.cache.size >= this.maxItems) {
      this.evictLRU();
    }

    // Remove old entry if exists
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key)!;
      this.stats.currentSize -= oldEntry.size;
      this.removeFromAccessOrder(key);
    }

    // Add new entry
    const entry: CacheEntry<T> = {
      value,
      expires: now + expiryTTL,
      size: estimatedSize,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    // DEDUP FIX: Only push if not already in accessOrder (prevent duplicates)
    if (!this.accessOrder.includes(key)) {
      this.accessOrder.push(key);
    } else {
      // Update position
      this.updateAccessOrder(key);
    }
    this.stats.currentSize += estimatedSize;

    this.updateMetrics();
  }

  public get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.counterCacheMisses.inc();
      this.updateHitRate();
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (entry.expires < now) {
      this.delete(key);
      this.stats.misses++;
      this.counterCacheMisses.inc();
      this.updateHitRate();
      return null;
    }

    // Update access time and order (LRU)
    entry.lastAccessed = now;
    this.updateAccessOrder(key);

    this.stats.hits++;
    this.counterCacheHits.inc();
    this.updateHitRate();
    
    return entry.value;
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (entry.expires < Date.now()) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  public delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.stats.currentSize -= entry.size;
    this.cache.delete(key);
    this.removeFromAccessOrder(key);
    this.updateMetrics();
    
    return true;
  }

  public clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    this.stats.currentSize = 0;
    this.updateMetrics();
    console.log(`🗄️ Smart Cache [${this.name}]: Cleared all entries (${size} items removed)`);
    
    // 🔧 PATCH 4: Force GC after cache clear to release memory immediately
    if (global.gc) {
      global.gc();
      console.log(`🗄️ Smart Cache [${this.name}]: Forced GC after clear`);
    }
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder[0];
    const entry = this.cache.get(lruKey);
    
    if (entry) {
      this.stats.currentSize -= entry.size;
      this.stats.evictions++;
      this.counterCacheEvictions.inc();
    }

    this.cache.delete(lruKey);
    this.accessOrder.shift();
    this.updateMetrics();
  }

  private evictUntilFit(requiredSize: number): void {
    const targetSize = this.maxSizeBytes - requiredSize;
    let evictionCount = 0;

    while (this.stats.currentSize > targetSize && this.accessOrder.length > 0) {
      this.evictLRU();
      evictionCount++;
    }

    if (evictionCount > 0) {
      console.log(`🗄️ Smart Cache [${this.name}]: Evicted ${evictionCount} items to fit ${requiredSize} bytes`);
    }
  }

  private updateAccessOrder(key: string): void {
    // QUICK FIX: Use Set for dedup, then rebuild array periodically
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
    
    // Safety: Rebuild accessOrder if it grows beyond cache size (memory leak prevention)
    if (this.accessOrder.length > this.cache.size * 1.5) {
      this.rebuildAccessOrder();
    }
  }
  
  private rebuildAccessOrder(): void {
    // Rebuild accessOrder from cache entries, sorted by lastAccessed
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      .map(([key]) => key);
    
    this.accessOrder = entries;
    console.log(`🗄️ Smart Cache [${this.name}]: Rebuilt accessOrder (${this.accessOrder.length} items, was oversized)`);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private estimateSize(value: T): number {
    try {
      // Rough estimation of object size
      const json = JSON.stringify(value);
      return json.length * 2; // UTF-16 characters are 2 bytes each
    } catch {
      return 1024; // Default 1KB for non-serializable objects
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.expires < now) {
        this.stats.currentSize -= entry.size;
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🗄️ Smart Cache [${this.name}]: Cleaned up ${cleanedCount} expired entries`);
      this.updateMetrics();
      
      // 🔧 PATCH 4: Force GC after cleanup to release memory
      if (global.gc) {
        global.gc();
        console.log(`🗄️ Smart Cache [${this.name}]: Forced GC after cleanup`);
      }
    }
    
    // MEMORY LEAK FIX: Rebuild accessOrder if significantly larger than cache
    if (this.accessOrder.length > this.cache.size * 1.3) {
      this.rebuildAccessOrder();
    }
  }

  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
      
      // Memory-aware eviction: if heap is high, aggressively clean cache
      const usage = process.memoryUsage();
      const heapPercent = (usage.heapUsed / usage.heapTotal) * 100;
      
      if (heapPercent > 85) {
        const evictCount = Math.ceil(this.cache.size * 0.3); // Evict 30% of cache
        console.log(`🗄️ Smart Cache [${this.name}]: High heap usage (${heapPercent.toFixed(1)}%), evicting ${evictCount} items`);
        
        for (let i = 0; i < evictCount && this.accessOrder.length > 0; i++) {
          this.evictLRU();
        }
      }
    }, this.cleanupInterval);
  }

  private updateMetrics(): void {
    this.gaugeCacheSize.set(this.stats.currentSize);
    this.gaugeCacheItems.set(this.cache.size);
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    this.gaugeHitRate.set(hitRate);
  }

  public getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    let oldestItemAge = 0;
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder[0];
      const oldestEntry = this.cache.get(oldestKey);
      if (oldestEntry) {
        oldestItemAge = Date.now() - oldestEntry.lastAccessed;
      }
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.stats.currentSize,
      itemCount: this.cache.size,
      hitRate,
      oldestItemAge
    };
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
    console.log(`🗄️ Smart Cache [${this.name}]: Destroyed`);
  }
}

// Global cache registry
class CacheRegistry {
  private caches: Map<string, SmartCacheManager> = new Map();

  public getOrCreate<T = any>(
    name: string,
    config?: CacheConfig
  ): SmartCacheManager<T> {
    if (!this.caches.has(name)) {
      const cache = new SmartCacheManager<T>(name, config);
      this.caches.set(name, cache);
    }
    return this.caches.get(name) as SmartCacheManager<T>;
  }

  public get<T = any>(name: string): SmartCacheManager<T> | undefined {
    return this.caches.get(name) as SmartCacheManager<T>;
  }

  public getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of Array.from(this.caches.entries())) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  public clearAll(): void {
    for (const cache of Array.from(this.caches.values())) {
      cache.clear();
    }
    console.log("🗄️ Cache Registry: Cleared all caches");
  }

  public destroyAll(): void {
    for (const cache of Array.from(this.caches.values())) {
      cache.destroy();
    }
    this.caches.clear();
    console.log("🗄️ Cache Registry: Destroyed all caches");
  }
}

// Export singleton registry
export const cacheRegistry = new CacheRegistry();

// Export pre-configured caches for common use cases
export const apiCache = cacheRegistry.getOrCreate("api", {
  maxItems: 500,
  maxSizeMB: 30,
  defaultTTL: 30 * 1000 // 30 seconds
});

export const dataCache = cacheRegistry.getOrCreate("data", {
  maxItems: 1000,
  maxSizeMB: 50,
  defaultTTL: 5 * 60 * 1000 // 5 minutes
});

export const sessionCache = cacheRegistry.getOrCreate("session", {
  maxItems: 200,
  maxSizeMB: 10,
  defaultTTL: 30 * 60 * 1000 // 30 minutes
});

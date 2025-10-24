/**
 * Cache Monitor Utility
 * Provides visibility into cache usage across the application
 * Part of MEDIUM priority memory leak improvements
 */

interface CacheStats {
  name: string;
  size: number;
  maxSize: number;
  utilizationPercent: number;
  oldestEntry?: number; // timestamp
  newestEntry?: number; // timestamp
  avgAge?: number; // milliseconds
}

interface CacheEntry {
  timestamp: number;
  [key: string]: any;
}

export class CacheMonitor {
  private static instance: CacheMonitor | null = null;
  private caches: Map<string, any> = new Map();
  
  private constructor() {}
  
  public static getInstance(): CacheMonitor {
    if (!CacheMonitor.instance) {
      CacheMonitor.instance = new CacheMonitor();
    }
    return CacheMonitor.instance;
  }
  
  /**
   * Register a cache for monitoring
   */
  public registerCache(name: string, cache: Map<any, any> | any[], maxSize: number): void {
    this.caches.set(name, { cache, maxSize });
    console.log(`📊 Cache Monitor: Registered cache "${name}" (max: ${maxSize})`);
  }
  
  /**
   * Unregister a cache
   */
  public unregisterCache(name: string): void {
    this.caches.delete(name);
    console.log(`📊 Cache Monitor: Unregistered cache "${name}"`);
  }
  
  /**
   * Get stats for a specific cache
   */
  public getCacheStats(name: string): CacheStats | null {
    const cacheData = this.caches.get(name);
    if (!cacheData) return null;
    
    const { cache, maxSize } = cacheData;
    const size = cache instanceof Map ? cache.size : cache.length;
    const utilizationPercent = (size / maxSize) * 100;
    
    const stats: CacheStats = {
      name,
      size,
      maxSize,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100
    };
    
    // Try to extract timestamp info if available
    try {
      if (cache instanceof Map) {
        const entries = Array.from(cache.values());
        const timestamps = this.extractTimestamps(entries);
        if (timestamps.length > 0) {
          stats.oldestEntry = Math.min(...timestamps);
          stats.newestEntry = Math.max(...timestamps);
          stats.avgAge = Date.now() - (timestamps.reduce((a, b) => a + b, 0) / timestamps.length);
        }
      } else if (Array.isArray(cache)) {
        const timestamps = this.extractTimestamps(cache);
        if (timestamps.length > 0) {
          stats.oldestEntry = Math.min(...timestamps);
          stats.newestEntry = Math.max(...timestamps);
          stats.avgAge = Date.now() - (timestamps.reduce((a, b) => a + b, 0) / timestamps.length);
        }
      }
    } catch (error) {
      // Silently fail if timestamp extraction doesn't work
    }
    
    return stats;
  }
  
  /**
   * Get stats for all registered caches
   */
  public getAllCacheStats(): CacheStats[] {
    const allStats: CacheStats[] = [];
    
    for (const name of this.caches.keys()) {
      const stats = this.getCacheStats(name);
      if (stats) {
        allStats.push(stats);
      }
    }
    
    return allStats;
  }
  
  /**
   * Get summary report
   */
  public getSummaryReport(): {
    totalCaches: number;
    totalEntries: number;
    totalMaxSize: number;
    overallUtilization: number;
    caches: CacheStats[];
    warnings: string[];
  } {
    const allStats = this.getAllCacheStats();
    const totalEntries = allStats.reduce((sum, stat) => sum + stat.size, 0);
    const totalMaxSize = allStats.reduce((sum, stat) => sum + stat.maxSize, 0);
    const overallUtilization = totalMaxSize > 0 ? (totalEntries / totalMaxSize) * 100 : 0;
    
    const warnings: string[] = [];
    
    // Check for high utilization
    allStats.forEach(stat => {
      if (stat.utilizationPercent > 90) {
        warnings.push(`⚠️ Cache "${stat.name}" is ${stat.utilizationPercent.toFixed(1)}% full (${stat.size}/${stat.maxSize})`);
      }
      
      // Check for old entries (>7 days)
      if (stat.avgAge && stat.avgAge > 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(stat.avgAge / (24 * 60 * 60 * 1000));
        warnings.push(`⚠️ Cache "${stat.name}" has entries averaging ${days} days old`);
      }
    });
    
    return {
      totalCaches: allStats.length,
      totalEntries,
      totalMaxSize,
      overallUtilization: Math.round(overallUtilization * 100) / 100,
      caches: allStats,
      warnings
    };
  }
  
  /**
   * Log summary to console
   */
  public logSummary(): void {
    const report = this.getSummaryReport();
    
    console.log('\n📊 ===== CACHE MONITOR SUMMARY =====');
    console.log(`Total Caches: ${report.totalCaches}`);
    console.log(`Total Entries: ${report.totalEntries} / ${report.totalMaxSize} (${report.overallUtilization.toFixed(1)}%)`);
    console.log('\nCache Details:');
    
    report.caches.forEach(cache => {
      const ageInfo = cache.avgAge 
        ? ` | Avg Age: ${Math.floor(cache.avgAge / (60 * 60 * 1000))}h`
        : '';
      console.log(`  - ${cache.name}: ${cache.size}/${cache.maxSize} (${cache.utilizationPercent.toFixed(1)}%)${ageInfo}`);
    });
    
    if (report.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      report.warnings.forEach(warning => console.log(`  ${warning}`));
    }
    
    console.log('=====================================\n');
  }
  
  /**
   * Extract timestamps from cache entries
   */
  private extractTimestamps(entries: any[]): number[] {
    const timestamps: number[] = [];
    
    for (const entry of entries) {
      if (entry && typeof entry === 'object') {
        // Try common timestamp field names
        const ts = entry.timestamp || entry.time || entry.createdAt || entry.created_at;
        if (typeof ts === 'number') {
          timestamps.push(ts);
        } else if (ts instanceof Date) {
          timestamps.push(ts.getTime());
        } else if (typeof ts === 'string') {
          const parsed = new Date(ts).getTime();
          if (!isNaN(parsed)) {
            timestamps.push(parsed);
          }
        }
      }
    }
    
    return timestamps;
  }
  
  /**
   * Start periodic monitoring (logs every N minutes)
   */
  public startPeriodicMonitoring(intervalMinutes: number = 15): NodeJS.Timeout {
    console.log(`📊 Cache Monitor: Starting periodic monitoring (every ${intervalMinutes} minutes)`);
    
    return setInterval(() => {
      this.logSummary();
    }, intervalMinutes * 60 * 1000);
  }
}

// Export singleton instance
export const cacheMonitor = CacheMonitor.getInstance();

/**
 * 📊 Memory Dashboard & Enhanced Monitoring Endpoints
 * 
 * Provides real-time memory insights, trend analysis, and predictive alerts
 */

import { Router, type Request, type Response } from "express";
import { memoryGuard } from "../utils/memoryGuard.js";
import { memoryProfiler } from "../utils/memoryProfiler.js";
import { cacheRegistry } from "../utils/smartCacheManager.js";

export const memoryDashboardRouter = Router();

// 📊 GET /api/memory/dashboard - Comprehensive memory dashboard
memoryDashboardRouter.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const memoryStats = memoryGuard.getStats();
    const profilerReport = memoryProfiler.getProfilingReport();
    const cacheStats = cacheRegistry.getAllStats();

    // Calculate predictive metrics
    const trend = profilerReport.trend_analysis;
    const predictedCrashTime = calculatePredictedCrashTime(trend, memoryStats);
    const riskLevel = calculateRiskLevel(trend, memoryStats, profilerReport.recent_leaks);

    res.json({
      success: true,
      data: {
        current_memory: memoryStats,
        profiling: {
          trend: trend,
          leak_patterns: profilerReport.recent_leaks,
          recommendations: profilerReport.recommendations
        },
        cache_performance: cacheStats,
        predictions: {
          crash_time_minutes: predictedCrashTime,
          risk_level: riskLevel,
          action_required: riskLevel === 'critical' || riskLevel === 'high'
        },
        thresholds: {
          warning: 70,
          critical: 80,
          restart: 85,
          note: "v3 Enhanced: Safer thresholds with 15% buffer margin"
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to get memory dashboard",
      message: error?.message
    });
  }
});

// 📈 GET /api/memory/trends - Memory trend analysis
memoryDashboardRouter.get("/trends", async (req: Request, res: Response) => {
  try {
    const snapshots = memoryProfiler.getSnapshots();
    const leakPatterns = memoryProfiler.getLeakPatterns();

    // Calculate trend metrics
    const trendMetrics = calculateDetailedTrends(snapshots);

    res.json({
      success: true,
      data: {
        snapshots: snapshots.slice(-20), // Last 20 snapshots
        trend_metrics: trendMetrics,
        leak_patterns: leakPatterns,
        analysis: {
          is_stable: trendMetrics.growth_pattern === 'stable',
          needs_attention: trendMetrics.growth_pattern === 'exponential' || trendMetrics.avgGrowthRate > 10,
          leak_probability: trendMetrics.leak_probability
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to get memory trends",
      message: error?.message
    });
  }
});

// 🔍 POST /api/memory/snapshot - Take heap snapshot for analysis
memoryDashboardRouter.post("/snapshot", async (req: Request, res: Response) => {
  try {
    const snapshotPath = memoryProfiler.takeHeapSnapshot();
    
    res.json({
      success: true,
      data: {
        snapshot_path: snapshotPath,
        message: "Heap snapshot created successfully",
        instructions: "Download the .heapsnapshot file and open in Chrome DevTools > Memory"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to take heap snapshot",
      message: error?.message
    });
  }
});

// 🗑️ POST /api/memory/clear-cache - Clear all caches manually
memoryDashboardRouter.post("/clear-cache", async (req: Request, res: Response) => {
  try {
    const statsBefore = cacheRegistry.getAllStats();
    cacheRegistry.clearAll();
    const statsAfter = cacheRegistry.getAllStats();

    res.json({
      success: true,
      data: {
        cleared: true,
        stats_before: statsBefore,
        stats_after: statsAfter,
        message: "All caches cleared successfully"
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to clear cache",
      message: error?.message
    });
  }
});

// 📋 GET /api/memory/leaks - Get leak detection results
memoryDashboardRouter.get("/leaks", async (req: Request, res: Response) => {
  try {
    const leakPatterns = memoryProfiler.getLeakPatterns();
    
    // Group by severity
    const grouped = {
      critical: leakPatterns.filter(l => l.severity === 'critical'),
      high: leakPatterns.filter(l => l.severity === 'high'),
      medium: leakPatterns.filter(l => l.severity === 'medium'),
      low: leakPatterns.filter(l => l.severity === 'low')
    };

    res.json({
      success: true,
      data: {
        total_leaks: leakPatterns.length,
        by_severity: {
          critical: grouped.critical.length,
          high: grouped.high.length,
          medium: grouped.medium.length,
          low: grouped.low.length
        },
        patterns: grouped,
        requires_immediate_action: grouped.critical.length > 0 || grouped.high.length > 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to get leak patterns",
      message: error?.message
    });
  }
});

// 💾 GET /api/memory/cache-stats - Detailed cache statistics
memoryDashboardRouter.get("/cache-stats", async (req: Request, res: Response) => {
  try {
    const allStats = cacheRegistry.getAllStats();
    
    // Calculate aggregated metrics
    const totalSize = Object.values(allStats).reduce((sum, stats) => sum + stats.size, 0);
    const totalItems = Object.values(allStats).reduce((sum, stats) => sum + stats.itemCount, 0);
    const totalHits = Object.values(allStats).reduce((sum, stats) => sum + stats.hits, 0);
    const totalMisses = Object.values(allStats).reduce((sum, stats) => sum + stats.misses, 0);
    const avgHitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0;

    res.json({
      success: true,
      data: {
        by_cache: allStats,
        aggregated: {
          total_size_bytes: totalSize,
          total_items: totalItems,
          total_hits: totalHits,
          total_misses: totalMisses,
          average_hit_rate: avgHitRate.toFixed(2)
        },
        health: {
          status: avgHitRate > 70 ? 'excellent' : avgHitRate > 50 ? 'good' : 'needs_improvement',
          recommendation: avgHitRate < 50 ? 'Consider increasing cache TTL or reviewing cache keys' : 'Cache performing well'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to get cache stats",
      message: error?.message
    });
  }
});

// Helper functions

function calculatePredictedCrashTime(
  trend: any,
  memoryStats: any
): number | null {
  if (trend.avgGrowthRate <= 0) return null;
  
  const currentHeapPercent = memoryStats.heapPercent;
  const restartThreshold = 85;
  const remainingPercent = restartThreshold - currentHeapPercent;
  
  if (remainingPercent <= 0) return 0; // Already at or above threshold
  
  // Calculate time to reach threshold based on growth rate
  // Growth rate is MB/min, we need to convert to percent/min
  const heapTotalMB = memoryStats.heapTotalMB;
  const percentGrowthPerMin = (trend.avgGrowthRate / heapTotalMB) * 100;
  
  if (percentGrowthPerMin <= 0) return null;
  
  const minutesToCrash = remainingPercent / percentGrowthPerMin;
  return Math.max(0, Math.round(minutesToCrash));
}

function calculateRiskLevel(
  trend: any,
  memoryStats: any,
  leaks: any[]
): 'low' | 'medium' | 'high' | 'critical' {
  const heapPercent = memoryStats?.heapPercent || 0;
  const growthRate = trend?.avgGrowthRate || 0;
  // FIX: Use snake_case field names from profiler API (growth_pattern, leak_probability)
  const leakProbability = trend?.leak_probability || trend?.leakProbability || 0;
  const growthPattern = trend?.growth_pattern || trend?.growthPattern || 'stable';
  const criticalLeaks = leaks.filter(l => l.severity === 'critical').length;
  const highLeaks = leaks.filter(l => l.severity === 'high').length;

  // Critical conditions
  if (
    heapPercent > 80 ||
    growthPattern === 'exponential' ||
    criticalLeaks > 0
  ) {
    return 'critical';
  }

  // High risk conditions
  if (
    heapPercent > 70 ||
    growthRate > 10 ||
    leakProbability > 70 ||
    highLeaks > 0
  ) {
    return 'high';
  }

  // Medium risk conditions
  if (
    heapPercent > 60 ||
    growthRate > 5 ||
    leakProbability > 40
  ) {
    return 'medium';
  }

  return 'low';
}

function calculateDetailedTrends(snapshots: any[]) {
  if (snapshots.length < 2) {
    return {
      avgGrowthRate: 0,
      growth_pattern: 'stable',
      leak_probability: 0,
      volatility: 0
    };
  }

  const recent = snapshots.slice(-10);
  const first = recent[0];
  const last = recent[recent.length - 1];
  
  const timeDiffMin = (last.timestamp - first.timestamp) / 60000;
  const memoryDiffMB = last.heapUsedMB - first.heapUsedMB;
  const avgGrowthRate = timeDiffMin > 0 ? memoryDiffMB / timeDiffMin : 0;

  // Calculate volatility (standard deviation of growth rates)
  const growthRates = [];
  for (let i = 1; i < recent.length; i++) {
    const timeDiff = (recent[i].timestamp - recent[i-1].timestamp) / 60000;
    const memDiff = recent[i].heapUsedMB - recent[i-1].heapUsedMB;
    growthRates.push(timeDiff > 0 ? memDiff / timeDiff : 0);
  }

  const avgGR = growthRates.reduce((sum, r) => sum + r, 0) / growthRates.length;
  const variance = growthRates.reduce((sum, r) => sum + Math.pow(r - avgGR, 2), 0) / growthRates.length;
  const volatility = Math.sqrt(variance);

  // Detect pattern
  let growth_pattern: 'stable' | 'linear' | 'exponential' = 'stable';
  if (avgGrowthRate > 1) {
    const midPoint = Math.floor(recent.length / 2);
    const firstHalfGrowth = recent[midPoint].heapUsedMB - first.heapUsedMB;
    const secondHalfGrowth = last.heapUsedMB - recent[midPoint].heapUsedMB;
    
    if (secondHalfGrowth > firstHalfGrowth * 1.5) {
      growth_pattern = 'exponential';
    } else {
      growth_pattern = 'linear';
    }
  }

  const leak_probability = growth_pattern === 'exponential' ? 
    Math.min(95, 70 + avgGrowthRate) :
    growth_pattern === 'linear' ?
      Math.min(80, 40 + avgGrowthRate * 2) :
      Math.min(30, Math.abs(avgGrowthRate) * 10);

  return {
    avgGrowthRate: +avgGrowthRate.toFixed(2),
    growth_pattern,
    leak_probability: +leak_probability.toFixed(1),
    volatility: +volatility.toFixed(2)
  };
}

/**
 * 🔬 Memory Profiler & Leak Detection System
 * 
 * Features:
 * - Heap snapshot analysis
 * - Object allocation tracking
 * - Memory leak detection with pattern analysis
 * - Automatic leak alerts via Telegram
 * - Profiling reports dengan trend analysis
 * - Integration dengan MemoryGuard
 */

import fs from "fs";
import v8 from "v8";
import { sendTelegram } from "../observability/telegram.js";
import client from "prom-client";

interface HeapSnapshot {
  timestamp: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  arrayBuffersMB: number;
  heapPercent: number;
}

interface LeakPattern {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  detectedAt: number;
}

interface MemoryTrend {
  duration: string;
  avgGrowthRate: number; // MB per minute
  growthPattern: 'stable' | 'linear' | 'exponential';
  leakProbability: number; // 0-100
}

export class MemoryProfiler {
  private snapshots: HeapSnapshot[] = [];
  private maxSnapshots = 100; // Keep last 100 snapshots
  private snapshotInterval = 60 * 1000; // 1 minute
  private interval: NodeJS.Timeout | null = null;
  private leakPatterns: LeakPattern[] = [];
  private maxLeakPatterns = 50; // MEMORY LEAK FIX: Limit leak patterns array
  private lastLeakAlert = 0;
  private alertCooldown = 15 * 60 * 1000; // 15 minutes
  private profilingEnabled = true;
  
  // Heap object tracking
  private objectCounts: Map<string, number> = new Map();
  private lastObjectCounts: Map<string, number> = new Map();
  
  // Prometheus metrics
  private gaugeHeapGrowthRate: client.Gauge;
  private gaugeLeakProbability: client.Gauge;
  private counterLeaksDetected: client.Counter;

  constructor() {
    this.gaugeHeapGrowthRate = this.getOrCreateGauge(
      "memory_profiler_heap_growth_rate_mb_per_min",
      "Heap growth rate in MB per minute"
    );
    this.gaugeLeakProbability = this.getOrCreateGauge(
      "memory_profiler_leak_probability",
      "Probability of memory leak (0-100)"
    );
    this.counterLeaksDetected = this.getOrCreateCounter(
      "memory_profiler_leaks_detected_total",
      "Total number of memory leaks detected"
    );
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

  public startProfiling() {
    if (!this.profilingEnabled) {
      console.log("🔬 Memory Profiler: Profiling disabled");
      return;
    }

    console.log("🔬 Memory Profiler: Starting heap analysis and leak detection");
    
    // Take initial snapshot
    this.takeSnapshot();
    
    // Start periodic profiling
    this.interval = setInterval(() => {
      this.takeSnapshot();
      this.detectLeaks();
    }, this.snapshotInterval);
  }

  public stopProfiling() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log("🔬 Memory Profiler: Profiling stopped");
  }

  private takeSnapshot() {
    const usage = process.memoryUsage();
    
    const snapshot: HeapSnapshot = {
      timestamp: Date.now(),
      heapUsedMB: +(usage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: +(usage.heapTotal / 1024 / 1024).toFixed(2),
      externalMB: +(usage.external / 1024 / 1024).toFixed(2),
      arrayBuffersMB: +(usage.arrayBuffers / 1024 / 1024).toFixed(2),
      heapPercent: +((usage.heapUsed / usage.heapTotal) * 100).toFixed(2)
    };

    this.snapshots.push(snapshot);

    // Maintain max snapshots limit
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Track object counts for leak detection
    this.trackObjectCounts();
  }

  private trackObjectCounts() {
    try {
      // Store previous counts
      this.lastObjectCounts = new Map(this.objectCounts);
      
      // Get current heap statistics
      const heapStats = v8.getHeapStatistics();
      
      // Track key metrics
      this.objectCounts.set('total_heap_size', heapStats.total_heap_size);
      this.objectCounts.set('used_heap_size', heapStats.used_heap_size);
      this.objectCounts.set('heap_size_limit', heapStats.heap_size_limit);
      this.objectCounts.set('malloced_memory', heapStats.malloced_memory);
      this.objectCounts.set('peak_malloced_memory', heapStats.peak_malloced_memory);
      
    } catch (error) {
      console.error("Error tracking object counts:", error);
    }
  }

  private detectLeaks() {
    if (this.snapshots.length < 5) {
      // Need at least 5 snapshots for trend analysis
      return;
    }

    const trend = this.analyzeTrend();
    const leakPatterns: LeakPattern[] = [];

    // Pattern 1: Continuous memory growth
    if (trend.growthPattern === 'linear' && trend.avgGrowthRate > 5) {
      leakPatterns.push({
        type: 'continuous_growth',
        severity: trend.avgGrowthRate > 20 ? 'critical' : trend.avgGrowthRate > 10 ? 'high' : 'medium',
        description: `Continuous memory growth detected: ${trend.avgGrowthRate.toFixed(2)} MB/min`,
        evidence: [
          `Growth pattern: ${trend.growthPattern}`,
          `Duration: ${trend.duration}`,
          `Leak probability: ${trend.leakProbability.toFixed(1)}%`
        ],
        detectedAt: Date.now()
      });
    }

    // Pattern 2: Exponential growth (critical!)
    if (trend.growthPattern === 'exponential') {
      leakPatterns.push({
        type: 'exponential_growth',
        severity: 'critical',
        description: 'Exponential memory growth detected - severe leak likely',
        evidence: [
          `Growth rate: ${trend.avgGrowthRate.toFixed(2)} MB/min (accelerating)`,
          `Duration: ${trend.duration}`,
          `Leak probability: ${trend.leakProbability.toFixed(1)}%`
        ],
        detectedAt: Date.now()
      });
    }

    // Pattern 3: High external memory
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    if (lastSnapshot.externalMB > 100 || lastSnapshot.arrayBuffersMB > 100) {
      leakPatterns.push({
        type: 'external_memory_leak',
        severity: lastSnapshot.externalMB > 200 ? 'high' : 'medium',
        description: 'High external memory usage detected',
        evidence: [
          `External memory: ${lastSnapshot.externalMB.toFixed(2)} MB`,
          `ArrayBuffers: ${lastSnapshot.arrayBuffersMB.toFixed(2)} MB`
        ],
        detectedAt: Date.now()
      });
    }

    // Pattern 4: Heap space inefficiency
    if (lastSnapshot.heapPercent < 50 && lastSnapshot.heapTotalMB > 200) {
      leakPatterns.push({
        type: 'heap_fragmentation',
        severity: 'low',
        description: 'Heap fragmentation detected - inefficient memory usage',
        evidence: [
          `Heap usage: ${lastSnapshot.heapPercent.toFixed(1)}% of ${lastSnapshot.heapTotalMB.toFixed(1)} MB`,
          `Wasted space: ${(lastSnapshot.heapTotalMB - lastSnapshot.heapUsedMB).toFixed(1)} MB`
        ],
        detectedAt: Date.now()
      });
    }

    // Update metrics
    this.gaugeHeapGrowthRate.set(trend.avgGrowthRate);
    this.gaugeLeakProbability.set(trend.leakProbability);

    // Store and alert on new leaks
    if (leakPatterns.length > 0) {
      this.leakPatterns.push(...leakPatterns);
      this.counterLeaksDetected.inc(leakPatterns.length);
      
      // Alert on critical/high severity leaks
      const criticalLeaks = leakPatterns.filter(p => p.severity === 'critical' || p.severity === 'high');
      if (criticalLeaks.length > 0) {
        this.alertLeaks(criticalLeaks);
      }
    }

    // Keep only last N leak patterns (prevent memory leak)
    if (this.leakPatterns.length > this.maxLeakPatterns) {
      this.leakPatterns = this.leakPatterns.slice(-this.maxLeakPatterns);
    }
  }

  private analyzeTrend(): MemoryTrend {
    const recentSnapshots = this.snapshots.slice(-10); // Last 10 snapshots
    const duration = recentSnapshots.length;
    
    if (duration < 2) {
      return {
        duration: `${duration}m`,
        avgGrowthRate: 0,
        growthPattern: 'stable',
        leakProbability: 0
      };
    }

    // Calculate growth rate
    const firstSnapshot = recentSnapshots[0];
    const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];
    const timeDiffMin = (lastSnapshot.timestamp - firstSnapshot.timestamp) / 60000;
    const memoryDiffMB = lastSnapshot.heapUsedMB - firstSnapshot.heapUsedMB;
    const avgGrowthRate = timeDiffMin > 0 ? memoryDiffMB / timeDiffMin : 0;

    // Detect growth pattern
    let growthPattern: 'stable' | 'linear' | 'exponential' = 'stable';
    let leakProbability = 0;

    if (avgGrowthRate > 1) {
      // Check if growth is accelerating (exponential)
      const midPoint = Math.floor(recentSnapshots.length / 2);
      const firstHalfGrowth = recentSnapshots[midPoint].heapUsedMB - firstSnapshot.heapUsedMB;
      const secondHalfGrowth = lastSnapshot.heapUsedMB - recentSnapshots[midPoint].heapUsedMB;
      
      if (secondHalfGrowth > firstHalfGrowth * 1.5) {
        growthPattern = 'exponential';
        leakProbability = Math.min(95, 70 + avgGrowthRate);
      } else {
        growthPattern = 'linear';
        leakProbability = Math.min(80, 40 + avgGrowthRate * 2);
      }
    } else if (avgGrowthRate > 0.5) {
      growthPattern = 'linear';
      leakProbability = Math.min(60, avgGrowthRate * 20);
    } else {
      leakProbability = Math.min(30, Math.abs(avgGrowthRate) * 10);
    }

    return {
      duration: `${duration}m`,
      avgGrowthRate,
      growthPattern,
      leakProbability
    };
  }

  private async alertLeaks(leaks: LeakPattern[]) {
    const now = Date.now();
    if (now - this.lastLeakAlert < this.alertCooldown) {
      return; // Cooldown active
    }

    const criticalCount = leaks.filter(l => l.severity === 'critical').length;
    const highCount = leaks.filter(l => l.severity === 'high').length;

    let message = `🔬 <b>Memory Leak Detection Alert</b>\n\n`;
    message += `🚨 Detected ${leaks.length} memory leak pattern${leaks.length > 1 ? 's' : ''}:\n`;
    message += `   • Critical: ${criticalCount}\n`;
    message += `   • High: ${highCount}\n\n`;

    for (const leak of leaks.slice(0, 3)) { // Show top 3 leaks
      message += `📊 <b>${leak.type.replace(/_/g, ' ').toUpperCase()}</b>\n`;
      message += `   Severity: ${leak.severity.toUpperCase()}\n`;
      message += `   ${leak.description}\n`;
      leak.evidence.forEach(ev => {
        message += `   • ${ev}\n`;
      });
      message += `\n`;
    }

    const trend = this.analyzeTrend();
    message += `📈 <b>Memory Trend:</b>\n`;
    message += `   Growth Rate: ${trend.avgGrowthRate.toFixed(2)} MB/min\n`;
    message += `   Pattern: ${trend.growthPattern.toUpperCase()}\n`;
    message += `   Leak Probability: ${trend.leakProbability.toFixed(1)}%\n\n`;
    message += `💡 <b>Action:</b> Review heap snapshots and consider restart if critical`;

    await sendTelegram(message);
    this.lastLeakAlert = now;
  }

  public takeHeapSnapshot(filename?: string): string {
    const snapshotFile = filename || `/tmp/heap-snapshot-${Date.now()}.heapsnapshot`;
    
    try {
      const snapshot = v8.writeHeapSnapshot(snapshotFile);
      console.log(`🔬 Heap snapshot saved: ${snapshot}`);
      return snapshot;
    } catch (error) {
      console.error("Error taking heap snapshot:", error);
      return "";
    }
  }

  public getProfilingReport() {
    const trend = this.analyzeTrend();
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const recentLeaks = this.leakPatterns.slice(-10);

    return {
      current_memory: lastSnapshot,
      trend_analysis: trend,
      recent_leaks: recentLeaks,
      total_snapshots: this.snapshots.length,
      profiling_duration_minutes: this.snapshots.length,
      leak_detection_active: this.profilingEnabled,
      recommendations: this.generateRecommendations(trend, recentLeaks)
    };
  }

  private generateRecommendations(trend: MemoryTrend, leaks: LeakPattern[]): string[] {
    const recommendations: string[] = [];

    if (trend.growthPattern === 'exponential') {
      recommendations.push('URGENT: Exponential memory growth - restart recommended immediately');
      recommendations.push('Investigate recent code changes or new features');
    }

    if (trend.avgGrowthRate > 10) {
      recommendations.push('High growth rate detected - review cache eviction policies');
      recommendations.push('Check for event listener leaks or uncleared intervals');
    }

    const criticalLeaks = leaks.filter(l => l.severity === 'critical');
    if (criticalLeaks.length > 0) {
      recommendations.push('Critical leaks detected - enable heap profiling for detailed analysis');
      recommendations.push('Take heap snapshot for offline analysis');
    }

    const externalLeaks = leaks.filter(l => l.type === 'external_memory_leak');
    if (externalLeaks.length > 0) {
      recommendations.push('High external memory - review Buffer/ArrayBuffer usage');
      recommendations.push('Check for large file operations or stream handling issues');
    }

    if (recommendations.length === 0) {
      recommendations.push('Memory usage stable - continue monitoring');
    }

    return recommendations;
  }

  public getSnapshots(): HeapSnapshot[] {
    return [...this.snapshots];
  }

  public getLeakPatterns(): LeakPattern[] {
    return [...this.leakPatterns];
  }

  public clearHistory() {
    this.snapshots = [];
    this.leakPatterns = [];
    console.log("🔬 Memory Profiler: History cleared");
  }
}

// Export singleton
export const memoryProfiler = new MemoryProfiler();

/**
 * 🧠 MemoryGuard.ts
 * SRE-Grade Autonomous Memory Management System
 * Features: Prometheus metrics, Adaptive sampling, Telegram trend summary
 */

import fs from "fs";
import client from "prom-client";
import { sendTelegram } from "../observability/telegram.js";

interface MemoryStats {
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
  heapPercent: number;
  lastGC?: string;
  lastRestart?: string;
}

interface HourlyTrend {
  hour: string;
  avgHeapMB: number;
  avgRssMB: number;
  avgHeapPercent: number;
  samples: number;
}

export class MemoryGuard {
  private interval: NodeJS.Timeout | null = null;
  private hourlyInterval: NodeJS.Timeout | null = null;
  private lastRestart = 0;
  private lastGC = 0;
  private lastAlert = 0;
  private logFile = "/tmp/memory-guard.log";
  private restartCooldown = 60 * 1000; // 1 min minimum between restarts
  private alertCooldown = 5 * 60 * 1000; // 5 min between alerts
  
  // Adaptive sampling variables
  private baseInterval = 30 * 1000; // 30s base
  private checkInterval = 30 * 1000; // Dynamic interval
  
  // Hourly trend tracking
  private hourlyStats: MemoryStats[] = [];
  
  // Prometheus Gauges for SRE-grade metrics
  private gaugeHeapUsed: client.Gauge;
  private gaugeHeapTotal: client.Gauge;
  private gaugeRSS: client.Gauge;
  private gaugeHeapPercent: client.Gauge;

  constructor() {
    // Ensure log file exists
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, `[${new Date().toISOString()}] MemoryGuard SRE-Grade initialized\n`);
    }

    // Initialize Prometheus metrics (reuse existing or create new - prevents duplicate registration)
    this.gaugeHeapUsed = this.getOrCreateGauge("memoryguard_heap_used_mb", "Heap used in MB");
    this.gaugeHeapTotal = this.getOrCreateGauge("memoryguard_heap_total_mb", "Heap total in MB");
    this.gaugeRSS = this.getOrCreateGauge("memoryguard_rss_mb", "RSS memory in MB");
    this.gaugeHeapPercent = this.getOrCreateGauge("memoryguard_heap_percent", "Heap usage percentage");

    console.log("📊 MemoryGuard: Prometheus metrics registered (SRE-grade)");
  }

  /**
   * Get existing metric or create new one (prevents duplicate registration on hot-reload)
   */
  private getOrCreateGauge(name: string, help: string): client.Gauge {
    const existing = client.register.getSingleMetric(name);
    if (existing && existing instanceof client.Gauge) {
      return existing as client.Gauge;
    }
    return new client.Gauge({ name, help });
  }

  public startMonitoring() {
    console.log(`🧠 MemoryGuard: SRE-grade monitoring started (adaptive sampling: ${this.checkInterval/1000}s)`);
    
    // Start adaptive monitoring
    this.interval = setInterval(() => this.monitor(), this.checkInterval);
    
    // Start hourly trend summary (every hour)
    this.hourlyInterval = setInterval(() => this.sendHourlyTrend(), 60 * 60 * 1000);
    
    console.log("📈 MemoryGuard: Hourly trend summary enabled");
  }

  public stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.hourlyInterval) {
      clearInterval(this.hourlyInterval);
      this.hourlyInterval = null;
    }
    console.log("🛑 MemoryGuard: Monitoring stopped");
  }

  private async monitor() {
    const usage = process.memoryUsage();
    const heapUsedMB = +(usage.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMB = +(usage.heapTotal / 1024 / 1024).toFixed(1);
    const rssMB = +(usage.rss / 1024 / 1024).toFixed(1);
    const heapPercent = +(heapUsedMB / heapTotalMB * 100).toFixed(1);

    const stats: MemoryStats = {
      heapUsedMB, 
      heapTotalMB, 
      rssMB, 
      heapPercent,
      lastGC: this.lastGC ? new Date(this.lastGC).toISOString() : "Never",
      lastRestart: this.lastRestart ? new Date(this.lastRestart).toISOString() : "Never",
    };

    // Update Prometheus metrics
    this.updatePrometheusMetrics(stats);

    // Store for hourly trend
    this.hourlyStats.push(stats);
    if (this.hourlyStats.length > 120) { // Keep max 2 hours of data
      this.hourlyStats.shift();
    }

    // Always log memory trends
    this.logMemoryTrend(stats);

    // Adaptive Sampling: Adjust interval based on memory pressure
    this.adjustSamplingInterval(heapPercent);

    // Memory management based on thresholds
    if (heapPercent > 85 && heapPercent <= 90) {
      this.triggerGC("soft");
      // Alert only if not alerted recently
      if (Date.now() - this.lastAlert > this.alertCooldown) {
        await this.sendMemoryAlert("warning", stats);
        this.lastAlert = Date.now();
      }
    } else if (heapPercent > 90 && heapPercent <= 95) {
      this.triggerGC("aggressive");
      this.clearStaleCache();
      if (Date.now() - this.lastAlert > this.alertCooldown) {
        await this.sendMemoryAlert("critical", stats);
        this.lastAlert = Date.now();
      }
    } else if (heapPercent > 95) {
      await this.gracefulRestart(stats);
    }
  }

  private updatePrometheusMetrics(stats: MemoryStats) {
    this.gaugeHeapUsed.set(stats.heapUsedMB);
    this.gaugeHeapTotal.set(stats.heapTotalMB);
    this.gaugeRSS.set(stats.rssMB);
    this.gaugeHeapPercent.set(stats.heapPercent);
  }

  private adjustSamplingInterval(heapPercent: number) {
    let newInterval = this.baseInterval;

    // Adaptive logic: faster sampling when critical
    if (heapPercent > 90) {
      newInterval = 10 * 1000; // 10s when critical
    } else if (heapPercent > 85) {
      newInterval = 20 * 1000; // 20s when warning
    } else if (heapPercent < 75) {
      newInterval = 60 * 1000; // 60s when healthy
    }

    // Only update if interval changed
    if (newInterval !== this.checkInterval) {
      this.checkInterval = newInterval;
      
      // Restart interval with new timing
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = setInterval(() => this.monitor(), this.checkInterval);
        console.log(`🔄 MemoryGuard: Adaptive sampling adjusted to ${newInterval/1000}s (heap: ${heapPercent}%)`);
      }
    }
  }

  private async sendHourlyTrend() {
    if (this.hourlyStats.length === 0) return;

    // Calculate hourly averages
    const avgHeapMB = +(this.hourlyStats.reduce((sum, s) => sum + s.heapUsedMB, 0) / this.hourlyStats.length).toFixed(1);
    const avgRssMB = +(this.hourlyStats.reduce((sum, s) => sum + s.rssMB, 0) / this.hourlyStats.length).toFixed(1);
    const avgHeapPercent = +(this.hourlyStats.reduce((sum, s) => sum + s.heapPercent, 0) / this.hourlyStats.length).toFixed(1);
    const maxHeapPercent = Math.max(...this.hourlyStats.map(s => s.heapPercent));
    const minHeapPercent = Math.min(...this.hourlyStats.map(s => s.heapPercent));

    const trend: HourlyTrend = {
      hour: new Date().toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      avgHeapMB,
      avgRssMB,
      avgHeapPercent,
      samples: this.hourlyStats.length
    };

    const message = 
      `📊 <b>Hourly Memory Trend Summary</b>\n\n` +
      `🕐 Period: ${trend.hour}\n` +
      `📈 Avg Heap: ${avgHeapPercent}% (${avgHeapMB} MB)\n` +
      `📉 Range: ${minHeapPercent}% - ${maxHeapPercent}%\n` +
      `💾 Avg RSS: ${avgRssMB} MB\n` +
      `🔬 Samples: ${trend.samples}\n\n` +
      `<i>SRE-grade observability • Auto-generated hourly</i>`;

    try {
      await sendTelegram(message);
      console.log(`✅ MemoryGuard: Hourly trend summary sent (avg: ${avgHeapPercent}%)`);
      
      // Reset hourly stats
      this.hourlyStats = [];
    } catch (error: any) {
      console.error(`❌ MemoryGuard: Failed to send hourly trend:`, error?.message);
    }
  }

  private triggerGC(level: "soft" | "aggressive") {
    if (typeof global.gc === "function") {
      global.gc();
      this.lastGC = Date.now();
      console.warn(`⚙️ MemoryGuard: ${level} GC triggered at ${(new Date()).toISOString()}`);
      fs.appendFileSync(this.logFile, `[${new Date().toISOString()}] ${level.toUpperCase()} GC triggered\n`);
    } else {
      console.warn("⚠️ Manual GC unavailable (run with --expose-gc)");
    }
  }

  private clearStaleCache() {
    try {
      // Clear global cache if exists
      if ((global as any).cache) {
        const keys = Object.keys((global as any).cache);
        if (keys.length > 100) {
          (global as any).cache = {};
          console.log("🧹 MemoryGuard: Cleared global cache");
          fs.appendFileSync(this.logFile, `[${new Date().toISOString()}] Global cache cleared (${keys.length} entries)\n`);
        }
      }
    } catch (err) {
      console.error("❌ MemoryGuard: Error clearing cache:", err);
    }
  }

  private async gracefulRestart(stats: MemoryStats) {
    const now = Date.now();
    if (now - this.lastRestart < this.restartCooldown) {
      console.log("🕐 MemoryGuard: Restart cooldown active, skipping...");
      return;
    }

    console.warn("🚨 MemoryGuard: High memory detected (>95%) — initiating graceful restart...");
    
    // Send critical alert before restart
    await this.sendMemoryAlert("restart", stats);
    
    // Persistent log with flush
    const logEntry = `[${new Date().toISOString()}] RESTART triggered - Heap ${stats.heapPercent}%\n`;
    try {
      fs.appendFileSync(this.logFile, logEntry);
      fs.fsyncSync(fs.openSync(this.logFile, 'r+')); // Force flush to disk
    } catch (err) {
      console.error("Failed to persist restart log:", err);
    }
    
    this.lastRestart = now;

    // Graceful shutdown - Replit process manager will auto-restart
    console.log("🔄 MemoryGuard: Exiting process for automatic restart by supervisor...");
    setTimeout(() => {
      process.exit(1); // Exit with error code to trigger supervisor restart
    }, 1000);
  }

  private async sendMemoryAlert(level: "warning" | "critical" | "restart", stats: MemoryStats) {
    let emoji = "⚠️";
    let title = "Memory Warning";
    let action = "GC triggered";

    if (level === "critical") {
      emoji = "🚨";
      title = "Critical Memory Alert";
      action = "Aggressive GC + Cache cleanup";
    } else if (level === "restart") {
      emoji = "🔄";
      title = "Auto-Restart Initiated";
      action = "Process restarting to prevent crash";
    }

    const message = 
      `${emoji} <b>${title}</b>\n\n` +
      `📊 Heap Usage: <b>${stats.heapPercent}%</b>\n` +
      `💾 Memory: ${stats.heapUsedMB}/${stats.heapTotalMB} MB\n` +
      `📈 RSS: ${stats.rssMB} MB\n` +
      `⚙️ Action: ${action}\n` +
      `🔬 Sampling: ${this.checkInterval/1000}s (adaptive)\n` +
      `🕐 Time: ${new Date().toLocaleString()}\n\n` +
      `<i>SRE-grade MemoryGuard auto-managing resources</i>`;

    try {
      await sendTelegram(message);
      console.log(`✅ MemoryGuard: ${level} alert sent to Telegram`);
    } catch (error: any) {
      console.error(`❌ MemoryGuard: Failed to send ${level} alert:`, error?.message);
    }
  }

  private logMemoryTrend(stats: MemoryStats) {
    const msg = `[${new Date().toISOString()}] Heap ${stats.heapUsedMB}/${stats.heapTotalMB} MB (${stats.heapPercent}%), RSS ${stats.rssMB} MB, Interval ${this.checkInterval/1000}s\n`;
    try {
      fs.appendFileSync(this.logFile, msg);
    } catch (err) {
      // Fail silently to prevent log errors from affecting monitoring
    }
  }

  public getStats(): MemoryStats {
    const usage = process.memoryUsage();
    return {
      heapUsedMB: +(usage.heapUsed / 1024 / 1024).toFixed(1),
      heapTotalMB: +(usage.heapTotal / 1024 / 1024).toFixed(1),
      rssMB: +(usage.rss / 1024 / 1024).toFixed(1),
      heapPercent: +((usage.heapUsed / usage.heapTotal) * 100).toFixed(1),
      lastGC: this.lastGC ? new Date(this.lastGC).toISOString() : "Never",
      lastRestart: this.lastRestart ? new Date(this.lastRestart).toISOString() : "Never",
    };
  }
}

// Export singleton instance
export const memoryGuard = new MemoryGuard();

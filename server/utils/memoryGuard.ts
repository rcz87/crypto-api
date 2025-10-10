/**
 * 🧠 MemoryGuard v2 – Safe Restart Edition with Telegram Integration
 * Features:
 *  - Grace period on startup/module change (5 minutes)
 *  - Safe exit(0) restart (no workflow fail)
 *  - Smart warm-up detection
 *  - Telegram alerts with warm-up suppression notices
 *  - Prometheus metrics for SRE-grade monitoring
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

export class MemoryGuard {
  private interval: NodeJS.Timeout | null = null;
  private lastRestart = 0;
  private lastGC = 0;
  private lastAlert = 0;
  private lastModuleChange = Date.now(); // Used for grace period
  private logFile = "/tmp/memory-guard.log";
  private restartCooldown = 60 * 1000; // 1 min between restarts
  private alertCooldown = 5 * 60 * 1000; // 5 min between alerts
  private gracePeriod = 5 * 60 * 1000; // 5 minutes warm-up grace period
  private startTime = Date.now();
  
  // Adaptive sampling
  private baseInterval = 30 * 1000; // 30s base
  private checkInterval = 30 * 1000; // Dynamic interval

  // Prometheus Gauges
  private gaugeHeapUsed: client.Gauge;
  private gaugeHeapTotal: client.Gauge;
  private gaugeRSS: client.Gauge;
  private gaugeHeapPercent: client.Gauge;

  constructor() {
    // Ensure log file exists
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, `[${new Date().toISOString()}] MemoryGuard v2 initialized\n`);
    }

    // Initialize Prometheus metrics
    this.gaugeHeapUsed = this.getOrCreateGauge("memoryguard_heap_used_mb", "Heap used in MB");
    this.gaugeHeapTotal = this.getOrCreateGauge("memoryguard_heap_total_mb", "Heap total in MB");
    this.gaugeRSS = this.getOrCreateGauge("memoryguard_rss_mb", "RSS memory in MB");
    this.gaugeHeapPercent = this.getOrCreateGauge("memoryguard_heap_percent", "Heap usage percentage");

    this.log("📊 MemoryGuard v2: Prometheus metrics registered");
  }

  /** Called when a new module or feature is added */
  public registerModuleChange() {
    this.lastModuleChange = Date.now();
    this.log("🧩 Module change detected — grace period reset (5m)");
  }

  private getOrCreateGauge(name: string, help: string): client.Gauge {
    const existing = client.register.getSingleMetric(name);
    if (existing && existing instanceof client.Gauge) {
      return existing as client.Gauge;
    }
    return new client.Gauge({ name, help });
  }

  public startMonitoring() {
    this.log("🧠 MemoryGuard v2: SRE-grade monitoring started (adaptive sampling: 30s, safe restart mode)");
    
    // Run first check immediately
    this.monitor().catch(err => this.log(`Initial monitor failed: ${err}`));
    
    // Start monitoring loop
    this.interval = setInterval(() => this.monitor(), this.checkInterval);
  }

  public stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.log("🛑 MemoryGuard: Monitoring stopped");
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
    this.gaugeHeapUsed.set(heapUsedMB);
    this.gaugeHeapTotal.set(heapTotalMB);
    this.gaugeRSS.set(rssMB);
    this.gaugeHeapPercent.set(heapPercent);

    // Adaptive sampling based on heap usage
    if (heapPercent > 90 && this.checkInterval !== 10 * 1000) {
      this.checkInterval = 10 * 1000;
      this.log(`🔄 MemoryGuard: Adaptive sampling adjusted to 10s (heap: ${heapPercent}%)`);
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = setInterval(() => this.monitor(), this.checkInterval);
      }
    } else if (heapPercent <= 85 && this.checkInterval !== this.baseInterval) {
      this.checkInterval = this.baseInterval;
      this.log(`🔄 MemoryGuard: Adaptive sampling reset to 30s (heap: ${heapPercent}%)`);
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = setInterval(() => this.monitor(), this.checkInterval);
      }
    }

    await this.evaluateThresholds(stats);
  }

  private async evaluateThresholds(stats: MemoryStats) {
    const heap = stats.heapPercent;
    const now = Date.now();
    const uptime = now - this.startTime;
    const gracePeriodActive = now - this.lastModuleChange < this.gracePeriod;

    // Grace period check (first 5 minutes or after module changes)
    if (gracePeriodActive) {
      const remainingMinutes = Math.ceil((this.gracePeriod - (now - this.lastModuleChange)) / 60000);
      this.log(`⏳ Warm-up phase active — suppressing restart actions (${remainingMinutes}m remaining)`);
      
      // Send Telegram alert if heap is high during warm-up (once per grace period)
      if (heap > 90 && now - this.lastAlert > this.alertCooldown) {
        await sendTelegram(
          `⏳ <b>MemoryGuard Warm-Up Phase</b>\n\n` +
          `🔥 High memory detected during warm-up:\n` +
          `📊 Heap: ${stats.heapUsedMB}/${stats.heapTotalMB} MB (${heap}%)\n` +
          `💾 RSS: ${stats.rssMB} MB\n\n` +
          `✅ Restart suppressed for ${remainingMinutes} more minutes\n` +
          `🛡️ System stabilizing...`
        );
        this.lastAlert = now;
      }
      return;
    }

    // Threshold-based actions
    if (heap > 85 && heap <= 90) {
      this.triggerGC("soft");
      // Alert only once per cooldown
      if (now - this.lastAlert > this.alertCooldown) {
        await sendTelegram(
          `⚠️ <b>MemoryGuard Warning</b>\n\n` +
          `📊 Heap: ${stats.heapUsedMB}/${stats.heapTotalMB} MB (${heap}%)\n` +
          `🔧 Action: Soft GC triggered\n` +
          `⏱️ Uptime: ${Math.floor(uptime / 1000 / 60)}m`
        );
        this.lastAlert = now;
      }
    } else if (heap > 90 && heap <= 95) {
      this.triggerGC("aggressive");
      this.clearStaleCache();
      // Critical alert
      if (now - this.lastAlert > this.alertCooldown) {
        await sendTelegram(
          `🚨 <b>MemoryGuard Critical</b>\n\n` +
          `📊 Heap: ${stats.heapUsedMB}/${stats.heapTotalMB} MB (${heap}%)\n` +
          `💾 RSS: ${stats.rssMB} MB\n` +
          `🔧 Action: Aggressive GC + cache clear\n` +
          `⏱️ Uptime: ${Math.floor(uptime / 1000 / 60)}m`
        );
        this.lastAlert = now;
      }
    } else if (heap > 95) {
      await this.gracefulRestart();
    }
  }

  private triggerGC(level: "soft" | "aggressive") {
    if (typeof global.gc === "function") {
      global.gc();
      this.lastGC = Date.now();
      this.log(`⚙️ ${level.toUpperCase()} GC triggered`);
    } else {
      this.log("⚠️ Manual GC unavailable (run with --expose-gc)");
    }
  }

  private clearStaleCache() {
    try {
      const globalAny = global as any;
      if (globalAny.cache) {
        const keys = Object.keys(globalAny.cache);
        if (keys.length > 100) {
          globalAny.cache = {};
          this.log("🧹 Cleared global cache");
        }
      }
    } catch (err) {
      this.log(`Error clearing cache: ${err}`);
    }
  }

  /** Graceful restart without triggering workflow failure */
  private async gracefulRestart() {
    const now = Date.now();
    if (now - this.lastRestart < this.restartCooldown) return;

    this.log("🚨 High memory (>95%) — initiating graceful restart (safe exit mode)");
    this.lastRestart = now;

    const usage = process.memoryUsage();
    const heapUsedMB = +(usage.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMB = +(usage.heapTotal / 1024 / 1024).toFixed(1);
    const heapPercent = +(heapUsedMB / heapTotalMB * 100).toFixed(1);

    // Send Telegram restart alert
    await sendTelegram(
      `🔄 <b>MemoryGuard Auto-Restart</b>\n\n` +
      `🚨 Memory threshold exceeded:\n` +
      `📊 Heap: ${heapUsedMB}/${heapTotalMB} MB (${heapPercent}%)\n\n` +
      `✅ Safe restart initiated (exit code 0)\n` +
      `🛡️ System will auto-recover in ~10s`
    );

    fs.appendFileSync(this.logFile, `[${new Date().toISOString()}] Graceful restart initiated\n`);

    // Exit cleanly (code 0 → workflow success, supervisor auto-restarts)
    setTimeout(() => {
      this.log("🔄 Exiting process with code 0 — workflow safe restart");
      process.exit(0);
    }, 1500);
  }

  private log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(line.trim());
    try {
      fs.appendFileSync(this.logFile, line);
    } catch (err) {
      console.error("Failed to write to log:", err);
    }
  }

  /** Get current memory stats for health endpoint */
  public getStats(): MemoryStats {
    const usage = process.memoryUsage();
    const heapUsedMB = +(usage.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotalMB = +(usage.heapTotal / 1024 / 1024).toFixed(1);
    const rssMB = +(usage.rss / 1024 / 1024).toFixed(1);
    const heapPercent = +(heapUsedMB / heapTotalMB * 100).toFixed(1);

    return {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      heapPercent,
      lastGC: this.lastGC ? new Date(this.lastGC).toISOString() : "Never",
      lastRestart: this.lastRestart ? new Date(this.lastRestart).toISOString() : "Never",
    };
  }
}

// Export singleton instance
export const memoryGuard = new MemoryGuard();

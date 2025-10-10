/**
 * 🧠 MemoryGuard.ts
 * Autonomous Memory Management System
 * Integrated with Telegram alerts for proactive monitoring
 */

import fs from "fs";
import { exec } from "child_process";
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
  private logFile = "/tmp/memory-guard.log";
  private restartCooldown = 60 * 1000; // 1 min minimum between restarts
  private alertCooldown = 5 * 60 * 1000; // 5 min between alerts

  constructor(private checkInterval = 30 * 1000) {
    // Ensure log file exists
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, `[${new Date().toISOString()}] MemoryGuard initialized\n`);
    }
  }

  public startMonitoring() {
    console.log("🧠 MemoryGuard: Monitoring started (interval 30s)");
    this.interval = setInterval(() => this.monitor(), this.checkInterval);
  }

  public stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log("🛑 MemoryGuard: Monitoring stopped");
    }
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

    // Always log memory trends
    this.logMemoryTrend(stats);

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

    console.warn("🚨 MemoryGuard: High memory detected (>95%) — restarting process...");
    
    // Send critical alert before restart
    await this.sendMemoryAlert("restart", stats);
    
    fs.appendFileSync(this.logFile, `[${new Date().toISOString()}] RESTART triggered - Heap ${stats.heapPercent}%\n`);
    this.lastRestart = now;

    // Give time for alert to send
    setTimeout(() => {
      exec("kill 1", (err) => {
        if (err) console.error("❌ MemoryGuard: Failed to restart:", err);
      });
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
      `🕐 Time: ${new Date().toLocaleString()}\n\n` +
      `<i>MemoryGuard auto-managing system resources</i>`;

    try {
      await sendTelegram(message);
      console.log(`✅ MemoryGuard: ${level} alert sent to Telegram`);
    } catch (error: any) {
      console.error(`❌ MemoryGuard: Failed to send ${level} alert:`, error?.message);
    }
  }

  private logMemoryTrend(stats: MemoryStats) {
    const msg = `[${new Date().toISOString()}] Heap ${stats.heapUsedMB}/${stats.heapTotalMB} MB (${stats.heapPercent}%), RSS ${stats.rssMB} MB\n`;
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

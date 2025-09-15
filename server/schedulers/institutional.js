/**
 * 🕒 Institutional Alert Scheduler
 * Runs institutional bias and sniper timing checks on regular intervals
 * Enhanced with unified rate budget coordination to prevent API conflicts
 */

import cron from "node-cron";
import { runInstitutionalBiasAlert, runSOLSniperAlert } from "../services/alphaRules.js";
import { checkQuota, consumeQuota, getAllBudgetStatus } from "../services/rateBudget.ts";

// Track scheduler status with separate locks per job
let institutionalRunning = false;
let sniperRunning = false;
let lastInstitutionalRun = null;
let lastSniperRun = null;
let alertStats = {
  institutional: { total: 0, triggered: 0 },
  sniper: { total: 0, triggered: 0 }
};

/**
 * 🎯 Institutional Bias Alert (every 5 minutes)
 */
export function startInstitutionalScheduler() {
  console.log("🕒 Starting Institutional Bias Scheduler (5min intervals)");
  
  const biasScheduler = cron.schedule("*/5 * * * *", async () => {
    if (institutionalRunning) {
      console.log("⏳ Previous institutional check still running, skipping...");
      return;
    }
    
    institutionalRunning = true;
    lastInstitutionalRun = new Date();
    
    try {
      // Check rate budget before making CoinGlass API calls
      const quotaCheck = checkQuota('coinglass', 'scheduler');
      if (!quotaCheck.available) {
        console.warn(`⚠️ [SCHEDULER] Rate limit exceeded for CoinGlass. Reset in ${Math.ceil(quotaCheck.status.resetIn / 1000)}s`);
        return;
      }

      console.log("🔍 [SCHEDULER] Running institutional bias check...");
      
      // Consume quota before making API calls
      const consumeResult = consumeQuota('coinglass', 'scheduler', 3); // Institutional check uses ~3 API calls
      if (!consumeResult.success) {
        console.warn(`⚠️ [SCHEDULER] Unable to consume rate quota: ${consumeResult.violation?.provider}`);
        return;
      }

      const result = await runInstitutionalBiasAlert();
      
      alertStats.institutional.total++;
      if (result.triggered) {
        alertStats.institutional.triggered++;
      }
      
      console.log(`📊 Institutional Alert Stats: ${alertStats.institutional.triggered}/${alertStats.institutional.total} triggered`);
      console.log(`🔋 Rate budget remaining: ${consumeResult.status.remaining}/${consumeResult.status.allocated}`);
      
    } catch (error) {
      console.error("❌ [SCHEDULER] Institutional bias check failed:", error.message);
    } finally {
      institutionalRunning = false;
    }
  });
  
  // Don't start immediately
  biasScheduler.start();
  return biasScheduler;
}

/**
 * 🎯 SOL Sniper Timing Alert (every 3 minutes during market hours)
 */
export function startSniperScheduler() {
  console.log("🎯 Starting SOL Sniper Scheduler (3min intervals)");
  
  const sniperScheduler = cron.schedule("*/3 * * * *", async () => {
    // Only run during active trading hours (UTC)
    const hour = new Date().getUTCHours();
    const isActiveHours = (hour >= 13 && hour <= 21); // 13:00-21:00 UTC (8am-4pm EST)
    
    if (!isActiveHours) {
      return; // Skip during low-activity hours
    }
    
    if (sniperRunning) {
      console.log("⏳ Previous sniper check still running, skipping...");
      return;
    }
    
    sniperRunning = true;
    lastSniperRun = new Date();
    
    try {
      console.log("🎯 [SCHEDULER] Running SOL sniper timing check...");
      const result = await runSOLSniperAlert();
      
      alertStats.sniper.total++;
      if (result.triggered) {
        alertStats.sniper.triggered++;
      }
      
      console.log(`📊 Sniper Alert Stats: ${alertStats.sniper.triggered}/${alertStats.sniper.total} triggered`);
      
    } catch (error) {
      console.error("❌ [SCHEDULER] SOL sniper check failed:", error.message);
    } finally {
      sniperRunning = false;
    }
  });
  
  sniperScheduler.start();
  return sniperScheduler;
}

/**
 * 📊 Get scheduler status and statistics
 */
export function getSchedulerStatus() {
  return {
    institutional: {
      isRunning: institutionalRunning,
      lastRun: lastInstitutionalRun,
      uptime: lastInstitutionalRun ? Date.now() - lastInstitutionalRun.getTime() : 0
    },
    sniper: {
      isRunning: sniperRunning,
      lastRun: lastSniperRun,
      uptime: lastSniperRun ? Date.now() - lastSniperRun.getTime() : 0
    },
    stats: alertStats
  };
}

/**
 * 🛑 Stop all schedulers
 */
export function stopSchedulers() {
  console.log("🛑 Stopping all institutional schedulers...");
  // Schedulers will be stopped by their returned objects
}
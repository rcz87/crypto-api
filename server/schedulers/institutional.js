/**
 * 🕒 Adaptive Institutional Alert Scheduler
 * Runs institutional bias and sniper timing checks with intelligent backoff
 * Enhanced with exponential backoff, jitter, and self-healing mechanisms
 */

import { runInstitutionalBiasAlert, runSOLSniperAlert } from "../services/alphaRules.js";
import { checkQuota, consumeQuota, getAllBudgetStatus } from "../services/rateBudget.js";
import { createInstitutionalScheduler, createSniperScheduler } from "./AdaptiveScheduler.js";

// Adaptive scheduler instances
let institutionalScheduler = null;
let sniperScheduler = null;

// Enhanced tracking with adaptive metrics
let alertStats = {
  institutional: { 
    total: 0, 
    triggered: 0, 
    rateLimitErrors: 0,
    consecutiveFailures: 0,
    avgBackoffTime: 0
  },
  sniper: { 
    total: 0, 
    triggered: 0, 
    rateLimitErrors: 0,
    consecutiveFailures: 0,
    avgBackoffTime: 0
  }
};

/**
 * 🎯 Adaptive Institutional Bias Alert Scheduler
 */
export function startInstitutionalScheduler() {
  console.log("🕒 Starting Adaptive Institutional Bias Scheduler");
  
  // Create adaptive institutional task
  const institutionalTask = async () => {
    return await runInstitutionalBiasTask();
  };
  
  // Create and start adaptive scheduler
  institutionalScheduler = createInstitutionalScheduler(institutionalTask);
  institutionalScheduler.start();
  
  return institutionalScheduler;
}

/**
 * 🧠 Institutional Bias Task with Enhanced Error Handling
 */
async function runInstitutionalBiasTask() {
  const result = {
    success: false,
    error: null,
    isRateLimit: false,
    shouldBackoff: true,
    data: null
  };
  
  try {
    // Check rate budget before making CoinGlass API calls
    const quotaCheck = checkQuota('coinglass', 'scheduler');
    if (!quotaCheck.available) {
      console.warn(`⚠️ [SCHEDULER] Rate budget exhausted. Reset in ${Math.ceil(quotaCheck.status.resetIn / 1000)}s`);
      return {
        success: false,
        error: new Error(`Rate budget exhausted. Reset in ${Math.ceil(quotaCheck.status.resetIn / 1000)}s`),
        isRateLimit: true,
        shouldBackoff: true
      };
    }

    console.log("🔍 [SCHEDULER] Running institutional bias check...");
    
    // Consume quota before making API calls  
    const consumeResult = consumeQuota('coinglass', 'scheduler', 3); // Institutional check uses ~3 API calls
    if (!consumeResult.success) {
      console.warn(`⚠️ [SCHEDULER] Unable to consume rate quota: ${consumeResult.violation?.provider}`);
      return {
        success: false,
        error: new Error(`Rate quota consumption failed: ${consumeResult.violation?.provider}`),
        isRateLimit: true,
        shouldBackoff: true
      };
    }

    // Execute the institutional bias alert
    const alertResult = await runInstitutionalBiasAlert();
    
    // Update stats
    alertStats.institutional.total++;
    if (alertResult.triggered) {
      alertStats.institutional.triggered++;
    }
    
    // Check if we got an error from the alert
    if (alertResult.error) {
      throw new Error(alertResult.error);
    }
    
    console.log(`📊 Institutional Alert Stats: ${alertStats.institutional.triggered}/${alertStats.institutional.total} triggered`);
    console.log(`🔋 Rate budget remaining: ${consumeResult.status.remaining}/${consumeResult.status.allocated}`);
    
    return {
      success: true,
      data: alertResult,
      isRateLimit: false,
      shouldBackoff: false
    };
    
  } catch (error) {
    console.error("❌ [SCHEDULER] Institutional bias check failed:", error.message);
    
    // Detect rate limit errors
    const isRateLimit = error.status === 429 || 
                       error.isRateLimit || 
                       error.message.includes('429') ||
                       error.message.includes('Too Many Requests') ||
                       error.message.includes('Rate limit');
    
    if (isRateLimit) {
      alertStats.institutional.rateLimitErrors++;
      alertStats.institutional.consecutiveFailures++;
      console.warn(`⚠️ [SCHEDULER] Rate limit detected (total: ${alertStats.institutional.rateLimitErrors})`);
    }
    
    return {
      success: false,
      error: error,
      isRateLimit: isRateLimit,
      shouldBackoff: true
    };
  }
}

/**
 * 🎯 Adaptive SOL Sniper Timing Alert Scheduler
 */
export function startSniperScheduler() {
  console.log("🎯 Starting Adaptive SOL Sniper Scheduler");
  
  // Create adaptive sniper task
  const sniperTask = async () => {
    return await runSOLSniperTask();
  };
  
  // Create and start adaptive scheduler
  sniperScheduler = createSniperScheduler(sniperTask);
  sniperScheduler.start();
  
  return sniperScheduler;
}

/**
 * 🎯 SOL Sniper Task with Enhanced Error Handling
 */
async function runSOLSniperTask() {
  try {
    // Only run during active trading hours (UTC)
    const hour = new Date().getUTCHours();
    const isActiveHours = (hour >= 13 && hour <= 21); // 13:00-21:00 UTC (8am-4pm EST)
    
    if (!isActiveHours) {
      console.log("🕒 [SCHEDULER] Outside active trading hours, skipping SOL sniper check");
      return {
        success: true,
        data: { skipped: true, reason: "Outside trading hours" },
        isRateLimit: false,
        shouldBackoff: false
      };
    }

    console.log("🎯 [SCHEDULER] Running SOL sniper timing check...");
    
    // Execute the SOL sniper alert
    const alertResult = await runSOLSniperAlert();
    
    // Update stats
    alertStats.sniper.total++;
    if (alertResult.triggered) {
      alertStats.sniper.triggered++;
    }
    
    // Check if we got an error from the alert
    if (alertResult.error) {
      throw new Error(alertResult.error);
    }
    
    console.log(`📊 Sniper Alert Stats: ${alertStats.sniper.triggered}/${alertStats.sniper.total} triggered`);
    
    return {
      success: true,
      data: alertResult,
      isRateLimit: false,
      shouldBackoff: false
    };
    
  } catch (error) {
    console.error("❌ [SCHEDULER] SOL sniper check failed:", error.message);
    
    // Detect rate limit errors
    const isRateLimit = error.status === 429 || 
                       error.isRateLimit || 
                       error.message.includes('429') ||
                       error.message.includes('Too Many Requests') ||
                       error.message.includes('Rate limit');
    
    if (isRateLimit) {
      alertStats.sniper.rateLimitErrors++;
      alertStats.sniper.consecutiveFailures++;
      console.warn(`⚠️ [SCHEDULER] SOL Sniper rate limit detected (total: ${alertStats.sniper.rateLimitErrors})`);
    }
    
    return {
      success: false,
      error: error,
      isRateLimit: isRateLimit,
      shouldBackoff: true
    };
  }
}

/**
 * 📊 Get enhanced adaptive scheduler status and statistics
 */
export function getSchedulerStatus() {
  const institutionalState = institutionalScheduler?.getState();
  const sniperState = sniperScheduler?.getState();
  
  return {
    institutional: {
      isRunning: institutionalScheduler !== null,
      isHealthy: institutionalState?.isHealthy ?? true,
      lastRun: institutionalState?.lastRunAt ? new Date(institutionalState.lastRunAt) : null,
      nextRun: institutionalState?.nextRunAt ? new Date(institutionalState.nextRunAt) : null,
      currentBackoff: institutionalState?.currentBackoff ?? 0,
      consecutiveFailures: institutionalState?.consecutiveFailures ?? 0,
      totalRuns: institutionalState?.totalRuns ?? 0,
      successfulRuns: institutionalState?.successfulRuns ?? 0,
      failedRuns: institutionalState?.failedRuns ?? 0,
      rateLimitErrors: institutionalState?.rateLimitErrors ?? 0,
      uptime: institutionalState?.lastRunAt ? Date.now() - institutionalState.lastRunAt : 0,
      config: institutionalState?.config
    },
    sniper: {
      isRunning: sniperScheduler !== null,
      isHealthy: sniperState?.isHealthy ?? true,
      lastRun: sniperState?.lastRunAt ? new Date(sniperState.lastRunAt) : null,
      nextRun: sniperState?.nextRunAt ? new Date(sniperState.nextRunAt) : null,
      currentBackoff: sniperState?.currentBackoff ?? 0,
      consecutiveFailures: sniperState?.consecutiveFailures ?? 0,
      totalRuns: sniperState?.totalRuns ?? 0,
      successfulRuns: sniperState?.successfulRuns ?? 0,
      failedRuns: sniperState?.failedRuns ?? 0,
      rateLimitErrors: sniperState?.rateLimitErrors ?? 0,
      uptime: sniperState?.lastRunAt ? Date.now() - sniperState.lastRunAt : 0,
      config: sniperState?.config
    },
    stats: alertStats,
    overall: {
      healthScore: calculateHealthScore(),
      totalRateLimitErrors: alertStats.institutional.rateLimitErrors + alertStats.sniper.rateLimitErrors,
      isAdaptive: true
    }
  };
}

/**
 * 🛑 Stop all adaptive schedulers
 */
export function stopSchedulers() {
  console.log("🛑 Stopping all adaptive institutional schedulers...");
  
  if (institutionalScheduler) {
    institutionalScheduler.stop();
    institutionalScheduler = null;
    console.log("✅ Institutional scheduler stopped");
  }
  
  if (sniperScheduler) {
    sniperScheduler.stop();
    sniperScheduler = null;
    console.log("✅ Sniper scheduler stopped");
  }
}

/**
 * 🔄 Reset scheduler states (useful for recovery)
 */
export function resetSchedulers() {
  console.log("🔄 Resetting scheduler states...");
  
  if (institutionalScheduler) {
    institutionalScheduler.reset();
  }
  
  if (sniperScheduler) {
    sniperScheduler.reset();
  }
  
  // Reset local stats
  alertStats = {
    institutional: { 
      total: 0, 
      triggered: 0, 
      rateLimitErrors: 0,
      consecutiveFailures: 0,
      avgBackoffTime: 0
    },
    sniper: { 
      total: 0, 
      triggered: 0, 
      rateLimitErrors: 0,
      consecutiveFailures: 0,
      avgBackoffTime: 0
    }
  };
  
  console.log("✅ All scheduler states reset");
}

/**
 * 📊 Calculate overall health score based on scheduler performance
 */
function calculateHealthScore() {
  let score = 100;
  
  // Get scheduler states
  const institutionalState = institutionalScheduler?.getState();
  const sniperState = sniperScheduler?.getState();
  
  // Penalize for consecutive failures
  if (institutionalState?.consecutiveFailures > 0) {
    score -= institutionalState.consecutiveFailures * 5;
  }
  
  if (sniperState?.consecutiveFailures > 0) {
    score -= sniperState.consecutiveFailures * 5;
  }
  
  // Penalize for high rate limit errors
  const totalRateErrors = alertStats.institutional.rateLimitErrors + alertStats.sniper.rateLimitErrors;
  score -= totalRateErrors * 2;
  
  // Penalize for unhealthy schedulers
  if (institutionalState && !institutionalState.isHealthy) {
    score -= 20;
  }
  
  if (sniperState && !sniperState.isHealthy) {
    score -= 20;
  }
  
  // Calculate success rates
  const institutionalSuccessRate = institutionalState?.totalRuns > 0 ? 
    (institutionalState.successfulRuns / institutionalState.totalRuns) * 100 : 100;
  const sniperSuccessRate = sniperState?.totalRuns > 0 ? 
    (sniperState.successfulRuns / sniperState.totalRuns) * 100 : 100;
  
  // Factor in success rates
  score = (score + institutionalSuccessRate + sniperSuccessRate) / 3;
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * ⚡ Force run scheduler (useful for testing)
 */
export function forceRunInstitutional() {
  console.log("⚡ Force running institutional scheduler...");
  if (institutionalScheduler) {
    // This would trigger immediate execution
    return runInstitutionalBiasTask();
  }
  throw new Error("Institutional scheduler not running");
}

export function forceRunSniper() {
  console.log("⚡ Force running sniper scheduler...");
  if (sniperScheduler) {
    return runSOLSniperTask();
  }
  throw new Error("Sniper scheduler not running");
}
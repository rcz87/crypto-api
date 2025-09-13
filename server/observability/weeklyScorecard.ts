/**
 * Event Logging System - Weekly Scorecard
 * 
 * Generates and sends weekly performance reports with:
 * - Winrate analysis by confluence score bins
 * - Monotonicity check (higher bins should have higher winrates)
 * - Telegram reporting
 * 
 * All operations use Asia/Jakarta timezone for consistency.
 */

import { getCurrentWeekStart, getWeeklyWinrateByBins, upsertWeeklyScorecard, getDatabaseStats } from './eventIngestor.js';
import { sendWeeklyScorecardReport, sendSystemAlert } from './telegram.js';

export interface WeeklyScorecardResult {
  week_start: string;
  bins: Record<string, { n: number; winrate: number }>;
  monotonic_ok: boolean;
  total_signals: number;
  best_bin?: string;
  worst_bin?: string;
  avg_confluence?: number;
}

/**
 * Format number for display (handle null/undefined gracefully)
 */
function formatNumber(n: number | null | undefined, decimals: number = 3): string {
  return (n == null) ? '-' : Number(n).toFixed(decimals);
}

/**
 * Check monotonicity of winrates across bins
 * Higher confluence bins should have higher or equal winrates
 */
function checkMonotonicity(bins: Record<string, { n: number; winrate: number }>): boolean {
  const binOrder = ['0.50-0.59', '0.60-0.69', '0.70-0.79', '0.80+'];
  
  for (let i = 0; i < binOrder.length - 1; i++) {
    const currentBin = bins[binOrder[i]];
    const nextBin = bins[binOrder[i + 1]];
    
    // Skip comparison if either bin has no data
    if (!currentBin || !nextBin || currentBin.n === 0 || nextBin.n === 0) {
      continue;
    }
    
    // Check if higher bin has lower winrate (violation)
    if (nextBin.winrate < currentBin.winrate) {
      console.log(`Monotonicity violation: ${binOrder[i]} (${formatNumber(currentBin.winrate)}) > ${binOrder[i + 1]} (${formatNumber(nextBin.winrate)})`);
      return false;
    }
  }
  
  return true;
}

/**
 * Find best and worst performing bins
 */
function analyzeBinPerformance(bins: Record<string, { n: number; winrate: number }>): {
  best?: string;
  worst?: string;
  avg_confluence?: number;
} {
  let bestBin: string | undefined;
  let worstBin: string | undefined;
  let maxWinrate = -1;
  let minWinrate = 2; // Start above 1 to handle empty bins
  
  const binsWithData = Object.entries(bins).filter(([_, data]) => data.n > 0);
  
  for (const [binLabel, data] of binsWithData) {
    if (data.winrate > maxWinrate) {
      maxWinrate = data.winrate;
      bestBin = binLabel;
    }
    if (data.winrate < minWinrate) {
      minWinrate = data.winrate;
      worstBin = binLabel;
    }
  }
  
  // Calculate average confluence score (estimated from bin midpoints)
  const binMidpoints: Record<string, number> = {
    '0.50-0.59': 0.545,
    '0.60-0.69': 0.645,
    '0.70-0.79': 0.745,
    '0.80+': 0.85, // Estimate for 0.80+
  };
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const [binLabel, data] of binsWithData) {
    const midpoint = binMidpoints[binLabel];
    if (midpoint && data.n > 0) {
      weightedSum += midpoint * data.n;
      totalWeight += data.n;
    }
  }
  
  const avgConfluence = totalWeight > 0 ? weightedSum / totalWeight : undefined;
  
  return {
    best: bestBin,
    worst: worstBin,
    avg_confluence: avgConfluence,
  };
}

/**
 * Generate weekly scorecard report
 */
export async function generateWeeklyScorecard(): Promise<WeeklyScorecardResult> {
  try {
    console.log('🔄 Generating weekly scorecard...');
    
    // Get current week start in Asia/Jakarta timezone
    const weekStart = await getCurrentWeekStart();
    console.log(`Week start: ${weekStart} (Asia/Jakarta)`);
    
    // Get winrate data by confluence bins
    const bins = await getWeeklyWinrateByBins(weekStart);
    console.log('Winrate by bins:', bins);
    
    // Check monotonicity
    const monotonicOk = checkMonotonicity(bins);
    console.log(`Monotonicity check: ${monotonicOk ? 'PASS' : 'FAIL'}`);
    
    // Analyze bin performance
    const analysis = analyzeBinPerformance(bins);
    console.log('Bin analysis:', analysis);
    
    // Get additional database stats
    const stats = await getDatabaseStats();
    
    // Save to database
    await upsertWeeklyScorecard(weekStart, bins, monotonicOk);
    console.log('✅ Weekly scorecard saved to database');
    
    // Send Telegram report
    const telegramSent = await sendWeeklyScorecardReport(
      weekStart, 
      bins, 
      monotonicOk,
      {
        totalSignals: stats.current_week_signals,
        avgConfluence: analysis.avg_confluence,
        bestBin: analysis.best,
        worstBin: analysis.worst,
      }
    );
    
    if (telegramSent) {
      console.log('✅ Weekly scorecard sent to Telegram');
    } else {
      console.warn('⚠️ Failed to send weekly scorecard to Telegram');
    }
    
    // Send alert if monotonicity is broken
    if (!monotonicOk) {
      await sendSystemAlert(
        'Confluence Monotonicity Alert',
        'Weekly scorecard shows broken monotonicity. Higher confluence bins should have higher winrates. Review confluence scoring weights.',
        'warning'
      );
    }
    
    const result: WeeklyScorecardResult = {
      week_start: weekStart,
      bins,
      monotonic_ok: monotonicOk,
      total_signals: stats.current_week_signals,
      best_bin: analysis.best,
      worst_bin: analysis.worst,
      avg_confluence: analysis.avg_confluence,
    };
    
    console.log('✅ Weekly scorecard generation completed');
    return result;
    
  } catch (error) {
    console.error('❌ Weekly scorecard generation failed:', error);
    
    // Send error alert
    await sendSystemAlert(
      'Weekly Scorecard Error',
      `Failed to generate weekly scorecard: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    );
    
    throw error;
  }
}

/**
 * Manual scorecard generation (for testing/debugging)
 */
export async function generateManualScorecard(weekStartOverride?: string): Promise<WeeklyScorecardResult> {
  console.log('🔧 Generating manual scorecard...');
  
  if (weekStartOverride) {
    // For manual testing, we'd need to modify the query - for now just log the override
    console.log(`Note: Week start override requested: ${weekStartOverride}`);
  }
  
  return await generateWeeklyScorecard();
}

/**
 * Schedule weekly scorecard generation
 * Runs every Sunday at 23:59 Asia/Jakarta timezone
 */
export function scheduleWeeklyScorecard(callback?: (result: WeeklyScorecardResult) => void): NodeJS.Timer {
  console.log('📅 Scheduling weekly scorecard generation (Sundays 23:59 WIB)');
  
  const interval = setInterval(async () => {
    try {
      // Get current time in Asia/Jakarta
      const now = new Date();
      const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      
      const isSunday = wibTime.getDay() === 0; // 0 = Sunday
      const hour = wibTime.getHours();
      const minute = wibTime.getMinutes();
      
      // Run at Sunday 23:59 WIB
      if (isSunday && hour === 23 && minute >= 59) {
        console.log('🕐 Weekly scorecard trigger time reached');
        
        const result = await generateWeeklyScorecard();
        
        if (callback) {
          callback(result);
        }
      }
      
    } catch (error) {
      console.error('Weekly scorecard scheduler error:', error);
      
      // Send error alert
      await sendSystemAlert(
        'Weekly Scorecard Scheduler Error',
        `Scheduled scorecard generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }, 60 * 1000); // Check every minute
  
  return interval;
}

/**
 * Get next scheduled run time for monitoring
 */
export function getNextScheduledRun(): Date {
  const now = new Date();
  const wibNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  
  // Find next Sunday 23:59 WIB
  const nextSunday = new Date(wibNow);
  nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay())); // Next Sunday
  nextSunday.setHours(23, 59, 0, 0);
  
  // If it's already Sunday and past 23:59, schedule for next week
  if (wibNow.getDay() === 0 && wibNow.getHours() >= 23 && wibNow.getMinutes() >= 59) {
    nextSunday.setDate(nextSunday.getDate() + 7);
  }
  
  // Convert back to local time for return
  return new Date(nextSunday.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) + 'Z');
}

/**
 * Get scorecard generation status for monitoring
 */
export function getScorecardStatus(): {
  next_run: string;
  timezone: string;
  current_wib_time: string;
} {
  const nextRun = getNextScheduledRun();
  const currentWIB = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  
  return {
    next_run: nextRun.toISOString(),
    timezone: 'Asia/Jakarta',
    current_wib_time: currentWIB,
  };
}
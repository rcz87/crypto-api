/**
 * Enhanced SOL Sniper Scheduler dengan:
 * - Prometheus metrics untuk soft-fail per modul 
 * - Reset backoff saat ada modul sukses
 * - Telegram alerting hanya kalau semua modul utama gagal
 */
import { runSolSniper } from './runner';
import client from 'prom-client';

const REG = client.register;

// Metrics baru: counter untuk soft fail modul
export const sniperSoftFailCounter = new client.Counter({
  name: 'sniper_soft_fail_total',
  help: 'Soft-fail events in sniper modules',
  labelNames: ['module'],
  registers: [REG]
});

// Metric: hard fail run
export const sniperHardFailCounter = new client.Counter({
  name: 'sniper_hard_fail_total', 
  help: 'Hard-fail sniper runs (all modules down)',
  registers: [REG]
});

// Gauge: consecutive failures
export const sniperConsecutiveFailures = new client.Gauge({
  name: 'sniper_consecutive_failures',
  help: 'Number of consecutive hard failures in sniper',
  registers: [REG]
});

// Gauge: modules active
export const sniperModulesActive = new client.Gauge({
  name: 'sniper_modules_active',
  help: 'Number of active modules in last sniper run',
  registers: [REG]
});

// Backoff state
let consecutiveFailures = 0;
let nextIntervalMs = 5000; // start 5s
let schedulerTimeout: NodeJS.Timeout | null = null;

function calcBackoff() {
  const base = Math.min(60000, 5000 * Math.pow(2, consecutiveFailures));
  const jitter = Math.floor(Math.random() * 5000);
  return base + jitter;
}

/**
 * Enhanced Sniper Tick dengan graceful degradation
 */
export async function enhancedSniperTick(): Promise<void> {
  const log = (msg: string) => console.log(`[Enhanced Sniper] ${msg}`);
  
  try {
    const res = await runSolSniper();

    // Catat soft fails per modul
    res.softFails.forEach((sf) => {
      if (sf.includes('ETF')) {
        sniperSoftFailCounter.inc({ module: 'etf' });
      } else if (sf.includes('HEATMAP')) {
        sniperSoftFailCounter.inc({ module: 'heatmap' });
      } else if (sf.includes('SPOT_OB')) {
        sniperSoftFailCounter.inc({ module: 'spot_ob' });
      } else {
        sniperSoftFailCounter.inc({ module: 'unknown' });
      }
    });

    // Update metrics
    sniperModulesActive.set(res.usedModules.length);

    if (res.success) {
      // Reset fail count & backoff - ini yang penting!
      consecutiveFailures = 0;
      nextIntervalMs = 5000;
      sniperConsecutiveFailures.set(0);

      log(`✅ SUCCESS: ${res.usedModules.length} modules active, ${res.softFails.length} soft-fails`);
      log(`📊 Modules used: [${res.usedModules.join(', ')}]`);
      if (res.softFails.length > 0) {
        log(`⚠️ Soft failures: [${res.softFails.join(', ')}]`);
      }
    } else {
      consecutiveFailures++;
      sniperHardFailCounter.inc();
      sniperConsecutiveFailures.set(consecutiveFailures);

      nextIntervalMs = calcBackoff();
      log(`❌ HARD FAIL (${consecutiveFailures} consecutive). Next=${(nextIntervalMs / 1000).toFixed(1)}s`);
      log(`💥 All modules failed: ${res.errors.join(', ')}`);

      // Telegram alert hanya kalau betul-betul semua modul gagal (setiap 3 kali)
      if (consecutiveFailures % 3 === 0) {
        // Note: Telegram integration akan ditambahkan nanti jika diperlukan
        log(`🚨 Would send Telegram: Sniper hard-fail x${consecutiveFailures} — ALL modules unavailable!`);
      }
    }

  } catch (error: any) {
    consecutiveFailures++;
    sniperHardFailCounter.inc(); 
    sniperConsecutiveFailures.set(consecutiveFailures);
    
    nextIntervalMs = calcBackoff();
    console.error(`❌ [Enhanced Sniper] Scheduler error:`, error.message);
  }

  // Schedule next run
  schedulerTimeout = setTimeout(enhancedSniperTick, nextIntervalMs);
}

/**
 * Start Enhanced Sniper Scheduler
 */
export function startEnhancedSniperScheduler(): void {
  const log = (msg: string) => console.log(`[Enhanced Sniper] ${msg}`);
  
  log('🚀 Starting Enhanced SOL Sniper Scheduler with graceful degradation...');
  log(`🔧 Feature flags: ETF=${process.env.FEATURE_ETF ?? 'on'}, HEATMAP=${process.env.FEATURE_HEATMAP ?? 'on'}, SPOT_OB=${process.env.FEATURE_SPOT_OB ?? 'on'}`);
  
  // Start first tick immediately
  enhancedSniperTick();
}

/**
 * Stop Enhanced Sniper Scheduler  
 */
export function stopEnhancedSniperScheduler(): void {
  if (schedulerTimeout) {
    clearTimeout(schedulerTimeout);
    schedulerTimeout = null;
    console.log('[Enhanced Sniper] Scheduler stopped');
  }
}
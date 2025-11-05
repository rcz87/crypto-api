/**
 * NEW COIN SCANNER JOB
 * 
 * Scheduled job to scan for newly listed coins and trigger analysis
 * - Runs at configurable intervals (default: every 60 seconds)
 * - NO infinite loops - uses setInterval
 * - Includes concurrency guard to prevent overlapping scans
 */

import { newCoinScanner } from '../services/newCoinScanner.js';
import { earlyAnalysisEngine } from '../services/earlyAnalysisEngine.js';

// Job state
let scanInterval: NodeJS.Timeout | null = null;
let isScanning = false;
let scanCount = 0;
let lastScanDuration = 0;

// Configuration
const ENABLE_SCANNER = process.env.ENABLE_NEW_COIN_SCANNER === 'true';
const SCAN_INTERVAL = parseInt(process.env.NEW_COIN_SCAN_INTERVAL || '60') * 1000; // Convert to ms

/**
 * Perform a single scan cycle
 */
async function performScan(): Promise<void> {
  // Skip if previous scan still running
  if (isScanning) {
    console.warn(`⏭️ [NewCoinJob] Skipping scan #${scanCount + 1} - previous scan still in progress (${lastScanDuration}ms)`);
    return;
  }

  isScanning = true;
  scanCount++;
  const scanStart = Date.now();

  try {
    console.log(`🔍 [NewCoinJob] Starting scan #${scanCount}...`);

    // Step 1: Scan for new coins
    const newCoins = await newCoinScanner.scanForNewCoins();

    if (newCoins.length === 0) {
      console.log(`✅ [NewCoinJob] Scan #${scanCount} complete - no new coins found`);
      return;
    }

    console.log(`🆕 [NewCoinJob] Found ${newCoins.length} new coins to analyze`);

    // Step 2: Analyze new coins with AI
    await earlyAnalysisEngine.analyzeMultipleCoins(newCoins);

    console.log(`✅ [NewCoinJob] Scan #${scanCount} complete - analyzed ${newCoins.length} new coins`);

  } catch (error) {
    console.error(`❌ [NewCoinJob] Scan #${scanCount} failed:`, error);
  } finally {
    lastScanDuration = Date.now() - scanStart;
    isScanning = false;

    // Log stats every 10 scans
    if (scanCount % 10 === 0) {
      console.log(`📊 [NewCoinJob] Stats: ${scanCount} scans completed, last=${lastScanDuration}ms, interval=${SCAN_INTERVAL / 1000}s`);
    }
  }
}

/**
 * Start the new coin scanner job
 */
export function startNewCoinJob(): void {
  if (!ENABLE_SCANNER) {
    console.log('⏸️  [NewCoinJob] DISABLED (set ENABLE_NEW_COIN_SCANNER=true to enable)');
    return;
  }

  if (scanInterval) {
    console.warn('[NewCoinJob] Already running');
    return;
  }

  console.log('🚀 [NewCoinJob] Starting New Coin Radar + Early Smart Money Detection');
  console.log(`📊 [NewCoinJob] Scan interval: ${SCAN_INTERVAL / 1000} seconds`);
  console.log(`💰 [NewCoinJob] Min volume: $${process.env.MIN_NEW_COIN_VOLUME || '200000'}`);
  console.log(`🐋 [NewCoinJob] Min whale TX: $${process.env.MIN_WHALE_TX_AMOUNT || '50000'}`);
  console.log(`🎯 [NewCoinJob] Min confidence: ${(parseFloat(process.env.MIN_NEW_COIN_CONFIDENCE || '0.6') * 100).toFixed(0)}%`);

  // Perform initial scan immediately
  performScan().catch(err => {
    console.error('[NewCoinJob] Initial scan failed:', err);
  });

  // Schedule recurring scans
  scanInterval = setInterval(async () => {
    await performScan();
  }, SCAN_INTERVAL);

  console.log('✅ [NewCoinJob] New Coin Scanner started - monitoring exchanges for new listings');
}

/**
 * Stop the new coin scanner job
 */
export function stopNewCoinJob(): void {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    console.log('[NewCoinJob] Scanner stopped');
  }
}

/**
 * Get scanner status
 */
export function getNewCoinJobStatus() {
  return {
    isRunning: !!scanInterval,
    isScanning,
    scanCount,
    lastScanDuration,
    scanInterval: SCAN_INTERVAL / 1000,
    enabled: ENABLE_SCANNER
  };
}

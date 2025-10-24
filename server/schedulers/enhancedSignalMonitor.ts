/**
 * EVENT-DRIVEN ENHANCED AI SIGNAL MONITOR
 * 
 * Tidak pakai loop! Hanya trigger Enhanced AI analysis kalau ada price movement signifikan.
 * Alert Telegram HANYA kalau sinyal valid (confidence ≥ adaptive threshold).
 * 
 * Flow:
 * 1. Monitor price changes (minimal overhead)
 * 2. Detect significant movement (>0.5%)
 * 3. Trigger Enhanced AI analysis (25-feature neural network + market context)
 * 4. Send Telegram alert HANYA kalau pass adaptive threshold
 */

// 🔧 PATCH 2: RE-ENABLED AFTER MEMORY LEAK FIXES
// Memory leak fixes implemented:
// 1. Learning History TTL (24h)
// 2. Pattern Memory Age-Based Cleanup (7d)
// 3. Cache Monitoring
// 4. OpenAI Connection Management
// 5. Concurrency guard (prevent sweep overlap)
const ENABLE_SIGNAL_MONITOR = true;

import { okxService } from '../services/okx';
import { getEnhancedAISignalEngine } from '../services/enhancedAISignalEngine';
import { sendTradingSignal } from '../observability/dualTelegram'; // Use signal bot for trading signals
import { adaptiveThresholdManager } from '../services/adaptiveThreshold';

// 10 Priority Coins untuk monitoring
const PRIORITY_COINS = [
  'BTC-USDT-SWAP',
  'ETH-USDT-SWAP', 
  'SOL-USDT-SWAP',
  'AVAX-USDT-SWAP',
  'RENDER-USDT-SWAP',
  'BNB-USDT-SWAP',
  'HYPE-USDT-SWAP',
  'XRP-USDT-SWAP',
  'TRUMP-USDT-SWAP',
  'DOGE-USDT-SWAP'
];

// Price tracking state
const priceCache = new Map<string, { price: number; timestamp: number }>();

// Cooldown untuk prevent spam (5 menit per symbol)
const alertCooldown = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Rate limiter untuk Telegram (1000ms minimum interval)
let lastTelegramAlert = 0;
const TELEGRAM_MIN_INTERVAL = 1000;

interface PriceChangeEvent {
  symbol: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
}

/**
 * Check price changes and detect significant movements
 */
async function checkPriceChanges(): Promise<PriceChangeEvent[]> {
  const events: PriceChangeEvent[] = [];

  for (const symbol of PRIORITY_COINS) {
    try {
      const ticker = await okxService.getTicker(symbol);
      const newPrice = parseFloat(ticker.price);
      const cached = priceCache.get(symbol);

      if (cached) {
        const changePercent = ((newPrice - cached.price) / cached.price) * 100;
        
        // Significant movement detected (>0.5%)
        if (Math.abs(changePercent) > 0.5) {
          events.push({
            symbol,
            oldPrice: cached.price,
            newPrice,
            changePercent
          });
        }
      }

      // Update cache
      priceCache.set(symbol, { price: newPrice, timestamp: Date.now() });

    } catch (error) {
      console.error(`[EnhancedSignalMonitor] Failed to fetch ${symbol}:`, error);
    }
  }

  return events;
}

/**
 * Analyze signal dengan Enhanced AI Engine
 */
async function analyzeSignal(symbol: string): Promise<any> {
  try {
    const aiEngine = getEnhancedAISignalEngine();
    const result = await aiEngine.generateEnhancedAISignal(symbol);
    return result;
  } catch (error) {
    console.error(`[EnhancedSignalMonitor] Enhanced AI analysis failed for ${symbol}:`, error);
    return null;
  }
}

/**
 * Check if symbol is on cooldown
 */
function isOnCooldown(symbol: string): boolean {
  const lastAlert = alertCooldown.get(symbol);
  if (!lastAlert) return false;
  
  const elapsed = Date.now() - lastAlert;
  return elapsed < COOLDOWN_MS;
}

/**
 * Send Telegram alert dengan rate limiting
 */
async function sendSignalAlert(signal: any): Promise<boolean> {
  // Rate limiting check
  const now = Date.now();
  const timeSinceLastAlert = now - lastTelegramAlert;
  
  if (timeSinceLastAlert < TELEGRAM_MIN_INTERVAL) {
    const waitTime = TELEGRAM_MIN_INTERVAL - timeSinceLastAlert;
    console.log(`⏳ [EnhancedSignalMonitor] Rate limiting: waiting ${waitTime}ms before Telegram alert`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  try {
    // Format signal untuk Telegram
    const direction = signal.bias === 'long' ? '🟢 LONG' : signal.bias === 'short' ? '🔴 SHORT' : '⚪ NEUTRAL';
    const confidence = signal.confidence || 0;
    const marketContext = signal.market_context || {};
    
    const message = `
🎯 <b>Enhanced AI Signal</b>

<b>Symbol:</b> ${signal.symbol.replace('-USDT-SWAP', '')}
<b>Direction:</b> ${direction}
<b>Confidence:</b> ${confidence.toFixed(1)}%

📊 <b>Market Context:</b>
• Funding: ${marketContext.funding_rate || 'N/A'}
• OI Change: ${marketContext.oi_change || 'N/A'}
• Volume Δ: ${marketContext.volume_delta || 'N/A'}
• Boost: +${marketContext.confidence_boost || 0}%

💡 <b>Reasoning:</b>
${signal.reasoning?.summary || 'Enhanced AI analysis'}

⚡ <b>Factors:</b>
${signal.reasoning?.primary_factors?.slice(0, 3).map((f: string) => `• ${f}`).join('\n') || ''}
    `.trim();

    await sendTradingSignal(message, { parseMode: 'HTML' });
    lastTelegramAlert = Date.now();
    alertCooldown.set(signal.symbol, Date.now());
    console.log(`✅ [EnhancedSignalMonitor] Trading signal sent to Telegram signal bot for ${signal.symbol}`);
    return true;
  } catch (error) {
    console.error(`[EnhancedSignalMonitor] Failed to send Telegram alert:`, error);
    return false;
  }
}

/**
 * Process price change event
 */
async function processEvent(event: PriceChangeEvent): Promise<void> {
  const { symbol, changePercent } = event;

  // Check cooldown
  if (isOnCooldown(symbol)) {
    console.log(`⏱️ [EnhancedSignalMonitor] ${symbol} on cooldown, skipping...`);
    return;
  }

  console.log(`🔍 [EnhancedSignalMonitor] Significant movement detected: ${symbol} ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`);

  // Trigger Enhanced AI analysis
  const signal = await analyzeSignal(symbol);
  
  if (!signal || !signal.confidence) {
    console.log(`⚠️ [EnhancedSignalMonitor] No valid signal from Enhanced AI for ${symbol}`);
    return;
  }

  // Get current adaptive threshold
  const currentThreshold = adaptiveThresholdManager.getCurrentThreshold();
  
  console.log(`📊 [EnhancedSignalMonitor] Signal detected: ${symbol} confidence=${signal.confidence}%, threshold=${currentThreshold}%`);

  // HANYA alert kalau confidence >= adaptive threshold
  if (signal.confidence >= currentThreshold) {
    console.log(`✅ [EnhancedSignalMonitor] VALID SIGNAL! ${symbol} confidence ${signal.confidence}% ≥ ${currentThreshold}%`);
    await sendSignalAlert(signal);
  } else {
    console.log(`❌ [EnhancedSignalMonitor] Signal filtered: ${symbol} confidence ${signal.confidence}% < ${currentThreshold}%`);
  }
}

/**
 * Main monitoring loop (lightweight, hanya check price changes)
 */
let monitorInterval: NodeJS.Timeout | null = null;

// MEMORY LEAK FIX: Prevent concurrent sweeps from overlapping
let isProcessing = false;
let sweepCount = 0;
let lastSweepDuration = 0;

export function startEnhancedSignalMonitor() {
  if (!ENABLE_SIGNAL_MONITOR) {
    console.log('⏸️  [EnhancedSignalMonitor] DISABLED (temporary - memory optimization, sweep overlap leak)');
    return;
  }

  if (monitorInterval) {
    console.warn('[EnhancedSignalMonitor] Already running');
    return;
  }

  console.log('🎯 [EnhancedSignalMonitor] Starting event-driven Enhanced AI Signal Monitor');
  console.log(`📊 [EnhancedSignalMonitor] Monitoring ${PRIORITY_COINS.length} priority coins: ${PRIORITY_COINS.map(s => s.replace('-USDT-SWAP', '')).join(', ')}`);
  
  // Initial price cache population
  checkPriceChanges().catch(err => {
    console.error('[EnhancedSignalMonitor] Initial price check failed:', err);
  });

  // MEMORY LEAK FIX: Guard against concurrent sweeps
  // Old: setInterval spawns new sweep every 10s regardless of completion
  // New: Only start new sweep if previous one finished
  monitorInterval = setInterval(async () => {
    // Skip if previous sweep still running
    if (isProcessing) {
      console.warn(`⏭️ [EnhancedSignalMonitor] Skipping sweep #${sweepCount + 1} - previous sweep still in progress (${lastSweepDuration}ms)`);
      return;
    }

    isProcessing = true;
    sweepCount++;
    const sweepStart = Date.now();

    try {
      const events = await checkPriceChanges();
      
      if (events.length > 0) {
        console.log(`🔔 [EnhancedSignalMonitor] Detected ${events.length} significant price movements`);
        
        // Process events sequentially to respect rate limits
        for (const event of events) {
          await processEvent(event);
        }
      }

      lastSweepDuration = Date.now() - sweepStart;
      
      // Log sweep stats for performance monitoring
      if (sweepCount % 6 === 0) { // Every minute (6 x 10s)
        console.log(`📊 [EnhancedSignalMonitor] Sweep stats: ${sweepCount} total, last=${lastSweepDuration}ms, avgLoad=${(lastSweepDuration / 10000 * 100).toFixed(1)}%`);
      }
    } catch (error) {
      console.error('[EnhancedSignalMonitor] Monitor cycle failed:', error);
      lastSweepDuration = Date.now() - sweepStart;
    } finally {
      isProcessing = false;
    }
  }, 10000); // Check every 10 seconds (lightweight)

  console.log('✅ [EnhancedSignalMonitor] Event-driven monitor started - alerts ONLY on valid signals (with concurrency guard)');
}

export function stopEnhancedSignalMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[EnhancedSignalMonitor] Monitor stopped');
  }
}

export function getMonitorStatus() {
  return {
    isRunning: !!monitorInterval,
    priorityCoins: PRIORITY_COINS,
    pricesCached: priceCache.size,
    alertsOnCooldown: alertCooldown.size
  };
}

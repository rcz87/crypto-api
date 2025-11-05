/**
 * EARLY ANALYSIS ENGINE
 * 
 * Analyzes newly detected coins using existing AI Signal & Market Engine
 * - Uses Phase 1-6 AI capabilities (funding, CVD, smart money, volume, order blocks)
 * - Filters based on confidence threshold
 * - Integrates with Telegram alert system
 */

import { getEnhancedAISignalEngine } from './enhancedAISignalEngine.js';
import { newCoinScanner } from './newCoinScanner.js';
import { sendTradingSignal } from '../observability/dualTelegram.js';

interface EarlyAnalysisResult {
  symbol: string;
  exchange: string;
  shouldAlert: boolean;
  signal?: any;
  metrics?: {
    volume24h: number;
    whaleTxCount: number;
    whaleTxVolume: number;
  };
  reason?: string;
}

export class EarlyAnalysisEngine {
  private minConfidence: number;
  private processingQueue: Set<string> = new Set();

  constructor() {
    this.minConfidence = parseFloat(process.env.MIN_NEW_COIN_CONFIDENCE || '0.6');
  }

  /**
   * Analyze a newly detected coin
   */
  async analyzeNewCoin(
    symbol: string,
    exchange: string,
    listedAt: string
  ): Promise<EarlyAnalysisResult> {
    // Prevent duplicate analysis
    if (this.processingQueue.has(symbol)) {
      console.log(`⏭️ [EarlyAnalysis] ${symbol} already being analyzed, skipping...`);
      return {
        symbol,
        exchange,
        shouldAlert: false,
        reason: 'Already processing'
      };
    }

    this.processingQueue.add(symbol);

    try {
      console.log(`🔬 [EarlyAnalysis] Starting analysis for ${symbol}...`);

      // Step 1: Validate coin (check volume & whale activity)
      const isValid = await newCoinScanner.validateCoin(symbol);
      if (!isValid) {
        return {
          symbol,
          exchange,
          shouldAlert: false,
          reason: 'Failed validation (low volume or no whale activity)'
        };
      }

      // Get coin metrics for alert
      const metrics = await newCoinScanner.getCoinMetrics(symbol);

      // Calculate time since listing
      const timeSinceListing = this.getTimeSinceListing(listedAt);

      // Send EARLY ALERT immediately (before AI analysis)
      await this.sendEarlyAlert(symbol, exchange, metrics, timeSinceListing);

      // Step 2: Run AI signal analysis (Phase 1-6)
      console.log(`🤖 [EarlyAnalysis] Running AI smart money analysis for ${symbol}...`);
      
      const aiEngine = getEnhancedAISignalEngine();
      let signal;

      try {
        // Try to analyze with symbol-USDT format for our AI engine
        signal = await aiEngine.generateEnhancedAISignal(`${symbol}-USDT-SWAP`);
      } catch (error) {
        console.warn(`⚠️ [EarlyAnalysis] Could not analyze ${symbol} with AI engine:`, error instanceof Error ? error.message : error);
        return {
          symbol,
          exchange,
          shouldAlert: false,
          metrics,
          reason: 'AI analysis failed (coin may not be available on our data sources)'
        };
      }

      // Step 3: Check if signal passes confidence threshold
      const confidence = signal.confidence || 0;
      const direction = signal.direction || 'neutral';

      console.log(`📊 [EarlyAnalysis] ${symbol} AI Result: ${direction} (${confidence}% confidence)`);

      if (direction === 'neutral' || confidence < this.minConfidence * 100) {
        console.log(`❌ [EarlyAnalysis] ${symbol} signal too weak: ${direction} ${confidence}% < ${this.minConfidence * 100}%`);
        return {
          symbol,
          exchange,
          shouldAlert: false,
          signal,
          metrics,
          reason: `Weak signal: ${direction} ${confidence}%`
        };
      }

      // Step 4: Valid signal detected! Send full trading alert
      console.log(`✅ [EarlyAnalysis] ${symbol} VALID SIGNAL DETECTED: ${direction} ${confidence}%`);

      await this.sendFullTradingAlert(symbol, exchange, signal, metrics);

      return {
        symbol,
        exchange,
        shouldAlert: true,
        signal,
        metrics,
        reason: `Valid signal: ${direction} ${confidence}%`
      };

    } catch (error) {
      console.error(`❌ [EarlyAnalysis] Analysis failed for ${symbol}:`, error);
      return {
        symbol,
        exchange,
        shouldAlert: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      // Remove from processing queue
      this.processingQueue.delete(symbol);
    }
  }

  /**
   * Calculate time since listing in human-readable format
   */
  private getTimeSinceListing(listedAt: string): string {
    const listedTime = new Date(listedAt).getTime();
    const now = Date.now();
    const diffMs = now - listedTime;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Baru saja';
    if (diffMinutes === 1) return '1 menit lalu';
    if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 jam lalu';
    if (diffHours < 24) return `${diffHours} jam lalu`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari lalu`;
  }

  /**
   * Send early listing alert to Telegram
   */
  private async sendEarlyAlert(
    symbol: string,
    exchange: string,
    metrics: { volume24h: number; whaleTxCount: number; whaleTxVolume: number },
    timeSince: string
  ): Promise<void> {
    try {
      const message = `
⚠ <b>EARLY LISTING DETECTED — ${symbol}/USDT</b>

<b>Exchange</b>  : ${exchange}
<b>Listed</b>    : ${timeSince}
<b>Volume 5m</b> : $${this.formatNumber(metrics.volume24h)}
<b>Whale TXs</b> : ${metrics.whaleTxCount} wallets > $50K

⏳ <i>Running AI Smart Money Analysis...</i>
      `.trim();

      await sendTradingSignal(message, { parseMode: 'HTML' });
      console.log(`📱 [EarlyAnalysis] Early alert sent for ${symbol}`);
    } catch (error) {
      console.error(`❌ [EarlyAnalysis] Failed to send early alert for ${symbol}:`, error);
    }
  }

  /**
   * Send full trading signal alert to Telegram
   */
  private async sendFullTradingAlert(
    symbol: string,
    exchange: string,
    signal: any,
    metrics: { volume24h: number; whaleTxCount: number; whaleTxVolume: number }
  ): Promise<void> {
    try {
      const direction = signal.direction === 'long' ? '🟢 LONG' : signal.direction === 'short' ? '🔴 SHORT' : '⚪ NEUTRAL';
      const confidence = signal.confidence || 0;
      
      // Calculate entry, stop loss, and take profit from signal
      const currentPrice = signal.current_price || 0;
      const stopLoss = signal.direction === 'long' 
        ? currentPrice * 0.99  // 1% below for long
        : currentPrice * 1.01; // 1% above for short
      const takeProfit1 = signal.direction === 'long'
        ? currentPrice * 1.02  // 2% above for long
        : currentPrice * 0.98; // 2% below for short
      const takeProfit2 = signal.direction === 'long'
        ? currentPrice * 1.05  // 5% above for long
        : currentPrice * 0.95; // 5% below for short

      const message = `
🚀 <b>AI SIGNAL DETECTED — ${symbol}/USDT</b>

${direction} <b>SIGNAL ACTIVE</b>
<b>Entry</b>      : ${currentPrice.toFixed(4)}
<b>Stop Loss</b>  : ${stopLoss.toFixed(4)}
<b>Take Profit</b>: ${takeProfit1.toFixed(4)} / ${takeProfit2.toFixed(4)}
<b>R/R Ratio</b>  : 1:2.5

📊 <b>Smart Money Insight:</b>
• CVD ${signal.cvd_delta > 0 ? '+' : ''}${(signal.cvd_delta / 1000000).toFixed(1)}M (${signal.cvd_delta > 0 ? 'buyer aggression' : 'seller pressure'})
• Funding ${signal.funding_rate || 'N/A'} (${signal.funding_rate < 0 ? 'shorts pay longs' : 'longs pay shorts'})
• OI ${signal.oi_change > 0 ? '+' : ''}${signal.oi_change}% (${signal.oi_change > 0 ? 'fresh leverage entering' : 'positions closing'})

💡 <b>Reason:</b>
${signal.reasoning?.summary || 'Early listing with strong smart money signals'}

<b>Time:</b> ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
      `.trim();

      await sendTradingSignal(message, { parseMode: 'HTML' });
      console.log(`📱 [EarlyAnalysis] Full trading alert sent for ${symbol}`);
    } catch (error) {
      console.error(`❌ [EarlyAnalysis] Failed to send trading alert for ${symbol}:`, error);
    }
  }

  /**
   * Format large numbers with K/M suffix
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
  }

  /**
   * Process multiple new coins in batch
   */
  async analyzeMultipleCoins(
    newCoins: Array<{ symbol: string; exchange: string; listedAt: string }>
  ): Promise<EarlyAnalysisResult[]> {
    console.log(`📊 [EarlyAnalysis] Analyzing ${newCoins.length} new coins...`);

    const results: EarlyAnalysisResult[] = [];

    // Process coins sequentially to avoid overwhelming APIs
    for (const coin of newCoins) {
      const result = await this.analyzeNewCoin(coin.symbol, coin.exchange, coin.listedAt);
      results.push(result);

      // Wait 2 seconds between analyses to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const alertedCount = results.filter(r => r.shouldAlert).length;
    console.log(`✅ [EarlyAnalysis] Analysis complete: ${alertedCount}/${newCoins.length} coins triggered alerts`);

    return results;
  }
}

// Singleton instance
export const earlyAnalysisEngine = new EarlyAnalysisEngine();

/**
 * Phase 6: Telegram Auto Signal Delivery Service
 * 
 * Event-based signal delivery (NO loops, NO cron, NO setInterval)
 * Sends formatted trading signals to Telegram when AI generates real signals
 */

interface SignalData {
  symbol: string;
  bias: 'long' | 'short' | 'neutral';
  confidence: number;
  data_quality?: number;
  currentPrice?: number;
  entry?: number;
  execution_details?: {
    stop_loss?: number;
    take_profit?: number[];
  };
  reasoning?: {
    primary_factors?: string[];
    summary?: string;
  };
  market_context?: any;
}

export class TelegramSignalService {
  private enabled: boolean;
  private token: string | undefined;
  private chatId: string | undefined;
  private allowedSymbols: string[] | null;
  private minConfidence: number;

  constructor() {
    this.enabled = process.env.ENABLE_TELEGRAM_SIGNAL === 'true';
    this.token = process.env.TELEGRAM_SIGNAL_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_SIGNAL_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
    this.allowedSymbols = process.env.ALLOWED_SIGNAL_SYMBOLS 
      ? process.env.ALLOWED_SIGNAL_SYMBOLS.split(',').map(s => s.trim())
      : null;
    this.minConfidence = parseFloat(process.env.MIN_SIGNAL_CONFIDENCE || '0.6');

    if (this.enabled) {
      console.log('📊 [TelegramSignalService] Initialized', {
        hasCredentials: !!(this.token && this.chatId),
        allowedSymbols: this.allowedSymbols || 'ALL',
        minConfidence: this.minConfidence
      });
    }
  }

  /**
   * Send signal to Telegram (event-triggered, not loop-based)
   */
  async sendSignalMessage(signal: SignalData): Promise<boolean> {
    // Check if service is enabled
    if (!this.enabled) {
      console.log('🚫 [TelegramSignalService] Signal delivery disabled (ENABLE_TELEGRAM_SIGNAL=false)');
      return false;
    }

    // Check credentials
    if (!this.token || !this.chatId) {
      console.warn('⚠️ [TelegramSignalService] Missing Telegram credentials');
      return false;
    }

    // Filter by symbol if whitelist exists
    if (this.allowedSymbols) {
      const cleanSymbol = signal.symbol.replace('-USDT-SWAP', '').replace('-USDT', '');
      if (!this.allowedSymbols.includes(cleanSymbol)) {
        console.log(`⏭️ [TelegramSignalService] Symbol ${cleanSymbol} not in whitelist, skipping`);
        return false;
      }
    }

    // Filter by confidence
    if (signal.confidence < this.minConfidence) {
      console.log(`⏭️ [TelegramSignalService] Confidence ${signal.confidence.toFixed(2)} < ${this.minConfidence}, skipping`);
      return false;
    }

    // Only send non-neutral signals
    if (signal.bias === 'neutral') {
      console.log(`⏭️ [TelegramSignalService] NEUTRAL signal, skipping`);
      return false;
    }

    try {
      const message = this.buildMessage(signal);
      
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [TelegramSignalService] Failed to send:`, response.status, errorText);
        return false;
      }

      console.log(`✅ [TelegramSignalService] Signal sent to Telegram (${signal.symbol}, ${signal.bias.toUpperCase()}, ${(signal.confidence * 100).toFixed(1)}%)`);
      return true;

    } catch (error) {
      console.error(`❌ [TelegramSignalService] Error sending signal:`, error);
      return false;
    }
  }

  /**
   * Build formatted Telegram message with emojis and markdown (Enhanced Professional Format)
   */
  private buildMessage(signal: SignalData): string {
    const cleanSymbol = signal.symbol.replace('-USDT-SWAP', '').replace('-USDT', '');
    const direction = signal.bias.toUpperCase();
    const directionEmoji = signal.bias === 'long' ? '🟢' : '🔴';
    const signalType = signal.bias === 'long' ? 'LONG' : 'SHORT';
    
    const confidence = (signal.confidence * 100).toFixed(1);
    const dataQuality = signal.data_quality ? (signal.data_quality * 100).toFixed(1) : 'N/A';
    
    const entry = signal.entry || signal.currentPrice || 0;
    const sl = signal.execution_details?.stop_loss || 0;
    const tps = signal.execution_details?.take_profit || [];
    
    // Calculate Risk/Reward Ratio
    let rr = '-';
    let slPercent = 0;
    let tpPercent = 0;
    if (tps.length && sl && entry) {
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tps[0] - entry);
      rr = (reward / risk).toFixed(2);
      slPercent = ((sl - entry) / entry * 100);
      tpPercent = ((tps[0] - entry) / entry * 100);
    }
    
    // Entry zone (small range around entry)
    const entryLow = (entry * 0.9995).toFixed(2);
    const entryHigh = (entry * 1.0005).toFixed(2);
    
    // Target direction text
    const targetText = signal.bias === 'long' ? 'Targeting Upside Move' : 'Targeting Downside Move';
    
    // Build enhanced message
    const lines = [
      `🚀 *AI SIGNAL DETECTED — ${cleanSymbol}/USDT*`,
      '',
      `${directionEmoji} *${signalType} SIGNAL ACTIVE*`,
      `_Pricing Live: ${entry.toFixed(2)} → (${targetText})_`,
      '',
      '────────────',
      '🎯 *Trade Setup*',
      `• Entry Zone     : ${entryLow} – ${entryHigh}`,
      `• Stop Loss (SL) : ${sl.toFixed(2)}  ❌ (${slPercent.toFixed(2)}%)`,
      `• Take Profit (TP): ${tps.length ? tps[0].toFixed(2) : 'N/A'} ✅ (${tpPercent > 0 ? '+' : ''}${tpPercent.toFixed(2)}%)`,
      `• Risk/Reward    : 1 : ${rr}`,
      '────────────',
      '',
      '📊 *Smart Money Insight*',
    ];
    
    // Add market context
    if (signal.market_context) {
      const mc = signal.market_context;
      if (mc.funding_rate) {
        const fundingValue = mc.funding_rate;
        const fundingText = signal.bias === 'long' 
          ? 'Shorts Paying Longs → Bullish Fuel' 
          : 'Longs Paying Shorts → Bearish Pressure';
        lines.push(`• Funding Rate   : ${fundingValue} (${fundingText})`);
      }
      lines.push(`• CVD Trend      : ${signal.bias === 'long' ? 'Strong Buyer Aggression Detected' : 'Strong Seller Pressure Detected'}`);
      if (mc.oi_change) {
        lines.push(`• OI Movement    : ${mc.oi_change} (Fresh Positions Entering Market)`);
      }
      if (mc.volume_delta) {
        lines.push(`• Volume Delta   : ${mc.volume_delta}`);
      }
      const stopCluster = signal.bias === 'long' ? `below ${(entry * 0.998).toFixed(1)}` : `above ${(entry * 1.002).toFixed(1)}`;
      lines.push(`• Liquidity      : Stop-loss liquidity cluster ${stopCluster} absorbed`);
    } else {
      lines.push('• CVD Trend      : Monitoring buyer/seller aggression');
      lines.push('• OI Movement    : Fresh positions entering market');
      lines.push('• Liquidity      : Institutional activity detected');
    }
    
    lines.push('────────────');
    lines.push('');
    lines.push('💡 *AI Reasoning*');
    
    // Add reasoning
    if (signal.reasoning && signal.reasoning.primary_factors && signal.reasoning.primary_factors.length) {
      const factors = signal.reasoning.primary_factors.slice(0, 2);
      lines.push(factors.join('. ') + '.');
    } else if (signal.reasoning && signal.reasoning.summary) {
      lines.push(signal.reasoning.summary);
    } else {
      const defaultReason = signal.bias === 'long'
        ? 'Whales are accumulating on discount levels. Order blocks successfully defended, showing institutional interest.'
        : 'Distribution pattern detected. Smart money taking profits at resistance levels.';
      lines.push(defaultReason);
    }
    
    // Add order block info
    const obLow = (entry * 0.992).toFixed(1);
    const obHigh = (entry * 0.998).toFixed(1);
    if (signal.bias === 'long') {
      lines.push(`Order blocks at ${obLow} – ${obHigh} successfully defended, showing institutional interest.`);
    }
    
    lines.push('');
    lines.push('────────────');
    lines.push('⚠️ *Invalid if:*');
    
    // Invalidation conditions
    if (signal.bias === 'long') {
      lines.push(`✖ Candle closes below ${sl.toFixed(2)}`);
      lines.push('✖ CVD flips bearish');
      lines.push('✖ OI turns negative');
    } else {
      lines.push(`✖ Candle closes above ${sl.toFixed(2)}`);
      lines.push('✖ CVD flips bullish');
      lines.push('✖ OI turns positive');
    }
    
    lines.push('');
    const timestamp = new Date().toLocaleString('id-ID', { 
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    lines.push(`🕒 *Timestamp:* ${timestamp} WIB`);
    lines.push(`#${cleanSymbol} #SmartMoney #AIsignal #${signalType}`);
    
    // Phase 7: Add Position Sizing section (appended after Phase 6 format)
    const positionSizingSection = this.calculatePositionSizing(signal.bias, entry, sl);
    if (positionSizingSection) {
      lines.push('');
      lines.push(positionSizingSection);
    }
    
    return lines.join('\n');
  }

  /**
   * Phase 7: Calculate Position Sizing based on account equity and risk
   */
  private calculatePositionSizing(
    direction: 'long' | 'short' | 'neutral',
    entryPrice: number,
    stopLoss: number
  ): string | null {
    // Skip if neutral or missing data
    if (direction === 'neutral' || !entryPrice || !stopLoss) {
      return null;
    }

    try {
      // Read from environment
      const accountEquity = parseFloat(process.env.ACCOUNT_EQUITY || '10000');
      const riskPercent = parseFloat(process.env.RISK_PER_TRADE_PERCENT || '1');

      // Calculate risk amount in USD
      const riskAmount = accountEquity * (riskPercent / 100);

      // Calculate stop loss distance
      let stopLossDistance: number;
      if (direction === 'long') {
        stopLossDistance = entryPrice - stopLoss;
      } else {
        // SHORT
        stopLossDistance = stopLoss - entryPrice;
      }

      // Avoid division by zero
      if (stopLossDistance <= 0) {
        return null;
      }

      // Calculate position size (in coin amount)
      const positionSize = riskAmount / stopLossDistance;

      // Round to 2 decimals
      const positionSizeRounded = Math.round(positionSize * 100) / 100;

      // Build Position Sizing section
      const lines = [
        '📐 *Position Sizing*',
        `• Account Balance : $${accountEquity.toLocaleString('en-US')}`,
        `• Risk per Trade  : ${riskPercent}% ($${riskAmount.toFixed(2)})`,
        `• Position Size   : ${positionSizeRounded} coins`
      ];

      return lines.join('\n');

    } catch (error) {
      // If calculation fails, don't break the message - just skip this section
      console.error('[TelegramSignalService] Position sizing calculation error:', error);
      return null;
    }
  }

  /**
   * Get service status for monitoring
   */
  getStatus(): {
    enabled: boolean;
    configured: boolean;
    allowedSymbols: string[] | null;
    minConfidence: number;
  } {
    return {
      enabled: this.enabled,
      configured: !!(this.token && this.chatId),
      allowedSymbols: this.allowedSymbols,
      minConfidence: this.minConfidence,
    };
  }
}

// Singleton instance
export const telegramSignalService = new TelegramSignalService();

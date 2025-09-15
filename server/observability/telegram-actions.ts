/**
 * 📱 Enhanced Telegram Actions with Interactive Buttons
 * Implements 1-click execution, feedback loops, and anti-spam
 */

// Using global fetch (Node 18+)
import { sendTelegram } from "./telegram";
import { sizeByConfidence, formatSizingForDisplay } from "../services/autoSize.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Simple in-memory cache for deduplication (in production use Redis)
const sentMessages = new Map<string, number>();
const snoozeSettings = new Map<string, number>();
const feedbackData = new Map<string, any>();

/**
 * 🟢 Send Interactive Institutional Bias Alert
 */
export async function sendInstitutionalBias(
  data: {
    symbol: string,
    bias: string,
    whale: boolean,
    etfFlow: number,
    sentiment: number,
    confidence: number,
    altSymbol?: string
  }
) {
  const ref = `ib_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`; // ib_20250915_0730
  
  // Check deduplication
  if (await isRecentlySent(ref, 'institutional', 300)) { // 5 minutes
    console.log(`⏸️ Institutional bias alert skipped - recently sent (${ref})`);
    return false;
  }

  // Check snooze
  if (isSnoozing('institutional')) {
    console.log(`😴 Institutional bias alert snoozed`);
    return false;
  }

  const { symbol, bias, whale, etfFlow, sentiment, confidence, altSymbol = 'SOL' } = data;
  const emoji = bias === 'LONG' ? '🟢' : bias === 'SHORT' ? '🔴' : '🟡';
  
  // Calculate position size
  let sizeInfo = '';
  try {
    const sizing = await sizeByConfidence({
      confidence,
      symbol,
      market: {
        etfFlowUSD: etfFlow
      }
    });
    
    if (!sizing.error) {
      sizeInfo = `\n💰 **POSITION SIZE**\n${formatSizingForDisplay(sizing, { compact: true })}`;
    }
  } catch (error) {
    console.warn('⚠️ Position sizing calculation failed:', error);
  }
  
  const text = `${emoji} INSTITUTIONAL ${bias} — ${symbol}
Whale: ${whale ? 'BUY ≥ $1M ✅' : 'No large activity ❌'}
ETF Flow: ${etfFlow >= 0 ? `+$${Math.round(etfFlow/1000000)}M ✅` : `${Math.round(etfFlow/1000000)}M ❌`}
Sentiment: ${sentiment}/100 ${sentiment >= 60 ? '✅' : sentiment <= 40 ? '❌' : '⚠️'}
Confidence: ${confidence}%${sizeInfo}

Next:
• Cek ${altSymbol} sniper 5m \(entry presisi\)
• Validasi heatmap & orderbook

ref: ${ref}`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: `🔥 Heatmap ${altSymbol}`, callback_data: `heatmap:${altSymbol}:${ref}` },
        { text: `📘 Orderbook ${altSymbol}`, callback_data: `orderbook:${altSymbol}:${ref}` },
        { text: `🎯 Sniper ${altSymbol}`, callback_data: `sniper:${altSymbol}:${ref}` },
      ],
      [
        { text: "👍 Bagus", callback_data: `rate:+:${ref}` },
        { text: "👎 Buruk", callback_data: `rate:-:${ref}` },
        { text: "⏸ Snooze 30m", callback_data: `snooze:30:${ref}` },
      ],
    ],
  };

  try {
    const response = await sendTelegramWithKeyboard(text, inlineKeyboard);
    if (response.ok) {
      markAsSent(ref, 'institutional');
      // Store alert data for feedback analysis
      feedbackData.set(ref, { 
        ...data, 
        timestamp: Date.now(), 
        messageType: 'institutional' 
      });
      console.log(`📱 Institutional bias alert sent: ${ref}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Failed to send institutional bias alert:', error);
    return false;
  }
}

/**
 * 🎯 Send SOL Sniper Timing Alert  
 */
export async function sendSOLSniperAlert(
  data: {
    symbol: string,
    bias: string,
    entry: [number, number], // [min, max]
    stopLoss: number,
    takeProfit: [number, number], // [TP1, TP2]
    invalidation: number,
    confidence: number
  }
) {
  const ref = `snp_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
  
  // Check deduplication (3 minutes for sniper)
  if (await isRecentlySent(ref, 'sniper', 180)) {
    console.log(`⏸️ SOL sniper alert skipped - recently sent (${ref})`);
    return false;
  }

  if (isSnoozing('sniper')) {
    console.log(`😴 SOL sniper alert snoozed`);
    return false;
  }

  const { symbol, bias, entry, stopLoss, takeProfit, invalidation, confidence } = data;
  const slPercent = ((stopLoss - entry[0]) / entry[0] * 100).toFixed(2);
  
  // Calculate position size for sniper alert
  let sizeInfo = '';
  try {
    const sizing = await sizeByConfidence({
      confidence,
      symbol,
      timeframe: '5m'
    });
    
    if (!sizing.error) {
      sizeInfo = `\n💰 Size: $${sizing.sizing.dollarAmount.toLocaleString()} (${sizing.sizing.percentage}%) | ${sizing.sizing.coinAmount} ${symbol}`;
    }
  } catch (error) {
    console.warn('⚠️ Sniper position sizing calculation failed:', error);
  }
  
  const text = `🎯 ${symbol} Sniper (5m)
Bias: ${bias} (institusional)
Entry: ${entry[0]}–${entry[1]}
SL: ${stopLoss} (${slPercent}%)
TP1/TP2: ${takeProfit[0]} / ${takeProfit[1]}
Invalidasi: close < ${invalidation} (5m)
Confidence: ${confidence}%${sizeInfo}

ref: ${ref}`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "🎯 Set Entry", callback_data: `entry:${symbol}:${ref}` },
        { text: "⚠️ Set Alert Lines", callback_data: `alerts:${symbol}:${ref}` },
        { text: "❌ Cancel", callback_data: `cancel:${symbol}:${ref}` },
      ],
      [
        { text: "👍 Bagus", callback_data: `rate:+:${ref}` },
        { text: "👎 Buruk", callback_data: `rate:-:${ref}` },
        { text: "⏸ Snooze 15m", callback_data: `snooze:15:${ref}` },
      ],
    ],
  };

  try {
    const response = await sendTelegramWithKeyboard(text, inlineKeyboard);
    if (response.ok) {
      markAsSent(ref, 'sniper');
      feedbackData.set(ref, { 
        ...data, 
        timestamp: Date.now(), 
        messageType: 'sniper' 
      });
      console.log(`📱 SOL sniper alert sent: ${ref}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Failed to send SOL sniper alert:', error);
    return false;
  }
}

/**
 * 📤 Send message with inline keyboard
 */
async function sendTelegramWithKeyboard(text: string, inlineKeyboard: any) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('📱 Telegram not configured - interactive message not sent');
    return { ok: false };
  }

  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "MarkdownV2",
      reply_markup: inlineKeyboard,
      disable_web_page_preview: true,
    }),
  });
}

/**
 * 🔄 Send Quick Command Response
 */
export async function sendQuickCommandResponse(command: string, args: string[] = []) {
  try {
    let text = '';
    
    switch (command) {
      case '/alpha':
        // Get latest institutional bias
        const response = await fetch('http://localhost:5000/api/signal/institutional/BTC');
        const biasData: any = await response.json();
        text = `🎯 **ALPHA REKAP (BTC)**

Bias: ${biasData.bias || 'NEUTRAL'}
Confidence: ${biasData.confidence || 0}%
Strength: ${biasData.strength || 'LOW'}

Analysis:
• Whale: ${biasData.analysis?.whale?.bias || 'neutral'}
• ETF: ${biasData.analysis?.etf?.bias || 'neutral'} 
• Sentiment: ${biasData.analysis?.sentiment?.score || 50}/100

Last Updated: ${new Date().toLocaleTimeString('id-ID')} WIB`;
        break;

      case '/sniper':
        const symbol = args[0] || 'SOL';
        text = `🎯 **${symbol} SNIPER STATUS**

Checking entry conditions...
⏱️ Next scan: <2 minutes
📊 Active setups: 0

Use /alpha for institutional bias first.`;
        break;

      case '/heat':
        const heatSymbol = args[0] || 'SOL';
        const timeframe = args[1] || '1h';
        text = `🔥 **LIQUIDATION HEATMAP (${heatSymbol})**

Timeframe: ${timeframe}
📊 Scanning clusters...

Major levels akan muncul di chart TradingView.`;
        break;

      case '/ob':
        const obSymbol = args[0] || 'SOL';
        text = `📘 **ORDERBOOK ANALYSIS (${obSymbol})**

📈 Bid/Ask Ratio: Scanning...
🏛️ Support/Resistance: Analyzing...

Detail analysis available via buttons.`;
        break;

      case '/panic':
        text = `🚨 **PANIC MODE ACTIVATED**

⏸️ Schedulers paused
❌ All alerts cancelled
🔄 Safe mode enabled

Use /resume to restart.`;
        break;

      default:
        text = `❓ **AVAILABLE COMMANDS**

/alpha - Latest institutional bias
/sniper SOL - SOL 5m timing
/heat SOL 1h - Liquidation clusters
/ob SOL - Orderbook analysis
/panic - Emergency stop`;
    }

    await sendTelegram(text, { parseMode: 'MarkdownV2' });
    return true;

  } catch (error) {
    console.error(`❌ Quick command ${command} failed:`, error);
    return false;
  }
}

/**
 * 🎛️ Deduplication & Anti-spam
 */
async function isRecentlySent(ref: string, category: string, seconds: number): Promise<boolean> {
  const key = `${category}_last`;
  const lastSent = sentMessages.get(key) || 0;
  const now = Date.now();
  
  return (now - lastSent) < (seconds * 1000);
}

function markAsSent(ref: string, category: string) {
  const key = `${category}_last`;
  sentMessages.set(key, Date.now());
  sentMessages.set(ref, Date.now());
}

function isSnoozing(category: string): boolean {
  const snoozeUntil = snoozeSettings.get(category) || 0;
  return Date.now() < snoozeUntil;
}

export function setSnooze(category: string, minutes: number) {
  const snoozeUntil = Date.now() + (minutes * 60 * 1000);
  snoozeSettings.set(category, snoozeUntil);
  console.log(`😴 ${category} alerts snoozed for ${minutes} minutes`);
}

/**
 * 💾 Store Feedback
 */
export function storeFeedback(ref: string, rating: '+' | '-', userId?: string) {
  const alertData = feedbackData.get(ref);
  if (!alertData) {
    console.log(`⚠️ No alert data found for ref: ${ref}`);
    return false;
  }

  const feedback = {
    ref,
    rating,
    userId,
    timestamp: Date.now(),
    alertData,
    responseTime: Date.now() - alertData.timestamp
  };

  // In production, save to database
  feedbackData.set(`feedback_${ref}`, feedback);
  
  console.log(`📊 Feedback stored: ${ref} -> ${rating === '+' ? '👍' : '👎'}`);
  return true;
}

/**
 * 📈 Get Feedback Stats
 */
export function getFeedbackStats() {
  const feedbacks = Array.from(feedbackData.entries())
    .filter(([key]) => key.startsWith('feedback_'))
    .map(([, data]) => data);

  const total = feedbacks.length;
  const positive = feedbacks.filter(f => f.rating === '+').length;
  const negative = feedbacks.filter(f => f.rating === '-').length;
  const winRate = total > 0 ? Math.round((positive / total) * 100) : 0;
  
  const avgResponseTime = total > 0 
    ? Math.round(feedbacks.reduce((sum, f) => sum + f.responseTime, 0) / total / 1000)
    : 0;

  return {
    total,
    positive, 
    negative,
    winRate,
    avgResponseTime
  };
}
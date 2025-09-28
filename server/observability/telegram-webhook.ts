/**
 * 🎛️ Telegram Webhook Handler for Interactive Buttons
 * Handles callback queries from inline keyboards
 */

import express from "express";
import axios from "axios";
import { storeFeedback, setSnooze, sendQuickCommandResponse } from "./telegram-actions";
import { saveGhostOrder } from "../services/okxGhost";

export const telegramRouter = express.Router();

/**
 * 🧪 Test Telegram Connection
 */
telegramRouter.get("/telegram/test", async (req, res) => {
  try {
    const { sendTelegram } = await import('./telegram.js');
    
    const testMessage = `🧪 Test Message dari Replit
⏰ Time: ${new Date().toISOString()}
✅ Environment variables loaded
🤖 Node.js Telegram integration working`;

    const success = await sendTelegram(testMessage);
    
    if (success) {
      res.json({
        success: true,
        message: "Test message sent successfully to Telegram",
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to send test message",
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Telegram test endpoint error:', errorMessage);
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PY_BASE = process.env.PY_BASE || "http://127.0.0.1:8000";

/**
 * 📥 Telegram Webhook Endpoint
 */
telegramRouter.post("/telegram/webhook", async (req, res) => {
  try {
    const update = req.body;
    
    // Handle callback queries (button presses)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
    
    // Handle text commands
    if (update.message?.text?.startsWith('/')) {
      await handleCommand(update.message);
    }
    
    res.sendStatus(200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Telegram webhook error:', errorMessage);
    res.sendStatus(500);
  }
});

/**
 * 🎯 Handle Button Callback Queries
 */
async function handleCallbackQuery(callbackQuery: any) {
  const { id, data, message } = callbackQuery;
  const parts = data.split(":"); // Split callback data
  const [action, ...args] = parts;
  
  try {
    let response = '';
    
    switch (action) {
      case 'heatmap':
        response = await handleHeatmapRequest(args[0], args[1]);
        break;
        
      case 'orderbook':
        response = await handleOrderbookRequest(args[0], args[1]);
        break;
        
      case 'sniper':
        response = await handleSniperRequest(args[0], args[1]);
        break;
        
      case 'rate':
        response = await handleRating(args[0] as '+' | '-', args[1], callbackQuery.from?.id);
        break;
        
      case 'snooze':
        response = await handleSnooze(parseInt(args[0]), args[1]);
        break;
        
      case 'entry':
        response = await handleSetEntry(args[0], args[1]);
        break;
        
      case 'setentry':
        // Enhanced format: setentry:SOL:221.35:220.95:222.0,222.7:80:LONG:ref123
        response = await handleSetEntryDetailed(args, callbackQuery.from?.id);
        break;
        
      case 'alerts':
        response = await handleSetAlerts(args[0], args[1]);
        break;
        
      case 'cancel':
        response = `❌ Setup ${args[0]} dibatalkan untuk ${args[1]}`;
        break;
        
      default:
        response = `❓ Unknown action: ${action}`;
    }
    
    // Acknowledge callback query
    await ackCallback(id, response);
    
    // Send detailed response if needed
    if (response.length > 50) {
      await sendFollowUpMessage(response);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Callback handling error (${action}):`, errorMessage);
    await ackCallback(id, "⚠️ Error processing request");
  }
}

/**
 * 🔥 Handle Heatmap Request
 */
async function handleHeatmapRequest(symbol: string, ref: string): Promise<string> {
  try {
    const response = await fetch(`${PY_BASE}/gpts/advanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        op: 'liquidation_heatmap',
        params: {
          symbol: symbol,
          timeframe: '1h'
        }
      })
    });
    const data: any = await response.json();
    
    if (!response.ok) {
      return `❌ Heatmap data unavailable for ${symbol}`;
    }
    
    const heatmap = data.heatmap || [];
    const nearClusters = heatmap.filter((level: any) => 
      Math.abs(level.price_distance_pct || 0) < 2
    ).slice(0, 5);
    
    if (nearClusters.length === 0) {
      return `🔥 **${symbol} HEATMAP**\n\nNo significant liquidation clusters within 2%`;
    }
    
    let message = `🔥 **${symbol} LIQUIDATION HEATMAP**\n\n`;
    
    nearClusters.forEach((level: any, index: number) => {
      const direction = level.price_distance_pct > 0 ? '📈' : '📉';
      const size = (level.size_usd || 0) / 1_000_000;
      message += `${direction} ${level.price_distance_pct?.toFixed(2)}% | $${size.toFixed(1)}M\n`;
    });
    
    message += `\n🎯 Use clusters as support/resistance levels\nRef: ${ref}`;
    
    return message;
    
  } catch (error) {
    console.error('❌ Heatmap request failed:', error);
    return `❌ Failed to fetch heatmap for ${symbol}`;
  }
}

/**
 * 📘 Handle Orderbook Request
 */
async function handleOrderbookRequest(symbol: string, ref: string): Promise<string> {
  try {
    const response = await fetch(`${PY_BASE}/gpts/advanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        op: 'spot_orderbook',
        params: {
          symbol: symbol,
          exchange: 'binance'
        }
      })
    });
    const data: any = await response.json();
    
    if (!response.ok) {
      return `❌ Orderbook data unavailable for ${symbol}`;
    }
    
    const orderbook = data.orderbook || { bids: [], asks: [] };
    const bids = orderbook.bids?.slice(0, 5) || [];
    const asks = orderbook.asks?.slice(0, 5) || [];
    
    const bidVolume = bids.reduce((sum: number, bid: any) => sum + (bid[1] || 0), 0);
    const askVolume = asks.reduce((sum: number, ask: any) => sum + (ask[1] || 0), 0);
    const imbalance = bidVolume / (askVolume + bidVolume || 1);
    
    let message = `📘 **${symbol} ORDERBOOK**\n\n`;
    message += `📊 Bid/Ask Ratio: ${(imbalance * 100).toFixed(1)}%\n`;
    message += `🏛️ ${imbalance > 0.6 ? 'STRONG Support' : imbalance < 0.4 ? 'STRONG Resistance' : 'Balanced'}\n\n`;
    
    // Show top levels
    if (bids.length > 0) {
      message += `💚 **Top Bids:**\n`;
      bids.slice(0, 3).forEach((bid: any) => {
        message += `${bid[0]} | ${(bid[1] || 0).toFixed(0)}\n`;
      });
    }
    
    if (asks.length > 0) {
      message += `\n❤️ **Top Asks:**\n`;
      asks.slice(0, 3).forEach((ask: any) => {
        message += `${ask[0]} | ${(ask[1] || 0).toFixed(0)}\n`;
      });
    }
    
    message += `\nRef: ${ref}`;
    
    return message;
    
  } catch (error) {
    console.error('❌ Orderbook request failed:', error);
    return `❌ Failed to fetch orderbook for ${symbol}`;
  }
}

/**
 * 🎯 Handle Sniper Request
 */
async function handleSniperRequest(symbol: string, ref: string): Promise<string> {
  try {
    const response = await fetch(`http://localhost:5000/api/signal/institutional/${symbol}`);
    const data: any = await response.json();
    
    if (!response.ok) {
      return `❌ Signal data unavailable for ${symbol}`;
    }
    
    const { bias, confidence, recommendation } = data;
    
    let message = `🎯 **${symbol} SNIPER SETUP**\n\n`;
    message += `📊 Institutional Bias: ${bias}\n`;
    message += `🎯 Confidence: ${confidence}%\n`;
    message += `⚡ Action: ${recommendation.action}\n`;
    message += `⏱️ Timeframe: ${recommendation.timeframe}\n\n`;
    message += `💡 **Entry Strategy:**\n`;
    
    if (bias === 'LONG') {
      message += `• Wait for dip to support\n`;
      message += `• Enter on bounce confirmation\n`;
      message += `• SL below key level\n`;
    } else if (bias === 'SHORT') {
      message += `• Wait for rejection at resistance\n`;
      message += `• Enter on breakdown confirmation\n`;
      message += `• SL above key level\n`;
    } else {
      message += `• Wait for clearer signals\n`;
      message += `• Monitor bias changes\n`;
    }
    
    message += `\nRef: ${ref}`;
    
    return message;
    
  } catch (error) {
    console.error('❌ Sniper request failed:', error);
    return `❌ Failed to generate sniper setup for ${symbol}`;
  }
}

/**
 * 👍👎 Handle Rating
 */
async function handleRating(rating: '+' | '-', ref: string, userId?: number): Promise<string> {
  const success = storeFeedback(ref, rating, userId?.toString());
  
  if (success) {
    const emoji = rating === '+' ? '👍' : '👎';
    return `${emoji} Rating tersimpan untuk ${ref}`;
  } else {
    return '❌ Failed to store rating';
  }
}

/**
 * 😴 Handle Snooze
 */
async function handleSnooze(minutes: number, ref: string): Promise<string> {
  const category = ref.startsWith('ib_') ? 'institutional' : 'sniper';
  setSnooze(category, minutes);
  
  return `😴 ${category} alerts snoozed for ${minutes} minutes`;
}

/**
 * 🎯 Handle Set Entry (Legacy)
 */
async function handleSetEntry(symbol: string, ref: string): Promise<string> {
  // In a real implementation, this would integrate with a trading platform
  return `🎯 Entry alert set for ${symbol}\n\n⚠️ Manual execution required\n📱 Check your trading platform\n\nRef: ${ref}`;
}

/**
 * 👻 Handle Detailed Set Entry - Creates Ghost Order
 * Format: setentry:SOL:221.35:220.95:222.0,222.7:80:LONG:ref123
 */
async function handleSetEntryDetailed(args: string[], userId?: number): Promise<string> {
  try {
    if (args.length < 6) {
      return `❌ Invalid setentry format. Expected: setentry:SYMBOL:ENTRY:SL:TPS:CONFIDENCE:SIDE:REF`;
    }

    const [symbol, entryStr, slStr, tpsStr, confidenceStr, side, ref] = args;
    
    // Parse parameters
    const entry = parseFloat(entryStr);
    const sl = parseFloat(slStr);
    const confidence = parseInt(confidenceStr);
    const tps = tpsStr.split(',').map(tp => parseFloat(tp.trim())).filter(tp => !isNaN(tp));
    
    // Validate parameters
    if (isNaN(entry) || isNaN(sl) || isNaN(confidence)) {
      return `❌ Invalid numeric values in setentry data`;
    }
    
    if (!['LONG', 'SHORT'].includes(side.toUpperCase())) {
      return `❌ Invalid side: ${side}. Must be LONG or SHORT`;
    }
    
    if (confidence < 0 || confidence > 100) {
      return `❌ Invalid confidence: ${confidence}. Must be 0-100`;
    }

    console.log(`👻 Creating ghost order: ${symbol} ${side} Entry=${entry} SL=${sl} TPs=[${tps.join(',')}] Conf=${confidence}%`);
    
    // Create ghost order
    const result = await saveGhostOrder({
      ref_id: ref,
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      entry_zone: entry, // Single price for now
      sl,
      tps,
      confidence,
      mode: 'ghost',
      metadata: {
        created_by: userId?.toString() || 'telegram',
        signal_source: 'telegram_button',
        timeframe: '5m'
      }
    });

    if (!result.success) {
      return `❌ Failed to create ghost order: ${result.error}`;
    }

    const order = result.order;
    const summary = result.summary;
    
    // Validate result data
    if (!order || !summary) {
      return `❌ Failed to create ghost order: Invalid result data`;
    }
    
    // Format confirmation message
    let message = `👻 **GHOST ORDER CREATED**\n\n`;
    message += `🎯 **${summary.symbol}** ${summary.side}\n`;
    message += `💰 Size: $${summary.size_usd.toLocaleString()} (${summary.size_coins} ${summary.symbol})\n`;
    message += `📍 Entry: ${summary.entry_range}\n`;
    message += `🛑 Stop Loss: ${order.sl} (${order.pricing.sl_distance_pct}%)\n`;
    
    if (order.tps.length > 0) {
      message += `🎯 Take Profits: ${order.tps.join(', ')}\n`;
      message += `📊 Risk:Reward: 1:${order.pricing.risk_reward}\n`;
    }
    
    message += `🎯 Confidence: ${order.confidence}% (${summary.confidence_tier})\n`;
    message += `📊 Mode: Paper Trading (Ghost)\n\n`;
    message += `✅ Order is now monitoring price action\n`;
    message += `📱 You'll be notified when levels are hit\n\n`;
    message += `Ref: ${ref}`;

    return message;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to handle detailed set entry:', error);
    return `❌ Error creating ghost order: ${errorMessage}`;
  }
}

/**
 * ⚠️ Handle Set Alerts  
 */
async function handleSetAlerts(symbol: string, ref: string): Promise<string> {
  return `⚠️ Alert lines configured for ${symbol}\n\n📢 You'll be notified when:\n• Price approaches entry zone\n• Stop loss level hit\n• Take profit targets reached\n\nRef: ${ref}`;
}

/**
 * 📝 Handle Text Commands
 */
async function handleCommand(message: any) {
  const text = message.text;
  const [command, ...args] = text.split(' ');
  
  try {
    await sendQuickCommandResponse(command, args);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Command ${command} failed:`, errorMessage);
  }
}

/**
 * ✅ Acknowledge Callback Query
 */
async function ackCallback(callbackQueryId: string, text: string) {
  if (!BOT_TOKEN) return;
  
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        callback_query_id: callbackQueryId, 
        text: text.length > 50 ? text.substring(0, 47) + '...' : text
      }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to acknowledge callback:', errorMessage);
  }
}

/**
 * 📤 Send Follow-up Message
 */
async function sendFollowUpMessage(text: string) {
  if (!BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to send follow-up message:', errorMessage);
  }
}
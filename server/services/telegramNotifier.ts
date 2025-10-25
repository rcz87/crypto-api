/**
 * Telegram Notifier Service
 *
 * Specialized notification service for pump detection alerts
 */

import { sendTelegram } from '../observability/telegram';
import { PumpSignal } from '../brain/pumpDetector';

/**
 * Send pump detection alert to Telegram
 */
export async function sendTelegramPumpAlert(signal: PumpSignal): Promise<void> {
  const { symbol, detected, confidence, strength, reasons, warnings, metrics, recommendation } = signal;

  if (!detected) {
    console.log(`[TelegramNotifier] Skipping alert for ${symbol} - not detected`);
    return;
  }

  // Build alert message
  let message = `🚨 *EARLY PUMP DETECTED* 🚨\n\n`;

  // Header
  message += `📊 *Symbol:* ${symbol}\n`;
  message += `⚡ *Strength:* ${strength.toUpperCase()}\n`;
  message += `📈 *Confidence:* ${(confidence * 100).toFixed(1)}%\n`;
  message += `⏰ *Time:* ${new Date(signal.timestamp).toLocaleString()}\n\n`;

  // Metrics
  message += `*📊 Key Metrics:*\n`;
  message += `├ Price: $${metrics.price.toFixed(2)}\n`;
  message += `├ OI Change: ${metrics.oiChangePercent > 0 ? '+' : ''}${metrics.oiChangePercent.toFixed(2)}%\n`;
  message += `├ Volume Spike: ${metrics.volumeChangePercent > 0 ? '+' : ''}${metrics.volumeChangePercent.toFixed(1)}%\n`;
  message += `├ Funding Rate: ${(metrics.fundingRate * 100).toFixed(3)}%\n`;
  message += `├ Consolidating: ${metrics.isConsolidating ? '✅ Yes' : '❌ No'}\n`;
  if (metrics.isConsolidating) {
    message += `├ Duration: ${metrics.consolidationDuration} minutes\n`;
  }
  if (metrics.whaleActivity) {
    message += `└ Whale Activity: ${metrics.whaleActivity.toUpperCase()}\n`;
  }
  message += `\n`;

  // Reasoning
  message += `*✅ Detection Reasons:*\n`;
  reasons.forEach(reason => {
    message += `${reason}\n`;
  });
  message += `\n`;

  // Warnings (if any)
  if (warnings.length > 0) {
    message += `*⚠️ Warnings:*\n`;
    warnings.forEach(warning => {
      message += `${warning}\n`;
    });
    message += `\n`;
  }

  // Trading Recommendation
  if (recommendation) {
    message += `*💡 Trading Recommendation:*\n`;
    message += `├ Action: *${recommendation.action}*\n`;
    message += `├ Urgency: ${recommendation.urgency.toUpperCase()}\n`;

    if (recommendation.action === 'ENTER') {
      message += `├ Entry: $${recommendation.entryPrice?.toFixed(2)}\n`;
      message += `├ Stop Loss: $${recommendation.stopLoss?.toFixed(2)} (${((1 - (recommendation.stopLoss! / recommendation.entryPrice!)) * 100).toFixed(2)}%)\n`;
      message += `└ Take Profits:\n`;
      recommendation.takeProfit?.forEach((tp, i) => {
        const profit = ((tp / recommendation.entryPrice! - 1) * 100).toFixed(2);
        message += `   ${i + 1}. $${tp.toFixed(2)} (+${profit}%)\n`;
      });
      message += `\n`;
      message += `*Position Size:* ${recommendation.positionSize?.toFixed(1)}% of capital\n`;
    } else if (recommendation.action === 'EXIT') {
      message += `└ Reason: Funding rate too high - possible top signal\n`;
    }
    message += `\n`;
  }

  // Footer
  message += `*🎯 Strategy:*\n`;
  message += `• Enter BEFORE explosive candle\n`;
  message += `• Use tight stop loss (2%)\n`;
  message += `• Take profits on spikes\n`;
  message += `• Exit if funding > 0.03% (retail FOMO = top)\n\n`;

  message += `⚠️ *Risk Warning:* Pump plays are high risk. Use proper position sizing.\n`;

  // Send to Telegram
  try {
    await sendTelegram(message);
    console.log(`✅ [TelegramNotifier] Pump alert sent for ${symbol}`);
  } catch (error) {
    console.error('❌ [TelegramNotifier] Failed to send alert:', error);
    throw error;
  }
}

/**
 * Send pump exit alert (when funding spikes)
 */
export async function sendTelegramPumpExitAlert(
  symbol: string,
  entryPrice: number,
  currentPrice: number,
  fundingRate: number,
  pnlPercent: number
): Promise<void> {
  let message = `🚪 *PUMP EXIT SIGNAL* 🚪\n\n`;

  message += `📊 *Symbol:* ${symbol}\n`;
  message += `💰 *Entry:* $${entryPrice.toFixed(2)}\n`;
  message += `💰 *Current:* $${currentPrice.toFixed(2)}\n`;
  message += `📈 *PnL:* ${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%\n\n`;

  message += `*⚠️ Exit Reason:*\n`;
  message += `Funding Rate: ${(fundingRate * 100).toFixed(3)}%\n`;
  message += `└ Retail FOMO detected - Possible top!\n\n`;

  message += `*💡 Recommendation:*\n`;
  message += `• Exit position NOW\n`;
  message += `• Take profits before dump\n`;
  message += `• Wait for next setup\n`;

  try {
    await sendTelegram(message);
    console.log(`✅ [TelegramNotifier] Exit alert sent for ${symbol}`);
  } catch (error) {
    console.error('❌ [TelegramNotifier] Failed to send exit alert:', error);
    throw error;
  }
}

/**
 * Send pump update (price movement after detection)
 */
export async function sendTelegramPumpUpdate(
  symbol: string,
  entryPrice: number,
  currentPrice: number,
  highPrice: number,
  pnlPercent: number,
  minutesElapsed: number
): Promise<void> {
  let message = `📊 *PUMP UPDATE* 📊\n\n`;

  message += `*Symbol:* ${symbol}\n`;
  message += `*Entry:* $${entryPrice.toFixed(2)}\n`;
  message += `*Current:* $${currentPrice.toFixed(2)}\n`;
  message += `*High:* $${highPrice.toFixed(2)}\n`;
  message += `*PnL:* ${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%\n`;
  message += `*Time:* ${minutesElapsed} minutes\n\n`;

  if (pnlPercent > 5) {
    message += `🎉 *Pump confirmed!* Consider taking partial profits.\n`;
  } else if (pnlPercent > 0) {
    message += `✅ Position in profit. Monitor for TP levels.\n`;
  } else {
    message += `⚠️ Position in drawdown. Watch stop loss.\n`;
  }

  try {
    await sendTelegram(message);
    console.log(`✅ [TelegramNotifier] Update sent for ${symbol}`);
  } catch (error) {
    console.error('❌ [TelegramNotifier] Failed to send update:', error);
  }
}

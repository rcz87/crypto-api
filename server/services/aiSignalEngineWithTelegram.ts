/**
 * Phase 6: AI Signal Engine with Auto Telegram Delivery
 * 
 * Wraps aiSignalEngine to add automatic Telegram signal delivery
 * Event-based: Sends to Telegram ONLY when real signals are generated
 */

import { aiSignalEngine, AISignal } from './aiSignalEngine';
import { telegramSignalService } from './telegramSignalService';

/**
 * Calculate SL/TP based on entry price and direction
 */
function calculateExecutionPrices(signal: AISignal, currentPrice: number = 200): {
  entry: number;
  stop_loss: number;
  take_profit: number[];
} {
  // Use current price as entry
  const entry = currentPrice;
  
  const slPercent = parseFloat(process.env.DEFAULT_SL_PERCENT || '0.003');
  const tpPercent = parseFloat(process.env.DEFAULT_TP_PERCENT || '0.007');
  
  // Calculate SL/TP based on direction
  let stop_loss: number;
  let take_profit: number[];
  
  if (signal.direction === 'long') {
    stop_loss = entry * (1 - slPercent);
    take_profit = [entry * (1 + tpPercent)];
  } else if (signal.direction === 'short') {
    stop_loss = entry * (1 + slPercent);
    take_profit = [entry * (1 - tpPercent)];
  } else {
    // Neutral - no SL/TP
    stop_loss = entry;
    take_profit = [entry];
  }
  
  return { entry, stop_loss, take_profit };
}

/**
 * Generate AI signal with automatic Telegram delivery
 * This replaces direct calls to aiSignalEngine.generateAISignal()
 */
export async function generateAISignalWithTelegram(symbol: string = 'SOL-USDT-SWAP'): Promise<AISignal> {
  // Generate the signal using existing AI engine
  const signal = await aiSignalEngine.generateAISignal(symbol);
  
  // Phase 6: Auto-send to Telegram if valid signal
  if (signal.direction !== 'neutral' && signal.confidence >= parseFloat(process.env.MIN_SIGNAL_CONFIDENCE || '0.6')) {
    try {
      // Get current price (placeholder - should get real price from exchange)
      const currentPrice = 200;
      
      // Calculate SL/TP if not provided
      let entryPrice = currentPrice;
      let stopLoss = signal.execution_details?.stop_loss || 0;
      let takeProfitLevels = signal.execution_details?.take_profit || [];
      
      if (!stopLoss || !takeProfitLevels.length) {
        const prices = calculateExecutionPrices(signal, currentPrice);
        entryPrice = prices.entry;
        stopLoss = prices.stop_loss;
        takeProfitLevels = prices.take_profit;
        
        // Update signal execution details if not set
        if (!signal.execution_details) {
          signal.execution_details = {
            recommended_size: 0.05,
            stop_loss: 0,
            take_profit: [],
            max_holding_time: '1-4 hours',
            optimal_entry_window: '5-15 minutes',
          };
        }
        signal.execution_details.stop_loss = stopLoss;
        signal.execution_details.take_profit = takeProfitLevels;
      }
      
      // Convert signal to Telegram-compatible format
      const telegramSignal = {
        symbol,
        bias: signal.direction as 'long' | 'short' | 'neutral',
        confidence: signal.confidence / 100, // Convert from 0-100 to 0-1
        data_quality: signal.confidence / 100,
        currentPrice: entryPrice,
        entry: entryPrice,
        execution_details: {
          stop_loss: stopLoss,
          take_profit: takeProfitLevels,
        },
        reasoning: {
          primary_factors: signal.reasoning.primary_factors,
          summary: signal.reasoning.market_context,
        },
        market_context: {
          funding_rate: undefined,
          oi_change: undefined,
          volume_delta: undefined,
        },
      };
      
      // Send to Telegram (event-based, no loop)
      await telegramSignalService.sendSignalMessage(telegramSignal);
      
      console.log(`📊 [Phase 6] Signal sent to Telegram: ${symbol} ${signal.direction.toUpperCase()} @ ${signal.confidence}%`);
    } catch (error) {
      // Don't fail signal generation if Telegram send fails
      console.error('❌ [Phase 6] Failed to send signal to Telegram:', error);
    }
  } else {
    console.log(`⏭️ [Phase 6] Signal not sent to Telegram (${signal.direction}, confidence: ${signal.confidence}%)`);
  }
  
  return signal;
}

// Re-export for convenience
export { aiSignalEngine, telegramSignalService };

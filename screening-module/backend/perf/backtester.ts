// Backtester - Historical simulation engine for strategy validation
// Professional backtesting for institutional trading systems

import { recordSignal, recordExecution, recordOutcome } from './signalTracker';
import { equityCurve, maxDrawdown, calculateFullMetrics, type PerfPoint, type PerformanceMetrics } from './metrics';
import { logger } from '../screener/logger';

export type Candle = { 
  ts: number; 
  open: number; 
  high: number; 
  low: number; 
  close: number; 
  volume: number; 
};

export type StrategyContext = {
  symbol: string;
  timeframe: string;
  cost: { 
    feeRate: number; 
    slipBps: number; 
    spreadBps: number; 
  };
  risk: { 
    equity: number; 
    riskPct: number; 
    atrMult: number; 
    tp1RR: number; 
    tp2RR: number; 
  };
};

export type ScreenerFunction = (candleWindow: Candle[]) => {
  label: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  confidence?: number;
  summary: string;
  regime?: string;
  htf?: any;
  mtf?: any;
};

export type BacktestResult = {
  stats: PerformanceMetrics;
  curve: Array<{ ts: number; equity: number; drawdown?: number }>;
  trades: Array<{
    entry_ts: number;
    exit_ts: number;
    symbol: string;
    side: 'long' | 'short';
    entry: number;
    exit: number;
    pnl: number;
    rr: number;
    reason: string;
  }>;
  summary: {
    startDate: string;
    endDate: string;
    duration: string;
    totalSignals: number;
    tradedSignals: number;
    skippedSignals: number;
  };
};

export async function runBacktest(
  ctx: StrategyContext, 
  candles: Candle[], 
  screener: ScreenerFunction,
  options: {
    startIndex?: number;
    warmupPeriod?: number;
    saveToDb?: boolean;
    maxTrades?: number;
  } = {}
): Promise<BacktestResult> {
  
  const { 
    startIndex = 100, 
    warmupPeriod = 50, 
    saveToDb = false,
    maxTrades = 1000
  } = options;
  
  logger.info('Starting backtest', {
    symbol: ctx.symbol,
    timeframe: ctx.timeframe,
    candles: candles.length,
    startIndex,
    warmupPeriod
  });

  const trades: PerfPoint[] = [];
  const tradeDetails: BacktestResult['trades'] = [];
  let totalSignals = 0;
  let tradedSignals = 0;
  let skippedSignals = 0;

  try {
    // Backtest loop - process each candle
    for (let i = startIndex; i < candles.length && trades.length < maxTrades; i++) {
      const window = candles.slice(Math.max(0, i - warmupPeriod), i + 1);
      const currentCandle = candles[i];
      const nextCandle = candles[i + 1];
      
      if (!nextCandle) break; // Need next candle for execution
      
      // Generate signal using screener
      const signal = screener(window);
      totalSignals++;
      
      // Record signal if enabled
      let signalId: number | null = null;
      let eventSignalId: string | null = null;
      if (saveToDb) {
        const signalResult = recordSignal({
          ts: currentCandle.ts,
          symbol: ctx.symbol,
          label: signal.label,
          score: signal.score,
          confidence: signal.confidence,
          timeframe: ctx.timeframe,
          regime: signal.regime,
          htf_bias: signal.htf?.combined?.bias,
          mtf_aligned: signal.mtf?.agree,
          summary: signal.summary
        });
        signalId = signalResult.signalId;
        eventSignalId = signalResult.eventSignalId;
      }
      
      // Skip HOLD signals
      if (signal.label === 'HOLD') {
        skippedSignals++;
        continue;
      }
      
      tradedSignals++;
      const side = signal.label === 'BUY' ? 'long' : 'short';
      
      // Calculate execution price with slippage
      const slippageFactor = ctx.cost.slipBps / 10000;
      const entry = signal.label === 'BUY' 
        ? nextCandle.open * (1 + slippageFactor)
        : nextCandle.open * (1 - slippageFactor);
      
      // Calculate costs
      const fee = entry * ctx.cost.feeRate;
      const slippageCost = entry * slippageFactor;
      const spreadCost = entry * (ctx.cost.spreadBps / 10000);
      const totalCosts = fee + slippageCost + spreadCost;
      
      // Calculate ATR-based stop loss and take profit
      const atr = calculateATR(window, 14);
      const stopDistance = ctx.risk.atrMult * atr;
      
      const sl = signal.label === 'BUY' 
        ? entry - stopDistance 
        : entry + stopDistance;
      
      const rrUnit = Math.abs(entry - sl);
      const tp1 = signal.label === 'BUY' 
        ? entry + ctx.risk.tp1RR * rrUnit 
        : entry - ctx.risk.tp1RR * rrUnit;
      
      // Record execution if enabled
      if (saveToDb && signalId) {
        recordExecution(signalId, {
          side,
          entry,
          sl,
          tp1,
          qty: 1, // Normalized to 1 unit
          fees: fee,
          slip: slippageCost,
          spread: spreadCost,
          symbol: ctx.symbol
        }, eventSignalId || undefined);
      }
      
      // Simulate trade execution over subsequent candles
      let exitPrice = entry;
      let exitTs = nextCandle.ts;
      let exitReason = 'timeout';
      let exitFound = false;
      
      // Look ahead for exit conditions
      for (let j = i + 1; j < Math.min(candles.length, i + 100); j++) { // Max 100 bars forward
        const futureCandle = candles[j];
        
        if (signal.label === 'BUY') {
          // Long position
          if (futureCandle.low <= sl) {
            exitPrice = sl;
            exitReason = 'stop_loss';
            exitTs = futureCandle.ts;
            exitFound = true;
            break;
          } else if (futureCandle.high >= tp1) {
            exitPrice = tp1;
            exitReason = 'take_profit';
            exitTs = futureCandle.ts;
            exitFound = true;
            break;
          }
        } else {
          // Short position
          if (futureCandle.high >= sl) {
            exitPrice = sl;
            exitReason = 'stop_loss';
            exitTs = futureCandle.ts;
            exitFound = true;
            break;
          } else if (futureCandle.low <= tp1) {
            exitPrice = tp1;
            exitReason = 'take_profit';
            exitTs = futureCandle.ts;
            exitFound = true;
            break;
          }
        }
      }
      
      // If no exit found, use last available candle
      if (!exitFound) {
        const lastCandle = candles[candles.length - 1];
        exitPrice = lastCandle.close;
        exitTs = lastCandle.ts;
        exitReason = 'end_of_data';
      }
      
      // Calculate PnL
      const pnlGross = signal.label === 'BUY' 
        ? exitPrice - entry 
        : entry - exitPrice;
      
      const pnlNet = pnlGross - totalCosts;
      const rr = rrUnit > 0 ? (Math.abs(exitPrice - entry) / rrUnit) * (pnlGross >= 0 ? 1 : -1) : 0;
      
      // Record trade
      trades.push({ ts: exitTs, pnl: pnlNet });
      
      tradeDetails.push({
        entry_ts: currentCandle.ts,
        exit_ts: exitTs,
        symbol: ctx.symbol,
        side,
        entry,
        exit: exitPrice,
        pnl: Math.round(pnlNet * 100) / 100,
        rr: Math.round(rr * 100) / 100,
        reason: exitReason
      });
      
      // Record outcome if enabled
      if (saveToDb && signalId) {
        recordOutcome(signalId, {
          exit_ts: exitTs,
          exit_price: exitPrice,
          pnl: pnlNet,
          pnl_pct: (pnlNet / entry) * 100,
          rr,
          reason: exitReason,
          duration_mins: Math.round((exitTs - currentCandle.ts) / (1000 * 60)),
          symbol: ctx.symbol
        }, eventSignalId || undefined);
      }
    }
    
    // Calculate final metrics
    const curve = equityCurve(trades, ctx.risk.equity);
    const stats = calculateFullMetrics(trades, ctx.risk.equity);
    
    const startDate = new Date(candles[startIndex].ts).toISOString().split('T')[0];
    const endDate = new Date(candles[candles.length - 1].ts).toISOString().split('T')[0];
    const durationDays = Math.round((candles[candles.length - 1].ts - candles[startIndex].ts) / (1000 * 60 * 60 * 24));
    
    const result: BacktestResult = {
      stats,
      curve,
      trades: tradeDetails,
      summary: {
        startDate,
        endDate,
        duration: `${durationDays} days`,
        totalSignals,
        tradedSignals,
        skippedSignals
      }
    };
    
    logger.info('Backtest completed', {
      symbol: ctx.symbol,
      totalTrades: trades.length,
      winRate: stats.winRate,
      totalReturn: stats.totalReturnPct,
      maxDrawdown: stats.maxDrawdownPct
    });
    
    return result;
    
  } catch (error) {
    logger.error('Backtest failed', { error, symbol: ctx.symbol });
    throw error;
  }
}

function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;
  
  let trSum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];
    
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    
    trSum += tr;
  }
  
  return trSum / period;
}

// Helper function to validate backtest inputs
export function validateBacktestInputs(
  ctx: StrategyContext,
  candles: Candle[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!ctx.symbol) errors.push('Symbol is required');
  if (!ctx.timeframe) errors.push('Timeframe is required');
  if (ctx.cost.feeRate < 0 || ctx.cost.feeRate > 0.01) errors.push('Fee rate must be between 0 and 1%');
  if (ctx.risk.equity <= 0) errors.push('Equity must be positive');
  if (ctx.risk.riskPct <= 0 || ctx.risk.riskPct > 10) errors.push('Risk percentage must be between 0 and 10%');
  
  if (candles.length < 200) errors.push('Minimum 200 candles required for backtest');
  
  // Validate candle data integrity
  const invalidCandles = candles.filter(c => 
    !c.ts || c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0 || 
    c.high < c.low || c.high < c.open || c.high < c.close || 
    c.low > c.open || c.low > c.close
  );
  
  if (invalidCandles.length > 0) {
    errors.push(`${invalidCandles.length} invalid candles detected`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
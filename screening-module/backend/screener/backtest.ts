/**
 * Backtesting Engine for Alert Rules
 *
 * Tests alert strategies against historical data to validate effectiveness
 * before deploying to production.
 */

import type { AlertConfig, AlertDecision } from './alert.rules';
import { decideAlert } from './alert.rules';
import type { IndicatorsResult } from '../../shared/schemas';
import { computeIndicators } from './indicators';

/**
 * Historical candle data point
 */
export interface HistoricalCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Backtest trade result
 */
export interface BacktestTrade {
  entryTime: Date;
  exitTime: Date;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPercent: number;
  outcome: 'win' | 'loss' | 'breakeven';
  holdingPeriod: number; // hours
  exitReason: 'stop_loss' | 'take_profit' | 'timeout' | 'signal_reversal';
}

/**
 * Complete backtest results
 */
export interface BacktestResult {
  // Summary statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;

  // P&L metrics
  totalPnL: number;
  totalPnLPercent: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;

  // Risk metrics
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;

  // Performance metrics
  avgHoldingPeriod: number;
  avgRiskReward: number;
  expectancy: number;

  // Individual trades
  trades: BacktestTrade[];

  // Equity curve
  equityCurve: Array<{ timestamp: Date; equity: number }>;

  // Configuration used
  config: AlertConfig;

  // Time period
  startDate: Date;
  endDate: Date;
  totalDays: number;
}

/**
 * Backtest parameters
 */
export interface BacktestParams {
  initialCapital: number;
  positionSize: number; // % of capital per trade
  stopLossATRMultiplier: number;
  takeProfitATRMultiplier: number;
  maxHoldingPeriod: number; // hours
  commission: number; // % per trade
  slippage: number; // % per trade
}

const DEFAULT_BACKTEST_PARAMS: BacktestParams = {
  initialCapital: 10000,
  positionSize: 0.05, // 5% of capital
  stopLossATRMultiplier: 1.5,
  takeProfitATRMultiplier: 3,
  maxHoldingPeriod: 72, // 3 days
  commission: 0.001, // 0.1%
  slippage: 0.001 // 0.1%
};

/**
 * Run backtest on historical data
 */
export async function runBacktest(
  candles: HistoricalCandle[],
  config: AlertConfig,
  params: BacktestParams = DEFAULT_BACKTEST_PARAMS
): Promise<BacktestResult> {
  if (candles.length < 100) {
    throw new Error('Insufficient data for backtesting (minimum 100 candles required)');
  }

  const trades: BacktestTrade[] = [];
  const equityCurve: Array<{ timestamp: Date; equity: number }> = [];

  let equity = params.initialCapital;
  let currentPosition: BacktestTrade | null = null;
  let maxEquity = params.initialCapital;
  let maxDrawdown = 0;

  // Simulate trading on historical data
  for (let i = 50; i < candles.length; i++) {
    const currentCandles = candles.slice(Math.max(0, i - 100), i + 1);

    // Compute indicators
    const indicators = computeIndicators(currentCandles);

    // Create mock screening result
    const score = calculateMockScore(indicators);
    const label = score >= 50 ? 'BUY' : score <= 50 ? 'SELL' : 'HOLD';
    const confidence = Math.abs(score - 50) * 2; // 0-100

    const result = {
      symbol: 'BACKTEST',
      score,
      label: label as 'BUY' | 'SELL' | 'HOLD',
      confidence,
      riskLevel: confidence > 80 ? 'low' : confidence > 50 ? 'medium' : 'high' as 'low' | 'medium' | 'high',
      regime: indicators.adx && indicators.adx > 25 ? 'trending' : 'quiet' as 'trending' | 'quiet',
      summary: 'Backtest signal',
      tradableSignal: null
    };

    // Check for entry signal if no position
    if (!currentPosition) {
      const decision = decideAlert(result, config);

      if (decision.shouldAlert && (decision.side === 'BUY' || decision.side === 'SELL')) {
        const currentCandle = candles[i];
        const atr = indicators.atr || currentCandle.close * 0.02; // fallback to 2%

        const entryPrice = currentCandle.close;
        const stopLoss = decision.side === 'BUY'
          ? entryPrice - (atr * params.stopLossATRMultiplier)
          : entryPrice + (atr * params.stopLossATRMultiplier);
        const takeProfit = decision.side === 'BUY'
          ? entryPrice + (atr * params.takeProfitATRMultiplier)
          : entryPrice - (atr * params.takeProfitATRMultiplier);

        currentPosition = {
          entryTime: currentCandle.timestamp,
          exitTime: currentCandle.timestamp, // will be updated
          side: decision.side,
          entryPrice,
          exitPrice: entryPrice, // will be updated
          stopLoss,
          takeProfit,
          pnl: 0, // will be calculated
          pnlPercent: 0,
          outcome: 'breakeven',
          holdingPeriod: 0,
          exitReason: 'signal_reversal'
        };
      }
    }

    // Check for exit if position exists
    else {
      const currentCandle = candles[i];
      const holdingHours = (currentCandle.timestamp.getTime() - currentPosition.entryTime.getTime()) / (1000 * 60 * 60);

      let shouldExit = false;
      let exitReason: BacktestTrade['exitReason'] = 'signal_reversal';
      let exitPrice = currentCandle.close;

      // Check stop loss
      if (currentPosition.side === 'BUY' && currentCandle.low <= currentPosition.stopLoss) {
        shouldExit = true;
        exitReason = 'stop_loss';
        exitPrice = currentPosition.stopLoss;
      } else if (currentPosition.side === 'SELL' && currentCandle.high >= currentPosition.stopLoss) {
        shouldExit = true;
        exitReason = 'stop_loss';
        exitPrice = currentPosition.stopLoss;
      }

      // Check take profit
      else if (currentPosition.side === 'BUY' && currentCandle.high >= currentPosition.takeProfit) {
        shouldExit = true;
        exitReason = 'take_profit';
        exitPrice = currentPosition.takeProfit;
      } else if (currentPosition.side === 'SELL' && currentCandle.low <= currentPosition.takeProfit) {
        shouldExit = true;
        exitReason = 'take_profit';
        exitPrice = currentPosition.takeProfit;
      }

      // Check timeout
      else if (holdingHours >= params.maxHoldingPeriod) {
        shouldExit = true;
        exitReason = 'timeout';
      }

      // Check reversal signal
      else {
        const decision = decideAlert(result, config);
        if (decision.shouldAlert && decision.side !== currentPosition.side && decision.side !== 'HOLD') {
          shouldExit = true;
          exitReason = 'signal_reversal';
        }
      }

      if (shouldExit) {
        // Calculate P&L
        const positionValue = equity * params.positionSize;
        const costs = positionValue * (params.commission + params.slippage);

        let pnl = 0;
        if (currentPosition.side === 'BUY') {
          pnl = ((exitPrice - currentPosition.entryPrice) / currentPosition.entryPrice) * positionValue - costs;
        } else {
          pnl = ((currentPosition.entryPrice - exitPrice) / currentPosition.entryPrice) * positionValue - costs;
        }

        const pnlPercent = (pnl / positionValue) * 100;

        currentPosition.exitTime = currentCandle.timestamp;
        currentPosition.exitPrice = exitPrice;
        currentPosition.pnl = pnl;
        currentPosition.pnlPercent = pnlPercent;
        currentPosition.holdingPeriod = holdingHours;
        currentPosition.exitReason = exitReason;
        currentPosition.outcome = pnl > 0.1 ? 'win' : pnl < -0.1 ? 'loss' : 'breakeven';

        equity += pnl;
        trades.push(currentPosition);
        currentPosition = null;

        // Track max drawdown
        if (equity > maxEquity) {
          maxEquity = equity;
        }
        const drawdown = maxEquity - equity;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    // Record equity
    equityCurve.push({
      timestamp: candles[i].timestamp,
      equity
    });
  }

  // Calculate statistics
  const winningTrades = trades.filter(t => t.outcome === 'win');
  const losingTrades = trades.filter(t => t.outcome === 'loss');
  const breakevenTrades = trades.filter(t => t.outcome === 'breakeven');

  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

  const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
  const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;

  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  const avgHoldingPeriod = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / trades.length
    : 0;

  const avgRR = losingTrades.length > 0 && winningTrades.length > 0
    ? avgWin / avgLoss
    : 0;

  const expectancy = trades.length > 0
    ? (winningTrades.length / trades.length) * avgWin - (losingTrades.length / trades.length) * avgLoss
    : 0;

  // Calculate Sharpe Ratio (simplified)
  const returns = equityCurve.map((point, i) =>
    i > 0 ? (point.equity - equityCurve[i-1].equity) / equityCurve[i-1].equity : 0
  );
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // annualized

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    breakevenTrades: breakevenTrades.length,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,

    totalPnL,
    totalPnLPercent: (totalPnL / params.initialCapital) * 100,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    profitFactor,

    maxDrawdown,
    maxDrawdownPercent: (maxDrawdown / maxEquity) * 100,
    sharpeRatio,

    avgHoldingPeriod,
    avgRiskReward: avgRR,
    expectancy,

    trades,
    equityCurve,
    config,

    startDate: candles[0].timestamp,
    endDate: candles[candles.length - 1].timestamp,
    totalDays: (candles[candles.length - 1].timestamp.getTime() - candles[0].timestamp.getTime()) / (1000 * 60 * 60 * 24)
  };
}

/**
 * Calculate mock confluence score from indicators
 * (In production, this would use your actual scoring logic)
 */
function calculateMockScore(indicators: IndicatorsResult): number {
  let score = 50; // neutral

  // RSI contribution
  if (indicators.rsi !== null) {
    if (indicators.rsi > 70) score -= 15;
    else if (indicators.rsi > 60) score += 5;
    else if (indicators.rsi > 50) score += 10;
    else if (indicators.rsi > 40) score += 5;
    else if (indicators.rsi > 30) score -= 5;
    else score -= 15;
  }

  // EMA trend contribution
  if (indicators.emaTrend === 'bullish') score += 15;
  else if (indicators.emaTrend === 'bearish') score -= 15;

  // MACD contribution
  if (indicators.macd.hist !== null) {
    score += indicators.macd.hist > 0 ? 10 : -10;
  }

  // ADX contribution (trend strength)
  if (indicators.adx !== null) {
    if (indicators.adx > 40) score += score > 50 ? 10 : -10; // amplify existing signal
    else if (indicators.adx < 20) score *= 0.7; // dampen weak trends
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Format backtest results for console output
 */
export function formatBacktestResults(results: BacktestResult): string {
  const lines = [
    '=' .repeat(80),
    '📊 BACKTEST RESULTS',
    '='.repeat(80),
    '',
    '📈 Period:',
    `   Start: ${results.startDate.toISOString()}`,
    `   End:   ${results.endDate.toISOString()}`,
    `   Days:  ${results.totalDays.toFixed(0)}`,
    '',
    '🎯 Performance:',
    `   Total Trades:    ${results.totalTrades}`,
    `   Win Rate:        ${results.winRate.toFixed(1)}%`,
    `   Profit Factor:   ${results.profitFactor.toFixed(2)}`,
    `   Sharpe Ratio:    ${results.sharpeRatio.toFixed(2)}`,
    '',
    '💰 P&L:',
    `   Total P&L:       $${results.totalPnL.toFixed(2)} (${results.totalPnLPercent.toFixed(1)}%)`,
    `   Avg Win:         $${results.avgWin.toFixed(2)}`,
    `   Avg Loss:        $${results.avgLoss.toFixed(2)}`,
    `   Largest Win:     $${results.largestWin.toFixed(2)}`,
    `   Largest Loss:    $${results.largestLoss.toFixed(2)}`,
    `   Avg R:R:         ${results.avgRiskReward.toFixed(2)}`,
    `   Expectancy:      $${results.expectancy.toFixed(2)}`,
    '',
    '📉 Risk:',
    `   Max Drawdown:    $${results.maxDrawdown.toFixed(2)} (${results.maxDrawdownPercent.toFixed(1)}%)`,
    `   Avg Hold Time:   ${results.avgHoldingPeriod.toFixed(1)} hours`,
    '',
    '📋 Configuration:',
    `   Buy Threshold:   ${results.config.buyThreshold}`,
    `   Sell Threshold:  ${results.config.sellThreshold}`,
    `   Min Confidence:  ${results.config.minConfidence}%`,
    `   Risk Filter:     ${results.config.riskFilter ? 'Enabled' : 'Disabled'}`,
    `   Regime Filter:   ${results.config.regimeFilter.join(', ')}`,
    '',
    '='.repeat(80)
  ];

  return lines.join('\n');
}

/**
 * Export results to CSV for further analysis
 */
export function exportTradesCSV(trades: BacktestTrade[]): string {
  const headers = [
    'Entry Time',
    'Exit Time',
    'Side',
    'Entry Price',
    'Exit Price',
    'Stop Loss',
    'Take Profit',
    'P&L',
    'P&L %',
    'Outcome',
    'Holding Period (h)',
    'Exit Reason'
  ];

  const rows = trades.map(t => [
    t.entryTime.toISOString(),
    t.exitTime.toISOString(),
    t.side,
    t.entryPrice.toFixed(2),
    t.exitPrice.toFixed(2),
    t.stopLoss.toFixed(2),
    t.takeProfit.toFixed(2),
    t.pnl.toFixed(2),
    t.pnlPercent.toFixed(2),
    t.outcome,
    t.holdingPeriod.toFixed(1),
    t.exitReason
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

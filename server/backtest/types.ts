/**
 * Backtesting Framework - Type Definitions
 *
 * Comprehensive types for backtesting the Meta-Brain Fusion Engine
 */

import { UnifiedSignal, UnifiedSignalWithMetrics } from '../brain/unifiedSignal';

/**
 * Historical candle data point
 */
export interface HistoricalCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Historical derivatives data point
 */
export interface HistoricalDerivatives {
  timestamp: number;
  oi: number;
  oi_change_percent: number;
  funding_rate: number;
  long_short_ratio: number;
  liquidations_long: number;
  liquidations_short: number;
}

/**
 * Trade result from backtest
 */
export interface BacktestTrade {
  // Entry
  entryTime: number;
  entryPrice: number;
  signal: 'LONG' | 'SHORT';
  confidence: number;

  // Exit
  exitTime: number;
  exitPrice: number;
  exitReason: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'TIMEOUT' | 'REVERSE_SIGNAL';

  // Performance
  pnl: number;
  pnlPercent: number;
  rMultiple: number; // R:R achieved

  // Risk Management
  stopLoss: number;
  takeProfits: number[];
  riskAmount: number;

  // Signal Details
  fusionSignal: UnifiedSignalWithMetrics;
  triggeredRules: string[];

  // Duration
  durationMinutes: number;
}

/**
 * Performance metrics for a backtest run
 */
export interface BacktestPerformance {
  // Summary
  symbol: string;
  startDate: number;
  endDate: number;
  totalTrades: number;

  // Win/Loss
  wins: number;
  losses: number;
  winrate: number;

  // PnL
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number; // Total wins / Total losses

  // Risk-adjusted
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;

  // R-Multiple
  avgRMultiple: number;
  expectancy: number; // (Win% × AvgWin) - (Loss% × AvgLoss)

  // Trade characteristics
  avgTradeDuration: number; // minutes
  avgConfidence: number;

  // Rule performance breakdown
  rulePerformance: RulePerformance[];

  // Time-based analysis
  performanceByHour: { [hour: number]: PerformanceSummary };
  performanceByDay: { [day: string]: PerformanceSummary };

  // Confidence analysis
  performanceByConfidence: {
    high: PerformanceSummary; // >0.8
    medium: PerformanceSummary; // 0.6-0.8
    low: PerformanceSummary; // <0.6
  };
}

/**
 * Performance for individual fusion rule
 */
export interface RulePerformance {
  ruleNumber: number;
  ruleName: string;
  trades: number;
  wins: number;
  losses: number;
  winrate: number;
  totalPnl: number;
  avgRMultiple: number;
  avgConfidence: number;
}

/**
 * Summary performance metrics
 */
export interface PerformanceSummary {
  trades: number;
  wins: number;
  winrate: number;
  totalPnl: number;
  avgRMultiple: number;
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  // Data range
  symbol: string;
  startDate: Date;
  endDate: Date;

  // Capital & Risk
  initialCapital: number;
  riskPerTradePercent: number; // % of capital per trade
  maxPositionSize: number; // max $ per position

  // Execution
  slippage: number; // % slippage on entry/exit
  commission: number; // % commission per trade

  // Rules
  minConfidence: number; // minimum confidence to take trade
  enabledRules: number[]; // which of 11 rules to test (1-11)

  // Time filters
  tradingHoursOnly?: boolean; // trade only during specific hours
  excludeWeekends?: boolean;

  // Position management
  maxConcurrentTrades: number;
  exitOnReverseSignal: boolean;
  usePartialTakeProfits: boolean; // scale out at TP1, TP2, TP3
  trailStopLoss: boolean;

  // Timeframe
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
}

/**
 * Backtest result (complete output)
 */
export interface BacktestResult {
  config: BacktestConfig;
  performance: BacktestPerformance;
  trades: BacktestTrade[];
  equityCurve: { timestamp: number; equity: number }[];
  drawdownCurve: { timestamp: number; drawdown: number }[];

  // Metadata
  executionTime: number; // ms
  dataPoints: number;
  generatedAt: string;
}

/**
 * Market state at a given timestamp (for backtesting)
 */
export interface MarketState {
  timestamp: number;
  price: HistoricalCandle;
  derivatives: HistoricalDerivatives;

  // Technical indicators (computed)
  sma20?: number;
  sma50?: number;
  rsi?: number;
  atr?: number;

  // Order book simulation (if available)
  bidAskSpread?: number;
  liquidity?: {
    bidLiquidity: number;
    askLiquidity: number;
  };
}

/**
 * Position tracking during backtest
 */
export interface BacktestPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: number;
  size: number;
  stopLoss: number;
  takeProfits: number[];
  takeProfitHits: boolean[]; // which TPs have been hit
  fusionSignal: UnifiedSignalWithMetrics;
  unrealizedPnl: number;
}

/**
 * Backtest event (for detailed logging)
 */
export interface BacktestEvent {
  timestamp: number;
  type: 'SIGNAL' | 'ENTRY' | 'EXIT' | 'TP_HIT' | 'SL_HIT' | 'REVERSE' | 'TIMEOUT';
  data: any;
  message: string;
}

/**
 * Performance Analyzer
 *
 * Analyzes backtest results and calculates performance metrics
 */

import {
  BacktestTrade,
  BacktestConfig,
  BacktestPerformance,
  RulePerformance,
  PerformanceSummary
} from './types';

export class PerformanceAnalyzer {
  /**
   * Analyze backtest trades and generate performance metrics
   */
  analyze(trades: BacktestTrade[], config: BacktestConfig): BacktestPerformance {
    if (trades.length === 0) {
      return this.getEmptyPerformance(config);
    }

    // Basic metrics
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const winrate = wins.length / trades.length;

    // PnL metrics
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const totalPnlPercent = (totalPnl / config.initialCapital) * 100;
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? Math.abs(avgWin * wins.length / (avgLoss * losses.length)) : 0;

    // Risk-adjusted metrics
    const returns = this.calculateReturns(trades, config.initialCapital);
    const sharpeRatio = this.calculateSharpe(returns);
    const sortinoRatio = this.calculateSortino(returns);
    const { maxDrawdown, maxDrawdownPercent } = this.calculateMaxDrawdown(trades, config.initialCapital);

    // R-Multiple
    const avgRMultiple = trades.reduce((sum, t) => sum + t.rMultiple, 0) / trades.length;
    const expectancy = (winrate * avgWin) - ((1 - winrate) * avgLoss);

    // Trade characteristics
    const avgTradeDuration = trades.reduce((sum, t) => sum + t.durationMinutes, 0) / trades.length;
    const avgConfidence = trades.reduce((sum, t) => sum + t.confidence, 0) / trades.length;

    // Rule performance breakdown
    const rulePerformance = this.analyzeRulePerformance(trades);

    // Time-based analysis
    const performanceByHour = this.analyzeByHour(trades);
    const performanceByDay = this.analyzeByDay(trades);

    // Confidence analysis
    const performanceByConfidence = this.analyzeByConfidence(trades);

    return {
      symbol: config.symbol,
      startDate: config.startDate.getTime(),
      endDate: config.endDate.getTime(),
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winrate,
      totalPnl,
      totalPnlPercent,
      avgWin,
      avgLoss,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      maxDrawdownPercent,
      avgRMultiple,
      expectancy,
      avgTradeDuration,
      avgConfidence,
      rulePerformance,
      performanceByHour,
      performanceByDay,
      performanceByConfidence
    };
  }

  /**
   * Analyze performance by fusion rule
   */
  private analyzeRulePerformance(trades: BacktestTrade[]): RulePerformance[] {
    const ruleMap = new Map<number, BacktestTrade[]>();

    // Group trades by rule
    for (const trade of trades) {
      for (const ruleNum of trade.triggeredRules) {
        if (!ruleMap.has(ruleNum)) {
          ruleMap.set(ruleNum, []);
        }
        ruleMap.get(ruleNum)!.push(trade);
      }
    }

    // Calculate performance for each rule
    const performance: RulePerformance[] = [];
    for (const [ruleNum, ruleTrades] of ruleMap.entries()) {
      const wins = ruleTrades.filter(t => t.pnl > 0);
      const totalPnl = ruleTrades.reduce((sum, t) => sum + t.pnl, 0);
      const avgRMultiple = ruleTrades.reduce((sum, t) => sum + t.rMultiple, 0) / ruleTrades.length;
      const avgConfidence = ruleTrades.reduce((sum, t) => sum + t.confidence, 0) / ruleTrades.length;

      performance.push({
        ruleNumber: ruleNum,
        ruleName: this.getRuleName(ruleNum),
        trades: ruleTrades.length,
        wins: wins.length,
        losses: ruleTrades.length - wins.length,
        winrate: wins.length / ruleTrades.length,
        totalPnl,
        avgRMultiple,
        avgConfidence
      });
    }

    return performance.sort((a, b) => b.totalPnl - a.totalPnl);
  }

  /**
   * Analyze performance by hour of day
   */
  private analyzeByHour(trades: BacktestTrade[]): { [hour: number]: PerformanceSummary } {
    const hourMap = new Map<number, BacktestTrade[]>();

    for (const trade of trades) {
      const hour = new Date(trade.entryTime).getUTCHours();
      if (!hourMap.has(hour)) {
        hourMap.set(hour, []);
      }
      hourMap.get(hour)!.push(trade);
    }

    const result: { [hour: number]: PerformanceSummary } = {};
    for (const [hour, hourTrades] of hourMap.entries()) {
      result[hour] = this.calculateSummary(hourTrades);
    }

    return result;
  }

  /**
   * Analyze performance by day of week
   */
  private analyzeByDay(trades: BacktestTrade[]): { [day: string]: PerformanceSummary } {
    const dayMap = new Map<string, BacktestTrade[]>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const trade of trades) {
      const dayIndex = new Date(trade.entryTime).getUTCDay();
      const dayName = dayNames[dayIndex];
      if (!dayMap.has(dayName)) {
        dayMap.set(dayName, []);
      }
      dayMap.get(dayName)!.push(trade);
    }

    const result: { [day: string]: PerformanceSummary } = {};
    for (const [day, dayTrades] of dayMap.entries()) {
      result[day] = this.calculateSummary(dayTrades);
    }

    return result;
  }

  /**
   * Analyze performance by confidence level
   */
  private analyzeByConfidence(trades: BacktestTrade[]): {
    high: PerformanceSummary;
    medium: PerformanceSummary;
    low: PerformanceSummary;
  } {
    const high = trades.filter(t => t.confidence > 0.8);
    const medium = trades.filter(t => t.confidence >= 0.6 && t.confidence <= 0.8);
    const low = trades.filter(t => t.confidence < 0.6);

    return {
      high: this.calculateSummary(high),
      medium: this.calculateSummary(medium),
      low: this.calculateSummary(low)
    };
  }

  /**
   * Calculate performance summary for a subset of trades
   */
  private calculateSummary(trades: BacktestTrade[]): PerformanceSummary {
    if (trades.length === 0) {
      return {
        trades: 0,
        wins: 0,
        winrate: 0,
        totalPnl: 0,
        avgRMultiple: 0
      };
    }

    const wins = trades.filter(t => t.pnl > 0);
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    const avgRMultiple = trades.reduce((sum, t) => sum + t.rMultiple, 0) / trades.length;

    return {
      trades: trades.length,
      wins: wins.length,
      winrate: wins.length / trades.length,
      totalPnl,
      avgRMultiple
    };
  }

  /**
   * Calculate returns array for metrics
   */
  private calculateReturns(trades: BacktestTrade[], initialCapital: number): number[] {
    const returns: number[] = [];
    let capital = initialCapital;

    for (const trade of trades) {
      const returnPercent = (trade.pnl / capital) * 100;
      returns.push(returnPercent);
      capital += trade.pnl;
    }

    return returns;
  }

  /**
   * Calculate Sharpe Ratio
   */
  private calculateSharpe(returns: number[]): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = this.calculateStdDev(returns, avgReturn);

    if (stdDev === 0) return 0;

    // Annualized Sharpe (assuming daily returns)
    const riskFreeRate = 0; // Simplification
    return ((avgReturn - riskFreeRate) / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate Sortino Ratio (downside deviation only)
   */
  private calculateSortino(returns: number[]): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < 0);

    if (downsideReturns.length === 0) return 0;

    const downsideStdDev = this.calculateStdDev(downsideReturns, 0);

    if (downsideStdDev === 0) return 0;

    return (avgReturn / downsideStdDev) * Math.sqrt(252);
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;

    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;

    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(trades: BacktestTrade[], initialCapital: number): {
    maxDrawdown: number;
    maxDrawdownPercent: number;
  } {
    let peak = initialCapital;
    let maxDrawdown = 0;
    let currentCapital = initialCapital;

    for (const trade of trades) {
      currentCapital += trade.pnl;

      if (currentCapital > peak) {
        peak = currentCapital;
      }

      const drawdown = peak - currentCapital;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      maxDrawdown,
      maxDrawdownPercent: (maxDrawdown / peak) * 100
    };
  }

  /**
   * Get rule name by number
   */
  private getRuleName(ruleNum: number): string {
    const names: { [key: number]: string } = {
      1: 'Short Squeeze Setup',
      2: 'Long Squeeze Setup',
      3: 'Strong Buy',
      4: 'Distribution Phase',
      5: 'Trend Change',
      6: 'Contrarian Long',
      7: 'Contrarian Short',
      8: 'Liquidation Bounce',
      9: 'ETF Flow',
      10: 'High Vol Adjust',
      11: 'Brain Override'
    };

    return names[ruleNum] || `Rule ${ruleNum}`;
  }

  /**
   * Get empty performance (no trades)
   */
  private getEmptyPerformance(config: BacktestConfig): BacktestPerformance {
    return {
      symbol: config.symbol,
      startDate: config.startDate.getTime(),
      endDate: config.endDate.getTime(),
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winrate: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      avgRMultiple: 0,
      expectancy: 0,
      avgTradeDuration: 0,
      avgConfidence: 0,
      rulePerformance: [],
      performanceByHour: {},
      performanceByDay: {},
      performanceByConfidence: {
        high: { trades: 0, wins: 0, winrate: 0, totalPnl: 0, avgRMultiple: 0 },
        medium: { trades: 0, wins: 0, winrate: 0, totalPnl: 0, avgRMultiple: 0 },
        low: { trades: 0, wins: 0, winrate: 0, totalPnl: 0, avgRMultiple: 0 }
      }
    };
  }
}

// Export singleton
export const performanceAnalyzer = new PerformanceAnalyzer();

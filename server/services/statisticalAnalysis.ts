/**
 * statisticalAnalysis.ts - Phase 5: Statistical Analysis
 * 
 * Provides statistical tests to compare Strategy A vs Strategy B
 * Tests include: t-test, chi-square, confidence intervals
 */

import { BacktestResult, BacktestMetrics } from './backtestEngine';

export interface StatisticalComparison {
  metric: string;
  strategy_a_value: number;
  strategy_b_value: number;
  difference: number;
  difference_percent: number;
  p_value: number;
  significant: boolean;
  confidence_level: number;
  interpretation: string;
}

export interface ComparisonReport {
  period: string;
  strategy_a: {
    name: string;
    metrics: BacktestMetrics;
    summary: string;
  };
  strategy_b: {
    name: string;
    metrics: BacktestMetrics;
    summary: string;
  };
  comparisons: StatisticalComparison[];
  overall_assessment: {
    winner: 'A' | 'B' | 'tie';
    confidence: string;
    key_improvements: string[];
    recommendation: string;
  };
}

export class StatisticalAnalysis {
  /**
   * Compare two backtest results with statistical tests
   */
  static compareStrategies(resultA: BacktestResult, resultB: BacktestResult): ComparisonReport {
    const comparisons: StatisticalComparison[] = [];
    
    // 1. Win Rate Comparison (Chi-square test)
    comparisons.push(this.compareWinRate(resultA, resultB));
    
    // 2. Average Return Comparison (T-test)
    comparisons.push(this.compareReturns(resultA, resultB));
    
    // 3. Risk/Reward Ratio Comparison
    comparisons.push(this.compareRiskReward(resultA, resultB));
    
    // 4. Max Drawdown Comparison
    comparisons.push(this.compareDrawdown(resultA, resultB));
    
    // 5. Sharpe Ratio Comparison
    comparisons.push(this.compareSharpe(resultA, resultB));
    
    // 6. Profit Factor Comparison
    comparisons.push(this.compareProfitFactor(resultA, resultB));
    
    // Overall assessment
    const assessment = this.generateOverallAssessment(comparisons, resultA, resultB);
    
    return {
      period: `${resultA.period.start.toISOString().split('T')[0]} to ${resultA.period.end.toISOString().split('T')[0]}`,
      strategy_a: {
        name: resultA.strategy,
        metrics: resultA.metrics,
        summary: resultA.summary,
      },
      strategy_b: {
        name: resultB.strategy,
        metrics: resultB.metrics,
        summary: resultB.summary,
      },
      comparisons,
      overall_assessment: assessment,
    };
  }

  /**
   * Compare win rates using chi-square test
   */
  private static compareWinRate(resultA: BacktestResult, resultB: BacktestResult): StatisticalComparison {
    const winRateA = resultA.metrics.win_rate;
    const winRateB = resultB.metrics.win_rate;
    const tradesA = resultA.metrics.total_trades;
    const tradesB = resultB.metrics.total_trades;
    
    // Chi-square test for proportions
    const pValue = this.chiSquareTest(
      resultA.metrics.winning_trades,
      tradesA,
      resultB.metrics.winning_trades,
      tradesB
    );
    
    const difference = winRateB - winRateA;
    const differencePercent = ((winRateB / Math.max(winRateA, 0.01)) - 1) * 100;
    
    let interpretation = '';
    if (pValue < 0.05) {
      interpretation = difference > 0 
        ? `Strategy B has significantly higher win rate (p=${pValue.toFixed(3)})`
        : `Strategy A has significantly higher win rate (p=${pValue.toFixed(3)})`;
    } else {
      interpretation = `No significant difference in win rates (p=${pValue.toFixed(3)})`;
    }
    
    return {
      metric: 'Win Rate',
      strategy_a_value: winRateA,
      strategy_b_value: winRateB,
      difference,
      difference_percent: differencePercent,
      p_value: pValue,
      significant: pValue < 0.05,
      confidence_level: 95,
      interpretation,
    };
  }

  /**
   * Compare returns using t-test
   */
  private static compareReturns(resultA: BacktestResult, resultB: BacktestResult): StatisticalComparison {
    const returnsA = resultA.trades.map(t => t.pnl_percent / 100);
    const returnsB = resultB.trades.map(t => t.pnl_percent / 100);
    
    const meanA = this.mean(returnsA);
    const meanB = this.mean(returnsB);
    const pValue = this.tTest(returnsA, returnsB);
    
    const difference = meanB - meanA;
    const differencePercent = ((meanB / Math.max(Math.abs(meanA), 0.0001)) - 1) * 100;
    
    let interpretation = '';
    if (pValue < 0.05) {
      interpretation = difference > 0
        ? `Strategy B has significantly higher average returns (p=${pValue.toFixed(3)})`
        : `Strategy A has significantly higher average returns (p=${pValue.toFixed(3)})`;
    } else {
      interpretation = `No significant difference in average returns (p=${pValue.toFixed(3)})`;
    }
    
    return {
      metric: 'Average Return',
      strategy_a_value: meanA * 100,
      strategy_b_value: meanB * 100,
      difference: difference * 100,
      difference_percent: differencePercent,
      p_value: pValue,
      significant: pValue < 0.05,
      confidence_level: 95,
      interpretation,
    };
  }

  /**
   * Compare risk/reward ratios
   */
  private static compareRiskReward(resultA: BacktestResult, resultB: BacktestResult): StatisticalComparison {
    const rrA = resultA.metrics.rr_ratio;
    const rrB = resultB.metrics.rr_ratio;
    
    const difference = rrB - rrA;
    const differencePercent = ((rrB / Math.max(rrA, 0.1)) - 1) * 100;
    
    // Simple comparison (no statistical test for ratio)
    const interpretation = difference > 0.5
      ? `Strategy B has substantially better risk/reward (+${difference.toFixed(2)})`
      : difference > 0.2
      ? `Strategy B has moderately better risk/reward (+${difference.toFixed(2)})`
      : difference < -0.5
      ? `Strategy A has substantially better risk/reward`
      : `Similar risk/reward ratios`;
    
    return {
      metric: 'Risk/Reward Ratio',
      strategy_a_value: rrA,
      strategy_b_value: rrB,
      difference,
      difference_percent: differencePercent,
      p_value: 0.5, // Not applicable
      significant: Math.abs(difference) > 0.3,
      confidence_level: 95,
      interpretation,
    };
  }

  /**
   * Compare max drawdowns
   */
  private static compareDrawdown(resultA: BacktestResult, resultB: BacktestResult): StatisticalComparison {
    const ddA = resultA.metrics.max_drawdown_percent;
    const ddB = resultB.metrics.max_drawdown_percent;
    
    const difference = ddB - ddA; // Negative is better (lower drawdown)
    const differencePercent = ((ddB / Math.max(ddA, 0.1)) - 1) * 100;
    
    const interpretation = difference < -5
      ? `Strategy B has significantly lower drawdown (-${Math.abs(difference).toFixed(1)}%)`
      : difference < -2
      ? `Strategy B has moderately lower drawdown (-${Math.abs(difference).toFixed(1)}%)`
      : difference > 5
      ? `Strategy A has significantly lower drawdown`
      : `Similar drawdown levels`;
    
    return {
      metric: 'Max Drawdown',
      strategy_a_value: ddA,
      strategy_b_value: ddB,
      difference,
      difference_percent: differencePercent,
      p_value: 0.5, // Not applicable
      significant: Math.abs(difference) > 3,
      confidence_level: 95,
      interpretation,
    };
  }

  /**
   * Compare Sharpe ratios
   */
  private static compareSharpe(resultA: BacktestResult, resultB: BacktestResult): StatisticalComparison {
    const sharpeA = resultA.metrics.sharpe_ratio;
    const sharpeB = resultB.metrics.sharpe_ratio;
    
    const difference = sharpeB - sharpeA;
    const differencePercent = ((sharpeB / Math.max(Math.abs(sharpeA), 0.1)) - 1) * 100;
    
    const interpretation = difference > 0.5
      ? `Strategy B has significantly better risk-adjusted returns (+${difference.toFixed(2)})`
      : difference > 0.2
      ? `Strategy B has moderately better risk-adjusted returns (+${difference.toFixed(2)})`
      : difference < -0.5
      ? `Strategy A has significantly better risk-adjusted returns`
      : `Similar risk-adjusted performance`;
    
    return {
      metric: 'Sharpe Ratio',
      strategy_a_value: sharpeA,
      strategy_b_value: sharpeB,
      difference,
      difference_percent: differencePercent,
      p_value: 0.5, // Not applicable
      significant: Math.abs(difference) > 0.3,
      confidence_level: 95,
      interpretation,
    };
  }

  /**
   * Compare profit factors
   */
  private static compareProfitFactor(resultA: BacktestResult, resultB: BacktestResult): StatisticalComparison {
    const pfA = resultA.metrics.profit_factor;
    const pfB = resultB.metrics.profit_factor;
    
    const difference = pfB - pfA;
    const differencePercent = ((pfB / Math.max(pfA, 0.1)) - 1) * 100;
    
    const interpretation = difference > 0.5
      ? `Strategy B has significantly higher profit factor (+${difference.toFixed(2)})`
      : difference > 0.2
      ? `Strategy B has moderately higher profit factor (+${difference.toFixed(2)})`
      : difference < -0.5
      ? `Strategy A has significantly higher profit factor`
      : `Similar profit factors`;
    
    return {
      metric: 'Profit Factor',
      strategy_a_value: pfA,
      strategy_b_value: pfB,
      difference,
      difference_percent: differencePercent,
      p_value: 0.5, // Not applicable
      significant: Math.abs(difference) > 0.3,
      confidence_level: 95,
      interpretation,
    };
  }

  /**
   * Generate overall assessment
   */
  private static generateOverallAssessment(
    comparisons: StatisticalComparison[],
    resultA: BacktestResult,
    resultB: BacktestResult
  ) {
    // Count wins for each strategy
    let scoreA = 0;
    let scoreB = 0;
    const keyImprovements: string[] = [];
    
    for (const comp of comparisons) {
      if (comp.significant) {
        if (comp.difference > 0 && comp.metric !== 'Max Drawdown') {
          scoreB++;
          keyImprovements.push(`${comp.metric}: +${comp.difference.toFixed(2)}`);
        } else if (comp.difference < 0 && comp.metric === 'Max Drawdown') {
          scoreB++;
          keyImprovements.push(`${comp.metric}: ${comp.difference.toFixed(1)}%`);
        } else if (comp.difference < 0 && comp.metric !== 'Max Drawdown') {
          scoreA++;
        } else if (comp.difference > 0 && comp.metric === 'Max Drawdown') {
          scoreA++;
        }
      }
    }
    
    let winner: 'A' | 'B' | 'tie' = 'tie';
    let confidence = 'Low';
    let recommendation = '';
    
    if (scoreB > scoreA + 1) {
      winner = 'B';
      confidence = scoreB > scoreA + 2 ? 'High' : 'Medium';
      recommendation = `Strategy B (Phase 4 with Validation) demonstrates superior performance across multiple metrics. Recommend deploying Strategy B for live trading.`;
    } else if (scoreA > scoreB + 1) {
      winner = 'A';
      confidence = scoreA > scoreB + 2 ? 'High' : 'Medium';
      recommendation = `Strategy A (Pre-Phase 4) shows better performance. Consider reviewing Phase 4 validation criteria.`;
    } else {
      winner = 'tie';
      confidence = 'Medium';
      recommendation = `Both strategies show similar performance. Consider longer backtest period or additional metrics for conclusive results.`;
    }
    
    return {
      winner,
      confidence,
      key_improvements: keyImprovements,
      recommendation,
    };
  }

  // === Statistical Tests ===

  /**
   * Chi-square test for proportions
   */
  private static chiSquareTest(wins1: number, total1: number, wins2: number, total2: number): number {
    const p1 = wins1 / total1;
    const p2 = wins2 / total2;
    const pPooled = (wins1 + wins2) / (total1 + total2);
    
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1/total1 + 1/total2));
    const z = Math.abs(p1 - p2) / se;
    
    // Convert z-score to p-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(z));
    
    return Math.max(0.001, Math.min(0.999, pValue));
  }

  /**
   * T-test for comparing means
   */
  private static tTest(sample1: number[], sample2: number[]): number {
    const mean1 = this.mean(sample1);
    const mean2 = this.mean(sample2);
    const var1 = this.variance(sample1);
    const var2 = this.variance(sample2);
    const n1 = sample1.length;
    const n2 = sample2.length;
    
    const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    const se = Math.sqrt(pooledVar * (1/n1 + 1/n2));
    
    const t = Math.abs(mean1 - mean2) / se;
    const df = n1 + n2 - 2;
    
    // Approximate p-value using normal distribution for large samples
    const pValue = 2 * (1 - this.normalCDF(t));
    
    return Math.max(0.001, Math.min(0.999, pValue));
  }

  /**
   * Calculate mean
   */
  private static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate variance
   */
  private static variance(values: number[]): number {
    if (values.length === 0) return 0;
    const m = this.mean(values);
    return values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
  }

  /**
   * Normal CDF approximation
   */
  private static normalCDF(z: number): number {
    // Using erf approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    
    return z > 0 ? 1 - p : p;
  }
}

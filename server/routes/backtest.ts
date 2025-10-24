/**
 * backtest.ts - Phase 5: Backtest API Routes
 * 
 * Provides endpoints for running A/B tests and comparing strategies
 */

import { Router, Request, Response } from 'express';
import { BacktestEngine, BacktestConfig } from '../services/backtestEngine';
import { StatisticalAnalysis } from '../services/statisticalAnalysis';

const router = Router();

/**
 * GET /api/backtest/compare
 * 
 * Run A/B comparison between Strategy A (Pre-Phase 4) and Strategy B (Phase 4)
 * 
 * Query params:
 * - symbol: Trading pair (default: SOL-USDT-SWAP)
 * - days: Lookback period in days (default: 7)
 * - capital: Initial capital in USD (default: 10000)
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'SOL-USDT-SWAP';
    const days = parseInt(req.query.days as string) || 7;
    const capital = parseInt(req.query.capital as string) || 10000;

    console.log(`[Backtest API] Starting A/B comparison for ${symbol}, ${days} days`);

    // Define date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Config for Strategy A (Pre-Phase 4)
    const configA: BacktestConfig = {
      strategy: 'A',
      symbol,
      startDate,
      endDate,
      initialCapital: capital,
      positionSizePercent: 0.05, // 5% per trade
      slippageBps: 10, // 0.1% slippage
      feePercent: 0.0006, // 0.06% OKX taker fee
    };

    // Config for Strategy B (Phase 4)
    const configB: BacktestConfig = {
      strategy: 'B',
      symbol,
      startDate,
      endDate,
      initialCapital: capital,
      positionSizePercent: 0.05, // 5% per trade
      slippageBps: 10, // 0.1% slippage
      feePercent: 0.0006, // 0.06% OKX taker fee
    };

    // Run backtests in parallel
    console.log(`[Backtest API] Running Strategy A backtest...`);
    const engineA = new BacktestEngine(configA);
    const resultA = await engineA.run();

    console.log(`[Backtest API] Running Strategy B backtest...`);
    const engineB = new BacktestEngine(configB);
    const resultB = await engineB.run();

    // Perform statistical comparison
    console.log(`[Backtest API] Performing statistical analysis...`);
    const comparison = StatisticalAnalysis.compareStrategies(resultA, resultB);

    res.json({
      success: true,
      data: comparison,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Backtest API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run backtest comparison',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/backtest/run
 * 
 * Run a single backtest for specified strategy
 * 
 * Query params:
 * - strategy: 'A' or 'B' (required)
 * - symbol: Trading pair (default: SOL-USDT-SWAP)
 * - days: Lookback period in days (default: 7)
 * - capital: Initial capital in USD (default: 10000)
 */
router.get('/run', async (req: Request, res: Response) => {
  try {
    const strategy = req.query.strategy as 'A' | 'B';
    if (!strategy || (strategy !== 'A' && strategy !== 'B')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid strategy parameter. Must be "A" or "B"',
      });
    }

    const symbol = (req.query.symbol as string) || 'SOL-USDT-SWAP';
    const days = parseInt(req.query.days as string) || 7;
    const capital = parseInt(req.query.capital as string) || 10000;

    console.log(`[Backtest API] Running Strategy ${strategy} for ${symbol}, ${days} days`);

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const config: BacktestConfig = {
      strategy,
      symbol,
      startDate,
      endDate,
      initialCapital: capital,
      positionSizePercent: 0.05,
      slippageBps: 10,
      feePercent: 0.0006,
    };

    const engine = new BacktestEngine(config);
    const result = await engine.run();

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Backtest API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run backtest',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/backtest/quick-compare
 * 
 * Quick comparison using mock data for testing (doesn't fetch real historical data)
 */
router.get('/quick-compare', async (req: Request, res: Response) => {
  try {
    // Generate mock comparison report for testing
    const mockComparison = {
      period: '2025-10-17 to 2025-10-24',
      strategy_a: {
        name: 'Pre-Phase 4 (No Validation)',
        metrics: {
          total_trades: 52,
          winning_trades: 24,
          losing_trades: 28,
          win_rate: 0.46,
          rr_ratio: 1.5,
          total_return_percent: -3.2,
          max_drawdown_percent: 18.5,
          sharpe_ratio: 0.6,
          profit_factor: 1.2,
        },
        summary: 'Unprofitable strategy with Low quality signals. Win rate: 46.2%, RR: 1.50:1, Drawdown: 18.5%',
      },
      strategy_b: {
        name: 'Phase 4 (With Validation)',
        metrics: {
          total_trades: 18,
          winning_trades: 12,
          losing_trades: 6,
          win_rate: 0.67,
          rr_ratio: 2.4,
          total_return_percent: 8.7,
          max_drawdown_percent: 11.2,
          sharpe_ratio: 1.8,
          profit_factor: 2.3,
        },
        summary: 'Profitable strategy with High quality signals. Win rate: 66.7%, RR: 2.40:1, Drawdown: 11.2%',
      },
      comparisons: [
        {
          metric: 'Win Rate',
          strategy_a_value: 0.46,
          strategy_b_value: 0.67,
          difference: 0.21,
          difference_percent: 45.7,
          p_value: 0.003,
          significant: true,
          confidence_level: 95,
          interpretation: 'Strategy B has significantly higher win rate (p=0.003)',
        },
        {
          metric: 'Risk/Reward Ratio',
          strategy_a_value: 1.5,
          strategy_b_value: 2.4,
          difference: 0.9,
          difference_percent: 60.0,
          p_value: 0.5,
          significant: true,
          confidence_level: 95,
          interpretation: 'Strategy B has substantially better risk/reward (+0.90)',
        },
        {
          metric: 'Max Drawdown',
          strategy_a_value: 18.5,
          strategy_b_value: 11.2,
          difference: -7.3,
          difference_percent: -39.5,
          p_value: 0.5,
          significant: true,
          confidence_level: 95,
          interpretation: 'Strategy B has significantly lower drawdown (-7.3%)',
        },
        {
          metric: 'Sharpe Ratio',
          strategy_a_value: 0.6,
          strategy_b_value: 1.8,
          difference: 1.2,
          difference_percent: 200.0,
          p_value: 0.5,
          significant: true,
          confidence_level: 95,
          interpretation: 'Strategy B has significantly better risk-adjusted returns (+1.20)',
        },
      ],
      overall_assessment: {
        winner: 'B' as const,
        confidence: 'High',
        key_improvements: [
          'Win Rate: +0.21',
          'Risk/Reward Ratio: +0.90',
          'Max Drawdown: -7.3%',
          'Sharpe Ratio: +1.20',
        ],
        recommendation: 'Strategy B (Phase 4 with Validation) demonstrates superior performance across multiple metrics. Recommend deploying Strategy B for live trading.',
      },
    };

    res.json({
      success: true,
      data: mockComparison,
      note: 'This is mock data for testing. Use /api/backtest/compare for real backtest.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Backtest API] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate quick comparison',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

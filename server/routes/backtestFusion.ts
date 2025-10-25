/**
 * Fusion Backtest API Routes
 *
 * Endpoints for backtesting the Meta-Brain Fusion Engine
 */

import { Router, Request, Response } from 'express';
import { backtestEngine } from '../backtest/backtestEngine';
import { BacktestConfig } from '../backtest/types';

const router = Router();

/**
 * POST /api/backtest-fusion/run
 * Run a fusion backtest with specified configuration
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      symbol = 'BTC',
      startDate,
      endDate,
      initialCapital = 10000,
      riskPerTradePercent = 2,
      maxPositionSize = 5000,
      slippage = 0.1,
      commission = 0.1,
      minConfidence = 0.7,
      enabledRules = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      maxConcurrentTrades = 1,
      exitOnReverseSignal = false,
      usePartialTakeProfits = true,
      trailStopLoss = true,
      timeframe = '1h'
    } = req.body;

    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    // Build config
    const config: BacktestConfig = {
      symbol,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      initialCapital,
      riskPerTradePercent,
      maxPositionSize,
      slippage,
      commission,
      minConfidence,
      enabledRules,
      maxConcurrentTrades,
      exitOnReverseSignal,
      usePartialTakeProfits,
      trailStopLoss,
      timeframe
    };

    console.log(`🧪 [API] Starting fusion backtest: ${symbol} ${timeframe} ${startDate} → ${endDate}`);

    // Run backtest
    const result = await backtestEngine.run(config);

    res.json({
      success: true,
      data: result,
      summary: {
        totalTrades: result.performance.totalTrades,
        winrate: `${(result.performance.winrate * 100).toFixed(1)}%`,
        totalPnl: `$${result.performance.totalPnl.toFixed(2)}`,
        totalPnlPercent: `${result.performance.totalPnlPercent.toFixed(2)}%`,
        sharpeRatio: result.performance.sharpeRatio.toFixed(2),
        maxDrawdown: `${result.performance.maxDrawdownPercent.toFixed(2)}%`,
        avgRMultiple: result.performance.avgRMultiple.toFixed(2),
        executionTime: `${result.executionTime}ms`
      }
    });

  } catch (error: any) {
    console.error('❌ [API] Fusion backtest failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Backtest failed'
    });
  }
});

/**
 * POST /api/backtest-fusion/quick
 * Run a quick backtest with default settings (last 7 days)
 */
router.post('/quick', async (req: Request, res: Response) => {
  try {
    const { symbol = 'BTC' } = req.body;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    const config: BacktestConfig = {
      symbol,
      startDate,
      endDate,
      initialCapital: 10000,
      riskPerTradePercent: 2,
      maxPositionSize: 5000,
      slippage: 0.1,
      commission: 0.1,
      minConfidence: 0.7,
      enabledRules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      maxConcurrentTrades: 1,
      exitOnReverseSignal: false,
      usePartialTakeProfits: true,
      trailStopLoss: true,
      timeframe: '1h'
    };

    console.log(`🚀 [API] Quick fusion backtest: ${symbol} (last 7 days)`);

    const result = await backtestEngine.run(config);

    res.json({
      success: true,
      data: result,
      summary: {
        period: 'Last 7 days',
        totalTrades: result.performance.totalTrades,
        winrate: `${(result.performance.winrate * 100).toFixed(1)}%`,
        totalPnl: `$${result.performance.totalPnl.toFixed(2)}`,
        totalPnlPercent: `${result.performance.totalPnlPercent.toFixed(2)}%`,
        bestRule: result.performance.rulePerformance[0]?.ruleName || 'N/A',
        worstRule: result.performance.rulePerformance[result.performance.rulePerformance.length - 1]?.ruleName || 'N/A'
      }
    });

  } catch (error: any) {
    console.error('❌ [API] Quick fusion backtest failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Quick backtest failed'
    });
  }
});

/**
 * GET /api/backtest-fusion/examples
 * Get example backtest configurations
 */
router.get('/examples', (req: Request, res: Response) => {
  res.json({
    success: true,
    examples: [
      {
        name: 'Conservative Strategy',
        description: 'Low risk, high confidence signals only',
        config: {
          symbol: 'BTC',
          initialCapital: 10000,
          riskPerTradePercent: 1,
          minConfidence: 0.8,
          enabledRules: [1, 2, 3, 11], // Only squeeze & strong buy rules
          usePartialTakeProfits: true,
          trailStopLoss: true,
          timeframe: '1h'
        }
      },
      {
        name: 'Aggressive Strategy',
        description: 'Higher risk, all rules enabled',
        config: {
          symbol: 'BTC',
          initialCapital: 10000,
          riskPerTradePercent: 3,
          minConfidence: 0.6,
          enabledRules: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxConcurrentTrades: 3,
          usePartialTakeProfits: false,
          timeframe: '15m'
        }
      },
      {
        name: 'Contrarian Focus',
        description: 'Focus on counter-trend plays',
        config: {
          symbol: 'BTC',
          initialCapital: 10000,
          riskPerTradePercent: 2,
          minConfidence: 0.7,
          enabledRules: [6, 7, 8], // Contrarian long/short + liquidation bounce
          usePartialTakeProfits: true,
          timeframe: '1h'
        }
      },
      {
        name: 'Squeeze Hunter',
        description: 'Target short/long squeeze opportunities',
        config: {
          symbol: 'BTC',
          initialCapital: 10000,
          riskPerTradePercent: 2.5,
          minConfidence: 0.75,
          enabledRules: [1, 2], // Only squeeze rules
          usePartialTakeProfits: true,
          trailStopLoss: true,
          timeframe: '1h'
        }
      }
    ]
  });
});

export default router;

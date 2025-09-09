// Performance Routes - REST API endpoints for backtesting and performance analysis
// Professional performance API for institutional trading

import express from 'express';
import { z } from 'zod';
import { runBacktest, validateBacktestInputs } from './backtester';
import { calculateFullMetrics, getPerformanceByPeriod, type PerfPoint } from './metrics';
import { 
  fetchJoined, 
  fetchCompletedTrades, 
  fetchOpenPositions, 
  getSignalStats,
  deleteOldSignals,
  recordSignal,
  recordExecution,
  recordOutcome 
} from './signalTracker';
import { db, getDBStats, resetPerfDB, checkDBHealth } from './db';
import { logger } from '../screener/logger';

export const perfRouter = express.Router();

// Validation schemas
const BacktestRequestSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().default('5m'),
  candles: z.array(z.object({
    ts: z.number(),
    open: z.number().positive(),
    high: z.number().positive(),
    low: z.number().positive(),
    close: z.number().positive(),
    volume: z.number().nonnegative()
  })).min(200),
  cost: z.object({
    feeRate: z.number().min(0).max(0.01).default(0.0005),
    slipBps: z.number().min(0).max(100).default(10),
    spreadBps: z.number().min(0).max(100).default(5)
  }).default({}),
  risk: z.object({
    equity: z.number().positive().default(10000),
    riskPct: z.number().min(0.1).max(10).default(0.5),
    atrMult: z.number().min(0.5).max(5).default(1.5),
    tp1RR: z.number().min(0.5).max(10).default(1.5),
    tp2RR: z.number().min(1).max(10).default(2.5)
  }).default({})
});

const TrackSignalSchema = z.object({
  ts: z.number(),
  symbol: z.string(),
  label: z.enum(['BUY', 'SELL', 'HOLD']),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1).optional(),
  timeframe: z.string(),
  regime: z.string().optional(),
  htf_bias: z.string().optional(),
  mtf_aligned: z.boolean().optional(),
  summary: z.string().optional()
});

// Dummy screener adapter for backtesting (replace with real integration)
function screenerAdapter(candles: any[]): {
  label: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  confidence: number;
  summary: string;
  regime?: string;
  htf?: any;
  mtf?: any;
} {
  if (candles.length < 50) {
    return { label: 'HOLD', score: 50, confidence: 0.5, summary: 'Insufficient data' };
  }
  
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const sma20 = candles.slice(-20).reduce((sum, c) => sum + c.close, 0) / 20;
  
  // Simple momentum strategy for demo
  const momentum = (last.close - prev.close) / prev.close;
  const position = last.close > sma20 ? 1 : -1;
  
  let label: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let score = 50;
  
  if (momentum > 0.001 && position > 0) {
    label = 'BUY';
    score = Math.min(85, 60 + momentum * 10000);
  } else if (momentum < -0.001 && position < 0) {
    label = 'SELL';
    score = Math.min(85, 60 + Math.abs(momentum) * 10000);
  }
  
  return {
    label,
    score: Math.round(score),
    confidence: Math.min(0.9, 0.5 + Math.abs(momentum) * 100),
    summary: `Demo strategy: momentum=${(momentum * 100).toFixed(3)}%, sma=${position > 0 ? 'bull' : 'bear'}`,
    regime: momentum > 0.005 ? 'trending' : 'ranging'
  };
}

// POST /api/perf/backtest - Run historical backtest
perfRouter.post('/backtest', express.json({ limit: '5mb' }), async (req, res) => {
  try {
    logger.info('Backtest request received', { 
      symbol: req.body.symbol,
      candles: req.body.candles?.length 
    });

    const input = BacktestRequestSchema.parse(req.body);
    const { symbol, timeframe, candles, cost, risk } = input;
    
    // Validate inputs
    const validation = validateBacktestInputs({ symbol, timeframe, cost, risk }, candles);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        details: validation.errors
      });
    }
    
    // Run backtest
    const result = await runBacktest(
      { symbol, timeframe, cost, risk },
      candles,
      screenerAdapter,
      {
        startIndex: 100,
        warmupPeriod: 50,
        saveToDb: false, // Don't save demo backtests to DB
        maxTrades: 1000
      }
    );
    
    logger.info('Backtest completed', {
      symbol,
      totalTrades: result.stats.totalTrades,
      winRate: result.stats.winRate,
      totalReturn: result.stats.totalReturnPct
    });
    
    res.json({
      success: true,
      result,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('Backtest failed', { error: error.message });
    res.status(400).json({
      error: 'BACKTEST_FAILED',
      details: error.message
    });
  }
});

// GET /api/perf/summary - Get performance summary
perfRouter.get('/summary', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    const trades = db.prepare(`
      SELECT s.symbol, s.timeframe, s.label,
             COUNT(o.id) as trade_count,
             AVG(CASE WHEN o.pnl > 0 THEN 1.0 ELSE 0.0 END) as win_rate,
             AVG(o.pnl) as avg_pnl,
             SUM(o.pnl) as total_pnl,
             AVG(o.rr) as avg_rr,
             MAX(o.pnl) as best_trade,
             MIN(o.pnl) as worst_trade
      FROM signals s
      INNER JOIN outcomes o ON o.signal_id = s.id
      WHERE s.ts >= ?
      GROUP BY s.symbol, s.timeframe, s.label
      ORDER BY total_pnl DESC
    `).all(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const overall = db.prepare(`
      SELECT COUNT(o.id) as total_trades,
             AVG(CASE WHEN o.pnl > 0 THEN 1.0 ELSE 0.0 END) as overall_win_rate,
             SUM(o.pnl) as total_pnl,
             AVG(o.pnl) as avg_pnl,
             MAX(o.pnl) as best_trade,
             MIN(o.pnl) as worst_trade
      FROM outcomes o
      INNER JOIN signals s ON s.id = o.signal_id
      WHERE s.ts >= ?
    `).get(Date.now() - days * 24 * 60 * 60 * 1000);
    
    res.json({
      success: true,
      data: {
        period: `${days} days`,
        overall: overall || {},
        by_strategy: trades || []
      }
    });
    
  } catch (error) {
    logger.error('Failed to get performance summary', { error: error.message });
    res.status(500).json({
      error: 'SUMMARY_FAILED',
      details: error.message
    });
  }
});

// GET /api/perf/equity - Get equity curve
perfRouter.get('/equity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 1000;
    const startEquity = parseFloat(req.query.start_equity as string) || 10000;
    
    const trades = db.prepare(`
      SELECT o.exit_ts as ts, o.pnl, s.symbol
      FROM outcomes o
      INNER JOIN signals s ON s.id = o.signal_id
      WHERE o.pnl IS NOT NULL
      ORDER BY o.exit_ts ASC
      LIMIT ?
    `).all(limit) as PerfPoint[];
    
    if (trades.length === 0) {
      return res.json({
        success: true,
        data: {
          curve: [{ ts: Date.now(), equity: startEquity, drawdown: 0 }],
          metrics: calculateFullMetrics([], startEquity)
        }
      });
    }
    
    let equity = startEquity;
    let peak = startEquity;
    const curve = trades.map(trade => {
      equity += trade.pnl;
      peak = Math.max(peak, equity);
      const drawdown = peak - equity;
      
      return {
        ts: trade.ts,
        equity: Math.round(equity * 100) / 100,
        drawdown: Math.round(drawdown * 100) / 100,
        peak: Math.round(peak * 100) / 100
      };
    });
    
    const metrics = calculateFullMetrics(trades, startEquity);
    
    res.json({
      success: true,
      data: {
        curve,
        metrics,
        summary: {
          start_equity: startEquity,
          current_equity: curve[curve.length - 1]?.equity || startEquity,
          total_trades: trades.length
        }
      }
    });
    
  } catch (error) {
    logger.error('Failed to get equity curve', { error: error.message });
    res.status(500).json({
      error: 'EQUITY_FAILED',
      details: error.message
    });
  }
});

// GET /api/perf/trades - Get trade history
perfRouter.get('/trades', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const symbol = req.query.symbol as string;
    
    let query = `
      SELECT s.ts, s.symbol, s.label, s.score, s.confidence, s.timeframe, s.regime,
             e.side, e.entry, e.sl, e.tp1, e.qty, e.notional,
             o.exit_ts, o.exit_price, o.pnl, o.pnl_pct, o.rr, o.reason, o.duration_mins
      FROM signals s
      INNER JOIN executions e ON e.signal_id = s.id
      INNER JOIN outcomes o ON o.signal_id = s.id
      WHERE o.pnl IS NOT NULL
    `;
    
    const params: any[] = [];
    
    if (symbol) {
      query += ` AND s.symbol = ?`;
      params.push(symbol);
    }
    
    query += ` ORDER BY o.exit_ts DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const trades = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: trades,
      pagination: {
        limit,
        offset,
        count: trades.length
      }
    });
    
  } catch (error) {
    logger.error('Failed to get trades', { error: error.message });
    res.status(500).json({
      error: 'TRADES_FAILED',
      details: error.message
    });
  }
});

// GET /api/perf/positions - Get open positions
perfRouter.get('/positions', async (req, res) => {
  try {
    const positions = fetchOpenPositions();
    
    res.json({
      success: true,
      data: positions,
      count: positions.length
    });
    
  } catch (error) {
    logger.error('Failed to get open positions', { error: error.message });
    res.status(500).json({
      error: 'POSITIONS_FAILED',
      details: error.message
    });
  }
});

// POST /api/perf/track - Manually track a signal
perfRouter.post('/track', express.json(), async (req, res) => {
  try {
    const signal = TrackSignalSchema.parse(req.body);
    
    const signalId = recordSignal(signal);
    
    if (signalId) {
      res.json({
        success: true,
        signal_id: signalId,
        message: 'Signal tracked successfully'
      });
    } else {
      res.status(400).json({
        error: 'TRACKING_FAILED',
        details: 'Failed to record signal'
      });
    }
    
  } catch (error) {
    logger.error('Failed to track signal', { error: error.message });
    res.status(400).json({
      error: 'TRACKING_FAILED',
      details: error.message
    });
  }
});

// GET /api/perf/stats - Get database and performance stats
perfRouter.get('/stats', async (req, res) => {
  try {
    const dbStats = getDBStats();
    const signalStats = getSignalStats(30);
    const isHealthy = checkDBHealth();
    
    res.json({
      success: true,
      data: {
        database: {
          ...dbStats,
          healthy: isHealthy
        },
        signals: signalStats,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json({
      error: 'STATS_FAILED',
      details: error.message
    });
  }
});

// GET /api/perf/performance/:period - Get performance by period
perfRouter.get('/performance/:period', async (req, res) => {
  try {
    const period = req.params.period as 'daily' | 'weekly' | 'monthly';
    
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({
        error: 'INVALID_PERIOD',
        details: 'Period must be daily, weekly, or monthly'
      });
    }
    
    const trades = db.prepare(`
      SELECT o.exit_ts as ts, o.pnl, s.symbol
      FROM outcomes o
      INNER JOIN signals s ON s.id = o.signal_id
      WHERE o.pnl IS NOT NULL
      ORDER BY o.exit_ts ASC
    `).all() as PerfPoint[];
    
    const performance = getPerformanceByPeriod(trades, period);
    
    res.json({
      success: true,
      data: {
        period,
        performance,
        summary: {
          total_periods: performance.length,
          total_trades: trades.length
        }
      }
    });
    
  } catch (error) {
    logger.error('Failed to get performance by period', { error: error.message });
    res.status(500).json({
      error: 'PERFORMANCE_FAILED',
      details: error.message
    });
  }
});

// DELETE /api/perf/cleanup - Clean up old data
perfRouter.delete('/cleanup', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    
    const deleted = deleteOldSignals(days);
    
    res.json({
      success: true,
      message: `Deleted ${deleted} old signals`,
      deleted_count: deleted
    });
    
  } catch (error) {
    logger.error('Failed to cleanup old data', { error: error.message });
    res.status(500).json({
      error: 'CLEANUP_FAILED',
      details: error.message
    });
  }
});

// POST /api/perf/reset - Reset performance database (dev only)
perfRouter.post('/reset', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        details: 'Reset not allowed in production'
      });
    }
    
    resetPerfDB();
    
    res.json({
      success: true,
      message: 'Performance database reset successfully'
    });
    
  } catch (error) {
    logger.error('Failed to reset database', { error: error.message });
    res.status(500).json({
      error: 'RESET_FAILED',
      details: error.message
    });
  }
});

// Middleware for error handling
perfRouter.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Performance API error', {
    error: error.message,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    details: 'An internal error occurred'
  });
});
// Performance Database - SQLite connection & schema for signal tracking
// Professional performance tracking for institutional trading

import Database from 'better-sqlite3';
import { logger } from '../screener/logger';

export const db = new Database(process.env.PERF_DB_PATH || './screening-module/perf.sqlite');

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 1000');

// Initialize database schema
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      label TEXT NOT NULL CHECK(label IN ('BUY', 'SELL', 'HOLD')),
      score REAL NOT NULL,
      confidence REAL,
      timeframe TEXT NOT NULL,
      regime TEXT,
      htf_bias TEXT,
      mtf_aligned INTEGER,
      summary TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(ts, symbol, timeframe)
    );

    CREATE TABLE IF NOT EXISTS executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id INTEGER NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('long', 'short')),
      entry REAL NOT NULL,
      sl REAL,
      tp1 REAL,
      tp2 REAL,
      qty REAL,
      notional REAL,
      fees REAL,
      slip REAL,
      spread REAL,
      risk_amount REAL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(signal_id) REFERENCES signals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_id INTEGER NOT NULL,
      exit_ts INTEGER,
      exit_price REAL,
      pnl REAL,
      pnl_pct REAL,
      rr REAL,
      reason TEXT,
      duration_mins INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY(signal_id) REFERENCES signals(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS performance_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      total_signals INTEGER,
      total_trades INTEGER,
      win_rate REAL,
      avg_pnl REAL,
      total_pnl REAL,
      sharpe_ratio REAL,
      max_drawdown REAL,
      equity REAL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(ts);
    CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
    CREATE INDEX IF NOT EXISTS idx_executions_signal_id ON executions(signal_id);
    CREATE INDEX IF NOT EXISTS idx_outcomes_signal_id ON outcomes(signal_id);
    CREATE INDEX IF NOT EXISTS idx_outcomes_exit_ts ON outcomes(exit_ts);
  `);

  logger.info('Performance database initialized successfully');
} catch (error) {
  logger.error('Failed to initialize performance database', error);
  throw error;
}

export function resetPerfDB(): void {
  try {
    db.exec(`
      DELETE FROM performance_snapshots;
      DELETE FROM outcomes;
      DELETE FROM executions;
      DELETE FROM signals;
      VACUUM;
    `);
    logger.info('Performance database reset successfully');
  } catch (error) {
    logger.error('Failed to reset performance database', error);
    throw error;
  }
}

export function getDBStats(): {
  signals: number;
  executions: number;
  outcomes: number;
  snapshots: number;
} {
  try {
    const signals = db.prepare('SELECT COUNT(*) as count FROM signals').get() as { count: number };
    const executions = db.prepare('SELECT COUNT(*) as count FROM executions').get() as { count: number };
    const outcomes = db.prepare('SELECT COUNT(*) as count FROM outcomes').get() as { count: number };
    const snapshots = db.prepare('SELECT COUNT(*) as count FROM performance_snapshots').get() as { count: number };

    return {
      signals: signals.count,
      executions: executions.count,
      outcomes: outcomes.count,
      snapshots: snapshots.count
    };
  } catch (error) {
    logger.error('Failed to get database stats', error);
    return { signals: 0, executions: 0, outcomes: 0, snapshots: 0 };
  }
}

// Database health check
export function checkDBHealth(): boolean {
  try {
    db.prepare('SELECT 1').get();
    return true;
  } catch (error) {
    logger.error('Database health check failed', error);
    return false;
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Closing performance database connection');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Closing performance database connection');
  db.close();
  process.exit(0);
});
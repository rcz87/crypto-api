// Signal Tracker - Record and retrieve signals, executions, and outcomes
// Professional signal tracking for performance analysis

import { db } from './db';
import { logger } from '../screener/logger';

export type TrackedSignal = {
  ts: number;
  symbol: string;
  label: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  confidence?: number;
  timeframe: string;
  regime?: string;
  htf_bias?: string;
  mtf_aligned?: boolean;
  summary?: string;
};

export type TrackedExecution = {
  side: 'long' | 'short';
  entry: number;
  sl?: number | null;
  tp1?: number | null;
  tp2?: number | null;
  qty?: number | null;
  notional?: number | null;
  fees?: number | null;
  slip?: number | null;
  spread?: number | null;
  risk_amount?: number | null;
};

export type TrackedOutcome = {
  exit_ts: number;
  exit_price: number;
  pnl: number;
  pnl_pct?: number;
  rr: number;
  reason?: string;
  duration_mins?: number;
};

export function recordSignal(sig: TrackedSignal): number | null {
  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO signals 
      (ts, symbol, label, score, confidence, timeframe, regime, htf_bias, mtf_aligned, summary) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      sig.ts,
      sig.symbol,
      sig.label,
      sig.score,
      sig.confidence || null,
      sig.timeframe,
      sig.regime || null,
      sig.htf_bias || null,
      sig.mtf_aligned ? 1 : 0,
      sig.summary || null
    );

    const row = db.prepare(`
      SELECT id FROM signals 
      WHERE ts = ? AND symbol = ? AND timeframe = ?
    `).get(sig.ts, sig.symbol, sig.timeframe) as { id: number } | undefined;

    if (row) {
      logger.debug('Signal recorded', { signalId: row.id, symbol: sig.symbol, label: sig.label });
      return row.id;
    }

    return null;
  } catch (error) {
    logger.error('Failed to record signal', { error, signal: sig });
    return null;
  }
}

export function recordExecution(signalId: number, exec: TrackedExecution): boolean {
  try {
    const stmt = db.prepare(`
      INSERT INTO executions 
      (signal_id, side, entry, sl, tp1, tp2, qty, notional, fees, slip, spread, risk_amount) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      signalId,
      exec.side,
      exec.entry,
      exec.sl || null,
      exec.tp1 || null,
      exec.tp2 || null,
      exec.qty || null,
      exec.notional || null,
      exec.fees || null,
      exec.slip || null,
      exec.spread || null,
      exec.risk_amount || null
    );

    logger.debug('Execution recorded', { signalId, side: exec.side, entry: exec.entry });
    return true;
  } catch (error) {
    logger.error('Failed to record execution', { error, signalId, execution: exec });
    return false;
  }
}

export function recordOutcome(signalId: number, out: TrackedOutcome): boolean {
  try {
    const stmt = db.prepare(`
      INSERT INTO outcomes 
      (signal_id, exit_ts, exit_price, pnl, pnl_pct, rr, reason, duration_mins) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      signalId,
      out.exit_ts,
      out.exit_price,
      out.pnl,
      out.pnl_pct || null,
      out.rr,
      out.reason || null,
      out.duration_mins || null
    );

    logger.debug('Outcome recorded', { signalId, pnl: out.pnl, reason: out.reason });
    return true;
  } catch (error) {
    logger.error('Failed to record outcome', { error, signalId, outcome: out });
    return false;
  }
}

export function fetchSignals(limit: number = 1000, offset: number = 0) {
  try {
    return db.prepare(`
      SELECT * FROM signals 
      ORDER BY ts DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  } catch (error) {
    logger.error('Failed to fetch signals', { error, limit, offset });
    return [];
  }
}

export function fetchSignalsBySymbol(symbol: string, limit: number = 100) {
  try {
    return db.prepare(`
      SELECT * FROM signals 
      WHERE symbol = ? 
      ORDER BY ts DESC 
      LIMIT ?
    `).all(symbol, limit);
  } catch (error) {
    logger.error('Failed to fetch signals by symbol', { error, symbol, limit });
    return [];
  }
}

export function fetchJoined(limit: number = 1000, offset: number = 0) {
  try {
    return db.prepare(`
      SELECT 
        s.*,
        e.side, e.entry, e.sl, e.tp1, e.tp2, e.qty, e.notional, e.fees, e.slip, e.spread,
        o.exit_ts, o.exit_price, o.pnl, o.pnl_pct, o.rr, o.reason, o.duration_mins
      FROM signals s
      LEFT JOIN executions e ON e.signal_id = s.id
      LEFT JOIN outcomes o ON o.signal_id = s.id
      ORDER BY s.ts DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  } catch (error) {
    logger.error('Failed to fetch joined data', { error, limit, offset });
    return [];
  }
}

export function fetchCompletedTrades(limit: number = 1000) {
  try {
    return db.prepare(`
      SELECT 
        s.symbol, s.label, s.score, s.confidence, s.timeframe, s.regime, s.ts,
        e.side, e.entry, e.sl, e.tp1, e.tp2, e.qty, e.notional,
        o.exit_ts, o.exit_price, o.pnl, o.pnl_pct, o.rr, o.reason, o.duration_mins
      FROM signals s
      INNER JOIN executions e ON e.signal_id = s.id
      INNER JOIN outcomes o ON o.signal_id = s.id
      WHERE o.pnl IS NOT NULL
      ORDER BY o.exit_ts DESC
      LIMIT ?
    `).all(limit);
  } catch (error) {
    logger.error('Failed to fetch completed trades', { error, limit });
    return [];
  }
}

export function fetchOpenPositions() {
  try {
    return db.prepare(`
      SELECT 
        s.id, s.symbol, s.label, s.score, s.timeframe, s.ts,
        e.side, e.entry, e.sl, e.tp1, e.tp2, e.qty, e.notional
      FROM signals s
      INNER JOIN executions e ON e.signal_id = s.id
      LEFT JOIN outcomes o ON o.signal_id = s.id
      WHERE o.id IS NULL AND s.label != 'HOLD'
      ORDER BY s.ts DESC
    `).all();
  } catch (error) {
    logger.error('Failed to fetch open positions', { error });
    return [];
  }
}

export function getSignalStats(days: number = 30): {
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  holdSignals: number;
  avgScore: number;
  avgConfidence: number;
} {
  try {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN label = 'BUY' THEN 1 ELSE 0 END) as buys,
        SUM(CASE WHEN label = 'SELL' THEN 1 ELSE 0 END) as sells,
        SUM(CASE WHEN label = 'HOLD' THEN 1 ELSE 0 END) as holds,
        AVG(score) as avg_score,
        AVG(confidence) as avg_confidence
      FROM signals 
      WHERE ts >= ?
    `).get(since) as any;

    return {
      totalSignals: stats.total || 0,
      buySignals: stats.buys || 0,
      sellSignals: stats.sells || 0,
      holdSignals: stats.holds || 0,
      avgScore: Math.round((stats.avg_score || 0) * 100) / 100,
      avgConfidence: Math.round((stats.avg_confidence || 0) * 100) / 100
    };
  } catch (error) {
    logger.error('Failed to get signal stats', { error, days });
    return {
      totalSignals: 0,
      buySignals: 0,
      sellSignals: 0,
      holdSignals: 0,
      avgScore: 0,
      avgConfidence: 0
    };
  }
}

export function deleteOldSignals(days: number = 90): number {
  try {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const result = db.prepare(`DELETE FROM signals WHERE ts < ?`).run(cutoff);
    
    logger.info('Deleted old signals', { deleted: result.changes, days });
    return result.changes;
  } catch (error) {
    logger.error('Failed to delete old signals', { error, days });
    return 0;
  }
}
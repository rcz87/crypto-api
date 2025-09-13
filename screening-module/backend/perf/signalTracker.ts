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
  event_signal_id?: string; // For consistent UUID propagation
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
  symbol?: string; // For consistent symbol in events
};

export type TrackedOutcome = {
  exit_ts: number;
  exit_price: number;
  pnl: number;
  pnl_pct?: number;
  rr: number;
  reason?: string;
  duration_mins?: number;
  symbol?: string; // For consistent symbol in events
};

export function recordSignal(sig: TrackedSignal): { signalId: number | null, eventSignalId: string | null } {
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
      
      // Generate UUID exactly once for the entire signal lifecycle
      const { randomUUID } = require('crypto');
      const eventSignalId = sig.event_signal_id || randomUUID();
      
      // Event Logging: Signal Published - Async fire-and-forget
      setImmediate(async () => {
        try {
          const { EventEmitter } = await import('../../server/observability/eventEmitter.js');
          
          // Use the same UUID generated above - no re-generation!
          await EventEmitter.published({
            signal_id: eventSignalId,
            symbol: sig.symbol,
            confluence_score: sig.score / 100, // Convert 0-100 to 0-1
            rr: 2.0, // Default RR for screening signals
            scenarios: {
              primary: {
                side: sig.label === 'BUY' ? 'long' : 'short'
              }
            },
            expiry_minutes: 240, // 4H expiry for screening signals
            rules_version: 'screening-1.0'
          });
        } catch (error) {
          logger.error('Event logging failed for published signal', { error, signalId: row.id });
        }
      });
      
      return { signalId: row.id, eventSignalId };
    }

    return { signalId: null, eventSignalId: null };
  } catch (error) {
    logger.error('Failed to record signal', { error, signal: sig });
    return null;
  }
}

export function recordExecution(signalId: number, exec: TrackedExecution, eventSignalId?: string): boolean {
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
    
    // Event Logging: Signal Triggered (Entry Filled) - Async fire-and-forget
    if (eventSignalId) {
      setImmediate(async () => {
        try {
          const { EventEmitter } = await import('../../server/observability/eventEmitter.js');
          
          await EventEmitter.triggered({
            signal_id: eventSignalId,
            symbol: exec.symbol || 'SOL-USDT-SWAP', // Use provided symbol or fallback
            entry_fill: exec.entry,
            time_to_trigger_ms: 0 // TODO: Calculate actual trigger time
          });
        } catch (error) {
          logger.error('Event logging failed for triggered signal', { error, signalId });
        }
      });
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to record execution', { error, signalId, execution: exec });
    return false;
  }
}

export function recordOutcome(signalId: number, out: TrackedOutcome, eventSignalId?: string): boolean {
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
    
    // Event Logging: Signal Closed (Position Closed) - Async fire-and-forget
    if (eventSignalId) {
      setImmediate(async () => {
        try {
          const { EventEmitter } = await import('../../server/observability/eventEmitter.js');
          
          // Map screening module reasons to standard exit reasons
          const exitReason = out.reason === 'tp' ? 'tp' : 
                            out.reason === 'sl' ? 'sl' : 
                            out.reason === 'manual' ? 'manual' : 
                            out.reason === 'time' ? 'time' : 'other';
          
          // Use invalidated for SL hits, closed for profitable exits
          if (exitReason === 'sl') {
            await EventEmitter.invalidated({
              signal_id: eventSignalId,
              symbol: out.symbol || 'SOL-USDT-SWAP',
              reason: 'sl' as 'sl' | 'hard_invalidate' | 'expiry'
            });
          } else {
            await EventEmitter.closed({
              signal_id: eventSignalId,
              symbol: out.symbol || 'SOL-USDT-SWAP', // Use provided symbol or fallback
              rr_realized: out.rr,
              time_in_trade_ms: (out.duration_mins || 0) * 60 * 1000,
              exit_reason: exitReason as 'tp' | 'manual' | 'sl' | 'time' | 'other'
            });
          }
        } catch (error) {
          logger.error('Event logging failed for closed signal', { error, signalId });
        }
      });
    }
    
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
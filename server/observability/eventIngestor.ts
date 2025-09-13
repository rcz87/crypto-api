/**
 * Event Logging System - Database Ingestor
 * 
 * Handles PostgreSQL data insertion with safety guards and proper error handling.
 * Uses Drizzle ORM for type-safe database operations.
 * 
 * SAFETY: All database operations use lazy initialization to prevent crashes
 * when FEATURE_EVENT_LOGGING=false or DATABASE_URL is not available.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { EventPublished, EventTriggered, EventInvalidated, EventClosed } from '@shared/schema.js';

// Lazy database connection - only initialized when needed
let dbConnection: any = null;
let dbInstance: any = null;

/**
 * Initialize database connection only when needed
 * Returns null if DATABASE_URL is not available or connection fails
 */
async function getDbConnection(): Promise<{ sql: any; db: any } | null> {
  if (dbConnection && dbInstance) {
    return { sql: dbConnection, db: dbInstance };
  }

  try {
    // Dynamic imports to prevent module-load failures
    const [{ drizzle }, { default: postgres }, { signals, signalTriggers, signalInvalidations, signalClosures }] = await Promise.all([
      import('drizzle-orm/postgres-js'),
      import('postgres'),
      import('@shared/schema.js')
    ]);

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('EventIngestor: DATABASE_URL not available - database operations disabled');
      return null;
    }

    dbConnection = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    dbInstance = drizzle(dbConnection);

    return { sql: dbConnection, db: dbInstance };
  } catch (error) {
    console.error('EventIngestor: Failed to initialize database connection:', error);
    return null;
  }
}

/**
 * Run database migration
 */
export async function migrate(): Promise<void> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      throw new Error('Database connection not available for migration');
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const migrationPath = path.join(__dirname, 'db.sql');
    
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    await connection.sql.unsafe(migrationSQL);
    
    console.log('✅ Event Logging System: Database migration completed successfully');
  } catch (error) {
    console.error('❌ Event Logging System: Migration failed:', error);
    throw error;
  }
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      return false;
    }
    await connection.sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Insert published signal event
 */
export async function insertPublished(evt: EventPublished): Promise<void> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      console.warn('insertPublished: Database connection not available, skipping event');
      return;
    }

    const { signals } = await import('@shared/schema.js');
    const side = evt.scenarios?.primary?.side || 'long';
    
    await connection.db.insert(signals).values({
      signal_id: evt.signal_id,
      symbol: evt.symbol,
      side,
      confluence_score: evt.confluence_score.toString(),
      rr_target: evt.rr.toString(),
      expiry_minutes: evt.expiry_minutes,
      rules_version: evt.rules_version,
      ts_published: evt.ts_published ? new Date(evt.ts_published) : new Date(),
    }).onConflictDoNothing(); // Idempotent - handle duplicate signal_id gracefully
    
  } catch (error) {
    console.error('insertPublished failed:', error);
    throw error;
  }
}

/**
 * Insert triggered signal event
 */
export async function insertTriggered(evt: EventTriggered): Promise<void> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      console.warn('insertTriggered: Database connection not available, skipping event');
      return;
    }

    const { signalTriggers } = await import('@shared/schema.js');
    
    await connection.db.insert(signalTriggers).values({
      signal_id: evt.signal_id,
      ts_triggered: evt.ts_triggered ? new Date(evt.ts_triggered) : new Date(),
      entry_fill: evt.entry_fill.toString(),
      time_to_trigger_ms: evt.time_to_trigger_ms,
    });
    
  } catch (error) {
    console.error('insertTriggered failed:', error);
    throw error;
  }
}

/**
 * Insert invalidated signal event
 */
export async function insertInvalidated(evt: EventInvalidated): Promise<void> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      console.warn('insertInvalidated: Database connection not available, skipping event');
      return;
    }

    const { signalInvalidations } = await import('@shared/schema.js');
    
    await connection.db.insert(signalInvalidations).values({
      signal_id: evt.signal_id,
      ts_invalidated: evt.ts_invalidated ? new Date(evt.ts_invalidated) : new Date(),
      reason: evt.reason,
    });
    
  } catch (error) {
    console.error('insertInvalidated failed:', error);
    throw error;
  }
}

/**
 * Insert closed signal event
 */
export async function insertClosed(evt: EventClosed): Promise<void> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      console.warn('insertClosed: Database connection not available, skipping event');
      return;
    }

    const { signalClosures } = await import('@shared/schema.js');
    
    await connection.db.insert(signalClosures).values({
      signal_id: evt.signal_id,
      ts_closed: evt.ts_closed ? new Date(evt.ts_closed) : new Date(),
      rr_realized: evt.rr_realized.toString(),
      time_in_trade_ms: evt.time_in_trade_ms,
      exit_reason: evt.exit_reason,
    });
    
  } catch (error) {
    console.error('insertClosed failed:', error);
    throw error;
  }
}

/**
 * Get current week start date in Asia/Jakarta timezone
 */
export async function getCurrentWeekStart(): Promise<string> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      throw new Error('Database connection not available for getCurrentWeekStart');
    }

    const result = await connection.sql`
      SELECT (date_trunc('week', (now() at time zone 'Asia/Jakarta'))::date) AS week_start
    `;
    return result[0].week_start;
  } catch (error) {
    console.error('getCurrentWeekStart failed:', error);
    throw error;
  }
}

/**
 * Get winrate data for weekly scorecard by confluence bins
 */
export async function getWeeklyWinrateByBins(weekStart: string): Promise<Record<string, { n: number; winrate: number }>> {
  const connection = await getDbConnection();
  if (!connection) {
    throw new Error('Database connection not available for getWeeklyWinrateByBins');
  }

  const bins = [
    { label: '0.50-0.59', condition: 'confluence_score >= 0.50 AND confluence_score < 0.60' },
    { label: '0.60-0.69', condition: 'confluence_score >= 0.60 AND confluence_score < 0.70' },
    { label: '0.70-0.79', condition: 'confluence_score >= 0.70 AND confluence_score < 0.80' },
    { label: '0.80+', condition: 'confluence_score >= 0.80' },
  ];

  const results: Record<string, { n: number; winrate: number }> = {};
  
  for (const bin of bins) {
    try {
      const query = `
        WITH weekly AS (
          SELECT s.signal_id, s.confluence_score, c.rr_realized
          FROM signals s JOIN signal_closures c USING (signal_id)
          WHERE s.ts_published >= $1::date
            AND s.ts_published < ($1::date + interval '7 day')
            AND ${bin.condition}
        )
        SELECT count(*)::int AS n,
               COALESCE(avg((rr_realized > 0)::int)::numeric(5,3), 0) AS winrate
        FROM weekly;
      `;
      
      const result = await connection.sql.unsafe(query, [weekStart]);
      const row = result[0];
      
      results[bin.label] = { 
        n: row.n || 0, 
        winrate: parseFloat(row.winrate) || 0 
      };
      
    } catch (error) {
      console.error(`Failed to get winrate for bin ${bin.label}:`, error);
      results[bin.label] = { n: 0, winrate: 0 };
    }
  }
  
  return results;
}

/**
 * Insert or update weekly scorecard
 */
export async function upsertWeeklyScorecard(weekStart: string, bins: Record<string, any>, monotonicOk: boolean): Promise<void> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      throw new Error('Database connection not available for upsertWeeklyScorecard');
    }

    await connection.sql`
      INSERT INTO weekly_scorecard(week_start, bins, monotonic_ok)
      VALUES (${weekStart}, ${JSON.stringify(bins)}, ${monotonicOk})
      ON CONFLICT (week_start) 
      DO UPDATE SET bins = ${JSON.stringify(bins)}, monotonic_ok = ${monotonicOk}, created_at = now()
    `;
    
  } catch (error) {
    console.error('upsertWeeklyScorecard failed:', error);
    throw error;
  }
}

/**
 * Clean up old data (optional - for data retention policies)
 */
export async function cleanupOldData(retentionDays: number = 90): Promise<void> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      throw new Error('Database connection not available for cleanupOldData');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    await connection.sql`DELETE FROM signals WHERE ts_published < ${cutoffDate}`;
    
    console.log(`✅ Cleaned up signals older than ${retentionDays} days`);
  } catch (error) {
    console.error('cleanupOldData failed:', error);
    throw error;
  }
}

/**
 * Get database statistics for monitoring
 */
export async function getDatabaseStats(): Promise<{
  total_signals: number;
  triggered_signals: number;
  closed_signals: number;
  invalidated_signals: number;
  current_week_signals: number;
}> {
  try {
    const connection = await getDbConnection();
    if (!connection) {
      // Return zeros when database is not available
      console.warn('getDatabaseStats: Database connection not available, returning zero stats');
      return {
        total_signals: 0,
        triggered_signals: 0,
        closed_signals: 0,
        invalidated_signals: 0,
        current_week_signals: 0,
      };
    }

    const stats = await connection.sql`
      SELECT 
        (SELECT count(*) FROM signals) as total_signals,
        (SELECT count(*) FROM signal_triggers) as triggered_signals,
        (SELECT count(*) FROM signal_closures) as closed_signals,
        (SELECT count(*) FROM signal_invalidations) as invalidated_signals,
        (SELECT count(*) FROM signals 
         WHERE ts_published >= date_trunc('week', now() at time zone 'Asia/Jakarta')) as current_week_signals
    `;
    
    return {
      total_signals: parseInt(stats[0].total_signals),
      triggered_signals: parseInt(stats[0].triggered_signals),
      closed_signals: parseInt(stats[0].closed_signals),
      invalidated_signals: parseInt(stats[0].invalidated_signals),
      current_week_signals: parseInt(stats[0].current_week_signals),
    };
  } catch (error) {
    console.error('getDatabaseStats failed:', error);
    throw error;
  }
}

/**
 * Advanced database operations - use getDbConnection() for direct access
 * Note: Database connections are now lazy-loaded for safety
 */
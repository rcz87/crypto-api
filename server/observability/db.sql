-- Event Logging System - Signal Lifecycle Tracking Tables
-- PostgreSQL migration for signal event tracking with Asia/Jakarta timezone support

-- Main signals table - tracks published signals
CREATE TABLE IF NOT EXISTS signals (
  signal_id UUID PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT CHECK (side IN ('long','short')) NOT NULL,
  confluence_score NUMERIC(4,2) NOT NULL,
  rr_target NUMERIC(4,2) NOT NULL,
  expiry_minutes INT NOT NULL,
  rules_version TEXT NOT NULL,
  ts_published TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signal triggers - when entry gets filled
CREATE TABLE IF NOT EXISTS signal_triggers (
  signal_id UUID REFERENCES signals(signal_id) ON DELETE CASCADE,
  ts_triggered TIMESTAMPTZ NOT NULL,
  entry_fill NUMERIC(18,8) NOT NULL,
  time_to_trigger_ms INT NOT NULL
);

-- Signal invalidations - when signals become invalid
CREATE TABLE IF NOT EXISTS signal_invalidations (
  signal_id UUID REFERENCES signals(signal_id) ON DELETE CASCADE,
  ts_invalidated TIMESTAMPTZ NOT NULL,
  reason TEXT CHECK (reason IN ('sl','hard_invalidate','expiry')) NOT NULL
);

-- Signal closures - when positions are closed
CREATE TABLE IF NOT EXISTS signal_closures (
  signal_id UUID REFERENCES signals(signal_id) ON DELETE CASCADE,
  ts_closed TIMESTAMPTZ NOT NULL,
  rr_realized NUMERIC(5,2) NOT NULL,
  time_in_trade_ms INT NOT NULL,
  exit_reason TEXT CHECK (exit_reason IN ('tp','manual','sl','time','other')) NOT NULL
);

-- Weekly scorecard summary table
CREATE TABLE IF NOT EXISTS weekly_scorecard (
  week_start DATE PRIMARY KEY,
  bins JSONB NOT NULL,
  monotonic_ok BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(ts_published);
CREATE INDEX IF NOT EXISTS idx_signals_confluence ON signals(confluence_score);
CREATE INDEX IF NOT EXISTS idx_triggers_ts ON signal_triggers(ts_triggered);
CREATE INDEX IF NOT EXISTS idx_closures_ts ON signal_closures(ts_closed);
CREATE INDEX IF NOT EXISTS idx_invalidations_ts ON signal_invalidations(ts_invalidated);

-- Composite indexes for weekly scorecard queries
CREATE INDEX IF NOT EXISTS idx_signals_week_confluence ON signals(
  date_trunc('week', ts_published AT TIME ZONE 'Asia/Jakarta'), 
  confluence_score
);

-- Comment for future reference
COMMENT ON TABLE signals IS 'Event Logging System - Main signal tracking table';
COMMENT ON TABLE signal_triggers IS 'Event Logging System - Signal trigger events';
COMMENT ON TABLE signal_invalidations IS 'Event Logging System - Signal invalidation events';
COMMENT ON TABLE signal_closures IS 'Event Logging System - Signal closure events';
COMMENT ON TABLE weekly_scorecard IS 'Event Logging System - Weekly performance scorecard';
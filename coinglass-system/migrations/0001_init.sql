CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS futures_oi_ohlc (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  interval text NOT NULL,
  aggregated boolean NOT NULL,
  open numeric, high numeric, low numeric, close numeric,
  oi_value numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('futures_oi_ohlc','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS funding_rate (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  exchange text,
  interval text NOT NULL,
  rate numeric,
  rate_oi_weighted numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('funding_rate','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS liquidations (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL,
  price numeric NOT NULL,
  qty numeric NOT NULL,
  exchange text,
  bucket numeric,
  meta jsonb,
  PRIMARY KEY (symbol, ts, price, side)
);
SELECT create_hypertable('liquidations','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS taker_volume (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  exchange text,
  interval text NOT NULL,
  taker_buy numeric,
  taker_sell numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('taker_volume','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS long_short_ratio (
  ts timestamptz NOT NULL,
  scope text NOT NULL,
  ratio numeric,
  PRIMARY KEY (scope, ts)
);
SELECT create_hypertable('long_short_ratio','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS long_short_ratio_symbol (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  interval text NOT NULL,
  ratio numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('long_short_ratio_symbol','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS price_ohlc (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  interval text NOT NULL,
  open numeric, high numeric, low numeric, close numeric, volume numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('price_ohlc','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS liquidation_heatmap (
  ts_min timestamptz NOT NULL,
  symbol text NOT NULL,
  bucket numeric NOT NULL,
  qty_sum numeric NOT NULL,
  events_count int NOT NULL,
  PRIMARY KEY (symbol, ts_min, bucket)
);
SELECT create_hypertable('liquidation_heatmap','ts_min', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS composite_heatmap (
  ts_min timestamptz NOT NULL,
  symbol text NOT NULL,
  bucket numeric NOT NULL,
  score numeric NOT NULL,
  components jsonb,
  PRIMARY KEY (symbol, ts_min, bucket)
);
SELECT create_hypertable('composite_heatmap','ts_min', if_not_exists => TRUE);
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// System metrics table
export const systemMetrics = pgTable("system_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  responseTime: integer("response_time").notNull(),
  requestsToday: integer("requests_today").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// System logs table
export const systemLogs = pgTable("system_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: text("level").notNull(), // 'info', 'warning', 'error'
  message: text("message").notNull(),
  details: text("details"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Enhanced AI Signal tracking tables
export const aiSignals = pgTable("ai_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signal_id: varchar("signal_id").notNull().unique(),
  symbol: varchar("symbol").notNull(),
  direction: text("direction").notNull(), // 'long', 'short', 'neutral'
  strength: integer("strength").notNull(), // 0-100
  confidence: integer("confidence").notNull(), // 0-100
  patterns: jsonb("patterns"), // detected patterns with confidence
  reasoning: jsonb("reasoning"), // AI reasoning and factors
  execution_details: jsonb("execution_details"), // recommended entry, SL, TP
  neural_features: jsonb("neural_features"), // feature vector used
  timestamp: timestamp("timestamp").defaultNow(),
});

export const aiExecutions = pgTable("ai_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signal_id: varchar("signal_id").notNull(),
  entry_price: decimal("entry_price", { precision: 10, scale: 4 }),
  entry_time: timestamp("entry_time").defaultNow(),
  position_size: decimal("position_size", { precision: 10, scale: 4 }),
  stop_loss: decimal("stop_loss", { precision: 10, scale: 4 }),
  take_profit_1: decimal("take_profit_1", { precision: 10, scale: 4 }),
  take_profit_2: decimal("take_profit_2", { precision: 10, scale: 4 }),
  risk_amount: decimal("risk_amount", { precision: 10, scale: 2 }),
  execution_type: text("execution_type").default("manual"), // 'manual', 'auto', 'paper'
  timestamp: timestamp("timestamp").defaultNow(),
});

export const aiOutcomes = pgTable("ai_outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  signal_id: varchar("signal_id").notNull().unique(),
  exit_price: decimal("exit_price", { precision: 10, scale: 4 }),
  exit_time: timestamp("exit_time"),
  pnl: decimal("pnl", { precision: 10, scale: 2 }), // absolute P&L
  pnl_percentage: decimal("pnl_percentage", { precision: 8, scale: 4 }), // percentage return
  risk_reward_ratio: decimal("risk_reward_ratio", { precision: 6, scale: 2 }),
  duration_minutes: integer("duration_minutes"),
  exit_reason: text("exit_reason"), // 'stop_loss', 'take_profit', 'manual', 'time_exit'
  was_successful: integer("was_successful"), // 1 for win, 0 for loss
  confidence_validation: integer("confidence_validation"), // how well confidence matched outcome
  timestamp: timestamp("timestamp").defaultNow(),
});

export const aiPatternPerformance = pgTable("ai_pattern_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pattern_id: varchar("pattern_id").notNull().unique(),
  pattern_name: varchar("pattern_name").notNull(),
  total_signals: integer("total_signals").default(0),
  successful_signals: integer("successful_signals").default(0),
  failed_signals: integer("failed_signals").default(0),
  win_rate: decimal("win_rate", { precision: 5, scale: 4 }).default("0"), // 0.0 to 1.0
  avg_confidence: decimal("avg_confidence", { precision: 5, scale: 2 }).default("0"),
  avg_pnl: decimal("avg_pnl", { precision: 10, scale: 2 }).default("0"),
  total_pnl: decimal("total_pnl", { precision: 10, scale: 2 }).default("0"),
  best_trade: decimal("best_trade", { precision: 10, scale: 2 }).default("0"),
  worst_trade: decimal("worst_trade", { precision: 10, scale: 2 }).default("0"),
  avg_duration_minutes: integer("avg_duration_minutes").default(0),
  last_updated: timestamp("last_updated").defaultNow(),
  adaptation_factor: decimal("adaptation_factor", { precision: 4, scale: 3 }).default("1.0"), // confidence multiplier
  learning_velocity: decimal("learning_velocity", { precision: 4, scale: 3 }).default("0.1"), // how fast it adapts
  timestamp: timestamp("timestamp").defaultNow(),
});

// Event Logging System - Signal Lifecycle Tracking Tables
export const signals = pgTable("signals", {
  signal_id: uuid("signal_id").primaryKey(), // UUID from signal generation
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'long' | 'short'
  confluence_score: decimal("confluence_score", { precision: 4, scale: 2 }).notNull(),
  rr_target: decimal("rr_target", { precision: 4, scale: 2 }).notNull(),
  expiry_minutes: integer("expiry_minutes").notNull(),
  rules_version: text("rules_version").notNull(),
  ts_published: timestamp("ts_published", { withTimezone: true }).defaultNow(),
});

export const signalTriggers = pgTable("signal_triggers", {
  signal_id: uuid("signal_id").notNull().references(() => signals.signal_id, { onDelete: "cascade" }),
  ts_triggered: timestamp("ts_triggered", { withTimezone: true }).notNull(),
  entry_fill: decimal("entry_fill", { precision: 18, scale: 8 }).notNull(),
  time_to_trigger_ms: integer("time_to_trigger_ms").notNull(),
});

export const signalInvalidations = pgTable("signal_invalidations", {
  signal_id: uuid("signal_id").notNull().references(() => signals.signal_id, { onDelete: "cascade" }),
  ts_invalidated: timestamp("ts_invalidated", { withTimezone: true }).notNull(),
  reason: text("reason").notNull(), // 'sl' | 'hard_invalidate' | 'expiry'
});

export const signalClosures = pgTable("signal_closures", {
  signal_id: uuid("signal_id").notNull().references(() => signals.signal_id, { onDelete: "cascade" }),
  ts_closed: timestamp("ts_closed", { withTimezone: true }).notNull(),
  rr_realized: decimal("rr_realized", { precision: 5, scale: 2 }).notNull(),
  time_in_trade_ms: integer("time_in_trade_ms").notNull(),
  exit_reason: text("exit_reason").notNull(), // 'tp' | 'manual' | 'sl' | 'time' | 'other'
});

export const weeklyScorecard = pgTable("weekly_scorecard", {
  week_start: text("week_start").primaryKey(), // DATE as string (YYYY-MM-DD)
  bins: jsonb("bins").notNull(), // winrate data per confluence bin
  monotonic_ok: integer("monotonic_ok").notNull(), // 1 for true, 0 for false
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// OKX ticker data schema
export const tickerSchema = z.object({
  symbol: z.string(),
  price: z.string(),
  change24h: z.string(),
  high24h: z.string(),
  low24h: z.string(),
  volume: z.string(),
  tradingVolume24h: z.string(), // Trading volume, not market cap
});

// OKX candle data schema
export const candleSchema = z.object({
  timestamp: z.string(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string(),
});

// Order book entry schema
export const orderBookEntrySchema = z.object({
  price: z.string(),
  size: z.string(),
});

// Order book schema
export const orderBookSchema = z.object({
  asks: z.array(orderBookEntrySchema),
  bids: z.array(orderBookEntrySchema),
  spread: z.string(),
});

// Recent trade schema
export const recentTradeSchema = z.object({
  price: z.string(),
  size: z.string(),
  side: z.enum(['buy', 'sell']),
  timestamp: z.string(),
});

// Funding rate schema
export const fundingRateSchema = z.object({
  instId: z.string(),
  fundingRate: z.string(),
  nextFundingRate: z.string().optional(),
  nextFundingTime: z.string(),
  fundingTime: z.string(),
  premium: z.string(),
  interestRate: z.string(),
  maxFundingRate: z.string(),
  minFundingRate: z.string(),
  settFundingRate: z.string(),
  settState: z.enum(['settled', 'processing']),
  timestamp: z.string(),
});

// Open interest schema
export const openInterestSchema = z.object({
  instId: z.string(),
  instType: z.enum(['SPOT', 'MARGIN', 'SWAP', 'FUTURES', 'OPTION']),
  oi: z.string(), // Open Interest in base currency
  oiCcy: z.string(), // Open Interest in currency
  oiUsd: z.string(), // Open Interest in USD
  timestamp: z.string(),
});

// Enhanced Open Interest schema - Institutional grade analytics
export const enhancedOpenInterestSchema = z.object({
  current: z.object({
    instId: z.string(),
    instType: z.string(),
    openInterest: z.number(),
    openInterestUsd: z.number(),
    price: z.number(),
    timestamp: z.string(),
  }),
  historical_context: z.object({
    oi_24h_avg: z.number(),
    oi_7d_avg: z.number(),
    oi_change_24h: z.number(),
    oi_change_7d: z.number(),
    oi_volatility_24h: z.number(),
    price_oi_correlation: z.number(),
  }),
  advanced_metrics: z.object({
    market_efficiency: z.number(),
    oi_pressure_ratio: z.number(),
    long_short_ratio: z.number(),
    oi_turnover_rate: z.number(),
    institutional_dominance_score: z.number(),
    liquidity_depth_score: z.number(),
  }),
  liquidation_analysis: z.object({
    cluster_risk_score: z.number(),
    critical_levels: z.array(z.object({
      priceLevel: z.number(),
      liquidationVolume: z.number(),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
      positionType: z.enum(['long', 'short', 'mixed']),
    })),
    cascade_probability: z.number(),
    estimated_liquidation_volume: z.number(),
    time_to_cascade_estimate: z.string(),
  }),
  market_structure: z.object({
    oi_distribution: z.enum(['concentrated', 'balanced', 'distributed']),
    market_phase: z.enum(['accumulation', 'distribution', 'trending', 'consolidation']),
    institutional_presence: z.enum(['dominant', 'significant', 'moderate', 'light']),
    risk_level: z.enum(['extreme', 'high', 'moderate', 'low']),
  }),
});

// Historical Open Interest data schema
export const historicalOpenInterestDataSchema = z.object({
  data_points: z.array(z.object({
    timestamp: z.string(),
    openInterest: z.number(),
    openInterestUsd: z.number(),
    price: z.number(),
    volume24h: z.number(),
    longShortRatio: z.number().optional(),
  })),
  trends: z.object({
    oi_trend: z.array(z.number()),
    oi_usd_trend: z.array(z.number()),
    price_correlation: z.array(z.number()),
  }),
  statistics: z.object({
    average_oi: z.number(),
    max_oi: z.number(),
    min_oi: z.number(),
    oi_volatility: z.number(),
    correlation_with_price: z.number(),
  }),
});

// Volume History schema for Enhanced Volume Profile
export const volumeHistorySchema = z.object({
  volume24hAgo: z.number(),
  volumeChange24h: z.number(),
  volumeChangePercentage: z.number(),
});

// Enhanced order book schema with deeper levels
export const enhancedOrderBookSchema = z.object({
  asks: z.array(orderBookEntrySchema),
  bids: z.array(orderBookEntrySchema),
  spread: z.string(),
  askWalls: z.array(z.object({
    price: z.string(),
    size: z.string(),
    isLarge: z.boolean(),
  })),
  bidWalls: z.array(z.object({
    price: z.string(),
    size: z.string(),
    isLarge: z.boolean(),
  })),
  imbalance: z.string(), // percentage
  lastUpdate: z.string(),
});

// Volume profile schema
export const volumeProfileSchema = z.object({
  poc: z.string(), // Point of Control - highest volume price
  hvnLevels: z.array(z.object({
    price: z.string(),
    volume: z.string(),
    percentage: z.string(),
  })), // High Volume Nodes
  lvnLevels: z.array(z.object({
    price: z.string(),
    volume: z.string(),
    percentage: z.string(),
  })), // Low Volume Nodes
  totalVolume: z.string(),
  valueArea: z.object({
    high: z.string(),
    low: z.string(),
    percentage: z.string(), // typically 70%
  }),
  profileRange: z.object({
    high: z.string(),
    low: z.string(),
    timeframe: z.string(),
  }),
  lastUpdate: z.string(),
});

// Complete SOL data aggregation schema with comprehensive timeframes
export const solCompleteDataSchema = z.object({
  ticker: tickerSchema,
  candles: z.object({
    '5m': z.array(candleSchema),   // 5-minute candles for scalping
    '15m': z.array(candleSchema),  // 15-minute candles for short-term
    '30m': z.array(candleSchema),  // 30-minute candles for intraday
    '1H': z.array(candleSchema),   // 1-hour candles for day trading
    '4H': z.array(candleSchema),   // 4-hour candles for swing trading
    '1D': z.array(candleSchema),   // 1-day candles for position trading
    '1W': z.array(candleSchema),   // 1-week candles for long-term analysis
  }),
  orderBook: orderBookSchema,
  recentTrades: z.array(recentTradeSchema),
  fundingRate: z.any().optional(), // Allow flexible funding rate schema
  openInterest: z.any().optional(), // Allow flexible open interest schema
  cvdAnalysis: z.any().optional(), // Allow flexible CVD analysis schema
  confluenceAnalysis: z.any().optional(), // Allow flexible confluence analysis schema
  lastUpdate: z.string(),
});

// Health check response schema
export const healthCheckSchema = z.object({
  status: z.enum(['operational', 'degraded', 'down']),
  timestamp: z.string(),
  services: z.object({
    okx: z.enum(['connected', 'disconnected', 'error']),
    api: z.enum(['operational', 'degraded', 'down']),
  }),
  metrics: z.object({
    responseTime: z.number(),
    requestsToday: z.number(),
    uptime: z.string(),
  }),
});

// API response wrapper schema
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

export const insertSystemMetricsSchema = createInsertSchema(systemMetrics).omit({
  id: true,
  timestamp: true,
});

export const insertSystemLogsSchema = createInsertSchema(systemLogs).omit({
  id: true,
  timestamp: true,
});

// ========================
// EVENT LOGGING SCHEMAS
// ========================

// Event Logging Zod schemas for lifecycle tracking
export const eventPublishedSchema = z.object({
  signal_id: z.string().uuid(),
  symbol: z.string(),
  confluence_score: z.number(),
  rr: z.number(),
  scenarios: z.object({
    primary: z.object({
      side: z.enum(['long', 'short'])
    })
  }).optional(),
  expiry_minutes: z.number().int(),
  rules_version: z.string(),
  ts_published: z.string().optional()
});

export const eventTriggeredSchema = z.object({
  signal_id: z.string().uuid(),
  symbol: z.string(),
  entry_fill: z.number(),
  time_to_trigger_ms: z.number().int(),
  ts_triggered: z.string().optional()
});

export const eventInvalidatedSchema = z.object({
  signal_id: z.string().uuid(),
  symbol: z.string(),
  reason: z.enum(['sl', 'hard_invalidate', 'expiry']),
  ts_invalidated: z.string().optional()
});

export const eventClosedSchema = z.object({
  signal_id: z.string().uuid(),
  symbol: z.string(),
  rr_realized: z.number(),
  time_in_trade_ms: z.number().int(),
  exit_reason: z.enum(['tp', 'manual', 'sl', 'time', 'other']),
  ts_closed: z.string().optional()
});

// Event Logging Type exports
export type EventPublished = z.infer<typeof eventPublishedSchema>;
export type EventTriggered = z.infer<typeof eventTriggeredSchema>;
export type EventInvalidated = z.infer<typeof eventInvalidatedSchema>;
export type EventClosed = z.infer<typeof eventClosedSchema>;


// SMC (Smart Money Concept) Analysis Schema
export const fvgSchema = z.object({
  id: z.string(),
  timeframe: z.string(),
  type: z.enum(['bullish', 'bearish']),
  high: z.string(),
  low: z.string(),
  timestamp: z.string(),
  mitigated: z.boolean(),
  significance: z.enum(['low', 'medium', 'high']),
});

export const orderBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['demand', 'supply']),
  price: z.string(),
  high: z.string(),
  low: z.string(),
  volume: z.string(),
  timestamp: z.string(),
  strength: z.enum(['weak', 'medium', 'strong']),
  tested: z.boolean(),
});

export const structurePointSchema = z.object({
  type: z.enum(['high', 'low']),
  price: z.string(),
  timestamp: z.string(),
  significance: z.enum(['minor', 'major', 'key']),
});

// Enhanced SMC Analysis Schema with professional trading features
export const nearestZoneSchema = z.object({
  type: z.enum(['OB', 'FVG']),
  side: z.enum(['above', 'below']),
  price: z.string(),
  distancePct: z.number(),
  significance: z.enum(['low', 'medium', 'high']),
});

export const riskAlertSchema = z.object({
  type: z.enum(['manipulation_warning', 'liquidation_cascade', 'institutional_distribution']),
  severity: z.enum(['low', 'medium', 'high', 'extreme']),
  message: z.string(),
  source: z.string(),
  recommendation: z.string(),
});

export const crossDashboardRiskSchema = z.object({
  alerts: z.array(riskAlertSchema),
  overallRiskLevel: z.enum(['low', 'medium', 'high', 'extreme']),
  lastUpdate: z.string(),
  affectedScenarios: z.boolean(),
});

export const tradingScenarioSchema = z.object({
  side: z.enum(['bullish', 'bearish']),
  trigger: z.string(),
  invalidation: z.string(),
  target: z.string(),
  note: z.string().optional(),
  probability: z.number(), // 0-100
});

export const smcAnalysisSchema = z.object({
  timeframe: z.string(),
  trend: z.enum(['bullish', 'bearish', 'ranging']),
  lastBOS: z.object({
    type: z.enum(['bullish', 'bearish']),
    price: z.string(),
    timestamp: z.string(),
  }).nullable(),
  lastCHoCH: z.object({
    from: z.enum(['bullish', 'bearish']),
    to: z.enum(['bullish', 'bearish']),
    price: z.string(),
    timestamp: z.string(),
  }).nullable(),
  fvgs: z.array(fvgSchema),
  orderBlocks: z.array(orderBlockSchema),
  eqh: z.array(structurePointSchema),
  eql: z.array(structurePointSchema),
  liquiditySweeps: z.array(z.object({
    type: z.enum(['buy_side', 'sell_side']),
    level: z.string(),
    timestamp: z.string(),
    confirmed: z.boolean(),
  })),
  marketStructure: z.enum(['bullish', 'bearish', 'ranging', 'transitioning']),
  confidence: z.number().min(0).max(100),
  // NEW: Enhanced Professional Trading Features
  confluenceScore: z.number().min(0).max(100),
  multiTimeframe: z.record(z.enum(['bullish', 'bearish', 'ranging'])),
  nearestZones: z.array(nearestZoneSchema),
  regime: z.enum(['trending', 'ranging']),
  session: z.enum(['Asia', 'London', 'NY']),
  scenarios: z.array(tradingScenarioSchema),
  riskAlerts: crossDashboardRiskSchema.optional(), // Enhanced: Cross-dashboard risk integration
  derivatives: z.object({
    openInterest: z.object({
      value: z.string(),
      change24h: z.string(),
      trend: z.enum(['increasing', 'decreasing', 'stable']),
    }),
    fundingRate: z.object({
      current: z.string(),
      next: z.string(),
      sentiment: z.enum(['bullish', 'bearish', 'neutral']),
      extremeLevel: z.boolean(),
    }),
    flowAnalysis: z.object({
      signal: z.enum(['absorption', 'distribution', 'neutral']),
      strength: z.enum(['weak', 'medium', 'strong']),
      description: z.string(),
    }),
  }),
  atr: z.object({
    value: z.string(),
    percentile: z.number(),
    volatilityRegime: z.enum(['low', 'normal', 'high']),
  }),
  lastUpdate: z.string(),
  dataAge: z.number(), // in seconds
});

export const smcResponseSchema = z.object({
  success: z.boolean(),
  data: smcAnalysisSchema,
  timestamp: z.string(),
});

export const volumeProfileResponseSchema = z.object({
  success: z.boolean(),
  data: volumeProfileSchema,
  timestamp: z.string(),
});

export type SystemMetrics = typeof systemMetrics.$inferSelect;
export type InsertSystemMetrics = z.infer<typeof insertSystemMetricsSchema>;
export type SystemLogs = typeof systemLogs.$inferSelect;
export type InsertSystemLogs = z.infer<typeof insertSystemLogsSchema>;

export type TickerData = z.infer<typeof tickerSchema>;
export type CandleData = z.infer<typeof candleSchema>;
export type OrderBookData = z.infer<typeof orderBookSchema>;
export type RecentTradeData = z.infer<typeof recentTradeSchema>;
export type SolCompleteData = z.infer<typeof solCompleteDataSchema>;
export type HealthCheckData = z.infer<typeof healthCheckSchema>;
export type FundingRateData = z.infer<typeof fundingRateSchema>;

// Enhanced Funding Rate Schemas
export const signalConflictSchema = z.object({
  detected: z.boolean(),
  type: z.enum(['funding_premium_divergence', 'extreme_rate_low_premium', 'normal_rate_high_premium']),
  explanation: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  recommendation: z.string()
});

export const liquidationAlertSchema = z.object({
  active: z.boolean(),
  cluster_prices: z.array(z.number()),
  open_interest_at_cluster: z.array(z.number()),
  probability: z.number(),
  explanation: z.string(),
  estimated_liquidation_volume: z.number(),
  time_to_cascade: z.string()
});

export const marketStructureAnalysisSchema = z.object({
  current_structure: z.enum(['steep_contango', 'contango', 'neutral', 'backwardation', 'steep_backwardation']),
  regime_classification: z.enum(['compressed', 'normal', 'elevated', 'extreme']),
  historical_percentile: z.number(),
  basis_trading_score: z.number(),
  funding_squeeze_detected: z.boolean(),
  liquidation_pressure: z.enum(['low', 'moderate', 'elevated', 'critical'])
});

export const enhancedFundingRateSchema = z.object({
  current: z.object({
    instId: z.string(),
    fundingRate: z.number(),
    premium: z.number(),
    nextFundingTime: z.string(),
    fundingTime: z.string(),
    interestRate: z.number(),
    settState: z.enum(['settled', 'processing']),
    timestamp: z.string()
  }),
  historical_context: z.object({
    funding_rate_24h_avg: z.number(),
    funding_rate_7d_avg: z.number(),
    funding_rate_max_24h: z.number(),
    funding_rate_min_24h: z.number(),
    premium_24h_avg: z.number(),
    volatility_24h: z.number(),
    historical_percentile: z.number()
  }),
  signal_analysis: z.object({
    overall_sentiment: z.enum(['strong_bullish', 'bullish', 'neutral', 'bearish', 'strong_bearish']),
    confidence_score: z.number(),
    conflicts_detected: z.array(signalConflictSchema),
    weighted_score: z.number(),
    primary_signal: z.string(),
    supporting_signals: z.array(z.string()),
    contradicting_signals: z.array(z.string())
  }),
  market_structure: marketStructureAnalysisSchema,
  alerts: z.object({
    liquidation_cascade_warning: liquidationAlertSchema,
    manipulation_alert: z.object({
      active: z.boolean(),
      absorption_levels: z.array(z.number()),
      institutional_flow_pattern: z.string(),
      unusual_activity_score: z.number(),
      explanation: z.string()
    }),
    funding_squeeze_alert: z.object({
      active: z.boolean(),
      squeeze_type: z.enum(['long', 'short', 'both']),
      intensity: z.number(),
      duration_estimate: z.string(),
      historical_outcomes: z.string()
    })
  }),
  correlation_metrics: z.object({
    funding_oi_correlation: z.number(),
    funding_volume_correlation: z.number(),
    premium_price_correlation: z.number(),
    predictive_strength: z.number()
  }),
  trading_implications: z.object({
    immediate_bias: z.enum(['long', 'short', 'neutral']),
    strategy_suggestions: z.array(z.string()),
    risk_factors: z.array(z.string()),
    optimal_entry_timing: z.string(),
    position_sizing_advice: z.string()
  })
});

export const historicalFundingDataSchema = z.object({
  data_points: z.array(z.object({
    timestamp: z.string(),
    fundingRate: z.number(),
    premium: z.number(),
    openInterest: z.number(),
    price: z.number()
  })),
  statistics: z.object({
    average_funding_rate: z.number(),
    max_funding_rate: z.number(),
    min_funding_rate: z.number(),
    volatility: z.number(),
    trend_direction: z.enum(['increasing', 'decreasing', 'stable']),
    anomaly_count: z.number()
  }),
  trends: z.object({
    funding_rate_trend: z.array(z.number()),
    premium_trend: z.array(z.number()),
    correlation_trend: z.array(z.number())
  })
});

export const fundingCorrelationSchema = z.object({
  funding_oi_correlation: z.object({
    correlation_coefficient: z.number(),
    strength: z.enum(['weak', 'moderate', 'strong']),
    trend: z.enum(['positive', 'negative']),
    significance: z.number()
  }),
  funding_volume_correlation: z.object({
    correlation_coefficient: z.number(),
    strength: z.enum(['weak', 'moderate', 'strong']),
    trend: z.enum(['positive', 'negative']),
    significance: z.number()
  }),
  premium_price_correlation: z.object({
    correlation_coefficient: z.number(),
    strength: z.enum(['weak', 'moderate', 'strong']),
    trend: z.enum(['positive', 'negative']),
    significance: z.number()
  }),
  predictive_metrics: z.object({
    funding_rate_predictive_power: z.number(),
    premium_predictive_power: z.number(),
    combined_predictive_score: z.number()
  })
});
export type OpenInterestData = z.infer<typeof openInterestSchema>;
export type EnhancedOrderBookData = z.infer<typeof enhancedOrderBookSchema>;
export type VolumeProfileData = z.infer<typeof volumeProfileSchema>;
export type SMCAnalysisData = z.infer<typeof smcAnalysisSchema>;
export type FVGData = z.infer<typeof fvgSchema>;
export type OrderBlockData = z.infer<typeof orderBlockSchema>;
export type StructurePointData = z.infer<typeof structurePointSchema>;
export type NearestZoneData = z.infer<typeof nearestZoneSchema>;
export type TradingScenarioData = z.infer<typeof tradingScenarioSchema>;
export type RiskAlertData = z.infer<typeof riskAlertSchema>;
export type CrossDashboardRiskData = z.infer<typeof crossDashboardRiskSchema>;
// Volume Delta (CVD) Analysis Schemas - Professional Trading Analysis
export const volumeDeltaBarSchema = z.object({
  timestamp: z.string(),
  price: z.string(),
  buyVolume: z.string(),
  sellVolume: z.string(),
  netVolume: z.string(), // buyVolume - sellVolume
  totalVolume: z.string(),
  cumulativeDelta: z.string(),
  aggressionRatio: z.number(), // buyVolume / totalVolume (0-1)
  isAbsorption: z.boolean(),
  isDistribution: z.boolean(),
});

export const buyerSellerAggressionSchema = z.object({
  timeframe: z.string(),
  buyerAggression: z.object({
    percentage: z.number(), // 0-100
    strength: z.enum(['weak', 'moderate', 'strong', 'extreme']),
    volume: z.string(),
    averageSize: z.string(),
  }),
  sellerAggression: z.object({
    percentage: z.number(), // 0-100  
    strength: z.enum(['weak', 'moderate', 'strong', 'extreme']),
    volume: z.string(),
    averageSize: z.string(),
  }),
  dominantSide: z.enum(['buyers', 'sellers', 'balanced']),
  imbalanceRatio: z.number(), // ratio between buy/sell aggression
  marketPressure: z.enum(['buying_pressure', 'selling_pressure', 'neutral', 'accumulation', 'distribution']),
});

export const cvdDivergenceSchema = z.object({
  type: z.enum(['bullish', 'bearish', 'hidden_bullish', 'hidden_bearish']),
  strength: z.enum(['weak', 'moderate', 'strong']),
  startTime: z.string(),
  endTime: z.string(),
  priceDirection: z.enum(['up', 'down']),
  cvdDirection: z.enum(['up', 'down']),
  significance: z.enum(['minor', 'major', 'critical']),
  confirmed: z.boolean(),
  description: z.string(),
});

export const absorptionPatternSchema = z.object({
  type: z.enum(['buy_absorption', 'sell_absorption', 'two_way_absorption']),
  startTime: z.string(),
  endTime: z.string(),
  priceRange: z.object({
    high: z.string(),
    low: z.string(),
    width: z.string(),
  }),
  volumeAbsorbed: z.string(),
  efficiency: z.number(), // 0-100, how much volume for price movement
  strength: z.enum(['weak', 'moderate', 'strong', 'institutional']),
  implication: z.enum(['support', 'resistance', 'reversal_zone', 'continuation']),
});

export const flowAnalysisSchema = z.object({
  trend: z.enum(['accumulation', 'distribution', 'neutral', 'rotation']),
  phase: z.enum(['markup', 'markdown', 'reaccumulation', 'redistribution', 'ranging']),
  strength: z.enum(['weak', 'moderate', 'strong']),
  duration: z.string(), // time period of current flow
  volumeProfile: z.object({
    totalBuyVolume: z.string(),
    totalSellVolume: z.string(),
    netFlow: z.string(),
    flowDirection: z.enum(['inflow', 'outflow', 'neutral']),
  }),
  institutionalFootprint: z.object({
    detected: z.boolean(),
    confidence: z.number(), // 0-100
    patterns: z.array(z.string()),
  }),
});

export const cvdAnalysisSchema = z.object({
  timeframe: z.string(),
  currentCVD: z.string(),
  previousCVD: z.string(),
  deltaChange: z.string(),
  percentageChange: z.number(),
  
  // Historical data points for charting
  cvdHistory: z.array(volumeDeltaBarSchema),
  
  // Aggression analysis
  buyerSellerAggression: buyerSellerAggressionSchema,
  
  // Divergence detection
  activeDivergences: z.array(cvdDivergenceSchema),
  recentDivergences: z.array(cvdDivergenceSchema),
  
  // Absorption patterns
  absorptionPatterns: z.array(absorptionPatternSchema),
  
  // Flow analysis
  flowAnalysis: flowAnalysisSchema,
  
  // Smart money indicators
  smartMoneySignals: z.object({
    accumulation: z.object({
      detected: z.boolean(),
      strength: z.enum(['weak', 'moderate', 'strong']),
      timeframe: z.string(),
    }),
    distribution: z.object({
      detected: z.boolean(),
      strength: z.enum(['weak', 'moderate', 'strong']),
      timeframe: z.string(),
    }),
    manipulation: z.object({
      detected: z.boolean(),
      type: z.enum(['stop_hunt', 'liquidity_grab', 'false_breakout']),
      confidence: z.number(),
      priceTargets: z.array(z.object({
        price: z.number(),
        type: z.string(),
        confidence: z.number(),
      })).optional(),
      expectedMove: z.object({
        direction: z.string(),
        magnitude: z.number(),
        timeframe: z.string(),
      }).optional(),
    }),
  }),
  
  // Real-time metrics
  realTimeMetrics: z.object({
    currentBuyPressure: z.number(), // 0-100
    currentSellPressure: z.number(), // 0-100
    momentum: z.enum(['bullish', 'bearish', 'neutral']),
    velocity: z.number(), // rate of CVD change
    acceleration: z.number(), // rate of velocity change
  }),
  
  // Multi-timeframe analysis
  multiTimeframeAlignment: z.record(z.object({
    cvd: z.string(),
    trend: z.enum(['bullish', 'bearish', 'neutral']),
    strength: z.enum(['weak', 'moderate', 'strong']),
  })),
  
  // Confidence scoring
  confidence: z.object({
    overall: z.number(), // 0-100
    dataQuality: z.number(), // 0-100 
    signalClarity: z.number(), // 0-100
    timeframeSynergy: z.number(), // 0-100
  }),
  
  // Alerts and signals
  alerts: z.array(z.object({
    type: z.enum(['divergence', 'absorption', 'flow_change', 'smart_money']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    message: z.string(),
    timestamp: z.string(),
  })),

  // Enhanced: Historical pressure data for charts and analytics
  pressureHistoryData: z.object({
    history: z.array(z.object({
      timestamp: z.string(),
      buyPressure: z.number(),
      sellPressure: z.number(),
      price: z.number(),
      volume: z.number(),
      manipulationLevel: z.number().optional(),
      absorptionPrice: z.number().optional(),
    })),
    analytics: z.object({
      pressureChange24h: z.object({
        buyPressureChange: z.number(),
        sellPressureChange: z.number(),
        trendDirection: z.enum(['bullish', 'bearish', 'neutral']),
      }),
      manipulationEvents: z.array(z.object({
        timestamp: z.string(),
        price: z.number(),
        confidence: z.number(),
        type: z.literal('high_confidence_manipulation'),
      })),
      absorptionLevels: z.array(z.object({
        timestamp: z.string(),
        price: z.number(),
        volume: z.number(),
      })),
    }),
  }).optional(),
  
  lastUpdate: z.string(),
  dataAge: z.number(),
});

export const cvdResponseSchema = z.object({
  success: z.boolean(),
  data: cvdAnalysisSchema,
  timestamp: z.string(),
});

export type VolumeDeltaBar = z.infer<typeof volumeDeltaBarSchema>;
export type BuyerSellerAggression = z.infer<typeof buyerSellerAggressionSchema>;
export type CVDDivergence = z.infer<typeof cvdDivergenceSchema>;
export type AbsorptionPattern = z.infer<typeof absorptionPatternSchema>;
export type FlowAnalysis = z.infer<typeof flowAnalysisSchema>;
export type CVDAnalysis = z.infer<typeof cvdAnalysisSchema>;
export type ApiResponse = z.infer<typeof apiResponseSchema>;

// Position Calculator Schemas
export const positionParamsSchema = z.object({
  entryPrice: z.number().positive(),
  currentPrice: z.number().positive().optional(),
  size: z.number().positive(),
  leverage: z.number().min(1).max(100),
  side: z.enum(['long', 'short']),
  marginMode: z.enum(['isolated', 'cross']).default('isolated'),
});

export const marginCalculationSchema = z.object({
  initialMargin: z.number(),
  maintenanceMargin: z.number(),
  freeMargin: z.number(),
  marginRatio: z.number(),
  liquidationPrice: z.number(),
  marginCall: z.number(),
});

export const pnlCalculationSchema = z.object({
  unrealizedPnL: z.number(),
  realizedPnL: z.number(),
  totalPnL: z.number(),
  pnlPercentage: z.number(),
  roe: z.number(),
});

export const riskMetricsSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high', 'extreme']),
  liquidationDistance: z.number(),
  timeToLiquidation: z.number().optional(),
  maxDrawdown: z.number(),
  sharpeRatio: z.number(),
  valueAtRisk: z.number(),
});

export const positionSizingSchema = z.object({
  optimalSize: z.number(),
  maxSafeSize: z.number(),
  kellySize: z.number(),
  fixedRatioSize: z.number(),
  riskPercentage: z.number(),
});

export const leverageAnalysisSchema = z.object({
  currentLeverage: z.number(),
  effectiveLeverage: z.number(),
  maxSafeLeverage: z.number(),
  leverageRisk: z.enum(['low', 'medium', 'high', 'extreme']),
  recommendations: z.array(z.string()),
});

export const positionCalculatorSchema = z.object({
  position: positionParamsSchema,
  margin: marginCalculationSchema,
  pnl: pnlCalculationSchema,
  risk: riskMetricsSchema,
  sizing: positionSizingSchema,
  leverage: leverageAnalysisSchema,
  scenarios: z.object({
    bullish: z.object({
      price: z.number(),
      pnl: z.number(),
      margin: z.number(),
    }),
    bearish: z.object({
      price: z.number(),
      pnl: z.number(),
      margin: z.number(),
    }),
    liquidation: z.object({
      price: z.number(),
      time: z.number().optional(),
    }),
  }),
  recommendations: z.object({
    action: z.enum(['hold', 'reduce', 'close', 'add']),
    reason: z.string(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
  }),
});

export type PositionParams = z.infer<typeof positionParamsSchema>;
export type MarginCalculation = z.infer<typeof marginCalculationSchema>;
export type PnLCalculation = z.infer<typeof pnlCalculationSchema>;
export type RiskMetrics = z.infer<typeof riskMetricsSchema>;
export type PositionSizing = z.infer<typeof positionSizingSchema>;
export type LeverageAnalysis = z.infer<typeof leverageAnalysisSchema>;
export type PositionCalculatorResult = z.infer<typeof positionCalculatorSchema>;

// Risk Management Dashboard Schemas
export const portfolioRiskMetricsSchema = z.object({
  portfolioValue: z.number(),
  totalExposure: z.number(),
  marginUtilization: z.number(),
  valueAtRisk: z.object({
    daily: z.number(),
    weekly: z.number(),
    confidence95: z.number(),
    confidence99: z.number(),
  }),
  maxDrawdown: z.object({
    current: z.number(),
    estimated: z.number(),
    historical: z.number(),
  }),
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive', 'extreme']),
});

export const portfolioPositionSchema = z.object({
  symbol: z.string(),
  side: z.enum(['long', 'short']),
  size: z.number(),
  entryPrice: z.number(),
  currentPrice: z.number(),
  leverage: z.number(),
  marginMode: z.enum(['isolated', 'cross']),
  unrealizedPnl: z.number(),
  liquidationPrice: z.number(),
  liquidationDistance: z.number(),
  riskWeight: z.number(),
});

export const marketRiskFactorsSchema = z.object({
  volatilityRegime: z.enum(['low', 'normal', 'high', 'extreme']),
  volatilityPercentile: z.number(),
  marketTrend: z.enum(['bullish', 'bearish', 'sideways']),
  fundingRateImpact: z.number(),
  openInterestChange24h: z.number(),
  correlationRisk: z.number(),
  liquidityRisk: z.enum(['low', 'medium', 'high']),
});

export const riskAlertsSchema = z.object({
  marginCallWarnings: z.array(z.object({
    position: z.string(),
    currentMargin: z.number(),
    requiredMargin: z.number(),
    timeToMarginCall: z.string(),
    severity: z.enum(['warning', 'critical']),
  })),
  liquidationWarnings: z.array(z.object({
    position: z.string(),
    liquidationDistance: z.number(),
    estimatedTime: z.string(),
    severity: z.enum(['warning', 'danger', 'critical']),
  })),
  concentrationRisk: z.array(z.object({
    type: z.enum(['position', 'sector', 'leverage']),
    description: z.string(),
    riskLevel: z.number(),
    recommendation: z.string(),
  })),
  marketAlerts: z.array(z.object({
    type: z.enum(['volatility', 'funding', 'liquidity', 'correlation']),
    message: z.string(),
    impact: z.enum(['low', 'medium', 'high']),
    action: z.string(),
  })),
});

export const riskComplianceSchema = z.object({
  riskLimits: z.object({
    maxDrawdown: z.object({
      limit: z.number(),
      current: z.number(),
      status: z.enum(['safe', 'warning', 'breach']),
    }),
    maxLeverage: z.object({
      limit: z.number(),
      current: z.number(),
      status: z.enum(['safe', 'warning', 'breach']),
    }),
    maxExposure: z.object({
      limit: z.number(),
      current: z.number(),
      status: z.enum(['safe', 'warning', 'breach']),
    }),
    varLimit: z.object({
      limit: z.number(),
      current: z.number(),
      status: z.enum(['safe', 'warning', 'breach']),
    }),
  }),
  overallCompliance: z.enum(['compliant', 'warning', 'non_compliant']),
});

export const riskDashboardSchema = z.object({
  timestamp: z.string(),
  accountBalance: z.number(),
  portfolioMetrics: portfolioRiskMetricsSchema,
  positions: z.array(portfolioPositionSchema),
  marketFactors: marketRiskFactorsSchema,
  alerts: riskAlertsSchema,
  recommendations: z.object({
    overall: z.string(),
    positions: z.array(z.string()),
    riskAdjustments: z.array(z.string()),
    urgentActions: z.array(z.string()),
  }),
  compliance: riskComplianceSchema,
});

export type PortfolioRiskMetrics = z.infer<typeof portfolioRiskMetricsSchema>;
export type PortfolioPosition = z.infer<typeof portfolioPositionSchema>;
export type MarketRiskFactors = z.infer<typeof marketRiskFactorsSchema>;
export type RiskAlerts = z.infer<typeof riskAlertsSchema>;
export type RiskCompliance = z.infer<typeof riskComplianceSchema>;
export type RiskDashboardData = z.infer<typeof riskDashboardSchema>;
export type EnhancedFundingRateData = z.infer<typeof enhancedFundingRateSchema>;
export type HistoricalFundingData = z.infer<typeof historicalFundingDataSchema>;
export type FundingCorrelationData = z.infer<typeof fundingCorrelationSchema>;
export type SignalConflictData = z.infer<typeof signalConflictSchema>;
export type LiquidationAlertData = z.infer<typeof liquidationAlertSchema>;
export type MarketStructureAnalysisData = z.infer<typeof marketStructureAnalysisSchema>;

// AI Signal Engine Schemas
export const marketPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  confidence: z.number(),
  timeframe: z.string(),
  signals: z.array(z.string()),
  historical_accuracy: z.number(),
  risk_reward_ratio: z.number(),
  market_conditions: z.array(z.string())
});

export const aiSignalSchema = z.object({
  signal_id: z.string(),
  timestamp: z.string(),
  signal_type: z.enum(['entry', 'exit', 'hold', 'risk_management']),
  direction: z.enum(['long', 'short', 'neutral']),
  strength: z.number(),
  confidence: z.number(),
  source_patterns: z.array(marketPatternSchema),
  reasoning: z.object({
    primary_factors: z.array(z.string()),
    supporting_evidence: z.array(z.string()),
    risk_factors: z.array(z.string()),
    market_context: z.string(),
    educational_note: z.string().optional(),
    data_sources: z.string().optional(),
    ai_confidence: z.string().optional(),
    analysis_timestamp: z.string().optional()
  }),
  execution_details: z.object({
    recommended_size: z.number(),
    stop_loss: z.number(),
    take_profit: z.array(z.number()),
    max_holding_time: z.string(),
    optimal_entry_window: z.string()
  }),
  performance_metrics: z.object({
    expected_return: z.number(),
    max_drawdown: z.number(),
    win_rate: z.number(),
    profit_factor: z.number()
  })
});

export const strategyOptimizationSchema = z.object({
  strategy_id: z.string(),
  parameters: z.record(z.string(), z.number()),
  fitness_score: z.number(),
  backtest_results: z.object({
    total_return: z.number(),
    sharpe_ratio: z.number(),
    max_drawdown: z.number(),
    win_rate: z.number(),
    profit_factor: z.number(),
    total_trades: z.number()
  }),
  generation: z.number(),
  parent_strategies: z.array(z.string()).optional()
});

export const backtestResultsSchema = z.object({
  strategy_id: z.string(),
  timeframe: z.string(),
  period: z.string(),
  results: z.object({
    total_return: z.number(),
    annualized_return: z.number(),
    sharpe_ratio: z.number(),
    sortino_ratio: z.number(),
    max_drawdown: z.number(),
    win_rate: z.number(),
    profit_factor: z.number(),
    total_trades: z.number(),
    average_trade_duration: z.number(),
    risk_adjusted_return: z.number()
  }),
  equity_curve: z.array(z.object({
    timestamp: z.string(),
    equity: z.number(),
    drawdown: z.number()
  })),
  trades: z.array(z.object({
    entry_time: z.string(),
    exit_time: z.string(),
    direction: z.enum(['long', 'short']),
    entry_price: z.number(),
    exit_price: z.number(),
    return: z.number(),
    duration_hours: z.number()
  }))
});

export const strategyPerformanceSchema = z.object({
  active_strategies: z.array(z.object({
    strategy_id: z.string(),
    name: z.string(),
    current_fitness: z.number(),
    recent_performance: z.object({
      return_7d: z.number(),
      return_30d: z.number(),
      win_rate_7d: z.number(),
      max_drawdown_7d: z.number()
    }),
    optimization_status: z.enum(['optimizing', 'stable', 'underperforming']),
    next_evolution: z.string()
  })),
  ai_learning_stats: z.object({
    total_patterns_learned: z.number(),
    pattern_accuracy: z.number(),
    adaptation_rate: z.number(),
    current_generation: z.number(),
    elite_strategies: z.number()
  }),
  market_intelligence: z.object({
    current_regime: z.enum(['trending', 'ranging', 'volatile', 'calm']),
    pattern_confidence: z.number(),
    signal_reliability: z.number(),
    recommended_exposure: z.number()
  })
});

export type MarketPatternData = z.infer<typeof marketPatternSchema>;
export type AISignalData = z.infer<typeof aiSignalSchema>;
export type StrategyOptimizationData = z.infer<typeof strategyOptimizationSchema>;
export type BacktestResultsData = z.infer<typeof backtestResultsSchema>;
export type StrategyPerformanceData = z.infer<typeof strategyPerformanceSchema>;

// ===================================
// MULTI-COIN SCREENING SYSTEM SCHEMAS
// ===================================

// Database table for screening runs
export const screenerRuns = pgTable("screener_runs", {
  id: text("id").primaryKey(),
  params: jsonb("params").notNull(),
  status: text("status").notNull().default('running'), // 'running', 'completed', 'failed'
  totalSymbols: integer("total_symbols").notNull().default(0),
  completedSymbols: integer("completed_symbols").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// Database table for screening results 
export const screenerResults = pgTable("screener_results", {
  runId: text("run_id").references(() => screenerRuns.id).notNull(),
  symbol: text("symbol").notNull(),
  score: integer("score").notNull(),
  label: text("label").notNull(), // 'BUY', 'SELL', 'HOLD'
  layers: jsonb("layers").notNull(),
  levels: jsonb("levels"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// Screening parameters schema
export const screenerParamsSchema = z.object({
  symbols: z.array(z.string()).default(['SOL', 'BTC', 'ETH']),
  timeframe: z.enum(['5m', '15m', '30m', '1h', '4h', '1d']).default('15m'),
  limit: z.number().min(50).max(500).default(200),
  enabledLayers: z.object({
    smc: z.boolean().default(true),
    price_action: z.boolean().default(true),
    ema: z.boolean().default(true),
    rsi_macd: z.boolean().default(true),
    funding: z.boolean().default(true),
    oi: z.boolean().default(true),
    cvd: z.boolean().default(true),
    fibo: z.boolean().default(true),
  }).default({}),
});

// Layer score schema
export const layerScoreSchema = z.object({
  score: z.number().min(-30).max(30),
  reasons: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  timeframe: z.string().optional(),
});

// Screening layers schema
export const screeningLayersSchema = z.object({
  smc: layerScoreSchema,
  price_action: layerScoreSchema.optional(),
  ema: layerScoreSchema.optional(), 
  rsi_macd: layerScoreSchema.optional(),
  funding: layerScoreSchema.optional(),
  oi: layerScoreSchema.optional(),
  cvd: layerScoreSchema.optional(),
  fibo: layerScoreSchema.optional(),
});

// Entry/exit levels schema
export const tradingLevelsSchema = z.object({
  entry: z.number(),
  tp: z.array(z.number()).max(3), // Maximum 3 take profit levels
  sl: z.number(),
  riskReward: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

// Single screening result schema
export const screeningResultSchema = z.object({
  symbol: z.string(),
  score: z.number().min(0).max(100),
  label: z.enum(['BUY', 'SELL', 'HOLD']),
  layers: screeningLayersSchema,
  levels: tradingLevelsSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  timestamp: z.string(),
  analysis: z.object({
    summary: z.string().optional(),
    keyLevels: z.array(z.number()).optional(),
    riskAssessment: z.enum(['low', 'medium', 'high']).optional(),
    timeHorizon: z.enum(['scalp', 'day', 'swing', 'position']).optional(),
  }).optional(),
});

// Complete screening response schema
export const screeningResponseSchema = z.object({
  run_id: z.string(),
  params: screenerParamsSchema,
  status: z.enum(['running', 'completed', 'failed']),
  results: z.array(screeningResultSchema),
  stats: z.object({
    totalSymbols: z.number(),
    buySignals: z.number(),
    sellSignals: z.number(),
    holdSignals: z.number(),
    avgScore: z.number(),
    processingTime: z.number(), // in milliseconds
    topPicks: z.array(z.object({
      symbol: z.string(),
      score: z.number(),
      label: z.string(),
    })).max(5).optional(),
  }),
  timestamp: z.string(),
});

// Drizzle insert schemas
export const insertScreenerRunSchema = createInsertSchema(screenerRuns);
export const insertScreenerResultSchema = createInsertSchema(screenerResults);

// Enhanced AI tracking insert schemas
export const insertAiSignalSchema = createInsertSchema(aiSignals);
export const insertAiExecutionSchema = createInsertSchema(aiExecutions);
export const insertAiOutcomeSchema = createInsertSchema(aiOutcomes);
export const insertAiPatternPerformanceSchema = createInsertSchema(aiPatternPerformance);

// TypeScript types
export type ScreenerRun = typeof screenerRuns.$inferSelect;
export type ScreenerResult = typeof screenerResults.$inferSelect;
export type ScreenerParams = z.infer<typeof screenerParamsSchema>;
export type LayerScore = z.infer<typeof layerScoreSchema>;
export type ScreeningLayers = z.infer<typeof screeningLayersSchema>;
export type TradingLevels = z.infer<typeof tradingLevelsSchema>;
export type ScreeningResult = z.infer<typeof screeningResultSchema>;
export type ScreeningResponse = z.infer<typeof screeningResponseSchema>;
export type InsertScreenerRun = z.infer<typeof insertScreenerRunSchema>;
export type InsertScreenerResult = z.infer<typeof insertScreenerResultSchema>;

// Enhanced AI tracking types
export type AiSignal = typeof aiSignals.$inferSelect;
export type AiExecution = typeof aiExecutions.$inferSelect;
export type AiOutcome = typeof aiOutcomes.$inferSelect;
export type AiPatternPerformance = typeof aiPatternPerformance.$inferSelect;
export type InsertAiSignal = z.infer<typeof insertAiSignalSchema>;
export type InsertAiExecution = z.infer<typeof insertAiExecutionSchema>;
export type InsertAiOutcome = z.infer<typeof insertAiOutcomeSchema>;
export type InsertAiPatternPerformance = z.infer<typeof insertAiPatternPerformanceSchema>;

// Event Logging System insert schemas
export const insertSignalSchema = createInsertSchema(signals);
export const insertSignalTriggerSchema = createInsertSchema(signalTriggers);
export const insertSignalInvalidationSchema = createInsertSchema(signalInvalidations);
export const insertSignalClosureSchema = createInsertSchema(signalClosures);
export const insertWeeklyScorecardSchema = createInsertSchema(weeklyScorecard);

// Event Logging System types
export type Signal = typeof signals.$inferSelect;
export type SignalTrigger = typeof signalTriggers.$inferSelect;
export type SignalInvalidation = typeof signalInvalidations.$inferSelect;
export type SignalClosure = typeof signalClosures.$inferSelect;
export type WeeklyScorecard = typeof weeklyScorecard.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type InsertSignalTrigger = z.infer<typeof insertSignalTriggerSchema>;
export type InsertSignalInvalidation = z.infer<typeof insertSignalInvalidationSchema>;
export type InsertSignalClosure = z.infer<typeof insertSignalClosureSchema>;
export type InsertWeeklyScorecard = z.infer<typeof insertWeeklyScorecardSchema>;

// ========================
// FEEDBACK & LEARNING SYSTEM SCHEMAS
// ========================

// User feedback table for signal ratings
export const userFeedback = pgTable("user_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ref_id: varchar("ref_id").notNull(), // Signal reference ID (e.g., "ib_20250915_0730")
  user_id: varchar("user_id"), // Telegram user ID (optional)
  signal_type: text("signal_type").notNull(), // 'institutional', 'sniper', 'smc', etc.
  rating: integer("rating").notNull(), // +1 for positive, -1 for negative
  response_time_seconds: integer("response_time_seconds"), // Time to respond after signal sent
  metadata: jsonb("metadata"), // Additional context (patterns, confidence, etc.)
  timestamp: timestamp("timestamp").defaultNow(),
});

// Pattern performance tracking with learning adjustments
export const patternLearning = pgTable("pattern_learning", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pattern_name: varchar("pattern_name").notNull().unique(),
  pattern_type: text("pattern_type").notNull(), // 'institutional', 'smc', 'technical', etc.
  base_weight: decimal("base_weight", { precision: 4, scale: 3 }).default("1.0"), // Original weight
  current_weight: decimal("current_weight", { precision: 4, scale: 3 }).default("1.0"), // Adjusted weight
  min_confidence: decimal("min_confidence", { precision: 4, scale: 3 }).default("0.7"), // Minimum confidence threshold
  feedback_stats: jsonb("feedback_stats"), // Rolling feedback statistics
  performance_history: jsonb("performance_history"), // Historical adjustments
  last_adjustment: timestamp("last_adjustment").defaultNow(),
  created_at: timestamp("created_at").defaultNow(),
});

// Weekly feedback analysis results
export const weeklyFeedbackAnalysis = pgTable("weekly_feedback_analysis", {
  week_start: text("week_start").primaryKey(), // DATE as string (YYYY-MM-DD)
  total_feedback: integer("total_feedback").notNull().default(0),
  positive_feedback: integer("positive_feedback").notNull().default(0),
  negative_feedback: integer("negative_feedback").notNull().default(0),
  net_sentiment: decimal("net_sentiment", { precision: 4, scale: 3 }).notNull().default("0"), // (positive - negative) / total
  avg_response_time: integer("avg_response_time"), // Average response time in seconds
  pattern_adjustments: jsonb("pattern_adjustments"), // Patterns that were adjusted this week
  signal_type_performance: jsonb("signal_type_performance"), // Performance by signal type
  learning_velocity: decimal("learning_velocity", { precision: 4, scale: 3 }).default("0.1"), // How aggressively to adjust
  created_at: timestamp("created_at").defaultNow(),
});

// Signal quality metrics tracking
export const signalQualityMetrics = pgTable("signal_quality_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ref_id: varchar("ref_id").notNull().unique(),
  signal_type: text("signal_type").notNull(),
  patterns_used: jsonb("patterns_used"), // Patterns that contributed to this signal
  confidence_score: decimal("confidence_score", { precision: 4, scale: 3 }).notNull(),
  adjusted_weights: jsonb("adjusted_weights"), // Weights used during signal generation
  feedback_received: boolean("feedback_received").default(false),
  final_rating: integer("final_rating"), // Final user rating if received
  learning_impact: jsonb("learning_impact"), // How this signal affected learning
  created_at: timestamp("created_at").defaultNow(),
});

// Feedback schemas for validation
export const feedbackSchema = z.object({
  ref_id: z.string(),
  user_id: z.string().optional(),
  signal_type: z.enum(['institutional', 'sniper', 'smc', 'technical', 'whale', 'funding']),
  rating: z.number().int().min(-1).max(1), // Only +1 or -1 allowed
  response_time_seconds: z.number().int().optional(),
  metadata: z.any().optional(),
});

export const patternLearningSchema = z.object({
  pattern_name: z.string(),
  pattern_type: z.string(),
  base_weight: z.number(),
  current_weight: z.number(),
  min_confidence: z.number(),
  feedback_stats: z.object({
    total_feedback: z.number(),
    positive_count: z.number(),
    negative_count: z.number(),
    net_sentiment: z.number(),
    win_rate: z.number(),
    avg_response_time: z.number().optional(),
  }).optional(),
  performance_history: z.array(z.object({
    date: z.string(),
    adjustment_reason: z.string(),
    weight_change: z.number(),
    confidence_change: z.number(),
    feedback_trigger: z.object({
      total_feedback: z.number(),
      net_sentiment: z.number(),
    }),
  })).optional(),
});

export const weeklyFeedbackReportSchema = z.object({
  week_start: z.string(),
  overall_performance: z.object({
    total_signals: z.number(),
    total_feedback: z.number(),
    feedback_rate: z.number(), // percentage of signals that received feedback
    net_sentiment: z.number(),
    avg_response_time: z.number(),
  }),
  signal_type_breakdown: z.record(z.object({
    signals_sent: z.number(),
    feedback_received: z.number(),
    positive_feedback: z.number(),
    negative_feedback: z.number(),
    net_sentiment: z.number(),
    improvement_trend: z.enum(['improving', 'stable', 'declining']),
  })),
  pattern_adjustments: z.array(z.object({
    pattern_name: z.string(),
    adjustment_type: z.enum(['weight_increase', 'weight_decrease', 'confidence_increase', 'confidence_decrease']),
    magnitude: z.number(),
    reason: z.string(),
    expected_impact: z.string(),
  })),
  learning_insights: z.object({
    most_improved_pattern: z.string().optional(),
    worst_performing_pattern: z.string().optional(),
    learning_velocity: z.number(),
    total_adjustments: z.number(),
    patterns_being_watched: z.array(z.string()),
  }),
  recommendations: z.array(z.string()),
});

// Insert schemas for the new tables
export const insertUserFeedbackSchema = createInsertSchema(userFeedback).omit({
  id: true,
  timestamp: true,
});

export const insertPatternLearningSchema = createInsertSchema(patternLearning).omit({
  id: true,
  last_adjustment: true,
  created_at: true,
});

export const insertWeeklyFeedbackAnalysisSchema = createInsertSchema(weeklyFeedbackAnalysis).omit({
  created_at: true,
});

export const insertSignalQualityMetricsSchema = createInsertSchema(signalQualityMetrics).omit({
  id: true,
  created_at: true,
});

// Type exports for the new tables
export type UserFeedback = typeof userFeedback.$inferSelect;
export type PatternLearning = typeof patternLearning.$inferSelect;
export type WeeklyFeedbackAnalysis = typeof weeklyFeedbackAnalysis.$inferSelect;
export type SignalQualityMetrics = typeof signalQualityMetrics.$inferSelect;

export type InsertUserFeedback = z.infer<typeof insertUserFeedbackSchema>;
export type InsertPatternLearning = z.infer<typeof insertPatternLearningSchema>;
export type InsertWeeklyFeedbackAnalysis = z.infer<typeof insertWeeklyFeedbackAnalysisSchema>;
export type InsertSignalQualityMetrics = z.infer<typeof insertSignalQualityMetricsSchema>;

// Feedback and learning type exports
export type FeedbackData = z.infer<typeof feedbackSchema>;
export type PatternLearningData = z.infer<typeof patternLearningSchema>;
export type WeeklyFeedbackReport = z.infer<typeof weeklyFeedbackReportSchema>;


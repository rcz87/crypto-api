import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, jsonb } from "drizzle-orm/pg-core";
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

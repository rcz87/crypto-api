import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enhanced Zod Schemas for Better Validation
export const TimeframeSchema = z.enum(["1m","3m","5m","15m","30m","1h","4h","1d"]);
export const SymbolSchema = z.string().min(1).max(20);

export const ScreenerRequestSchema = z.object({
  symbols: z.array(SymbolSchema).min(1).max(50),
  timeframe: TimeframeSchema,
  limit: z.number().int().min(100).max(2000).default(500)
});

export type ScreenerRequest = z.infer<typeof ScreenerRequestSchema>;

// SMC Result Schema
export const SMCResultSchema = z.object({
  bias: z.enum(["bullish","bearish","neutral"]).default("neutral"),
  strength: z.number().min(0).max(10).default(0),
  confidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().optional()
});
export type SMCResult = z.infer<typeof SMCResultSchema>;

// Enhanced Indicators Schema with ATR/ADX
export const IndicatorsResultSchema = z.object({
  rsi: z.number().min(0).max(100).nullable(),
  emaTrend: z.enum(["bullish","bearish","mixed","neutral"]).default("neutral"),
  macd: z.object({
    hist: z.number().nullable(),
    signal: z.number().nullable(),
    macd: z.number().nullable()
  }).optional(),
  atr: z.number().min(0).nullable().optional(),
  adx: z.number().min(0).max(100).nullable().optional()
});
export type IndicatorsResult = z.infer<typeof IndicatorsResultSchema>;

// Derivatives Data Schema
export const DerivativesResultSchema = z.object({
  oiChangePct: z.number().nullable().optional(),
  fundingRate: z.number().nullable().optional(),
  premium: z.number().nullable().optional()
});
export type DerivativesResult = z.infer<typeof DerivativesResultSchema>;

// Comprehensive Screening Layers
export const ScreeningLayersSchema = z.object({
  smc: SMCResultSchema,
  indicators: IndicatorsResultSchema.optional(),
  derivatives: DerivativesResultSchema.optional()
});
export type ScreeningLayers = z.infer<typeof ScreeningLayersSchema>;

// Confluence Result with Enhanced Validation
export const ConfluenceResultSchema = z.object({
  totalScore: z.number(),
  normalizedScore: z.number().min(0).max(100),
  label: z.enum(["BUY","SELL","HOLD"]),
  confidence: z.number().min(0).max(100),
  riskLevel: z.enum(["low","medium","high"]).default("medium"),
  layers: ScreeningLayersSchema,
  summary: z.string().default("")
});
export type ConfluenceResult = z.infer<typeof ConfluenceResultSchema>;

// Final Response Schema
export const ScreenerResponseSchema = z.object({
  timestamp: z.number(),
  processingTime: z.number().optional(),
  results: z.array(z.object({
    symbol: SymbolSchema,
    score: z.number().min(0).max(100),
    label: z.enum(["BUY","SELL","HOLD"]),
    riskLevel: z.enum(["low","medium","high"]).default("medium"),
    confidence: z.number().min(0).max(100),
    summary: z.string().default(""),
    layers: ScreeningLayersSchema
  })),
  stats: z.object({
    totalSymbols: z.number(),
    buySignals: z.number(),
    sellSignals: z.number(),
    holdSignals: z.number(),
    avgScore: z.number(),
    topPicks: z.array(z.object({
      symbol: z.string(),
      score: z.number(),
      label: z.string()
    })).max(5).optional()
  }).optional()
});
export type ScreenerResponse = z.infer<typeof ScreenerResponseSchema>;

// Database tables (existing)
export const screenerRuns = pgTable("screener_runs", {
  id: text("id").primaryKey(),
  params: jsonb("params").notNull(),
  status: text("status").notNull().default('running'),
  totalSymbols: integer("total_symbols").notNull().default(0),
  completedSymbols: integer("completed_symbols").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const screenerResults = pgTable("screener_results", {
  runId: text("run_id").references(() => screenerRuns.id).notNull(),
  symbol: text("symbol").notNull(),
  score: integer("score").notNull(),
  label: text("label").notNull(),
  layers: jsonb("layers").notNull(),
  levels: jsonb("levels"),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// Drizzle schemas
export const insertScreenerRunSchema = createInsertSchema(screenerRuns);
export const insertScreenerResultSchema = createInsertSchema(screenerResults);

// TypeScript types
export type ScreenerRun = typeof screenerRuns.$inferSelect;
export type ScreenerResult = typeof screenerResults.$inferSelect;
export type ScreenerParams = z.infer<typeof ScreenerRequestSchema>;
export type LayerScore = z.infer<typeof SMCResultSchema>;
export type TradingLevels = any; // preserved for compatibility
export type ScreeningResult = z.infer<typeof ScreenerResponseSchema>["results"][0];
export type ScreeningResponse = z.infer<typeof ScreenerResponseSchema>;
export type InsertScreenerRun = z.infer<typeof insertScreenerRunSchema>;
export type InsertScreenerResult = z.infer<typeof insertScreenerResultSchema>;
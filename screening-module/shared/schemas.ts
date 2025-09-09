import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
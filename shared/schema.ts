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

// Complete SOL data aggregation schema
export const solCompleteDataSchema = z.object({
  ticker: tickerSchema,
  candles: z.object({
    '1H': z.array(candleSchema),
    '4H': z.array(candleSchema),
    '1D': z.array(candleSchema),
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
export type ApiResponse = z.infer<typeof apiResponseSchema>;

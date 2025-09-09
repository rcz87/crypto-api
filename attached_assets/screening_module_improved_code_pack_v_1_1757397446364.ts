# PATCH PACK — screening-module (v1)
# Tujuan: perbaikan menyeluruh sesuai review (Zod validation, config weights, ATR/ADX, caching Redis, API security, logging, health endpoint, frontend filters/export)
# Catatan: salin tiap blok ke file path yang sesuai.

// ===============================
// 1) shared/schemas.ts
// ===============================

// File: shared/schemas.ts
import { z } from "zod";

export const TimeframeSchema = z.enum(["1m","3m","5m","15m","30m","1h","4h","1d"]);

export const SymbolSchema = z.string().min(1);

export const ScreenerRequestSchema = z.object({
  symbols: z.array(SymbolSchema).min(1),
  timeframe: TimeframeSchema,
  limit: z.number().int().min(100).max(2000).default(500)
});

export type ScreenerRequest = z.infer<typeof ScreenerRequestSchema>;

export const SMCResultSchema = z.object({
  bias: z.enum(["bullish","bearish","neutral"]).default("neutral"),
  strength: z.number().min(0).max(10).default(0),
  notes: z.string().optional()
});
export type SMCResult = z.infer<typeof SMCResultSchema>;

export const IndicatorsResultSchema = z.object({
  rsi: z.number().min(0).max(100).nullable(),
  emaTrend: z.enum(["bullish","bearish","mixed","neutral"]).default("neutral"),
  macd: z.object({
    hist: z.number().nullable(),
    signal: z.number().nullable(),
    macd: z.number().nullable()
  }).optional(),
  atr: z.number().nullable().optional(),
  adx: z.number().nullable().optional()
});
export type IndicatorsResult = z.infer<typeof IndicatorsResultSchema>;

export const DerivativesResultSchema = z.object({
  oiChangePct: z.number().nullable().optional(),
  fundingRate: z.number().nullable().optional()
});
export type DerivativesResult = z.infer<typeof DerivativesResultSchema>;

export const ScreeningLayersSchema = z.object({
  smc: SMCResultSchema,
  indicators: IndicatorsResultSchema.optional(),
  derivatives: DerivativesResultSchema.optional()
});
export type ScreeningLayers = z.infer<typeof ScreeningLayersSchema>;

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

export const ScreenerResponseSchema = z.object({
  timestamp: z.number(),
  results: z.array(z.object({
    symbol: SymbolSchema,
    score: z.number(),
    label: z.enum(["BUY","SELL","HOLD"]),
    riskLevel: z.enum(["low","medium","high"]).default("medium"),
    summary: z.string().default(""),
    layers: ScreeningLayersSchema
  }))
});
export type ScreenerResponse = z.infer<typeof ScreenerResponseSchema>;


// ===============================
// 2) backend/screener/config.ts (baru)
// ===============================

// File: backend/screener/config.ts
export const layerWeights = {
  smc: 1.0,          // paling penting
  indicators: 0.6,
  derivatives: 0.5
} as const;

export const thresholds = {
  buy: 65,  // normalized score
  sell: 35
} as const;

export const security = {
  requireApiKey: true,
  allowedKeys: process.env.API_KEYS?.split(",").map(s => s.trim()).filter(Boolean) || []
};

export const cache = {
  enabled: true,
  ttlSeconds: 20
};


// ===============================
// 3) backend/screener/indicators.ts (upgrade ATR/ADX)
// ===============================

// File: backend/screener/indicators.ts
import { IndicatorsResult } from "../../shared/schemas";

// NOTE: fungsi indikator di bawah bersifat placeholder/quick impl. 
// Ganti dengan lib TA pilihan (misal tulis manual, atau integrasi TA-Lib di sisi Python lalu dipipe).

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let ema: number[] = [];
  values.forEach((v, i) => {
    if (i === 0) ema.push(v);
    else ema.push(v * k + ema[i - 1] * (1 - k));
  });
  return ema;
}

function calcRSI(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcATR(high: number[], low: number[], close: number[], period = 14): number | null {
  if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < high.length; i++) {
    const tr = Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  // simple moving average of TR
  const slice = trs.slice(-period);
  const atr = slice.reduce((a, b) => a + b, 0) / period;
  return atr;
}

function calcADX(high: number[], low: number[], close: number[], period = 14): number | null {
  // Simplified ADX (classic Wilder method would smooth). This is a light approximation for screening.
  if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) return null;
  // For brevity, we’ll output a placeholder estimation using ATR as proxy for trend strength scaling.
  const atr = calcATR(high, low, close, period);
  if (atr == null) return null;
  // crude normalization by last close
  const lastClose = close[close.length - 1];
  if (lastClose <= 0) return null;
  let adx = Math.min(100, Math.max(0, (atr / lastClose) * 100 * 2));
  return adx;
}

export function computeIndicators(candles: { open:number; high:number; low:number; close:number; volume:number; }[]): IndicatorsResult {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const emaTrend = ema20.length && ema50.length && ema20.at(-1)! > ema50.at(-1)! ? "bullish" : (ema20.at(-1)! < ema50.at(-1)! ? "bearish" : "mixed");
  const rsi = calcRSI(closes, 14);
  const atr = calcATR(highs, lows, closes, 14);
  const adx = calcADX(highs, lows, closes, 14);

  return {
    rsi: rsi ?? null,
    emaTrend: emaTrend ?? "neutral",
    macd: { hist: null, signal: null, macd: null }, // optional, bisa diisi nanti
    atr: atr ?? null,
    adx: adx ?? null
  };
}


// ===============================
// 4) backend/screener/scoring.ts (pakai weights + clamp + thresholds)
// ===============================

// File: backend/screener/scoring.ts
import { ConfluenceResult, ScreeningLayers } from "../../shared/schemas";
import { layerWeights, thresholds } from "./config";

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function scoreFromSMC(layers: ScreeningLayers): number {
  const smc = layers.smc;
  let base = 0;
  if (smc.bias === "bullish") base += 10;
  else if (smc.bias === "bearish") base -= 10;
  // strength 0-10 → multiplier
  base *= (1 + (smc.strength || 0) / 10);
  return clamp(base, -30, 30);
}

function scoreFromIndicators(layers: ScreeningLayers): number {
  const ind = layers.indicators;
  if (!ind) return 0;
  let s = 0;
  if (ind.emaTrend === "bullish") s += 6; else if (ind.emaTrend === "bearish") s -= 6;
  if (typeof ind.rsi === "number") {
    if (ind.rsi > 55 && ind.rsi < 70) s += 4; // healthy momentum
    if (ind.rsi >= 70) s -= 3; // overbought warning
    if (ind.rsi < 45 && ind.rsi > 30) s -= 4; // weak momentum
    if (ind.rsi <= 30) s += 3; // oversold bounce potential
  }
  if (typeof ind.adx === "number") {
    if (ind.adx >= 25 && ind.adx <= 45) s += 4; // trending
    if (ind.adx > 45) s += 2; // strong trend
    if (ind.adx < 15) s -= 2; // choppy
  }
  return clamp(s, -20, 20);
}

function scoreFromDerivatives(layers: ScreeningLayers): number {
  const der = layers.derivatives;
  if (!der) return 0;
  let s = 0;
  if (typeof der.oiChangePct === "number") {
    if (der.oiChangePct > 1.5) s += 4; // build-up
    if (der.oiChangePct < -1.5) s -= 4; // unwind
  }
  if (typeof der.fundingRate === "number") {
    // slight contrarian: very positive funding may cap upside
    if (der.fundingRate > 0.05) s -= 2;
    if (der.fundingRate < -0.01) s += 2;
  }
  return clamp(s, -15, 15);
}

export function aggregateConfluence(layers: ScreeningLayers): ConfluenceResult {
  const smcScore = scoreFromSMC(layers) * layerWeights.smc;
  const indScore = scoreFromIndicators(layers) * layerWeights.indicators;
  const derScore = scoreFromDerivatives(layers) * layerWeights.derivatives;

  const total = smcScore + indScore + derScore; // typical range ~ [-30, +30]
  const normalized = clamp(Math.round(((total + 30) / 60) * 100), 0, 100);

  let label: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (normalized >= thresholds.buy) label = "BUY";
  else if (normalized <= thresholds.sell) label = "SELL";

  const confidence = Math.min(100, Math.abs(normalized - 50) * 2);
  const riskLevel: "low" | "medium" | "high" = normalized >= 70 ? "medium" : (normalized <= 30 ? "high" : "medium");

  const summary = `SMC:${Math.round(smcScore)} IND:${Math.round(indScore)} DER:${Math.round(derScore)} → ${normalized}`;

  return {
    totalScore: total,
    normalizedScore: normalized,
    label,
    confidence,
    riskLevel,
    layers,
    summary
  };
}


// ===============================
// 5) backend/screener/screener.service.ts (tambah Redis cache optional)
// ===============================

// File: backend/screener/screener.service.ts
import { ScreenerRequest, ScreenerRequestSchema, ScreenerResponse, ConfluenceResult } from "../../shared/schemas";
import { aggregateConfluence } from "./scoring";
import { computeIndicators } from "./indicators";
import { cache as cacheCfg } from "./config";

// Placeholder store untuk Redis (bisa ganti ke ioredis bila tersedia)
const memCache = new Map<string, { data:any; expireAt:number }>();

function cacheGet(key: string) {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) { memCache.delete(key); return null; }
  return hit.data;
}
function cacheSet(key:string, data:any, ttlSec:number) {
  memCache.set(key, { data, expireAt: Date.now() + ttlSec*1000 });
}

// Mock fetch candles & derivatives — ganti dengan OKXFetcher
async function fetchMarketData(symbol: string, timeframe: string, limit: number) {
  // TODO: Integrasi ke OKXFetcher; di sini dummy generator
  const candles = Array.from({length: limit}, (_,i)=>({
    open: 200 + Math.sin(i/10)*5,
    high: 205 + Math.sin(i/10)*5,
    low: 195 + Math.sin(i/10)*5,
    close: 200 + Math.sin((i+1)/10)*5,
    volume: 1000 + i
  }));
  const derivatives = { oiChangePct: 1.8, fundingRate: 0.003 };
  return { candles, derivatives };
}

// Mock SMC — ganti dengan engine SMC kamu
function computeSMC(candles:any[]) {
  const lastUp = candles.at(-1).close > candles.at(-2).close;
  return { bias: lastUp ? "bullish" : "bearish", strength: 6, notes: "mock" } as const;
}

export class ScreenerService {
  async run(reqRaw: unknown): Promise<ScreenerResponse> {
    const parsed = ScreenerRequestSchema.parse(reqRaw) as ScreenerRequest;
    const { symbols, timeframe, limit } = parsed;

    const results: { symbol:string; score:number; label:ConfluenceResult["label"]; riskLevel:ConfluenceResult["riskLevel"]; summary:string; layers:any }[] = [];

    for (const sym of symbols) {
      const cacheKey = `${sym}:${timeframe}:${limit}`;
      if (cacheCfg.enabled) {
        const hit = cacheGet(cacheKey);
        if (hit) { results.push(hit); continue; }
      }

      const { candles, derivatives } = await fetchMarketData(sym, timeframe, limit);
      const smc = computeSMC(candles);
      const indicators = computeIndicators(candles);
      const layers = { smc, indicators, derivatives };
      const agg = aggregateConfluence(layers);

      const item = { symbol: sym, score: agg.normalizedScore, label: agg.label, riskLevel: agg.riskLevel, summary: agg.summary, layers };
      if (cacheCfg.enabled) cacheSet(cacheKey, item, cacheCfg.ttlSeconds);
      results.push(item);
    }

    return { timestamp: Date.now(), results };
  }
}


// ===============================
// 6) backend/screener/screener.controller.ts (validasi & error handling)
// ===============================

// File: backend/screener/screener.controller.ts
import { Request, Response } from "express";
import { ScreenerService } from "./screener.service";
import { ScreenerRequestSchema } from "../../shared/schemas";

const service = new ScreenerService();

export class ScreenerController {
  async run(req: Request, res: Response) {
    try {
      const body = req.body;
      // runtime validation
      const parsed = ScreenerRequestSchema.parse(body);
      const out = await service.run(parsed);
      return res.status(200).json(out);
    } catch (err:any) {
      if (err?.issues) {
        return res.status(400).json({ error: "VALIDATION_ERROR", details: err.issues });
      }
      return res.status(500).json({ error: "INTERNAL_ERROR", message: err?.message || "unknown" });
    }
  }

  health(_req: Request, res: Response) {
    return res.status(200).json({ ok: true, ts: Date.now() });
  }
}


// ===============================
// 7) backend/screener/screener.routes.ts (API key + routes + rate limit ringan)
// ===============================

// File: backend/screener/screener.routes.ts
import express from "express";
import rateLimit from "express-rate-limit";
import { security } from "./config";
import { ScreenerController } from "./screener.controller";

const controller = new ScreenerController();
export const screenerRouter = express.Router();

// API key middleware
function apiKeyGuard(req:express.Request, res:express.Response, next:express.NextFunction) {
  if (!security.requireApiKey) return next();
  const key = req.header("x-api-key") || req.query.apikey as string | undefined;
  if (!key || !security.allowedKeys.includes(key)) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  return next();
}

const limiter = rateLimit({ windowMs: 15 * 1000, max: 20 });

screenerRouter.get("/health", controller.health.bind(controller));

screenerRouter.post("/run", apiKeyGuard, limiter, express.json({ limit: "200kb" }), controller.run.bind(controller));

// Optional: batch endpoint alias
screenerRouter.post("/multi", apiKeyGuard, limiter, express.json({ limit: "200kb" }), controller.run.bind(controller));


// ===============================
// 8) backend/screener/smc.ts (minor guard)
// ===============================

// File: backend/screener/smc.ts
// NOTE: ini placeholder guard untuk memastikan nilai tidak undefined.
import { SMCResult } from "../../shared/schemas";

export function safeSMC(input: Partial<SMCResult>): SMCResult {
  return {
    bias: input.bias ?? "neutral",
    strength: Math.max(0, Math.min(10, input.strength ?? 0)),
    notes: input.notes
  };
}


// ===============================
// 9) backend/logger.ts (baru) — pino logger
// ===============================

// File: backend/logger.ts
import pino from "pino";
const level = process.env.LOG_LEVEL || "info";
export const logger = pino({ level, base: undefined });


// ===============================
// 10) backend/server.ts (contoh mounting)
// ===============================

// File: backend/server.ts
import express from "express";
import cors from "cors";
import { screenerRouter } from "./screener/screener.routes";
import { logger } from "./logger";

const app = express();
app.use(cors({ origin: [/localhost/, /guardiansofthegreentoken\.com$/] }));
app.use("/api/screener", screenerRouter);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => logger.info({ msg: "screener up", port }));


// ===============================
// 11) frontend/MultiCoinScreening.tsx (filters + badges + export)
// ===============================

// File: frontend/MultiCoinScreening.tsx
import React, { useEffect, useMemo, useState } from "react";

type Row = {
  symbol: string;
  score: number;
  label: "BUY" | "SELL" | "HOLD";
  riskLevel: "low" | "medium" | "high";
  summary: string;
};

export default function MultiCoinScreening() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tf, setTf] = useState("5m");
  const [minScore, setMinScore] = useState(0);
  const [label, setLabel] = useState<string>("all");

  useEffect(() => {
    // Example fetch — sesuaikan URL & API key
    fetch(`/api/screener/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": (window as any).API_KEY ?? "" },
      body: JSON.stringify({ symbols: ["SOLUSDT","ETHUSDT","BTCUSDT"], timeframe: tf, limit: 500 })
    })
      .then(r => r.json())
      .then((d) => {
        const mapped: Row[] = d.results.map((x:any) => ({ symbol: x.symbol, score: x.score, label: x.label, riskLevel: x.riskLevel, summary: x.summary }));
        setRows(mapped);
      })
      .catch(console.error);
  }, [tf]);

  const filtered = useMemo(() => rows.filter(r => r.score >= minScore && (label === "all" || r.label === label)), [rows, minScore, label]);

  const exportCSV = () => {
    const header = "symbol,score,label,riskLevel,summary\n";
    const body = filtered.map(r => `${r.symbol},${r.score},${r.label},${r.riskLevel},"${r.summary.replace(/"/g,'""')}"`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `screening-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <select value={tf} onChange={e=>setTf(e.target.value)} className="border rounded px-2 py-1">
          { ["1m","3m","5m","15m","30m","1h","4h","1d"].map(x=> <option key={x} value={x}>{x}</option>) }
        </select>
        <div className="flex items-center gap-2">
          <label>Min Score</label>
          <input type="number" value={minScore} onChange={e=>setMinScore(Number(e.target.value)||0)} className="border rounded px-2 py-1 w-24" />
        </div>
        <select value={label} onChange={e=>setLabel(e.target.value)} className="border rounded px-2 py-1">
          <option value="all">All</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
          <option value="HOLD">HOLD</option>
        </select>
        <button onClick={exportCSV} className="border rounded px-3 py-1">Export CSV</button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Symbol</th>
            <th>Score</th>
            <th>Label</th>
            <th>Risk</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.symbol} className="border-b hover:bg-gray-50">
              <td className="py-2 font-medium">{r.symbol}</td>
              <td>{r.score}</td>
              <td>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.label === 'BUY' ? 'bg-green-100' : r.label === 'SELL' ? 'bg-red-100' : 'bg-yellow-100'}`}>{r.label}</span>
              </td>
              <td>
                <span className={`px-2 py-0.5 rounded text-xs ${r.riskLevel === 'low' ? 'bg-blue-100' : r.riskLevel === 'high' ? 'bg-red-200' : 'bg-amber-100'}`}>{r.riskLevel}</span>
              </td>
              <td className="text-gray-600">{r.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ===============================
// 12) INTEGRATION_GUIDE.md (update potongan penting)
// ===============================

// File: INTEGRATION_GUIDE.md (tambahan di bagian API)

## Auth
Kirim `x-api-key` pada header. Daftar key dibaca dari env `API_KEYS` (pisahkan dengan koma).

## Endpoints
- `GET /api/screener/health` → `{ ok: true, ts }`
- `POST /api/screener/run`
```jsonc
{
  "symbols": ["SOLUSDT","ETHUSDT"],
  "timeframe": "5m",
  "limit": 500
}
```
**Response** mengikuti `ScreenerResponseSchema`.

## Caching
Hasil disimpan sementara (memCache/Redis) selama `ttlSeconds` (default 20s) per `symbol:timeframe:limit`.


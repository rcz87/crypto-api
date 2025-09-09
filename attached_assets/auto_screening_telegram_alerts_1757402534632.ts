// ============================================================================
// AUTO SCREENING + TELEGRAM ALERTS
// Author: GPT-5 Thinking (RICOZ)
// Target: screening-module v2.x
// Purpose: Auto-scan coins, validate BUY/SELL signals (SMC+Indicators+Derivatives),
//          and push alerts to Telegram.
// ============================================================================

// ============================================================================
// File: backend/notifier/telegram.ts
// ============================================================================
import fetch from "node-fetch";

const token = process.env.TELEGRAM_BOT_TOKEN!;
const chatId = process.env.TELEGRAM_CHAT_ID!;

export async function tgSend(text: string) {
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true };
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// ============================================================================
// File: backend/screener/alert.rules.ts
// ============================================================================
import type { ConfluenceResult } from "../../shared/schemas";

export type AlertDecision = { shouldAlert: boolean; side: "BUY" | "SELL" | "HOLD"; reason: string };

export function decideAlert(agg: ConfluenceResult, buyTh = 65, sellTh = 35): AlertDecision {
  if (agg.label === "BUY" && agg.normalizedScore >= buyTh) {
    return { shouldAlert: true, side: "BUY", reason: `Score ${agg.normalizedScore} ≥ ${buyTh}` };
  }
  if (agg.label === "SELL" && agg.normalizedScore <= sellTh) {
    return { shouldAlert: true, side: "SELL", reason: `Score ${agg.normalizedScore} ≤ ${sellTh}` };
  }
  return { shouldAlert: false, side: "HOLD", reason: "No threshold met" };
}

export function renderAlert(params: { symbol: string; agg: ConfluenceResult & { regime?: string; dynamicThresholds?: { buy: number; sell: number } } }) {
  const { symbol, agg } = params;
  return [
    `⚡ <b>${symbol}</b> — <b>${agg.label}</b> (${agg.normalizedScore}/100)`,
    agg.regime ? `Regime: <b>${agg.regime}</b>` : null,
    `Risk: <b>${agg.riskLevel}</b> | Conf: <b>${Math.round(agg.confidence)}%</b>`,
    `Layers → ${agg.summary}`,
    agg.dynamicThresholds ? `DynTh: BUY≥${agg.dynamicThresholds.buy} / SELL≤${agg.dynamicThresholds.sell}` : null,
    `⏱️ ${new Date().toLocaleString()}`
  ].filter(Boolean).join("\n");
}

// ============================================================================
// File: backend/screener/fetchers.ts
// ============================================================================
// TODO: Replace mock with OKXFetcher
export async function getCandles(symbol: string, timeframe: string, limit: number) {
  return Array.from({ length: limit }, (_, i) => ({
    open: 200 + Math.sin(i / 10) * 5,
    high: 205 + Math.sin(i / 10) * 5,
    low: 195 + Math.sin(i / 10) * 5,
    close: 200 + Math.sin((i + 1) / 10) * 5,
    volume: 1000 + i
  }));
}

export async function getDerivatives(symbol: string) {
  return { oiChangePct: 1.8, fundingRate: 0.003 };
}

// ============================================================================
// File: backend/screener/auto.scheduler.ts
// ============================================================================
import { aggregateMTF } from "./scoring.mtf";
import { computeProIndicators } from "./indicators.pro";
import { decideAlert, renderAlert } from "./alert.rules";
import { tgSend } from "../notifier/telegram";
import { getCandles, getDerivatives } from "./fetchers";
import { ScreenerRequestSchema } from "../../shared/schemas";

const sentKeys = new Map<string, number>();
const dedupTTL = (Number(process.env.DUP_DEDUP_TTL_SEC) || 600) * 1000;

function touchKey(key: string) { sentKeys.set(key, Date.now() + dedupTTL); }
function recentlySent(key: string) {
  const exp = sentKeys.get(key);
  if (!exp) return false;
  if (Date.now() > exp) { sentKeys.delete(key); return false; }
  return true;
}

async function scanOnce() {
  const symbols = (process.env.SYMBOLS || "SOLUSDT,ETHUSDT").split(",").map(s => s.trim()).filter(Boolean);
  const timeframe = process.env.TIMEFRAME || "5m";
  const limit = Number(process.env.CANDLE_LIMIT || 500);
  const buyTh = Number(process.env.BUY_THRESHOLD || 65);
  const sellTh = Number(process.env.SELL_THRESHOLD || 35);

  ScreenerRequestSchema.parse({ symbols, timeframe, limit });

  for (const symbol of symbols) {
    const ltf = await getCandles(symbol, timeframe, limit);
    const h1 = await getCandles(symbol, "1h", 300);
    const h4 = await getCandles(symbol, "4h", 300);
    const derivatives = await getDerivatives(symbol);

    const smc = { bias: ltf.at(-1)!.close > ltf.at(-2)!.close ? "bullish" : "bearish", strength: 6, notes: "auto" } as const;
    const indicators = computeProIndicators(ltf);
    const layers: any = {
      smc,
      indicators: { rsi: indicators.rsi14 ?? null, emaTrend: indicators.emaTrend, adx: indicators.adx14 ?? null, atr: indicators.atr14 ?? null },
      derivatives
    };

    const agg = aggregateMTF(layers, ltf as any, h1 as any, h4 as any);

    const decision = decideAlert(agg, buyTh, sellTh);
    const key = `${symbol}:${agg.label}:${Math.round(agg.normalizedScore)}`;

    if (decision.shouldAlert && !recentlySent(key)) {
      const msg = renderAlert({ symbol, agg: agg as any });
      await tgSend(msg);
      touchKey(key);
    }
  }
}

export function startAutoScanner() {
  const interval = Number(process.env.SCAN_INTERVAL_MS || 15000);
  scanOnce().catch(console.error);
  return setInterval(() => scanOnce().catch(console.error), interval);
}

// ============================================================================
// File: backend/server.autoscan.mount.ts
// ============================================================================
import express from "express";
import cors from "cors";
import { screenerRouter } from "./screener/screener.routes";
import { initObservability } from "./observability";
import { startAutoScanner } from "./screener/auto.scheduler";

const app = express();
app.use(cors({ origin: [/localhost/, /guardiansofthegreentoken\.com$/] }));

try { initObservability(app); } catch {}

app.use("/api/screener", screenerRouter);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`Server up on ${port}`));

startAutoScanner();

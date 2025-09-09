// ================================================================
// MTF PACK — HTF Bias & Alignment (drop-in files) for screening-module v2.x
// Author: GPT-5 Thinking (RICOZ)
// Goal: Multi‑Timeframe alignment where HTF (4h/1h) bias modulates LTF (5m/15m)
// Files below are copy‑paste ready. Each block = ONE FILE.
// ================================================================

// ================================================================
// File: backend/screener/mtf.ts
// Purpose: Compute HTF bias (4h/1h) and provide utilities for MTF alignment
// Exports: computeHTFBias(htfCandles), applyHTFModulation(baseScore, htfBias)
// ================================================================

export type Candle = { open:number; high:number; low:number; close:number; volume:number };

export type HTFBias = {
  h4: { bias: 'bullish'|'bearish'|'neutral'; strength: number; emaTrend: 'bullish'|'bearish'|'mixed'|'neutral'; adx?: number|null };
  h1: { bias: 'bullish'|'bearish'|'neutral'; strength: number; emaTrend: 'bullish'|'bearish'|'mixed'|'neutral'; adx?: number|null };
  combined: { bias: 'bullish'|'bearish'|'neutral'; strength: number };
  notes: string[];
};

// lightweight EMA
function ema(vals:number[], period:number){ const k=2/(period+1); let out:number[]=[]; let prev:number|undefined; for (let i=0;i<vals.length;i++){ const v=vals[i]; prev = prev===undefined? v : v*k + prev*(1-k); out.push(prev);} return out; }

function inferBias(candles:Candle[]): {bias:'bullish'|'bearish'|'neutral'; strength:number; emaTrend:'bullish'|'bearish'|'mixed'|'neutral'}{
  if (!candles || candles.length<60) return { bias:'neutral', strength:0, emaTrend:'neutral' };
  const c = candles.map(x=>x.close);
  const e20 = ema(c,20).at(-1)!; const e50 = ema(c,50).at(-1)!;
  const emaTrend = (e20>e50)? 'bullish' : (e20<e50? 'bearish':'mixed');
  // swing bias via last n candles direction
  const last = c.at(-1)!; const ref = c.at(-30)!;
  const dir = last - ref; let bias:'bullish'|'bearish'|'neutral' = 'neutral';
  if (dir>0) bias='bullish'; else if (dir<0) bias='bearish';
  const slope = Math.abs(dir) / Math.max(1, ref);
  // strength 0..10 based on slope & EMA agreement
  let strength = Math.min(10, Math.round((slope*200) + (emaTrend==='bullish'||emaTrend==='bearish'? 2:0)));
  return { bias, strength, emaTrend };
}

export function computeHTFBias(opts:{h4:Candle[], h1:Candle[]}): HTFBias {
  const h4b = inferBias(opts.h4);
  const h1b = inferBias(opts.h1);
  // combine
  let combinedBias:'bullish'|'bearish'|'neutral' = 'neutral';
  if (h4b.bias===h1b.bias) combinedBias = h4b.bias; else if (h4b.bias!=='neutral') combinedBias = h4b.bias; else combinedBias = h1b.bias;
  const combinedStrength = Math.max(1, Math.round((h4b.strength*0.6 + h1b.strength*0.4)));
  const notes:string[] = [];
  notes.push(`H4: ${h4b.bias} (ema:${h4b.emaTrend})`);
  notes.push(`H1: ${h1b.bias} (ema:${h1b.emaTrend})`);
  notes.push(`Combined: ${combinedBias} x${combinedStrength}`);
  return {
    h4: {...h4b, adx: null},
    h1: {...h1b, adx: null},
    combined: { bias: combinedBias, strength: combinedStrength },
    notes
  };
}

export function applyHTFModulation(baseNormalizedScore:number, ltfBias:'bullish'|'bearish'|'neutral', htf:HTFBias){
  // Rule of thumb: if LTF bias agrees with HTF combined, give a tilt; if disagrees, penalize.
  let adjusted = baseNormalizedScore;
  const agree = (ltfBias!=='neutral' && ltfBias===htf.combined.bias);
  const disagree = (ltfBias!=='neutral' && htf.combined.bias!=='neutral' && ltfBias!==htf.combined.bias);
  const tilt = Math.min(6, Math.max(2, Math.round(htf.combined.strength/2))); // 2..6
  if (agree) adjusted = Math.min(100, adjusted + tilt);
  if (disagree) adjusted = Math.max(0, adjusted - tilt);
  return { adjusted, tilt, agree, disagree };
}


// ================================================================
// File: backend/screener/scoring.mtf.ts
// Purpose: Aggregate with HTF (4h/1h) modulation on top of dynamic scoring
// Exports: aggregateMTF(layers, ltfCandles, h1Candles, h4Candles)
// ================================================================

import type { ScreeningLayers } from '../../shared/schemas';
import { aggregateDynamic } from './scoring.dynamic';
import { computeHTFBias, applyHTFModulation, type Candle } from './mtf';

export function aggregateMTF(layers: ScreeningLayers, ltfCandles:Candle[], h1Candles:Candle[], h4Candles:Candle[]){
  // 1) LTF base via regime-aware dynamic scoring
  const base = aggregateDynamic(layers, ltfCandles);

  // 2) Compute HTF bias
  const htf = computeHTFBias({ h4: h4Candles, h1: h1Candles });

  // 3) Apply HTF modulation to base normalized score using LTF SMC bias
  const ltfBias = layers.smc.bias;
  const mod = applyHTFModulation(base.normalizedScore, ltfBias, htf);

  // 4) Decide label again after modulation
  let label: 'BUY'|'SELL'|'HOLD' = 'HOLD';
  const buyTh = base.dynamicThresholds?.buy ?? 65;
  const sellTh = base.dynamicThresholds?.sell ?? 35;
  if (mod.adjusted >= buyTh) label = 'BUY';
  else if (mod.adjusted <= sellTh) label = 'SELL';

  return {
    ...base,
    label,
    normalizedScore: mod.adjusted,
    htf,
    mtf: {
      appliedTilt: mod.tilt,
      agree: mod.agree,
      disagree: mod.disagree
    }
  };
}


// ================================================================
// File: backend/screener/screener.service.mtf.example.ts
// Purpose: Example wiring in your service to use MTF aggregator
// NOTE: replace your existing service loop with this pattern
// ================================================================

import { aggregateMTF } from './scoring.mtf';
import type { ScreenerResponse, ConfluenceResult } from '../../shared/schemas';

// You must provide real fetchers for each TF ↓
async function fetchCandles(symbol:string, timeframe:string, limit:number){
  // TODO: swap with OKXFetcher.getCandles({symbol,timeframe,limit})
  const candles = Array.from({length: limit}, (_,i)=>({
    open: 200 + Math.sin(i/10)*5,
    high: 205 + Math.sin(i/10)*5,
    low: 195 + Math.sin(i/10)*5,
    close: 200 + Math.sin((i+1)/10)*5,
    volume: 1000 + i
  }));
  return candles;
}

export async function runWithMTF(symbols:string[], timeframe:'5m'|'15m', limit:number){
  const results: { symbol:string; score:number; label:ConfluenceResult['label']; riskLevel:ConfluenceResult['riskLevel']; summary:string; layers:any; htf:any; mtf:any }[] = [];
  for (const sym of symbols){
    const ltf = await fetchCandles(sym, timeframe, limit);
    const h1 = await fetchCandles(sym, '1h', 300);
    const h4 = await fetchCandles(sym, '4h', 300);

    // build layers (replace with your real SMC/Indicators/Derivatives)
    const smc = { bias: 'bullish', strength: 6, notes: 'mock' } as const;
    const indicators = { rsi: 58, emaTrend: 'bullish' } as any;
    const derivatives = { oiChangePct: 1.2, fundingRate: 0.003 } as any;

    const agg = aggregateMTF({ smc, indicators, derivatives }, ltf, h1, h4);

    results.push({
      symbol: sym,
      score: agg.normalizedScore,
      label: agg.label,
      riskLevel: agg.riskLevel,
      summary: `${agg.summary} | HTF:${agg.htf.combined.bias} x${agg.htf.combined.strength} (tilt:${agg.mtf.appliedTilt}${agg.mtf.agree?'+':''}${agg.mtf.disagree?'-':''})`,
      layers: { smc, indicators, derivatives },
      htf: agg.htf,
      mtf: agg.mtf
    });
  }
  const out: ScreenerResponse = { timestamp: Date.now(), results } as any;
  return out;
}


// ================================================================
// File: shared/schemas.mtf.patch.ts (optional)
// Purpose: Patch to extend schemas with MTF fields (if you want to expose to UI)
// How: merge these into your existing shared/schemas.ts
// ================================================================

// Add to ConfluenceResultSchema (optional fields)
// regime: z.enum(["trending","ranging","volatile","quiet"]).optional(),
// dynamicThresholds: z.object({ buy:z.number(), sell:z.number() }).optional(),
// htf: z.object({
//   h4: z.object({ bias: z.enum(["bullish","bearish","neutral"]), strength:z.number(), emaTrend:z.enum(["bullish","bearish","mixed","neutral"]) }),
//   h1: z.object({ bias: z.enum(["bullish","bearish","neutral"]), strength:z.number(), emaTrend:z.enum(["bullish","bearish","mixed","neutral"]) }),
//   combined: z.object({ bias: z.enum(["bullish","bearish","neutral"]), strength:z.number() }),
//   notes: z.array(z.string())
// }).optional(),
// mtf: z.object({ appliedTilt:z.number(), agree:z.boolean(), disagree:z.boolean() }).optional(),


// ================================================================
// File: frontend/MultiCoinScreening.mtf.patch.tsx (optional UI patch)
// Purpose: Show HTF badges + tilt info in your current table
// How: merge the bits below into your component
// ================================================================

// In the row mapping/columns, add:
// <td>
//   <span className="px-2 py-0.5 rounded text-xs bg-blue-100 mr-1">HTF {row?.htf?.combined?.bias ?? '-'}</span>
//   <span className="px-2 py-0.5 rounded text-xs bg-gray-100">tilt {row?.mtf?.appliedTilt ?? 0}</span>
// </td>

// And extend Row type with optional fields htf/mtf if you return them from API.

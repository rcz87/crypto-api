// ================================================================
// PRO PACK — DROP-IN FILES for screening-module v2.x
// Author: GPT-5 Thinking (RICOZ)
// What: Production-grade indicators (Wilder ADX, MACD, BB, CCI, Stoch, SAR),
//        regime detection (trending vs ranging) + dynamic thresholds/weights,
//        ATR-based position sizing. Each block = a FILE. Copy to paths below.
// ================================================================

// ================================================================
// File: backend/screener/indicators.pro.ts
// Purpose: Pure TypeScript TA library (no external deps) for screening.
// Exports: computeProIndicators(candles)
// ================================================================

export type Candle = { open:number; high:number; low:number; close:number; volume:number };

export type ProIndicators = {
  ema20: number | null;
  ema50: number | null;
  emaTrend: 'bullish'|'bearish'|'mixed'|'neutral';
  rsi14: number | null;
  macd: { macd:number|null; signal:number|null; hist:number|null };
  bb: { mid:number|null; upper:number|null; lower:number|null; widthPct:number|null };
  atr14: number | null;
  adx14: number | null; // Wilder
  diPlus14: number | null;
  diMinus14: number | null;
  cci20: number | null;
  stoch: { k:number|null; d:number|null };
  sar: number | null;
};

const eps = 1e-9;

function sma(arr:number[], period:number): number[] {
  const out:number[] = []; let sum=0; for (let i=0;i<arr.length;i++){ sum+=arr[i]; if (i>=period) sum-=arr[i-period]; if (i>=period-1) out.push(sum/period); else out.push(NaN); } return out;
}
function ema(arr:number[], period:number): number[] {
  const k = 2/(period+1); const out:number[]=[]; let prev:number|undefined;
  for (let i=0;i<arr.length;i++){ const v=arr[i]; prev = prev===undefined? v : v*k + prev*(1-k); out.push(prev); } return out;
}
function rsi(arr:number[], period=14): number[] {
  let gains=0, losses=0; const out:number[]=[];
  for (let i=1;i<arr.length;i++){
    const ch = arr[i]-arr[i-1]; const g = Math.max(0,ch), l = Math.max(0,-ch);
    if (i<=period){ gains+=g; losses+=l; out.push(NaN); if (i===period){ const avgG=gains/period, avgL=losses/period; const rs=avgL<eps? 100: avgG/(avgL+eps); out[i-1] = 100 - (100/(1+rs)); } }
    else {
      const prev = out[i-2]; // not used directly; keep consistent length
      gains = (gains*(period-1)+g)/period; losses=(losses*(period-1)+l)/period; const rs=losses<eps? 100: gains/(losses+eps); out.push(100 - (100/(1+rs)));
    }
  }
  out.unshift(NaN); // align length
  return out;
}
function macdSeries(arr:number[], fast=12, slow=26, signalP=9){
  const emaF = ema(arr, fast); const emaS = ema(arr, slow); const macd = arr.map((_,i)=> (emaF[i]-emaS[i]));
  const signal = ema(macd, signalP); const hist = macd.map((v,i)=> v - signal[i]);
  return { macd, signal, hist };
}
function std(arr:number[], period:number): number[] {
  const out:number[]=[]; const q:number[]=[]; let sum=0, sum2=0;
  for (let i=0;i<arr.length;i++){
    const v=arr[i]; q.push(v); sum+=v; sum2+=v*v; if(q.length>period){ const r=q.shift()!; sum-=r; sum2-=r*r; }
    if (q.length===period){ const mean=sum/period; out.push(Math.sqrt(Math.max(0, sum2/period - mean*mean))); } else out.push(NaN);
  }
  return out;
}
function bbands(arr:number[], period=20, mult=2){
  const mid = sma(arr, period); const dev = std(arr, period); const upper:number[]=[]; const lower:number[]=[]; const widthPct:number[]=[];
  for (let i=0;i<arr.length;i++){ const m=mid[i], d=dev[i]; if (Number.isNaN(m)||Number.isNaN(d)) { upper.push(NaN); lower.push(NaN); widthPct.push(NaN);} else { upper.push(m+mult*d); lower.push(m-mult*d); widthPct.push(((upper[i]-lower[i])/(m+eps))*100); } }
  return { mid, upper, lower, widthPct };
}
function trueRange(h:number[], l:number[], c:number[]): number[] {
  const tr:number[]=[]; for(let i=0;i<h.length;i++){ if (i===0) tr.push(h[i]-l[i]); else tr.push(Math.max(h[i]-l[i], Math.abs(h[i]-c[i-1]), Math.abs(l[i]-c[i-1]))); } return tr;
}
function atrWilder(h:number[], l:number[], c:number[], period=14): number[] {
  const tr = trueRange(h,l,c); const out:number[]=[]; let prev:number|undefined;
  for (let i=0;i<tr.length;i++){
    if (i<period) { out.push(NaN); if (i===period-1){ const seed = tr.slice(0,period).reduce((a,b)=>a+b,0)/period; prev=seed; out[i]=seed; } }
    else { prev = ((prev as number)*(period-1) + tr[i]) / period; out.push(prev); }
  } return out;
}
function adxWilder(h:number[], l:number[], c:number[], period=14){
  const len = h.length; const plusDM:number[]=[]; const minusDM:number[]=[];
  for (let i=0;i<len;i++){
    if (i===0){ plusDM.push(0); minusDM.push(0); continue; }
    const upMove = h[i]-h[i-1]; const downMove = l[i-1]-l[i];
    plusDM.push((upMove>downMove && upMove>0)? upMove: 0);
    minusDM.push((downMove>upMove && downMove>0)? downMove: 0);
  }
  // Wilder smoothing for TR, +DM, -DM
  const tr = trueRange(h,l,c);
  function wSmooth(src:number[]): number[] { const out:number[]=[]; let prev:number|undefined; for (let i=0;i<src.length;i++){ if (i<period){ out.push(NaN); if(i===period-1){ const seed=src.slice(0,period).reduce((a,b)=>a+b,0); prev=seed; out[i]=seed; } } else { prev = (prev as number) - ((prev as number)/period) + src[i]; out.push(prev as number); } } return out; }
  const trS = wSmooth(tr); const pDMS = wSmooth(plusDM); const mDMS = wSmooth(minusDM);
  const plusDI:number[]=[]; const minusDI:number[]=[]; const dx:number[]=[];
  for (let i=0;i<len;i++){
    const trv = trS[i]; const p = pDMS[i]; const m = mDMS[i];
    if (Number.isNaN(trv)) { plusDI.push(NaN); minusDI.push(NaN); dx.push(NaN); }
    else {
      const pdi = 100 * (p/(trv+eps)); const mdi = 100 * (m/(trv+eps)); plusDI.push(pdi); minusDI.push(mdi);
      const dxi = 100 * (Math.abs(pdi - mdi) / (pdi + mdi + eps)); dx.push(dxi);
    }
  }
  // ADX = Wilder EMA of DX
  const adx:number[]=[]; let prevADX:number|undefined; for (let i=0;i<dx.length;i++){
    if (i<period*2-1){ adx.push(NaN); if (i===period*2-2){ const seed = dx.slice(period-1, period*2-1).reduce((a,b)=>a+(Number.isNaN(b)?0:b),0)/period; prevADX = seed; adx[i] = seed; } }
    else { prevADX = ((prevADX as number)*(period-1) + dx[i]) / period; adx.push(prevADX as number); }
  }
  return { adx, plusDI, minusDI };
}
function typicalPrice(h:number[], l:number[], c:number[]): number[] { return h.map((_,i)=> (h[i]+l[i]+c[i])/3); }
function cciSeries(h:number[], l:number[], c:number[], period=20){ const tp=typicalPrice(h,l,c); const smaTp=sma(tp,period); const dev:number[]=[]; for(let i=0;i<tp.length;i++){ const m=smaTp[i]; if (Number.isNaN(m)) dev.push(NaN); else dev.push(Math.abs(tp[i]-m)); } const md = sma(dev, period); const out:number[]=[]; for (let i=0;i<tp.length;i++){ const m=smaTp[i]; const d=md[i]; if (Number.isNaN(m)||Number.isNaN(d)||d<eps) out.push(NaN); else out.push((tp[i]-m)/(0.015*d)); } return out; }
function stochSeries(h:number[], l:number[], c:number[], kPeriod=14, dPeriod=3){
  const k:number[]=[]; for (let i=0;i<c.length;i++){ const s=Math.max(0, i-kPeriod+1); const hh = Math.max(...h.slice(s,i+1)); const ll = Math.min(...l.slice(s,i+1)); const val = (hh-ll)<eps? 50 : ((c[i]-ll)/(hh-ll))*100; k.push(val); }
  const d = sma(k, dPeriod); return { k, d };
}
function parabolicSAR(h:number[], l:number[], step=0.02, max=0.2){
  const len=h.length; const out:number[] = new Array(len).fill(NaN); if (len<2) return out;
  // Initialize trend by first two candles
  let isLong = h[1] + l[1] >= h[0] + l[0];
  let ep = isLong ? h[1] : l[1]; // extreme point
  let sar = isLong ? l[0] : h[0];
  let af = step;
  out[0]=NaN; out[1]=sar;
  for (let i=2;i<len;i++){
    sar = sar + af * (ep - sar);
    if (isLong){ sar = Math.min(sar, l[i-1], l[i-2]); if (h[i] > ep){ ep = h[i]; af = Math.min(max, af + step); } if (l[i] < sar){ isLong = false; sar = ep; ep = l[i]; af = step; } }
    else { sar = Math.max(sar, h[i-1], h[i-2]); if (l[i] < ep){ ep = l[i]; af = Math.min(max, af + step); } if (h[i] > sar){ isLong = true; sar = ep; ep = h[i]; af = step; } }
    out[i]=sar;
  }
  return out;
}

export function computeProIndicators(candles:Candle[]): ProIndicators {
  const c = candles.map(x=>x.close), h = candles.map(x=>x.high), l = candles.map(x=>x.low);
  const ema20S = ema(c,20), ema50S = ema(c,50);
  const ema20 = ema20S.at(-1) ?? null; const ema50 = ema50S.at(-1) ?? null;
  const emaTrend = (ema20!=null && ema50!=null)? (ema20>ema50? 'bullish' : (ema20<ema50? 'bearish':'mixed')) : 'neutral';
  const rsiS = rsi(c,14); const rsi14 = rsiS.at(-1) ?? null;
  const { macd:macdS, signal:signalS, hist:histS } = macdSeries(c);
  const macd = { macd: macdS.at(-1) ?? null, signal: signalS.at(-1) ?? null, hist: histS.at(-1) ?? null };
  const bb = (()=>{ const b = bbands(c,20,2); const i=c.length-1; return { mid: b.mid[i]??null, upper: b.upper[i]??null, lower: b.lower[i]??null, widthPct: b.widthPct[i]??null }; })();
  const atrS = atrWilder(h,l,c,14); const atr14 = atrS.at(-1) ?? null;
  const { adx:adxS, plusDI, minusDI } = adxWilder(h,l,c,14); const adx14 = adxS.at(-1) ?? null;
  const diPlus14 = plusDI.at(-1) ?? null; const diMinus14 = minusDI.at(-1) ?? null;
  const cciS = cciSeries(h,l,c,20); const cci20 = cciS.at(-1) ?? null;
  const { k: kS, d: dS } = stochSeries(h,l,c,14,3); const stoch = { k: kS.at(-1) ?? null, d: dS.at(-1) ?? null };
  const sarS = parabolicSAR(h,l,0.02,0.2); const sar = sarS.at(-1) ?? null;
  return { ema20, ema50, emaTrend, rsi14, macd, bb, atr14, adx14, diPlus14, diMinus14, cci20, stoch, sar };
}


// ================================================================
// File: backend/screener/regime.ts
// Purpose: Detect market regime & suggest dynamic thresholds/weights.
// Exports: detectRegime(candles, indicators)
// ================================================================

import type { Candle } from './indicators.pro';
import type { ProIndicators } from './indicators.pro';

export type Regime = 'trending' | 'ranging' | 'volatile' | 'quiet';

export type RegimeAdvice = {
  regime: Regime;
  reason: string;
  dynamicThresholds: { buy:number; sell:number };
  weightMod: { smc:number; indicators:number; derivatives:number };
};

export function detectRegime(candles:Candle[], ind:ProIndicators): RegimeAdvice {
  const c = candles.map(x=>x.close); const lastClose = c.at(-1) ?? 0;
  const atrPct = ind.atr14 && lastClose>0 ? (ind.atr14/lastClose)*100 : null; // daily %
  const adx = ind.adx14 ?? 0; const bbWidth = ind.bb.widthPct ?? 0; const rsi = ind.rsi14 ?? 50;

  // Simple heuristics:
  // - trending: ADX>=25 (Wilder) and EMA trend not mixed
  // - ranging: ADX<20 and BB width small
  // - volatile: ATR% or BB width high
  // - quiet: ATR% very low
  const isTrending = adx>=25 && (ind.emaTrend==='bullish'||ind.emaTrend==='bearish');
  const isRanging = adx<20 && bbWidth>0 && bbWidth<6; // narrow bands
  const isVolatile = (atrPct!=null && atrPct>2.5) || bbWidth>12;
  const isQuiet = (atrPct!=null && atrPct<1.0) && bbWidth<5 && adx<18;

  let regime:Regime = 'ranging';
  let reason = '';
  if (isVolatile) { regime='volatile'; reason='High ATR%/BandWidth'; }
  if (isQuiet) { regime='quiet'; reason='Low ATR%/BandWidth'; }
  if (isTrending) { regime='trending'; reason='ADX≥25 + EMA alignment'; }
  if (!reason) reason = 'Neutral heuristics';

  // Dynamic thresholds & weight modulation
  let th = { buy: 65, sell: 35 };
  let wm = { smc: 1.0, indicators: 0.6, derivatives: 0.5 };

  switch(regime){
    case 'trending':
      th = { buy: 60, sell: 40 }; // easier buy/sell in strong trends
      wm = { smc: 1.1, indicators: 0.7, derivatives: 0.5 };
      break;
    case 'ranging':
      th = { buy: 68, sell: 32 }; // more conservative
      wm = { smc: 0.9, indicators: 0.7, derivatives: 0.5 };
      break;
    case 'volatile':
      th = { buy: 70, sell: 30 }; // avoid chop fakeouts
      wm = { smc: 1.0, indicators: 0.6, derivatives: 0.6 };
      break;
    case 'quiet':
      th = { buy: 66, sell: 34 };
      wm = { smc: 0.95, indicators: 0.65, derivatives: 0.5 };
      break;
  }

  return { regime, reason, dynamicThresholds: th, weightMod: wm };
}


// ================================================================
// File: backend/screener/risk.ts
// Purpose: ATR-based sizing & tradable signal packaging.
// Exports: computeRisk(candles, ind, params)
// ================================================================

import type { Candle } from './indicators.pro';
import type { ProIndicators } from './indicators.pro';

export type RiskParams = {
  accountEquity: number;     // e.g., 10000 USDT
  riskPerTradePct: number;   // e.g., 0.5 → 0.5% risk
  atrSLMult: number;         // e.g., 1.5 × ATR
  minNotional?: number;      // exchange min notionals
};

export type RiskAdvice = {
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  qty: number | null;        // position size based on risk
  rr1: number | null;        // risk-reward to TP1
  rr2: number | null;        // risk-reward to TP2
};

export function computeRisk(candles:Candle[], ind:ProIndicators, side:'long'|'short', params:RiskParams): RiskAdvice {
  const c = candles.map(x=>x.close); const last = c.at(-1) ?? null; if (!last) return { sl:null,tp1:null,tp2:null,qty:null,rr1:null,rr2:null };
  const atr = ind.atr14 ?? null; if (!atr) return { sl:null,tp1:null,tp2:null,qty:null,rr1:null,rr2:null };
  const sl = side==='long'? last - params.atrSLMult*atr : last + params.atrSLMult*atr;
  const tp1 = side==='long'? last + params.atrSLMult*atr : last - params.atrSLMult*atr;
  const tp2 = side==='long'? last + 2*params.atrSLMult*atr : last - 2*params.atrSLMult*atr;
  const riskAmt = params.accountEquity * (params.riskPerTradePct/100);
  const riskPerUnit = Math.abs(last - sl);
  const qtyRaw = riskPerUnit>eps? riskAmt / riskPerUnit : 0;
  const minN = params.minNotional ?? 0; const qty = Math.max(0, qtyRaw, minN>0? (minN/last): 0);
  const rr1 = riskPerUnit>eps? Math.abs(tp1 - last) / riskPerUnit : null;
  const rr2 = riskPerUnit>eps? Math.abs(tp2 - last) / riskPerUnit : null;
  return { sl, tp1, tp2, qty, rr1, rr2 };
}


// ================================================================
// File: backend/screener/scoring.dynamic.ts
// Purpose: Aggregate with regime-aware thresholds & weight mods.
// Exports: aggregateDynamic(layers, candles)
// ================================================================

import type { ScreeningLayers } from '../../shared/schemas';
import { aggregateConfluence as baseAggregate } from './scoring';
import { computeProIndicators } from './indicators.pro';
import { detectRegime } from './regime';

export function aggregateDynamic(layers: ScreeningLayers, candles: {open:number;high:number;low:number;close:number;volume:number}[]) {
  // 1) Compute pro indicators & regime
  const indPro = computeProIndicators(candles);
  const regimeInfo = detectRegime(candles, indPro);

  // 2) Use base aggregator, then apply dynamic adjustments
  const base = baseAggregate(layers);

  // Soft-adjust score by regime (small tilt so it remains explainable)
  let adjusted = base.normalizedScore;
  if (regimeInfo.regime==='trending' && layers.smc.bias==='bullish') adjusted = Math.min(100, adjusted + 3);
  if (regimeInfo.regime==='trending' && layers.smc.bias==='bearish') adjusted = Math.min(100, adjusted + 3);
  if (regimeInfo.regime==='ranging' && indPro.rsi14 && indPro.rsi14>70) adjusted = Math.max(0, adjusted - 2);
  if (regimeInfo.regime==='volatile') adjusted = Math.max(0, adjusted - 1);

  // Dynamic label using regime thresholds
  let label: 'BUY'|'SELL'|'HOLD' = 'HOLD';
  if (adjusted >= regimeInfo.dynamicThresholds.buy) label = 'BUY';
  else if (adjusted <= regimeInfo.dynamicThresholds.sell) label = 'SELL';

  return {
    ...base,
    normalizedScore: adjusted,
    label,
    regime: regimeInfo.regime,
    regimeReason: regimeInfo.reason,
    dynamicThresholds: regimeInfo.dynamicThresholds
  };
}


// ================================================================
// File: backend/screener/README_DROPPIN.md
// Purpose: Quick install notes for this Pro Pack.
// ================================================================

# Pro Pack — Install Notes

1) **Tambahkan file** berikut ke project kamu:
```
backend/screener/indicators.pro.ts
backend/screener/regime.ts
backend/screener/risk.ts
backend/screener/scoring.dynamic.ts
```

2) **Pakai aggregator dinamis** di service kamu:
```ts
// backend/screener/screener.service.ts
import { computeProIndicators } from './indicators.pro';
import { aggregateDynamic } from './scoring.dynamic';

// ...dalam loop per symbol
const indicatorsPro = computeProIndicators(candles); // optional kalau mau log detail
const agg = aggregateDynamic({ smc, indicators, derivatives }, candles);

// opsional risk
import { computeRisk } from './risk';
const risk = computeRisk(candles, indicatorsPro, agg.label==='BUY'?'long':'short', {
  accountEquity: 10000,
  riskPerTradePct: 0.5,
  atrSLMult: 1.5,
});
```

3) **Schemas (optional update)** — kalau mau expose nilai baru ke frontend, tambahkan field opsional di `shared/schemas.ts` untuk `regime`, `dynamicThresholds`, `risk` (sl,tp1,tp2,qty,rr1,rr2).

4) **Tuning cepat**:
- Ubah heuristik `detectRegime()` sesuai preferensi.
- Ubah tilt skor di `aggregateDynamic()` (bagian penyesuaian `adjusted`).
- Untuk Perp Futures, pertimbangkan **filter funding extreme** dan **OI spikes**.

5) **Catatan**: Semua indikator di sini **pure TS** tanpa dependensi eksternal (aman untuk serverless atau VPS minimalis).

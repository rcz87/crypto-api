// ============================================================================
// PERFORMANCE PACK — Backtester & Signal Tracker (drop-in files)
// Author: GPT-5 Thinking (RICOZ)
// Targets: screening-module v2.x (Node/TypeScript, Express)
// Adds: SQLite tracker (better-sqlite3), mini backtester, metrics (hit-rate,
//        expectancy, Sharpe, maxDD), REST endpoints, and a React dashboard.
// ----------------------------------------------------------------------------
// NOTE: Install deps (server):
//   npm i better-sqlite3 zod
// Client: React only (no extra deps)
// ============================================================================

// ============================================================================
// File: backend/perf/db.ts
// Purpose: lightweight SQLite connection + schema bootstrap
// ============================================================================

import Database from 'better-sqlite3';

export const db = new Database(process.env.PERF_DB_PATH || './perf.sqlite');

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  label TEXT NOT NULL,
  score REAL NOT NULL,
  timeframe TEXT NOT NULL,
  summary TEXT,
  UNIQUE(ts, symbol, timeframe)
);

CREATE TABLE IF NOT EXISTS executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id INTEGER NOT NULL,
  side TEXT NOT NULL,
  entry REAL NOT NULL,
  sl REAL,
  tp1 REAL,
  tp2 REAL,
  qty REAL,
  fees REAL,
  slip REAL,
  spread REAL,
  FOREIGN KEY(signal_id) REFERENCES signals(id)
);

CREATE TABLE IF NOT EXISTS outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id INTEGER NOT NULL,
  exit_ts INTEGER,
  exit_price REAL,
  pnl REAL,
  rr REAL,
  reason TEXT,
  FOREIGN KEY(signal_id) REFERENCES signals(id)
);
`);

export function resetPerfDB() {
  db.exec(`DELETE FROM signals; DELETE FROM executions; DELETE FROM outcomes; VACUUM;`);
}


// ============================================================================
// File: backend/perf/signalTracker.ts
// Purpose: record signals, executions, and outcomes
// ============================================================================

import { db } from './db';

export type TrackedSignal = {
  ts: number; symbol: string; label: 'BUY'|'SELL'|'HOLD'; score: number; timeframe: string; summary?: string;
};

export function recordSignal(sig: TrackedSignal) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO signals (ts, symbol, label, score, timeframe, summary) VALUES (?, ?, ?, ?, ?, ?)`);
  stmt.run(sig.ts, sig.symbol, sig.label, sig.score, sig.timeframe, sig.summary || null);
  const row = db.prepare(`SELECT id FROM signals WHERE ts=? AND symbol=? AND timeframe=?`).get(sig.ts, sig.symbol, sig.timeframe) as { id:number };
  return row?.id;
}

export function recordExecution(signalId:number, exec:{ side:'long'|'short'; entry:number; sl?:number|null; tp1?:number|null; tp2?:number|null; qty?:number|null; fees?:number|null; slip?:number|null; spread?:number|null; }) {
  const stmt = db.prepare(`INSERT INTO executions (signal_id, side, entry, sl, tp1, tp2, qty, fees, slip, spread) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(signalId, exec.side, exec.entry, exec.sl ?? null, exec.tp1 ?? null, exec.tp2 ?? null, exec.qty ?? null, exec.fees ?? null, exec.slip ?? null, exec.spread ?? null);
}

export function recordOutcome(signalId:number, out:{ exit_ts:number; exit_price:number; pnl:number; rr:number; reason?:string }) {
  const stmt = db.prepare(`INSERT INTO outcomes (signal_id, exit_ts, exit_price, pnl, rr, reason) VALUES (?, ?, ?, ?, ?, ?)`);
  stmt.run(signalId, out.exit_ts, out.exit_price, out.pnl, out.rr, out.reason || null);
}

export function fetchSignals(limit=1000) {
  return db.prepare(`SELECT * FROM signals ORDER BY ts DESC LIMIT ?`).all(limit);
}

export function fetchJoined(limit=1000) {
  return db.prepare(`
    SELECT s.*, e.side, e.entry, e.sl, e.tp1, e.tp2, e.qty, o.exit_ts, o.exit_price, o.pnl, o.rr
    FROM signals s
    LEFT JOIN executions e ON e.signal_id = s.id
    LEFT JOIN outcomes o ON o.signal_id = s.id
    ORDER BY s.ts ASC
    LIMIT ?
  `).all(limit);
}


// ============================================================================
// File: backend/perf/metrics.ts
// Purpose: compute hit-rate, expectancy, sharpe (daily), max drawdown
// ============================================================================

export type PerfPoint = { ts:number; pnl:number };

export function equityCurve(points: PerfPoint[], startEquity=10000) {
  let eq = startEquity; const curve:{ts:number; equity:number}[] = [];
  for (const p of points) { eq += p.pnl; curve.push({ ts: p.ts, equity: eq }); }
  return curve;
}

export function maxDrawdown(curve:{ts:number;equity:number}[]) {
  let peak = -Infinity, maxDD = 0;
  for (const p of curve) { peak = Math.max(peak, p.equity); const dd = (peak - p.equity); maxDD = Math.max(maxDD, dd); }
  return maxDD;
}

export function hitRate(points: PerfPoint[]) {
  const wins = points.filter(p=>p.pnl>0).length; const total = points.length || 1; return wins/total;
}

export function expectancy(points: PerfPoint[]) {
  if (points.length===0) return 0;
  const wins = points.filter(p=>p.pnl>0).map(p=>p.pnl); const losses = points.filter(p=>p.pnl<=0).map(p=>p.pnl);
  const avgW = wins.length? (wins.reduce((a,b)=>a+b,0)/wins.length):0;
  const avgL = losses.length? (losses.reduce((a,b)=>a+b,0)/losses.length):0;
  const pW = wins.length / (wins.length + losses.length || 1);
  const pL = 1 - pW;
  return pW*avgW + pL*avgL;
}

export function sharpeDaily(points: PerfPoint[], dailyRiskFree=0) {
  if (points.length<2) return 0;
  // assume points spaced evenly per trade; approximate daily by scaling factor k
  // If you have timestamps per trade, you can bin by day. Here we approximate.
  const returns = points.map(p=>p.pnl);
  const mean = returns.reduce((a,b)=>a+b,0)/returns.length;
  const varr = returns.reduce((a,b)=>a+(b-mean)*(b-mean),0)/Math.max(1, returns.length-1);
  const std = Math.sqrt(varr);
  if (std===0) return 0;
  const k = 1; // set k=1 trade ≈ 1 day (adjust if you aggregate per day)
  return (mean - dailyRiskFree) / (std + 1e-9) * Math.sqrt(k);
}


// ============================================================================
// File: backend/perf/backtester.ts
// Purpose: mini backtester (bar-by-bar) over candles & screener strategy
// ============================================================================

import { recordSignal, recordExecution, recordOutcome } from './signalTracker';
import { equityCurve, maxDrawdown, hitRate, expectancy, sharpeDaily, type PerfPoint } from './metrics';

export type Candle = { ts:number; open:number; high:number; low:number; close:number; volume:number };

export type StrategyContext = {
  symbol: string;
  timeframe: string;
  cost: { feeRate:number; slipBps:number; spreadBps:number };
  risk: { equity:number; riskPct:number; atrMult:number; tp1RR:number; tp2RR:number };
};

export type ScreenerLike = (candleWindow:Candle[])=>{ label:'BUY'|'SELL'|'HOLD'; score:number; summary:string };

export async function runBacktest(ctx:StrategyContext, candles:Candle[], screener:ScreenerLike) {
  // roll through candles; assume decisions are made at close of each bar
  const trades: PerfPoint[] = [];
  for (let i=100; i<candles.length; i++) {
    const win = candles.slice(0, i+1);
    const last = win[win.length-1];

    const s = screener(win);
    const sigId = recordSignal({ ts:last.ts, symbol:ctx.symbol, label:s.label, score:s.score, timeframe:ctx.timeframe, summary:s.summary });

    if (s.label==='HOLD') continue;

    // naive execution at next open with fees+slip+spread costs
    const next = candles[i+1]; if (!next) break;
    const entry = next.open * (s.label==='BUY' ? (1 + ctx.cost.slipBps/10000) : (1 - ctx.cost.slipBps/10000));
    const fee = entry * ctx.cost.feeRate;
    const spread = entry * (ctx.cost.spreadBps/10000);

    recordExecution(sigId!, { side: s.label==='BUY'?'long':'short', entry, fees: fee, slip: (entry*ctx.cost.slipBps/10000), spread });

    // simple ATR SL/TP using recent window
    const atr = atrSimple(win, 14);
    const sl = s.label==='BUY' ? entry - ctx.risk.atrMult*atr : entry + ctx.risk.atrMult*atr;
    const rrUnit = Math.abs(entry - sl);
    const tp1 = s.label==='BUY' ? entry + ctx.risk.tp1RR*rrUnit : entry - ctx.risk.tp1RR*rrUnit;

    // simulate exit on next candle(s) high/low touch (first-touch model)
    let exitPrice = candles[i+1].close; let reason = 'bar-close'; let exitTs = candles[i+1].ts;
    for (let j=i+1; j<candles.length; j++) {
      const c = candles[j];
      if (s.label==='BUY'){
        if (c.low <= sl) { exitPrice = sl; reason='stop'; exitTs=c.ts; break; }
        if (c.high >= tp1) { exitPrice = tp1; reason='tp1'; exitTs=c.ts; break; }
      } else {
        if (c.high >= sl) { exitPrice = sl; reason='stop'; exitTs=c.ts; break; }
        if (c.low <= tp1) { exitPrice = tp1; reason='tp1'; exitTs=c.ts; break; }
      }
    }

    // PnL per 1 unit (you can multiply by qty later); include fees/spread approx once per side
    const pnlUnit = (s.label==='BUY') ? (exitPrice - entry) : (entry - exitPrice);
    const costs = fee + spread; const pnl = pnlUnit - costs;
    const rr = rrUnit>0? (Math.abs(exitPrice - entry)/rrUnit) * (pnlUnit>=0? 1 : -1) : 0;
    trades.push({ ts: exitTs, pnl });

    recordOutcome(sigId!, { exit_ts: exitTs, exit_price: exitPrice, pnl, rr, reason });
  }

  // metrics
  const curve = equityCurve(trades);
  const stats = {
    trades: trades.length,
    hitRate: hitRate(trades),
    expectancy: expectancy(trades),
    sharpeDaily: sharpeDaily(trades),
    maxDrawdown: maxDrawdown(curve)
  };
  return { stats, curve };
}

function atrSimple(win:Candle[], period=14){
  if (win.length<period+1) return 0;
  let tr=0; for (let i=win.length-period; i<win.length; i++){
    const c = win[i]; const p = win[i-1];
    const t = Math.max(c.high-c.low, Math.abs(c.high-p.close), Math.abs(c.low-p.close));
    tr += t;
  }
  return tr/period;
}


// ============================================================================
// File: backend/perf/perf.routes.ts
// Purpose: REST endpoints for backtest + performance summary
// ============================================================================

import express from 'express';
import { z } from 'zod';
import { runBacktest } from './backtester';
import { db } from './db';

export const perfRouter = express.Router();

const BacktestReq = z.object({
  symbol: z.string(), timeframe: z.string().default('5m'), candles: z.array(z.object({ ts:z.number(), open:z.number(), high:z.number(), low:z.number(), close:z.number(), volume:z.number() })),
  cost: z.object({ feeRate:z.number().default(0.0005), slipBps:z.number().default(10), spreadBps:z.number().default(5) }).default({ feeRate:0.0005, slipBps:10, spreadBps:5 }),
  risk: z.object({ equity:z.number().default(10000), riskPct:z.number().default(0.5), atrMult:z.number().default(1.5), tp1RR:z.number().default(1.5), tp2RR:z.number().default(2.5) }).default({ equity:10000, riskPct:0.5, atrMult:1.5, tp1RR:1.5, tp2RR:2.5 })
});

// Screener adapter placeholder — replace with your real screener
function screenerAdapter(win:any[]): { label:'BUY'|'SELL'|'HOLD'; score:number; summary:string } {
  const last=win.at(-1); const prev=win.at(-2); const label = last.close>prev.close? 'BUY' : 'SELL';
  return { label, score: 55, summary: 'demo-adapter' };
}

perfRouter.post('/backtest', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const inb = BacktestReq.parse(req.body);
    const { symbol, timeframe, candles, cost, risk } = inb;
    const out = await runBacktest({ symbol, timeframe, cost, risk }, candles as any, screenerAdapter);
    res.json(out);
  } catch (e:any) {
    res.status(400).json({ error:'BAD_REQUEST', details:e?.message || e });
  }
});

perfRouter.get('/summary', (_req, res) => {
  const rows = db.prepare(`
    SELECT s.symbol, s.timeframe, COUNT(o.id) AS n, SUM(CASE WHEN o.pnl>0 THEN 1 ELSE 0 END)*1.0/COUNT(o.id) AS hit,
           AVG(o.pnl) AS avgPnl, SUM(o.pnl) AS totalPnl
    FROM signals s
    JOIN outcomes o ON o.signal_id = s.id
    GROUP BY s.symbol, s.timeframe
    ORDER BY totalPnl DESC
  `).all();
  res.json({ rows });
});

perfRouter.get('/equity', (_req, res) => {
  const rows = db.prepare(`SELECT s.ts AS ts, COALESCE(o.pnl,0) AS pnl FROM signals s LEFT JOIN outcomes o ON o.signal_id=s.id ORDER BY ts ASC`).all();
  let eq=10000; const curve = rows.map((r:any)=> ({ ts: r.ts, equity: (eq+=r.pnl) }));
  res.json({ curve });
});


// ============================================================================
// File: backend/server.perf.mount.ts (example)
// Purpose: how to mount perf routes into your Express app
// ============================================================================

import express from 'express';
import { perfRouter } from './perf/perf.routes';

const app = express();
app.use('/api/perf', perfRouter);
app.listen(8081);


// ============================================================================
// File: frontend/PerformanceDashboard.tsx
// Purpose: simple React dashboard to view summary & equity curve
// ============================================================================

import React, { useEffect, useState } from 'react';

type SummaryRow = { symbol:string; timeframe:string; n:number; hit:number; avgPnl:number; totalPnl:number };

export default function PerformanceDashboard(){
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [curve, setCurve] = useState<{ts:number;equity:number}[]>([]);

  useEffect(()=>{ fetch('/api/perf/summary').then(r=>r.json()).then(d=>setSummary(d.rows||[])).catch(console.error); },[]);
  useEffect(()=>{ fetch('/api/perf/equity').then(r=>r.json()).then(d=>setCurve(d.curve||[])).catch(console.error); },[]);

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-semibold">Performance Summary</h2>
      <table className="w-full text-sm">
        <thead><tr className="border-b"><th>Symbol</th><th>TF</th><th>#Trades</th><th>Hit-Rate</th><th>Avg PnL</th><th>Total PnL</th></tr></thead>
        <tbody>
          {summary.map((r,i)=> (
            <tr key={i} className="border-b hover:bg-gray-50">
              <td className="py-1">{r.symbol}</td>
              <td>{r.timeframe}</td>
              <td>{r.n}</td>
              <td>{(r.hit*100).toFixed(1)}%</td>
              <td>{r.avgPnl.toFixed(2)}</td>
              <td className={r.totalPnl>=0? 'text-green-600':'text-red-600'}>{r.totalPnl.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-xl font-semibold">Equity Curve</h2>
      <div className="w-full h-64 bg-white border rounded p-2 overflow-auto">
        {/* simple SVG line without chart libs */}
        <EquitySVG data={curve}/>
      </div>
    </div>
  );
}

function EquitySVG({ data }:{ data:{ts:number; equity:number}[] }){
  if (!data || data.length===0) return <div className="text-gray-500">No data</div>;
  const width = 800, height = 220, pad=20;
  const minE = Math.min(...data.map(d=>d.equity));
  const maxE = Math.max(...data.map(d=>d.equity));
  const span = Math.max(1, maxE-minE);
  const x = (i:number)=> pad + (i/(data.length-1))*(width-2*pad);
  const y = (e:number)=> pad + (1-(e-minE)/span)*(height-2*pad);
  const path = data.map((d,i)=> `${i===0? 'M':'L'} ${x(i).toFixed(1)} ${y(d.equity).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height}>
      <rect x={0} y={0} width={width} height={height} fill="#fafafa" stroke="#ddd"/>
      <path d={path} fill="none" stroke="#0ea5e9" strokeWidth={2}/>
      <text x={pad} y={pad+12} fontSize={12} fill="#555">Equity</text>
    </svg>
  );
}

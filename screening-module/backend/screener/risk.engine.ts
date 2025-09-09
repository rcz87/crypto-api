// Risk Engine — ATR-based SL/TP, %equity sizing, spread/slippage/fee aware
// Professional risk management for institutional trading

export type Candle = { open:number; high:number; low:number; close:number; volume:number };

export type ExchangeParams = {
  // Trading constraints
  minNotional: number;           // e.g., 5 USDT
  minQty: number;                // e.g., 0.001
  qtyStep: number;               // step size for qty increments
  priceStep: number;             // price tick size

  // Cost model
  takerFeeRate: number;          // e.g., 0.0005 = 5 bps
  makerFeeRate?: number;         // optional maker fee
  slippageBps: number;           // expected slippage in bps (1 bps = 0.01%)
  spreadBps: number;             // average spread in bps

  // Leverage & margin (optional)
  maxLeverage?: number;
};

export type RiskConfig = {
  accountEquity: number;         // total equity in quote currency (USDT)
  riskPerTradePct: number;       // % equity risked per trade (e.g., 0.5 = 0.5%)
  atrSLMult: number;             // SL distance in ATR multiples (e.g., 1.5)
  tp1RR: number;                 // RR for TP1 (e.g., 1.0 to 1.5)
  tp2RR: number;                 // RR for TP2 (e.g., 2.0)
  capPositionPct?: number;       // optional: cap position as % equity (e.g., 20)
};

export type RiskOutput = {
  side: 'long'|'short';
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  rr1: number;
  rr2: number;
  // Sizes and costs
  qty: number;
  notional: number;
  estFees: number;
  estSlippageCost: number;
  estSpreadCost: number;
  // Validation
  valid: boolean;
  violations: string[];
};

const EPS = 1e-9;
const roundStep = (v:number, step:number) => Math.round(v/step)*step;

export function computeATR(candles:Candle[], period=14): number | null {
  if (candles.length < period+1) return null;
  
  const tr:number[] = [];
  for (let i=1;i<candles.length;i++){
    const h=candles[i].high, l=candles[i].low, pc=candles[i-1].close;
    tr.push(Math.max(h-l, Math.abs(h-pc), Math.abs(l-pc)));
  }
  
  const array = tr.slice(-period);
  return array.reduce((a,b)=>a+b,0)/period;
}

export function riskEngine(params:{
  side: 'long'|'short',
  candles: Candle[],
  risk: RiskConfig,
  exch: ExchangeParams,
  entryPrice?: number
}): RiskOutput {
  const { side, candles, risk, exch } = params;
  const last = candles.at(-1)?.close;
  if (!last) throw new Error("No last close price available");
  
  const entry = params.entryPrice ?? last;

  // Calculate ATR for stop loss positioning
  const atr = computeATR(candles, 14);
  if (!atr) throw new Error("ATR calculation failed - insufficient data");

  // Raw SL/TP using ATR multiples
  const slRaw = side==='long' ? 
    entry - risk.atrSLMult*atr : 
    entry + risk.atrSLMult*atr;
  
  const rrUnit = Math.abs(entry - slRaw);

  const tp1Raw = side==='long' ? 
    entry + risk.tp1RR*rrUnit : 
    entry - risk.tp1RR*rrUnit;
  
  const tp2Raw = side==='long' ? 
    entry + risk.tp2RR*rrUnit : 
    entry - risk.tp2RR*rrUnit;

  // Adjust for exchange price tick size
  const sl = roundStep(slRaw, exch.priceStep);
  const tp1 = roundStep(tp1Raw, exch.priceStep);
  const tp2 = roundStep(tp2Raw, exch.priceStep);

  // Position sizing by %equity risk
  const riskAmount = risk.accountEquity * (risk.riskPerTradePct/100);
  const qtyRaw = rrUnit>EPS ? riskAmount / rrUnit : 0;

  // Cap by position %equity if set
  const capNotional = risk.capPositionPct ? 
    risk.accountEquity * (risk.capPositionPct/100) : 
    Infinity;
  const maxQtyByCap = capNotional / entry;
  let qty = Math.min(qtyRaw, maxQtyByCap);

  // Apply exchange constraints: minQty, step, minNotional
  qty = Math.max(qty, exch.minQty);
  qty = Math.max(qty, exch.minNotional/entry);
  qty = Math.max(qty, EPS);
  qty = roundStep(qty, exch.qtyStep);

  const notional = qty * entry;

  // Cost model calculations
  const takerFee = notional * (exch.takerFeeRate || 0);
  const slippageCost = notional * (exch.slippageBps/10000);
  const spreadCost = notional * (exch.spreadBps/10000);
  
  const estFees = takerFee;
  const estSlippageCost = slippageCost;
  const estSpreadCost = spreadCost;

  // R/R calculations (gross, before costs)
  const rr1 = rrUnit>EPS ? (Math.abs(tp1 - entry) / rrUnit) : 0;
  const rr2 = rrUnit>EPS ? (Math.abs(tp2 - entry) / rrUnit) : 0;

  // Comprehensive validations
  const violations:string[] = [];
  
  if (notional < exch.minNotional) {
    violations.push(`Notional ${notional.toFixed(2)} < minNotional ${exch.minNotional}`);
  }
  if (qty < exch.minQty) {
    violations.push(`Qty ${qty} < minQty ${exch.minQty}`);
  }
  if (rr1 < 1.0) {
    violations.push(`RR1 ${rr1.toFixed(2)} < 1.0 - insufficient reward`);
  }
  if (sl >= entry && side==='long') {
    violations.push(`SL (${sl}) invalid for long position`);
  }
  if (sl <= entry && side==='short') {
    violations.push(`SL (${sl}) invalid for short position`);
  }
  
  // Additional risk warnings
  if (notional > risk.accountEquity * 0.25) {
    violations.push(`Position size ${(notional/risk.accountEquity*100).toFixed(1)}% too large`);
  }
  if (rr1 > 5.0) {
    violations.push(`RR1 ${rr1.toFixed(2)} unrealistically high`);
  }

  return {
    side, entry, sl, tp1, tp2, rr1, rr2,
    qty, notional,
    estFees, estSlippageCost, estSpreadCost,
    valid: violations.length===0,
    violations
  };
}
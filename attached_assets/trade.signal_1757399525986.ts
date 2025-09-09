// ======================================================================
// Trade Signal Composer — combine Screening + Risk into tradable payload
// Author: GPT-5 Thinking (RICOZ)
// ======================================================================

import { riskEngine, type RiskConfig, type ExchangeParams, type Candle } from './risk.engine';

export type ScreenResult = {
  symbol: string;
  label: 'BUY'|'SELL'|'HOLD';
  score: number;               // normalized score 0..100
  summary: string;
  layers: any;
};

export type TradableSignal = {
  symbol: string;
  side: 'long'|'short'|'none';
  entry: number|null;
  sl: number|null;
  tp1: number|null;
  tp2: number|null;
  qty: number|null;
  rr1: number|null;
  rr2: number|null;
  costs: { fees:number; slip:number; spread:number };
  meta: {
    score: number;
    label: 'BUY'|'SELL'|'HOLD';
    valid: boolean;
    violations: string[];
    notes?: string;
  }
};

export function composeTradableSignal(screen:ScreenResult, candles:Candle[], risk:RiskConfig, exch:ExchangeParams): TradableSignal {
  if (screen.label==='HOLD') {
    return {
      symbol: screen.symbol, side:'none',
      entry: null, sl:null, tp1:null, tp2:null, qty:null, rr1:null, rr2:null,
      costs: { fees:0, slip:0, spread:0 },
      meta: { score: screen.score, label: screen.label, valid: false, violations: ['NON_TRADABLE: HOLD'] }
    };
  }

  const side = screen.label==='BUY' ? 'long' : 'short';
  const out = riskEngine({ side, candles, risk, exch });

  return {
    symbol: screen.symbol,
    side,
    entry: out.entry,
    sl: out.sl,
    tp1: out.tp1,
    tp2: out.tp2,
    qty: out.qty,
    rr1: out.rr1,
    rr2: out.rr2,
    costs: { fees: out.estFees, slip: out.estSlippageCost, spread: out.estSpreadCost },
    meta: { score: screen.score, label: screen.label, valid: out.valid, violations: out.violations, notes: screen.summary }
  };
}

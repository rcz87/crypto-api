// ======================================================================
// Execution Validator — sanity checks before placing orders
// Author: GPT-5 Thinking (RICOZ)
// ======================================================================

export type ExecutionContext = {
  symbol: string;
  side: 'long'|'short';
  price: number;
  qty: number;
  allowedSlippageBps: number; // e.g., 15 bps
  maxImpactBps: number;       // orderbook impact limit
  fundingRate?: number|null;  // current funding
  oiChangePct?: number|null;  // open interest change
};

export type BookSnapshot = {
  bestBid: number;
  bestAsk: number;
  mid: number;
};

export type ExecutionCheck = {
  ok: boolean;
  reasons: string[];
  warnings: string[];
};

export function validateExecution(ctx:ExecutionContext, book:BookSnapshot): ExecutionCheck {
  const reasons:string[] = [];
  const warnings:string[] = [];

  const spreadBps = ((book.bestAsk - book.bestBid) / book.mid) * 10000;
  if (spreadBps > ctx.maxImpactBps) reasons.push(`Spread too wide: ${spreadBps.toFixed(2)} bps > ${ctx.maxImpactBps} bps`);

  const slippageToMidBps = Math.abs(ctx.price - book.mid) / book.mid * 10000;
  if (slippageToMidBps > ctx.allowedSlippageBps) reasons.push(`Price slippage to mid ${slippageToMidBps.toFixed(2)} bps > allowed ${ctx.allowedSlippageBps}`);

  if (typeof ctx.fundingRate === 'number') {
    if (ctx.side==='long' && ctx.fundingRate > 0.1) warnings.push(`High positive funding ${ctx.fundingRate*100}% may cap upside`);
    if (ctx.side==='short' && ctx.fundingRate < -0.05) warnings.push(`High negative funding ${ctx.fundingRate*100}% may cap downside`);
  }
  if (typeof ctx.oiChangePct === 'number') {
    if (ctx.oiChangePct > 5) warnings.push(`OI spike +${ctx.oiChangePct}% — increased liquidation risk`);
  }

  return { ok: reasons.length===0, reasons, warnings };
}

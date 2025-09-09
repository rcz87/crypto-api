// Execution Validator — Pre-trade sanity checks and market condition analysis
// Professional order validation for institutional trading

export type ExecutionContext = {
  symbol: string;
  side: 'long'|'short';
  price: number;
  qty: number;
  allowedSlippageBps: number; // e.g., 15 bps max slippage
  maxImpactBps: number;       // orderbook impact limit
  fundingRate?: number|null;  // current funding rate
  oiChangePct?: number|null;  // open interest change %
};

export type BookSnapshot = {
  bestBid: number;
  bestAsk: number;
  mid: number;
  bidSize?: number;           // optional liquidity info
  askSize?: number;
};

export type ExecutionCheck = {
  ok: boolean;
  reasons: string[];          // blocking issues
  warnings: string[];         // non-blocking concerns
  metrics: {
    spreadBps: number;
    slippageBps: number;
    impactEst: number;
  };
};

export function validateExecution(
  ctx: ExecutionContext, 
  book: BookSnapshot
): ExecutionCheck {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Calculate spread in basis points
  const spreadBps = ((book.bestAsk - book.bestBid) / book.mid) * 10000;
  
  // Calculate slippage to mid price
  const slippageToMidBps = Math.abs(ctx.price - book.mid) / book.mid * 10000;
  
  // Estimate market impact
  const targetPrice = ctx.side === 'long' ? book.bestAsk : book.bestBid;
  const impactBps = Math.abs(ctx.price - targetPrice) / book.mid * 10000;

  // Critical validations (blocking)
  if (spreadBps > ctx.maxImpactBps) {
    reasons.push(`Spread too wide: ${spreadBps.toFixed(2)} bps > ${ctx.maxImpactBps} bps limit`);
  }

  if (slippageToMidBps > ctx.allowedSlippageBps) {
    reasons.push(`Price slippage ${slippageToMidBps.toFixed(2)} bps > allowed ${ctx.allowedSlippageBps} bps`);
  }

  // Price reasonableness checks
  if (ctx.side === 'long' && ctx.price < book.bestBid) {
    reasons.push(`Long entry price ${ctx.price} below best bid ${book.bestBid}`);
  }
  if (ctx.side === 'short' && ctx.price > book.bestAsk) {
    reasons.push(`Short entry price ${ctx.price} above best ask ${book.bestAsk}`);
  }

  // Market condition warnings (non-blocking)
  if (spreadBps > 20) {
    warnings.push(`Wide spread ${spreadBps.toFixed(1)} bps indicates low liquidity`);
  }

  // Funding rate analysis
  if (typeof ctx.fundingRate === 'number') {
    const fundingPct = ctx.fundingRate * 100;
    
    if (ctx.side === 'long' && ctx.fundingRate > 0.001) {
      warnings.push(`High positive funding ${fundingPct.toFixed(3)}% - longs pay shorts`);
    }
    if (ctx.side === 'short' && ctx.fundingRate < -0.0005) {
      warnings.push(`High negative funding ${fundingPct.toFixed(3)}% - shorts pay longs`);
    }
    
    // Extreme funding warnings
    if (Math.abs(ctx.fundingRate) > 0.005) {
      warnings.push(`Extreme funding rate ${fundingPct.toFixed(3)}% - high cost to hold`);
    }
  }

  // Open Interest analysis
  if (typeof ctx.oiChangePct === 'number') {
    if (ctx.oiChangePct > 10) {
      warnings.push(`Large OI increase +${ctx.oiChangePct.toFixed(1)}% - potential liquidation cascade risk`);
    }
    if (ctx.oiChangePct < -10) {
      warnings.push(`Large OI decrease ${ctx.oiChangePct.toFixed(1)}% - potential unwinding pressure`);
    }
    
    // Extreme OI changes
    if (Math.abs(ctx.oiChangePct) > 20) {
      reasons.push(`Extreme OI change ${ctx.oiChangePct.toFixed(1)}% - market instability`);
    }
  }

  // Liquidity size warnings
  if (book.bidSize && book.askSize) {
    const requiredLiquidity = ctx.qty;
    const availableLiquidity = ctx.side === 'long' ? book.askSize : book.bidSize;
    
    if (requiredLiquidity > availableLiquidity * 0.1) {
      warnings.push(`Order size ${requiredLiquidity} large vs available liquidity ${availableLiquidity}`);
    }
  }

  // Time-based warnings (would need timestamp in real implementation)
  // For now, just general market hours warning structure
  const isWeekend = false; // Would calculate from timestamp
  if (isWeekend) {
    warnings.push('Weekend trading - potentially lower liquidity');
  }

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
    metrics: {
      spreadBps: Math.round(spreadBps * 100) / 100,
      slippageBps: Math.round(slippageToMidBps * 100) / 100,
      impactEst: Math.round(impactBps * 100) / 100
    }
  };
}

// Additional helper for batch validation
export function validateMultipleExecutions(
  executions: ExecutionContext[],
  book: BookSnapshot
): { symbol: string; check: ExecutionCheck }[] {
  return executions.map(ctx => ({
    symbol: ctx.symbol,
    check: validateExecution(ctx, book)
  }));
}

// Helper for risk-adjusted execution validation
export function validateWithRiskProfile(
  ctx: ExecutionContext,
  book: BookSnapshot,
  riskProfile: 'conservative' | 'moderate' | 'aggressive'
): ExecutionCheck {
  // Adjust limits based on risk profile
  const adjustedCtx = { ...ctx };
  
  switch (riskProfile) {
    case 'conservative':
      adjustedCtx.allowedSlippageBps = Math.min(ctx.allowedSlippageBps, 10);
      adjustedCtx.maxImpactBps = Math.min(ctx.maxImpactBps, 15);
      break;
    case 'moderate':
      // Use provided limits
      break;
    case 'aggressive':
      adjustedCtx.allowedSlippageBps = Math.max(ctx.allowedSlippageBps, 25);
      adjustedCtx.maxImpactBps = Math.max(ctx.maxImpactBps, 35);
      break;
  }
  
  return validateExecution(adjustedCtx, book);
}
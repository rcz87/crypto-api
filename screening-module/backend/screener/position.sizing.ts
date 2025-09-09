// Position Sizing — Helpers to quantize qty/price to exchange constraints
// Professional order sizing for exchange compliance

export function quantizeQty(qty: number, minQty: number, step: number): number {
  // Ensure minimum quantity requirement
  if (qty < minQty) {
    return minQty;
  }
  
  // Round to nearest step
  const rounded = Math.round(qty / step) * step;
  
  // Ensure still meets minimum after rounding
  return Math.max(minQty, rounded);
}

export function quantizePrice(price: number, tick: number): number {
  return Math.round(price / tick) * tick;
}

// Advanced position sizing with risk management
export function calculateOptimalSize(params: {
  accountEquity: number;
  riskPercentage: number;    // e.g., 0.5 for 0.5%
  entryPrice: number;
  stopLoss: number;
  minQty: number;
  qtyStep: number;
  minNotional: number;
  maxPositionPercent?: number; // e.g., 20 for 20% max position
}): {
  quantity: number;
  notional: number;
  riskAmount: number;
  positionPercent: number;
  adjustments: string[];
} {
  const { 
    accountEquity, 
    riskPercentage, 
    entryPrice, 
    stopLoss, 
    minQty, 
    qtyStep, 
    minNotional,
    maxPositionPercent = 25 
  } = params;
  
  const adjustments: string[] = [];
  
  // Calculate risk per trade in dollar terms
  const riskAmount = accountEquity * (riskPercentage / 100);
  
  // Calculate position size based on stop loss distance
  const stopDistance = Math.abs(entryPrice - stopLoss);
  let quantity = stopDistance > 0 ? riskAmount / stopDistance : 0;
  
  // Apply minimum notional requirement
  const minQtyByNotional = minNotional / entryPrice;
  if (quantity < minQtyByNotional) {
    quantity = minQtyByNotional;
    adjustments.push(`Increased to meet min notional (${minNotional})`);
  }
  
  // Apply minimum quantity requirement
  if (quantity < minQty) {
    quantity = minQty;
    adjustments.push(`Increased to meet min quantity (${minQty})`);
  }
  
  // Apply maximum position size limit
  const maxQtyByPosition = (accountEquity * (maxPositionPercent / 100)) / entryPrice;
  if (quantity > maxQtyByPosition) {
    quantity = maxQtyByPosition;
    adjustments.push(`Reduced to max position limit (${maxPositionPercent}%)`);
  }
  
  // Quantize to exchange step size
  const quantizedQty = quantizeQty(quantity, minQty, qtyStep);
  if (quantizedQty !== quantity) {
    adjustments.push(`Quantized to step size (${qtyStep})`);
  }
  
  const finalNotional = quantizedQty * entryPrice;
  const positionPercent = (finalNotional / accountEquity) * 100;
  
  return {
    quantity: quantizedQty,
    notional: finalNotional,
    riskAmount,
    positionPercent,
    adjustments
  };
}

// Kelly Criterion position sizing (advanced)
export function calculateKellySize(params: {
  winRate: number;           // e.g., 0.6 for 60% win rate
  avgWin: number;            // average win amount
  avgLoss: number;           // average loss amount
  accountEquity: number;
  entryPrice: number;
  maxKellyPercent?: number;  // cap Kelly at this % (e.g., 25%)
}): {
  kellyPercent: number;
  recommendedSize: number;
  notional: number;
  isCapped: boolean;
} {
  const { winRate, avgWin, avgLoss, accountEquity, entryPrice, maxKellyPercent = 25 } = params;
  
  // Kelly formula: f = (bp - q) / b
  // where b = odds (avgWin/avgLoss), p = win rate, q = loss rate
  const b = avgWin / avgLoss;
  const p = winRate;
  const q = 1 - winRate;
  
  let kellyPercent = ((b * p) - q) / b * 100;
  
  // Ensure positive and reasonable
  kellyPercent = Math.max(0, kellyPercent);
  
  const isCapped = kellyPercent > maxKellyPercent;
  if (isCapped) {
    kellyPercent = maxKellyPercent;
  }
  
  const notional = accountEquity * (kellyPercent / 100);
  const recommendedSize = notional / entryPrice;
  
  return {
    kellyPercent: Math.round(kellyPercent * 100) / 100,
    recommendedSize,
    notional,
    isCapped
  };
}

// Portfolio heat calculation (total risk across positions)
export function calculatePortfolioHeat(positions: Array<{
  symbol: string;
  notional: number;
  riskAmount: number;
  entryPrice: number;
  stopLoss: number;
}>): {
  totalHeat: number;        // total $ at risk
  heatPercentage: number;   // % of equity at risk
  maxRiskPosition: string;
  avgRiskPerPosition: number;
  recommendations: string[];
} {
  const totalRisk = positions.reduce((sum, pos) => sum + pos.riskAmount, 0);
  const totalNotional = positions.reduce((sum, pos) => sum + pos.notional, 0);
  
  // Find position with highest risk
  const maxRiskPos = positions.reduce((max, pos) => 
    pos.riskAmount > max.riskAmount ? pos : max
  );
  
  const avgRisk = totalRisk / positions.length;
  
  // Assuming we can derive equity from position sizing
  const estimatedEquity = totalNotional; // Simplified
  const heatPercentage = (totalRisk / estimatedEquity) * 100;
  
  const recommendations: string[] = [];
  
  if (heatPercentage > 3) {
    recommendations.push('Portfolio heat >3% - consider reducing position sizes');
  }
  if (maxRiskPos.riskAmount > totalRisk * 0.4) {
    recommendations.push(`Position ${maxRiskPos.symbol} represents >40% of total risk`);
  }
  if (positions.length > 10) {
    recommendations.push('High number of positions - consider consolidation');
  }
  
  return {
    totalHeat: Math.round(totalRisk * 100) / 100,
    heatPercentage: Math.round(heatPercentage * 100) / 100,
    maxRiskPosition: maxRiskPos.symbol,
    avgRiskPerPosition: Math.round(avgRisk * 100) / 100,
    recommendations
  };
}
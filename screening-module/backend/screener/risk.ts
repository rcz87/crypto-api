// ATR-based Risk Management and Position Sizing
// Professional risk calculation with dynamic position sizing

import type { Candle } from './indicators.pro';
import type { ProIndicators } from './indicators.pro';

export type RiskParams = {
  accountEquity: number;     // e.g., 10000 USDT
  riskPerTradePct: number;   // e.g., 0.5 → 0.5% risk per trade
  atrSLMult: number;         // e.g., 1.5 × ATR for stop loss
  maxPositionPct: number;    // e.g., 10% max position size
};

export type RiskCalculation = {
  positionSize: number;      // USDT value
  stopLoss: number;          // Price level
  riskAmount: number;        // USDT at risk
  riskRewardRatio: number;   // R:R ratio
  atrBasedSL: boolean;       // Whether SL is ATR-based
  sizeLimit: 'risk' | 'maxPosition' | 'atr'; // What limited the size
};

export function computeRisk(
  candles: Candle[], 
  ind: ProIndicators, 
  params: RiskParams,
  entryPrice: number,
  isLong: boolean = true
): RiskCalculation {
  
  const { accountEquity, riskPerTradePct, atrSLMult, maxPositionPct } = params;
  const atr = ind.atr14 ?? 0;
  const lastClose = candles[candles.length - 1]?.close ?? entryPrice;
  
  // Calculate ATR-based stop loss
  const atrDistance = atr * atrSLMult;
  const stopLoss = isLong ? 
    entryPrice - atrDistance : 
    entryPrice + atrDistance;
  
  // Risk per trade in USDT
  const maxRiskAmount = accountEquity * (riskPerTradePct / 100);
  
  // Distance to stop loss in USDT per unit
  const slDistance = Math.abs(entryPrice - stopLoss);
  
  // Position size based on risk (Risk Amount / SL Distance)
  const riskBasedSize = slDistance > 0 ? maxRiskAmount / slDistance : 0;
  
  // Maximum position size based on equity percentage
  const maxPositionSize = accountEquity * (maxPositionPct / 100);
  
  // ATR-adjusted maximum size (for very low volatility situations)
  const atrAdjustedMaxSize = atr > 0 ? 
    Math.min(maxPositionSize, accountEquity * 0.02 / (atr / lastClose)) : 
    maxPositionSize;
  
  // Final position size (take the minimum of all constraints)
  let finalSize = Math.min(riskBasedSize, maxPositionSize, atrAdjustedMaxSize);
  let sizeLimit: 'risk' | 'maxPosition' | 'atr' = 'risk';
  
  if (finalSize === maxPositionSize) {
    sizeLimit = 'maxPosition';
  } else if (finalSize === atrAdjustedMaxSize && atrAdjustedMaxSize < riskBasedSize) {
    sizeLimit = 'atr';
  }
  
  // Ensure minimum viable position size
  const minPositionSize = 10; // Minimum $10 position
  finalSize = Math.max(finalSize, minPositionSize);
  
  // Calculate actual risk amount with final position size
  const actualRiskAmount = finalSize * slDistance;
  
  // Calculate risk-reward ratio (assume 1:2 default target)
  const defaultTarget = isLong ? 
    entryPrice + (atrDistance * 2) : 
    entryPrice - (atrDistance * 2);
  const targetDistance = Math.abs(defaultTarget - entryPrice);
  const riskRewardRatio = slDistance > 0 ? targetDistance / slDistance : 1;
  
  return {
    positionSize: Math.round(finalSize * 100) / 100,
    stopLoss: Math.round(stopLoss * 10000) / 10000,
    riskAmount: Math.round(actualRiskAmount * 100) / 100,
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    atrBasedSL: atr > 0,
    sizeLimit
  };
}

// Position sizing for multiple strategies
export function calculatePortfolioRisk(
  positions: Array<{ symbol: string; riskCalc: RiskCalculation }>,
  maxPortfolioRisk: number = 2.0 // 2% max portfolio risk
): {
  totalRisk: number;
  riskUtilization: number;
  recommendations: string[];
} {
  const totalRisk = positions.reduce((sum, pos) => sum + pos.riskCalc.riskAmount, 0);
  const riskUtilization = (totalRisk / maxPortfolioRisk) * 100;
  
  const recommendations: string[] = [];
  
  if (riskUtilization > 100) {
    recommendations.push('Portfolio risk exceeded - reduce position sizes');
  } else if (riskUtilization > 80) {
    recommendations.push('High portfolio risk - monitor closely');
  } else if (riskUtilization < 20) {
    recommendations.push('Low portfolio utilization - consider additional opportunities');
  }
  
  // Check for concentration risk
  const maxSingleRisk = Math.max(...positions.map(p => p.riskCalc.riskAmount));
  if (maxSingleRisk > totalRisk * 0.5) {
    recommendations.push('Single position concentration risk detected');
  }
  
  return {
    totalRisk: Math.round(totalRisk * 100) / 100,
    riskUtilization: Math.round(riskUtilization * 100) / 100,
    recommendations
  };
}

// Market condition risk adjustments
export function adjustRiskForVolatility(
  baseRisk: RiskParams,
  atrPct: number, // ATR as percentage of price
  adx: number
): RiskParams {
  let riskMultiplier = 1.0;
  let slMultiplier = 1.0;
  
  // Adjust for volatility (ATR%)
  if (atrPct > 3.0) {
    // High volatility - reduce risk, wider stops
    riskMultiplier = 0.7;
    slMultiplier = 1.3;
  } else if (atrPct < 1.0) {
    // Low volatility - can take slightly more risk, tighter stops
    riskMultiplier = 1.2;
    slMultiplier = 0.8;
  }
  
  // Adjust for trend strength (ADX)
  if (adx > 30) {
    // Strong trend - can risk slightly more
    riskMultiplier *= 1.1;
  } else if (adx < 15) {
    // Weak trend - reduce risk
    riskMultiplier *= 0.9;
  }
  
  return {
    ...baseRisk,
    riskPerTradePct: baseRisk.riskPerTradePct * riskMultiplier,
    atrSLMult: baseRisk.atrSLMult * slMultiplier
  };
}
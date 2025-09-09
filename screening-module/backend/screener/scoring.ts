// Enhanced Scoring System with Configuration-based Weights
import { ConfluenceResult, ScreeningLayers } from "../../shared/schemas";
import { layerWeights, thresholds } from "./config";

function clamp(n: number, min: number, max: number) { 
  return Math.max(min, Math.min(max, n)); 
}

// Score from SMC analysis
function scoreFromSMC(layers: ScreeningLayers): number {
  const smc = layers.smc;
  let base = 0;
  
  if (smc.bias === "bullish") base += 10;
  else if (smc.bias === "bearish") base -= 10;
  
  // Apply strength multiplier (0-10 scale)
  base *= (1 + (smc.strength || 0) / 10);
  
  return clamp(base, -30, 30);
}

// Score from technical indicators (RSI, EMA, MACD, ATR, ADX)
function scoreFromIndicators(layers: ScreeningLayers): number {
  const ind = layers.indicators;
  if (!ind) return 0;
  
  let score = 0;
  
  // EMA trend scoring
  if (ind.emaTrend === "bullish") score += 6;
  else if (ind.emaTrend === "bearish") score -= 6;
  else if (ind.emaTrend === "mixed") score += 1; // slight uncertainty bonus
  
  // RSI scoring with nuanced zones
  if (typeof ind.rsi === "number") {
    if (ind.rsi > 55 && ind.rsi < 70) score += 4; // healthy momentum
    else if (ind.rsi >= 70) score -= 3; // overbought warning
    else if (ind.rsi < 45 && ind.rsi > 30) score -= 4; // weak momentum
    else if (ind.rsi <= 30) score += 3; // oversold bounce potential
  }
  
  // MACD scoring
  if (ind.macd?.hist && ind.macd?.macd) {
    if (ind.macd.hist > 0 && ind.macd.macd > 0) score += 3; // bullish momentum
    else if (ind.macd.hist < 0 && ind.macd.macd < 0) score -= 3; // bearish momentum
  }
  
  // ADX trend strength scoring
  if (typeof ind.adx === "number") {
    if (ind.adx >= 25 && ind.adx <= 45) score += 4; // strong trending
    else if (ind.adx > 45) score += 2; // very strong trend
    else if (ind.adx < 15) score -= 2; // choppy/sideways
  }
  
  // ATR volatility consideration (higher ATR = higher risk)
  if (typeof ind.atr === "number" && ind.atr > 0) {
    // Normalize ATR relative to price for risk assessment
    // This is a simplified approach - in practice you'd compare to historical ATR
    if (ind.atr > 5) score -= 1; // high volatility penalty
  }
  
  return clamp(score, -20, 20);
}

// Score from derivatives data (funding, OI)
function scoreFromDerivatives(layers: ScreeningLayers): number {
  const der = layers.derivatives;
  if (!der) return 0;
  
  let score = 0;
  
  // Open Interest change analysis
  if (typeof der.oiChangePct === "number") {
    if (der.oiChangePct > 1.5) score += 4; // position build-up
    else if (der.oiChangePct < -1.5) score -= 4; // position unwind
    else if (Math.abs(der.oiChangePct) < 0.5) score -= 1; // stagnant interest
  }
  
  // Funding rate analysis (contrarian approach)
  if (typeof der.fundingRate === "number") {
    // Very positive funding may indicate overheated longs
    if (der.fundingRate > 0.05) score -= 2;
    else if (der.fundingRate > 0.01) score -= 1;
    // Negative funding may indicate oversold
    else if (der.fundingRate < -0.01) score += 2;
  }
  
  // Premium analysis
  if (typeof der.premium === "number") {
    if (Math.abs(der.premium) > 0.002) { // >0.2% premium/discount
      if (der.premium > 0) score -= 1; // futures premium warning
      else score += 1; // futures discount opportunity
    }
  }
  
  return clamp(score, -15, 15);
}

// Main aggregation function with weighted scoring
export function aggregateConfluence(layers: ScreeningLayers): ConfluenceResult {
  // Calculate weighted scores
  const smcScore = scoreFromSMC(layers) * layerWeights.smc;
  const indScore = scoreFromIndicators(layers) * layerWeights.indicators;
  const derScore = scoreFromDerivatives(layers) * layerWeights.derivatives;

  // Total raw score (typical range: ~[-30, +30] depending on weights)
  const totalScore = smcScore + indScore + derScore;
  
  // Normalize to 0-100 scale
  const maxPossibleScore = 30 * layerWeights.smc + 20 * layerWeights.indicators + 15 * layerWeights.derivatives;
  const normalized = clamp(
    Math.round(((totalScore + maxPossibleScore) / (2 * maxPossibleScore)) * 100), 
    0, 100
  );

  // Determine signal label based on thresholds
  let label: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (normalized >= thresholds.buy) label = "BUY";
  else if (normalized <= thresholds.sell) label = "SELL";

  // Calculate confidence based on distance from neutral (50)
  const confidence = Math.min(100, Math.abs(normalized - 50) * 2);
  
  // Risk assessment
  const riskLevel: "low" | "medium" | "high" = 
    (normalized >= 70 || normalized <= 30) && confidence > 60 ? "low" : 
    confidence > 40 ? "medium" : "high";

  // Generate detailed summary
  const summary = `SMC:${Math.round(smcScore)} IND:${Math.round(indScore)} DER:${Math.round(derScore)} → ${normalized}`;

  return {
    totalScore,
    normalizedScore: normalized,
    label,
    confidence,
    riskLevel,
    layers,
    summary
  };
}

// Helper function for backtesting and analysis
export function getScoreBreakdown(layers: ScreeningLayers) {
  return {
    smc: scoreFromSMC(layers),
    indicators: scoreFromIndicators(layers),
    derivatives: scoreFromDerivatives(layers),
    weights: layerWeights
  };
}
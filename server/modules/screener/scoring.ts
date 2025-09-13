/**
 * 8-Layer Confluence Scoring System
 * Mengagregasi semua analisis menjadi skor akhir dengan rekomendasi BUY/SELL/HOLD
 */

import type { SmcSignal } from './smc.js';
import type { LayerScore, ScreeningLayers } from '../../../shared/schema.js';

export type ConfluenceResult = {
  totalScore: number;
  normalizedScore: number; // 0-100 scale
  label: "BUY" | "SELL" | "HOLD";
  confidence: number;
  layers: ScreeningLayers;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
};

/**
 * Konversi SMC signal ke layer score
 */
export function scoreFromSMC(smc: SmcSignal): LayerScore {
  let score = 0;
  
  if (smc.bias === "bullish") {
    score = Math.round(24 * smc.confidence);
  } else if (smc.bias === "bearish") {
    score = Math.round(-24 * smc.confidence);
  }
  
  // Adjust berdasarkan strength (1-10)
  const strengthMultiplier = smc.strength / 10;
  score = Math.round(score * strengthMultiplier);
  
  // Clamp dalam range -30 sampai +30
  score = Math.max(-30, Math.min(30, score));
  
  return {
    score,
    reasons: smc.reasons,
    confidence: smc.confidence,
  };
}

/**
 * Score dari Price Action analysis
 */
export function scoreFromPriceAction(
  higherHighs: boolean,
  higherLows: boolean,
  trendStrength: number
): LayerScore {
  let score = 0;
  const reasons: string[] = [];
  
  // Trend structure analysis - ensure score is always a number
  const validTrendStrength = Math.abs(trendStrength || 0);
  
  if (higherHighs && higherLows) {
    score = Math.round(15 * validTrendStrength);
    reasons.push("Strong uptrend structure");
  } else if (!higherHighs && !higherLows) {
    score = Math.round(-15 * validTrendStrength);
    reasons.push("Strong downtrend structure");
  } else {
    score = 0;
    reasons.push("Sideways/choppy structure");
  }
  
  return { 
    score, 
    reasons, 
    confidence: Math.max(0.1, Math.abs(trendStrength || 0)) // Never null, minimum 0.1
  };
}

/**
 * Score dari EMA analysis
 */
export function scoreFromEMA(emaData: {
  score: number;
  reasons: string[];
  trend: 'bullish' | 'bearish' | 'neutral';
}): LayerScore {
  // EMA layer maksimal ±8 points
  let score = Math.max(-8, Math.min(8, emaData.score));
  
  return {
    score,
    reasons: emaData.reasons,
    confidence: Math.abs(score) / 8,
  };
}

/**
 * Score dari RSI/MACD momentum
 */
export function scoreFromMomentum(momentumData: {
  score: number;
  reasons: string[];
}): LayerScore {
  // Momentum layer maksimal ±6 points
  let score = Math.max(-6, Math.min(6, momentumData.score));
  
  return {
    score,
    reasons: momentumData.reasons,
    confidence: Math.abs(score) / 6,
  };
}

/**
 * Score dari Funding Rate analysis
 */
export function scoreFromFunding(
  fundingRate: number,
  nextFundingRate: number,
  premium: number
): LayerScore {
  let score = 0;
  const reasons: string[] = [];
  
  // Ekstrim funding rate biasanya bearish signal
  if (fundingRate > 0.01) { // > 1% funding rate
    score = -5;
    reasons.push("Extremely high funding rate - bearish");
  } else if (fundingRate < -0.01) { // < -1% funding rate
    score = 5;
    reasons.push("Extremely negative funding rate - bullish");
  } else if (fundingRate > 0.005) { // > 0.5%
    score = -3;
    reasons.push("High funding rate");
  } else if (fundingRate < -0.005) { // < -0.5%
    score = 3;
    reasons.push("Negative funding rate");
  }
  
  // Premium analysis
  if (Math.abs(premium) > 0.002) { // > 0.2% premium
    if (premium > 0) {
      score -= 1;
      reasons.push("High futures premium");
    } else {
      score += 1;
      reasons.push("Futures trading at discount");
    }
  }
  
  return {
    score,
    reasons,
    confidence: Math.min(Math.abs(fundingRate) * 100, 1),
  };
}

/**
 * Score dari Open Interest analysis
 */
export function scoreFromOI(
  oiChange24h: number,
  priceChange24h: number,
  oiPressureRatio: number
): LayerScore {
  let score = 0;
  const reasons: string[] = [];
  
  // OI dan price correlation
  if (oiChange24h > 0.1 && priceChange24h > 0.05) { // OI up, price up
    score = 5;
    reasons.push("Strong buying with OI increase");
  } else if (oiChange24h > 0.1 && priceChange24h < -0.05) { // OI up, price down
    score = -3;
    reasons.push("Heavy selling despite OI increase");
  } else if (oiChange24h < -0.1 && priceChange24h > 0.05) { // OI down, price up
    score = -2;
    reasons.push("Price up but OI declining");
  } else if (oiChange24h < -0.1 && priceChange24h < -0.05) { // OI down, price down
    score = 3;
    reasons.push("Healthy correction with OI decline");
  }
  
  // OI pressure ratio
  if (oiPressureRatio > 0.7) {
    score -= 1;
    reasons.push("High OI pressure");
  } else if (oiPressureRatio < 0.3) {
    score += 1;
    reasons.push("Low OI pressure");
  }
  
  return {
    score: Math.max(-5, Math.min(5, score)),
    reasons,
    confidence: Math.abs(oiChange24h),
  };
}

/**
 * Score dari CVD (Cumulative Volume Delta) analysis
 */
export function scoreFromCVD(
  cvdTrend: 'bullish' | 'bearish' | 'neutral',
  divergenceStrength: number,
  volumePressure: number
): LayerScore {
  let score = 0;
  const reasons: string[] = [];
  
  // CVD trend scoring
  if (cvdTrend === 'bullish') {
    score = Math.round(10 * Math.min(divergenceStrength, 1));
    reasons.push("Bullish CVD trend");
  } else if (cvdTrend === 'bearish') {
    score = Math.round(-10 * Math.min(divergenceStrength, 1));
    reasons.push("Bearish CVD trend");
  }
  
  // Volume pressure adjustment
  if (volumePressure > 0.8) {
    const adjustment = cvdTrend === 'bullish' ? 2 : -2;
    score += adjustment;
    reasons.push("High volume pressure");
  }
  
  return {
    score: Math.max(-10, Math.min(10, score)),
    reasons,
    confidence: divergenceStrength,
  };
}

/**
 * Score dari Fibonacci analysis
 */
export function scoreFromFibonacci(
  currentPrice: number,
  fibLevels: { level: number; type: 'support' | 'resistance' }[],
  nearestLevel: { level: number; distance: number; type: 'support' | 'resistance' }
): LayerScore {
  let score = 0;
  const reasons: string[] = [];
  
  // Proximity to key Fibonacci levels
  if (nearestLevel.distance < 0.01) { // Within 1% of Fib level
    if (nearestLevel.type === 'support') {
      score = 4;
      reasons.push(`Near Fibonacci support at ${nearestLevel.level.toFixed(2)}`);
    } else {
      score = -4;
      reasons.push(`Near Fibonacci resistance at ${nearestLevel.level.toFixed(2)}`);
    }
  } else if (nearestLevel.distance < 0.02) { // Within 2%
    if (nearestLevel.type === 'support') {
      score = 2;
      reasons.push("Approaching Fibonacci support");
    } else {
      score = -2;
      reasons.push("Approaching Fibonacci resistance");
    }
  }
  
  return {
    score,
    reasons,
    confidence: Math.max(0.1, 1 - Math.min(nearestLevel.distance || 1, 1)), // Never null
  };
}

/**
 * Agregasi semua layer scores menjadi hasil final
 */
export function aggregateScores(layers: ScreeningLayers): ConfluenceResult {
  // Hitung total raw score
  const totalScore = Object.values(layers).reduce((sum, layer) => {
    return sum + (layer?.score || 0);
  }, 0);
  
  // Normalisasi ke 0-100 scale
  // Range total: -87 sampai +87 (theoretical max dari semua layers)
  const normalizedScore = Math.round(((totalScore + 87) / 174) * 100);
  
  // Tentukan label berdasarkan normalized score
  let label: "BUY" | "SELL" | "HOLD";
  if (normalizedScore >= 70) {
    label = "BUY";
  } else if (normalizedScore <= 30) {
    label = "SELL";
  } else {
    label = "HOLD";
  }
  
  // Hitung confidence berdasarkan layer confidence dan score strength
  const validLayers = Object.values(layers).filter(layer => layer?.confidence !== undefined);
  const avgLayerConfidence = validLayers.reduce((sum, layer) => sum + (layer?.confidence || 0), 0) / validLayers.length;
  const scoreStrength = Math.abs(totalScore) / 87; // Normalize by max possible score
  const confidence = Math.max(0.1, Math.min((avgLayerConfidence + scoreStrength) / 2, 1)); // Minimum 10% confidence
  
  // Generate summary
  const activeLayers = Object.entries(layers).filter(([_, layer]) => layer && Math.abs(layer.score) > 1);
  const bullishLayers = activeLayers.filter(([_, layer]) => layer!.score > 0);
  const bearishLayers = activeLayers.filter(([_, layer]) => layer!.score < 0);
  
  let summary = "";
  if (label === "BUY") {
    summary = `Strong bullish confluence (${bullishLayers.length}/${activeLayers.length} layers bullish)`;
  } else if (label === "SELL") {
    summary = `Strong bearish confluence (${bearishLayers.length}/${activeLayers.length} layers bearish)`;
  } else {
    summary = `Mixed signals - ${bullishLayers.length} bullish, ${bearishLayers.length} bearish layers`;
  }
  
  // Risk assessment
  let riskLevel: 'low' | 'medium' | 'high';
  if (confidence > 0.7 && (normalizedScore >= 75 || normalizedScore <= 25)) {
    riskLevel = 'low';
  } else if (confidence > 0.5) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }
  
  return {
    totalScore,
    normalizedScore,
    label,
    confidence,
    layers,
    summary,
    riskLevel,
  };
}

/**
 * Helper function untuk generate trading levels
 */
export function generateTradingLevels(
  currentPrice: number,
  confluence: ConfluenceResult,
  atrValue?: number
): {
  entry: number;
  tp: number[];
  sl: number;
  riskReward: number;
} {
  // Ensure we have valid inputs
  if (!currentPrice || currentPrice <= 0) {
    currentPrice = 240; // Fallback price for SOL
  }
  
  const atr = atrValue && atrValue > 0 ? atrValue : currentPrice * 0.02; // Default 2% ATR
  
  let entry = currentPrice;
  let tp: number[] = [];
  let sl: number;
  let riskReward: number;
  
  if (confluence.label === "BUY") {
    // For bullish signals
    entry = currentPrice;
    sl = currentPrice - (atr * 1.5); // 1.5x ATR stop loss
    tp = [
      currentPrice + (atr * 2), // 1:1.33 R/R
      currentPrice + (atr * 3), // 1:2 R/R
      currentPrice + (atr * 4.5) // 1:3 R/R
    ];
    riskReward = Math.abs(tp[0] - entry) / Math.abs(entry - sl);
  } else if (confluence.label === "SELL") {
    // For bearish signals
    entry = currentPrice;
    sl = currentPrice + (atr * 1.5); // 1.5x ATR stop loss
    tp = [
      currentPrice - (atr * 2), // 1:1.33 R/R
      currentPrice - (atr * 3), // 1:2 R/R
      currentPrice - (atr * 4.5) // 1:3 R/R
    ];
    riskReward = Math.abs(entry - tp[0]) / Math.abs(sl - entry);
  } else {
    // For HOLD signals - neutral levels
    entry = currentPrice;
    sl = currentPrice - (atr * 1.5); // Conservative stop loss
    tp = [
      currentPrice + (atr * 1.5), // Conservative take profit
      currentPrice + (atr * 2.5),
      currentPrice + (atr * 3.5)
    ];
    riskReward = Math.abs(tp[0] - entry) / Math.abs(entry - sl);
  }
  
  // Ensure all values are valid numbers and properly formatted
  entry = Number(entry.toFixed(2));
  sl = Number(sl.toFixed(2));
  tp = tp.map(level => Number(level.toFixed(2)));
  riskReward = Number(riskReward.toFixed(2));
  
  return {
    entry,
    tp,
    sl,
    riskReward
  };
}
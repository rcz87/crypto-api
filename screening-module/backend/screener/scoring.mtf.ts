// Multi-Timeframe Scoring System
// Combines regime-aware dynamic scoring with HTF bias modulation

import type { ScreeningLayers } from '../../shared/schemas';
import { aggregateDynamic } from './scoring.dynamic';
import { computeHTFBias, applyHTFModulation, getHTFConfidence, getHTFSignalQuality, type Candle } from './mtf';
import { logger } from './logger';

export type MTFConfluenceResult = {
  // Base dynamic scoring fields
  totalScore: number;
  normalizedScore: number;
  label: "BUY" | "SELL" | "HOLD";
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  layers: ScreeningLayers;
  summary: string;
  regime: 'trending' | 'ranging' | 'volatile' | 'quiet';
  regimeReason: string;
  dynamicThresholds: { buy: number; sell: number };
  regimeAdjustment: number;
  
  // MTF-specific fields
  htf: {
    h4: { bias: 'bullish'|'bearish'|'neutral'; strength: number; emaTrend: 'bullish'|'bearish'|'mixed'|'neutral' };
    h1: { bias: 'bullish'|'bearish'|'neutral'; strength: number; emaTrend: 'bullish'|'bearish'|'mixed'|'neutral' };
    combined: { bias: 'bullish'|'bearish'|'neutral'; strength: number };
    notes: string[];
    confidence: number;
    quality: 'high' | 'medium' | 'low';
  };
  mtf: {
    appliedTilt: number;
    agree: boolean;
    disagree: boolean;
    reason: string;
    originalScore: number;
    htfModulatedScore: number;
  };
};

export function aggregateMTF(
  layers: ScreeningLayers, 
  ltfCandles: Candle[], 
  h1Candles: Candle[], 
  h4Candles: Candle[]
): MTFConfluenceResult {
  
  try {
    logger.debug('Starting MTF aggregation', {
      ltfCandles: ltfCandles.length,
      h1Candles: h1Candles.length,
      h4Candles: h4Candles.length
    });

    // 1) Get base scoring using regime-aware dynamic scoring
    const base = aggregateDynamic(layers, ltfCandles);
    logger.debug('Base dynamic scoring completed', {
      score: base.normalizedScore,
      label: base.label,
      regime: base.regime
    });

    // 2) Compute HTF bias from H4 and H1 timeframes
    const htfBias = computeHTFBias({ h4: h4Candles, h1: h1Candles });
    const htfConfidence = getHTFConfidence(htfBias);
    const htfQuality = getHTFSignalQuality(htfBias);
    
    logger.debug('HTF bias computed', {
      h4Bias: htfBias.h4.bias,
      h1Bias: htfBias.h1.bias,
      combinedBias: htfBias.combined.bias,
      strength: htfBias.combined.strength,
      confidence: htfConfidence,
      quality: htfQuality
    });

    // 3) Apply HTF modulation to base score using LTF SMC bias
    const ltfBias = layers.smc?.bias || 'neutral';
    const modulation = applyHTFModulation(base.normalizedScore, ltfBias, htfBias);
    
    logger.debug('HTF modulation applied', {
      ltfBias,
      originalScore: base.normalizedScore,
      adjustedScore: modulation.adjusted,
      tilt: modulation.tilt,
      agree: modulation.agree,
      disagree: modulation.disagree
    });

    // 4) Determine final label using regime-aware thresholds
    let finalLabel: 'BUY'|'SELL'|'HOLD' = 'HOLD';
    const buyThreshold = base.dynamicThresholds?.buy ?? 65;
    const sellThreshold = base.dynamicThresholds?.sell ?? 35;
    
    if (modulation.adjusted >= buyThreshold) {
      finalLabel = 'BUY';
    } else if (modulation.adjusted <= sellThreshold) {
      finalLabel = 'SELL';
    }

    // 5) Adjust overall confidence based on HTF quality
    let finalConfidence = base.confidence;
    
    // Boost confidence when HTF supports the signal
    if (modulation.agree && htfQuality === 'high') {
      finalConfidence = Math.min(1.0, finalConfidence * 1.15);
    } else if (modulation.agree && htfQuality === 'medium') {
      finalConfidence = Math.min(1.0, finalConfidence * 1.08);
    }
    
    // Reduce confidence when HTF contradicts
    if (modulation.disagree) {
      finalConfidence = Math.max(0.1, finalConfidence * 0.85);
    }
    
    // Slightly boost confidence for strong HTF alignment
    if (htfBias.combined.strength >= 8 && modulation.agree) {
      finalConfidence = Math.min(1.0, finalConfidence * 1.05);
    }

    // 6) Enhance summary with MTF context
    const htfIndicator = htfBias.combined.bias === 'bullish' ? '📈' :
                        htfBias.combined.bias === 'bearish' ? '📉' : '➡️';
    const mtfStatus = modulation.agree ? '✅' : modulation.disagree ? '❌' : '➖';
    
    const enhancedSummary = `${base.summary} | HTF:${htfIndicator}${htfBias.combined.bias.slice(0,4)} ${mtfStatus}${modulation.tilt}`;

    // 7) Adjust risk level based on HTF alignment
    let finalRiskLevel: 'low' | 'medium' | 'high' = base.riskLevel;
    
    if (modulation.disagree && htfQuality === 'high') {
      // Strong HTF disagreement increases risk
      finalRiskLevel = finalRiskLevel === 'low' ? 'medium' : 'high';
    } else if (modulation.agree && htfQuality === 'high' && finalConfidence > 0.8) {
      // Strong HTF agreement with high confidence reduces risk
      finalRiskLevel = finalRiskLevel === 'high' ? 'medium' : finalRiskLevel;
    }

    const result: MTFConfluenceResult = {
      // Base fields (modified)
      totalScore: base.totalScore,
      normalizedScore: Math.round(modulation.adjusted),
      label: finalLabel,
      confidence: Math.round(finalConfidence * 100) / 100,
      riskLevel: finalRiskLevel,
      layers: base.layers,
      summary: enhancedSummary,
      regime: base.regime,
      regimeReason: base.regimeReason,
      dynamicThresholds: base.dynamicThresholds,
      regimeAdjustment: base.regimeAdjustment,
      
      // MTF-specific fields
      htf: {
        h4: htfBias.h4,
        h1: htfBias.h1,
        combined: htfBias.combined,
        notes: htfBias.notes,
        confidence: Math.round(htfConfidence * 100) / 100,
        quality: htfQuality
      },
      mtf: {
        appliedTilt: modulation.tilt,
        agree: modulation.agree,
        disagree: modulation.disagree,
        reason: modulation.reason,
        originalScore: base.normalizedScore,
        htfModulatedScore: Math.round(modulation.adjusted)
      }
    };

    logger.debug('MTF aggregation completed', {
      finalScore: result.normalizedScore,
      finalLabel: result.label,
      mtfTilt: result.mtf.appliedTilt,
      htfQuality: result.htf.quality
    });

    return result;

  } catch (error) {
    logger.error('MTF aggregation failed, falling back to dynamic scoring', error);
    
    // Fallback to dynamic scoring if MTF fails
    const fallback = aggregateDynamic(layers, ltfCandles);
    return {
      ...fallback,
      htf: {
        h4: { bias: 'neutral' as const, strength: 0, emaTrend: 'neutral' as const },
        h1: { bias: 'neutral' as const, strength: 0, emaTrend: 'neutral' as const },
        combined: { bias: 'neutral' as const, strength: 0 },
        notes: ['HTF analysis failed - fallback to LTF only'],
        confidence: 0,
        quality: 'low' as const
      },
      mtf: {
        appliedTilt: 0,
        agree: false,
        disagree: false,
        reason: 'MTF analysis unavailable',
        originalScore: fallback.normalizedScore,
        htfModulatedScore: fallback.normalizedScore
      }
    };
  }
}

// Utility function to assess MTF signal strength
export function assessMTFSignalStrength(result: MTFConfluenceResult): {
  strength: 'very_strong' | 'strong' | 'moderate' | 'weak';
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;
  
  // HTF bias strength
  if (result.htf.combined.strength >= 8) {
    score += 3;
    reasons.push('Very strong HTF bias');
  } else if (result.htf.combined.strength >= 6) {
    score += 2;
    reasons.push('Strong HTF bias');
  } else if (result.htf.combined.strength >= 4) {
    score += 1;
    reasons.push('Moderate HTF bias');
  }
  
  // MTF alignment
  if (result.mtf.agree) {
    score += 2;
    reasons.push('LTF-HTF alignment confirmed');
  } else if (result.mtf.disagree) {
    score -= 2;
    reasons.push('LTF-HTF divergence detected');
  }
  
  // Confidence level
  if (result.confidence >= 0.8) {
    score += 2;
    reasons.push('High confidence signal');
  } else if (result.confidence >= 0.6) {
    score += 1;
    reasons.push('Medium confidence signal');
  }
  
  // HTF quality
  if (result.htf.quality === 'high') {
    score += 1;
    reasons.push('High quality HTF analysis');
  }
  
  // Determine overall strength
  let strength: 'very_strong' | 'strong' | 'moderate' | 'weak';
  if (score >= 7) strength = 'very_strong';
  else if (score >= 5) strength = 'strong';
  else if (score >= 3) strength = 'moderate';
  else strength = 'weak';
  
  return { strength, reasons };
}
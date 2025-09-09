// Dynamic Scoring System with Regime-Aware Adjustments
// Automatically adapts scoring based on market regime detection

import type { ScreeningLayers } from '../../shared/schemas';
import { aggregateConfluence as baseAggregate } from './scoring';
import { computeProIndicators } from './indicators.pro';
import { detectRegime } from './regime';
import { logger } from './logger';

export type DynamicConfluenceResult = {
  totalScore: number;
  normalizedScore: number;
  label: "BUY" | "SELL" | "HOLD";
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  layers: ScreeningLayers;
  summary: string;
  
  // Enhanced regime-aware fields
  regime: 'trending' | 'ranging' | 'volatile' | 'quiet';
  regimeReason: string;
  dynamicThresholds: { buy: number; sell: number };
  regimeAdjustment: number; // Score adjustment applied
  proIndicators?: {
    atr14: number | null;
    adx14: number | null;
    bbWidth: number | null;
    rsi14: number | null;
  };
};

export function aggregateDynamic(
  layers: ScreeningLayers, 
  candles: { open: number; high: number; low: number; close: number; volume: number }[]
): DynamicConfluenceResult {
  
  try {
    // 1) Compute professional indicators
    const indPro = computeProIndicators(candles);
    logger.debug('Pro indicators computed', { 
      atr14: indPro.atr14, 
      adx14: indPro.adx14, 
      emaTrend: indPro.emaTrend 
    });

    // 2) Detect market regime
    const regimeInfo = detectRegime(candles, indPro);
    logger.debug('Regime detected', regimeInfo);

    // 3) Use base aggregator with standard weights
    const base = baseAggregate(layers);

    // 4) Apply regime-aware score adjustments (subtle tilts)
    let regimeAdjustment = 0;
    let adjusted = base.normalizedScore;

    // Trending market adjustments
    if (regimeInfo.regime === 'trending') {
      if (layers.smc?.bias === 'bullish' && indPro.emaTrend === 'bullish') {
        regimeAdjustment = +3;
        adjusted = Math.min(100, adjusted + 3);
      } else if (layers.smc?.bias === 'bearish' && indPro.emaTrend === 'bearish') {
        regimeAdjustment = +3;
        adjusted = Math.min(100, adjusted + 3);
      }
    }

    // Ranging market adjustments (mean reversion focus)
    if (regimeInfo.regime === 'ranging') {
      if (indPro.rsi14 && indPro.rsi14 > 70) {
        regimeAdjustment = -2;
        adjusted = Math.max(0, adjusted - 2);
      } else if (indPro.rsi14 && indPro.rsi14 < 30) {
        regimeAdjustment = +2;
        adjusted = Math.min(100, adjusted + 2);
      }
    }

    // Volatile market adjustments (reduce confidence)
    if (regimeInfo.regime === 'volatile') {
      regimeAdjustment = -1;
      adjusted = Math.max(0, adjusted - 1);
    }

    // Quiet market adjustments (neutral bias)
    if (regimeInfo.regime === 'quiet') {
      // Pull scores towards neutral (50)
      if (adjusted > 60) {
        regimeAdjustment = -1;
        adjusted = Math.max(50, adjusted - 1);
      } else if (adjusted < 40) {
        regimeAdjustment = +1;
        adjusted = Math.min(50, adjusted + 1);
      }
    }

    // 5) Apply dynamic thresholds for label determination
    let label: "BUY" | "SELL" | "HOLD" = "HOLD";
    if (adjusted >= regimeInfo.dynamicThresholds.buy) {
      label = "BUY";
    } else if (adjusted <= regimeInfo.dynamicThresholds.sell) {
      label = "SELL";
    }

    // 6) Adjust confidence based on regime certainty
    let adjustedConfidence = base.confidence;
    
    // High ADX = more confident in trend signals
    if (indPro.adx14 && indPro.adx14 > 25 && regimeInfo.regime === 'trending') {
      adjustedConfidence = Math.min(1.0, adjustedConfidence * 1.1);
    }
    
    // Low ADX in ranging = less confident
    if (indPro.adx14 && indPro.adx14 < 15 && regimeInfo.regime === 'ranging') {
      adjustedConfidence = Math.max(0.1, adjustedConfidence * 0.9);
    }
    
    // Volatile conditions = reduced confidence
    if (regimeInfo.regime === 'volatile') {
      adjustedConfidence = Math.max(0.1, adjustedConfidence * 0.85);
    }

    // 7) Enhanced summary with regime context
    const regimeContext = regimeInfo.regime === 'trending' ? '🔥 Trending' :
                         regimeInfo.regime === 'ranging' ? '📊 Ranging' :
                         regimeInfo.regime === 'volatile' ? '⚡ Volatile' : '😴 Quiet';
    
    const enhancedSummary = `${regimeContext} | ${base.summary} | Adj: ${regimeAdjustment >= 0 ? '+' : ''}${regimeAdjustment}`;

    // 8) Risk level considering regime
    let riskLevel: 'low' | 'medium' | 'high' = base.riskLevel;
    if (regimeInfo.regime === 'volatile') {
      riskLevel = riskLevel === 'low' ? 'medium' : 'high';
    } else if (regimeInfo.regime === 'trending' && adjustedConfidence > 0.7) {
      riskLevel = riskLevel === 'high' ? 'medium' : riskLevel;
    }

    const result: DynamicConfluenceResult = {
      ...base,
      normalizedScore: Math.round(adjusted),
      label,
      confidence: Math.round(adjustedConfidence * 100) / 100,
      riskLevel,
      summary: enhancedSummary,
      
      // Enhanced regime fields
      regime: regimeInfo.regime,
      regimeReason: regimeInfo.reason,
      dynamicThresholds: regimeInfo.dynamicThresholds,
      regimeAdjustment,
      proIndicators: {
        atr14: indPro.atr14,
        adx14: indPro.adx14,
        bbWidth: indPro.bb.widthPct,
        rsi14: indPro.rsi14
      }
    };

    logger.debug('Dynamic aggregation completed', {
      regime: result.regime,
      originalScore: base.normalizedScore,
      adjustedScore: result.normalizedScore,
      label: result.label,
      regimeAdjustment
    });

    return result;

  } catch (error) {
    logger.error('Dynamic aggregation failed, falling back to base', error);
    
    // Fallback to base aggregation
    const base = baseAggregate(layers);
    return {
      ...base,
      regime: 'ranging' as const,
      regimeReason: 'Fallback due to error',
      dynamicThresholds: { buy: 65, sell: 35 },
      regimeAdjustment: 0,
      proIndicators: {
        atr14: null,
        adx14: null,
        bbWidth: null,
        rsi14: null
      }
    };
  }
}

// Helper function to get regime-specific trading advice
export function getRegimeTradingAdvice(regime: 'trending' | 'ranging' | 'volatile' | 'quiet'): {
  strategy: string;
  timeframe: string;
  riskAdjustment: string;
} {
  switch (regime) {
    case 'trending':
      return {
        strategy: 'Trend following, breakout trades, momentum plays',
        timeframe: 'Medium to long-term holds (hours to days)',
        riskAdjustment: 'Standard risk, wider stops for trend continuation'
      };
      
    case 'ranging':
      return {
        strategy: 'Mean reversion, support/resistance trading, range scalping',
        timeframe: 'Short-term trades (minutes to hours)',
        riskAdjustment: 'Tighter stops, quick profit taking at levels'
      };
      
    case 'volatile':
      return {
        strategy: 'Reduced position sizes, avoid low-confidence signals',
        timeframe: 'Very short-term or wait for clearer conditions',
        riskAdjustment: 'Reduced risk per trade, wider stops to avoid noise'
      };
      
    case 'quiet':
      return {
        strategy: 'Range trading, patience for breakouts, accumulation',
        timeframe: 'Wait for volatility expansion or range trade',
        riskAdjustment: 'Standard risk with tight stops due to low volatility'
      };
      
    default:
      return {
        strategy: 'Balanced approach',
        timeframe: 'Adapt to conditions',
        riskAdjustment: 'Standard risk management'
      };
  }
}
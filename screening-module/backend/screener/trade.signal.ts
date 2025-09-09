// Trade Signal Composer — Combine Screening + Risk into tradable payload
// Professional signal generation for institutional trading

import { riskEngine, type RiskConfig, type ExchangeParams, type Candle } from './risk.engine';
import { logger } from './logger';

export type ScreenResult = {
  symbol: string;
  label: 'BUY'|'SELL'|'HOLD';
  score: number;               // normalized score 0..100
  summary: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  layers: any;
  // Enhanced MTF fields (if available)
  regime?: string;
  htf?: any;
  mtf?: any;
};

export type TradableSignal = {
  symbol: string;
  side: 'long'|'short'|'none';
  entry: number|null;
  sl: number|null;
  tp1: number|null;
  tp2: number|null;
  qty: number|null;
  notional: number|null;
  rr1: number|null;
  rr2: number|null;
  costs: { 
    fees: number; 
    slip: number; 
    spread: number;
    total: number;
  };
  meta: {
    score: number;
    label: 'BUY'|'SELL'|'HOLD';
    confidence: number;
    riskLevel: 'low' | 'medium' | 'high';
    valid: boolean;
    violations: string[];
    notes?: string;
    // Enhanced metadata
    regime?: string;
    htfBias?: string;
    mtfAlignment?: string;
  };
  timing: {
    created: number;
    expiry?: number;          // signal expiry timestamp
    priority: 'high' | 'medium' | 'low';
  };
};

export function composeTradableSignal(
  screen: ScreenResult, 
  candles: Candle[], 
  risk: RiskConfig, 
  exch: ExchangeParams
): TradableSignal {
  const timestamp = Date.now();
  
  try {
    logger.debug('Composing tradable signal', {
      symbol: screen.symbol,
      label: screen.label,
      score: screen.score
    });

    // Handle HOLD signals
    if (screen.label === 'HOLD') {
      return {
        symbol: screen.symbol,
        side: 'none',
        entry: null,
        sl: null,
        tp1: null,
        tp2: null,
        qty: null,
        notional: null,
        rr1: null,
        rr2: null,
        costs: { fees: 0, slip: 0, spread: 0, total: 0 },
        meta: {
          score: screen.score,
          label: screen.label,
          confidence: screen.confidence,
          riskLevel: screen.riskLevel,
          valid: false,
          violations: ['NON_TRADABLE: HOLD signal'],
          notes: screen.summary,
          regime: screen.regime,
          htfBias: screen.htf?.combined?.bias,
          mtfAlignment: screen.mtf?.agree ? 'aligned' : screen.mtf?.disagree ? 'divergent' : 'neutral'
        },
        timing: {
          created: timestamp,
          priority: 'low'
        }
      };
    }

    // Determine trade side
    const side = screen.label === 'BUY' ? 'long' : 'short';

    // Calculate risk-based position sizing and levels
    const riskOutput = riskEngine({ side, candles, risk, exch });

    // Calculate total costs
    const totalCosts = riskOutput.estFees + riskOutput.estSlippageCost + riskOutput.estSpreadCost;

    // Determine signal priority based on score and confidence
    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (screen.score >= 80 && screen.confidence >= 0.7) {
      priority = 'high';
    } else if (screen.score <= 40 || screen.confidence <= 0.4) {
      priority = 'low';
    }

    // Enhanced metadata compilation
    const metaNotes = [
      screen.summary,
      screen.regime ? `Regime: ${screen.regime}` : '',
      screen.htf?.combined?.bias ? `HTF: ${screen.htf.combined.bias}` : '',
      screen.mtf?.appliedTilt ? `MTF: ${screen.mtf.appliedTilt > 0 ? '+' : ''}${screen.mtf.appliedTilt}` : ''
    ].filter(Boolean).join(' | ');

    // Calculate signal expiry (based on timeframe and volatility)
    const baseExpiry = 4 * 60 * 60 * 1000; // 4 hours base
    let expiryAdjustment = 1.0;
    
    // Adjust expiry based on market regime
    if (screen.regime === 'volatile') {
      expiryAdjustment = 0.5; // Shorter expiry in volatile markets
    } else if (screen.regime === 'quiet') {
      expiryAdjustment = 1.5; // Longer expiry in quiet markets
    }
    
    const expiry = timestamp + (baseExpiry * expiryAdjustment);

    const signal: TradableSignal = {
      symbol: screen.symbol,
      side,
      entry: riskOutput.entry,
      sl: riskOutput.sl,
      tp1: riskOutput.tp1,
      tp2: riskOutput.tp2,
      qty: riskOutput.qty,
      notional: riskOutput.notional,
      rr1: riskOutput.rr1,
      rr2: riskOutput.rr2,
      costs: {
        fees: Math.round(riskOutput.estFees * 100) / 100,
        slip: Math.round(riskOutput.estSlippageCost * 100) / 100,
        spread: Math.round(riskOutput.estSpreadCost * 100) / 100,
        total: Math.round(totalCosts * 100) / 100
      },
      meta: {
        score: screen.score,
        label: screen.label,
        confidence: screen.confidence,
        riskLevel: screen.riskLevel,
        valid: riskOutput.valid,
        violations: riskOutput.violations,
        notes: metaNotes,
        regime: screen.regime,
        htfBias: screen.htf?.combined?.bias,
        mtfAlignment: screen.mtf?.agree ? 'aligned' : screen.mtf?.disagree ? 'divergent' : 'neutral'
      },
      timing: {
        created: timestamp,
        expiry,
        priority
      }
    };

    logger.debug('Tradable signal composed', {
      symbol: signal.symbol,
      side: signal.side,
      valid: signal.meta.valid,
      priority: signal.timing.priority,
      violations: signal.meta.violations.length
    });

    return signal;

  } catch (error) {
    logger.error('Failed to compose tradable signal', {
      symbol: screen.symbol,
      error: error.message
    });

    // Return error signal
    return {
      symbol: screen.symbol,
      side: 'none',
      entry: null,
      sl: null,
      tp1: null,
      tp2: null,
      qty: null,
      notional: null,
      rr1: null,
      rr2: null,
      costs: { fees: 0, slip: 0, spread: 0, total: 0 },
      meta: {
        score: screen.score,
        label: screen.label,
        confidence: 0,
        riskLevel: 'high',
        valid: false,
        violations: [`Signal composition failed: ${error.message}`],
        notes: screen.summary
      },
      timing: {
        created: timestamp,
        priority: 'low'
      }
    };
  }
}

// Batch signal composition for multiple symbols
export function composeBatchTradableSignals(
  screens: ScreenResult[],
  candleData: Map<string, Candle[]>, // symbol -> candles
  risk: RiskConfig,
  exch: ExchangeParams
): TradableSignal[] {
  return screens.map(screen => {
    const candles = candleData.get(screen.symbol) || [];
    if (candles.length === 0) {
      logger.warn(`No candle data for ${screen.symbol}`);
    }
    return composeTradableSignal(screen, candles, risk, exch);
  }).filter(signal => signal.meta.valid || signal.side !== 'none'); // Keep invalid signals for analysis
}

// Signal quality assessment
export function assessSignalQuality(signal: TradableSignal): {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  score: number;
  factors: string[];
} {
  let score = 0;
  const factors: string[] = [];
  
  // Base score from screening
  if (signal.meta.score >= 80) {
    score += 30;
    factors.push('High screening score');
  } else if (signal.meta.score >= 65) {
    score += 20;
    factors.push('Good screening score');
  } else if (signal.meta.score >= 50) {
    score += 10;
    factors.push('Moderate screening score');
  }
  
  // Confidence factor
  if (signal.meta.confidence >= 0.8) {
    score += 25;
    factors.push('High confidence');
  } else if (signal.meta.confidence >= 0.6) {
    score += 15;
    factors.push('Good confidence');
  } else if (signal.meta.confidence >= 0.4) {
    score += 5;
    factors.push('Moderate confidence');
  }
  
  // Risk-reward factor
  if (signal.rr1 && signal.rr1 >= 2.0) {
    score += 20;
    factors.push('Excellent R:R ratio');
  } else if (signal.rr1 && signal.rr1 >= 1.5) {
    score += 15;
    factors.push('Good R:R ratio');
  } else if (signal.rr1 && signal.rr1 >= 1.0) {
    score += 5;
    factors.push('Acceptable R:R ratio');
  }
  
  // MTF alignment bonus
  if (signal.meta.mtfAlignment === 'aligned') {
    score += 15;
    factors.push('Multi-timeframe alignment');
  }
  
  // Regime suitability
  if (signal.meta.regime === 'trending' && signal.side !== 'none') {
    score += 10;
    factors.push('Trending market support');
  }
  
  // Cost efficiency
  if (signal.costs.total && signal.notional) {
    const costRatio = signal.costs.total / signal.notional;
    if (costRatio < 0.001) { // <0.1%
      score += 10;
      factors.push('Low execution costs');
    } else if (costRatio > 0.005) { // >0.5%
      score -= 10;
      factors.push('High execution costs');
    }
  }
  
  // Determine quality grade
  let quality: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 80) quality = 'excellent';
  else if (score >= 60) quality = 'good';
  else if (score >= 40) quality = 'fair';
  else quality = 'poor';
  
  return { quality, score, factors };
}
// Market Regime Detection with Dynamic Parameters
// Automatically adjusts thresholds and weights based on market conditions

import type { Candle } from './indicators.pro';
import type { ProIndicators } from './indicators.pro';

export type Regime = 'trending' | 'ranging' | 'volatile' | 'quiet';

export type RegimeAdvice = {
  regime: Regime;
  reason: string;
  dynamicThresholds: { buy:number; sell:number };
  weightMod: { smc:number; indicators:number; derivatives:number };
};

export function detectRegime(candles:Candle[], ind:ProIndicators): RegimeAdvice {
  const c = candles.map(x=>x.close); 
  const lastClose = c.at(-1) ?? 0;
  
  // Calculate ATR percentage (daily volatility)
  const atrPct = ind.atr14 && lastClose>0 ? (ind.atr14/lastClose)*100 : null;
  const adx = ind.adx14 ?? 0; 
  const bbWidth = ind.bb.widthPct ?? 0; 
  const rsi = ind.rsi14 ?? 50;

  // Market regime classification heuristics:
  // - trending: High ADX (≥25) with clear EMA alignment
  // - ranging: Low ADX (<20) with narrow Bollinger Bands
  // - volatile: High ATR% or wide Bollinger Bands
  // - quiet: Very low ATR% and narrow bands
  
  const isTrending = adx>=25 && (ind.emaTrend==='bullish'||ind.emaTrend==='bearish');
  const isRanging = adx<20 && bbWidth>0 && bbWidth<6; // narrow bands
  const isVolatile = (atrPct!=null && atrPct>2.5) || bbWidth>12;
  const isQuiet = (atrPct!=null && atrPct<1.0) && bbWidth<5 && adx<18;

  let regime:Regime = 'ranging';
  let reason = '';
  
  // Priority order: volatile > quiet > trending > ranging
  if (isVolatile) { 
    regime='volatile'; 
    reason='High ATR%/BandWidth indicating choppy conditions'; 
  }
  else if (isQuiet) { 
    regime='quiet'; 
    reason='Low ATR%/BandWidth indicating low volatility'; 
  }
  else if (isTrending) { 
    regime='trending'; 
    reason='ADX≥25 + EMA alignment indicating strong trend'; 
  }
  else {
    reason = 'Neutral conditions - sideways market';
  }

  // Dynamic thresholds & weight modulation based on regime
  let th = { buy: 65, sell: 35 }; // default
  let wm = { smc: 1.0, indicators: 0.6, derivatives: 0.5 }; // default

  switch(regime){
    case 'trending':
      // In trending markets, be more aggressive
      th = { buy: 60, sell: 40 }; // easier buy/sell in strong trends
      wm = { smc: 1.1, indicators: 0.7, derivatives: 0.5 }; // boost trend-following
      break;
      
    case 'ranging':
      // In ranging markets, be more conservative
      th = { buy: 68, sell: 32 }; // higher bar for signals
      wm = { smc: 0.9, indicators: 0.7, derivatives: 0.5 }; // boost mean reversion indicators
      break;
      
    case 'volatile':
      // In volatile markets, avoid false breakouts
      th = { buy: 70, sell: 30 }; // very conservative to avoid chop
      wm = { smc: 1.0, indicators: 0.6, derivatives: 0.6 }; // boost derivatives (funding/OI)
      break;
      
    case 'quiet':
      // In quiet markets, slightly conservative
      th = { buy: 66, sell: 34 }; // moderate conservatism
      wm = { smc: 0.95, indicators: 0.65, derivatives: 0.5 }; // balanced approach
      break;
  }

  return { 
    regime, 
    reason, 
    dynamicThresholds: th, 
    weightMod: wm 
  };
}

// Additional regime analysis helpers
export function getRegimeDescription(regime: Regime): string {
  switch(regime) {
    case 'trending':
      return 'Strong directional movement with clear trend continuation signals';
    case 'ranging':
      return 'Sideways price action with support/resistance bound trading';
    case 'volatile':
      return 'High volatility environment with increased noise and false signals';
    case 'quiet':
      return 'Low volatility consolidation with reduced directional bias';
    default:
      return 'Neutral market conditions';
  }
}

export function getRegimeStrategyAdvice(regime: Regime): string {
  switch(regime) {
    case 'trending':
      return 'Focus on trend-following strategies, momentum plays, and breakout trades';
    case 'ranging':
      return 'Emphasize mean reversion, range trading, and support/resistance levels';
    case 'volatile':
      return 'Use smaller position sizes, wider stops, and avoid low-confidence signals';
    case 'quiet':
      return 'Wait for clearer signals or use range-bound strategies with tight stops';
    default:
      return 'Maintain balanced approach with standard risk management';
  }
}
// ============================================================================
// ALERT RULES - Smart signal filtering and alert decision logic
// Author: CryptoSat Intelligence  
// Purpose: Determine when to send alerts based on confluence scores and thresholds
// ============================================================================

import type { ScreenerResponse } from '../../shared/schemas';
import { logger } from './logger';

export type AlertDecision = {
  shouldAlert: boolean;
  side: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  priority: 'low' | 'medium' | 'high';
};

export interface AlertConfig {
  buyThreshold: number;      // Score threshold for BUY alerts (default: 65)
  sellThreshold: number;     // Score threshold for SELL alerts (default: 35)
  minConfidence: number;     // Minimum confidence for alerts (default: 70%)
  riskFilter: boolean;       // Filter by risk level (default: true)
  regimeFilter: string[];    // Allowed regimes for alerts (default: ['trending', 'quiet'])
}

const DEFAULT_CONFIG: AlertConfig = {
  buyThreshold: Number(process.env.BUY_THRESHOLD || 65),
  sellThreshold: Number(process.env.SELL_THRESHOLD || 35),
  minConfidence: Number(process.env.MIN_CONFIDENCE || 70),
  riskFilter: process.env.RISK_FILTER !== 'false',
  regimeFilter: (process.env.REGIME_FILTER || 'trending,quiet').split(',').map(r => r.trim())
};

/**
 * Decide whether to send alert for a screening result
 */
export function decideAlert(
  result: ScreenerResponse['results'][0], 
  config: AlertConfig = DEFAULT_CONFIG
): AlertDecision {
  const { score, label, confidence, riskLevel, regime } = result;

  // Check basic score thresholds
  if (label === 'BUY' && score >= config.buyThreshold) {
    return validateAlert(result, 'BUY', `Score ${score} ≥ ${config.buyThreshold}`, config);
  }
  
  if (label === 'SELL' && score <= config.sellThreshold) {
    return validateAlert(result, 'SELL', `Score ${score} ≤ ${config.sellThreshold}`, config);
  }

  return {
    shouldAlert: false,
    side: 'HOLD',
    reason: `No threshold met (score: ${score}, buy≥${config.buyThreshold}, sell≤${config.sellThreshold})`,
    priority: 'low'
  };
}

/**
 * Additional validation for alert quality
 */
function validateAlert(
  result: ScreenerResponse['results'][0],
  side: 'BUY' | 'SELL',
  baseReason: string,
  config: AlertConfig
): AlertDecision {
  const { confidence, riskLevel, regime } = result;

  // Check confidence threshold
  if (confidence < config.minConfidence) {
    return {
      shouldAlert: false,
      side: 'HOLD',
      reason: `Low confidence: ${confidence}% < ${config.minConfidence}%`,
      priority: 'low'
    };
  }

  // Check risk filter
  if (config.riskFilter && riskLevel === 'high') {
    return {
      shouldAlert: false,
      side: 'HOLD', 
      reason: `High risk filtered out (risk: ${riskLevel})`,
      priority: 'low'
    };
  }

  // Check regime filter
  if (regime && config.regimeFilter.length > 0 && !config.regimeFilter.includes(regime)) {
    return {
      shouldAlert: false,
      side: 'HOLD',
      reason: `Regime filtered out (regime: ${regime}, allowed: ${config.regimeFilter.join(',')})`,
      priority: 'low'
    };
  }

  // Determine priority based on score and confidence
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if ((side === 'BUY' && result.score >= 80) || (side === 'SELL' && result.score <= 20)) {
    priority = 'high';
  } else if (confidence >= 90) {
    priority = 'high';
  }

  return {
    shouldAlert: true,
    side,
    reason: baseReason,
    priority
  };
}

/**
 * Render professional Telegram alert message
 */
export function renderAlert(params: {
  symbol: string;
  result: ScreenerResponse['results'][0];
  tradable?: boolean;
  config?: AlertConfig;
}): string {
  const { symbol, result, tradable = false } = params;
  const config = params.config || DEFAULT_CONFIG;

  const basicInfo = [
    `⚡ <b>${symbol}</b> — <b>${result.label}</b> (${result.score}/100)`,
    result.regime ? `Regime: <b>${result.regime}</b>` : null,
    `Risk: <b>${result.riskLevel}</b> | Conf: <b>${Math.round(result.confidence)}%</b>`,
    `Layers → ${result.summary}`,
    `DynTh: BUY≥${config.buyThreshold} / SELL≤${config.sellThreshold}`,
  ].filter(Boolean);

  if (!tradable || !result.tradableSignal?.valid) {
    return [
      ...basicInfo,
      `⏱️ ${new Date().toLocaleString()}`
    ].join('\n');
  }

  // Tradable signal with risk engine details
  const trade = result.tradableSignal;
  const tradePlan = [
    '',
    '<b>Trade Plan</b>',
    `Entry: <code>${trade.entry?.toFixed(2) || 'N/A'}</code>`,
    `SL:    <code>${trade.sl?.toFixed(2) || 'N/A'}</code> (ATR x1.5)`,
    `TP1:   <code>${trade.tp1?.toFixed(2) || 'N/A'}</code> (RR ${trade.rr1?.toFixed(1) || 'N/A'})`,
    `TP2:   <code>${trade.tp2?.toFixed(2) || 'N/A'}</code> (RR ${trade.rr2?.toFixed(1) || 'N/A'})`,
    `Qty:   <code>${trade.qty?.toFixed(3) || 'N/A'}</code>    (risk 0.5% equity)`,
    `Costs: fee≈<code>${trade.costs?.fees?.toFixed(2) || '0'}</code> | slip≈<code>${trade.costs?.slip?.toFixed(2) || '0'}</code> | spread≈<code>${trade.costs?.spread?.toFixed(2) || '0'}</code>`
  ];

  return [
    ...basicInfo,
    ...tradePlan,
    '',
    `⏱️ ${new Date().toLocaleString()}`
  ].join('\n');
}

/**
 * Generate deduplication key for alert
 */
export function generateAlertKey(symbol: string, label: string, score: number): string {
  return `${symbol}:${label}:${Math.round(score / 5) * 5}`; // Round to nearest 5 for dedup
}

/**
 * Log alert decision for debugging
 */
export function logAlertDecision(
  symbol: string, 
  result: ScreenerResponse['results'][0], 
  decision: AlertDecision
): void {
  logger.debug('Alert decision made', {
    symbol,
    label: result.label,
    score: result.score,
    confidence: result.confidence,
    regime: result.regime,
    riskLevel: result.riskLevel,
    shouldAlert: decision.shouldAlert,
    reason: decision.reason,
    priority: decision.priority
  });
}
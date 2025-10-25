/**
 * Unified Signal Schema
 *
 * Combines CoinAPI price action + CoinGlass derivatives intelligence
 * into a single, comprehensive trading signal format
 */

export interface PriceAction {
  structure: 'BOS_BULLISH' | 'BOS_BEARISH' | 'CHOCH' | 'Breakdown' | 'Consolidation' | 'Reversal';
  cvd: 'up' | 'down' | 'neutral';
  volume_profile: 'increasing' | 'decreasing' | 'stable';
  smart_money_signal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  liquidity_grabbed: boolean;
}

export interface DerivativesData {
  oi_change_percent: number;           // Open Interest change %
  funding_rate: number;                 // Current funding rate
  funding_pressure: 'long' | 'short' | 'neutral';
  liquidation_zone_above?: number;      // Price level
  liquidation_zone_below?: number;      // Price level
  long_short_ratio: number;             // Ratio of longs vs shorts
  whale_activity: 'accumulation' | 'distribution' | 'neutral';
  etf_flow?: number;                    // Bitcoin ETF flow (if BTC)
}

export interface UnifiedSignal {
  // Basic info
  symbol: string;
  timestamp: string;

  // Market regime
  regime: 'bullish_trending' | 'bearish_trending' | 'bullish_reversal' | 'bearish_reversal' | 'ranging' | 'high_volatility';
  regime_confidence: number;            // 0-1

  // Price action (from CoinAPI + Brain)
  price_action: PriceAction;
  current_price: number;

  // Derivatives intelligence (from CoinGlass)
  derivatives: DerivativesData;

  // Fusion decision
  final_signal: 'LONG' | 'SHORT' | 'HOLD' | 'CLOSE_LONG' | 'CLOSE_SHORT';
  confidence: number;                   // 0-1 (combined confidence)

  // Risk management
  stop_loss?: number;
  take_profit?: number[];               // Multiple TP levels
  position_size_percent?: number;       // % of capital
  risk_level: 'low' | 'medium' | 'high' | 'extreme';

  // Reasoning
  reasons: string[];                    // Why this signal was generated
  warnings?: string[];                  // Any concerns or caveats

  // Metadata
  data_sources: {
    coinapi_healthy: boolean;
    coinglass_healthy: boolean;
    data_age_seconds: number;
  };

  // Strategy recommendation
  strategy: 'scalp' | 'swing' | 'position' | 'avoid';
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
}

export interface FusionMetrics {
  // Alignment scores (how well data sources agree)
  price_derivatives_alignment: number;  // 0-1
  smart_money_whale_alignment: number;  // 0-1
  overall_confluence: number;           // 0-1

  // Divergence warnings
  divergences: {
    type: 'price_oi' | 'funding_sentiment' | 'whale_retail';
    severity: 'low' | 'medium' | 'high';
    description: string;
  }[];

  // Signal strength components
  technical_strength: number;           // 0-1
  derivatives_strength: number;         // 0-1
  institutional_strength: number;       // 0-1
}

export interface UnifiedSignalWithMetrics extends UnifiedSignal {
  fusion_metrics: FusionMetrics;
}

/**
 * Helper to create default UnifiedSignal when data is unavailable
 */
export function createDefaultSignal(symbol: string, reason: string): UnifiedSignal {
  return {
    symbol,
    timestamp: new Date().toISOString(),
    regime: 'ranging',
    regime_confidence: 0.5,
    price_action: {
      structure: 'Consolidation',
      cvd: 'neutral',
      volume_profile: 'stable',
      smart_money_signal: 'NEUTRAL',
      liquidity_grabbed: false
    },
    current_price: 0,
    derivatives: {
      oi_change_percent: 0,
      funding_rate: 0,
      funding_pressure: 'neutral',
      long_short_ratio: 1.0,
      whale_activity: 'neutral'
    },
    final_signal: 'HOLD',
    confidence: 0,
    risk_level: 'medium',
    reasons: [reason],
    warnings: ['Insufficient data - using default signal'],
    data_sources: {
      coinapi_healthy: false,
      coinglass_healthy: false,
      data_age_seconds: 0
    },
    strategy: 'avoid',
    timeframe: '1h'
  };
}

/**
 * Validate UnifiedSignal for completeness
 */
export function validateSignal(signal: UnifiedSignal): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!signal.symbol || signal.symbol.length === 0) {
    errors.push('Symbol is required');
  }

  if (signal.confidence < 0 || signal.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }

  if (signal.regime_confidence < 0 || signal.regime_confidence > 1) {
    errors.push('Regime confidence must be between 0 and 1');
  }

  if (signal.final_signal !== 'HOLD' && !signal.stop_loss) {
    errors.push('Stop loss is required for non-HOLD signals');
  }

  if (signal.final_signal !== 'HOLD' && (!signal.take_profit || signal.take_profit.length === 0)) {
    errors.push('Take profit levels are required for non-HOLD signals');
  }

  if (signal.reasons.length === 0) {
    errors.push('At least one reason is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate risk-adjusted position size
 */
export function calculatePositionSize(
  signal: UnifiedSignal,
  accountBalance: number,
  maxRiskPercent: number = 2
): number {
  if (signal.final_signal === 'HOLD') return 0;
  if (!signal.stop_loss || signal.current_price === 0) return 0;

  // Calculate risk per unit
  const riskPerUnit = Math.abs(signal.current_price - signal.stop_loss);
  const riskAmount = accountBalance * (maxRiskPercent / 100);

  // Position size = risk amount / risk per unit
  let positionSize = riskAmount / riskPerUnit;

  // Adjust based on confidence
  positionSize *= signal.confidence;

  // Adjust based on risk level
  const riskMultiplier = {
    'low': 1.0,
    'medium': 0.75,
    'high': 0.5,
    'extreme': 0.25
  }[signal.risk_level];

  positionSize *= riskMultiplier;

  return positionSize;
}

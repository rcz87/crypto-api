/**
 * Fusion Engine - Meta-Brain Intelligence Layer
 *
 * Combines:
 * 1. CoinAPI price action + smart money flow (from Brain Orchestrator)
 * 2. CoinGlass derivatives intelligence (from Bridge Service)
 *
 * Outputs: Unified trading signals with multi-factor confidence scoring
 */

import { BrainInsight } from './orchestrator';
import { coinGlassBridge } from '../services/coinGlassBridgeService';
import {
  UnifiedSignal,
  UnifiedSignalWithMetrics,
  FusionMetrics,
  PriceAction,
  DerivativesData,
  createDefaultSignal,
  validateSignal
} from './unifiedSignal';

export class FusionEngine {
  constructor() {
    console.log('⚡ [FusionEngine] Meta-Brain initialized');
  }

  /**
   * Main fusion method - combines Brain Insight + CoinGlass data
   */
  async fuse(brainInsight: BrainInsight, currentPrice: number): Promise<UnifiedSignalWithMetrics> {
    console.log(`🧬 [FusionEngine] Fusing intelligence for ${brainInsight.symbol}`);

    try {
      // 1. Fetch CoinGlass derivatives data
      const derivativesData = await coinGlassBridge.getDerivativesData(brainInsight.symbol);
      const institutionalBias = await coinGlassBridge.getInstitutionalBias(brainInsight.symbol);

      // 2. Check data availability
      const coinglassHealthy = derivativesData !== null;
      const coinapiHealthy = brainInsight !== null;

      if (!coinapiHealthy) {
        console.warn('⚠️ [FusionEngine] CoinAPI data unavailable, using defaults');
        return this.createDefaultSignalWithMetrics(
          brainInsight.symbol,
          'CoinAPI data unavailable'
        );
      }

      // 3. Build price action structure
      const priceAction = this.extractPriceAction(brainInsight);

      // 4. Use derivatives data or fallback to neutral
      const derivatives = derivativesData || this.getDefaultDerivatives();

      // 5. Determine market regime from brain insight
      const regime = this.mapRegime(brainInsight.regime.state);

      // 6. Make fusion decision
      const fusionDecision = this.makeFusionDecision(
        priceAction,
        derivatives,
        regime,
        institutionalBias,
        brainInsight
      );

      // 7. Calculate fusion metrics
      const fusionMetrics = this.calculateFusionMetrics(
        brainInsight,
        derivatives,
        fusionDecision
      );

      // 8. Calculate risk management levels
      const { stopLoss, takeProfits, riskLevel } = this.calculateRiskLevels(
        currentPrice,
        fusionDecision.signal,
        priceAction,
        derivatives,
        fusionDecision.confidence
      );

      // 9. Build unified signal
      const unifiedSignal: UnifiedSignal = {
        symbol: brainInsight.symbol,
        timestamp: brainInsight.timestamp,
        regime,
        regime_confidence: brainInsight.regime.probability,
        price_action: priceAction,
        current_price: currentPrice,
        derivatives,
        final_signal: fusionDecision.signal,
        confidence: fusionDecision.confidence,
        stop_loss: stopLoss,
        take_profit: takeProfits,
        risk_level: riskLevel,
        reasons: fusionDecision.reasons,
        warnings: fusionDecision.warnings,
        data_sources: {
          coinapi_healthy: coinapiHealthy,
          coinglass_healthy: coinglassHealthy,
          data_age_seconds: Math.floor((Date.now() - new Date(brainInsight.timestamp).getTime()) / 1000)
        },
        strategy: this.determineStrategy(fusionDecision.signal, regime, fusionDecision.confidence),
        timeframe: this.determineTimeframe(regime, priceAction)
      };

      // 10. Validate signal
      const validation = validateSignal(unifiedSignal);
      if (!validation.valid) {
        console.error('❌ [FusionEngine] Signal validation failed:', validation.errors);
        unifiedSignal.warnings = [...(unifiedSignal.warnings || []), ...validation.errors];
      }

      // 11. Return signal with metrics
      const result: UnifiedSignalWithMetrics = {
        ...unifiedSignal,
        fusion_metrics: fusionMetrics
      };

      console.log(`✅ [FusionEngine] Fusion complete: ${fusionDecision.signal} (${(fusionDecision.confidence * 100).toFixed(1)}%)`);
      return result;

    } catch (error) {
      console.error('❌ [FusionEngine] Fusion failed:', error);
      return this.createDefaultSignalWithMetrics(
        brainInsight.symbol,
        `Fusion error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract price action from brain insight
   */
  private extractPriceAction(insight: BrainInsight): PriceAction {
    // Determine structure based on regime and smart money
    let structure: PriceAction['structure'] = 'Consolidation';

    if (insight.regime.state === 'trending') {
      if (insight.smartMoney.signal === 'ACCUMULATION') {
        structure = 'BOS_BULLISH';
      } else if (insight.smartMoney.signal === 'DISTRIBUTION') {
        structure = 'BOS_BEARISH';
      }
    } else if (insight.regime.state === 'reversal') {
      structure = 'Reversal';
    } else if (insight.regime.state === 'ranging') {
      structure = 'Consolidation';
    }

    // Check for CHOCH (Change of Character) - regime switch
    if (insight.switchEvent && insight.switchEvent.triggered) {
      structure = 'CHOCH';
    }

    return {
      structure,
      cvd: insight.smartMoney.signal === 'ACCUMULATION' ? 'up' :
           insight.smartMoney.signal === 'DISTRIBUTION' ? 'down' : 'neutral',
      volume_profile: insight.smartMoney.strength === 'strong' ? 'increasing' :
                      insight.smartMoney.strength === 'weak' ? 'decreasing' : 'stable',
      smart_money_signal: insight.smartMoney.signal,
      liquidity_grabbed: insight.liquidity ? Math.abs(insight.liquidity.bidAskImbalance) > 0.5 : false
    };
  }

  /**
   * Map brain regime to unified regime
   */
  private mapRegime(brainRegime: string): UnifiedSignal['regime'] {
    const regimeMap: Record<string, UnifiedSignal['regime']> = {
      'trending': 'bullish_trending',
      'reversal': 'bullish_reversal',
      'ranging': 'ranging',
      'high_vol': 'high_volatility'
    };

    return regimeMap[brainRegime.toLowerCase()] || 'ranging';
  }

  /**
   * Make fusion decision by combining all intelligence
   */
  private makeFusionDecision(
    priceAction: PriceAction,
    derivatives: DerivativesData,
    regime: UnifiedSignal['regime'],
    institutionalBias: 'bullish' | 'bearish' | 'neutral',
    brainInsight: BrainInsight
  ): {
    signal: UnifiedSignal['final_signal'];
    confidence: number;
    reasons: string[];
    warnings: string[];
  } {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let signal: UnifiedSignal['final_signal'] = 'HOLD';
    let confidence = 0.5;

    // === RULE 1: Bullish BOS + OI Rising + Negative Funding (Short Squeeze Setup) ===
    if (
      priceAction.structure === 'BOS_BULLISH' &&
      derivatives.oi_change_percent > 2 &&
      derivatives.funding_rate < -0.005
    ) {
      signal = 'LONG';
      confidence = 0.85;
      reasons.push('🟢 Bullish BOS + OI rising + negative funding = Short squeeze setup');
      reasons.push(`OI: +${derivatives.oi_change_percent.toFixed(2)}%, Funding: ${(derivatives.funding_rate * 100).toFixed(3)}%`);
    }

    // === RULE 2: Bearish BOS + OI Rising + Positive Funding (Long Squeeze Setup) ===
    else if (
      priceAction.structure === 'BOS_BEARISH' &&
      derivatives.oi_change_percent > 2 &&
      derivatives.funding_rate > 0.005
    ) {
      signal = 'SHORT';
      confidence = 0.85;
      reasons.push('🔴 Bearish BOS + OI rising + positive funding = Long squeeze setup');
      reasons.push(`OI: +${derivatives.oi_change_percent.toFixed(2)}%, Funding: ${(derivatives.funding_rate * 100).toFixed(3)}%`);
    }

    // === RULE 3: Accumulation + Whale Accumulation + Low Funding (Strong Buy) ===
    else if (
      priceAction.smart_money_signal === 'ACCUMULATION' &&
      derivatives.whale_activity === 'accumulation' &&
      Math.abs(derivatives.funding_rate) < 0.01 &&
      regime.includes('bullish')
    ) {
      signal = 'LONG';
      confidence = 0.82;
      reasons.push('🐋 Smart money + Whale accumulation + neutral funding = Strong buy');
      reasons.push(`Institutional bias: ${institutionalBias}`);
    }

    // === RULE 4: Distribution + Whale Distribution + Rising OI (Smart Money Exit) ===
    else if (
      priceAction.smart_money_signal === 'DISTRIBUTION' &&
      derivatives.whale_activity === 'distribution' &&
      derivatives.oi_change_percent > 0
    ) {
      signal = 'SHORT';
      confidence = 0.80;
      reasons.push('📉 Distribution pattern + whale selling + OI rising = Top formation');
      warnings.push('⚠️ Potential distribution phase - institutions exiting');
    }

    // === RULE 5: CHOCH + OI Divergence (Trend Change Confirmation) ===
    else if (
      priceAction.structure === 'CHOCH' &&
      Math.abs(derivatives.oi_change_percent) > 3
    ) {
      // If OI rising with CHOCH = strong reversal
      if (derivatives.oi_change_percent > 0) {
        signal = derivatives.funding_pressure === 'long' ? 'SHORT' : 'LONG';
        confidence = 0.78;
        reasons.push('⚡ CHOCH detected + OI surge = Trend reversal confirmed');
      } else {
        // OI declining = weak reversal, stay cautious
        signal = 'HOLD';
        confidence = 0.60;
        warnings.push('⚠️ CHOCH but OI declining - reversal may be weak');
      }
    }

    // === RULE 6: Extreme Long/Short Ratio (Contrarian Signal) ===
    else if (derivatives.long_short_ratio > 2.5) {
      // Too many longs = potential short signal
      signal = 'SHORT';
      confidence = 0.70;
      reasons.push(`🎯 Extreme long/short ratio (${derivatives.long_short_ratio.toFixed(2)}) = Contrarian short opportunity`);
      warnings.push('⚠️ Contrarian play - use tight stops');
    } else if (derivatives.long_short_ratio < 0.4) {
      // Too many shorts = potential long signal
      signal = 'LONG';
      confidence = 0.70;
      reasons.push(`🎯 Extreme short/long ratio (${derivatives.long_short_ratio.toFixed(2)}) = Contrarian long opportunity`);
      warnings.push('⚠️ Contrarian play - use tight stops');
    }

    // === RULE 7: Liquidation Zone Proximity (Mean Reversion) ===
    else if (derivatives.liquidation_zone_below && priceAction.structure === 'Consolidation') {
      // Price near liquidation zone = potential bounce
      signal = 'LONG';
      confidence = 0.65;
      reasons.push('📍 Price approaching liquidation cluster below = Bounce opportunity');
      reasons.push(`Liquidation zone: ${derivatives.liquidation_zone_below}`);
    }

    // === RULE 8: ETF Flow Confirmation (BTC only) ===
    else if (derivatives.etf_flow && Math.abs(derivatives.etf_flow) > 100000000) {
      // Significant ETF flow
      if (derivatives.etf_flow > 0) {
        signal = 'LONG';
        confidence = 0.75;
        reasons.push(`💰 Strong ETF inflow ($${(derivatives.etf_flow / 1000000).toFixed(1)}M) = Institutional buying`);
      } else {
        signal = 'SHORT';
        confidence = 0.75;
        reasons.push(`💸 Strong ETF outflow ($${(Math.abs(derivatives.etf_flow) / 1000000).toFixed(1)}M) = Institutional selling`);
      }
    }

    // === RULE 9: High Volatility Regime - Reduce Position ===
    if (regime === 'high_volatility') {
      confidence *= 0.7; // Reduce confidence in high vol
      warnings.push('⚠️ High volatility regime - position size reduced');
    }

    // === RULE 10: Institutional Bias Alignment ===
    if (institutionalBias === 'bullish' && signal === 'LONG') {
      confidence += 0.05;
      reasons.push('✅ Institutional bias confirms LONG');
    } else if (institutionalBias === 'bearish' && signal === 'SHORT') {
      confidence += 0.05;
      reasons.push('✅ Institutional bias confirms SHORT');
    } else if (institutionalBias !== 'neutral' && signal !== 'HOLD') {
      // Divergence warning
      warnings.push(`⚠️ Institutional bias (${institutionalBias}) diverges from signal (${signal})`);
      confidence -= 0.1;
    }

    // === RULE 11: Brain Decision Override (if very confident) ===
    if (brainInsight.decision.confidence > 0.85) {
      const brainSignal = brainInsight.decision.action;
      if (brainSignal === 'BUY') signal = 'LONG';
      if (brainSignal === 'SELL') signal = 'SHORT';
      confidence = Math.max(confidence, brainInsight.decision.confidence);
      reasons.push(`🧠 Brain Orchestrator high confidence (${(brainInsight.decision.confidence * 100).toFixed(1)}%) override`);
    }

    // Cap confidence
    confidence = Math.max(0.3, Math.min(0.95, confidence));

    // Default to HOLD if no strong signal
    if (reasons.length === 0) {
      reasons.push('📊 No clear confluence detected - awaiting better setup');
      signal = 'HOLD';
      confidence = 0.5;
    }

    return { signal, confidence, reasons, warnings };
  }

  /**
   * Calculate fusion metrics for signal quality assessment
   */
  private calculateFusionMetrics(
    brainInsight: BrainInsight,
    derivatives: DerivativesData,
    decision: { signal: string; confidence: number }
  ): FusionMetrics {
    // Price-derivatives alignment
    const priceDerivativesAlignment = this.calculateAlignment(
      brainInsight.smartMoney.signal,
      derivatives.whale_activity
    );

    // Smart money - whale alignment
    const smartMoneyWhaleAlignment = this.calculateAlignment(
      brainInsight.smartMoney.signal,
      derivatives.whale_activity
    );

    // Overall confluence
    const overallConfluence = (priceDerivativesAlignment + smartMoneyWhaleAlignment) / 2;

    // Detect divergences
    const divergences = this.detectDivergences(brainInsight, derivatives);

    return {
      price_derivatives_alignment: priceDerivativesAlignment,
      smart_money_whale_alignment: smartMoneyWhaleAlignment,
      overall_confluence: overallConfluence,
      divergences,
      technical_strength: brainInsight.decision.confidence,
      derivatives_strength: Math.abs(derivatives.oi_change_percent) / 10, // Normalized
      institutional_strength: derivatives.whale_activity === 'neutral' ? 0.5 :
                             derivatives.whale_activity === 'accumulation' ? 0.8 : 0.2
    };
  }

  /**
   * Calculate alignment score between two signals
   */
  private calculateAlignment(signal1: string, signal2: string): number {
    const normalized1 = signal1.toLowerCase();
    const normalized2 = signal2.toLowerCase();

    if (normalized1 === normalized2) return 1.0;
    if (normalized1 === 'neutral' || normalized2 === 'neutral') return 0.5;
    return 0.0; // Divergence
  }

  /**
   * Detect divergences between data sources
   */
  private detectDivergences(
    brainInsight: BrainInsight,
    derivatives: DerivativesData
  ): FusionMetrics['divergences'] {
    const divergences: FusionMetrics['divergences'] = [];

    // Price-OI divergence
    if (brainInsight.smartMoney.signal === 'ACCUMULATION' && derivatives.oi_change_percent < -2) {
      divergences.push({
        type: 'price_oi',
        severity: 'high',
        description: 'Price accumulation but OI declining - weak buying pressure'
      });
    }

    // Funding-sentiment divergence
    if (derivatives.funding_rate > 0.01 && brainInsight.smartMoney.signal === 'ACCUMULATION') {
      divergences.push({
        type: 'funding_sentiment',
        severity: 'medium',
        description: 'High funding rate vs accumulation - overcrowded long trade'
      });
    }

    // Whale-retail divergence
    if (derivatives.whale_activity === 'distribution' && brainInsight.smartMoney.signal === 'ACCUMULATION') {
      divergences.push({
        type: 'whale_retail',
        severity: 'high',
        description: 'Whales distributing while retail accumulates - potential trap'
      });
    }

    return divergences;
  }

  /**
   * Calculate risk management levels
   */
  private calculateRiskLevels(
    currentPrice: number,
    signal: UnifiedSignal['final_signal'],
    priceAction: PriceAction,
    derivatives: DerivativesData,
    confidence: number
  ): {
    stopLoss?: number;
    takeProfits: number[];
    riskLevel: UnifiedSignal['risk_level'];
  } {
    if (signal === 'HOLD') {
      return { takeProfits: [], riskLevel: 'medium' };
    }

    // Base risk percentage on confidence
    const baseRisk = confidence > 0.8 ? 0.02 : confidence > 0.7 ? 0.03 : 0.05;

    let stopLoss: number;
    let takeProfits: number[] = [];
    let riskLevel: UnifiedSignal['risk_level'] = 'medium';

    if (signal === 'LONG') {
      // Stop below liquidation zone or -2%/-3%/-5% based on confidence
      stopLoss = derivatives.liquidation_zone_below || currentPrice * (1 - baseRisk);

      // Multiple take profits
      takeProfits = [
        currentPrice * (1 + baseRisk * 1.5), // TP1: 1.5R
        currentPrice * (1 + baseRisk * 2.5), // TP2: 2.5R
        currentPrice * (1 + baseRisk * 4.0)  // TP3: 4R
      ];
    } else {
      // SHORT
      stopLoss = derivatives.liquidation_zone_above || currentPrice * (1 + baseRisk);

      takeProfits = [
        currentPrice * (1 - baseRisk * 1.5),
        currentPrice * (1 - baseRisk * 2.5),
        currentPrice * (1 - baseRisk * 4.0)
      ];
    }

    // Determine risk level
    if (confidence > 0.8 && priceAction.smart_money_signal !== 'NEUTRAL') {
      riskLevel = 'low';
    } else if (confidence < 0.65) {
      riskLevel = 'high';
    } else if (Math.abs(derivatives.funding_rate) > 0.02) {
      riskLevel = 'high'; // High funding = risky
    }

    return { stopLoss, takeProfits, riskLevel };
  }

  /**
   * Determine trading strategy based on signal and regime
   */
  private determineStrategy(
    signal: UnifiedSignal['final_signal'],
    regime: UnifiedSignal['regime'],
    confidence: number
  ): UnifiedSignal['strategy'] {
    if (signal === 'HOLD') return 'avoid';

    if (regime === 'high_volatility') return 'scalp';
    if (confidence > 0.8) return 'swing';
    if (regime.includes('trending')) return 'position';

    return 'scalp';
  }

  /**
   * Determine optimal timeframe
   */
  private determineTimeframe(
    regime: UnifiedSignal['regime'],
    priceAction: PriceAction
  ): UnifiedSignal['timeframe'] {
    if (regime === 'high_volatility') return '5m';
    if (priceAction.structure === 'BOS_BULLISH' || priceAction.structure === 'BOS_BEARISH') return '15m';
    if (regime.includes('trending')) return '1h';

    return '15m';
  }

  /**
   * Helper: Get default derivatives data
   */
  private getDefaultDerivatives(): DerivativesData {
    return {
      oi_change_percent: 0,
      funding_rate: 0,
      funding_pressure: 'neutral',
      long_short_ratio: 1.0,
      whale_activity: 'neutral'
    };
  }

  /**
   * Helper: Create default signal with metrics
   */
  private createDefaultSignalWithMetrics(symbol: string, reason: string): UnifiedSignalWithMetrics {
    const baseSignal = createDefaultSignal(symbol, reason);

    return {
      ...baseSignal,
      fusion_metrics: {
        price_derivatives_alignment: 0.5,
        smart_money_whale_alignment: 0.5,
        overall_confluence: 0.5,
        divergences: [],
        technical_strength: 0,
        derivatives_strength: 0,
        institutional_strength: 0.5
      }
    };
  }
}

// Export singleton instance
export const fusionEngine = new FusionEngine();

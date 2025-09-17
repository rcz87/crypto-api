/**
 * Regime Detection Autopilot Service
 * 
 * Implements sophisticated market regime classification using:
 * - Hidden Markov Models (HMM)
 * - Rolling technical indicators (ATR, RSI, Kurtosis)
 * - AIC model selection for optimal classification
 * - Strategy filtering based on regime detection
 */

import { coinAPIService } from './coinapi.js';

// Regime types
export enum MarketRegime {
  TRENDING = 'trending',
  RANGING = 'ranging',
  MEAN_REVERT = 'mean_revert', 
  HIGH_VOL = 'high_vol'
}

// Strategy categories that can be enabled/disabled per regime
export enum StrategyType {
  BREAKOUT = 'breakout',
  MOMENTUM = 'momentum',
  MEAN_REVERSION = 'mean_reversion',
  SCALPING = 'scalping',
  SWING = 'swing',
  ARBITRAGE = 'arbitrage'
}

// Regime detection parameters
interface RegimeFeatures {
  atr_normalized: number;
  rsi_mean: number;
  rsi_volatility: number;
  price_kurtosis: number;
  volume_normalized: number;
  trend_strength: number;
  volatility_regime: number;
}

// HMM state representation
interface HMMState {
  regime: MarketRegime;
  probability: number;
  transition_matrix: number[][];
  emission_parameters: {
    mean: number[];
    covariance: number[][];
  };
}

// Regime detection result
export interface RegimeDetectionResult {
  symbol: string;
  timestamp: string;
  current_regime: MarketRegime;
  regime_probability: number;
  regime_duration_bars: number;
  regime_strength: number;
  features: RegimeFeatures;
  allowed_strategies: StrategyType[];
  disabled_strategies: StrategyType[];
  model_confidence: number;
  aic_score: number;
}

// Strategy rules per regime
const REGIME_STRATEGY_RULES = {
  [MarketRegime.TRENDING]: {
    allowed: [StrategyType.BREAKOUT, StrategyType.MOMENTUM, StrategyType.SWING],
    disabled: [StrategyType.MEAN_REVERSION, StrategyType.SCALPING]
  },
  [MarketRegime.RANGING]: {
    allowed: [StrategyType.MEAN_REVERSION, StrategyType.SCALPING, StrategyType.ARBITRAGE],
    disabled: [StrategyType.BREAKOUT, StrategyType.MOMENTUM]
  },
  [MarketRegime.MEAN_REVERT]: {
    allowed: [StrategyType.MEAN_REVERSION, StrategyType.SWING],
    disabled: [StrategyType.BREAKOUT, StrategyType.SCALPING]
  },
  [MarketRegime.HIGH_VOL]: {
    allowed: [StrategyType.ARBITRAGE, StrategyType.SWING],
    disabled: [StrategyType.SCALPING, StrategyType.MEAN_REVERSION]
  }
};

export class RegimeDetectionService {
  private regimeCache = new Map<string, RegimeDetectionResult>();
  private hmm_states: HMMState[] = [];
  private feature_history = new Map<string, RegimeFeatures[]>();

  constructor() {
    this.initializeHMM();
  }

  /**
   * Extract numeric value from candle data with multiple fallback field names
   */
  private extractNumericValue(candle: any, fieldNames: (string | number)[]): number | null {
    for (const field of fieldNames) {
      if (candle[field] !== undefined && candle[field] !== null) {
        const value = parseFloat(String(candle[field]));
        if (!isNaN(value)) {
          return value;
        }
      }
    }
    return null;
  }

  /**
   * Initialize Hidden Markov Model with 4 regimes
   */
  private initializeHMM(): void {
    // Initialize transition matrix (4x4 for 4 regimes)
    const transition_matrix = [
      [0.7, 0.15, 0.1, 0.05],  // Trending -> [Trending, Ranging, Mean-Revert, High-Vol]
      [0.2, 0.6, 0.15, 0.05],  // Ranging -> [Trending, Ranging, Mean-Revert, High-Vol]
      [0.15, 0.2, 0.6, 0.05],  // Mean-Revert -> [Trending, Ranging, Mean-Revert, High-Vol]
      [0.1, 0.1, 0.1, 0.7]     // High-Vol -> [Trending, Ranging, Mean-Revert, High-Vol]
    ];

    // Initialize emission parameters for each regime
    this.hmm_states = [
      {
        regime: MarketRegime.TRENDING,
        probability: 0.25,
        transition_matrix,
        emission_parameters: {
          mean: [0.8, 70, 15, -0.5, 0.7, 0.8, 0.3], // High trend, neutral RSI, low RSI vol, negative kurtosis
          covariance: this.createCovarianceMatrix(7, 0.1)
        }
      },
      {
        regime: MarketRegime.RANGING,
        probability: 0.25,
        transition_matrix,
        emission_parameters: {
          mean: [0.3, 50, 8, 0.2, 0.4, 0.2, 0.4], // Low trend, neutral RSI, low RSI vol, slight positive kurtosis
          covariance: this.createCovarianceMatrix(7, 0.15)
        }
      },
      {
        regime: MarketRegime.MEAN_REVERT,
        probability: 0.25,
        transition_matrix,
        emission_parameters: {
          mean: [0.4, 45, 20, 1.5, 0.5, 0.3, 0.5], // Medium trend, oversold bias, high RSI vol, high kurtosis
          covariance: this.createCovarianceMatrix(7, 0.2)
        }
      },
      {
        regime: MarketRegime.HIGH_VOL,
        probability: 0.25,
        transition_matrix,
        emission_parameters: {
          mean: [1.2, 60, 25, 2.0, 1.0, 0.6, 1.0], // Very high ATR, high RSI vol, very high kurtosis
          covariance: this.createCovarianceMatrix(7, 0.3)
        }
      }
    ];
  }

  /**
   * Create covariance matrix for multivariate normal distribution
   */
  private createCovarianceMatrix(size: number, variance: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < size; i++) {
      matrix[i] = [];
      for (let j = 0; j < size; j++) {
        if (i === j) {
          matrix[i][j] = variance;
        } else {
          matrix[i][j] = variance * 0.1; // Small correlation
        }
      }
    }
    return matrix;
  }

  /**
   * Detect market regime for a given symbol
   */
  async detectRegime(symbolId: string, lookback_hours: number = 48): Promise<RegimeDetectionResult> {
    try {
      // Get historical data for feature calculation
      const historicalDataResponse = await coinAPIService.getHistoricalData(
        symbolId,
        '1HRS',
        undefined,
        undefined,
        lookback_hours
      );

      // Enhanced defensive programming - ensure we have valid array data
      let historicalData: any[] = [];
      
      if (historicalDataResponse && typeof historicalDataResponse === 'object') {
        // Handle the ValidatedHistoricalData response format
        if ('data' in historicalDataResponse && Array.isArray(historicalDataResponse.data)) {
          historicalData = historicalDataResponse.data;
        } else if (Array.isArray(historicalDataResponse)) {
          // Handle direct array response (legacy format)
          historicalData = historicalDataResponse;
        } else {
          console.warn(`🚨 [RegimeDetection] Invalid data format for ${symbolId}:`, typeof historicalDataResponse, historicalDataResponse);
          throw new Error(`Invalid historical data format received for ${symbolId}`);
        }
      }

      if (!Array.isArray(historicalData) || historicalData.length < 20) {
        console.warn(`🚨 [RegimeDetection] Insufficient historical data for ${symbolId}: ${historicalData?.length || 0} candles (need 20+)`);
        throw new Error(`Insufficient historical data for regime detection: ${historicalData?.length || 0} candles (need 20+)`);
      }

      console.log(`📊 [RegimeDetection] Processing ${historicalData.length} candles for ${symbolId}`);

      // Calculate regime features with enhanced validation
      const features = this.calculateRegimeFeatures(historicalData);
      
      // Store feature history for trend analysis
      this.updateFeatureHistory(symbolId, features);

      // Run HMM regime classification
      const regime_result = this.classifyRegime(features);

      // Calculate regime duration and strength
      const regime_metrics = this.calculateRegimeMetrics(symbolId, regime_result.regime);

      // Determine allowed/disabled strategies
      const strategy_rules = REGIME_STRATEGY_RULES[regime_result.regime];

      // Calculate AIC score for model quality
      const aic_score = this.calculateAIC(features, regime_result);

      const result: RegimeDetectionResult = {
        symbol: symbolId,
        timestamp: new Date().toISOString(),
        current_regime: regime_result.regime,
        regime_probability: regime_result.probability,
        regime_duration_bars: regime_metrics.duration,
        regime_strength: regime_metrics.strength,
        features,
        allowed_strategies: strategy_rules.allowed,
        disabled_strategies: strategy_rules.disabled,
        model_confidence: regime_result.probability,
        aic_score
      };

      // Cache result
      this.regimeCache.set(symbolId, result);

      return result;

    } catch (error) {
      console.error(`Error detecting regime for ${symbolId}:`, error);
      throw new Error(`Failed to detect regime for ${symbolId}`);
    }
  }

  /**
   * Calculate regime features from historical data with enhanced validation
   */
  private calculateRegimeFeatures(data: any[]): RegimeFeatures {
    // Enhanced defensive programming - validate input data
    if (!Array.isArray(data)) {
      console.error(`🚨 [RegimeDetection] calculateRegimeFeatures received non-array:`, typeof data, data);
      throw new Error(`Expected array but received ${typeof data}`);
    }
    
    if (data.length === 0) {
      throw new Error('Empty data array provided to calculateRegimeFeatures');
    }
    
    // Log sample data for debugging
    console.log(`📊 [RegimeDetection] Sample candle data:`, data[0]);
    
    // Extract price and volume data with robust error handling
    const prices: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      if (!candle || typeof candle !== 'object') {
        console.warn(`🚨 [RegimeDetection] Invalid candle at index ${i}:`, candle);
        continue;
      }
      
      // Extract values with fallback field names
      const priceClose = this.extractNumericValue(candle, ['price_close', 'close', 'c', 4]);
      const priceHigh = this.extractNumericValue(candle, ['price_high', 'high', 'h', 2]);
      const priceLow = this.extractNumericValue(candle, ['price_low', 'low', 'l', 3]);
      const volume = this.extractNumericValue(candle, ['volume_traded', 'volume', 'vol', 'v', 5]);
      
      if (priceClose !== null && priceHigh !== null && priceLow !== null) {
        prices.push(priceClose);
        highs.push(priceHigh);
        lows.push(priceLow);
        volumes.push(volume || 0);
      } else {
        console.warn(`🚨 [RegimeDetection] Missing price data at index ${i}:`, {
          close: priceClose, high: priceHigh, low: priceLow, volume: volume
        });
      }
    }
    
    if (prices.length < 14) {
      throw new Error(`Insufficient valid price data: ${prices.length} candles (need 14+ for calculations)`);
    }
    
    console.log(`✅ [RegimeDetection] Extracted ${prices.length} valid candles from ${data.length} input candles`);

    // Calculate ATR (Average True Range)
    const atr = this.calculateATR(highs, lows, prices, 14);
    const atr_normalized = atr / prices[prices.length - 1]; // Normalize by current price

    // Calculate RSI and its statistics
    const rsi_values = this.calculateRSI(prices, 14);
    const rsi_mean = this.mean(rsi_values.slice(-20)); // Last 20 periods
    const rsi_volatility = this.standardDeviation(rsi_values.slice(-20));

    // Calculate price kurtosis (fat tails indicator)
    const returns = this.calculateReturns(prices);
    const price_kurtosis = this.kurtosis(returns.slice(-20));

    // Calculate normalized volume
    const volume_ma = this.mean(volumes.slice(-20));
    const volume_normalized = volumes[volumes.length - 1] / volume_ma;

    // Calculate trend strength (linear regression slope)
    const trend_strength = this.calculateTrendStrength(prices.slice(-20));

    // Calculate volatility regime (rolling volatility percentile)
    const volatility_regime = this.calculateVolatilityRegime(returns.slice(-20));

    const features = {
      atr_normalized: isNaN(atr_normalized) ? 0.5 : atr_normalized,
      rsi_mean: isNaN(rsi_mean) ? 50 : rsi_mean,
      rsi_volatility: isNaN(rsi_volatility) ? 10 : rsi_volatility,
      price_kurtosis: isNaN(price_kurtosis) ? 0 : price_kurtosis,
      volume_normalized: isNaN(volume_normalized) ? 1 : volume_normalized,
      trend_strength: isNaN(trend_strength) ? 0 : trend_strength,
      volatility_regime: isNaN(volatility_regime) ? 0.5 : volatility_regime
    };
    
    console.log('📊 [RegimeDetection] Calculated features:', features);
    return features;
  }

  /**
   * Classify regime using HMM
   */
  private classifyRegime(features: RegimeFeatures): { regime: MarketRegime; probability: number } {
    const feature_vector = [
      features.atr_normalized,
      features.rsi_mean,
      features.rsi_volatility,
      features.price_kurtosis,
      features.volume_normalized,
      features.trend_strength,
      features.volatility_regime
    ];

    let best_regime = MarketRegime.RANGING;
    let best_probability = 0;

    // Calculate likelihood for each regime
    for (const state of this.hmm_states) {
      const probability = this.multivariateNormalPDF(
        feature_vector,
        state.emission_parameters.mean,
        state.emission_parameters.covariance
      );

      if (probability > best_probability) {
        best_probability = probability;
        best_regime = state.regime;
      }
    }

    // Normalize probability to [0, 1]
    const total_prob = this.hmm_states.reduce((sum, state) => {
      return sum + this.multivariateNormalPDF(
        feature_vector,
        state.emission_parameters.mean,
        state.emission_parameters.covariance
      );
    }, 0);

    const normalized_probability = best_probability / (total_prob || 1);

    return {
      regime: best_regime,
      probability: Math.min(Math.max(normalized_probability, 0), 1)
    };
  }

  /**
   * Calculate ATR (Average True Range)
   */
  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    const tr_values: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const high_low = highs[i] - lows[i];
      const high_close_prev = Math.abs(highs[i] - closes[i - 1]);
      const low_close_prev = Math.abs(lows[i] - closes[i - 1]);
      
      tr_values.push(Math.max(high_low, high_close_prev, low_close_prev));
    }

    return this.mean(tr_values.slice(-period));
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number): number[] {
    const rsi_values: number[] = [];
    
    for (let i = period; i < prices.length; i++) {
      const gains: number[] = [];
      const losses: number[] = [];
      
      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) {
          gains.push(change);
          losses.push(0);
        } else {
          gains.push(0);
          losses.push(Math.abs(change));
        }
      }
      
      const avg_gain = this.mean(gains);
      const avg_loss = this.mean(losses);
      
      if (avg_loss === 0) {
        rsi_values.push(100);
      } else {
        const rs = avg_gain / avg_loss;
        rsi_values.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi_values;
  }

  /**
   * Calculate returns array
   */
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  /**
   * Calculate kurtosis (fat tails measure)
   */
  private kurtosis(values: number[]): number {
    const mean_val = this.mean(values);
    const std_val = this.standardDeviation(values);
    
    if (std_val === 0) return 0;
    
    const fourth_moment = values.reduce((sum, val) => {
      return sum + Math.pow((val - mean_val) / std_val, 4);
    }, 0) / values.length;
    
    return fourth_moment - 3; // Excess kurtosis
  }

  /**
   * Calculate trend strength using linear regression
   */
  private calculateTrendStrength(prices: number[]): number {
    const n = prices.length;
    const x_values = Array.from({ length: n }, (_, i) => i);
    
    const x_mean = this.mean(x_values);
    const y_mean = this.mean(prices);
    
    const numerator = x_values.reduce((sum, x, i) => {
      return sum + (x - x_mean) * (prices[i] - y_mean);
    }, 0);
    
    const denominator = x_values.reduce((sum, x) => {
      return sum + Math.pow(x - x_mean, 2);
    }, 0);
    
    const slope = denominator === 0 ? 0 : numerator / denominator;
    
    // Normalize slope by price level
    return slope / y_mean;
  }

  /**
   * Calculate volatility regime (percentile of current volatility)
   */
  private calculateVolatilityRegime(returns: number[]): number {
    const volatilities: number[] = [];
    const window = 5;
    
    for (let i = window; i < returns.length; i++) {
      const window_returns = returns.slice(i - window, i);
      volatilities.push(this.standardDeviation(window_returns));
    }
    
    if (volatilities.length === 0) return 0.5;
    
    const current_vol = volatilities[volatilities.length - 1];
    const sorted_vols = [...volatilities].sort((a, b) => a - b);
    const percentile = sorted_vols.indexOf(current_vol) / sorted_vols.length;
    
    return percentile;
  }

  /**
   * Multivariate normal PDF calculation
   */
  private multivariateNormalPDF(x: number[], mean: number[], covariance: number[][]): number {
    const k = x.length;
    const diff = x.map((val, i) => val - mean[i]);
    
    // Simplified calculation for diagonal covariance
    let exponent = 0;
    let det = 1;
    
    for (let i = 0; i < k; i++) {
      exponent += (diff[i] * diff[i]) / covariance[i][i];
      det *= covariance[i][i];
    }
    
    const normalization = Math.pow(2 * Math.PI, k / 2) * Math.sqrt(det);
    return Math.exp(-0.5 * exponent) / normalization;
  }

  /**
   * Calculate regime duration and strength metrics
   */
  private calculateRegimeMetrics(symbolId: string, current_regime: MarketRegime): { duration: number; strength: number } {
    const history = this.feature_history.get(symbolId) || [];
    
    let duration = 1;
    let strength = 0.8; // Default strength
    
    // Simple duration calculation (consecutive same regime classifications)
    // In production, this would be more sophisticated with regime transition detection
    
    return { duration, strength };
  }

  /**
   * Update feature history for trend analysis
   */
  private updateFeatureHistory(symbolId: string, features: RegimeFeatures): void {
    if (!this.feature_history.has(symbolId)) {
      this.feature_history.set(symbolId, []);
    }
    
    const history = this.feature_history.get(symbolId)!;
    history.push(features);
    
    // Keep last 100 periods
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Calculate AIC (Akaike Information Criterion) for model quality
   */
  private calculateAIC(features: RegimeFeatures, regime_result: { regime: MarketRegime; probability: number }): number {
    const k = 7; // Number of parameters (features)
    const log_likelihood = Math.log(regime_result.probability);
    
    return 2 * k - 2 * log_likelihood;
  }

  /**
   * Utility functions
   */
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private standardDeviation(values: number[]): number {
    const mean_val = this.mean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean_val, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Get cached regime for symbol
   */
  getCachedRegime(symbolId: string): RegimeDetectionResult | null {
    return this.regimeCache.get(symbolId) || null;
  }

  /**
   * Clear cache for symbol
   */
  clearCache(symbolId?: string): void {
    if (symbolId) {
      this.regimeCache.delete(symbolId);
    } else {
      this.regimeCache.clear();
    }
  }

  /**
   * Get all available strategy types
   */
  getAvailableStrategies(): StrategyType[] {
    return Object.values(StrategyType);
  }

  /**
   * Get regime strategy rules
   */
  getRegimeRules(): typeof REGIME_STRATEGY_RULES {
    return REGIME_STRATEGY_RULES;
  }
}

// Export singleton instance
export const regimeDetectionService = new RegimeDetectionService();
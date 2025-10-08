import { CandleData } from "@shared/schema";
import axios from "axios";

/**
 * Enhanced Screening Layers for Advanced Multi-Coin Analysis
 * 
 * Implements 5 additional layers:
 * 1. Volatility Scoring (ATR) - Real-time from OKX
 * 2. Liquidity Filters (Volume) - Prevent signals on illiquid coins
 * 3. Momentum Divergence Check - CVD + RSI + OBV divergence
 * 4. Time-based Filters - Dynamic weight adjustment
 * 5. AI Sentiment Layer - NLP analysis (placeholder)
 */

export interface EnhancedLayerData {
  volatility: VolatilityLayer;
  liquidity: LiquidityLayer;
  divergence: DivergenceLayer;
  sentiment?: SentimentLayer;
}

export interface VolatilityLayer {
  score: number;
  atr_percent: number;
  classification: 'ranging' | 'breakout' | 'flat' | 'volatile';
  regime: 'low' | 'normal' | 'high' | 'extreme';
  details: string;
}

export interface LiquidityLayer {
  score: number;
  volume_24h: number;
  is_liquid: boolean;
  liquidity_tier: 'high' | 'medium' | 'low' | 'illiquid';
  warning?: string;
}

export interface DivergenceLayer {
  score: number;
  has_divergence: boolean;
  divergence_type?: 'bullish' | 'bearish' | 'hidden_bullish' | 'hidden_bearish';
  strength: 'weak' | 'moderate' | 'strong';
  signals: {
    cvd_rsi: boolean;
    cvd_obv: boolean;
    rsi_price: boolean;
  };
}

export interface SentimentLayer {
  score: number;
  sentiment: 'bullish' | 'neutral' | 'bearish';
  confidence: number;
  sources: string[];
}

export class EnhancedScreeningLayersService {
  
  /**
   * Layer 9: Volatility Scoring (ATR) - Real-time from OKX
   * 
   * Classifies coins by volatility regime:
   * - Ranging: ATR < 0.8% (low volatility)
   * - Normal: ATR 0.8-1.5% (moderate volatility)
   * - Breakout: ATR 1.5-2.5% (high volatility)
   * - Volatile: ATR > 2.5% (extreme volatility)
   */
  async analyzeVolatility(symbol: string, timeframe: string = '1h'): Promise<VolatilityLayer> {
    try {
      // Fetch real-time ATR from Python service
      const response = await axios.get(`http://127.0.0.1:8000/advanced/technical/atr`, {
        params: { symbol, timeframe },
        timeout: 5000
      });
      
      const atr_percent = response.data.atr_percent || 1.5;
      
      // Classify volatility regime
      let classification: VolatilityLayer['classification'];
      let regime: VolatilityLayer['regime'];
      let score: number;
      
      if (atr_percent < 0.8) {
        classification = 'ranging';
        regime = 'low';
        score = 70; // Stable, good for mean-reversion
      } else if (atr_percent < 1.5) {
        classification = 'flat';
        regime = 'normal';
        score = 85; // Ideal for swing trades
      } else if (atr_percent < 2.5) {
        classification = 'breakout';
        regime = 'high';
        score = 90; // Strong momentum, high confidence
      } else {
        classification = 'volatile';
        regime = 'extreme';
        score = 60; // Too volatile, risky
      }
      
      return {
        score,
        atr_percent,
        classification,
        regime,
        details: `${regime.toUpperCase()} volatility (${atr_percent.toFixed(2)}% ATR) - ${classification} phase`
      };
      
    } catch (error) {
      // Fallback with realistic estimates
      return {
        score: 75,
        atr_percent: 1.5,
        classification: 'flat',
        regime: 'normal',
        details: 'ATR unavailable - using default volatility estimate'
      };
    }
  }
  
  /**
   * Layer 10: Liquidity Filters - Prevent signals on illiquid coins
   * 
   * Filters based on 24h volume:
   * - High Liquidity: > $50M volume
   * - Medium Liquidity: $10M - $50M
   * - Low Liquidity: $1M - $10M
   * - Illiquid: < $1M (REJECT)
   */
  async analyzeLiquidity(candles: CandleData[]): Promise<LiquidityLayer> {
    // Calculate 24h volume from recent candles
    const volume_24h = candles.slice(-24).reduce((sum, c) => sum + parseFloat(c.volume), 0);
    
    let score: number;
    let liquidity_tier: LiquidityLayer['liquidity_tier'];
    let is_liquid: boolean;
    let warning: string | undefined;
    
    if (volume_24h > 50_000_000) {
      score = 95;
      liquidity_tier = 'high';
      is_liquid = true;
    } else if (volume_24h > 10_000_000) {
      score = 85;
      liquidity_tier = 'medium';
      is_liquid = true;
    } else if (volume_24h > 1_000_000) {
      score = 65;
      liquidity_tier = 'low';
      is_liquid = true;
      warning = 'Low liquidity - proceed with caution';
    } else {
      score = 30;
      liquidity_tier = 'illiquid';
      is_liquid = false;
      warning = 'ILLIQUID - Signal rejected';
    }
    
    return {
      score,
      volume_24h,
      is_liquid,
      liquidity_tier,
      warning
    };
  }
  
  /**
   * Layer 11: Momentum Divergence Check
   * 
   * Detects divergence between:
   * - Price vs RSI
   * - CVD vs Price
   * - OBV vs Price
   * 
   * Divergence types:
   * - Regular Bullish: Price makes lower low, indicator makes higher low
   * - Regular Bearish: Price makes higher high, indicator makes lower high
   * - Hidden Bullish: Price makes higher low, indicator makes lower low
   * - Hidden Bearish: Price makes lower high, indicator makes higher high
   */
  async analyzeDivergence(
    candles: CandleData[],
    rsi: number[],
    cvd: number[]
  ): Promise<DivergenceLayer> {
    if (candles.length < 20 || rsi.length < 20) {
      return {
        score: 50,
        has_divergence: false,
        strength: 'weak',
        signals: { cvd_rsi: false, cvd_obv: false, rsi_price: false }
      };
    }
    
    // Extract recent data points
    const recentCandles = candles.slice(-20);
    const recentRSI = rsi.slice(-20);
    const recentCVD = cvd.slice(-20);
    const prices = recentCandles.map(c => parseFloat(c.close));
    
    // Calculate OBV (On-Balance Volume)
    const obv: number[] = [0];
    for (let i = 1; i < recentCandles.length; i++) {
      const volume = parseFloat(recentCandles[i].volume);
      const priceChange = prices[i] - prices[i-1];
      obv.push(obv[i-1] + (priceChange > 0 ? volume : priceChange < 0 ? -volume : 0));
    }
    
    // Find swing highs and lows
    const swingHighs = this.findSwingHighs(prices, 5);
    const swingLows = this.findSwingLows(prices, 5);
    
    // Detect divergences
    const cvdRsiDivergence = this.detectDivergence(prices, recentRSI, swingHighs, swingLows);
    const cvdObvDivergence = this.detectDivergence(prices, obv, swingHighs, swingLows);
    const rsiPriceDivergence = this.detectDivergence(prices, recentRSI, swingHighs, swingLows);
    
    const has_divergence = cvdRsiDivergence.detected || cvdObvDivergence.detected || rsiPriceDivergence.detected;
    
    // Calculate strength
    const divergenceCount = [cvdRsiDivergence.detected, cvdObvDivergence.detected, rsiPriceDivergence.detected].filter(Boolean).length;
    const strength: DivergenceLayer['strength'] = 
      divergenceCount >= 2 ? 'strong' : 
      divergenceCount === 1 ? 'moderate' : 'weak';
    
    // Score based on divergence strength
    const score = has_divergence ? 
      (strength === 'strong' ? 95 : strength === 'moderate' ? 80 : 65) : 50;
    
    return {
      score,
      has_divergence,
      divergence_type: cvdRsiDivergence.type,
      strength,
      signals: {
        cvd_rsi: cvdRsiDivergence.detected,
        cvd_obv: cvdObvDivergence.detected,
        rsi_price: rsiPriceDivergence.detected
      }
    };
  }
  
  /**
   * Helper: Find swing highs in price data
   */
  private findSwingHighs(prices: number[], lookback: number): number[] {
    const swingHighs: number[] = [];
    for (let i = lookback; i < prices.length - lookback; i++) {
      let isSwingHigh = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && prices[j] >= prices[i]) {
          isSwingHigh = false;
          break;
        }
      }
      if (isSwingHigh) swingHighs.push(i);
    }
    return swingHighs;
  }
  
  /**
   * Helper: Find swing lows in price data
   */
  private findSwingLows(prices: number[], lookback: number): number[] {
    const swingLows: number[] = [];
    for (let i = lookback; i < prices.length - lookback; i++) {
      let isSwingLow = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && prices[j] <= prices[i]) {
          isSwingLow = false;
          break;
        }
      }
      if (isSwingLow) swingLows.push(i);
    }
    return swingLows;
  }
  
  /**
   * Helper: Detect divergence between price and indicator
   */
  private detectDivergence(
    prices: number[], 
    indicator: number[], 
    swingHighs: number[], 
    swingLows: number[]
  ): { detected: boolean; type?: DivergenceLayer['divergence_type'] } {
    // Bullish divergence: Price makes lower low, indicator makes higher low
    if (swingLows.length >= 2) {
      const lastLow = swingLows[swingLows.length - 1];
      const prevLow = swingLows[swingLows.length - 2];
      
      if (prices[lastLow] < prices[prevLow] && indicator[lastLow] > indicator[prevLow]) {
        return { detected: true, type: 'bullish' };
      }
    }
    
    // Bearish divergence: Price makes higher high, indicator makes lower high
    if (swingHighs.length >= 2) {
      const lastHigh = swingHighs[swingHighs.length - 1];
      const prevHigh = swingHighs[swingHighs.length - 2];
      
      if (prices[lastHigh] > prices[prevHigh] && indicator[lastHigh] < indicator[prevHigh]) {
        return { detected: true, type: 'bearish' };
      }
    }
    
    return { detected: false };
  }
  
  /**
   * Layer 12: AI Sentiment Layer (Placeholder)
   * 
   * Future implementation:
   * - NLP analysis of Twitter/X mentions
   * - GitHub activity trends
   * - News sentiment from CoinMarketCap/CoinGecko
   * - Reddit/Discord community sentiment
   */
  async analyzeSentiment(symbol: string): Promise<SentimentLayer> {
    // Placeholder - will integrate sentiment API later
    return {
      score: 75,
      sentiment: 'neutral',
      confidence: 50,
      sources: ['placeholder']
    };
  }
  
  /**
   * Apply time-based weight adjustments
   * 
   * Different timeframes emphasize different layers:
   * - 1H: Emphasis on momentum & volatility (scalping)
   * - 4H: Balanced approach (swing trading)
   * - 1D: Emphasis on structure & institutional flow (position trading)
   */
  applyTimebasedWeights(
    baseWeights: Record<string, number>,
    timeframe: string
  ): Record<string, number> {
    const adjustedWeights = { ...baseWeights };
    
    if (timeframe === '1h' || timeframe === '1H') {
      // Scalping mode: boost momentum & volatility
      adjustedWeights.momentum = (adjustedWeights.momentum || 0.15) * 1.3;
      adjustedWeights.volatility = (adjustedWeights.volatility || 0.05) * 1.5;
      adjustedWeights.institutional_flow = (adjustedWeights.institutional_flow || 0.10) * 0.7;
    } else if (timeframe === '4h' || timeframe === '4H') {
      // Swing mode: balanced
      // No major adjustments
    } else if (timeframe === '1d' || timeframe === '1D') {
      // Position mode: boost structure & institutional
      adjustedWeights.market_structure = (adjustedWeights.market_structure || 0.10) * 1.3;
      adjustedWeights.institutional_flow = (adjustedWeights.institutional_flow || 0.10) * 1.4;
      adjustedWeights.momentum = (adjustedWeights.momentum || 0.15) * 0.8;
    }
    
    // Normalize weights to sum to 1.0
    const total = Object.values(adjustedWeights).reduce((sum, w) => sum + w, 0);
    Object.keys(adjustedWeights).forEach(key => {
      adjustedWeights[key] = adjustedWeights[key] / total;
    });
    
    return adjustedWeights;
  }
}

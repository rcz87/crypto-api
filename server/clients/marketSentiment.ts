import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { track404 } from '../services/route404Tracker';
import { coinAPIService } from '../services/coinapi';

const FEAT = (name: string) =>
  (process.env[`FEATURE_${name}`] ?? 'on').toLowerCase() !== 'off';

export interface MarketSentimentData {
  symbol: string;
  price: number;
  change_24h: number;
  change_percentage_24h: number;
  volume_24h: number;
  market_cap?: number;
  dominance?: number;
  timestamp?: string | number;
}

export interface SentimentDriver {
  factor: string;
  impact: number;
  description: string;
}

export interface RetailIndicators {
  volume_spike_24h: number;
  volume_vs_avg_7d: number;
  price_velocity: number;
  market_behavior_score: number;
  sudden_inflow_detected: boolean;
}

export interface FomoDriver {
  factor: string;
  impact: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface MarketSentimentResponse {
  ok: boolean;
  module: string;
  symbol?: string;
  score: number; // -100 to 100 (Fear & Greed Index)
  label: string; // "bullish" | "bearish" | "neutral"
  drivers: SentimentDriver[];
  // New FOMO Detection Fields
  fomo_score: number; // 0-100 scale (100 = Extreme FOMO)
  fomo_label: string; // "no-fomo" | "mild-fomo" | "moderate-fomo" | "extreme-fomo"
  retail_indicators: RetailIndicators;
  fomo_drivers: FomoDriver[];
  raw: {
    funding_rate?: number;
    long_short_ratio?: number;
    oi_change?: number;
    volume_delta?: number;
    price_change_24h?: number;
    volatility_24h?: number;
    dominance?: number;
    volume_vs_avg?: number;
  };
  used_sources: string[];
  summary: string;
}

export async function getMarketSentiment(symbol?: string): Promise<MarketSentimentResponse> {
  const targetSymbol = symbol || 'BTC';
  
  try {
    console.log(`[MarketSentiment] Calculating Fear & Greed Index for ${targetSymbol}`);
    
    // Get comprehensive market sentiment data from CoinAPI
    const sentimentData = await coinAPIService.getMarketSentimentData(targetSymbol);
    
    // Calculate Fear & Greed Index using real market data
    const fearGreedResult = calculateFearGreedIndex(sentimentData);
    
    // Calculate retail FOMO detection
    const fomoResult = calculateRetailFOMO(sentimentData, fearGreedResult);
    
    return {
      ok: true,
      module: 'market_sentiment',
      symbol: targetSymbol,
      score: fearGreedResult.score,
      label: fearGreedResult.label,
      drivers: fearGreedResult.drivers,
      // FOMO Detection Results
      fomo_score: fomoResult.fomo_score,
      fomo_label: fomoResult.fomo_label,
      retail_indicators: fomoResult.retail_indicators,
      fomo_drivers: fomoResult.fomo_drivers,
      raw: {
        funding_rate: undefined, // Not available from current data sources
        long_short_ratio: undefined, // Not available from current data sources
        oi_change: undefined, // Not available from current data sources
        volume_delta: sentimentData.asset_data.volume_24h_usd,
        price_change_24h: sentimentData.asset_data.price_change_24h_percentage,
        volatility_24h: sentimentData.asset_data.volatility_24h,
        dominance: sentimentData.market_overview.bitcoin_dominance_percentage,
        volume_vs_avg: sentimentData.volume_context.volume_vs_avg_7d
      },
      used_sources: ['coinapi', 'market_overview', 'historical_data'],
      summary: `${targetSymbol} Fear & Greed Index: ${fearGreedResult.label} (${fearGreedResult.score}/100) | FOMO: ${fomoResult.fomo_label} (${fomoResult.fomo_score}/100) - ${fearGreedResult.description}`
    };
    
  } catch (coinApiError: any) {
    console.warn(`[MarketSentiment] CoinAPI failed, trying fallback sources:`, coinApiError.message);
    
    // Fallback to existing endpoints as backup
    return await getFallbackSentiment(targetSymbol, coinApiError);
  }
}

/**
 * Fallback sentiment calculation using existing endpoints
 */
async function getFallbackSentiment(symbol: string, primaryError: any): Promise<MarketSentimentResponse> {
  const map = await getApiMap();
  const base = map['market_sentiment'] || '/advanced/market/sentiment';
  
  const candidates = [
    base,
    '/advanced/market/sentiment',
    '/api/futures/coins-markets'
  ];

  let lastErr: any = primaryError;
  for (const url of candidates) {
    try {
      const rawData = await getJson(url);
      
      // Transform Python response to sentiment analysis
      const marketData: MarketSentimentData[] = Array.isArray(rawData) ? rawData : (rawData.data || []);
      const symbolData = marketData.find(item => 
        item.symbol?.toUpperCase() === symbol.toUpperCase()
      ) || marketData[0];

      if (!symbolData) {
        throw new Error('No market data available');
      }

      // Calculate sentiment score using fallback data (convert to 0-100 scale)
      const legacyScore = calculateLegacySentimentScore(symbolData);
      const fearGreedScore = convertToFearGreedScale(legacyScore);
      const sentimentLabel = getFearGreedLabel(fearGreedScore);
      const drivers = generateFallbackSentimentDrivers(symbolData);

      // Fallback FOMO calculation with limited data
      const fallbackFomoResult = calculateFallbackFOMO(symbolData, fearGreedScore);
      
      return {
        ok: true,
        module: 'market_sentiment',
        symbol: symbolData.symbol,
        score: fearGreedScore,
        label: sentimentLabel,
        drivers: drivers,
        // Fallback FOMO fields
        fomo_score: fallbackFomoResult.fomo_score,
        fomo_label: fallbackFomoResult.fomo_label,
        retail_indicators: fallbackFomoResult.retail_indicators,
        fomo_drivers: fallbackFomoResult.fomo_drivers,
        raw: {
          volume_delta: symbolData.change_24h,
          price_change_24h: symbolData.change_percentage_24h
        },
        used_sources: ['coinglass_fallback', 'futures_markets'],
        summary: `${symbolData.symbol} Fear & Greed Index (fallback): ${sentimentLabel} (${fearGreedScore}/100) | FOMO: ${fallbackFomoResult.fomo_label} (${fallbackFomoResult.fomo_score}/100)`
      };
    }
    catch (e: any) {
      if (e.status === 404) {
        console.warn('[MarketSentiment] 404 error - continuing to next candidate');
        lastErr = e;
        continue;
      }
      lastErr = e;
      break;
    }
  }

  const err: any = new Error('MARKET_SENTIMENT_NOT_AVAILABLE');
  err.cause = lastErr;
  throw err;
}

/**
 * Calculate Fear & Greed Index using real CoinAPI market data
 * Returns score on 0-100 scale (0=Extreme Fear, 100=Extreme Greed)
 */
function calculateFearGreedIndex(data: any): {
  score: number;
  label: string;
  description: string;
  drivers: SentimentDriver[];
} {
  let totalScore = 0;
  const drivers: SentimentDriver[] = [];
  
  // 1. Price Momentum (40% weight)
  const priceChange = data.asset_data.price_change_24h_percentage || 0;
  const volatility = data.asset_data.volatility_24h || 0;
  
  // Normalize price change: +10% = bullish, -10% = bearish
  let priceScore = 50 + (priceChange * 2.5); // Scale: -10% -> 25, +10% -> 75
  
  // Adjust for volatility: high volatility reduces confidence
  if (volatility > 10) {
    priceScore = priceScore * 0.8; // Reduce score by 20% for high volatility
  }
  
  priceScore = Math.max(0, Math.min(100, priceScore));
  totalScore += priceScore * 0.4;
  
  drivers.push({
    factor: 'price_momentum',
    impact: Math.round((priceScore - 50) * 0.4),
    description: `24h price change: ${priceChange.toFixed(2)}% (volatility: ${volatility.toFixed(1)}%)`
  });
  
  // 2. Volume Analysis (30% weight)
  const volumeVsAvg = data.volume_context.volume_vs_avg_7d || 1;
  const volumeChange = data.market_overview.volume_change_24h_percentage || 0;
  
  // High volume during price increases = bullish, high volume during decreases = bearish
  let volumeScore = 50;
  if (volumeVsAvg > 1.2) {
    // Above average volume
    volumeScore = priceChange > 0 ? 75 : 25; // Amplify price direction
  } else if (volumeVsAvg < 0.8) {
    // Below average volume - neutral to slightly bearish
    volumeScore = 40;
  } else {
    // Normal volume
    volumeScore = 50 + (volumeChange * 1.5);
  }
  
  volumeScore = Math.max(0, Math.min(100, volumeScore));
  totalScore += volumeScore * 0.3;
  
  drivers.push({
    factor: 'trading_volume',
    impact: Math.round((volumeScore - 50) * 0.3),
    description: `Volume vs 7d avg: ${(volumeVsAvg * 100).toFixed(0)}% (${data.volume_context.is_above_average ? 'above' : 'below'} average)`
  });
  
  // 3. Market Dominance (30% weight) - BTC dominance indicates market sentiment
  const btcDominance = data.market_overview.bitcoin_dominance_percentage || 50;
  const dominanceChange = data.market_overview.market_cap_change_24h_percentage || 0;
  
  // Rising BTC dominance during positive price action = fear in alts, bullish for BTC
  // Falling BTC dominance during positive market = greed in alts
  let dominanceScore = 50;
  
  if (data.asset_data.symbol === 'BTC') {
    // For BTC: higher dominance = more bullish
    dominanceScore = 30 + (btcDominance * 0.8); // 40% dominance = 62, 60% = 78
  } else {
    // For alts: lower BTC dominance = more bullish for alts
    dominanceScore = 80 - (btcDominance * 0.6); // 40% dominance = 56, 60% = 44
  }
  
  // Adjust for overall market direction
  dominanceScore += dominanceChange * 2;
  
  dominanceScore = Math.max(0, Math.min(100, dominanceScore));
  totalScore += dominanceScore * 0.3;
  
  drivers.push({
    factor: 'market_dominance',
    impact: Math.round((dominanceScore - 50) * 0.3),
    description: `BTC dominance: ${btcDominance.toFixed(1)}% (market cap change: ${dominanceChange.toFixed(2)}%)`
  });
  
  // Final score (0-100 scale)
  const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  const label = getFearGreedLabel(finalScore);
  
  let description = 'Based on price momentum, volume analysis, and market dominance';
  if (data.data_quality.quality !== 'good') {
    description += ' (using partial data)';
  }
  
  console.log(`[FearGreed] ${data.asset_data.symbol}: Price(${priceScore.toFixed(1)}) + Volume(${volumeScore.toFixed(1)}) + Dominance(${dominanceScore.toFixed(1)}) = ${finalScore}`);
  
  return {
    score: finalScore,
    label,
    description,
    drivers
  };
}

/**
 * Legacy sentiment calculation for fallback (returns -100 to 100)
 */
function calculateLegacySentimentScore(data: MarketSentimentData): number {
  let score = 0;
  
  // Price change contribution (40% weight)
  const priceChange = data.change_percentage_24h || 0;
  score += priceChange * 0.4;
  
  // Volume contribution (30% weight)
  const volumeScore = data.volume_24h > 1000000000 ? 20 : (data.volume_24h > 100000000 ? 10 : 0);
  score += volumeScore * 0.3;
  
  // Market cap dominance (30% weight)
  const dominanceScore = (data.dominance || 50) > 40 ? 15 : 5;
  score += dominanceScore * 0.3;
  
  // Clamp between -100 and 100
  return Math.max(-100, Math.min(100, Math.round(score)));
}

/**
 * Convert legacy score (-100 to 100) to Fear & Greed scale (0 to 100)
 */
function convertToFearGreedScale(legacyScore: number): number {
  // Convert -100 to 100 range to 0 to 100 range
  return Math.max(0, Math.min(100, Math.round((legacyScore + 100) / 2)));
}

/**
 * Get Fear & Greed label based on 0-100 scale
 */
function getFearGreedLabel(score: number): string {
  if (score >= 80) return 'extreme_greed';
  if (score >= 60) return 'greed';
  if (score >= 40) return 'neutral';
  if (score >= 20) return 'fear';
  return 'extreme_fear';
}

/**
 * Legacy sentiment label for fallback
 */
function getSentimentLabel(score: number): string {
  if (score > 20) return 'bullish';
  if (score < -20) return 'bearish';
  return 'neutral';
}

/**
 * Generate sentiment drivers for fallback data
 */
function generateFallbackSentimentDrivers(data: MarketSentimentData): SentimentDriver[] {
  const drivers: SentimentDriver[] = [];
  
  // Price momentum driver
  const priceChange = data.change_percentage_24h || 0;
  drivers.push({
    factor: 'price_momentum',
    impact: Math.round(priceChange * 0.4),
    description: `24h price change: ${priceChange.toFixed(2)}%`
  });
  
  // Volume driver
  const volumeImpact = data.volume_24h > 1000000000 ? 25 : (data.volume_24h > 100000000 ? 15 : 5);
  drivers.push({
    factor: 'trading_volume',
    impact: Math.round(volumeImpact * 0.3),
    description: `24h volume: $${(data.volume_24h / 1000000).toFixed(0)}M`
  });
  
  // Market dominance driver (if available)
  if (data.dominance) {
    drivers.push({
      factor: 'market_dominance',
      impact: Math.round((data.dominance / 2) * 0.3),
      description: `Market dominance: ${data.dominance.toFixed(1)}%`
    });
  }
  
  return drivers;
}

/**
 * Calculate retail FOMO detection using comprehensive market data
 * Implements volume spike detection and social sentiment indicators
 * Returns FOMO score on 0-100 scale (100 = Extreme FOMO)
 */
function calculateRetailFOMO(data: any, fearGreedResult: any): {
  fomo_score: number;
  fomo_label: string;
  retail_indicators: RetailIndicators;
  fomo_drivers: FomoDriver[];
} {
  const drivers: FomoDriver[] = [];
  let totalScore = 0;
  
  // 1. Volume Spike Detection (50% weight)
  const volumeVsAvg = data.volume_context?.volume_vs_avg_7d || 1;
  const currentVolume24h = data.asset_data?.volume_24h_usd || 0;
  
  let volumeScore = 0;
  if (volumeVsAvg > 3.0) {
    // >300% = Extreme FOMO signal
    volumeScore = 100;
    drivers.push({
      factor: 'extreme_volume_spike',
      impact: 50,
      description: `Volume is ${Math.round(volumeVsAvg * 100)}% of 7-day average - extreme retail activity detected`,
      severity: 'high'
    });
  } else if (volumeVsAvg > 2.0) {
    // >200% = Strong FOMO signal
    volumeScore = 75;
    drivers.push({
      factor: 'high_volume_spike',
      impact: 37,
      description: `Volume is ${Math.round(volumeVsAvg * 100)}% of 7-day average - high retail FOMO`,
      severity: 'high'
    });
  } else if (volumeVsAvg > 1.5) {
    // >150% = Moderate FOMO
    volumeScore = 50;
    drivers.push({
      factor: 'moderate_volume_increase',
      impact: 25,
      description: `Volume is ${Math.round(volumeVsAvg * 100)}% above average - moderate FOMO`,
      severity: 'medium'
    });
  } else {
    volumeScore = Math.min(25, volumeVsAvg * 25); // Scale normal volume
    drivers.push({
      factor: 'normal_volume',
      impact: 0,
      description: `Volume is ${Math.round(volumeVsAvg * 100)}% of average - no FOMO detected`,
      severity: 'low'
    });
  }
  
  totalScore += volumeScore * 0.5;
  
  // 2. Price Velocity Analysis (30% weight)
  const priceChange24h = data.asset_data?.price_change_24h_percentage || 0;
  const volatility24h = data.asset_data?.volatility_24h || 0;
  
  // High velocity + high volume = retail FOMO
  const priceVelocity = Math.abs(priceChange24h) * (volumeVsAvg / 2);
  let velocityScore = 0;
  
  if (priceVelocity > 15 && priceChange24h > 0) {
    // Strong upward momentum with volume
    velocityScore = 90;
    drivers.push({
      factor: 'explosive_price_velocity',
      impact: 27,
      description: `Price velocity ${priceVelocity.toFixed(1)} with +${priceChange24h.toFixed(1)}% gain - retail FOMO momentum`,
      severity: 'high'
    });
  } else if (priceVelocity > 10 && priceChange24h > 0) {
    velocityScore = 70;
    drivers.push({
      factor: 'high_price_velocity',
      impact: 21,
      description: `Strong price velocity ${priceVelocity.toFixed(1)} - building FOMO`,
      severity: 'medium'
    });
  } else if (priceChange24h < -10 && volumeVsAvg > 1.5) {
    // Fear selling with volume
    velocityScore = 20;
    drivers.push({
      factor: 'panic_selling',
      impact: 6,
      description: `Price down ${priceChange24h.toFixed(1)}% with high volume - fear selling`,
      severity: 'medium'
    });
  } else {
    velocityScore = Math.max(0, 50 + (priceChange24h * 2));
    drivers.push({
      factor: 'normal_price_action',
      impact: 0,
      description: `Normal price velocity - no FOMO signals`,
      severity: 'low'
    });
  }
  
  totalScore += velocityScore * 0.3;
  
  // 3. Market Behavior Analysis (20% weight)
  const marketCap = data.asset_data?.market_cap_usd || 0;
  const dominance = data.market_overview?.bitcoin_dominance_percentage || 0;
  
  let behaviorScore = 50; // Default neutral
  
  // Small cap behavior analysis
  if (marketCap > 0 && marketCap < 10000000000) { // < $10B = small cap
    if (volumeVsAvg > 2 && priceChange24h > 5) {
      behaviorScore = 85; // Small cap pump with volume = retail FOMO
      drivers.push({
        factor: 'small_cap_pump',
        impact: 17,
        description: `Small cap (${(marketCap/1000000000).toFixed(1)}B) with high volume - typical retail FOMO pattern`,
        severity: 'high'
      });
    }
  }
  
  // Bitcoin dominance impact
  if (dominance < 45 && priceChange24h > 0) {
    // Low BTC dominance + alt pumping = alt season FOMO
    behaviorScore += 15;
    drivers.push({
      factor: 'alt_season_fomo',
      impact: 3,
      description: `BTC dominance ${dominance.toFixed(1)}% - alt season FOMO building`,
      severity: 'low'
    });
  }
  
  totalScore += behaviorScore * 0.2;
  
  // Cap score at 100
  const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));
  
  // Determine FOMO label
  let fomoLabel = 'no-fomo';
  if (finalScore >= 80) fomoLabel = 'extreme-fomo';
  else if (finalScore >= 60) fomoLabel = 'moderate-fomo';
  else if (finalScore >= 40) fomoLabel = 'mild-fomo';
  
  // Build retail indicators
  const retailIndicators: RetailIndicators = {
    volume_spike_24h: Math.round((volumeVsAvg - 1) * 100), // % above average
    volume_vs_avg_7d: volumeVsAvg,
    price_velocity: Math.round(priceVelocity * 10) / 10,
    market_behavior_score: Math.round(behaviorScore),
    sudden_inflow_detected: volumeVsAvg > 2 && priceChange24h > 3
  };
  
  return {
    fomo_score: finalScore,
    fomo_label: fomoLabel,
    retail_indicators: retailIndicators,
    fomo_drivers: drivers
  };
}

/**
 * Fallback FOMO calculation with limited data from fallback endpoints
 */
function calculateFallbackFOMO(symbolData: MarketSentimentData, fearGreedScore: number): {
  fomo_score: number;
  fomo_label: string;
  retail_indicators: RetailIndicators;
  fomo_drivers: FomoDriver[];
} {
  const drivers: FomoDriver[] = [];
  
  // Limited FOMO calculation based on price change and volume
  const priceChange = symbolData.change_percentage_24h || 0;
  const volumeChange = symbolData.change_24h || 0;
  
  let fomoScore = 25; // Default low FOMO
  
  // Simple FOMO detection with limited data
  if (priceChange > 10 && volumeChange > 0) {
    fomoScore = 70;
    drivers.push({
      factor: 'price_volume_surge',
      impact: 45,
      description: `Price up ${priceChange.toFixed(1)}% with volume increase - potential FOMO`,
      severity: 'medium'
    });
  } else if (priceChange > 5) {
    fomoScore = 45;
    drivers.push({
      factor: 'price_increase',
      impact: 20,
      description: `Price up ${priceChange.toFixed(1)}% - mild FOMO signals`,
      severity: 'low'
    });
  } else if (priceChange < -10) {
    fomoScore = 15;
    drivers.push({
      factor: 'price_decline',
      impact: -10,
      description: `Price down ${priceChange.toFixed(1)}% - fear overshadowing FOMO`,
      severity: 'low'
    });
  } else {
    drivers.push({
      factor: 'limited_data',
      impact: 0,
      description: `Limited data available - FOMO analysis incomplete`,
      severity: 'low'
    });
  }
  
  // Determine FOMO label
  let fomoLabel = 'no-fomo';
  if (fomoScore >= 60) fomoLabel = 'moderate-fomo';
  else if (fomoScore >= 40) fomoLabel = 'mild-fomo';
  
  const retailIndicators: RetailIndicators = {
    volume_spike_24h: 0, // Unknown with fallback data
    volume_vs_avg_7d: 1, // Assume average
    price_velocity: Math.abs(priceChange),
    market_behavior_score: 50, // Neutral
    sudden_inflow_detected: false // Cannot detect with limited data
  };
  
  return {
    fomo_score: fomoScore,
    fomo_label: fomoLabel,
    retail_indicators: retailIndicators,
    fomo_drivers: drivers
  };
}


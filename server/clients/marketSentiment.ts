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

export interface MarketSentimentResponse {
  ok: boolean;
  module: string;
  symbol?: string;
  score: number; // -100 to 100
  label: string; // "bullish" | "bearish" | "neutral"
  drivers: SentimentDriver[];
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
    
    return {
      ok: true,
      module: 'market_sentiment',
      symbol: targetSymbol,
      score: fearGreedResult.score,
      label: fearGreedResult.label,
      drivers: fearGreedResult.drivers,
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
      summary: `${targetSymbol} Fear & Greed Index: ${fearGreedResult.label} (${fearGreedResult.score}/100) - ${fearGreedResult.description}`
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

      return {
        ok: true,
        module: 'market_sentiment',
        symbol: symbolData.symbol,
        score: fearGreedScore,
        label: sentimentLabel,
        drivers: drivers,
        raw: {
          volume_delta: symbolData.change_24h,
          price_change_24h: symbolData.change_percentage_24h
        },
        used_sources: ['coinglass_fallback', 'futures_markets'],
        summary: `${symbolData.symbol} Fear & Greed Index (fallback): ${sentimentLabel} (${fearGreedScore}/100)`
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


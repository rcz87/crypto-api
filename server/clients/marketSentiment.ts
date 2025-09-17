import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { track404 } from '../services/route404Tracker';

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
  };
  used_sources: string[];
  summary: string;
}

export async function getMarketSentiment(symbol?: string): Promise<MarketSentimentResponse> {
  const map = await getApiMap();
  const base = map['market_sentiment'] || '/advanced/market/sentiment';
  
  const candidates = [
    base,
    '/advanced/market/sentiment',
    '/api/futures/coins-markets'
  ];

  let lastErr: any;
  for (const url of candidates) {
    try {
      const rawData = await getJson(url);
      
      // Transform Python response to sentiment analysis
      const marketData: MarketSentimentData[] = Array.isArray(rawData) ? rawData : (rawData.data || []);
      const targetSymbol = symbol || 'BTC';
      const symbolData = marketData.find(item => 
        item.symbol?.toUpperCase() === targetSymbol.toUpperCase()
      ) || marketData[0];

      if (!symbolData) {
        throw new Error('No market data available');
      }

      // Calculate sentiment score based on market data
      const sentimentScore = calculateSentimentScore(symbolData);
      const sentimentLabel = getSentimentLabel(sentimentScore);
      const drivers = generateSentimentDrivers(symbolData);

      return {
        ok: true,
        module: 'market_sentiment',
        symbol: symbolData.symbol,
        score: sentimentScore,
        label: sentimentLabel,
        drivers: drivers,
        raw: {
          volume_delta: symbolData.change_24h,
          // Add more raw data as available
        },
        used_sources: ['coinglass', 'futures_markets'],
        summary: `Market sentiment for ${symbolData.symbol}: ${sentimentLabel} (${sentimentScore}/100)`
      };
    }
    catch (e: any) {
      if (e.status === 404) {
        // Skip 404 tracking for market_sentiment since it's not in track404 Cat enum
        console.warn('[MarketSentiment] 404 error - continuing to next candidate');
        lastErr = e;
        continue;
      }
      // For other errors, try shim
      lastErr = e;
      break;
    }
  }

  // Fallback shim
  if (FEAT('MARKET_SENTIMENT_SHIM')) {
    console.log('[MarketSentiment Client] Using fallback shim');
    return await getMarketSentimentShim(symbol || 'BTC');
  }

  const err: any = new Error('MARKET_SENTIMENT_NOT_AVAILABLE');
  err.cause = lastErr;
  throw err;
}

function calculateSentimentScore(data: MarketSentimentData): number {
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

function getSentimentLabel(score: number): string {
  if (score > 20) return 'bullish';
  if (score < -20) return 'bearish';
  return 'neutral';
}

function generateSentimentDrivers(data: MarketSentimentData): SentimentDriver[] {
  const drivers: SentimentDriver[] = [];
  
  // Price momentum driver
  const priceChange = data.change_percentage_24h || 0;
  drivers.push({
    factor: 'price_momentum',
    impact: Math.round(priceChange),
    description: `24h price change: ${priceChange.toFixed(2)}%`
  });
  
  // Volume driver
  const volumeImpact = data.volume_24h > 1000000000 ? 25 : (data.volume_24h > 100000000 ? 15 : 5);
  drivers.push({
    factor: 'trading_volume',
    impact: volumeImpact,
    description: `24h volume: $${(data.volume_24h / 1000000).toFixed(0)}M`
  });
  
  // Market dominance driver (if available)
  if (data.dominance) {
    drivers.push({
      factor: 'market_dominance',
      impact: Math.round(data.dominance / 2),
      description: `Market dominance: ${data.dominance.toFixed(1)}%`
    });
  }
  
  return drivers;
}

async function getMarketSentimentShim(symbol: string): Promise<MarketSentimentResponse> {
  // Mock sentiment data for fallback
  const mockScore = Math.floor(Math.random() * 80) - 40; // -40 to 40 range
  const mockLabel = getSentimentLabel(mockScore);
  
  const mockDrivers: SentimentDriver[] = [
    {
      factor: 'price_momentum',
      impact: Math.floor(Math.random() * 20) - 10,
      description: '24h price momentum analysis'
    },
    {
      factor: 'trading_volume',
      impact: Math.floor(Math.random() * 15),
      description: 'Above-average trading activity'
    },
    {
      factor: 'market_structure',
      impact: Math.floor(Math.random() * 10) - 5,
      description: 'Overall market structure analysis'
    }
  ];

  return {
    ok: true,
    module: 'market_sentiment',
    symbol: symbol,
    score: mockScore,
    label: mockLabel,
    drivers: mockDrivers,
    raw: {
      volume_delta: Math.random() * 1000000000,
    },
    used_sources: ['fallback_shim'],
    summary: `Fallback sentiment analysis for ${symbol}: ${mockLabel} (${mockScore}/100)`
  };
}
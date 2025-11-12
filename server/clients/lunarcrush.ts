/**
 * LunarCrush API Client
 *
 * Social intelligence platform for cryptocurrency analytics
 * Provides social media sentiment, engagement metrics, and community data
 *
 * API Documentation: https://lunarcrush.com/developers/api
 *
 * Features:
 * - Social Volume & Engagement
 * - Sentiment Analysis (Twitter, Reddit, YouTube, etc)
 * - AltRank™ - Proprietary ranking system
 * - Galaxy Score™ - Overall health score
 * - Influencer Data & Sentiment
 * - Correlation Analysis
 *
 * Pricing:
 * - Free Tier: 300 requests/day
 * - Pro Tier: $99/month - 10,000 requests/day
 * - Enterprise: Custom pricing
 */

import axios, { AxiosInstance } from 'axios';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface LunarCrushCoinData {
  id: number;
  symbol: string;
  name: string;
  price: number;
  price_btc: number;
  market_cap: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d: number;
  volume_24h: number;

  // Social Metrics
  galaxy_score: number;          // 0-100 overall health score
  alt_rank: number;              // LunarCrush proprietary ranking
  alt_rank_30d: number;
  social_volume: number;         // Total social mentions
  social_volume_24h: number;
  social_engagement: number;     // Total engagement (likes, shares, etc)
  social_contributors: number;   // Unique contributors
  social_dominance: number;      // % of total crypto social volume

  // Sentiment
  sentiment: number;             // -1 to 1 (negative to positive)
  sentiment_absolute: number;
  sentiment_relative: number;

  // Trending & Momentum
  categories: string;
  interactions_24h: number;
  reddit_posts_24h: number;
  reddit_comments_24h: number;
  tweets_24h: number;

  // Time series data
  time_series?: {
    galaxy_score: number[];
    alt_rank: number[];
    social_volume: number[];
    sentiment: number[];
  };

  // Metadata
  url_shares: number;
  unique_url_shares: number;
  news: number;
  spam: number;
  last_updated: number;
}

export interface LunarCrushInfluencer {
  id: string;
  name: string;
  screen_name: string;
  followers: number;
  following: number;
  tweets: number;
  influence_score: number;
  sentiment: number;
  avatar_url: string;
}

export interface LunarCrushTimeSeries {
  symbol: string;
  time: number[];
  close: number[];
  volume: number[];
  galaxy_score: number[];
  alt_rank: number[];
  social_volume: number[];
  sentiment: number[];
  tweets: number[];
  reddit_posts: number[];
}

export interface SocialSentimentData {
  symbol: string;

  // Overall Scores
  galaxy_score: number;          // 0-100
  alt_rank: number;
  sentiment_score: number;       // -100 to 100 (normalized from -1 to 1)

  // Volume Metrics
  social_volume_24h: number;
  social_volume_change_24h: number;
  social_dominance: number;

  // Engagement
  total_engagement_24h: number;
  engagement_rate: number;
  unique_contributors: number;

  // Sentiment Breakdown
  positive_sentiment_ratio: number;
  negative_sentiment_ratio: number;
  neutral_sentiment_ratio: number;

  // Platform Breakdown
  twitter_mentions_24h: number;
  reddit_posts_24h: number;
  reddit_comments_24h: number;
  news_articles_24h: number;

  // Trend Analysis
  trending_score: number;        // 0-100
  momentum: 'rising' | 'falling' | 'stable';

  // Top Influencers (optional)
  top_influencers?: LunarCrushInfluencer[];

  timestamp: number;
}

// ============================================
// LUNARCRUSH CLIENT
// ============================================

export class LunarCrushClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.lunarcrush.com/v2';
  private client: AxiosInstance;
  private enabled: boolean;

  // Rate limiting
  private requestCount: number = 0;
  private dailyLimit: number = 300; // Free tier
  private resetTime: number = Date.now() + 24 * 60 * 60 * 1000;

  // Cache
  private cache = new Map<string, { data: any; expiry: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.apiKey = process.env.LUNARCRUSH_API_KEY || '';
    this.enabled = !!this.apiKey && this.apiKey !== 'your_lunarcrush_api_key_here';

    // Initialize axios client
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!this.enabled) {
      console.warn('⚠️  LunarCrush API key not configured. Social sentiment features disabled.');
      console.warn('   Add LUNARCRUSH_API_KEY to .env to enable social intelligence.');
    } else {
      console.log('✅ LunarCrush client initialized');

      // Set daily limit based on tier
      const tier = process.env.LUNARCRUSH_TIER || 'free';
      if (tier === 'pro') {
        this.dailyLimit = 10000;
      } else if (tier === 'enterprise') {
        this.dailyLimit = 100000;
      }
    }
  }

  /**
   * Check if LunarCrush is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check rate limit status
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Reset counter if 24 hours passed
    if (now > this.resetTime) {
      this.requestCount = 0;
      this.resetTime = now + 24 * 60 * 60 * 1000;
    }

    if (this.requestCount >= this.dailyLimit) {
      console.warn(`⚠️  LunarCrush rate limit reached: ${this.requestCount}/${this.dailyLimit}`);
      return false;
    }

    return true;
  }

  /**
   * Get cached data or null
   */
  private getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cache data
   */
  private setCache(key: string, data: any, ttl: number = this.cacheTTL): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  /**
   * Make API request with rate limiting and caching
   */
  private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T | null> {
    if (!this.enabled) {
      return null;
    }

    // Check cache first
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Check rate limit
    if (!this.checkRateLimit()) {
      return null;
    }

    try {
      this.requestCount++;

      const response = await this.client.get(endpoint, { params });

      if (response.data && response.data.data) {
        this.setCache(cacheKey, response.data.data);
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      console.error('[LunarCrush] API Error:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get coin data with social metrics
   */
  async getCoinData(symbol: string): Promise<LunarCrushCoinData | null> {
    const data = await this.request<any>('/assets', {
      symbol: symbol.toUpperCase(),
      data_points: 1
    });

    return data?.[0] || null;
  }

  /**
   * Get multiple coins data
   */
  async getMultipleCoins(symbols: string[]): Promise<LunarCrushCoinData[]> {
    const data = await this.request<any>('/assets', {
      symbol: symbols.map(s => s.toUpperCase()).join(',')
    });

    return data || [];
  }

  /**
   * Get time series data
   */
  async getTimeSeries(
    symbol: string,
    interval: '1h' | '1d' | '1w' = '1d',
    dataPoints: number = 30
  ): Promise<LunarCrushTimeSeries | null> {
    const data = await this.request<any>('/assets', {
      symbol: symbol.toUpperCase(),
      interval,
      data_points: dataPoints,
      time_series_indicators: 'galaxy_score,alt_rank,social_volume,sentiment'
    });

    return data?.[0] || null;
  }

  /**
   * Get influencers for a coin
   */
  async getInfluencers(symbol: string, limit: number = 10): Promise<LunarCrushInfluencer[]> {
    const data = await this.request<any>('/influencers', {
      symbol: symbol.toUpperCase(),
      num_results: limit
    });

    return data?.influencers || [];
  }

  /**
   * Get market-wide social metrics
   */
  async getMarketOverview(): Promise<any> {
    return await this.request<any>('/market', {
      data_points: 1
    });
  }

  /**
   * Get social sentiment data (processed for our system)
   */
  async getSocialSentiment(symbol: string): Promise<SocialSentimentData | null> {
    const coinData = await this.getCoinData(symbol);

    if (!coinData) {
      return null;
    }

    // Normalize sentiment from -1..1 to -100..100
    const sentimentScore = Math.round(coinData.sentiment * 100);

    // Calculate sentiment ratios (approximation)
    const positiveRatio = Math.max(0, coinData.sentiment);
    const negativeRatio = Math.max(0, -coinData.sentiment);
    const neutralRatio = 1 - Math.abs(coinData.sentiment);

    // Calculate trending score based on alt_rank and volume
    const trendingScore = Math.min(100, Math.max(0,
      (coinData.social_volume_24h / 1000) * 10 +
      (100 - coinData.alt_rank)
    ));

    // Determine momentum
    let momentum: 'rising' | 'falling' | 'stable' = 'stable';
    if (coinData.alt_rank_30d < coinData.alt_rank) {
      momentum = 'rising';
    } else if (coinData.alt_rank_30d > coinData.alt_rank) {
      momentum = 'falling';
    }

    return {
      symbol: coinData.symbol,
      galaxy_score: coinData.galaxy_score,
      alt_rank: coinData.alt_rank,
      sentiment_score: sentimentScore,

      social_volume_24h: coinData.social_volume_24h,
      social_volume_change_24h: coinData.percent_change_24h,
      social_dominance: coinData.social_dominance,

      total_engagement_24h: coinData.social_engagement,
      engagement_rate: coinData.social_engagement / Math.max(1, coinData.social_volume_24h),
      unique_contributors: coinData.social_contributors,

      positive_sentiment_ratio: positiveRatio,
      negative_sentiment_ratio: negativeRatio,
      neutral_sentiment_ratio: neutralRatio,

      twitter_mentions_24h: coinData.tweets_24h,
      reddit_posts_24h: coinData.reddit_posts_24h,
      reddit_comments_24h: coinData.reddit_comments_24h,
      news_articles_24h: coinData.news,

      trending_score: trendingScore,
      momentum,

      timestamp: coinData.last_updated
    };
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): {
    enabled: boolean;
    requests_used: number;
    requests_remaining: number;
    daily_limit: number;
    reset_time: number;
  } {
    return {
      enabled: this.enabled,
      requests_used: this.requestCount,
      requests_remaining: this.dailyLimit - this.requestCount,
      daily_limit: this.dailyLimit,
      reset_time: this.resetTime
    };
  }
}

// Export singleton instance
export const lunarCrushClient = new LunarCrushClient();

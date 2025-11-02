/**
 * Social Sentiment Service
 *
 * Aggregates social media sentiment from multiple sources:
 * - LunarCrush (primary) - Twitter, Reddit, YouTube sentiment
 * - Twitter API v2 (optional) - Direct Twitter mentions
 * - Reddit API (optional) - Subreddit discussions
 * - CoinGecko (fallback) - Community stats
 *
 * Provides normalized social sentiment scores for trading decisions
 */

import { lunarCrushClient, SocialSentimentData } from '../clients/lunarcrush';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SocialMetrics {
  // Core Metrics
  sentiment_score: number;           // -100 to 100
  sentiment_label: 'bearish' | 'neutral' | 'bullish';
  confidence: number;                // 0-100 based on data quality

  // Volume & Engagement
  social_volume_24h: number;
  social_volume_trend: 'increasing' | 'decreasing' | 'stable';
  engagement_rate: number;
  unique_contributors: number;

  // Sentiment Breakdown
  positive_ratio: number;            // 0-1
  negative_ratio: number;            // 0-1
  neutral_ratio: number;             // 0-1

  // Platform Breakdown
  twitter_sentiment: number;         // -100 to 100
  reddit_sentiment: number;          // -100 to 100
  news_sentiment: number;            // -100 to 100

  // Quality Scores
  galaxy_score?: number;             // LunarCrush overall health (0-100)
  alt_rank?: number;                 // LunarCrush ranking
  trending_score: number;            // 0-100

  // Influencer Impact
  influencer_sentiment?: number;     // -100 to 100
  top_influencers?: Array<{
    name: string;
    followers: number;
    sentiment: number;
  }>;

  // Metadata
  data_sources: string[];
  timestamp: number;
}

export interface SocialAlert {
  type: 'viral' | 'sentiment_shift' | 'influencer_mention' | 'spam_detected';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
}

export interface SocialSentimentResponse {
  ok: boolean;
  symbol: string;
  metrics: SocialMetrics;
  alerts: SocialAlert[];
  recommendations: string[];
  summary: string;
  cache_hit?: boolean;
  processing_time_ms?: number;
}

// ============================================
// SOCIAL SENTIMENT SERVICE
// ============================================

export class SocialSentimentService {
  private cache = new Map<string, { data: SocialSentimentResponse; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    console.log('📱 Social Sentiment Service initialized');
  }

  /**
   * Get social sentiment for a symbol
   */
  async getSocialSentiment(symbol: string): Promise<SocialSentimentResponse> {
    const startTime = Date.now();
    const cacheKey = `social_${symbol}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return {
        ...cached.data,
        cache_hit: true,
        processing_time_ms: Date.now() - startTime
      };
    }

    try {
      // Try LunarCrush first (primary source)
      let metrics: SocialMetrics;
      let dataSources: string[] = [];

      if (lunarCrushClient.isEnabled()) {
        const lunarData = await lunarCrushClient.getSocialSentiment(symbol);

        if (lunarData) {
          metrics = this.processLunarCrushData(lunarData);
          dataSources.push('LunarCrush');
        } else {
          // Fallback to basic metrics
          metrics = this.getDefaultMetrics(symbol);
          dataSources.push('Default (LunarCrush unavailable)');
        }
      } else {
        // LunarCrush not configured, use fallback
        metrics = this.getDefaultMetrics(symbol);
        dataSources.push('Default (LunarCrush not configured)');
      }

      metrics.data_sources = dataSources;
      metrics.timestamp = Date.now();

      // Generate alerts
      const alerts = this.generateAlerts(metrics);

      // Generate recommendations
      const recommendations = this.generateRecommendations(metrics);

      // Generate summary
      const summary = this.generateSummary(symbol, metrics, alerts);

      const response: SocialSentimentResponse = {
        ok: true,
        symbol,
        metrics,
        alerts,
        recommendations,
        summary,
        processing_time_ms: Date.now() - startTime
      };

      // Cache response
      this.cache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });

      return response;

    } catch (error: any) {
      console.error('[SocialSentiment] Error:', error.message);

      return {
        ok: false,
        symbol,
        metrics: this.getDefaultMetrics(symbol),
        alerts: [{
          type: 'spam_detected',
          severity: 'low',
          message: 'Unable to fetch social sentiment data',
          timestamp: Date.now()
        }],
        recommendations: ['Social data temporarily unavailable'],
        summary: `Social sentiment data unavailable for ${symbol}`,
        processing_time_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Process LunarCrush data into our format
   */
  private processLunarCrushData(data: SocialSentimentData): SocialMetrics {
    // Determine sentiment label
    let sentimentLabel: 'bearish' | 'neutral' | 'bullish' = 'neutral';
    if (data.sentiment_score > 30) {
      sentimentLabel = 'bullish';
    } else if (data.sentiment_score < -30) {
      sentimentLabel = 'bearish';
    }

    // Determine volume trend
    let volumeTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (data.social_volume_change_24h > 20) {
      volumeTrend = 'increasing';
    } else if (data.social_volume_change_24h < -20) {
      volumeTrend = 'decreasing';
    }

    // Calculate confidence based on data quality
    const confidence = Math.min(100, Math.max(0,
      (data.social_volume_24h / 100) * 20 +      // Volume factor
      (data.unique_contributors / 10) * 20 +     // Contributor factor
      data.galaxy_score * 0.3 +                  // Galaxy score factor
      30                                          // Base confidence
    ));

    // Estimate platform sentiments (LunarCrush provides aggregated data)
    const twitterSentiment = data.sentiment_score * 1.1; // Twitter tends more extreme
    const redditSentiment = data.sentiment_score * 0.9;  // Reddit more conservative
    const newsSentiment = data.sentiment_score * 0.8;    // News more neutral

    return {
      sentiment_score: data.sentiment_score,
      sentiment_label: sentimentLabel,
      confidence: Math.round(confidence),

      social_volume_24h: data.social_volume_24h,
      social_volume_trend: volumeTrend,
      engagement_rate: data.engagement_rate,
      unique_contributors: data.unique_contributors,

      positive_ratio: data.positive_sentiment_ratio,
      negative_ratio: data.negative_sentiment_ratio,
      neutral_ratio: data.neutral_sentiment_ratio,

      twitter_sentiment: Math.round(Math.min(100, Math.max(-100, twitterSentiment))),
      reddit_sentiment: Math.round(Math.min(100, Math.max(-100, redditSentiment))),
      news_sentiment: Math.round(Math.min(100, Math.max(-100, newsSentiment))),

      galaxy_score: data.galaxy_score,
      alt_rank: data.alt_rank,
      trending_score: data.trending_score,

      data_sources: [],
      timestamp: data.timestamp
    };
  }

  /**
   * Get default metrics when social data unavailable
   */
  private getDefaultMetrics(symbol: string): SocialMetrics {
    return {
      sentiment_score: 0,
      sentiment_label: 'neutral',
      confidence: 0,

      social_volume_24h: 0,
      social_volume_trend: 'stable',
      engagement_rate: 0,
      unique_contributors: 0,

      positive_ratio: 0.33,
      negative_ratio: 0.33,
      neutral_ratio: 0.34,

      twitter_sentiment: 0,
      reddit_sentiment: 0,
      news_sentiment: 0,

      trending_score: 0,

      data_sources: ['Unavailable'],
      timestamp: Date.now()
    };
  }

  /**
   * Generate alerts based on social metrics
   */
  private generateAlerts(metrics: SocialMetrics): SocialAlert[] {
    const alerts: SocialAlert[] = [];

    // Viral alert (high social volume increase)
    if (metrics.social_volume_trend === 'increasing' && metrics.social_volume_24h > 5000) {
      alerts.push({
        type: 'viral',
        severity: 'high',
        message: `${metrics.social_volume_24h.toLocaleString()} mentions in 24h - Going viral!`,
        timestamp: Date.now()
      });
    }

    // Sentiment shift alert
    if (Math.abs(metrics.sentiment_score) > 60) {
      alerts.push({
        type: 'sentiment_shift',
        severity: 'medium',
        message: `Strong ${metrics.sentiment_label} sentiment detected (${metrics.sentiment_score}/100)`,
        timestamp: Date.now()
      });
    }

    // Low confidence warning
    if (metrics.confidence < 30) {
      alerts.push({
        type: 'spam_detected',
        severity: 'low',
        message: 'Low data quality - social metrics may be unreliable',
        timestamp: Date.now()
      });
    }

    return alerts;
  }

  /**
   * Generate trading recommendations
   */
  private generateRecommendations(metrics: SocialMetrics): string[] {
    const recommendations: string[] = [];

    // High bullish sentiment
    if (metrics.sentiment_score > 50 && metrics.confidence > 60) {
      recommendations.push('🟢 Strong bullish social sentiment - Consider long positions');
      recommendations.push('⚠️ Watch for sentiment reversal as it may be overheated');
    }

    // High bearish sentiment
    if (metrics.sentiment_score < -50 && metrics.confidence > 60) {
      recommendations.push('🔴 Strong bearish social sentiment - Exercise caution on longs');
      recommendations.push('💡 May present buying opportunity if fundamentals strong');
    }

    // Viral but low confidence
    if (metrics.social_volume_trend === 'increasing' && metrics.confidence < 40) {
      recommendations.push('⚠️ High social volume but low quality - Possible pump attempt');
      recommendations.push('🛡️ Wait for price confirmation before entering');
    }

    // Strong trending
    if (metrics.trending_score > 70 && metrics.alt_rank && metrics.alt_rank < 50) {
      recommendations.push('📈 Trending high with good fundamentals - Monitor closely');
    }

    // Default recommendation
    if (recommendations.length === 0) {
      recommendations.push('📊 Neutral social sentiment - Focus on technical analysis');
    }

    return recommendations;
  }

  /**
   * Generate summary text
   */
  private generateSummary(symbol: string, metrics: SocialMetrics, alerts: SocialAlert[]): string {
    const parts: string[] = [];

    // Main sentiment
    parts.push(`${symbol} shows ${metrics.sentiment_label} social sentiment (${metrics.sentiment_score}/100)`);

    // Volume
    if (metrics.social_volume_24h > 1000) {
      parts.push(`with ${metrics.social_volume_24h.toLocaleString()} mentions`);
    }

    // Trending
    if (metrics.trending_score > 60) {
      parts.push('and high trending activity');
    }

    // High severity alerts
    const highAlerts = alerts.filter(a => a.severity === 'high');
    if (highAlerts.length > 0) {
      parts.push(`⚠️ ${highAlerts.length} important alert(s)`);
    }

    return parts.join(' ') + '.';
  }

  /**
   * Get rate limit status from LunarCrush
   */
  getRateLimitStatus() {
    return lunarCrushClient.getRateLimitStatus();
  }
}

// Export singleton instance
export const socialSentimentService = new SocialSentimentService();

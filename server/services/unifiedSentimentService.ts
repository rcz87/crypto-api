/**
 * Unified Sentiment Dashboard Service
 * Aggregates sentiment data from multiple sources with intelligent weighting and confluence scoring
 *
 * Data Sources (Updated with Social Intelligence):
 * - Fear & Greed Index (25% weight) - from marketSentiment.ts
 * - FOMO Detection (15% weight) - from marketSentiment.ts
 * - ETF Flows (20% weight) - from etf.ts
 * - Social Sentiment (15% weight) - from socialSentiment.ts (LunarCrush)
 * - Whale Activity (15% weight) - from whaleAlerts.ts
 * - Funding Rates (10% weight) - from enhancedFundingRate.ts
 * - Liquidation Heatmaps (optional) - from heatmap.ts
 * - Long/Short Ratios (optional) - from external sources
 */

import {
  UnifiedSentimentResponse,
  FearGreedData,
  FOMOData,
  ETFData,
  WhaleData,
  FundingData,
  LiquidationData,
  Driver,
  Alert
} from '@shared/schema';
import { getMarketSentiment } from '../clients/marketSentiment';
import { EtfClient } from '../clients/etf';
import { getWhaleAlerts } from '../clients/whaleAlerts';
import { getHeatmap } from '../clients/heatmap';
import { EnhancedFundingRateService } from './enhancedFundingRate';
import { socialSentimentService } from './socialSentiment';
import { metricsCollector } from '../utils/metrics';

// Configuration constants (Updated to include Social Sentiment)
const WEIGHTS = {
  FEAR_GREED: 0.25,  // 25% (reduced from 30%)
  FOMO: 0.15,        // 15% (reduced from 20%)
  ETF: 0.20,         // 20% (reduced from 25%)
  SOCIAL: 0.15,      // 15% (NEW - LunarCrush social intelligence)
  WHALE: 0.15,       // 15% (same)
  FUNDING: 0.10      // 10% (same)
};

// Feature flag for LunarCrush (can be disabled if API key not available)
const ENABLE_SOCIAL_SENTIMENT = process.env.LUNARCRUSH_API_KEY ? true : false;

const CACHE_TTL = 120000; // 2 minutes cache
const REQUEST_TIMEOUT = 2500; // 2.5s timeout per source to meet 3s target

interface DataSourceResult {
  success: boolean;
  data?: any;
  error?: string;
  source: string;
  fetchTime: number;
}

export class UnifiedSentimentService {
  private etfClient: EtfClient;
  private fundingService: EnhancedFundingRateService;
  private cache = new Map<string, { data: UnifiedSentimentResponse; timestamp: number }>();

  constructor() {
    this.etfClient = new EtfClient();
    this.fundingService = new EnhancedFundingRateService();
  }

  /**
   * Get unified sentiment dashboard data for a symbol
   */
  async getUnifiedSentiment(symbol: string = 'BTC'): Promise<UnifiedSentimentResponse> {
    const startTime = Date.now();
    const cacheKey = `unified_sentiment_${symbol}`;
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return { ...cached.data, cache_hit: true, processing_time_ms: Date.now() - startTime };
    }

    console.log(`[UnifiedSentiment] Starting sentiment analysis for ${symbol}`);

    try {
      // Parallel data fetching from all sources with timeout protection
      const dataSourcePromises = await this.fetchAllDataSources(symbol);
      const results = await Promise.allSettled(dataSourcePromises);
      
      // Process results and extract data
      const processedData = this.processDataSourceResults(results as PromiseSettledResult<DataSourceResult>[]);
      
      // Calculate confluence score with intelligent weighting
      const confluenceScore = this.calculateConfluenceScore(processedData);
      
      // Generate trading intelligence
      const tradingSignal = this.generateTradingSignal(confluenceScore, processedData);
      const riskLevel = this.assessRiskLevel(processedData);
      const marketPhase = this.detectMarketPhase(processedData);
      
      // Generate insights and alerts
      const keyDrivers = this.identifyKeyDrivers(processedData);
      const recommendations = this.generateRecommendations(tradingSignal, processedData);
      const alerts = this.generateAlerts(processedData);
      
      // Calculate data quality metrics
      const dataQuality = this.assessDataQuality(processedData);
      
      // Build response
      const response: UnifiedSentimentResponse = {
        ok: true,
        symbol: symbol.toUpperCase(),
        timestamp: new Date().toISOString(),
        
        // Core Metrics
        fear_greed_index: processedData.fearGreed?.score || 50,
        fomo_score: processedData.fomo?.score || 0,
        confluence_score: confluenceScore,
        
        // Trading Intelligence
        trading_signal: tradingSignal,
        risk_level: riskLevel,
        market_phase: marketPhase,
        
        // Detailed Breakdown
        sentiment_breakdown: {
          fear_greed: processedData.fearGreed || this.getDefaultFearGreedData(),
          fomo_detection: processedData.fomo || this.getDefaultFOMOData(),
          etf_flows: processedData.etf || this.getDefaultETFData(),
          whale_activity: processedData.whale || this.getDefaultWhaleData(),
          funding_rates: processedData.funding || this.getDefaultFundingData(),
          liquidation_heatmap: processedData.liquidation,
          long_short_ratios: undefined // Not implemented yet
        },
        
        // Actionable Insights
        key_drivers: keyDrivers,
        recommendations: recommendations,
        alerts: alerts,
        
        // Data Quality and Metadata
        data_quality: dataQuality,
        
        // Performance Metrics
        processing_time_ms: Date.now() - startTime,
        cache_hit: false
      };

      // Cache the response
      this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
      
      // Record metrics
      metricsCollector.recordHttpRequest(Date.now() - startTime, false);
      
      console.log(`[UnifiedSentiment] ✅ Analysis complete for ${symbol} in ${Date.now() - startTime}ms - Confluence: ${confluenceScore}, Signal: ${tradingSignal}`);
      
      return response;
      
    } catch (error) {
      console.error(`[UnifiedSentiment] ❌ Error analyzing ${symbol}:`, error);
      metricsCollector.recordHttpRequest(Date.now() - startTime, true);
      
      throw new Error(`Failed to generate unified sentiment analysis for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch data from all sources in parallel with timeout protection
   */
  private async fetchAllDataSources(symbol: string): Promise<Promise<DataSourceResult>[]> {
    const timeoutPromise = (ms: number, source: string): Promise<DataSourceResult> => 
      new Promise(resolve => 
        setTimeout(() => resolve({ success: false, error: 'Timeout', source, fetchTime: ms }), ms)
      );

    return [
      // Fear & Greed Index + FOMO
      Promise.race([
        this.fetchMarketSentiment(symbol),
        timeoutPromise(REQUEST_TIMEOUT, 'market_sentiment')
      ]),
      
      // ETF Flows (only for BTC/ETH)
      Promise.race([
        this.fetchETFData(symbol),
        timeoutPromise(REQUEST_TIMEOUT, 'etf_flows')
      ]),
      
      // Whale Activity
      Promise.race([
        this.fetchWhaleData(symbol),
        timeoutPromise(REQUEST_TIMEOUT, 'whale_activity')
      ]),
      
      // Funding Rates
      Promise.race([
        this.fetchFundingData(symbol),
        timeoutPromise(REQUEST_TIMEOUT, 'funding_rates')
      ]),
      
      // Liquidation Heatmap (optional)
      Promise.race([
        this.fetchLiquidationData(symbol),
        timeoutPromise(REQUEST_TIMEOUT, 'liquidation_heatmap')
      ])
    ];
  }

  /**
   * Fetch market sentiment data (Fear & Greed Index + FOMO)
   */
  private async fetchMarketSentiment(symbol: string): Promise<DataSourceResult> {
    const startTime = Date.now();
    try {
      const result = await getMarketSentiment(symbol);
      return {
        success: true,
        data: result,
        source: 'market_sentiment',
        fetchTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Market sentiment fetch failed',
        source: 'market_sentiment',
        fetchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch ETF data (only applicable to BTC/ETH)
   */
  private async fetchETFData(symbol: string): Promise<DataSourceResult> {
    const startTime = Date.now();
    
    // ETF data only available for BTC and ETH
    const etfSymbol = symbol.toUpperCase();
    if (!['BTC', 'ETH'].includes(etfSymbol)) {
      return {
        success: false,
        error: 'ETF data not available for this symbol',
        source: 'etf_flows',
        fetchTime: Date.now() - startTime
      };
    }

    try {
      const result = await this.etfClient.getFlows(etfSymbol as 'BTC' | 'ETH');
      return {
        success: true,
        data: result,
        source: 'etf_flows',
        fetchTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ETF data fetch failed',
        source: 'etf_flows',
        fetchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch whale activity data
   */
  private async fetchWhaleData(symbol: string): Promise<DataSourceResult> {
    const startTime = Date.now();
    try {
      const result = await getWhaleAlerts('hyperliquid'); // Default exchange
      return {
        success: true,
        data: result,
        source: 'whale_activity',
        fetchTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Whale data fetch failed',
        source: 'whale_activity',
        fetchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch funding rate data
   */
  private async fetchFundingData(symbol: string): Promise<DataSourceResult> {
    const startTime = Date.now();
    try {
      const okxSymbol = this.convertToOKXSymbol(symbol);
      const result = await this.fundingService.getEnhancedFundingRate(okxSymbol);
      return {
        success: true,
        data: result,
        source: 'funding_rates',
        fetchTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Funding data fetch failed',
        source: 'funding_rates',
        fetchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch liquidation heatmap data
   */
  private async fetchLiquidationData(symbol: string): Promise<DataSourceResult> {
    const startTime = Date.now();
    try {
      const result = await getHeatmap(symbol, '1h');
      return {
        success: true,
        data: result,
        source: 'liquidation_heatmap',
        fetchTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Liquidation data fetch failed',
        source: 'liquidation_heatmap',
        fetchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Process data source results and extract relevant data
   */
  private processDataSourceResults(results: PromiseSettledResult<DataSourceResult>[]): {
    fearGreed?: FearGreedData;
    fomo?: FOMOData;
    etf?: ETFData;
    whale?: WhaleData;
    funding?: FundingData;
    liquidation?: LiquidationData;
    sourcesAvailable: string[];
    sourcesFailed: string[];
  } {
    const processedData = {
      sourcesAvailable: [] as string[],
      sourcesFailed: [] as string[]
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        const { data, source } = result.value;
        processedData.sourcesAvailable.push(source);

        switch (source) {
          case 'market_sentiment':
            // Extract Fear & Greed and FOMO data
            processedData.fearGreed = this.extractFearGreedData(data);
            processedData.fomo = this.extractFOMOData(data);
            break;
          case 'etf_flows':
            processedData.etf = this.extractETFData(data);
            break;
          case 'whale_activity':
            processedData.whale = this.extractWhaleData(data);
            break;
          case 'funding_rates':
            processedData.funding = this.extractFundingData(data);
            break;
          case 'liquidation_heatmap':
            processedData.liquidation = this.extractLiquidationData(data);
            break;
        }
      } else {
        const source = result.status === 'fulfilled' ? result.value.source : 'unknown';
        processedData.sourcesFailed.push(source);
      }
    });

    return processedData;
  }

  /**
   * Calculate confluence score with intelligent weighting
   */
  private calculateConfluenceScore(data: any): number {
    let totalScore = 0;
    let totalWeight = 0;

    // Fear & Greed Index (30% weight)
    if (data.fearGreed?.score !== undefined) {
      totalScore += data.fearGreed.score * WEIGHTS.FEAR_GREED;
      totalWeight += WEIGHTS.FEAR_GREED;
    }

    // FOMO Detection (20% weight) - convert to bullish signal
    if (data.fomo?.score !== undefined) {
      const fomoContribution = Math.min(data.fomo.score * 0.8, 80); // Cap FOMO contribution
      totalScore += fomoContribution * WEIGHTS.FOMO;
      totalWeight += WEIGHTS.FOMO;
    }

    // ETF Flows (25% weight)
    if (data.etf) {
      const etfScore = this.calculateETFScore(data.etf);
      totalScore += etfScore * WEIGHTS.ETF;
      totalWeight += WEIGHTS.ETF;
    }

    // Whale Activity (15% weight)
    if (data.whale) {
      const whaleScore = this.calculateWhaleScore(data.whale);
      totalScore += whaleScore * WEIGHTS.WHALE;
      totalWeight += WEIGHTS.WHALE;
    }

    // Funding Rates (10% weight)
    if (data.funding) {
      const fundingScore = this.calculateFundingScore(data.funding);
      totalScore += fundingScore * WEIGHTS.FUNDING;
      totalWeight += WEIGHTS.FUNDING;
    }

    // Normalize score if we have partial data
    if (totalWeight === 0) return 50; // Neutral if no data
    
    const confluenceScore = Math.round(totalScore / totalWeight);
    return Math.max(0, Math.min(100, confluenceScore));
  }

  /**
   * Generate trading signal based on confluence score and data
   */
  private generateTradingSignal(confluenceScore: number, data: any): "strong_buy" | "buy" | "hold" | "sell" | "strong_sell" {
    // Base signal from confluence score
    let signal: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell" = "hold";

    if (confluenceScore >= 80) signal = "strong_buy";
    else if (confluenceScore >= 65) signal = "buy";
    else if (confluenceScore <= 20) signal = "strong_sell";
    else if (confluenceScore <= 35) signal = "sell";
    else signal = "hold";

    // Apply overrides for extreme conditions
    if (data.funding?.predictive_signals?.squeeze_detected) {
      // Funding squeeze detected - be more cautious
      if (signal === "strong_buy") signal = "buy";
      if (signal === "strong_sell") signal = "sell";
    }

    // Whale activity override
    if (data.whale?.net_whale_sentiment === 'accumulating' && confluenceScore >= 55) {
      signal = signal === "hold" ? "buy" : signal;
    }
    if (data.whale?.net_whale_sentiment === 'distributing' && confluenceScore <= 45) {
      signal = signal === "hold" ? "sell" : signal;
    }

    return signal;
  }

  /**
   * Assess overall risk level
   */
  private assessRiskLevel(data: any): "low" | "medium" | "high" {
    let riskFactors = 0;

    // Funding rate extremes
    if (data.funding?.extremes?.is_extreme) riskFactors += 2;
    
    // FOMO extremes
    if (data.fomo?.score >= 80) riskFactors += 1;
    
    // Fear extremes
    if (data.fearGreed?.score <= 20 || data.fearGreed?.score >= 80) riskFactors += 1;
    
    // Liquidation cascade risk
    if (data.liquidation?.cascade_risk === 'high') riskFactors += 2;
    if (data.liquidation?.cascade_risk === 'medium') riskFactors += 1;

    if (riskFactors >= 4) return "high";
    if (riskFactors >= 2) return "medium";
    return "low";
  }

  /**
   * Detect current market phase
   */
  private detectMarketPhase(data: any): "accumulation" | "distribution" | "markup" | "markdown" {
    const fearGreedScore = data.fearGreed?.score || 50;
    const fomoScore = data.fomo?.score || 0;
    const whaleActivity = data.whale?.net_whale_sentiment || 'neutral';

    // Strong fear + whale accumulation = accumulation phase
    if (fearGreedScore <= 35 && whaleActivity === 'accumulating') {
      return "accumulation";
    }
    
    // Strong greed + whale distribution = distribution phase
    if (fearGreedScore >= 75 && whaleActivity === 'distributing') {
      return "distribution";
    }
    
    // High FOMO + rising prices = markup phase
    if (fomoScore >= 60 && fearGreedScore >= 60) {
      return "markup";
    }
    
    // High fear + declining sentiment = markdown phase
    if (fearGreedScore <= 30 && fomoScore <= 20) {
      return "markdown";
    }

    // Default based on fear/greed
    if (fearGreedScore >= 60) return "markup";
    if (fearGreedScore <= 40) return "markdown";
    
    return whaleActivity === 'accumulating' ? "accumulation" : "distribution";
  }

  /**
   * Identify key sentiment drivers
   */
  private identifyKeyDrivers(data: any): Driver[] {
    const drivers: Driver[] = [];

    // Fear & Greed driver
    if (data.fearGreed?.score !== undefined) {
      const impact = data.fearGreed.score - 50; // -50 to +50
      drivers.push({
        factor: "Fear & Greed Index",
        impact: impact * 2, // Scale to -100 to +100
        description: `Market sentiment is ${data.fearGreed.label} with a score of ${data.fearGreed.score}/100`,
        weight: WEIGHTS.FEAR_GREED * 100
      });
    }

    // ETF flows driver
    if (data.etf?.net_flows_24h !== undefined) {
      const flowsMillions = data.etf.net_flows_24h / 1000000;
      const impact = Math.min(Math.max(flowsMillions / 10, -100), 100); // Scale flows to impact
      drivers.push({
        factor: "ETF Flows",
        impact: impact,
        description: `${data.etf.dominant_trend === 'inflow' ? 'Positive' : 'Negative'} ETF flows of $${Math.abs(flowsMillions).toFixed(1)}M in 24h`,
        weight: WEIGHTS.ETF * 100
      });
    }

    // Whale activity driver
    if (data.whale?.activity_score !== undefined) {
      const impact = (data.whale.activity_score - 50) * 2; // Scale to -100 to +100
      drivers.push({
        factor: "Whale Activity",
        impact: impact,
        description: `Whale sentiment is ${data.whale.net_whale_sentiment} with ${data.whale.large_transactions_24h} large transactions`,
        weight: WEIGHTS.WHALE * 100
      });
    }

    // Sort by absolute impact
    return drivers.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(signal: string, data: any): string[] {
    const recommendations: string[] = [];

    // Base recommendations by signal
    switch (signal) {
      case "strong_buy":
        recommendations.push("Consider accumulating positions with strong risk management");
        recommendations.push("Monitor for confirmation from volume and institutional flows");
        break;
      case "buy":
        recommendations.push("Look for entry opportunities on minor pullbacks");
        recommendations.push("Size positions appropriately for current volatility");
        break;
      case "strong_sell":
        recommendations.push("Consider reducing exposure or defensive positioning");
        recommendations.push("Watch for potential oversold bounces before re-entering");
        break;
      case "sell":
        recommendations.push("Take profits on existing positions");
        recommendations.push("Avoid new long positions until sentiment improves");
        break;
      default:
        recommendations.push("Maintain current positions and wait for clearer directional signals");
        recommendations.push("Focus on risk management in this neutral environment");
    }

    // Specific recommendations based on data
    if (data.funding?.extremes?.is_extreme) {
      recommendations.push("High funding rates detected - monitor for potential squeeze and reversal");
    }

    if (data.fomo?.score >= 70) {
      recommendations.push("Extreme FOMO detected - exercise caution and consider contrarian positioning");
    }

    if (data.liquidation?.cascade_risk === 'high') {
      recommendations.push("High liquidation risk - avoid leverage and prepare for volatility");
    }

    return recommendations.slice(0, 4); // Limit to 4 recommendations
  }

  /**
   * Generate alerts based on extreme conditions
   */
  private generateAlerts(data: any): Alert[] {
    const alerts: Alert[] = [];

    // Extreme fear/greed alerts
    if (data.fearGreed?.score <= 20) {
      alerts.push({
        type: 'warning',
        message: 'Extreme Fear detected - potential buying opportunity',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        source: 'fear_greed_index'
      });
    }
    
    if (data.fearGreed?.score >= 80) {
      alerts.push({
        type: 'warning',
        message: 'Extreme Greed detected - consider taking profits',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        source: 'fear_greed_index'
      });
    }

    // Funding rate alerts
    if (data.funding?.extremes?.is_extreme) {
      alerts.push({
        type: 'critical',
        message: 'Extreme funding rates detected - potential squeeze incoming',
        severity: 'high',
        timestamp: new Date().toISOString(),
        source: 'funding_rates'
      });
    }

    // Liquidation alerts
    if (data.liquidation?.cascade_risk === 'high') {
      alerts.push({
        type: 'critical',
        message: 'High liquidation cascade risk - expect volatility',
        severity: 'high',
        timestamp: new Date().toISOString(),
        source: 'liquidation_heatmap'
      });
    }

    // FOMO alerts
    if (data.fomo?.score >= 80) {
      alerts.push({
        type: 'warning',
        message: 'Extreme FOMO detected - market may be overheated',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        source: 'fomo_detection'
      });
    }

    return alerts;
  }

  /**
   * Assess data quality and completeness
   */
  private assessDataQuality(data: any): {
    completeness_score: number;
    data_freshness: number;
    sources_available: string[];
    sources_failed: string[];
    reliability_score: number;
  } {
    const totalSources = 5; // Core sources: market_sentiment, etf_flows, whale_activity, funding_rates, liquidation_heatmap
    const availableCount = data.sourcesAvailable.length;
    const completenessScore = Math.round((availableCount / totalSources) * 100);

    // Calculate reliability based on data consistency
    let reliabilityScore = 100;
    if (availableCount < 3) reliabilityScore -= 30;
    if (data.sourcesFailed.includes('market_sentiment')) reliabilityScore -= 20;
    if (data.sourcesFailed.includes('etf_flows')) reliabilityScore -= 10;

    return {
      completeness_score: completenessScore,
      data_freshness: 30, // Assume 30 seconds freshness for now
      sources_available: data.sourcesAvailable,
      sources_failed: data.sourcesFailed,
      reliability_score: Math.max(0, reliabilityScore)
    };
  }

  // Helper methods for data extraction and scoring
  private extractFearGreedData(data: any): FearGreedData {
    return {
      score: data.score || 50,
      label: data.label || 'neutral',
      change_24h: 0,
      historical_average: 50,
      components: {
        market_momentum: data.score * 0.4 || 20,
        volume_pressure: data.score * 0.3 || 15,
        market_volatility: data.score * 0.2 || 10,
        dominance_shifts: data.score * 0.1 || 5
      }
    };
  }

  private extractFOMOData(data: any): FOMOData {
    return {
      score: data.fomo_score || 0,
      label: data.fomo_label || 'no_fomo',
      retail_indicators: data.retail_indicators || {
        volume_spike_24h: 0,
        volume_vs_avg_7d: 1,
        price_velocity: 0,
        market_behavior_score: 50,
        sudden_inflow_detected: false
      },
      drivers: data.fomo_drivers || []
    };
  }

  private extractETFData(data: any): ETFData {
    return {
      net_flows_24h: data.net_flows_24h || 0,
      net_flows_7d: data.net_flows_7d || 0,
      dominant_trend: data.dominant_trend || 'neutral',
      institutional_sentiment: data.institutional_sentiment || 'neutral',
      flow_velocity: data.flow_velocity || 0,
      major_flows: data.major_flows || []
    };
  }

  private extractWhaleData(data: any): WhaleData {
    return {
      activity_score: data.activity_score || 50,
      large_transactions_24h: data.counts?.total || 0,
      net_whale_sentiment: this.determineWhaleSentiment(data),
      whale_flow_usd: data.whale_flow_usd || 0,
      significant_moves: data.alerts?.map((alert: any) => ({
        size_usd: alert.notional_value || 0,
        direction: alert.side === 'buy' ? 'buy' : 'sell',
        exchange: alert.exchange || 'unknown',
        timestamp: alert.timestamp || new Date().toISOString()
      })) || []
    };
  }

  private extractFundingData(data: any): FundingData {
    return {
      current_rate: data.current?.fundingRate || 0,
      normalized_score: this.normalizeFundingRate(data.current?.fundingRate || 0),
      trend: data.historical_context?.funding_rate_24h_avg > data.current?.fundingRate ? 'decreasing' : 'increasing',
      extremes: {
        is_extreme: Math.abs(data.current?.fundingRate || 0) > 0.0005,
        level: Math.abs(data.current?.fundingRate || 0) > 0.001 ? 'extreme' : 
               Math.abs(data.current?.fundingRate || 0) > 0.0003 ? 'elevated' : 'normal'
      },
      predictive_signals: {
        squeeze_detected: data.alerts?.funding_squeeze_alert?.active || false,
        reversal_probability: data.signal_analysis?.confidence_score || 50
      }
    };
  }

  private extractLiquidationData(data: any): LiquidationData | undefined {
    if (!data || !data.liquidation_clusters) return undefined;
    
    return {
      liquidation_clusters: data.liquidation_clusters || [],
      cascade_risk: data.cascade_risk || 'low',
      nearest_cluster_distance: data.nearest_cluster_distance || 0
    };
  }

  // Scoring helper methods
  private calculateETFScore(etfData: ETFData): number {
    const flowsMillions = etfData.net_flows_24h / 1000000;
    let score = 50; // Neutral base
    
    // Positive flows = bullish score
    if (flowsMillions > 0) {
      score += Math.min(flowsMillions * 2, 40); // Max +40 points
    } else {
      score += Math.max(flowsMillions * 2, -40); // Max -40 points
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateWhaleScore(whaleData: WhaleData): number {
    let score = whaleData.activity_score || 50;
    
    // Adjust based on sentiment
    if (whaleData.net_whale_sentiment === 'accumulating') score += 15;
    if (whaleData.net_whale_sentiment === 'distributing') score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateFundingScore(fundingData: FundingData): number {
    // Convert funding rate to sentiment score
    // Negative funding = bullish (shorts pay longs)
    // Positive funding = bearish (longs pay shorts)
    const fundingRate = fundingData.current_rate;
    let score = 50;
    
    // Extreme funding rates are contrarian indicators
    if (Math.abs(fundingRate) > 0.001) {
      // Very high positive funding = contrarian bullish
      if (fundingRate > 0.001) score += 30;
      // Very high negative funding = contrarian bearish
      if (fundingRate < -0.001) score -= 30;
    } else {
      // Normal funding rates follow the rate direction
      score -= fundingRate * 100000; // Scale to meaningful range
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Helper utility methods
  private convertToOKXSymbol(symbol: string): string {
    if (symbol.includes('-USDT-SWAP')) return symbol;
    return `${symbol.toUpperCase()}-USDT-SWAP`;
  }

  private determineWhaleSentiment(whaleData: any): 'accumulating' | 'distributing' | 'neutral' {
    if (!whaleData.counts) return 'neutral';
    
    const buyRatio = whaleData.counts.large_buys / (whaleData.counts.total || 1);
    if (buyRatio > 0.6) return 'accumulating';
    if (buyRatio < 0.4) return 'distributing';
    return 'neutral';
  }

  private normalizeFundingRate(rate: number): number {
    // Convert funding rate to -100 to +100 scale
    return Math.max(-100, Math.min(100, rate * 100000));
  }

  // Default data methods for fallbacks
  private getDefaultFearGreedData(): FearGreedData {
    return {
      score: 50,
      label: 'neutral',
      change_24h: 0,
      historical_average: 50,
      components: {
        market_momentum: 20,
        volume_pressure: 15,
        market_volatility: 10,
        dominance_shifts: 5
      }
    };
  }

  private getDefaultFOMOData(): FOMOData {
    return {
      score: 0,
      label: 'no_fomo',
      retail_indicators: {
        volume_spike_24h: 0,
        volume_vs_avg_7d: 1,
        price_velocity: 0,
        market_behavior_score: 50,
        sudden_inflow_detected: false
      },
      drivers: []
    };
  }

  private getDefaultETFData(): ETFData {
    return {
      net_flows_24h: 0,
      net_flows_7d: 0,
      dominant_trend: 'neutral',
      institutional_sentiment: 'neutral',
      flow_velocity: 0,
      major_flows: []
    };
  }

  private getDefaultWhaleData(): WhaleData {
    return {
      activity_score: 50,
      large_transactions_24h: 0,
      net_whale_sentiment: 'neutral',
      whale_flow_usd: 0,
      significant_moves: []
    };
  }

  private getDefaultFundingData(): FundingData {
    return {
      current_rate: 0,
      normalized_score: 0,
      trend: 'stable',
      extremes: {
        is_extreme: false,
        level: 'normal'
      },
      predictive_signals: {
        squeeze_detected: false,
        reversal_probability: 50
      }
    };
  }
}

// Export singleton instance
export const unifiedSentimentService = new UnifiedSentimentService();
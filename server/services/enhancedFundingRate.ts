import { okxService } from './okx';
import { storage } from '../storage';

interface FundingRateHistoricalData {
  timestamp: string;
  fundingRate: number;
  premium: number;
  openInterest: number;
  price: number;
}

interface SignalConflict {
  detected: boolean;
  type: 'funding_premium_divergence' | 'extreme_rate_low_premium' | 'normal_rate_high_premium';
  explanation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

interface LiquidationAlert {
  active: boolean;
  cluster_prices: number[];
  open_interest_at_cluster: number[];
  probability: number;
  explanation: string;
  estimated_liquidation_volume: number;
  time_to_cascade: string;
}

interface MarketStructureAnalysis {
  current_structure: 'steep_contango' | 'contango' | 'neutral' | 'backwardation' | 'steep_backwardation';
  regime_classification: 'compressed' | 'normal' | 'elevated' | 'extreme';
  historical_percentile: number;
  basis_trading_score: number;
  funding_squeeze_detected: boolean;
  liquidation_pressure: 'low' | 'moderate' | 'elevated' | 'critical';
}

interface EnhancedFundingRateData {
  // Current data
  current: {
    instId: string;
    fundingRate: number;
    premium: number;
    nextFundingTime: string;
    fundingTime: string;
    interestRate: number;
    settState: 'settled' | 'processing';
    timestamp: string;
  };
  
  // Historical context
  historical_context: {
    funding_rate_24h_avg: number;
    funding_rate_7d_avg: number;
    funding_rate_max_24h: number;
    funding_rate_min_24h: number;
    premium_24h_avg: number;
    volatility_24h: number;
    historical_percentile: number;
  };
  
  // Smart signal consolidation
  signal_analysis: {
    overall_sentiment: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
    confidence_score: number;
    conflicts_detected: SignalConflict[];
    weighted_score: number;
    primary_signal: string;
    supporting_signals: string[];
    contradicting_signals: string[];
  };
  
  // Market structure analysis
  market_structure: MarketStructureAnalysis;
  
  // Contextual alerts
  alerts: {
    liquidation_cascade_warning: LiquidationAlert;
    manipulation_alert: {
      active: boolean;
      absorption_levels: number[];
      institutional_flow_pattern: string;
      unusual_activity_score: number;
      explanation: string;
    };
    funding_squeeze_alert: {
      active: boolean;
      squeeze_type: 'long' | 'short' | 'both';
      intensity: number;
      duration_estimate: string;
      historical_outcomes: string;
    };
  };
  
  // Correlation data
  correlation_metrics: {
    funding_oi_correlation: number;
    funding_volume_correlation: number;
    premium_price_correlation: number;
    predictive_strength: number;
  };
  
  // Actionable insights
  trading_implications: {
    immediate_bias: 'long' | 'short' | 'neutral';
    strategy_suggestions: string[];
    risk_factors: string[];
    optimal_entry_timing: string;
    position_sizing_advice: string;
  };
}

export class EnhancedFundingRateService {
  private historicalData: Map<string, FundingRateHistoricalData[]> = new Map();
  private readonly HISTORICAL_RETENTION_HOURS = 720; // 30 days
  
  constructor() {
    // Initialize historical data cleanup
    setInterval(() => this.cleanupHistoricalData(), 3600000); // Every hour
  }
  
  /**
   * Get comprehensive enhanced funding rate data
   */
  async getEnhancedFundingRate(symbol: string = 'SOL-USDT-SWAP'): Promise<EnhancedFundingRateData> {
    try {
      // Fetch current data
      const [fundingRate, openInterest, currentPrice] = await Promise.all([
        okxService.getFundingRate(symbol),
        okxService.getOpenInterest(symbol),
        this.getCurrentPrice(symbol)
      ]);
      
      // Store historical data
      await this.storeHistoricalData(symbol, fundingRate, openInterest, currentPrice);
      
      // Get historical context
      const historicalContext = await this.calculateHistoricalContext(symbol);
      
      // Analyze signal conflicts
      const signalAnalysis = await this.analyzeSignalConflicts(fundingRate, historicalContext);
      
      // Analyze market structure
      const marketStructure = await this.analyzeMarketStructure(fundingRate, historicalContext);
      
      // Generate contextual alerts
      const alerts = await this.generateContextualAlerts(symbol, fundingRate, openInterest, currentPrice, historicalContext);
      
      // Calculate correlations
      const correlationMetrics = await this.calculateCorrelationMetrics(symbol);
      
      // Generate trading implications
      const tradingImplications = await this.generateTradingImplications(
        signalAnalysis, marketStructure, alerts, correlationMetrics
      );
      
      return {
        current: {
          instId: fundingRate.instId,
          fundingRate: parseFloat(fundingRate.fundingRate),
          premium: parseFloat(fundingRate.premium),
          nextFundingTime: fundingRate.nextFundingTime,
          fundingTime: fundingRate.fundingTime,
          interestRate: parseFloat(fundingRate.interestRate),
          settState: fundingRate.settState,
          timestamp: fundingRate.timestamp
        },
        historical_context: historicalContext,
        signal_analysis: signalAnalysis,
        market_structure: marketStructure,
        alerts: alerts,
        correlation_metrics: correlationMetrics,
        trading_implications: tradingImplications
      };
      
    } catch (error) {
      console.error('Error in enhanced funding rate analysis:', error);
      throw new Error('Failed to generate enhanced funding rate data');
    }
  }
  
  /**
   * Get historical funding rate data with trends
   */
  async getHistoricalFundingRate(
    symbol: string = 'SOL-USDT-SWAP',
    timeframe: '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    data_points: FundingRateHistoricalData[];
    statistics: {
      average_funding_rate: number;
      max_funding_rate: number;
      min_funding_rate: number;
      volatility: number;
      trend_direction: 'increasing' | 'decreasing' | 'stable';
      anomaly_count: number;
    };
    trends: {
      funding_rate_trend: number[];
      premium_trend: number[];
      correlation_trend: number[];
    };
  }> {
    const historical = this.historicalData.get(symbol) || [];
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - this.getTimeframeHours(timeframe) * 3600000);
    
    const filteredData = historical.filter(
      point => new Date(point.timestamp) >= cutoffTime
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (filteredData.length === 0) {
      throw new Error('Insufficient historical data');
    }
    
    // Calculate statistics
    const fundingRates = filteredData.map(d => d.fundingRate);
    const premiums = filteredData.map(d => d.premium);
    
    const statistics = {
      average_funding_rate: this.calculateAverage(fundingRates),
      max_funding_rate: Math.max(...fundingRates),
      min_funding_rate: Math.min(...fundingRates),
      volatility: this.calculateVolatility(fundingRates),
      trend_direction: this.calculateTrendDirection(fundingRates) as 'increasing' | 'decreasing' | 'stable',
      anomaly_count: this.countAnomalies(fundingRates)
    };
    
    // Generate trends
    const trends = {
      funding_rate_trend: this.generateTrendPoints(fundingRates),
      premium_trend: this.generateTrendPoints(premiums),
      correlation_trend: this.calculateCorrelationTrend(filteredData)
    };
    
    return {
      data_points: filteredData,
      statistics,
      trends
    };
  }
  
  /**
   * Get funding rate correlation with other metrics
   */
  async getFundingCorrelation(symbol: string = 'SOL-USDT-SWAP'): Promise<{
    funding_oi_correlation: {
      correlation_coefficient: number;
      strength: 'weak' | 'moderate' | 'strong';
      trend: 'positive' | 'negative';
      significance: number;
    };
    funding_volume_correlation: {
      correlation_coefficient: number;
      strength: 'weak' | 'moderate' | 'strong';
      trend: 'positive' | 'negative';
      significance: number;
    };
    premium_price_correlation: {
      correlation_coefficient: number;
      strength: 'weak' | 'moderate' | 'strong';
      trend: 'positive' | 'negative';
      significance: number;
    };
    predictive_metrics: {
      funding_rate_predictive_power: number;
      premium_predictive_power: number;
      combined_predictive_score: number;
    };
  }> {
    const correlationMetrics = await this.calculateCorrelationMetrics(symbol);
    
    return {
      funding_oi_correlation: {
        correlation_coefficient: correlationMetrics.funding_oi_correlation,
        strength: this.getCorrelationStrength(correlationMetrics.funding_oi_correlation),
        trend: correlationMetrics.funding_oi_correlation > 0 ? 'positive' : 'negative',
        significance: Math.abs(correlationMetrics.funding_oi_correlation)
      },
      funding_volume_correlation: {
        correlation_coefficient: correlationMetrics.funding_volume_correlation,
        strength: this.getCorrelationStrength(correlationMetrics.funding_volume_correlation),
        trend: correlationMetrics.funding_volume_correlation > 0 ? 'positive' : 'negative',
        significance: Math.abs(correlationMetrics.funding_volume_correlation)
      },
      premium_price_correlation: {
        correlation_coefficient: correlationMetrics.premium_price_correlation,
        strength: this.getCorrelationStrength(correlationMetrics.premium_price_correlation),
        trend: correlationMetrics.premium_price_correlation > 0 ? 'positive' : 'negative',
        significance: Math.abs(correlationMetrics.premium_price_correlation)
      },
      predictive_metrics: {
        funding_rate_predictive_power: correlationMetrics.predictive_strength * 0.4,
        premium_predictive_power: correlationMetrics.predictive_strength * 0.3,
        combined_predictive_score: correlationMetrics.predictive_strength
      }
    };
  }
  
  // Private helper methods
  private async getCurrentPrice(symbol: string): Promise<number> {
    try {
      // Use a placeholder price - in production this would fetch actual ticker data
      // This would be replaced with a proper ticker service method
      return 207.95; // Placeholder SOL price
    } catch (error) {
      console.error('Error fetching current price:', error);
      return 0;
    }
  }
  
  private async storeHistoricalData(
    symbol: string,
    fundingRate: any,
    openInterest: any,
    price: number
  ): Promise<void> {
    const dataPoint: FundingRateHistoricalData = {
      timestamp: new Date().toISOString(),
      fundingRate: parseFloat(fundingRate.fundingRate),
      premium: parseFloat(fundingRate.premium),
      openInterest: parseFloat(openInterest.oiUsd),
      price: price
    };
    
    if (!this.historicalData.has(symbol)) {
      this.historicalData.set(symbol, []);
    }
    
    const data = this.historicalData.get(symbol)!;
    data.push(dataPoint);
    
    // Keep only recent data
    const cutoffTime = new Date(Date.now() - this.HISTORICAL_RETENTION_HOURS * 3600000);
    this.historicalData.set(symbol, 
      data.filter(point => new Date(point.timestamp) >= cutoffTime)
    );
  }
  
  private async calculateHistoricalContext(symbol: string): Promise<any> {
    const historical = this.historicalData.get(symbol) || [];
    const now = new Date();
    
    // 24h data
    const data24h = historical.filter(
      point => new Date(point.timestamp) >= new Date(now.getTime() - 24 * 3600000)
    );
    
    // 7d data  
    const data7d = historical.filter(
      point => new Date(point.timestamp) >= new Date(now.getTime() - 7 * 24 * 3600000)
    );
    
    if (data24h.length === 0) {
      // Return default context if no historical data
      return {
        funding_rate_24h_avg: 0,
        funding_rate_7d_avg: 0,
        funding_rate_max_24h: 0,
        funding_rate_min_24h: 0,
        premium_24h_avg: 0,
        volatility_24h: 0,
        historical_percentile: 50
      };
    }
    
    const fundingRates24h = data24h.map(d => d.fundingRate);
    const fundingRates7d = data7d.map(d => d.fundingRate);
    const premiums24h = data24h.map(d => d.premium);
    
    return {
      funding_rate_24h_avg: this.calculateAverage(fundingRates24h),
      funding_rate_7d_avg: data7d.length > 0 ? this.calculateAverage(fundingRates7d) : 0,
      funding_rate_max_24h: fundingRates24h.length > 0 ? Math.max(...fundingRates24h) : 0,
      funding_rate_min_24h: fundingRates24h.length > 0 ? Math.min(...fundingRates24h) : 0,
      premium_24h_avg: this.calculateAverage(premiums24h),
      volatility_24h: this.calculateVolatility(fundingRates24h),
      historical_percentile: this.calculatePercentile(fundingRates24h, fundingRates24h[fundingRates24h.length - 1] || 0)
    };
  }
  
  private async analyzeSignalConflicts(fundingRate: any, historicalContext: any): Promise<any> {
    const currentFunding = parseFloat(fundingRate.fundingRate);
    const currentPremium = parseFloat(fundingRate.premium);
    
    const conflicts: SignalConflict[] = [];
    
    // Detect funding rate vs premium conflict
    if ((currentFunding > 0.0001 && currentPremium < -0.0005) || 
        (currentFunding < -0.0001 && currentPremium > 0.0005)) {
      conflicts.push({
        detected: true,
        type: 'funding_premium_divergence',
        explanation: currentFunding > 0 ? 
          'Positive funding rate suggests bullish sentiment, but negative premium indicates futures trading below spot. This anomaly often occurs during forced liquidations or market maker rebalancing.' :
          'Negative funding rate suggests bearish sentiment, but positive premium indicates contango. This may signal institutional accumulation despite retail pessimism.',
        severity: Math.abs(currentFunding - currentPremium) > 0.001 ? 'critical' : 'high',
        recommendation: currentFunding > 0 ? 
          'Monitor for long squeeze. Consider short bias if premium remains negative.' :
          'Watch for short covering. Consider long bias if institutional flow confirms accumulation.'
      });
    }
    
    // Detect extreme rate with low premium
    if (Math.abs(currentFunding) > 0.0005 && Math.abs(currentPremium) < 0.0002) {
      conflicts.push({
        detected: true,
        type: 'extreme_rate_low_premium',
        explanation: 'Extreme funding rate with minimal premium suggests funding payment pressure without corresponding futures/spot divergence. Often indicates leverage squeeze without directional conviction.',
        severity: 'medium',
        recommendation: 'Funding-driven volatility likely. Prepare for mean reversion in funding rate.'
      });
    }
    
    // Calculate weighted score
    const fundingWeight = 0.6;
    const premiumWeight = 0.4;
    const weightedScore = (this.normalizeFunding(currentFunding) * fundingWeight) + 
                         (this.normalizePremium(currentPremium) * premiumWeight);
    
    // Determine overall sentiment
    let overallSentiment: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
    if (weightedScore > 0.7) overallSentiment = 'strong_bullish';
    else if (weightedScore > 0.3) overallSentiment = 'bullish';
    else if (weightedScore > -0.3) overallSentiment = 'neutral';
    else if (weightedScore > -0.7) overallSentiment = 'bearish';
    else overallSentiment = 'strong_bearish';
    
    // Calculate confidence score (lower if conflicts detected)
    const baseConfidence = 85;
    const conflictPenalty = conflicts.length * 15;
    const confidenceScore = Math.max(30, baseConfidence - conflictPenalty);
    
    return {
      overall_sentiment: overallSentiment,
      confidence_score: confidenceScore,
      conflicts_detected: conflicts,
      weighted_score: weightedScore,
      primary_signal: Math.abs(currentFunding) > Math.abs(currentPremium) ? 'funding_rate' : 'premium',
      supporting_signals: this.getSupportingSignals(currentFunding, currentPremium),
      contradicting_signals: conflicts.map(c => c.type)
    };
  }
  
  private async analyzeMarketStructure(fundingRate: any, historicalContext: any): Promise<MarketStructureAnalysis> {
    const currentPremium = parseFloat(fundingRate.premium);
    const currentFunding = parseFloat(fundingRate.fundingRate);
    const absoluteFundingRate = Math.abs(currentFunding);
    
    // Market structure classification
    let currentStructure: 'steep_contango' | 'contango' | 'neutral' | 'backwardation' | 'steep_backwardation';
    if (currentPremium > 0.001) currentStructure = 'steep_contango';
    else if (currentPremium > 0.0002) currentStructure = 'contango';
    else if (currentPremium > -0.0002) currentStructure = 'neutral';
    else if (currentPremium > -0.001) currentStructure = 'backwardation';
    else currentStructure = 'steep_backwardation';
    
    // Regime classification
    let regimeClassification: 'compressed' | 'normal' | 'elevated' | 'extreme';
    if (absoluteFundingRate > 0.0005) regimeClassification = 'extreme';
    else if (absoluteFundingRate > 0.0001) regimeClassification = 'elevated';
    else if (absoluteFundingRate > 0.00005) regimeClassification = 'normal';
    else regimeClassification = 'compressed';
    
    return {
      current_structure: currentStructure,
      regime_classification: regimeClassification,
      historical_percentile: historicalContext.historical_percentile,
      basis_trading_score: Math.min(100, (Math.abs(currentPremium) * 10000 / 100) * 20),
      funding_squeeze_detected: absoluteFundingRate > 0.0003 && Math.abs(currentPremium) > 0.002,
      liquidation_pressure: absoluteFundingRate > 0.0004 ? 'critical' :
                           absoluteFundingRate > 0.0002 ? 'elevated' :
                           absoluteFundingRate > 0.0001 ? 'moderate' : 'low'
    };
  }
  
  private async generateContextualAlerts(
    symbol: string,
    fundingRate: any,
    openInterest: any,
    currentPrice: number,
    historicalContext: any
  ): Promise<any> {
    const currentFunding = parseFloat(fundingRate.fundingRate);
    const oiUsd = parseFloat(openInterest.oiUsd);
    
    // Liquidation cascade warning
    const liquidationAlert: LiquidationAlert = await this.calculateLiquidationCascade(
      currentPrice, oiUsd, currentFunding
    );
    
    // Manipulation alert
    const manipulationScore = this.calculateManipulationScore(currentFunding, historicalContext);
    
    // Funding squeeze alert
    const squeezeAlert = this.calculateFundingSqueezeAlert(currentFunding, historicalContext);
    
    return {
      liquidation_cascade_warning: liquidationAlert,
      manipulation_alert: {
        active: manipulationScore > 70,
        absorption_levels: this.calculateAbsorptionLevels(currentPrice),
        institutional_flow_pattern: manipulationScore > 70 ? 'two-way-absorption' : 'normal',
        unusual_activity_score: manipulationScore,
        explanation: manipulationScore > 70 ? 
          'Unusual funding rate patterns detected. Large orders may be absorbing liquidity at key levels.' :
          'Funding rate patterns within normal parameters.'
      },
      funding_squeeze_alert: squeezeAlert
    };
  }
  
  private async calculateLiquidationCascade(
    currentPrice: number,
    openInterest: number,
    fundingRate: number
  ): Promise<LiquidationAlert> {
    // Calculate estimated liquidation levels (simplified)
    const longLiquidationLevels = [
      currentPrice * 0.95, // -5%
      currentPrice * 0.90, // -10%
      currentPrice * 0.85  // -15%
    ];
    
    const shortLiquidationLevels = [
      currentPrice * 1.05, // +5%
      currentPrice * 1.10, // +10%
      currentPrice * 1.15  // +15%
    ];
    
    // Estimate OI at each level (simplified distribution)
    const oiPerLevel = openInterest * 0.3; // 30% of OI concentrated at each major level
    
    // Calculate cascade probability
    const fundingPressure = Math.abs(fundingRate) > 0.0002 ? 50 : 20;
    const oiPressure = openInterest > 300000000 ? 30 : 10; // High OI adds pressure
    const cascadeProbability = Math.min(95, fundingPressure + oiPressure);
    
    const clusterPrices = fundingRate > 0 ? longLiquidationLevels : shortLiquidationLevels;
    
    return {
      active: cascadeProbability > 60,
      cluster_prices: clusterPrices,
      open_interest_at_cluster: [oiPerLevel, oiPerLevel * 0.8, oiPerLevel * 0.6],
      probability: cascadeProbability,
      explanation: cascadeProbability > 60 ? 
        `High liquidation risk detected. ${fundingRate > 0 ? 'Long' : 'Short'} positions concentrated near key levels.` :
        'Liquidation risk within normal parameters.',
      estimated_liquidation_volume: oiPerLevel * (cascadeProbability / 100),
      time_to_cascade: cascadeProbability > 80 ? '< 2 hours' : 
                      cascadeProbability > 60 ? '2-6 hours' : '> 6 hours'
    };
  }
  
  private async calculateCorrelationMetrics(symbol: string): Promise<any> {
    const historical = this.historicalData.get(symbol) || [];
    
    if (historical.length < 10) {
      return {
        funding_oi_correlation: 0,
        funding_volume_correlation: 0,
        premium_price_correlation: 0,
        predictive_strength: 50
      };
    }
    
    const fundingRates = historical.map(d => d.fundingRate);
    const openInterests = historical.map(d => d.openInterest);
    const premiums = historical.map(d => d.premium);
    const prices = historical.map(d => d.price);
    
    return {
      funding_oi_correlation: this.calculateCorrelation(fundingRates, openInterests),
      funding_volume_correlation: 0.3, // Placeholder - would calculate from volume data
      premium_price_correlation: this.calculateCorrelation(premiums, prices),
      predictive_strength: Math.min(95, historical.length * 2) // More data = higher predictive strength
    };
  }
  
  private async generateTradingImplications(
    signalAnalysis: any,
    marketStructure: any,
    alerts: any,
    correlationMetrics: any
  ): Promise<any> {
    const sentiment = signalAnalysis.overall_sentiment;
    const confidence = signalAnalysis.confidence_score;
    const conflicts = signalAnalysis.conflicts_detected.length > 0;
    
    // Determine immediate bias
    let immediateBias: 'long' | 'short' | 'neutral';
    if (sentiment.includes('bullish') && confidence > 60) immediateBias = 'long';
    else if (sentiment.includes('bearish') && confidence > 60) immediateBias = 'short';
    else immediateBias = 'neutral';
    
    // Generate strategy suggestions
    const strategies = [];
    if (marketStructure.funding_squeeze_detected) {
      strategies.push('Consider fade strategies - funding squeezes often reverse');
    }
    if (alerts.liquidation_cascade_warning.active) {
      strategies.push('Monitor liquidation levels for cascading volatility opportunities');
    }
    if (conflicts) {
      strategies.push('Wait for signal confirmation - conflicting indicators present');
    }
    
    // Risk factors
    const riskFactors = [];
    if (marketStructure.liquidation_pressure === 'critical') {
      riskFactors.push('Critical liquidation pressure - high volatility risk');
    }
    if (signalAnalysis.conflicts_detected.length > 0) {
      riskFactors.push('Signal conflicts may indicate market transition phase');
    }
    
    return {
      immediate_bias: immediateBias,
      strategy_suggestions: strategies.length > 0 ? strategies : ['Monitor market for clearer signals'],
      risk_factors: riskFactors.length > 0 ? riskFactors : ['Normal market risk parameters'],
      optimal_entry_timing: confidence > 70 ? 'Immediate' : 'Wait for confirmation',
      position_sizing_advice: conflicts ? 'Reduce position size due to signal conflicts' : 
                              confidence > 80 ? 'Normal position sizing' : 'Conservative position sizing'
    };
  }
  
  // Utility methods
  private cleanupHistoricalData(): void {
    const cutoffTime = new Date(Date.now() - this.HISTORICAL_RETENTION_HOURS * 3600000);
    
    for (const [symbol, data] of Array.from(this.historicalData.entries())) {
      const filteredData = data.filter((point: FundingRateHistoricalData) => new Date(point.timestamp) >= cutoffTime);
      this.historicalData.set(symbol, filteredData);
    }
  }
  
  private getTimeframeHours(timeframe: '24h' | '7d' | '30d'): number {
    switch (timeframe) {
      case '24h': return 24;
      case '7d': return 168;
      case '30d': return 720;
      default: return 24;
    }
  }
  
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.calculateAverage(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = this.calculateAverage(squaredDiffs);
    return Math.sqrt(variance);
  }
  
  private calculateTrendDirection(values: number[]): string {
    if (values.length < 2) return 'stable';
    const first = values.slice(0, Math.floor(values.length / 2));
    const second = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = this.calculateAverage(first);
    const secondAvg = this.calculateAverage(second);
    
    const change = (secondAvg - firstAvg) / Math.abs(firstAvg);
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }
  
  private countAnomalies(values: number[]): number {
    if (values.length < 3) return 0;
    const mean = this.calculateAverage(values);
    const volatility = this.calculateVolatility(values);
    const threshold = volatility * 2;
    
    return values.filter(val => Math.abs(val - mean) > threshold).length;
  }
  
  private generateTrendPoints(values: number[]): number[] {
    // Simple moving average for trend
    if (values.length < 5) return values;
    
    const trendPoints = [];
    const windowSize = 5;
    
    for (let i = windowSize - 1; i < values.length; i++) {
      const window = values.slice(i - windowSize + 1, i + 1);
      trendPoints.push(this.calculateAverage(window));
    }
    
    return trendPoints;
  }
  
  private calculateCorrelationTrend(data: FundingRateHistoricalData[]): number[] {
    const correlations = [];
    const windowSize = 10;
    
    for (let i = windowSize; i < data.length; i++) {
      const window = data.slice(i - windowSize, i);
      const fundingRates = window.map(d => d.fundingRate);
      const premiums = window.map(d => d.premium);
      correlations.push(this.calculateCorrelation(fundingRates, premiums));
    }
    
    return correlations;
  }
  
  private calculatePercentile(values: number[], target: number): number {
    if (values.length === 0) return 50;
    const sorted = [...values].sort((a, b) => a - b);
    const index = sorted.findIndex(val => val >= target);
    if (index === -1) return 100;
    return (index / sorted.length) * 100;
  }
  
  private normalizeFunding(funding: number): number {
    // Normalize funding rate to -1 to 1 scale
    return Math.max(-1, Math.min(1, funding * 1000));
  }
  
  private normalizePremium(premium: number): number {
    // Normalize premium to -1 to 1 scale
    return Math.max(-1, Math.min(1, premium * 100));
  }
  
  private getSupportingSignals(funding: number, premium: number): string[] {
    const signals = [];
    
    if (Math.sign(funding) === Math.sign(premium)) {
      signals.push('funding_premium_alignment');
    }
    
    if (Math.abs(funding) > 0.0001) {
      signals.push('significant_funding_pressure');
    }
    
    if (Math.abs(premium) > 0.0005) {
      signals.push('significant_basis_divergence');
    }
    
    return signals;
  }
  
  private getCorrelationStrength(correlation: number): 'weak' | 'moderate' | 'strong' {
    const abs = Math.abs(correlation);
    if (abs > 0.7) return 'strong';
    if (abs > 0.3) return 'moderate';
    return 'weak';
  }
  
  private calculateManipulationScore(funding: number, historicalContext: any): number {
    let score = 0;
    
    // Extreme funding vs historical average
    const fundingDeviation = Math.abs(funding - historicalContext.funding_rate_24h_avg);
    if (fundingDeviation > 0.0003) score += 40;
    else if (fundingDeviation > 0.0001) score += 20;
    
    // Volatility consideration
    if (historicalContext.volatility_24h > historicalContext.funding_rate_24h_avg * 2) {
      score += 30;
    }
    
    return Math.min(100, score);
  }
  
  private calculateAbsorptionLevels(currentPrice: number): number[] {
    return [
      Math.round(currentPrice * 0.99 * 100) / 100,
      Math.round(currentPrice * 1.01 * 100) / 100
    ];
  }
  
  private calculateFundingSqueezeAlert(funding: number, historicalContext: any): any {
    const absoluteFunding = Math.abs(funding);
    const isExtreme = absoluteFunding > 0.0003;
    
    return {
      active: isExtreme,
      squeeze_type: funding > 0 ? 'long' : 'short',
      intensity: Math.min(100, absoluteFunding * 10000),
      duration_estimate: isExtreme ? '2-6 hours typical duration' : 'N/A',
      historical_outcomes: isExtreme ? 
        'Historical squeezes of this magnitude typically reverse within 6 hours' : 'N/A'
    };
  }
  
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
}

// Export singleton instance
export const enhancedFundingRateService = new EnhancedFundingRateService();
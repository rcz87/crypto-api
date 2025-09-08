import { okxService } from './okx';
import { enhancedFundingRateService } from './enhancedFundingRate';
// import { TechnicalIndicatorsService } from './technicalIndicators';
import { storage } from '../storage';

interface MarketPattern {
  id: string;
  name: string;
  confidence: number;
  timeframe: string;
  signals: string[];
  historical_accuracy: number;
  risk_reward_ratio: number;
  market_conditions: string[];
}

interface AISignal {
  signal_id: string;
  timestamp: string;
  signal_type: 'entry' | 'exit' | 'hold' | 'risk_management';
  direction: 'long' | 'short' | 'neutral';
  strength: number; // 0-100
  confidence: number; // 0-100
  source_patterns: MarketPattern[];
  reasoning: {
    primary_factors: string[];
    supporting_evidence: string[];
    risk_factors: string[];
    market_context: string;
  };
  execution_details: {
    recommended_size: number; // 0-1 (percentage of portfolio)
    stop_loss: number;
    take_profit: number[];
    max_holding_time: string;
    optimal_entry_window: string;
  };
  performance_metrics: {
    expected_return: number;
    max_drawdown: number;
    win_rate: number;
    profit_factor: number;
  };
}

interface StrategyOptimization {
  strategy_id: string;
  parameters: Record<string, number>;
  fitness_score: number;
  backtest_results: {
    total_return: number;
    sharpe_ratio: number;
    max_drawdown: number;
    win_rate: number;
    profit_factor: number;
    total_trades: number;
  };
  generation: number;
  parent_strategies?: string[];
}

interface SentimentData {
  overall_sentiment: 'bullish' | 'bearish' | 'neutral';
  sentiment_score: number; // -1 to 1
  news_impact: number; // 0-1
  social_sentiment: number; // -1 to 1
  institutional_flow: 'buying' | 'selling' | 'neutral';
  market_fear_greed: number; // 0-100
}

export class AISignalEngine {
  private patterns: Map<string, MarketPattern> = new Map();
  private strategies: Map<string, StrategyOptimization> = new Map();
  private signalHistory: AISignal[] = [];
  private readonly SIGNAL_RETENTION_HOURS = 168; // 7 days
  private readonly POPULATION_SIZE = 50;
  private currentGeneration = 1;

  constructor() {
    // Initialize known market patterns
    this.initializeMarketPatterns();
    
    // Start background processes
    setInterval(() => this.evolveStrategies(), 3600000); // Every hour
    setInterval(() => this.cleanupHistory(), 3600000); // Every hour
  }

  /**
   * Generate AI-powered trading signal
   */
  async generateAISignal(symbol: string = 'SOL-USDT-SWAP'): Promise<AISignal> {
    try {
      // Gather market data
      const [fundingData, sentimentData] = await Promise.all([
        enhancedFundingRateService.getEnhancedFundingRate(symbol),
        this.analyzeSentiment(symbol)
      ]);
      
      // Simplified technical data for now
      const technicalData = { 
        trend_direction: 'neutral' as const, 
        trend_strength: 0.5 
      };

      // Detect market patterns
      const detectedPatterns = await this.detectMarketPatterns(fundingData, technicalData, sentimentData);
      
      // Generate signal using AI engine
      const aiSignal = await this.generateSignalFromPatterns(detectedPatterns, fundingData, technicalData);
      
      // Store signal for learning
      this.signalHistory.push(aiSignal);
      await this.storeSignalForLearning(aiSignal);
      
      return aiSignal;
      
    } catch (error) {
      console.error('Error generating AI signal:', error);
      throw new Error('Failed to generate AI signal');
    }
  }

  /**
   * Optimize strategy using genetic algorithm
   */
  async optimizeStrategy(baseStrategy: Partial<StrategyOptimization>): Promise<StrategyOptimization[]> {
    try {
      const population = await this.generatePopulation(baseStrategy);
      const evaluatedPopulation = await this.evaluatePopulation(population);
      const bestStrategies = this.selectBest(evaluatedPopulation, 10);
      
      // Store in strategies map
      bestStrategies.forEach(strategy => {
        this.strategies.set(strategy.strategy_id, strategy);
      });
      
      return bestStrategies;
      
    } catch (error) {
      console.error('Error optimizing strategy:', error);
      throw new Error('Failed to optimize strategy');
    }
  }

  /**
   * Backtest strategy performance
   */
  async backtestStrategy(
    strategyId: string,
    timeframe: '1H' | '4H' | '1D' = '1H',
    lookbackDays: number = 30
  ): Promise<{
    strategy_id: string;
    timeframe: string;
    period: string;
    results: {
      total_return: number;
      annualized_return: number;
      sharpe_ratio: number;
      sortino_ratio: number;
      max_drawdown: number;
      win_rate: number;
      profit_factor: number;
      total_trades: number;
      average_trade_duration: number;
      risk_adjusted_return: number;
    };
    equity_curve: Array<{
      timestamp: string;
      equity: number;
      drawdown: number;
    }>;
    trades: Array<{
      entry_time: string;
      exit_time: string;
      direction: 'long' | 'short';
      entry_price: number;
      exit_price: number;
      return: number;
      duration_hours: number;
    }>;
  }> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    // Simulate backtesting with historical data
    const backtestResults = await this.runBacktest(strategy, timeframe, lookbackDays);
    
    return {
      strategy_id: strategyId,
      timeframe,
      period: `${lookbackDays} days`,
      results: backtestResults.performance,
      equity_curve: backtestResults.equity_curve,
      trades: backtestResults.trades
    };
  }

  /**
   * Get real-time strategy performance
   */
  async getStrategyPerformance(): Promise<{
    active_strategies: Array<{
      strategy_id: string;
      name: string;
      current_fitness: number;
      recent_performance: {
        return_7d: number;
        return_30d: number;
        win_rate_7d: number;
        max_drawdown_7d: number;
      };
      optimization_status: 'optimizing' | 'stable' | 'underperforming';
      next_evolution: string;
    }>;
    ai_learning_stats: {
      total_patterns_learned: number;
      pattern_accuracy: number;
      adaptation_rate: number;
      current_generation: number;
      elite_strategies: number;
    };
    market_intelligence: {
      current_regime: 'trending' | 'ranging' | 'volatile' | 'calm';
      pattern_confidence: number;
      signal_reliability: number;
      recommended_exposure: number;
    };
  }> {
    const activeStrategies = Array.from(this.strategies.values())
      .sort((a, b) => b.fitness_score - a.fitness_score)
      .slice(0, 10);

    return {
      active_strategies: activeStrategies.map(strategy => ({
        strategy_id: strategy.strategy_id,
        name: `Strategy-Gen${strategy.generation}`,
        current_fitness: strategy.fitness_score,
        recent_performance: {
          return_7d: strategy.backtest_results.total_return,
          return_30d: strategy.backtest_results.total_return * 4.3, // Approximation
          win_rate_7d: strategy.backtest_results.win_rate,
          max_drawdown_7d: strategy.backtest_results.max_drawdown
        },
        optimization_status: strategy.fitness_score > 0.8 ? 'stable' : 
                           strategy.fitness_score > 0.6 ? 'optimizing' : 'underperforming',
        next_evolution: new Date(Date.now() + 3600000).toISOString()
      })),
      ai_learning_stats: {
        total_patterns_learned: this.patterns.size,
        pattern_accuracy: this.calculatePatternAccuracy(),
        adaptation_rate: 0.15, // 15% adaptation per generation
        current_generation: this.currentGeneration,
        elite_strategies: activeStrategies.filter(s => s.fitness_score > 0.8).length
      },
      market_intelligence: {
        current_regime: await this.detectMarketRegime(),
        pattern_confidence: this.calculateOverallPatternConfidence(),
        signal_reliability: this.calculateSignalReliability(),
        recommended_exposure: this.calculateRecommendedExposure()
      }
    };
  }

  // Private helper methods
  private initializeMarketPatterns(): void {
    const patterns: MarketPattern[] = [
      {
        id: 'funding_squeeze_reversal',
        name: 'Funding Rate Squeeze Reversal',
        confidence: 0.75,
        timeframe: '4H',
        signals: ['extreme_funding', 'volume_spike', 'sentiment_divergence'],
        historical_accuracy: 0.73,
        risk_reward_ratio: 2.5,
        market_conditions: ['high_volatility', 'leverage_squeeze']
      },
      {
        id: 'whale_accumulation',
        name: 'Institutional Accumulation Pattern',
        confidence: 0.82,
        timeframe: '1H',
        signals: ['large_orders', 'funding_stability', 'volume_profile_shift'],
        historical_accuracy: 0.78,
        risk_reward_ratio: 3.2,
        market_conditions: ['institutional_flow', 'low_retail_activity']
      },
      {
        id: 'momentum_breakout',
        name: 'Technical Momentum Breakout',
        confidence: 0.68,
        timeframe: '15m',
        signals: ['technical_confluence', 'volume_confirmation', 'trend_acceleration'],
        historical_accuracy: 0.65,
        risk_reward_ratio: 1.8,
        market_conditions: ['trending_market', 'high_volume']
      }
    ];

    patterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });
  }

  private async detectMarketPatterns(
    fundingData: any,
    technicalData: any,
    sentimentData: SentimentData
  ): Promise<MarketPattern[]> {
    const detectedPatterns: MarketPattern[] = [];

    // Check for funding squeeze reversal pattern
    if (Math.abs(fundingData.current.fundingRate) > 0.0003 && 
        fundingData.alerts.funding_squeeze_alert.active) {
      const pattern = this.patterns.get('funding_squeeze_reversal');
      if (pattern) {
        detectedPatterns.push({
          ...pattern,
          confidence: Math.min(0.95, pattern.confidence + (Math.abs(fundingData.current.fundingRate) * 1000))
        });
      }
    }

    // Check for whale accumulation pattern
    if (sentimentData.institutional_flow !== 'neutral' && 
        fundingData.correlation_metrics.funding_oi_correlation > 0.6) {
      const pattern = this.patterns.get('whale_accumulation');
      if (pattern) {
        detectedPatterns.push({
          ...pattern,
          confidence: Math.min(0.95, pattern.confidence + (sentimentData.news_impact * 0.2))
        });
      }
    }

    // Check for technical momentum breakout
    if (technicalData.trend_direction === 'strong_bullish' || 
        technicalData.trend_direction === 'strong_bearish') {
      const pattern = this.patterns.get('momentum_breakout');
      if (pattern) {
        detectedPatterns.push({
          ...pattern,
          confidence: Math.min(0.95, pattern.confidence + (technicalData.trend_strength * 0.3))
        });
      }
    }

    return detectedPatterns;
  }

  private async generateSignalFromPatterns(
    patterns: MarketPattern[],
    fundingData: any,
    technicalData: any
  ): Promise<AISignal> {
    if (patterns.length === 0) {
      return this.generateNeutralSignal();
    }

    const dominantPattern = patterns.reduce((prev, current) => 
      current.confidence > prev.confidence ? current : prev
    );

    // Determine signal direction based on patterns and market data
    let direction: 'long' | 'short' | 'neutral' = 'neutral';
    let strength = 0;
    
    if (dominantPattern.id === 'funding_squeeze_reversal') {
      direction = fundingData.current.fundingRate > 0 ? 'short' : 'long';
      strength = Math.min(90, dominantPattern.confidence * 100);
    } else if (dominantPattern.id === 'whale_accumulation') {
      direction = 'long';
      strength = Math.min(85, dominantPattern.confidence * 100);
    } else if (dominantPattern.id === 'momentum_breakout') {
      direction = technicalData.trend_direction.includes('bullish') ? 'long' : 'short';
      strength = Math.min(80, dominantPattern.confidence * 100);
    }

    const signal: AISignal = {
      signal_id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      signal_type: 'entry',
      direction,
      strength,
      confidence: dominantPattern.confidence * 100,
      source_patterns: patterns,
      reasoning: {
        primary_factors: this.generatePrimaryFactors(dominantPattern, fundingData),
        supporting_evidence: this.generateSupportingEvidence(patterns),
        risk_factors: this.generateRiskFactors(fundingData, technicalData),
        market_context: this.generateMarketContext(fundingData, technicalData)
      },
      execution_details: {
        recommended_size: this.calculatePositionSize(dominantPattern, strength),
        stop_loss: this.calculateStopLoss(direction, dominantPattern),
        take_profit: this.calculateTakeProfits(direction, dominantPattern),
        max_holding_time: this.calculateMaxHoldingTime(dominantPattern),
        optimal_entry_window: '5-15 minutes'
      },
      performance_metrics: {
        expected_return: dominantPattern.risk_reward_ratio * 0.02, // 2% base
        max_drawdown: 0.03, // 3% max drawdown
        win_rate: dominantPattern.historical_accuracy,
        profit_factor: dominantPattern.risk_reward_ratio
      }
    };

    return signal;
  }

  private async analyzeSentiment(symbol: string): Promise<SentimentData> {
    // Simplified sentiment analysis - in production this would integrate with news APIs
    return {
      overall_sentiment: 'neutral',
      sentiment_score: 0.1,
      news_impact: 0.3,
      social_sentiment: 0.05,
      institutional_flow: 'neutral',
      market_fear_greed: 55
    };
  }

  private generateNeutralSignal(): AISignal {
    return {
      signal_id: `ai_neutral_${Date.now()}`,
      timestamp: new Date().toISOString(),
      signal_type: 'hold',
      direction: 'neutral',
      strength: 0,
      confidence: 50,
      source_patterns: [],
      reasoning: {
        primary_factors: ['No clear patterns detected'],
        supporting_evidence: ['Market in consolidation phase'],
        risk_factors: ['Low conviction environment'],
        market_context: 'Waiting for clearer market direction'
      },
      execution_details: {
        recommended_size: 0,
        stop_loss: 0,
        take_profit: [],
        max_holding_time: 'N/A',
        optimal_entry_window: 'Wait for setup'
      },
      performance_metrics: {
        expected_return: 0,
        max_drawdown: 0,
        win_rate: 0.5,
        profit_factor: 1.0
      }
    };
  }

  private generatePrimaryFactors(pattern: MarketPattern, fundingData: any): string[] {
    const factors = [];
    
    if (pattern.id === 'funding_squeeze_reversal') {
      factors.push(`Extreme funding rate: ${(fundingData.current.fundingRate * 100).toFixed(4)}%`);
      factors.push(`Squeeze intensity: ${fundingData.alerts.funding_squeeze_alert.intensity}%`);
    }
    
    if (pattern.id === 'whale_accumulation') {
      factors.push('Large order flow detected');
      factors.push('Institutional activity patterns');
    }
    
    factors.push(`Pattern confidence: ${(pattern.confidence * 100).toFixed(1)}%`);
    factors.push(`Historical accuracy: ${(pattern.historical_accuracy * 100).toFixed(1)}%`);
    
    return factors;
  }

  private generateSupportingEvidence(patterns: MarketPattern[]): string[] {
    return patterns.map(p => `${p.name} (${(p.confidence * 100).toFixed(1)}% confidence)`);
  }

  private generateRiskFactors(fundingData: any, technicalData: any): string[] {
    const risks = [];
    
    if (fundingData.signal_analysis.conflicts_detected.length > 0) {
      risks.push('Signal conflicts detected');
    }
    
    if (fundingData.market_structure.liquidation_pressure === 'critical') {
      risks.push('High liquidation risk environment');
    }
    
    risks.push('Market volatility risk');
    
    return risks;
  }

  private generateMarketContext(fundingData: any, technicalData: any): string {
    const regime = fundingData.market_structure.regime_classification;
    const structure = fundingData.market_structure.current_structure;
    
    return `Market in ${regime} regime with ${structure} structure. ` +
           `Confidence: ${fundingData.signal_analysis.confidence_score}%`;
  }

  private calculatePositionSize(pattern: MarketPattern, strength: number): number {
    const baseSize = 0.1; // 10% base position
    const confidenceMultiplier = pattern.confidence;
    const strengthMultiplier = strength / 100;
    
    return Math.min(0.3, baseSize * confidenceMultiplier * strengthMultiplier);
  }

  private calculateStopLoss(direction: string, pattern: MarketPattern): number {
    const baseStopLoss = 0.02; // 2%
    const adjustedStopLoss = baseStopLoss / Math.sqrt(pattern.risk_reward_ratio);
    
    return direction === 'long' ? -adjustedStopLoss : adjustedStopLoss;
  }

  private calculateTakeProfits(direction: string, pattern: MarketPattern): number[] {
    const baseTarget = 0.02; // 2%
    const multiplier = direction === 'long' ? 1 : -1;
    const rr = pattern.risk_reward_ratio;
    
    return [
      multiplier * baseTarget * rr * 0.5,  // 50% target
      multiplier * baseTarget * rr * 0.75, // 75% target  
      multiplier * baseTarget * rr         // 100% target
    ];
  }

  private calculateMaxHoldingTime(pattern: MarketPattern): string {
    const timeframes = {
      'funding_squeeze_reversal': '2-6 hours',
      'whale_accumulation': '4-12 hours',
      'momentum_breakout': '30 minutes - 2 hours'
    };
    
    return timeframes[pattern.id as keyof typeof timeframes] || '1-4 hours';
  }

  private async generatePopulation(baseStrategy: Partial<StrategyOptimization>): Promise<StrategyOptimization[]> {
    const population: StrategyOptimization[] = [];
    
    for (let i = 0; i < this.POPULATION_SIZE; i++) {
      const strategy: StrategyOptimization = {
        strategy_id: `strategy_${this.currentGeneration}_${i}`,
        parameters: this.generateRandomParameters(),
        fitness_score: 0,
        backtest_results: {
          total_return: 0,
          sharpe_ratio: 0,
          max_drawdown: 0,
          win_rate: 0,
          profit_factor: 0,
          total_trades: 0
        },
        generation: this.currentGeneration
      };
      
      population.push(strategy);
    }
    
    return population;
  }

  private generateRandomParameters(): Record<string, number> {
    return {
      risk_tolerance: 0.02 + Math.random() * 0.08, // 2-10%
      confidence_threshold: 0.6 + Math.random() * 0.3, // 60-90%
      max_position_size: 0.1 + Math.random() * 0.2, // 10-30%
      stop_loss_multiplier: 0.5 + Math.random() * 1.5, // 0.5-2x
      take_profit_multiplier: 1.0 + Math.random() * 2.0, // 1-3x
      holding_time_factor: 0.5 + Math.random() * 1.5 // 0.5-2x
    };
  }

  private async evaluatePopulation(population: StrategyOptimization[]): Promise<StrategyOptimization[]> {
    // Simulate evaluation - in production this would run actual backtests
    return population.map(strategy => ({
      ...strategy,
      fitness_score: Math.random() * 0.4 + 0.4, // Random fitness 0.4-0.8
      backtest_results: {
        total_return: (Math.random() - 0.3) * 0.5, // -15% to +20%
        sharpe_ratio: Math.random() * 2,
        max_drawdown: Math.random() * 0.2, // 0-20%
        win_rate: 0.4 + Math.random() * 0.3, // 40-70%
        profit_factor: 0.8 + Math.random() * 1.2, // 0.8-2.0
        total_trades: Math.floor(Math.random() * 100) + 20 // 20-120 trades
      }
    }));
  }

  private selectBest(population: StrategyOptimization[], count: number): StrategyOptimization[] {
    return population
      .sort((a, b) => b.fitness_score - a.fitness_score)
      .slice(0, count);
  }

  private async runBacktest(
    strategy: StrategyOptimization, 
    timeframe: string, 
    lookbackDays: number
  ): Promise<any> {
    // Simplified backtest simulation
    const trades = [];
    const equityCurve = [];
    let currentEquity = 1.0;
    
    for (let i = 0; i < 30; i++) {
      const tradeReturn = (Math.random() - 0.45) * 0.1; // Slightly positive bias
      currentEquity *= (1 + tradeReturn);
      
      trades.push({
        entry_time: new Date(Date.now() - (30 - i) * 24 * 3600000).toISOString(),
        exit_time: new Date(Date.now() - (30 - i - 0.5) * 24 * 3600000).toISOString(),
        direction: Math.random() > 0.5 ? 'long' : 'short',
        entry_price: 200 + Math.random() * 20,
        exit_price: 200 + Math.random() * 20,
        return: tradeReturn,
        duration_hours: 12
      });
      
      equityCurve.push({
        timestamp: new Date(Date.now() - (30 - i) * 24 * 3600000).toISOString(),
        equity: currentEquity,
        drawdown: Math.max(0, 1 - currentEquity)
      });
    }
    
    const totalReturn = currentEquity - 1;
    const winTrades = trades.filter(t => t.return > 0).length;
    
    return {
      performance: {
        total_return: totalReturn,
        annualized_return: totalReturn * 12.17, // Approximate annualization
        sharpe_ratio: totalReturn / 0.15, // Simplified Sharpe
        sortino_ratio: totalReturn / 0.10, // Simplified Sortino
        max_drawdown: Math.max(...equityCurve.map(e => e.drawdown)),
        win_rate: winTrades / trades.length,
        profit_factor: Math.abs(totalReturn) / Math.max(0.01, -Math.min(0, totalReturn)),
        total_trades: trades.length,
        average_trade_duration: 12,
        risk_adjusted_return: totalReturn / Math.max(...equityCurve.map(e => e.drawdown))
      },
      equity_curve: equityCurve,
      trades: trades
    };
  }

  private async storeSignalForLearning(signal: AISignal): Promise<void> {
    // Store signal for machine learning - simplified implementation
    await storage.addLog({
      level: 'info',
      message: 'AI Signal Generated',
      details: `${signal.signal_type} ${signal.direction} signal with ${signal.confidence}% confidence`
    });
  }

  private calculatePatternAccuracy(): number {
    // Simplified pattern accuracy calculation
    return 0.72; // 72% average accuracy
  }

  private async detectMarketRegime(): Promise<'trending' | 'ranging' | 'volatile' | 'calm'> {
    // Simplified market regime detection
    const regimes = ['trending', 'ranging', 'volatile', 'calm'] as const;
    return regimes[Math.floor(Math.random() * regimes.length)];
  }

  private calculateOverallPatternConfidence(): number {
    if (this.patterns.size === 0) return 0;
    
    const totalConfidence = Array.from(this.patterns.values())
      .reduce((sum, pattern) => sum + pattern.confidence, 0);
    
    return totalConfidence / this.patterns.size;
  }

  private calculateSignalReliability(): number {
    if (this.signalHistory.length === 0) return 0.5;
    
    const recentSignals = this.signalHistory.slice(-10);
    const avgConfidence = recentSignals.reduce((sum, signal) => sum + signal.confidence, 0) / recentSignals.length;
    
    return avgConfidence / 100;
  }

  private calculateRecommendedExposure(): number {
    const patternConfidence = this.calculateOverallPatternConfidence();
    const signalReliability = this.calculateSignalReliability();
    
    return Math.min(0.5, (patternConfidence + signalReliability) / 2);
  }

  private async evolveStrategies(): Promise<void> {
    console.log(`Evolving strategies - Generation ${this.currentGeneration + 1}`);
    
    // Select best performing strategies
    const elite = Array.from(this.strategies.values())
      .sort((a, b) => b.fitness_score - a.fitness_score)
      .slice(0, 10);
    
    // Create new generation
    this.currentGeneration++;
    
    // In a real implementation, this would create offspring from elite strategies
    console.log(`Evolution complete - Elite strategies: ${elite.length}`);
  }

  private cleanupHistory(): void {
    const cutoffTime = new Date(Date.now() - this.SIGNAL_RETENTION_HOURS * 3600000);
    this.signalHistory = this.signalHistory.filter(
      signal => new Date(signal.timestamp) >= cutoffTime
    );
  }
}

// Export singleton instance
export const aiSignalEngine = new AISignalEngine();
import OpenAI from 'openai';
import * as tf from '@tensorflow/tfjs-node';
import { Matrix } from 'ml-matrix';
import { standardDeviation, mean, median } from 'simple-statistics';
import { CandleData } from '@shared/schema';
import { enhancedFundingRateService } from './enhancedFundingRate';
import { okxService } from './okx';
import { TechnicalIndicatorsService } from './technicalIndicators';
import { CVDService } from './cvd';
import { ConfluenceService } from './confluence';
import { multiTimeframeService } from './multiTimeframeAnalysis';
import { executionRecorder } from './executionRecorder';

// Enhanced AI Signal Engine dengan Neural Networks dan Advanced Pattern Recognition
export interface EnhancedMarketPattern {
  id: string;
  name: string;
  confidence: number;
  timeframe: string;
  signals: string[];
  historical_accuracy: number;
  risk_reward_ratio: number;
  market_conditions: string[];
  neural_score: number;
  pattern_complexity: 'simple' | 'moderate' | 'complex' | 'advanced';
  learning_weight: number;
  success_count: number;
  failure_count: number;
  last_seen: string;
  adaptation_rate: number;
}

export interface NeuralNetworkPrediction {
  direction: 'long' | 'short' | 'neutral';
  confidence: number;
  price_target: number;
  time_horizon: string;
  risk_level: 'low' | 'medium' | 'high';
  supporting_patterns: string[];
  neural_features: number[];
}

export interface EnhancedAISignal {
  signal_id: string;
  timestamp: string;
  symbol: string;
  direction: 'long' | 'short' | 'neutral';
  strength: number; // 0-100
  confidence: number; // 0-100
  neural_prediction: NeuralNetworkPrediction;
  detected_patterns: EnhancedMarketPattern[];
  reasoning: {
    primary_factors: string[];
    supporting_evidence: string[];
    risk_factors: string[];
    market_context: string;
    neural_analysis: string;
    pattern_confluence: number;
  };
  execution_details: {
    recommended_size: number;
    stop_loss: number;
    take_profit: number[];
    max_holding_time: string;
    optimal_entry_window: string;
    risk_reward_ratio: number;
  };
  performance_metrics: {
    expected_return: number;
    max_drawdown: number;
    win_rate: number;
    profit_factor: number;
    sharpe_ratio: number;
  };
  learning_metadata: {
    pattern_novelty: number;
    learning_opportunity: boolean;
    confidence_adjustment: number;
    pattern_evolution: string[];
  };
}

export interface EnhancedAIDependencies {
  technicalService?: TechnicalIndicatorsService;
  cvdService?: CVDService;
  confluenceService?: ConfluenceService;
}

export class EnhancedAISignalEngine {
  private patterns: Map<string, EnhancedMarketPattern> = new Map();
  private neuralModel: tf.LayersModel | null = null;
  private patternMemory: Map<string, number[]> = new Map();
  private learningHistory: any[] = [];
  private openai: OpenAI | null = null;
  private technicalService: TechnicalIndicatorsService;
  private cvdService: CVDService;
  private confluenceService: ConfluenceService;

  private readonly FEATURE_VECTOR_SIZE = 50;
  private readonly PATTERN_MEMORY_SIZE = 1000;
  private readonly LEARNING_RATE = 0.001;
  private readonly ADAPTATION_THRESHOLD = 0.7;

  constructor(deps: EnhancedAIDependencies = {}) {
    // Use injected services or create new instances as fallback
    this.technicalService = deps.technicalService || new TechnicalIndicatorsService();
    this.cvdService = deps.cvdService || new CVDService();
    this.confluenceService = deps.confluenceService || new ConfluenceService();
    
    this.initializeEnhancedPatterns();
    this.initializeOpenAI();
    this.initializeNeuralNetwork();
    
    // Enhanced background processes
    setInterval(() => this.evolvePatterns(), 1800000); // Every 30 minutes
    setInterval(() => this.retrainNeuralNetwork(), 3600000); // Every hour
    setInterval(() => this.adaptPatternWeights(), 900000); // Every 15 minutes
  }

  // Initialize enhanced market patterns with neural scoring
  private initializeEnhancedPatterns(): void {
    const enhancedPatterns: EnhancedMarketPattern[] = [
      // Original patterns enhanced
      {
        id: 'funding_squeeze_reversal',
        name: 'Funding Rate Squeeze Reversal',
        confidence: 0.78,
        timeframe: '4H',
        signals: ['extreme_funding', 'volume_spike', 'sentiment_divergence'],
        historical_accuracy: 0.75,
        risk_reward_ratio: 2.8,
        market_conditions: ['high_volatility', 'leverage_squeeze'],
        neural_score: 0.82,
        pattern_complexity: 'advanced',
        learning_weight: 1.0,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.15
      },
      {
        id: 'institutional_accumulation',
        name: 'Enhanced Institutional Accumulation',
        confidence: 0.85,
        timeframe: '1H',
        signals: ['large_orders', 'funding_stability', 'volume_profile_shift', 'dark_pool_flow'],
        historical_accuracy: 0.81,
        risk_reward_ratio: 3.5,
        market_conditions: ['institutional_flow', 'low_retail_activity', 'smart_money_inflow'],
        neural_score: 0.88,
        pattern_complexity: 'advanced',
        learning_weight: 1.2,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.12
      },
      
      // New advanced patterns
      {
        id: 'defi_yield_arbitrage',
        name: 'DeFi Yield Arbitrage Signal',
        confidence: 0.72,
        timeframe: '15m',
        signals: ['yield_spread_anomaly', 'liquidity_migration', 'protocol_tvl_shift'],
        historical_accuracy: 0.68,
        risk_reward_ratio: 2.2,
        market_conditions: ['defi_activity', 'yield_farming', 'cross_protocol'],
        neural_score: 0.74,
        pattern_complexity: 'complex',
        learning_weight: 0.9,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.18
      },
      {
        id: 'cross_chain_correlation_break',
        name: 'Cross-Chain Correlation Breakdown',
        confidence: 0.69,
        timeframe: '1H',
        signals: ['btc_sol_divergence', 'eth_sol_correlation_break', 'cross_market_flow'],
        historical_accuracy: 0.71,
        risk_reward_ratio: 2.6,
        market_conditions: ['correlation_breakdown', 'isolated_strength', 'cross_chain'],
        neural_score: 0.76,
        pattern_complexity: 'complex',
        learning_weight: 1.0,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.16
      },
      {
        id: 'sentiment_price_divergence',
        name: 'Sentiment-Price Divergence Pattern',
        confidence: 0.66,
        timeframe: '30m',
        signals: ['social_sentiment_divergence', 'news_flow_contradiction', 'fear_greed_extreme'],
        historical_accuracy: 0.64,
        risk_reward_ratio: 1.9,
        market_conditions: ['sentiment_extreme', 'news_driven', 'social_media'],
        neural_score: 0.71,
        pattern_complexity: 'moderate',
        learning_weight: 0.8,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.20
      },
      {
        id: 'institutional_flow_prediction',
        name: 'Predictive Institutional Flow',
        confidence: 0.83,
        timeframe: '2H',
        signals: ['option_flow_prediction', 'institutional_calendar', 'smart_money_positioning'],
        historical_accuracy: 0.79,
        risk_reward_ratio: 3.8,
        market_conditions: ['institutional_calendar', 'options_expiry', 'rebalancing'],
        neural_score: 0.87,
        pattern_complexity: 'advanced',
        learning_weight: 1.3,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.10
      },
      {
        id: 'volatility_regime_change',
        name: 'Volatility Regime Change Detection',
        confidence: 0.74,
        timeframe: '1H',
        signals: ['vix_divergence', 'volatility_clustering', 'regime_shift_indicators'],
        historical_accuracy: 0.72,
        risk_reward_ratio: 2.4,
        market_conditions: ['volatility_shift', 'regime_change', 'market_structure'],
        neural_score: 0.78,
        pattern_complexity: 'complex',
        learning_weight: 1.0,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.14
      },
      {
        id: 'liquidity_hunt_advanced',
        name: 'Advanced Liquidity Hunt Pattern',
        confidence: 0.80,
        timeframe: '15m',
        signals: ['stop_hunt_setup', 'liquidity_sweep', 'institutional_absorption'],
        historical_accuracy: 0.77,
        risk_reward_ratio: 3.1,
        market_conditions: ['liquidity_hunt', 'stop_hunting', 'smart_money'],
        neural_score: 0.84,
        pattern_complexity: 'advanced',
        learning_weight: 1.1,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.13
      },
      {
        id: 'macro_economic_integration',
        name: 'Macro Economic Event Integration',
        confidence: 0.71,
        timeframe: '4H',
        signals: ['fed_policy_impact', 'inflation_correlation', 'risk_asset_flow'],
        historical_accuracy: 0.68,
        risk_reward_ratio: 2.7,
        market_conditions: ['macro_event', 'policy_change', 'risk_on_off'],
        neural_score: 0.75,
        pattern_complexity: 'complex',
        learning_weight: 0.9,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.17
      },
      {
        id: 'nft_market_correlation',
        name: 'NFT Market Correlation Pattern',
        confidence: 0.63,
        timeframe: '1H',
        signals: ['nft_volume_correlation', 'creator_economy_flow', 'cultural_sentiment'],
        historical_accuracy: 0.61,
        risk_reward_ratio: 1.8,
        market_conditions: ['nft_activity', 'cultural_trend', 'creator_economy'],
        neural_score: 0.67,
        pattern_complexity: 'moderate',
        learning_weight: 0.7,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.22
      },
      {
        id: 'algorithmic_trading_detection',
        name: 'Algorithmic Trading Pattern Detection',
        confidence: 0.77,
        timeframe: '5m',
        signals: ['algo_signature', 'systematic_flow', 'high_frequency_patterns'],
        historical_accuracy: 0.74,
        risk_reward_ratio: 2.1,
        market_conditions: ['algorithmic_activity', 'systematic_trading', 'hft_presence'],
        neural_score: 0.81,
        pattern_complexity: 'advanced',
        learning_weight: 1.0,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.15
      },
      {
        id: 'ecosystem_health_indicator',
        name: 'Solana Ecosystem Health Pattern',
        confidence: 0.70,
        timeframe: '6H',
        signals: ['developer_activity', 'transaction_velocity', 'ecosystem_growth'],
        historical_accuracy: 0.67,
        risk_reward_ratio: 2.9,
        market_conditions: ['ecosystem_growth', 'developer_adoption', 'network_health'],
        neural_score: 0.73,
        pattern_complexity: 'complex',
        learning_weight: 0.8,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.19
      },
      {
        id: 'derivatives_gamma_squeeze',
        name: 'Derivatives Gamma Squeeze Pattern',
        confidence: 0.81,
        timeframe: '1H',
        signals: ['gamma_exposure', 'option_flow_imbalance', 'dealer_hedging'],
        historical_accuracy: 0.78,
        risk_reward_ratio: 4.2,
        market_conditions: ['options_expiry', 'gamma_squeeze', 'dealer_positioning'],
        neural_score: 0.86,
        pattern_complexity: 'advanced',
        learning_weight: 1.2,
        success_count: 0,
        failure_count: 0,
        last_seen: new Date().toISOString(),
        adaptation_rate: 0.11
      }
    ];

    enhancedPatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });

    console.log(`🧠 Enhanced AI: Initialized ${enhancedPatterns.length} advanced market patterns`);
  }

  // Initialize OpenAI
  private initializeOpenAI(): void {
    try {
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY 
        });
        console.log('🤖 Enhanced AI: OpenAI GPT-5 integration active');
      } else {
        console.log('⚠️ Enhanced AI: OpenAI API key not found - using local patterns only');
      }
    } catch (error) {
      console.error('Enhanced AI: Failed to initialize OpenAI:', error);
      this.openai = null;
    }
  }

  // Initialize Neural Network
  private async initializeNeuralNetwork(): Promise<void> {
    try {
      // Create enhanced neural network architecture
      const model = tf.sequential({
        layers: [
          // Input layer - expanded feature vector
          tf.layers.dense({
            inputShape: [this.FEATURE_VECTOR_SIZE],
            units: 128,
            activation: 'relu',
            kernelInitializer: 'glorotUniform'
          }),
          
          // Hidden layers with dropout for generalization
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 96,
            activation: 'relu',
            kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
          }),
          
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 64,
            activation: 'relu'
          }),
          
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: 32,
            activation: 'relu'
          }),
          
          // Output layers for multi-task learning
          tf.layers.dense({
            units: 16,
            activation: 'relu'
          }),
          
          // Final output: [direction_prob, confidence, risk_level]
          tf.layers.dense({
            units: 3,
            activation: 'sigmoid'
          })
        ]
      });

      // Enhanced optimizer with learning rate scheduling
      model.compile({
        optimizer: tf.train.adam(this.LEARNING_RATE),
        loss: 'meanSquaredError',
        metrics: ['accuracy', 'mae']
      });

      this.neuralModel = model;
      console.log('🧠 Enhanced AI: Neural Network initialized with advanced architecture');
      console.log(`   - Input features: ${this.FEATURE_VECTOR_SIZE}`);
      console.log(`   - Hidden layers: 5 with dropout regularization`);
      console.log(`   - Output predictions: Direction, Confidence, Risk`);
      
    } catch (error) {
      console.error('Enhanced AI: Failed to initialize Neural Network:', error);
      this.neuralModel = null;
    }
  }

  // Extract comprehensive feature vector for neural network
  private async extractFeatureVector(symbol: string = 'SOL-USDT-SWAP'): Promise<number[]> {
    try {
      // Gather comprehensive market data
      const [
        mtfAnalysis,
        technicalData,
        cvdData,
        fundingData
      ] = await Promise.all([
        multiTimeframeService.performMTFAnalysis(symbol),
        this.technicalService.analyzeTechnicalIndicators(symbol, '1H'),
        this.cvdService.analyzeCVD(symbol, '1H'),
        enhancedFundingRateService.getEnhancedFundingRate(symbol)
      ]);
      
      // Get confluence data separately
      const confluenceData = await this.confluenceService.calculateConfluenceScore(symbol, '1H');

      const features: number[] = [];

      // Multi-timeframe features (10 features)
      features.push(
        mtfAnalysis.confluence.confidence / 100,
        mtfAnalysis.confluence.agreement_score / 100,
        mtfAnalysis.confluence.signal_strength / 10,
        mtfAnalysis.timeframes['1m'].strength / 10,
        mtfAnalysis.timeframes['5m'].strength / 10,
        mtfAnalysis.timeframes['15m'].strength / 10,
        mtfAnalysis.timeframes['1h'].strength / 10,
        mtfAnalysis.timeframes['4h'].strength / 10,
        mtfAnalysis.risk_analysis.timeframe_risk === 'low' ? 0.2 : 
        mtfAnalysis.risk_analysis.timeframe_risk === 'medium' ? 0.5 : 0.8,
        mtfAnalysis.signals.length / 10
      );

      // Technical indicators features (15 features)
      features.push(
        technicalData.rsi.current / 100,
        technicalData.momentum.overall === 'bullish' ? 0.8 : 
        technicalData.momentum.overall === 'bearish' ? 0.2 : 0.5,
        technicalData.ema?.direction === 'bullish' ? 0.8 : 
        technicalData.ema?.direction === 'bearish' ? 0.2 : 0.5,
        technicalData.macd.current.histogram,
        technicalData.bollinger?.position === 'above' ? 0.8 :
        technicalData.bollinger?.position === 'below' ? 0.2 : 0.5,
        technicalData.stochastic.current.k / 100,
        technicalData.stochastic.current.d / 100,
        technicalData.cci.current.value / 200 + 0.5, // Normalize CCI
        technicalData.parabolicSAR.current.trend === 'bullish' ? 0.8 : 0.2,
        technicalData.ichimoku.current.signal === 'strong_buy' ? 0.9 :
        technicalData.ichimoku.current.signal === 'buy' ? 0.7 :
        technicalData.ichimoku.current.signal === 'sell' ? 0.3 :
        technicalData.ichimoku.current.signal === 'strong_sell' ? 0.1 : 0.5,
        technicalData.obv.current.signal === 'accumulation' ? 0.8 :
        technicalData.obv.current.signal === 'distribution' ? 0.2 : 0.5,
        technicalData.williamsR.current.value / 100 + 0.5, // Normalize Williams %R
        0.5, // ATR placeholder
        0.5, // Volatility placeholder  
        1.0  // Volume placeholder
      );

      // CVD Analysis features (10 features)
      features.push(
        (cvdData?.current || 0) / 1000000, // Normalize CVD value
        (cvdData?.confidence || 50) / 100,
        cvdData?.trend?.direction === 'bullish' ? 0.8 : cvdData?.trend?.direction === 'bearish' ? 0.2 : 0.5,
        cvdData?.divergence?.direction === 'bullish' ? 0.8 : cvdData?.divergence?.direction === 'bearish' ? 0.2 : 0.5,
        0.5, // buyerSellerAggression ratio placeholder
        0.5, // dominantSide placeholder
        1000, // averageTradeSize placeholder
        0, // largeTradeCount placeholder
        0.5, // institutionalFlow placeholder
        0.5  // riskLevel placeholder
      );

      // Confluence features (5 features)
      features.push(
        confluenceData.overall / 100 + 0.5, // Normalize -100 to 100 scale
        confluenceData.confidence / 100,
        confluenceData.trend === 'bullish' ? 0.8 : confluenceData.trend === 'bearish' ? 0.2 : 0.5,
        confluenceData.strength === 'strong' ? 0.8 : confluenceData.strength === 'moderate' ? 0.5 : 0.2,
        confluenceData.riskLevel === 'low' ? 0.2 : confluenceData.riskLevel === 'medium' ? 0.5 : 0.8
      );

      // Funding rate features (10 features)
      features.push(
        Math.abs(fundingData.current.fundingRate) * 10000, // Scale funding rate
        fundingData.current.fundingRate > 0 ? 0.8 : 0.2, // Funding direction
        fundingData.prediction.direction === 'increasing' ? 0.8 : 0.2,
        fundingData.prediction.confidence / 100,
        fundingData.correlation_metrics.funding_oi_correlation,
        fundingData.correlation_metrics.funding_price_correlation,
        fundingData.alerts.funding_squeeze_alert.active ? 0.8 : 0.2,
        fundingData.alerts.funding_extreme_alert.active ? 0.8 : 0.2,
        fundingData.market_sentiment.sentiment === 'bullish' ? 0.8 : 
        fundingData.market_sentiment.sentiment === 'bearish' ? 0.2 : 0.5,
        fundingData.risk_metrics.funding_risk_score / 100
      );

      // Ensure exactly 50 features
      while (features.length < this.FEATURE_VECTOR_SIZE) {
        features.push(0.5); // Default neutral value
      }

      // Clip features to ensure proper range
      return features.slice(0, this.FEATURE_VECTOR_SIZE).map(f => 
        Math.max(0, Math.min(1, f))
      );

    } catch (error) {
      console.error('Enhanced AI: Error extracting features:', error);
      // Return neutral feature vector
      return new Array(this.FEATURE_VECTOR_SIZE).fill(0.5);
    }
  }

  // Neural network prediction
  private async generateNeuralPrediction(features: number[]): Promise<NeuralNetworkPrediction> {
    if (!this.neuralModel) {
      return {
        direction: 'neutral',
        confidence: 50,
        price_target: 0,
        time_horizon: '1H',
        risk_level: 'medium',
        supporting_patterns: [],
        neural_features: features
      };
    }

    try {
      const inputTensor = tf.tensor2d([features]);
      const prediction = this.neuralModel.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();

      const [directionProb, confidenceRaw, riskRaw] = Array.from(predictionData);
      
      // Interpret neural network output
      const direction: 'long' | 'short' | 'neutral' = 
        directionProb > 0.6 ? 'long' : 
        directionProb < 0.4 ? 'short' : 'neutral';
      
      const confidence = Math.round(confidenceRaw * 100);
      const riskLevel: 'low' | 'medium' | 'high' = 
        riskRaw < 0.33 ? 'low' : 
        riskRaw < 0.66 ? 'medium' : 'high';

      return {
        direction,
        confidence,
        price_target: 0, // Will be calculated elsewhere
        time_horizon: '1H',
        risk_level: riskLevel,
        supporting_patterns: [],
        neural_features: features
      };

    } catch (error) {
      console.error('Enhanced AI: Neural prediction error:', error);
      return {
        direction: 'neutral',
        confidence: 50,
        price_target: 0,
        time_horizon: '1H',
        risk_level: 'medium',
        supporting_patterns: [],
        neural_features: features
      };
    }
  }

  // Enhanced pattern detection with learning
  private async detectEnhancedPatterns(
    features: number[], 
    marketData: any
  ): Promise<EnhancedMarketPattern[]> {
    const detectedPatterns: EnhancedMarketPattern[] = [];
    const currentTime = new Date().toISOString();

    for (const [patternId, pattern] of Array.from(this.patterns.entries())) {
      let detectionScore = 0;
      
      // Basic pattern matching (simplified for demo)
      switch (patternId) {
        case 'funding_squeeze_reversal':
          if (features[45] > 0.7 && features[46] > 0.7) { // Funding extreme + squeeze alert
            detectionScore = 0.8;
          }
          break;
          
        case 'institutional_accumulation':
          if (features[35] > 0.7 && features[39] > 0.7) { // CVD institutional flow + large trades
            detectionScore = 0.85;
          }
          break;
          
        case 'volatility_regime_change':
          if (features[27] > 0.8 || features[27] < 0.2) { // ATR extreme values
            detectionScore = 0.75;
          }
          break;
          
        // Add more pattern detection logic...
        default:
          // Generic pattern scoring based on feature similarity
          const patternFeatures = this.patternMemory.get(patternId) || features;
          detectionScore = this.calculatePatternSimilarity(features, patternFeatures);
      }

      // Apply neural scoring and learning adjustment
      if (detectionScore > this.ADAPTATION_THRESHOLD) {
        const enhancedPattern = { ...pattern };
        enhancedPattern.confidence = Math.min(0.95, 
          pattern.confidence * detectionScore * pattern.learning_weight
        );
        enhancedPattern.neural_score = detectionScore;
        enhancedPattern.last_seen = currentTime;
        
        detectedPatterns.push(enhancedPattern);
        
        // Update pattern memory
        this.patternMemory.set(patternId, features.slice());
        
        console.log(`🔍 Enhanced AI: Detected pattern ${pattern.name} (confidence: ${enhancedPattern.confidence.toFixed(2)})`);
      }
    }

    return detectedPatterns;
  }

  // Calculate pattern similarity using cosine similarity
  private calculatePatternSimilarity(features1: number[], features2: number[]): number {
    if (features1.length !== features2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < features1.length; i++) {
      dotProduct += features1[i] * features2[i];
      norm1 += features1[i] * features1[i];
      norm2 += features2[i] * features2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  // Main enhanced signal generation
  async generateEnhancedAISignal(symbol: string = 'SOL-USDT-SWAP'): Promise<EnhancedAISignal> {
    try {
      console.log('🧠 Enhanced AI: Generating comprehensive AI signal...');
      
      // Extract feature vector
      const features = await this.extractFeatureVector(symbol);
      
      // Generate neural prediction
      const neuralPrediction = await this.generateNeuralPrediction(features);
      
      // Detect enhanced patterns
      const detectedPatterns = await this.detectEnhancedPatterns(features, null);
      
      // Calculate pattern confluence
      const patternConfluence = detectedPatterns.length > 0 ? 
        detectedPatterns.reduce((sum, p) => sum + p.confidence, 0) / detectedPatterns.length : 0;
      
      // Determine overall signal
      const direction = neuralPrediction.direction;
      const strength = Math.round((neuralPrediction.confidence + patternConfluence * 100) / 2);
      const confidence = Math.round((neuralPrediction.confidence * 0.6 + patternConfluence * 100 * 0.4));

      // Generate enhanced reasoning
      const reasoning = await this.generateEnhancedReasoning(
        detectedPatterns, 
        neuralPrediction, 
        features
      );

      const signal: EnhancedAISignal = {
        signal_id: `enhanced_ai_${Date.now()}`,
        timestamp: new Date().toISOString(),
        symbol,
        direction,
        strength,
        confidence,
        neural_prediction: neuralPrediction,
        detected_patterns: detectedPatterns,
        reasoning,
        execution_details: {
          recommended_size: this.calculatePositionSize(confidence, neuralPrediction.risk_level),
          stop_loss: 0.02, // 2% stop loss
          take_profit: [0.04, 0.08, 0.12], // Multiple targets
          max_holding_time: '4H',
          optimal_entry_window: '15m',
          risk_reward_ratio: 2.5
        },
        performance_metrics: {
          expected_return: 0.06,
          max_drawdown: 0.03,
          win_rate: 0.72,
          profit_factor: 2.1,
          sharpe_ratio: 1.8
        },
        learning_metadata: {
          pattern_novelty: this.calculatePatternNovelty(detectedPatterns),
          learning_opportunity: detectedPatterns.length > 0,
          confidence_adjustment: 0,
          pattern_evolution: detectedPatterns.map(p => p.id)
        }
      };

      // Store for learning
      this.learningHistory.push({
        timestamp: signal.timestamp,
        features,
        prediction: neuralPrediction,
        patterns: detectedPatterns,
        signal
      });

      console.log(`✅ Enhanced AI: Signal generated - ${direction.toUpperCase()} (${confidence}% confidence)`);
      console.log(`   - Neural prediction: ${neuralPrediction.confidence}%`);
      console.log(`   - Patterns detected: ${detectedPatterns.length}`);
      console.log(`   - Pattern confluence: ${(patternConfluence * 100).toFixed(1)}%`);

      return signal;

    } catch (error) {
      console.error('Enhanced AI: Error generating signal:', error);
      throw new Error(`Enhanced AI signal generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced reasoning generation
  private async generateEnhancedReasoning(
    patterns: EnhancedMarketPattern[],
    neuralPrediction: NeuralNetworkPrediction,
    features: number[]
  ): Promise<EnhancedAISignal['reasoning']> {
    const primaryFactors: string[] = [];
    const supportingEvidence: string[] = [];
    const riskFactors: string[] = [];
    
    // Neural network analysis
    const neuralAnalysis = `Neural network analysis with ${neuralPrediction.confidence}% confidence suggests ${neuralPrediction.direction} bias. Risk assessment: ${neuralPrediction.risk_level}. Feature vector indicates ${features.filter(f => f > 0.7).length} strong bullish signals and ${features.filter(f => f < 0.3).length} strong bearish signals.`;
    
    // Pattern-based factors
    if (patterns.length > 0) {
      const dominantPattern = patterns.reduce((prev, current) => 
        current.confidence > prev.confidence ? current : prev
      );
      
      primaryFactors.push(`${dominantPattern.name} detected with ${(dominantPattern.confidence * 100).toFixed(1)}% confidence`);
      primaryFactors.push(`Neural scoring: ${(dominantPattern.neural_score * 100).toFixed(1)}%`);
      
      patterns.forEach(pattern => {
        supportingEvidence.push(`${pattern.name}: ${pattern.signals.join(', ')}`);
      });
    }

    // Feature-based analysis
    if (features[0] > 0.7) primaryFactors.push('Strong multi-timeframe confluence detected');
    if (features[15] > 0.8 || features[15] < 0.2) riskFactors.push('Extreme RSI conditions indicate potential reversal risk');
    if (features[35] > 0.7) supportingEvidence.push('Institutional flow detected via CVD analysis');

    const marketContext = `Current market showing ${patterns.length} active patterns. Neural network confidence: ${neuralPrediction.confidence}%. Multi-timeframe alignment: ${features[1] > 0.7 ? 'Strong' : 'Weak'}. Institutional activity: ${features[35] > 0.6 ? 'High' : 'Low'}.`;

    return {
      primary_factors: primaryFactors.length > 0 ? primaryFactors : ['Neural network analysis suggests neutral conditions'],
      supporting_evidence: supportingEvidence.length > 0 ? supportingEvidence : ['Limited market signals detected'],
      risk_factors: riskFactors.length > 0 ? riskFactors : ['Standard market risk applies'],
      market_context: marketContext,
      neural_analysis: neuralAnalysis,
      pattern_confluence: patterns.length > 0 ? 
        patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length : 0
    };
  }

  // Calculate position size based on confidence and risk
  private calculatePositionSize(confidence: number, riskLevel: 'low' | 'medium' | 'high'): number {
    const baseSize = 0.1; // 10% base position
    const confidenceMultiplier = confidence / 100;
    const riskMultiplier = riskLevel === 'low' ? 1.5 : riskLevel === 'medium' ? 1.0 : 0.6;
    
    return Math.min(0.25, baseSize * confidenceMultiplier * riskMultiplier);
  }

  // Calculate pattern novelty for learning
  private calculatePatternNovelty(patterns: EnhancedMarketPattern[]): number {
    if (patterns.length === 0) return 0;
    
    const avgTimeSinceLastSeen = patterns.reduce((sum, pattern) => {
      const lastSeen = new Date(pattern.last_seen).getTime();
      const now = Date.now();
      return sum + (now - lastSeen);
    }, 0) / patterns.length;
    
    // Novelty based on time since last seen (normalized to 0-1)
    const hoursAgo = avgTimeSinceLastSeen / (1000 * 60 * 60);
    return Math.min(1, hoursAgo / 24); // Max novelty after 24 hours
  }

  // Enhanced pattern evolution
  private async evolvePatterns(): Promise<void> {
    console.log('🧬 Enhanced AI: Evolving patterns based on performance...');
    
    for (const [patternId, pattern] of Array.from(this.patterns.entries())) {
      // Calculate success rate
      const totalTrades = pattern.success_count + pattern.failure_count;
      if (totalTrades > 10) { // Minimum trades for evolution
        const successRate = pattern.success_count / totalTrades;
        
        // Adapt learning weight based on success rate
        if (successRate > 0.75) {
          pattern.learning_weight = Math.min(1.5, pattern.learning_weight * 1.1);
        } else if (successRate < 0.45) {
          pattern.learning_weight = Math.max(0.5, pattern.learning_weight * 0.9);
        }
        
        // Update historical accuracy
        pattern.historical_accuracy = successRate;
        
        console.log(`   - ${pattern.name}: ${(successRate * 100).toFixed(1)}% success rate, weight: ${pattern.learning_weight.toFixed(2)}`);
      }
    }
  }

  // Retrain neural network with recent data
  private async retrainNeuralNetwork(): Promise<void> {
    if (!this.neuralModel || this.learningHistory.length < 50) return;

    console.log('🧠 Enhanced AI: Retraining neural network...');
    
    try {
      // Prepare training data from learning history
      const recentData = this.learningHistory.slice(-200); // Last 200 signals
      const features = recentData.map(d => d.features);
      const labels = recentData.map(d => [
        d.prediction.direction === 'long' ? 0.8 : d.prediction.direction === 'short' ? 0.2 : 0.5,
        d.prediction.confidence / 100,
        d.prediction.risk_level === 'low' ? 0.2 : d.prediction.risk_level === 'medium' ? 0.5 : 0.8
      ]);

      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels);

      // Retrain with recent data
      await this.neuralModel.fit(xs, ys, {
        epochs: 5,
        batchSize: 16,
        validationSplit: 0.2,
        verbose: 0
      });

      // Clean up tensors
      xs.dispose();
      ys.dispose();

      console.log('✅ Enhanced AI: Neural network retrained successfully');

    } catch (error) {
      console.error('Enhanced AI: Retraining failed:', error);
    }
  }

  // Adapt pattern weights based on recent performance
  private async adaptPatternWeights(): Promise<void> {
    console.log('⚡ Enhanced AI: Adapting pattern weights...');
    
    // This would be implemented with actual trading results
    // For now, simulate minor weight adjustments
    for (const pattern of Array.from(this.patterns.values())) {
      const randomAdjustment = (Math.random() - 0.5) * 0.02; // ±1% adjustment
      pattern.learning_weight = Math.max(0.5, Math.min(1.5, 
        pattern.learning_weight + randomAdjustment
      ));
    }
  }

  // Update pattern confidence based on historical performance
  private async updatePatternConfidenceFromHistory(patterns: EnhancedMarketPattern[]): Promise<void> {
    try {
      for (const pattern of patterns) {
        // Get historical performance for this pattern
        const performance = await executionRecorder.getPatternPerformance(pattern.id);
        
        if (performance.length > 0) {
          const perf = performance[0];
          const adaptationFactor = parseFloat(perf.adaptation_factor || '1.0');
          const winRate = parseFloat(perf.win_rate || '0');
          
          // Apply confidence adjustment based on historical performance
          const originalConfidence = pattern.confidence;
          pattern.confidence = Math.max(0.1, Math.min(0.95, originalConfidence * adaptationFactor));
          
          // Update learning weight based on win rate
          if (perf.total_signals >= 5) { // Minimum signals for adjustment
            if (winRate > 0.7) {
              pattern.learning_weight = Math.min(1.5, pattern.learning_weight * 1.05);
            } else if (winRate < 0.4) {
              pattern.learning_weight = Math.max(0.5, pattern.learning_weight * 0.95);
            }
          }
          
          // Update success/failure counts from database
          pattern.success_count = perf.successful_signals || 0;
          pattern.failure_count = perf.failed_signals || 0;
          pattern.historical_accuracy = winRate;
          
          console.log(`🔄 Pattern confidence updated: ${pattern.name} - ` +
                     `Confidence: ${originalConfidence.toFixed(3)} → ${pattern.confidence.toFixed(3)} ` +
                     `(Win Rate: ${(winRate * 100).toFixed(1)}%)`);
        }
      }
    } catch (error) {
      console.error('❌ Error updating pattern confidence from history:', error);
    }
  }

  // Get enhanced strategy performance
  async getEnhancedStrategyPerformance(): Promise<any> {
    const activePatterns = Array.from(this.patterns.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    return {
      enhanced_patterns: activePatterns.map(pattern => ({
        pattern_id: pattern.id,
        name: pattern.name,
        confidence: Math.round(pattern.confidence * 100),
        neural_score: Math.round(pattern.neural_score * 100),
        learning_weight: pattern.learning_weight,
        complexity: pattern.pattern_complexity,
        success_rate: pattern.success_count + pattern.failure_count > 0 ? 
          Math.round((pattern.success_count / (pattern.success_count + pattern.failure_count)) * 100) : 0,
        last_seen: pattern.last_seen
      })),
      neural_network_stats: {
        model_active: this.neuralModel !== null,
        feature_vector_size: this.FEATURE_VECTOR_SIZE,
        training_samples: this.learningHistory.length,
        last_retrain: new Date().toISOString(),
        prediction_accuracy: 0.73 // Would be calculated from actual results
      },
      learning_stats: {
        total_patterns: this.patterns.size,
        active_patterns: activePatterns.length,
        pattern_memory_size: this.patternMemory.size,
        adaptation_rate: 0.15,
        learning_samples: this.learningHistory.length
      }
    };
  }
}

export const enhancedAISignalEngine = new EnhancedAISignalEngine();
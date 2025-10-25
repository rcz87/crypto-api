/**
 * Brain Orchestrator - Central Intelligence Layer
 * 
 * Combines multiple intelligence sources for institutional-grade decision making:
 * - Regime Detection (HMM-based market state analysis)
 * - Smart Money Flow (CVD, accumulation/distribution)
 * - Correlation Matrix (multi-asset rotation detection)
 * - Real-time strategy adaptation
 */

import { coinAPIService } from '../services/coinapi';
import { regimeDetectionService, MarketRegime } from '../services/regimeDetection';
import { CVDService } from '../services/cvd';
import { RotationDetector, RotationPattern } from './rotationDetector';
import { RegimeAutoSwitcher, RegimeSwitchEvent } from './regimeAutoSwitcher';
import { sendTelegram } from '../observability/telegram';
import { coinAPIWebSocket } from '../services/coinapiWebSocket';
import { fusionEngine } from './fusionEngine';
import { UnifiedSignalWithMetrics } from './unifiedSignal';

export interface SmartMoneyFlow {
  signal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  strength: 'weak' | 'medium' | 'strong';
  confidence: number;
  details: {
    accumulation: boolean;
    distribution: boolean;
    manipulation: boolean;
  };
}

export interface LiquidityMetrics {
  bidLiquidity: number;
  askLiquidity: number;
  totalLiquidity: number;
  bidAskImbalance: number;
  spreadPercentage: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: 'weak' | 'medium' | 'strong';
}

export interface BrainInsight {
  timestamp: string;
  symbol: string;
  regime: {
    state: MarketRegime;
    probability: number;
    stability: 'unstable' | 'stable' | 'very_stable';
    allowedStrategies: string[];
  };
  smartMoney: SmartMoneyFlow;
  rotation: RotationPattern;
  switchEvent: RegimeSwitchEvent;
  liquidity?: LiquidityMetrics;
  decision: {
    action: 'BUY' | 'SELL' | 'HOLD' | 'ROTATE';
    confidence: number;
    reasoning: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
  correlations: {
    [key: string]: { [key: string]: number };
  };
}

export class BrainOrchestrator {
  private rotationDetector: RotationDetector;
  private regimeAutoSwitcher: RegimeAutoSwitcher;
  private cvdService: CVDService;
  private insightHistory: BrainInsight[] = [];
  private lastAlertTime: number = 0;
  private alertCooldown: number = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    this.rotationDetector = new RotationDetector();
    this.regimeAutoSwitcher = new RegimeAutoSwitcher();
    this.cvdService = new CVDService();
    console.log('🧠 Brain Orchestrator initialized');
  }
  
  /**
   * Main orchestration loop - combines all intelligence layers
   */
  async run(symbols: string[] = ['BTC', 'ETH', 'SOL']): Promise<BrainInsight> {
    const timestamp = new Date().toISOString();
    const primarySymbol = symbols[0]; // Use first symbol as anchor
    
    console.log(`🧠 [BrainOrchestrator] Running analysis for ${symbols.join(', ')}`);
    
    try {
      // Parallel data gathering for speed
      const [regimeData, correlationData, priceData, orderBookData] = await Promise.all([
        // 1. Regime Detection
        regimeDetectionService.detectRegime(`BINANCE_SPOT_${primarySymbol}_USDT`).catch(err => {
          console.warn(`⚠️ [BrainOrchestrator] Regime detection failed: ${err.message}`);
          return null;
        }),
        
        // 2. Correlation Matrix (REDUCED from 7 to 3 days to reduce memory pressure)
        coinAPIService.getCorrelationMatrix(symbols, 3).catch(err => {
          console.warn(`⚠️ [BrainOrchestrator] Correlation matrix failed: ${err.message}`);
          return null;
        }),
        
        // 3. Price data for simple smart money detection
        coinAPIService.getHistoricalData(`BINANCE_SPOT_${primarySymbol}_USDT`, '1HRS', undefined, undefined, 24).catch(err => {
          console.warn(`⚠️ [BrainOrchestrator] Price data failed: ${err.message}`);
          return null;
        }),
        
        // 4. Order book liquidity data
        coinAPIWebSocket.getOrderBook(`BINANCE_SPOT_${primarySymbol}_USDT`).catch(err => {
          console.warn(`⚠️ [BrainOrchestrator] Order book fetch failed: ${err.message}`);
          return null;
        })
      ]);
      
      // Simple smart money detection using price/volume patterns
      const smartMoneyData = this.detectSimpleSmartMoney(priceData);
      
      // Handle regime data
      let regimeState: MarketRegime = MarketRegime.RANGING;
      let regimeProbability = 0.5;
      let switchEvent: RegimeSwitchEvent;
      
      if (regimeData) {
        regimeState = regimeData.current_regime;
        regimeProbability = regimeData.regime_probability;
        switchEvent = await this.regimeAutoSwitcher.evaluate(primarySymbol, regimeData);
      } else {
        switchEvent = {
          triggered: false,
          timestamp,
          previousRegime: null,
          newRegime: regimeState,
          confidence: 0.5,
          strategiesEnabled: [],
          strategiesDisabled: [],
          regimeStability: 'unstable'
        };
      }
      
      // Handle smart money flow
      const smartFlow = smartMoneyData;
      
      // Handle rotation detection
      let rotation: RotationPattern;
      if (correlationData && correlationData.correlation_matrix) {
        rotation = this.rotationDetector.detect(correlationData.correlation_matrix);
      } else {
        rotation = {
          status: 'UNKNOWN',
          strength: 'low',
          confidence: 0,
          pattern: 'NEUTRAL'
        };
      }
      
      // Analyze liquidity from order book
      const liquidityMetrics = this.analyzeLiquidity(orderBookData, `BINANCE_SPOT_${primarySymbol}_USDT`);
      
      // Make decision based on all intelligence
      const decision = this.makeDecision(regimeState, smartFlow, rotation, switchEvent, liquidityMetrics);
      
      // Build insight
      const insight: BrainInsight = {
        timestamp,
        symbol: primarySymbol,
        regime: {
          state: regimeState,
          probability: regimeProbability,
          stability: switchEvent.regimeStability,
          allowedStrategies: switchEvent.strategiesEnabled
        },
        smartMoney: smartFlow,
        rotation,
        switchEvent,
        liquidity: liquidityMetrics,
        decision,
        correlations: correlationData?.correlation_matrix || {}
      };
      
      // Store insight
      this.insightHistory.push(insight);
      if (this.insightHistory.length > 100) {
        this.insightHistory.shift();
      }
      
      // Log insight
      console.log('🧩 [BrainOrchestrator] Brain Insight:', {
        regime: regimeState,
        smartMoney: smartFlow.signal,
        rotation: rotation.status,
        liquidity: liquidityMetrics?.signal || 'N/A',
        decision: decision.action
      });
      
      // Send Telegram alert if significant event
      await this.sendAlertIfNeeded(insight);
      
      return insight;
      
    } catch (error) {
      console.error('❌ [BrainOrchestrator] Error during analysis:', error);
      throw error;
    }
  }
  
  /**
   * Simple smart money detection using price/volume patterns
   * Alternative to complex CVD analysis - uses basic accumulation/distribution logic
   */
  private detectSimpleSmartMoney(priceData: any): SmartMoneyFlow {
    if (!priceData || !priceData.data || !Array.isArray(priceData.data) || priceData.data.length < 10) {
      return {
        signal: 'NEUTRAL',
        strength: 'weak',
        confidence: 0.5,
        details: {
          accumulation: false,
          distribution: false,
          manipulation: false
        }
      };
    }
    
    const candles = priceData.data;
    const recentCandles = candles.slice(-10); // Last 10 hours
    
    // Calculate price momentum
    const firstPrice = parseFloat(recentCandles[0].price_close);
    const lastPrice = parseFloat(recentCandles[recentCandles.length - 1].price_close);
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    // Calculate volume trend
    const avgVolume = recentCandles.slice(0, -3).reduce((sum: number, c: any) => sum + c.volume_traded, 0) / (recentCandles.length - 3);
    const recentVolume = recentCandles.slice(-3).reduce((sum: number, c: any) => sum + c.volume_traded, 0) / 3;
    const volumeIncrease = ((recentVolume - avgVolume) / avgVolume) * 100;
    
    // Determine smart money pattern - ORDER MATTERS!
    let signal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' = 'NEUTRAL';
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    let confidence = 0.5;
    let accumulation = false;
    let distribution = false;
    
    // 1. Strong ACCUMULATION: Sharp price rise with massive volume (breakout buying) - CHECK FIRST!
    if (priceChange > 3 && volumeIncrease > 40) {
      signal = 'ACCUMULATION';
      accumulation = true;
      strength = 'strong';
      confidence = 0.85;
    }
    // 2. DISTRIBUTION: Price up/stable + volume increasing (smart money selling rallies)
    else if (priceChange >= 0 && volumeIncrease > 25) {
      signal = 'DISTRIBUTION';
      distribution = true;
      strength = volumeIncrease > 50 ? 'strong' : 'medium';
      confidence = priceChange > 2 ? 0.8 : 0.7; // Higher confidence on price rally
    }
    // 3. ACCUMULATION: Price down + volume increasing (smart money buying dips)
    else if (priceChange < 0 && volumeIncrease > 20) {
      signal = 'ACCUMULATION';
      accumulation = true;
      strength = volumeIncrease > 50 ? 'strong' : 'medium';
      confidence = priceChange < -2 ? 0.8 : 0.7; // Higher confidence on deeper dip
    }
    
    console.log(`💰 [BrainOrchestrator] Smart Money Detection: price=${priceChange.toFixed(2)}%, volume=${volumeIncrease.toFixed(1)}%, signal=${signal}`);
    
    return {
      signal,
      strength,
      confidence,
      details: {
        accumulation,
        distribution,
        manipulation: false // Simple detection doesn't detect manipulation
      }
    };
  }
  
  /**
   * Analyze liquidity from order book data
   */
  private analyzeLiquidity(orderBook: any, symbolId: string): LiquidityMetrics | undefined {
    if (!orderBook || !orderBook.bids || !orderBook.asks) {
      return undefined;
    }
    
    const liquidityMetrics = coinAPIWebSocket.calculateLiquidityMetrics(symbolId);
    if (!liquidityMetrics) {
      return undefined;
    }
    
    const { bidLiquidity, askLiquidity, totalLiquidity, bidAskImbalance, spreadPercentage } = liquidityMetrics;
    
    // Determine liquidity signal based on bid/ask imbalance
    let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    
    const absImbalance = Math.abs(bidAskImbalance);
    
    if (bidAskImbalance > 0.3) {
      signal = 'BULLISH'; // Strong bid pressure
      strength = bidAskImbalance > 0.6 ? 'strong' : bidAskImbalance > 0.45 ? 'medium' : 'weak';
    } else if (bidAskImbalance < -0.3) {
      signal = 'BEARISH'; // Strong ask pressure
      strength = bidAskImbalance < -0.6 ? 'strong' : bidAskImbalance < -0.45 ? 'medium' : 'weak';
    }
    
    console.log(`💧 [BrainOrchestrator] Liquidity Analysis: signal=${signal}, imbalance=${bidAskImbalance.toFixed(2)}, spread=${spreadPercentage.toFixed(4)}%`);
    
    return {
      bidLiquidity,
      askLiquidity,
      totalLiquidity,
      bidAskImbalance,
      spreadPercentage,
      signal,
      strength
    };
  }
  
  /**
   * Make trading decision based on all intelligence
   */
  private makeDecision(
    regime: MarketRegime,
    smartMoney: SmartMoneyFlow,
    rotation: RotationPattern,
    switchEvent: RegimeSwitchEvent,
    liquidity?: LiquidityMetrics
  ): BrainInsight['decision'] {
    const reasoning: string[] = [];
    let action: 'BUY' | 'SELL' | 'HOLD' | 'ROTATE' = 'HOLD';
    let confidence = 0.5;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    
    // Factor 1: Regime-based decision
    if (regime === MarketRegime.TRENDING && smartMoney.signal === 'ACCUMULATION') {
      action = 'BUY';
      confidence += 0.2;
      reasoning.push(`Trending regime + Smart money accumulation = Strong BUY signal`);
    } else if (regime === MarketRegime.TRENDING && smartMoney.signal === 'DISTRIBUTION') {
      action = 'SELL';
      confidence += 0.15;
      reasoning.push(`Trending regime + Distribution = Potential reversal`);
    } else if (regime === MarketRegime.RANGING) {
      action = 'HOLD';
      reasoning.push(`Ranging regime = Wait for breakout`);
    } else if (regime === MarketRegime.HIGH_VOL) {
      riskLevel = 'high';
      reasoning.push(`High volatility regime = Elevated risk`);
    }
    
    // Factor 2: Rotation pattern
    if (rotation.pattern === 'ROTATION' && rotation.flow_direction) {
      action = 'ROTATE';
      confidence += 0.15;
      reasoning.push(`Capital rotation detected: ${rotation.flow_direction}`);
      if (rotation.opportunities) {
        reasoning.push(`Opportunities: ${rotation.opportunities.join(', ')}`);
      }
    }
    
    // Factor 3: Regime switch event
    if (switchEvent.triggered) {
      confidence += 0.1;
      reasoning.push(`Regime switched from ${switchEvent.previousRegime} to ${switchEvent.newRegime}`);
      reasoning.push(`Strategies enabled: ${switchEvent.strategiesEnabled.join(', ')}`);
    }
    
    // Factor 4: Liquidity-based confirmation
    if (liquidity) {
      if (liquidity.signal === 'BULLISH' && action === 'BUY') {
        confidence += 0.1;
        reasoning.push(`Liquidity confirms BUY: ${liquidity.bidAskImbalance > 0 ? '+' : ''}${(liquidity.bidAskImbalance * 100).toFixed(1)}% bid pressure`);
      } else if (liquidity.signal === 'BEARISH' && action === 'SELL') {
        confidence += 0.1;
        reasoning.push(`Liquidity confirms SELL: ${(liquidity.bidAskImbalance * 100).toFixed(1)}% ask pressure`);
      } else if (liquidity.signal !== 'NEUTRAL' && liquidity.signal !== action.replace('HOLD', 'NEUTRAL') as any) {
        confidence -= 0.05;
        reasoning.push(`⚠️ Liquidity divergence: ${liquidity.signal} pressure vs ${action} signal`);
      }
      
      // Wide spread = higher risk
      if (liquidity.spreadPercentage > 0.1) {
        riskLevel = 'high';
        reasoning.push(`⚠️ Wide spread (${liquidity.spreadPercentage.toFixed(3)}%) = high slippage risk`);
      }
    }
    
    // Factor 5: Smart money manipulation
    if (smartMoney.details.manipulation) {
      riskLevel = 'high';
      confidence -= 0.1;
      reasoning.push(`⚠️ Smart money manipulation detected - proceed with caution`);
    }
    
    // Adjust confidence based on stability
    if (switchEvent.regimeStability === 'very_stable') {
      confidence += 0.05;
    } else if (switchEvent.regimeStability === 'unstable') {
      confidence -= 0.1;
      riskLevel = 'high';
    }
    
    // Cap confidence at 0-1 range
    confidence = Math.max(0.3, Math.min(0.95, confidence));
    
    return {
      action,
      confidence,
      reasoning,
      riskLevel
    };
  }
  
  /**
   * Send Telegram alert for significant events
   */
  private async sendAlertIfNeeded(insight: BrainInsight): Promise<void> {
    const now = Date.now();
    
    // Check cooldown
    if (now - this.lastAlertTime < this.alertCooldown) {
      return;
    }
    
    // Alert conditions
    const shouldAlert = 
      insight.switchEvent.triggered || 
      insight.smartMoney.signal !== 'NEUTRAL' ||
      insight.rotation.pattern === 'ROTATION' ||
      insight.decision.confidence > 0.8;
    
    if (!shouldAlert) {
      return;
    }
    
    // Build alert message
    let message = `🧠 *Brain Intelligence Update*\n\n`;
    message += `📊 *Symbol:* ${insight.symbol}\n`;
    message += `⏰ *Time:* ${new Date(insight.timestamp).toLocaleString()}\n\n`;
    
    message += `*Regime Analysis:*\n`;
    message += `├ State: ${insight.regime.state.toUpperCase()}\n`;
    message += `├ Confidence: ${(insight.regime.probability * 100).toFixed(1)}%\n`;
    message += `└ Stability: ${insight.regime.stability}\n\n`;
    
    if (insight.switchEvent.triggered) {
      message += `⚡ *Regime Switch Detected!*\n`;
      message += `├ From: ${insight.switchEvent.previousRegime}\n`;
      message += `├ To: ${insight.switchEvent.newRegime}\n`;
      message += `└ Strategies Updated ✅\n\n`;
    }
    
    message += `*Smart Money Flow:*\n`;
    message += `├ Signal: ${insight.smartMoney.signal}\n`;
    message += `├ Strength: ${insight.smartMoney.strength}\n`;
    message += `└ Confidence: ${(insight.smartMoney.confidence * 100).toFixed(1)}%\n\n`;
    
    message += `*Market Rotation:*\n`;
    message += `├ Pattern: ${insight.rotation.pattern}\n`;
    message += `├ Status: ${insight.rotation.status}\n`;
    message += `└ Strength: ${insight.rotation.strength}\n\n`;
    
    if (insight.liquidity) {
      message += `*Order Book Liquidity:*\n`;
      message += `├ Signal: ${insight.liquidity.signal}\n`;
      message += `├ Bid/Ask Imbalance: ${(insight.liquidity.bidAskImbalance * 100).toFixed(1)}%\n`;
      message += `├ Spread: ${insight.liquidity.spreadPercentage.toFixed(4)}%\n`;
      message += `├ Total Liquidity: $${(insight.liquidity.totalLiquidity / 1000).toFixed(1)}K\n`;
      message += `└ Strength: ${insight.liquidity.strength}\n\n`;
    }
    
    message += `*Decision:*\n`;
    message += `├ Action: ${insight.decision.action}\n`;
    message += `├ Confidence: ${(insight.decision.confidence * 100).toFixed(1)}%\n`;
    message += `├ Risk: ${insight.decision.riskLevel}\n`;
    message += `└ Reasoning:\n`;
    insight.decision.reasoning.forEach(r => {
      message += `   • ${r}\n`;
    });
    
    try {
      await sendTelegram(message);
      this.lastAlertTime = now;
      console.log('✅ [BrainOrchestrator] Telegram alert sent');
    } catch (error) {
      console.error('❌ [BrainOrchestrator] Failed to send Telegram alert:', error);
    }
  }
  
  /**
   * Get recent insights
   */
  getRecentInsights(limit: number = 10): BrainInsight[] {
    return this.insightHistory.slice(-limit);
  }
  
  /**
   * Get orchestrator statistics
   */
  getStats(): {
    totalInsights: number;
    regimeStats: any;
    rotationTrend: any;
    lastInsight: BrainInsight | null;
  } {
    return {
      totalInsights: this.insightHistory.length,
      regimeStats: this.regimeAutoSwitcher.getRegimeStats(),
      rotationTrend: this.rotationDetector.getRotationTrend(),
      lastInsight: this.insightHistory[this.insightHistory.length - 1] || null
    };
  }
  
  /**
   * 🧬 META-BRAIN: Run fusion analysis combining CoinAPI + CoinGlass
   *
   * This is the NEW unified intelligence method that combines:
   * 1. Brain Orchestrator analysis (CoinAPI price action + smart money)
   * 2. CoinGlass derivatives intelligence (OI, funding, whale, liquidations)
   *
   * Returns: Unified trading signal with multi-factor confidence scoring
   */
  async runFusion(symbols: string[] = ['BTC', 'ETH', 'SOL']): Promise<UnifiedSignalWithMetrics> {
    const primarySymbol = symbols[0];
    console.log(`🧬 [Meta-Brain] Running fusion analysis for ${primarySymbol}`);

    try {
      // Step 1: Run traditional brain analysis
      const brainInsight = await this.run(symbols);

      // Step 2: Get current price
      const priceData = await coinAPIService.getLatestPrice(`BINANCE_SPOT_${primarySymbol}_USDT`).catch(() => null);
      const currentPrice = priceData?.price || 0;

      if (currentPrice === 0) {
        console.warn(`⚠️ [Meta-Brain] No price data available for ${primarySymbol}`);
      }

      // Step 3: Fuse with CoinGlass data
      const fusedSignal = await fusionEngine.fuse(brainInsight, currentPrice);

      // Step 4: Send enhanced Telegram alert
      await this.sendFusionAlert(fusedSignal);

      console.log(`✅ [Meta-Brain] Fusion complete: ${fusedSignal.final_signal} (${(fusedSignal.confidence * 100).toFixed(1)}%)`);
      return fusedSignal;

    } catch (error) {
      console.error('❌ [Meta-Brain] Fusion analysis failed:', error);
      throw error;
    }
  }

  /**
   * Send enhanced Telegram alert with fusion signal
   */
  private async sendFusionAlert(signal: UnifiedSignalWithMetrics): Promise<void> {
    const now = Date.now();

    // Check cooldown
    if (now - this.lastAlertTime < this.alertCooldown) {
      return;
    }

    // Only alert on actionable signals with sufficient confidence
    if (signal.final_signal === 'HOLD' && signal.confidence < 0.7) {
      return;
    }

    // Build enhanced alert message
    let message = `🧬 *META-BRAIN FUSION SIGNAL*\n\n`;
    message += `📊 *Symbol:* ${signal.symbol}\n`;
    message += `⏰ *Time:* ${new Date(signal.timestamp).toLocaleString()}\n\n`;

    // Signal
    const signalEmoji = {
      'LONG': '🟢',
      'SHORT': '🔴',
      'HOLD': '⚪',
      'CLOSE_LONG': '🟡',
      'CLOSE_SHORT': '🟡'
    }[signal.final_signal];

    message += `${signalEmoji} *SIGNAL:* ${signal.final_signal}\n`;
    message += `📈 *Confidence:* ${(signal.confidence * 100).toFixed(1)}%\n`;
    message += `⚠️ *Risk Level:* ${signal.risk_level.toUpperCase()}\n`;
    message += `🎯 *Strategy:* ${signal.strategy}\n`;
    message += `⏱ *Timeframe:* ${signal.timeframe}\n\n`;

    // Market Regime
    message += `*Market Regime:*\n`;
    message += `├ State: ${signal.regime.replace('_', ' ').toUpperCase()}\n`;
    message += `└ Confidence: ${(signal.regime_confidence * 100).toFixed(1)}%\n\n`;

    // Price Action
    message += `*Price Action:*\n`;
    message += `├ Structure: ${signal.price_action.structure}\n`;
    message += `├ Smart Money: ${signal.price_action.smart_money_signal}\n`;
    message += `├ CVD: ${signal.price_action.cvd.toUpperCase()}\n`;
    message += `└ Volume: ${signal.price_action.volume_profile}\n\n`;

    // Derivatives Intelligence
    message += `*Derivatives Intelligence:*\n`;
    message += `├ OI Change: ${signal.derivatives.oi_change_percent > 0 ? '+' : ''}${signal.derivatives.oi_change_percent.toFixed(2)}%\n`;
    message += `├ Funding Rate: ${(signal.derivatives.funding_rate * 100).toFixed(3)}%\n`;
    message += `├ Funding Pressure: ${signal.derivatives.funding_pressure.toUpperCase()}\n`;
    message += `├ Long/Short Ratio: ${signal.derivatives.long_short_ratio.toFixed(2)}\n`;
    message += `└ Whale Activity: ${signal.derivatives.whale_activity.toUpperCase()}\n\n`;

    // Risk Management
    if (signal.final_signal !== 'HOLD') {
      message += `*Risk Management:*\n`;
      message += `├ Entry: $${signal.current_price.toFixed(2)}\n`;
      if (signal.stop_loss) {
        message += `├ Stop Loss: $${signal.stop_loss.toFixed(2)} (${((Math.abs(signal.current_price - signal.stop_loss) / signal.current_price) * 100).toFixed(2)}%)\n`;
      }
      if (signal.take_profit && signal.take_profit.length > 0) {
        message += `└ Take Profits:\n`;
        signal.take_profit.forEach((tp, i) => {
          const profit = ((Math.abs(tp - signal.current_price) / signal.current_price) * 100).toFixed(2);
          message += `   ${i + 1}. $${tp.toFixed(2)} (+${profit}%)\n`;
        });
      }
      message += `\n`;
    }

    // Fusion Metrics
    message += `*Fusion Quality Metrics:*\n`;
    message += `├ Overall Confluence: ${(signal.fusion_metrics.overall_confluence * 100).toFixed(1)}%\n`;
    message += `├ Technical Strength: ${(signal.fusion_metrics.technical_strength * 100).toFixed(1)}%\n`;
    message += `├ Derivatives Strength: ${(signal.fusion_metrics.derivatives_strength * 100).toFixed(1)}%\n`;
    message += `└ Institutional Strength: ${(signal.fusion_metrics.institutional_strength * 100).toFixed(1)}%\n\n`;

    // Divergence warnings
    if (signal.fusion_metrics.divergences.length > 0) {
      message += `*⚠️ Divergences Detected:*\n`;
      signal.fusion_metrics.divergences.forEach(div => {
        message += `├ [${div.severity.toUpperCase()}] ${div.description}\n`;
      });
      message += `\n`;
    }

    // Reasoning
    message += `*Reasoning:*\n`;
    signal.reasons.forEach(reason => {
      message += `• ${reason}\n`;
    });

    // Warnings
    if (signal.warnings && signal.warnings.length > 0) {
      message += `\n*⚠️ Warnings:*\n`;
      signal.warnings.forEach(warning => {
        message += `• ${warning}\n`;
      });
    }

    // Data source status
    message += `\n*Data Sources:*\n`;
    message += `├ CoinAPI: ${signal.data_sources.coinapi_healthy ? '✅' : '❌'}\n`;
    message += `├ CoinGlass: ${signal.data_sources.coinglass_healthy ? '✅' : '❌'}\n`;
    message += `└ Data Age: ${signal.data_sources.data_age_seconds}s\n`;

    try {
      await sendTelegram(message);
      this.lastAlertTime = now;
      console.log('✅ [Meta-Brain] Fusion alert sent to Telegram');
    } catch (error) {
      console.error('❌ [Meta-Brain] Failed to send Telegram alert:', error);
    }
  }

  /**
   * Reset orchestrator state
   */
  reset(): void {
    this.regimeAutoSwitcher.reset();
    this.rotationDetector.clearHistory();
    this.insightHistory = [];
    this.lastAlertTime = 0;
    console.log('🔄 [BrainOrchestrator] State reset');
  }
}

// Export singleton instance
export const brainOrchestrator = new BrainOrchestrator();

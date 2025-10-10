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
      const [regimeData, correlationData, priceData] = await Promise.all([
        // 1. Regime Detection
        regimeDetectionService.detectRegime(`BINANCE_SPOT_${primarySymbol}_USDT`).catch(err => {
          console.warn(`⚠️ [BrainOrchestrator] Regime detection failed: ${err.message}`);
          return null;
        }),
        
        // 2. Correlation Matrix
        coinAPIService.getCorrelationMatrix(symbols, 7).catch(err => {
          console.warn(`⚠️ [BrainOrchestrator] Correlation matrix failed: ${err.message}`);
          return null;
        }),
        
        // 3. Price data for simple smart money detection
        coinAPIService.getHistoricalData(`BINANCE_SPOT_${primarySymbol}_USDT`, '1HRS', undefined, undefined, 24).catch(err => {
          console.warn(`⚠️ [BrainOrchestrator] Price data failed: ${err.message}`);
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
      
      // Make decision based on all intelligence
      const decision = this.makeDecision(regimeState, smartFlow, rotation, switchEvent);
      
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
   * Make trading decision based on all intelligence
   */
  private makeDecision(
    regime: MarketRegime,
    smartMoney: SmartMoneyFlow,
    rotation: RotationPattern,
    switchEvent: RegimeSwitchEvent
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
    
    // Factor 4: Smart money manipulation
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

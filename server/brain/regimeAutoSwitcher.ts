/**
 * Regime Auto-Switcher - Dynamic Strategy Adaptation
 * 
 * Automatically adjusts trading strategies based on market regime changes:
 * - Monitors regime transitions in real-time
 * - Enables/disables strategies per regime rules
 * - Tracks regime stability and confidence
 */

import { MarketRegime, StrategyType, RegimeDetectionResult } from '../services/regimeDetection';

export interface RegimeSwitchEvent {
  triggered: boolean;
  timestamp: string;
  previousRegime: MarketRegime | null;
  newRegime: MarketRegime;
  confidence: number;
  strategiesEnabled: StrategyType[];
  strategiesDisabled: StrategyType[];
  regimeStability: 'unstable' | 'stable' | 'very_stable';
}

export interface ActiveStrategy {
  type: StrategyType;
  enabled: boolean;
  regime: MarketRegime;
  activatedAt: string;
}

export class RegimeAutoSwitcher {
  private lastRegime: MarketRegime | null = null;
  private activeStrategies: Map<StrategyType, ActiveStrategy> = new Map();
  private regimeHistory: Array<{ regime: MarketRegime; timestamp: string; confidence: number }> = [];
  private switchHistory: RegimeSwitchEvent[] = [];
  
  /**
   * Evaluate regime and trigger strategy switch if needed
   */
  async evaluate(symbol: string, regimeData: RegimeDetectionResult): Promise<RegimeSwitchEvent> {
    const currentRegime = regimeData.current_regime;
    const timestamp = new Date().toISOString();
    
    // Add to regime history
    this.regimeHistory.push({
      regime: currentRegime,
      timestamp,
      confidence: regimeData.regime_probability
    });
    
    // Keep last 20 regime checks
    if (this.regimeHistory.length > 20) {
      this.regimeHistory.shift();
    }
    
    // Check if regime changed
    if (currentRegime !== this.lastRegime && this.lastRegime !== null) {
      console.log(`⚡ [RegimeAutoSwitcher] Regime changed for ${symbol}: ${this.lastRegime} → ${currentRegime}`);
      
      // Update strategies
      const strategiesEnabled = regimeData.allowed_strategies;
      const strategiesDisabled = regimeData.disabled_strategies;
      
      // Apply strategy changes
      this.updateActiveStrategies(currentRegime, strategiesEnabled, strategiesDisabled, timestamp);
      
      // Calculate regime stability
      const stability = this.calculateRegimeStability();
      
      const switchEvent: RegimeSwitchEvent = {
        triggered: true,
        timestamp,
        previousRegime: this.lastRegime,
        newRegime: currentRegime,
        confidence: regimeData.regime_probability,
        strategiesEnabled,
        strategiesDisabled,
        regimeStability: stability
      };
      
      // Store event
      this.switchHistory.push(switchEvent);
      if (this.switchHistory.length > 50) {
        this.switchHistory.shift();
      }
      
      // Update last regime
      this.lastRegime = currentRegime;
      
      return switchEvent;
    }
    
    // No regime change
    const switchEvent: RegimeSwitchEvent = {
      triggered: false,
      timestamp,
      previousRegime: this.lastRegime,
      newRegime: currentRegime,
      confidence: regimeData.regime_probability,
      strategiesEnabled: regimeData.allowed_strategies,
      strategiesDisabled: regimeData.disabled_strategies,
      regimeStability: this.calculateRegimeStability()
    };
    
    // Update last regime if first run
    if (this.lastRegime === null) {
      this.lastRegime = currentRegime;
      this.updateActiveStrategies(currentRegime, regimeData.allowed_strategies, regimeData.disabled_strategies, timestamp);
    }
    
    return switchEvent;
  }
  
  /**
   * Update active strategies based on regime
   */
  private updateActiveStrategies(
    regime: MarketRegime,
    enabledStrategies: StrategyType[],
    disabledStrategies: StrategyType[],
    timestamp: string
  ): void {
    // Enable allowed strategies
    for (const strategy of enabledStrategies) {
      this.activeStrategies.set(strategy, {
        type: strategy,
        enabled: true,
        regime,
        activatedAt: timestamp
      });
    }
    
    // Disable disallowed strategies
    for (const strategy of disabledStrategies) {
      this.activeStrategies.set(strategy, {
        type: strategy,
        enabled: false,
        regime,
        activatedAt: timestamp
      });
    }
    
    console.log(`✅ [RegimeAutoSwitcher] Strategies updated for ${regime}:`, {
      enabled: enabledStrategies,
      disabled: disabledStrategies
    });
  }
  
  /**
   * Calculate regime stability based on recent history
   */
  private calculateRegimeStability(): 'unstable' | 'stable' | 'very_stable' {
    if (this.regimeHistory.length < 3) {
      return 'unstable';
    }
    
    const recentRegimes = this.regimeHistory.slice(-5);
    const uniqueRegimes = new Set(recentRegimes.map(r => r.regime));
    
    // Very stable: same regime for 5+ checks
    if (uniqueRegimes.size === 1 && recentRegimes.length >= 5) {
      return 'very_stable';
    }
    
    // Stable: max 2 different regimes in last 5 checks
    if (uniqueRegimes.size <= 2) {
      return 'stable';
    }
    
    // Unstable: frequent regime changes
    return 'unstable';
  }
  
  /**
   * Get currently active strategies
   */
  getActiveStrategies(): ActiveStrategy[] {
    return Array.from(this.activeStrategies.values()).filter(s => s.enabled);
  }
  
  /**
   * Get disabled strategies
   */
  getDisabledStrategies(): ActiveStrategy[] {
    return Array.from(this.activeStrategies.values()).filter(s => !s.enabled);
  }
  
  /**
   * Get current regime
   */
  getCurrentRegime(): MarketRegime | null {
    return this.lastRegime;
  }
  
  /**
   * Get regime change frequency (switches per hour)
   */
  getRegimeChangeFrequency(): number {
    if (this.switchHistory.length < 2) {
      return 0;
    }
    
    const recentSwitches = this.switchHistory.filter(s => s.triggered).slice(-10);
    if (recentSwitches.length < 2) {
      return 0;
    }
    
    const firstTime = new Date(recentSwitches[0].timestamp).getTime();
    const lastTime = new Date(recentSwitches[recentSwitches.length - 1].timestamp).getTime();
    const hoursDiff = (lastTime - firstTime) / (1000 * 60 * 60);
    
    return hoursDiff > 0 ? recentSwitches.length / hoursDiff : 0;
  }
  
  /**
   * Get switch history
   */
  getSwitchHistory(): RegimeSwitchEvent[] {
    return [...this.switchHistory];
  }
  
  /**
   * Check if strategy is enabled
   */
  isStrategyEnabled(strategy: StrategyType): boolean {
    const activeStrategy = this.activeStrategies.get(strategy);
    return activeStrategy?.enabled || false;
  }
  
  /**
   * Get regime statistics
   */
  getRegimeStats(): {
    currentRegime: MarketRegime | null;
    stability: 'unstable' | 'stable' | 'very_stable';
    changeFrequency: number;
    totalSwitches: number;
    regimeDistribution: Map<MarketRegime, number>;
  } {
    const regimeDistribution = new Map<MarketRegime, number>();
    
    for (const { regime } of this.regimeHistory) {
      regimeDistribution.set(regime, (regimeDistribution.get(regime) || 0) + 1);
    }
    
    return {
      currentRegime: this.lastRegime,
      stability: this.calculateRegimeStability(),
      changeFrequency: this.getRegimeChangeFrequency(),
      totalSwitches: this.switchHistory.filter(s => s.triggered).length,
      regimeDistribution
    };
  }
  
  /**
   * Reset switcher state
   */
  reset(): void {
    this.lastRegime = null;
    this.activeStrategies.clear();
    this.regimeHistory = [];
    this.switchHistory = [];
  }
}

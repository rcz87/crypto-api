/**
 * Rotation Detector - Multi-Coin Capital Flow Analysis
 * 
 * Detects capital rotation patterns across major crypto assets:
 * - BTC → ETH → SOL rotation (smart money flow)
 * - Synchronized movements (risk-on/risk-off)
 * - Decoupling events (alpha opportunities)
 */

export interface RotationPattern {
  status: string;
  strength: 'low' | 'medium' | 'high' | 'extreme';
  confidence: number;
  pattern: 'ROTATION' | 'SYNCHRONIZED' | 'DECOUPLED' | 'NEUTRAL';
  flow_direction?: string;
  opportunities?: string[];
}

export class RotationDetector {
  private rotationHistory: RotationPattern[] = [];
  
  /**
   * Detect capital rotation patterns from correlation matrix
   */
  detect(correlationMatrix: { [key: string]: { [key: string]: number } }): RotationPattern {
    // Extract key correlations
    const btcEth = correlationMatrix['BTC']?.['ETH'] || 0;
    const btcSol = correlationMatrix['BTC']?.['SOL'] || 0;
    const ethSol = correlationMatrix['ETH']?.['SOL'] || 0;
    
    console.log(`📊 [RotationDetector] Correlation Matrix: BTC-ETH=${btcEth.toFixed(3)}, BTC-SOL=${btcSol.toFixed(3)}, ETH-SOL=${ethSol.toFixed(3)}`);
    
    // Pattern 1: BTC → ETH → SOL Rotation (Capital Flow)
    if (btcEth > 0.8 && btcSol < 0.5 && ethSol > 0.7) {
      const pattern: RotationPattern = {
        status: 'CAPITAL ROTATION: BTC → ETH → SOL',
        strength: 'high',
        confidence: 0.85,
        pattern: 'ROTATION',
        flow_direction: 'BTC → ETH → SOL',
        opportunities: ['Long ETH/SOL', 'Short BTC dominance']
      };
      this.addToHistory(pattern);
      return pattern;
    }
    
    // Pattern 2: SOL → ETH → BTC Rotation (Risk-off)
    if (btcEth > 0.8 && ethSol < 0.4 && btcSol < 0.3) {
      const pattern: RotationPattern = {
        status: 'CAPITAL ROTATION: SOL → ETH → BTC (Risk-Off)',
        strength: 'high',
        confidence: 0.82,
        pattern: 'ROTATION',
        flow_direction: 'SOL → ETH → BTC',
        opportunities: ['Long BTC', 'Exit altcoins']
      };
      this.addToHistory(pattern);
      return pattern;
    }
    
    // Pattern 3: Synchronized Movement (Risk-On)
    if (btcSol > 0.8 && ethSol > 0.8 && btcEth > 0.7) {
      const pattern: RotationPattern = {
        status: 'SYNCHRONIZED MOVEMENT (Risk-On)',
        strength: 'extreme',
        confidence: 0.9,
        pattern: 'SYNCHRONIZED',
        flow_direction: 'All assets moving together',
        opportunities: ['Broad market momentum', 'Follow the trend']
      };
      this.addToHistory(pattern);
      return pattern;
    }
    
    // Pattern 4: Strong Decoupling (Alpha Opportunity)
    if (Math.abs(btcSol) < 0.3 || Math.abs(ethSol) < 0.3) {
      const pattern: RotationPattern = {
        status: 'DECOUPLED ASSETS (Alpha Opportunity)',
        strength: 'medium',
        confidence: 0.75,
        pattern: 'DECOUPLED',
        opportunities: ['Pairs trading', 'Independent asset selection']
      };
      this.addToHistory(pattern);
      return pattern;
    }
    
    // Pattern 5: Medium Correlation (Neutral)
    if (btcEth > 0.5 && btcEth < 0.8) {
      const pattern: RotationPattern = {
        status: 'MODERATE CORRELATION (Neutral)',
        strength: 'low',
        confidence: 0.6,
        pattern: 'NEUTRAL'
      };
      this.addToHistory(pattern);
      return pattern;
    }
    
    // Default: Neutral state
    const pattern: RotationPattern = {
      status: 'NEUTRAL',
      strength: 'low',
      confidence: 0.5,
      pattern: 'NEUTRAL'
    };
    this.addToHistory(pattern);
    return pattern;
  }
  
  /**
   * Add pattern to history (keep last 50)
   */
  private addToHistory(pattern: RotationPattern): void {
    this.rotationHistory.push(pattern);
    if (this.rotationHistory.length > 50) {
      this.rotationHistory.shift();
    }
  }
  
  /**
   * Get rotation strength trend (increasing/decreasing)
   */
  getRotationTrend(): { trend: 'strengthening' | 'weakening' | 'stable'; confidence: number } {
    if (this.rotationHistory.length < 3) {
      return { trend: 'stable', confidence: 0.5 };
    }
    
    const recent = this.rotationHistory.slice(-3);
    const strengthValues = recent.map(r => {
      switch(r.strength) {
        case 'extreme': return 4;
        case 'high': return 3;
        case 'medium': return 2;
        case 'low': return 1;
      }
    });
    
    const avgRecent = strengthValues.reduce((a, b) => a + b, 0) / strengthValues.length;
    const older = this.rotationHistory.slice(-6, -3);
    const olderStrengthValues = older.map(r => {
      switch(r.strength) {
        case 'extreme': return 4;
        case 'high': return 3;
        case 'medium': return 2;
        case 'low': return 1;
      }
    });
    const avgOlder = olderStrengthValues.reduce((a, b) => a + b, 0) / olderStrengthValues.length;
    
    if (avgRecent > avgOlder + 0.5) {
      return { trend: 'strengthening', confidence: 0.8 };
    } else if (avgRecent < avgOlder - 0.5) {
      return { trend: 'weakening', confidence: 0.8 };
    }
    
    return { trend: 'stable', confidence: 0.6 };
  }
  
  /**
   * Get rotation history
   */
  getHistory(): RotationPattern[] {
    return [...this.rotationHistory];
  }
  
  /**
   * Clear history
   */
  clearHistory(): void {
    this.rotationHistory = [];
  }
}

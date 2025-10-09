import fs from 'fs/promises';
import path from 'path';

interface SignalOutcome {
  signal_id: string;
  timestamp: string;
  symbol: string;
  confidence: number;
  outcome: 'win' | 'loss' | 'pending';
  entry_price?: number;
  exit_price?: number;
  pnl_pct?: number;
}

interface SignalStats {
  current_threshold: number;
  last_evaluation: string;
  outcomes: SignalOutcome[];
  evaluation_history: Array<{
    date: string;
    accuracy: number;
    total_signals: number;
    wins: number;
    losses: number;
    threshold_before: number;
    threshold_after: number;
    adjustment: number;
  }>;
}

const STATS_FILE = path.join(process.cwd(), 'signal_stats.json');
const DEFAULT_THRESHOLD = 65;
const MIN_THRESHOLD = 50;
const MAX_THRESHOLD = 80;

export class AdaptiveThresholdManager {
  private stats: SignalStats;
  private isInitialized = false;

  constructor() {
    this.stats = {
      current_threshold: DEFAULT_THRESHOLD,
      last_evaluation: new Date().toISOString(),
      outcomes: [],
      evaluation_history: []
    };
  }

  /**
   * Initialize - load existing stats or create new file
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(STATS_FILE, 'utf-8');
      this.stats = JSON.parse(data);
      console.log(`📊 [AdaptiveThreshold] Loaded stats: ${this.stats.outcomes.length} outcomes, threshold=${this.stats.current_threshold}%`);
    } catch (error) {
      // File doesn't exist, create with defaults
      await this.saveStats();
      console.log(`📊 [AdaptiveThreshold] Initialized new stats file with threshold=${DEFAULT_THRESHOLD}%`);
    }
    this.isInitialized = true;
  }

  /**
   * Get current confidence threshold
   */
  getCurrentThreshold(): number {
    return this.stats.current_threshold;
  }

  /**
   * Record signal outcome
   */
  async recordOutcome(outcome: SignalOutcome): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    this.stats.outcomes.push(outcome);
    
    // Keep only last 30 days of data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.stats.outcomes = this.stats.outcomes.filter(
      o => new Date(o.timestamp) > thirtyDaysAgo
    );
    
    await this.saveStats();
  }

  /**
   * Calculate accuracy for last N days
   */
  private calculateAccuracy(days: number): { accuracy: number; total: number; wins: number; losses: number } {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentOutcomes = this.stats.outcomes.filter(
      o => new Date(o.timestamp) > cutoffDate && o.outcome !== 'pending'
    );

    const wins = recentOutcomes.filter(o => o.outcome === 'win').length;
    const losses = recentOutcomes.filter(o => o.outcome === 'loss').length;
    const total = wins + losses;
    const accuracy = total > 0 ? (wins / total) * 100 : 0;

    return { accuracy, total, wins, losses };
  }

  /**
   * Evaluate and adjust threshold based on 7-day performance
   */
  async evaluateAndAdjust(): Promise<{ adjusted: boolean; oldThreshold: number; newThreshold: number; reason: string }> {
    if (!this.isInitialized) await this.initialize();

    const stats = this.calculateAccuracy(7);
    const oldThreshold = this.stats.current_threshold;
    let adjustment = 0;
    let reason = '';

    // Minimum 10 signals required for evaluation
    if (stats.total < 10) {
      console.log(`📊 [AdaptiveThreshold] Insufficient data (${stats.total} signals), need 10+ for evaluation`);
      return { 
        adjusted: false, 
        oldThreshold, 
        newThreshold: oldThreshold, 
        reason: `Insufficient data: ${stats.total} signals (need 10+)` 
      };
    }

    // Adjustment logic
    if (stats.accuracy < 60) {
      adjustment = +2;
      reason = `Low accuracy ${stats.accuracy.toFixed(1)}% < 60% → raise threshold to reduce noise`;
    } else if (stats.accuracy > 75) {
      adjustment = -2;
      reason = `High accuracy ${stats.accuracy.toFixed(1)}% > 75% → lower threshold to catch more signals`;
    } else {
      reason = `Accuracy ${stats.accuracy.toFixed(1)}% within target range (60-75%) → no adjustment`;
    }

    const newThreshold = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, oldThreshold + adjustment));
    
    // Record evaluation
    this.stats.evaluation_history.push({
      date: new Date().toISOString(),
      accuracy: stats.accuracy,
      total_signals: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      threshold_before: oldThreshold,
      threshold_after: newThreshold,
      adjustment
    });

    // Keep only last 30 evaluations
    if (this.stats.evaluation_history.length > 30) {
      this.stats.evaluation_history = this.stats.evaluation_history.slice(-30);
    }

    this.stats.current_threshold = newThreshold;
    this.stats.last_evaluation = new Date().toISOString();
    await this.saveStats();

    if (adjustment !== 0) {
      console.log(`🎯 [AdaptiveThreshold] Updated threshold → ${newThreshold}% (${adjustment > 0 ? '+' : ''}${adjustment}%)`);
      console.log(`   Reason: ${reason}`);
      console.log(`   7-Day Stats: ${stats.wins}W/${stats.losses}L (${stats.accuracy.toFixed(1)}% accuracy)`);
    } else {
      console.log(`📊 [AdaptiveThreshold] Threshold unchanged at ${newThreshold}%`);
      console.log(`   ${reason}`);
    }

    return {
      adjusted: adjustment !== 0,
      oldThreshold,
      newThreshold,
      reason
    };
  }

  /**
   * Get statistics summary
   */
  getStats(): {
    current_threshold: number;
    last_evaluation: string;
    total_outcomes: number;
    accuracy_7d: number;
    accuracy_30d: number;
  } {
    const stats7d = this.calculateAccuracy(7);
    const stats30d = this.calculateAccuracy(30);

    return {
      current_threshold: this.stats.current_threshold,
      last_evaluation: this.stats.last_evaluation,
      total_outcomes: this.stats.outcomes.length,
      accuracy_7d: stats7d.accuracy,
      accuracy_30d: stats30d.accuracy
    };
  }

  /**
   * Save stats to file
   */
  private async saveStats(): Promise<void> {
    await fs.writeFile(STATS_FILE, JSON.stringify(this.stats, null, 2), 'utf-8');
  }

  /**
   * Manual outcome update (for testing or manual corrections)
   */
  async updateOutcome(signalId: string, outcome: 'win' | 'loss', pnlPct?: number): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    const signal = this.stats.outcomes.find(o => o.signal_id === signalId);
    if (signal) {
      signal.outcome = outcome;
      if (pnlPct !== undefined) signal.pnl_pct = pnlPct;
      await this.saveStats();
      console.log(`✅ [AdaptiveThreshold] Updated outcome for ${signalId}: ${outcome} (PnL: ${pnlPct?.toFixed(2)}%)`);
    }
  }
}

// Singleton instance
export const adaptiveThresholdManager = new AdaptiveThresholdManager();

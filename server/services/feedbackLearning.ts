/**
 * 🧠 Feedback → Learning System
 * Comprehensive service for collecting user feedback and automatically adjusting signal weights
 */

import { storage } from "../storage";
import { 
  type FeedbackData, 
  type PatternLearningData, 
  type WeeklyFeedbackReport 
} from "@shared/schema";

export interface FeedbackMetadata {
  signal_type: string;
  patterns_used?: string[];
  confidence_score?: number;
  timeframe?: string;
  symbol?: string;
  entry_price?: number;
  alert_timestamp?: Date;
}

export interface LearningConfig {
  learning_velocity: number; // How aggressively to adjust (0.1 = conservative, 0.3 = aggressive)
  min_feedback_threshold: number; // Minimum feedback needed before adjusting
  sentiment_threshold: number; // Minimum net sentiment to trigger changes (-0.3 = trigger at -30%)
  max_weight_adjustment: number; // Maximum weight change per adjustment (0.2 = 20%)
  confidence_adjustment_factor: number; // How much to adjust confidence thresholds (0.05 = 5%)
}

export class FeedbackLearningService {
  private config: LearningConfig;
  private signalStartTimes: Map<string, number> = new Map(); // Track signal start times

  constructor(config: Partial<LearningConfig> = {}) {
    this.config = {
      learning_velocity: 0.15,
      min_feedback_threshold: 3,
      sentiment_threshold: -0.25, // -25% net sentiment triggers learning
      max_weight_adjustment: 0.2,
      confidence_adjustment_factor: 0.05,
      ...config
    };
  }

  /**
   * 📝 Record user feedback from Telegram callbacks
   */
  async recordFeedback(data: {
    ref_id: string;
    user_id?: string;
    rating: number; // +1 or -1
    metadata?: FeedbackMetadata;
  }): Promise<{ success: boolean; message: string; learning_triggered?: boolean }> {
    try {
      // Calculate response time if we have the signal start time
      const signalStartTime = this.signalStartTimes.get(data.ref_id);
      const responseTimeSeconds = signalStartTime 
        ? Math.floor((Date.now() - signalStartTime) / 1000)
        : undefined;

      // Determine signal type from ref_id if not provided
      const signalType = data.metadata?.signal_type || this.extractSignalTypeFromRef(data.ref_id);

      // Store feedback
      const feedback = await storage.addFeedback({
        ref_id: data.ref_id,
        user_id: data.user_id,
        signal_type: signalType,
        rating: data.rating,
        response_time_seconds: responseTimeSeconds,
        metadata: data.metadata,
      });

      console.log(`📊 Feedback recorded: ${data.ref_id} -> ${data.rating > 0 ? '👍' : '👎'} (${responseTimeSeconds}s)`);

      // Update signal quality metrics
      await storage.updateSignalFeedback(data.ref_id, data.rating);

      // Trigger learning analysis if enabled
      const learningTriggered = await this.analyzeFeedbackAndLearn(signalType, data.metadata?.patterns_used);

      return {
        success: true,
        message: `Feedback recorded successfully${learningTriggered ? ' (learning triggered)' : ''}`,
        learning_triggered: learningTriggered
      };

    } catch (error) {
      console.error('❌ Failed to record feedback:', error);
      return {
        success: false,
        message: `Failed to record feedback: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * 🚀 Register signal start time for response time tracking
   */
  registerSignalStart(ref_id: string): void {
    this.signalStartTimes.set(ref_id, Date.now());
    
    // Clean up old entries (keep only last 1000)
    if (this.signalStartTimes.size > 1000) {
      const entries = Array.from(this.signalStartTimes.entries());
      entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp desc
      this.signalStartTimes.clear();
      entries.slice(0, 1000).forEach(([key, value]) => {
        this.signalStartTimes.set(key, value);
      });
    }
  }

  /**
   * 🧠 Analyze feedback patterns and trigger learning adjustments
   */
  async analyzeFeedbackAndLearn(signalType: string, patternsUsed?: string[]): Promise<boolean> {
    try {
      // Get recent feedback stats for this signal type
      const stats = await this.getFeedbackStatsForSignalType(signalType, 7); // 7 days

      console.log(`🔍 Learning analysis for ${signalType}: ${stats.total} feedback, ${stats.net_sentiment.toFixed(2)} sentiment`);

      // Check if we have enough feedback to make decisions
      if (stats.total < this.config.min_feedback_threshold) {
        console.log(`⏳ Insufficient feedback for ${signalType} (${stats.total}/${this.config.min_feedback_threshold})`);
        return false;
      }

      // Check if sentiment is below threshold (needs improvement)
      if (stats.net_sentiment < this.config.sentiment_threshold) {
        console.log(`📉 Poor sentiment for ${signalType} (${stats.net_sentiment.toFixed(2)}), triggering learning...`);
        
        // Analyze and adjust patterns if specified
        if (patternsUsed && patternsUsed.length > 0) {
          await this.adjustPatternWeights(patternsUsed, stats);
        }
        
        // Adjust signal type global settings
        await this.adjustSignalTypeSettings(signalType, stats);
        
        return true;
      }

      // Check if sentiment is very positive (can be more aggressive)
      if (stats.net_sentiment > 0.4) {
        console.log(`📈 High sentiment for ${signalType} (${stats.net_sentiment.toFixed(2)}), increasing aggressiveness...`);
        await this.increaseSignalAggressiveness(signalType, patternsUsed);
        return true;
      }

      console.log(`✅ ${signalType} performing within normal range (${stats.net_sentiment.toFixed(2)})`);
      return false;

    } catch (error) {
      console.error('❌ Learning analysis failed:', error);
      return false;
    }
  }

  /**
   * 📊 Get feedback statistics for a specific signal type
   */
  async getFeedbackStatsForSignalType(signalType: string, days: number = 7): Promise<{
    total: number;
    positive: number;
    negative: number;
    net_sentiment: number;
    avg_response_time?: number;
  }> {
    const allFeedback = await storage.getFeedbackBatch(1000); // Get recent feedback
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filteredFeedback = allFeedback.filter(f => 
      f.signal_type === signalType && 
      (f.timestamp?.getTime() || 0) >= cutoffDate.getTime()
    );

    const positive = filteredFeedback.filter(f => f.rating > 0).length;
    const negative = filteredFeedback.filter(f => f.rating < 0).length;
    const total = filteredFeedback.length;

    const responseTimes = filteredFeedback
      .map(f => f.response_time_seconds)
      .filter(t => t !== null && t !== undefined) as number[];

    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length 
      : undefined;

    return {
      total,
      positive,
      negative,
      net_sentiment: total > 0 ? (positive - negative) / total : 0,
      avg_response_time: avgResponseTime,
    };
  }

  /**
   * 🔧 Adjust pattern weights based on feedback
   */
  async adjustPatternWeights(patterns: string[], stats: { net_sentiment: number; total: number }): Promise<void> {
    for (const patternName of patterns) {
      try {
        let pattern = await storage.getPatternLearning(patternName);
        
        if (!pattern) {
          // Initialize new pattern
          pattern = await storage.upsertPatternLearning({
            pattern_name: patternName,
            pattern_type: 'auto_detected',
            base_weight: 1.0,
            current_weight: 1.0,
            min_confidence: 0.7,
            feedback_stats: {
              total_feedback: stats.total,
              positive_count: Math.max(0, Math.round(stats.total * (1 + stats.net_sentiment) / 2)),
              negative_count: Math.max(0, Math.round(stats.total * (1 - stats.net_sentiment) / 2)),
              net_sentiment: stats.net_sentiment,
              win_rate: (1 + stats.net_sentiment) / 2,
            },
            performance_history: []
          });
        }

        // Calculate weight adjustment
        const adjustmentMagnitude = Math.min(
          this.config.max_weight_adjustment,
          Math.abs(stats.net_sentiment) * this.config.learning_velocity
        );

        const weightChange = stats.net_sentiment < 0 ? -adjustmentMagnitude : adjustmentMagnitude;
        const newWeight = Math.max(0.1, Math.min(2.0, (pattern.current_weight || 1.0) + weightChange));

        // Calculate confidence adjustment
        const confidenceChange = stats.net_sentiment < 0 
          ? this.config.confidence_adjustment_factor 
          : -this.config.confidence_adjustment_factor * 0.5; // Less aggressive when increasing

        const newMinConfidence = Math.max(0.5, Math.min(0.95, (pattern.min_confidence || 0.7) + confidenceChange));

        // Update pattern with new settings
        const historyEntry = {
          date: new Date().toISOString(),
          adjustment_reason: `Feedback sentiment: ${stats.net_sentiment.toFixed(2)} (${stats.total} samples)`,
          weight_change: weightChange,
          confidence_change: confidenceChange,
          feedback_trigger: {
            total_feedback: stats.total,
            net_sentiment: stats.net_sentiment,
          }
        };

        await storage.upsertPatternLearning({
          pattern_name: patternName,
          pattern_type: pattern.pattern_type,
          base_weight: pattern.base_weight || 1.0,
          current_weight: newWeight,
          min_confidence: newMinConfidence,
          feedback_stats: {
            total_feedback: stats.total,
            positive_count: Math.max(0, Math.round(stats.total * (1 + stats.net_sentiment) / 2)),
            negative_count: Math.max(0, Math.round(stats.total * (1 - stats.net_sentiment) / 2)),
            net_sentiment: stats.net_sentiment,
            win_rate: (1 + stats.net_sentiment) / 2,
          },
          performance_history: [
            ...(pattern.performance_history || []).slice(-10), // Keep last 10 adjustments
            historyEntry
          ]
        });

        console.log(`🔧 Pattern "${patternName}" adjusted: weight ${pattern.current_weight?.toFixed(3)} → ${newWeight.toFixed(3)}, confidence ${pattern.min_confidence?.toFixed(3)} → ${newMinConfidence.toFixed(3)}`);

      } catch (error) {
        console.error(`❌ Failed to adjust pattern ${patternName}:`, error);
      }
    }
  }

  /**
   * ⚙️ Adjust global signal type settings
   */
  async adjustSignalTypeSettings(signalType: string, stats: { net_sentiment: number; total: number }): Promise<void> {
    const settingsPatternName = `${signalType}_global_settings`;
    
    try {
      let settings = await storage.getPatternLearning(settingsPatternName);
      
      if (!settings) {
        // Initialize global settings
        settings = await storage.upsertPatternLearning({
          pattern_name: settingsPatternName,
          pattern_type: 'signal_type_settings',
          base_weight: 1.0,
          current_weight: 1.0,
          min_confidence: 0.7,
        });
      }

      // For poor performance, make more conservative
      if (stats.net_sentiment < -0.2) {
        const newConfidence = Math.min(0.95, (settings.min_confidence || 0.7) + 0.1);
        const newWeight = Math.max(0.5, (settings.current_weight || 1.0) - 0.1);
        
        await storage.upsertPatternLearning({
          ...settings,
          current_weight: newWeight,
          min_confidence: newConfidence,
          feedback_stats: {
            total_feedback: stats.total,
            positive_count: Math.max(0, Math.round(stats.total * (1 + stats.net_sentiment) / 2)),
            negative_count: Math.max(0, Math.round(stats.total * (1 - stats.net_sentiment) / 2)),
            net_sentiment: stats.net_sentiment,
            win_rate: (1 + stats.net_sentiment) / 2,
          }
        });

        console.log(`🔧 ${signalType} global settings adjusted (conservative): confidence → ${newConfidence.toFixed(3)}, weight → ${newWeight.toFixed(3)}`);
      }

    } catch (error) {
      console.error(`❌ Failed to adjust ${signalType} global settings:`, error);
    }
  }

  /**
   * 📈 Increase signal aggressiveness for well-performing signals
   */
  async increaseSignalAggressiveness(signalType: string, patterns?: string[]): Promise<void> {
    try {
      // Slightly decrease confidence thresholds for well-performing patterns
      if (patterns) {
        for (const patternName of patterns) {
          const pattern = await storage.getPatternLearning(patternName);
          if (pattern && (pattern.min_confidence || 0.7) > 0.6) {
            const newConfidence = Math.max(0.6, (pattern.min_confidence || 0.7) - 0.02);
            await storage.upsertPatternLearning({
              ...pattern,
              min_confidence: newConfidence,
            });
            console.log(`📈 Increased aggressiveness for ${patternName}: confidence → ${newConfidence.toFixed(3)}`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Failed to increase aggressiveness for ${signalType}:`, error);
    }
  }

  /**
   * 📋 Generate comprehensive weekly feedback report
   */
  async generateWeeklyFeedbackReport(): Promise<WeeklyFeedbackReport> {
    try {
      const weekStart = this.getWeekStart();
      const allFeedback = await storage.getFeedbackBatch(5000); // Get comprehensive data
      const cutoffDate = new Date(weekStart);
      
      const weeklyFeedback = allFeedback.filter(f => 
        (f.timestamp?.getTime() || 0) >= cutoffDate.getTime()
      );

      // Overall performance metrics
      const totalSignals = await this.estimateSignalsSent(weekStart);
      const overallPerformance = {
        total_signals: totalSignals,
        total_feedback: weeklyFeedback.length,
        feedback_rate: totalSignals > 0 ? weeklyFeedback.length / totalSignals : 0,
        net_sentiment: this.calculateNetSentiment(weeklyFeedback),
        avg_response_time: this.calculateAvgResponseTime(weeklyFeedback),
      };

      // Signal type breakdown
      const signalTypes = Array.from(new Set(weeklyFeedback.map(f => f.signal_type)));
      const signalTypeBreakdown: Record<string, any> = {};
      
      for (const signalType of signalTypes) {
        const typeFeedback = weeklyFeedback.filter(f => f.signal_type === signalType);
        const positive = typeFeedback.filter(f => f.rating > 0).length;
        const negative = typeFeedback.filter(f => f.rating < 0).length;
        const netSentiment = typeFeedback.length > 0 ? (positive - negative) / typeFeedback.length : 0;
        
        signalTypeBreakdown[signalType] = {
          signals_sent: Math.round(totalSignals * 0.3), // Estimate
          feedback_received: typeFeedback.length,
          positive_feedback: positive,
          negative_feedback: negative,
          net_sentiment: netSentiment,
          improvement_trend: await this.calculateImprovementTrend(signalType),
        };
      }

      // Pattern adjustments made this week
      const allPatterns = await storage.getAllPatterns();
      const weekStartTime = cutoffDate.getTime();
      const patternAdjustments = allPatterns
        .filter(p => (p.last_adjustment?.getTime() || 0) >= weekStartTime)
        .map(p => {
          const lastHistory = p.performance_history?.[p.performance_history.length - 1];
          return {
            pattern_name: p.pattern_name,
            adjustment_type: lastHistory?.weight_change > 0 ? 'weight_increase' as const : 'weight_decrease' as const,
            magnitude: Math.abs(lastHistory?.weight_change || 0),
            reason: lastHistory?.adjustment_reason || 'Automated adjustment',
            expected_impact: lastHistory?.weight_change > 0 ? 'Increased signal frequency' : 'Improved signal quality',
          };
        });

      // Learning insights
      const learningInsights = {
        most_improved_pattern: this.findMostImprovedPattern(allPatterns),
        worst_performing_pattern: this.findWorstPerformingPattern(allPatterns),
        learning_velocity: this.config.learning_velocity,
        total_adjustments: patternAdjustments.length,
        patterns_being_watched: allPatterns
          .filter(p => (p.feedback_stats?.net_sentiment || 0) < -0.1)
          .map(p => p.pattern_name)
          .slice(0, 5),
      };

      // Recommendations
      const recommendations = this.generateRecommendations(overallPerformance, signalTypeBreakdown, patternAdjustments);

      return {
        week_start: weekStart,
        overall_performance: overallPerformance,
        signal_type_breakdown: signalTypeBreakdown,
        pattern_adjustments: patternAdjustments,
        learning_insights: learningInsights,
        recommendations: recommendations,
      };

    } catch (error) {
      console.error('❌ Failed to generate weekly feedback report:', error);
      throw error;
    }
  }

  /**
   * 🔍 Extract signal type from reference ID
   */
  private extractSignalTypeFromRef(refId: string): string {
    if (refId.startsWith('ib_')) return 'institutional';
    if (refId.startsWith('snp_')) return 'sniper';
    if (refId.startsWith('smc_')) return 'smc';
    if (refId.startsWith('whale_')) return 'whale';
    if (refId.startsWith('funding_')) return 'funding';
    return 'unknown';
  }

  /**
   * 📅 Get current week start date
   */
  private getWeekStart(): string {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days to subtract to get to Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }

  /**
   * 📊 Helper functions for report generation
   */
  private calculateNetSentiment(feedback: any[]): number {
    if (feedback.length === 0) return 0;
    const positive = feedback.filter(f => f.rating > 0).length;
    const negative = feedback.filter(f => f.rating < 0).length;
    return (positive - negative) / feedback.length;
  }

  private calculateAvgResponseTime(feedback: any[]): number {
    const times = feedback
      .map(f => f.response_time_seconds)
      .filter(t => t !== null && t !== undefined) as number[];
    return times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;
  }

  private async estimateSignalsSent(weekStart: string): Promise<number> {
    // Estimate based on logs or other metrics
    // For now, return a reasonable estimate
    return 50;
  }

  private async calculateImprovementTrend(signalType: string): Promise<'improving' | 'stable' | 'declining'> {
    // Compare recent vs previous period sentiment
    const recent = await this.getFeedbackStatsForSignalType(signalType, 3);
    const previous = await this.getFeedbackStatsForSignalType(signalType, 7);
    
    if (recent.net_sentiment > previous.net_sentiment + 0.1) return 'improving';
    if (recent.net_sentiment < previous.net_sentiment - 0.1) return 'declining';
    return 'stable';
  }

  private findMostImprovedPattern(patterns: any[]): string | undefined {
    return patterns
      .filter(p => p.feedback_stats?.win_rate > 0.6)
      .sort((a, b) => (b.feedback_stats?.win_rate || 0) - (a.feedback_stats?.win_rate || 0))
      [0]?.pattern_name;
  }

  private findWorstPerformingPattern(patterns: any[]): string | undefined {
    return patterns
      .filter(p => (p.feedback_stats?.total_feedback || 0) > 3)
      .sort((a, b) => (a.feedback_stats?.win_rate || 1) - (b.feedback_stats?.win_rate || 1))
      [0]?.pattern_name;
  }

  private generateRecommendations(overall: any, breakdown: any, adjustments: any[]): string[] {
    const recommendations: string[] = [];

    if (overall.feedback_rate < 0.3) {
      recommendations.push("📊 Low feedback rate detected. Consider adding more engaging call-to-actions in alerts.");
    }

    if (overall.net_sentiment < -0.2) {
      recommendations.push("⚠️ Overall sentiment is negative. Review signal quality and consider increasing confidence thresholds.");
    }

    if (adjustments.length > 10) {
      recommendations.push("🔧 High number of pattern adjustments. Monitor for stability over the next week.");
    }

    if (overall.avg_response_time > 300) {
      recommendations.push("⏱️ Long response times detected. Consider shortening alert messages or improving clarity.");
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ System performing well. Continue monitoring patterns for optimization opportunities.");
    }

    return recommendations;
  }
}

// Global service instance
export const feedbackLearningService = new FeedbackLearningService();
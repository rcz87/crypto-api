import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { 
  aiSignals, 
  aiExecutions, 
  aiOutcomes, 
  aiPatternPerformance,
  type InsertAiSignal,
  type InsertAiExecution,
  type InsertAiOutcome,
  type InsertAiPatternPerformance,
  type AiPatternPerformance
} from "@shared/schema";
import type { EnhancedAISignal, EnhancedMarketPattern } from "./enhancedAISignalEngine";
import { EventEmitter } from '../observability/eventEmitter.js';

export interface ExecutionResult {
  exit_price: number;
  exit_time: Date;
  exit_reason: 'stop_loss' | 'take_profit' | 'manual' | 'time_exit';
  duration_minutes?: number;
}

export class ExecutionRecorder {
  
  /**
   * Record an Enhanced AI signal for tracking
   */
  async recordSignal(signal: EnhancedAISignal): Promise<string | null> {
    try {
      const signalData: InsertAiSignal = {
        signal_id: signal.signal_id,
        symbol: signal.symbol,
        direction: signal.direction,
        strength: signal.strength,
        confidence: signal.confidence,
        patterns: signal.detected_patterns,
        reasoning: signal.reasoning,
        execution_details: signal.execution_details,
        neural_features: signal.neural_prediction.neural_features,
      };

      const result = await db.insert(aiSignals).values(signalData).returning({ id: aiSignals.id });
      
      if (result[0]) {
        console.log(`📊 Signal recorded: ${signal.signal_id} - ${signal.direction.toUpperCase()} (${signal.confidence}% confidence)`);
        
        // Initialize pattern performance tracking for new patterns
        await this.ensurePatternTracking(signal.detected_patterns);
        
        return result[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error recording signal:', error);
      return null;
    }
  }

  /**
   * Record execution details when a signal is executed
   */
  async recordExecution(
    signalId: string, 
    executionDetails: {
      entry_price: number;
      position_size: number;
      stop_loss?: number;
      take_profit_1?: number;
      take_profit_2?: number;
      risk_amount?: number;
      execution_type?: 'manual' | 'auto' | 'paper';
    }
  ): Promise<string | null> {
    try {
      const execData: InsertAiExecution = {
        signal_id: signalId,
        entry_price: executionDetails.entry_price.toString(),
        position_size: executionDetails.position_size.toString(),
        stop_loss: executionDetails.stop_loss?.toString(),
        take_profit_1: executionDetails.take_profit_1?.toString(),
        take_profit_2: executionDetails.take_profit_2?.toString(),
        risk_amount: executionDetails.risk_amount?.toString(),
        execution_type: executionDetails.execution_type || 'manual',
      };

      const result = await db.insert(aiExecutions).values(execData).returning({ id: aiExecutions.id });
      
      if (result[0]) {
        console.log(`⚡ Execution recorded: ${signalId} - Entry: $${executionDetails.entry_price}`);
        
        // Event Logging: Signal Triggered (Entry Filled)
        try {
          // Get signal data to extract actual symbol
          const signalData = await db
            .select({ symbol: aiSignals.symbol })
            .from(aiSignals)
            .where(eq(aiSignals.signal_id, signalId))
            .limit(1);
          
          const actualSymbol = signalData[0]?.symbol || 'SOL-USDT-SWAP';
          
          await EventEmitter.triggered({
            signal_id: signalId, // Use the same UUID from the signal
            symbol: actualSymbol, // Use actual symbol from signal
            entry_fill: executionDetails.entry_price,
            time_to_trigger_ms: 0 // TODO: Calculate actual trigger time from signal creation
          });
        } catch (error) {
          console.error('Event logging failed for triggered signal:', error);
        }
        
        return result[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error recording execution:', error);
      return null;
    }
  }

  /**
   * Record trade outcome and update pattern performance
   */
  async recordOutcome(
    signalId: string,
    outcome: ExecutionResult
  ): Promise<void> {
    try {
      // Get signal and execution details
      const signalData = await db
        .select()
        .from(aiSignals)
        .leftJoin(aiExecutions, eq(aiSignals.signal_id, aiExecutions.signal_id))
        .where(eq(aiSignals.signal_id, signalId))
        .limit(1);

      if (!signalData[0] || !signalData[0].ai_executions) {
        console.error(`❌ Signal or execution not found for ${signalId}`);
        return;
      }

      const signal = signalData[0].ai_signals;
      const execution = signalData[0].ai_executions;

      // Calculate P&L and metrics
      const entryPrice = parseFloat(execution.entry_price || '0');
      const positionSize = parseFloat(execution.position_size || '0');
      const isLong = signal.direction === 'long';
      
      let pnl: number;
      if (isLong) {
        pnl = (outcome.exit_price - entryPrice) * positionSize;
      } else {
        pnl = (entryPrice - outcome.exit_price) * positionSize;
      }

      const pnlPercentage = ((outcome.exit_price - entryPrice) / entryPrice) * 100 * (isLong ? 1 : -1);
      const riskAmount = parseFloat(execution.risk_amount || '0');
      const riskRewardRatio = riskAmount > 0 ? Math.abs(pnl / riskAmount) : 0;
      const wasSuccessful = pnl > 0 ? 1 : 0;
      
      // Confidence validation (how well the confidence matched the outcome)
      const confidenceValidation = this.calculateConfidenceValidation(signal.confidence, wasSuccessful);

      // Record outcome
      const outcomeData: InsertAiOutcome = {
        signal_id: signalId,
        exit_price: outcome.exit_price.toString(),
        exit_time: outcome.exit_time,
        pnl: pnl.toString(),
        pnl_percentage: pnlPercentage.toString(),
        risk_reward_ratio: riskRewardRatio.toString(),
        duration_minutes: outcome.duration_minutes,
        exit_reason: outcome.exit_reason,
        was_successful: wasSuccessful,
        confidence_validation: confidenceValidation,
      };

      await db.insert(aiOutcomes).values(outcomeData);

      console.log(`📈 Outcome recorded: ${signalId} - P&L: $${pnl.toFixed(2)} (${pnlPercentage.toFixed(2)}%)`);      

      // Event Logging: Signal Closed (Position Closed)
      try {
        const entryTime = execution.entry_time ? new Date(execution.entry_time).getTime() : Date.now();
        const exitTime = outcome.exit_time ? new Date(outcome.exit_time).getTime() : Date.now();
        const timeInTrade = Math.max(0, exitTime - entryTime);
        
        // Use actual symbol from signal data
        const actualSymbol = signal.symbol || 'SOL-USDT-SWAP';
        
        // Map exit reasons and determine if we should use invalidated or closed
        const isStopLoss = outcome.exit_reason === 'stop_loss';
        
        if (isStopLoss) {
          await EventEmitter.invalidated({
            signal_id: signalId, // Use the same UUID from the signal
            symbol: actualSymbol,
            reason: 'sl' as 'sl' | 'hard_invalidate' | 'expiry'
          });
        } else {
          await EventEmitter.closed({
            signal_id: signalId, // Use the same UUID from the signal
            symbol: actualSymbol, // Use actual symbol from signal
            rr_realized: riskRewardRatio,
            time_in_trade_ms: timeInTrade,
            exit_reason: outcome.exit_reason as 'tp' | 'manual' | 'sl' | 'time' | 'other'
          });
        }
      } catch (error) {
        console.error('Event logging failed for closed signal:', error);
      }

      // Update pattern performance metrics
      if (signal.patterns && Array.isArray(signal.patterns)) {
        await this.updatePatternPerformance(signal.patterns as EnhancedMarketPattern[], pnl, wasSuccessful === 1, signal.confidence);
      }

    } catch (error) {
      console.error('❌ Error recording outcome:', error);
    }
  }

  /**
   * Ensure pattern tracking exists for all detected patterns
   */
  private async ensurePatternTracking(patterns: EnhancedMarketPattern[]): Promise<void> {
    for (const pattern of patterns) {
      try {
        // Check if pattern tracking exists
        const existing = await db
          .select()
          .from(aiPatternPerformance)
          .where(eq(aiPatternPerformance.pattern_id, pattern.id))
          .limit(1);

        if (existing.length === 0) {
          // Create new pattern tracking
          const patternData: InsertAiPatternPerformance = {
            pattern_id: pattern.id,
            pattern_name: pattern.name,
            total_signals: 0,
            successful_signals: 0,
            failed_signals: 0,
            win_rate: "0",
            avg_confidence: pattern.confidence.toString(),
            adaptation_factor: pattern.learning_weight.toString(),
            learning_velocity: pattern.adaptation_rate.toString(),
          };

          await db.insert(aiPatternPerformance).values(patternData);
          console.log(`🆕 Pattern tracking initialized: ${pattern.name}`);
        }
      } catch (error) {
        console.error(`❌ Error ensuring pattern tracking for ${pattern.id}:`, error);
      }
    }
  }

  /**
   * Update pattern performance metrics with new outcome
   */
  private async updatePatternPerformance(
    patterns: EnhancedMarketPattern[],
    pnl: number,
    wasSuccessful: boolean,
    signalConfidence: number
  ): Promise<void> {
    for (const pattern of patterns) {
      try {
        // Get current pattern performance
        const currentPerf = await db
          .select()
          .from(aiPatternPerformance)
          .where(eq(aiPatternPerformance.pattern_id, pattern.id))
          .limit(1);

        if (currentPerf.length === 0) continue;

        const perf = currentPerf[0];
        
        // Calculate updated metrics
        const newTotalSignals = (perf.total_signals || 0) + 1;
        const newSuccessfulSignals = (perf.successful_signals || 0) + (wasSuccessful ? 1 : 0);
        const newFailedSignals = (perf.failed_signals || 0) + (wasSuccessful ? 0 : 1);
        const newWinRate = newSuccessfulSignals / newTotalSignals;
        
        // Update running averages
        const currentAvgPnl = parseFloat(perf.avg_pnl || '0');
        const newAvgPnl = ((currentAvgPnl * (perf.total_signals || 0)) + pnl) / newTotalSignals;
        
        const currentAvgConfidence = parseFloat(perf.avg_confidence || '0');
        const newAvgConfidence = ((currentAvgConfidence * (perf.total_signals || 0)) + signalConfidence) / newTotalSignals;
        
        const newTotalPnl = parseFloat(perf.total_pnl || '0') + pnl;
        const newBestTrade = Math.max(parseFloat(perf.best_trade || '0'), pnl);
        const newWorstTrade = Math.min(parseFloat(perf.worst_trade || '0'), pnl);

        // Calculate dynamic adaptation factor based on performance
        const currentAdaptationFactor = parseFloat(perf.adaptation_factor || '1.0');
        const learningVelocity = parseFloat(perf.learning_velocity || '0.1');
        
        const newAdaptationFactor = this.calculateAdaptationFactor(
          newWinRate,
          currentAdaptationFactor,
          learningVelocity,
          wasSuccessful
        );

        // Update pattern performance
        await db
          .update(aiPatternPerformance)
          .set({
            total_signals: newTotalSignals,
            successful_signals: newSuccessfulSignals,
            failed_signals: newFailedSignals,
            win_rate: newWinRate.toString(),
            avg_confidence: newAvgConfidence.toString(),
            avg_pnl: newAvgPnl.toString(),
            total_pnl: newTotalPnl.toString(),
            best_trade: newBestTrade.toString(),
            worst_trade: newWorstTrade.toString(),
            adaptation_factor: newAdaptationFactor.toString(),
            last_updated: new Date(),
          })
          .where(eq(aiPatternPerformance.pattern_id, pattern.id));

        console.log(`🔄 Pattern updated: ${pattern.name} - Win Rate: ${(newWinRate * 100).toFixed(1)}% | Adaptation: ${newAdaptationFactor.toFixed(3)}`);

      } catch (error) {
        console.error(`❌ Error updating pattern performance for ${pattern.id}:`, error);
      }
    }
  }

  /**
   * Calculate confidence validation score (how well confidence matched outcome)
   */
  private calculateConfidenceValidation(confidence: number, wasSuccessful: number): number {
    // Higher confidence should predict success better
    // Score from 0-100 where 100 means perfect prediction
    if (wasSuccessful === 1) {
      // Success: higher confidence gets higher validation score
      return Math.round(confidence);
    } else {
      // Failure: lower confidence gets higher validation score
      return Math.round(100 - confidence);
    }
  }

  /**
   * Calculate dynamic adaptation factor for pattern confidence
   */
  private calculateAdaptationFactor(
    winRate: number,
    currentFactor: number,
    learningVelocity: number,
    wasSuccessful: boolean
  ): number {
    // Adaptation factor modifies pattern confidence based on performance
    // Range: 0.5 to 1.5 (50% reduction to 50% increase)
    
    let targetFactor: number;
    
    if (winRate >= 0.7) {
      // High win rate: increase confidence
      targetFactor = 1.2;
    } else if (winRate >= 0.5) {
      // Average win rate: maintain confidence
      targetFactor = 1.0;
    } else {
      // Poor win rate: decrease confidence
      targetFactor = 0.8;
    }
    
    // Apply recent success/failure for faster adaptation
    if (wasSuccessful) {
      targetFactor += 0.05; // Small boost for recent success
    } else {
      targetFactor -= 0.05; // Small penalty for recent failure
    }
    
    // Gradually move towards target factor
    const newFactor = currentFactor + (targetFactor - currentFactor) * learningVelocity;
    
    // Clamp to reasonable bounds
    return Math.max(0.5, Math.min(1.5, newFactor));
  }

  /**
   * Get pattern performance metrics
   */
  async getPatternPerformance(patternId?: string): Promise<AiPatternPerformance[]> {
    try {
      if (patternId) {
        return await db
          .select()
          .from(aiPatternPerformance)
          .where(eq(aiPatternPerformance.pattern_id, patternId));
      } else {
        return await db
          .select()
          .from(aiPatternPerformance)
          .orderBy(sql`${aiPatternPerformance.win_rate} DESC`);
      }
    } catch (error) {
      console.error('❌ Error getting pattern performance:', error);
      return [];
    }
  }

  /**
   * Get overall AI signal performance statistics
   */
  async getOverallPerformance(): Promise<{
    total_signals: number;
    successful_signals: number;
    win_rate: number;
    total_pnl: number;
    avg_pnl: number;
    best_pattern: string | null;
    worst_pattern: string | null;
  }> {
    try {
      // Aggregate from all pattern performances
      const patterns = await db.select().from(aiPatternPerformance);
      
      const totalSignals = patterns.reduce((sum: number, p: AiPatternPerformance) => sum + (p.total_signals || 0), 0);
      const successfulSignals = patterns.reduce((sum: number, p: AiPatternPerformance) => sum + (p.successful_signals || 0), 0);
      const totalPnl = patterns.reduce((sum: number, p: AiPatternPerformance) => sum + parseFloat(p.total_pnl || '0'), 0);
      
      const winRate = totalSignals > 0 ? successfulSignals / totalSignals : 0;
      const avgPnl = totalSignals > 0 ? totalPnl / totalSignals : 0;
      
      // Find best and worst patterns by win rate
      const sortedPatterns = patterns.sort((a: AiPatternPerformance, b: AiPatternPerformance) => 
        parseFloat(b.win_rate || '0') - parseFloat(a.win_rate || '0')
      );
      
      return {
        total_signals: totalSignals,
        successful_signals: successfulSignals,
        win_rate: winRate,
        total_pnl: totalPnl,
        avg_pnl: avgPnl,
        best_pattern: sortedPatterns[0]?.pattern_name || null,
        worst_pattern: sortedPatterns[sortedPatterns.length - 1]?.pattern_name || null,
      };
    } catch (error) {
      console.error('❌ Error getting overall performance:', error);
      return {
        total_signals: 0,
        successful_signals: 0,
        win_rate: 0,
        total_pnl: 0,
        avg_pnl: 0,
        best_pattern: null,
        worst_pattern: null,
      };
    }
  }
}

// Export singleton instance
export const executionRecorder = new ExecutionRecorder();
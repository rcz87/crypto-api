/**
 * Backtest Engine
 *
 * Core backtesting logic for Meta-Brain Fusion Engine
 */

import { fusionEngine } from '../brain/fusionEngine';
import { BrainInsight } from '../brain/orchestrator';
import { UnifiedSignalWithMetrics } from '../brain/unifiedSignal';
import {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  BacktestPosition,
  BacktestEvent,
  MarketState,
  BacktestPerformance
} from './types';
import { historicalDataFetcher } from './historicalDataFetcher';
import { performanceAnalyzer } from './performanceAnalyzer';

export class BacktestEngine {
  private events: BacktestEvent[] = [];
  private trades: BacktestTrade[] = [];
  private equity: { timestamp: number; equity: number }[] = [];
  private positions: BacktestPosition[] = [];

  /**
   * Run complete backtest
   */
  async run(config: BacktestConfig): Promise<BacktestResult> {
    const startTime = Date.now();
    console.log(`🧪 [Backtest] Starting backtest for ${config.symbol}`);
    console.log(`📅 Period: ${config.startDate.toISOString()} → ${config.endDate.toISOString()}`);

    // Reset state
    this.events = [];
    this.trades = [];
    this.equity = [];
    this.positions = [];

    try {
      // 1. Fetch historical data
      const marketData = await historicalDataFetcher.fetchHistoricalData(
        config.symbol,
        config.startDate,
        config.endDate,
        config.timeframe
      );

      if (marketData.length === 0) {
        throw new Error('No historical data available');
      }

      console.log(`📊 [Backtest] Processing ${marketData.length} data points`);

      // 2. Initialize capital
      let currentCapital = config.initialCapital;
      this.equity.push({
        timestamp: marketData[0].timestamp,
        equity: currentCapital
      });

      // 3. Iterate through each market state
      for (let i = 0; i < marketData.length; i++) {
        const state = marketData[i];
        const nextState = marketData[i + 1];

        // Update open positions
        this.updatePositions(state, config);

        // Check for exit signals on existing positions
        this.checkExits(state, nextState, config);

        // Check for new entry signals (if not at max positions)
        if (this.positions.length < config.maxConcurrentTrades) {
          await this.checkEntry(state, config, currentCapital);
        }

        // Calculate current equity
        const unrealizedPnl = this.calculateUnrealizedPnl(state);
        const realizedPnl = this.calculateRealizedPnl();
        const totalEquity = config.initialCapital + realizedPnl + unrealizedPnl;

        this.equity.push({
          timestamp: state.timestamp,
          equity: totalEquity
        });

        currentCapital = totalEquity;

        // Progress logging
        if (i % 100 === 0) {
          const progress = ((i / marketData.length) * 100).toFixed(1);
          console.log(`⏳ [Backtest] Progress: ${progress}% | Equity: $${totalEquity.toFixed(2)} | Positions: ${this.positions.length}`);
        }
      }

      // 4. Close any remaining positions at end
      this.closeAllPositions(marketData[marketData.length - 1], 'TIMEOUT', config);

      // 5. Calculate performance metrics
      const performance = performanceAnalyzer.analyze(
        this.trades,
        config
      );

      // 6. Build result
      const result: BacktestResult = {
        config,
        performance,
        trades: this.trades,
        equityCurve: this.equity,
        drawdownCurve: this.calculateDrawdownCurve(),
        executionTime: Date.now() - startTime,
        dataPoints: marketData.length,
        generatedAt: new Date().toISOString()
      };

      console.log(`✅ [Backtest] Complete in ${result.executionTime}ms`);
      console.log(`📈 Trades: ${result.performance.totalTrades} | Winrate: ${(result.performance.winrate * 100).toFixed(1)}%`);
      console.log(`💰 Total PnL: $${result.performance.totalPnl.toFixed(2)} (${result.performance.totalPnlPercent.toFixed(2)}%)`);

      return result;

    } catch (error) {
      console.error('❌ [Backtest] Failed:', error);
      throw error;
    }
  }

  /**
   * Check for entry signals
   */
  private async checkEntry(
    state: MarketState,
    config: BacktestConfig,
    currentCapital: number
  ): Promise<void> {
    try {
      // Create mock BrainInsight from historical data
      const brainInsight = this.createMockBrainInsight(state, config.symbol);

      // Run fusion engine
      const signal = await fusionEngine.fuse(brainInsight, state.price.close);

      // Check if signal meets criteria
      if (signal.final_signal === 'HOLD') return;
      if (signal.confidence < config.minConfidence) return;

      // Check if this rule is enabled
      const triggeredRules = this.extractTriggeredRules(signal);
      const hasEnabledRule = triggeredRules.some(r => config.enabledRules.includes(r));
      if (!hasEnabledRule) return;

      // Calculate position size
      const riskAmount = currentCapital * (config.riskPerTradePercent / 100);
      const stopDistance = Math.abs(state.price.close - (signal.stop_loss || state.price.close * 0.98));
      let positionSize = riskAmount / stopDistance;

      // Apply max position size limit
      positionSize = Math.min(positionSize, config.maxPositionSize);

      // Apply slippage to entry
      const entryPrice = this.applySlippage(state.price.close, signal.final_signal, config.slippage);

      // Create position
      const position: BacktestPosition = {
        symbol: config.symbol,
        side: signal.final_signal as 'LONG' | 'SHORT',
        entryPrice,
        entryTime: state.timestamp,
        size: positionSize,
        stopLoss: signal.stop_loss || this.calculateDefaultStopLoss(entryPrice, signal.final_signal),
        takeProfits: signal.take_profit || this.calculateDefaultTakeProfits(entryPrice, signal.final_signal),
        takeProfitHits: [false, false, false],
        fusionSignal: signal,
        unrealizedPnl: 0
      };

      this.positions.push(position);

      this.logEvent({
        timestamp: state.timestamp,
        type: 'ENTRY',
        data: { position, signal },
        message: `${signal.final_signal} entry at $${entryPrice.toFixed(2)} | Confidence: ${(signal.confidence * 100).toFixed(1)}%`
      });

    } catch (error) {
      console.error('❌ [Backtest] Entry check failed:', error);
    }
  }

  /**
   * Check for exit signals on existing positions
   */
  private checkExits(
    state: MarketState,
    nextState: MarketState | undefined,
    config: BacktestConfig
  ): void {
    const currentPrice = state.price.close;
    const positionsToClose: number[] = [];

    for (let i = 0; i < this.positions.length; i++) {
      const position = this.positions[i];

      // Check stop loss
      if (this.isStopLossHit(position, state)) {
        this.closePosition(i, state, 'SL', config);
        positionsToClose.push(i);
        continue;
      }

      // Check take profits
      for (let tpIndex = 0; tpIndex < position.takeProfits.length; tpIndex++) {
        if (!position.takeProfitHits[tpIndex] && this.isTakeProfitHit(position, tpIndex, state)) {
          if (config.usePartialTakeProfits) {
            // Partial close
            this.partialClosePosition(i, state, tpIndex, config);
          } else {
            // Full close on first TP
            this.closePosition(i, state, `TP${tpIndex + 1}` as any, config);
            positionsToClose.push(i);
            break;
          }
        }
      }

      // Check reverse signal
      if (config.exitOnReverseSignal && nextState) {
        // Would need to run fusion on next state (expensive)
        // Skip for now or implement as optimization
      }

      // Check timeout (max trade duration)
      const durationHours = (state.timestamp - position.entryTime) / (1000 * 60 * 60);
      if (durationHours > 24) { // Max 24 hours per trade
        this.closePosition(i, state, 'TIMEOUT', config);
        positionsToClose.push(i);
      }
    }

    // Remove closed positions (in reverse order to maintain indices)
    for (let i = positionsToClose.length - 1; i >= 0; i--) {
      this.positions.splice(positionsToClose[i], 1);
    }
  }

  /**
   * Update position unrealized PnL
   */
  private updatePositions(state: MarketState, config: BacktestConfig): void {
    const currentPrice = state.price.close;

    for (const position of this.positions) {
      if (position.side === 'LONG') {
        position.unrealizedPnl = (currentPrice - position.entryPrice) * position.size;
      } else {
        position.unrealizedPnl = (position.entryPrice - currentPrice) * position.size;
      }

      // Trail stop loss if enabled
      if (config.trailStopLoss && position.unrealizedPnl > 0) {
        this.trailStopLoss(position, currentPrice);
      }
    }
  }

  /**
   * Close position and record trade
   */
  private closePosition(
    index: number,
    state: MarketState,
    exitReason: BacktestTrade['exitReason'],
    config: BacktestConfig
  ): void {
    const position = this.positions[index];
    const exitPrice = this.applySlippage(state.price.close, position.side, config.slippage);

    // Calculate PnL
    let pnl: number;
    if (position.side === 'LONG') {
      pnl = (exitPrice - position.entryPrice) * position.size;
    } else {
      pnl = (position.entryPrice - exitPrice) * position.size;
    }

    // Apply commission
    const commission = (position.entryPrice * position.size * config.commission / 100) +
                      (exitPrice * position.size * config.commission / 100);
    pnl -= commission;

    const pnlPercent = (pnl / (position.entryPrice * position.size)) * 100;
    const riskAmount = Math.abs((position.entryPrice - position.stopLoss) * position.size);
    const rMultiple = pnl / riskAmount;

    const trade: BacktestTrade = {
      entryTime: position.entryTime,
      entryPrice: position.entryPrice,
      signal: position.side,
      confidence: position.fusionSignal.confidence,
      exitTime: state.timestamp,
      exitPrice,
      exitReason,
      pnl,
      pnlPercent,
      rMultiple,
      stopLoss: position.stopLoss,
      takeProfits: position.takeProfits,
      riskAmount,
      fusionSignal: position.fusionSignal,
      triggeredRules: this.extractTriggeredRules(position.fusionSignal),
      durationMinutes: (state.timestamp - position.entryTime) / (1000 * 60)
    };

    this.trades.push(trade);

    this.logEvent({
      timestamp: state.timestamp,
      type: 'EXIT',
      data: { trade },
      message: `${position.side} exit at $${exitPrice.toFixed(2)} | PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%) | ${exitReason}`
    });
  }

  /**
   * Partial close at take profit level
   */
  private partialClosePosition(
    index: number,
    state: MarketState,
    tpIndex: number,
    config: BacktestConfig
  ): void {
    const position = this.positions[index];
    position.takeProfitHits[tpIndex] = true;

    // Close 33% at each TP
    const closeSize = position.size * 0.33;
    position.size -= closeSize;

    this.logEvent({
      timestamp: state.timestamp,
      type: 'TP_HIT',
      data: { tpIndex, closeSize },
      message: `TP${tpIndex + 1} hit - Partial close $${closeSize.toFixed(2)}`
    });
  }

  /**
   * Close all remaining positions
   */
  private closeAllPositions(
    state: MarketState,
    reason: BacktestTrade['exitReason'],
    config: BacktestConfig
  ): void {
    while (this.positions.length > 0) {
      this.closePosition(0, state, reason, config);
      this.positions.splice(0, 1);
    }
  }

  /**
   * Check if stop loss is hit
   */
  private isStopLossHit(position: BacktestPosition, state: MarketState): boolean {
    if (position.side === 'LONG') {
      return state.price.low <= position.stopLoss;
    } else {
      return state.price.high >= position.stopLoss;
    }
  }

  /**
   * Check if take profit is hit
   */
  private isTakeProfitHit(position: BacktestPosition, tpIndex: number, state: MarketState): boolean {
    const tp = position.takeProfits[tpIndex];
    if (!tp) return false;

    if (position.side === 'LONG') {
      return state.price.high >= tp;
    } else {
      return state.price.low <= tp;
    }
  }

  /**
   * Trail stop loss based on profit
   */
  private trailStopLoss(position: BacktestPosition, currentPrice: number): void {
    const profitPercent = Math.abs((currentPrice - position.entryPrice) / position.entryPrice);

    if (profitPercent > 0.02) { // 2% profit
      const newStopLoss = position.side === 'LONG'
        ? position.entryPrice * 1.005 // Move to 0.5% profit
        : position.entryPrice * 0.995;

      if (position.side === 'LONG' && newStopLoss > position.stopLoss) {
        position.stopLoss = newStopLoss;
      } else if (position.side === 'SHORT' && newStopLoss < position.stopLoss) {
        position.stopLoss = newStopLoss;
      }
    }
  }

  /**
   * Apply slippage to price
   */
  private applySlippage(price: number, side: string, slippagePercent: number): number {
    const slippage = price * (slippagePercent / 100);
    return side === 'LONG' ? price + slippage : price - slippage;
  }

  /**
   * Calculate unrealized PnL for all open positions
   */
  private calculateUnrealizedPnl(state: MarketState): number {
    return this.positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
  }

  /**
   * Calculate realized PnL from closed trades
   */
  private calculateRealizedPnl(): number {
    return this.trades.reduce((sum, trade) => sum + trade.pnl, 0);
  }

  /**
   * Calculate drawdown curve
   */
  private calculateDrawdownCurve(): { timestamp: number; drawdown: number }[] {
    let peak = this.equity[0]?.equity || 0;
    return this.equity.map(point => {
      if (point.equity > peak) peak = point.equity;
      const drawdown = ((peak - point.equity) / peak) * 100;
      return { timestamp: point.timestamp, drawdown };
    });
  }

  /**
   * Create mock BrainInsight from historical data
   */
  private createMockBrainInsight(state: MarketState, symbol: string): BrainInsight {
    // Simplified mock - would need full brain logic for accurate backtest
    return {
      timestamp: new Date(state.timestamp).toISOString(),
      symbol,
      regime: {
        state: 'trending' as any,
        probability: 0.7,
        stability: 'stable',
        allowedStrategies: []
      },
      smartMoney: {
        signal: 'NEUTRAL',
        strength: 'medium',
        confidence: 0.5,
        details: {
          accumulation: false,
          distribution: false,
          manipulation: false
        }
      },
      rotation: {
        status: 'NEUTRAL',
        strength: 'low',
        confidence: 0,
        pattern: 'NEUTRAL'
      },
      switchEvent: {
        triggered: false,
        timestamp: new Date(state.timestamp).toISOString(),
        previousRegime: null,
        newRegime: 'trending' as any,
        confidence: 0.7,
        strategiesEnabled: [],
        strategiesDisabled: [],
        regimeStability: 'stable'
      },
      decision: {
        action: 'HOLD',
        confidence: 0.5,
        reasoning: [],
        riskLevel: 'medium'
      },
      correlations: {}
    };
  }

  /**
   * Extract triggered rule numbers from fusion signal
   */
  private extractTriggeredRules(signal: UnifiedSignalWithMetrics): number[] {
    // Parse reasons to find which rules triggered
    const rules: number[] = [];
    for (const reason of signal.reasons) {
      // Match patterns like "Rule 1:", "Rule 2:", etc.
      const match = reason.match(/Rule (\d+):/);
      if (match) {
        rules.push(parseInt(match[1]));
      }
    }
    return rules.length > 0 ? rules : [0]; // Default to rule 0 if none found
  }

  /**
   * Calculate default stop loss
   */
  private calculateDefaultStopLoss(entryPrice: number, side: string): number {
    const stopPercent = 0.02; // 2% default
    return side === 'LONG'
      ? entryPrice * (1 - stopPercent)
      : entryPrice * (1 + stopPercent);
  }

  /**
   * Calculate default take profits
   */
  private calculateDefaultTakeProfits(entryPrice: number, side: string): number[] {
    if (side === 'LONG') {
      return [
        entryPrice * 1.015, // TP1: 1.5%
        entryPrice * 1.025, // TP2: 2.5%
        entryPrice * 1.04   // TP3: 4%
      ];
    } else {
      return [
        entryPrice * 0.985, // TP1: 1.5%
        entryPrice * 0.975, // TP2: 2.5%
        entryPrice * 0.96   // TP3: 4%
      ];
    }
  }

  /**
   * Log backtest event
   */
  private logEvent(event: BacktestEvent): void {
    this.events.push(event);
  }

  /**
   * Get all backtest events
   */
  getEvents(): BacktestEvent[] {
    return this.events;
  }
}

// Export singleton
export const backtestEngine = new BacktestEngine();

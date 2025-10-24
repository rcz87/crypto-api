/**
 * backtestEngine.ts - Phase 5: Backtest Engine
 * 
 * Core backtesting infrastructure for comparing Strategy A vs Strategy B
 * Simulates historical trading with realistic execution modeling
 */

import { okxService } from './okx';
import { enhancedFundingRateService } from './enhancedFundingRate';

// === Types ===

export interface BacktestConfig {
  strategy: 'A' | 'B';
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  positionSizePercent: number; // 0.01 = 1%
  slippageBps: number; // basis points, 10 = 0.1%
  feePercent: number; // 0.0006 = 0.06% (OKX taker fee)
}

export interface Trade {
  id: string;
  timestamp: Date;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  exit_timestamp: Date;
  stop_loss: number;
  take_profit: number[];
  position_size_usd: number;
  pnl: number;
  pnl_percent: number;
  fees: number;
  slippage: number;
  exit_reason: 'stop_loss' | 'take_profit' | 'time_exit' | 'manual';
  signal_confidence: number;
  pattern_ids: string[];
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  drawdown: number;
  drawdown_percent: number;
}

export interface BacktestMetrics {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  breakeven_trades: number;
  win_rate: number;
  avg_win: number;
  avg_loss: number;
  avg_win_percent: number;
  avg_loss_percent: number;
  rr_ratio: number;
  total_return: number;
  total_return_percent: number;
  max_drawdown: number;
  max_drawdown_percent: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  profit_factor: number;
  calmar_ratio: number;
  expectancy: number;
  best_trade: number;
  worst_trade: number;
  avg_trade_duration_hours: number;
  total_fees: number;
  total_slippage: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  strategy: string;
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  metrics: BacktestMetrics;
  trades: Trade[];
  equity_curve: EquityPoint[];
  summary: string;
}

// === Backtest Engine ===

export class BacktestEngine {
  private config: BacktestConfig;
  private equity: number;
  private peak_equity: number;
  private trades: Trade[] = [];
  private equity_curve: EquityPoint[] = [];
  
  constructor(config: BacktestConfig) {
    this.config = config;
    this.equity = config.initialCapital;
    this.peak_equity = config.initialCapital;
  }

  /**
   * Run backtest for configured strategy and period
   */
  async run(): Promise<BacktestResult> {
    console.log(`[Backtest] Starting ${this.config.strategy} backtest...`);
    console.log(`[Backtest] Period: ${this.config.startDate.toISOString()} to ${this.config.endDate.toISOString()}`);
    
    // Fetch historical candles (1H timeframe)
    const historicalData = await this.fetchHistoricalData();
    console.log(`[Backtest] Fetched ${historicalData.length} historical candles`);
    
    // Generate signals for each candle based on strategy
    for (let i = 24; i < historicalData.length; i++) { // Need 24 candles for indicators
      const currentCandle = historicalData[i];
      const pastCandles = historicalData.slice(i - 24, i);
      
      // Generate signal for this timestamp
      const signal = await this.generateSignalForStrategy(currentCandle, pastCandles);
      
      if (signal && signal.signal_type === 'entry' && signal.direction !== 'neutral') {
        // Execute trade
        const trade = await this.executeTrade(signal, currentCandle, historicalData.slice(i + 1));
        
        if (trade) {
          this.trades.push(trade);
          this.updateEquity(trade);
          this.recordEquityPoint(trade.exit_timestamp);
        }
      }
    }
    
    // Calculate final metrics
    const metrics = this.calculateMetrics();
    
    const result: BacktestResult = {
      config: this.config,
      strategy: this.config.strategy === 'A' ? 'Pre-Phase 4 (No Validation)' : 'Phase 4 (With Validation)',
      period: {
        start: this.config.startDate,
        end: this.config.endDate,
        days: Math.floor((this.config.endDate.getTime() - this.config.startDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
      metrics,
      trades: this.trades,
      equity_curve: this.equity_curve,
      summary: this.generateSummary(metrics),
    };
    
    console.log(`[Backtest] Completed: ${this.trades.length} trades, ${(metrics.win_rate * 100).toFixed(1)}% win rate`);
    
    return result;
  }

  /**
   * Fetch historical candle data from exchange
   */
  private async fetchHistoricalData(): Promise<any[]> {
    const candles: any[] = [];
    const oneHour = 60 * 60 * 1000;
    let currentTime = this.config.startDate.getTime();
    const endTime = this.config.endDate.getTime();
    
    // Fetch in batches (max 100 candles per request)
    while (currentTime < endTime) {
      const batchEnd = Math.min(currentTime + (100 * oneHour), endTime);
      
      try {
        const batchCandles = await okxService.getCandles(
          this.config.symbol,
          '1H',
          100
        );
        
        candles.push(...batchCandles);
        currentTime = batchEnd;
        
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`[Backtest] Error fetching candles:`, error);
        break;
      }
    }
    
    return candles.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate signal based on strategy type
   */
  private async generateSignalForStrategy(currentCandle: any, pastCandles: any[]): Promise<any> {
    // For now, use simplified pattern detection
    // In production, this would call actual strategy implementations
    
    if (this.config.strategy === 'A') {
      // Strategy A: No validation, more aggressive
      return this.generateStrategyASignal(currentCandle, pastCandles);
    } else {
      // Strategy B: With Phase 4 validation
      return this.generateStrategyBSignal(currentCandle, pastCandles);
    }
  }

  /**
   * Strategy A: Pre-Phase 4 (No Validation)
   */
  private generateStrategyASignal(currentCandle: any, pastCandles: any[]): any {
    // Simplified strategy A logic
    // Accepts more patterns, lower thresholds
    
    const rsi = this.calculateRSI(pastCandles, 14);
    const trend = this.determineTrend(pastCandles);
    
    // More aggressive entry conditions
    if (rsi < 35 && trend === 'downtrend') {
      return {
        signal_type: 'entry',
        direction: 'long',
        confidence: 60,
        entry_price: parseFloat(currentCandle.close),
        stop_loss: parseFloat(currentCandle.close) * 0.98, // 2%
        take_profit: [parseFloat(currentCandle.close) * 1.04], // 4%
        pattern_ids: ['rsi_oversold'],
        timestamp: new Date(currentCandle.timestamp * 1000),
      };
    }
    
    if (rsi > 65 && trend === 'uptrend') {
      return {
        signal_type: 'entry',
        direction: 'short',
        confidence: 60,
        entry_price: parseFloat(currentCandle.close),
        stop_loss: parseFloat(currentCandle.close) * 1.02, // 2%
        take_profit: [parseFloat(currentCandle.close) * 0.96], // 4%
        pattern_ids: ['rsi_overbought'],
        timestamp: new Date(currentCandle.timestamp * 1000),
      };
    }
    
    return null;
  }

  /**
   * Strategy B: Phase 4 (With Validation)
   */
  private generateStrategyBSignal(currentCandle: any, pastCandles: any[]): any {
    // Simplified strategy B logic
    // More selective, requires confluence
    
    const rsi = this.calculateRSI(pastCandles, 14);
    const trend = this.determineTrend(pastCandles);
    const volatility = this.calculateVolatility(pastCandles);
    
    // More selective entry conditions (requires confluence)
    if (rsi < 30 && trend === 'downtrend' && volatility > 0.02) {
      // Strong oversold + trend + volatility = better setup
      return {
        signal_type: 'entry',
        direction: 'long',
        confidence: 75,
        entry_price: parseFloat(currentCandle.close),
        stop_loss: parseFloat(currentCandle.close) * 0.97, // 3%
        take_profit: [
          parseFloat(currentCandle.close) * 1.06, // First target: 6%
          parseFloat(currentCandle.close) * 1.09, // Second target: 9%
        ],
        pattern_ids: ['validated_oversold', 'trend_confluence'],
        timestamp: new Date(currentCandle.timestamp * 1000),
      };
    }
    
    if (rsi > 70 && trend === 'uptrend' && volatility > 0.02) {
      return {
        signal_type: 'entry',
        direction: 'short',
        confidence: 75,
        entry_price: parseFloat(currentCandle.close),
        stop_loss: parseFloat(currentCandle.close) * 1.03, // 3%
        take_profit: [
          parseFloat(currentCandle.close) * 0.94, // First target: 6%
          parseFloat(currentCandle.close) * 0.91, // Second target: 9%
        ],
        pattern_ids: ['validated_overbought', 'trend_confluence'],
        timestamp: new Date(currentCandle.timestamp * 1000),
      };
    }
    
    return null;
  }

  /**
   * Execute trade with realistic slippage and fees
   */
  private async executeTrade(signal: any, entryCandle: any, futureCandles: any[]): Promise<Trade | null> {
    if (futureCandles.length < 2) return null;
    
    const direction = signal.direction;
    const entryPrice = signal.entry_price;
    const stopLoss = signal.stop_loss;
    const takeProfits = signal.take_profit;
    
    // Apply slippage to entry
    const slippageFactor = this.config.slippageBps / 10000;
    const actualEntryPrice = direction === 'long' 
      ? entryPrice * (1 + slippageFactor)
      : entryPrice * (1 - slippageFactor);
    
    // Calculate position size
    const positionSizeUsd = this.equity * this.config.positionSizePercent;
    
    // Simulate trade execution by scanning future candles
    let exitPrice = actualEntryPrice;
    let exitTimestamp = signal.timestamp;
    let exitReason: 'stop_loss' | 'take_profit' | 'time_exit' = 'time_exit';
    
    // Max holding time: 24 hours (24 candles for 1H timeframe)
    const maxCandles = Math.min(24, futureCandles.length);
    
    for (let i = 0; i < maxCandles; i++) {
      const candle = futureCandles[i];
      const high = parseFloat(candle.high);
      const low = parseFloat(candle.low);
      const close = parseFloat(candle.close);
      
      if (direction === 'long') {
        // Check stop loss
        if (low <= stopLoss) {
          exitPrice = stopLoss;
          exitReason = 'stop_loss';
          exitTimestamp = new Date(candle.timestamp * 1000);
          break;
        }
        
        // Check take profit (use first target for simplicity)
        if (high >= takeProfits[0]) {
          exitPrice = takeProfits[0];
          exitReason = 'take_profit';
          exitTimestamp = new Date(candle.timestamp * 1000);
          break;
        }
        
        // Update exit to current close (time exit)
        exitPrice = close;
        exitTimestamp = new Date(candle.timestamp * 1000);
      } else {
        // Short logic
        if (high >= stopLoss) {
          exitPrice = stopLoss;
          exitReason = 'stop_loss';
          exitTimestamp = new Date(candle.timestamp * 1000);
          break;
        }
        
        if (low <= takeProfits[0]) {
          exitPrice = takeProfits[0];
          exitReason = 'take_profit';
          exitTimestamp = new Date(candle.timestamp * 1000);
          break;
        }
        
        exitPrice = close;
        exitTimestamp = new Date(candle.timestamp * 1000);
      }
    }
    
    // Apply exit slippage
    const actualExitPrice = direction === 'long'
      ? exitPrice * (1 - slippageFactor)
      : exitPrice * (1 + slippageFactor);
    
    // Calculate P&L
    const pnlPercent = direction === 'long'
      ? (actualExitPrice - actualEntryPrice) / actualEntryPrice
      : (actualEntryPrice - actualExitPrice) / actualEntryPrice;
    
    const pnl = positionSizeUsd * pnlPercent;
    const fees = positionSizeUsd * this.config.feePercent * 2; // Entry + exit
    const slippage = positionSizeUsd * slippageFactor * 2;
    
    const netPnl = pnl - fees - slippage;
    
    const trade: Trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: signal.timestamp,
      direction,
      entry_price: actualEntryPrice,
      exit_price: actualExitPrice,
      exit_timestamp: exitTimestamp,
      stop_loss: stopLoss,
      take_profit: takeProfits,
      position_size_usd: positionSizeUsd,
      pnl: netPnl,
      pnl_percent: (netPnl / positionSizeUsd) * 100,
      fees,
      slippage,
      exit_reason: exitReason,
      signal_confidence: signal.confidence,
      pattern_ids: signal.pattern_ids || [],
    };
    
    return trade;
  }

  /**
   * Update equity after trade
   */
  private updateEquity(trade: Trade): void {
    this.equity += trade.pnl;
    
    if (this.equity > this.peak_equity) {
      this.peak_equity = this.equity;
    }
  }

  /**
   * Record equity point for curve
   */
  private recordEquityPoint(timestamp: Date): void {
    const drawdown = this.peak_equity - this.equity;
    const drawdownPercent = (drawdown / this.peak_equity) * 100;
    
    this.equity_curve.push({
      timestamp,
      equity: this.equity,
      drawdown,
      drawdown_percent: drawdownPercent,
    });
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(): BacktestMetrics {
    const winningTrades = this.trades.filter(t => t.pnl > 0);
    const losingTrades = this.trades.filter(t => t.pnl < 0);
    const breakevenTrades = this.trades.filter(t => t.pnl === 0);
    
    const totalTrades = this.trades.length;
    const winRate = totalTrades > 0 ? winningTrades.length / totalTrades : 0;
    
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
      : 0;
    
    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
      : 0;
    
    const avgWinPercent = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl_percent, 0) / winningTrades.length
      : 0;
    
    const avgLossPercent = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl_percent, 0) / losingTrades.length)
      : 0;
    
    const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    const totalReturn = this.equity - this.config.initialCapital;
    const totalReturnPercent = (totalReturn / this.config.initialCapital) * 100;
    
    const maxDrawdown = Math.max(...this.equity_curve.map(e => e.drawdown), 0);
    const maxDrawdownPercent = Math.max(...this.equity_curve.map(e => e.drawdown_percent), 0);
    
    // Calculate Sharpe ratio
    const returns = this.trades.map(t => t.pnl_percent / 100);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    
    // Calculate Sortino ratio (downside deviation only)
    const negativeReturns = returns.filter(r => r < 0);
    const downsideDev = negativeReturns.length > 0
      ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length)
      : stdDev;
    const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0;
    
    // Profit factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    // Calmar ratio
    const calmarRatio = maxDrawdownPercent > 0 ? totalReturnPercent / maxDrawdownPercent : 0;
    
    // Expectancy
    const expectancy = (winRate * avgWinPercent) - ((1 - winRate) * avgLossPercent);
    
    // Best/worst trades
    const bestTrade = this.trades.length > 0 ? Math.max(...this.trades.map(t => t.pnl)) : 0;
    const worstTrade = this.trades.length > 0 ? Math.min(...this.trades.map(t => t.pnl)) : 0;
    
    // Average trade duration
    const avgTradeDuration = this.trades.length > 0
      ? this.trades.reduce((sum, t) => sum + (t.exit_timestamp.getTime() - t.timestamp.getTime()), 0) / this.trades.length / (1000 * 60 * 60)
      : 0;
    
    // Total fees and slippage
    const totalFees = this.trades.reduce((sum, t) => sum + t.fees, 0);
    const totalSlippage = this.trades.reduce((sum, t) => sum + t.slippage, 0);
    
    return {
      total_trades: totalTrades,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      breakeven_trades: breakevenTrades.length,
      win_rate: winRate,
      avg_win: avgWin,
      avg_loss: avgLoss,
      avg_win_percent: avgWinPercent,
      avg_loss_percent: avgLossPercent,
      rr_ratio: rrRatio,
      total_return: totalReturn,
      total_return_percent: totalReturnPercent,
      max_drawdown: maxDrawdown,
      max_drawdown_percent: maxDrawdownPercent,
      sharpe_ratio: sharpeRatio,
      sortino_ratio: sortinoRatio,
      profit_factor: profitFactor,
      calmar_ratio: calmarRatio,
      expectancy,
      best_trade: bestTrade,
      worst_trade: worstTrade,
      avg_trade_duration_hours: avgTradeDuration,
      total_fees: totalFees,
      total_slippage: totalSlippage,
    };
  }

  /**
   * Generate summary text
   */
  private generateSummary(metrics: BacktestMetrics): string {
    const performance = metrics.total_return_percent > 0 ? 'Profitable' : 'Unprofitable';
    const quality = metrics.win_rate > 0.6 ? 'High quality' : metrics.win_rate > 0.5 ? 'Medium quality' : 'Low quality';
    
    return `${performance} strategy with ${quality} signals. Win rate: ${(metrics.win_rate * 100).toFixed(1)}%, RR: ${metrics.rr_ratio.toFixed(2)}:1, Drawdown: ${metrics.max_drawdown_percent.toFixed(1)}%`;
  }

  // === Technical Indicators ===

  private calculateRSI(candles: any[], period: number = 14): number {
    if (candles.length < period + 1) return 50;
    
    const closes = candles.map(c => parseFloat(c.close)).slice(-period - 1);
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return rsi;
  }

  private determineTrend(candles: any[]): 'uptrend' | 'downtrend' | 'sideways' {
    if (candles.length < 10) return 'sideways';
    
    const recent = candles.slice(-10);
    const closes = recent.map(c => parseFloat(c.close));
    
    const firstHalf = closes.slice(0, 5).reduce((sum, c) => sum + c, 0) / 5;
    const secondHalf = closes.slice(5).reduce((sum, c) => sum + c, 0) / 5;
    
    const change = (secondHalf - firstHalf) / firstHalf;
    
    if (change > 0.02) return 'uptrend';
    if (change < -0.02) return 'downtrend';
    return 'sideways';
  }

  private calculateVolatility(candles: any[]): number {
    if (candles.length < 20) return 0;
    
    const closes = candles.slice(-20).map(c => parseFloat(c.close));
    const returns = [];
    
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev;
  }
}

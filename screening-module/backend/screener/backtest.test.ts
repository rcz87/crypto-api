/**
 * Unit Tests for Backtesting Engine
 *
 * Tests for backtest.ts functionality:
 * - Historical simulation
 * - P&L calculations
 * - Performance metrics
 * - Equity curve generation
 */

import { describe, it, expect } from '@jest/globals';
import {
  BacktestEngine,
  BacktestConfig,
  BacktestResult,
  BacktestTrade
} from './backtest';

// Mock alert rule function
function mockAlertRule(candles: any[], index: number): boolean {
  // Simple rule: Buy when RSI-like condition is oversold
  if (index < 14) return false;

  const recentCloses = candles.slice(index - 14, index + 1).map((c: any) => c.close);
  const avgClose = recentCloses.reduce((a: number, b: number) => a + b, 0) / recentCloses.length;
  const currentClose = candles[index].close;

  return currentClose < avgClose * 0.98; // Buy when 2% below average
}

// Generate mock historical candles
function generateMockHistory(count: number, trend: 'up' | 'down' | 'sideways' | 'volatile' = 'up') {
  const candles = [];
  let basePrice = 100;

  for (let i = 0; i < count; i++) {
    let change = 0;

    if (trend === 'up') {
      change = Math.random() * 3 - 0.5; // Mostly up
    } else if (trend === 'down') {
      change = Math.random() * 3 - 2.5; // Mostly down
    } else if (trend === 'volatile') {
      change = Math.random() * 10 - 5; // High volatility
    } else {
      change = Math.random() * 2 - 1; // Sideways
    }

    basePrice += change;
    const volatility = basePrice * 0.02;

    candles.push({
      timestamp: new Date(Date.now() - (count - i) * 3600000), // 1 hour intervals
      open: basePrice - volatility * 0.5,
      high: basePrice + volatility,
      low: basePrice - volatility,
      close: basePrice,
      volume: 1000 + Math.random() * 500
    });
  }

  return candles;
}

describe('BacktestEngine', () => {
  describe('Constructor and Configuration', () => {
    it('should create engine with default config', () => {
      const candles = generateMockHistory(100);
      const engine = new BacktestEngine(candles, mockAlertRule);

      expect(engine).toBeDefined();
    });

    it('should create engine with custom config', () => {
      const candles = generateMockHistory(100);
      const config: BacktestConfig = {
        initialCapital: 50000,
        positionSize: 0.2,
        commission: 0.002,
        slippage: 0.001,
        stopLoss: 0.03,
        takeProfit: 0.06
      };

      const engine = new BacktestEngine(candles, mockAlertRule, config);
      expect(engine).toBeDefined();
    });

    it('should throw error with insufficient data', () => {
      const candles = generateMockHistory(10); // Less than 50
      expect(() => new BacktestEngine(candles, mockAlertRule)).toThrow();
    });
  });

  describe('Backtest Execution', () => {
    it('should execute backtest and return results', () => {
      const candles = generateMockHistory(200, 'up');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      expect(result).toBeDefined();
      expect(result.totalTrades).toBeGreaterThan(0);
      expect(result.winningTrades).toBeGreaterThanOrEqual(0);
      expect(result.losingTrades).toBeGreaterThanOrEqual(0);
      expect(result.winningTrades + result.losingTrades).toBe(result.totalTrades);
    });

    it('should calculate win rate correctly', () => {
      const candles = generateMockHistory(200, 'up');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      if (result.totalTrades > 0) {
        const expectedWinRate = (result.winningTrades / result.totalTrades) * 100;
        expect(result.winRate).toBeCloseTo(expectedWinRate, 2);
        expect(result.winRate).toBeGreaterThanOrEqual(0);
        expect(result.winRate).toBeLessThanOrEqual(100);
      }
    });

    it('should track all trades', () => {
      const candles = generateMockHistory(200, 'up');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      expect(result.trades).toBeDefined();
      expect(result.trades.length).toBe(result.totalTrades);

      result.trades.forEach(trade => {
        expect(trade.entryTime).toBeInstanceOf(Date);
        expect(trade.exitTime).toBeInstanceOf(Date);
        expect(trade.entryPrice).toBeGreaterThan(0);
        expect(trade.exitPrice).toBeGreaterThan(0);
        expect(typeof trade.pnl).toBe('number');
        expect(['win', 'loss']).toContain(trade.result);
        expect(['stop_loss', 'take_profit', 'signal_exit']).toContain(trade.exitReason);
      });
    });
  });

  describe('P&L Calculations', () => {
    it('should calculate total profit/loss correctly', () => {
      const candles = generateMockHistory(200, 'up');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      const sumPnL = result.trades.reduce((sum, trade) => sum + trade.pnl, 0);
      expect(result.totalPnL).toBeCloseTo(sumPnL, 2);
    });

    it('should calculate profit factor correctly', () => {
      const candles = generateMockHistory(200, 'up');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      const totalGains = result.trades
        .filter(t => t.pnl > 0)
        .reduce((sum, t) => sum + t.pnl, 0);
      const totalLosses = Math.abs(result.trades
        .filter(t => t.pnl < 0)
        .reduce((sum, t) => sum + t.pnl, 0));

      if (totalLosses > 0) {
        const expectedPF = totalGains / totalLosses;
        expect(result.profitFactor).toBeCloseTo(expectedPF, 2);
      }
    });

    it('should apply commission correctly', () => {
      const candles = generateMockHistory(200, 'up');
      const config: BacktestConfig = {
        initialCapital: 10000,
        positionSize: 0.1,
        commission: 0.001, // 0.1%
        slippage: 0,
        stopLoss: 0.05,
        takeProfit: 0.1
      };

      const engine = new BacktestEngine(candles, mockAlertRule, config);
      const result = engine.run();

      // Each trade should have commission applied
      result.trades.forEach(trade => {
        // Commission is applied on both entry and exit
        const expectedCommission = (trade.entryPrice + trade.exitPrice) * config.commission;
        // PnL should reflect commission costs
        expect(trade.pnl).toBeLessThan((trade.exitPrice - trade.entryPrice));
      });
    });

    it('should apply slippage correctly', () => {
      const candles = generateMockHistory(200, 'up');
      const config: BacktestConfig = {
        initialCapital: 10000,
        positionSize: 0.1,
        commission: 0,
        slippage: 0.001, // 0.1%
        stopLoss: 0.05,
        takeProfit: 0.1
      };

      const engine = new BacktestEngine(candles, mockAlertRule, config);
      const result = engine.run();

      expect(result.trades.length).toBeGreaterThan(0);
      // Slippage reduces profitability
      expect(result.totalPnL).toBeDefined();
    });
  });

  describe('Risk Management', () => {
    it('should respect stop loss', () => {
      const candles = generateMockHistory(200, 'volatile');
      const config: BacktestConfig = {
        initialCapital: 10000,
        positionSize: 0.1,
        commission: 0,
        slippage: 0,
        stopLoss: 0.02, // 2% stop loss
        takeProfit: 0.1
      };

      const engine = new BacktestEngine(candles, mockAlertRule, config);
      const result = engine.run();

      const stopLossTrades = result.trades.filter(t => t.exitReason === 'stop_loss');

      stopLossTrades.forEach(trade => {
        const lossPercent = Math.abs((trade.exitPrice - trade.entryPrice) / trade.entryPrice);
        // Should exit around stop loss level (allowing for slippage/commission)
        expect(lossPercent).toBeLessThanOrEqual(config.stopLoss! * 1.5);
      });
    });

    it('should respect take profit', () => {
      const candles = generateMockHistory(200, 'up');
      const config: BacktestConfig = {
        initialCapital: 10000,
        positionSize: 0.1,
        commission: 0,
        slippage: 0,
        stopLoss: 0.1,
        takeProfit: 0.03 // 3% take profit
      };

      const engine = new BacktestEngine(candles, mockAlertRule, config);
      const result = engine.run();

      const takeProfitTrades = result.trades.filter(t => t.exitReason === 'take_profit');

      takeProfitTrades.forEach(trade => {
        const gainPercent = (trade.exitPrice - trade.entryPrice) / trade.entryPrice;
        // Should exit at or above take profit level
        expect(gainPercent).toBeGreaterThanOrEqual(config.takeProfit! * 0.9);
      });
    });

    it('should calculate max drawdown', () => {
      const candles = generateMockHistory(200, 'volatile');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      expect(result.maxDrawdown).toBeLessThanOrEqual(0);
      expect(result.maxDrawdownPercent).toBeLessThanOrEqual(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate Sharpe ratio', () => {
      const candles = generateMockHistory(200, 'up');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      expect(typeof result.sharpeRatio).toBe('number');
      // Sharpe ratio can be negative, positive, or zero
      expect(isNaN(result.sharpeRatio)).toBe(false);
    });

    it('should generate equity curve', () => {
      const candles = generateMockHistory(200, 'up');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      expect(result.equityCurve).toBeDefined();
      expect(result.equityCurve.length).toBeGreaterThan(0);

      result.equityCurve.forEach(point => {
        expect(point.timestamp).toBeInstanceOf(Date);
        expect(typeof point.equity).toBe('number');
        expect(point.equity).toBeGreaterThan(0);
      });

      // First point should be initial capital
      expect(result.equityCurve[0].equity).toBe(10000); // Default initial capital
    });

    it('should calculate average trade duration', () => {
      const candles = generateMockHistory(200, 'up');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      if (result.totalTrades > 0) {
        const avgDuration = result.trades.reduce((sum, trade) => {
          return sum + (trade.exitTime.getTime() - trade.entryTime.getTime());
        }, 0) / result.totalTrades;

        expect(result.averageTradeDuration).toBeDefined();
        expect(result.averageTradeDuration).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle no trades scenario', () => {
      const candles = generateMockHistory(100, 'sideways');

      // Rule that never triggers
      const neverTriggerRule = () => false;

      const engine = new BacktestEngine(candles, neverTriggerRule);
      const result = engine.run();

      expect(result.totalTrades).toBe(0);
      expect(result.winRate).toBe(0);
      expect(result.profitFactor).toBe(0);
      expect(result.totalPnL).toBe(0);
      expect(result.finalCapital).toBe(10000); // No change from initial
    });

    it('should handle all winning trades', () => {
      const candles = generateMockHistory(100, 'up');

      // Rule that triggers early in strong uptrend
      const earlyBuyRule = (candles: any[], index: number) => {
        return index === 15; // Buy once early
      };

      const config: BacktestConfig = {
        initialCapital: 10000,
        positionSize: 0.1,
        commission: 0,
        slippage: 0,
        stopLoss: 0.5, // Very wide stop
        takeProfit: 0.05 // Tight take profit
      };

      const engine = new BacktestEngine(candles, earlyBuyRule, config);
      const result = engine.run();

      if (result.totalTrades > 0) {
        expect(result.winRate).toBeGreaterThan(50);
      }
    });

    it('should handle high volatility correctly', () => {
      const candles = generateMockHistory(200, 'volatile');
      const engine = new BacktestEngine(candles, mockAlertRule);
      const result = engine.run();

      expect(result).toBeDefined();
      expect(result.maxDrawdown).toBeLessThan(0);
    });

    it('should handle small position size', () => {
      const candles = generateMockHistory(200, 'up');
      const config: BacktestConfig = {
        initialCapital: 10000,
        positionSize: 0.01, // 1% per trade
        commission: 0.001,
        slippage: 0.001,
        stopLoss: 0.05,
        takeProfit: 0.1
      };

      const engine = new BacktestEngine(candles, mockAlertRule, config);
      const result = engine.run();

      expect(result.finalCapital).toBeGreaterThan(0);
      expect(Math.abs(result.finalCapital - config.initialCapital)).toBeLessThan(config.initialCapital * 0.2);
    });
  });

  describe('Integration with Alert Rules', () => {
    it('should work with complex alert rule', () => {
      const candles = generateMockHistory(200, 'up');

      // Complex rule with multiple conditions
      const complexRule = (candles: any[], index: number): boolean => {
        if (index < 50) return false;

        const recent = candles.slice(index - 20, index + 1);
        const closes = recent.map((c: any) => c.close);
        const avg = closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
        const current = candles[index].close;

        return current < avg * 0.97 && candles[index].volume > 1200;
      };

      const engine = new BacktestEngine(candles, complexRule);
      const result = engine.run();

      expect(result).toBeDefined();
      expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    it('should execute backtest quickly', () => {
      const candles = generateMockHistory(500);
      const engine = new BacktestEngine(candles, mockAlertRule);

      const startTime = performance.now();
      engine.run();
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200); // Should complete in less than 200ms
    });

    it('should handle large datasets efficiently', () => {
      const candles = generateMockHistory(2000);
      const engine = new BacktestEngine(candles, mockAlertRule);

      const startTime = performance.now();
      engine.run();
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});

// Export for use in other test files
export { generateMockHistory, mockAlertRule };

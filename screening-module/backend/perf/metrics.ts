// Performance Metrics - Calculate trading statistics and risk metrics
// Professional performance analysis for institutional trading

import { logger } from '../screener/logger';

export type PerfPoint = { 
  ts: number; 
  pnl: number; 
  symbol?: string;
  side?: 'long' | 'short';
};

export type EquityPoint = { 
  ts: number; 
  equity: number; 
  drawdown?: number;
  peak?: number;
};

export type PerformanceMetrics = {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgTrade: number;
  expectancy: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentDrawdown: number;
  totalReturn: number;
  totalReturnPct: number;
  calmarRatio: number;
  recoveryFactor: number;
};

export function equityCurve(points: PerfPoint[], startEquity: number = 10000): EquityPoint[] {
  if (points.length === 0) return [{ ts: Date.now(), equity: startEquity }];
  
  let equity = startEquity;
  let peak = startEquity;
  const curve: EquityPoint[] = [];
  
  for (const point of points) {
    equity += point.pnl;
    peak = Math.max(peak, equity);
    const drawdown = peak - equity;
    
    curve.push({
      ts: point.ts,
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
      peak: Math.round(peak * 100) / 100
    });
  }
  
  return curve;
}

export function maxDrawdown(curve: EquityPoint[]): { absolute: number; percentage: number } {
  if (curve.length === 0) return { absolute: 0, percentage: 0 };
  
  let peak = -Infinity;
  let maxDD = 0;
  let maxDDPct = 0;
  
  for (const point of curve) {
    peak = Math.max(peak, point.equity);
    const dd = peak - point.equity;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    
    maxDD = Math.max(maxDD, dd);
    maxDDPct = Math.max(maxDDPct, ddPct);
  }
  
  return {
    absolute: Math.round(maxDD * 100) / 100,
    percentage: Math.round(maxDDPct * 100) / 100
  };
}

export function hitRate(points: PerfPoint[]): number {
  if (points.length === 0) return 0;
  
  const wins = points.filter(p => p.pnl > 0).length;
  return wins / points.length;
}

export function expectancy(points: PerfPoint[]): number {
  if (points.length === 0) return 0;
  
  const wins = points.filter(p => p.pnl > 0).map(p => p.pnl);
  const losses = points.filter(p => p.pnl <= 0).map(p => p.pnl);
  
  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  
  const winProb = wins.length / (wins.length + losses.length || 1);
  const lossProb = 1 - winProb;
  
  return winProb * avgWin + lossProb * avgLoss;
}

export function profitFactor(points: PerfPoint[]): number {
  if (points.length === 0) return 0;
  
  const totalWins = points.filter(p => p.pnl > 0).reduce((sum, p) => sum + p.pnl, 0);
  const totalLosses = Math.abs(points.filter(p => p.pnl <= 0).reduce((sum, p) => sum + p.pnl, 0));
  
  return totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
}

export function sharpeRatio(points: PerfPoint[], riskFreeRate: number = 0): number {
  if (points.length < 2) return 0;
  
  const returns = points.map(p => p.pnl);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  
  if (std === 0) return 0;
  
  // Annualize assuming daily returns (252 trading days)
  const annualizedReturn = mean * 252;
  const annualizedStd = std * Math.sqrt(252);
  
  return (annualizedReturn - riskFreeRate) / annualizedStd;
}

export function sortinoRatio(points: PerfPoint[], riskFreeRate: number = 0): number {
  if (points.length < 2) return 0;
  
  const returns = points.map(p => p.pnl);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  
  // Only consider negative returns for downside deviation
  const negativeReturns = returns.filter(r => r < 0);
  if (negativeReturns.length === 0) return mean > riskFreeRate ? Infinity : 0;
  
  const downsideVariance = negativeReturns.reduce((a, b) => a + b ** 2, 0) / negativeReturns.length;
  const downsideStd = Math.sqrt(downsideVariance);
  
  if (downsideStd === 0) return mean > riskFreeRate ? Infinity : 0;
  
  // Annualize
  const annualizedReturn = mean * 252;
  const annualizedDownsideStd = downsideStd * Math.sqrt(252);
  
  return (annualizedReturn - riskFreeRate) / annualizedDownsideStd;
}

export function calmarRatio(points: PerfPoint[], startEquity: number = 10000): number {
  if (points.length === 0) return 0;
  
  const curve = equityCurve(points, startEquity);
  const totalReturn = curve[curve.length - 1].equity - startEquity;
  const annualizedReturn = (totalReturn / startEquity) * (252 / points.length); // Approximate annualization
  
  const { percentage: maxDD } = maxDrawdown(curve);
  
  return maxDD > 0 ? (annualizedReturn * 100) / maxDD : annualizedReturn > 0 ? Infinity : 0;
}

export function calculateFullMetrics(points: PerfPoint[], startEquity: number = 10000): PerformanceMetrics {
  try {
    if (points.length === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        avgTrade: 0,
        expectancy: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        maxDrawdownPct: 0,
        currentDrawdown: 0,
        totalReturn: 0,
        totalReturnPct: 0,
        calmarRatio: 0,
        recoveryFactor: 0
      };
    }

    const curve = equityCurve(points, startEquity);
    const wins = points.filter(p => p.pnl > 0);
    const losses = points.filter(p => p.pnl <= 0);
    
    const totalReturn = curve[curve.length - 1].equity - startEquity;
    const totalReturnPct = (totalReturn / startEquity) * 100;
    
    const avgWin = wins.length > 0 ? wins.reduce((sum, p) => sum + p.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, p) => sum + p.pnl, 0) / losses.length : 0;
    const avgTrade = points.reduce((sum, p) => sum + p.pnl, 0) / points.length;
    
    const dd = maxDrawdown(curve);
    const currentDrawdown = curve[curve.length - 1].drawdown || 0;
    
    const recoveryFactor = dd.absolute > 0 ? Math.abs(totalReturn) / dd.absolute : totalReturn > 0 ? Infinity : 0;

    return {
      totalTrades: points.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: Math.round(hitRate(points) * 10000) / 100, // percentage with 2 decimals
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      avgTrade: Math.round(avgTrade * 100) / 100,
      expectancy: Math.round(expectancy(points) * 100) / 100,
      profitFactor: Math.round(profitFactor(points) * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio(points) * 100) / 100,
      sortinoRatio: Math.round(sortinoRatio(points) * 100) / 100,
      maxDrawdown: dd.absolute,
      maxDrawdownPct: dd.percentage,
      currentDrawdown: Math.round(currentDrawdown * 100) / 100,
      totalReturn: Math.round(totalReturn * 100) / 100,
      totalReturnPct: Math.round(totalReturnPct * 100) / 100,
      calmarRatio: Math.round(calmarRatio(points, startEquity) * 100) / 100,
      recoveryFactor: Math.round(recoveryFactor * 100) / 100
    };
  } catch (error) {
    logger.error('Failed to calculate performance metrics', { error, pointsCount: points.length });
    throw error;
  }
}

// Monthly/Weekly breakdown
export function getPerformanceByPeriod(
  points: PerfPoint[], 
  period: 'daily' | 'weekly' | 'monthly' = 'monthly'
): Array<{ period: string; pnl: number; trades: number; winRate: number }> {
  if (points.length === 0) return [];
  
  const periodMap = new Map<string, PerfPoint[]>();
  
  points.forEach(point => {
    const date = new Date(point.ts);
    let key: string;
    
    switch (period) {
      case 'daily':
        key = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        const week = getWeekNumber(date);
        key = `${date.getFullYear()}-W${week}`;
        break;
      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }
    
    if (!periodMap.has(key)) {
      periodMap.set(key, []);
    }
    periodMap.get(key)!.push(point);
  });
  
  return Array.from(periodMap.entries()).map(([period, periodPoints]) => ({
    period,
    pnl: Math.round(periodPoints.reduce((sum, p) => sum + p.pnl, 0) * 100) / 100,
    trades: periodPoints.length,
    winRate: Math.round(hitRate(periodPoints) * 10000) / 100
  })).sort((a, b) => a.period.localeCompare(b.period));
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
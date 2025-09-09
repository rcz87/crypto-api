// Professional Metrics Collection - Prometheus-compatible monitoring
// Institutional-grade observability for trading systems

import client from 'prom-client';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../screener/logger';

export const registry = new client.Registry();

// Collect default Node.js metrics
client.collectDefaultMetrics({ 
  register: registry, 
  prefix: 'screener_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5] // GC duration buckets
});

// HTTP Request Metrics
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status', 'service'] as const,
  registers: [registry]
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  labelNames: ['method', 'route', 'status', 'service'] as const,
  registers: [registry]
});

export const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP 5xx errors',
  labelNames: ['route', 'service', 'error_type'] as const,
  registers: [registry]
});

// Trading-specific Metrics
export const screeningRequestsTotal = new client.Counter({
  name: 'screening_requests_total',
  help: 'Total number of screening requests',
  labelNames: ['timeframe', 'symbols_count'] as const,
  registers: [registry]
});

export const signalsGenerated = new client.Counter({
  name: 'signals_generated_total',
  help: 'Total number of trading signals generated',
  labelNames: ['symbol', 'label', 'confidence_tier'] as const,
  registers: [registry]
});

export const backtestExecutions = new client.Counter({
  name: 'backtest_executions_total',
  help: 'Total number of backtest executions',
  labelNames: ['symbol', 'timeframe', 'success'] as const,
  registers: [registry]
});

export const databaseOperations = new client.Counter({
  name: 'database_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'table', 'success'] as const,
  registers: [registry]
});

export const databaseLatency = new client.Histogram({
  name: 'database_operation_duration_seconds',
  help: 'Database operation duration in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  labelNames: ['operation', 'table'] as const,
  registers: [registry]
});

// Performance Metrics
export const portfolioEquity = new client.Gauge({
  name: 'portfolio_equity_value',
  help: 'Current portfolio equity value',
  labelNames: ['currency'] as const,
  registers: [registry]
});

export const openPositions = new client.Gauge({
  name: 'open_positions_count',
  help: 'Number of currently open trading positions',
  labelNames: ['exchange'] as const,
  registers: [registry]
});

export const winRateGauge = new client.Gauge({
  name: 'strategy_win_rate',
  help: 'Current strategy win rate percentage',
  labelNames: ['strategy', 'timeframe'] as const,
  registers: [registry]
});

export const sharpeRatioGauge = new client.Gauge({
  name: 'strategy_sharpe_ratio',
  help: 'Current strategy Sharpe ratio',
  labelNames: ['strategy', 'timeframe'] as const,
  registers: [registry]
});

// Cache Metrics
export const cacheOperations = new client.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'hit_miss'] as const,
  registers: [registry]
});

export const cacheSize = new client.Gauge({
  name: 'cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['cache_type'] as const,
  registers: [registry]
});

// Middleware for HTTP metrics collection
export function metricsMiddleware(serviceName: string = 'screener') {
  return function(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();
    const method = req.method;
    const route = getRouteName(req);

    res.on('finish', () => {
      try {
        const status = String(res.statusCode);
        const durationNs = Number(process.hrtime.bigint() - start);
        const durationSeconds = durationNs / 1e9;
        
        // Record metrics
        httpRequestsTotal.inc({ method, route, status, service: serviceName });
        httpRequestDuration.observe({ method, route, status, service: serviceName }, durationSeconds);
        
        // Record errors
        if (res.statusCode >= 500) {
          const errorType = getErrorType(res.statusCode);
          httpErrorsTotal.inc({ route, service: serviceName, error_type: errorType });
          
          logger.error('HTTP 5xx error recorded', {
            method,
            route,
            status,
            duration: durationSeconds,
            service: serviceName
          });
        }
      } catch (error) {
        logger.error('Error in metrics middleware', { error: error.message });
      }
    });

    next();
  };
}

// Helper functions
function getRouteName(req: Request): string {
  if (req.route?.path) {
    return req.route.path;
  }
  
  // Extract meaningful route patterns
  const path = req.path;
  if (path.startsWith('/api/screener')) return '/api/screener/*';
  if (path.startsWith('/api/perf')) return '/api/perf/*';
  if (path === '/metrics') return '/metrics';
  if (path === '/health') return '/health';
  
  return path || 'unknown';
}

function getErrorType(statusCode: number): string {
  if (statusCode >= 500 && statusCode < 504) return 'server_error';
  if (statusCode === 504) return 'gateway_timeout';
  if (statusCode === 503) return 'service_unavailable';
  return 'unknown_error';
}

// Metrics handler for Prometheus scraping
export async function metricsHandler(_req: Request, res: Response) {
  try {
    res.set('Content-Type', registry.contentType);
    const metrics = await registry.metrics();
    res.send(metrics);
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).send('Error generating metrics');
  }
}

// Helper functions for trading metrics
export function recordScreeningRequest(timeframe: string, symbolsCount: number) {
  screeningRequestsTotal.inc({ 
    timeframe, 
    symbols_count: String(symbolsCount) 
  });
}

export function recordSignalGenerated(symbol: string, label: string, confidence: number) {
  const tier = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
  signalsGenerated.inc({ 
    symbol, 
    label: label.toLowerCase(), 
    confidence_tier: tier 
  });
}

export function recordBacktestExecution(symbol: string, timeframe: string, success: boolean) {
  backtestExecutions.inc({ 
    symbol, 
    timeframe, 
    success: String(success) 
  });
}

export function recordDatabaseOperation(operation: string, table: string, duration: number, success: boolean) {
  databaseOperations.inc({ 
    operation, 
    table, 
    success: String(success) 
  });
  
  if (success) {
    databaseLatency.observe({ operation, table }, duration);
  }
}

export function updatePortfolioMetrics(equity: number, openPositionsCount: number, winRate: number, sharpeRatio: number) {
  portfolioEquity.set({ currency: 'USDT' }, equity);
  openPositions.set({ exchange: 'aggregated' }, openPositionsCount);
  winRateGauge.set({ strategy: 'mtf_confluence', timeframe: 'multi' }, winRate);
  sharpeRatioGauge.set({ strategy: 'mtf_confluence', timeframe: 'multi' }, sharpeRatio);
}

export function recordCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', type: 'hit' | 'miss' = operation as any) {
  if (operation === 'hit' || operation === 'miss') {
    cacheOperations.inc({ operation: 'get', hit_miss: operation });
  } else {
    cacheOperations.inc({ operation, hit_miss: 'n/a' });
  }
}

// Initialize metrics collection
logger.info('Prometheus metrics collection initialized', {
  totalMetrics: registry.getMetricsAsArray().length
});
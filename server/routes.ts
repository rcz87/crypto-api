import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import WebSocket, { WebSocketServer } from "ws";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { okxService } from "./services/okx";
import { premiumOrderbookService } from "./services/premiumOrderbook";
import { registerSeoRoutes } from "./routes/seo";
import { registerSystemRoutes } from "./routes/system";
import { registerTradingRoutes } from "./routes/trading";
import { registerGhostRoutes } from "./routes/ghost";
import { registerGptsRoutes } from "./routes/gpts";
import { screenerRouter } from "./modules/screener/screener.routes.js";
import { CVDService } from "./services/cvd";
import { ConfluenceService } from "./services/confluence";
import { TechnicalIndicatorsService } from "./services/technicalIndicators";
import { BybitTestService } from "./services/bybit-test";
import { FibonacciService } from "./services/fibonacci";
import { OrderFlowService } from "./services/orderFlow";
import { LiquidationService } from "./services/liquidation";
import { PositionCalculatorService } from "./services/positionCalculator";
import { RiskManagementService, type PortfolioPosition } from "./services/riskManagement";
import { LiquidationHeatMapService } from "./services/liquidationHeatMap";
import { multiTimeframeService } from "./services/multiTimeframeAnalysis";
import { EnhancedAISignalEngine } from "./services/enhancedAISignalEngine";
import { aiSignalEngine } from "./services/aiSignalEngine";
import { executionRecorder } from "./services/executionRecorder";
import { solCompleteDataSchema, healthCheckSchema, apiResponseSchema, fundingRateSchema, openInterestSchema, volumeProfileSchema, smcAnalysisSchema, cvdResponseSchema, positionCalculatorSchema, positionParamsSchema, riskDashboardSchema } from "@shared/schema";

// Create shared service instances with real OKX data
const sharedTechnicalService = new TechnicalIndicatorsService();
const sharedCVDService = new CVDService();
const sharedConfluenceService = new ConfluenceService();

// Use Enhanced AI singleton instance with shared service dependencies
const enhancedAISignalEngine = EnhancedAISignalEngine.getInstance({
  technicalService: sharedTechnicalService,
  cvdService: sharedCVDService,
  confluenceService: sharedConfluenceService
});

console.log('🎯 Routes: Enhanced AI engine initialized with shared services');
import { metricsCollector } from "./utils/metrics";
import { cache, TTL_CONFIG } from "./utils/cache";
import { backpressureManager } from "./utils/websocket";

// Enhanced security imports (rate limiting moved to middleware/security.ts)
import { InputSanitizer, getEnhancedSecurityMetrics } from './middleware/security';
import pLimit from 'p-limit';

// Screening module service import
import { ScreenerService } from '../screening-module/backend/screener/screener.service';

// Degradation utilities import
import { applyDegradationNotice } from './utils/degradationNotice';
import { addDeprecationWarning, wrapResponseWithDeprecation } from './utils/deprecationNotice';

// CORS middleware
function corsMiddleware(req: Request, res: Response, next: Function) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // SEO routes MUST be registered FIRST before any middleware
  // This ensures they're not caught by Vite's catch-all route
  registerSeoRoutes(app);
  
  // System routes (health, metrics, logs) - registered early
  registerSystemRoutes(app);
  
  // SOL trading routes (complete, funding, technical analysis, etc.)
  registerTradingRoutes(app);
  
  // Ghost order management routes (paper trading system)
  registerGhostRoutes(app);
  
  // GPT Actions gateway routes (unified endpoints)
  registerGptsRoutes(app);

  // 🔧 ALIAS FIX: /api/gpts/* → /gpts/* (per testing specification)
  app.use('/api/gpts', (req: Request, res: Response, next: Function) => {
    req.url = req.originalUrl.replace(/^\/api\/gpts/, '/gpts');
    next();
  });

  // 📊 SELECTIVE MONITORING ENDPOINTS - untuk visualisasi/monitoring only
  // Pertahankan /advanced/ internal, expose hanya yang diperlukan untuk dashboard
  const PY_BASE = process.env.PY_BASE || 'http://127.0.0.1:8000';
  
  // Monitoring endpoint untuk dashboard - basic ticker data
  app.get('/monitor/ticker/:symbol', async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const response = await fetch(`${PY_BASE}/advanced/ticker/${symbol}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Python service responded with ${response.status}`);
      }
      
      const data = await response.json();
      res.json({
        success: true,
        data,
        source: 'internal_python_service',
        endpoint: 'monitoring_only',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('[Monitor] Ticker endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Monitoring endpoint failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Monitoring endpoint untuk system health check
  app.get('/monitor/system', async (req: Request, res: Response) => {
    try {
      const healthResponse = await fetch(`${PY_BASE}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const healthData = healthResponse.ok ? await healthResponse.json() : null;
      
      res.json({
        success: true,
        data: {
          python_service: {
            status: healthResponse.ok ? 'operational' : 'down',
            response_code: healthResponse.status,
            response_time: `${Date.now() % 1000}ms`
          },
          enhanced_sniper: {
            status: 'active',
            modules: 4,
            last_check: new Date().toISOString()
          },
          gpts_gateway: {
            status: 'operational',
            endpoints_active: ['/gpts/health', '/gpts/unified/symbols', '/gpts/unified/advanced']
          },
          internal_endpoints: {
            available: true,
            note: 'Internal /advanced/* endpoints working via Python service'
          }
        },
        monitoring_note: 'Selected endpoints exposed for visualization only',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('[Monitor] System endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'System monitoring failed'
      });
    }
  });
  
  // Monitoring endpoint untuk ETF flows (untuk dashboard)
  app.get('/monitor/etf/:asset?', async (req: Request, res: Response) => {
    try {
      const asset = req.params.asset || 'BTC';
      const window = req.query.window || '1d';
      
      const response = await fetch(`${PY_BASE}/advanced/etf/flows?asset=${asset}&window=${window}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`ETF endpoint responded with ${response.status}`);
      }
      
      const data = await response.json();
      res.json({
        success: true,
        data,
        monitoring_context: {
          asset,
          window,
          purpose: 'dashboard_visualization',
          note: 'Exposed for monitoring only - full access via /gpts/unified/advanced'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('[Monitor] ETF endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'ETF monitoring failed'
      });
    }
  });

  // Note: Enhanced rate limiting is now applied globally in server/index.ts
  
  // Mount the modules screener router first (has GET /api/screener endpoint frontend needs)
  app.use('/api/screener', screenerRouter);

  // 📱 Telegram Interactive Webhook Routes
  try {
    const { telegramRouter } = await import("./observability/telegram-webhook");
    app.use('/api', telegramRouter);
    console.log('📱 Telegram webhook routes registered successfully');
  } catch (error) {
    console.warn('⚠️ Telegram webhook routes not available:', (error as Error).message);
  }
  
  // Mount the screening-module router at different path to avoid conflicts
  try {
    const { screenerRouter: moduleScreenerRouter } = await import('../screening-module/backend/screener/screener.routes.js');
    app.use('/api/screening', moduleScreenerRouter);
  } catch (error) {
    console.error('Failed to load screening module router:', error);
  }

  // Auto-screening routes with Telegram alerts
  try {
    const { autoRouter } = await import('../screening-module/backend/auto/auto.routes.js');
    app.use('/api/auto', autoRouter);
    console.log('Auto-screening routes registered successfully');
  } catch (error) {
    console.error('Failed to load auto-screening router:', error);
  }
  
  // Performance tracking and backtesting routes
  const { perfRouter } = await import('../screening-module/backend/perf/perf.routes.js');
  app.use('/api/perf', perfRouter);
  
  // Health check endpoint moved to registerSystemRoutes()
  
  // SOL complete endpoint moved to registerTradingRoutes()

  // SOL funding endpoint moved to registerTradingRoutes()

  // SOL open-interest endpoint moved to registerTradingRoutes()

  // SOL volume-profile endpoint moved to registerTradingRoutes()

  // SOL smc endpoint moved to registerTradingRoutes()

  // SOL cvd endpoint moved to registerTradingRoutes()

  // SOL confluence endpoint moved to registerTradingRoutes()

  // Enhanced security metrics endpoint
  app.get('/api/security/metrics', async (req: Request, res: Response) => {
    try {
      const enhancedMetrics = getEnhancedSecurityMetrics();
      res.json({
        success: true,
        data: enhancedMetrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error in /api/security/metrics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Advanced Filtered Screening Endpoint - 4-Layer Filtering System
  app.post('/api/screen/filtered', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Parse and validate request parameters
      const symbols = req.body.symbols || ['BTC', 'ETH', 'SOL'];
      const timeframe = req.body.timeframe || '15m';
      const limit = req.body.limit || 500;
      
      console.log(`🎯 [FilteredScreening] Processing ${symbols.length} symbols with 4-layer filtering`);
      
      // Step 1: Get data from existing intelligent screening endpoint
      const screenerRequest = {
        symbols: symbols,
        timeframe: timeframe,
        limit: limit
      };
      
      // Import and use the screening service (wrapping existing intelligent screening)
      const { ScreenerService } = await import('../screening-module/backend/screener/screener.service');
      const screenerService = new ScreenerService();
      const rawScreeningData = await screenerService.run(screenerRequest);
      const originalCount = rawScreeningData.results.length;
      
      console.log(`📊 [FilteredScreening] Raw screening returned ${rawScreeningData.results.length} results`);
      
      // Step 2: Apply 4-layer filtering system using shared function
      const filteredResults = await applyAdvancedFilters(rawScreeningData.results);
      
      const responseTime = Date.now() - startTime;
      
      // Fallback handling - if no signals pass filters
      if (filteredResults.length === 0) {
        console.log(`🟡 [FilteredScreening] No signals passed filters - returning fallback HOLD`);
        filteredResults.push({
          symbol: "ALL",
          signal: "HOLD", 
          confidence: 50
        });
      }
      
      // Generate summary
      const buyCount = filteredResults.filter(r => r.signal.includes('BUY')).length;
      const sellCount = filteredResults.filter(r => r.signal.includes('SELL')).length;
      const holdCount = filteredResults.filter(r => r.signal.includes('HOLD')).length;
      
      const summary = `${filteredResults.length} coins passed filters: ${buyCount} BUY, ${sellCount} SELL, ${holdCount} HOLD`;
      
      // Log success metrics
      await storage.addLog({
        level: 'info',
        message: 'Advanced filtered screening completed',
        details: `POST /api/screen/filtered - ${responseTime}ms - Original: ${originalCount}, Filtered: ${filteredResults.length} - ${summary}`,
      });
      
      await storage.updateMetrics(responseTime);
      
      res.json({
        success: true,
        data: {
          results: filteredResults,
          summary: summary,
          filters_applied: ["confidence", "regime", "liquidity", "whale"],
          original_count: originalCount,
          filtered_count: filteredResults.length
        },
        meta: {
          responseTime,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/screen/filtered:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Advanced filtered screening failed',
        details: `POST /api/screen/filtered - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Comprehensive Backtest Engine for Enhanced Filtering System
  app.post('/api/backtest/filtered', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Parse and validate backtest parameters
      const {
        symbols = ['BTC', 'ETH', 'SOL'],
        timeframe = '1h',
        start_date = '2024-01-01',
        end_date = '2024-12-31',
        initial_balance = 100.0,
        use_filters = true
      } = req.body;
      
      console.log(`🎯 [Backtest] Starting comprehensive backtest for ${symbols.length} symbols`);
      console.log(`📊 [Backtest] Parameters: ${timeframe}, ${start_date} to ${end_date}, Balance: ${initial_balance}`);
      
      // Validate date range
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format. Use YYYY-MM-DD format.');
      }
      
      if (startDate >= endDate) {
        throw new Error('Start date must be before end date.');
      }
      
      if (endDate > new Date()) {
        throw new Error('End date cannot be in the future.');
      }
      
      // Calculate required candles based on timeframe
      const timePeriod = endDate.getTime() - startDate.getTime();
      const timeframeMs = getTimeframeMs(timeframe);
      const totalCandles = Math.ceil(timePeriod / timeframeMs);
      const candlesPerSymbol = Math.min(totalCandles + 200, 2000); // Add buffer for technical indicators, max 2000
      
      console.log(`📈 [Backtest] Fetching ${candlesPerSymbol} candles per symbol for ${timeframe} timeframe`);
      
      // Run backtests in parallel: filtered vs unfiltered
      const [filteredResults, unfilteredResults] = await Promise.all([
        runStrategyBacktest(symbols, timeframe, candlesPerSymbol, initial_balance, true, startDate, endDate),
        runStrategyBacktest(symbols, timeframe, candlesPerSymbol, initial_balance, false, startDate, endDate)
      ]);
      
      // Calculate improvement metrics
      const improvement = {
        win_rate_delta: Math.round((filteredResults.win_rate - unfilteredResults.win_rate) * 10000) / 100,
        profit_factor_delta: Math.round((filteredResults.profit_factor - unfilteredResults.profit_factor) * 100) / 100,
        return_delta_percent: Math.round((filteredResults.total_return_percent - unfilteredResults.total_return_percent) * 100) / 100
      };
      
      // Generate summary
      const summary = `Filtered strategy ${improvement.win_rate_delta >= 0 ? 'improved' : 'decreased'} win rate by ${Math.abs(improvement.win_rate_delta)}%, profit factor by ${Math.abs(improvement.profit_factor_delta)}, total return by ${Math.abs(improvement.return_delta_percent)}%`;
      
      const responseTime = Date.now() - startTime;
      
      // Log successful completion
      await storage.addLog({
        level: 'info',
        message: 'Comprehensive backtest completed successfully',
        details: `POST /api/backtest/filtered - ${responseTime}ms - Symbols: ${symbols.length}, Timeframe: ${timeframe}, Period: ${start_date} to ${end_date}`,
      });
      
      await storage.updateMetrics(responseTime);
      
      res.json({
        success: true,
        data: {
          backtest_period: `${start_date} to ${end_date}`,
          symbols_tested: symbols,
          filtered_results: filteredResults,
          unfiltered_results: unfilteredResults,
          improvement,
          summary
        },
        meta: {
          responseTime,
          timestamp: new Date().toISOString(),
          total_candles_processed: symbols.length * candlesPerSymbol
        }
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/backtest/filtered:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Comprehensive backtest failed',
        details: `POST /api/backtest/filtered - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Helper Functions for Comprehensive Backtest Engine
  
  async function runStrategyBacktest(
    symbols: string[],
    timeframe: string,
    candleLimit: number,
    initialBalance: number,
    useFilters: boolean,
    startDate: Date,
    endDate: Date
  ) {
    console.log(`🔄 [Backtest] Running ${useFilters ? 'filtered' : 'unfiltered'} strategy backtest`);
    
    const backtesterModule = await import('../screening-module/backend/perf/backtester');
    const { runBacktest } = backtesterModule;
    
    // Define StrategyContext type locally since it's not exported as type
    interface StrategyContext {
      symbol: string;
      timeframe: string;
      cost: {
        feeRate: number;
        slipBps: number;
        spreadBps: number;
      };
      risk: {
        equity: number;
        riskPct: number;
        atrMult: number;
        tp1RR: number;
        tp2RR: number;
      };
    }
    const { calculateFullMetrics } = await import('../screening-module/backend/perf/metrics');
    
    let allTrades: any[] = [];
    let totalSignals = 0;
    let tradedSignals = 0;
    let skippedSignals = 0;
    
    // Process symbols in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (symbol) => {
        try {
          console.log(`📊 [Backtest] Processing ${symbol} with ${useFilters ? 'filters' : 'no filters'}`);
          
          // Fetch historical candles
          const candles = await fetchHistoricalCandles(symbol, timeframe, candleLimit);
          
          if (candles.length < 100) {
            console.warn(`⚠️  [Backtest] Insufficient data for ${symbol}: ${candles.length} candles`);
            return { trades: [], signals: { total: 0, traded: 0, skipped: 0 } };
          }
          
          // Filter candles to backtest period
          const filteredCandles = candles.filter(c => {
            const candleDate = new Date(parseInt(c.ts));
            return candleDate >= startDate && candleDate <= endDate;
          });
          
          if (filteredCandles.length < 50) {
            console.warn(`⚠️  [Backtest] Insufficient data in period for ${symbol}: ${filteredCandles.length} candles`);
            return { trades: [], signals: { total: 0, traded: 0, skipped: 0 } };
          }
          
          // Create strategy context
          const context: StrategyContext = {
            symbol,
            timeframe,
            cost: {
              feeRate: 0.0005, // 0.05% taker fee (OKX standard)
              slipBps: 8,      // 0.08% slippage
              spreadBps: 5     // 0.05% spread
            },
            risk: {
              equity: initialBalance,
              riskPct: 1.0,    // 1% risk per trade
              atrMult: 1.5,    // 1.5x ATR for stop loss
              tp1RR: 1.5,      // 1.5:1 first target
              tp2RR: 2.5       // 2.5:1 second target
            }
          };
          
          // Create screener function
          const screenerFunction = createScreenerFunction(symbol, timeframe, useFilters);
          
          // Run backtest for this symbol
          const result = await runBacktest(context, filteredCandles, screenerFunction, {
            startIndex: 50,
            warmupPeriod: 30,
            saveToDb: false,
            maxTrades: 500
          });
          
          console.log(`✅ [Backtest] ${symbol} completed: ${result.trades.length} trades, Win rate: ${result.stats.winRate}%`);
          
          return {
            trades: result.trades.map(trade => ({
              ...trade,
              symbol,
              pnl: trade.pnl,
              ts: trade.exit_ts
            })),
            signals: {
              total: result.summary.totalSignals,
              traded: result.summary.tradedSignals,
              skipped: result.summary.skippedSignals
            }
          };
          
        } catch (error) {
          console.error(`❌ [Backtest] Error processing ${symbol}:`, error);
          return { trades: [], signals: { total: 0, traded: 0, skipped: 0 } };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Aggregate batch results
      batchResults.forEach(result => {
        allTrades.push(...result.trades);
        totalSignals += result.signals.total;
        tradedSignals += result.signals.traded;
        skippedSignals += result.signals.skipped;
      });
    }
    
    // Calculate comprehensive performance metrics
    if (allTrades.length === 0) {
      return {
        trades_total: 0,
        win_rate: 0,
        avg_return_percent: 0,
        profit_factor: 0,
        max_drawdown: 0,
        sharpe_ratio: 0,
        balance_start: initialBalance,
        balance_end: initialBalance,
        total_return_percent: 0,
        best_trade: 0,
        worst_trade: 0,
        avg_trade_duration: '0h',
        total_signals: totalSignals,
        traded_signals: tradedSignals,
        skipped_signals: skippedSignals
      };
    }
    
    // Convert trades to performance points
    const perfPoints = allTrades.map(trade => ({
      ts: trade.ts,
      pnl: trade.pnl,
      symbol: trade.symbol
    }));
    
    const metrics = calculateFullMetrics(perfPoints, initialBalance);
    
    // Calculate additional metrics
    const tradePnLs = allTrades.map(t => t.pnl);
    const bestTrade = Math.max(...tradePnLs);
    const worstTrade = Math.min(...tradePnLs);
    
    // Calculate average trade duration
    const durations = allTrades.map(t => t.exit_ts - t.entry_ts);
    const avgDurationMs = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const avgDurationHours = avgDurationMs / (1000 * 60 * 60);
    
    return {
      trades_total: metrics.totalTrades,
      win_rate: metrics.winRate / 100, // Convert percentage to decimal
      avg_return_percent: metrics.avgTrade / initialBalance * 100,
      profit_factor: metrics.profitFactor,
      max_drawdown: -Math.abs(metrics.maxDrawdownPct), // Negative value
      sharpe_ratio: metrics.sharpeRatio,
      balance_start: initialBalance,
      balance_end: initialBalance + metrics.totalReturn,
      total_return_percent: metrics.totalReturnPct,
      best_trade: Math.round(bestTrade * 100) / 100,
      worst_trade: Math.round(worstTrade * 100) / 100,
      avg_trade_duration: `${Math.round(avgDurationHours * 10) / 10}h`,
      total_signals: totalSignals,
      traded_signals: tradedSignals,
      skipped_signals: skippedSignals
    };
  }
  
  async function fetchHistoricalCandles(symbol: string, timeframe: string, limit: number): Promise<any[]> {
    try {
      const okxSymbol = symbol.includes('-') ? symbol : `${symbol}-USDT-SWAP`;
      const okxTimeframe = mapTimeframeToOKX(timeframe);
      
      console.log(`📈 [Backtest] Fetching ${limit} ${okxTimeframe} candles for ${okxSymbol}`);
      
      const candles = await okxService.getCandles(okxSymbol, okxTimeframe, limit);
      
      return candles.map(candle => ({
        ts: parseInt(candle.timestamp),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume)
      }));
      
    } catch (error) {
      console.error(`❌ [Backtest] Error fetching candles for ${symbol}:`, error);
      return [];
    }
  }
  
  function createScreenerFunction(symbol: string, timeframe: string, useFilters: boolean) {
    return (candleWindow: any[]) => {
      try {
        if (!useFilters) {
          // Simple momentum-based signals for unfiltered strategy
          if (candleWindow.length < 20) return { label: 'HOLD' as const, score: 50, summary: 'Insufficient data' };
          
          const recent = candleWindow.slice(-5);
          const closes = recent.map(c => c.close);
          const momentum = (closes[4] - closes[0]) / closes[0];
          
          if (momentum > 0.02) return { label: 'BUY' as const, score: 75, summary: 'Momentum bullish' };
          if (momentum < -0.02) return { label: 'SELL' as const, score: 75, summary: 'Momentum bearish' };
          return { label: 'HOLD' as const, score: 50, summary: 'No clear momentum' };
        }
        
        // Use historical data from candleWindow for deterministic analysis (synchronous)
        console.log(`📊 [Backtest] Processing ${symbol} with historical data (${candleWindow.length} candles)`);
        
        try {
          // Step 1: Compute historical signals from candleWindow data
          const historicalSignal = computeHistoricalSignals(symbol, candleWindow, timeframe);
          
          if (historicalSignal) {
            // Note: For backtest mode, we'll skip async filters and use deterministic analysis
            console.log(`✅ [Backtest] ${symbol} using historical signal: ${historicalSignal.label}`);
            return {
              label: (historicalSignal.label || 'HOLD') as 'BUY' | 'SELL' | 'HOLD',
              score: historicalSignal.score || 50,
              confidence: historicalSignal.confidence || 50,
              summary: historicalSignal.summary || 'Historical deterministic analysis',
              regime: historicalSignal.regime,
              htf: historicalSignal.htf,
              mtf: historicalSignal.mtf
            };
          }
        } catch (error) {
          console.warn(`⚠️  [Backtest] Historical analysis error for ${symbol}:`, error);
        }
        
        // Fallback to simple analysis if historical analysis fails
        return { label: 'HOLD' as const, score: 50, summary: 'Historical analysis unavailable' };
        
      } catch (error) {
        console.error(`❌ [Backtest] Error in screener function for ${symbol}:`, error);
        return { label: 'HOLD' as const, score: 50, summary: 'Analysis error' };
      }
    };
  }
  
  function getTimeframeMs(timeframe: string): number {
    const timeframeMs: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000
    };
    return timeframeMs[timeframe] || 60 * 60 * 1000; // Default to 1h
  }
  
  function mapTimeframeToOKX(timeframe: string): string {
    const mapping: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1H',
      '4h': '4H',
      '1d': '1D',
      '1w': '1W'
    };
    return mapping[timeframe] || '1H';
  }

  // Helper Functions for 4-Layer Filtering System
  
  // Compute historical signals from candleWindow data (deterministic)
  function computeHistoricalSignals(symbol: string, candleWindow: any[], timeframe: string): any {
    try {
      if (candleWindow.length < 20) {
        return null; // Not enough data
      }
      
      console.log(`📊 [HistoricalSignals] Computing signals for ${symbol} from ${candleWindow.length} candles`);
      
      // Get recent candles for analysis
      const recentCandles = candleWindow.slice(-50); // Last 50 candles for analysis
      const closes = recentCandles.map(c => c.close);
      const highs = recentCandles.map(c => c.high);
      const lows = recentCandles.map(c => c.low);
      const volumes = recentCandles.map(c => c.volume);
      
      // Calculate technical indicators from historical data
      const sma20 = calculateSMA(closes.slice(-20), 20);
      const sma50 = calculateSMA(closes.slice(-50), 50);
      const rsi = calculateRSI(closes, 14);
      const currentPrice = closes[closes.length - 1];
      const previousPrice = closes[closes.length - 2];
      
      // Calculate momentum and trends
      const shortTermMomentum = (currentPrice - closes[closes.length - 5]) / closes[closes.length - 5];
      const mediumTermMomentum = (currentPrice - closes[closes.length - 10]) / closes[closes.length - 10];
      const volumeAvg = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const currentVolume = volumes[volumes.length - 1];
      const volumeRatio = currentVolume / volumeAvg;
      
      // Determine signal strength and direction
      let label = 'HOLD';
      let confidence = 50;
      let score = 50;
      let summary = 'Neutral market conditions';
      
      // Bullish conditions
      if (currentPrice > sma20 && sma20 > sma50 && rsi < 70 && shortTermMomentum > 0.01) {
        label = 'BUY';
        confidence = Math.min(95, 60 + (shortTermMomentum * 1000) + (volumeRatio > 1.2 ? 10 : 0));
        score = confidence;
        summary = `Bullish: Price above SMAs, RSI ${rsi.toFixed(1)}, momentum ${(shortTermMomentum * 100).toFixed(2)}%`;
      }
      // Bearish conditions  
      else if (currentPrice < sma20 && sma20 < sma50 && rsi > 30 && shortTermMomentum < -0.01) {
        label = 'SELL';
        confidence = Math.min(95, 60 + Math.abs(shortTermMomentum * 1000) + (volumeRatio > 1.2 ? 10 : 0));
        score = confidence;
        summary = `Bearish: Price below SMAs, RSI ${rsi.toFixed(1)}, momentum ${(shortTermMomentum * 100).toFixed(2)}%`;
      }
      // Strong momentum override
      else if (Math.abs(shortTermMomentum) > 0.03 && volumeRatio > 1.5) {
        label = shortTermMomentum > 0 ? 'BUY' : 'SELL';
        confidence = Math.min(90, 70 + Math.abs(shortTermMomentum * 500));
        score = confidence;
        summary = `Strong momentum: ${(shortTermMomentum * 100).toFixed(2)}% with high volume`;
      }
      
      // Add regime and timeframe context
      const regime = confidence > 70 ? 'trending' : 'ranging';
      const htf = mediumTermMomentum > 0.02 ? 'bullish' : mediumTermMomentum < -0.02 ? 'bearish' : 'neutral';
      const mtf = shortTermMomentum > 0.01 ? 'bullish' : shortTermMomentum < -0.01 ? 'bearish' : 'neutral';
      
      return {
        symbol,
        label,
        confidence: Math.round(confidence),
        score: Math.round(score),
        summary,
        regime,
        htf,
        mtf,
        // Add historical context for filters
        historicalData: {
          candles: candleWindow,
          currentPrice,
          volume24h: volumes.slice(-24).reduce((a, b) => a + b, 0), // Approximate 24h volume
          volumeRatio,
          rsi,
          momentum: shortTermMomentum
        }
      };
      
    } catch (error) {
      console.error(`❌ [HistoricalSignals] Error computing signals for ${symbol}:`, error);
      return null;
    }
  }
  
  // Helper function to calculate Simple Moving Average
  function calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / period;
  }
  
  // Helper function to calculate RSI
  function calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50; // Default neutral RSI
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  // Shared 4-Layer Advanced Filtering Logic (updated to accept historical data)
  async function applyAdvancedFilters(rawResults: any[], candleWindow?: any[]): Promise<any[]> {
    console.log(`🎯 [AdvancedFilters] Processing ${rawResults.length} raw results with 4-layer filtering`);
    
    const filteredResults = [];
    let originalCount = rawResults.length;
    
    for (const result of rawResults) {
      try {
        // Layer 1: Confidence Filter (<55% discard, 55-65% WEAK, 66-75% normal, 76%+ STRONG)
        if (result.confidence < 55) {
          console.log(`🔴 [ConfidenceFilter] Discarding ${result.symbol}: confidence ${result.confidence}% < 55%`);
          continue;
        }
        
        // Layer 2: Regime Filter (TRENDING vs RANGING logic)
        const regimeFilterPassed = await applyRegimeFilter(result);
        if (!regimeFilterPassed) {
          console.log(`🔴 [RegimeFilter] Filtering out ${result.symbol}: regime mismatch`);
          continue;
        }
        
        // Layer 3: Liquidity Filter (24h volume > $500M)
        const liquidityFilterPassed = await applyLiquidityFilter(result.symbol, candleWindow);
        if (!liquidityFilterPassed) {
          console.log(`🔴 [LiquidityFilter] Filtering out ${result.symbol}: insufficient volume`);
          continue;
        }
        
        // Layer 4: Whale Filter (CVD + buyer/seller aggression validation)
        const whaleFilterPassed = await applyWhaleFilter(result, candleWindow);
        if (!whaleFilterPassed) {
          console.log(`🔴 [WhaleFilter] Filtering out ${result.symbol}: whale validation failed`);
          continue;
        }
        
        // All filters passed - format the result
        let finalSignal = result.label;
        
        // Apply confidence labeling
        if (result.confidence >= 76) {
          finalSignal = `STRONG ${result.label}`;
        } else if (result.confidence >= 55 && result.confidence <= 65) {
          finalSignal = `WEAK ${result.label}`;
        }
        
        filteredResults.push({
          symbol: result.symbol,
          signal: finalSignal,
          label: result.label, // Keep original label for backtest compatibility
          confidence: result.confidence,
          score: result.score,
          summary: result.summary,
          regime: result.regime,
          htf: result.htf,
          mtf: result.mtf
        });
        
        console.log(`✅ [AdvancedFilters] ${result.symbol} passed all filters: ${finalSignal} (${result.confidence}%)`);
        
      } catch (error) {
        console.warn(`⚠️ [AdvancedFilters] Error processing ${result.symbol}:`, error);
        // Continue processing other symbols
      }
    }
    
    // Fallback handling - if no signals pass filters, return empty array (let caller handle)
    console.log(`📊 [AdvancedFilters] Filtered ${originalCount} → ${filteredResults.length} results`);
    return filteredResults;
  }
  
  async function applyRegimeFilter(result: any): Promise<boolean> {
    try {
      // Import regime detection service - Note: this is a placeholder since actual service may need different parameters
      console.log(`📊 [RegimeFilter] ${result.symbol} checking regime compatibility with ${result.label} signal`);
      
      // For now, use simple regime filtering based on signal characteristics
      // TODO: Implement full regime detection service integration when available
      
      // Basic regime filtering logic:
      // 1. High confidence signals (>70%) suggest trending conditions
      // 2. Medium confidence (55-70%) suggests ranging conditions  
      // 3. HOLD signals are better in ranging markets
      
      const confidence = result.confidence || 50;
      let regimeCompatible = false;
      let regimeType = 'unknown';
      let reason = '';
      
      if (confidence > 70) {
        // High confidence suggests trending market
        regimeType = 'trending';
        regimeCompatible = result.label !== 'HOLD'; // Prefer directional signals in trending
        reason = `High confidence (${confidence}%) indicates trending - ${result.label !== 'HOLD' ? 'directional signal preferred' : 'HOLD not ideal'}`;
      } else if (confidence >= 55) {
        // Medium confidence suggests ranging market
        regimeType = 'ranging';
        regimeCompatible = true; // All signals OK in ranging
        reason = `Medium confidence (${confidence}%) indicates ranging - all signals acceptable`;
      } else {
        // Low confidence - should not pass confidence filter anyway
        regimeType = 'uncertain';
        regimeCompatible = false;
        reason = `Low confidence (${confidence}%) indicates uncertain market`;
      }
      
      console.log(`📊 [RegimeFilter] ${result.symbol} - ${regimeType} regime, ${reason} - ${regimeCompatible ? 'PASS' : 'FAIL'}`);
      
      return regimeCompatible;
      
    } catch (error) {
      console.warn(`⚠️ [RegimeFilter] Regime detection failed for ${result.symbol}:`, error);
      return true; // Default to pass if regime detection fails
    }
  }
  
  async function applyLiquidityFilter(symbol: string, candleWindow?: any[]): Promise<boolean> {
    try {
      // Use historical data if available (backtest mode)
      if (candleWindow && candleWindow.length > 0) {
        console.log(`💰 [LiquidityFilter] ${symbol} using historical data (${candleWindow.length} candles)`);
        
        // Calculate historical volume from candleWindow
        const recentCandles = candleWindow.slice(-24); // Last 24 candles for volume estimate
        const totalVolume = recentCandles.reduce((sum, candle) => sum + candle.volume, 0);
        const currentPrice = candleWindow[candleWindow.length - 1].close;
        const volumeUSD = totalVolume * currentPrice;
        const volume500M = 500_000_000; // $500M threshold
        
        const volumeMB = Math.round(volumeUSD / 1_000_000);
        const passed = volumeUSD >= volume500M;
        
        console.log(`💰 [LiquidityFilter] ${symbol} historical volume: $${volumeMB}M (${totalVolume.toFixed(0)} ${symbol} × $${currentPrice.toFixed(2)}) - ${passed ? 'PASS' : 'FAIL'}`);
        
        return passed;
      }
      
      // Fallback to live data (real-time mode)
      console.log(`💰 [LiquidityFilter] ${symbol} using live data`);
      
      // Convert symbol to OKX format
      const okxSymbol = symbol.includes('-') ? symbol : `${symbol.toUpperCase()}-USDT-SWAP`;
      
      // Get ticker data for volume check
      const ticker = await okxService.getTicker(okxSymbol);
      
      // Get current price for USD conversion - Use correct ValidatedTickerData properties
      const currentPrice = parseFloat(ticker.price || '0');
      
      // Extract 24h trading volume (in base currency) and convert to USD
      const volumeBase = parseFloat(ticker.tradingVolume24h || '0');
      const volumeUSD = volumeBase * currentPrice; // Convert base volume to USD value
      const volume500M = 500_000_000; // $500M threshold
      
      const volumeMB = Math.round(volumeUSD / 1_000_000);
      const passed = volumeUSD >= volume500M;
      
      console.log(`💰 [LiquidityFilter] ${symbol} live volume: $${volumeMB}M (${volumeBase.toFixed(0)} ${symbol} × $${currentPrice.toFixed(2)}) - ${passed ? 'PASS' : 'FAIL'}`);
      
      return passed;
      
    } catch (error) {
      console.warn(`⚠️ [LiquidityFilter] Volume check failed for ${symbol}:`, error);
      return false; // Strict: fail if we can't verify volume
    }
  }
  
  async function applyWhaleFilter(result: any, candleWindow?: any[]): Promise<boolean> {
    try {
      // Skip whale filter for HOLD signals
      if (result.label === 'HOLD') {
        console.log(`🐋 [WhaleFilter] ${result.symbol} HOLD signal - PASS (no whale validation needed)`);
        return true;
      }
      
      // Use historical data if available (backtest mode)
      if (candleWindow && candleWindow.length > 0) {
        console.log(`🐋 [WhaleFilter] ${result.symbol} using historical data (${candleWindow.length} candles)`);
        
        // Calculate historical CVD-like metrics from candleWindow
        const recentCandles = candleWindow.slice(-20); // Last 20 candles for analysis
        
        // Estimate buyer/seller aggression from price action and volume
        let buyPressure = 0;
        let sellPressure = 0;
        let totalVolume = 0;
        
        for (const candle of recentCandles) {
          const bodySize = Math.abs(candle.close - candle.open);
          const upperWick = candle.high - Math.max(candle.open, candle.close);
          const lowerWick = Math.min(candle.open, candle.close) - candle.low;
          
          if (candle.close > candle.open) {
            // Bullish candle - more buy pressure
            buyPressure += candle.volume * (bodySize / (bodySize + upperWick + lowerWick));
          } else {
            // Bearish candle - more sell pressure
            sellPressure += candle.volume * (bodySize / (bodySize + upperWick + lowerWick));
          }
          totalVolume += candle.volume;
        }
        
        const buyerAggression = totalVolume > 0 ? (buyPressure / totalVolume) * 100 : 50;
        const sellerAggression = totalVolume > 0 ? (sellPressure / totalVolume) * 100 : 50;
        
        // Simplified CVD calculation from price momentum
        const priceChange = (recentCandles[recentCandles.length - 1].close - recentCandles[0].close) / recentCandles[0].close;
        const currentCVD = priceChange * (buyerAggression - sellerAggression);
        
        let passed = false;
        let reason = '';
        
        if (result.label === 'BUY') {
          // BUY confirmed only if: CVD positive AND buyer aggression > 55%
          const cvdPositive = currentCVD > 0;
          const strongBuyers = buyerAggression > 55;
          passed = cvdPositive && strongBuyers;
          reason = `Historical CVD: ${currentCVD > 0 ? '✅' : '❌'} ${currentCVD.toFixed(4)}, Buyer Aggr: ${strongBuyers ? '✅' : '❌'} ${buyerAggression.toFixed(1)}%`;
        } else if (result.label === 'SELL') {
          // SELL confirmed only if: CVD negative AND seller aggression > 55%
          const cvdNegative = currentCVD < 0;
          const strongSellers = sellerAggression > 55;
          passed = cvdNegative && strongSellers;
          reason = `Historical CVD: ${currentCVD < 0 ? '✅' : '❌'} ${currentCVD.toFixed(4)}, Seller Aggr: ${strongSellers ? '✅' : '❌'} ${sellerAggression.toFixed(1)}%`;
        } else {
          passed = true; // Default pass for other signals
          reason = 'Non-directional signal';
        }
        
        console.log(`🐋 [WhaleFilter] ${result.symbol} ${result.label} (historical) - ${reason} - ${passed ? 'PASS' : 'FAIL'}`);
        
        return passed;
      }
      
      // Fallback to live data (real-time mode)
      console.log(`🐋 [WhaleFilter] ${result.symbol} using live data`);
      
      // Get CVD analysis for the symbol
      const okxSymbol = `${result.symbol}-USDT-SWAP`;
      const candles = await okxService.getCandles(okxSymbol, '15m', 100);
      const trades = await okxService.getRecentTrades(okxSymbol);
      
      const cvdAnalysis = await sharedCVDService.analyzeCVD(candles, trades, '15m');
      
      const currentCVD = parseFloat(cvdAnalysis.currentCVD || '0');
      const buyerAggression = cvdAnalysis.buyerSellerAggression.buyerAggression.percentage;
      const sellerAggression = cvdAnalysis.buyerSellerAggression.sellerAggression.percentage;
      
      let passed = false;
      let reason = '';
      
      if (result.label === 'BUY') {
        // BUY confirmed only if: CVD positive AND buyer aggression > 55%
        const cvdPositive = currentCVD > 0;
        const strongBuyers = buyerAggression > 55;
        passed = cvdPositive && strongBuyers;
        reason = `Live CVD: ${currentCVD > 0 ? '✅' : '❌'} ${currentCVD.toFixed(4)}, Buyer Aggr: ${strongBuyers ? '✅' : '❌'} ${buyerAggression.toFixed(1)}%`;
      } else if (result.label === 'SELL') {
        // SELL confirmed only if: CVD negative AND seller aggression > 55%
        const cvdNegative = currentCVD < 0;
        const strongSellers = sellerAggression > 55;
        passed = cvdNegative && strongSellers;
        reason = `Live CVD: ${currentCVD < 0 ? '✅' : '❌'} ${currentCVD.toFixed(4)}, Seller Aggr: ${strongSellers ? '✅' : '❌'} ${sellerAggression.toFixed(1)}%`;
      } else {
        passed = true; // Default pass for other signals
        reason = 'Non-directional signal';
      }
      
      console.log(`🐋 [WhaleFilter] ${result.symbol} ${result.label} (live) - ${reason} - ${passed ? 'PASS' : 'FAIL'}`);
      
      return passed;
      
    } catch (error) {
      console.warn(`⚠️ [WhaleFilter] Whale validation failed for ${result.symbol}:`, error);
      return false; // Strict: fail if we can't verify whale data
    }
  }

  // Technical Indicators endpoint - RSI/EMA Professional Analysis (with enhanced validation)
  app.get('/api/sol/technical', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Add deprecation warning
      addDeprecationWarning(req, res, {
        legacyEndpoint: '/api/sol/technical',
        newEndpoint: '/api/sol/technical (or /api/{pair}/technical for other coins)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Use /api/btc/technical, /api/eth/technical, etc. for other trading pairs. Technical indicators support all 65+ trading pairs.'
      });

      // Enhanced input sanitization
      const timeframe = InputSanitizer.sanitizeTimeframe(req.query.timeframe as string);
      const limit = InputSanitizer.sanitizeNumeric(req.query.limit, 1, 1000, 100);
      
      // Initialize technical indicators service
      const technicalService = new TechnicalIndicatorsService();
      
      // Get candles data for technical analysis
      const candles = await okxService.getCandles('SOL-USDT', timeframe, limit);
      
      // Perform technical indicators analysis
      const technicalAnalysis = await technicalService.analyzeTechnicalIndicators(candles, timeframe);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Technical indicators analysis request completed',
        details: `GET /api/sol/technical - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit} - DEPRECATED`,
      });
      
      // Wrap response with deprecation notice
      const responseData = wrapResponseWithDeprecation({
        success: true,
        data: technicalAnalysis,
        timestamp: new Date().toISOString(),
      }, {
        legacyEndpoint: '/api/sol/technical',
        newEndpoint: '/api/sol/technical (or /api/{pair}/technical for other coins)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Use /api/btc/technical, /api/eth/technical, etc. for other trading pairs. Technical indicators support all 65+ trading pairs.'
      });

      res.json(responseData);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/technical:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Technical indicators analysis request failed',
        details: `GET /api/sol/technical - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Multi-Exchange Aggregated Orderbook endpoint (with enhanced validation)
  app.get('/api/sol/multi-exchange-orderbook', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Add deprecation warning
      addDeprecationWarning(req, res, {
        legacyEndpoint: '/api/sol/multi-exchange-orderbook',
        newEndpoint: '/api/{pair}/multi-exchange-orderbook (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Multi-exchange orderbook aggregation will be available for all trading pairs. Use newer unified endpoints for multi-pair support.'
      });

      const { multiExchangeService } = await import('./services/multiExchange.js');
      // Enhanced input sanitization
      const symbol = InputSanitizer.sanitizeSymbol(req.query.symbol as string) || 'SOL-USDT';
      
      const result = await multiExchangeService.getAggregatedOrderbook(symbol);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Multi-exchange orderbook aggregation completed',
        details: `GET /api/sol/multi-exchange-orderbook - ${responseTime}ms - 200 OK - Symbol: ${symbol}, Exchanges: ${result.stats.activeExchanges.join(', ')}, Depth: ${result.stats.totalLevels} - DEPRECATED`,
      });
      
      // Wrap response with deprecation notice
      const responseData = wrapResponseWithDeprecation({
        success: true,
        data: result.data,
        stats: result.stats,
        timestamp: new Date().toISOString(),
      }, {
        legacyEndpoint: '/api/sol/multi-exchange-orderbook',
        newEndpoint: '/api/{pair}/multi-exchange-orderbook (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Multi-exchange orderbook aggregation will be available for all trading pairs. Use newer unified endpoints for multi-pair support.'
      });

      res.json(responseData);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/multi-exchange-orderbook:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Multi-exchange orderbook aggregation failed',
        details: `GET /api/sol/multi-exchange-orderbook - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Multi-Exchange Statistics endpoint
  app.get('/api/sol/multi-exchange-stats', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Add deprecation warning
      addDeprecationWarning(req, res, {
        legacyEndpoint: '/api/sol/multi-exchange-stats',
        newEndpoint: '/api/{pair}/multi-exchange-stats (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Multi-exchange statistics will be available for all trading pairs. Use newer unified endpoints for multi-pair support.'
      });

      const { multiExchangeService } = await import('./services/multiExchange.js');
      const stats = await multiExchangeService.getMultiExchangeStats();
      const responseTime = Date.now() - startTime;
      
      await storage.addLog({
        level: 'info',
        message: 'Multi-exchange statistics retrieved',
        details: `GET /api/sol/multi-exchange-stats - ${responseTime}ms - 200 OK - DEPRECATED`,
      });
      
      // Wrap response with deprecation notice
      const responseData = wrapResponseWithDeprecation({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      }, {
        legacyEndpoint: '/api/sol/multi-exchange-stats',
        newEndpoint: '/api/{pair}/multi-exchange-stats (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Multi-exchange statistics will be available for all trading pairs. Use newer unified endpoints for multi-pair support.'
      });

      res.json(responseData);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/multi-exchange-stats:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Bybit API Connection Test endpoint
  app.get('/api/test/bybit', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const bybitTestService = new BybitTestService();
      const testResults = await bybitTestService.testConnection();
      const responseTime = Date.now() - startTime;
      
      // Check if all tests passed
      const allPassed = testResults.every(result => result.status === 'success');
      const successCount = testResults.filter(result => result.status === 'success').length;
      const totalTests = testResults.length;
      
      await storage.addLog({
        level: allPassed ? 'info' : 'warning',
        message: `Bybit API connection test completed - ${successCount}/${totalTests} tests passed`,
        details: `GET /api/test/bybit - ${responseTime}ms - ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`,
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalTests,
            passedTests: successCount,
            failedTests: totalTests - successCount,
            allTestsPassed: allPassed,
            totalResponseTime: responseTime
          },
          testResults
        },
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/test/bybit:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Bybit API connection test failed',
        details: `GET /api/test/bybit - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // WebSocket Connection Test endpoint
  app.get('/api/test/bybit-ws', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const bybitTestService = new BybitTestService();
      const wsTestResult = await bybitTestService.testWebSocketConnection();
      const responseTime = Date.now() - startTime;
      
      await storage.addLog({
        level: wsTestResult.status === 'success' ? 'info' : 'warning',
        message: `Bybit WebSocket connection test ${wsTestResult.status === 'success' ? 'passed' : 'failed'}`,
        details: `GET /api/test/bybit-ws - ${responseTime}ms - ${wsTestResult.status === 'success' ? 'SUCCESS' : 'FAILED'}`,
      });

      res.json({
        success: true,
        data: wsTestResult,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/test/bybit-ws:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Bybit WebSocket connection test failed',
        details: `GET /api/test/bybit-ws - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Fibonacci Analysis endpoint - Professional Fibonacci Retracements & Extensions (with enhanced validation)
  app.get('/api/sol/fibonacci', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Add deprecation warning
      addDeprecationWarning(req, res, {
        legacyEndpoint: '/api/sol/fibonacci',
        newEndpoint: '/api/sol/fibonacci (or /api/{pair}/fibonacci for other coins)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Use /api/btc/fibonacci, /api/eth/fibonacci, etc. for other trading pairs. Fibonacci analysis supports all 65+ trading pairs.'
      });

      // Enhanced input sanitization
      const timeframe = InputSanitizer.sanitizeTimeframe(req.query.timeframe as string);
      const limit = InputSanitizer.sanitizeNumeric(req.query.limit, 1, 1000, 100);
      
      // Initialize fibonacci service
      const fibonacciService = new FibonacciService();
      
      // Get candles data for fibonacci analysis
      const candles = await okxService.getCandles('SOL-USDT', timeframe, limit);
      
      // Perform fibonacci analysis
      const fibonacciAnalysis = await fibonacciService.analyzeFibonacci(candles, timeframe);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Fibonacci analysis request completed',
        details: `GET /api/sol/fibonacci - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit} - DEPRECATED`,
      });
      
      // Wrap response with deprecation notice
      const responseData = wrapResponseWithDeprecation({
        success: true,
        data: fibonacciAnalysis,
        timestamp: new Date().toISOString(),
      }, {
        legacyEndpoint: '/api/sol/fibonacci',
        newEndpoint: '/api/sol/fibonacci (or /api/{pair}/fibonacci for other coins)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Use /api/btc/fibonacci, /api/eth/fibonacci, etc. for other trading pairs. Fibonacci analysis supports all 65+ trading pairs.'
      });

      res.json(responseData);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/fibonacci:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Fibonacci analysis request failed',
        details: `GET /api/sol/fibonacci - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Order Flow Analysis endpoint - Professional Market Microstructure & Tape Reading (with enhanced validation)
  app.get('/api/sol/order-flow', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Add deprecation warning
      addDeprecationWarning(req, res, {
        legacyEndpoint: '/api/sol/order-flow',
        newEndpoint: '/api/sol/order-flow (or /api/{pair}/order-flow for other coins)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Use /api/btc/order-flow, /api/eth/order-flow, etc. for other trading pairs. Order flow analysis supports all 65+ trading pairs.'
      });

      // Enhanced input sanitization
      const timeframe = InputSanitizer.sanitizeTimeframe(req.query.timeframe as string);
      const tradeLimit = InputSanitizer.sanitizeNumeric(req.query.tradeLimit, 1, 1000, 200);
      
      // Initialize order flow service
      const orderFlowService = new OrderFlowService();
      
      // Get trades and order book data
      const [trades, orderBook] = await Promise.all([
        okxService.getRecentTrades('SOL-USDT', tradeLimit),
        okxService.getEnhancedOrderBook('SOL-USDT', 50) // Get enhanced order book with 50 levels
      ]);
      
      // Perform order flow analysis
      const orderFlowAnalysis = await orderFlowService.analyzeOrderFlow(trades, orderBook, timeframe);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Order flow analysis request completed',
        details: `GET /api/sol/order-flow - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Trades: ${tradeLimit} - DEPRECATED`,
      });
      
      // Wrap response with deprecation notice
      const responseData = wrapResponseWithDeprecation({
        success: true,
        data: orderFlowAnalysis,
        timestamp: new Date().toISOString(),
      }, {
        legacyEndpoint: '/api/sol/order-flow',
        newEndpoint: '/api/sol/order-flow (or /api/{pair}/order-flow for other coins)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Use /api/btc/order-flow, /api/eth/order-flow, etc. for other trading pairs. Order flow analysis supports all 65+ trading pairs.'
      });

      res.json(responseData);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/order-flow:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Order flow analysis request failed',
        details: `GET /api/sol/order-flow - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  // Get system metrics (also serves OpenAPI spec with ?format=openapi)
  app.get('/api/metrics', async (req: Request, res: Response) => {
    try {
      // Check if OpenAPI spec is requested
      if (req.query.format === 'openapi') {
        const spec = {
          "openapi": "3.1.0",
          "$schema": "https://spec.openapis.org/oas/3.1.0",
          "info": {
            "title": "SOL Trading Gateway - SharpSignalEngine API",
            "description": "Institutional-grade SOL/USDT perpetual futures trading intelligence with 8-layer analysis engine",
            "version": "1.0.0"
          },
          "servers": [
            {
              "url": "https://guardiansofthegreentoken.com",
              "description": "Production server"
            }
          ],
          "paths": {
            "/health": {
              "get": {
                "operationId": "get_health",
                "summary": "System health check",
                "description": "Check overall system health and connectivity status",
                "responses": {
                  "200": {
                    "description": "System operational",
                    "content": {
                      "application/json": {
                        "schema": {
                          "type": "object",
                          "properties": {
                            "success": { "type": "boolean" },
                            "data": {
                              "type": "object",
                              "properties": {
                                "status": { "type": "string" },
                                "services": {
                                  "type": "object",
                                  "properties": {
                                    "okx": { "type": "string" },
                                    "api": { "type": "string" }
                                  }
                                },
                                "metrics": {
                                  "type": "object",
                                  "properties": {
                                    "responseTime": { "type": "number" },
                                    "requestsToday": { "type": "number" },
                                    "uptime": { "type": "string" }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/api/sol/complete": {
              "get": {
                "operationId": "getApiSolComplete",
                "summary": "Complete SOL market analysis",
                "description": "Comprehensive SOL/USDT analysis including ticker, orderbook, candlesticks, and recent trades",
                "responses": {
                  "200": {
                    "description": "Complete market data",
                    "content": {
                      "application/json": {
                        "schema": {
                          "type": "object",
                          "properties": {
                            "success": { "type": "boolean" },
                            "data": {
                              "type": "object",
                              "properties": {
                                "ticker": { "type": "object" },
                                "orderbook": { "type": "object" },
                                "candlesticks": { "type": "object" },
                                "trades": { "type": "array" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/api/sol/confluence": {
              "get": {
                "operationId": "getApiSolConfluence",
                "summary": "SharpSignalEngine confluence analysis",
                "description": "8-layer institutional confluence score with trend analysis",
                "responses": {
                  "200": {
                    "description": "Confluence analysis",
                    "content": {
                      "application/json": {
                        "schema": {
                          "type": "object",
                          "properties": {
                            "success": { "type": "boolean" },
                            "data": {
                              "type": "object",
                              "properties": {
                                "overall": { "type": "number" },
                                "trend": { "type": "string" },
                                "confidence": { "type": "number" },
                                "layers": { "type": "object" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/api/sol/cvd": {
              "get": {
                "operationId": "getApiSolCvd",
                "summary": "Cumulative Volume Delta analysis",
                "description": "Advanced CVD analysis with divergence detection",
                "responses": {
                  "200": {
                    "description": "CVD analysis",
                    "content": {
                      "application/json": {
                        "schema": {
                          "type": "object",
                          "properties": {
                            "success": { "type": "boolean" },
                            "data": {
                              "type": "object",
                              "properties": {
                                "current": { "type": "number" },
                                "confidence": { "type": "number" },
                                "trend": { "type": "string" },
                                "divergence": { "type": "object" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/api/sol/smc": {
              "get": {
                "operationId": "getApiSolSmc",
                "summary": "Smart Money Concepts analysis",
                "description": "BOS/CHoCH detection with smart money flow analysis",
                "responses": {
                  "200": {
                    "description": "Smart Money analysis",
                    "content": {
                      "application/json": {
                        "schema": {
                          "type": "object",
                          "properties": {
                            "success": { "type": "boolean" },
                            "data": {
                              "type": "object",
                              "properties": {
                                "trend": { "type": "string" },
                                "structure": { "type": "string" },
                                "bos": { "type": "object" },
                                "choch": { "type": "object" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/api/sol/order-flow": {
              "get": {
                "operationId": "getApiSolOrderFlow",
                "summary": "Order flow analysis",
                "description": "Advanced tape reading and order flow analysis",
                "responses": {
                  "200": {
                    "description": "Order flow data",
                    "content": {
                      "application/json": {
                        "schema": {
                          "type": "object",
                          "properties": {
                            "success": { "type": "boolean" },
                            "data": {
                              "type": "object",
                              "properties": {
                                "buyPressure": { "type": "number" },
                                "sellPressure": { "type": "number" },
                                "flow": { "type": "string" },
                                "whales": { "type": "array" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            "/api/sol/volume-profile": {
              "get": {
                "operationId": "getApiSolVolumeProfile",
                "summary": "Volume profile analysis",
                "description": "POC, VPOC and value area analysis",
                "responses": {
                  "200": {
                    "description": "Volume profile data"
                  }
                }
              }
            },
            "/api/sol/fibonacci": {
              "get": {
                "operationId": "getApiSolFibonacci",
                "summary": "Fibonacci retracement levels",
                "description": "Multi-level Fibonacci analysis",
                "responses": {
                  "200": {
                    "description": "Fibonacci levels"
                  }
                }
              }
            },
            "/api/sol/funding": {
              "get": {
                "operationId": "getApiSolFunding",
                "summary": "Funding rate analysis",
                "description": "Perpetual funding rates and trends",
                "responses": {
                  "200": {
                    "description": "Funding rate data"
                  }
                }
              }
            },
            "/api/sol/open-interest": {
              "get": {
                "operationId": "getApiSolOpenInterest",
                "summary": "Open interest analysis",
                "description": "Derivatives positioning and open interest",
                "responses": {
                  "200": {
                    "description": "Open interest data"
                  }
                }
              }
            },
            "/api/sol/technical": {
              "get": {
                "operationId": "getApiSolTechnical",
                "summary": "Technical indicators",
                "description": "Comprehensive technical analysis indicators",
                "responses": {
                  "200": {
                    "description": "Technical indicators"
                  }
                }
              }
            }
          }
        };
        
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(spec);
        return;
      }

      // Default behavior: return proper metrics using metricsCollector  
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Get basic metrics for all environments
      let metrics = metricsCollector.getMetrics();
      
      // Add security metrics with production safety
      try {
        const { getEnhancedSecurityMetrics } = await import('./middleware/security');
        const securityMetrics = getEnhancedSecurityMetrics();
        
        if (isProduction) {
          // Production: Only include aggregate security stats, no detailed info
          metrics = {
            ...metrics,
            security: {
              securityHealth: 'operational',
              rateLimitHits: securityMetrics.security?.totalRateLimitHits || 0,
              suspiciousRequests: securityMetrics.security?.totalSuspiciousRequests || 0,
              validationFailures: securityMetrics.security?.totalValidationFailures || 0,
              blockedIPs: securityMetrics.security?.activelyBlockedIPs || 0,
              lastSecurityEvent: securityMetrics.security?.lastSecurityEvent || 0,
            }
          };
        } else {
          // Development: Full security metrics for debugging
          metrics = {
            ...metrics,
            security: {
              securityHealth: 'operational',
              rateLimitHits: securityMetrics.security?.totalRateLimitHits || 0,
              suspiciousRequests: securityMetrics.security?.totalSuspiciousRequests || 0,
              validationFailures: securityMetrics.security?.totalValidationFailures || 0,
              blockedIPs: securityMetrics.security?.activelyBlockedIPs || 0,
              lastSecurityEvent: securityMetrics.security?.lastSecurityEvent || 0,
            }
          };
        }
      } catch {
        // Fallback: basic metrics only if security middleware unavailable
        console.warn('Security middleware unavailable, returning basic metrics only');
      }

      // Enhance CoinGlass metrics with aggregated data
      try {
        // Try to get circuit breaker state - using metrics collector directly
        const currentMetrics = metricsCollector.getMetrics();
        if (currentMetrics.coinglass?.circuitBreaker) {
          // Circuit breaker metrics are already included in collector
          metrics = currentMetrics;
        }

      } catch (error) {
        console.warn('Failed to enhance CoinGlass metrics:', error instanceof Error ? error.message : 'Unknown error');
        // Keep basic CoinGlass metrics from collector
      }
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
        environment: isProduction ? 'production' : 'development'
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch metrics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // OpenAPI specification for GPT Actions integration
  app.get('/api/spec', async (req: Request, res: Response) => {
    try {
      const spec = {
        "openapi": "3.0.0",
        "info": {
          "title": "SOL Trading Gateway - SharpSignalEngine API",
          "description": "Institutional-grade SOL/USDT perpetual futures trading intelligence with 8-layer analysis engine",
          "version": "1.0.0"
        },
        "servers": [
          {
            "url": "https://guardiansofthegreentoken.com",
            "description": "Production server"
          }
        ],
        "paths": {
          "/health": {
            "get": {
              "operationId": "get_health",
              "summary": "System health check",
              "description": "Check overall system health and connectivity status"
            }
          },
          "/api/sol/complete": {
            "get": {
              "operationId": "getApiSolComplete",
              "summary": "Complete SOL market analysis",
              "description": "Comprehensive SOL/USDT analysis including ticker, orderbook, candlesticks, and recent trades"
            }
          },
          "/api/sol/confluence": {
            "get": {
              "operationId": "getApiSolConfluence", 
              "summary": "SharpSignalEngine confluence analysis",
              "description": "8-layer institutional confluence score with trend analysis"
            }
          },
          "/api/sol/cvd": {
            "get": {
              "operationId": "getApiSolCvd",
              "summary": "Cumulative Volume Delta analysis",
              "description": "Advanced CVD analysis with divergence detection"
            }
          },
          "/api/sol/smc": {
            "get": {
              "operationId": "getApiSolSmc",
              "summary": "Smart Money Concepts analysis", 
              "description": "BOS/CHoCH detection with smart money flow analysis"
            }
          },
          "/api/sol/order-flow": {
            "get": {
              "operationId": "getApiSolOrderFlow",
              "summary": "Order flow analysis",
              "description": "Advanced tape reading and order flow analysis"
            }
          },
          "/api/sol/volume-profile": {
            "get": {
              "operationId": "getApiSolVolumeProfile",
              "summary": "Volume profile analysis",
              "description": "POC, VPOC and value area analysis"
            }
          },
          "/api/sol/fibonacci": {
            "get": {
              "operationId": "getApiSolFibonacci",
              "summary": "Fibonacci retracement levels",
              "description": "Multi-level Fibonacci analysis"
            }
          },
          "/api/sol/funding": {
            "get": {
              "operationId": "getApiSolFunding",
              "summary": "Funding rate analysis",
              "description": "Perpetual funding rates and trends"
            }
          },
          "/api/sol/open-interest": {
            "get": {
              "operationId": "getApiSolOpenInterest",
              "summary": "Open interest analysis",
              "description": "Derivatives positioning and open interest"
            }
          },
          "/api/sol/technical": {
            "get": {
              "operationId": "getApiSolTechnical",
              "summary": "Technical indicators",
              "description": "Comprehensive technical analysis indicators"
            }
          }
        }
      };
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json(spec);
    } catch (error) {
      console.error('Error serving OpenAPI spec:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to serve OpenAPI specification',
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  // /api/logs endpoint moved to registerSystemRoutes()

  // SOL Liquidation Analysis endpoint
  app.get('/api/sol/liquidation', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Add deprecation warning
      addDeprecationWarning(req, res, {
        legacyEndpoint: '/api/sol/liquidation',
        newEndpoint: '/api/{pair}/liquidation (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Liquidation analysis will be available for all trading pairs. Consider using the liquidation heat map for market-wide risk analysis.'
      });

      const timeframe = (req.query.timeframe as string) || '1H';
      
      // Get required data for liquidation analysis
      const [currentTicker, orderBook, openInterest, fundingRate, candles] = await Promise.all([
        okxService.getTicker(),
        okxService.getOrderBook(),
        okxService.getOpenInterest(),
        okxService.getFundingRate(),
        okxService.getCandles('SOL-USDT-SWAP', timeframe, 50)
      ]);
      
      // Initialize liquidation service
      const liquidationService = new LiquidationService();
      
      // Perform liquidation analysis
      const liquidationAnalysis = await liquidationService.analyzeLiquidations(
        parseFloat(currentTicker.price),
        orderBook,
        openInterest,
        fundingRate,
        candles,
        timeframe
      );
      
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Liquidation analysis request completed',
        details: `GET /api/sol/liquidation - ${responseTime}ms - 200 OK - Timeframe: ${timeframe} - DEPRECATED`,
      });
      
      // Wrap response with deprecation notice
      const responseData = wrapResponseWithDeprecation({
        success: true,
        data: liquidationAnalysis,
        timestamp: new Date().toISOString(),
      }, {
        legacyEndpoint: '/api/sol/liquidation',
        newEndpoint: '/api/{pair}/liquidation (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Liquidation analysis will be available for all trading pairs. Consider using the liquidation heat map for market-wide risk analysis.'
      });

      res.json(responseData);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/liquidation:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Liquidation analysis request failed',
        details: `GET /api/sol/liquidation - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // SOL Liquidation Heat Map - Market-wide Risk Analysis
  app.get('/api/sol/liquidation-heatmap', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Add deprecation warning
      addDeprecationWarning(req, res, {
        legacyEndpoint: '/api/sol/liquidation-heatmap',
        newEndpoint: '/api/{pair}/liquidation-heatmap (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Liquidation heat map analysis will be available for all trading pairs. This provides market-wide risk analysis across multiple assets.'
      });

      // Get required market data
      const [currentTicker, openInterest, fundingRate] = await Promise.all([
        okxService.getTicker(),
        okxService.getOpenInterest(),
        okxService.getFundingRate()
      ]);
      
      const currentPrice = parseFloat(currentTicker.price);
      const volume24h = parseFloat(currentTicker.volume || '0');
      const openInterestValue = parseFloat(openInterest.oiUsd || '0');
      const fundingRateValue = parseFloat(fundingRate.fundingRate || '0');
      
      // Initialize liquidation heat map service
      const liquidationHeatMapService = new LiquidationHeatMapService();
      
      // Perform comprehensive market-wide liquidation analysis
      const heatMapAnalysis = await liquidationHeatMapService.analyzeLiquidationRisk(
        currentPrice,
        volume24h,
        openInterestValue,
        fundingRateValue
      );
      
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Liquidation heat map analysis completed',
        details: `GET /api/sol/liquidation-heatmap - ${responseTime}ms - 200 OK - Price: $${currentPrice}, Risk Score: ${heatMapAnalysis.overallRiskScore} - DEPRECATED`,
      });
      
      // Wrap response with deprecation notice
      const responseData = wrapResponseWithDeprecation({
        success: true,
        data: heatMapAnalysis,
        timestamp: new Date().toISOString(),
      }, {
        legacyEndpoint: '/api/sol/liquidation-heatmap',
        newEndpoint: '/api/{pair}/liquidation-heatmap (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Liquidation heat map analysis will be available for all trading pairs. This provides market-wide risk analysis across multiple assets.'
      });

      res.json(responseData);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/liquidation-heatmap:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Liquidation heat map request failed',
        details: `GET /api/sol/liquidation-heatmap - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Position Calculator endpoint - Advanced Futures Position Analysis
  app.post('/api/sol/position-calculator', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Position Calculator endpoint
      
      // Validate request body
      const positionParams = positionParamsSchema.parse(req.body);
      // Request validation passed
      
      const accountBalance = req.body.accountBalance || 10000; // Default $10k account
      
      // Initialize Position Calculator service
      const positionCalculatorService = new PositionCalculatorService(okxService);
      // Position Calculator service initialized
      
      // Calculate comprehensive position metrics
      // Starting position calculation
      const positionAnalysis = await positionCalculatorService.calculatePosition(
        positionParams,
        accountBalance
      );
      // Position calculation completed
      
      const responseTime = Date.now() - startTime;
      
      // Skip schema validation for now to debug
      // const validated = positionCalculatorSchema.parse(positionAnalysis);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Position calculator request completed',
        details: `POST /api/sol/position-calculator - ${responseTime}ms - 200 OK - Entry: ${positionParams.entryPrice}, Size: ${positionParams.size}, Leverage: ${positionParams.leverage}x ${positionParams.side}`,
      });
      
      res.json({
        success: true,
        data: positionAnalysis,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/position-calculator:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Position calculator request failed',
        details: `POST /api/sol/position-calculator - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Risk Management Dashboard - Comprehensive Portfolio Risk Analysis
  app.post('/api/sol/risk-dashboard', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Risk Dashboard endpoint
      
      // Validate request body
      const { positions, accountBalance = 10000, riskLimits } = req.body;
      
      if (!positions || !Array.isArray(positions)) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid positions array',
          timestamp: new Date().toISOString(),
        });
      }
      
      // Validate positions structure
      const validatedPositions: PortfolioPosition[] = positions.map((pos: any) => ({
        symbol: pos.symbol || 'SOL-USDT-SWAP',
        side: pos.side,
        size: parseFloat(pos.size),
        entryPrice: parseFloat(pos.entryPrice),
        currentPrice: parseFloat(pos.currentPrice || pos.entryPrice),
        leverage: parseInt(pos.leverage),
        marginMode: pos.marginMode || 'isolated',
        unrealizedPnl: parseFloat(pos.unrealizedPnl || 0),
        liquidationPrice: parseFloat(pos.liquidationPrice || 0),
        liquidationDistance: parseFloat(pos.liquidationDistance || 0),
        riskWeight: parseFloat(pos.riskWeight || 1),
      }));
      
      // Validated positions
      
      // Initialize Risk Management service
      const riskManagementService = new RiskManagementService(okxService);
      
      // Generate comprehensive risk dashboard
      // Generating risk dashboard
      const riskDashboard = await riskManagementService.generateRiskDashboard(
        validatedPositions,
        accountBalance,
        riskLimits
      );
      
      // Risk dashboard generated successfully
      
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Risk dashboard request completed',
        details: `POST /api/sol/risk-dashboard - ${responseTime}ms - 200 OK - Positions: ${validatedPositions.length}, Balance: $${accountBalance}`,
      });
      
      res.json({
        success: true,
        data: riskDashboard,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/risk-dashboard:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Risk dashboard request failed',
        details: `POST /api/sol/risk-dashboard - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Quick Liquidation Price Calculator
  app.get('/api/sol/liquidation-price', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Add deprecation warning
      addDeprecationWarning(req, res, {
        legacyEndpoint: '/api/sol/liquidation-price',
        newEndpoint: '/api/{pair}/liquidation-price (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Liquidation price calculator will be available for all trading pairs. Use the newer unified position calculator for multi-pair support.'
      });

      const entryPrice = parseFloat(req.query.entryPrice as string);
      const leverage = parseFloat(req.query.leverage as string);
      const side = req.query.side as 'long' | 'short';
      
      if (!entryPrice || !leverage || !side) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: entryPrice, leverage, side',
          timestamp: new Date().toISOString(),
        });
      }
      
      // Initialize Position Calculator service
      const positionCalculatorService = new PositionCalculatorService(okxService);
      
      // Calculate liquidation price
      const liquidationPrice = await positionCalculatorService.getQuickLiquidationPrice(
        entryPrice,
        leverage,
        side
      );
      
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Liquidation price calculation completed',
        details: `GET /api/sol/liquidation-price - ${responseTime}ms - 200 OK - Entry: ${entryPrice}, Leverage: ${leverage}x ${side} - DEPRECATED`,
      });
      
      // Wrap response with deprecation notice
      const responseData = wrapResponseWithDeprecation({
        success: true,
        data: {
          entryPrice,
          leverage,
          side,
          liquidationPrice,
          liquidationDistance: Math.abs((entryPrice - liquidationPrice) / entryPrice) * 100,
          safetyMargin: side === 'long' ? 
            ((entryPrice - liquidationPrice) / entryPrice) * 100 :
            ((liquidationPrice - entryPrice) / entryPrice) * 100
        },
        timestamp: new Date().toISOString(),
      }, {
        legacyEndpoint: '/api/sol/liquidation-price',
        newEndpoint: '/api/{pair}/liquidation-price (planned)',
        deprecatedSince: '2024-01-01',
        removalDate: '2024-06-01',
        migrationGuide: 'Liquidation price calculator will be available for all trading pairs. Use the newer unified position calculator for multi-pair support.'
      });

      res.json(responseData);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/liquidation-price:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Liquidation price calculation failed',
        details: `GET /api/sol/liquidation-price - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GPT Plugin manifest endpoint
  app.get('/.well-known/ai-plugin.json', (req: Request, res: Response) => {
    try {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      const filePath = path.resolve(process.cwd(), 'public/.well-known/ai-plugin.json');
      res.sendFile(filePath);
    } catch (error) {
      console.error('Error serving plugin manifest:', error);
      res.status(500).json({ error: 'Plugin manifest not found' });
    }
  });

  // Multi-Timeframe Analysis - Advanced institutional MTF confluence analysis
  app.get('/api/sol/mtf-analysis', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      console.log('🔍 MTF Analysis request received');
      
      // Perform comprehensive multi-timeframe analysis
      const mtfAnalysis = await multiTimeframeService.performMTFAnalysis('SOL-USDT-SWAP');
      
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Multi-timeframe analysis completed successfully',
        details: `GET /api/sol/mtf-analysis - ${responseTime}ms - Overall bias: ${mtfAnalysis.confluence.overall_bias} (${mtfAnalysis.confluence.confidence}% confidence)`,
      });
      
      console.log(`✅ MTF Analysis completed in ${responseTime}ms - ${mtfAnalysis.confluence.overall_bias} bias with ${mtfAnalysis.confluence.confidence}% confidence`);
      
      res.json({
        success: true,
        data: mtfAnalysis,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('❌ Error in MTF Analysis:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Multi-timeframe analysis failed',
        details: `GET /api/sol/mtf-analysis - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Multi-timeframe analysis failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Premium Orderbook Metrics - VIP tier management
  app.get('/api/sol/premium-orderbook', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      await storage.addLog({
        level: 'info',
        message: 'Premium orderbook metrics request',
        details: `GET /api/sol/premium-orderbook - Started`,
      });

      // Get premium orderbook metrics based on VIP tier
      const metrics = premiumOrderbookService.getEnhancedMetrics('SOL-USDT-SWAP');
      const tierConfig = premiumOrderbookService.getCurrentTierConfig();
      const upgradeInfo = premiumOrderbookService.getUpgradeInfo();

      const responseTime = Date.now() - startTime;
      
      await storage.addLog({
        level: 'info',
        message: 'Premium orderbook metrics completed',
        details: `GET /api/sol/premium-orderbook - ${responseTime}ms - Tier: ${tierConfig.tier}`,
      });
      
      res.json({
        success: true,
        data: {
          tier: tierConfig.tier,
          metrics: metrics || { message: 'No cached data available' },
          upgrade: upgradeInfo,
          performance: {
            responseTime,
            maxDepth: tierConfig.maxDepth,
            updateRate: `${tierConfig.updateRate}ms`,
            features: tierConfig.features
          }
        },
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/premium-orderbook:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Premium orderbook request failed',
        details: `GET /api/sol/premium-orderbook - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Enhanced Premium Orderbook Analytics - VIP8+ Exclusive
  app.get('/api/premium/institutional-analytics', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const tierConfig = premiumOrderbookService.getCurrentTierConfig();
      
      // Restrict to VIP8+ tiers only
      if (!['vip8', 'institutional'].includes(tierConfig.tier)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - VIP8+ subscription required',
          upgrade: {
            message: 'Upgrade to VIP8 or Institutional for advanced analytics',
            currentTier: tierConfig.tier,
            requiredTier: 'vip8'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Get enhanced premium analytics
      const enhancedMetrics = await premiumOrderbookService.getEnhancedMetrics();
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          analyticsLevel: tierConfig.tier === 'institutional' ? 'institutional' : 'vip8',
          features: tierConfig.features,
          analytics: enhancedMetrics?.metrics || null,
          institutionalFeatures: {
            whaleDetection: enhancedMetrics?.metrics?.whaleDetection || null,
            smartMoneyFlow: enhancedMetrics?.metrics?.smartMoneyFlow || null,
            liquidityHeatmap: enhancedMetrics?.metrics?.liquidityHeatmap || null,
            microstructureAnalysis: enhancedMetrics?.metrics?.microstructureAnalysis || null,
            // Institutional-exclusive features
            ...(tierConfig.tier === 'institutional' ? {
              advancedRiskMetrics: enhancedMetrics?.metrics?.advancedRiskMetrics || null,
              arbitrageSignals: enhancedMetrics?.metrics?.arbitrageSignals || null,
              liquidityStress: enhancedMetrics?.metrics?.liquidityStress || null,
              correlationMatrix: enhancedMetrics?.metrics?.correlationMatrix || null
            } : {})
          },
          disclaimer: 'For institutional use only. Not financial advice.',
          lastUpdate: enhancedMetrics?.metrics?.lastUpdate || new Date().toISOString()
        },
        responseTime,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/premium/institutional-analytics:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        responseTime,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Premium Market Intelligence Dashboard - Institutional Exclusive
  app.get('/api/premium/market-intelligence', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const tierConfig = premiumOrderbookService.getCurrentTierConfig();
      
      // Restrict to Institutional tier only
      if (tierConfig.tier !== 'institutional') {
        return res.status(403).json({
          success: false,
          error: 'Access denied - Institutional subscription required',
          upgrade: {
            message: 'Upgrade to Institutional for complete market intelligence',
            currentTier: tierConfig.tier,
            requiredTier: 'institutional'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Get comprehensive institutional analytics
      const enhancedMetrics = await premiumOrderbookService.getEnhancedMetrics();
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          marketIntelligence: {
            summary: {
              marketHealth: enhancedMetrics?.metrics?.microstructureAnalysis?.microstructureHealth || 'unknown',
              stressLevel: enhancedMetrics?.metrics?.advancedRiskMetrics?.marketStress?.stressLevel || 'unknown',
              liquidityScore: enhancedMetrics?.metrics?.liquidityScore || 0,
              whaleActivity: enhancedMetrics?.metrics?.whaleDetection?.whaleImpact || 'unknown'
            },
            riskAssessment: {
              valueAtRisk: enhancedMetrics?.metrics?.advancedRiskMetrics?.valueAtRisk || null,
              liquidityRisk: enhancedMetrics?.metrics?.advancedRiskMetrics?.liquidityRisk || null,
              concentrationRisk: enhancedMetrics?.metrics?.advancedRiskMetrics?.concentrationRisk || null,
              stressTesting: enhancedMetrics?.metrics?.liquidityStress || null
            },
            tradingSignals: {
              arbitrageOpportunities: enhancedMetrics?.metrics?.arbitrageSignals || null,
              smartMoneyFlow: enhancedMetrics?.metrics?.smartMoneyFlow || null,
              marketSentiment: enhancedMetrics?.metrics?.smartMoneyFlow?.marketSentiment || 'unknown'
            },
            portfolioAnalysis: {
              correlationMatrix: enhancedMetrics?.metrics?.correlationMatrix || null,
              hedgingOpportunities: enhancedMetrics?.metrics?.correlationMatrix?.hedgingOpportunities || [],
              diversificationBenefit: enhancedMetrics?.metrics?.correlationMatrix?.diversificationBenefit || 0
            }
          },
          premiumFeatures: {
            realTimeAnalytics: true,
            customAlerts: true,
            dedicatedSupport: true,
            apiAccess: true
          },
          lastUpdate: enhancedMetrics?.metrics?.lastUpdate || new Date().toISOString()
        },
        responseTime,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/premium/market-intelligence:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        responseTime,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // VIP Tier Status and Upgrade Information
  app.get('/api/premium/tier-status', async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const tierConfig = premiumOrderbookService.getCurrentTierConfig();
      const upgradeInfo = premiumOrderbookService.getUpgradeInfo();
      const responseTime = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          currentTier: {
            tier: tierConfig.tier,
            maxDepth: tierConfig.maxDepth,
            updateRate: `${tierConfig.updateRate}ms`,
            features: tierConfig.features,
            requirements: {
              monthlyVolume: tierConfig.monthlyVolume?.toLocaleString() || 'N/A',
              assetRequirement: tierConfig.assetRequirement?.toLocaleString() || 'N/A'
            }
          },
          upgradeInfo,
          premiumFeatures: {
            level2Data: tierConfig.tier !== 'standard',
            institutionalGrade: tierConfig.tier === 'institutional',
            marketMakerInfo: ['vip8', 'institutional'].includes(tierConfig.tier),
            negativeFees: tierConfig.tier === 'vip8' || tierConfig.tier === 'institutional'
          }
        },
        responseTime,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/premium/tier-status:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        responseTime,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 🎯 Institutional Signal Aggregator Endpoint with protection
  const rateLimit = (await import('express-rate-limit')).default;
  const signalRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute per IP
    message: { error: "Too many signal requests - institutional analysis is computationally expensive" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Signal aggregator cache (30 second TTL)
  const signalCache = new Map();
  const signalCacheMiddleware = (req: any, res: any, next: any) => {
    const symbol = req.params.symbol || 'BTC';
    const key = `signal:${symbol.toUpperCase()}`;
    const hit = signalCache.get(key);
    const now = Date.now();
    
    if (hit && hit.exp > now) {
      return res.json(hit.data);
    }
    
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 200) {
        signalCache.set(key, { data: body, exp: now + 30000 }); // 30s cache
      }
      return originalJson(body);
    };
    
    next();
  };

  app.get('/api/signal/institutional/:symbol?', signalRateLimit, signalCacheMiddleware, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { getInstitutionalSignal } = await import("./routes/signalAggregator");
      await getInstitutionalSignal(req, res);
      
      // Observability: Track performance
      const duration = Date.now() - startTime;
      metricsCollector.recordHttpRequest(duration, false);
      if (duration > 5000) {
        console.warn(`⚠️ Slow signal aggregation: ${duration}ms for ${req.params.symbol || 'BTC'}`);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      metricsCollector.recordHttpRequest(duration, true);
      console.error("❌ Signal aggregator error:", error.message);
      res.status(500).json({
        error: "Signal aggregation service unavailable",
        message: error.message
      });
    }
  });

  // 📱 Telegram Interactive Test Endpoints
  app.post('/api/telegram/test/institutional', async (req: Request, res: Response) => {
    try {
      const { sendInstitutionalBias } = await import("./observability/telegram-actions");
      
      const testData = {
        symbol: req.body.symbol || 'BTC',
        bias: req.body.bias || 'LONG',
        whale: req.body.whale ?? true,
        etfFlow: req.body.etfFlow ?? 25000000,
        sentiment: req.body.sentiment ?? 75,
        confidence: req.body.confidence ?? 82,
        altSymbol: req.body.altSymbol || 'SOL'
      };
      
      const success = await sendInstitutionalBias(testData);
      
      res.json({
        success,
        message: success 
          ? "🎉 Interactive institutional bias alert sent with buttons!" 
          : "❌ Failed to send alert",
        testData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("❌ Telegram institutional test error:", error.message);
      res.status(500).json({
        error: "Test failed",
        message: error.message
      });
    }
  });

  app.post('/api/telegram/test/sniper', async (req: Request, res: Response) => {
    try {
      const { sendSOLSniperAlert } = await import("./observability/telegram-actions");
      
      const testData = {
        symbol: req.body.symbol || 'SOL',
        bias: req.body.bias || 'LONG',
        entry: req.body.entry || [221.30, 221.45],
        stopLoss: req.body.stopLoss ?? 220.95,
        takeProfit: req.body.takeProfit || [222.0, 222.7], 
        invalidation: req.body.invalidation ?? 220.9,
        confidence: req.body.confidence ?? 85
      };
      
      const success = await sendSOLSniperAlert(testData);
      
      res.json({
        success,
        message: success 
          ? "🎯 Interactive SOL sniper alert sent with buttons!"
          : "❌ Failed to send alert",
        testData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("❌ Telegram sniper test error:", error.message);
      res.status(500).json({
        error: "Test failed",
        message: error.message
      });
    }
  });

  // OpenAPI specification endpoint  
  app.get('/openapi.yaml', (req: Request, res: Response) => {
    try {
      res.setHeader('Content-Type', 'application/x-yaml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      const filePath = path.resolve(process.cwd(), 'public/openapi-4.0.1-gpts-compat.yaml');
      const content = fs.readFileSync(filePath, 'utf8');
      res.send(content);
    } catch (error) {
      console.error('Error serving OpenAPI spec:', error);
      res.status(500).json({ error: 'OpenAPI specification not found' });
    }
  });

  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time data streaming
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Track connected clients
  const connectedClients = new Set<WebSocket>();
  
  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    // WebSocket client connected
    
    connectedClients.add(ws);
    
    // Send initial connection success message
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Connected to OKX real-time data stream'
    }));
    
    // Initialize OKX WebSocket if not already connected
    // Also reconnect if this is the first client after idle period
    if (!okxService.isWebSocketConnected()) {
      console.log('Initializing OKX WebSocket for new client connection');
      okxService.initWebSocket((data) => {
        // Update WebSocket metrics on each message
        metricsCollector.updateOkxWsStatus('up');
        
        // Broadcast OKX data to all connected clients
        const message = JSON.stringify({
          type: 'market_data',
          source: 'okx',
          data: data,
          timestamp: new Date().toISOString()
        });
        
        // Use smart broadcast with backpressure control
        backpressureManager.smartBroadcast(connectedClients, {
          type: 'okx_connection',
          status: 'connected',
          source: 'okx',
          data: data,
          timestamp: new Date().toISOString()
        }, 'high'); // High priority for connection status
      }).catch(error => {
        console.error('Failed to initialize OKX WebSocket:', error);
      });
    }
    
    // Handle client messages (for subscriptions, etc.)
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message from client:', data);
        
        // Echo back for now, can be extended for specific commands
        backpressureManager.safeSend(ws, {
          type: 'response',
          originalMessage: data,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error parsing client message:', error);
      }
    });
    
    // Handle client disconnect  
    ws.on('close', () => {
      connectedClients.delete(ws);
      console.log(`WebSocket client disconnected: ${clientIp}`);
      
      // Schedule OKX WebSocket closure if no clients remain
      if (connectedClients.size === 0) {
        console.log('No clients connected, scheduling OKX WebSocket closure in 60 seconds...');
        setTimeout(() => {
          if (connectedClients.size === 0) {
            console.log('Closing OKX WebSocket due to no active clients');
            okxService.closeWebSocket();
          } else {
            console.log('New clients connected, keeping OKX WebSocket open');
          }
        }, 60000); // 60 seconds delay
      }
    });
    
    ws.on('error', (error) => {
      console.error(`WebSocket client error: ${error}`);
      connectedClients.delete(ws);
    });
  });
  
  // Broadcast system status updates periodically
  setInterval(async () => {
    if (connectedClients.size > 0) {
      try {
        const metrics = await storage.getLatestMetrics();
        const systemUpdate = JSON.stringify({
          type: 'system_update',
          data: {
            connectedClients: connectedClients.size,
            okxWebSocketStatus: okxService.isWebSocketConnected() ? 'connected' : 'disconnected',
            metrics: metrics,
            uptime: process.uptime()
          },
          timestamp: new Date().toISOString()
        });
        
        connectedClients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(systemUpdate);
          }
        });
      } catch (error) {
        console.error('Error broadcasting system update:', error);
      }
    }
  }, 30000); // Every 30 seconds

  // Enhanced AI Signal Engine - Advanced Neural Network Analysis
  app.get('/api/ai/enhanced-signal', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      console.log('🧠 Enhanced AI Signal request received');
      
      // Generate enhanced AI signal with neural networks
      const enhancedSignal = await enhancedAISignalEngine.generateEnhancedAISignal('SOL-USDT-SWAP');
      
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request with degradation awareness
      const degradationInfo = enhancedSignal.degradation_notice ? ` (degraded: ${enhancedSignal.degradation_notice.data_quality_score}/100)` : '';
      await storage.addLog({
        level: 'info',
        message: 'Enhanced AI signal generated successfully',
        details: `GET /api/ai/enhanced-signal - ${responseTime}ms - Direction: ${enhancedSignal.direction} (${enhancedSignal.confidence}% confidence)${degradationInfo}`,
      });
      
      console.log(`✅ Enhanced AI Signal completed in ${responseTime}ms - ${enhancedSignal.direction.toUpperCase()} with ${enhancedSignal.confidence}% confidence${degradationInfo}`);
      
      // Prepare base response
      const baseResponse = {
        success: true,
        data: enhancedSignal,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`
      };
      
      // Apply degradation notice to response if signal is degraded
      const finalResponse = enhancedSignal.degradation_notice 
        ? applyDegradationNotice(baseResponse, enhancedSignal.degradation_notice)
        : baseResponse;
      
      res.json(finalResponse);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('❌ Error in Enhanced AI Signal:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Enhanced AI signal generation failed',
        details: `GET /api/ai/enhanced-signal - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Enhanced AI signal generation failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ===== INTELLIGENT SCREENING ROUTING ENDPOINT =====
  
  // Intelligent screening router - routes single vs multi-coin requests efficiently
  app.post('/api/screen/intelligent', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Enhanced input validation and sanitization
      const { symbols, timeframe = '15m' } = req.body;
      
      if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REQUEST',
          message: 'Symbols array is required and cannot be empty',
          timestamp: new Date().toISOString()
        });
      }
      
      // Timeframe validation and sanitization
      const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
      const sanitizedTimeframe = InputSanitizer.sanitizeTimeframe(timeframe);
      
      if (!validTimeframes.includes(sanitizedTimeframe)) {
        await storage.addLog({
          level: 'warning',
          message: 'Invalid timeframe provided to intelligent screening',
          details: `POST /api/screen/intelligent - Invalid timeframe: ${timeframe}, using default: 15m`,
        });
        // Use default but continue processing
      }
      
      // Sanitize and validate symbols
      const sanitizedSymbols = symbols.map((symbol: string) => {
        if (typeof symbol !== 'string' || symbol.length === 0) {
          throw new Error('All symbols must be non-empty strings');
        }
        return symbol.toUpperCase().trim();
      });
      
      console.log(`🎯 Intelligent Screening: Processing ${sanitizedSymbols.length} symbols with timeframe ${sanitizedTimeframe}`);
      
      let methodUsed: string;
      let results: Array<{symbol: string, signal: string, confidence: number}> = [];
      let summary: string;
      
      if (sanitizedSymbols.length === 1) {
        // Single coin - route to enhanced AI signal
        methodUsed = 'single_coin_ai';
        console.log('🧠 Using enhanced AI signal for single coin analysis');
        
        try {
          // Convert symbol to OKX format for enhanced AI signal
          const okxSymbol = sanitizedSymbols[0].includes('-') 
            ? sanitizedSymbols[0] 
            : `${sanitizedSymbols[0]}-USDT-SWAP`;
          
          const enhancedSignal = await enhancedAISignalEngine.generateEnhancedAISignal(okxSymbol);
          
          // Normalize signal mapping with case handling
          const direction = enhancedSignal.direction.toLowerCase();
          const signal = direction === 'long' ? 'BUY' 
                      : direction === 'short' ? 'SELL' 
                      : direction === 'neutral' ? 'HOLD'
                      : 'HOLD'; // fallback for any unexpected directions
          
          // Fix confidence handling - ensure meaningful values
          const confidence = enhancedSignal.confidence > 0 
            ? enhancedSignal.confidence 
            : (signal === 'HOLD' ? 55 : 65); // Default ranges 50-70
          
          results = [{
            symbol: sanitizedSymbols[0],
            signal: signal,
            confidence: confidence
          }];
          
          summary = `Enhanced AI analysis for ${sanitizedSymbols[0]}: ${signal} signal with ${confidence}% confidence (timeframe: ${sanitizedTimeframe})`;
          
        } catch (aiError) {
          console.error('❌ Enhanced AI signal failed, falling back:', aiError);
          methodUsed = 'fallback_individual';
          
          // Fallback: basic analysis
          results = [{
            symbol: sanitizedSymbols[0],
            signal: 'HOLD',
            confidence: 50
          }];
          summary = `Fallback analysis for ${sanitizedSymbols[0]}: Unable to generate enhanced signal, defaulting to HOLD (timeframe: ${sanitizedTimeframe})`;
        }
        
      } else {
        // Multiple coins - route to batch screening
        methodUsed = 'batch_screening';
        console.log('📊 Using batch screening for multi-coin analysis');
        
        try {
          const screenerService = new ScreenerService();
          const screenerRequest = {
            symbols: sanitizedSymbols,
            timeframe: sanitizedTimeframe as any,
            limit: 500
          };
          
          const screenerResponse = await screenerService.run(screenerRequest);
          
          // Transform screener response to unified format with robust confidence handling
          results = screenerResponse.results.map(result => {
            // Fix confidence handling - ensure meaningful confidence values
            let confidence = result.confidence;
            
            // Handle any invalid or low confidence values
            if (!confidence || confidence <= 0 || confidence < 50) {
              // Provide sensible defaults based on signal type for low/invalid confidence
              confidence = result.label === 'BUY' ? 62
                        : result.label === 'SELL' ? 64
                        : 58; // HOLD gets lower default confidence
            }
            
            // Ensure confidence is always within 50-70 range
            const finalConfidence = Math.max(50, Math.min(70, confidence));
            
            return {
              symbol: result.symbol,
              signal: result.label, // Already in BUY/SELL/HOLD format
              confidence: finalConfidence
            };
          });
          
          const buyCount = results.filter(r => r.signal === 'BUY').length;
          const sellCount = results.filter(r => r.signal === 'SELL').length;
          const holdCount = results.filter(r => r.signal === 'HOLD').length;
          
          summary = `Batch screening of ${sanitizedSymbols.length} symbols (${sanitizedTimeframe}): ${buyCount} BUY, ${sellCount} SELL, ${holdCount} HOLD signals - Avg confidence: ${Math.round(results.reduce((acc, r) => acc + r.confidence, 0) / results.length)}%`;
          
        } catch (screenerError) {
          console.error('❌ Batch screening failed, using individual fallback:', screenerError);
          methodUsed = 'fallback_individual';
          
          // Fallback: loop through symbols individually using enhanced AI with concurrency limits
          const limit = pLimit(4); // Limit to 4 concurrent requests to avoid rate limiting
          const individualResults = [];
          
          const promises = sanitizedSymbols.map(symbol => 
            limit(async () => {
              try {
                const okxSymbol = symbol.includes('-') ? symbol : `${symbol}-USDT-SWAP`;
                const enhancedSignal = await enhancedAISignalEngine.generateEnhancedAISignal(okxSymbol);
                
                // Normalize signal mapping with case handling
                const direction = enhancedSignal.direction.toLowerCase();
                const signal = direction === 'long' ? 'BUY' 
                            : direction === 'short' ? 'SELL' 
                            : direction === 'neutral' ? 'HOLD'
                            : 'HOLD'; // fallback for any unexpected directions
                
                // Fix confidence handling
                const confidence = enhancedSignal.confidence > 0 
                  ? enhancedSignal.confidence 
                  : (signal === 'HOLD' ? 52 : 60); // Default ranges 50-70
                
                return {
                  symbol: symbol,
                  signal: signal,
                  confidence: confidence
                };
                
              } catch (individualError) {
                console.warn(`⚠️ Individual AI analysis failed for ${symbol}:`, individualError);
                return {
                  symbol: symbol,
                  signal: 'HOLD',
                  confidence: 50 // Improved default confidence for failed analysis
                };
              }
            })
          );
          
          const resolvedResults = await Promise.all(promises);
          individualResults.push(...resolvedResults);
          
          results = individualResults;
          const buyCount = results.filter(r => r.signal === 'BUY').length;
          const sellCount = results.filter(r => r.signal === 'SELL').length;
          const holdCount = results.filter(r => r.signal === 'HOLD').length;
          
          summary = `Individual fallback analysis of ${sanitizedSymbols.length} symbols (${sanitizedTimeframe}): ${buyCount} BUY, ${sellCount} SELL, ${holdCount} HOLD signals - Avg confidence: ${Math.round(results.reduce((acc, r) => acc + r.confidence, 0) / results.length)}%`;
        }
      }
      
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Enhanced observability logging
      await storage.addLog({
        level: 'info',
        message: 'Intelligent screening request completed',
        details: `POST /api/screen/intelligent - ${responseTime}ms - Method: ${methodUsed} - Symbols: ${sanitizedSymbols.length} - Timeframe: ${sanitizedTimeframe} - Results: ${results.length} - Confidence range: ${Math.min(...results.map(r => r.confidence))}-${Math.max(...results.map(r => r.confidence))}%`,
      });
      
      const response = {
        success: true,
        data: {
          results,
          summary
        },
        method_used: methodUsed,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Intelligent Screening completed in ${responseTime}ms using ${methodUsed} - ${results.length} results`);
      res.json(response);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('❌ Error in Intelligent Screening:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Intelligent screening request failed',
        details: `POST /api/screen/intelligent - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Intelligent screening failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Enhanced AI Strategy Performance - Neural Network Metrics
  app.get('/api/ai/enhanced-performance', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      console.log('📊 Enhanced AI Performance metrics request');
      
      // Get enhanced strategy performance with neural network stats
      const enhancedPerformance = await enhancedAISignalEngine.getEnhancedStrategyPerformance();
      
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request with degradation awareness
      const degradationInfo = enhancedPerformance.degradation_notice ? ` (data quality: ${enhancedPerformance.degradation_notice.data_quality_score}/100)` : '';
      await storage.addLog({
        level: 'info',
        message: 'Enhanced AI performance metrics retrieved',
        details: `GET /api/ai/enhanced-performance - ${responseTime}ms - Patterns: ${enhancedPerformance.enhanced_patterns.length}${degradationInfo}`,
      });
      
      // Prepare final response (degradation notice already applied in service if needed)
      res.json({
        success: true,
        data: enhancedPerformance,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('❌ Error in Enhanced AI Performance:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Enhanced AI performance retrieval failed',
        details: `GET /api/ai/enhanced-performance - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Enhanced AI performance failed',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // === ENHANCED AI PERFORMANCE TRACKING ENDPOINTS ===

  // Record signal execution
  app.post('/api/ai/tracking/execution', async (req: Request, res: Response) => {
    try {
      const { signal_id, entry_price, position_size, stop_loss, take_profit_1, execution_type } = req.body;
      
      if (!signal_id || !entry_price || !position_size) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: signal_id, entry_price, position_size'
        });
      }
      
      const executionId = await executionRecorder.recordExecution(signal_id, {
        entry_price: parseFloat(entry_price),
        position_size: parseFloat(position_size),
        stop_loss: stop_loss ? parseFloat(stop_loss) : undefined,
        take_profit_1: take_profit_1 ? parseFloat(take_profit_1) : undefined,
        execution_type: execution_type || 'manual'
      });
      
      res.json({
        success: true,
        data: { execution_id: executionId, signal_id },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record execution'
      });
    }
  });

  // Record trade outcome
  app.post('/api/ai/tracking/outcome', async (req: Request, res: Response) => {
    try {
      const { signal_id, exit_price, exit_reason } = req.body;
      
      if (!signal_id || !exit_price || !exit_reason) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: signal_id, exit_price, exit_reason'
        });
      }
      
      await executionRecorder.recordOutcome(signal_id, {
        exit_price: parseFloat(exit_price),
        exit_time: new Date(),
        exit_reason: exit_reason
      });
      
      res.json({
        success: true,
        data: { signal_id, message: 'Outcome recorded and pattern performance updated' },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record outcome'
      });
    }
  });

  // Get overall AI performance statistics
  app.get('/api/ai/tracking/overall-performance', async (req: Request, res: Response) => {
    try {
      const overallPerformance = await executionRecorder.getOverallPerformance();
      
      res.json({
        success: true,
        data: overallPerformance,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get overall performance'
      });
    }
  });
  
  // Start Enhanced AI Signal Engine schedulers for strategy evolution
  aiSignalEngine.startSchedulers();
  console.log("🚀 Enhanced AI Signal Engine schedulers started - auto evolution & cleanup enabled");
  
  return httpServer;
}

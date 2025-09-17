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
      const filePath = path.resolve(process.cwd(), 'public/openapi.yaml');
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

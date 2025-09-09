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
import { solCompleteDataSchema, healthCheckSchema, apiResponseSchema, fundingRateSchema, openInterestSchema, volumeProfileSchema, smcAnalysisSchema, cvdResponseSchema, positionCalculatorSchema, positionParamsSchema, riskDashboardSchema } from "@shared/schema";
import { metricsCollector } from "./utils/metrics";
import { cache, TTL_CONFIG } from "./utils/cache";
import { backpressureManager } from "./utils/websocket";

// Rate limiting middleware
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

function rateLimit(req: Request, res: Response, next: Function) {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Clean expired entries
  const entries = Array.from(rateLimitMap.entries());
  for (const [ip, data] of entries) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
  
  const clientData = rateLimitMap.get(clientIp);
  
  if (!clientData) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_WINDOW });
  } else {
    if (clientData.count >= RATE_LIMIT) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Maximum 100 requests per minute.',
        timestamp: new Date().toISOString(),
      });
    }
    clientData.count++;
  }
  
  next();
}

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

  // Apply middleware AFTER SEO routes
  app.use('/api', rateLimit);
  
  // Multi-coin screening routes (setelah rate limiting)
  app.use('/api/screener', screenerRouter);
  
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

  // Technical Indicators endpoint - RSI/EMA Professional Analysis
  app.get('/api/sol/technical', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      
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
        details: `GET /api/sol/technical - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: technicalAnalysis,
        timestamp: new Date().toISOString(),
      });
      
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

  // Multi-Exchange Aggregated Orderbook endpoint
  app.get('/api/sol/multi-exchange-orderbook', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const { multiExchangeService } = await import('./services/multiExchange.js');
      const symbol = req.query.symbol as string || 'SOL-USDT';
      
      const result = await multiExchangeService.getAggregatedOrderbook(symbol);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Multi-exchange orderbook aggregation completed',
        details: `GET /api/sol/multi-exchange-orderbook - ${responseTime}ms - 200 OK - Symbol: ${symbol}, Exchanges: ${result.stats.activeExchanges.join(', ')}, Depth: ${result.stats.totalLevels}`,
      });
      
      res.json({
        success: true,
        data: result.data,
        stats: result.stats,
        timestamp: new Date().toISOString(),
      });
      
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
      const { multiExchangeService } = await import('./services/multiExchange.js');
      const stats = await multiExchangeService.getMultiExchangeStats();
      const responseTime = Date.now() - startTime;
      
      await storage.addLog({
        level: 'info',
        message: 'Multi-exchange statistics retrieved',
        details: `GET /api/sol/multi-exchange-stats - ${responseTime}ms - 200 OK`,
      });
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
      
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

  // Fibonacci Analysis endpoint - Professional Fibonacci Retracements & Extensions
  app.get('/api/sol/fibonacci', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      
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
        details: `GET /api/sol/fibonacci - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: fibonacciAnalysis,
        timestamp: new Date().toISOString(),
      });
      
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

  // Order Flow Analysis endpoint - Professional Market Microstructure & Tape Reading
  app.get('/api/sol/order-flow', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const tradeLimit = parseInt(req.query.tradeLimit as string) || 200;
      
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
        details: `GET /api/sol/order-flow - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Trades: ${tradeLimit}`,
      });
      
      res.json({
        success: true,
        data: orderFlowAnalysis,
        timestamp: new Date().toISOString(),
      });
      
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

      // Default behavior: return metrics
      const metrics = await storage.getLatestMetrics();
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
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
        details: `GET /api/sol/liquidation - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}`,
      });
      
      res.json({
        success: true,
        data: liquidationAnalysis,
        timestamp: new Date().toISOString(),
      });
      
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
        details: `GET /api/sol/liquidation-heatmap - ${responseTime}ms - 200 OK - Price: $${currentPrice}, Risk Score: ${heatMapAnalysis.overallRiskScore}`,
      });
      
      res.json({
        success: true,
        data: heatMapAnalysis,
        timestamp: new Date().toISOString(),
      });
      
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
        details: `GET /api/sol/liquidation-price - ${responseTime}ms - 200 OK - Entry: ${entryPrice}, Leverage: ${leverage}x ${side}`,
      });
      
      res.json({
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
      });
      
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
      const enhancedMetrics = premiumOrderbookService.getEnhancedMetrics();
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
      const enhancedMetrics = premiumOrderbookService.getEnhancedMetrics();
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
  
  return httpServer;
}

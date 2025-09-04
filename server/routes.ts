import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import WebSocket, { WebSocketServer } from "ws";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { okxService } from "./services/okx";
import { CVDService } from "./services/cvd";
import { ConfluenceService } from "./services/confluence";
import { TechnicalIndicatorsService } from "./services/technicalIndicators";
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
  
  // Robots.txt for search engines (HIGH PRIORITY)
  app.get('/robots.txt', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(`User-agent: *
Allow: /
Allow: /api/
Allow: /.well-known/

Sitemap: https://guardiansofthegreentoken.com/sitemap.xml

# API endpoints for crawlers
Allow: /api/sol/complete
Allow: /health
Allow: /api/metrics
Allow: /.well-known/ai-plugin.json
Allow: /openapi.yaml
Allow: /openapi.json`);
  });

  // OpenAPI JSON specification for GPT custom actions - HIGH PRIORITY
  app.get('/openapi.json', (req: Request, res: Response) => {
    try {
      const openapiPath = path.join(process.cwd(), 'openapi-spec.json');
      const stats = fs.statSync(openapiPath);
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      
      // Generate ETag from file modification time and size
      const etag = `"${stats.mtime.getTime()}-${stats.size}"`;
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end(); // Not Modified
      }
      
      // Set smart cache headers
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=1800, must-revalidate'); // 30 min cache
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Parse and send JSON
      const jsonContent = JSON.parse(openapiContent);
      res.json(jsonContent);
    } catch (error) {
      console.error('Error serving OpenAPI JSON:', error);
      res.status(500).json({ error: 'Failed to load OpenAPI JSON specification' });
    }
  });

  // Alternative OpenAPI JSON endpoint
  app.get('/api/openapi.json', (req: Request, res: Response) => {
    try {
      const openapiPath = path.join(process.cwd(), 'openapi-spec.json');
      const stats = fs.statSync(openapiPath);
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      
      // Generate ETag from file modification time and size
      const etag = `"api-${stats.mtime.getTime()}-${stats.size}"`;
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end(); // Not Modified
      }
      
      // Set smart cache headers
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=900, must-revalidate'); // 15 min cache for API endpoint
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Parse and send JSON
      const jsonContent = JSON.parse(openapiContent);
      res.json(jsonContent);
    } catch (error) {
      console.error('Error serving OpenAPI JSON via API:', error);
      res.status(500).json({ error: 'Failed to load OpenAPI JSON specification' });
    }
  });

  // Health check endpoint - critical for monitoring
  app.get('/healthz', async (req: Request, res: Response) => {
    try {
      const health = metricsCollector.getHealthStatus();
      const statusCode = health.status === 'ok' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Duplicate OpenAPI endpoints removed - moved to high priority section

  // Metrics endpoint for monitoring and observability
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = metricsCollector.getMetrics();
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics',
        timestamp: new Date().toISOString()
      });
    }
  });

  // OpenAPI YAML specification for GPT custom actions - OPTIMIZED CACHE
  app.get('/openapi.yaml', (req: Request, res: Response) => {
    try {
      const openapiPath = path.join(process.cwd(), 'public', 'openapi.yaml');
      const stats = fs.statSync(openapiPath);
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      
      // Generate ETag from file modification time and size
      const etag = `"${stats.mtime.getTime()}-${stats.size}"`;
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end(); // Not Modified
      }
      
      // Set smart cache headers
      res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=1800, must-revalidate'); // 30 min cache, always revalidate
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Vary', 'Accept-Encoding');
      
      res.send(openapiContent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load OpenAPI specification' });
    }
  });

  // Alternative OpenAPI endpoint with same smart cache
  app.get('/api/openapi.yaml', (req: Request, res: Response) => {
    try {
      const openapiPath = path.join(process.cwd(), 'public', 'openapi.yaml');
      const stats = fs.statSync(openapiPath);
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      
      // Generate ETag from file modification time and size
      const etag = `"api-${stats.mtime.getTime()}-${stats.size}"`;
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end(); // Not Modified
      }
      
      // Set smart cache headers
      res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=900, must-revalidate'); // 15 min cache for API endpoint
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      
      res.send(openapiContent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load OpenAPI specification' });
    }
  });


  // OpenAPI JSON specification for GPT integration
  app.get("/.well-known/openapi.json", (req: Request, res: Response) => {
    try {
      const openapiPath = path.join(process.cwd(), 'openapi-spec.json');
      const stats = fs.statSync(openapiPath);
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      
      // Generate ETag from file modification time and size
      const etag = `"wk-${stats.mtime.getTime()}-${stats.size}"`;
      
      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end(); // Not Modified
      }
      
      // Set smart cache headers
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=1800, must-revalidate'); // 30 min cache
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Parse and send JSON
      const jsonContent = JSON.parse(openapiContent);
      res.json(jsonContent);
    } catch (error) {
      console.error('Error serving OpenAPI JSON from .well-known:', error);
      res.status(500).json({ error: 'Failed to load OpenAPI JSON specification' });
    }
  });

  // GPT AI Plugin manifest
  app.get("/.well-known/ai-plugin.json", (req: Request, res: Response) => {
    try {
      const pluginPath = path.join(process.cwd(), ".well-known/ai-plugin.json");
      const pluginContent = fs.readFileSync(pluginPath, "utf8");
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.json(JSON.parse(pluginContent));
    } catch (error) {
      console.error("Error serving AI plugin manifest:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load AI plugin manifest"
      });
    }
  });

  // Sitemap.xml for search engines
  app.get('/sitemap.xml', (req: Request, res: Response) => {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://guardiansofthegreentoken.com/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://guardiansofthegreentoken.com/api/sol/complete</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>minutely</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://guardiansofthegreentoken.com/health</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>minutely</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://guardiansofthegreentoken.com/.well-known/ai-plugin.json</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://guardiansofthegreentoken.com/openapi.yaml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;
    res.setHeader('Content-Type', 'application/xml');
    res.send(sitemap);
  });

  // Direct OpenAPI JSON specification (guaranteed to work)
  app.get('/openapi', (req: Request, res: Response) => {
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
            "description": "Check overall system health and connectivity status",
            "responses": {
              "200": {
                "description": "System operational",
                "content": {
                  "application/json": {
                    "schema": {
                      "type": "object",
                      "properties": {
                        "success": {"type": "boolean"},
                        "data": {
                          "type": "object",
                          "properties": {
                            "status": {"type": "string"},
                            "services": {
                              "type": "object",
                              "properties": {
                                "okx": {"type": "string"},
                                "api": {"type": "string"}
                              }
                            },
                            "metrics": {
                              "type": "object",
                              "properties": {
                                "responseTime": {"type": "number"},
                                "requestsToday": {"type": "number"},
                                "uptime": {"type": "string"}
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
                "description": "Complete market data"
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
                "description": "Confluence analysis"
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
                "description": "CVD analysis"
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
                "description": "Smart Money analysis"
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
                "description": "Order flow data"
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
    res.setHeader('Cache-Control', 'public, max-age=1800, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(spec);
  });

  // OpenAPI spec endpoint for GPT integration (BEFORE rate limiting)
  app.get('/api/openapi', (req: Request, res: Response) => {
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
  });

  // Apply middleware AFTER SEO routes and OpenAPI spec (CORS already handled in index.ts)
  app.use('/api', rateLimit);
  
  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const okxConnected = await okxService.testConnection();
      const responseTime = Date.now() - startTime;
      
      const healthData = {
        status: okxConnected ? 'operational' : 'degraded' as const,
        timestamp: new Date().toISOString(),
        services: {
          okx: okxConnected ? 'connected' : 'error' as const,
          api: 'operational' as const,
        },
        metrics: {
          responseTime,
          requestsToday: await storage.getTodayRequestCount(),
          uptime: process.uptime().toString() + 's',
        },
      };
      
      const validated = healthCheckSchema.parse(healthData);
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
      // Log the health check
      await storage.addLog({
        level: 'info',
        message: 'Health check performed',
        details: `Response time: ${responseTime}ms, OKX: ${okxConnected ? 'connected' : 'error'}`,
      });
      
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  // Main SOL complete data endpoint
  app.get('/api/sol/complete', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const solData = await okxService.getCompleteSOLData();
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = solCompleteDataSchema.parse(solData);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'API request completed successfully',
        details: `GET /api/sol/complete - ${responseTime}ms - 200 OK`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/complete:', error);
      
      // Log error
      await storage.addLog({
        level: 'error',
        message: 'API request failed',
        details: `GET /api/sol/complete - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // SOL Funding Rate endpoint
  app.get('/api/sol/funding', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const fundingData = await okxService.getFundingRate();
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = fundingRateSchema.parse(fundingData);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Funding rate request completed',
        details: `GET /api/sol/funding - ${responseTime}ms - 200 OK`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/funding:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Funding rate request failed',
        details: `GET /api/sol/funding - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // SOL Open Interest endpoint
  app.get('/api/sol/open-interest', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const oiData = await okxService.getOpenInterest();
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = openInterestSchema.parse(oiData);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Open interest request completed',
        details: `GET /api/sol/open-interest - ${responseTime}ms - 200 OK`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/open-interest:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Open interest request failed',
        details: `GET /api/sol/open-interest - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Volume Profile endpoint
  app.get('/api/sol/volume-profile', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      const volumeProfile = await okxService.getVolumeProfile('SOL-USDT', timeframe, limit);
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = volumeProfileSchema.parse(volumeProfile);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Volume profile request completed',
        details: `GET /api/sol/volume-profile - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/volume-profile:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Volume profile request failed',
        details: `GET /api/sol/volume-profile - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // SMC Analysis endpoint
  app.get('/api/sol/smc', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      const smcAnalysis = await okxService.getSMCAnalysis('SOL-USDT', timeframe, limit);
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = smcAnalysisSchema.parse(smcAnalysis);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'SMC analysis request completed',
        details: `GET /api/sol/smc - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/smc:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'SMC analysis request failed',
        details: `GET /api/sol/smc - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // CVD Analysis endpoint - Volume Delta Professional Analysis
  app.get('/api/sol/cvd', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Initialize CVD service with OKX service
      const cvdService = new CVDService(okxService);
      
      // Get candles and trades data for CVD analysis
      const [candles, trades] = await Promise.all([
        okxService.getCandles('SOL-USDT', timeframe, limit),
        okxService.getRecentTrades('SOL-USDT', 200) // Get 200 recent trades for analysis
      ]);
      
      // Perform CVD analysis
      const cvdAnalysis = await cvdService.analyzeCVD(candles, trades, timeframe);
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = cvdResponseSchema.parse({
        success: true,
        data: cvdAnalysis,
        timestamp: new Date().toISOString(),
      });
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'CVD analysis request completed',
        details: `GET /api/sol/cvd - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json(validated);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/cvd:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'CVD analysis request failed',
        details: `GET /api/sol/cvd - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Confluence Scoring endpoint - Multi-layer Analysis
  app.get('/api/sol/confluence', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      
      // Initialize confluence service
      const confluenceService = new ConfluenceService();
      
      // Fetch all analysis data in parallel
      const [smcData, cvdData, volumeData, fundingData, oiData, technicalData, fibonacciData, orderFlowData] = await Promise.all([
        okxService.getSMCAnalysis('SOL-USDT', timeframe, 100).catch(() => null),
        new CVDService(okxService).analyzeCVD(
          await okxService.getCandles('SOL-USDT', timeframe, 100),
          await okxService.getRecentTrades('SOL-USDT', 200),
          timeframe
        ).catch(() => null),
        okxService.getVolumeProfile('SOL-USDT', timeframe, 100).catch(() => null),
        okxService.getFundingRate('SOL-USDT-SWAP').catch(() => null),
        okxService.getOpenInterest('SOL-USDT-SWAP').catch(() => null),
        new TechnicalIndicatorsService().analyzeTechnicalIndicators(
          await okxService.getCandles('SOL-USDT', timeframe, 100),
          timeframe
        ).catch(() => null),
        new FibonacciService().analyzeFibonacci(
          await okxService.getCandles('SOL-USDT', timeframe, 100),
          timeframe
        ).catch(() => null),
        new OrderFlowService().analyzeOrderFlow(
          await okxService.getRecentTrades('SOL-USDT', 200),
          await okxService.getEnhancedOrderBook('SOL-USDT', 50),
          timeframe
        ).catch(() => null)
      ]);
      
      // Calculate confluence score with all 8 layers
      const confluenceScore = await confluenceService.calculateConfluenceScore(
        smcData || undefined,
        cvdData || undefined,
        volumeData || undefined,
        fundingData || undefined,
        oiData || undefined,
        technicalData || undefined,
        fibonacciData || undefined,
        orderFlowData || undefined,
        timeframe
      );
      
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Confluence analysis request completed',
        details: `GET /api/sol/confluence - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}`,
      });
      
      res.json({
        success: true,
        data: confluenceScore,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/confluence:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Confluence analysis request failed',
        details: `GET /api/sol/confluence - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

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
  
  // Get system logs
  app.get('/api/logs', async (req: Request, res: Response) => {
    try {
      const logs = await storage.getRecentLogs(50);
      res.json({
        success: true,
        data: logs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch logs',
        timestamp: new Date().toISOString(),
      });
    }
  });

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
      const volume24h = parseFloat(currentTicker.vol24h || '0');
      const openInterestValue = parseFloat(openInterest.openInterest || '0');
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
      console.log('Position Calculator endpoint hit with body:', req.body);
      
      // Validate request body
      const positionParams = positionParamsSchema.parse(req.body);
      console.log('Request validation passed:', positionParams);
      
      const accountBalance = req.body.accountBalance || 10000; // Default $10k account
      
      // Initialize Position Calculator service
      const positionCalculatorService = new PositionCalculatorService(okxService);
      console.log('Position Calculator service initialized');
      
      // Calculate comprehensive position metrics
      console.log('Starting position calculation...');
      const positionAnalysis = await positionCalculatorService.calculatePosition(
        positionParams,
        accountBalance
      );
      console.log('Position calculation completed:', positionAnalysis);
      
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
      console.log('Risk Dashboard endpoint hit with body:', req.body);
      
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
      
      console.log('Validated positions:', validatedPositions);
      
      // Initialize Risk Management service
      const riskManagementService = new RiskManagementService(okxService);
      
      // Generate comprehensive risk dashboard
      console.log('Generating risk dashboard...');
      const riskDashboard = await riskManagementService.generateRiskDashboard(
        validatedPositions,
        accountBalance,
        riskLimits
      );
      
      console.log('Risk dashboard generated successfully');
      
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
    console.log(`WebSocket client connected: ${clientIp}`);
    
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

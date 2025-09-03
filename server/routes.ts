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
import { solCompleteDataSchema, healthCheckSchema, apiResponseSchema, fundingRateSchema, openInterestSchema, volumeProfileSchema, smcAnalysisSchema, cvdResponseSchema } from "@shared/schema";
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
Allow: /openapi.yaml`);
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

  // OpenAPI YAML specification for GPT custom actions - HIGH PRIORITY
  app.get('/openapi.yaml', (req: Request, res: Response) => {
    try {
      const openapiPath = path.join(process.cwd(), 'public', 'openapi.yaml');
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      
      // Set aggressive anti-cache headers
      res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.setHeader('ETag', `"priority-${Date.now()}"`);
      res.setHeader('Vary', '*');
      
      res.send(openapiContent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load OpenAPI specification' });
    }
  });

  // Alternative OpenAPI endpoint untuk GPT Custom Actions
  app.get('/api/openapi.yaml', (req: Request, res: Response) => {
    try {
      const openapiPath = path.join(process.cwd(), 'public', 'openapi.yaml');
      const openapiContent = fs.readFileSync(openapiPath, 'utf8');
      
      // Set aggressive anti-cache headers
      res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('ETag', `"api-${Date.now()}"`);
      
      res.send(openapiContent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load OpenAPI specification' });
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

  // Apply middleware AFTER SEO routes (CORS already handled in index.ts)
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
  
  // Get system metrics
  app.get('/api/metrics', async (req: Request, res: Response) => {
    try {
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

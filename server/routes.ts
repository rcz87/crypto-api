import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { okxService } from "./services/okx";
import { solCompleteDataSchema, healthCheckSchema, apiResponseSchema } from "@shared/schema";

// Rate limiting middleware
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

function rateLimit(req: Request, res: Response, next: Function) {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Clean expired entries
  for (const [ip, data] of rateLimitMap.entries()) {
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
  // Apply middleware
  app.use(corsMiddleware);
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

  const httpServer = createServer(app);
  
  return httpServer;
}

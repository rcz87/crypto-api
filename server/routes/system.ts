import type { Express, Request, Response } from 'express';
import { metricsCollector } from '../utils/metrics.js';
import { okxService } from '../services/okx.js';
import { storage } from '../storage.js';
import { healthCheckSchema } from '../../shared/schema.js';
import type { SystemLogs } from '../../shared/schema.js';

/**
 * Register all system and monitoring routes
 * Includes health checks, metrics, and system logs
 */
export function registerSystemRoutes(app: Express): void {
  // Simple health check endpoint - critical for monitoring
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

  // Comprehensive health check endpoint with OKX connectivity test
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
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // API Metrics endpoint (under /api namespace)
  app.get('/api/metrics', async (req: Request, res: Response) => {
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

  // System logs endpoint
  app.get('/api/logs', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const level = req.query.level as string;
      
      const logs = await storage.getRecentLogs(limit);
      
      // Filter by level if specified
      const filteredLogs = level ? logs.filter((log: SystemLogs) => log.level === level) : logs;
      
      res.json({
        success: true,
        data: filteredLogs,
        timestamp: new Date().toISOString(),
        meta: {
          count: filteredLogs.length,
          limit,
          level: level || 'all'
        }
      });
    } catch (error) {
      console.error('Failed to retrieve logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve logs',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
}
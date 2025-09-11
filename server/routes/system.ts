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

  // API Metrics endpoint (under /api namespace) with production-safe security metrics
  app.get('/api/metrics', async (req: Request, res: Response) => {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Get basic metrics for all environments
      let metrics = metricsCollector.getMetrics();
      
      // Add security metrics with production safety
      try {
        const { getEnhancedSecurityMetrics } = await import('../middleware/security');
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
              // Note: Detailed thresholds, blocked IPs list, and store stats omitted in production
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
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
        environment: isProduction ? 'production' : 'development'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics',
        timestamp: new Date().toISOString()
      });
    }
  });

  // System logs endpoint (with enhanced input validation)
  app.get('/api/logs', async (req: Request, res: Response) => {
    try {
      // Enhanced input sanitization for query parameters
      const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit as string) || 100));
      const level = ['info', 'warning', 'error', 'debug'].includes(req.query.level as string) 
        ? req.query.level as string 
        : undefined;
      
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
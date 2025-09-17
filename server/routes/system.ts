import type { Express, Request, Response } from 'express';
import { metricsCollector } from '../utils/metrics';
import { coinglassCircuitBreaker } from '../utils/circuitBreaker';
import { okxService } from '../services/okx.js';
import { storage } from '../storage.js';
import { healthCheckSchema } from '../../shared/schema.js';
import type { SystemLogs } from '../../shared/schema.js';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';

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

  // Comprehensive health check endpoint with OKX and CoinGlass connectivity test
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      
      // Test OKX connection
      const okxConnected = await okxService.testConnection();
      const okxResponseTime = Date.now() - startTime;
      
      // Test CoinGlass connection with 1500ms timeout
      let coinglassConnected = false;
      let coinglassResponseTime = 0;
      let coinglassHasKey = false;
      
      const coinglassStart = Date.now();
      try {
        const PY_BASE = process.env.PY_BASE || 'http://127.0.0.1:8000';
        
        // Use AbortController for timeout
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 1500);
        
        const response = await fetch(`${PY_BASE}/health`, {
          signal: abortController.signal
        });
        
        clearTimeout(timeoutId);
        coinglassResponseTime = Date.now() - coinglassStart;
        
        if (response.ok) {
          const coinglassHealth = await response.json() as any;
          coinglassConnected = true;
          // Extract has_key if available in response
          coinglassHasKey = coinglassHealth?.coinglass?.has_key || false;
        }
      } catch (error) {
        coinglassResponseTime = Date.now() - coinglassStart;
        console.warn(`CoinGlass health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Determine overall system status - degraded if any critical service fails
      const allCriticalServicesHealthy = okxConnected && coinglassConnected;
      const status = allCriticalServicesHealthy ? 'operational' : 'degraded' as const;
      
      const healthData = {
        status,
        timestamp: new Date().toISOString(),
        services: {
          okx: okxConnected ? 'connected' : 'error' as const,
          api: 'operational' as const,
          coinglass: coinglassConnected ? 'connected' : 'error' as const,
        },
        metrics: {
          responseTime: okxResponseTime,
          requestsToday: await storage.getTodayRequestCount(),
          uptime: process.uptime().toString() + 's',
          coinglassResponseTimeMs: coinglassResponseTime,
        },
        coinglass: {
          has_key: coinglassHasKey,
        },
      };
      
      const validated = healthCheckSchema.parse(healthData);
      
      // Return 503 if any critical services are down
      const statusCode = allCriticalServicesHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        success: allCriticalServicesHealthy,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
      // Log the comprehensive health check
      await storage.addLog({
        level: allCriticalServicesHealthy ? 'info' : 'warning',
        message: 'Comprehensive health check performed',
        details: `OKX: ${okxConnected ? 'connected' : 'error'} (${okxResponseTime}ms), CoinGlass: ${coinglassConnected ? 'connected' : 'error'} (${coinglassResponseTime}ms)`,
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

      // Enhance CoinGlass metrics with aggregated data
      try {
        // Get circuit breaker state from singleton (no circular import)
        const circuitBreakerState = coinglassCircuitBreaker.getState();
        
        // Update metrics collector with circuit breaker state
        metricsCollector.updateCoinglassCircuitBreaker(
          circuitBreakerState.failures,
          circuitBreakerState.isOpen,
          circuitBreakerState.lastFailure
        );

        // Try to fetch Python service metrics with timeout
        let pythonMetrics = null;
        const PY_BASE = process.env.PY_BASE || 'http://127.0.0.1:8000';
        
        try {
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 1000);
          
          const pythonResponse = await fetch(`${PY_BASE}/metrics`, {
            signal: abortController.signal,
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });
          
          clearTimeout(timeoutId);
          
          if (pythonResponse.ok) {
            const contentType = pythonResponse.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              pythonMetrics = await pythonResponse.json();
            } else {
              // Python service might return Prometheus format - skip parsing
              console.warn('CoinGlass Python service returned non-JSON metrics format');
              pythonMetrics = { format: 'prometheus', available: true };
            }
          }
        } catch (error) {
          // Python service metrics unavailable - continue with local metrics
          console.warn('CoinGlass Python service metrics unavailable:', error instanceof Error ? error.message : 'Unknown error');
        }

        // Re-fetch updated metrics that include circuit breaker state
        metrics = metricsCollector.getMetrics();

        // Preserve enhanced coinglass metrics format and add Python service data
        // DO NOT overwrite the enhanced format - preserve all fields from metrics collector
        if (metrics.coinglass) {
          // Add Python service metrics to the existing enhanced format
          metrics.coinglass.python_service = pythonMetrics ? {
            available: true,
            response_time_ms: pythonMetrics.response_time_ms || null,
            metrics: pythonMetrics
          } : {
            available: false,
            reason: 'Service unavailable or timeout'
          };
          
          // Add legacy format under separate key for backward compatibility
          metrics.coinglass.legacy_format = {
            health: metrics.coinglass.healthStatus,
            has_key: metrics.coinglass.hasKey,
            requests: {
              total: metrics.coinglass.requests,
              errors: metrics.coinglass.errors,
              error_rate: metrics.coinglass.errorRate
            },
            performance: {
              avg_latency_ms: metrics.coinglass.avgLatency,
              last_health_check_ms_ago: metrics.coinglass.lastHealthCheckMs
            },
            circuit_breaker: {
              failures: metrics.coinglass.circuitBreaker?.failures || 0,
              is_open: metrics.coinglass.circuitBreaker?.isOpen || false,
              last_failure: metrics.coinglass.circuitBreaker?.lastFailure || null
            }
          };
        } else {
          // Fallback if coinglass metrics not available
          metrics.coinglass = {
            // Enhanced format fields
            requestCount: 0,
            avgResponseTime: 0,
            errorRate: 0,
            lastHealthStatus: 'disconnected',
            hasApiKey: false,
            circuitBreaker: { failures: 0, isOpen: false, lastFailure: null },
            // Backward compatibility fields
            requests: 0,
            errors: 0,
            avgLatency: 0,
            healthStatus: 'disconnected',
            hasKey: false,
            lastHealthCheck: 0,
            lastHealthCheckMs: -1,
            errorRatePercent: '0.00%',
            // Python service data
            python_service: { available: false, reason: 'Metrics collector not initialized' },
            // Legacy format
            legacy_format: {
              health: 'disconnected',
              has_key: false,
              requests: { total: 0, errors: 0, error_rate: 0 },
              performance: { avg_latency_ms: 0, last_health_check_ms_ago: -1 },
              circuit_breaker: { failures: 0, is_open: false, last_failure: null }
            }
          };
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

  // Event Logging System comprehensive health endpoint
  app.get('/api/event-logging/health', async (req: Request, res: Response) => {
    try {
      // Import Event Logging system components dynamically
      const { EventEmitter } = await import('../observability/eventEmitter.js');
      const { testDatabaseConnection, getDatabaseStats } = await import('../observability/eventIngestor.js');
      const { isTelegramConfigured, getTelegramStatus } = await import('../observability/telegram.js');
      
      const startTime = Date.now();
      
      // Test all Event Logging System components
      const isFeatureEnabled = process.env.FEATURE_EVENT_LOGGING === 'true';
      const dbConnected = await testDatabaseConnection();
      const telegramConfigured = isTelegramConfigured();
      const telegramStatus = getTelegramStatus();
      
      // Get database stats if available
      let dbStats = null;
      if (isFeatureEnabled && dbConnected) {
        try {
          dbStats = await getDatabaseStats();
        } catch (error) {
          console.warn('Failed to get database stats:', error);
        }
      }
      
      // Test EventEmitter health check
      const emitterHealth = await EventEmitter.healthCheck();
      
      const responseTime = Date.now() - startTime;
      
      const systemStatus = {
        initialized: true,
        feature_enabled: isFeatureEnabled,
        database: {
          connected: dbConnected,
          migrated: dbConnected, // If connected, migration was successful
          stats: dbStats
        },
        telegram: telegramStatus,
        scheduler: {
          running: true, // Scheduler is always running if system is up
          timezone: 'Asia/Jakarta'
        },
        event_emitter: emitterHealth,
        environment: {
          timezone: process.env.TZ || 'system default',
          feature_logging: process.env.FEATURE_EVENT_LOGGING,
          database_url: !!process.env.DATABASE_URL
        },
        performance: {
          response_time_ms: responseTime,
          timestamp: new Date().toISOString()
        }
      };
      
      // Determine overall health status
      const isHealthy = isFeatureEnabled ? 
        (dbConnected && emitterHealth.enabled && emitterHealth.database) :
        true; // If feature disabled, system is healthy
        
      const statusCode = isHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        success: isHealthy,
        status: isHealthy ? 'operational' : 'degraded',
        data: systemStatus,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Event Logging health check failed:', error);
      res.status(500).json({
        success: false,
        status: 'error',
        error: 'Event Logging health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // 📊 Scheduler Status Endpoint
  const schedulerStatusLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per IP
    message: { error: "Too many scheduler status requests" }
  });

  app.get('/api/scheduler/status', schedulerStatusLimit, async (req: Request, res: Response) => {
    try {
      const { getSchedulerStatus } = await import('../schedulers/institutional');
      const status = getSchedulerStatus();
      
      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("❌ Scheduler status error:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to get scheduler status",
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}
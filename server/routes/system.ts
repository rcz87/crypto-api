import type { Express, Request, Response } from 'express';
import { metricsCollector } from '../utils/metrics';
import { coinglassCircuitBreaker } from '../utils/circuitBreaker';
import { okxService } from '../services/okx.js';
import { storage } from '../storage.js';
import { healthCheckSchema } from '../../shared/schema.js';
import type { SystemLogs } from '../../shared/schema.js';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import { healthMonitor, healthCheckMiddleware, pythonServiceGuard } from '../middleware/healthMonitor';
import { circuitBreaker } from '../middleware/circuitBreaker';

/**
 * Register all system and monitoring routes
 * Includes health checks, metrics, and system logs
 */
export function registerSystemRoutes(app: Express): void {
  // Enhanced health check endpoint - institutional grade monitoring with proper service categorization
  app.get('/healthz', async (req: Request, res: Response) => {
    try {
      const health = metricsCollector.getHealthStatus();
      
      // Status mapping: ok → 200, degraded → 200, down → 503
      // Only critical service failures should return 503
      const statusCode = health.status === 'down' ? 503 : 200;
      
      // Enhanced response with proper categorization
      const response = {
        status: health.status,
        message: health.reasoning.status_explanation,
        uptime: health.uptime,
        services: {
          critical: health.services.critical,
          non_critical: health.services.non_critical
        },
        summary: {
          critical_services_healthy: health.reasoning.critical_services_healthy,
          non_critical_services_degraded: health.reasoning.non_critical_services_degraded,
          overall_availability: health.status === 'down' ? 'unavailable' : 'available'
        },
        timestamp: health.timestamp
      };
      
      res.status(statusCode).json(response);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // 🚨 NEW: Python service health monitoring with circuit breaker protection  
  app.get('/health/python', healthCheckMiddleware);
  
  // 🚨 NEW: Circuit breaker status endpoint
  app.get('/health/circuit-breaker', (req: Request, res: Response) => {
    const status = circuitBreaker.getStatus();
    const allClosed = Object.values(status).every(state => state.state === 'CLOSED');
    
    res.status(allClosed ? 200 : 503).json({
      success: true,
      circuit_breaker_status: status,
      overall_status: allClosed ? 'all_circuits_closed' : 'some_circuits_open',
      timestamp: new Date().toISOString()
    });
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

  // 🔧 FIX #2: Enhanced health endpoint with commit field (build verification)
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
        commit: process.env.GIT_COMMIT || 'unknown',
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
        const baseMetrics = metricsCollector.getMetrics();

        // Create enhanced metrics object with proper typing
        const enhancedCoinglass = {
          ...baseMetrics.coinglass,
          // Add Python service metrics as additional property
          python_service: pythonMetrics ? {
            available: true,
            response_time_ms: (pythonMetrics as any).response_time_ms || null,
            metrics: pythonMetrics
          } : {
            available: false,
            reason: 'Service unavailable or timeout'
          },
          // Add legacy format under separate key for backward compatibility
          legacy_format: {
            health: baseMetrics.coinglass.healthStatus,
            has_key: baseMetrics.coinglass.hasKey,
            requests: {
              total: baseMetrics.coinglass.requests,
              errors: baseMetrics.coinglass.errors,
              error_rate: baseMetrics.coinglass.errorRate
            },
            performance: {
              avg_latency_ms: baseMetrics.coinglass.avgLatency,
              last_health_check_ms_ago: baseMetrics.coinglass.lastHealthCheckMs
            },
            circuit_breaker: {
              failures: baseMetrics.coinglass.circuitBreaker?.failures || 0,
              is_open: baseMetrics.coinglass.circuitBreaker?.isOpen || false,
              last_failure: baseMetrics.coinglass.circuitBreaker?.lastFailure || null
            }
          }
        };

        // Construct final metrics with enhanced coinglass data
        metrics = {
          ...baseMetrics,
          coinglass: enhancedCoinglass
        };

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
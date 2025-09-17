// Performance metrics collection
type CoinGlassHealth = "connected" | "degraded" | "disconnected";

interface Metrics {
  http: {
    count: number;
    p95: number;
    errors: number;
  };
  cache: {
    hits: number;
    misses: number;
    size: number;
  };
  ws: {
    reconnects: number;
    activeClients: number;
    bufferedAmount: number;
  };
  okx: {
    restStatus: 'up' | 'down' | 'degraded';
    wsStatus: 'up' | 'down' | 'connecting';
    lastRestCall: number;
    lastWsMessage: number;
  };
  security: {
    rateLimitHits: number;
    validationFailures: number;
    suspiciousRequests: number;
    blockedIPs: number;
    lastSecurityEvent: number;
  };
  coinglass: {
    requests: number;
    errors: number;
    avgLatency: number;
    lastHealthCheck: number;
    healthStatus: CoinGlassHealth;
    hasKey: boolean;
    circuitBreaker: {
      failures: number;
      isOpen: boolean;
      lastFailure: number | null;
    };
  };
}

class MetricsCollector {
  private metrics: Metrics = {
    http: { count: 0, p95: 0, errors: 0 },
    cache: { hits: 0, misses: 0, size: 0 },
    ws: { reconnects: 0, activeClients: 0, bufferedAmount: 0 },
    // STARTUP GRACE PERIOD FIX: Initialize OKX services to 'degraded' instead of 'down'
    // This prevents false positive 503 responses during system startup/warmup
    okx: { restStatus: 'degraded', wsStatus: 'degraded', lastRestCall: 0, lastWsMessage: 0 },
    security: { rateLimitHits: 0, validationFailures: 0, suspiciousRequests: 0, blockedIPs: 0, lastSecurityEvent: 0 },
    coinglass: { 
      requests: 0, 
      errors: 0, 
      avgLatency: 0, 
      lastHealthCheck: 0, 
      healthStatus: 'disconnected', 
      hasKey: !!process.env.CG_API_KEY || !!process.env.COINGLASS_API_KEY,
      circuitBreaker: { failures: 0, isOpen: false, lastFailure: null }
    }
  };

  private responseTimes: number[] = [];
  
  // Enhanced CoinGlass metrics with EMA and rolling window
  private coinglassAvgRt = 0; // EMA for avgLatency
  private readonly coinglassAlpha = 0.15; // EMA smoothing factor
  private readonly coinglassWindow = 200; // Rolling window for error rate
  private coinglassErrorBuffer: (0 | 1)[] = []; // Ring buffer for errors
  private coinglassBufferIndex = 0;
  
  private readonly maxSamples = 100;
  private startTime = Date.now();
  
  // STARTUP GRACE PERIOD: 5-minute window for service initialization
  private readonly STARTUP_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Check if system is still within startup/warmup period
   * During this time, uninitialized services should be treated as 'degraded' not 'down'
   */
  private isWithinStartupGracePeriod(): boolean {
    return (Date.now() - this.startTime) < this.STARTUP_GRACE_PERIOD_MS;
  }

  // HTTP metrics
  recordHttpRequest(duration: number, isError: boolean = false) {
    this.metrics.http.count++;
    if (isError) this.metrics.http.errors++;
    
    this.responseTimes.push(duration);
    if (this.responseTimes.length > this.maxSamples) {
      this.responseTimes.shift();
    }
    
    // Calculate P95
    if (this.responseTimes.length >= 5) {
      const sorted = [...this.responseTimes].sort((a, b) => a - b);
      const p95Index = Math.ceil(sorted.length * 0.95) - 1;
      this.metrics.http.p95 = sorted[p95Index] || 0;
    }
  }

  // Cache metrics
  recordCacheHit() {
    this.metrics.cache.hits++;
  }

  recordCacheMiss() {
    this.metrics.cache.misses++;
  }

  updateCacheSize(size: number) {
    this.metrics.cache.size = size;
  }

  // WebSocket metrics
  recordWsReconnect() {
    this.metrics.ws.reconnects++;
  }

  updateActiveClients(count: number) {
    this.metrics.ws.activeClients = count;
  }

  updateBufferedAmount(amount: number) {
    this.metrics.ws.bufferedAmount = amount;
  }

  // OKX service metrics
  updateOkxRestStatus(status: 'up' | 'down' | 'degraded') {
    this.metrics.okx.restStatus = status;
    this.metrics.okx.lastRestCall = Date.now();
  }

  updateOkxWsStatus(status: 'up' | 'down' | 'connecting') {
    this.metrics.okx.wsStatus = status;
    this.metrics.okx.lastWsMessage = Date.now();
  }

  // Security metrics
  recordSecurityViolation(type: 'rate_limit' | 'validation' | 'suspicious') {
    switch (type) {
      case 'rate_limit':
        this.metrics.security.rateLimitHits++;
        break;
      case 'validation':
        this.metrics.security.validationFailures++;
        break;
      case 'suspicious':
        this.metrics.security.suspiciousRequests++;
        break;
    }
    this.metrics.security.lastSecurityEvent = Date.now();
  }

  updateBlockedIPs(count: number) {
    this.metrics.security.blockedIPs = count;
  }

  // Enhanced CoinGlass metrics with EMA and rolling window
  recordCoinglassRequest(duration: number, isError: boolean = false) {
    this.metrics.coinglass.requests++;
    
    // Update EMA for avgLatency (smooth and efficient)
    if (this.coinglassAvgRt === 0) {
      this.coinglassAvgRt = duration;
    } else {
      this.coinglassAvgRt = this.coinglassAvgRt + this.coinglassAlpha * (duration - this.coinglassAvgRt);
    }
    this.metrics.coinglass.avgLatency = Math.round(this.coinglassAvgRt);
    
    // Update rolling window for error rate calculation
    if (this.coinglassErrorBuffer.length < this.coinglassWindow) {
      this.coinglassErrorBuffer.push(isError ? 1 : 0);
    } else {
      this.coinglassErrorBuffer[this.coinglassBufferIndex] = isError ? 1 : 0;
      this.coinglassBufferIndex = (this.coinglassBufferIndex + 1) % this.coinglassWindow;
    }
    
    if (isError) {
      this.metrics.coinglass.errors++;
    }
    
    // Update health status based on error rate
    this.updateCoinglassHealth();
  }
  
  // Calculate error rate from rolling window
  private getCoinglassErrorRate(): number {
    if (this.coinglassErrorBuffer.length === 0) return 0;
    const sum = this.coinglassErrorBuffer.reduce((a: number, b: 0 | 1) => a + b, 0);
    return sum / this.coinglassErrorBuffer.length;
  }
  
  // Update health status based on error rate thresholds
  private updateCoinglassHealth() {
    const errorRate = this.getCoinglassErrorRate();
    // Only update health if we have actual requests
    if (this.metrics.coinglass.requests > 0) {
      if (errorRate > 0.5) {
        this.metrics.coinglass.healthStatus = 'disconnected';
      } else if (errorRate > 0.2) {
        this.metrics.coinglass.healthStatus = 'degraded';
      } else {
        this.metrics.coinglass.healthStatus = 'connected';
      }
    } else {
      // No requests yet - status should be connected if API key available
      this.metrics.coinglass.healthStatus = this.metrics.coinglass.hasKey ? 'connected' : 'disconnected';
    }
  }

  updateCoinglassHealthCheck(hasKey: boolean = false) {
    this.metrics.coinglass.hasKey = hasKey;
    this.metrics.coinglass.lastHealthCheck = Date.now();
    // Health status is now calculated automatically from error rate
  }

  updateCoinglassCircuitBreaker(failures: number, isOpen: boolean, lastFailure: number | null) {
    this.metrics.coinglass.circuitBreaker.failures = failures;
    this.metrics.coinglass.circuitBreaker.isOpen = isOpen;
    this.metrics.coinglass.circuitBreaker.lastFailure = lastFailure;
  }

  /**
   * STARTUP GRACE PERIOD FIX: Enhanced OKX REST service health evaluation
   * Properly handles uninitialized services during warmup period
   */
  private evaluateOkxRestHealth(currentTime: number, isWarmup: boolean): boolean {
    const { restStatus, lastRestCall } = this.metrics.okx;
    
    // During warmup: treat uninitialized (timestamp = 0) as degraded, not down
    if (isWarmup && lastRestCall === 0) {
      return true; // Consider as 'not failing' during warmup
    }
    
    // After warmup: normal health check logic
    return restStatus === 'up' && (currentTime - lastRestCall) < 30000; // 30s threshold
  }

  /**
   * STARTUP GRACE PERIOD FIX: Enhanced OKX WebSocket service health evaluation
   * Properly handles uninitialized services during warmup period
   */
  private evaluateOkxWsHealth(currentTime: number, isWarmup: boolean): boolean {
    const { wsStatus, lastWsMessage } = this.metrics.okx;
    
    // During warmup: treat uninitialized (timestamp = 0) as degraded, not down
    if (isWarmup && lastWsMessage === 0) {
      return true; // Consider as 'not failing' during warmup
    }
    
    // After warmup: normal health check logic
    return wsStatus === 'up' && (currentTime - lastWsMessage) < 60000; // 60s threshold for WS
  }

  getMetrics() {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const cacheHitRatio = this.metrics.cache.hits + this.metrics.cache.misses > 0 
      ? (this.metrics.cache.hits / (this.metrics.cache.hits + this.metrics.cache.misses) * 100).toFixed(1)
      : '0.0';

    return {
      uptime,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      http: {
        ...this.metrics.http,
        errorRate: this.metrics.http.count > 0 
          ? ((this.metrics.http.errors / this.metrics.http.count) * 100).toFixed(2) + '%'
          : '0.00%'
      },
      cache: {
        ...this.metrics.cache,
        hitRatio: cacheHitRatio + '%'
      },
      ws: this.metrics.ws,
      okx: {
        ...this.metrics.okx,
        restLatency: this.metrics.okx.lastRestCall > 0 ? Date.now() - this.metrics.okx.lastRestCall : -1,
        wsLatency: this.metrics.okx.lastWsMessage > 0 ? Date.now() - this.metrics.okx.lastWsMessage : -1
      },
      security: {
        ...this.metrics.security,
        securityHealth: this.metrics.security.lastSecurityEvent > 0 ? 
          Date.now() - this.metrics.security.lastSecurityEvent < 300000 ? 'recent_activity' : 'quiet' : 'no_events'
      },
      coinglass: {
        requestCount: this.metrics.coinglass.requests,
        avgResponseTime: this.metrics.coinglass.avgLatency,
        errorRate: Number(this.getCoinglassErrorRate().toFixed(4)),
        lastHealthStatus: this.metrics.coinglass.healthStatus,
        hasApiKey: this.metrics.coinglass.hasKey,
        circuitBreaker: {
          failures: this.metrics.coinglass.circuitBreaker.failures,
          isOpen: this.metrics.coinglass.circuitBreaker.isOpen,
          lastFailure: this.metrics.coinglass.circuitBreaker.lastFailure ? 
            new Date(this.metrics.coinglass.circuitBreaker.lastFailure).toISOString() : null
        },
        // Backward compatibility fields
        requests: this.metrics.coinglass.requests,
        errors: this.metrics.coinglass.errors,
        avgLatency: this.metrics.coinglass.avgLatency,
        healthStatus: this.metrics.coinglass.healthStatus,
        hasKey: this.metrics.coinglass.hasKey,
        lastHealthCheck: this.metrics.coinglass.lastHealthCheck,
        lastHealthCheckMs: this.metrics.coinglass.lastHealthCheck > 0 
          ? Date.now() - this.metrics.coinglass.lastHealthCheck 
          : -1,
        errorRatePercent: (this.getCoinglassErrorRate() * 100).toFixed(2) + '%'
      }
    };
  }

  getHealthStatus() {
    const now = Date.now();
    const metrics = this.getMetrics();
    const isWarmup = this.isWithinStartupGracePeriod();
    
    // STARTUP GRACE PERIOD FIX: Enhanced critical service checks with warmup handling
    // During warmup (first 5 minutes), treat uninitialized services as degraded, not down
    const restHealthy = this.evaluateOkxRestHealth(now, isWarmup);
    const wsHealthy = this.evaluateOkxWsHealth(now, isWarmup);
    
    const memoryHealthy = metrics.memory.used < 500; // 500MB threshold
    
    // Non-critical service checks
    const cacheHealthy = parseFloat(metrics.cache.hitRatio) > 30; // 30% hit ratio threshold
    const coinglassHealthy = this.metrics.coinglass.healthStatus === 'connected';
    const coinglassCircuitBreakerOpen = this.metrics.coinglass.circuitBreaker.isOpen;
    
    // Service categorization
    const criticalServices = {
      okx_rest: restHealthy,
      okx_ws: wsHealthy,
      memory: memoryHealthy
    };
    
    const nonCriticalServices = {
      cache: cacheHealthy,
      coinglass: coinglassHealthy && !coinglassCircuitBreakerOpen
    };
    
    // STARTUP GRACE PERIOD FIX: Enhanced overall status determination
    // Only consider services truly 'down' if they are actively failing after warmup
    const criticalDown = (!restHealthy || !wsHealthy || !memoryHealthy) && !isWarmup;
    const nonCriticalDegraded = !cacheHealthy || !coinglassHealthy || coinglassCircuitBreakerOpen;
    const duringWarmup = isWarmup && (!restHealthy || !wsHealthy);
    
    let overall: 'ok' | 'degraded' | 'down';
    if (criticalDown) {
      overall = 'down';  // Only during confirmed failures after warmup
    } else if (nonCriticalDegraded || duringWarmup) {
      overall = 'degraded';  // Include warmup period as degraded
    } else {
      overall = 'ok';
    }

    return {
      status: overall,
      uptime: metrics.uptime,
      memory: metrics.memory,
      services: {
        critical: {
          okx_rest: {
            status: restHealthy ? 'up' : 'down',
            last_call_ms_ago: now - this.metrics.okx.lastRestCall,
            threshold_ms: 30000
          },
          okx_ws: {
            status: wsHealthy ? 'up' : 'down',
            last_message_ms_ago: now - this.metrics.okx.lastWsMessage,
            threshold_ms: 60000
          },
          memory: {
            status: memoryHealthy ? 'ok' : 'high',
            used_mb: metrics.memory.used,
            threshold_mb: 500
          }
        },
        non_critical: {
          cache: {
            status: cacheHealthy ? 'healthy' : 'degraded',
            hit_ratio: metrics.cache.hitRatio,
            threshold_percent: 30
          },
          coinglass: {
            status: coinglassHealthy ? 'connected' : 'degraded',
            health_status: this.metrics.coinglass.healthStatus,
            circuit_breaker_open: coinglassCircuitBreakerOpen,
            error_rate: this.getCoinglassErrorRate(),
            avg_latency_ms: this.metrics.coinglass.avgLatency
          }
        }
      },
      // Legacy components format for backward compatibility
      components: {
        okx_rest: restHealthy ? 'up' : 'down',
        okx_ws: wsHealthy ? 'up' : 'down',
        cache: cacheHealthy ? 'healthy' : 'degraded',
        memory: memoryHealthy ? 'ok' : 'high',
        coinglass: coinglassHealthy ? 'connected' : 'degraded'
      },
      cache: {
        size: metrics.cache.size,
        hits: metrics.cache.hits,
        misses: metrics.cache.misses,
        hitRatio: metrics.cache.hitRatio
      },
      reasoning: {
        critical_services_healthy: !criticalDown,
        non_critical_services_degraded: nonCriticalDegraded,
        startup_grace_period_active: isWarmup,
        warmup_time_remaining_ms: isWarmup ? (this.STARTUP_GRACE_PERIOD_MS - (now - this.startTime)) : 0,
        status_explanation: criticalDown ? 'Critical services down' : 
                           duringWarmup ? `System warming up (${Math.ceil((this.STARTUP_GRACE_PERIOD_MS - (now - this.startTime)) / 1000)}s remaining)` :
                           nonCriticalDegraded ? 'Non-critical services degraded' : 'All services healthy'
      },
      timestamp: new Date().toISOString()
    };
  }
}

export const metricsCollector = new MetricsCollector();
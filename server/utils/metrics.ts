// Performance metrics collection
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
}

class MetricsCollector {
  private metrics: Metrics = {
    http: { count: 0, p95: 0, errors: 0 },
    cache: { hits: 0, misses: 0, size: 0 },
    ws: { reconnects: 0, activeClients: 0, bufferedAmount: 0 },
    okx: { restStatus: 'down', wsStatus: 'down', lastRestCall: 0, lastWsMessage: 0 },
    security: { rateLimitHits: 0, validationFailures: 0, suspiciousRequests: 0, blockedIPs: 0, lastSecurityEvent: 0 }
  };

  private responseTimes: number[] = [];
  private readonly maxSamples = 100;
  private startTime = Date.now();

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
      }
    };
  }

  getHealthStatus() {
    const now = Date.now();
    const metrics = this.getMetrics();
    
    // Health checks
    const restHealthy = this.metrics.okx.restStatus === 'up' && 
                       (now - this.metrics.okx.lastRestCall) < 30000; // 30s threshold
    
    const wsHealthy = this.metrics.okx.wsStatus === 'up' && 
                     (now - this.metrics.okx.lastWsMessage) < 60000; // 60s threshold for WS
    
    const memoryHealthy = metrics.memory.used < 500; // 500MB threshold
    const cacheHealthy = parseFloat(metrics.cache.hitRatio) > 30; // 30% hit ratio threshold (more realistic)

    const overall = restHealthy && wsHealthy && memoryHealthy ? 'ok' : 'degraded';

    return {
      status: overall,
      uptime: metrics.uptime,
      memory: metrics.memory,
      components: {
        okx_rest: restHealthy ? 'up' : 'down',
        okx_ws: wsHealthy ? 'up' : 'down',
        cache: cacheHealthy ? 'healthy' : 'degraded',
        memory: memoryHealthy ? 'ok' : 'high'
      },
      cache: {
        size: metrics.cache.size,
        hits: metrics.cache.hits,
        misses: metrics.cache.misses,
        hitRatio: metrics.cache.hitRatio
      },
      timestamp: new Date().toISOString()
    };
  }
}

export const metricsCollector = new MetricsCollector();
// 🔧 PATCH 1: FORCE GC EXPOSURE CHECK
// This MUST be at the very top to ensure GC is available before any other code runs
if (typeof global.gc !== 'function') {
  console.warn('⚠️  GC is not exposed! Attempting to expose...');
  
  try {
    if (process.execArgv.includes('--expose-gc') || 
        process.env.NODE_OPTIONS?.includes('--expose-gc')) {
      console.log('✅ --expose-gc flag detected, attempting manual exposure');
      
      const v8 = require('v8');
      v8.setFlagsFromString('--expose_gc');
      global.gc = require('vm').runInNewContext('gc');
    }
  } catch (e: any) {
    console.error('❌ Could not expose GC manually:', e.message);
  }
}

if (typeof global.gc === 'function') {
  console.log('✅ GC is available and exposed');
  global.gc();
  console.log('✅ GC test successful');
} else {
  console.error('❌ GC is NOT available - memory management will be limited');
}

// Set TensorFlow quiet mode to reduce log noise
process.env.TF_CPP_MIN_LOG_LEVEL = '2';

// 🔧 TASK 7: NODE_OPTIONS Startup Validation
const requiredNodeOptions = ['--expose-gc', '--max-old-space-size'];
const currentOptions = process.env.NODE_OPTIONS || '';

const missingOptions: string[] = [];
if (!currentOptions.includes('--expose-gc')) {
  missingOptions.push('--expose-gc (enables manual GC)');
}
if (!currentOptions.includes('--max-old-space-size')) {
  missingOptions.push('--max-old-space-size=256 (increases heap to 256MB)');
}

if (missingOptions.length > 0) {
  console.error('\n❌ CRITICAL: NODE_OPTIONS not properly configured!\n');
  console.error('Missing required flags:');
  missingOptions.forEach(opt => console.error(`  - ${opt}`));
  console.error('\n📖 SETUP INSTRUCTIONS:');
  console.error('   Option 1 (Recommended): Set via Replit Secrets');
  console.error('     1. Open Replit Settings → Secrets');
  console.error('     2. Add new secret:');
  console.error('        Key: NODE_OPTIONS');
  console.error('        Value: --expose-gc --max-old-space-size=256');
  console.error('     3. Restart the Repl\n');
  console.error('   Option 2: Use startup script');
  console.error('     chmod +x START_WITH_INCREASED_HEAP.sh');
  console.error('     ./START_WITH_INCREASED_HEAP.sh\n');
  console.error('📄 See SETUP_NODE_OPTIONS.md for detailed instructions\n');
  console.error('⚠️  Continuing without these flags will result in:');
  console.error('   - Manual GC unavailable (memory leaks cannot be mitigated)');
  console.error('   - Heap limited to 57MB (will crash at 95% usage)');
  console.error('   - /api/debug/gc endpoint non-functional\n');
  console.error('▶️  Starting anyway... Fix this ASAP to prevent memory crashes!\n');
}

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { globalErrorHandler, responseErrorInterceptor, notFoundHandler } from "./middleware/errorHandler";
import { memoryGuard } from "./utils/memoryGuard.js";
import { memoryMonitor } from "./middleware/memoryMonitor.js";

const app = express();

// Trust proxy for proper IP detection behind Replit's proxy
app.set('trust proxy', true);

// 🔧 FIX #1: ALIAS REWRITE /api/gpts/* → /gpts/* (per testing specification)
// IMPORTANT: Place BEFORE routes registration to intercept correctly
app.use('/api/gpts', (req: Request, _res: Response, next: NextFunction) => {
  // REWRITE in-place (not redirect) so HEAD/POST/GET all work properly
  req.url = req.originalUrl.replace(/^\/api\/gpts/, '/gpts');
  next();
});

// Whitelist domains for CORS
const allowedOrigins = [
  'http://localhost:5000',
  'https://guardiansofthetoken.com',
  'https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirksrv795356' // Replit domain
];

// Enhanced CORS middleware with proper origin validation
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is in whitelist or if it's a Replit domain
  if (origin && (allowedOrigins.includes(origin) || origin.includes('srv795356'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow requests without origin (like direct API calls)
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// CoinGlass Python service proxy - MOVE TO TOP!
import { createProxyMiddleware, type Options } from "http-proxy-middleware";
import type { IncomingMessage, ServerResponse } from 'http';
import { spawn } from "child_process";
import axios from "axios";

// Import metrics collector early for proxy middleware
import { metricsCollector } from "./utils/metrics";

const PY_BASE = process.env.PY_BASE || "http://127.0.0.1:8000";

// Note: Rate limiting now handled by enhanced security middleware
// which properly exempts loopback addresses and critical routes

// 💾 Enhanced Memory Cache with eviction for CoinGlass endpoints
interface CacheEntry {
  data: any;
  exp: number;
}
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 1000; // Prevent unbounded growth

// 🧹 Cache eviction and cleanup
const evictOldEntries = () => {
  const now = Date.now();
  for (const [key, value] of Array.from(cache.entries())) {
    if (value.exp < now) {
      cache.delete(key);
    }
  }
  
  // Size-based eviction if still too large
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].exp - b[1].exp); // Sort by expiration
    
    const toDelete = cache.size - MAX_CACHE_SIZE + 100; // Delete extra + buffer
    for (let i = 0; i < toDelete && i < entries.length; i++) {
      cache.delete(entries[i][0]);
    }
    log(`🧹 Cache eviction: removed ${toDelete} entries, size now: ${cache.size}`);
  }
};

// 🕒 Periodic cache cleanup every 5 minutes
setInterval(evictOldEntries, 5 * 60 * 1000);

const cacheMiddleware = (ttlMs = 15000) => {
  return (req: any, res: any, next: any) => {
    const key = req.originalUrl;
    const hit = cache.get(key);
    const now = Date.now();
    
    // Return cached response if still valid
    if (hit && hit.exp > now) {
      return res.json(hit.data);
    }
    
    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 200) {
        cache.set(key, { data: body, exp: now + ttlMs });
      }
      return originalJson(body);
    };
    
    next();
  };
};

// Apply caching to expensive endpoints
app.use("/coinglass/advanced/etf", cacheMiddleware(30000)); // 30s cache
app.use("/coinglass/advanced/market/sentiment", cacheMiddleware(15000)); // 15s cache
app.use("/coinglass/advanced/liquidation/heatmap", cacheMiddleware(10000)); // 10s cache

// Add cache for /py/* endpoints (for getCoinGlassTickerData)
app.use("/py/advanced/ticker", cacheMiddleware(5000)); // 5s cache for ticker data
app.use("/py/advanced/etf", cacheMiddleware(30000)); // 30s cache
app.use("/py/advanced/market/sentiment", cacheMiddleware(15000)); // 15s cache

// Add micro-cache for SOL complete endpoint (624ms → faster)
app.use("/api/sol/complete", cacheMiddleware(500)); // 500ms micro-cache
app.use("/api/btc/complete", cacheMiddleware(500)); // 500ms micro-cache

// 🚀 PROXY MIDDLEWARE WITH CIRCUIT BREAKER
import { coinglassCircuitBreaker } from "./utils/circuitBreaker";

// 🛡️ PRE-PROXY CIRCUIT BREAKER MIDDLEWARE - Check before proxy
app.use("/coinglass", (req, res, next) => {
  if (coinglassCircuitBreaker.isCircuitOpen()) {
    const state = coinglassCircuitBreaker.getState();
    return res.status(503).json({
      error: "CoinGlass service temporarily unavailable - circuit breaker is open",
      circuitBreaker: { failures: state.failures, isOpen: state.isOpen },
      retryAfter: "60 seconds"
    });
  }
  next();
});

app.use("/coinglass", createProxyMiddleware({
  target: PY_BASE,
  changeOrigin: true,
  pathRewrite: { "^/coinglass": "" },    // /coinglass/health -> /health
  proxyTimeout: 20000,
  onProxyReq: (proxyReq: any, req: IncomingMessage, res: ServerResponse) => {
    // Track request start time
    (req as any).startTime = Date.now();
  },
  onError: (err: Error, req: IncomingMessage, res: ServerResponse) => {
    // Track request duration and error
    const duration = (req as any).startTime ? Date.now() - (req as any).startTime : 0;
    
    // Circuit breaker logic
    coinglassCircuitBreaker.recordFailure();
    const state = coinglassCircuitBreaker.getState();
    
    // Record metrics directly (import already loaded at top)
    metricsCollector.recordCoinglassRequest(duration, true);
    // Sync circuit breaker state with metrics
    metricsCollector.updateCoinglassCircuitBreaker(state.failures, state.isOpen, state.lastFailure);
    
    if (state.isOpen) {
      log(`🔴 Circuit breaker OPEN - ${state.failures} consecutive failures`);
    }
    
    log(`[PY PROXY ERROR] ${err.message} (failures: ${state.failures})`);
    
    if (!res.headersSent) {
      const status = state.isOpen ? 503 : 502;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: state.isOpen ? "Service temporarily unavailable" : "CoinGlass service unavailable", 
        details: err.message,
        circuitBreaker: { failures: state.failures, isOpen: state.isOpen }
      }));
    }
  },
  onProxyRes: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
    // Track successful request duration
    const duration = (req as any).startTime ? Date.now() - (req as any).startTime : 0;
    const isError = proxyRes.statusCode ? proxyRes.statusCode >= 400 : false;
    
    // Circuit breaker logic
    if (!isError) {
      const hadFailures = coinglassCircuitBreaker.getState().failures > 0;
      coinglassCircuitBreaker.recordSuccess();
      if (hadFailures) {
        log(`✅ Circuit breaker RESET - service recovered`);
      }
    }
    
    const state = coinglassCircuitBreaker.getState();
    
    // Record metrics directly (import already loaded at top)
    metricsCollector.recordCoinglassRequest(duration, isError);
    // Sync circuit breaker state with metrics
    metricsCollector.updateCoinglassCircuitBreaker(state.failures, state.isOpen, state.lastFailure);
    
    // Log proxy activity for debugging
    log(`[CG PROXY] ${req.url} - ${proxyRes.statusCode} (${duration}ms)`);
  }
} as Options));

// Auto-reset circuit breaker after 1 minute
setInterval(() => {
  if (coinglassCircuitBreaker.checkAutoReset()) {
    log(`🔄 Circuit breaker auto-reset after 60 seconds`);
    // Sync with metrics collector
    const state = coinglassCircuitBreaker.getState();
    metricsCollector.updateCoinglassCircuitBreaker(state.failures, state.isOpen, state.lastFailure);
  }
}, 30000);

log(`🚀 CoinGlass Python proxy configured: /coinglass/* → ${PY_BASE} (with guard rails)`);

// 🔧 ADDITIONAL PROXY FOR /py/* PATTERNS (getCoinGlassTickerData fix)
// Pre-proxy circuit breaker for /py patterns
app.use("/py", (req, res, next) => {
  if (coinglassCircuitBreaker.isCircuitOpen()) {
    const state = coinglassCircuitBreaker.getState();
    return res.status(503).json({
      error: "CoinGlass service temporarily unavailable - circuit breaker is open",
      circuitBreaker: { failures: state.failures, isOpen: state.isOpen },
      retryAfter: "60 seconds"
    });
  }
  next();
});

app.use("/py", createProxyMiddleware({
  target: PY_BASE,
  changeOrigin: true,
  pathRewrite: { "^/py": "" },    // /py/advanced/ticker/BTC -> /advanced/ticker/BTC
  proxyTimeout: 20000,
  onProxyReq: (proxyReq: any, req: IncomingMessage, res: ServerResponse) => {
    // Track request start time
    (req as any).startTime = Date.now();
  },
  onError: (err: Error, req: IncomingMessage, res: ServerResponse) => {
    // Track request duration and error
    const duration = (req as any).startTime ? Date.now() - (req as any).startTime : 0;
    
    // Circuit breaker logic
    coinglassCircuitBreaker.recordFailure();
    const state = coinglassCircuitBreaker.getState();
    
    // Record metrics directly (import already loaded at top)
    metricsCollector.recordCoinglassRequest(duration, true);
    // Sync circuit breaker state with metrics
    metricsCollector.updateCoinglassCircuitBreaker(state.failures, state.isOpen, state.lastFailure);
    
    if (state.isOpen) {
      log(`🔴 Circuit breaker OPEN - ${state.failures} consecutive failures`);
    }
    
    log(`[PY PROXY ERROR] ${err.message} (failures: ${state.failures})`);
    
    if (!res.headersSent) {
      const status = state.isOpen ? 503 : 502;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: state.isOpen ? "Service temporarily unavailable" : "CoinGlass service unavailable", 
        details: err.message,
        circuitBreaker: { failures: state.failures, isOpen: state.isOpen }
      }));
    }
  },
  onProxyRes: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
    // Track successful request duration
    const duration = (req as any).startTime ? Date.now() - (req as any).startTime : 0;
    const isError = proxyRes.statusCode ? proxyRes.statusCode >= 400 : false;
    
    // Circuit breaker logic
    if (!isError) {
      const hadFailures = coinglassCircuitBreaker.getState().failures > 0;
      coinglassCircuitBreaker.recordSuccess();
      if (hadFailures) {
        log(`✅ Circuit breaker RESET - service recovered`);
      }
    }
    
    const state = coinglassCircuitBreaker.getState();
    
    // Record metrics directly (import already loaded at top)
    metricsCollector.recordCoinglassRequest(duration, isError);
    // Sync circuit breaker state with metrics
    metricsCollector.updateCoinglassCircuitBreaker(state.failures, state.isOpen, state.lastFailure);
    
    // Log proxy activity for debugging
    log(`[PY PROXY] ${req.url} - ${proxyRes.statusCode} (${duration}ms)`);
  }
} as Options));

log(`🚀 Python service proxy configured: /py/* → ${PY_BASE} (getCoinGlassTickerData fix)`);

// Note: GPT proxy middleware moved to after registerRoutes() to ensure Node.js routes get priority

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Start Python service as managed child process
let pythonProcessGlobal: any = null;

const startPythonService = () => {
  log("Starting CoinGlass Python service...");
  
  const pythonProcess = spawn('python3', [
    '-m', 'uvicorn', 'app.main:app', 
    '--host', '127.0.0.1', 
    '--port', '8000',
    '--workers', '1',
    '--timeout-keep-alive', '75'
  ], {
    cwd: 'coinglass-system',
    env: { 
      ...process.env, 
      PORT: '8000', 
      COINGLASS_API_KEY: process.env.COINGLASS_API_KEY,
      CG_API_KEY: process.env.COINGLASS_API_KEY  // Also set CG_API_KEY for backward compat
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pythonProcess.stdout?.on('data', (data) => {
    log(`[Python] ${data.toString().trim()}`);
  });

  pythonProcess.stderr?.on('data', (data) => {
    log(`[Python Error] ${data.toString().trim()}`);
  });

  pythonProcess.on('exit', (code) => {
    log(`Python service exited with code ${code}`);
  });

  pythonProcess.on('error', (error) => {
    log(`Failed to start Python service: ${error.message}`);
  });

  // Health check polling
  const pollHealth = async () => {
    try {
      const response = await fetch(`${PY_BASE}/health`);
      if (response.ok) {
        log("✅ CoinGlass Python service is healthy");
        return true;
      }
    } catch (error) {
      // Service not ready yet
    }
    return false;
  };

  // Wait for service to be ready
  const waitForReady = async () => {
    for (let i = 0; i < 30; i++) {
      if (await pollHealth()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    log("❌ Python service failed to start within 30 seconds");
    return false;
  };

  // Just log the health check status - proxy already active above!
  waitForReady().then((ready) => {
    if (ready) {
      log(`✅ CoinGlass Python service confirmed healthy at ${PY_BASE}`);
    } else {
      log(`⚠️ CoinGlass Python service not responding - proxy will return 502 errors`);
    }
  });
  
  pythonProcessGlobal = pythonProcess;
  return pythonProcess;
};

// 🔧 TASK 2: Graceful Shutdown Handler - Comprehensive cleanup with timeout
let isShuttingDown = false;
let httpServerGlobal: any = null; // Will be set after app.listen()

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    console.log('⚠️ [Shutdown] Already shutting down, ignoring signal:', signal);
    return;
  }
  
  isShuttingDown = true;
  console.log(`🛑 [Shutdown] Received ${signal}, initiating graceful shutdown...`);
  
  // Set 10-second overall timeout
  const shutdownTimeout = setTimeout(() => {
    console.error('❌ [Shutdown] Timeout exceeded (10s), forcing exit');
    process.exit(1);
  }, 10000);
  
  try {
    // 1. Stop MemoryGuard monitoring
    try {
      const { memoryGuard } = await import('./utils/memoryGuard.js');
      memoryGuard.stopMonitoring();
      console.log('✅ [Shutdown] MemoryGuard stopped');
    } catch (err) {
      console.error('⚠️ [Shutdown] MemoryGuard cleanup error:', err);
    }
    
    // 2. Close HTTP server
    if (httpServerGlobal) {
      await new Promise<void>((resolve, reject) => {
        httpServerGlobal.close((err: Error | undefined) => {
          if (err) {
            console.error('⚠️ [Shutdown] HTTP server close error:', err);
            reject(err);
          } else {
            console.log('✅ [Shutdown] HTTP server closed');
            resolve();
          }
        });
        // Force close after 3 seconds
        setTimeout(() => resolve(), 3000);
      });
    }
    
    // 3. Cleanup CoinAPI WebSocket (use destroy() method)
    try {
      const { coinAPIWebSocket } = await import('./services/coinapiWebSocket.js');
      coinAPIWebSocket.destroy();
      console.log('✅ [Shutdown] CoinAPI WebSocket destroyed');
    } catch (err) {
      console.error('⚠️ [Shutdown] CoinAPI cleanup error:', err);
    }
    
    // 4. Cleanup OKX service
    try {
      const { okxService } = await import('./services/okx.js');
      if (okxService?.cleanup) {
        okxService.cleanup();
        console.log('✅ [Shutdown] OKX service cleaned up');
      }
    } catch (err) {
      console.error('⚠️ [Shutdown] OKX cleanup error:', err);
    }
    
    // 4b. Cleanup Binance Liquidation WebSocket
    try {
      const { binanceLiquidationWS } = await import('./services/binanceLiquidationWebSocket.js');
      await binanceLiquidationWS.stop();
      console.log('✅ [Shutdown] Binance Liquidation WebSocket stopped');
    } catch (err) {
      console.error('⚠️ [Shutdown] Binance WS cleanup error:', err);
    }
    
    // 5. Kill Python process (SIGTERM with 2s timeout, then SIGKILL)
    if (pythonProcessGlobal) {
      pythonProcessGlobal.kill('SIGTERM');
      console.log('📤 [Shutdown] Sent SIGTERM to Python process');
      
      await new Promise<void>((resolve) => {
        const killTimeout = setTimeout(() => {
          if (pythonProcessGlobal && !pythonProcessGlobal.killed) {
            pythonProcessGlobal.kill('SIGKILL');
            console.log('💀 [Shutdown] Sent SIGKILL to Python process (SIGTERM timeout)');
          }
          resolve();
        }, 2000);
        
        pythonProcessGlobal.on('exit', () => {
          clearTimeout(killTimeout);
          console.log('✅ [Shutdown] Python process terminated');
          resolve();
        });
      });
    }
    
    // 6. Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️ [Shutdown] Manual GC triggered');
    }
    
    clearTimeout(shutdownTimeout);
    console.log('✅ [Shutdown] Graceful shutdown complete');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ [Shutdown] Error during shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

// Register comprehensive shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
process.on('uncaughtException', (err) => {
  console.error('💥 [Shutdown] Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 [Shutdown] Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

// Python service will be started AFTER app.listen() to prevent blocking startup

// Observability will be initialized after routes registration

// Import enhanced security middleware
import { enhancedRateLimit, InputSanitizer, getEnhancedSecurityMetrics } from "./middleware/security";

// Apply enhanced security middleware (before other middleware for maximum protection)
// Route exemptions now handled within the enhanced rate limiter
app.use(enhancedRateLimit);
app.use(InputSanitizer.validateInput);

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  // Production-ready CSP with explicit domain allowlists
  const isDev = process.env.NODE_ENV === 'development';
  
  let cspPolicy;
  if (isDev) {
    // Development: Allow unsafe directives for dev tools and localhost
    cspPolicy = "default-src 'self' http: https: ws: wss: 'unsafe-inline' 'unsafe-eval'";
  } else {
    // Production: Secure CSP with explicit domain allowlists
    cspPolicy = [
      "default-src 'self'",
      "connect-src 'self' https://ws.okx.com wss://ws.okx.com https://rest.coinapi.io https://api.coinapi.io https://api.binance.com wss://stream.binance.com wss://*srv795356 https://*srv795356",
      "script-src 'self' 'sha256-n8Z7m8gNNvJlTq/Z+o4LH8rTq7PpOLz5Z1oN1eNhK5o=' 'nonce-trading-view'",
      "style-src 'self' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=' 'sha256-VQAKPRQs+v2o0Z0Q6QJ1FJ0+Z8K3U7W8tKJ7+J3w3tA='",
      "font-src 'self' data:",
      "img-src 'self' data: https:",
      "media-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
  }
  
  res.setHeader('Content-Security-Policy', cspPolicy);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Enhanced logging and metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 400;
    
    // Record metrics for all requests
    metricsCollector.recordHttpRequest(duration, isError);
    
    if (path.startsWith("/api") || path === "/healthz" || path === "/metrics") {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Observability and alerts will be initialized AFTER app.listen() to prevent blocking startup

  // Add response error interceptor before routes
  app.use(responseErrorInterceptor);

  // 🔄 GPTs routing fix: Rewrite in-place alias /api/gpts/* → /gpts/*
  app.use('/api/gpts', (req, _res, next) => {
    req.url = req.originalUrl.replace(/^\/api\/gpts/, '/gpts');
    next();
  });

  const server = await registerRoutes(app);
  
  // Set global server reference for graceful shutdown
  httpServerGlobal = server;

  // 🔥 Register Unified Heatmap Routes
  const heatmapRoutes = (await import('./routes/heatmap')).default;
  app.use('/api/heatmap', heatmapRoutes);
  log('🔥 Unified Heatmap API registered at /api/heatmap/*');

  // 📊 Register Phase 5 Backtest Routes
  const backtestRoutes = (await import('./routes/backtest')).default;
  app.use('/api/backtest', backtestRoutes);
  log('📊 Phase 5 Backtest API registered at /api/backtest/*');

  // 📱 Register Telegram Test Routes
  const telegramTestRoutes = (await import('./routes/telegram-test')).default;
  app.use('/api/telegram', telegramTestRoutes);
  log('📱 Telegram Bot Test API registered at /api/telegram/*');

  // 🔄 Backward compatibility aliases
  
  // /api/gpts/* → /gpts/*
  app.use('/api/gpts', (req, res) => {
    const target = req.originalUrl.replace(/^\/api\/gpts/, '/gpts');
    return res.redirect(308, target);
  });
  
  // /advanced/* → /py/advanced/* (two-way compatibility)
  app.use('/advanced', (req, res) => {
    const target = req.originalUrl.replace(/^\/advanced/, '/py/advanced');
    return res.redirect(308, target);
  });

  // 🎯 GPTs Gateway proxy middleware (AFTER Node.js routes to ensure Node.js gets priority)
  // This handles /gpts/* routes that weren't handled by Node.js (like /gpts/institutional/bias)
  app.use("/gpts", createProxyMiddleware({
    target: PY_BASE,
    changeOrigin: true,
    pathRewrite: { "^/gpts": "" },    // /gpts/institutional/bias -> /institutional/bias
    proxyTimeout: 15000,
    onProxyReq: (proxyReq: any, req: IncomingMessage, res: ServerResponse) => {
      (req as any).startTime = Date.now();
      log(`[GPTs Gateway] Proxying fallback route: ${req.url} → ${PY_BASE}${req.url?.replace('/gpts', '')}`);
    },
    onError: (err: Error, req: IncomingMessage, res: ServerResponse) => {
      const duration = (req as any).startTime ? Date.now() - (req as any).startTime : 0;
      log(`[GPTs Gateway Error] ${req.url} failed: ${err.message} (${duration}ms)`);
      
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          error: "GPTs Gateway service unavailable", 
          details: err.message,
          url: req.url
        }));
      }
    },
    onProxyRes: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
      const duration = (req as any).startTime ? Date.now() - (req as any).startTime : 0;
      log(`[GPTs Gateway] ${req.url} → ${proxyRes.statusCode} (${duration}ms)`);
    }
  } as Options));

  log(`🤖 GPTs Gateway fallback proxy configured: Node.js routes first, then → ${PY_BASE}`);

  // Serve OpenAPI schema explicitly
  const path = await import('path');
  app.get('/openapi-4.0.1-gpts-compat.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.resolve(process.cwd(), 'public/openapi-4.0.1-gpts-compat.yaml'));
  });

  // Memory monitoring endpoint
  app.get('/health/memory', memoryMonitor);

  // 🔧 TASK 6: Memory Debug Endpoints
  app.get('/api/debug/memory', async (req, res) => {
    const usage = process.memoryUsage();
    const v8 = await import('v8');
    const heapStats = v8.getHeapStatistics();
    
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const heapLimitMB = heapStats.heap_size_limit / 1024 / 1024;
    const heapPercent = (heapUsedMB / heapTotalMB) * 100;
    const rssMB = usage.rss / 1024 / 1024;
    const externalMB = usage.external / 1024 / 1024;
    const arrayBuffersMB = usage.arrayBuffers / 1024 / 1024;
    const uptimeMinutes = Math.floor(process.uptime() / 60);
    
    res.json({
      success: true,
      memory: {
        heap: {
          used: heapUsedMB.toFixed(2) + ' MB',
          total: heapTotalMB.toFixed(2) + ' MB',
          limit: heapLimitMB.toFixed(2) + ' MB',
          percent: heapPercent.toFixed(1) + '%'
        },
        rss: rssMB.toFixed(2) + ' MB',
        external: externalMB.toFixed(2) + ' MB',
        arrayBuffers: arrayBuffersMB.toFixed(2) + ' MB'
      },
      uptime: {
        minutes: uptimeMinutes,
        formatted: `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}m`
      },
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/debug/gc', (req, res) => {
    if (!global.gc) {
      return res.status(503).json({
        success: false,
        error: 'Manual GC not available',
        hint: 'Start Node.js with --expose-gc flag'
      });
    }

    const before = process.memoryUsage();
    const beforeHeapMB = before.heapUsed / 1024 / 1024;

    global.gc();

    const after = process.memoryUsage();
    const afterHeapMB = after.heapUsed / 1024 / 1024;
    const freedMB = beforeHeapMB - afterHeapMB;

    res.json({
      success: true,
      result: {
        before: beforeHeapMB.toFixed(2) + ' MB',
        after: afterHeapMB.toFixed(2) + ' MB',
        freed: freedMB.toFixed(2) + ' MB',
        freedPercent: ((freedMB / beforeHeapMB) * 100).toFixed(1) + '%'
      },
      timestamp: new Date().toISOString()
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Enhanced error handlers with Telegram alerting and monitoring
  // IMPORTANT: Place AFTER Vite setup so frontend routes are served first
  app.use(notFoundHandler);  // Handle 404 errors
  app.use(globalErrorHandler);  // Handle all errors (5xx) with production alerts

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const startTime = Date.now();
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    const listenDuration = Date.now() - startTime;
    log(`✅ Server listening on port ${port} in ${listenDuration}ms`);
    
    // 🚀 START BACKGROUND SERVICES AFTER SERVER IS LISTENING
    // This ensures health checks pass quickly while services initialize in background
    
    // Start Memory Guard - monitors memory and prevents OOM crashes
    memoryGuard.startMonitoring();
    log("🧠 MemoryGuard: Auto-recovery system active");
    
    // Start Python service (non-blocking) - runs in all environments
    try {
      log("🐍 Starting Python service in background...");
      const pythonProc = startPythonService();
      log(`🐍 Python service spawn initiated, PID: ${pythonProc?.pid || 'pending'}`);
    } catch (error: any) {
      log(`❌ Python service start error: ${error?.message || String(error)}`);
    }
    
    // 🔧 TASK 5: Conditional OpenTelemetry (~15MB saved when disabled)
    (async () => {
      const ENABLE_TELEMETRY = process.env.ENABLE_TELEMETRY === 'true';
      
      if (!ENABLE_TELEMETRY) {
        log("⚠️ OpenTelemetry DISABLED (set ENABLE_TELEMETRY=true to enable)");
        log("💾 Memory saved: ~15MB (tracing overhead)");
        return;
      }
      
      try {
        const { initObservability } = await import("../screening-module/backend/observability");
        initObservability(app);
        log("✅ Observability system initialized (OpenTelemetry enabled)");
      } catch (error: any) {
        log(`⚠️ Observability init failed: ${error?.message || String(error)}`);
      }
    })();
    
    // Initialize Institutional Alert System (non-blocking)
    (async () => {
      try {
        const { startInstitutionalScheduler, startSniperScheduler } = await import("./schedulers/institutional");
        startInstitutionalScheduler();
        
        // 🔬 MEMORY LEAK INVESTIGATION: Temporarily disabled Enhanced Sniper
        // Testing if this is the source of heap growth 87%→91%+ in 20s
        // startSniperScheduler();
        log("✅ Institutional Alert System initialized (⚠️ Enhanced Sniper DISABLED for leak test)");
      } catch (error: any) {
        log(`⚠️ Institutional alerts init failed: ${error?.message || String(error)}`);
      }
    })();
    
    // Initialize New Listing Detection System (non-blocking)
    (async () => {
      try {
        const { startListingScheduler } = await import("./services/listing-scheduler");
        startListingScheduler();
        log("✅ New Listing Detection System initialized");
      } catch (error: any) {
        log(`⚠️ Listing scheduler init failed: ${error?.message || String(error)}`);
      }
    })();
    
    // Initialize Brain Orchestrator - Central Intelligence Layer (non-blocking)
    (async () => {
      try {
        // Register module change to trigger 5-minute grace period
        memoryGuard.registerModuleChange();
        
        const { brainOrchestrator } = await import("./brain/orchestrator");
        
        // MEMORY OPTIMIZATION: Skip initial run to reduce startup memory pressure
        // Brain will run after 15min when system is stable
        log("🧠 Brain Orchestrator: Initial run skipped (memory optimization)");
        
        // Schedule every 15 minutes
        setInterval(() => {
          brainOrchestrator.run(['BTC', 'ETH', 'SOL']).catch(err => {
            log(`⚠️ Brain orchestrator run failed: ${err.message}`);
          });
        }, 15 * 60 * 1000); // 15 minutes
        
        log("🧠 Brain Orchestrator initialized - monitoring every 15min");
      } catch (error: any) {
        log(`⚠️ Brain orchestrator init failed: ${error?.message || String(error)}`);
      }
    })();
    
    // Initialize Enhanced Signal Monitor - Event-driven Telegram alerts (non-blocking)
    (async () => {
      try {
        const { startEnhancedSignalMonitor } = await import("./schedulers/enhancedSignalMonitor");
        startEnhancedSignalMonitor();
        log("✅ Enhanced Signal Monitor initialized - Telegram alerts active");
      } catch (error: any) {
        log(`⚠️ Enhanced Signal Monitor init failed: ${error?.message || String(error)}`);
      }
    })();
    
    // Initialize Binance Liquidation WebSocket - Real-time liquidation tracking (non-blocking)
    (async () => {
      try {
        const { binanceLiquidationWS } = await import("./services/binanceLiquidationWebSocket");
        const TRACKED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'BNBUSDT'];
        
        await binanceLiquidationWS.start(TRACKED_SYMBOLS);
        log(`🔥 Binance Liquidation WebSocket initialized - tracking ${TRACKED_SYMBOLS.length} symbols`);
        
        // Log status after 5 seconds
        setTimeout(() => {
          const status = binanceLiquidationWS.getStatus();
          if (status.connected) {
            log(`✅ Binance Liquidation WS connected - ${status.totalMessages} liquidations received`);
          } else {
            log(`⚠️ Binance Liquidation WS not connected - reconnecting...`);
          }
        }, 5000);
      } catch (error: any) {
        log(`⚠️ Binance Liquidation WebSocket init failed: ${error?.message || String(error)}`);
      }
    })();
    
    // MEMORY LEAK FIX TEST: CoinAPI WebSocket DISABLED temporarily to isolate leak source
    // Issue: Message queue fills (1000), drops messages → sequence gaps → REST recovery → memory exhaustion
    /*
    (async () => {
      try {
        const { coinAPIWebSocket } = await import("./services/coinapiWebSocket");
        log("🌐 CoinAPI WebSocket initialized - real-time order book streaming active");
        
        // Log connection status after 3 seconds
        setTimeout(() => {
          const health = coinAPIWebSocket.getHealth();
          if (health.wsConnected) {
            log(`✅ CoinAPI WebSocket connected - ${health.totalMessagesReceived} messages received`);
          } else {
            log(`⚠️ CoinAPI WebSocket not connected - reconnecting... (attempt ${health.reconnectAttempts})`);
          }
        }, 3000);
      } catch (error: any) {
        log(`⚠️ CoinAPI WebSocket init failed: ${error?.message || String(error)}`);
      }
    })();
    */
    log("⚠️ CoinAPI WebSocket DISABLED for memory leak isolation test");
    
    log(`🚀 Total startup time: ${Date.now() - startTime}ms`);
  });
})();

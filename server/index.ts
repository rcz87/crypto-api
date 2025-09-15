// Set TensorFlow quiet mode to reduce log noise
process.env.TF_CPP_MIN_LOG_LEVEL = '2';

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Trust proxy for proper IP detection behind Replit's proxy
app.set('trust proxy', 1);

// Whitelist domains for CORS
const allowedOrigins = [
  'http://localhost:5000',
  'https://guardiansofthegreentoken.com',
  'https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev' // Replit domain
];

// Enhanced CORS middleware with proper origin validation
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is in whitelist or if it's a Replit domain
  if (origin && (allowedOrigins.includes(origin) || origin.includes('.replit.dev'))) {
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
import { createProxyMiddleware } from "http-proxy-middleware";
import { spawn } from "child_process";
import fetch from "node-fetch";

const PY_BASE = process.env.PY_BASE || "http://127.0.0.1:8000";

// 🛡️ GUARD RAILS - Rate Limiting for Python API
import rateLimit from "express-rate-limit";

const pyRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 120, // Limit each IP to 120 requests per minute
  message: { error: "Too many requests to CoinGlass API, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/py", pyRateLimit);

// 💾 Enhanced Memory Cache with eviction for CoinGlass endpoints
const cache = new Map();
const MAX_CACHE_SIZE = 1000; // Prevent unbounded growth

// 🧹 Cache eviction and cleanup
const evictOldEntries = () => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.exp < now) {
      cache.delete(key);
    }
  }
  
  // Size-based eviction if still too large
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => (a[1] as any).exp - (b[1] as any).exp); // Sort by expiration
    
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
app.use("/py/advanced/etf", cacheMiddleware(30000)); // 30s cache
app.use("/py/advanced/market/sentiment", cacheMiddleware(15000)); // 15s cache
app.use("/py/advanced/liquidation/heatmap", cacheMiddleware(10000)); // 10s cache

// Add micro-cache for SOL complete endpoint (624ms → faster)
app.use("/api/sol/complete", cacheMiddleware(500)); // 500ms micro-cache
app.use("/api/btc/complete", cacheMiddleware(500)); // 500ms micro-cache

// 🚀 PROXY MIDDLEWARE WITH CIRCUIT BREAKER
let circuitBreaker = { failures: 0, lastFailure: null, isOpen: false };

// 🛡️ PRE-PROXY CIRCUIT BREAKER MIDDLEWARE - Check before proxy
app.use("/py", (req, res, next) => {
  if (circuitBreaker.isOpen) {
    return res.status(503).json({
      error: "Service temporarily unavailable - circuit breaker is open",
      circuitBreaker: { failures: circuitBreaker.failures, isOpen: circuitBreaker.isOpen },
      retryAfter: "60 seconds"
    });
  }
  next();
});

app.use("/py", createProxyMiddleware({
  target: PY_BASE,
  changeOrigin: true,
  pathRewrite: { "^/py": "" },    // /py/health -> /health
  proxyTimeout: 20000,
  onError: (err, req, res) => {
    // Circuit breaker logic
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();
    
    if (circuitBreaker.failures >= 5) {
      circuitBreaker.isOpen = true;
      log(`🔴 Circuit breaker OPEN - ${circuitBreaker.failures} consecutive failures`);
    }
    
    log(`[PY PROXY ERROR] ${err.message} (failures: ${circuitBreaker.failures})`);
    
    if (!res.headersSent) {
      const status = circuitBreaker.isOpen ? 503 : 502;
      res.status(status).json({ 
        error: circuitBreaker.isOpen ? "Service temporarily unavailable" : "CoinGlass service unavailable", 
        details: err.message,
        circuitBreaker: { failures: circuitBreaker.failures, isOpen: circuitBreaker.isOpen }
      });
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Reset circuit breaker on successful response
    if (proxyRes.statusCode && proxyRes.statusCode < 400) {
      if (circuitBreaker.failures > 0) {
        log(`✅ Circuit breaker RESET - service recovered`);
      }
      circuitBreaker.failures = 0;
      circuitBreaker.isOpen = false;
    }
  }
}));

// Auto-reset circuit breaker after 1 minute
setInterval(() => {
  if (circuitBreaker.isOpen && circuitBreaker.lastFailure) {
    const timeSinceFailure = Date.now() - circuitBreaker.lastFailure;
    if (timeSinceFailure > 60000) {
      circuitBreaker.isOpen = false;
      log(`🔄 Circuit breaker auto-reset after 60 seconds`);
    }
  }
}, 30000);

log(`🚀 CoinGlass Python proxy configured: /py/* → ${PY_BASE} (with guard rails)`);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Start Python service as managed child process
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
    env: { ...process.env, PORT: '8000', COINGLASS_API_KEY: process.env.CG_API_KEY },
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

  // Clean shutdown
  process.on('SIGTERM', () => pythonProcess.kill());
  process.on('SIGINT', () => pythonProcess.kill());
  process.on('exit', () => pythonProcess.kill());
  
  return pythonProcess;
};

// Start Python service
startPythonService();

// Observability will be initialized after routes registration

// Import metrics collector
import { metricsCollector } from "./utils/metrics";

// Import enhanced security middleware
import { enhancedRateLimit, InputSanitizer, getEnhancedSecurityMetrics } from "./middleware/security";

// Apply enhanced security middleware (before other middleware for maximum protection)
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
      "connect-src 'self' https://ws.okx.com wss://ws.okx.com https://rest.coinapi.io https://api.coinapi.io https://api.binance.com wss://stream.binance.com wss://*.replit.dev https://*.replit.dev",
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
  // Initialize observability system (metrics, tracing, alerts)
  try {
    const { initObservability } = await import("../screening-module/backend/observability");
    initObservability(app);
    log("Observability system initialized successfully");
  } catch (error: any) {
    log(`Failed to initialize observability: ${error?.message || String(error)}`);
  }

  // 🚀 Initialize Institutional Alert System
  try {
    const { startInstitutionalScheduler, startSniperScheduler } = await import("./schedulers/institutional.js");
    startInstitutionalScheduler();
    startSniperScheduler();
    log("✅ Institutional Alert System initialized - bias & sniper alerts active");
  } catch (error: any) {
    log(`❌ Failed to initialize institutional alerts: ${error?.message || String(error)}`);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve OpenAPI schema explicitly BEFORE Vite in both modes
  const path = await import('path');
  app.get('/openapi-4.0.1-gpts-compat.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(path.resolve(process.cwd(), 'public/openapi-gpts-clean.yaml'));
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

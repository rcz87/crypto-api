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

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Observability will be initialized after routes registration

// Import metrics collector
import { metricsCollector } from "./utils/metrics";

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Content-Security-Policy', "default-src 'self' https: wss: 'unsafe-inline' 'unsafe-eval'");
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

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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

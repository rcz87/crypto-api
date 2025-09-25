# 🔒 SECURITY VULNERABILITIES - CRITICAL FIX

## 🚨 CRITICAL SECURITY ISSUES OVERVIEW

Berdasarkan analisis mendalam, berikut adalah 8 security vulnerabilities critical yang ditemukan dan solusi lengkapnya:

---

## 🔴 1. AUTHENTICATION BYPASS VULNERABILITY

### Problem:
- Tidak ada sistem autentikasi
- Semua API endpoints terbuka untuk public access
- Tidak ada API key validation

### Impact:
- Unauthorized access ke semua endpoints
- Data exposure
- Potential abuse dan DoS attacks

### Solution:

**1. Buat file `server/middleware/auth.ts`:**
```typescript
import { Request, Response, NextFunction } from 'express';

interface ApiKeyData {
  id: string;
  key: string;
  userId: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: ApiKeyData;
      apiKey?: string;
    }
  }
}

// Temporary API keys - replace with database in production
const API_KEYS_DB = new Map<string, ApiKeyData>([
  ['test-key-123', {
    id: '1',
    key: 'test-key-123',
    userId: 'user-1',
    permissions: ['read', 'write'],
    rateLimit: 100,
    isActive: true
  }],
  ['admin-key-456', {
    id: '2', 
    key: 'admin-key-456',
    userId: 'admin-1',
    permissions: ['read', 'write', 'admin'],
    rateLimit: 1000,
    isActive: true
  }]
]);

export const authenticateApiKey = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    const keyData = API_KEYS_DB.get(apiKey);
    
    if (!keyData || !keyData.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    req.user = keyData;
    req.apiKey = apiKey;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permission,
        available: req.user.permissions
      });
    }

    next();
  };
};
```

**2. Update `server/index.ts` - Add after CORS setup:**
```typescript
// Import authentication
import { authenticateApiKey, requirePermission } from './middleware/auth';

// Apply authentication to API routes (skip health check)
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/healthz') {
    return next();
  }
  authenticateApiKey(req, res, next);
});

// Premium endpoints require admin permission
app.use('/api/premium', requirePermission('admin'));
```

---

## 🔴 2. CORS SECURITY VULNERABILITY

### Problem:
- CORS configuration terlalu permissive (`Access-Control-Allow-Origin: *`)
- Memungkinkan akses dari domain manapun
- Tidak ada origin validation

### Impact:
- Cross-site request forgery (CSRF)
- Data leakage ke unauthorized domains
- Potential malicious site access

### Solution:

**Update `server/index.ts` - Replace CORS section:**
```typescript
// Secure CORS configuration
const allowedOrigins = [
  'https://guardiansofthegreentoken.com',
  'https://your-production-domain.com',
  ...(process.env.NODE_ENV === 'development' ? [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  ] : [])
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow requests without origin (Postman, curl)
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    console.warn(`Blocked unauthorized origin: ${origin}`);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
```

---

## 🔴 3. WEBSOCKET MEMORY LEAKS

### Problem:
- WebSocket connections tidak dibersihkan dengan benar
- Tidak ada connection health checks
- Tidak ada backpressure control

### Impact:
- Memory leaks
- Server crash pada high traffic
- Resource exhaustion

### Solution:

**Create file `server/utils/websocketManager.ts`:**
```typescript
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  lastPing: number;
  isAlive: boolean;
  subscriptions: Set<string>;
}

export class WebSocketManager {
  private clients = new Map<string, ClientConnection>();
  private cleanupInterval: NodeJS.Timeout;
  private pingInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, 30000);

    this.pingInterval = setInterval(() => {
      this.pingAllClients();
    }, 30000);

    console.log('WebSocketManager initialized');
  }

  addClient(ws: WebSocket, userId?: string): string {
    const clientId = uuidv4();
    
    const client: ClientConnection = {
      id: clientId,
      ws,
      userId,
      lastPing: Date.now(),
      isAlive: true,
      subscriptions: new Set()
    };

    this.clients.set(clientId, client);

    ws.on('pong', () => {
      client.isAlive = true;
      client.lastPing = Date.now();
    });

    ws.on('close', () => {
      this.removeClient(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.removeClient(clientId);
    });

    console.log(`Client connected: ${clientId} (Total: ${this.clients.size})`);
    return clientId;
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close();
        }
      } catch (error) {
        console.error(`Error closing WebSocket for ${clientId}:`, error);
      }
      
      this.clients.delete(clientId);
      console.log(`Client disconnected: ${clientId} (Total: ${this.clients.size})`);
    }
  }

  broadcast(data: any): void {
    const message = JSON.stringify(data);
    let sentCount = 0;
    let failedCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          if (client.ws.bufferedAmount < 1024 * 1024) { // 1MB limit
            client.ws.send(message);
            sentCount++;
          } else {
            console.warn(`Client ${clientId} buffer full, skipping message`);
            failedCount++;
          }
        } else {
          this.removeClient(clientId);
          failedCount++;
        }
      } catch (error) {
        console.error(`Failed to send to client ${clientId}:`, error);
        this.removeClient(clientId);
        failedCount++;
      }
    }

    if (sentCount > 0 || failedCount > 0) {
      console.log(`Broadcast: ${sentCount} sent, ${failedCount} failed`);
    }
  }

  private cleanupDeadConnections(): void {
    const deadClients: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.CLOSED || 
          client.ws.readyState === WebSocket.CLOSING) {
        deadClients.push(clientId);
      }
    }

    deadClients.forEach(clientId => {
      this.removeClient(clientId);
    });

    if (deadClients.length > 0) {
      console.log(`Cleaned up ${deadClients.length} dead connections`);
    }
  }

  private pingAllClients(): void {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (!client.isAlive) {
          console.log(`Client ${clientId} didn't respond to ping, removing`);
          this.removeClient(clientId);
          continue;
        }

        client.isAlive = false;
        try {
          client.ws.ping();
        } catch (error) {
          console.error(`Failed to ping client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }
  }

  getStats() {
    return {
      totalClients: this.clients.size,
      activeClients: Array.from(this.clients.values())
        .filter(c => c.ws.readyState === WebSocket.OPEN).length
    };
  }

  shutdown(): void {
    console.log('Shutting down WebSocketManager...');
    
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);

    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(1000, 'Server shutdown');
        }
      } catch (error) {
        console.error(`Error closing client ${clientId}:`, error);
      }
    }

    this.clients.clear();
    console.log('WebSocketManager shutdown complete');
  }
}

export const wsManager = new WebSocketManager();

process.on('SIGTERM', () => wsManager.shutdown());
process.on('SIGINT', () => wsManager.shutdown());
```

**Update `server/routes.ts` - Replace WebSocket section:**
```typescript
import { wsManager } from './utils/websocketManager';

// In registerRoutes function, replace WebSocket setup:
wss.on('connection', (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';
  console.log(`New WebSocket connection from ${clientIp}`);
  
  const clientId = wsManager.addClient(ws);
  
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    clientId,
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Message from ${clientId}:`, data);
      
      ws.send(JSON.stringify({
        type: 'response',
        originalMessage: data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Error parsing message from ${clientId}:`, error);
    }
  });
});

// Replace all broadcast calls:
// OLD: connectedClients.forEach(...)
// NEW: wsManager.broadcast(data)
```

---

## 🔴 4. ENVIRONMENT VARIABLE EXPOSURE

### Problem:
- Sensitive data di logs
- Tidak ada environment validation
- Environment variables exposed dalam error messages

### Impact:
- Credential exposure
- Security breach
- Configuration leaks

### Solution:

**Create file `server/utils/envValidator.ts`:**
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  CG_API_KEY: z.string().min(1, 'CoinGlass API key is required'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters').optional(),
  REDIS_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info')
});

export function validateEnvironment() {
  try {
    const env = envSchema.parse(process.env);
    
    // Log safe configuration
    console.log('Environment configuration loaded:', {
      NODE_ENV: env.NODE_ENV,
      PORT: env.PORT,
      DATABASE_URL: env.DATABASE_URL ? '[CONFIGURED]' : '[MISSING]',
      CG_API_KEY: env.CG_API_KEY ? '[CONFIGURED]' : '[MISSING]',
      JWT_SECRET: env.JWT_SECRET ? '[CONFIGURED]' : '[NOT SET]',
      REDIS_URL: env.REDIS_URL ? '[CONFIGURED]' : '[NOT SET]',
      LOG_LEVEL: env.LOG_LEVEL
    });
    
    return env;
  } catch (error) {
    console.error('Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`- ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}
```

**Update `server/index.ts` - Add at the beginning:**
```typescript
import { validateEnvironment } from './utils/envValidator';

// Validate environment variables first
const env = validateEnvironment();
```

---

## 🔴 5. UNHANDLED PROMISE REJECTIONS

### Problem:
- Banyak async operations tanpa proper error handling
- Unhandled promise rejections
- Inconsistent error responses

### Impact:
- Server crashes
- Unpredictable behavior
- Poor user experience

### Solution:

**Create file `server/middleware/errorHandler.ts`:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] as string || 
    Math.random().toString(36).substring(7);

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = error.errors;
  }

  console.error(`[${requestId}] ${req.method} ${req.path}:`, {
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    statusCode
  });

  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      details
    },
    requestId,
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`
    },
    timestamp: new Date().toISOString()
  });
};
```

**Update `server/index.ts` - Add at the end:**
```typescript
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Add before server.listen()
app.use(notFoundHandler);
app.use(errorHandler);
```

**Update service methods with proper error handling:**
```typescript
// Example for OKX service
async getCandles(symbol: string, timeframe: string, limit: number): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${this.baseUrl}/candles?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`, {
      signal: controller.signal,
      headers: this.getHeaders()
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new ApiError('OKX_API_ERROR', `HTTP ${response.status}: ${response.statusText}`, 502);
    }

    const data = await response.json();
    return data.candles || [];
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('OKX_TIMEOUT', 'Request to OKX API timed out', 504);
    }
    
    console.error(`Failed to get candles for ${symbol}:`, error);
    throw new ApiError('OKX_API_ERROR', error.message || 'Failed to fetch candles', 502);
  }
}
```

---

## 🔴 6. RATE LIMITING BYPASS

### Problem:
- Rate limiting hanya berdasarkan IP
- Tidak ada rate limiting per API key
- Mudah di-bypass dengan IP rotation

### Impact:
- DoS attacks
- API abuse
- Resource exhaustion

### Solution:

**Create file `server/middleware/rateLimit.ts`:**
```typescript
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Track rate limits per API key
const apiKeyLimits = new Map<string, number>();

// Multi-layer rate limiting
export const createRateLimiter = () => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: (req: Request) => {
      // Get API key if available
      const apiKey = req.headers['x-api-key'] as string;
      
      // If API key exists, use its custom limit
      if (apiKey && req.user?.rateLimit) {
        return req.user.rateLimit;
      }
      
      // Default limits based on path
      if (req.path.startsWith('/api/premium')) {
        return 200; // Higher limit for premium endpoints
      } else if (req.path.startsWith('/api/sol/complete')) {
        return 30; // Lower limit for expensive endpoints
      }
      
      // Default limit
      return 100;
    },
    keyGenerator: (req: Request) => {
      // Use multiple identifiers for better security
      const ip = req.ip || req.socket.remoteAddress || '';
      const userAgent = req.get('User-Agent') || '';
      const apiKey = req.headers['x-api-key'] as string || '';
      
      // Create composite key
      return `${ip}:${apiKey}:${crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8)}`;
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
        timestamp: new Date().toISOString()
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/healthz';
    }
  });
};

// Apply rate limiting middleware
export const enhancedRateLimit = createRateLimiter();
```

**Update `server/index.ts` - Add after CORS middleware:**
```typescript
import { enhancedRateLimit } from './middleware/rateLimit';

// Apply rate limiting
app.use(enhancedRateLimit);
```

---

## 🔴 7. SQL INJECTION VULNERABILITY

### Problem:
- Raw SQL queries dengan user input
- Tidak ada parameterized queries
- Tidak ada input sanitization

### Impact:
- Database compromise
- Data theft
- Unauthorized access

### Solution:

**Update database queries to use parameterized queries:**
```typescript
// BAD:
const query = `SELECT * FROM logs WHERE level = '${level}'`; // Vulnerable

// GOOD:
const query = `SELECT * FROM logs WHERE level = $1`;
const result = await db.query(query, [level]);

// Or with Drizzle ORM (already implemented correctly):
const logs = await db.select()
  .from(logsTable)
  .where(eq(logsTable.level, level)); // Safe
```

**Add input validation with Zod:**
```typescript
import { z } from 'zod';

// Define schema
const logQuerySchema = z.object({
  level: z.enum(['info', 'warn', 'error', 'debug']),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0)
});

// Validate input
app.get('/api/logs', async (req: Request, res: Response) => {
  try {
    // Validate and sanitize input
    const params = logQuerySchema.parse({
      level: req.query.level,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    });
    
    // Use validated params with ORM
    const logs = await db.select()
      .from(logsTable)
      .where(eq(logsTable.level, params.level))
      .limit(params.limit)
      .offset(params.offset);
    
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error); // Will be handled by error middleware
  }
});
```

---

## 🔴 8. SERVER STARTUP ISSUES

### Problem:
- Environment variables tidak work di Windows
- Missing dependencies
- Cross-platform compatibility issues

### Impact:
- Server tidak bisa start
- Development environment issues
- Deployment failures

### Solution:

**Update `package.json` scripts:**
```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development tsx server/index.ts",
    "start": "cross-env NODE_ENV=production node dist/index.js",
    "dev:win": "set NODE_ENV=development && tsx server/index.ts",
    "start:win": "set NODE_ENV=production && node dist/index.js",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  },
  "devDependencies": {
    "cross-env": "^7.0.3"
  }
}
```

**Install missing dependencies:**
```bash
npm install cross-env --save-dev
npm install http-proxy-middleware --save
```

**Create setup script for Windows:**
```batch
@echo off
echo Setting up development environment...
set NODE_ENV=development
npm install
echo Environment setup complete!
npx tsx server/index.ts
```

---

## 🧪 TESTING IMPLEMENTATION

### Test Authentication:
```bash
# Test without API key (should fail)
curl -X GET http://localhost:5000/api/sol/complete

# Test with valid API key (should work)
curl -X GET http://localhost:5000/api/sol/complete \
  -H "X-API-Key: test-key-123"

# Test health check (should work without API key)
curl -X GET http://localhost:5000/health
```

### Test CORS:
```bash
# Test allowed origin
curl -X GET http://localhost:5000/api/health \
  -H "Origin: http://localhost:3000" \
  -H "X-API-Key: test-key-123"

# Test blocked origin
curl -X GET http://localhost:5000/api/health \
  -H "Origin: http://malicious-site.com" \
  -H "X-API-Key: test-key-123"
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Today (Critical):
- [ ] Install cross-env: `npm install cross-env --save-dev`
- [ ] Update package.json scripts
- [ ] Create auth middleware file
- [ ] Update server/index.ts with authentication
- [ ] Fix CORS configuration
- [ ] Create WebSocket manager
- [ ] Add error handling middleware
- [ ] Add input validation
- [ ] Test all endpoints with API keys

### This Week:
- [ ] Implement rate limiting
- [ ] Add environment validation
- [ ] Fix SQL injection vulnerabilities
- [ ] Test security improvements
- [ ] Document security changes

---

## 🚨 SECURITY BEST PRACTICES

1. **Always use API keys** for authentication
2. **Validate all input** with Zod schemas
3. **Use parameterized queries** for database
4. **Implement strict CORS** with origin validation
5. **Add rate limiting** for all endpoints
6. **Sanitize error messages** in production
7. **Use secure headers** for all responses
8. **Implement proper logging** without sensitive data
9. **Add request validation** middleware
10. **Use HTTPS** in production

---

**STATUS: CRITICAL - IMPLEMENT IMMEDIATELY**
**PRIORITY: P0 - Security Vulnerabilities**
**ETA: 1-2 days to implement all critical fixes**

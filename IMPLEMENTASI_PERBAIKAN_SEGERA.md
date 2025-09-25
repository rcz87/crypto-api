# 🚀 IMPLEMENTASI PERBAIKAN SEGERA - STEP BY STEP

## 📋 CHECKLIST PERBAIKAN CRITICAL

### ✅ STEP 1: Setup Authentication System (URGENT)

#### 1.1 Buat API Key Management
```bash
# Buat file baru untuk authentication
touch server/middleware/auth.ts
touch server/models/apiKey.ts
touch server/utils/jwt.ts
```

#### 1.2 Implementasi Authentication Middleware
**File**: `server/middleware/auth.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

interface ApiKeyData {
  id: string;
  key: string;
  userId: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
}

// Extend Request type
declare global {
  namespace Express {
    interface Request {
      user?: ApiKeyData;
      apiKey?: string;
    }
  }
}

const API_KEYS_DB = new Map<string, ApiKeyData>([
  // Default API keys untuk testing
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
        code: 'MISSING_API_KEY',
        message: 'Please provide X-API-Key header'
      });
    }

    const keyData = API_KEYS_DB.get(apiKey);
    
    if (!keyData || !keyData.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
        message: 'The provided API key is invalid or inactive'
      });
    }

    // Add user data to request
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
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission,
        available: req.user.permissions
      });
    }

    next();
  };
};

// Rate limiting per API key
export const apiKeyRateLimit = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  // Implement rate limiting logic here
  // For now, just pass through
  next();
};
```

#### 1.3 Update Server Index
**File**: `server/index.ts` - Tambahkan setelah CORS setup:
```typescript
// Import authentication
import { authenticateApiKey, requirePermission } from './middleware/auth';

// Apply authentication to all API routes (kecuali health check)
app.use('/api', (req, res, next) => {
  // Skip auth for health check
  if (req.path === '/health' || req.path === '/healthz') {
    return next();
  }
  
  // Apply authentication
  authenticateApiKey(req, res, next);
});

// Premium endpoints require admin permission
app.use('/api/premium', requirePermission('admin'));
```

### ✅ STEP 2: Fix WebSocket Memory Leaks (URGENT)

#### 2.1 Buat WebSocket Manager
**File**: `server/utils/websocketManager.ts`
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
    // Cleanup dead connections every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, 30000);

    // Ping clients every 30 seconds
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

    // Setup WebSocket event handlers
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

  broadcast(data: any, subscription?: string): void {
    const message = JSON.stringify(data);
    let sentCount = 0;
    let failedCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      try {
        // Check subscription filter
        if (subscription && !client.subscriptions.has(subscription)) {
          continue;
        }

        // Check if connection is still alive
        if (client.ws.readyState === WebSocket.OPEN) {
          // Check backpressure
          if (client.ws.bufferedAmount < 1024 * 1024) { // 1MB limit
            client.ws.send(message);
            sentCount++;
          } else {
            console.warn(`Client ${clientId} buffer full, skipping message`);
            failedCount++;
          }
        } else {
          // Mark for cleanup
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
          // Client didn't respond to previous ping
          console.log(`Client ${clientId} didn't respond to ping, removing`);
          this.removeClient(clientId);
          continue;
        }

        // Send ping
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
    
    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all connections
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

// Singleton instance
export const wsManager = new WebSocketManager();

// Graceful shutdown
process.on('SIGTERM', () => wsManager.shutdown());
process.on('SIGINT', () => wsManager.shutdown());
```

#### 2.2 Update Routes.ts untuk menggunakan WebSocketManager
**File**: `server/routes.ts` - Replace WebSocket section:
```typescript
import { wsManager } from './utils/websocketManager';

// Replace existing WebSocket setup with:
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress || 'unknown';
  console.log(`New WebSocket connection from ${clientIp}`);
  
  // Add client to manager
  const clientId = wsManager.addClient(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    clientId,
    timestamp: new Date().toISOString()
  }));

  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Message from ${clientId}:`, data);
      
      // Echo back for now
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

// Update broadcast calls to use wsManager
// Replace: connectedClients.forEach(...)
// With: wsManager.broadcast(data)
```

### ✅ STEP 3: Secure CORS Configuration (URGENT)

#### 3.1 Update CORS Settings
**File**: `server/index.ts` - Replace CORS section:
```typescript
// Secure CORS configuration
const allowedOrigins = [
  'https://guardiansofthegreentoken.com',
  'https://your-production-domain.com',
  // Add development origins only in dev mode
  ...(process.env.NODE_ENV === 'development' ? [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  ] : [])
];

// Enhanced CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow requests without origin (like Postman, curl)
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    // Log unauthorized origin attempts
    console.warn(`Blocked request from unauthorized origin: ${origin}`);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});
```

### ✅ STEP 4: Fix Error Handling (URGENT)

#### 4.1 Buat Centralized Error Handler
**File**: `server/middleware/errorHandler.ts`
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
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || 
    Math.random().toString(36).substring(7);

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle different error types
  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication required';
  }

  // Log error for debugging
  console.error(`[${requestId}] ${req.method} ${req.path}:`, {
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    statusCode,
    userId: req.user?.userId,
    apiKey: req.apiKey ? `${req.apiKey.substring(0, 8)}...` : undefined
  });

  // Send standardized error response
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

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
      details: {
        method: req.method,
        path: req.path,
        availableEndpoints: [
          'GET /health',
          'GET /api/sol/complete',
          'GET /api/sol/confluence',
          'GET /api/metrics'
        ]
      }
    },
    timestamp: new Date().toISOString()
  });
};
```

#### 4.2 Update Server Index untuk Error Handling
**File**: `server/index.ts` - Tambahkan di akhir file sebelum server.listen:
```typescript
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Apply error handling middleware (harus di akhir)
app.use(notFoundHandler);
app.use(errorHandler);
```

### ✅ STEP 5: Environment Variable Security

#### 5.1 Buat Environment Validator
**File**: `server/utils/envValidator.ts`
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(5000),
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

#### 5.2 Update Server Index untuk Environment Validation
**File**: `server/index.ts` - Tambahkan di awal file:
```typescript
import { validateEnvironment } from './utils/envValidator';

// Validate environment variables first
const env = validateEnvironment();
```

---

## 🧪 TESTING IMPLEMENTASI

### Test Authentication
```bash
# Test tanpa API key
curl -X GET http://localhost:5000/api/sol/complete

# Test dengan API key valid
curl -X GET http://localhost:5000/api/sol/complete \
  -H "X-API-Key: test-key-123"

# Test dengan API key invalid
curl -X GET http://localhost:5000/api/sol/complete \
  -H "X-API-Key: invalid-key"
```

### Test WebSocket
```javascript
// Test WebSocket connection
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'test', message: 'hello' }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

### Test CORS
```bash
# Test CORS dari allowed origin
curl -X GET http://localhost:5000/api/health \
  -H "Origin: http://localhost:3000" \
  -H "X-API-Key: test-key-123"

# Test CORS dari blocked origin
curl -X GET http://localhost:5000/api/health \
  -H "Origin: http://malicious-site.com" \
  -H "X-API-Key: test-key-123"
```

---

## 📊 MONITORING & VERIFICATION

### Health Check Endpoint
**File**: `server/routes/health.ts`
```typescript
import { Request, Response } from 'express';
import { wsManager } from '../utils/websocketManager';

export const healthCheck = async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    websocket: wsManager.getStats(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  };

  res.json({
    success: true,
    data: health
  });
};
```

### Metrics Endpoint Update
```typescript
// Add security metrics
app.get('/api/metrics', async (req: Request, res: Response) => {
  const metrics = {
    // ... existing metrics
    security: {
      authenticatedRequests: getAuthenticatedRequestCount(),
      failedAuthAttempts: getFailedAuthAttempts(),
      blockedOrigins: getBlockedOriginCount()
    },
    websocket: wsManager.getStats()
  };

  res.json({
    success: true,
    data: metrics
  });
});
```

---

## ✅ DEPLOYMENT CHECKLIST

### Pre-deployment
- [ ] Backup database
- [ ] Test all endpoints dengan API key
- [ ] Verify WebSocket connections
- [ ] Test CORS dari production domain
- [ ] Check environment variables
- [ ] Run security scan

### Deployment
- [ ] Deploy ke staging environment
- [ ] Run integration tests
- [ ] Monitor error rates
- [ ] Check WebSocket stability
- [ ] Verify authentication works
- [ ] Test from production frontend

### Post-deployment
- [ ] Monitor memory usage
- [ ] Check WebSocket connection count
- [ ] Verify no authentication bypasses
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Validate CORS headers

---

## 🚨 ROLLBACK PLAN

Jika ada masalah setelah deployment:

1. **Immediate Rollback**:
   ```bash
   git checkout previous-stable-version
   npm run build
   pm2 restart all
   ```

2. **Database Rollback** (jika diperlukan):
   ```bash
   # Restore from backup
   pg_restore -d crypto_api backup_pre_security_update.sql
   ```

3. **Monitoring**:
   - Check error rates return to normal
   - Verify WebSocket connections stable
   - Confirm API endpoints working

---

**Status**: READY FOR IMPLEMENTATION  
**Estimated Time**: 2-3 hari untuk semua critical fixes  
**Risk Level**: MEDIUM (dengan proper testing)  
**Success Criteria**: Zero security vulnerabilities, stable WebSocket, proper authentication

**Next Steps**: Mulai dengan Step 1 (Authentication) hari ini!

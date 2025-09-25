# 🚀 QUICK FIX IMPLEMENTATION - CRITICAL BUGS

## 📋 IMMEDIATE FIXES READY TO IMPLEMENT

Berdasarkan analisis yang telah dilakukan, berikut adalah perbaikan critical yang dapat langsung diimplementasikan:

---

## 🔴 FIX 1: DEPENDENCY & ENVIRONMENT ISSUES

### Problem: npm install lambat & environment variables tidak work di Windows

### Solution:
```bash
# 1. Install cross-env untuk Windows compatibility
npm install cross-env --save-dev

# 2. Update package.json scripts
```

**File: package.json** - Update scripts section:
```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development tsx server/index.ts",
    "start": "cross-env NODE_ENV=production node dist/index.js",
    "dev:win": "set NODE_ENV=development && tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  }
}
```

---

## 🔴 FIX 2: AUTHENTICATION SYSTEM

### Problem: Tidak ada authentication, semua endpoints terbuka

### Solution: Buat file `server/middleware/auth.ts`
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

// Temporary API keys - replace with database
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

### Update `server/index.ts` - Add after CORS setup:
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

## 🔴 FIX 3: CORS SECURITY

### Problem: CORS terlalu permissive

### Solution: Update `server/index.ts` - Replace CORS section:
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

## 🔴 FIX 4: WEBSOCKET MEMORY LEAKS

### Problem: WebSocket connections tidak dibersihkan

### Solution: Buat file `server/utils/websocketManager.ts`
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

### Update `server/routes.ts` - Replace WebSocket section:
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

## 🔴 FIX 5: ERROR HANDLING

### Problem: Inconsistent error responses

### Solution: Buat file `server/middleware/errorHandler.ts`
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

### Update `server/index.ts` - Add at the end:
```typescript
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Add before server.listen()
app.use(notFoundHandler);
app.use(errorHandler);
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
- [ ] Test all endpoints with API keys

### Success

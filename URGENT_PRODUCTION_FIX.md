# 🚨 URGENT PRODUCTION FIX - HTTP 502 ERRORS

## 📊 ERROR ANALYSIS

**Alert dari Telegram:**
- 🔴 5xx Errors: 10 dalam 2 menit
- Status: 502 Bad Gateway
- Endpoint: `/gpts/institutional/bias`
- IP: 127.0.0.1 (internal request)
- Environment: production

## 🔍 ROOT CAUSE ANALYSIS

### Problem: HTTP 502 Bad Gateway
**502 Error** = Server sebagai gateway/proxy menerima response invalid dari upstream server

**Berdasarkan endpoint `/gpts/institutional/bias`:**
- Ini adalah GPT Actions endpoint
- Kemungkinan Python service (CoinGlass) down atau tidak responding
- Proxy middleware di `server/index.ts` tidak bisa connect ke Python backend

### Kemungkinan Penyebab:
1. **Python CoinGlass service crash/restart**
2. **Port 8000 tidak accessible**
3. **Circuit breaker terbuka**
4. **Memory/resource exhaustion**
5. **Database connection issues**

---

## 🚀 IMMEDIATE FIXES (URGENT)

### 1. CHECK PYTHON SERVICE STATUS
```bash
# SSH ke server production
ssh your-server

# Check if Python service running
ps aux | grep python
ps aux | grep uvicorn

# Check port 8000
netstat -tlnp | grep :8000
curl http://127.0.0.1:8000/health

# Check logs
tail -f logs/python-service.log
tail -f logs/app.log
```

### 2. RESTART PYTHON SERVICE
```bash
# If Python service down, restart it
cd coinglass-system
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 &

# Or using PM2 if configured
pm2 restart python-service
pm2 status
```

### 3. CHECK CIRCUIT BREAKER STATUS
```bash
# Check if circuit breaker is open
curl http://localhost:5000/api/metrics | grep circuit

# Reset circuit breaker if needed (add this endpoint)
curl -X POST http://localhost:5000/api/system/reset-circuit-breaker \
  -H "X-API-Key: admin-key-456"
```

### 4. TEMPORARY FALLBACK IMPLEMENTATION

**Add to `server/routes/gpts.ts` (or create if not exists):**
```typescript
// Fallback for /gpts/institutional/bias when Python service down
app.get('/gpts/institutional/bias', async (req: Request, res: Response) => {
  try {
    // Try Python service first
    const pythonResponse = await fetch('http://127.0.0.1:8000/institutional/bias', {
      timeout: 5000
    });
    
    if (pythonResponse.ok) {
      const data = await pythonResponse.json();
      return res.json(data);
    }
  } catch (error) {
    console.error('Python service unavailable, using fallback');
  }
  
  // FALLBACK: Return mock institutional bias data
  const fallbackData = {
    symbol: "BTC",
    bias: "NEUTRAL",
    confidence: 50,
    whale_activity: false,
    etf_flow: 0,
    market_sentiment: 50,
    timestamp: new Date().toISOString(),
    source: "fallback",
    message: "Python service temporarily unavailable - using fallback data"
  };
  
  res.json({
    success: true,
    data: fallbackData,
    fallback: true
  });
});
```

### 5. ENHANCED ERROR HANDLING FOR PROXY

**Update `server/index.ts` - Improve proxy error handling:**
```typescript
// Enhanced proxy with better error handling
app.use("/gpts", createProxyMiddleware({
  target: PY_BASE,
  changeOrigin: true,
  pathRewrite: { "^/gpts": "" },
  proxyTimeout: 10000, // Reduce timeout
  timeout: 10000,
  onError: (err: Error, req: IncomingMessage, res: ServerResponse) => {
    console.error(`[GPTs Proxy Error] ${req.url}: ${err.message}`);
    
    // Send proper JSON error response instead of HTML
    if (!res.headersSent) {
      res.statusCode = 503; // Service Unavailable instead of 502
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        success: false,
        error: "Institutional analysis service temporarily unavailable",
        code: "SERVICE_UNAVAILABLE",
        message: "Please try again in a few moments",
        timestamp: new Date().toISOString(),
        fallback_available: true
      }));
    }
  },
  onProxyReq: (proxyReq: any, req: IncomingMessage, res: ServerResponse) => {
    console.log(`[GPTs Proxy] ${req.method} ${req.url} → ${PY_BASE}${req.url?.replace('/gpts', '')}`);
  },
  onProxyRes: (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
    console.log(`[GPTs Proxy] ${req.url} → ${proxyRes.statusCode}`);
  }
}));
```

---

## 🔧 MONITORING & PREVENTION

### 1. ADD HEALTH CHECK ENDPOINT
```typescript
// Add to server/routes/system.ts
app.get('/api/system/health-detailed', async (req: Request, res: Response) => {
  const health = {
    timestamp: new Date().toISOString(),
    services: {
      nodejs: 'up',
      python: 'unknown',
      database: 'unknown',
      circuit_breaker: 'unknown'
    },
    errors: {
      last_5xx_count: 0,
      last_error_time: null
    }
  };
  
  // Check Python service
  try {
    const pythonCheck = await fetch('http://127.0.0.1:8000/health', { timeout: 3000 });
    health.services.python = pythonCheck.ok ? 'up' : 'down';
  } catch {
    health.services.python = 'down';
  }
  
  // Check circuit breaker
  const cbState = coinglassCircuitBreaker.getState();
  health.services.circuit_breaker = cbState.isOpen ? 'open' : 'closed';
  
  const overallStatus = Object.values(health.services).every(s => s === 'up') ? 'healthy' : 'degraded';
  
  res.status(overallStatus === 'healthy' ? 200 : 503).json({
    status: overallStatus,
    ...health
  });
});
```

### 2. AUTO-RESTART MECHANISM
```typescript
// Add to server/index.ts - Auto restart Python service
let pythonRestartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 3;

const checkAndRestartPython = async () => {
  try {
    const response = await fetch('http://127.0.0.1:8000/health', { timeout: 5000 });
    if (response.ok) {
      pythonRestartAttempts = 0; // Reset counter on success
      return;
    }
  } catch (error) {
    console.error('Python service health check failed:', error.message);
  }
  
  if (pythonRestartAttempts < MAX_RESTART_ATTEMPTS) {
    pythonRestartAttempts++;
    console.log(`Attempting to restart Python service (attempt ${pythonRestartAttempts}/${MAX_RESTART_ATTEMPTS})`);
    
    try {
      // Kill existing Python process
      exec('pkill -f "uvicorn app.main:app"', (error) => {
        if (error) console.log('No existing Python process to kill');
        
        // Start new Python process
        setTimeout(() => {
          startPythonService();
        }, 2000);
      });
    } catch (error) {
      console.error('Failed to restart Python service:', error);
    }
  } else {
    console.error('Max restart attempts reached. Manual intervention required.');
  }
};

// Check every 30 seconds
setInterval(checkAndRestartPython, 30000);
```

### 3. TELEGRAM ALERT ENHANCEMENT
```typescript
// Add to server/observability/telegram-webhook.ts
export const sendProductionAlert = async (errorData: any) => {
  const message = `
🚨 PRODUCTION ALERT RESOLVED

✅ Status: Service Restored
🔧 Action: Python service restarted
📊 Error Count: ${errorData.errorCount} (now resolved)
⏰ Downtime: ${errorData.downtime}
🔄 Auto-recovery: Enabled

Next Steps:
• Monitor for 15 minutes
• Check logs for root cause
• Update monitoring thresholds

#ProductionFixed #AutoRecovery
  `;
  
  // Send to Telegram monitoring channel
  await sendTelegramMessage(message);
};
```

---

## 📋 IMMEDIATE ACTION CHECKLIST

### RIGHT NOW (Next 5 minutes):
- [ ] SSH ke production server
- [ ] Check Python service status: `ps aux | grep uvicorn`
- [ ] Check port 8000: `curl http://127.0.0.1:8000/health`
- [ ] Restart Python service jika down
- [ ] Monitor error rate di Telegram

### NEXT 15 MINUTES:
- [ ] Deploy fallback endpoint untuk `/gpts/institutional/bias`
- [ ] Improve proxy error handling
- [ ] Add detailed health check endpoint
- [ ] Test endpoint: `curl https://guardiansofthegreentoken.com/gpts/institutional/bias`

### NEXT 30 MINUTES:
- [ ] Implement auto-restart mechanism
- [ ] Add enhanced monitoring
- [ ] Update Telegram alerts
- [ ] Document incident untuk post-mortem

---

## 🎯 QUICK COMMANDS TO RUN

```bash
# 1. Check service status
curl http://127.0.0.1:8000/health
curl https://guardiansofthegreentoken.com/gpts/institutional/bias

# 2. Restart Python service
cd coinglass-system
pkill -f "uvicorn app.main:app"
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 &

# 3. Check if fixed
curl https://guardiansofthegreentoken.com/gpts/institutional/bias

# 4. Monitor logs
tail -f logs/app.log
```

---

## 💡 ROOT CAUSE PREVENTION

**Kemungkinan penyebab 502 errors:**
1. **Python service memory leak** → Add memory monitoring
2. **Database connection timeout** → Add connection pooling
3. **High load causing crashes** → Add rate limiting
4. **Dependency conflicts** → Pin Python package versions
5. **Resource exhaustion** → Add resource monitoring

**Long-term fixes:**
- Implement proper health checks
- Add circuit breaker with auto-recovery
- Set up proper logging and monitoring
- Add graceful degradation
- Implement blue-green deployment

---

**STATUS: URGENT - IMPLEMENT IMMEDIATELY**
**PRIORITY: P0 - Production Down**
**ETA: 5-15 minutes to resolve**

Silakan jalankan quick commands di atas untuk mengatasi 502 errors segera!

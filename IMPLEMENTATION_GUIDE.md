# 🚀 IMPLEMENTATION GUIDE - Memory Leak Fix & CI/CD

## 📋 OVERVIEW

Dokumen ini berisi panduan lengkap untuk mengimplementasikan:
1. ✅ Fix memory leak CoinAPI WebSocket
2. ✅ CI/CD pipeline dengan GitHub Actions
3. ✅ Unit tests dengan Jest
4. ✅ Monitoring dan observability

---

## 🎯 GOALS

### Before Fix
```
Memory Usage: 87% → 91%+ dalam 20 detik
Queue Size: Unlimited (10,000+ messages possible)
REST Calls: 10+ concurrent (storm)
Reconnects: Memory leak setiap reconnect
Test Coverage: 15%
Deployment: Manual
```

### After Fix
```
Memory Usage: Stable <70%
Queue Size: Max 500 messages (bounded)
REST Calls: Max 2 concurrent (rate-limited)
Reconnects: No memory leak (proper cleanup)
Test Coverage: 80%+
Deployment: Automated via CI/CD
```

---

## 📁 FILES CREATED

### 1. Utility Files
```
server/utils/boundedQueue.ts          - Bounded queue dengan backpressure
server/utils/recoveryQueue.ts         - Rate-limited recovery queue
server/utils/boundedQueue.test.ts     - Unit tests untuk bounded queue
server/utils/recoveryQueue.test.ts    - Unit tests untuk recovery queue
```

### 2. Fixed WebSocket Service
```
server/services/coinapiWebSocket.fixed.ts  - Fixed version dengan semua perbaikan
```

### 3. CI/CD Pipeline
```
.github/workflows/ci-cd.yml           - GitHub Actions workflow
```

### 4. Documentation
```
SOLUSI_MEMORY_LEAK_COINAPI.md         - Root cause analysis & solusi
IMPLEMENTATION_GUIDE.md               - Panduan implementasi (file ini)
```

---

## 🔧 STEP-BY-STEP IMPLEMENTATION

### Phase 1: Setup Testing (Week 1, Day 1-2)

#### 1.1 Update package.json

Tambahkan scripts untuk testing:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0"
  }
}
```

#### 1.2 Create jest.config.js

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.test.ts',
    '!server/**/*.spec.ts',
    '!server/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1',
  },
};
```

#### 1.3 Install Dependencies

```bash
npm install --save-dev jest @types/jest ts-jest
npm install
```

#### 1.4 Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

**Expected Output**:
```
PASS  server/utils/boundedQueue.test.ts
PASS  server/utils/recoveryQueue.test.ts

Test Suites: 2 passed, 2 total
Tests:       30 passed, 30 total
Coverage:    85% statements, 80% branches
```

---

### Phase 2: Implement Memory Leak Fix (Week 1, Day 3-5)

#### 2.1 Backup Current File

```bash
cp server/services/coinapiWebSocket.ts server/services/coinapiWebSocket.backup.ts
```

#### 2.2 Replace with Fixed Version

```bash
# Option 1: Rename fixed version
mv server/services/coinapiWebSocket.fixed.ts server/services/coinapiWebSocket.ts

# Option 2: Copy content manually
# Copy content dari coinapiWebSocket.fixed.ts ke coinapiWebSocket.ts
```

#### 2.3 Enable Service

Update environment variable:

```bash
# .env atau Replit Secrets
COINAPI_WS_ENABLED=true
```

#### 2.4 Test Locally

```bash
# Start server
npm run dev

# Monitor memory
curl http://localhost:5000/api/debug/memory | jq .

# Check health
curl http://localhost:5000/health | jq .
```

#### 2.5 Load Test

```bash
# Run for 10 minutes and monitor memory
watch -n 5 'curl -s http://localhost:5000/api/debug/memory | jq ".memory.heap"'
```

**Success Criteria**:
- ✅ Memory usage stable <70%
- ✅ No queue overflow warnings
- ✅ No REST recovery storms
- ✅ Service runs for 10+ minutes without issues

---

### Phase 3: Setup CI/CD (Week 1, Day 6-7)

#### 3.1 Create GitHub Secrets

Go to GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:

```
STAGING_HOST=your-staging-server.com
STAGING_USER=deploy
STAGING_SSH_KEY=<your-ssh-private-key>
STAGING_URL=https://staging.yourdomain.com

PRODUCTION_HOST=your-production-server.com
PRODUCTION_USER=deploy
PRODUCTION_SSH_KEY=<your-ssh-private-key>
PRODUCTION_URL=https://yourdomain.com
```

#### 3.2 Generate SSH Key for Deployment

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# Copy public key to servers
ssh-copy-id -i ~/.ssh/github_deploy.pub deploy@your-server.com

# Copy private key content to GitHub Secrets
cat ~/.ssh/github_deploy
```

#### 3.3 Test CI/CD Pipeline

```bash
# Create feature branch
git checkout -b feature/memory-leak-fix

# Commit changes
git add .
git commit -m "Fix: CoinAPI WebSocket memory leak + CI/CD"

# Push to trigger CI
git push origin feature/memory-leak-fix
```

#### 3.4 Monitor GitHub Actions

1. Go to GitHub repo → Actions tab
2. Watch workflow run
3. Check each job status

**Expected Flow**:
```
✅ Lint & Type Check (2 min)
✅ Unit Tests (3 min)
✅ Build (4 min)
✅ Python Tests (2 min)
✅ Security Scan (3 min)
```

#### 3.5 Deploy to Staging

```bash
# Merge to develop branch
git checkout develop
git merge feature/memory-leak-fix
git push origin develop
```

This will trigger automatic deployment to staging.

#### 3.6 Deploy to Production

```bash
# Merge to main branch (after staging verification)
git checkout main
git merge develop
git push origin main
```

This will trigger automatic deployment to production.

---

### Phase 4: Monitoring & Verification (Week 2)

#### 4.1 Setup Monitoring Dashboard

Create monitoring script:

```bash
# monitor-memory.sh
#!/bin/bash

while true; do
  echo "=== $(date) ==="
  curl -s http://localhost:5000/api/debug/memory | jq '.memory.heap'
  curl -s http://localhost:5000/health | jq '.data.services'
  echo ""
  sleep 60
done
```

Run monitoring:

```bash
chmod +x monitor-memory.sh
./monitor-memory.sh > memory-monitor.log 2>&1 &
```

#### 4.2 Check Logs

```bash
# PM2 logs
pm2 logs

# Memory monitor logs
tail -f memory-monitor.log

# System logs
journalctl -u crypto-api -f
```

#### 4.3 Verify Metrics

After 24 hours, check:

```bash
# Memory usage trend
grep "heap" memory-monitor.log | tail -100

# Queue metrics
curl http://localhost:5000/health | jq '.data.metrics'

# Error rate
pm2 logs --err | grep -i error | wc -l
```

**Success Criteria**:
- ✅ Memory usage stable <70% for 24 hours
- ✅ No queue overflow warnings
- ✅ No memory-related errors
- ✅ All services healthy

---

## 🧪 TESTING CHECKLIST

### Unit Tests
- [x] BoundedQueue - Basic operations
- [x] BoundedQueue - Backpressure
- [x] BoundedQueue - Batch processing
- [x] BoundedQueue - Metrics
- [x] RecoveryQueue - Queue management
- [x] RecoveryQueue - Rate limiting
- [x] RecoveryQueue - Error handling
- [x] RecoveryQueue - Metrics

### Integration Tests
- [ ] WebSocket connection lifecycle
- [ ] Message processing flow
- [ ] Gap detection and recovery
- [ ] Memory cleanup on shutdown

### Load Tests
- [ ] 1000 messages/sec for 10 minutes
- [ ] 100 gap detections
- [ ] 50 reconnects
- [ ] Memory usage under load

### E2E Tests
- [ ] Full system startup
- [ ] WebSocket subscription
- [ ] Order book updates
- [ ] Graceful shutdown

---

## 📊 MONITORING METRICS

### Key Metrics to Track

```typescript
// Memory Metrics
- heap_used_mb: <70% of heap_total
- rss_mb: <200MB
- queue_size: <100 messages
- dropped_count: <10 per hour

// Performance Metrics
- message_processing_time: <10ms
- recovery_time: <2000ms
- reconnect_time: <5000ms

// Reliability Metrics
- uptime: >99.5%
- error_rate: <0.5%
- gap_detection_rate: <1 per hour
```

### Alerting Rules

```yaml
# Prometheus Alert Rules
groups:
  - name: coinapi_websocket
    rules:
      - alert: HighMemoryUsage
        expr: heap_used_percent > 80
        for: 5m
        annotations:
          summary: "High memory usage detected"
      
      - alert: QueueOverflow
        expr: queue_size > 400
        for: 2m
        annotations:
          summary: "Message queue near capacity"
      
      - alert: HighDropRate
        expr: rate(dropped_count[5m]) > 10
        annotations:
          summary: "High message drop rate"
```

---

## 🚨 TROUBLESHOOTING

### Issue 1: Tests Failing

**Symptoms**:
```
FAIL  server/utils/boundedQueue.test.ts
  ● BoundedQueue › should enqueue items
    expect(received).toBe(expected)
```

**Solution**:
```bash
# Clear Jest cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Run tests again
npm test
```

### Issue 2: CI/CD Pipeline Fails

**Symptoms**:
```
Error: Process completed with exit code 1
```

**Solution**:
1. Check GitHub Actions logs
2. Verify secrets are set correctly
3. Test SSH connection manually:
   ```bash
   ssh -i ~/.ssh/github_deploy deploy@your-server.com
   ```

### Issue 3: Memory Still High After Fix

**Symptoms**:
```
Heap usage: 85%+ after 1 hour
```

**Solution**:
1. Check if service is enabled:
   ```bash
   curl http://localhost:5000/health | jq '.data.services'
   ```

2. Verify queue metrics:
   ```bash
   curl http://localhost:5000/api/debug/memory | jq .
   ```

3. Check for other memory leaks:
   ```bash
   node --inspect server/index.ts
   # Use Chrome DevTools to take heap snapshot
   ```

### Issue 4: Deployment Fails

**Symptoms**:
```
pm2 reload failed
```

**Solution**:
```bash
# SSH to server
ssh deploy@your-server.com

# Check PM2 status
pm2 status

# Check logs
pm2 logs --err

# Manual reload
cd /var/www/crypto-api
git pull
npm ci --production
npm run build
pm2 reload ecosystem.config.cjs
```

---

## 📚 ADDITIONAL RESOURCES

### Documentation
- [BoundedQueue API](./server/utils/boundedQueue.ts)
- [RecoveryQueue API](./server/utils/recoveryQueue.ts)
- [Fixed WebSocket Service](./server/services/coinapiWebSocket.fixed.ts)
- [CI/CD Workflow](./.github/workflows/ci-cd.yml)

### Tools
- [Jest Documentation](https://jestjs.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [Node.js Memory Profiling](https://nodejs.org/en/docs/guides/simple-profiling/)

### Support
- GitHub Issues: [Create Issue](https://github.com/your-repo/issues/new)
- Slack Channel: #crypto-api-support
- Email: support@yourdomain.com

---

## ✅ SUCCESS CRITERIA

### Phase 1: Testing (Week 1)
- [x] Jest configured and running
- [x] Unit tests passing (30+ tests)
- [x] Coverage >70%

### Phase 2: Memory Fix (Week 1)
- [ ] Memory usage <70% for 24 hours
- [ ] No queue overflow
- [ ] No REST storms
- [ ] Service stable

### Phase 3: CI/CD (Week 1)
- [ ] GitHub Actions configured
- [ ] Automated testing working
- [ ] Automated deployment working
- [ ] Rollback capability tested

### Phase 4: Production (Week 2)
- [ ] Deployed to production
- [ ] Monitoring active
- [ ] No incidents for 7 days
- [ ] Team trained on new system

---

## 🎓 NEXT STEPS

After successful implementation:

1. **Week 3**: Add integration tests
2. **Week 4**: Implement E2E tests
3. **Week 5**: Setup advanced monitoring (Grafana)
4. **Week 6**: Performance optimization
5. **Week 7**: Documentation update
6. **Week 8**: Team training

---

**Last Updated**: 15 Januari 2025  
**Maintainer**: Development Team  
**Status**: Ready for Implementation

---

**END OF GUIDE**

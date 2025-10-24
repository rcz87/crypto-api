# 🔧 SOLUSI MEMORY LEAK - CoinAPI WebSocket

## 📊 ROOT CAUSE ANALYSIS

### Masalah yang Ditemukan

1. **Message Queue Overflow** ❌
   ```typescript
   // MASALAH: Queue bisa grow unlimited jika processing lambat
   private messageQueue: any[] = [];
   
   // Skenario:
   // - Messages masuk: 100/sec
   // - Processing: 10/sec
   // - Queue growth: 90 messages/sec
   // - Dalam 1 menit: 5,400 messages = ~5MB
   // - Dalam 10 menit: 54,000 messages = ~50MB
   ```

2. **REST Recovery Storm** ❌
   ```typescript
   // MASALAH: Banyak gap → banyak REST calls bersamaan
   private async recoverFromGap(symbol_id: string) {
     // Tidak ada rate limiting
     // Tidak ada queue untuk recovery
     // Bisa trigger 10+ REST calls bersamaan
   }
   ```

3. **No Connection Timeout** ❌
   ```typescript
   // MASALAH: WebSocket bisa hang forever
   this.ws = new WebSocket(this.WS_URL);
   // Tidak ada timeout untuk connection
   ```

4. **Event Listener Leak** ❌
   ```typescript
   // MASALAH: Listeners tidak di-remove saat reconnect
   this.ws.on('message', ...);
   this.ws.on('error', ...);
   // Setiap reconnect = new listeners
   // 10 reconnects = 10x listeners
   ```

## ✅ SOLUSI YANG DIIMPLEMENTASI

### 1. Bounded Queue dengan Backpressure

```typescript
// File: server/utils/boundedQueue.ts
export class BoundedQueue<T> {
  private queue: T[] = [];
  private readonly maxSize: number;
  private droppedCount = 0;
  
  constructor(maxSize: number = 500) {
    this.maxSize = maxSize;
  }
  
  enqueue(item: T): boolean {
    if (this.queue.length >= this.maxSize) {
      this.droppedCount++;
      return false; // Backpressure: reject new items
    }
    this.queue.push(item);
    return true;
  }
  
  dequeue(batchSize: number = 10): T[] {
    return this.queue.splice(0, batchSize);
  }
  
  size(): number {
    return this.queue.length;
  }
  
  getDroppedCount(): number {
    return this.droppedCount;
  }
  
  clear(): void {
    this.queue = [];
  }
}
```

### 2. Rate-Limited REST Recovery

```typescript
// File: server/utils/recoveryQueue.ts
export class RecoveryQueue {
  private queue: string[] = [];
  private processing = false;
  private readonly maxConcurrent = 2;
  private readonly delayMs = 1000;
  
  async addRecovery(symbolId: string): Promise<void> {
    if (!this.queue.includes(symbolId)) {
      this.queue.push(symbolId);
    }
    
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  private async processQueue(): Promise<void> {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxConcurrent);
      
      await Promise.all(
        batch.map(symbolId => this.recover(symbolId))
      );
      
      if (this.queue.length > 0) {
        await this.delay(this.delayMs);
      }
    }
    
    this.processing = false;
  }
  
  private async recover(symbolId: string): Promise<void> {
    // Implementation in main service
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Connection Timeout & Auto-Reconnect

```typescript
// Tambahan di constructor
private readonly CONNECTION_TIMEOUT = 30000; // 30 seconds
private connectionTimer: NodeJS.Timeout | null = null;

private connect() {
  // Set connection timeout
  this.connectionTimer = setTimeout(() => {
    if (!this.health.wsConnected) {
      console.error('❌ Connection timeout');
      this.ws?.close();
    }
  }, this.CONNECTION_TIMEOUT);
  
  this.ws = new WebSocket(this.WS_URL);
  // ... rest of code
}

private handleOpen() {
  // Clear connection timeout
  if (this.connectionTimer) {
    clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }
  // ... rest of code
}
```

### 4. Proper Event Cleanup

```typescript
private cleanupWebSocket(): void {
  if (this.ws) {
    // Remove ALL listeners before closing
    this.ws.removeAllListeners('open');
    this.ws.removeAllListeners('message');
    this.ws.removeAllListeners('error');
    this.ws.removeAllListeners('close');
    
    // Close connection
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Cleanup');
    }
    
    this.ws = null;
  }
}
```

## 📈 EXPECTED IMPROVEMENTS

### Before Fix
```
Memory Usage: 87% → 91%+ dalam 20 detik
Queue Size: Unlimited (bisa 10,000+ messages)
REST Calls: 10+ concurrent (storm)
Reconnects: Memory leak setiap reconnect
```

### After Fix
```
Memory Usage: Stable <70%
Queue Size: Max 500 messages (bounded)
REST Calls: Max 2 concurrent (rate-limited)
Reconnects: No memory leak (proper cleanup)
```

## 🧪 TESTING PLAN

1. **Load Test**: Send 1000 messages/sec for 10 minutes
2. **Gap Test**: Trigger 100 gaps and verify recovery
3. **Reconnect Test**: Force 50 reconnects and check memory
4. **Backpressure Test**: Verify queue drops messages when full

## 📝 IMPLEMENTATION CHECKLIST

- [ ] Create `server/utils/boundedQueue.ts`
- [ ] Create `server/utils/recoveryQueue.ts`
- [ ] Update `server/services/coinapiWebSocket.ts`
- [ ] Add connection timeout
- [ ] Add proper event cleanup
- [ ] Write unit tests
- [ ] Load test in staging
- [ ] Deploy to production
- [ ] Monitor for 24 hours

## 🎯 SUCCESS CRITERIA

✅ Memory usage stable <70% for 24 hours
✅ No queue overflow warnings
✅ No REST recovery storms
✅ Successful reconnects without memory leak
✅ All unit tests passing

---

**Next**: Lihat file-file implementasi di bawah untuk kode lengkap.

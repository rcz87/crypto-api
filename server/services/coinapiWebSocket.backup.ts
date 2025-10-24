import WebSocket from 'ws';
import axios from 'axios';
import { componentMemoryTracker } from '../utils/componentMemoryTracker.js';

// 🚨 MEMORY LEAK FIX: EMERGENCY DISABLE CoinAPI WebSocket
// Issue: Message queue backlog → sequence gaps → REST recovery storm → memory exhaustion
// This MUST be at top to prevent any execution
const COINAPI_WS_ENABLED = false; // Set to true to re-enable

// Health status tracking
export interface CoinAPIWebSocketHealth {
  wsConnected: boolean;
  lastWsMessageTime: number | null;
  lastWsMessage: any;
  restOrderbookOk: boolean;
  reconnectAttempts: number;
  totalMessagesReceived: number;
}

// Order book data structures
export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookSnapshot {
  symbol_id: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  time_exchange: string;
  time_coinapi: string;
}

export interface OrderBookUpdate {
  type: 'book' | 'book5' | 'book20';
  symbol_id: string;
  sequence?: number; // Monotonically increasing sequence number
  bids?: OrderBookLevel[];
  asks?: OrderBookLevel[];
  time_exchange: string;
  time_coinapi: string;
}

class CoinAPIWebSocketService {
  private ws: WebSocket | null = null;
  private health: CoinAPIWebSocketHealth = {
    wsConnected: false,
    lastWsMessageTime: null,
    lastWsMessage: null,
    restOrderbookOk: false,
    reconnectAttempts: 0,
    totalMessagesReceived: 0
  };
  
  private readonly WS_URL = 'wss://ws.coinapi.io/v1/';
  private readonly REST_ORDERBOOK_URL = 'https://rest.coinapi.io/v1/orderbooks/{symbol_id}/current';
  private readonly API_KEY = process.env.COINAPI_KEY;
  private readonly RECONNECT_DELAY = 5000; // 5 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  
  // Memory leak prevention constants
  private readonly MAX_SYMBOLS = 100; // Maximum symbols to cache (supports 65+ pairs with headroom)
  private readonly MAX_AGE_MS = 3600000; // 1 hour stale data threshold
  private readonly CLEANUP_INTERVAL_MS = 60000; // Cleanup every minute
  
  // 🔧 FIX #1: Message queue with rate limiting (prevents overwhelming processing)
  private readonly MESSAGE_QUEUE_MAX_SIZE = 1000; // Circular buffer - prevents unlimited growth
  private readonly MESSAGE_PROCESS_BATCH_SIZE = 10; // Process max 10 messages per tick
  private readonly MESSAGE_PROCESS_INTERVAL_MS = 100; // Process every 100ms (10 batches/sec max)
  private messageQueue: any[] = []; // Circular buffer for incoming messages
  private queueProcessorInterval: NodeJS.Timeout | null = null;
  
  // In-memory order book storage
  private orderBooks = new Map<string, OrderBookSnapshot>();
  
  // Track actively subscribed symbols to prevent eviction
  private subscribedSymbols = new Set<string>();
  
  // Sequence tracking for gap detection (P0 Critical)
  private lastSequence = new Map<string, number>();
  private gapDetectionStats = {
    totalGapsDetected: 0,
    recoveryTriggered: 0,
    lastGapTime: null as number | null
  };
  
  // Callback for order book updates
  private updateCallbacks: Array<(update: OrderBookUpdate) => void> = [];
  
  // 🔧 MEMORY LEAK FIX: Track timers for proper cleanup
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 🚨 MEMORY LEAK FIX: Check if service is disabled - COMPLETE EARLY RETURN
    if (!COINAPI_WS_ENABLED) {
      console.log('⚠️ [CoinAPI-WS] Service DISABLED by COINAPI_WS_ENABLED flag (memory leak isolation)');
      return; // ✅ No timers created if disabled
    }
    
    if (!this.API_KEY) {
      console.error('❌ [CoinAPI-WS] COINAPI_KEY not found in environment');
      return; // ✅ No timers created if no API key
    }
    
    // Auto-start connection
    this.connect();
    
    // 🔧 FIX: Store interval IDs for cleanup
    this.healthCheckInterval = setInterval(() => {
      this.healthCheck();
    }, 30000);
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleData();
    }, this.CLEANUP_INTERVAL_MS);
    
    // 🔧 FIX #1: Start message queue processor (rate-limited processing)
    this.startMessageQueueProcessor();
  }
  
  /**
   * 🔧 FIX #1: Start message queue processor with rate limiting
   * Prevents memory overflow from processing too many messages at once
   */
  private startMessageQueueProcessor() {
    this.queueProcessorInterval = setInterval(() => {
      this.processMessageQueue();
    }, this.MESSAGE_PROCESS_INTERVAL_MS);
  }
  
  /**
   * 🔧 FIX #1: Process message queue in batches
   * Limits processing to MESSAGE_PROCESS_BATCH_SIZE messages per tick
   */
  private processMessageQueue() {
    if (this.messageQueue.length === 0) return;
    
    // Process up to BATCH_SIZE messages
    const batch = this.messageQueue.splice(0, this.MESSAGE_PROCESS_BATCH_SIZE);
    
    for (const message of batch) {
      try {
        // Handle different message types
        if (message.type === 'book' || message.type === 'book5' || message.type === 'book20') {
          this.processOrderBookUpdate(message as OrderBookUpdate);
        }
      } catch (error) {
        console.error('❌ [CoinAPI-WS] Queue processing error:', error);
      }
    }
    
    // Log if queue is building up (potential bottleneck)
    if (this.messageQueue.length > 100 && this.messageQueue.length % 50 === 0) {
      console.warn(`⚠️ [CoinAPI-WS] Message queue backlog: ${this.messageQueue.length} messages pending`);
    }
  }
  
  /**
   * Establish WebSocket connection to CoinAPI
   */
  private connect() {
    try {
      console.log('🔌 [CoinAPI-WS] Connecting to WebSocket...');
      
      this.ws = new WebSocket(this.WS_URL);
      
      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(data));
      this.ws.on('error', (error: Error) => this.handleError(error));
      this.ws.on('close', (code: number, reason: Buffer) => this.handleClose(code, reason));
      
    } catch (error) {
      console.error('❌ [CoinAPI-WS] Connection error:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle WebSocket open event
   */
  private handleOpen() {
    console.log('✅ [CoinAPI-WS] WebSocket connected');
    this.health.wsConnected = true;
    this.health.reconnectAttempts = 0;
    
    // 🔧 FIX #4: Subscription optimization - Reduce from 7 pairs to 3 priority pairs
    // This reduces message volume by ~57% (7→3 pairs), lowering memory pressure
    const symbolList = [
      'BINANCE_SPOT_BTC_USDT',
      'BINANCE_SPOT_ETH_USDT',
      'BINANCE_SPOT_SOL_USDT'
      // REMOVED for memory optimization (can re-enable if needed):
      // 'BINANCE_SPOT_BNB_USDT',
      // 'BINANCE_SPOT_XRP_USDT',
      // 'BINANCE_SPOT_DOGE_USDT',
      // 'BINANCE_SPOT_AVAX_USDT'
    ];
    
    const helloMessage = {
      type: 'hello',
      apikey: this.API_KEY,
      subscribe_data_type: ['book5'], // Subscribe to top 5 levels order book
      subscribe_filter_symbol_id: symbolList
    };
    
    // Track subscribed symbols (prevents cleanup eviction)
    symbolList.forEach(symbol => this.subscribedSymbols.add(symbol));
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(helloMessage));
      console.log('📡 [CoinAPI-WS] Subscription sent (OPTIMIZED for memory):', helloMessage.subscribe_filter_symbol_id);
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   * 🔧 FIX #1 & #2: Enqueue messages instead of immediate processing (circular buffer)
   */
  private handleMessage(data: WebSocket.Data) {
    try {
      const message = JSON.parse(data.toString());
      
      this.health.lastWsMessageTime = Date.now();
      this.health.lastWsMessage = message;
      this.health.totalMessagesReceived++;
      
      // 🔧 FIX #2: Circular buffer - if queue is full, remove oldest message
      if (this.messageQueue.length >= this.MESSAGE_QUEUE_MAX_SIZE) {
        const dropped = this.messageQueue.shift(); // Remove oldest
        if (this.health.totalMessagesReceived % 100 === 0) {
          console.warn(`⚠️ [CoinAPI-WS] Queue full (${this.MESSAGE_QUEUE_MAX_SIZE}), dropped oldest message: ${dropped?.symbol_id || 'unknown'}`);
        }
      }
      
      // 🔧 FIX #1: Enqueue message for rate-limited processing
      this.messageQueue.push(message);
      
      // 🔧 FIX #3: MEMORY TRACKING with circular buffer limit (max 1000 tracked messages)
      // componentMemoryTracker now has internal limit to prevent unlimited growth
      componentMemoryTracker.registerData('coinapi_ws_messages', {
        type: message.type,
        symbol: message.symbol_id,
        timestamp: Date.now(),
        size: data.toString().length
      });
      
    } catch (error) {
      console.error('❌ [CoinAPI-WS] Message parsing error:', error);
    }
  }
  
  /**
   * Process order book update and store in memory
   * P0: Implements sequence tracking & gap detection
   */
  private async processOrderBookUpdate(update: OrderBookUpdate) {
    const { symbol_id, sequence, bids, asks, time_exchange, time_coinapi } = update;
    
    // P0: Sequence gap detection
    if (sequence !== undefined) {
      const lastSeq = this.lastSequence.get(symbol_id);
      
      if (lastSeq !== undefined) {
        const expectedSeq = lastSeq + 1;
        
        // Gap detected - missed updates!
        if (sequence !== expectedSeq) {
          const gap = sequence - lastSeq;
          this.gapDetectionStats.totalGapsDetected++;
          this.gapDetectionStats.lastGapTime = Date.now();
          
          console.warn(`🚨 [CoinAPI-WS] SEQUENCE GAP DETECTED - ${symbol_id}: expected ${expectedSeq}, got ${sequence} (gap: ${gap})`);
          
          // Trigger REST snapshot recovery
          await this.recoverFromGap(symbol_id);
          this.gapDetectionStats.recoveryTriggered++;
        }
      }
      
      // Update last sequence
      this.lastSequence.set(symbol_id, sequence);
    }
    
    // Update local order book (book5 = always full snapshot, no merge needed)
    if (bids || asks) {
      const snapshot: OrderBookSnapshot = {
        symbol_id,
        bids: bids || [],
        asks: asks || [],
        time_exchange,
        time_coinapi
      };
      
      this.orderBooks.set(symbol_id, snapshot);
      
      // Notify callbacks
      this.updateCallbacks.forEach(callback => {
        try {
          callback(update);
        } catch (err) {
          console.error('❌ [CoinAPI-WS] Callback error:', err);
        }
      });
      
      // Log sample update (every 100th message to reduce noise)
      if (this.health.totalMessagesReceived % 100 === 0) {
        console.log(`📊 [CoinAPI-WS] Order book update: ${symbol_id} - ${bids?.length || 0} bids, ${asks?.length || 0} asks`);
      }
    }
  }
  
  /**
   * Recover from sequence gap by fetching REST snapshot
   * P0: Auto-recovery mechanism
   */
  private async recoverFromGap(symbol_id: string): Promise<void> {
    try {
      console.log(`🔄 [CoinAPI-WS] Recovering ${symbol_id} via REST snapshot...`);
      
      // Fetch fresh snapshot via REST API
      const snapshot = await this.getOrderBook(symbol_id);
      
      if (snapshot) {
        // Replace stale data with fresh snapshot
        this.orderBooks.set(symbol_id, snapshot);
        console.log(`✅ [CoinAPI-WS] Recovery successful: ${symbol_id} - ${snapshot.bids.length} bids, ${snapshot.asks.length} asks`);
      } else {
        console.error(`❌ [CoinAPI-WS] Recovery failed: ${symbol_id} - REST snapshot unavailable`);
      }
    } catch (error) {
      console.error(`❌ [CoinAPI-WS] Recovery error for ${symbol_id}:`, error);
    }
  }
  
  /**
   * Handle WebSocket error
   */
  private handleError(error: Error) {
    console.error('❌ [CoinAPI-WS] WebSocket error:', error.message);
    this.health.wsConnected = false;
  }
  
  /**
   * Handle WebSocket close
   */
  private handleClose(code: number, reason: Buffer) {
    console.warn(`⚠️ [CoinAPI-WS] WebSocket closed - Code: ${code}, Reason: ${reason.toString()}`);
    this.health.wsConnected = false;
    
    // Auto-reconnect
    this.scheduleReconnect();
  }
  
  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (this.health.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error(`🚨 [CoinAPI-WS] Max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached`);
      return;
    }
    
    this.health.reconnectAttempts++;
    console.log(`🔄 [CoinAPI-WS] Reconnecting in ${this.RECONNECT_DELAY / 1000}s (attempt ${this.health.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
    
    setTimeout(() => {
      this.connect();
    }, this.RECONNECT_DELAY);
  }
  
  /**
   * Health check and auto-recovery
   */
  private healthCheck() {
    const now = Date.now();
    const timeSinceLastMessage = this.health.lastWsMessageTime 
      ? now - this.health.lastWsMessageTime 
      : Infinity;
    
    // If no message in 60 seconds and supposed to be connected, reconnect
    if (this.health.wsConnected && timeSinceLastMessage > 60000) {
      console.warn('⚠️ [CoinAPI-WS] No messages in 60s, forcing reconnect');
      this.ws?.close();
    }
  }
  
  /**
   * Cleanup stale order book data to prevent memory leaks
   * CRITICAL: Subscribed symbols are NEVER evicted regardless of age or size
   */
  private cleanupStaleData() {
    const now = Date.now();
    let staleCount = 0;
    let sizeLimitCount = 0;
    let protectedCount = 0;
    let skippedProtectedStale = 0;
    
    // Memory instrumentation
    const memUsage = process.memoryUsage();
    const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
    const heapPercent = ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1);
    
    // 1. Remove stale data (older than MAX_AGE_MS)
    // PROTECTION: Subscribed symbols are NEVER deleted due to age
    for (const [symbol, snapshot] of this.orderBooks) {
      // Skip subscribed symbols ALWAYS (double protection)
      if (this.subscribedSymbols.has(symbol)) {
        const age = now - new Date(snapshot.time_coinapi).getTime();
        if (age > this.MAX_AGE_MS) {
          skippedProtectedStale++;
        }
        continue;
      }
      
      // Only delete non-subscribed stale entries
      const age = now - new Date(snapshot.time_coinapi).getTime();
      if (age > this.MAX_AGE_MS) {
        this.orderBooks.delete(symbol);
        staleCount++;
      }
    }
    
    // 2. Enforce size limit using LRU
    // PROTECTION: Subscribed symbols are NEVER deleted for size limits
    if (this.orderBooks.size > this.MAX_SYMBOLS) {
      // Sort by timestamp (oldest first), EXCLUDE subscribed symbols
      const sorted = Array.from(this.orderBooks.entries())
        .filter(([symbol]) => !this.subscribedSymbols.has(symbol))
        .sort((a, b) => {
          const timeA = new Date(a[1].time_coinapi).getTime();
          const timeB = new Date(b[1].time_coinapi).getTime();
          return timeA - timeB;
        });
      
      // Remove oldest non-subscribed entries to stay within limit
      const excessCount = this.orderBooks.size - this.MAX_SYMBOLS;
      const toDelete = sorted.slice(0, Math.min(excessCount, sorted.length));
      toDelete.forEach(([symbol]) => {
        this.orderBooks.delete(symbol);
        sizeLimitCount++;
      });
    }
    
    // Count protected symbols
    for (const symbol of this.subscribedSymbols) {
      if (this.orderBooks.has(symbol)) {
        protectedCount++;
      }
    }
    
    // Log cleanup activity with enhanced metrics (always log during investigation)
    const shouldLog = staleCount > 0 || sizeLimitCount > 0 || skippedProtectedStale > 0 || 
                      this.health.totalMessagesReceived % 500 === 0; // Log every 500 msgs during investigation
    
    if (shouldLog) {
      console.log(`🧹 [CoinAPI-WS] Cleanup: ` +
        `removed ${staleCount} stale + ${sizeLimitCount} over-limit. ` +
        `Cache: ${this.orderBooks.size} (${protectedCount}/${this.subscribedSymbols.size} protected${skippedProtectedStale > 0 ? `, ${skippedProtectedStale} stale-but-protected` : ''}). ` +
        `Heap: ${heapUsedMB}/${heapTotalMB}MB (${heapPercent}%)`
      );
    }
  }
  
  /**
   * Fetch order book via REST API (fallback)
   */
  async fetchOrderBookREST(symbolId: string, limitLevels = 20): Promise<OrderBookSnapshot | null> {
    const url = this.REST_ORDERBOOK_URL.replace('{symbol_id}', symbolId);
    
    try {
      const response = await axios.get(url, {
        headers: { 'X-CoinAPI-Key': this.API_KEY },
        params: { limit_levels: limitLevels },
        timeout: 10000
      });
      
      this.health.restOrderbookOk = true;
      
      const data = response.data;
      const snapshot: OrderBookSnapshot = {
        symbol_id: data.symbol_id,
        bids: data.bids?.map((b: any) => ({ price: b.price, size: b.size })) || [],
        asks: data.asks?.map((a: any) => ({ price: a.price, size: a.size })) || [],
        time_exchange: data.time_exchange,
        time_coinapi: data.time_coinapi
      };
      
      return snapshot;
      
    } catch (error: any) {
      this.health.restOrderbookOk = false;
      console.error(`❌ [CoinAPI-WS] REST orderbook error for ${symbolId}:`, error.response?.status, error.message);
      return null;
    }
  }
  
  /**
   * Get order book (WebSocket first, fallback to REST)
   */
  async getOrderBook(symbolId: string): Promise<OrderBookSnapshot | null> {
    // Try WebSocket cache first
    const cached = this.orderBooks.get(symbolId);
    if (cached) {
      // Check if data is fresh (< 5 seconds old)
      const age = Date.now() - new Date(cached.time_coinapi).getTime();
      if (age < 5000) {
        return cached;
      }
    }
    
    // Fallback to REST API and cache the result
    console.log(`🔄 [CoinAPI-WS] Falling back to REST for ${symbolId}`);
    const restSnapshot = await this.fetchOrderBookREST(symbolId);
    
    // Cache REST snapshot for future use (including liquidity metrics)
    if (restSnapshot) {
      this.orderBooks.set(symbolId, restSnapshot);
    }
    
    return restSnapshot;
  }
  
  /**
   * Get gap detection statistics
   */
  getGapStats() {
    return {
      totalGapsDetected: this.gapDetectionStats.totalGapsDetected,
      recoveryTriggered: this.gapDetectionStats.recoveryTriggered,
      lastGapTime: this.gapDetectionStats.lastGapTime
    };
  }
  
  /**
   * Get health status with gap detection stats
   */
  getHealth() {
    return { 
      ...this.health,
      gapStats: this.getGapStats()
    };
  }
  
  /**
   * Register callback for order book updates
   */
  onOrderBookUpdate(callback: (update: OrderBookUpdate) => void) {
    this.updateCallbacks.push(callback);
  }
  
  /**
   * Get all stored order books
   */
  getAllOrderBooks(): Map<string, OrderBookSnapshot> {
    return new Map(this.orderBooks);
  }
  
  /**
   * Calculate liquidity metrics from order book
   */
  calculateLiquidityMetrics(symbolId: string) {
    const book = this.orderBooks.get(symbolId);
    if (!book) return null;
    
    const bidLiquidity = book.bids.reduce((sum, level) => sum + (level.price * level.size), 0);
    const askLiquidity = book.asks.reduce((sum, level) => sum + (level.price * level.size), 0);
    const totalLiquidity = bidLiquidity + askLiquidity;
    
    const bidAskImbalance = bidLiquidity && askLiquidity 
      ? (bidLiquidity - askLiquidity) / (bidLiquidity + askLiquidity) 
      : 0;
    
    const spread = book.asks[0] && book.bids[0] 
      ? book.asks[0].price - book.bids[0].price 
      : 0;
    
    const spreadPercentage = book.asks[0] && book.bids[0] && book.bids[0].price > 0
      ? (spread / book.bids[0].price) * 100
      : 0;
    
    return {
      symbol_id: symbolId,
      bidLiquidity,
      askLiquidity,
      totalLiquidity,
      bidAskImbalance,
      spread,
      spreadPercentage,
      timestamp: book.time_coinapi
    };
  }
  
  /**
   * 🔧 MEMORY LEAK FIX: Comprehensive cleanup on shutdown
   * Public destroy() method for graceful cleanup
   */
  destroy() {
    console.log('🛑 [CoinAPI-WS] Performing comprehensive shutdown...');
    
    // 1. Clear all intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = null;
    }
    
    // 2. Clear message queue
    this.messageQueue = [];
    
    // 3. Close WebSocket with cleanup
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close(1000, 'Graceful shutdown');
      this.ws = null;
    }
    
    // 4. Clear all maps and sets
    this.orderBooks.clear();
    this.subscribedSymbols.clear();
    this.lastSequence.clear();
    this.updateCallbacks = [];
    
    console.log('✅ [CoinAPI-WS] Shutdown complete - all intervals cleared, connections closed');
  }
}

// Export singleton instance
export const coinAPIWebSocket = new CoinAPIWebSocketService();

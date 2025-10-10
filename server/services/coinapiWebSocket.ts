import WebSocket from 'ws';
import axios from 'axios';

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
  
  // In-memory order book storage
  private orderBooks = new Map<string, OrderBookSnapshot>();
  
  // Callback for order book updates
  private updateCallbacks: Array<(update: OrderBookUpdate) => void> = [];
  
  constructor() {
    if (!this.API_KEY) {
      console.error('❌ [CoinAPI-WS] COINAPI_KEY not found in environment');
      return;
    }
    
    // Auto-start connection
    this.connect();
    
    // Periodic health check & reconnect
    setInterval(() => {
      this.healthCheck();
    }, 30000); // Every 30 seconds
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
    
    // Send hello message and subscribe to order book updates
    // Extended symbol list for comprehensive coverage
    const helloMessage = {
      type: 'hello',
      apikey: this.API_KEY,
      subscribe_data_type: ['book5'], // Subscribe to top 5 levels order book
      subscribe_filter_symbol_id: [
        'BINANCE_SPOT_BTC_USDT',
        'BINANCE_SPOT_ETH_USDT',
        'BINANCE_SPOT_SOL_USDT',
        'BINANCE_SPOT_BNB_USDT',
        'BINANCE_SPOT_XRP_USDT',
        'BINANCE_SPOT_DOGE_USDT',
        'BINANCE_SPOT_AVAX_USDT'
      ]
    };
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(helloMessage));
      console.log('📡 [CoinAPI-WS] Subscription sent:', helloMessage.subscribe_filter_symbol_id);
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data) {
    try {
      const message = JSON.parse(data.toString());
      
      this.health.lastWsMessageTime = Date.now();
      this.health.lastWsMessage = message;
      this.health.totalMessagesReceived++;
      
      // Handle different message types
      if (message.type === 'book' || message.type === 'book5' || message.type === 'book20') {
        this.processOrderBookUpdate(message as OrderBookUpdate);
      }
      
    } catch (error) {
      console.error('❌ [CoinAPI-WS] Message parsing error:', error);
    }
  }
  
  /**
   * Process order book update and store in memory
   */
  private processOrderBookUpdate(update: OrderBookUpdate) {
    const { symbol_id, bids, asks, time_exchange, time_coinapi } = update;
    
    // Update local order book
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
   * Get health status
   */
  getHealth(): CoinAPIWebSocketHealth {
    return { ...this.health };
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
   * Graceful shutdown
   */
  shutdown() {
    console.log('🛑 [CoinAPI-WS] Shutting down WebSocket connection');
    if (this.ws) {
      this.ws.close(1000, 'Graceful shutdown');
      this.ws = null;
    }
  }
}

// Export singleton instance
export const coinAPIWebSocket = new CoinAPIWebSocketService();

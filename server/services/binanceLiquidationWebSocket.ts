/**
 * Binance Liquidation WebSocket Manager
 * Real-time liquidation event tracking from Binance Futures
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { liquidationProcessor, LiquidationEvent } from './liquidationProcessor';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface BinanceLiquidationData {
  e: 'forceOrder';
  E: number; // Event time
  o: {
    s: string; // Symbol
    S: 'BUY' | 'SELL'; // Side
    o: 'LIMIT' | 'MARKET'; // Order type
    f: 'IOC'; // Time in force
    q: string; // Original quantity
    p: string; // Price
    ap: string; // Average price
    X: string; // Order status
    l: string; // Last filled quantity
    z: string; // Filled accumulated quantity
    T: number; // Order trade time
  };
}

interface ConnectionStatus {
  connected: boolean;
  lastUpdate: Date | null;
  totalMessages: number;
  errors: number;
  reconnectAttempts: number;
}

// ============================================================================
// BINANCE LIQUIDATION WEBSOCKET MANAGER
// ============================================================================

export class BinanceLiquidationWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;
  
  private readonly baseUrl = 'wss://fstream.binance.com';
  private readonly reconnectDelay = 5000; // 5 seconds
  private readonly maxReconnectDelay = 60000; // 60 seconds
  private readonly pingIntervalMs = 30000; // 30 seconds
  
  private status: ConnectionStatus = {
    connected: false,
    lastUpdate: null,
    totalMessages: 0,
    errors: 0,
    reconnectAttempts: 0
  };

  private subscribedSymbols: Set<string> = new Set();

  constructor() {
    super();
  }

  /**
   * Start WebSocket connection and subscribe to liquidation streams
   */
  async start(symbols: string[]): Promise<void> {
    if (this.isConnecting || this.ws) {
      console.log('[Binance WS] Already connected or connecting');
      return;
    }

    this.subscribedSymbols = new Set(symbols.map(s => s.toLowerCase()));
    await this.connect();
  }

  /**
   * Connect to Binance WebSocket
   */
  private async connect(): Promise<void> {
    if (this.isConnecting) return;

    this.isConnecting = true;

    try {
      // Create stream URL for all liquidation orders
      const streamUrl = `${this.baseUrl}/ws/!forceOrder@arr`;

      console.log('[Binance WS] Connecting to:', streamUrl);

      this.ws = new WebSocket(streamUrl);

      this.ws.on('open', () => this.handleOpen());
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('error', (error) => this.handleError(error));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason));
      this.ws.on('ping', () => this.handlePing());
      this.ws.on('pong', () => this.handlePong());

    } catch (error) {
      console.error('[Binance WS] Connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('[Binance WS] Connected successfully');
    
    this.isConnecting = false;
    this.status.connected = true;
    this.status.reconnectAttempts = 0;
    this.status.lastUpdate = new Date();

    // Start ping interval
    this.startPingInterval();

    this.emit('connected', this.status);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle liquidation order event
      if (message.e === 'forceOrder') {
        this.handleLiquidationEvent(message as BinanceLiquidationData);
      }

      this.status.totalMessages++;
      this.status.lastUpdate = new Date();

    } catch (error) {
      console.error('[Binance WS] Message parsing error:', error);
      this.status.errors++;
    }
  }

  /**
   * Handle liquidation event
   */
  private handleLiquidationEvent(data: BinanceLiquidationData): void {
    const symbol = data.o.s;

    // Filter only subscribed symbols
    if (!this.subscribedSymbols.has(symbol.toLowerCase())) {
      return;
    }

    const price = parseFloat(data.o.p);
    const quantity = parseFloat(data.o.q);
    const side = data.o.S;

    // Estimate leverage based on liquidation
    const estimatedLeverage = this.estimateLeverage(price, quantity);

    const liquidationEvent: LiquidationEvent = {
      symbol,
      side,
      price,
      quantity,
      timestamp: new Date(data.E),
      exchange: 'binance',
      estimatedLeverage,
      value: price * quantity
    };

    // Add to liquidation processor
    liquidationProcessor.addLiquidationEvent(liquidationEvent);

    // Emit event
    this.emit('liquidation', liquidationEvent);

    console.log(
      `[Binance WS] Liquidation: ${symbol} ${side} ${quantity} @ ${price} (${estimatedLeverage}x)`
    );
  }

  /**
   * Estimate leverage from liquidation data
   * This is a simplified estimation based on typical margin requirements
   */
  private estimateLeverage(price: number, quantity: number): number {
    const notionalValue = price * quantity;

    // Binance margin tiers (simplified)
    if (notionalValue < 50000) return 125;
    if (notionalValue < 250000) return 100;
    if (notionalValue < 1000000) return 50;
    if (notionalValue < 5000000) return 20;
    if (notionalValue < 20000000) return 10;
    return 5;
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Error): void {
    console.error('[Binance WS] Error:', error.message);
    this.status.errors++;
    this.emit('error', error);
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: Buffer): void {
    console.log(`[Binance WS] Connection closed: ${code} - ${reason.toString()}`);
    
    this.status.connected = false;
    this.isConnecting = false;

    this.stopPingInterval();

    this.emit('disconnected', { code, reason: reason.toString() });

    if (this.shouldReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle ping from server
   */
  private handlePing(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.pong();
    }
  }

  /**
   * Handle pong from server
   */
  private handlePong(): void {
    // Connection is alive
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.pingIntervalMs);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.status.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`[Binance WS] Reconnecting in ${delay}ms...`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.status.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Stop WebSocket connection
   */
  async stop(): Promise<void> {
    console.log('[Binance WS] Stopping...');

    this.shouldReconnect = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.removeAllListeners();
      
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Normal closure');
      }
      
      this.ws = null;
    }

    this.status.connected = false;
    this.isConnecting = false;

    console.log('[Binance WS] Stopped');
  }

  /**
   * Add symbols to subscription
   */
  addSymbols(symbols: string[]): void {
    symbols.forEach(symbol => {
      this.subscribedSymbols.add(symbol.toLowerCase());
    });
    console.log('[Binance WS] Added symbols:', symbols);
  }

  /**
   * Remove symbols from subscription
   */
  removeSymbols(symbols: string[]): void {
    symbols.forEach(symbol => {
      this.subscribedSymbols.delete(symbol.toLowerCase());
    });
    console.log('[Binance WS] Removed symbols:', symbols);
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  /**
   * Get subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const binanceLiquidationWS = new BinanceLiquidationWebSocket();

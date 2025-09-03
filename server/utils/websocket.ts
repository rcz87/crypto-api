import WebSocket from 'ws';
import { metricsCollector } from './metrics';

interface VolatilityMetrics {
  priceChangeBps: number;
  ticksPerSecond: number;
  lastPrice: number;
  lastUpdateTime: number;
  tickCount: number;
}

export class WebSocketBackpressureManager {
  private volatilityMetrics: VolatilityMetrics = {
    priceChangeBps: 0,
    ticksPerSecond: 0,
    lastPrice: 0,
    lastUpdateTime: Date.now(),
    tickCount: 0
  };

  private readonly MAX_BUFFER_SIZE = 512 * 1024; // 512KB buffer limit
  private readonly HIGH_VOLATILITY_THRESHOLD = 50; // basis points
  private readonly NORMAL_THROTTLE_MS = 3000;
  private readonly HIGH_VOLATILITY_THROTTLE_MS = 500;

  // Calculate volatility score (0-1)
  calculateVolatilityScore(): number {
    const priceVolatility = Math.min(this.volatilityMetrics.priceChangeBps / this.HIGH_VOLATILITY_THRESHOLD, 1);
    const tickVolatility = Math.min(this.volatilityMetrics.ticksPerSecond / 15, 1);
    
    return Math.max(priceVolatility, tickVolatility);
  }

  // Get adaptive throttle interval based on volatility
  getAdaptiveThrottle(): number {
    const volatilityScore = this.calculateVolatilityScore();
    
    if (volatilityScore > 0.7) {
      return this.HIGH_VOLATILITY_THROTTLE_MS; // High volatility = faster updates
    }
    
    return this.NORMAL_THROTTLE_MS + (volatilityScore * 2000); // 3-5s range
  }

  // Update price metrics for volatility calculation
  updatePriceMetrics(newPrice: number): void {
    const now = Date.now();
    
    if (this.volatilityMetrics.lastPrice > 0) {
      const priceChange = Math.abs(newPrice - this.volatilityMetrics.lastPrice);
      this.volatilityMetrics.priceChangeBps = (priceChange / this.volatilityMetrics.lastPrice) * 10000;
    }
    
    // Calculate ticks per second (rolling window)
    const timeDiff = now - this.volatilityMetrics.lastUpdateTime;
    if (timeDiff >= 1000) { // Reset every second
      this.volatilityMetrics.ticksPerSecond = this.volatilityMetrics.tickCount;
      this.volatilityMetrics.tickCount = 0;
      this.volatilityMetrics.lastUpdateTime = now;
    } else {
      this.volatilityMetrics.tickCount++;
    }
    
    this.volatilityMetrics.lastPrice = newPrice;
  }

  // Safe WebSocket send with backpressure control
  safeSend(ws: WebSocket, data: any): boolean {
    // Check WebSocket state
    if (ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    // Check buffer size for backpressure
    if (ws.bufferedAmount > this.MAX_BUFFER_SIZE) {
      console.warn(`WebSocket buffer full (${ws.bufferedAmount} bytes), skipping non-critical message`);
      metricsCollector.updateBufferedAmount(ws.bufferedAmount);
      return false;
    }

    try {
      ws.send(JSON.stringify(data));
      metricsCollector.updateBufferedAmount(ws.bufferedAmount);
      return true;
    } catch (error) {
      console.error('WebSocket send error:', error);
      return false;
    }
  }

  // Smart broadcast with prioritization
  smartBroadcast(clients: Set<WebSocket>, data: any, priority: 'high' | 'normal' | 'low' = 'normal'): number {
    let successCount = 0;
    const volatilityScore = this.calculateVolatilityScore();
    const clientsArray = Array.from(clients);
    
    for (const client of clientsArray) {
      // For high volatility, be more aggressive with low priority messages
      if (priority === 'low' && volatilityScore > 0.8 && client.bufferedAmount > this.MAX_BUFFER_SIZE * 0.5) {
        continue; // Skip low priority messages when buffer is half full during high volatility
      }

      if (this.safeSend(client, data)) {
        successCount++;
      } else {
        // Remove dead connections
        if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
          clients.delete(client);
        }
      }
    }

    return successCount;
  }

  // Get throttle recommendations for different data types
  getThrottleConfig() {
    const volatilityScore = this.calculateVolatilityScore();
    
    return {
      ticker: volatilityScore > 0.7 ? 1000 : 2500,    // 1s high vol, 2.5s normal
      orderBook: volatilityScore > 0.7 ? 800 : 1500,  // 800ms high vol, 1.5s normal  
      trades: volatilityScore > 0.5 ? 500 : 1000,     // 500ms medium vol, 1s normal
      volatilityScore,
      isHighVolatility: volatilityScore > 0.7
    };
  }

  // Get current metrics for monitoring
  getMetrics() {
    return {
      volatility: this.volatilityMetrics,
      volatilityScore: this.calculateVolatilityScore(),
      adaptiveThrottle: this.getAdaptiveThrottle(),
      throttleConfig: this.getThrottleConfig()
    };
  }
}

// Singleton instance
export const backpressureManager = new WebSocketBackpressureManager();
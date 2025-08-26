import axios, { AxiosInstance } from 'axios';
import { createHmac } from 'crypto';
import WebSocket from 'ws';
import { TickerData, CandleData, OrderBookData, RecentTradeData, SolCompleteData } from '@shared/schema';

export class OKXService {
  private client: AxiosInstance;
  private apiKey: string;
  private secretKey: string;
  private passphrase: string;
  private baseURL = 'https://www.okx.com';
  private wsUrl = 'wss://ws.okx.com:8443/ws/v5/public';
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;

  constructor() {
    this.apiKey = process.env.OKX_API_KEY || '';
    this.secretKey = process.env.OKX_SECRET_KEY || '';
    this.passphrase = process.env.OKX_PASSPHRASE || '';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': this.apiKey,
        'OK-ACCESS-PASSPHRASE': this.passphrase,
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        const timestamp = Date.now() / 1000;
        const method = config.method?.toUpperCase() || 'GET';
        const requestPath = config.url || '';
        const body = config.data ? JSON.stringify(config.data) : '';
        
        // Create signature for OKX API
        const prehashString = timestamp + method + requestPath + body;
        const signature = this.createSignature(prehashString);
        
        config.headers['OK-ACCESS-SIGN'] = signature;
        config.headers['OK-ACCESS-TIMESTAMP'] = timestamp.toString();
        
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  private createSignature(prehashString: string): string {
    return createHmac('sha256', this.secretKey).update(prehashString).digest('base64');
  }

  async getTicker(symbol: string = 'SOL-USDT'): Promise<TickerData> {
    try {
      const response = await this.client.get(`/api/v5/market/ticker?instId=${symbol}`);
      
      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      const tickerData = response.data.data[0];
      
      return {
        symbol: tickerData.instId,
        price: tickerData.last,
        change24h: ((parseFloat(tickerData.last) - parseFloat(tickerData.open24h)) / parseFloat(tickerData.open24h) * 100).toFixed(2) + '%',
        high24h: tickerData.high24h,
        low24h: tickerData.low24h,
        volume: tickerData.vol24h,
        tradingVolume24h: (parseFloat(tickerData.last) * parseFloat(tickerData.vol24h)).toFixed(0), // This is trading volume, not market cap
      };
    } catch (error) {
      console.error('Error fetching ticker:', error);
      throw new Error('Failed to fetch ticker data from OKX');
    }
  }

  async getCandles(symbol: string = 'SOL-USDT', bar: string = '1H', limit: number = 24): Promise<CandleData[]> {
    try {
      const response = await this.client.get(`/api/v5/market/candles?instId=${symbol}&bar=${bar}&limit=${limit}`);
      
      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      return response.data.data.map((candle: string[]) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
    } catch (error) {
      console.error('Error fetching candles:', error);
      throw new Error(`Failed to fetch ${bar} candle data from OKX`);
    }
  }

  async getOrderBook(symbol: string = 'SOL-USDT', depth: number = 20): Promise<OrderBookData> {
    try {
      const response = await this.client.get(`/api/v5/market/books?instId=${symbol}&sz=${depth}`);
      
      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      const orderBookData = response.data.data[0];
      
      const asks = orderBookData.asks.map((ask: string[]) => ({
        price: ask[0],
        size: ask[1],
      }));

      const bids = orderBookData.bids.map((bid: string[]) => ({
        price: bid[0],
        size: bid[1],
      }));

      const spread = (parseFloat(asks[0]?.price || '0') - parseFloat(bids[0]?.price || '0')).toFixed(4);

      return {
        asks,
        bids,
        spread,
      };
    } catch (error) {
      console.error('Error fetching order book:', error);
      throw new Error('Failed to fetch order book data from OKX');
    }
  }

  async getRecentTrades(symbol: string = 'SOL-USDT', limit: number = 20): Promise<RecentTradeData[]> {
    try {
      const response = await this.client.get(`/api/v5/market/trades?instId=${symbol}&limit=${limit}`);
      
      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      return response.data.data.map((trade: any) => ({
        price: trade.px,
        size: trade.sz,
        side: trade.side,
        timestamp: trade.ts,
      }));
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      throw new Error('Failed to fetch recent trades data from OKX');
    }
  }

  async getCompleteSOLData(): Promise<SolCompleteData> {
    try {
      const [ticker, candles1H, candles4H, candles1D, orderBook, recentTrades] = await Promise.all([
        this.getTicker('SOL-USDT'),
        this.getCandles('SOL-USDT', '1H', 50), // Increased from 24 to 50
        this.getCandles('SOL-USDT', '4H', 50), // Increased from 24 to 50  
        this.getCandles('SOL-USDT', '1D', 60), // Increased from 30 to 60
        this.getOrderBook('SOL-USDT', 20), // Increased to 20 levels for better depth
        this.getRecentTrades('SOL-USDT', 30), // Increased from 20 to 30
      ]);

      return {
        ticker,
        candles: {
          '1H': candles1H,
          '4H': candles4H,
          '1D': candles1D,
        },
        orderBook,
        recentTrades,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching complete SOL data:', error);
      throw new Error('Failed to fetch complete SOL data from OKX');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v5/market/ticker?instId=BTC-USDT');
      return response.data.code === '0';
    } catch (error) {
      console.error('OKX connection test failed:', error);
      return false;
    }
  }

  // WebSocket methods for real-time streaming
  initWebSocket(onMessage?: (data: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.on('open', () => {
          console.log('OKX WebSocket connected');
          this.reconnectAttempts = 0;
          
          // Subscribe to SOL-USDT ticker, order book, and trades
          const subscriptions = [
            {
              op: 'subscribe',
              args: [
                { channel: 'tickers', instId: 'SOL-USDT' },
                { channel: 'books', instId: 'SOL-USDT' }, // Upgraded to 10 levels
                { channel: 'trades', instId: 'SOL-USDT' }
              ]
            }
          ];
          
          subscriptions.forEach(sub => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify(sub));
            }
          });
          
          resolve();
        });
        
        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            if (onMessage && message.data) {
              onMessage(message);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });
        
        this.ws.on('error', (error) => {
          console.error('OKX WebSocket error:', error);
          reject(error);
        });
        
        this.ws.on('close', (code, reason) => {
          console.log(`OKX WebSocket closed: ${code} - ${reason}`);
          this.attemptReconnect(onMessage);
        });
        
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        reject(error);
      }
    });
  }
  
  private attemptReconnect(onMessage?: (data: any) => void): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.initWebSocket(onMessage).catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectInterval);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }
  
  closeWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  isWebSocketConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const okxService = new OKXService();

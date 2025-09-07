import axios, { AxiosInstance } from 'axios';

interface BybitTestResult {
  endpoint: string;
  status: 'success' | 'error';
  data?: any;
  error?: string;
  responseTime?: number;
}

export class BybitTestService {
  private client: AxiosInstance;
  private baseURL = 'https://api.bybit.com';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async testConnection(): Promise<BybitTestResult[]> {
    const results: BybitTestResult[] = [];

    // Test endpoints in parallel for efficiency
    const tests = [
      this.testTicker(),
      this.testOrderBook(),
      this.testRecentTrades(),
      this.testCandles(),
      this.testInstrumentInfo(),
    ];

    const testResults = await Promise.allSettled(tests);
    
    testResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const endpoints = ['ticker', 'orderbook', 'recent-trades', 'candles', 'instrument-info'];
        results.push({
          endpoint: endpoints[index],
          status: 'error',
          error: result.reason?.message || 'Unknown error'
        });
      }
    });

    return results;
  }

  private async testTicker(): Promise<BybitTestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/v5/market/tickers', {
        params: {
          category: 'linear',
          symbol: 'SOLUSDT'
        }
      });

      const responseTime = Date.now() - startTime;

      if (response.data.retCode === 0) {
        const tickerData = response.data.result.list[0];
        return {
          endpoint: 'ticker',
          status: 'success',
          responseTime,
          data: {
            symbol: tickerData.symbol,
            lastPrice: tickerData.lastPrice,
            price24hPcnt: tickerData.price24hPcnt,
            volume24h: tickerData.volume24h,
            high24h: tickerData.highPrice24h,
            low24h: tickerData.lowPrice24h,
            bid1Price: tickerData.bid1Price,
            ask1Price: tickerData.ask1Price
          }
        };
      } else {
        throw new Error(`Bybit API Error: ${response.data.retMsg}`);
      }
    } catch (error: any) {
      return {
        endpoint: 'ticker',
        status: 'error',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async testOrderBook(): Promise<BybitTestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/v5/market/orderbook', {
        params: {
          category: 'linear',
          symbol: 'SOLUSDT',
          limit: 25
        }
      });

      const responseTime = Date.now() - startTime;

      if (response.data.retCode === 0) {
        const orderbook = response.data.result;
        return {
          endpoint: 'orderbook',
          status: 'success',
          responseTime,
          data: {
            symbol: orderbook.s,
            updateId: orderbook.u,
            bids: orderbook.b.slice(0, 5), // Top 5 bids
            asks: orderbook.a.slice(0, 5), // Top 5 asks
            timestamp: orderbook.ts
          }
        };
      } else {
        throw new Error(`Bybit API Error: ${response.data.retMsg}`);
      }
    } catch (error: any) {
      return {
        endpoint: 'orderbook',
        status: 'error',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async testRecentTrades(): Promise<BybitTestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/v5/market/recent-trade', {
        params: {
          category: 'linear',
          symbol: 'SOLUSDT',
          limit: 10
        }
      });

      const responseTime = Date.now() - startTime;

      if (response.data.retCode === 0) {
        const trades = response.data.result.list;
        return {
          endpoint: 'recent-trades',
          status: 'success',
          responseTime,
          data: {
            symbol: 'SOLUSDT',
            tradesCount: trades.length,
            recentTrades: trades.slice(0, 3).map((trade: any) => ({
              price: trade.price,
              size: trade.size,
              side: trade.side,
              time: trade.time
            }))
          }
        };
      } else {
        throw new Error(`Bybit API Error: ${response.data.retMsg}`);
      }
    } catch (error: any) {
      return {
        endpoint: 'recent-trades',
        status: 'error',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async testCandles(): Promise<BybitTestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/v5/market/kline', {
        params: {
          category: 'linear',
          symbol: 'SOLUSDT',
          interval: '15',
          limit: 10
        }
      });

      const responseTime = Date.now() - startTime;

      if (response.data.retCode === 0) {
        const candles = response.data.result.list;
        return {
          endpoint: 'candles',
          status: 'success',
          responseTime,
          data: {
            symbol: 'SOLUSDT',
            interval: '15m',
            candlesCount: candles.length,
            latestCandle: candles[0] ? {
              timestamp: candles[0][0],
              open: candles[0][1],
              high: candles[0][2],
              low: candles[0][3],
              close: candles[0][4],
              volume: candles[0][5]
            } : null
          }
        };
      } else {
        throw new Error(`Bybit API Error: ${response.data.retMsg}`);
      }
    } catch (error: any) {
      return {
        endpoint: 'candles',
        status: 'error',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async testInstrumentInfo(): Promise<BybitTestResult> {
    const startTime = Date.now();
    try {
      const response = await this.client.get('/v5/market/instruments-info', {
        params: {
          category: 'linear',
          symbol: 'SOLUSDT'
        }
      });

      const responseTime = Date.now() - startTime;

      if (response.data.retCode === 0) {
        const instrument = response.data.result.list[0];
        return {
          endpoint: 'instrument-info',
          status: 'success',
          responseTime,
          data: {
            symbol: instrument.symbol,
            status: instrument.status,
            baseCoin: instrument.baseCoin,
            quoteCoin: instrument.quoteCoin,
            contractType: instrument.contractType,
            minPrice: instrument.priceFilter.minPrice,
            maxPrice: instrument.priceFilter.maxPrice,
            tickSize: instrument.priceFilter.tickSize
          }
        };
      } else {
        throw new Error(`Bybit API Error: ${response.data.retMsg}`);
      }
    } catch (error: any) {
      return {
        endpoint: 'instrument-info',
        status: 'error',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  async testWebSocketConnection(): Promise<BybitTestResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const wsUrl = 'wss://stream.bybit.com/v5/public/linear';
      
      try {
        const WebSocket = require('ws');
        const ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            endpoint: 'websocket',
            status: 'error',
            error: 'Connection timeout',
            responseTime: Date.now() - startTime
          });
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          
          // Test subscription to ticker
          ws.send(JSON.stringify({
            op: 'subscribe',
            args: ['tickers.SOLUSDT']
          }));
        });

        ws.on('message', (data: any) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.success === true && message.op === 'subscribe') {
              ws.close();
              resolve({
                endpoint: 'websocket',
                status: 'success',
                responseTime: Date.now() - startTime,
                data: {
                  connection: 'successful',
                  subscription: 'tickers.SOLUSDT confirmed'
                }
              });
            }
          } catch (e) {
            // Ignore parsing errors for this test
          }
        });

        ws.on('error', (error: any) => {
          clearTimeout(timeout);
          resolve({
            endpoint: 'websocket',
            status: 'error',
            error: error.message,
            responseTime: Date.now() - startTime
          });
        });

      } catch (error: any) {
        resolve({
          endpoint: 'websocket',
          status: 'error',
          error: error.message,
          responseTime: Date.now() - startTime
        });
      }
    });
  }
}
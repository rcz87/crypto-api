import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';

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
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
    });
  }

  async testConnection(): Promise<BybitTestResult[]> {
    const results: BybitTestResult[] = [];

    // Test endpoints sequentially with delays to avoid rate limiting
    const tests = [
      { name: 'ticker', fn: () => this.testTicker() },
      { name: 'orderbook', fn: () => this.testOrderBook() },
      { name: 'recent-trades', fn: () => this.testRecentTrades() },
      { name: 'candles', fn: () => this.testCandles() },
      { name: 'instrument-info', fn: () => this.testInstrumentInfo() },
    ];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      
      try {
        const result = await test.fn();
        results.push(result);
      } catch (error: any) {
        results.push({
          endpoint: test.name,
          status: 'error',
          error: error.message || 'Unknown error'
        });
      }

      // Add delay between requests to avoid rate limiting (except for last request)
      if (i < tests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
      }
    }

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
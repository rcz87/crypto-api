import axios, { AxiosInstance } from 'axios';
import { createHmac } from 'crypto';
import WebSocket from 'ws';
import { TickerData, CandleData, OrderBookData, RecentTradeData, SolCompleteData, FundingRateData, OpenInterestData, EnhancedOrderBookData, VolumeProfileData, SMCAnalysisData } from '@shared/schema';
import { SMCService } from './smc';
import { cache, TTL_CONFIG } from '../utils/cache';
import { metricsCollector } from '../utils/metrics';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class OKXService {
  private client: AxiosInstance;
  private apiKey: string;
  private secretKey: string;
  private passphrase: string;
  private baseURL = 'https://www.okx.com';
  private wsUrl = 'wss://ws.okx.com:8443/ws/v5/public';
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased for better reliability
  private reconnectInterval = 3000;  // Faster reconnection
  private pingInterval: NodeJS.Timeout | null = null;
  private smcService: SMCService;
  
  // WebSocket status tracking for metrics
  private wsConnected = false;
  private lastWsMessage = 0;

  constructor() {
    this.apiKey = process.env.OKX_API_KEY || '';
    this.secretKey = process.env.OKX_SECRET_KEY || '';
    this.passphrase = process.env.OKX_PASSPHRASE || '';
    this.smcService = new SMCService();

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

  // Cache helper method
  private getCacheKey(method: string, params?: any): string {
    return `okx:${method}:${JSON.stringify(params || {})}`;
  }

  async getTicker(symbol: string = 'SOL-USDT-SWAP'): Promise<TickerData> {
    const cacheKey = this.getCacheKey('ticker', { symbol });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        metricsCollector.updateOkxRestStatus('up');
        const response = await this.client.get(`/api/v5/market/ticker?instId=${symbol}`);
        
        if (response.data.code !== '0') {
          throw new Error(`OKX API Error: ${response.data.msg}`);
        }

        const tickerData = response.data.data[0];
        
        const result: TickerData = {
          symbol: tickerData.instId,
          price: tickerData.last,
          change24h: ((parseFloat(tickerData.last) - parseFloat(tickerData.open24h)) / parseFloat(tickerData.open24h) * 100).toFixed(2) + '%',
          high24h: tickerData.high24h,
          low24h: tickerData.low24h,
          volume: tickerData.vol24h,
          tradingVolume24h: (parseFloat(tickerData.last) * parseFloat(tickerData.vol24h)).toFixed(0), // This is trading volume, not market cap
        };

        return result;
      } catch (error) {
        console.error('Error fetching ticker:', error);
        metricsCollector.updateOkxRestStatus('down');
        throw new Error('Failed to fetch ticker data from OKX');
      }
    }, TTL_CONFIG.TICKER);
  }

  async getCandles(symbol: string = 'SOL-USDT-SWAP', bar: string = '1H', limit: number = 24): Promise<CandleData[]> {
    const cacheKey = this.getCacheKey('candles', { symbol, bar, limit });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        metricsCollector.updateOkxRestStatus('up');
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
        metricsCollector.updateOkxRestStatus('down');
        throw new Error(`Failed to fetch ${bar} candle data from OKX`);
      }
    }, TTL_CONFIG.CANDLES);
  }

  async getOrderBook(symbol: string = 'SOL-USDT-SWAP', depth: number = 50): Promise<OrderBookData> {
    const cacheKey = this.getCacheKey('orderBook', { symbol, depth });
    
    return cache.getSingleFlight(cacheKey, async () => {
      try {
        metricsCollector.updateOkxRestStatus('up');
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

        const result: OrderBookData = {
          asks,
          bids,
          spread,
        };

        return result;
      } catch (error) {
        console.error('Error fetching order book:', error);
        metricsCollector.updateOkxRestStatus('down');
        throw new Error('Failed to fetch order book data from OKX');
      }
    }, TTL_CONFIG.ORDERBOOK);
  }

  async getRecentTrades(symbol: string = 'SOL-USDT-SWAP', limit: number = 20): Promise<RecentTradeData[]> {
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
      const results = await Promise.allSettled([
        this.getTicker('SOL-USDT-SWAP'),
        this.getCandles('SOL-USDT-SWAP', '5m', 100),  // 5m: 8+ hours of data
        this.getCandles('SOL-USDT-SWAP', '15m', 96),  // 15m: 24+ hours of data
        this.getCandles('SOL-USDT-SWAP', '30m', 48),  // 30m: 24+ hours of data
        this.getCandles('SOL-USDT-SWAP', '1H', 72),   // 1H: 72+ hours (3+ days) of data
        this.getCandles('SOL-USDT-SWAP', '4H', 42),   // 4H: 168+ hours (7+ days) of data  
        this.getCandles('SOL-USDT-SWAP', '1D', 90),   // 1D: 90+ days (3+ months) of data
        this.getCandles('SOL-USDT-SWAP', '1W', 52),   // 1W: 52+ weeks (1+ year) of data
        this.getOrderBook('SOL-USDT-SWAP', 50), // Increased to 50 levels for maximum depth
        this.getRecentTrades('SOL-USDT-SWAP', 30), // Increased from 20 to 30
      ]);

      // Extract results with fallbacks for failed requests
      const ticker = results[0].status === 'fulfilled' ? results[0].value : null;
      const candles5m = results[1].status === 'fulfilled' ? results[1].value : [];
      const candles15m = results[2].status === 'fulfilled' ? results[2].value : [];
      const candles30m = results[3].status === 'fulfilled' ? results[3].value : [];
      const candles1H = results[4].status === 'fulfilled' ? results[4].value : [];
      const candles4H = results[5].status === 'fulfilled' ? results[5].value : [];
      const candles1D = results[6].status === 'fulfilled' ? results[6].value : [];
      const candles1W = results[7].status === 'fulfilled' ? results[7].value : [];
      const orderBook = results[8].status === 'fulfilled' ? results[8].value : {
        asks: [],
        bids: [],
        spread: '0.0000'
      };
      const recentTrades = results[9].status === 'fulfilled' ? results[9].value : [];

      // Log any failed requests for debugging
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const endpoints = ['ticker', '5m', '15m', '30m', '1H', '4H', '1D', '1W', 'orderBook', 'trades'];
          console.error(`Failed to fetch ${endpoints[index]}:`, result.reason);
        }
      });

      // Ensure we have at least ticker data
      if (!ticker) {
        throw new Error('Critical: Failed to fetch ticker data');
      }

      return {
        ticker,
        candles: {
          '5m': candles5m,   // Scalping & micro-movements
          '15m': candles15m, // Short-term patterns
          '30m': candles30m, // Intraday analysis
          '1H': candles1H,   // Day trading
          '4H': candles4H,   // Swing trading
          '1D': candles1D,   // Position trading
          '1W': candles1W,   // Long-term trends
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
          metricsCollector.updateOkxWsStatus('up');
          
          // Subscribe to comprehensive SOL-USDT data streams
          const subscriptions = [
            {
              op: 'subscribe',
              args: [
                { channel: 'tickers', instId: 'SOL-USDT-SWAP' },
                { channel: 'books', instId: 'SOL-USDT-SWAP' },     // Real-time order book
                { channel: 'trades', instId: 'SOL-USDT-SWAP' },    // All trades
                { channel: 'books-l2-tbt', instId: 'SOL-USDT-SWAP' }, // Tick-by-tick order book updates
                { channel: 'mark-price', instId: 'SOL-USDT-SWAP' }, // Mark price for derivatives
                { channel: 'funding-rate', instId: 'SOL-USDT-SWAP' } // Funding rate data
              ]
            }
          ];
          
          subscriptions.forEach(sub => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify(sub));
            }
          });

          // Setup ping/pong for connection health
          this.setupPingPong();
          
          resolve();
        });
        
        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            metricsCollector.updateOkxWsStatus('up'); // Update on each message received
            if (onMessage && message.data) {
              onMessage(message);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });
        
        this.ws.on('error', (error) => {
          console.error('OKX WebSocket error:', error);
          // Clear ping interval on error to prevent memory leak
          if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
          }
          reject(error);
        });
        
        this.ws.on('close', (code, reason) => {
          console.log(`OKX WebSocket closed: ${code} - ${reason}`);
          // Clear ping interval on close to prevent memory leak
          if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
          }
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
      
      // Exponential backoff: 3s, 6s, 12s, 24s, etc.
      const backoffDelay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);
      
      setTimeout(() => {
        this.initWebSocket(onMessage).catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, backoffDelay);
    } else {
      console.error('Max reconnection attempts reached');
      // Reset after 5 minutes to allow fresh reconnection attempts
      setTimeout(() => {
        this.reconnectAttempts = 0;
        console.log('Reconnection attempts reset, allowing new attempts');
      }, 300000);
    }
  }

  // Get funding rate for SOL perpetual swap
  async getFundingRate(symbol: string = 'SOL-USDT-SWAP'): Promise<FundingRateData> {
    try {
      const response = await this.client.get(`/api/v5/public/funding-rate?instId=${symbol}`);
      
      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      const fundingData = response.data.data[0];
      
      return {
        instId: fundingData.instId,
        fundingRate: fundingData.fundingRate,
        nextFundingRate: fundingData.nextFundingRate || '',
        nextFundingTime: fundingData.nextFundingTime,
        fundingTime: fundingData.fundingTime,
        premium: fundingData.premium,
        interestRate: fundingData.interestRate,
        maxFundingRate: fundingData.maxFundingRate,
        minFundingRate: fundingData.minFundingRate,
        settFundingRate: fundingData.settFundingRate,
        settState: fundingData.settState,
        timestamp: fundingData.ts,
      };
    } catch (error) {
      console.error('Error fetching funding rate:', error);
      throw new Error('Failed to fetch funding rate data');
    }
  }

  // Get open interest for SOL perpetual swap
  async getOpenInterest(symbol: string = 'SOL-USDT-SWAP'): Promise<OpenInterestData> {
    try {
      const response = await this.client.get(`/api/v5/public/open-interest?instType=SWAP&instId=${symbol}`);
      
      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      const oiData = response.data.data[0];
      
      return {
        instId: oiData.instId,
        instType: oiData.instType,
        oi: oiData.oi,
        oiCcy: oiData.oiCcy,
        oiUsd: oiData.oiUsd,
        timestamp: oiData.ts,
      };
    } catch (error) {
      console.error('Error fetching open interest:', error);
      throw new Error('Failed to fetch open interest data');
    }
  }

  // Get enhanced order book with deeper levels and analysis
  async getEnhancedOrderBook(symbol: string = 'SOL-USDT-SWAP', depth: number = 400): Promise<EnhancedOrderBookData> {
    try {
      const response = await this.client.get(`/api/v5/market/books?instId=${symbol}&sz=${depth}`);
      
      if (response.data.code !== '0') {
        throw new Error(`OKX API Error: ${response.data.msg}`);
      }

      const bookData = response.data.data[0];
      const asks = bookData.asks.map((ask: string[]) => ({ price: ask[0], size: ask[1] }));
      const bids = bookData.bids.map((bid: string[]) => ({ price: bid[0], size: bid[1] }));
      
      // Calculate spread
      const bestAsk = parseFloat(asks[0]?.price || '0');
      const bestBid = parseFloat(bids[0]?.price || '0');
      const spread = ((bestAsk - bestBid) / bestBid * 100).toFixed(4);

      // Detect large orders (walls) - orders significantly larger than average
      const avgAskSize = asks.reduce((sum: number, ask: any) => sum + parseFloat(ask.size), 0) / asks.length;
      const avgBidSize = bids.reduce((sum: number, bid: any) => sum + parseFloat(bid.size), 0) / bids.length;
      const wallThreshold = 3; // 3x average size

      const askWalls = asks
        .filter((ask: any) => parseFloat(ask.size) > avgAskSize * wallThreshold)
        .slice(0, 10)
        .map((ask: any) => ({
          price: ask.price,
          size: ask.size,
          isLarge: parseFloat(ask.size) > avgAskSize * wallThreshold * 2,
        }));

      const bidWalls = bids
        .filter((bid: any) => parseFloat(bid.size) > avgBidSize * wallThreshold)
        .slice(0, 10)
        .map((bid: any) => ({
          price: bid.price,
          size: bid.size,
          isLarge: parseFloat(bid.size) > avgBidSize * wallThreshold * 2,
        }));

      // Calculate order book imbalance
      const totalBidVolume = bids.slice(0, 10).reduce((sum: number, bid: any) => sum + parseFloat(bid.size), 0);
      const totalAskVolume = asks.slice(0, 10).reduce((sum: number, ask: any) => sum + parseFloat(ask.size), 0);
      const imbalance = ((totalBidVolume - totalAskVolume) / (totalBidVolume + totalAskVolume) * 100).toFixed(2);

      return {
        asks: asks.slice(0, 50), // Return top 50 levels
        bids: bids.slice(0, 50),
        spread,
        askWalls,
        bidWalls,
        imbalance,
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching enhanced order book:', error);
      throw new Error('Failed to fetch enhanced order book data');
    }
  }

  // Build volume profile from candlestick data
  async getVolumeProfile(symbol: string = 'SOL-USDT-SWAP', timeframe: string = '1H', limit: number = 100): Promise<VolumeProfileData> {
    try {
      // Get historical candlestick data
      const candlesResponse = await this.client.get(
        `/api/v5/market/history-candles?instId=${symbol}&bar=${timeframe}&limit=${limit}`
      );
      
      if (candlesResponse.data.code !== '0') {
        throw new Error(`OKX API Error: ${candlesResponse.data.msg}`);
      }

      const candles = candlesResponse.data.data;
      
      // Calculate volume at each price level
      const volumeByPrice: { [price: string]: number } = {};
      let totalVolume = 0;
      let high = 0;
      let low = Infinity;

      candles.forEach((candle: string[]) => {
        const [timestamp, open, high_price, low_price, close, volume] = candle;
        const vol = parseFloat(volume);
        const h = parseFloat(high_price);
        const l = parseFloat(low_price);
        
        totalVolume += vol;
        high = Math.max(high, h);
        low = Math.min(low, l);
        
        // Distribute volume across price range (simplified VWAP approach)
        const priceRange = h - l;
        const steps = Math.max(1, Math.floor(priceRange / 0.01)); // 0.01 price steps
        const volumePerStep = vol / steps;
        
        for (let i = 0; i < steps; i++) {
          const price = (l + (priceRange * i / steps)).toFixed(2);
          volumeByPrice[price] = (volumeByPrice[price] || 0) + volumePerStep;
        }
      });

      // Find POC (Point of Control) - highest volume price
      let maxVolume = 0;
      let poc = '0';
      
      Object.entries(volumeByPrice).forEach(([price, volume]) => {
        if (volume > maxVolume) {
          maxVolume = volume;
          poc = price;
        }
      });

      // Sort by volume and identify HVN/LVN
      const sortedPrices = Object.entries(volumeByPrice)
        .sort(([,a], [,b]) => b - a)
        .map(([price, volume]) => ({
          price,
          volume: volume.toFixed(2),
          percentage: ((volume / totalVolume) * 100).toFixed(2),
        }));

      const hvnLevels = sortedPrices.slice(0, 5); // Top 5 high volume nodes
      const lvnLevels = sortedPrices.slice(-5).reverse(); // Bottom 5 low volume nodes

      // Calculate Value Area (typically 70% of volume)
      const targetVolume = totalVolume * 0.7;
      let accumulatedVolume = 0;
      let valueAreaHigh = high;
      let valueAreaLow = low;
      
      // Find 70% value area around POC
      const pocPrice = parseFloat(poc);
      const pricesAroundPoc = sortedPrices
        .filter(p => Math.abs(parseFloat(p.price) - pocPrice) <= (high - low) * 0.3)
        .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

      if (pricesAroundPoc.length > 0) {
        valueAreaHigh = parseFloat(pricesAroundPoc[pricesAroundPoc.length - 1].price);
        valueAreaLow = parseFloat(pricesAroundPoc[0].price);
      }

      return {
        poc,
        hvnLevels,
        lvnLevels,
        totalVolume: totalVolume.toFixed(2),
        valueArea: {
          high: valueAreaHigh.toFixed(2),
          low: valueAreaLow.toFixed(2),
          percentage: '70',
        },
        profileRange: {
          high: high.toFixed(2),
          low: low.toFixed(2),
          timeframe,
        },
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error building volume profile:', error);
      throw new Error('Failed to build volume profile data');
    }
  }

  // SMC Analysis using historical candlestick data
  async getSMCAnalysis(symbol: string = 'SOL-USDT-SWAP', timeframe: string = '1H', limit: number = 100): Promise<SMCAnalysisData> {
    try {
      // Get historical candlestick data for SMC analysis
      const candlesResponse = await this.client.get(
        `/api/v5/market/history-candles?instId=${symbol}&bar=${timeframe}&limit=${limit}`
      );
      
      if (candlesResponse.data.code !== '0') {
        throw new Error(`OKX API Error: ${candlesResponse.data.msg}`);
      }

      // Convert OKX candle format to our schema format
      const candles = candlesResponse.data.data.map((candle: string[]) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));

      // Perform SMC analysis using the SMC service
      const smcAnalysis = await this.smcService.analyzeSMC(candles, timeframe);
      
      return smcAnalysis;
    } catch (error) {
      console.error('Error performing SMC analysis:', error);
      throw new Error('Failed to perform SMC analysis');
    }
  }

  private setupPingPong(): void {
    // Clear existing ping interval before creating new one to prevent memory leak
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Send ping every 25 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 'ping' }));
      }
    }, 25000);
  }
  
  closeWebSocket(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
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

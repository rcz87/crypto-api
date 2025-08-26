import axios, { AxiosInstance } from 'axios';
import { createHmac } from 'crypto';
import WebSocket from 'ws';
import { TickerData, CandleData, OrderBookData, RecentTradeData, SolCompleteData, FundingRateData, OpenInterestData, EnhancedOrderBookData, VolumeProfileData } from '@shared/schema';

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

  async getOrderBook(symbol: string = 'SOL-USDT', depth: number = 50): Promise<OrderBookData> {
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
      const [ticker, candles5m, candles15m, candles30m, candles1H, candles4H, candles1D, candles1W, orderBook, recentTrades] = await Promise.all([
        this.getTicker('SOL-USDT'),
        this.getCandles('SOL-USDT', '5m', 100),  // 5m: 8+ hours of data
        this.getCandles('SOL-USDT', '15m', 96),  // 15m: 24+ hours of data
        this.getCandles('SOL-USDT', '30m', 48),  // 30m: 24+ hours of data
        this.getCandles('SOL-USDT', '1H', 72),   // 1H: 72+ hours (3+ days) of data
        this.getCandles('SOL-USDT', '4H', 42),   // 4H: 168+ hours (7+ days) of data  
        this.getCandles('SOL-USDT', '1D', 90),   // 1D: 90+ days (3+ months) of data
        this.getCandles('SOL-USDT', '1W', 52),   // 1W: 52+ weeks (1+ year) of data
        this.getOrderBook('SOL-USDT', 50), // Increased to 50 levels for maximum depth
        this.getRecentTrades('SOL-USDT', 30), // Increased from 20 to 30
      ]);

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
          
          // Subscribe to comprehensive SOL-USDT data streams
          const subscriptions = [
            {
              op: 'subscribe',
              args: [
                { channel: 'tickers', instId: 'SOL-USDT' },
                { channel: 'books', instId: 'SOL-USDT' },     // Real-time order book
                { channel: 'trades', instId: 'SOL-USDT' },    // All trades
                { channel: 'books-l2-tbt', instId: 'SOL-USDT' }, // Tick-by-tick order book updates
                { channel: 'mark-price', instId: 'SOL-USDT' }, // Mark price for derivatives
                { channel: 'funding-rate', instId: 'SOL-USDT' } // Funding rate data
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
  async getEnhancedOrderBook(symbol: string = 'SOL-USDT', depth: number = 400): Promise<EnhancedOrderBookData> {
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
  async getVolumeProfile(symbol: string = 'SOL-USDT', timeframe: string = '1H', limit: number = 100): Promise<VolumeProfileData> {
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

  private setupPingPong(): void {
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

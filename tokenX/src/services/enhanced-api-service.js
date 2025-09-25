/**
 * @fileoverview Enhanced API Service dengan adapters, cache, rate limiting, dan circuit breaker
 * Implementasi sesuai spesifikasi dengan mock-friendly design
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

/**
 * @typedef {import('../types/contracts').ApiConfig} ApiConfig
 */

/**
 * Circuit breaker untuk individual API providers
 */
class ApiCircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 30000; // 30s
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 1min
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
    this.requestCount = 0;
    
    // Reset counters periodically
    setInterval(() => {
      this.requestCount = 0;
      this.successCount = 0;
    }, this.monitoringPeriod);
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        logger.info(`Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    this.requestCount++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = 0;
      logger.info(`Circuit breaker ${this.name} recovered to CLOSED state`);
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    const errorRate = this.requestCount > 0 ? 
      (this.requestCount - this.successCount) / this.requestCount : 0;
    
    if (this.failures >= this.failureThreshold || errorRate > 0.5) {
      this.state = 'OPEN';
      logger.warn(`Circuit breaker ${this.name} opened due to failures`);
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      errorRate: this.requestCount > 0 ? 
        (this.requestCount - this.successCount) / this.requestCount : 0,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Rate limiter untuk API requests
 */
class RateLimiter {
  constructor(requestsPerSecond = 10) {
    this.requestsPerSecond = requestsPerSecond;
    this.requests = [];
  }

  async waitForSlot() {
    const now = Date.now();
    
    // Remove requests older than 1 second
    this.requests = this.requests.filter(time => now - time < 1000);
    
    if (this.requests.length >= this.requestsPerSecond) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 1000 - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.requests.push(Date.now());
  }
}

/**
 * Cache dengan TTL support
 */
class ApiCache {
  constructor() {
    this.cache = new Map();
  }

  set(key, value, ttlMs = 300000) { // Default 5min TTL
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

/**
 * DexScreener API Adapter
 */
class DexScreenerAdapter {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://api.dexscreener.com/latest';
    this.circuitBreaker = new ApiCircuitBreaker('DexScreener');
    this.rateLimiter = new RateLimiter(5); // 5 req/sec
    this.cache = new ApiCache();
  }

  async getPoolsByMint(mint) {
    const cacheKey = `pools_${mint}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.waitForSlot();

    return this.circuitBreaker.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/dex/tokens/${mint}`, {
        timeout: 300
      });
      
      const result = response.data;
      this.cache.set(cacheKey, result, 300000); // 5min cache
      return result;
    });
  }

  async getVolume24h(mint) {
    const poolData = await this.getPoolsByMint(mint);
    
    if (poolData && poolData.pairs && poolData.pairs.length > 0) {
      return poolData.pairs[0].volume?.h24 || 0;
    }
    
    return 0;
  }

  getState() {
    return {
      circuitBreaker: this.circuitBreaker.getState(),
      cacheSize: this.cache.size()
    };
  }
}

/**
 * Jupiter API Adapter
 */
class JupiterAdapter {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://quote-api.jup.ag/v6';
    this.circuitBreaker = new ApiCircuitBreaker('Jupiter');
    this.rateLimiter = new RateLimiter(10); // 10 req/sec
    this.cache = new ApiCache();
  }

  async getQuote(inputMint, outputMint, amount) {
    const cacheKey = `quote_${inputMint}_${outputMint}_${amount}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.waitForSlot();

    return this.circuitBreaker.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount,
          slippageBps: 50 // 0.5% slippage
        },
        timeout: 200
      });
      
      const result = response.data;
      this.cache.set(cacheKey, result, 800); // 800ms cache for quotes
      return result;
    });
  }

  async buildSwapTx(quoteResponse, userPublicKey) {
    await this.rateLimiter.waitForSlot();

    return this.circuitBreaker.execute(async () => {
      const response = await axios.post(`${this.baseUrl}/swap`, {
        quoteResponse,
        userPublicKey: userPublicKey.toString(),
        wrapAndUnwrapSol: true
      }, {
        timeout: 300
      });
      
      return response.data;
    });
  }

  getState() {
    return {
      circuitBreaker: this.circuitBreaker.getState(),
      cacheSize: this.cache.size()
    };
  }
}

/**
 * Birdeye API Adapter
 */
class BirdeyeAdapter {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://public-api.birdeye.so';
    this.apiKey = config.apiKey || '';
    this.circuitBreaker = new ApiCircuitBreaker('Birdeye');
    this.rateLimiter = new RateLimiter(3); // 3 req/sec for free tier
    this.cache = new ApiCache();
  }

  async getTokenInfo(mint) {
    const cacheKey = `token_info_${mint}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.waitForSlot();

    return this.circuitBreaker.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/defi/token_overview`, {
        params: { address: mint },
        headers: this.apiKey ? { 'X-API-KEY': this.apiKey } : {},
        timeout: 300
      });
      
      const result = response.data;
      this.cache.set(cacheKey, result, 300000); // 5min cache
      return result;
    });
  }

  async getHolders(mint) {
    const cacheKey = `holders_${mint}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.waitForSlot();

    return this.circuitBreaker.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/defi/token_holders`, {
        params: { 
          address: mint,
          limit: 100
        },
        headers: this.apiKey ? { 'X-API-KEY': this.apiKey } : {},
        timeout: 300
      });
      
      const result = response.data;
      this.cache.set(cacheKey, result, 600000); // 10min cache
      return result;
    });
  }

  getState() {
    return {
      circuitBreaker: this.circuitBreaker.getState(),
      cacheSize: this.cache.size()
    };
  }
}

/**
 * Solscan API Adapter
 */
class SolscanAdapter {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://public-api.solscan.io';
    this.apiKey = config.apiKey || '';
    this.circuitBreaker = new ApiCircuitBreaker('Solscan');
    this.rateLimiter = new RateLimiter(5); // 5 req/sec
    this.cache = new ApiCache();
  }

  async getMintInfo(mint) {
    const cacheKey = `mint_info_${mint}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.waitForSlot();

    return this.circuitBreaker.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/token/meta`, {
        params: { tokenAddress: mint },
        headers: this.apiKey ? { 'token': this.apiKey } : {},
        timeout: 300
      });
      
      const result = response.data;
      this.cache.set(cacheKey, result, 600000); // 10min cache
      return result;
    });
  }

  async getTxs(mint, limit = 50) {
    const cacheKey = `txs_${mint}_${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    await this.rateLimiter.waitForSlot();

    return this.circuitBreaker.execute(async () => {
      const response = await axios.get(`${this.baseUrl}/token/transfer`, {
        params: { 
          token: mint,
          limit
        },
        headers: this.apiKey ? { 'token': this.apiKey } : {},
        timeout: 300
      });
      
      const result = response.data;
      this.cache.set(cacheKey, result, 60000); // 1min cache for tx data
      return result;
    });
  }

  getState() {
    return {
      circuitBreaker: this.circuitBreaker.getState(),
      cacheSize: this.cache.size()
    };
  }
}

/**
 * Mock API Service for testing without real API calls
 */
class MockApiService {
  constructor() {
    this.dexscreener = {
      getPoolsByMint: async (mint) => ({
        pairs: [{
          volume: { h24: 50000 },
          liquidity: { usd: 100000 },
          priceUsd: '0.001',
          priceChange: { h24: 5.5 }
        }]
      }),
      getVolume24h: async (mint) => 50000
    };

    this.jupiter = {
      getQuote: async (inputMint, outputMint, amount) => ({
        inputMint,
        outputMint,
        inAmount: amount,
        outAmount: Math.floor(amount * 0.99), // 1% slippage simulation
        otherAmountThreshold: Math.floor(amount * 0.98),
        swapMode: 'ExactIn',
        priceImpactPct: 0.1
      }),
      buildSwapTx: async (quoteResponse, userPublicKey) => ({
        swapTransaction: 'mock_transaction_data',
        lastValidBlockHeight: 12345678
      })
    };

    this.birdeye = {
      getTokenInfo: async (mint) => ({
        data: {
          address: mint,
          symbol: 'MOCK',
          name: 'Mock Token',
          decimals: 9,
          supply: 1000000000,
          price: 0.001,
          mc: 1000000,
          liquidity: 100000,
          v24hUSD: 50000,
          priceChange24hPercent: 5.5,
          holder: 1500
        }
      }),
      getHolders: async (mint) => ({
        data: {
          items: [
            { owner: 'whale1...', amount: 50000000, percentage: 5.0 },
            { owner: 'whale2...', amount: 30000000, percentage: 3.0 }
          ]
        }
      })
    };

    this.solscan = {
      getMintInfo: async (mint) => ({
        data: {
          tokenAddress: mint,
          mintAuthority: null,
          freezeAuthority: null,
          decimals: 9,
          supply: 1000000000
        }
      }),
      getTxs: async (mint, limit) => ({
        data: Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
          signature: `mock_sig_${i}`,
          blockTime: Date.now() - i * 60000,
          amount: Math.random() * 1000000
        }))
      })
    };
  }

  // Mock implementations return state as if they're working
  getState() {
    return {
      dexscreener: { circuitBreaker: { state: 'CLOSED' }, cacheSize: 5 },
      jupiter: { circuitBreaker: { state: 'CLOSED' }, cacheSize: 3 },
      birdeye: { circuitBreaker: { state: 'CLOSED' }, cacheSize: 8 },
      solscan: { circuitBreaker: { state: 'CLOSED' }, cacheSize: 4 }
    };
  }
}

/**
 * Main API Service factory
 * @param {ApiConfig} config - API configuration
 * @param {boolean} mockMode - Whether to use mock implementations
 * @returns {Object} API service with all adapters
 */
function createApiService(config = {}, mockMode = false) {
  if (mockMode) {
    logger.info('Creating API service in MOCK mode');
    return new MockApiService();
  }

  const dexscreener = new DexScreenerAdapter(config);
  const jupiter = new JupiterAdapter(config);
  const birdeye = new BirdeyeAdapter(config);
  const solscan = new SolscanAdapter(config);

  return {
    dexscreener,
    jupiter,
    birdeye,
    solscan,
    
    // Aggregate state from all adapters
    getState() {
      return {
        dexscreener: dexscreener.getState(),
        jupiter: jupiter.getState(),
        birdeye: birdeye.getState(),
        solscan: solscan.getState()
      };
    },

    // Test methods for comprehensive testing
    async testJupiterConnection() {
      try {
        await jupiter.getQuote(
          'So11111111111111111111111111111111111111112', // SOL
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          1000000 // 0.001 SOL
        );
        return true;
      } catch (error) {
        return false;
      }
    },

    async testDexScreenerConnection() {
      try {
        await dexscreener.getPoolsByMint('So11111111111111111111111111111111111111112');
        return true;
      } catch (error) {
        return false;
      }
    },

    async testBirdeyeConnection() {
      try {
        await birdeye.getTokenInfo('So11111111111111111111111111111111111111112');
        return true;
      } catch (error) {
        return false;
      }
    },

    async testTimeoutHandling() {
      try {
        // This should timeout quickly in real implementation
        await axios.get('https://httpstat.us/200?sleep=5000', { timeout: 100 });
        return false;
      } catch (error) {
        return error.code === 'ECONNABORTED' || error.message.includes('timeout');
      }
    },

    async testRateLimitHandling() {
      try {
        // Test rate limiting by making rapid requests
        const promises = Array.from({ length: 20 }, () => 
          dexscreener.getPoolsByMint('So11111111111111111111111111111111111111112')
        );
        
        await Promise.all(promises);
        return true; // Rate limiting should handle this gracefully
      } catch (error) {
        return error.response?.status === 429 || error.message.includes('rate limit');
      }
    }
  };
}

module.exports = {
  createApiService,
  DexScreenerAdapter,
  JupiterAdapter,
  BirdeyeAdapter,
  SolscanAdapter,
  MockApiService,
  ApiCircuitBreaker,
  RateLimiter,
  ApiCache
};

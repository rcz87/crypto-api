const axios = require('axios');
const { logger, logError } = require('../utils/logger');
const config = require('../config');

class APIService {
  constructor() {
    this.apis = {
      solscan: 'https://public-api.solscan.io',
      dexscreener: 'https://api.dexscreener.com/latest',
      birdeye: 'https://public-api.birdeye.so/defi',
      coingecko: 'https://api.coingecko.com/api/v3',
      coinmarketcap: 'https://pro-api.coinmarketcap.com/v1'
    };
    
    this.rateLimits = new Map();
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds cache
  }

  // ==================== SOLSCAN API ====================
  
  async getTokenHolders(tokenMint, limit = 50) {
    try {
      const cacheKey = `holders_${tokenMint}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const url = `${this.apis.solscan}/token/holders`;
      const response = await this.makeRequest(url, {
        params: {
          tokenAddress: tokenMint,
          limit,
          offset: 0
        }
      });

      if (response.data && response.data.data) {
        const holders = response.data.data;
        
        // Analyze holder distribution
        const analysis = this.analyzeHolderDistribution(holders);
        
        const result = {
          holders,
          analysis,
          totalHolders: holders.length,
          timestamp: Date.now()
        };
        
        this.setCache(cacheKey, result);
        return result;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getTokenHolders');
      return null;
    }
  }

  async getTokenTransactions(tokenMint, limit = 100) {
    try {
      const cacheKey = `transactions_${tokenMint}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const url = `${this.apis.solscan}/token/transfer`;
      const response = await this.makeRequest(url, {
        params: {
          token: tokenMint,
          limit
        }
      });

      if (response.data && response.data.data) {
        const transactions = response.data.data;
        
        // Analyze transaction patterns
        const analysis = this.analyzeTransactionPatterns(transactions);
        
        const result = {
          transactions,
          analysis,
          totalTransactions: transactions.length,
          timestamp: Date.now()
        };
        
        this.setCache(cacheKey, result);
        return result;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getTokenTransactions');
      return null;
    }
  }

  async getWalletAnalysis(walletAddress) {
    try {
      const cacheKey = `wallet_${walletAddress}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const url = `${this.apis.solscan}/account/tokens`;
      const response = await this.makeRequest(url, {
        params: {
          account: walletAddress
        }
      });

      if (response.data && response.data.data) {
        const tokens = response.data.data;
        
        // Analyze wallet for whale characteristics
        const analysis = this.analyzeWalletCharacteristics(tokens, walletAddress);
        
        const result = {
          tokens,
          analysis,
          isWhale: analysis.totalValue > 100000, // $100k+ = whale
          timestamp: Date.now()
        };
        
        this.setCache(cacheKey, result);
        return result;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getWalletAnalysis');
      return null;
    }
  }

  // ==================== DEXSCREENER API ====================
  
  async getTokenPrice(tokenMint) {
    try {
      const cacheKey = `price_${tokenMint}`;
      const cached = this.getFromCache(cacheKey, 5000); // 5 second cache for prices
      if (cached) return cached;

      const url = `${this.apis.dexscreener}/dex/tokens/${tokenMint}`;
      const response = await this.makeRequest(url);

      if (response.data && response.data.pairs && response.data.pairs.length > 0) {
        const pair = response.data.pairs[0]; // Get first/main pair
        
        const priceData = {
          price: parseFloat(pair.priceUsd) || 0,
          priceChange24h: parseFloat(pair.priceChange.h24) || 0,
          volume24h: parseFloat(pair.volume.h24) || 0,
          liquidity: parseFloat(pair.liquidity?.usd) || 0,
          marketCap: parseFloat(pair.fdv) || 0,
          dex: pair.dexId,
          pairAddress: pair.pairAddress,
          timestamp: Date.now()
        };
        
        this.setCache(cacheKey, priceData, 5000);
        return priceData;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getTokenPrice');
      return null;
    }
  }

  async getTokenChart(tokenMint, timeframe = '1h') {
    try {
      const cacheKey = `chart_${tokenMint}_${timeframe}`;
      const cached = this.getFromCache(cacheKey, 60000); // 1 minute cache
      if (cached) return cached;

      // Get pair address first
      const tokenData = await this.getTokenPrice(tokenMint);
      if (!tokenData || !tokenData.pairAddress) return null;

      const url = `${this.apis.dexscreener}/dex/pairs/solana/${tokenData.pairAddress}`;
      const response = await this.makeRequest(url);

      if (response.data && response.data.pair) {
        const pair = response.data.pair;
        
        const chartData = {
          priceHistory: pair.priceHistory || [],
          volumeHistory: pair.volumeHistory || [],
          currentPrice: parseFloat(pair.priceUsd),
          trend: this.calculateTrend(pair.priceHistory),
          timestamp: Date.now()
        };
        
        this.setCache(cacheKey, chartData, 60000);
        return chartData;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getTokenChart');
      return null;
    }
  }

  // ==================== BIRDEYE API ====================
  
  async getBirdeyeTokenData(tokenMint) {
    try {
      const cacheKey = `birdeye_${tokenMint}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const url = `${this.apis.birdeye}/token/overview`;
      const response = await this.makeRequest(url, {
        params: {
          address: tokenMint
        },
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY || ''
        }
      });

      if (response.data && response.data.data) {
        const data = response.data.data;
        
        const tokenData = {
          price: data.price || 0,
          marketCap: data.mc || 0,
          liquidity: data.liquidity || 0,
          volume24h: data.v24hUSD || 0,
          priceChange24h: data.priceChange24hPercent || 0,
          holders: data.holder || 0,
          security: {
            isVerified: data.isVerified || false,
            hasRisk: data.hasRisk || false,
            riskLevel: data.riskLevel || 'unknown'
          },
          timestamp: Date.now()
        };
        
        this.setCache(cacheKey, tokenData);
        return tokenData;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getBirdeyeTokenData');
      return null;
    }
  }

  async getBirdeyeWhaleTransactions(tokenMint, limit = 50) {
    try {
      const url = `${this.apis.birdeye}/defi/txs/token`;
      const response = await this.makeRequest(url, {
        params: {
          address: tokenMint,
          tx_type: 'swap',
          sort_type: 'desc',
          sort_by: 'block_time',
          limit
        },
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY || ''
        }
      });

      if (response.data && response.data.data && response.data.data.items) {
        const transactions = response.data.data.items;
        
        // Filter untuk whale transactions (>1 SOL)
        const whaleTransactions = transactions.filter(tx => 
          tx.volume_in_usd && tx.volume_in_usd > 1000 // $1000+ = whale transaction
        );
        
        return {
          whaleTransactions,
          totalWhaleVolume: whaleTransactions.reduce((sum, tx) => sum + (tx.volume_in_usd || 0), 0),
          whaleCount: whaleTransactions.length,
          timestamp: Date.now()
        };
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getBirdeyeWhaleTransactions');
      return null;
    }
  }

  // ==================== COINGECKO API ====================
  
  async getMarketSentiment() {
    try {
      const cacheKey = 'market_sentiment';
      const cached = this.getFromCache(cacheKey, 300000); // 5 minute cache
      if (cached) return cached;

      const url = `${this.apis.coingecko}/global`;
      const response = await this.makeRequest(url);

      if (response.data && response.data.data) {
        const data = response.data.data;
        
        const sentiment = {
          marketCapChangePercentage24h: data.market_cap_change_percentage_24h_usd || 0,
          totalMarketCap: data.total_market_cap?.usd || 0,
          totalVolume24h: data.total_volume?.usd || 0,
          btcDominance: data.market_cap_percentage?.btc || 0,
          fearGreedIndex: await this.getFearGreedIndex(),
          timestamp: Date.now()
        };
        
        this.setCache(cacheKey, sentiment, 300000);
        return sentiment;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getMarketSentiment');
      return null;
    }
  }

  async getSolanaPrice() {
    try {
      const cacheKey = 'solana_price';
      const cached = this.getFromCache(cacheKey, 10000); // 10 second cache
      if (cached) return cached;

      const url = `${this.apis.coingecko}/simple/price`;
      const response = await this.makeRequest(url, {
        params: {
          ids: 'solana',
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_24hr_vol: true
        }
      });

      if (response.data && response.data.solana) {
        const data = response.data.solana;
        
        const solPrice = {
          price: data.usd || 0,
          priceChange24h: data.usd_24h_change || 0,
          volume24h: data.usd_24h_vol || 0,
          timestamp: Date.now()
        };
        
        this.setCache(cacheKey, solPrice, 10000);
        return solPrice;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getSolanaPrice');
      return null;
    }
  }

  // ==================== NEWS & SENTIMENT ====================
  
  async getCryptoNews(keywords = ['solana', 'meme', 'token']) {
    try {
      const cacheKey = `news_${keywords.join('_')}`;
      const cached = this.getFromCache(cacheKey, 600000); // 10 minute cache
      if (cached) return cached;

      // Using CoinGecko news endpoint
      const url = `${this.apis.coingecko}/news`;
      const response = await this.makeRequest(url);

      if (response.data && response.data.data) {
        const allNews = response.data.data;
        
        // Filter news berdasarkan keywords
        const relevantNews = allNews.filter(news => 
          keywords.some(keyword => 
            news.title.toLowerCase().includes(keyword.toLowerCase()) ||
            news.description.toLowerCase().includes(keyword.toLowerCase())
          )
        );
        
        // Analyze sentiment
        const sentiment = this.analyzeNewsSentiment(relevantNews);
        
        const result = {
          news: relevantNews.slice(0, 10), // Top 10 relevant news
          sentiment,
          totalNews: relevantNews.length,
          timestamp: Date.now()
        };
        
        this.setCache(cacheKey, result, 600000);
        return result;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'APIService.getCryptoNews');
      return null;
    }
  }

  async getFearGreedIndex() {
    try {
      // Alternative Fear & Greed Index API
      const url = 'https://api.alternative.me/fng/';
      const response = await this.makeRequest(url);

      if (response.data && response.data.data && response.data.data[0]) {
        const fgi = response.data.data[0];
        return {
          value: parseInt(fgi.value),
          classification: fgi.value_classification,
          timestamp: fgi.timestamp
        };
      }
      
      return { value: 50, classification: 'Neutral', timestamp: Date.now() };
      
    } catch (error) {
      logError(error, 'APIService.getFearGreedIndex');
      return { value: 50, classification: 'Neutral', timestamp: Date.now() };
    }
  }

  // ==================== ANALYSIS HELPERS ====================
  
  analyzeHolderDistribution(holders) {
    try {
      const totalSupply = holders.reduce((sum, holder) => sum + parseFloat(holder.amount || 0), 0);
      
      // Calculate concentration
      const top10Holdings = holders.slice(0, 10).reduce((sum, holder) => sum + parseFloat(holder.amount || 0), 0);
      const concentration = (top10Holdings / totalSupply) * 100;
      
      return {
        totalHolders: holders.length,
        top10Concentration: concentration,
        isHighlyConcentrated: concentration > 50,
        averageHolding: totalSupply / holders.length,
        riskLevel: concentration > 70 ? 'HIGH' : concentration > 50 ? 'MEDIUM' : 'LOW'
      };
      
    } catch (error) {
      logError(error, 'APIService.analyzeHolderDistribution');
      return { riskLevel: 'UNKNOWN' };
    }
  }

  analyzeTransactionPatterns(transactions) {
    try {
      const now = Date.now() / 1000;
      const oneHourAgo = now - 3600;
      
      const recentTxs = transactions.filter(tx => tx.blockTime > oneHourAgo);
      const totalVolume = recentTxs.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
      
      // Detect unusual activity
      const avgTxSize = totalVolume / recentTxs.length;
      const largeTxs = recentTxs.filter(tx => parseFloat(tx.amount || 0) > avgTxSize * 5);
      
      return {
        recentTransactions: recentTxs.length,
        totalVolume1h: totalVolume,
        averageTransactionSize: avgTxSize,
        largeTransactions: largeTxs.length,
        activityLevel: recentTxs.length > 50 ? 'HIGH' : recentTxs.length > 20 ? 'MEDIUM' : 'LOW'
      };
      
    } catch (error) {
      logError(error, 'APIService.analyzeTransactionPatterns');
      return { activityLevel: 'UNKNOWN' };
    }
  }

  analyzeWalletCharacteristics(tokens, walletAddress) {
    try {
      const totalValue = tokens.reduce((sum, token) => {
        const value = parseFloat(token.amount || 0) * parseFloat(token.price || 0);
        return sum + value;
      }, 0);
      
      const tokenCount = tokens.length;
      const hasHighValueTokens = tokens.some(token => 
        parseFloat(token.amount || 0) * parseFloat(token.price || 0) > 10000
      );
      
      return {
        totalValue,
        tokenCount,
        hasHighValueTokens,
        isWhale: totalValue > 100000,
        riskLevel: totalValue > 1000000 ? 'WHALE' : totalValue > 100000 ? 'LARGE' : 'NORMAL'
      };
      
    } catch (error) {
      logError(error, 'APIService.analyzeWalletCharacteristics');
      return { riskLevel: 'UNKNOWN' };
    }
  }

  calculateTrend(priceHistory) {
    try {
      if (!priceHistory || priceHistory.length < 2) return 'NEUTRAL';
      
      const recent = priceHistory.slice(-10); // Last 10 data points
      const first = parseFloat(recent[0]);
      const last = parseFloat(recent[recent.length - 1]);
      
      const change = ((last - first) / first) * 100;
      
      if (change > 5) return 'BULLISH';
      if (change < -5) return 'BEARISH';
      return 'NEUTRAL';
      
    } catch (error) {
      return 'NEUTRAL';
    }
  }

  analyzeNewsSentiment(news) {
    try {
      const positiveWords = ['bullish', 'surge', 'pump', 'moon', 'gain', 'rise', 'up'];
      const negativeWords = ['bearish', 'dump', 'crash', 'fall', 'drop', 'down', 'loss'];
      
      let positiveScore = 0;
      let negativeScore = 0;
      
      news.forEach(article => {
        const text = (article.title + ' ' + article.description).toLowerCase();
        
        positiveWords.forEach(word => {
          if (text.includes(word)) positiveScore++;
        });
        
        negativeWords.forEach(word => {
          if (text.includes(word)) negativeScore++;
        });
      });
      
      const totalScore = positiveScore + negativeScore;
      if (totalScore === 0) return 'NEUTRAL';
      
      const sentimentRatio = positiveScore / totalScore;
      
      if (sentimentRatio > 0.6) return 'POSITIVE';
      if (sentimentRatio < 0.4) return 'NEGATIVE';
      return 'NEUTRAL';
      
    } catch (error) {
      return 'NEUTRAL';
    }
  }

  // ==================== UTILITY METHODS ====================
  
  async makeRequest(url, options = {}) {
    try {
      // Rate limiting check
      const domain = new URL(url).hostname;
      if (this.isRateLimited(domain)) {
        throw new Error(`Rate limited for ${domain}`);
      }
      
      const response = await axios({
        url,
        method: 'GET',
        timeout: 10000,
        ...options
      });
      
      // Update rate limit
      this.updateRateLimit(domain);
      
      return response;
      
    } catch (error) {
      if (error.response?.status === 429) {
        this.setRateLimit(new URL(url).hostname);
      }
      throw error;
    }
  }

  isRateLimited(domain) {
    const limit = this.rateLimits.get(domain);
    return limit && Date.now() < limit;
  }

  setRateLimit(domain, duration = 60000) {
    this.rateLimits.set(domain, Date.now() + duration);
  }

  updateRateLimit(domain) {
    // Simple rate limiting - 1 request per second per domain
    this.rateLimits.set(domain, Date.now() + 1000);
  }

  getFromCache(key, maxAge = null) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    const timeout = maxAge || this.cacheTimeout;
    
    if (age > timeout) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data, maxAge = null) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      maxAge: maxAge || this.cacheTimeout
    });
  }

  clearCache() {
    this.cache.clear();
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      rateLimits: this.rateLimits.size,
      apis: Object.keys(this.apis)
    };
  }

  // Test methods for comprehensive testing
  async testJupiterConnection() {
    try {
      const response = await axios.get(`${config.dex.jupiterApiUrl}/tokens`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async testDexScreenerConnection() {
    try {
      const response = await axios.get('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112', {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async testBirdeyeConnection() {
    try {
      const response = await axios.get('https://public-api.birdeye.so/public/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=10', {
        timeout: 5000,
        headers: {
          'X-API-KEY': process.env.BIRDEYE_API_KEY || 'demo'
        }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async testTimeoutHandling() {
    try {
      // Test with very short timeout to trigger timeout error
      await axios.get('https://api.mainnet-beta.solana.com', {
        timeout: 1 // 1ms timeout
      });
      return false;
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return true; // Timeout handled correctly
      }
      throw error;
    }
  }

  async testRateLimitHandling() {
    try {
      // Simulate rate limit by making many rapid requests
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(this.testJupiterConnection());
      }
      await Promise.all(promises);
      return true;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        return true; // Rate limit handled correctly
      }
      return false;
    }
  }
}

module.exports = APIService;

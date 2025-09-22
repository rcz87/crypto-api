const { PublicKey } = require('@solana/web3.js');
const { logger, logError, logTokenAnalysis } = require('../utils/logger');
const config = require('../config');
const APIService = require('../services/api-service');

class TokenAnalyzer {
  constructor(solanaConnection) {
    this.connection = solanaConnection.getConnection();
    this.wallet = solanaConnection.getWallet();
    this.apiService = new APIService();
    
    // Scoring weights untuk different criteria
    this.weights = {
      liquidity: 0.20,      // 20% - Liquidity strength
      security: 0.25,       // 25% - Security checks (rug pull detection)
      whale: 0.25,          // 25% - Whale activity analysis (increased)
      technical: 0.15,      // 15% - Technical indicators
      timing: 0.10,         // 10% - Launch timing and momentum
      sentiment: 0.05       // 5% - News & market sentiment
    };
  }

  async analyzeToken(tokenMint, poolInfo = null) {
    try {
      const startTime = Date.now();
      logger.info(`🔍 Analyzing token: ${tokenMint}`);
      
      const analysis = {
        tokenMint,
        timestamp: Date.now(),
        scores: {},
        totalScore: 0,
        recommendation: 'HOLD',
        reasons: [],
        risks: [],
        apiData: {}
      };

      // Parallel API calls untuk speed
      const [
        liquidityScore,
        securityScore,
        whaleScore,
        technicalScore,
        timingScore,
        sentimentScore
      ] = await Promise.all([
        this.analyzeLiquidity(tokenMint, poolInfo),
        this.analyzeTokenSecurity(tokenMint),
        this.analyzeWhaleActivity(tokenMint),
        this.analyzeTechnicalIndicators(tokenMint),
        this.analyzeTimingAndMomentum(tokenMint, poolInfo),
        this.analyzeSentiment(tokenMint)
      ]);

      analysis.scores = {
        liquidity: liquidityScore,
        security: securityScore,
        whale: whaleScore,
        technical: technicalScore,
        timing: timingScore,
        sentiment: sentimentScore
      };
      
      // Calculate weighted total score
      analysis.totalScore = this.calculateTotalScore(analysis.scores);
      
      // Generate recommendation
      analysis.recommendation = this.generateRecommendation(analysis.totalScore, analysis.scores);
      
      // Add reasons and risks
      this.addAnalysisReasons(analysis);
      
      const analysisTime = Date.now() - startTime;
      logger.info(`✅ Token analysis complete: ${tokenMint} | Score: ${analysis.totalScore}/10 | Time: ${analysisTime}ms`);
      
      logTokenAnalysis(tokenMint, analysis.totalScore, analysis);
      
      return analysis;
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.analyzeToken');
      return {
        tokenMint,
        totalScore: 0,
        recommendation: 'REJECT',
        error: error.message
      };
    }
  }

  async analyzeLiquidity(tokenMint, poolInfo) {
    try {
      let score = 0;
      let liquidityUsd = 0;
      
      // Get liquidity dari multiple sources
      const [dexScreenerData, birdeyeData] = await Promise.all([
        this.apiService.getTokenPrice(tokenMint),
        this.apiService.getBirdeyeTokenData(tokenMint)
      ]);
      
      // Use best available liquidity data
      if (dexScreenerData && dexScreenerData.liquidity) {
        liquidityUsd = dexScreenerData.liquidity;
      } else if (birdeyeData && birdeyeData.liquidity) {
        liquidityUsd = birdeyeData.liquidity;
      } else if (poolInfo && poolInfo.liquidity) {
        // Fallback to pool info (assume SOL price ~$100)
        liquidityUsd = poolInfo.liquidity * 100;
      }
      
      // Score berdasarkan liquidity amount (USD)
      if (liquidityUsd >= 500000) score = 10;      // $500k+ = Excellent
      else if (liquidityUsd >= 200000) score = 8;  // $200k+ = Very Good
      else if (liquidityUsd >= 100000) score = 6;  // $100k+ = Good
      else if (liquidityUsd >= 50000) score = 4;   // $50k+ = Moderate
      else if (liquidityUsd >= 10000) score = 2;   // $10k+ = Minimum
      else score = 0;                              // Too low
      
      logger.debug(`Liquidity analysis: $${liquidityUsd} USD = ${score}/10`);
      return score;
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.analyzeLiquidity');
      return 0;
    }
  }

  async analyzeTokenSecurity(tokenMint) {
    try {
      let score = 10; // Start with perfect score, deduct for risks
      const risks = [];
      
      // Get token account info
      const tokenPublicKey = new PublicKey(tokenMint);
      const tokenAccountInfo = await this.connection.getAccountInfo(tokenPublicKey);
      
      if (!tokenAccountInfo) {
        return 0; // Token doesn't exist
      }
      
      // Check mint authority (should be null for safe tokens)
      const mintInfo = await this.connection.getParsedAccountInfo(tokenPublicKey);
      if (mintInfo.value && mintInfo.value.data.parsed) {
        const mintData = mintInfo.value.data.parsed.info;
        
        if (mintData.mintAuthority !== null) {
          score -= 3;
          risks.push('Mint authority not revoked - can create new tokens');
        }
        
        if (mintData.freezeAuthority !== null) {
          score -= 2;
          risks.push('Freeze authority not revoked - can freeze accounts');
        }
        
        // Check supply
        const supply = mintData.supply;
        if (supply > 1000000000000) { // Very high supply
          score -= 1;
          risks.push('Very high token supply');
        }
      }
      
      // Check for honeypot indicators
      const honeypotCheck = await this.checkHoneypot(tokenMint);
      if (honeypotCheck.isHoneypot) {
        score -= 5;
        risks.push('Potential honeypot detected');
      }
      
      // Check token age (very new tokens are riskier)
      const tokenAge = await this.getTokenAge(tokenMint);
      if (tokenAge < 300) { // Less than 5 minutes old
        score -= 1;
        risks.push('Very new token (high risk)');
      }
      
      return Math.max(0, score);
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.analyzeTokenSecurity');
      return 3; // Default moderate score on error
    }
  }

  async analyzeWhaleActivity(tokenMint) {
    try {
      let score = 5; // Neutral starting point
      
      // Get whale data dari multiple sources
      const [holdersData, whaleTransactions, solscanTxs] = await Promise.all([
        this.apiService.getTokenHolders(tokenMint, 100),
        this.apiService.getBirdeyeWhaleTransactions(tokenMint, 50),
        this.apiService.getTokenTransactions(tokenMint, 100)
      ]);
      
      // Analyze holder distribution
      if (holdersData && holdersData.analysis) {
        const holderAnalysis = holdersData.analysis;
        
        if (holderAnalysis.riskLevel === 'LOW') score += 2;
        else if (holderAnalysis.riskLevel === 'MEDIUM') score += 1;
        else if (holderAnalysis.riskLevel === 'HIGH') score -= 2;
        
        // Bonus untuk healthy holder count
        if (holdersData.totalHolders > 1000) score += 1;
        else if (holdersData.totalHolders > 500) score += 0.5;
      }
      
      // Analyze whale transactions
      if (whaleTransactions) {
        const whaleVolume = whaleTransactions.totalWhaleVolume;
        const whaleCount = whaleTransactions.whaleCount;
        
        // Positive whale activity
        if (whaleVolume > 100000) score += 2; // $100k+ whale volume
        else if (whaleVolume > 50000) score += 1; // $50k+ whale volume
        
        if (whaleCount > 10) score += 1; // Many whales interested
        
        logger.debug(`Whale activity: $${whaleVolume} volume, ${whaleCount} whales`);
      }
      
      // Analyze transaction patterns
      if (solscanTxs && solscanTxs.analysis) {
        const txAnalysis = solscanTxs.analysis;
        
        if (txAnalysis.activityLevel === 'HIGH') score += 1;
        if (txAnalysis.largeTransactions > 5) score += 1;
      }
      
      return Math.min(10, Math.max(0, score));
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.analyzeWhaleActivity');
      return 5; // Neutral score on error
    }
  }

  async analyzeTechnicalIndicators(tokenMint) {
    try {
      let score = 5; // Start neutral
      
      // Get comprehensive price data
      const [priceData, chartData, birdeyeData] = await Promise.all([
        this.apiService.getTokenPrice(tokenMint),
        this.apiService.getTokenChart(tokenMint, '1h'),
        this.apiService.getBirdeyeTokenData(tokenMint)
      ]);
      
      // Price momentum analysis
      if (priceData) {
        const priceChange = priceData.priceChange24h;
        const volume24h = priceData.volume24h;
        
        // Volume analysis
        if (volume24h > 100000) score += 2;      // $100k+ volume = excellent
        else if (volume24h > 50000) score += 1.5; // $50k+ volume = good
        else if (volume24h > 10000) score += 1;   // $10k+ volume = moderate
        else if (volume24h < 1000) score -= 1;    // <$1k volume = poor
        
        // Price momentum (balanced approach)
        if (priceChange > 50) score += 2;         // Strong pump
        else if (priceChange > 20) score += 1.5;  // Good momentum
        else if (priceChange > 5) score += 1;     // Positive momentum
        else if (priceChange < -30) score -= 2;   // Strong dump
        else if (priceChange < -10) score -= 1;   // Negative momentum
        
        // Market cap analysis
        if (priceData.marketCap) {
          if (priceData.marketCap < 50000) score += 1;      // Micro cap potential
          else if (priceData.marketCap > 10000000) score -= 1; // Large cap less potential
        }
        
        logger.debug(`Technical: Price change ${priceChange}%, Volume $${volume24h}`);
      }
      
      // Chart pattern analysis
      if (chartData && chartData.trend) {
        if (chartData.trend === 'BULLISH') score += 1;
        else if (chartData.trend === 'BEARISH') score -= 1;
      }
      
      // Birdeye security analysis
      if (birdeyeData && birdeyeData.security) {
        if (birdeyeData.security.isVerified) score += 0.5;
        if (birdeyeData.security.hasRisk) score -= 1;
        if (birdeyeData.security.riskLevel === 'HIGH') score -= 2;
      }
      
      return Math.min(10, Math.max(0, score));
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.analyzeTechnicalIndicators');
      return 5;
    }
  }

  async analyzeTimingAndMomentum(tokenMint, poolInfo) {
    try {
      let score = 5;
      
      // Check launch timing
      const currentTime = Date.now();
      if (poolInfo && poolInfo.timestamp) {
        const timeSinceLaunch = currentTime - poolInfo.timestamp;
        
        // Best time window: 0-5 minutes after launch
        if (timeSinceLaunch < 300000) { // 5 minutes
          score += 3;
        } else if (timeSinceLaunch < 900000) { // 15 minutes
          score += 1;
        } else if (timeSinceLaunch > 3600000) { // 1 hour
          score -= 1;
        }
      }
      
      // Check market conditions (simplified)
      const marketConditions = await this.checkMarketConditions();
      if (marketConditions.bullish) score += 1;
      if (marketConditions.volatile) score -= 1;
      
      return Math.min(10, Math.max(0, score));
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.analyzeTimingAndMomentum');
      return 5;
    }
  }

  calculateTotalScore(scores) {
    let totalScore = 0;
    
    for (const [category, score] of Object.entries(scores)) {
      const weight = this.weights[category] || 0;
      totalScore += score * weight;
    }
    
    return Math.round(totalScore * 100) / 100; // Round to 2 decimal places
  }

  generateRecommendation(totalScore, scores) {
    if (totalScore >= config.trading.minScoreToBuy) {
      return 'BUY';
    } else if (totalScore >= 6) {
      return 'WATCH';
    } else if (totalScore >= 4) {
      return 'HOLD';
    } else {
      return 'REJECT';
    }
  }

  addAnalysisReasons(analysis) {
    const { scores, totalScore } = analysis;
    
    // Add positive reasons
    if (scores.liquidity >= 8) analysis.reasons.push('Excellent liquidity');
    if (scores.security >= 8) analysis.reasons.push('High security score');
    if (scores.whale >= 7) analysis.reasons.push('Strong whale interest');
    if (scores.technical >= 7) analysis.reasons.push('Good technical indicators');
    if (scores.timing >= 7) analysis.reasons.push('Optimal timing');
    
    // Add risk warnings
    if (scores.security <= 5) analysis.risks.push('Security concerns detected');
    if (scores.liquidity <= 3) analysis.risks.push('Low liquidity risk');
    if (scores.whale <= 3) analysis.risks.push('Lack of whale interest');
    
    // Overall assessment
    if (totalScore >= 8) {
      analysis.reasons.push('High confidence trade setup');
    } else if (totalScore <= 4) {
      analysis.risks.push('Low confidence - high risk');
    }
  }

  async analyzeSentiment(tokenMint) {
    try {
      let score = 5; // Neutral starting point
      
      // Get market sentiment data
      const [marketSentiment, cryptoNews, solanaPrice] = await Promise.all([
        this.apiService.getMarketSentiment(),
        this.apiService.getCryptoNews(['solana', 'meme', 'defi']),
        this.apiService.getSolanaPrice()
      ]);
      
      // Overall market sentiment
      if (marketSentiment) {
        const marketChange = marketSentiment.marketCapChangePercentage24h;
        if (marketChange > 5) score += 1;
        else if (marketChange < -5) score -= 1;
        
        // Fear & Greed Index
        if (marketSentiment.fearGreedIndex) {
          const fgi = marketSentiment.fearGreedIndex.value;
          if (fgi > 70) score += 0.5; // Greed is good for meme coins
          else if (fgi < 30) score -= 0.5; // Fear is bad
        }
      }
      
      // News sentiment
      if (cryptoNews && cryptoNews.sentiment) {
        if (cryptoNews.sentiment === 'POSITIVE') score += 1;
        else if (cryptoNews.sentiment === 'NEGATIVE') score -= 1;
      }
      
      // Solana price momentum
      if (solanaPrice) {
        const solChange = solanaPrice.priceChange24h;
        if (solChange > 10) score += 0.5; // SOL pumping helps meme coins
        else if (solChange < -10) score -= 0.5; // SOL dumping hurts
      }
      
      return Math.min(10, Math.max(0, score));
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.analyzeSentiment');
      return 5;
    }
  }

  // Helper methods dengan real API integration
  async checkHoneypot(tokenMint) {
    try {
      // Use Birdeye security data
      const birdeyeData = await this.apiService.getBirdeyeTokenData(tokenMint);
      
      if (birdeyeData && birdeyeData.security) {
        return {
          isHoneypot: birdeyeData.security.hasRisk && birdeyeData.security.riskLevel === 'HIGH',
          riskLevel: birdeyeData.security.riskLevel,
          isVerified: birdeyeData.security.isVerified
        };
      }
      
      return { isHoneypot: false, riskLevel: 'UNKNOWN' };
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.checkHoneypot');
      return { isHoneypot: false, riskLevel: 'UNKNOWN' };
    }
  }

  async getTokenAge(tokenMint) {
    try {
      // Get token creation time dari Solscan
      const txData = await this.apiService.getTokenTransactions(tokenMint, 1000);
      
      if (txData && txData.transactions && txData.transactions.length > 0) {
        // Get oldest transaction (creation)
        const oldestTx = txData.transactions[txData.transactions.length - 1];
        const creationTime = oldestTx.blockTime * 1000; // Convert to milliseconds
        const ageInSeconds = (Date.now() - creationTime) / 1000;
        
        return ageInSeconds;
      }
      
      return 3600; // Default 1 hour if can't determine
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.getTokenAge');
      return 3600;
    }
  }

  async checkMarketConditions() {
    try {
      const [marketSentiment, solanaPrice] = await Promise.all([
        this.apiService.getMarketSentiment(),
        this.apiService.getSolanaPrice()
      ]);
      
      let bullish = false;
      let volatile = false;
      
      if (marketSentiment) {
        bullish = marketSentiment.marketCapChangePercentage24h > 2;
        
        if (marketSentiment.fearGreedIndex) {
          const fgi = marketSentiment.fearGreedIndex.value;
          volatile = fgi > 80 || fgi < 20; // Extreme greed or fear
        }
      }
      
      if (solanaPrice) {
        const solChange = Math.abs(solanaPrice.priceChange24h);
        if (solChange > 15) volatile = true; // High SOL volatility
        if (solanaPrice.priceChange24h > 5) bullish = true;
      }
      
      return { bullish, volatile };
      
    } catch (error) {
      logError(error, 'TokenAnalyzer.checkMarketConditions');
      return { bullish: true, volatile: false };
    }
  }
}

module.exports = TokenAnalyzer;

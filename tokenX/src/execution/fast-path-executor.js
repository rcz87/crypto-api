const { Transaction, SystemProgram, ComputeBudgetProgram } = require('@solana/web3.js');
const { logger, logError, logTrade, logPerformance } = require('../utils/logger');
const config = require('../config');

class FastPathExecutor {
  constructor(solanaConnection, transactionBuilder) {
    this.connection = solanaConnection.getConnection();
    this.wallet = solanaConnection.getWallet();
    this.transactionBuilder = transactionBuilder;
    
    // Fast-path thresholds
    this.fastPathThresholds = {
      minLiquidity: 10000,        // $10k minimum liquidity
      maxSecurityRisk: 'MEDIUM',  // Maximum acceptable risk
      maxLatency: 200,            // 200ms max latency
      minConfidence: 0.6          // 60% minimum confidence
    };
    
    // Pre-signed transaction cache
    this.preSignedCache = new Map();
    this.executionQueue = [];
    this.isProcessing = false;
    
    // Performance tracking
    this.performanceMetrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      averageLatency: 0,
      fastPathHits: 0
    };
  }

  // FAST-PATH EXECUTION: Buy first, analyze later
  async executeFastPath(tokenData, poolInfo) {
    const startTime = Date.now();
    
    try {
      logger.info(`⚡ Fast-path execution for token: ${tokenData.mint}`);
      
      // Quick security check (< 50ms)
      const quickSecurity = await this.quickSecurityCheck(tokenData.mint);
      if (!quickSecurity.passed) {
        logger.warn(`❌ Fast-path rejected: ${quickSecurity.reason}`);
        return { success: false, reason: quickSecurity.reason };
      }
      
      // Quick liquidity check
      const liquidityUsd = poolInfo.liquidity * 100; // Assume SOL ~$100
      if (liquidityUsd < this.fastPathThresholds.minLiquidity) {
        return { success: false, reason: 'Insufficient liquidity for fast-path' };
      }
      
      // Calculate fast-path position size (smaller than full analysis)
      const fastPathAmount = config.trading.tradeAmountSol * 0.3; // 30% of normal size
      
      // Execute immediate buy
      const buyResult = await this.executeImmediateBuy(
        tokenData.mint,
        fastPathAmount,
        poolInfo
      );
      
      if (buyResult.success) {
        // Schedule lazy analysis for the rest
        this.scheduleLazyAnalysis(tokenData, poolInfo, buyResult.signature);
        
        const executionTime = Date.now() - startTime;
        this.updatePerformanceMetrics(true, executionTime, true);
        
        logger.info(`✅ Fast-path buy executed: ${buyResult.signature} (${executionTime}ms)`);
        
        return {
          success: true,
          signature: buyResult.signature,
          amount: fastPathAmount,
          executionTime,
          type: 'FAST_PATH'
        };
      }
      
      return buyResult;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updatePerformanceMetrics(false, executionTime, true);
      
      logError(error, 'FastPathExecutor.executeFastPath');
      return { success: false, reason: error.message };
    }
  }

  async quickSecurityCheck(tokenMint) {
    try {
      const startTime = Date.now();
      
      // Only essential checks for speed
      const checks = await Promise.race([
        this.performQuickChecks(tokenMint),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Security check timeout')), 100)
        )
      ]);
      
      const checkTime = Date.now() - startTime;
      logger.debug(`Quick security check completed in ${checkTime}ms`);
      
      return checks;
      
    } catch (error) {
      // If security check times out, reject for safety
      return { 
        passed: false, 
        reason: 'Security check timeout - safety first' 
      };
    }
  }

  async performQuickChecks(tokenMint) {
    try {
      // Parallel essential checks
      const [mintInfo, recentTxs] = await Promise.all([
        this.connection.getParsedAccountInfo(new PublicKey(tokenMint)),
        this.getRecentTransactions(tokenMint, 5) // Only 5 recent transactions
      ]);
      
      // Check 1: Valid mint
      if (!mintInfo.value) {
        return { passed: false, reason: 'Invalid token mint' };
      }
      
      // Check 2: Basic mint authority check
      const mintData = mintInfo.value.data.parsed?.info;
      if (mintData?.mintAuthority !== null) {
        return { passed: false, reason: 'Active mint authority detected' };
      }
      
      // Check 3: Recent activity check
      if (recentTxs.length === 0) {
        return { passed: false, reason: 'No recent trading activity' };
      }
      
      return { passed: true, reason: 'Quick checks passed' };
      
    } catch (error) {
      return { passed: false, reason: 'Quick check failed' };
    }
  }

  async executeImmediateBuy(tokenMint, amount, poolInfo) {
    try {
      const startTime = Date.now();
      
      // Get or create pre-signed transaction
      let transaction = this.getPreSignedTransaction(tokenMint, amount);
      
      if (!transaction) {
        // Build transaction quickly
        transaction = await this.buildFastTransaction(tokenMint, amount, poolInfo);
      }
      
      // Add priority fee for speed
      const priorityFee = this.calculateUrgentPriorityFee();
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFee
        })
      );
      
      // Execute with high priority
      const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
        skipPreflight: true, // Skip for speed
        preflightCommitment: 'processed',
        maxRetries: 1 // Fast fail
      });
      
      const executionTime = Date.now() - startTime;
      
      // Don't wait for confirmation in fast-path
      this.scheduleConfirmationCheck(signature);
      
      logTrade('BUY_FAST', tokenMint, amount, 'MARKET', null);
      
      return {
        success: true,
        signature,
        executionTime,
        confirmed: false // Will be confirmed async
      };
      
    } catch (error) {
      logError(error, 'FastPathExecutor.executeImmediateBuy');
      return { success: false, reason: error.message };
    }
  }

  async buildFastTransaction(tokenMint, amount, poolInfo) {
    try {
      // Use Jupiter for fast routing
      const route = await this.transactionBuilder.getJupiterRoute(
        'So11111111111111111111111111111111111111112', // SOL
        tokenMint,
        amount * 1e9, // Convert to lamports
        5 // 5% slippage for speed
      );
      
      if (!route) {
        throw new Error('No route found for fast execution');
      }
      
      // Build transaction with minimal checks
      const transaction = await this.transactionBuilder.buildSwapTransaction(
        route,
        this.wallet.publicKey,
        { skipValidation: true } // Skip validation for speed
      );
      
      return transaction;
      
    } catch (error) {
      throw new Error(`Fast transaction build failed: ${error.message}`);
    }
  }

  calculateUrgentPriorityFee() {
    // Higher priority fee for fast-path
    const baseFee = config.fees.basePriorityFee;
    const urgentMultiplier = 3; // 3x normal priority fee
    
    return Math.min(baseFee * urgentMultiplier, config.fees.maxPriorityFee);
  }

  // LAZY ANALYSIS: Complete analysis after fast-path execution
  scheduleLazyAnalysis(tokenData, poolInfo, buySignature) {
    // Schedule comprehensive analysis in background
    setTimeout(async () => {
      try {
        logger.info(`🔍 Starting lazy analysis for ${tokenData.mint}`);
        
        const TokenAnalyzer = require('../analysis/token-analyzer');
        const analyzer = new TokenAnalyzer(this.solanaConnection);
        
        // Full analysis with all 6 criteria
        const fullAnalysis = await analyzer.analyzeToken(tokenData.mint, poolInfo);
        
        // Evaluate if we should hold or sell based on full analysis
        await this.evaluatePostBuyDecision(tokenData.mint, fullAnalysis, buySignature);
        
      } catch (error) {
        logError(error, 'FastPathExecutor.scheduleLazyAnalysis');
      }
    }, 1000); // Start analysis 1 second after buy
  }

  async evaluatePostBuyDecision(tokenMint, fullAnalysis, buySignature) {
    try {
      const totalScore = fullAnalysis.totalScore;
      
      logger.info(`📊 Lazy analysis complete: ${tokenMint} scored ${totalScore}/10`);
      
      if (totalScore < 4) {
        // Score too low, consider immediate exit
        logger.warn(`⚠️ Low score detected (${totalScore}), considering exit`);
        await this.scheduleEarlyExit(tokenMint, 'LOW_SCORE');
        
      } else if (totalScore >= 7) {
        // Score high enough, increase position
        logger.info(`✅ High score confirmed (${totalScore}), considering position increase`);
        await this.considerPositionIncrease(tokenMint, fullAnalysis);
        
      } else {
        // Medium score, hold current position
        logger.info(`📊 Medium score (${totalScore}), holding current position`);
      }
      
      // Update position monitoring with full analysis data
      this.updatePositionMonitoring(tokenMint, fullAnalysis);
      
    } catch (error) {
      logError(error, 'FastPathExecutor.evaluatePostBuyDecision');
    }
  }

  async scheduleEarlyExit(tokenMint, reason) {
    try {
      // Wait a bit to avoid immediate sell (let price stabilize)
      setTimeout(async () => {
        const AutoTrader = require('../trading/auto-trader');
        const autoTrader = new AutoTrader(this.solanaConnection, this.transactionBuilder);
        
        await autoTrader.executeSell(tokenMint, 'FULL', {
          reason: `EARLY_EXIT_${reason}`,
          urgency: 'HIGH'
        });
        
        logger.info(`🚪 Early exit executed for ${tokenMint}: ${reason}`);
        
      }, 30000); // Wait 30 seconds before exit
      
    } catch (error) {
      logError(error, 'FastPathExecutor.scheduleEarlyExit');
    }
  }

  async considerPositionIncrease(tokenMint, analysis) {
    try {
      // Only increase if we have high confidence and good metrics
      if (analysis.totalScore >= 8 && analysis.scores.security >= 8) {
        
        const additionalAmount = config.trading.tradeAmountSol * 0.7; // Add 70% more
        
        logger.info(`📈 Increasing position for ${tokenMint} by ${additionalAmount} SOL`);
        
        // Execute additional buy
        const additionalBuy = await this.executeImmediateBuy(tokenMint, additionalAmount, null);
        
        if (additionalBuy.success) {
          logger.info(`✅ Position increased: ${additionalBuy.signature}`);
        }
      }
      
    } catch (error) {
      logError(error, 'FastPathExecutor.considerPositionIncrease');
    }
  }

  // PRE-SIGNED TRANSACTION MANAGEMENT
  preparePreSignedTransactions() {
    // Prepare common transaction templates
    setInterval(() => {
      this.refreshPreSignedCache();
    }, 30000); // Refresh every 30 seconds
  }

  getPreSignedTransaction(tokenMint, amount) {
    const cacheKey = `${tokenMint}_${amount}`;
    return this.preSignedCache.get(cacheKey);
  }

  async refreshPreSignedCache() {
    try {
      // Clear old cache
      this.preSignedCache.clear();
      
      // Pre-build common transaction templates
      const commonAmounts = [0.05, 0.1, 0.2]; // Common SOL amounts
      
      for (const amount of commonAmounts) {
        // This would pre-build transaction templates
        // Implementation depends on specific requirements
      }
      
      logger.debug(`Pre-signed cache refreshed with ${this.preSignedCache.size} templates`);
      
    } catch (error) {
      logError(error, 'FastPathExecutor.refreshPreSignedCache');
    }
  }

  // CONFIRMATION TRACKING
  scheduleConfirmationCheck(signature) {
    setTimeout(async () => {
      try {
        const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          logger.error(`❌ Fast-path transaction failed: ${signature}`);
          // Handle failed transaction
        } else {
          logger.info(`✅ Fast-path transaction confirmed: ${signature}`);
        }
        
      } catch (error) {
        logError(error, 'FastPathExecutor.scheduleConfirmationCheck');
      }
    }, 5000); // Check confirmation after 5 seconds
  }

  // PERFORMANCE MONITORING
  updatePerformanceMetrics(success, latency, isFastPath) {
    this.performanceMetrics.totalExecutions++;
    
    if (success) {
      this.performanceMetrics.successfulExecutions++;
    }
    
    if (isFastPath) {
      this.performanceMetrics.fastPathHits++;
    }
    
    // Update average latency
    const currentAvg = this.performanceMetrics.averageLatency;
    const totalExecs = this.performanceMetrics.totalExecutions;
    
    this.performanceMetrics.averageLatency = 
      ((currentAvg * (totalExecs - 1)) + latency) / totalExecs;
    
    // Log performance every 10 executions
    if (totalExecs % 10 === 0) {
      this.logPerformanceStats();
    }
  }

  logPerformanceStats() {
    const metrics = this.performanceMetrics;
    const successRate = (metrics.successfulExecutions / metrics.totalExecutions) * 100;
    const fastPathRate = (metrics.fastPathHits / metrics.totalExecutions) * 100;
    
    logger.info(`📊 Performance Stats: ${successRate.toFixed(1)}% success, ${fastPathRate.toFixed(1)}% fast-path, ${metrics.averageLatency.toFixed(0)}ms avg latency`);
  }

  updatePositionMonitoring(tokenMint, analysis) {
    // Update monitoring parameters based on analysis
    const monitoringConfig = {
      tokenMint,
      stopLoss: -30, // Standard stop loss
      takeProfit: 30, // Standard take profit
      trailingStop: analysis.totalScore >= 8 ? 15 : null, // Trailing stop for high-score tokens
      riskLevel: analysis.scores.security <= 5 ? 'HIGH' : 'MEDIUM',
      lastAnalysis: analysis,
      timestamp: Date.now()
    };
    
    // This would integrate with position monitoring system
    logger.info(`📊 Position monitoring updated for ${tokenMint}`);
  }

  // UTILITY METHODS
  async getRecentTransactions(tokenMint, limit = 10) {
    try {
      // This is a simplified version - would need proper implementation
      return [];
    } catch (error) {
      return [];
    }
  }

  getStats() {
    return {
      performanceMetrics: this.performanceMetrics,
      cacheSize: this.preSignedCache.size,
      queueLength: this.executionQueue.length,
      isProcessing: this.isProcessing
    };
  }
}

module.exports = FastPathExecutor;

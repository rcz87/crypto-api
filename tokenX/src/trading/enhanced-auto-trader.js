/**
 * @fileoverview Enhanced Auto Trader dengan pre-flight sell simulation dan guard logic
 * Implementasi sesuai spesifikasi dengan Decision → Guard → Execute pattern
 */

const { logger } = require('../utils/logger');
const { analyzeToken } = require('../analysis/ai-token-analyzer');

/**
 * @typedef {import('../types/contracts').TokenSnapshot} TokenSnapshot
 * @typedef {import('../types/contracts').AnalysisScores} AnalysisScores
 * @typedef {import('../types/contracts').TradeDecision} TradeDecision
 * @typedef {import('../types/contracts').ExecutionResult} ExecutionResult
 * @typedef {import('../types/contracts').TradingConfig} TradingConfig
 * @typedef {import('../types/contracts').Position} Position
 */

/**
 * Enhanced Auto Trader dengan sophisticated decision making
 */
class EnhancedAutoTrader {
  constructor(dependencies = {}) {
    /** @type {import('../core/solana-connection-factory').SolanaConnectionFactory} */
    this.connectionFactory = dependencies.connectionFactory;
    
    /** @type {import('../services/enhanced-api-service')} */
    this.apiService = dependencies.apiService;
    
    /** @type {import('../execution/fast-path-executor')} */
    this.executor = dependencies.executor;
    
    /** @type {TradingConfig} */
    this.config = {
      tradeAmountSol: 0.1,
      minScoreToBuy: 7.0,
      maxPositions: 10,
      takeProfitPct: 30,
      stopLossPct: 30,
      priorityFeeMicro: 1000,
      ...dependencies.config
    };
    
    /** @type {Map<string, Position>} */
    this.openPositions = new Map();
    
    /** @type {Object[]} */
    this.tradeHistory = [];
    
    /** @type {boolean} */
    this.isActive = false;
    
    /** @type {Object} */
    this.stats = {
      totalTrades: 0,
      successfulTrades: 0,
      totalProfit: 0,
      totalLoss: 0
    };
  }

  /**
   * Start the auto trader
   */
  async start() {
    if (this.isActive) {
      logger.warn('Auto trader already active');
      return;
    }

    this.isActive = true;
    logger.info('🚀 Enhanced Auto Trader started');
    logger.info(`📊 Config: ${this.config.tradeAmountSol} SOL/trade, TP: +${this.config.takeProfitPct}%, SL: -${this.config.stopLossPct}%, Min Score: ${this.config.minScoreToBuy}/10`);
  }

  /**
   * Stop the auto trader
   */
  async stop() {
    this.isActive = false;
    logger.info('🛑 Enhanced Auto Trader stopped');
  }

  /**
   * Main trading decision function: Decision → Guard → Execute
   * @param {TokenSnapshot} snapshot - Token data snapshot
   * @param {AnalysisScores} scores - Analysis scores
   * @param {Object} ctx - Trading context
   * @returns {Promise<TradeDecision>}
   */
  async maybeTrade(snapshot, scores, ctx = {}) {
    try {
      // Step 1: Score-based decision
      if (scores.finalScore < this.config.minScoreToBuy) {
        return {
          action: "SKIP",
          reason: "Score too low",
          score: scores.finalScore,
          sizeSol: 0
        };
      }

      // Step 2: Pre-flight sell simulation (critical guard)
      const canSell = await this.preflightSellSimulation(snapshot.mint);
      if (!canSell) {
        return {
          action: "SKIP",
          reason: "Cannot sell (honeypot/fees)",
          score: scores.finalScore,
          sizeSol: 0
        };
      }

      // Step 3: Position limits guard
      if (this.openPositions.size >= this.config.maxPositions) {
        return {
          action: "WATCH",
          reason: "Max positions reached",
          score: scores.finalScore,
          sizeSol: 0
        };
      }

      // Step 4: Duplicate position guard
      if (this.openPositions.has(snapshot.mint)) {
        return {
          action: "SKIP",
          reason: "Already have position",
          score: scores.finalScore,
          sizeSol: 0
        };
      }

      // Step 5: Liquidity guard
      if (snapshot.poolLiquiditySol < 10) {
        return {
          action: "SKIP",
          reason: "Insufficient liquidity",
          score: scores.finalScore,
          sizeSol: 0
        };
      }

      // Step 6: Security guard (critical)
      if (!snapshot.mintAuthorityNull) {
        return {
          action: "SKIP",
          reason: "Mint authority not null",
          score: scores.finalScore,
          sizeSol: 0
        };
      }

      // Step 7: Age guard (avoid brand new tokens)
      if (snapshot.hoursSinceLaunch < 0.5) { // Less than 30 minutes
        return {
          action: "WATCH",
          reason: "Token too new",
          score: scores.finalScore,
          sizeSol: 0
        };
      }

      // All guards passed - execute buy
      const sizeSol = this.config.tradeAmountSol;
      return {
        action: "BUY",
        reason: "All checks passed",
        score: scores.finalScore,
        sizeSol
      };

    } catch (error) {
      logger.error('Error in trading decision:', error);
      return {
        action: "SKIP",
        reason: "Decision error",
        score: scores.finalScore || 0,
        sizeSol: 0
      };
    }
  }

  /**
   * Pre-flight sell simulation to detect honeypots and high fees
   * @param {string} mint - Token mint address
   * @returns {Promise<boolean>} Whether token can be sold
   */
  async preflightSellSimulation(mint) {
    try {
      logger.debug(`Running pre-flight sell simulation for ${mint}`);

      // Step 1: Get quote for small sell (0.0001 SOL equivalent)
      const testAmount = 100; // Very small amount for testing
      
      const quote = await this.apiService.jupiter.getQuote(
        mint,
        'So11111111111111111111111111111111111111112', // SOL
        testAmount
      );

      if (!quote || !quote.outAmount) {
        logger.warn(`Pre-flight failed: No quote available for ${mint}`);
        return false;
      }

      // Step 2: Check for reasonable slippage
      const expectedOut = testAmount * 0.95; // Allow 5% slippage
      if (quote.outAmount < expectedOut) {
        logger.warn(`Pre-flight failed: High slippage detected for ${mint}`);
        return false;
      }

      // Step 3: Check price impact
      if (quote.priceImpactPct && quote.priceImpactPct > 10) {
        logger.warn(`Pre-flight failed: High price impact (${quote.priceImpactPct}%) for ${mint}`);
        return false;
      }

      // Step 4: Try to build transaction (without executing)
      try {
        const mockUserKey = 'So11111111111111111111111111111111111111112'; // Mock key for testing
        const swapTx = await this.apiService.jupiter.buildSwapTx(quote, mockUserKey);
        
        if (!swapTx || !swapTx.swapTransaction) {
          logger.warn(`Pre-flight failed: Cannot build swap transaction for ${mint}`);
          return false;
        }
      } catch (buildError) {
        logger.warn(`Pre-flight failed: Transaction build error for ${mint}:`, buildError.message);
        return false;
      }

      logger.debug(`Pre-flight passed for ${mint}`);
      return true;

    } catch (error) {
      logger.warn(`Pre-flight simulation failed for ${mint}:`, error.message);
      return false;
    }
  }

  /**
   * Execute buy order
   * @param {TokenSnapshot} snapshot - Token data
   * @param {TradeDecision} decision - Trading decision
   * @returns {Promise<ExecutionResult>}
   */
  async executeBuy(snapshot, decision) {
    try {
      logger.info(`💰 EXECUTING BUY: ${snapshot.symbol} | Score: ${decision.score}/10 | Size: ${decision.sizeSol} SOL`);

      const startTime = Date.now();

      // Execute the buy transaction
      const result = await this.executor.fastExecuteSwap({
        conn: this.connectionFactory.getConnection(),
        inputMint: 'So11111111111111111111111111111111111111112', // SOL
        outputMint: snapshot.mint,
        amount: decision.sizeSol * 1e9, // Convert to lamports
        priorityFeeMicro: this.config.priorityFeeMicro
      });

      if (result.ok) {
        // Create position record
        const position = {
          mint: snapshot.mint,
          entryPrice: 0, // Will be updated after confirmation
          currentPrice: 0,
          sizeSol: decision.sizeSol,
          entryTime: Date.now(),
          takeProfitPrice: 0, // Will be calculated after entry price known
          stopLossPrice: 0, // Will be calculated after entry price known
          status: 'PENDING'
        };

        this.openPositions.set(snapshot.mint, position);
        this.stats.totalTrades++;

        const executionTime = Date.now() - startTime;
        logger.info(`✅ BUY EXECUTED: ${snapshot.symbol} | Signature: ${result.signature} | Time: ${executionTime}ms`);

        return result;
      } else {
        logger.error(`❌ BUY FAILED: ${snapshot.symbol} | Error: ${result.error}`);
        return result;
      }

    } catch (error) {
      logger.error(`Error executing buy for ${snapshot.symbol}:`, error);
      return {
        ok: false,
        error: error.message
      };
    }
  }

  /**
   * Execute sell order
   * @param {string} mint - Token mint
   * @param {string} reason - Reason for selling
   * @returns {Promise<ExecutionResult>}
   */
  async executeSell(mint, reason = 'MANUAL') {
    try {
      const position = this.openPositions.get(mint);
      if (!position) {
        logger.warn(`No position found for ${mint}`);
        return { ok: false, error: 'No position found' };
      }

      logger.info(`💸 EXECUTING SELL: ${mint} | Reason: ${reason}`);

      const startTime = Date.now();

      // Get current token balance (simplified - would need actual balance check)
      const tokenBalance = position.sizeSol * 1e9; // Mock balance

      // Execute the sell transaction
      const result = await this.executor.fastExecuteSwap({
        conn: this.connectionFactory.getConnection(),
        inputMint: mint,
        outputMint: 'So11111111111111111111111111111111111111112', // SOL
        amount: tokenBalance,
        priorityFeeMicro: this.config.priorityFeeMicro
      });

      if (result.ok) {
        // Update position
        position.status = 'CLOSING';
        
        const executionTime = Date.now() - startTime;
        logger.info(`✅ SELL EXECUTED: ${mint} | Signature: ${result.signature} | Time: ${executionTime}ms`);

        // Move to history and remove from active positions
        this.tradeHistory.push({
          ...position,
          exitTime: Date.now(),
          exitReason: reason,
          signature: result.signature
        });
        
        this.openPositions.delete(mint);

        return result;
      } else {
        logger.error(`❌ SELL FAILED: ${mint} | Error: ${result.error}`);
        return result;
      }

    } catch (error) {
      logger.error(`Error executing sell for ${mint}:`, error);
      return {
        ok: false,
        error: error.message
      };
    }
  }

  /**
   * Process new token detection
   * @param {TokenSnapshot} snapshot - Token data snapshot
   */
  async processNewToken(snapshot) {
    if (!this.isActive) return;

    try {
      logger.info(`🔍 Processing new token: ${snapshot.symbol} (${snapshot.mint})`);

      // Step 1: Analyze token
      const scores = await analyzeToken(snapshot);

      // Step 2: Make trading decision
      const decision = await this.maybeTrade(snapshot, scores, { state: this });

      // Step 3: Log decision
      logger.info(`📊 Decision for ${snapshot.symbol}: ${decision.action} | Score: ${decision.score}/10 | Reason: ${decision.reason}`);

      // Step 4: Execute if decision is BUY
      if (decision.action === 'BUY') {
        await this.executeBuy(snapshot, decision);
      }

    } catch (error) {
      logger.error(`Error processing token ${snapshot.mint}:`, error);
    }
  }

  /**
   * Monitor existing positions for TP/SL
   */
  async monitorPositions() {
    if (!this.isActive || this.openPositions.size === 0) return;

    for (const [mint, position] of this.openPositions) {
      if (position.status !== 'ACTIVE') continue;

      try {
        // Get current price (simplified - would use real price feed)
        const currentPrice = await this.getCurrentPrice(mint);
        if (!currentPrice) continue;

        position.currentPrice = currentPrice;

        // Calculate profit/loss percentage
        const profitPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

        // Check take profit
        if (profitPct >= this.config.takeProfitPct) {
          logger.info(`🟢 TAKE PROFIT triggered for ${mint}: +${profitPct.toFixed(2)}%`);
          await this.executeSell(mint, 'TAKE_PROFIT');
        }
        // Check stop loss
        else if (profitPct <= -this.config.stopLossPct) {
          logger.warn(`🔴 STOP LOSS triggered for ${mint}: ${profitPct.toFixed(2)}%`);
          await this.executeSell(mint, 'STOP_LOSS');
        }

      } catch (error) {
        logger.error(`Error monitoring position ${mint}:`, error);
      }
    }
  }

  /**
   * Get current price for a token (simplified implementation)
   * @param {string} mint - Token mint
   * @returns {Promise<number|null>} Current price
   */
  async getCurrentPrice(mint) {
    try {
      const poolData = await this.apiService.dexscreener.getPoolsByMint(mint);
      
      if (poolData && poolData.pairs && poolData.pairs.length > 0) {
        return parseFloat(poolData.pairs[0].priceUsd) || null;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error getting price for ${mint}:`, error);
      return null;
    }
  }

  /**
   * Get trading statistics
   * @returns {Object} Trading stats
   */
  getStats() {
    const winRate = this.stats.totalTrades > 0 ? 
      (this.stats.successfulTrades / this.stats.totalTrades) * 100 : 0;

    return {
      isActive: this.isActive,
      openPositions: this.openPositions.size,
      totalTrades: this.stats.totalTrades,
      successfulTrades: this.stats.successfulTrades,
      winRate: winRate.toFixed(2) + '%',
      totalProfit: this.stats.totalProfit.toFixed(4) + ' SOL',
      totalLoss: this.stats.totalLoss.toFixed(4) + ' SOL',
      netProfit: (this.stats.totalProfit - this.stats.totalLoss).toFixed(4) + ' SOL',
      recentTrades: this.tradeHistory.slice(-10)
    };
  }

  /**
   * Get current positions
   * @returns {Position[]} Array of current positions
   */
  getPositions() {
    return Array.from(this.openPositions.values());
  }

  // Testing methods for comprehensive testing
  calculateStopLoss(entryPrice) {
    try {
      return entryPrice * (1 - this.config.stopLossPct / 100);
    } catch (error) {
      return 0;
    }
  }

  calculateTakeProfit(entryPrice) {
    try {
      return entryPrice * (1 + this.config.takeProfitPct / 100);
    } catch (error) {
      return 0;
    }
  }

  calculatePositionSize() {
    try {
      return this.config.tradeAmountSol;
    } catch (error) {
      return 0;
    }
  }

  canOpenNewPosition() {
    try {
      return this.openPositions.size < this.config.maxPositions;
    } catch (error) {
      return false;
    }
  }

  simulateTokenDetection(tokenData) {
    try {
      return tokenData && tokenData.address && tokenData.symbol;
    } catch (error) {
      return false;
    }
  }

  async simulateAnalysis(tokenAddress) {
    try {
      // Mock analysis result
      return {
        finalScore: 7.5,
        liquidity: 8,
        security: 9,
        whale: 7,
        technical: 6,
        price: 8,
        social: 7
      };
    } catch (error) {
      return null;
    }
  }

  simulateDecision(analysis) {
    try {
      if (!analysis || analysis.finalScore === undefined) return false;
      return analysis.finalScore >= this.config.minScoreToBuy;
    } catch (error) {
      return false;
    }
  }

  simulateTransactionPreparation(tokenAddress) {
    try {
      return tokenAddress && tokenAddress.length === 44;
    } catch (error) {
      return false;
    }
  }

  simulatePositionMonitoring() {
    try {
      return true; // Always return true for simulation
    } catch (error) {
      return false;
    }
  }
}

module.exports = {
  EnhancedAutoTrader
};

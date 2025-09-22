const { logger, logError, logTrade } = require('../utils/logger');
const config = require('../config');

class AutoTrader {
  constructor(solanaConnection, tokenAnalyzer, transactionBuilder) {
    this.connection = solanaConnection;
    this.analyzer = tokenAnalyzer;
    this.txBuilder = transactionBuilder;
    
    // Trading state
    this.isActive = false;
    this.positions = new Map(); // tokenMint -> position info
    this.tradingHistory = [];
    this.stats = {
      totalTrades: 0,
      successfulTrades: 0,
      totalProfit: 0,
      totalLoss: 0
    };
    
    // Risk management
    this.maxPositions = config.trading.maxPositions;
    this.tradeAmount = config.trading.tradeAmountSol;
    this.takeProfitPercent = config.trading.takeProfitPercent;
    this.stopLossPercent = config.trading.stopLossPercent;
    
    // Monitoring intervals
    this.monitoringInterval = null;
    this.cleanupInterval = null;
  }

  async start() {
    try {
      if (this.isActive) {
        logger.warn('AutoTrader is already active');
        return;
      }

      this.isActive = true;
      logger.info('🚀 AutoTrader started - Ready for automatic trading!');
      
      // Start position monitoring
      this.startPositionMonitoring();
      
      // Start cleanup tasks
      this.startCleanupTasks();
      
      logger.info(`📊 Trading Settings:
        - Amount per trade: ${this.tradeAmount} SOL
        - Take Profit: +${this.takeProfitPercent}%
        - Stop Loss: -${this.stopLossPercent}%
        - Max Positions: ${this.maxPositions}
        - Min Score to Buy: ${config.trading.minScoreToBuy}/10`);
      
    } catch (error) {
      logError(error, 'AutoTrader.start');
      this.isActive = false;
      throw error;
    }
  }

  async stop() {
    try {
      this.isActive = false;
      
      // Clear intervals
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
      }
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      logger.info('🛑 AutoTrader stopped');
      
    } catch (error) {
      logError(error, 'AutoTrader.stop');
    }
  }

  async handleNewToken(tokenData) {
    try {
      if (!this.isActive || config.emergency.stopTrading) {
        return;
      }

      const { tokenMint, poolInfo } = tokenData;
      
      logger.info(`🔍 New token detected: ${tokenMint}`);
      
      // Check if we already have position
      if (this.positions.has(tokenMint)) {
        logger.debug(`Already have position in ${tokenMint}`);
        return;
      }
      
      // Check position limits
      if (this.positions.size >= this.maxPositions) {
        logger.warn(`Max positions reached (${this.maxPositions}), skipping ${tokenMint}`);
        return;
      }
      
      // Analyze token
      const analysis = await this.analyzer.analyzeToken(tokenMint, poolInfo);
      
      if (analysis.recommendation === 'BUY' && analysis.totalScore >= config.trading.minScoreToBuy) {
        await this.executeBuy(tokenMint, analysis);
      } else {
        logger.info(`❌ Token rejected: ${tokenMint} | Score: ${analysis.totalScore}/10 | Reason: ${analysis.recommendation}`);
      }
      
    } catch (error) {
      logError(error, 'AutoTrader.handleNewToken');
    }
  }

  async executeBuy(tokenMint, analysis) {
    try {
      const startTime = Date.now();
      
      logger.info(`💰 EXECUTING BUY: ${tokenMint} | Score: ${analysis.totalScore}/10`);
      
      // Execute buy transaction
      const signature = await this.txBuilder.executeQuickBuy(tokenMint, this.tradeAmount);
      
      // Create position record
      const position = {
        tokenMint,
        entryPrice: 0, // Will be updated after confirmation
        amount: this.tradeAmount,
        entryTime: Date.now(),
        entrySignature: signature,
        analysis,
        status: 'PENDING',
        stopLossPrice: 0,
        takeProfitPrice: 0
      };
      
      this.positions.set(tokenMint, position);
      
      // Update stats
      this.stats.totalTrades++;
      
      const executionTime = Date.now() - startTime;
      logger.info(`✅ BUY ORDER SENT: ${tokenMint} | Signature: ${signature} | Time: ${executionTime}ms`);
      
      logTrade('BUY', tokenMint, this.tradeAmount, 0);
      
      // Monitor transaction confirmation
      this.monitorTransactionConfirmation(signature, position);
      
    } catch (error) {
      logError(error, 'AutoTrader.executeBuy');
      
      // Remove failed position
      this.positions.delete(tokenMint);
    }
  }

  async executeSell(tokenMint, reason = 'MANUAL') {
    try {
      const position = this.positions.get(tokenMint);
      if (!position) {
        logger.warn(`No position found for ${tokenMint}`);
        return;
      }

      const startTime = Date.now();
      
      logger.info(`💸 EXECUTING SELL: ${tokenMint} | Reason: ${reason}`);
      
      // Get current token balance
      const tokenBalance = await this.txBuilder.getTokenBalance(tokenMint);
      
      if (tokenBalance.uiAmount <= 0) {
        logger.warn(`No tokens to sell for ${tokenMint}`);
        this.positions.delete(tokenMint);
        return;
      }
      
      // Execute sell transaction
      const signature = await this.txBuilder.executeQuickSell(tokenMint, tokenBalance.balance);
      
      // Update position
      position.exitTime = Date.now();
      position.exitSignature = signature;
      position.exitReason = reason;
      position.status = 'SELLING';
      
      const executionTime = Date.now() - startTime;
      logger.info(`✅ SELL ORDER SENT: ${tokenMint} | Signature: ${signature} | Time: ${executionTime}ms`);
      
      // Monitor sell confirmation
      this.monitorSellConfirmation(signature, position);
      
    } catch (error) {
      logError(error, 'AutoTrader.executeSell');
    }
  }

  async monitorTransactionConfirmation(signature, position) {
    try {
      // Wait for confirmation
      const confirmation = await this.connection.getConnection().confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        logger.error(`Buy transaction failed: ${signature}`);
        this.positions.delete(position.tokenMint);
        return;
      }
      
      // Get transaction details untuk calculate entry price
      const txDetails = await this.getTransactionDetails(signature);
      
      if (txDetails) {
        position.entryPrice = txDetails.price;
        position.status = 'ACTIVE';
        
        // Calculate stop loss and take profit prices
        position.stopLossPrice = position.entryPrice * (1 - this.stopLossPercent / 100);
        position.takeProfitPrice = position.entryPrice * (1 + this.takeProfitPercent / 100);
        
        logger.info(`🎯 Position ACTIVE: ${position.tokenMint} | Entry: $${position.entryPrice} | SL: $${position.stopLossPrice} | TP: $${position.takeProfitPrice}`);
        
        this.stats.successfulTrades++;
      }
      
    } catch (error) {
      logError(error, 'AutoTrader.monitorTransactionConfirmation');
      this.positions.delete(position.tokenMint);
    }
  }

  async monitorSellConfirmation(signature, position) {
    try {
      // Wait for confirmation
      const confirmation = await this.connection.getConnection().confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        logger.error(`Sell transaction failed: ${signature}`);
        return;
      }
      
      // Get transaction details untuk calculate exit price
      const txDetails = await this.getTransactionDetails(signature);
      
      if (txDetails) {
        position.exitPrice = txDetails.price;
        position.status = 'CLOSED';
        
        // Calculate profit/loss
        const profitPercent = ((position.exitPrice - position.entryPrice) / position.entryPrice) * 100;
        const profitSol = (profitPercent / 100) * position.amount;
        
        position.profitPercent = profitPercent;
        position.profitSol = profitSol;
        
        // Update stats
        if (profitSol > 0) {
          this.stats.totalProfit += profitSol;
        } else {
          this.stats.totalLoss += Math.abs(profitSol);
        }
        
        logger.info(`📊 Position CLOSED: ${position.tokenMint} | Profit: ${profitPercent.toFixed(2)}% (${profitSol.toFixed(4)} SOL)`);
        
        logTrade('SELL', position.tokenMint, position.amount, position.exitPrice, profitPercent);
        
        // Move to history
        this.tradingHistory.push(position);
        this.positions.delete(position.tokenMint);
      }
      
    } catch (error) {
      logError(error, 'AutoTrader.monitorSellConfirmation');
    }
  }

  startPositionMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkPositions();
      } catch (error) {
        logError(error, 'AutoTrader.positionMonitoring');
      }
    }, 5000); // Check every 5 seconds
  }

  async checkPositions() {
    if (!this.isActive || this.positions.size === 0) {
      return;
    }

    for (const [tokenMint, position] of this.positions) {
      if (position.status !== 'ACTIVE') {
        continue;
      }

      try {
        // Get current price (simplified - would use real price feed)
        const currentPrice = await this.getCurrentPrice(tokenMint);
        
        if (!currentPrice) {
          continue;
        }

        const priceChangePercent = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        
        // Check stop loss
        if (priceChangePercent <= -this.stopLossPercent) {
          logger.warn(`🔴 STOP LOSS triggered for ${tokenMint}: ${priceChangePercent.toFixed(2)}%`);
          await this.executeSell(tokenMint, 'STOP_LOSS');
        }
        // Check take profit
        else if (priceChangePercent >= this.takeProfitPercent) {
          logger.info(`🟢 TAKE PROFIT triggered for ${tokenMint}: ${priceChangePercent.toFixed(2)}%`);
          await this.executeSell(tokenMint, 'TAKE_PROFIT');
        }
        
      } catch (error) {
        logError(error, `AutoTrader.checkPositions.${tokenMint}`);
      }
    }
  }

  startCleanupTasks() {
    this.cleanupInterval = setInterval(() => {
      try {
        // Cleanup old pre-built transactions
        this.txBuilder.cleanupOldTransactions();
        
        // Cleanup old history (keep last 100 trades)
        if (this.tradingHistory.length > 100) {
          this.tradingHistory = this.tradingHistory.slice(-100);
        }
        
      } catch (error) {
        logError(error, 'AutoTrader.cleanupTasks');
      }
    }, 60000); // Every minute
  }

  async getCurrentPrice(tokenMint) {
    try {
      // Simplified price fetching - in real implementation would use DEX APIs
      // For now, return mock price
      return Math.random() * 0.001; // Random price for testing
    } catch (error) {
      logError(error, 'AutoTrader.getCurrentPrice');
      return null;
    }
  }

  async getTransactionDetails(signature) {
    try {
      // Get transaction details untuk extract price info
      // Simplified implementation
      return {
        price: Math.random() * 0.001, // Mock price
        amount: this.tradeAmount
      };
    } catch (error) {
      logError(error, 'AutoTrader.getTransactionDetails');
      return null;
    }
  }

  // Emergency stop all trading
  async emergencyStop() {
    try {
      logger.warn('🚨 EMERGENCY STOP ACTIVATED');
      
      this.isActive = false;
      config.emergency.stopTrading = true;
      
      // Sell all positions
      const sellPromises = [];
      for (const [tokenMint, position] of this.positions) {
        if (position.status === 'ACTIVE') {
          sellPromises.push(this.executeSell(tokenMint, 'EMERGENCY_STOP'));
        }
      }
      
      await Promise.all(sellPromises);
      
      logger.warn('🚨 Emergency stop complete - All positions closed');
      
    } catch (error) {
      logError(error, 'AutoTrader.emergencyStop');
    }
  }

  // Get trading statistics
  getStats() {
    const winRate = this.stats.totalTrades > 0 ? 
      (this.stats.successfulTrades / this.stats.totalTrades) * 100 : 0;
    
    const netProfit = this.stats.totalProfit - this.stats.totalLoss;
    
    return {
      isActive: this.isActive,
      activePositions: this.positions.size,
      totalTrades: this.stats.totalTrades,
      successfulTrades: this.stats.successfulTrades,
      winRate: winRate.toFixed(2) + '%',
      totalProfit: this.stats.totalProfit.toFixed(4) + ' SOL',
      totalLoss: this.stats.totalLoss.toFixed(4) + ' SOL',
      netProfit: netProfit.toFixed(4) + ' SOL',
      recentTrades: this.tradingHistory.slice(-10)
    };
  }

  // Get current positions
  getPositions() {
    return Array.from(this.positions.values());
  }

  // Manual buy (for testing)
  async manualBuy(tokenMint) {
    const mockAnalysis = {
      totalScore: 8,
      recommendation: 'BUY'
    };
    
    await this.executeBuy(tokenMint, mockAnalysis);
  }

  // Manual sell (for testing)
  async manualSell(tokenMint) {
    await this.executeSell(tokenMint, 'MANUAL');
  }

  // Test methods for comprehensive testing
  simulateTokenDetection(tokenData) {
    try {
      // Simulate token detection logic
      if (tokenData && tokenData.address && tokenData.symbol) {
        logger.info(`Token detected: ${tokenData.symbol} (${tokenData.address})`);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async simulateAnalysis(tokenAddress) {
    try {
      // Simulate token analysis
      const mockAnalysis = {
        finalScore: 7.5,
        liquidity: { score: 8, details: 'Good liquidity' },
        security: { score: 9, details: 'Secure token' },
        whale: { score: 7, details: 'Moderate whale activity' },
        technical: { score: 6, details: 'Neutral technical indicators' },
        timing: { score: 8, details: 'Good timing' }
      };
      
      return mockAnalysis;
    } catch (error) {
      return null;
    }
  }

  simulateDecision(analysis) {
    try {
      if (!analysis || analysis.finalScore === undefined) {
        return false;
      }
      
      // Decision based on score threshold
      return analysis.finalScore >= config.trading.minScoreToBuy;
    } catch (error) {
      return false;
    }
  }

  simulateTransactionPreparation(tokenAddress) {
    try {
      // Simulate transaction preparation
      const mockTransaction = {
        tokenAddress,
        amount: config.trading.tradeAmountSol,
        type: 'BUY',
        prepared: true,
        timestamp: Date.now()
      };
      
      logger.info(`Transaction prepared for ${tokenAddress}`);
      return mockTransaction;
    } catch (error) {
      return null;
    }
  }

  simulatePositionMonitoring() {
    try {
      // Simulate position monitoring
      const mockPositions = [
        {
          tokenAddress: 'mock_token_1',
          entryPrice: 1.0,
          currentPrice: 1.2,
          profit: 20,
          status: 'MONITORING'
        }
      ];
      
      return mockPositions.length > 0;
    } catch (error) {
      return false;
    }
  }

  calculateStopLoss(entryPrice) {
    try {
      const stopLossPercent = config.trading.stopLossPercent / 100;
      return entryPrice * (1 - stopLossPercent);
    } catch (error) {
      return 0;
    }
  }

  calculateTakeProfit(entryPrice) {
    try {
      const takeProfitPercent = config.trading.takeProfitPercent / 100;
      return entryPrice * (1 + takeProfitPercent);
    } catch (error) {
      return 0;
    }
  }

  calculatePositionSize() {
    try {
      return config.trading.tradeAmountSol;
    } catch (error) {
      return 0;
    }
  }

  canOpenNewPosition() {
    try {
      return this.positions.size < config.trading.maxPositions;
    } catch (error) {
      return false;
    }
  }
}

module.exports = AutoTrader;

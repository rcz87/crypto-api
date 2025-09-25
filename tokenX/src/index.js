const config = require('./config');
const { logger, logError } = require('./utils/logger');
const SolanaConnection = require('./core/solana-connection');
const EventListener = require('./core/event-listener');
const TokenAnalyzer = require('./analysis/token-analyzer');
const TransactionBuilder = require('./trading/transaction-builder');
const AutoTrader = require('./trading/auto-trader');

class SolanaAutoTradingBot {
  constructor() {
    this.solanaConnection = null;
    this.eventListener = null;
    this.tokenAnalyzer = null;
    this.transactionBuilder = null;
    this.autoTrader = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing Solana Auto Trading Bot...');
      
      // 1. Initialize Solana connection
      logger.info('📡 Setting up Solana connection...');
      this.solanaConnection = new SolanaConnection();
      await this.solanaConnection.initialize();
      
      // 2. Initialize Token Analyzer
      logger.info('🔍 Setting up Token Analyzer...');
      this.tokenAnalyzer = new TokenAnalyzer(this.solanaConnection);
      
      // 3. Initialize Transaction Builder
      logger.info('🔨 Setting up Transaction Builder...');
      this.transactionBuilder = new TransactionBuilder(this.solanaConnection);
      
      // 4. Initialize Auto Trader
      logger.info('🤖 Setting up Auto Trader...');
      this.autoTrader = new AutoTrader(
        this.solanaConnection,
        this.tokenAnalyzer,
        this.transactionBuilder
      );
      
      // 5. Initialize Event Listener
      logger.info('👂 Setting up Event Listener...');
      this.eventListener = new EventListener(this.solanaConnection);
      
      // Setup event handlers
      this.setupEventHandlers();
      
      logger.info('✅ Bot initialization complete!');
      
    } catch (error) {
      logError(error, 'SolanaAutoTradingBot.initialize');
      throw error;
    }
  }

  setupEventHandlers() {
    try {
      // Handle new pool detection
      this.eventListener.on('newPool', async (data) => {
        try {
          logger.info(`🆕 New pool event: ${data.poolInfo?.signature || 'unknown'}`);
          
          // Extract token mint dari pool info
          const tokenMint = this.extractTokenMintFromPool(data);
          
          if (tokenMint) {
            await this.autoTrader.handleNewToken({
              tokenMint,
              poolInfo: data.poolInfo,
              dex: data.dex,
              timestamp: data.timestamp
            });
          }
          
        } catch (error) {
          logError(error, 'EventHandler.newPool');
        }
      });
      
      // Handle swap events untuk whale tracking
      this.eventListener.on('swap', async (data) => {
        try {
          // Log significant swaps
          if (data.swapInfo && data.swapInfo.amount > 5) {
            logger.info(`🐋 Large swap detected: ${data.swapInfo.amount} SOL on ${data.dex}`);
          }
        } catch (error) {
          logError(error, 'EventHandler.swap');
        }
      });
      
      logger.info('📋 Event handlers setup complete');
      
    } catch (error) {
      logError(error, 'SolanaAutoTradingBot.setupEventHandlers');
    }
  }

  extractTokenMintFromPool(poolData) {
    try {
      // Simplified extraction - in real implementation would parse transaction data
      // For now, return a mock token mint for testing
      return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC for testing
    } catch (error) {
      logError(error, 'SolanaAutoTradingBot.extractTokenMintFromPool');
      return null;
    }
  }

  async start() {
    try {
      if (this.isRunning) {
        logger.warn('Bot is already running');
        return;
      }

      logger.info('🎯 Starting Solana Auto Trading Bot...');
      
      // Check emergency stop
      if (config.emergency.stopTrading) {
        throw new Error('Emergency stop is active - cannot start trading');
      }
      
      // Start event listener
      await this.eventListener.startListening();
      
      // Start auto trader
      await this.autoTrader.start();
      
      this.isRunning = true;
      
      logger.info('🟢 Bot is now ACTIVE and monitoring for trading opportunities!');
      
      // Display current settings
      this.displayBotStatus();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      logError(error, 'SolanaAutoTradingBot.start');
      throw error;
    }
  }

  async stop() {
    try {
      if (!this.isRunning) {
        logger.warn('Bot is not running');
        return;
      }

      logger.info('🛑 Stopping Solana Auto Trading Bot...');
      
      this.isRunning = false;
      
      // Stop auto trader
      if (this.autoTrader) {
        await this.autoTrader.stop();
      }
      
      // Stop event listener
      if (this.eventListener) {
        await this.eventListener.stopListening();
      }
      
      // Cleanup connections
      if (this.solanaConnection) {
        await this.solanaConnection.cleanup();
      }
      
      logger.info('🔴 Bot stopped successfully');
      
    } catch (error) {
      logError(error, 'SolanaAutoTradingBot.stop');
    }
  }

  displayBotStatus() {
    const walletAddress = this.solanaConnection.getWallet().publicKey.toString();
    const connectionStatus = this.solanaConnection.isReady();
    const eventListenerStatus = this.eventListener.getStatus();
    const traderStats = this.autoTrader.getStats();
    
    logger.info(`
╔══════════════════════════════════════════════════════════════╗
║                    SOLANA AUTO TRADING BOT                  ║
║                         STATUS: ACTIVE                      ║
╠══════════════════════════════════════════════════════════════╣
║ Wallet: ${walletAddress.substring(0, 20)}...                    ║
║ Connection: ${connectionStatus ? 'CONNECTED' : 'DISCONNECTED'}                                    ║
║ Event Listener: ${eventListenerStatus.isListening ? 'ACTIVE' : 'INACTIVE'}                               ║
║ Subscriptions: ${eventListenerStatus.subscriptions}                                      ║
╠══════════════════════════════════════════════════════════════╣
║ TRADING SETTINGS:                                           ║
║ • Amount per trade: ${config.trading.tradeAmountSol} SOL                              ║
║ • Take Profit: +${config.trading.takeProfitPercent}%                                    ║
║ • Stop Loss: -${config.trading.stopLossPercent}%                                     ║
║ • Min Score to Buy: ${config.trading.minScoreToBuy}/10                                ║
║ • Max Positions: ${config.trading.maxPositions}                                      ║
╠══════════════════════════════════════════════════════════════╣
║ CURRENT STATS:                                              ║
║ • Active Positions: ${traderStats.activePositions}                                   ║
║ • Total Trades: ${traderStats.totalTrades}                                       ║
║ • Win Rate: ${traderStats.winRate}                                        ║
║ • Net Profit: ${traderStats.netProfit}                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logError(error, 'UncaughtException');
      shutdown('UNCAUGHT_EXCEPTION');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('UNHANDLED_REJECTION');
    });
  }

  // Manual trading methods untuk testing
  async manualBuy(tokenMint) {
    if (!this.isRunning) {
      throw new Error('Bot is not running');
    }
    
    logger.info(`🔧 Manual buy triggered for: ${tokenMint}`);
    return await this.autoTrader.manualBuy(tokenMint);
  }

  async manualSell(tokenMint) {
    if (!this.isRunning) {
      throw new Error('Bot is not running');
    }
    
    logger.info(`🔧 Manual sell triggered for: ${tokenMint}`);
    return await this.autoTrader.manualSell(tokenMint);
  }

  async emergencyStop() {
    logger.warn('🚨 EMERGENCY STOP TRIGGERED');
    
    if (this.autoTrader) {
      await this.autoTrader.emergencyStop();
    }
    
    await this.stop();
  }

  // Get bot status
  getStatus() {
    return {
      isRunning: this.isRunning,
      connection: this.solanaConnection?.isReady() || false,
      eventListener: this.eventListener?.getStatus() || {},
      trader: this.autoTrader?.getStats() || {},
      positions: this.autoTrader?.getPositions() || []
    };
  }
}

// Main execution
async function main() {
  try {
    logger.info('Starting Solana Auto Trading Bot...');
    
    const bot = new SolanaAutoTradingBot();
    
    // Initialize bot
    await bot.initialize();
    
    // Start trading
    await bot.start();
    
    // Keep process alive
    process.stdin.resume();
    
  } catch (error) {
    logError(error, 'main');
    process.exit(1);
  }
}

// Export untuk testing
module.exports = SolanaAutoTradingBot;

// Run jika dipanggil langsung
if (require.main === module) {
  main();
}

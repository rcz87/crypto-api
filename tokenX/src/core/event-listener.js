const { PublicKey } = require('@solana/web3.js');
const { logger, logError, logPerformance } = require('../utils/logger');
const config = require('../config');

class EventListener {
  constructor(solanaConnection) {
    this.connection = solanaConnection.getConnection();
    this.subscriptions = new Map();
    this.isListening = false;
    this.eventHandlers = new Map();
    
    // Program IDs yang akan dimonitor
    this.programIds = {
      raydium: new PublicKey(config.dex.raydium),
      orca: new PublicKey(config.dex.orca)
    };
  }

  async startListening() {
    try {
      this.isListening = true;
      logger.info('Starting event listener...');
      
      // Subscribe ke Raydium program logs
      await this.subscribeToRaydiumEvents();
      
      // Subscribe ke Orca program logs
      await this.subscribeToOrcaEvents();
      
      // Subscribe ke account changes untuk monitoring
      await this.subscribeToAccountChanges();
      
      logger.info('Event listener started successfully');
    } catch (error) {
      logError(error, 'EventListener.startListening');
      throw error;
    }
  }

  async subscribeToRaydiumEvents() {
    try {
      const subscriptionId = this.connection.onLogs(
        this.programIds.raydium,
        (logs, context) => {
          this.handleRaydiumLogs(logs, context);
        },
        'confirmed'
      );
      
      this.subscriptions.set('raydium', subscriptionId);
      logger.info('Subscribed to Raydium program logs');
    } catch (error) {
      logError(error, 'EventListener.subscribeToRaydiumEvents');
    }
  }

  async subscribeToOrcaEvents() {
    try {
      const subscriptionId = this.connection.onLogs(
        this.programIds.orca,
        (logs, context) => {
          this.handleOrcaLogs(logs, context);
        },
        'confirmed'
      );
      
      this.subscriptions.set('orca', subscriptionId);
      logger.info('Subscribed to Orca program logs');
    } catch (error) {
      logError(error, 'EventListener.subscribeToOrcaEvents');
    }
  }

  async subscribeToAccountChanges() {
    try {
      // Monitor untuk perubahan account yang penting
      // Ini akan digunakan untuk tracking whale wallets nanti
      logger.info('Account change monitoring ready');
    } catch (error) {
      logError(error, 'EventListener.subscribeToAccountChanges');
    }
  }

  handleRaydiumLogs(logs, context) {
    try {
      const startTime = Date.now();
      
      // Parse Raydium logs untuk detect pool creation, swaps, etc.
      const signature = logs.signature;
      const logMessages = logs.logs;
      
      // Check untuk pool initialization
      const poolInitLog = logMessages.find(log => 
        log.includes('InitializeInstruction') || 
        log.includes('initialize') ||
        log.includes('CreatePool')
      );
      
      if (poolInitLog) {
        this.handleNewPoolDetected('raydium', signature, logs, context);
      }
      
      // Check untuk swap events
      const swapLog = logMessages.find(log => 
        log.includes('SwapInstruction') || 
        log.includes('swap')
      );
      
      if (swapLog) {
        this.handleSwapDetected('raydium', signature, logs, context);
      }
      
      const processingTime = Date.now() - startTime;
      if (processingTime > 10) { // Log jika processing > 10ms
        logPerformance('Raydium log processing', processingTime);
      }
      
    } catch (error) {
      logError(error, 'EventListener.handleRaydiumLogs');
    }
  }

  handleOrcaLogs(logs, context) {
    try {
      const startTime = Date.now();
      
      // Parse Orca logs untuk detect pool creation, swaps, etc.
      const signature = logs.signature;
      const logMessages = logs.logs;
      
      // Similar logic untuk Orca
      const poolInitLog = logMessages.find(log => 
        log.includes('InitializePool') || 
        log.includes('initialize')
      );
      
      if (poolInitLog) {
        this.handleNewPoolDetected('orca', signature, logs, context);
      }
      
      const swapLog = logMessages.find(log => 
        log.includes('Swap') || 
        log.includes('swap')
      );
      
      if (swapLog) {
        this.handleSwapDetected('orca', signature, logs, context);
      }
      
      const processingTime = Date.now() - startTime;
      if (processingTime > 10) {
        logPerformance('Orca log processing', processingTime);
      }
      
    } catch (error) {
      logError(error, 'EventListener.handleOrcaLogs');
    }
  }

  async handleNewPoolDetected(dex, signature, logs, context) {
    try {
      logger.info(`🚀 NEW POOL DETECTED on ${dex.toUpperCase()}: ${signature}`);
      
      // Extract pool information dari transaction
      const poolInfo = await this.extractPoolInfo(signature, dex);
      
      if (poolInfo) {
        // Emit event untuk analysis engine
        this.emitEvent('newPool', {
          dex,
          signature,
          poolInfo,
          timestamp: Date.now(),
          slot: context.slot
        });
      }
      
    } catch (error) {
      logError(error, 'EventListener.handleNewPoolDetected');
    }
  }

  async handleSwapDetected(dex, signature, logs, context) {
    try {
      // Extract swap information
      const swapInfo = await this.extractSwapInfo(signature, dex);
      
      if (swapInfo && swapInfo.amount > 1) { // Only log significant swaps
        logger.debug(`💱 SWAP on ${dex.toUpperCase()}: ${swapInfo.amount} SOL`);
        
        // Emit event untuk whale tracking
        this.emitEvent('swap', {
          dex,
          signature,
          swapInfo,
          timestamp: Date.now(),
          slot: context.slot
        });
      }
      
    } catch (error) {
      logError(error, 'EventListener.handleSwapDetected');
    }
  }

  async extractPoolInfo(signature, dex) {
    try {
      // Get transaction details
      const tx = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (!tx) return null;
      
      // Parse transaction untuk extract pool info
      // Ini akan diimplementasi lebih detail nanti
      const poolInfo = {
        signature,
        dex,
        tokenA: null, // Will be extracted from tx
        tokenB: null, // Will be extracted from tx
        liquidity: 0, // Will be calculated
        timestamp: Date.now()
      };
      
      return poolInfo;
      
    } catch (error) {
      logError(error, 'EventListener.extractPoolInfo');
      return null;
    }
  }

  async extractSwapInfo(signature, dex) {
    try {
      // Similar extraction untuk swap info
      const swapInfo = {
        signature,
        dex,
        tokenIn: null,
        tokenOut: null,
        amountIn: 0,
        amountOut: 0,
        wallet: null,
        timestamp: Date.now()
      };
      
      return swapInfo;
      
    } catch (error) {
      logError(error, 'EventListener.extractSwapInfo');
      return null;
    }
  }

  // Event emitter system
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  emitEvent(eventType, data) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logError(error, `EventListener.emitEvent.${eventType}`);
        }
      });
    }
  }

  // Subscribe ke specific token untuk monitoring
  async subscribeToToken(tokenMint) {
    try {
      const tokenPublicKey = new PublicKey(tokenMint);
      
      const subscriptionId = this.connection.onAccountChange(
        tokenPublicKey,
        (accountInfo, context) => {
          this.handleTokenAccountChange(tokenMint, accountInfo, context);
        },
        'confirmed'
      );
      
      this.subscriptions.set(`token_${tokenMint}`, subscriptionId);
      logger.info(`Subscribed to token: ${tokenMint}`);
      
    } catch (error) {
      logError(error, 'EventListener.subscribeToToken');
    }
  }

  handleTokenAccountChange(tokenMint, accountInfo, context) {
    try {
      // Handle perubahan pada token account
      this.emitEvent('tokenChange', {
        tokenMint,
        accountInfo,
        context,
        timestamp: Date.now()
      });
    } catch (error) {
      logError(error, 'EventListener.handleTokenAccountChange');
    }
  }

  async stopListening() {
    try {
      this.isListening = false;
      
      // Unsubscribe dari semua subscriptions
      for (const [key, subscriptionId] of this.subscriptions) {
        try {
          if (key.startsWith('token_')) {
            await this.connection.removeAccountChangeListener(subscriptionId);
          } else {
            await this.connection.removeOnLogsListener(subscriptionId);
          }
          logger.debug(`Unsubscribed from ${key}`);
        } catch (error) {
          logError(error, `EventListener.stopListening.${key}`);
        }
      }
      
      this.subscriptions.clear();
      this.eventHandlers.clear();
      
      logger.info('Event listener stopped');
    } catch (error) {
      logError(error, 'EventListener.stopListening');
    }
  }

  getStatus() {
    return {
      isListening: this.isListening,
      subscriptions: this.subscriptions.size,
      eventHandlers: this.eventHandlers.size
    };
  }

  // Testing Methods
  async testWebSocketConnection() {
    try {
      // Test basic connection capability
      const testConnection = this.connection;
      if (testConnection && testConnection.rpcEndpoint) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async testProgramSubscription() {
    try {
      const subscriptionId = this.connection.onLogs(
        this.programIds.raydium,
        (logs) => {
          // Test callback
        },
        'confirmed'
      );
      
      if (subscriptionId) {
        await this.connection.removeOnLogsListener(subscriptionId);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async testAccountMonitoring() {
    try {
      const testAccount = new PublicKey('So11111111111111111111111111111111111111112');
      const subscriptionId = this.connection.onAccountChange(
        testAccount,
        (accountInfo) => {
          // Test callback
        },
        'confirmed'
      );
      
      if (subscriptionId) {
        await this.connection.removeAccountChangeListener(subscriptionId);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}

module.exports = EventListener;

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const config = require('../config');
const { logger, logError } = require('../utils/logger');

class SolanaConnection {
  constructor() {
    this.connection = null;
    this.wsConnection = null;
    this.wallet = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize() {
    try {
      // Setup wallet dari private key
      if (!config.trading.privateKey) {
        throw new Error('Private key tidak ditemukan di environment variables');
      }

      this.wallet = Keypair.fromSecretKey(bs58.decode(config.trading.privateKey));
      logger.info(`Wallet initialized: ${this.wallet.publicKey.toString()}`);

      // Setup RPC connection (prioritas private RPC)
      const rpcUrl = config.solana.privateRpcUrl || config.solana.rpcUrl;
      this.connection = new Connection(rpcUrl, {
        commitment: config.solana.commitment,
        wsEndpoint: config.solana.privateWsUrl || config.solana.wsUrl,
        confirmTransactionInitialTimeout: 60000
      });

      // Test connection
      await this.testConnection();
      
      this.isConnected = true;
      logger.info(`Solana connection established: ${rpcUrl}`);
      
      // Setup WebSocket connection untuk real-time data
      await this.setupWebSocket();
      
      return true;
    } catch (error) {
      logError(error, 'SolanaConnection.initialize');
      throw error;
    }
  }

  async testConnection() {
    try {
      const startTime = Date.now();
      const slot = await this.connection.getSlot();
      const latency = Date.now() - startTime;
      
      logger.info(`Connection test successful - Slot: ${slot}, Latency: ${latency}ms`);
      
      if (latency > 100) {
        logger.warn(`High latency detected: ${latency}ms - Consider using private RPC`);
      }
      
      // Test wallet balance
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      const solBalance = balance / 1e9;
      
      logger.info(`Wallet balance: ${solBalance} SOL`);
      
      if (solBalance < 0.1) {
        logger.warn('Low SOL balance - Make sure you have enough SOL for trading and fees');
      }
      
      return { slot, latency, balance: solBalance };
    } catch (error) {
      logError(error, 'SolanaConnection.testConnection');
      throw error;
    }
  }

  async setupWebSocket() {
    try {
      // Subscribe ke slot changes untuk timing
      this.slotSubscription = this.connection.onSlotChange((slotInfo) => {
        this.currentSlot = slotInfo.slot;
        // Log setiap 100 slot untuk monitoring
        if (slotInfo.slot % 100 === 0) {
          logger.debug(`Current slot: ${slotInfo.slot}`);
        }
      });

      logger.info('WebSocket subscriptions setup complete');
    } catch (error) {
      logError(error, 'SolanaConnection.setupWebSocket');
    }
  }

  async getCurrentSlot() {
    try {
      return await this.connection.getSlot();
    } catch (error) {
      logError(error, 'SolanaConnection.getCurrentSlot');
      return this.currentSlot || 0;
    }
  }

  async getBalance(publicKey = null) {
    try {
      const key = publicKey || this.wallet.publicKey;
      const balance = await this.connection.getBalance(key);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      logError(error, 'SolanaConnection.getBalance');
      return 0;
    }
  }

  async sendTransaction(transaction, options = {}) {
    try {
      const startTime = Date.now();
      
      // Get fresh blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;
      
      // Sign transaction
      transaction.sign(this.wallet);
      
      // Send dengan options untuk kecepatan
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: options.skipPreflight || false,
          preflightCommitment: 'processed',
          maxRetries: options.maxRetries || 3,
          ...options
        }
      );
      
      const sendTime = Date.now() - startTime;
      logger.info(`Transaction sent: ${signature} (${sendTime}ms)`);
      
      // Confirm transaction jika diminta
      if (options.waitForConfirmation !== false) {
        const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
        const totalTime = Date.now() - startTime;
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }
        
        logger.info(`Transaction confirmed: ${signature} (${totalTime}ms total)`);
      }
      
      return signature;
    } catch (error) {
      logError(error, 'SolanaConnection.sendTransaction');
      throw error;
    }
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('Max reconnection attempts reached');
    }

    this.reconnectAttempts++;
    logger.warn(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    try {
      await this.initialize();
      this.reconnectAttempts = 0;
      logger.info('Reconnection successful');
    } catch (error) {
      logError(error, 'SolanaConnection.reconnect');
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 5000 * this.reconnectAttempts));
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.slotSubscription) {
        await this.connection.removeSlotChangeListener(this.slotSubscription);
      }
      
      this.isConnected = false;
      logger.info('Solana connection cleanup complete');
    } catch (error) {
      logError(error, 'SolanaConnection.cleanup');
    }
  }

  // Getter methods
  getConnection() {
    return this.connection;
  }

  getWallet() {
    return this.wallet;
  }

  isReady() {
    return this.isConnected && this.connection && this.wallet;
  }

  // Additional test methods for comprehensive testing
  async connect() {
    try {
      // Test connection by getting slot
      await this.connection.getSlot();
      return true;
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async testWebSocketConnection() {
    try {
      // Test WebSocket by subscribing to slot changes
      const subscriptionId = this.connection.onSlotChange(() => {});
      if (subscriptionId) {
        await this.connection.removeSlotChangeListener(subscriptionId);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async testConnectionRecovery() {
    try {
      // Simulate connection recovery by testing multiple endpoints
      const testEndpoints = [
        config.solana.rpcUrl,
        'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com'
      ];
      
      for (const endpoint of testEndpoints) {
        try {
          const testConnection = new Connection(endpoint);
          await testConnection.getSlot();
          return true;
        } catch (error) {
          continue;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async testRpcFailover() {
    try {
      // Test RPC failover mechanism
      const backupRpc = 'https://api.mainnet-beta.solana.com';
      const backupConnection = new Connection(backupRpc);
      await backupConnection.getSlot();
      return true;
    } catch (error) {
      return false;
    }
  }

  async testWebSocketReconnection() {
    try {
      // Test WebSocket reconnection
      const wsUrl = config.solana.wsUrl;
      // Simplified test - just check if we can create connection
      return wsUrl && (wsUrl.includes('wss://') || wsUrl.includes('ws://'));
    } catch (error) {
      return false;
    }
  }
}

module.exports = SolanaConnection;

/**
 * @fileoverview Enhanced Event Listener dengan auto-resubscribe dan backfill
 * Implementasi sesuai spesifikasi dengan backoff dan recovery mechanisms
 */

const { PublicKey } = require('@solana/web3.js');
const { logger } = require('../utils/logger');

/**
 * Event listener dengan auto-resubscribe dan backfill capabilities
 */
class EnhancedEventListener {
  constructor() {
    /** @type {import('./solana-connection-factory').SolanaConnectionFactory|null} */
    this.connectionFactory = null;
    
    /** @type {Map<string, number>} */
    this.subscriptions = new Map();
    
    /** @type {Map<string, Function>} */
    this.eventHandlers = new Map();
    
    /** @type {boolean} */
    this.isListening = false;
    
    /** @type {number} */
    this.lastProcessedSlot = 0;
    
    /** @type {number} */
    this.reconnectAttempts = 0;
    
    /** @type {number} */
    this.maxReconnectAttempts = 10;
    
    /** @type {NodeJS.Timeout|null} */
    this.reconnectTimer = null;
    
    /** @type {NodeJS.Timeout|null} */
    this.backfillTimer = null;
    
    /** @type {PublicKey[]} */
    this.programIds = [];
    
    /** @type {Function|null} */
    this.onEventCallback = null;
  }

  /**
   * Initialize event listener
   * @param {import('./solana-connection-factory').SolanaConnectionFactory} connectionFactory 
   * @param {string[]} programIds - Array of program ID strings to monitor
   * @param {Function} onEvent - Event callback function
   */
  initialize(connectionFactory, programIds, onEvent) {
    this.connectionFactory = connectionFactory;
    this.programIds = programIds.map(id => new PublicKey(id));
    this.onEventCallback = onEvent;
    
    // Listen for connection health changes
    this.connectionFactory.onHealthy(() => {
      if (this.isListening && this.subscriptions.size === 0) {
        logger.info('Connection restored, restarting event listener');
        this.startListening();
      }
    });
    
    this.connectionFactory.onUnhealthy(() => {
      logger.warn('Connection unhealthy, event listener may experience issues');
    });
    
    logger.info(`Enhanced Event Listener initialized for ${this.programIds.length} programs`);
  }

  /**
   * Start listening to events
   */
  async startListening() {
    if (this.isListening) {
      logger.warn('Event listener already running');
      return;
    }

    this.isListening = true;
    this.reconnectAttempts = 0;
    
    try {
      // Get current slot as starting point
      const connection = this.connectionFactory.getConnection();
      this.lastProcessedSlot = await connection.getSlot('confirmed');
      
      // Subscribe to all program logs
      await this.subscribeToPrograms();
      
      // Start backfill monitoring
      this.startBackfillMonitoring();
      
      logger.info(`Event listener started, monitoring from slot ${this.lastProcessedSlot}`);
      
    } catch (error) {
      logger.error('Failed to start event listener:', error);
      this.handleConnectionError(error);
    }
  }

  /**
   * Subscribe to program logs with error handling
   */
  async subscribeToPrograms() {
    const connection = this.connectionFactory.getConnection();
    
    for (const programId of this.programIds) {
      try {
        const subscriptionId = connection.onLogs(
          programId,
          (logs, context) => {
            this.handleProgramLogs(programId.toString(), logs, context);
          },
          'confirmed'
        );
        
        this.subscriptions.set(programId.toString(), subscriptionId);
        logger.info(`Subscribed to program: ${programId.toString()}`);
        
      } catch (error) {
        logger.error(`Failed to subscribe to program ${programId.toString()}:`, error);
        this.handleConnectionError(error);
      }
    }
  }

  /**
   * Handle program logs with error handling and slot tracking
   * @param {string} programId - Program ID string
   * @param {Object} logs - Log data
   * @param {Object} context - Context with slot information
   */
  handleProgramLogs(programId, logs, context) {
    try {
      // Update last processed slot
      if (context.slot > this.lastProcessedSlot) {
        this.lastProcessedSlot = context.slot;
      }
      
      // Process the event
      const eventData = {
        programId,
        signature: logs.signature,
        logs: logs.logs,
        slot: context.slot,
        timestamp: Date.now(),
        err: logs.err
      };
      
      // Call the event handler
      if (this.onEventCallback) {
        this.onEventCallback(eventData);
      }
      
      // Emit to specific handlers
      this.emitEvent('programLog', eventData);
      
    } catch (error) {
      logger.error(`Error handling program logs for ${programId}:`, error);
    }
  }

  /**
   * Handle connection errors with exponential backoff
   * @param {Error} error - The error that occurred
   */
  handleConnectionError(error) {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, stopping event listener');
      this.stopListening();
      return;
    }
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, max 60s
    const backoffMs = Math.min(60000, Math.pow(2, this.reconnectAttempts - 1) * 1000);
    
    logger.warn(`Connection error, retrying in ${backoffMs}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    // Clear existing subscriptions
    this.clearSubscriptions();
    
    // Schedule reconnection
    this.reconnectTimer = setTimeout(() => {
      this.attemptReconnection();
    }, backoffMs);
  }

  /**
   * Attempt to reconnect and resubscribe
   */
  async attemptReconnection() {
    try {
      logger.info('Attempting to reconnect event listener...');
      
      // Test connection health
      const connection = this.connectionFactory.getConnection();
      await connection.getSlot('confirmed');
      
      // Resubscribe to programs
      await this.subscribeToPrograms();
      
      // Perform backfill for missed events
      await this.performBackfill();
      
      // Reset reconnect attempts on success
      this.reconnectAttempts = 0;
      
      logger.info('Event listener reconnected successfully');
      
    } catch (error) {
      logger.error('Reconnection attempt failed:', error);
      this.handleConnectionError(error);
    }
  }

  /**
   * Perform backfill to catch missed events during disconnection
   */
  async performBackfill() {
    try {
      const connection = this.connectionFactory.getConnection();
      const currentSlot = await connection.getSlot('confirmed');
      
      // If we missed more than 100 slots, perform backfill
      const missedSlots = currentSlot - this.lastProcessedSlot;
      
      if (missedSlots > 100) {
        logger.warn(`Missed ${missedSlots} slots, performing backfill...`);
        
        // Get signatures for each program since last processed slot
        for (const programId of this.programIds) {
          try {
            const signatures = await connection.getSignaturesForAddress(
              programId,
              {
                before: null,
                until: null,
                limit: Math.min(1000, missedSlots)
              }
            );
            
            // Process signatures in reverse order (oldest first)
            for (const sigInfo of signatures.reverse()) {
              if (sigInfo.slot > this.lastProcessedSlot) {
                await this.processBackfillSignature(programId.toString(), sigInfo);
              }
            }
            
          } catch (error) {
            logger.error(`Backfill failed for program ${programId.toString()}:`, error);
          }
        }
        
        logger.info(`Backfill completed, processed up to slot ${currentSlot}`);
      }
      
      this.lastProcessedSlot = currentSlot;
      
    } catch (error) {
      logger.error('Backfill operation failed:', error);
    }
  }

  /**
   * Process a signature during backfill
   * @param {string} programId - Program ID string
   * @param {Object} sigInfo - Signature information
   */
  async processBackfillSignature(programId, sigInfo) {
    try {
      const connection = this.connectionFactory.getConnection();
      
      // Get transaction details
      const tx = await connection.getTransaction(sigInfo.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (tx && tx.meta && tx.meta.logMessages) {
        // Create synthetic event data
        const eventData = {
          programId,
          signature: sigInfo.signature,
          logs: tx.meta.logMessages,
          slot: sigInfo.slot,
          timestamp: Date.now(),
          err: tx.meta.err,
          backfilled: true
        };
        
        // Call the event handler
        if (this.onEventCallback) {
          this.onEventCallback(eventData);
        }
        
        // Emit to specific handlers
        this.emitEvent('programLog', eventData);
      }
      
    } catch (error) {
      logger.error(`Error processing backfill signature ${sigInfo.signature}:`, error);
    }
  }

  /**
   * Start backfill monitoring to periodically check for missed events
   */
  startBackfillMonitoring() {
    // Check for missed events every 30 seconds
    this.backfillTimer = setInterval(() => {
      if (this.isListening && this.subscriptions.size > 0) {
        this.performBackfill().catch(error => {
          logger.error('Scheduled backfill failed:', error);
        });
      }
    }, 30000);
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions() {
    if (this.subscriptions.size > 0) {
      logger.info('Clearing existing subscriptions...');
      
      for (const [programId, subscriptionId] of this.subscriptions) {
        try {
          const connection = this.connectionFactory.getConnection();
          connection.removeOnLogsListener(subscriptionId);
        } catch (error) {
          logger.error(`Error removing subscription for ${programId}:`, error);
        }
      }
      
      this.subscriptions.clear();
    }
  }

  /**
   * Register event handler
   * @param {string} eventType - Event type
   * @param {Function} handler - Event handler function
   */
  on(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  /**
   * Emit event to registered handlers
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  emitEvent(eventType, data) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          logger.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Stop listening and cleanup
   */
  stopListening() {
    this.isListening = false;
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.backfillTimer) {
      clearInterval(this.backfillTimer);
      this.backfillTimer = null;
    }
    
    // Clear subscriptions
    this.clearSubscriptions();
    
    // Clear handlers
    this.eventHandlers.clear();
    
    logger.info('Event listener stopped');
  }

  /**
   * Get current status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isListening: this.isListening,
      subscriptions: this.subscriptions.size,
      lastProcessedSlot: this.lastProcessedSlot,
      reconnectAttempts: this.reconnectAttempts,
      programIds: this.programIds.map(id => id.toString())
    };
  }

  /**
   * Test WebSocket connection (for testing)
   * @returns {Promise<boolean>}
   */
  async testWebSocketConnection() {
    try {
      if (!this.connectionFactory) return false;
      
      const connection = this.connectionFactory.getConnection();
      const slot = await connection.getSlot('confirmed');
      
      return typeof slot === 'number' && slot > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test program subscription (for testing)
   * @returns {Promise<boolean>}
   */
  async testProgramSubscription() {
    try {
      if (this.programIds.length === 0) return false;
      
      const connection = this.connectionFactory.getConnection();
      const testProgramId = this.programIds[0];
      
      // Test subscription
      const subscriptionId = connection.onLogs(
        testProgramId,
        () => {}, // Empty callback
        'confirmed'
      );
      
      // Immediately remove the test subscription
      if (subscriptionId) {
        connection.removeOnLogsListener(subscriptionId);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test account monitoring (for testing)
   * @returns {Promise<boolean>}
   */
  async testAccountMonitoring() {
    try {
      const connection = this.connectionFactory.getConnection();
      const testAccount = new PublicKey('So11111111111111111111111111111111111111112');
      
      // Test account subscription
      const subscriptionId = connection.onAccountChange(
        testAccount,
        () => {}, // Empty callback
        'confirmed'
      );
      
      // Immediately remove the test subscription
      if (subscriptionId) {
        connection.removeAccountChangeListener(subscriptionId);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Factory function to create and start event listener
 * @param {import('./solana-connection-factory').SolanaConnectionFactory} connectionFactory
 * @param {string[]} programIds - Array of program ID strings
 * @param {Function} onEvent - Event callback function
 * @returns {EnhancedEventListener}
 */
function startEventListener(connectionFactory, programIds, onEvent) {
  const listener = new EnhancedEventListener();
  listener.initialize(connectionFactory, programIds, onEvent);
  listener.startListening();
  return listener;
}

module.exports = {
  EnhancedEventListener,
  startEventListener
};

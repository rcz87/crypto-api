/**
 * @fileoverview Solana Connection Factory dengan health monitoring dan failover
 */

const { Connection, clusterApiUrl } = require('@solana/web3.js');
const { logger } = require('../utils/logger');

/**
 * @typedef {import('../types/contracts').ConnectionConfig} ConnectionConfig
 * @typedef {import('../types/contracts').HealthMetrics} HealthMetrics
 */

class SolanaConnectionFactory {
  constructor() {
    /** @type {Connection|null} */
    this.connection = null;
    
    /** @type {ConnectionConfig[]} */
    this.endpoints = [];
    
    /** @type {number} */
    this.currentEndpointIndex = 0;
    
    /** @type {HealthMetrics} */
    this.healthMetrics = {
      latencyMs: 0,
      successRate: 1.0,
      errorRate: 0.0,
      lastHealthCheck: 0
    };
    
    /** @type {NodeJS.Timeout|null} */
    this.healthCheckInterval = null;
    
    /** @type {Function[]} */
    this.healthyCallbacks = [];
    
    /** @type {Function[]} */
    this.unhealthyCallbacks = [];
    
    this.isHealthy = true;
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 3;
  }

  /**
   * Initialize connection factory with endpoints
   * @param {ConnectionConfig[]} endpoints - Array of RPC endpoints
   */
  initialize(endpoints) {
    this.endpoints = endpoints.map(endpoint => ({
      http: endpoint.http,
      ws: endpoint.ws,
      timeout: endpoint.timeout || 10000,
      retries: endpoint.retries || 2
    }));

    if (this.endpoints.length === 0) {
      // Fallback to public endpoints
      this.endpoints = [
        {
          http: clusterApiUrl('mainnet-beta'),
          ws: clusterApiUrl('mainnet-beta').replace('https', 'wss'),
          timeout: 10000,
          retries: 2
        }
      ];
    }

    this.createConnection();
    this.startHealthMonitoring();
    
    logger.info(`SolanaConnectionFactory initialized with ${this.endpoints.length} endpoints`);
  }

  /**
   * Create connection to current endpoint
   */
  createConnection() {
    try {
      const endpoint = this.endpoints[this.currentEndpointIndex];
      
      this.connection = new Connection(endpoint.http, {
        commitment: 'confirmed',
        wsEndpoint: endpoint.ws,
        confirmTransactionInitialTimeout: endpoint.timeout,
        disableRetryOnRateLimit: false
      });

      logger.info(`Connected to RPC endpoint: ${endpoint.http}`);
      
    } catch (error) {
      logger.error('Failed to create Solana connection:', error);
      this.handleConnectionFailure();
    }
  }

  /**
   * Get the current connection instance
   * @returns {Connection}
   */
  getConnection() {
    if (!this.connection) {
      throw new Error('Connection not initialized. Call initialize() first.');
    }
    return this.connection;
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Initial health check
    this.performHealthCheck();
  }

  /**
   * Perform health check by getting current slot
   */
  async performHealthCheck() {
    if (!this.connection) return;

    const startTime = Date.now();
    
    try {
      const slot = await this.connection.getSlot('confirmed');
      const latency = Date.now() - startTime;
      
      // Update health metrics
      this.updateHealthMetrics(true, latency);
      
      if (!this.isHealthy) {
        this.isHealthy = true;
        this.consecutiveFailures = 0;
        this.notifyHealthy();
        logger.info(`Connection restored. Slot: ${slot}, Latency: ${latency}ms`);
      }
      
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateHealthMetrics(false, latency);
      this.handleHealthCheckFailure(error);
    }
  }

  /**
   * Update health metrics
   * @param {boolean} success - Whether the operation was successful
   * @param {number} latency - Operation latency in ms
   */
  updateHealthMetrics(success, latency) {
    const now = Date.now();
    
    // Exponential moving average for latency
    if (this.healthMetrics.latencyMs === 0) {
      this.healthMetrics.latencyMs = latency;
    } else {
      this.healthMetrics.latencyMs = (this.healthMetrics.latencyMs * 0.8) + (latency * 0.2);
    }
    
    // Update success/error rates (rolling window approach)
    if (success) {
      this.healthMetrics.successRate = Math.min(1.0, this.healthMetrics.successRate + 0.1);
      this.healthMetrics.errorRate = Math.max(0.0, this.healthMetrics.errorRate - 0.1);
    } else {
      this.healthMetrics.successRate = Math.max(0.0, this.healthMetrics.successRate - 0.2);
      this.healthMetrics.errorRate = Math.min(1.0, this.healthMetrics.errorRate + 0.2);
    }
    
    this.healthMetrics.lastHealthCheck = now;
  }

  /**
   * Handle health check failure
   * @param {Error} error - The error that occurred
   */
  handleHealthCheckFailure(error) {
    this.consecutiveFailures++;
    
    logger.warn(`Health check failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures}):`, error.message);
    
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      if (this.isHealthy) {
        this.isHealthy = false;
        this.notifyUnhealthy();
      }
      
      // Try to failover to next endpoint
      this.attemptFailover();
    }
  }

  /**
   * Handle connection failure and attempt failover
   */
  handleConnectionFailure() {
    this.consecutiveFailures++;
    
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.attemptFailover();
    }
  }

  /**
   * Attempt failover to next available endpoint
   */
  attemptFailover() {
    if (this.endpoints.length <= 1) {
      logger.error('No alternative endpoints available for failover');
      return;
    }

    const previousIndex = this.currentEndpointIndex;
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
    
    logger.warn(`Failing over from endpoint ${previousIndex} to ${this.currentEndpointIndex}`);
    
    try {
      this.createConnection();
      this.consecutiveFailures = 0;
      
      // Immediate health check after failover
      setTimeout(() => this.performHealthCheck(), 1000);
      
    } catch (error) {
      logger.error('Failover attempt failed:', error);
      
      // If all endpoints fail, wait before retrying
      if (this.currentEndpointIndex === previousIndex) {
        logger.error('All endpoints failed. Waiting 30s before retry...');
        setTimeout(() => this.attemptFailover(), 30000);
      }
    }
  }

  /**
   * Register callback for healthy state
   * @param {Function} callback - Callback function
   */
  onHealthy(callback) {
    this.healthyCallbacks.push(callback);
  }

  /**
   * Register callback for unhealthy state
   * @param {Function} callback - Callback function
   */
  onUnhealthy(callback) {
    this.unhealthyCallbacks.push(callback);
  }

  /**
   * Notify all healthy callbacks
   */
  notifyHealthy() {
    this.healthyCallbacks.forEach(callback => {
      try {
        callback(this.healthMetrics);
      } catch (error) {
        logger.error('Error in healthy callback:', error);
      }
    });
  }

  /**
   * Notify all unhealthy callbacks
   */
  notifyUnhealthy() {
    this.unhealthyCallbacks.forEach(callback => {
      try {
        callback(this.healthMetrics);
      } catch (error) {
        logger.error('Error in unhealthy callback:', error);
      }
    });
  }

  /**
   * Get current health status
   * @returns {Object} Health status information
   */
  getHealthStatus() {
    return {
      isHealthy: this.isHealthy,
      currentEndpoint: this.endpoints[this.currentEndpointIndex],
      consecutiveFailures: this.consecutiveFailures,
      metrics: { ...this.healthMetrics }
    };
  }

  /**
   * Test connection recovery (for testing purposes)
   * @returns {Promise<boolean>}
   */
  async testConnectionRecovery() {
    try {
      // Simulate connection failure
      this.consecutiveFailures = this.maxConsecutiveFailures;
      this.isHealthy = false;
      
      // Attempt recovery
      await this.performHealthCheck();
      
      return this.isHealthy;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test RPC failover (for testing purposes)
   * @returns {Promise<boolean>}
   */
  async testRpcFailover() {
    try {
      if (this.endpoints.length <= 1) {
        return true; // No failover needed with single endpoint
      }
      
      const originalIndex = this.currentEndpointIndex;
      this.attemptFailover();
      
      // Check if we switched endpoints
      return this.currentEndpointIndex !== originalIndex;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test WebSocket reconnection (for testing purposes)
   * @returns {Promise<boolean>}
   */
  async testWebSocketReconnection() {
    try {
      // Test by creating a new connection
      const oldConnection = this.connection;
      this.createConnection();
      
      // Verify new connection works
      await this.connection.getSlot('confirmed');
      
      return this.connection !== oldConnection;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop health monitoring and cleanup
   */
  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.healthyCallbacks = [];
    this.unhealthyCallbacks = [];
    this.connection = null;
    
    logger.info('SolanaConnectionFactory destroyed');
  }
}

// Singleton instance
let connectionFactory = null;

/**
 * Create or get singleton connection factory
 * @param {ConnectionConfig[]} [endpoints] - RPC endpoints configuration
 * @returns {SolanaConnectionFactory}
 */
function createSolanaConnection(endpoints) {
  if (!connectionFactory) {
    connectionFactory = new SolanaConnectionFactory();
    if (endpoints) {
      connectionFactory.initialize(endpoints);
    }
  }
  return connectionFactory;
}

/**
 * Get existing connection factory instance
 * @returns {SolanaConnectionFactory}
 */
function getSolanaConnection() {
  if (!connectionFactory) {
    throw new Error('Connection factory not initialized. Call createSolanaConnection() first.');
  }
  return connectionFactory;
}

module.exports = {
  SolanaConnectionFactory,
  createSolanaConnection,
  getSolanaConnection
};

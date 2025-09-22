const { logger, logError } = require('../utils/logger');
const config = require('../config');

class CircuitBreaker {
  constructor(solanaConnection, transactionBuilder) {
    this.connection = solanaConnection.getConnection();
    this.wallet = solanaConnection.getWallet();
    this.transactionBuilder = transactionBuilder;
    
    // Circuit breaker states
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    
    // Thresholds and timeouts
    this.config = {
      failureThreshold: 3,        // Open after 3 consecutive failures
      recoveryTimeout: 60000,     // 1 minute recovery timeout
      halfOpenMaxCalls: 5,        // Max calls in half-open state
      dailyLossLimit: 1.0,        // Max 1 SOL daily loss
      latencyThreshold: 2000,     // 2 second max latency
      rpcHealthThreshold: 3,      // Max 3 RPC failures
      minDataSources: 2           // Minimum required data sources
    };
    
    // Monitoring data
    this.dailyStats = {
      totalTrades: 0,
      successfulTrades: 0,
      totalPnL: 0,
      startTime: Date.now(),
      lastReset: Date.now()
    };
    
    this.healthChecks = {
      rpcFailures: 0,
      apiFailures: new Map(),
      lastHealthCheck: Date.now(),
      activeDataSources: 0
    };
    
    this.emergencyStop = false;
    this.pauseReasons = new Set();
    
    // Start monitoring
    this.startHealthMonitoring();
  }

  // MAIN CIRCUIT BREAKER LOGIC
  async executeWithCircuitBreaker(operation, operationType = 'TRADE') {
    try {
      // Check if circuit breaker allows execution
      if (!this.canExecute(operationType)) {
        const reason = this.getBlockingReason();
        logger.warn(`🚫 Circuit breaker blocking ${operationType}: ${reason}`);
        return { success: false, reason, blocked: true };
      }
      
      const startTime = Date.now();
      
      // Execute the operation
      const result = await operation();
      
      const executionTime = Date.now() - startTime;
      
      // Check execution latency
      if (executionTime > this.config.latencyThreshold) {
        logger.warn(`⚠️ High latency detected: ${executionTime}ms`);
        this.recordLatencyIssue(executionTime);
      }
      
      // Record success
      this.recordSuccess(operationType, result, executionTime);
      
      return result;
      
    } catch (error) {
      // Record failure
      this.recordFailure(operationType, error);
      
      logError(error, `CircuitBreaker.${operationType}`);
      return { success: false, reason: error.message, error: true };
    }
  }

  canExecute(operationType) {
    // Emergency stop check
    if (this.emergencyStop) {
      return false;
    }
    
    // Daily loss limit check
    if (this.dailyStats.totalPnL < -this.config.dailyLossLimit) {
      this.pauseReasons.add('DAILY_LOSS_LIMIT');
      return false;
    }
    
    // Circuit breaker state check
    switch (this.state) {
      case 'OPEN':
        // Check if recovery timeout has passed
        if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
          this.state = 'HALF_OPEN';
          this.successCount = 0;
          logger.info('🔄 Circuit breaker moving to HALF_OPEN state');
          return true;
        }
        return false;
        
      case 'HALF_OPEN':
        // Allow limited calls in half-open state
        return this.successCount < this.config.halfOpenMaxCalls;
        
      case 'CLOSED':
      default:
        return true;
    }
  }

  getBlockingReason() {
    if (this.emergencyStop) {
      return 'Emergency stop activated';
    }
    
    if (this.pauseReasons.size > 0) {
      return Array.from(this.pauseReasons).join(', ');
    }
    
    if (this.state === 'OPEN') {
      const timeLeft = this.config.recoveryTimeout - (Date.now() - this.lastFailureTime);
      return `Circuit breaker OPEN (recovery in ${Math.ceil(timeLeft / 1000)}s)`;
    }
    
    if (this.state === 'HALF_OPEN') {
      return `Circuit breaker HALF_OPEN (${this.successCount}/${this.config.halfOpenMaxCalls} calls used)`;
    }
    
    return 'Unknown blocking reason';
  }

  recordSuccess(operationType, result, executionTime) {
    // Reset failure count on success
    this.failureCount = 0;
    this.successCount++;
    
    // Update daily stats
    this.dailyStats.successfulTrades++;
    this.dailyStats.totalTrades++;
    
    // Update PnL if it's a trade result
    if (result && result.pnl !== undefined) {
      this.dailyStats.totalPnL += result.pnl;
    }
    
    // Circuit breaker state transitions
    if (this.state === 'HALF_OPEN' && this.successCount >= this.config.halfOpenMaxCalls) {
      this.state = 'CLOSED';
      logger.info('✅ Circuit breaker recovered to CLOSED state');
    }
    
    // Clear pause reasons on success
    this.pauseReasons.clear();
    
    logger.debug(`✅ ${operationType} success recorded (${executionTime}ms)`);
  }

  recordFailure(operationType, error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Update daily stats
    this.dailyStats.totalTrades++;
    
    // Check if we should open the circuit breaker
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      logger.error(`🔴 Circuit breaker OPENED after ${this.failureCount} failures`);
    }
    
    // Categorize failure types
    this.categorizeFailure(error);
    
    logger.error(`❌ ${operationType} failure recorded (${this.failureCount}/${this.config.failureThreshold})`);
  }

  categorizeFailure(error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('rpc') || errorMessage.includes('connection')) {
      this.healthChecks.rpcFailures++;
      this.pauseReasons.add('RPC_ISSUES');
    }
    
    if (errorMessage.includes('slippage') || errorMessage.includes('price')) {
      this.pauseReasons.add('SLIPPAGE_ISSUES');
    }
    
    if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
      this.pauseReasons.add('INSUFFICIENT_FUNDS');
    }
    
    if (errorMessage.includes('timeout')) {
      this.pauseReasons.add('TIMEOUT_ISSUES');
    }
  }

  recordLatencyIssue(latency) {
    if (latency > this.config.latencyThreshold * 2) {
      this.pauseReasons.add('HIGH_LATENCY');
      logger.warn(`⚠️ Extreme latency detected: ${latency}ms`);
    }
  }

  // PRE-FLIGHT SELL TEST
  async preFlightSellTest(tokenMint, testAmount = 0.001) {
    try {
      logger.debug(`🧪 Pre-flight sell test for ${tokenMint}`);
      
      // Simulate a small sell transaction
      const route = await this.transactionBuilder.getJupiterRoute(
        tokenMint,
        'So11111111111111111111111111111111111111112', // SOL
        testAmount * 1e9, // Convert to smallest unit
        10 // Higher slippage for test
      );
      
      if (!route) {
        return { canSell: false, reason: 'No sell route available' };
      }
      
      // Build transaction but don't execute
      const transaction = await this.transactionBuilder.buildSwapTransaction(
        route,
        this.wallet.publicKey,
        { simulate: true }
      );
      
      // Simulate the transaction
      const simulation = await this.connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        return { 
          canSell: false, 
          reason: `Sell simulation failed: ${simulation.value.err}` 
        };
      }
      
      logger.debug(`✅ Pre-flight sell test passed for ${tokenMint}`);
      return { canSell: true, estimatedOutput: route.outAmount };
      
    } catch (error) {
      logError(error, 'CircuitBreaker.preFlightSellTest');
      return { 
        canSell: false, 
        reason: `Sell test error: ${error.message}` 
      };
    }
  }

  // HEALTH MONITORING
  startHealthMonitoring() {
    // Check health every 30 seconds
    setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    // Reset daily stats at midnight
    setInterval(() => {
      this.resetDailyStatsIfNeeded();
    }, 60000); // Check every minute
  }

  async performHealthCheck() {
    try {
      const healthResults = await Promise.allSettled([
        this.checkRPCHealth(),
        this.checkAPIHealth(),
        this.checkWalletBalance(),
        this.checkNetworkCongestion()
      ]);
      
      let healthyServices = 0;
      
      healthResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.healthy) {
          healthyServices++;
        }
      });
      
      this.healthChecks.activeDataSources = healthyServices;
      this.healthChecks.lastHealthCheck = Date.now();
      
      // Check if we have minimum required services
      if (healthyServices < this.config.minDataSources) {
        this.pauseReasons.add('INSUFFICIENT_DATA_SOURCES');
        logger.warn(`⚠️ Only ${healthyServices} healthy data sources available`);
      } else {
        this.pauseReasons.delete('INSUFFICIENT_DATA_SOURCES');
      }
      
      // Check RPC health threshold
      if (this.healthChecks.rpcFailures >= this.config.rpcHealthThreshold) {
        this.pauseReasons.add('RPC_UNHEALTHY');
        logger.error(`🔴 RPC health threshold exceeded: ${this.healthChecks.rpcFailures} failures`);
      }
      
    } catch (error) {
      logError(error, 'CircuitBreaker.performHealthCheck');
    }
  }

  async checkRPCHealth() {
    try {
      const startTime = Date.now();
      const slot = await this.connection.getSlot();
      const latency = Date.now() - startTime;
      
      return {
        healthy: latency < 1000 && slot > 0,
        latency,
        slot
      };
      
    } catch (error) {
      this.healthChecks.rpcFailures++;
      return { healthy: false, error: error.message };
    }
  }

  async checkAPIHealth() {
    // This would check external APIs (Jupiter, DexScreener, etc.)
    try {
      // Simplified health check
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async checkWalletBalance() {
    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      const solBalance = balance / 1e9;
      
      const isHealthy = solBalance > 0.1; // Need at least 0.1 SOL
      
      if (!isHealthy) {
        this.pauseReasons.add('LOW_SOL_BALANCE');
      } else {
        this.pauseReasons.delete('LOW_SOL_BALANCE');
      }
      
      return {
        healthy: isHealthy,
        balance: solBalance
      };
      
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async checkNetworkCongestion() {
    try {
      // Check recent block times for congestion
      const recentSlots = await this.connection.getRecentBlockhash();
      
      // Simplified congestion check
      return { healthy: true, congestion: 'LOW' };
      
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  resetDailyStatsIfNeeded() {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (now - this.dailyStats.lastReset > dayInMs) {
      logger.info('📊 Resetting daily statistics');
      
      this.dailyStats = {
        totalTrades: 0,
        successfulTrades: 0,
        totalPnL: 0,
        startTime: now,
        lastReset: now
      };
      
      // Reset some pause reasons
      this.pauseReasons.delete('DAILY_LOSS_LIMIT');
      
      // Reset RPC failure count
      this.healthChecks.rpcFailures = 0;
    }
  }

  // EMERGENCY CONTROLS
  activateEmergencyStop(reason = 'Manual activation') {
    this.emergencyStop = true;
    logger.error(`🚨 EMERGENCY STOP ACTIVATED: ${reason}`);
    
    // Log emergency stop
    this.logEmergencyEvent('EMERGENCY_STOP', reason);
  }

  deactivateEmergencyStop(reason = 'Manual deactivation') {
    this.emergencyStop = false;
    logger.info(`✅ Emergency stop deactivated: ${reason}`);
    
    // Reset circuit breaker state
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.pauseReasons.clear();
    
    this.logEmergencyEvent('EMERGENCY_STOP_DEACTIVATED', reason);
  }

  pauseTrading(reason, duration = null) {
    this.pauseReasons.add(reason);
    logger.warn(`⏸️ Trading paused: ${reason}`);
    
    if (duration) {
      setTimeout(() => {
        this.resumeTrading(reason);
      }, duration);
    }
  }

  resumeTrading(reason) {
    this.pauseReasons.delete(reason);
    logger.info(`▶️ Trading resumed: ${reason} cleared`);
  }

  logEmergencyEvent(event, reason) {
    const emergencyLog = {
      timestamp: new Date().toISOString(),
      event,
      reason,
      state: this.state,
      dailyStats: { ...this.dailyStats },
      healthChecks: { ...this.healthChecks }
    };
    
    logger.error(`🚨 EMERGENCY EVENT: ${JSON.stringify(emergencyLog)}`);
  }

  // ADAPTIVE PARAMETERS
  updateConfigBasedOnPerformance() {
    const successRate = this.dailyStats.totalTrades > 0 
      ? this.dailyStats.successfulTrades / this.dailyStats.totalTrades 
      : 1;
    
    // Adjust failure threshold based on success rate
    if (successRate < 0.7) {
      // Lower threshold if success rate is poor
      this.config.failureThreshold = Math.max(2, this.config.failureThreshold - 1);
    } else if (successRate > 0.9) {
      // Higher threshold if success rate is excellent
      this.config.failureThreshold = Math.min(5, this.config.failureThreshold + 1);
    }
    
    logger.debug(`🔧 Circuit breaker config updated: failure threshold = ${this.config.failureThreshold}`);
  }

  // STATUS AND REPORTING
  getStatus() {
    return {
      state: this.state,
      emergencyStop: this.emergencyStop,
      pauseReasons: Array.from(this.pauseReasons),
      failureCount: this.failureCount,
      successCount: this.successCount,
      dailyStats: { ...this.dailyStats },
      healthChecks: { ...this.healthChecks },
      config: { ...this.config }
    };
  }

  getDailyReport() {
    const successRate = this.dailyStats.totalTrades > 0 
      ? (this.dailyStats.successfulTrades / this.dailyStats.totalTrades * 100).toFixed(1)
      : '0';
    
    const runtime = Date.now() - this.dailyStats.startTime;
    const runtimeHours = (runtime / (1000 * 60 * 60)).toFixed(1);
    
    return {
      date: new Date().toISOString().split('T')[0],
      runtime: `${runtimeHours} hours`,
      totalTrades: this.dailyStats.totalTrades,
      successRate: `${successRate}%`,
      totalPnL: `${this.dailyStats.totalPnL.toFixed(4)} SOL`,
      circuitBreakerState: this.state,
      emergencyStops: this.emergencyStop ? 1 : 0,
      healthScore: `${this.healthChecks.activeDataSources}/${this.config.minDataSources + 2}`
    };
  }
}

module.exports = CircuitBreaker;

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const config = require('./config');
const { logger } = require('./utils/logger');
const SolanaConnection = require('./core/solana-connection');
const EventListener = require('./core/event-listener');
const TokenAnalyzer = require('./analysis/token-analyzer');
const AutoTrader = require('./trading/auto-trader');
const ApiService = require('./services/api-service');
const CircuitBreaker = require('./risk/circuit-breaker');
const FastPathExecutor = require('./execution/fast-path-executor');

class ComprehensiveTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log('🚀 STARTING COMPREHENSIVE TESTING SUITE');
    console.log('=' .repeat(60));

    try {
      // 1. Real-time Event Listener Tests
      await this.testEventListener();
      
      // 2. Live API Service Tests
      await this.testApiServices();
      
      // 3. Token Analysis with Real Data
      await this.testTokenAnalysisReal();
      
      // 4. Risk Management System
      await this.testRiskManagement();
      
      // 5. Circuit Breaker Functionality
      await this.testCircuitBreaker();
      
      // 6. Performance Testing
      await this.testPerformance();
      
      // 7. Error Handling Tests
      await this.testErrorHandling();
      
      // 8. End-to-End Trading Flow (Simulation)
      await this.testEndToEndFlow();
      
      // 9. Whale Tracking with Real Data
      await this.testWhaleTracking();
      
      // 10. Network Resilience Tests
      await this.testNetworkResilience();

    } catch (error) {
      this.logError('CRITICAL TEST FAILURE', error);
    }

    this.printFinalResults();
  }

  async testEventListener() {
    console.log('\n📡 TESTING REAL-TIME EVENT LISTENER');
    console.log('-'.repeat(40));

    try {
      const solanaConnection = new SolanaConnection();
      await solanaConnection.connect();
      
      const eventListener = new EventListener(solanaConnection);
      
      // Test 1: Connection to WebSocket
      console.log('🔍 Testing WebSocket connection...');
      const wsConnected = await this.testWithTimeout(
        () => eventListener.testWebSocketConnection(),
        5000,
        'WebSocket connection'
      );
      
      if (wsConnected) {
        this.logPass('WebSocket connection established');
      } else {
        this.logFail('WebSocket connection failed');
      }

      // Test 2: Program Log Subscription
      console.log('🔍 Testing program log subscription...');
      const subscribed = await this.testWithTimeout(
        () => eventListener.testProgramSubscription(),
        3000,
        'Program subscription'
      );
      
      if (subscribed) {
        this.logPass('Program log subscription active');
      } else {
        this.logFail('Program log subscription failed');
      }

      // Test 3: Account Change Monitoring
      console.log('🔍 Testing account change monitoring...');
      const accountMonitoring = await this.testWithTimeout(
        () => eventListener.testAccountMonitoring(),
        3000,
        'Account monitoring'
      );
      
      if (accountMonitoring) {
        this.logPass('Account change monitoring active');
      } else {
        this.logFail('Account change monitoring failed');
      }

    } catch (error) {
      this.logError('Event Listener Test', error);
    }
  }

  async testApiServices() {
    console.log('\n🌐 TESTING LIVE API SERVICES');
    console.log('-'.repeat(40));

    try {
      const apiService = new ApiService();

      // Test 1: Jupiter API
      console.log('🔍 Testing Jupiter API...');
      const jupiterTest = await this.testWithTimeout(
        () => apiService.testJupiterConnection(),
        5000,
        'Jupiter API'
      );
      
      if (jupiterTest) {
        this.logPass('Jupiter API responding');
      } else {
        this.logFail('Jupiter API not responding');
      }

      // Test 2: DexScreener API
      console.log('🔍 Testing DexScreener API...');
      const dexScreenerTest = await this.testWithTimeout(
        () => apiService.testDexScreenerConnection(),
        5000,
        'DexScreener API'
      );
      
      if (dexScreenerTest) {
        this.logPass('DexScreener API responding');
      } else {
        this.logFail('DexScreener API not responding');
      }

      // Test 3: Birdeye API
      console.log('🔍 Testing Birdeye API...');
      const birdeyeTest = await this.testWithTimeout(
        () => apiService.testBirdeyeConnection(),
        5000,
        'Birdeye API'
      );
      
      if (birdeyeTest) {
        this.logPass('Birdeye API responding');
      } else {
        this.logFail('Birdeye API not responding');
      }

      // Test 4: Rate Limiting
      console.log('🔍 Testing API rate limiting...');
      const rateLimitTest = await this.testApiRateLimit(apiService);
      
      if (rateLimitTest) {
        this.logPass('API rate limiting working');
      } else {
        this.logFail('API rate limiting issues');
      }

    } catch (error) {
      this.logError('API Services Test', error);
    }
  }

  async testTokenAnalysisReal() {
    console.log('\n🔍 TESTING TOKEN ANALYSIS WITH REAL DATA');
    console.log('-'.repeat(40));

    try {
      const tokenAnalyzer = new TokenAnalyzer();
      
      // Test dengan beberapa token real
      const testTokens = [
        'So11111111111111111111111111111111111111112', // WSOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'  // BONK
      ];

      for (const tokenAddress of testTokens) {
        console.log(`🔍 Analyzing token: ${tokenAddress.substring(0, 8)}...`);
        
        const analysis = await this.testWithTimeout(
          () => tokenAnalyzer.analyzeToken(tokenAddress),
          10000,
          `Token analysis for ${tokenAddress}`
        );
        
        if (analysis && analysis.finalScore !== undefined) {
          this.logPass(`Token analysis completed - Score: ${analysis.finalScore}/10`);
          
          // Validate analysis components
          if (analysis.liquidity && analysis.security && analysis.whale && analysis.technical) {
            this.logPass('All analysis components present');
          } else {
            this.logFail('Missing analysis components');
          }
          
        } else {
          this.logFail(`Token analysis failed for ${tokenAddress}`);
        }
        
        // Small delay between requests
        await this.sleep(1000);
      }

    } catch (error) {
      this.logError('Token Analysis Test', error);
    }
  }

  async testRiskManagement() {
    console.log('\n🛡️ TESTING RISK MANAGEMENT SYSTEM');
    console.log('-'.repeat(40));

    try {
      const autoTrader = new AutoTrader();
      
      // Test 1: Stop Loss Calculation
      console.log('🔍 Testing stop-loss calculation...');
      const stopLossTest = this.testStopLossCalculation(autoTrader);
      
      if (stopLossTest) {
        this.logPass('Stop-loss calculation working');
      } else {
        this.logFail('Stop-loss calculation failed');
      }

      // Test 2: Take Profit Calculation
      console.log('🔍 Testing take-profit calculation...');
      const takeProfitTest = this.testTakeProfitCalculation(autoTrader);
      
      if (takeProfitTest) {
        this.logPass('Take-profit calculation working');
      } else {
        this.logFail('Take-profit calculation failed');
      }

      // Test 3: Position Sizing
      console.log('🔍 Testing position sizing...');
      const positionSizeTest = this.testPositionSizing(autoTrader);
      
      if (positionSizeTest) {
        this.logPass('Position sizing working');
      } else {
        this.logFail('Position sizing failed');
      }

      // Test 4: Max Positions Limit
      console.log('🔍 Testing max positions limit...');
      const maxPositionsTest = this.testMaxPositionsLimit(autoTrader);
      
      if (maxPositionsTest) {
        this.logPass('Max positions limit enforced');
      } else {
        this.logFail('Max positions limit not working');
      }

    } catch (error) {
      this.logError('Risk Management Test', error);
    }
  }

  async testCircuitBreaker() {
    console.log('\n⚡ TESTING CIRCUIT BREAKER FUNCTIONALITY');
    console.log('-'.repeat(40));

    try {
      const circuitBreaker = new CircuitBreaker();
      
      // Test 1: Normal Operation
      console.log('🔍 Testing normal operation...');
      const normalTest = circuitBreaker.canExecute();
      
      if (normalTest) {
        this.logPass('Circuit breaker allows normal operation');
      } else {
        this.logFail('Circuit breaker blocking normal operation');
      }

      // Test 2: Failure Threshold
      console.log('🔍 Testing failure threshold...');
      
      // Simulate failures
      for (let i = 0; i < 5; i++) {
        circuitBreaker.recordFailure();
      }
      
      const afterFailures = circuitBreaker.canExecute();
      
      if (!afterFailures) {
        this.logPass('Circuit breaker triggered after failures');
      } else {
        this.logFail('Circuit breaker not triggered after failures');
      }

      // Test 3: Recovery
      console.log('🔍 Testing recovery mechanism...');
      
      // Wait for recovery period
      await this.sleep(2000);
      circuitBreaker.recordSuccess();
      
      const afterRecovery = circuitBreaker.canExecute();
      
      if (afterRecovery) {
        this.logPass('Circuit breaker recovered successfully');
      } else {
        this.logFail('Circuit breaker recovery failed');
      }

    } catch (error) {
      this.logError('Circuit Breaker Test', error);
    }
  }

  async testPerformance() {
    console.log('\n⚡ TESTING PERFORMANCE METRICS');
    console.log('-'.repeat(40));

    try {
      const tokenAnalyzer = new TokenAnalyzer();
      const performanceResults = [];

      // Test analysis speed with multiple tokens
      console.log('🔍 Testing analysis speed...');
      
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        try {
          await tokenAnalyzer.analyzeToken('So11111111111111111111111111111111111111112');
          const duration = Date.now() - startTime;
          performanceResults.push(duration);
          
        } catch (error) {
          console.log(`Analysis ${i + 1} failed:`, error.message);
        }
      }

      if (performanceResults.length > 0) {
        const avgTime = performanceResults.reduce((a, b) => a + b, 0) / performanceResults.length;
        const maxTime = Math.max(...performanceResults);
        const minTime = Math.min(...performanceResults);
        
        console.log(`📊 Performance Results:`);
        console.log(`   Average: ${avgTime.toFixed(0)}ms`);
        console.log(`   Min: ${minTime}ms`);
        console.log(`   Max: ${maxTime}ms`);
        
        if (avgTime < 5000) { // Under 5 seconds
          this.logPass(`Analysis performance acceptable (${avgTime.toFixed(0)}ms avg)`);
        } else {
          this.logFail(`Analysis too slow (${avgTime.toFixed(0)}ms avg)`);
        }
      } else {
        this.logFail('No performance data collected');
      }

    } catch (error) {
      this.logError('Performance Test', error);
    }
  }

  async testErrorHandling() {
    console.log('\n🚨 TESTING ERROR HANDLING');
    console.log('-'.repeat(40));

    try {
      const tokenAnalyzer = new TokenAnalyzer();
      
      // Test 1: Invalid Token Address
      console.log('🔍 Testing invalid token address handling...');
      
      try {
        await tokenAnalyzer.analyzeToken('invalid-address');
        this.logFail('Should have thrown error for invalid address');
      } catch (error) {
        this.logPass('Invalid address error handled correctly');
      }

      // Test 2: Network Timeout
      console.log('🔍 Testing network timeout handling...');
      
      const apiService = new ApiService();
      try {
        await apiService.testTimeoutHandling();
        this.logPass('Network timeout handled correctly');
      } catch (error) {
        if (error.message.includes('timeout')) {
          this.logPass('Timeout error handled correctly');
        } else {
          this.logFail('Unexpected error type');
        }
      }

      // Test 3: API Rate Limit
      console.log('🔍 Testing API rate limit handling...');
      
      try {
        await apiService.testRateLimitHandling();
        this.logPass('Rate limit handled correctly');
      } catch (error) {
        if (error.message.includes('rate limit')) {
          this.logPass('Rate limit error handled correctly');
        } else {
          this.logFail('Rate limit not handled properly');
        }
      }

    } catch (error) {
      this.logError('Error Handling Test', error);
    }
  }

  async testEndToEndFlow() {
    console.log('\n🔄 TESTING END-TO-END TRADING FLOW (SIMULATION)');
    console.log('-'.repeat(40));

    try {
      // Simulate complete trading flow without actual transactions
      const autoTrader = new AutoTrader();
      
      console.log('🔍 Testing token detection simulation...');
      const mockTokenData = {
        address: 'So11111111111111111111111111111111111111112',
        symbol: 'WSOL',
        name: 'Wrapped SOL'
      };
      
      // Step 1: Token Detection
      const detected = autoTrader.simulateTokenDetection(mockTokenData);
      if (detected) {
        this.logPass('Token detection simulation working');
      } else {
        this.logFail('Token detection simulation failed');
      }

      // Step 2: Analysis
      console.log('🔍 Testing analysis pipeline...');
      const analysis = await autoTrader.simulateAnalysis(mockTokenData.address);
      if (analysis && analysis.finalScore !== undefined) {
        this.logPass(`Analysis pipeline working - Score: ${analysis.finalScore}`);
      } else {
        this.logFail('Analysis pipeline failed');
      }

      // Step 3: Decision Making
      console.log('🔍 Testing decision making...');
      const decision = autoTrader.simulateDecision(analysis);
      if (decision !== undefined) {
        this.logPass(`Decision making working - Decision: ${decision ? 'BUY' : 'SKIP'}`);
      } else {
        this.logFail('Decision making failed');
      }

      // Step 4: Transaction Preparation (without execution)
      if (decision) {
        console.log('🔍 Testing transaction preparation...');
        const txPrep = autoTrader.simulateTransactionPreparation(mockTokenData.address);
        if (txPrep) {
          this.logPass('Transaction preparation working');
        } else {
          this.logFail('Transaction preparation failed');
        }
      }

      // Step 5: Position Monitoring Simulation
      console.log('🔍 Testing position monitoring...');
      const monitoring = autoTrader.simulatePositionMonitoring();
      if (monitoring) {
        this.logPass('Position monitoring simulation working');
      } else {
        this.logFail('Position monitoring simulation failed');
      }

    } catch (error) {
      this.logError('End-to-End Flow Test', error);
    }
  }

  async testWhaleTracking() {
    console.log('\n🐋 TESTING WHALE TRACKING WITH REAL DATA');
    console.log('-'.repeat(40));

    try {
      const tokenAnalyzer = new TokenAnalyzer();
      
      // Test whale tracking for known tokens
      console.log('🔍 Testing whale detection...');
      
      const whaleData = await this.testWithTimeout(
        () => tokenAnalyzer.getWhaleActivity('So11111111111111111111111111111111111111112'),
        8000,
        'Whale tracking'
      );
      
      if (whaleData) {
        this.logPass('Whale tracking data retrieved');
        
        if (whaleData.smartMoney && whaleData.whaleTransactions) {
          this.logPass('Whale data structure valid');
        } else {
          this.logFail('Whale data structure incomplete');
        }
      } else {
        this.logFail('Whale tracking failed');
      }

      // Test smart money detection
      console.log('🔍 Testing smart money detection...');
      
      const smartMoney = await this.testWithTimeout(
        () => tokenAnalyzer.detectSmartMoney('So11111111111111111111111111111111111111112'),
        5000,
        'Smart money detection'
      );
      
      if (smartMoney !== undefined) {
        this.logPass(`Smart money detection working - Found: ${smartMoney.length || 0} wallets`);
      } else {
        this.logFail('Smart money detection failed');
      }

    } catch (error) {
      this.logError('Whale Tracking Test', error);
    }
  }

  async testNetworkResilience() {
    console.log('\n🌐 TESTING NETWORK RESILIENCE');
    console.log('-'.repeat(40));

    try {
      const solanaConnection = new SolanaConnection();
      
      // Test 1: Connection Recovery
      console.log('🔍 Testing connection recovery...');
      
      const recoveryTest = await this.testWithTimeout(
        () => solanaConnection.testConnectionRecovery(),
        10000,
        'Connection recovery'
      );
      
      if (recoveryTest) {
        this.logPass('Connection recovery working');
      } else {
        this.logFail('Connection recovery failed');
      }

      // Test 2: RPC Failover
      console.log('🔍 Testing RPC failover...');
      
      const failoverTest = await this.testWithTimeout(
        () => solanaConnection.testRpcFailover(),
        8000,
        'RPC failover'
      );
      
      if (failoverTest) {
        this.logPass('RPC failover working');
      } else {
        this.logFail('RPC failover failed');
      }

      // Test 3: WebSocket Reconnection
      console.log('🔍 Testing WebSocket reconnection...');
      
      const wsReconnectTest = await this.testWithTimeout(
        () => solanaConnection.testWebSocketReconnection(),
        6000,
        'WebSocket reconnection'
      );
      
      if (wsReconnectTest) {
        this.logPass('WebSocket reconnection working');
      } else {
        this.logFail('WebSocket reconnection failed');
      }

    } catch (error) {
      this.logError('Network Resilience Test', error);
    }
  }

  // Helper Methods
  async testWithTimeout(testFunction, timeout, testName) {
    return new Promise(async (resolve) => {
      const timer = setTimeout(() => {
        console.log(`⏰ ${testName} timed out after ${timeout}ms`);
        resolve(false);
      }, timeout);

      try {
        const result = await testFunction();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        console.log(`❌ ${testName} error:`, error.message);
        resolve(false);
      }
    });
  }

  async testApiRateLimit(apiService) {
    // Test rapid API calls to check rate limiting
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(apiService.testJupiterConnection());
    }
    
    try {
      await Promise.all(promises);
      return true;
    } catch (error) {
      return error.message.includes('rate limit');
    }
  }

  testStopLossCalculation(autoTrader) {
    try {
      const entryPrice = 1.0;
      const stopLoss = autoTrader.calculateStopLoss(entryPrice);
      return stopLoss === 0.7; // 30% stop loss
    } catch (error) {
      return false;
    }
  }

  testTakeProfitCalculation(autoTrader) {
    try {
      const entryPrice = 1.0;
      const takeProfit = autoTrader.calculateTakeProfit(entryPrice);
      return takeProfit === 1.3; // 30% take profit
    } catch (error) {
      return false;
    }
  }

  testPositionSizing(autoTrader) {
    try {
      const positionSize = autoTrader.calculatePositionSize();
      return positionSize === 0.1; // 0.1 SOL per trade
    } catch (error) {
      return false;
    }
  }

  testMaxPositionsLimit(autoTrader) {
    try {
      // Simulate having max positions
      autoTrader.currentPositions = 10;
      const canTrade = autoTrader.canOpenNewPosition();
      return !canTrade; // Should not allow new positions
    } catch (error) {
      return false;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  logPass(message) {
    console.log(`✅ ${message}`);
    this.testResults.passed++;
  }

  logFail(message) {
    console.log(`❌ ${message}`);
    this.testResults.failed++;
    this.testResults.errors.push(message);
  }

  logError(context, error) {
    console.log(`🚨 ${context}: ${error.message}`);
    this.testResults.failed++;
    this.testResults.errors.push(`${context}: ${error.message}`);
  }

  printFinalResults() {
    const totalTime = Date.now() - this.startTime;
    const totalTests = this.testResults.passed + this.testResults.failed;
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 COMPREHENSIVE TESTING RESULTS');
    console.log('='.repeat(60));
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`📊 Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${((this.testResults.passed / totalTests) * 100).toFixed(1)}%`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n🚨 FAILED TESTS:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    if (this.testResults.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! System ready for deployment.');
    } else {
      console.log('\n⚠️  Some tests failed. Review and fix before deployment.');
    }
    
    console.log('='.repeat(60));
  }
}

// Run comprehensive tests
if (require.main === module) {
  const tester = new ComprehensiveTest();
  tester.runAllTests().catch(console.error);
}

module.exports = ComprehensiveTest;

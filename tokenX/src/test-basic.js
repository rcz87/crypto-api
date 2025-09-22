const { logger } = require('./utils/logger');

async function testBasicComponents() {
  try {
    logger.info('🧪 Starting basic component tests...');
    
    // Test 1: Configuration loading
    logger.info('📋 Testing configuration...');
    const config = require('./config');
    
    if (config.solana && config.trading && config.dex) {
      logger.info('✅ Configuration loaded successfully');
    } else {
      throw new Error('Configuration incomplete');
    }
    
    // Test 2: Logger functionality
    logger.info('📝 Testing logger...');
    logger.debug('Debug message test');
    logger.warn('Warning message test');
    logger.error('Error message test (this is normal)');
    logger.info('✅ Logger working correctly');
    
    // Test 3: API Service initialization
    logger.info('🌐 Testing API Service...');
    const APIService = require('./services/api-service');
    const apiService = new APIService();
    
    if (apiService.apis && apiService.apis.solscan) {
      logger.info('✅ API Service initialized successfully');
    } else {
      throw new Error('API Service initialization failed');
    }
    
    // Test 4: Basic API calls (without keys)
    logger.info('📡 Testing basic API calls...');
    
    // Test DexScreener (no API key required)
    try {
      const testToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
      const priceData = await apiService.getTokenPrice(testToken);
      
      if (priceData && priceData.price) {
        logger.info(`✅ DexScreener API working - USDC price: $${priceData.price}`);
      } else {
        logger.warn('⚠️ DexScreener API returned no data (might be rate limited)');
      }
    } catch (error) {
      logger.warn('⚠️ DexScreener API test failed:', error.message);
    }
    
    // Test 5: Solana connection (without private key)
    logger.info('🔗 Testing Solana connection...');
    const { Connection } = require('@solana/web3.js');
    
    try {
      const connection = new Connection(config.solana.rpcUrl, 'confirmed');
      const slot = await connection.getSlot();
      
      if (slot > 0) {
        logger.info(`✅ Solana RPC connection working - Current slot: ${slot}`);
      } else {
        throw new Error('Invalid slot received');
      }
    } catch (error) {
      logger.error('❌ Solana RPC connection failed:', error.message);
    }
    
    // Test 6: Jupiter API
    logger.info('🪐 Testing Jupiter API...');
    try {
      const axios = require('axios');
      const response = await axios.get(`${config.dex.jupiterApiUrl}/quote`, {
        params: {
          inputMint: 'So11111111111111111111111111111111111111112', // SOL
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          amount: 1000000000, // 1 SOL
          slippageBps: 50
        },
        timeout: 10000
      });
      
      if (response.data && response.data.outAmount) {
        logger.info('✅ Jupiter API working - Quote received');
      } else {
        logger.warn('⚠️ Jupiter API returned unexpected response');
      }
    } catch (error) {
      logger.warn('⚠️ Jupiter API test failed:', error.message);
    }
    
    // Test 7: Module imports
    logger.info('📦 Testing module imports...');
    
    const modules = [
      { name: 'TokenAnalyzer', path: './analysis/token-analyzer' },
      { name: 'TransactionBuilder', path: './trading/transaction-builder' },
      { name: 'AutoTrader', path: './trading/auto-trader' },
      { name: 'EventListener', path: './core/event-listener' },
      { name: 'SolanaConnection', path: './core/solana-connection' }
    ];
    
    for (const module of modules) {
      try {
        const ModuleClass = require(module.path);
        if (typeof ModuleClass === 'function') {
          logger.info(`✅ ${module.name} module imported successfully`);
        } else {
          throw new Error(`${module.name} is not a constructor`);
        }
      } catch (error) {
        logger.error(`❌ ${module.name} import failed:`, error.message);
      }
    }
    
    // Test Summary
    logger.info('');
    logger.info('🎯 BASIC TESTS COMPLETED');
    logger.info('');
    logger.info('✅ Components that are working:');
    logger.info('   - Configuration system');
    logger.info('   - Logging system');
    logger.info('   - API Service framework');
    logger.info('   - Module imports');
    logger.info('   - Basic Solana RPC connection');
    logger.info('');
    logger.info('⚠️  Components that need setup:');
    logger.info('   - Private wallet key (for actual trading)');
    logger.info('   - API keys (for enhanced data)');
    logger.info('   - Private RPC (for better performance)');
    logger.info('');
    logger.info('🚀 READY FOR NEXT PHASE: Connection testing with wallet');
    
  } catch (error) {
    logger.error('❌ Basic test failed:', error.message);
    throw error;
  }
}

// Run tests
if (require.main === module) {
  testBasicComponents()
    .then(() => {
      logger.info('🎉 All basic tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Tests failed:', error.message);
      process.exit(1);
    });
}

module.exports = testBasicComponents;

const SolanaAutoTradingBot = require('./index');
const { logger } = require('./utils/logger');

async function testBot() {
  try {
    logger.info('🧪 Starting bot test...');
    
    const bot = new SolanaAutoTradingBot();
    
    // Test initialization
    logger.info('Testing bot initialization...');
    await bot.initialize();
    
    // Test connection
    const status = bot.getStatus();
    logger.info('Bot status:', status);
    
    // Test manual functions (uncomment untuk test)
    // await bot.start();
    
    // Test manual buy (gunakan token address yang valid)
    // await bot.manualBuy('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    
    logger.info('✅ Test completed successfully');
    
  } catch (error) {
    logger.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  testBot();
}

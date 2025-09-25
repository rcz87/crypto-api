// API Keys Configuration
// Copy this file to api-keys.local.js and add your actual API keys

module.exports = {
  // Solscan API (Free tier available)
  solscan: {
    apiKey: process.env.SOLSCAN_API_KEY || '', // Optional for basic usage
    baseUrl: 'https://public-api.solscan.io'
  },

  // DexScreener API (Free, no key required)
  dexscreener: {
    baseUrl: 'https://api.dexscreener.com/latest'
  },

  // Birdeye API (Requires API key)
  birdeye: {
    apiKey: process.env.BIRDEYE_API_KEY || 'YOUR_BIRDEYE_API_KEY',
    baseUrl: 'https://public-api.birdeye.so/defi'
  },

  // CoinGecko API (Free tier available)
  coingecko: {
    apiKey: process.env.COINGECKO_API_KEY || '', // Optional for free tier
    baseUrl: 'https://api.coingecko.com/api/v3'
  },

  // CoinMarketCap API (Requires API key)
  coinmarketcap: {
    apiKey: process.env.COINMARKETCAP_API_KEY || 'YOUR_CMC_API_KEY',
    baseUrl: 'https://pro-api.coinmarketcap.com/v1'
  },

  // Alternative Fear & Greed Index (Free)
  fearGreed: {
    baseUrl: 'https://api.alternative.me/fng/'
  },

  // Telegram Bot (Optional for notifications)
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN',
    chatId: process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID'
  }
};

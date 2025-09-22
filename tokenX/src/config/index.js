require('dotenv').config();

const config = {
  // Solana Network
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    wsUrl: process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com',
    privateRpcUrl: process.env.PRIVATE_RPC_URL,
    privateWsUrl: process.env.PRIVATE_WS_URL,
    commitment: 'confirmed'
  },

  // Trading Settings
  trading: {
    privateKey: process.env.PRIVATE_KEY,
    tradeAmountSol: parseFloat(process.env.TRADE_AMOUNT_SOL) || 0.1,
    takeProfitPercent: parseFloat(process.env.TAKE_PROFIT_PERCENT) || 30,
    stopLossPercent: parseFloat(process.env.STOP_LOSS_PERCENT) || 30,
    minLiquiditySol: parseFloat(process.env.MIN_LIQUIDITY_SOL) || 5,
    maxSlippagePercent: parseFloat(process.env.MAX_SLIPPAGE_PERCENT) || 5,
    minScoreToBuy: parseInt(process.env.MIN_SCORE_TO_BUY) || 7,
    maxPositions: parseInt(process.env.MAX_POSITIONS) || 10
  },

  // Priority Fees
  fees: {
    basePriorityFee: parseInt(process.env.BASE_PRIORITY_FEE) || 1000,
    maxPriorityFee: parseInt(process.env.MAX_PRIORITY_FEE) || 10000,
    computeUnitLimit: parseInt(process.env.COMPUTE_UNIT_LIMIT) || 200000
  },

  // DEX Program IDs
  dex: {
    raydium: process.env.RAYDIUM_PROGRAM_ID || '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    orca: process.env.ORCA_PROGRAM_ID || '9W959DqEETiGZocYWCQPaJ6sD6MUGLiAZH6Aq7TZjTa',
    jupiterApiUrl: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6'
  },

  // Monitoring
  monitoring: {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Emergency Controls
  emergency: {
    stopTrading: process.env.EMERGENCY_STOP === 'true'
  }
};

module.exports = config;

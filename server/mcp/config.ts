/**
 * MCP Server Configuration
 * Shared configuration between Express.js API and MCP server
 * This ensures both services use the same settings without duplication
 */

import { config } from 'dotenv';

// Load environment variables
config();

export const mcpConfig = {
  // Server identification
  name: 'crypto-trading-mcp',
  version: '1.0.0',

  // API endpoints (shared with Express)
  pythonServiceUrl: process.env.PY_BASE || 'http://127.0.0.1:8000',
  nodeServiceUrl: process.env.NODE_SERVICE_URL || 'http://127.0.0.1:5000',

  // Database (shared connection)
  databaseUrl: process.env.DATABASE_URL,

  // Redis (shared cache)
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // API Keys (shared credentials)
  coinglassApiKey: process.env.COINGLASS_API_KEY,
  coinApiKey: process.env.COINAPI_KEY,
  okxApiKey: process.env.OKX_API_KEY,
  okxSecretKey: process.env.OKX_SECRET_KEY,
  okxPassphrase: process.env.OKX_PASSPHRASE,
  openaiApiKey: process.env.OPENAI_API_KEY,

  // Feature flags
  enableWhaleAlerts: process.env.ENABLE_WHALE_ALERTS === 'true',
  enableBrainOrchestrator: process.env.ENABLE_BRAIN_ORCHESTRATOR === 'true',
  enableGuardiansOfTheToken: process.env.ENABLE_GOT === 'true',

  // Timeouts
  defaultTimeout: 30000, // 30 seconds
  pythonServiceTimeout: 15000, // 15 seconds

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Supported symbols (aligned with GPT Actions)
  supportedSymbols: [
    'BTC', 'ETH', 'SOL',
    'ADA', 'AVAX', 'DOT', 'ATOM', 'NEAR', 'ALGO', 'FTM', 'LUNA', 'ONE',
    'MATIC', 'ARB', 'OP', 'LRC',
    'UNI', 'SUSHI', 'AAVE', 'COMP', 'MKR', 'SNX', 'CRV', '1INCH', 'YFI',
    'DOGE', 'SHIB', 'PEPE', 'FLOKI', 'TRUMP',
    'BNB', 'CRO', 'FTT', 'LEO',
    'XMR', 'ZEC', 'DASH',
    'LINK', 'VET', 'XLM', 'TRX', 'THETA', 'HBAR', 'ICP', 'EOS',
    'AXS', 'SAND', 'MANA', 'ENJ', 'CHZ',
    'FET', 'OCEAN', 'AGIX', 'AR', 'FIL', 'RENDER',
    'LTC', 'BCH', 'XRP', 'ETC', 'BSV', 'FLOW', 'APT', 'SUI', 'DYDX', 'GMX', 'HYPE',
    'USDT', 'USDC', 'DAI', 'BUSD'
  ],
};

export type McpConfig = typeof mcpConfig;

/**
 * @fileoverview Data contracts untuk sistem trading bot
 * Kontrak data yang dipakai lintas modul dengan JSDoc untuk IDE support
 */

/**
 * @typedef {Object} TokenSnapshot
 * @property {string} mint - Token mint address
 * @property {string} symbol - Token symbol
 * @property {number} poolLiquiditySol - Pool liquidity in SOL
 * @property {number} volume24h - 24h trading volume
 * @property {number} liqChange24hPct - 24h liquidity change percentage
 * @property {boolean} mintAuthorityNull - Whether mint authority is null
 * @property {boolean} freezeAuthorityNull - Whether freeze authority is null
 * @property {boolean} transferHookDetected - Whether transfer hook is detected
 * @property {number} topHoldersPct - Top holders percentage
 * @property {number} whaleAccumPct - Whale accumulation percentage
 * @property {number} rsi - RSI indicator value
 * @property {boolean} macdBullish - MACD bullish signal
 * @property {number} priceChangePct - Price change percentage
 * @property {number} socialBuzzScore - Social buzz score (0..1)
 * @property {number} hoursSinceLaunch - Hours since token launch
 */

/**
 * @typedef {Object} AnalysisScores
 * @property {number} liquidity - Liquidity score (0..10)
 * @property {number} security - Security score (0..10)
 * @property {number} whale - Whale activity score (0..10)
 * @property {number} technical - Technical analysis score (0..10)
 * @property {number} price - Price action score (0..10)
 * @property {number} social - Social sentiment score (0..10)
 * @property {number} finalScore - Final weighted score (0..10 + bonus)
 */

/**
 * @typedef {Object} TradeDecision
 * @property {"BUY"|"WATCH"|"SKIP"} action - Trading action to take
 * @property {string} reason - Reason for the decision
 * @property {number} score - Analysis score that led to decision
 * @property {number} sizeSol - Trade size in SOL
 */

/**
 * @typedef {Object} ExecutionResult
 * @property {boolean} ok - Whether execution was successful
 * @property {string} [signature] - Transaction signature if successful
 * @property {string} [error] - Error message if failed
 * @property {number} [slot] - Slot number when executed
 */

/**
 * @typedef {Object} ConnectionConfig
 * @property {string} http - HTTP RPC endpoint
 * @property {string} ws - WebSocket RPC endpoint
 * @property {number} [timeout] - Request timeout in ms
 * @property {number} [retries] - Number of retries
 */

/**
 * @typedef {Object} ApiConfig
 * @property {string} [dexscreenerUrl] - DexScreener API URL
 * @property {string} [jupiterUrl] - Jupiter API URL
 * @property {string} [birdeyeUrl] - Birdeye API URL
 * @property {string} [birdeyeKey] - Birdeye API key
 * @property {string} [solscanUrl] - Solscan API URL
 * @property {string} [solscanKey] - Solscan API key
 */

/**
 * @typedef {Object} TradingConfig
 * @property {number} tradeAmountSol - Amount to trade per position in SOL
 * @property {number} minScoreToBuy - Minimum score required to buy (0..10)
 * @property {number} maxPositions - Maximum concurrent positions
 * @property {number} takeProfitPct - Take profit percentage
 * @property {number} stopLossPct - Stop loss percentage
 * @property {number} priorityFeeMicro - Priority fee in micro lamports
 */

/**
 * @typedef {Object} CircuitBreakerState
 * @property {"CLOSED"|"OPEN"|"HALF_OPEN"} state - Current circuit breaker state
 * @property {number} failures - Current failure count
 * @property {number} lastFailureTime - Timestamp of last failure
 * @property {number} nextRetryTime - Timestamp when next retry is allowed
 */

/**
 * @typedef {Object} HealthMetrics
 * @property {number} latencyMs - Average latency in milliseconds
 * @property {number} successRate - Success rate (0..1)
 * @property {number} errorRate - Error rate (0..1)
 * @property {number} lastHealthCheck - Timestamp of last health check
 */

/**
 * @typedef {Object} Position
 * @property {string} mint - Token mint address
 * @property {number} entryPrice - Entry price
 * @property {number} currentPrice - Current price
 * @property {number} sizeSol - Position size in SOL
 * @property {number} entryTime - Entry timestamp
 * @property {number} takeProfitPrice - Take profit target price
 * @property {number} stopLossPrice - Stop loss target price
 * @property {"ACTIVE"|"PENDING"|"CLOSING"} status - Position status
 */

module.exports = {
  // Export types for JSDoc reference
};

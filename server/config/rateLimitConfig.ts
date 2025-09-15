/**
 * Environment Configuration for Rate Limits and Budget Allocation
 * 
 * Centralized configuration for the unified rate coordination system
 */

// Environment variables with defaults
export const RATE_LIMIT_CONFIG = {
  // Provider-specific rate limits (requests per minute)
  OKX_RATE_LIMIT: parseInt(process.env.RATE_OKX_PER_MIN || '500'),
  COINGLASS_RATE_LIMIT: parseInt(process.env.RATE_COINGLASS_PER_MIN || '100'),
  COINAPI_RATE_LIMIT: parseInt(process.env.RATE_COINAPI_PER_MIN || '90'),

  // Budget allocation percentages (must sum to 100% per provider)
  BUDGET_ALLOCATION: {
    okx: {
      realtime: parseInt(process.env.OKX_REALTIME_ALLOCATION || '40'), // 40%
      orderbook: parseInt(process.env.OKX_ORDERBOOK_ALLOCATION || '40'), // 40%
      trades: parseInt(process.env.OKX_TRADES_ALLOCATION || '20'), // 20%
    },
    coinglass: {
      scheduler: parseInt(process.env.COINGLASS_SCHEDULER_ALLOCATION || '40'), // 40%
      gpt: parseInt(process.env.COINGLASS_GPT_ALLOCATION || '30'), // 30%
      manual: parseInt(process.env.COINGLASS_MANUAL_ALLOCATION || '30'), // 30%
    },
    coinapi: {
      historical: parseInt(process.env.COINAPI_HISTORICAL_ALLOCATION || '55'), // 55%
      spot: parseInt(process.env.COINAPI_SPOT_ALLOCATION || '45'), // 45%
    }
  },

  // Monitoring and alerting thresholds
  MONITORING: {
    HEALTH_CHECK_INTERVAL_MS: parseInt(process.env.RATE_BUDGET_HEALTH_CHECK_MS || '30000'), // 30s
    LOW_BUDGET_THRESHOLD: parseFloat(process.env.RATE_BUDGET_LOW_THRESHOLD || '0.2'), // 20%
    CRITICAL_BUDGET_THRESHOLD: parseFloat(process.env.RATE_BUDGET_CRITICAL_THRESHOLD || '0.1'), // 10%
    VIOLATION_ALERT_THRESHOLD: parseInt(process.env.RATE_VIOLATIONS_ALERT_COUNT || '5'), // 5 violations
    ENABLE_RATE_LIMIT_LOGGING: process.env.ENABLE_RATE_LIMIT_LOGGING === 'true',
    ENABLE_SYMBOL_MAPPING_LOGGING: process.env.ENABLE_SYMBOL_MAPPING_LOGGING === 'true'
  },

  // System behavior settings
  SYSTEM: {
    ENABLE_RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false', // Enabled by default
    ENABLE_SYMBOL_MAPPING: process.env.ENABLE_SYMBOL_MAPPING !== 'false', // Enabled by default
    FALLBACK_ON_RATE_LIMIT: process.env.FALLBACK_ON_RATE_LIMIT === 'true', // Disabled by default
    RESET_BUDGETS_ON_STARTUP: process.env.RESET_BUDGETS_ON_STARTUP === 'true' // Disabled by default
  }
};

/**
 * Validate configuration on startup
 */
export function validateRateLimitConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate rate limits are positive numbers
  if (RATE_LIMIT_CONFIG.OKX_RATE_LIMIT <= 0) {
    errors.push('OKX rate limit must be positive');
  }
  if (RATE_LIMIT_CONFIG.COINGLASS_RATE_LIMIT <= 0) {
    errors.push('CoinGlass rate limit must be positive');
  }
  if (RATE_LIMIT_CONFIG.COINAPI_RATE_LIMIT <= 0) {
    errors.push('CoinAPI rate limit must be positive');
  }

  // Validate budget allocations sum to 100%
  const okxAllocation = Object.values(RATE_LIMIT_CONFIG.BUDGET_ALLOCATION.okx).reduce((sum, val) => sum + val, 0);
  const coinglassAllocation = Object.values(RATE_LIMIT_CONFIG.BUDGET_ALLOCATION.coinglass).reduce((sum, val) => sum + val, 0);
  const coinapiAllocation = Object.values(RATE_LIMIT_CONFIG.BUDGET_ALLOCATION.coinapi).reduce((sum, val) => sum + val, 0);

  if (okxAllocation !== 100) {
    errors.push(`OKX budget allocation must sum to 100%, currently ${okxAllocation}%`);
  }
  if (coinglassAllocation !== 100) {
    errors.push(`CoinGlass budget allocation must sum to 100%, currently ${coinglassAllocation}%`);
  }
  if (coinapiAllocation !== 100) {
    errors.push(`CoinAPI budget allocation must sum to 100%, currently ${coinapiAllocation}%`);
  }

  // Validate thresholds are between 0 and 1
  if (RATE_LIMIT_CONFIG.MONITORING.LOW_BUDGET_THRESHOLD <= 0 || RATE_LIMIT_CONFIG.MONITORING.LOW_BUDGET_THRESHOLD > 1) {
    errors.push('Low budget threshold must be between 0 and 1');
  }
  if (RATE_LIMIT_CONFIG.MONITORING.CRITICAL_BUDGET_THRESHOLD <= 0 || RATE_LIMIT_CONFIG.MONITORING.CRITICAL_BUDGET_THRESHOLD > 1) {
    errors.push('Critical budget threshold must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Log current configuration (for debugging)
 */
export function logRateLimitConfig(): void {
  console.log('[RateConfig] Current configuration:');
  console.log('  Rate Limits:', {
    okx: RATE_LIMIT_CONFIG.OKX_RATE_LIMIT,
    coinglass: RATE_LIMIT_CONFIG.COINGLASS_RATE_LIMIT,
    coinapi: RATE_LIMIT_CONFIG.COINAPI_RATE_LIMIT
  });
  console.log('  Budget Allocations:', RATE_LIMIT_CONFIG.BUDGET_ALLOCATION);
  console.log('  Monitoring:', RATE_LIMIT_CONFIG.MONITORING);
  console.log('  System:', RATE_LIMIT_CONFIG.SYSTEM);
}

// Export individual configurations for easy access
export const { 
  OKX_RATE_LIMIT, 
  COINGLASS_RATE_LIMIT, 
  COINAPI_RATE_LIMIT, 
  BUDGET_ALLOCATION,
  MONITORING,
  SYSTEM 
} = RATE_LIMIT_CONFIG;
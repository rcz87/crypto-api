/**
 * Alert Rate Limiter
 *
 * Prevents spam by limiting alert frequency per symbol and globally.
 * Ensures users get meaningful signals without notification fatigue.
 */

import { logger } from './logger';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  perSymbolCooldownMs: number;    // Min time between alerts for same symbol
  globalMaxAlertsPerMinute: number; // Max total alerts per minute
  globalMaxAlertsPerHour: number;   // Max total alerts per hour
  enableCooldown: boolean;          // Enable/disable cooldown
  enableGlobalLimits: boolean;      // Enable/disable global limits
}

const DEFAULT_CONFIG: RateLimitConfig = {
  perSymbolCooldownMs: Number(process.env.ALERT_COOLDOWN_MS || 5 * 60 * 1000), // 5 minutes
  globalMaxAlertsPerMinute: Number(process.env.MAX_ALERTS_PER_MINUTE || 10),
  globalMaxAlertsPerHour: Number(process.env.MAX_ALERTS_PER_HOUR || 100),
  enableCooldown: process.env.ENABLE_ALERT_COOLDOWN !== 'false',
  enableGlobalLimits: process.env.ENABLE_GLOBAL_LIMITS !== 'false'
};

/**
 * Alert rate limiter class
 */
export class AlertRateLimiter {
  private lastAlertTime: Map<string, number> = new Map();
  private alertHistory: number[] = []; // timestamps of recent alerts
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Check if alert should be allowed for a symbol
   *
   * @param symbol - Trading symbol
   * @param priority - Alert priority (high priority bypasses some limits)
   * @returns Object with allowed status and reason
   */
  shouldAllowAlert(
    symbol: string,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): { allowed: boolean; reason?: string; retryAfterMs?: number } {
    const now = Date.now();

    // High priority alerts bypass symbol cooldown (but not global limits)
    if (priority !== 'high' && this.config.enableCooldown) {
      const lastTime = this.lastAlertTime.get(symbol) || 0;
      const timeSinceLastAlert = now - lastTime;

      if (timeSinceLastAlert < this.config.perSymbolCooldownMs) {
        const retryAfterMs = this.config.perSymbolCooldownMs - timeSinceLastAlert;
        logger.debug('Alert cooldown active', {
          symbol,
          timeSinceLastAlert,
          cooldownPeriod: this.config.perSymbolCooldownMs,
          retryAfterMs
        });

        return {
          allowed: false,
          reason: `Cooldown active for ${symbol} (${Math.ceil(retryAfterMs / 1000)}s remaining)`,
          retryAfterMs
        };
      }
    }

    // Check global limits
    if (this.config.enableGlobalLimits) {
      // Clean old history
      this.cleanOldHistory(now);

      // Check per-minute limit
      const alertsLastMinute = this.alertHistory.filter(
        t => now - t < 60 * 1000
      ).length;

      if (alertsLastMinute >= this.config.globalMaxAlertsPerMinute) {
        logger.warn('Global per-minute alert limit reached', {
          alertsLastMinute,
          limit: this.config.globalMaxAlertsPerMinute
        });

        return {
          allowed: false,
          reason: `Global rate limit: ${alertsLastMinute}/${this.config.globalMaxAlertsPerMinute} alerts/minute`,
          retryAfterMs: 60 * 1000 // retry after a minute
        };
      }

      // Check per-hour limit
      const alertsLastHour = this.alertHistory.filter(
        t => now - t < 60 * 60 * 1000
      ).length;

      if (alertsLastHour >= this.config.globalMaxAlertsPerHour) {
        logger.warn('Global per-hour alert limit reached', {
          alertsLastHour,
          limit: this.config.globalMaxAlertsPerHour
        });

        return {
          allowed: false,
          reason: `Global rate limit: ${alertsLastHour}/${this.config.globalMaxAlertsPerHour} alerts/hour`,
          retryAfterMs: 60 * 60 * 1000 // retry after an hour
        };
      }
    }

    // All checks passed
    return { allowed: true };
  }

  /**
   * Record that an alert was sent
   *
   * @param symbol - Trading symbol
   */
  recordAlert(symbol: string): void {
    const now = Date.now();

    // Update symbol-specific timestamp
    this.lastAlertTime.set(symbol, now);

    // Add to global history
    this.alertHistory.push(now);

    logger.debug('Alert recorded', {
      symbol,
      totalAlertsLastHour: this.alertHistory.filter(t => now - t < 60 * 60 * 1000).length,
      totalAlertsLastMinute: this.alertHistory.filter(t => now - t < 60 * 1000).length
    });
  }

  /**
   * Reset cooldown for a symbol (admin/manual override)
   *
   * @param symbol - Trading symbol
   */
  resetSymbolCooldown(symbol: string): void {
    this.lastAlertTime.delete(symbol);
    logger.info('Cooldown reset for symbol', { symbol });
  }

  /**
   * Reset all rate limits (admin/manual override)
   */
  resetAll(): void {
    this.lastAlertTime.clear();
    this.alertHistory = [];
    logger.info('All rate limits reset');
  }

  /**
   * Get current statistics
   */
  getStats(): {
    symbolsInCooldown: number;
    alertsLastMinute: number;
    alertsLastHour: number;
    totalSymbolsTracked: number;
  } {
    const now = Date.now();

    const symbolsInCooldown = Array.from(this.lastAlertTime.entries())
      .filter(([_, time]) => now - time < this.config.perSymbolCooldownMs)
      .length;

    return {
      symbolsInCooldown,
      alertsLastMinute: this.alertHistory.filter(t => now - t < 60 * 1000).length,
      alertsLastHour: this.alertHistory.filter(t => now - t < 60 * 60 * 1000).length,
      totalSymbolsTracked: this.lastAlertTime.size
    };
  }

  /**
   * Get cooldown status for a specific symbol
   */
  getSymbolStatus(symbol: string): {
    inCooldown: boolean;
    lastAlertTime: Date | null;
    nextAvailableTime: Date | null;
    remainingCooldownMs: number;
  } {
    const now = Date.now();
    const lastTime = this.lastAlertTime.get(symbol);

    if (!lastTime) {
      return {
        inCooldown: false,
        lastAlertTime: null,
        nextAvailableTime: null,
        remainingCooldownMs: 0
      };
    }

    const timeSinceLastAlert = now - lastTime;
    const inCooldown = timeSinceLastAlert < this.config.perSymbolCooldownMs;
    const remainingCooldownMs = inCooldown
      ? this.config.perSymbolCooldownMs - timeSinceLastAlert
      : 0;

    return {
      inCooldown,
      lastAlertTime: new Date(lastTime),
      nextAvailableTime: inCooldown
        ? new Date(lastTime + this.config.perSymbolCooldownMs)
        : null,
      remainingCooldownMs
    };
  }

  /**
   * Clean old history to prevent memory leaks
   */
  private cleanOldHistory(now: number): void {
    const oneHourAgo = now - 60 * 60 * 1000;
    this.alertHistory = this.alertHistory.filter(t => t > oneHourAgo);

    // Also clean very old symbol timestamps (older than 24 hours)
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    for (const [symbol, time] of this.lastAlertTime.entries()) {
      if (time < oneDayAgo) {
        this.lastAlertTime.delete(symbol);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Rate limiter configuration updated', this.config);
  }
}

// Export singleton instance
export const rateLimiter = new AlertRateLimiter();

/**
 * Helper function to format cooldown time
 */
export function formatCooldownTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60 * 1000) return `${Math.ceil(ms / 1000)}s`;
  if (ms < 60 * 60 * 1000) return `${Math.ceil(ms / (60 * 1000))}m`;
  return `${Math.ceil(ms / (60 * 60 * 1000))}h`;
}

/**
 * Middleware function for alert systems
 */
export async function checkRateLimit(
  symbol: string,
  priority: 'low' | 'medium' | 'high' = 'medium'
): Promise<{ allowed: boolean; reason?: string }> {
  const check = rateLimiter.shouldAllowAlert(symbol, priority);

  if (!check.allowed) {
    logger.info('Alert rate limited', {
      symbol,
      priority,
      reason: check.reason,
      retryAfter: check.retryAfterMs ? formatCooldownTime(check.retryAfterMs) : undefined
    });
  }

  return check;
}

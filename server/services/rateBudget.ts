/**
 * Rate Budget Coordination System
 * 
 * Prevents API conflicts and 429 errors by coordinating rate limits
 * across OKX, CoinGlass, and CoinAPI providers with intelligent budget allocation.
 */

import { EventEmitter } from 'events';

export type Provider = 'okx' | 'coinglass' | 'coinapi';
export type UseCase = 'scheduler' | 'gpt' | 'manual' | 'realtime' | 'orderbook' | 'trades' | 'historical' | 'spot';

export interface RateLimit {
  total: number;           // Total requests per minute for provider
  window: number;          // Window size in milliseconds (default: 60000ms)
  allocation: Record<UseCase, number>; // Budget allocation per use case
}

export interface RateBudgetConfig {
  coinglass: RateLimit;
  okx: RateLimit;
  coinapi: RateLimit;
}

export interface BudgetStatus {
  provider: Provider;
  useCase: UseCase;
  used: number;
  allocated: number;
  remaining: number;
  windowEnd: number;
  resetIn: number; // milliseconds until reset
}

export interface RateLimitViolation {
  provider: Provider;
  useCase: UseCase;
  requestedQuota: number;
  availableQuota: number;
  timestamp: number;
  windowEnd: number;
}

/**
 * Sliding window rate tracker for individual buckets
 */
class SlidingWindowTracker {
  private requests: number[] = [];
  private windowSizeMs: number;
  private maxRequests: number;

  constructor(maxRequests: number, windowSizeMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSizeMs;
  }

  /**
   * Check if we can consume N requests without exceeding the limit
   */
  canConsume(count: number = 1): boolean {
    this.cleanup();
    return (this.requests.length + count) <= this.maxRequests;
  }

  /**
   * Consume N requests from the budget
   */
  consume(count: number = 1): boolean {
    if (!this.canConsume(count)) {
      return false;
    }

    const now = Date.now();
    for (let i = 0; i < count; i++) {
      this.requests.push(now);
    }
    
    return true;
  }

  /**
   * Get current usage statistics
   */
  getStats(): { used: number; remaining: number; windowEnd: number; resetIn: number } {
    this.cleanup();
    const now = Date.now();
    const windowEnd = now + this.windowSizeMs;
    
    return {
      used: this.requests.length,
      remaining: this.maxRequests - this.requests.length,
      windowEnd,
      resetIn: this.requests.length > 0 ? 
        Math.max(0, (this.requests[0] + this.windowSizeMs) - now) : 0
    };
  }

  /**
   * Reset the tracker (clear all requests)
   */
  reset(): void {
    this.requests = [];
  }

  /**
   * Remove requests outside the current window
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowSizeMs;
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);
  }
}

/**
 * Main Rate Budget Manager
 */
export class RateBudgetManager extends EventEmitter {
  private config: RateBudgetConfig;
  private trackers: Map<string, SlidingWindowTracker> = new Map();
  private violations: RateLimitViolation[] = [];
  private maxViolationHistory = 1000;

  constructor(config?: Partial<RateBudgetConfig>) {
    super();
    this.config = {
      // CoinGlass rate limits: total=100/min
      coinglass: {
        total: parseInt(process.env.RATE_COINGLASS_PER_MIN || '100'),
        window: 60000, // 1 minute
        allocation: {
          scheduler: 40,  // 40% for scheduled tasks
          gpt: 30,       // 30% for GPT Actions
          manual: 30,    // 30% for manual requests
          realtime: 0,
          orderbook: 0,
          trades: 0,
          historical: 0,
          spot: 0
        }
      },
      
      // OKX rate limits: total=500/min
      okx: {
        total: parseInt(process.env.RATE_OKX_PER_MIN || '500'),
        window: 60000,
        allocation: {
          realtime: 200,   // 40% for real-time data
          orderbook: 200,  // 40% for orderbook data
          trades: 100,     // 20% for trade data
          scheduler: 0,
          gpt: 0,
          manual: 0,
          historical: 0,
          spot: 0
        }
      },
      
      // CoinAPI rate limits: total=90/min
      coinapi: {
        total: parseInt(process.env.RATE_COINAPI_PER_MIN || '90'),
        window: 60000,
        allocation: {
          historical: 50,  // 55% for historical data
          spot: 40,        // 45% for spot data
          scheduler: 0,
          gpt: 0,
          manual: 0,
          realtime: 0,
          orderbook: 0,
          trades: 0
        }
      },
      
      // Merge with user-provided config
      ...config
    };

    // Initialize trackers for each provider/use case combination
    this.initializeTrackers();

    // Set up periodic cleanup
    setInterval(() => this.cleanupViolations(), 300000); // 5 minutes
    
    console.log('[RateBudget] Manager initialized with config:', this.getConfigSummary());
  }

  /**
   * Check if quota is available for a request
   */
  checkQuota(provider: Provider, useCase: UseCase, count: number = 1): {
    available: boolean;
    status: BudgetStatus;
    violation?: RateLimitViolation;
  } {
    const key = this.getTrackerKey(provider, useCase);
    const tracker = this.trackers.get(key);
    
    if (!tracker) {
      const error = new Error(`[RateBudget] No tracker found for ${provider}:${useCase}`);
      console.error(error.message);
      return {
        available: false,
        status: this.getEmptyStatus(provider, useCase),
        violation: {
          provider,
          useCase,
          requestedQuota: count,
          availableQuota: 0,
          timestamp: Date.now(),
          windowEnd: Date.now() + 60000
        }
      };
    }

    const available = tracker.canConsume(count);
    const stats = tracker.getStats();
    const allocation = this.config[provider].allocation[useCase];

    const status: BudgetStatus = {
      provider,
      useCase,
      used: stats.used,
      allocated: allocation,
      remaining: stats.remaining,
      windowEnd: stats.windowEnd,
      resetIn: stats.resetIn
    };

    let violation: RateLimitViolation | undefined;
    
    if (!available) {
      violation = {
        provider,
        useCase,
        requestedQuota: count,
        availableQuota: stats.remaining,
        timestamp: Date.now(),
        windowEnd: stats.windowEnd
      };

      this.violations.push(violation);
      this.emit('rateLimitViolation', violation);
      
      console.warn(`[RateBudget] Rate limit violation: ${provider}:${useCase} requested=${count} available=${stats.remaining}`);
    }

    return { available, status, violation };
  }

  /**
   * Consume quota for a request
   */
  consumeQuota(provider: Provider, useCase: UseCase, count: number = 1): {
    success: boolean;
    status: BudgetStatus;
    violation?: RateLimitViolation;
  } {
    const checkResult = this.checkQuota(provider, useCase, count);
    
    if (!checkResult.available) {
      return {
        success: false,
        status: checkResult.status,
        violation: checkResult.violation
      };
    }

    const key = this.getTrackerKey(provider, useCase);
    const tracker = this.trackers.get(key);
    
    if (!tracker) {
      return {
        success: false,
        status: checkResult.status
      };
    }

    const consumed = tracker.consume(count);
    const stats = tracker.getStats();
    const allocation = this.config[provider].allocation[useCase];

    const status: BudgetStatus = {
      provider,
      useCase,
      used: stats.used,
      allocated: allocation,
      remaining: stats.remaining,
      windowEnd: stats.windowEnd,
      resetIn: stats.resetIn
    };

    if (consumed) {
      this.emit('quotaConsumed', { provider, useCase, count, status });
    }

    return { success: consumed, status };
  }

  /**
   * Get current budget status for a specific provider/use case
   */
  getBudgetStatus(provider: Provider, useCase: UseCase): BudgetStatus {
    const key = this.getTrackerKey(provider, useCase);
    const tracker = this.trackers.get(key);
    
    if (!tracker) {
      return this.getEmptyStatus(provider, useCase);
    }

    const stats = tracker.getStats();
    const allocation = this.config[provider].allocation[useCase];

    return {
      provider,
      useCase,
      used: stats.used,
      allocated: allocation,
      remaining: stats.remaining,
      windowEnd: stats.windowEnd,
      resetIn: stats.resetIn
    };
  }

  /**
   * Get budget status for all provider/use case combinations
   */
  getAllBudgetStatus(): BudgetStatus[] {
    const results: BudgetStatus[] = [];

    Object.entries(this.config).forEach(([provider, config]) => {
      Object.entries(config.allocation).forEach(([useCase, allocation]) => {
        if (allocation > 0) { // Only include active allocations
          results.push(this.getBudgetStatus(provider as Provider, useCase as UseCase));
        }
      });
    });

    return results;
  }

  /**
   * Reset all budgets (useful for testing or emergency resets)
   */
  resetAllBudgets(): void {
    this.trackers.forEach(tracker => tracker.reset());
    this.violations = [];
    this.emit('budgetsReset');
    console.log('[RateBudget] All budgets reset');
  }

  /**
   * Reset budget for specific provider/use case
   */
  resetBudget(provider: Provider, useCase: UseCase): void {
    const key = this.getTrackerKey(provider, useCase);
    const tracker = this.trackers.get(key);
    
    if (tracker) {
      tracker.reset();
      this.emit('budgetReset', { provider, useCase });
      console.log(`[RateBudget] Budget reset for ${provider}:${useCase}`);
    }
  }

  /**
   * Get recent rate limit violations
   */
  getRecentViolations(limit: number = 50): RateLimitViolation[] {
    return this.violations.slice(-limit);
  }

  /**
   * Get rate limiting statistics
   */
  getStats(): {
    totalAllocated: Record<Provider, number>;
    totalUsed: Record<Provider, number>;
    violationsLast24h: number;
    healthScore: number; // 0-100, 100 = healthy
  } {
    const totalAllocated: Record<Provider, number> = {
      okx: this.config.okx.total,
      coinglass: this.config.coinglass.total,
      coinapi: this.config.coinapi.total
    };

    const totalUsed: Record<Provider, number> = {
      okx: 0,
      coinglass: 0,
      coinapi: 0
    };

    // Calculate total usage per provider
    Object.entries(this.config).forEach(([provider, config]) => {
      Object.entries(config.allocation).forEach(([useCase, allocation]) => {
        if (allocation > 0) {
          const status = this.getBudgetStatus(provider as Provider, useCase as UseCase);
          totalUsed[provider as Provider] += status.used;
        }
      });
    });

    // Count violations in last 24 hours
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    const violationsLast24h = this.violations.filter(v => v.timestamp > twentyFourHoursAgo).length;

    // Calculate health score (lower is better for violations, higher usage = lower health)
    const averageUsage = Object.entries(totalUsed).reduce((sum, [provider, used]) => {
      return sum + (used / totalAllocated[provider as Provider]);
    }, 0) / 3;

    const healthScore = Math.max(0, Math.min(100, 
      100 - (averageUsage * 100) - (violationsLast24h * 2)
    ));

    return {
      totalAllocated,
      totalUsed,
      violationsLast24h,
      healthScore
    };
  }

  /**
   * Get configuration summary for logging
   */
  private getConfigSummary(): Record<Provider, { total: number; allocations: number }> {
    const summary: any = {};
    
    Object.entries(this.config).forEach(([provider, config]) => {
      const totalAllocated = Object.values(config.allocation).reduce((sum, val) => sum + val, 0);
      summary[provider] = {
        total: config.total,
        allocations: totalAllocated
      };
    });

    return summary;
  }

  /**
   * Initialize trackers for all provider/use case combinations
   */
  private initializeTrackers(): void {
    Object.entries(this.config).forEach(([provider, config]) => {
      Object.entries(config.allocation).forEach(([useCase, allocation]) => {
        if (allocation > 0) { // Only create trackers for active allocations
          const key = this.getTrackerKey(provider as Provider, useCase as UseCase);
          const tracker = new SlidingWindowTracker(allocation, config.window);
          this.trackers.set(key, tracker);
        }
      });
    });

    console.log(`[RateBudget] Initialized ${this.trackers.size} rate trackers`);
  }

  /**
   * Generate tracker key for provider/use case combination
   */
  private getTrackerKey(provider: Provider, useCase: UseCase): string {
    return `${provider}:${useCase}`;
  }

  /**
   * Get empty status for error cases
   */
  private getEmptyStatus(provider: Provider, useCase: UseCase): BudgetStatus {
    return {
      provider,
      useCase,
      used: 0,
      allocated: 0,
      remaining: 0,
      windowEnd: Date.now() + 60000,
      resetIn: 0
    };
  }

  /**
   * Clean up old violations to prevent memory leaks
   */
  private cleanupViolations(): void {
    if (this.violations.length > this.maxViolationHistory) {
      this.violations = this.violations.slice(-this.maxViolationHistory / 2);
      console.log(`[RateBudget] Cleaned up violations, kept ${this.violations.length}`);
    }
  }
}

// Global rate budget manager instance
let globalRateBudgetManager: RateBudgetManager | null = null;

/**
 * Get or create the global rate budget manager instance
 */
export function getRateBudgetManager(): RateBudgetManager {
  if (!globalRateBudgetManager) {
    globalRateBudgetManager = new RateBudgetManager();
    
    // Set up global error handling
    globalRateBudgetManager.on('rateLimitViolation', (violation: RateLimitViolation) => {
      console.warn(`[RateBudget] VIOLATION: ${violation.provider}:${violation.useCase} - requested=${violation.requestedQuota}, available=${violation.availableQuota}`);
    });

    globalRateBudgetManager.on('quotaConsumed', ({ provider, useCase, count }: any) => {
      console.log(`[RateBudget] CONSUMED: ${provider}:${useCase} - count=${count}`);
    });
  }

  return globalRateBudgetManager;
}

/**
 * Convenience functions for common operations
 */
export function checkQuota(provider: Provider, useCase: UseCase, count: number = 1) {
  return getRateBudgetManager().checkQuota(provider, useCase, count);
}

export function consumeQuota(provider: Provider, useCase: UseCase, count: number = 1) {
  return getRateBudgetManager().consumeQuota(provider, useCase, count);
}

export function getBudgetStatus(provider: Provider, useCase: UseCase) {
  return getRateBudgetManager().getBudgetStatus(provider, useCase);
}

export function getAllBudgetStatus() {
  return getRateBudgetManager().getAllBudgetStatus();
}

export function resetBudgets() {
  return getRateBudgetManager().resetAllBudgets();
}

// Export types for external usage
export type { Provider, UseCase, RateLimit, RateBudgetConfig, BudgetStatus, RateLimitViolation };
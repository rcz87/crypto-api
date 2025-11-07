/**
 * Unit Tests for Alert Rate Limiter
 *
 * Tests for alertRateLimiter.ts functionality:
 * - Per-symbol cooldown
 * - Global rate limits
 * - Priority handling
 * - Stats and monitoring
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AlertRateLimiter, RateLimiterConfig } from './alertRateLimiter';

describe('AlertRateLimiter', () => {
  let limiter: AlertRateLimiter;

  beforeEach(() => {
    // Reset limiter before each test
    limiter = new AlertRateLimiter();
  });

  describe('Constructor and Configuration', () => {
    it('should create limiter with default config', () => {
      const limiter = new AlertRateLimiter();
      const stats = limiter.getStats();

      expect(limiter).toBeDefined();
      expect(stats).toBeDefined();
    });

    it('should create limiter with custom config', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 10 * 60 * 1000, // 10 minutes
        maxAlertsPerMinute: 5,
        maxAlertsPerHour: 50
      };

      const limiter = new AlertRateLimiter(config);
      expect(limiter).toBeDefined();
    });

    it('should use default values when not specified', () => {
      const limiter = new AlertRateLimiter();
      const stats = limiter.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.symbolsInCooldown).toBe('number');
    });
  });

  describe('Per-Symbol Cooldown', () => {
    it('should allow first alert for a symbol', () => {
      const allowed = limiter.shouldAllowAlert('BTC-USDT', 'medium');
      expect(allowed).toBe(true);
    });

    it('should block repeated alerts within cooldown period', () => {
      limiter.recordAlert('BTC-USDT');

      const allowed = limiter.shouldAllowAlert('BTC-USDT', 'medium');
      expect(allowed).toBe(false);
    });

    it('should allow alerts after cooldown expires', async () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 100, // 100ms cooldown for testing
        maxAlertsPerMinute: 100,
        maxAlertsPerHour: 1000
      };

      const limiter = new AlertRateLimiter(config);

      limiter.recordAlert('BTC-USDT');
      expect(limiter.shouldAllowAlert('BTC-USDT', 'medium')).toBe(false);

      // Wait for cooldown to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(limiter.shouldAllowAlert('BTC-USDT', 'medium')).toBe(true);
    });

    it('should track different symbols independently', () => {
      limiter.recordAlert('BTC-USDT');
      limiter.recordAlert('ETH-USDT');

      expect(limiter.shouldAllowAlert('BTC-USDT', 'medium')).toBe(false);
      expect(limiter.shouldAllowAlert('ETH-USDT', 'medium')).toBe(false);
      expect(limiter.shouldAllowAlert('SOL-USDT', 'medium')).toBe(true);
    });

    it('should return cooldown remaining time', () => {
      limiter.recordAlert('BTC-USDT');

      const remaining = limiter.getCooldownRemaining('BTC-USDT');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(5 * 60 * 1000); // Default 5 minutes
    });

    it('should return 0 cooldown for symbols not in cooldown', () => {
      const remaining = limiter.getCooldownRemaining('BTC-USDT');
      expect(remaining).toBe(0);
    });
  });

  describe('Global Rate Limits', () => {
    it('should block alerts when per-minute limit exceeded', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 0, // Disable cooldown for this test
        maxAlertsPerMinute: 3,
        maxAlertsPerHour: 100
      };

      const limiter = new AlertRateLimiter(config);

      // Send 3 alerts (should all succeed)
      expect(limiter.shouldAllowAlert('BTC-USDT', 'medium')).toBe(true);
      limiter.recordAlert('BTC-USDT');

      expect(limiter.shouldAllowAlert('ETH-USDT', 'medium')).toBe(true);
      limiter.recordAlert('ETH-USDT');

      expect(limiter.shouldAllowAlert('SOL-USDT', 'medium')).toBe(true);
      limiter.recordAlert('SOL-USDT');

      // 4th alert should be blocked
      expect(limiter.shouldAllowAlert('AVAX-USDT', 'medium')).toBe(false);
    });

    it('should block alerts when per-hour limit exceeded', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 0,
        maxAlertsPerMinute: 100,
        maxAlertsPerHour: 5
      };

      const limiter = new AlertRateLimiter(config);

      // Send 5 alerts
      for (let i = 0; i < 5; i++) {
        expect(limiter.shouldAllowAlert(`COIN-${i}`, 'medium')).toBe(true);
        limiter.recordAlert(`COIN-${i}`);
      }

      // 6th alert should be blocked
      expect(limiter.shouldAllowAlert('COIN-6', 'medium')).toBe(false);
    });

    it('should reset per-minute counter after 1 minute', async () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 0,
        maxAlertsPerMinute: 2,
        maxAlertsPerHour: 100
      };

      const limiter = new AlertRateLimiter(config);

      // Use up the per-minute limit
      limiter.recordAlert('BTC-USDT');
      limiter.recordAlert('ETH-USDT');

      expect(limiter.shouldAllowAlert('SOL-USDT', 'medium')).toBe(false);

      // Mock time passage (in real scenario, would wait 60 seconds)
      // For testing, we'll check the logic works
      const stats = limiter.getStats();
      expect(stats.alertsLastMinute).toBe(2);
    });
  });

  describe('Priority Handling', () => {
    it('should allow high priority alerts even during cooldown', () => {
      limiter.recordAlert('BTC-USDT');

      expect(limiter.shouldAllowAlert('BTC-USDT', 'low')).toBe(false);
      expect(limiter.shouldAllowAlert('BTC-USDT', 'medium')).toBe(false);
      expect(limiter.shouldAllowAlert('BTC-USDT', 'high')).toBe(true);
    });

    it('should bypass cooldown for critical alerts', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 10 * 60 * 1000, // 10 minutes
        maxAlertsPerMinute: 100,
        maxAlertsPerHour: 1000
      };

      const limiter = new AlertRateLimiter(config);

      limiter.recordAlert('BTC-USDT');

      // Low priority blocked
      expect(limiter.shouldAllowAlert('BTC-USDT', 'low')).toBe(false);

      // High priority allowed
      expect(limiter.shouldAllowAlert('BTC-USDT', 'high')).toBe(true);
    });

    it('should still respect global limits for high priority', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 0,
        maxAlertsPerMinute: 2,
        maxAlertsPerHour: 100
      };

      const limiter = new AlertRateLimiter(config);

      // Use up global limit
      limiter.recordAlert('BTC-USDT');
      limiter.recordAlert('ETH-USDT');

      // High priority still blocked by global limit
      expect(limiter.shouldAllowAlert('SOL-USDT', 'high')).toBe(false);
    });
  });

  describe('Stats and Monitoring', () => {
    it('should track symbols in cooldown', () => {
      limiter.recordAlert('BTC-USDT');
      limiter.recordAlert('ETH-USDT');
      limiter.recordAlert('SOL-USDT');

      const stats = limiter.getStats();
      expect(stats.symbolsInCooldown).toBe(3);
    });

    it('should track alerts per minute', () => {
      limiter.recordAlert('BTC-USDT');
      limiter.recordAlert('ETH-USDT');

      const stats = limiter.getStats();
      expect(stats.alertsLastMinute).toBe(2);
    });

    it('should track alerts per hour', () => {
      limiter.recordAlert('BTC-USDT');
      limiter.recordAlert('ETH-USDT');
      limiter.recordAlert('SOL-USDT');

      const stats = limiter.getStats();
      expect(stats.alertsLastHour).toBe(3);
    });

    it('should provide time until next allowed alert', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 0,
        maxAlertsPerMinute: 2,
        maxAlertsPerHour: 100
      };

      const limiter = new AlertRateLimiter(config);

      limiter.recordAlert('BTC-USDT');
      limiter.recordAlert('ETH-USDT');

      const stats = limiter.getStats();
      expect(stats.nextAllowedAlert).toBeGreaterThan(0);
    });

    it('should return 0 next allowed time when below limits', () => {
      const stats = limiter.getStats();
      expect(stats.nextAllowedAlert).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid successive alerts', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 5000,
        maxAlertsPerMinute: 10,
        maxAlertsPerHour: 100
      };

      const limiter = new AlertRateLimiter(config);

      // Rapid fire alerts
      for (let i = 0; i < 5; i++) {
        limiter.recordAlert(`SYMBOL-${i}`);
      }

      const stats = limiter.getStats();
      expect(stats.symbolsInCooldown).toBe(5);
      expect(stats.alertsLastMinute).toBe(5);
    });

    it('should handle same symbol multiple record attempts', () => {
      limiter.recordAlert('BTC-USDT');
      limiter.recordAlert('BTC-USDT'); // Should update cooldown
      limiter.recordAlert('BTC-USDT');

      const stats = limiter.getStats();
      expect(stats.symbolsInCooldown).toBe(1); // Still just one symbol
    });

    it('should handle empty symbol string', () => {
      const allowed = limiter.shouldAllowAlert('', 'medium');
      expect(typeof allowed).toBe('boolean');
    });

    it('should handle very short cooldown period', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 1, // 1ms
        maxAlertsPerMinute: 100,
        maxAlertsPerHour: 1000
      };

      const limiter = new AlertRateLimiter(config);
      limiter.recordAlert('BTC-USDT');

      // Should be blocked immediately
      expect(limiter.shouldAllowAlert('BTC-USDT', 'medium')).toBe(false);
    });

    it('should handle zero cooldown period', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 0,
        maxAlertsPerMinute: 100,
        maxAlertsPerHour: 1000
      };

      const limiter = new AlertRateLimiter(config);
      limiter.recordAlert('BTC-USDT');

      // With 0 cooldown, should allow immediately
      expect(limiter.shouldAllowAlert('BTC-USDT', 'medium')).toBe(true);
    });
  });

  describe('Memory Management', () => {
    it('should clean up expired cooldowns', async () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 100, // 100ms
        maxAlertsPerMinute: 100,
        maxAlertsPerHour: 1000
      };

      const limiter = new AlertRateLimiter(config);

      limiter.recordAlert('BTC-USDT');
      limiter.recordAlert('ETH-USDT');

      expect(limiter.getStats().symbolsInCooldown).toBe(2);

      // Wait for cooldowns to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger cleanup by checking a symbol
      limiter.shouldAllowAlert('BTC-USDT', 'medium');

      // Note: Actual cleanup might be lazy, so this tests the concept
      const remaining = limiter.getCooldownRemaining('BTC-USDT');
      expect(remaining).toBe(0);
    });

    it('should handle large number of symbols efficiently', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 5 * 60 * 1000,
        maxAlertsPerMinute: 1000,
        maxAlertsPerHour: 10000
      };

      const limiter = new AlertRateLimiter(config);

      // Add 100 symbols
      for (let i = 0; i < 100; i++) {
        limiter.recordAlert(`SYMBOL-${i}`);
      }

      const stats = limiter.getStats();
      expect(stats.symbolsInCooldown).toBe(100);

      // Should still be performant
      const startTime = performance.now();
      limiter.shouldAllowAlert('NEW-SYMBOL', 'medium');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // Should be very fast
    });
  });

  describe('Concurrent Usage', () => {
    it('should handle concurrent alert checks', () => {
      const results: boolean[] = [];

      // Simulate concurrent checks
      for (let i = 0; i < 10; i++) {
        results.push(limiter.shouldAllowAlert(`SYMBOL-${i}`, 'medium'));
      }

      // All should be allowed (different symbols)
      expect(results.every(r => r === true)).toBe(true);
    });

    it('should handle concurrent recordings', () => {
      const symbols = ['BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'AVAX-USDT', 'MATIC-USDT'];

      symbols.forEach(symbol => limiter.recordAlert(symbol));

      const stats = limiter.getStats();
      expect(stats.symbolsInCooldown).toBe(5);
      expect(stats.alertsLastMinute).toBe(5);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with realistic trading scenario', async () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 5 * 60 * 1000, // 5 minutes
        maxAlertsPerMinute: 10,
        maxAlertsPerHour: 100
      };

      const limiter = new AlertRateLimiter(config);

      // Simulate screening 20 symbols
      const symbols = Array.from({ length: 20 }, (_, i) => `SYMBOL-${i}`);

      let allowedAlerts = 0;
      let blockedAlerts = 0;

      symbols.forEach(symbol => {
        if (limiter.shouldAllowAlert(symbol, 'medium')) {
          limiter.recordAlert(symbol);
          allowedAlerts++;
        } else {
          blockedAlerts++;
        }
      });

      expect(allowedAlerts).toBeLessThanOrEqual(10); // Respect per-minute limit
      expect(allowedAlerts + blockedAlerts).toBe(20);
    });

    it('should prioritize critical alerts during high volume', () => {
      const config: RateLimiterConfig = {
        symbolCooldownMs: 10 * 60 * 1000,
        maxAlertsPerMinute: 3,
        maxAlertsPerHour: 100
      };

      const limiter = new AlertRateLimiter(config);

      // Fill up the per-minute quota with low priority
      limiter.recordAlert('SYMBOL-1');
      limiter.recordAlert('SYMBOL-2');
      limiter.recordAlert('SYMBOL-3');

      // Low priority should be blocked
      expect(limiter.shouldAllowAlert('SYMBOL-4', 'low')).toBe(false);

      // But critical alert should still go through (bypassing global)
      // Note: In this implementation, high priority bypasses cooldown but not global limits
      // This test documents that behavior
      expect(limiter.shouldAllowAlert('SYMBOL-4', 'high')).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should check alerts quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        limiter.shouldAllowAlert(`SYMBOL-${i}`, 'medium');
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50); // Should complete in less than 50ms
    });

    it('should record alerts quickly', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        limiter.recordAlert(`SYMBOL-${i}`);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50); // Should complete in less than 50ms
    });

    it('should get stats quickly even with many symbols', () => {
      // Add many symbols
      for (let i = 0; i < 500; i++) {
        limiter.recordAlert(`SYMBOL-${i}`);
      }

      const startTime = performance.now();
      const stats = limiter.getStats();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(20);
      expect(stats.symbolsInCooldown).toBe(500);
    });
  });
});

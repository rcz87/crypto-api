// ============================================================================
// AUTO SCHEDULER - Continuous screening with intelligent alerting
// Author: CryptoSat Intelligence
// Purpose: Auto-scan symbols, detect signals, and send Telegram alerts
// ============================================================================

import { ScreenerService } from './screener.service';
import { decideAlert, renderAlert, generateAlertKey, logAlertDecision, type AlertConfig } from './alert.rules';
import { tgSend, sendSystemAlert } from '../notifier/telegram';
import { recordSignalMetrics } from '../observability';
import { logger } from './logger';
import type { ScreenerRequest, ScreenerResponse } from '../../shared/schemas';

export class AutoScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private sentKeys = new Map<string, number>();
  private screenerService = new ScreenerService();
  private config: AutoSchedulerConfig;

  constructor(config?: Partial<AutoSchedulerConfig>) {
    this.config = {
      ...DEFAULT_AUTO_CONFIG,
      ...config
    };
  }

  /**
   * Start auto-scheduling
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('AutoScheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting AutoScheduler', {
      symbols: this.config.symbols,
      interval: this.config.intervalMs,
      buyThreshold: this.config.alertConfig.buyThreshold,
      sellThreshold: this.config.alertConfig.sellThreshold
    });

    // Initial scan
    this.scanOnce().catch(error => {
      logger.error('Initial auto-scan failed', { error: error?.message || String(error) });
    });

    // Schedule periodic scans
    this.timer = setInterval(() => {
      this.scanOnce().catch(error => {
        logger.error('Auto-scan failed', { error: error?.message || String(error) });
      });
    }, this.config.intervalMs);

    // Send startup notification
    sendSystemAlert(
      'Auto-Screening Started',
      `🤖 Auto-screening system is now active\n📊 Scanning ${this.config.symbols.length} symbols every ${this.config.intervalMs/1000}s\n⚡ Alert thresholds: BUY≥${this.config.alertConfig.buyThreshold}, SELL≤${this.config.alertConfig.sellThreshold}`,
      'info'
    ).catch(error => {
      logger.error('Failed to send startup notification', { error: error?.message || String(error) });
    });
  }

  /**
   * Stop auto-scheduling
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    this.sentKeys.clear();
    
    logger.info('AutoScheduler stopped');

    // Send shutdown notification
    sendSystemAlert(
      'Auto-Screening Stopped',
      '🛑 Auto-screening system has been stopped',
      'warning'
    ).catch(error => {
      logger.error('Failed to send shutdown notification', { error: error?.message || String(error) });
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      sentKeysCount: this.sentKeys.size,
      nextScanIn: this.timer ? this.config.intervalMs : null
    };
  }

  /**
   * Perform one screening scan cycle
   */
  private async scanOnce(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.debug('Starting auto-scan cycle', {
        symbols: this.config.symbols.length,
        timeframe: this.config.timeframe
      });

      const request: ScreenerRequest = {
        symbols: this.config.symbols,
        timeframe: this.config.timeframe,
        limit: this.config.limit
      };

      const response = await this.screenerService.run(request);
      const scanDuration = Date.now() - startTime;

      let alertsSent = 0;
      let alertsFiltered = 0;

      for (const result of response.results) {
        const decision = decideAlert(result, this.config.alertConfig);
        logAlertDecision(result.symbol, result, decision);

        if (decision.shouldAlert) {
          const alertKey = generateAlertKey(result.symbol, result.label, result.score);
          
          if (!this.recentlySent(alertKey)) {
            try {
              const alertMessage = renderAlert({
                symbol: result.symbol,
                result,
                tradable: this.config.includeTradableSignals,
                config: this.config.alertConfig
              });

              const sent = await tgSend(alertMessage, decision.priority === 'low');
              
              if (sent) {
                this.touchKey(alertKey);
                alertsSent++;
                
                // Record signal metrics
                recordSignalMetrics(result.symbol, result.label, result.confidence);
                
                logger.info('Alert sent successfully', {
                  symbol: result.symbol,
                  label: result.label,
                  score: result.score,
                  priority: decision.priority
                });
              }
              
            } catch (error: any) {
              logger.error('Failed to send alert', {
                symbol: result.symbol,
                error: error?.message || String(error)
              });
            }
          } else {
            alertsFiltered++;
            logger.debug('Alert filtered (recently sent)', {
              symbol: result.symbol,
              alertKey
            });
          }
        }
      }

      logger.info('Auto-scan cycle completed', {
        symbols: response.results.length,
        alertsSent,
        alertsFiltered,
        scanDuration,
        buySignals: response.summary?.buy || 0,
        sellSignals: response.summary?.sell || 0,
        avgScore: response.summary?.avgScore || 0
      });

      // Clean up expired dedup keys
      this.cleanupExpiredKeys();

    } catch (error: any) {
      const scanDuration = Date.now() - startTime;
      logger.error('Auto-scan cycle failed', {
        error: error?.message || String(error),
        scanDuration,
        symbols: this.config.symbols.length
      });

      // Send error notification for critical failures
      if (error?.message?.includes('rate limit') || error?.message?.includes('timeout')) {
        sendSystemAlert(
          'Auto-Scan Error',
          `⚠️ Auto-scanning encountered an issue: ${error.message}\n\n🔄 System will retry on next cycle`,
          'warning'
        ).catch(() => {});
      }
    }
  }

  /**
   * Check if alert was recently sent (deduplication)
   */
  private recentlySent(key: string): boolean {
    const expiry = this.sentKeys.get(key);
    if (!expiry) return false;
    
    if (Date.now() > expiry) {
      this.sentKeys.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Mark alert as sent (for deduplication)
   */
  private touchKey(key: string): void {
    this.sentKeys.set(key, Date.now() + this.config.dedupTtlMs);
  }

  /**
   * Clean up expired deduplication keys
   */
  private cleanupExpiredKeys(): void {
    const now = Date.now();
    const before = this.sentKeys.size;
    
    for (const [key, expiry] of this.sentKeys.entries()) {
      if (now > expiry) {
        this.sentKeys.delete(key);
      }
    }
    
    const cleaned = before - this.sentKeys.size;
    if (cleaned > 0) {
      logger.debug('Cleaned up expired dedup keys', { cleaned, remaining: this.sentKeys.size });
    }
  }
}

export type AutoSchedulerConfig = {
  symbols: string[];
  timeframe: string;
  limit: number;
  intervalMs: number;
  dedupTtlMs: number;
  includeTradableSignals: boolean;
  alertConfig: AlertConfig;
};

const DEFAULT_AUTO_CONFIG: AutoSchedulerConfig = {
  symbols: (process.env.AUTO_SYMBOLS || 'SOL-USDT-SWAP,BTC-USDT-SWAP,ETH-USDT-SWAP').split(',').map(s => s.trim()),
  timeframe: process.env.AUTO_TIMEFRAME || '5m',
  limit: Number(process.env.AUTO_LIMIT || 200),
  intervalMs: Number(process.env.AUTO_INTERVAL_MS || 30000), // 30 seconds
  dedupTtlMs: Number(process.env.DEDUP_TTL_MS || 600000), // 10 minutes
  includeTradableSignals: process.env.INCLUDE_TRADABLE !== 'false',
  alertConfig: {
    buyThreshold: Number(process.env.BUY_THRESHOLD || 65),
    sellThreshold: Number(process.env.SELL_THRESHOLD || 35),
    minConfidence: Number(process.env.MIN_CONFIDENCE || 70),
    riskFilter: process.env.RISK_FILTER !== 'false',
    regimeFilter: (process.env.REGIME_FILTER || 'trending,quiet').split(',').map(r => r.trim())
  }
};

// Singleton instance
let autoScheduler: AutoScheduler | null = null;

/**
 * Get or create auto-scheduler instance
 */
export function getAutoScheduler(config?: Partial<AutoSchedulerConfig>): AutoScheduler {
  if (!autoScheduler) {
    autoScheduler = new AutoScheduler(config);
  }
  return autoScheduler;
}

/**
 * Start auto-screening system
 */
export function startAutoScreening(config?: Partial<AutoSchedulerConfig>): AutoScheduler {
  const scheduler = getAutoScheduler(config);
  scheduler.start();
  return scheduler;
}

/**
 * Stop auto-screening system
 */
export function stopAutoScreening(): void {
  if (autoScheduler) {
    autoScheduler.stop();
  }
}

/**
 * Get auto-screening status
 */
export function getAutoScreeningStatus() {
  return autoScheduler?.getStatus() || { isRunning: false };
}
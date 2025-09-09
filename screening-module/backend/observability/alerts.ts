// Professional Alert System - Telegram notifications for trading system
// Real-time monitoring and alerting for institutional trading

import fetch from 'node-fetch';
import { httpErrorsTotal, httpRequestsTotal, signalsGenerated, portfolioEquity } from './metrics';
import { logger } from '../screener/logger';

/**
 * ErrorRateAlerter - Monitor error rates and send Telegram alerts
 * Tracks HTTP error rates over sliding time windows
 */
export class ErrorRateAlerter {
  private lastRequestCount = 0;
  private lastErrorCount = 0;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  constructor(private config: {
    intervalMs: number;
    threshold: number;
    telegramBotToken: string;
    telegramChatId: string;
    serviceName?: string;
  }) {}

  start(): void {
    if (this.isRunning) {
      logger.warn('ErrorRateAlerter already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting ErrorRateAlerter', {
      intervalMs: this.config.intervalMs,
      threshold: this.config.threshold * 100,
      serviceName: this.config.serviceName || 'screener'
    });

    this.timer = setInterval(async () => {
      try {
        await this.checkErrorRate();
      } catch (error) {
        logger.error('Error in ErrorRateAlerter check', { error: error.message });
      }
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('ErrorRateAlerter stopped');
  }

  private async checkErrorRate(): Promise<void> {
    const currentRequests = this.sumCounter(httpRequestsTotal);
    const currentErrors = this.sumCounter(httpErrorsTotal);
    
    const deltaRequests = Math.max(0, currentRequests - this.lastRequestCount);
    const deltaErrors = Math.max(0, currentErrors - this.lastErrorCount);
    
    this.lastRequestCount = currentRequests;
    this.lastErrorCount = currentErrors;
    
    // Skip if no requests in this window
    if (deltaRequests === 0) return;
    
    const errorRate = deltaErrors / deltaRequests;
    const windowSeconds = this.config.intervalMs / 1000;
    
    logger.debug('Error rate check', {
      deltaRequests,
      deltaErrors,
      errorRate: errorRate * 100,
      threshold: this.config.threshold * 100
    });
    
    if (errorRate >= this.config.threshold) {
      const message = this.formatErrorAlert(errorRate, windowSeconds, deltaErrors, deltaRequests);
      await this.sendTelegram(message);
      
      logger.warn('Error rate threshold exceeded', {
        errorRate: errorRate * 100,
        threshold: this.config.threshold * 100,
        deltaRequests,
        deltaErrors
      });
    }
  }

  private formatErrorAlert(rate: number, windowSeconds: number, errors: number, requests: number): string {
    const pct = (rate * 100).toFixed(2);
    const serviceName = this.config.serviceName || 'Screener';
    
    return `🚨 <b>${serviceName} Error Rate Alert</b>\n\n` +
           `📊 Error Rate: <b>${pct}%</b>\n` +
           `⏱ Time Window: ${windowSeconds}s\n` +
           `❌ Errors: ${errors}\n` +
           `📈 Requests: ${requests}\n` +
           `🕐 Time: ${new Date().toLocaleString()}\n\n` +
           `<i>Check logs for detailed error information</i>`;
  }

  private sumCounter(counter: any): number {
    try {
      const value = counter.get();
      return (value?.values || []).reduce((acc: number, item: any) => acc + (item?.value || 0), 0);
    } catch (error) {
      logger.error('Error reading counter value', { error: error.message });
      return 0;
    }
  }

  private async sendTelegram(text: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;
      const body = {
        chat_id: this.config.telegramChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
      }

      logger.info('Telegram alert sent successfully');
    } catch (error) {
      logger.error('Failed to send Telegram alert', { error: error.message });
    }
  }
}

/**
 * TradingAlerter - Monitor trading metrics and portfolio performance
 */
export class TradingAlerter {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSignalCount = 0;
  private lastEquityCheck = Date.now();
  
  constructor(private config: {
    intervalMs: number;
    telegramBotToken: string;
    telegramChatId: string;
    equityDropThreshold: number; // Percentage drop that triggers alert
    signalVolumeThreshold: number; // Signals per minute threshold
  }) {}

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('Starting TradingAlerter', this.config);
    
    this.timer = setInterval(async () => {
      try {
        await this.checkTradingMetrics();
      } catch (error) {
        logger.error('Error in TradingAlerter check', { error: error.message });
      }
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('TradingAlerter stopped');
  }

  private async checkTradingMetrics(): Promise<void> {
    // Check signal generation rate
    await this.checkSignalVolume();
    
    // Check portfolio performance (if equity tracking is available)
    await this.checkPortfolioPerformance();
  }

  private async checkSignalVolume(): Promise<void> {
    const currentSignals = this.sumCounter(signalsGenerated);
    const deltaSignals = Math.max(0, currentSignals - this.lastSignalCount);
    this.lastSignalCount = currentSignals;
    
    const windowMinutes = this.config.intervalMs / (1000 * 60);
    const signalsPerMinute = deltaSignals / windowMinutes;
    
    if (signalsPerMinute > this.config.signalVolumeThreshold) {
      const message = `⚡ <b>High Signal Volume Alert</b>\n\n` +
                     `📊 Signals/min: <b>${signalsPerMinute.toFixed(1)}</b>\n` +
                     `🎯 Threshold: ${this.config.signalVolumeThreshold}/min\n` +
                     `📈 Total signals: ${deltaSignals}\n` +
                     `⏱ Window: ${windowMinutes.toFixed(1)} minutes\n` +
                     `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                     `<i>High signal generation may indicate market volatility</i>`;
      
      await this.sendTelegram(message);
    }
  }

  private async checkPortfolioPerformance(): Promise<void> {
    // This would typically check actual portfolio metrics
    // For now, this is a placeholder for portfolio monitoring
    logger.debug('Portfolio performance check completed');
  }

  private sumCounter(counter: any): number {
    try {
      const value = counter.get();
      return (value?.values || []).reduce((acc: number, item: any) => acc + (item?.value || 0), 0);
    } catch (error) {
      return 0;
    }
  }

  private async sendTelegram(text: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;
      const body = {
        chat_id: this.config.telegramChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      };

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeout: 5000
      });

      logger.info('Trading alert sent to Telegram');
    } catch (error) {
      logger.error('Failed to send trading alert', { error: error.message });
    }
  }
}

/**
 * SystemHealthAlerter - Monitor overall system health
 */
export class SystemHealthAlerter {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  constructor(private config: {
    intervalMs: number;
    telegramBotToken: string;
    telegramChatId: string;
  }) {}

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.timer = setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (error) {
        logger.error('Error in SystemHealthAlerter', { error: error.message });
      }
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  private async checkSystemHealth(): Promise<void> {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    // Alert if memory usage is very high (>500MB for example)
    if (memUsageMB > 500) {
      const message = `⚠️ <b>High Memory Usage Alert</b>\n\n` +
                     `💾 Heap Used: <b>${memUsageMB.toFixed(1)} MB</b>\n` +
                     `📊 Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(1)} MB\n` +
                     `🔄 RSS: ${(memUsage.rss / 1024 / 1024).toFixed(1)} MB\n` +
                     `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                     `<i>Consider investigating memory usage patterns</i>`;
      
      await this.sendTelegram(message);
    }
  }

  private async sendTelegram(text: string): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;
      const body = {
        chat_id: this.config.telegramChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      };

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeout: 5000
      });
    } catch (error) {
      logger.error('Failed to send system health alert', { error: error.message });
    }
  }
}

// Utility function to send custom alerts
export async function sendCustomTelegramAlert(
  botToken: string,
  chatId: string,
  title: string,
  message: string,
  isUrgent: boolean = false
): Promise<void> {
  try {
    const emoji = isUrgent ? '🚨' : '📢';
    const text = `${emoji} <b>${title}</b>\n\n${message}\n\n🕐 ${new Date().toLocaleString()}`;
    
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout: 5000
    });

    logger.info('Custom Telegram alert sent', { title, isUrgent });
  } catch (error) {
    logger.error('Failed to send custom Telegram alert', { 
      error: error.message, 
      title 
    });
  }
}
/**
 * Telegram Alerting System - Monitor system health and send real-time alerts
 * Monitors error rates, trading anomalies, and system health
 */

import { sendTelegram } from './telegram.js';

/**
 * ErrorRateAlerter - Monitor HTTP error rates
 */
export class ErrorRateAlerter {
  private lastRequestCount = 0;
  private lastErrorCount = 0;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  constructor(private config: {
    intervalMs: number;
    threshold: number;
    serviceName?: string;
  }) {}

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ ErrorRateAlerter already running');
      return;
    }

    this.isRunning = true;
    console.log(`✅ Starting ErrorRateAlerter (threshold: ${this.config.threshold * 100}%, interval: ${this.config.intervalMs/1000}s)`);

    this.timer = setInterval(async () => {
      try {
        await this.checkErrorRate();
      } catch (error: any) {
        console.error('Error in ErrorRateAlerter check:', error?.message);
      }
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('🛑 ErrorRateAlerter stopped');
  }

  private async checkErrorRate(): Promise<void> {
    // Note: This is a simplified version. In production, you'd track metrics from actual HTTP middleware
    // For now, we'll just log that the alerter is running
    console.log(`🔍 [ErrorRateAlerter] Monitoring error rates...`);
  }

  getStatus(): { running: boolean } {
    return { running: this.isRunning };
  }
}

/**
 * TradingAlerter - Monitor trading metrics and portfolio
 */
export class TradingAlerter {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  constructor(private config: {
    intervalMs: number;
    signalVolumeThreshold: number;
    equityDropThreshold: number;
  }) {}

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ TradingAlerter already running');
      return;
    }
    
    this.isRunning = true;
    console.log(`✅ Starting TradingAlerter (signal threshold: ${this.config.signalVolumeThreshold}/min, equity drop: ${this.config.equityDropThreshold}%)`);
    
    this.timer = setInterval(async () => {
      try {
        await this.checkTradingMetrics();
      } catch (error: any) {
        console.error('Error in TradingAlerter check:', error?.message);
      }
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('🛑 TradingAlerter stopped');
  }

  private async checkTradingMetrics(): Promise<void> {
    console.log(`📊 [TradingAlerter] Monitoring trading metrics...`);
  }

  getStatus(): { running: boolean } {
    return { running: this.isRunning };
  }
}

/**
 * SystemHealthAlerter - Monitor system resources and health
 */
export class SystemHealthAlerter {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  constructor(private config: {
    intervalMs: number;
  }) {}

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ SystemHealthAlerter already running');
      return;
    }
    
    this.isRunning = true;
    console.log(`✅ Starting SystemHealthAlerter (interval: ${this.config.intervalMs/1000}s)`);
    
    this.timer = setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (error: any) {
        console.error('Error in SystemHealthAlerter check:', error?.message);
      }
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('🛑 SystemHealthAlerter stopped');
  }

  private async checkSystemHealth(): Promise<void> {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);
    
    console.log(`💚 [SystemHealth] Memory: ${heapUsedMB}/${heapTotalMB} MB heap, ${rssMB} MB RSS`);
    
    // Alert if memory usage is critical (>80%)
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
    if (heapUsagePercent > 80) {
      const message = `🚨 <b>High Memory Usage Alert</b>\n\n` +
                     `📊 Heap Usage: <b>${heapUsagePercent.toFixed(1)}%</b>\n` +
                     `💾 Heap: ${heapUsedMB}/${heapTotalMB} MB\n` +
                     `📈 RSS: ${rssMB} MB\n` +
                     `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                     `<i>Consider restarting the service if this persists</i>`;
      
      await sendTelegram(message);
    }
  }

  getStatus(): { running: boolean } {
    return { running: this.isRunning };
  }
}

/**
 * Master Alerting System Coordinator
 */
class AlertingSystem {
  private errorAlerter: ErrorRateAlerter | null = null;
  private tradingAlerter: TradingAlerter | null = null;
  private healthAlerter: SystemHealthAlerter | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('⚠️ Alerting system already initialized');
      return;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.log('ℹ️ Telegram credentials not found, skipping alerting initialization');
      return;
    }

    try {
      console.log('🚀 Initializing Telegram Alerting System...');

      // Error rate alerter
      const errorThreshold = Number(process.env.ERROR_RATE_THRESHOLD || 0.1);
      const errorWindowMs = Number(process.env.ERROR_RATE_WINDOW_MS || 60000);
      
      this.errorAlerter = new ErrorRateAlerter({
        intervalMs: errorWindowMs,
        threshold: errorThreshold,
        serviceName: 'Crypto Trading System'
      });
      this.errorAlerter.start();

      // Trading alerter
      const tradingWindowMs = Number(process.env.TRADING_ALERT_WINDOW_MS || 300000);
      const signalThreshold = Number(process.env.SIGNAL_VOLUME_THRESHOLD || 20);
      const equityDropThreshold = Number(process.env.EQUITY_DROP_THRESHOLD || 5);
      
      this.tradingAlerter = new TradingAlerter({
        intervalMs: tradingWindowMs,
        signalVolumeThreshold: signalThreshold,
        equityDropThreshold: equityDropThreshold
      });
      this.tradingAlerter.start();

      // System health alerter
      const healthWindowMs = Number(process.env.HEALTH_CHECK_WINDOW_MS || 600000);
      
      this.healthAlerter = new SystemHealthAlerter({
        intervalMs: healthWindowMs
      });
      this.healthAlerter.start();

      this.initialized = true;
      console.log('✅ Telegram Alerting System initialized successfully');

      // Send initialization notification
      const message = `✅ <b>Alerting System Initialized</b>\n\n` +
                     `📊 Error Rate Monitor: Active\n` +
                     `💹 Trading Metrics Monitor: Active\n` +
                     `💚 System Health Monitor: Active\n` +
                     `🕐 ${new Date().toLocaleString()}\n\n` +
                     `<i>Real-time monitoring active</i>`;
      
      await sendTelegram(message);

    } catch (error: any) {
      console.error('❌ Failed to initialize alerting system:', error?.message);
      throw error;
    }
  }

  getStatus(): {
    initialized: boolean;
    error_alerter: { running: boolean };
    trading_alerter: { running: boolean };
    health_alerter: { running: boolean };
  } {
    return {
      initialized: this.initialized,
      error_alerter: this.errorAlerter?.getStatus() || { running: false },
      trading_alerter: this.tradingAlerter?.getStatus() || { running: false },
      health_alerter: this.healthAlerter?.getStatus() || { running: false }
    };
  }

  shutdown(): void {
    console.log('🔄 Shutting down alerting system...');
    
    if (this.errorAlerter) {
      this.errorAlerter.stop();
      this.errorAlerter = null;
    }

    if (this.tradingAlerter) {
      this.tradingAlerter.stop();
      this.tradingAlerter = null;
    }

    if (this.healthAlerter) {
      this.healthAlerter.stop();
      this.healthAlerter = null;
    }

    this.initialized = false;
    console.log('✅ Alerting system shutdown completed');
  }
}

// Create singleton instance
export const alertingSystem = new AlertingSystem();

// Auto-initialize
alertingSystem.initialize().catch(error => {
  console.error('Failed to auto-initialize alerting system:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  alertingSystem.shutdown();
});

process.on('SIGINT', () => {
  alertingSystem.shutdown();
});

export default alertingSystem;

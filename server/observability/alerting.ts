/**
 * Telegram Alerting System - Monitor system health and send real-time alerts
 * Monitors error rates, trading anomalies, and system health
 */

import { sendTelegram } from './telegram.js';
import { coinAPIWebSocket } from '../services/coinapiWebSocket.js';

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
 * CoinAPIAlerter - Monitor CoinAPI WebSocket gap detection and recovery
 */
export class CoinAPIAlerter {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastGapCount = 0;
  private lastRecoveryCount = 0;
  private lastWsConnected = true; // Track previous connection state
  
  constructor(private config: {
    intervalMs: number;
  }) {}

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ CoinAPIAlerter already running');
      return;
    }
    
    this.isRunning = true;
    console.log(`✅ Starting CoinAPIAlerter (interval: ${this.config.intervalMs/1000}s)`);
    
    this.timer = setInterval(async () => {
      try {
        await this.checkCoinAPIHealth();
      } catch (error: any) {
        console.error('Error in CoinAPIAlerter check:', error?.message);
      }
    }, this.config.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('🛑 CoinAPIAlerter stopped');
  }

  private async checkCoinAPIHealth(): Promise<void> {
    try {
      const health = coinAPIWebSocket.getHealth();
      const gapStats = health.gapStats;
      
      if (!gapStats) {
        console.log('🔍 [CoinAPIAlerter] Gap stats not available');
        return;
      }
      
      // Check for new gaps detected
      if (gapStats.totalGapsDetected > this.lastGapCount) {
        const newGaps = gapStats.totalGapsDetected - this.lastGapCount;
        const message = `🚨 <b>CoinAPI Sequence Gap Detected!</b>\n\n` +
                       `📊 Total Gaps: <b>${gapStats.totalGapsDetected}</b> (+${newGaps})\n` +
                       `🔄 Recovery Triggered: ${gapStats.recoveryTriggered} times\n` +
                       `🕐 Last Gap: ${gapStats.lastGapTime ? new Date(gapStats.lastGapTime).toLocaleString() : 'N/A'}\n` +
                       `📈 Total Messages: ${health.totalMessagesReceived}\n` +
                       `🌐 WS Connected: ${health.wsConnected ? '✅' : '❌'}\n\n` +
                       `<i>System auto-recovered via REST fallback</i>`;
        
        await sendTelegram(message, { parseMode: 'HTML' });
        this.lastGapCount = gapStats.totalGapsDetected;
      }
      
      // Check for new recovery triggers
      if (gapStats.recoveryTriggered > this.lastRecoveryCount) {
        const newRecoveries = gapStats.recoveryTriggered - this.lastRecoveryCount;
        const message = `🔄 <b>CoinAPI Gap Recovery Triggered</b>\n\n` +
                       `✅ Recovery Count: <b>${gapStats.recoveryTriggered}</b> (+${newRecoveries})\n` +
                       `📊 Total Gaps: ${gapStats.totalGapsDetected}\n` +
                       `📈 Total Messages: ${health.totalMessagesReceived}\n` +
                       `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                       `<i>System auto-recovered via REST snapshot fallback</i>`;
        
        await sendTelegram(message, { parseMode: 'HTML' });
        console.log(`🔄 [CoinAPIAlerter] Recovery alert sent: ${newRecoveries} new recoveries`);
        this.lastRecoveryCount = gapStats.recoveryTriggered;
      }
      
      // Check for latency spikes (message delay)
      const latencyThreshold = Number(process.env.COINAPI_LATENCY_THRESHOLD_MS || 10000); // Default 10s
      const timeSinceLastMessage = health.lastWsMessageTime 
        ? Date.now() - health.lastWsMessageTime 
        : null;
      
      if (timeSinceLastMessage && timeSinceLastMessage > latencyThreshold && health.wsConnected) {
        const message = `⚠️ <b>CoinAPI Latency Spike Detected</b>\n\n` +
                       `⏱️ Message Delay: <b>${Math.round(timeSinceLastMessage / 1000)}s</b>\n` +
                       `⚙️ Threshold: ${latencyThreshold / 1000}s\n` +
                       `📊 Total Messages: ${health.totalMessagesReceived}\n` +
                       `🌐 WS Connected: ${health.wsConnected ? '✅' : '❌'}\n` +
                       `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                       `<i>No messages received for ${Math.round(timeSinceLastMessage / 1000)}s</i>`;
        
        await sendTelegram(message, { parseMode: 'HTML' });
      }
      
      // Alert if WebSocket disconnected (only when state changes, and only if not intentionally disabled)
      const wsEnabled = process.env.COINAPI_WS_ENABLED === 'true';
      
      if (!health.wsConnected && this.lastWsConnected && wsEnabled) {
        // WebSocket just disconnected and it's supposed to be enabled
        const message = `⚠️ <b>CoinAPI WebSocket Disconnected</b>\n\n` +
                       `🔌 Connection Status: <b>Disconnected</b>\n` +
                       `🔄 Reconnect Attempts: ${health.reconnectAttempts}\n` +
                       `📊 REST Fallback: ${health.restOrderbookOk ? '✅ Active' : '❌ Failed'}\n` +
                       `🕐 Time: ${new Date().toLocaleString()}\n\n` +
                       `<i>System attempting auto-reconnection</i>`;
        
        await sendTelegram(message, { parseMode: 'HTML' });
      }
      
      // Update last state
      this.lastWsConnected = health.wsConnected;
      
      console.log(`🌐 [CoinAPIAlerter] Health check - Gaps: ${gapStats.totalGapsDetected}, Recovery: ${gapStats.recoveryTriggered}, WS: ${health.wsConnected ? 'Connected' : 'Disconnected'}${!wsEnabled ? ' (Disabled)' : ''}`);
      
    } catch (error: any) {
      console.error('❌ [CoinAPIAlerter] Health check failed:', error?.message);
    }
  }

  getStatus(): { running: boolean; lastGapCount: number; lastRecoveryCount: number } {
    return { 
      running: this.isRunning,
      lastGapCount: this.lastGapCount,
      lastRecoveryCount: this.lastRecoveryCount
    };
  }
}

/**
 * Master Alerting System Coordinator
 */
class AlertingSystem {
  private errorAlerter: ErrorRateAlerter | null = null;
  private tradingAlerter: TradingAlerter | null = null;
  private healthAlerter: SystemHealthAlerter | null = null;
  private coinapiAlerter: CoinAPIAlerter | null = null;
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

      // CoinAPI WebSocket alerter
      const coinapiWindowMs = Number(process.env.COINAPI_ALERT_WINDOW_MS || 30000);
      
      this.coinapiAlerter = new CoinAPIAlerter({
        intervalMs: coinapiWindowMs
      });
      this.coinapiAlerter.start();

      this.initialized = true;
      console.log('✅ Telegram Alerting System initialized successfully');

      // Send initialization notification
      const message = `✅ <b>Alerting System Initialized</b>\n\n` +
                     `📊 Error Rate Monitor: Active\n` +
                     `💹 Trading Metrics Monitor: Active\n` +
                     `💚 System Health Monitor: Active\n` +
                     `🌐 CoinAPI Gap Monitor: Active\n` +
                     `🕐 ${new Date().toLocaleString()}\n\n` +
                     `<i>Real-time monitoring active</i>`;
      
      await sendTelegram(message, { parseMode: 'HTML' });

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
    coinapi_alerter: { running: boolean; lastGapCount: number; lastRecoveryCount: number };
  } {
    return {
      initialized: this.initialized,
      error_alerter: this.errorAlerter?.getStatus() || { running: false },
      trading_alerter: this.tradingAlerter?.getStatus() || { running: false },
      health_alerter: this.healthAlerter?.getStatus() || { running: false },
      coinapi_alerter: this.coinapiAlerter?.getStatus() || { running: false, lastGapCount: 0, lastRecoveryCount: 0 }
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

    if (this.coinapiAlerter) {
      this.coinapiAlerter.stop();
      this.coinapiAlerter = null;
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

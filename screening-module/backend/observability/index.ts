// Observability System - Complete monitoring, metrics, and alerting
// Professional observability for institutional trading systems

import express from 'express';
import { metricsHandler, metricsMiddleware, recordScreeningRequest, recordSignalGenerated } from './metrics';
import { initTracing, shutdownTracing } from './tracing';
import { ErrorRateAlerter, TradingAlerter, SystemHealthAlerter } from './alerts';
import { logger } from '../screener/logger';

let tracingSDK: any = null;
let errorAlerter: ErrorRateAlerter | null = null;
let tradingAlerter: TradingAlerter | null = null;
let healthAlerter: SystemHealthAlerter | null = null;

export function initObservability(app: express.Express): void {
  try {
    logger.info('Initializing observability system...');

    // 1. Metrics collection middleware
    app.use(metricsMiddleware('screener-service'));
    logger.info('Metrics middleware initialized');

    // 2. Metrics endpoint for Prometheus scraping
    app.get('/metrics', metricsHandler);
    logger.info('Metrics endpoint registered at /metrics');

    // 3. Initialize distributed tracing
    try {
      tracingSDK = initTracing();
      logger.info('Distributed tracing initialized');
    } catch (error) {
      logger.error('Failed to initialize tracing, continuing without it', { error: error.message });
    }

    // 4. Initialize Telegram alerting (if configured)
    initTelegramAlerting();

    // 5. Health check endpoint with observability
    app.get('/health/observability', (req, res) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          metrics: 'operational',
          tracing: tracingSDK ? 'operational' : 'disabled',
          alerting: {
            error_alerter: errorAlerter?.['isRunning'] ? 'operational' : 'disabled',
            trading_alerter: tradingAlerter?.['isRunning'] ? 'operational' : 'disabled',
            health_alerter: healthAlerter?.['isRunning'] ? 'operational' : 'disabled'
          }
        },
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
        },
        uptime: Math.round(process.uptime())
      };

      res.json(health);
    });

    logger.info('Observability system initialized successfully', {
      metrics: 'enabled',
      tracing: tracingSDK ? 'enabled' : 'disabled',
      alerting: 'enabled'
    });

  } catch (error) {
    logger.error('Failed to initialize observability system', { error: error.message });
    throw error;
  }
}

function initTelegramAlerting(): void {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    logger.info('Telegram credentials not found, skipping alert initialization', {
      hasBotToken: !!botToken,
      hasChatId: !!chatId
    });
    return;
  }

  try {
    // Error rate alerter
    const errorThreshold = Number(process.env.ERROR_RATE_THRESHOLD || 0.1); // 10%
    const errorWindowMs = Number(process.env.ERROR_RATE_WINDOW_MS || 60000); // 1 minute
    
    errorAlerter = new ErrorRateAlerter({
      intervalMs: errorWindowMs,
      threshold: errorThreshold,
      telegramBotToken: botToken,
      telegramChatId: chatId,
      serviceName: 'Crypto Screener'
    });
    errorAlerter.start();

    // Trading alerter
    const tradingWindowMs = Number(process.env.TRADING_ALERT_WINDOW_MS || 300000); // 5 minutes
    const signalThreshold = Number(process.env.SIGNAL_VOLUME_THRESHOLD || 20); // signals per minute
    const equityDropThreshold = Number(process.env.EQUITY_DROP_THRESHOLD || 5); // 5% drop
    
    tradingAlerter = new TradingAlerter({
      intervalMs: tradingWindowMs,
      telegramBotToken: botToken,
      telegramChatId: chatId,
      signalVolumeThreshold: signalThreshold,
      equityDropThreshold: equityDropThreshold
    });
    tradingAlerter.start();

    // System health alerter
    const healthWindowMs = Number(process.env.HEALTH_CHECK_WINDOW_MS || 600000); // 10 minutes
    
    healthAlerter = new SystemHealthAlerter({
      intervalMs: healthWindowMs,
      telegramBotToken: botToken,
      telegramChatId: chatId
    });
    healthAlerter.start();

    logger.info('Telegram alerting initialized', {
      errorThreshold: errorThreshold * 100,
      signalThreshold,
      equityDropThreshold,
      chatId: chatId.substring(0, 8) + '***' // Mask chat ID for security
    });

  } catch (error) {
    logger.error('Failed to initialize Telegram alerting', { error: error.message });
  }
}

// Graceful shutdown
export async function shutdownObservability(): Promise<void> {
  logger.info('Shutting down observability system...');

  try {
    // Stop alerters
    if (errorAlerter) {
      errorAlerter.stop();
      errorAlerter = null;
    }

    if (tradingAlerter) {
      tradingAlerter.stop();
      tradingAlerter = null;
    }

    if (healthAlerter) {
      healthAlerter.stop();
      healthAlerter = null;
    }

    // Shutdown tracing
    if (tracingSDK) {
      await shutdownTracing();
      tracingSDK = null;
    }

    logger.info('Observability system shut down gracefully');
  } catch (error) {
    logger.error('Error during observability shutdown', { error: error.message });
  }
}

// Enhanced utility functions for recording trading metrics
export function recordScreeningMetrics(timeframe: string, symbolsCount: number): void {
  try {
    recordScreeningRequest(timeframe, symbolsCount);
  } catch (error) {
    logger.error('Failed to record screening metrics', { error: error.message });
  }
}

export function recordSignalMetrics(symbol: string, label: string, confidence: number): void {
  try {
    recordSignalGenerated(symbol, label, confidence);
  } catch (error) {
    logger.error('Failed to record signal metrics', { error: error.message });
  }
}

// Setup graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down observability...');
  await shutdownObservability();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down observability...');
  await shutdownObservability();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception detected', { error: error.message, stack: error.stack });
  
  // Try to send alert before shutting down
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const { sendCustomTelegramAlert } = await import('./alerts');
      await sendCustomTelegramAlert(
        process.env.TELEGRAM_BOT_TOKEN,
        process.env.TELEGRAM_CHAT_ID,
        'System Crash Alert',
        `Uncaught exception: ${error.message}`,
        true
      );
    } catch (alertError) {
      logger.error('Failed to send crash alert', { error: alertError.message });
    }
  }
  
  await shutdownObservability();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise });
  
  // Send alert for unhandled rejections
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const { sendCustomTelegramAlert } = await import('./alerts');
      await sendCustomTelegramAlert(
        process.env.TELEGRAM_BOT_TOKEN,
        process.env.TELEGRAM_CHAT_ID,
        'Unhandled Promise Rejection',
        `Reason: ${String(reason)}`,
        false
      );
    } catch (alertError) {
      logger.error('Failed to send rejection alert', { error: alertError.message });
    }
  }
});
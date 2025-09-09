// ============================================================================
// AUTO-SCREENING ROUTES - API endpoints for controlling auto-screening system
// Author: CryptoSat Intelligence
// Purpose: REST API to start/stop/configure auto-screening with Telegram alerts
// ============================================================================

import express from 'express';
import { startAutoScreening, stopAutoScreening, getAutoScreeningStatus, getAutoScheduler } from '../screener/auto.scheduler';
import { sendTestAlert, sendSystemAlert } from '../notifier/telegram';
import { logger } from '../screener/logger';
import type { AutoSchedulerConfig } from '../screener/auto.scheduler';

export const autoRouter = express.Router();

// GET /api/auto/status - Get auto-screening status
autoRouter.get('/status', async (req, res) => {
  try {
    const status = getAutoScreeningStatus();
    
    res.json({
      success: true,
      data: {
        isRunning: status.isRunning,
        config: status.config || null,
        sentKeysCount: status.sentKeysCount || 0,
        nextScanIn: status.nextScanIn,
        telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Failed to get auto-screening status', { error: error?.message || String(error) });
    
    res.status(500).json({
      success: false,
      error: 'STATUS_FAILED',
      message: error?.message || 'Failed to get status',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/auto/start - Start auto-screening
autoRouter.post('/start', async (req, res) => {
  try {
    const status = getAutoScreeningStatus();
    
    if (status.isRunning) {
      return res.status(400).json({
        success: false,
        error: 'ALREADY_RUNNING',
        message: 'Auto-screening is already running',
        timestamp: new Date().toISOString()
      });
    }

    // Check Telegram configuration
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_NOT_CONFIGURED',
        message: 'Telegram bot token and chat ID must be configured',
        timestamp: new Date().toISOString()
      });
    }

    // Parse optional configuration from request body
    const customConfig: Partial<AutoSchedulerConfig> = {};
    if (req.body.symbols) customConfig.symbols = req.body.symbols;
    if (req.body.timeframe) customConfig.timeframe = req.body.timeframe;
    if (req.body.intervalMs) customConfig.intervalMs = Number(req.body.intervalMs);
    if (req.body.buyThreshold || req.body.sellThreshold) {
      customConfig.alertConfig = {
        buyThreshold: Number(req.body.buyThreshold || 65),
        sellThreshold: Number(req.body.sellThreshold || 35),
        minConfidence: Number(req.body.minConfidence || 70),
        riskFilter: req.body.riskFilter !== false,
        regimeFilter: req.body.regimeFilter || ['trending', 'quiet']
      };
    }

    const scheduler = startAutoScreening(customConfig);
    const newStatus = scheduler.getStatus();

    logger.info('Auto-screening started via API', {
      symbols: newStatus.config.symbols,
      intervalMs: newStatus.config.intervalMs,
      buyThreshold: newStatus.config.alertConfig.buyThreshold,
      sellThreshold: newStatus.config.alertConfig.sellThreshold
    });

    res.json({
      success: true,
      data: {
        message: 'Auto-screening started successfully',
        status: newStatus
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Failed to start auto-screening', { error: error?.message || String(error) });
    
    res.status(500).json({
      success: false,
      error: 'START_FAILED',
      message: error?.message || 'Failed to start auto-screening',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/auto/stop - Stop auto-screening
autoRouter.post('/stop', async (req, res) => {
  try {
    const status = getAutoScreeningStatus();
    
    if (!status.isRunning) {
      return res.status(400).json({
        success: false,
        error: 'NOT_RUNNING',
        message: 'Auto-screening is not currently running',
        timestamp: new Date().toISOString()
      });
    }

    stopAutoScreening();

    logger.info('Auto-screening stopped via API');

    res.json({
      success: true,
      data: {
        message: 'Auto-screening stopped successfully'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Failed to stop auto-screening', { error: error?.message || String(error) });
    
    res.status(500).json({
      success: false,
      error: 'STOP_FAILED',
      message: error?.message || 'Failed to stop auto-screening',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/auto/test-telegram - Test Telegram connectivity
autoRouter.post('/test-telegram', async (req, res) => {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      return res.status(400).json({
        success: false,
        error: 'TELEGRAM_NOT_CONFIGURED',
        message: 'Telegram bot token and chat ID must be configured',
        timestamp: new Date().toISOString()
      });
    }

    const sent = await sendTestAlert();

    if (sent) {
      res.json({
        success: true,
        data: {
          message: 'Test alert sent successfully to Telegram',
          chatId: String(process.env.TELEGRAM_CHAT_ID).substring(0, 8) + '***'
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'TELEGRAM_SEND_FAILED',
        message: 'Failed to send test message to Telegram',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error: any) {
    logger.error('Telegram test failed', { error: error?.message || String(error) });
    
    res.status(500).json({
      success: false,
      error: 'TELEGRAM_TEST_FAILED',
      message: error?.message || 'Telegram test failed',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/auto/config - Get default auto-screening configuration
autoRouter.get('/config', async (req, res) => {
  try {
    const defaultConfig = {
      symbols: (process.env.AUTO_SYMBOLS || 'SOL-USDT-SWAP,BTC-USDT-SWAP,ETH-USDT-SWAP').split(',').map(s => s.trim()),
      timeframe: process.env.AUTO_TIMEFRAME || '5m',
      limit: Number(process.env.AUTO_LIMIT || 200),
      intervalMs: Number(process.env.AUTO_INTERVAL_MS || 30000),
      dedupTtlMs: Number(process.env.DEDUP_TTL_MS || 600000),
      includeTradableSignals: process.env.INCLUDE_TRADABLE !== 'false',
      alertConfig: {
        buyThreshold: Number(process.env.BUY_THRESHOLD || 65),
        sellThreshold: Number(process.env.SELL_THRESHOLD || 35),
        minConfidence: Number(process.env.MIN_CONFIDENCE || 70),
        riskFilter: process.env.RISK_FILTER !== 'false',
        regimeFilter: (process.env.REGIME_FILTER || 'trending,quiet').split(',').map(r => r.trim())
      }
    };

    res.json({
      success: true,
      data: {
        defaultConfig,
        environmentVariables: {
          telegramConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
          availableSymbols: ['SOL-USDT-SWAP', 'BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'ADA-USDT-SWAP', 'DOT-USDT-SWAP'],
          supportedTimeframes: ['1m', '3m', '5m', '15m', '30m', '1H', '4H'],
          supportedRegimes: ['trending', 'ranging', 'volatile', 'quiet']
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Failed to get auto-screening config', { error: error?.message || String(error) });
    
    res.status(500).json({
      success: false,
      error: 'CONFIG_FAILED',
      message: error?.message || 'Failed to get configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
autoRouter.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Auto-screening router error', {
    error: error?.message || String(error),
    stack: error?.stack,
    path: req.path,
    method: req.method
  });

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An internal error occurred in the auto-screening module',
    timestamp: new Date().toISOString()
  });
});

export default autoRouter;
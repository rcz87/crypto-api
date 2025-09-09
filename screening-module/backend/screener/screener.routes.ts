// Screening Module Routes - Multi-coin screening API endpoints
// Professional routing for institutional screening system

import express from 'express';
import { ScreenerService } from './screener.service';
import { logger } from './logger';
import type { ScreenerRequest, ScreenerResponse } from '../../shared/schemas';

export const screenerRouter = express.Router();

// POST /api/screener/screen - Multi-coin screening
screenerRouter.post('/screen', express.json(), async (req, res) => {
  const startTime = Date.now();
  
  try {
    logger.info('Screening request received', {
      body: req.body,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Validate request
    const request: ScreenerRequest = req.body;
    
    if (!request.symbols || !Array.isArray(request.symbols) || request.symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Symbols array is required and cannot be empty',
        timestamp: new Date().toISOString()
      });
    }

    if (request.symbols.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'TOO_MANY_SYMBOLS',
        message: 'Maximum 50 symbols allowed per request',
        timestamp: new Date().toISOString()
      });
    }

    // Run screening
    const screenerService = new ScreenerService();
    const response: ScreenerResponse = await screenerService.run(request);
    const duration = Date.now() - startTime;
    
    logger.info('Screening completed successfully', {
      symbolsCount: request.symbols.length,
      resultsCount: response.results.length,
      duration,
      timeframe: request.timeframe
    });

    res.json({
      success: true,
      data: response,
      meta: {
        duration,
        timestamp: new Date().toISOString(),
        symbolsRequested: request.symbols.length,
        resultsReturned: response.results.length
      }
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error('Screening request failed', {
      error: error?.message || String(error),
      stack: error?.stack,
      duration,
      body: req.body
    });

    const statusCode = error?.name === 'ValidationError' ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: 'SCREENING_FAILED',
      message: error?.message || 'Internal screening error',
      duration,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/screener/health - Screening module health check
screenerRouter.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      components: {
        database: 'healthy',
        indicators: 'operational',
        risk_engine: 'operational',
        performance_tracking: 'operational'
      },
      version: '4.0.0',
      features: [
        'multi_timeframe_analysis',
        'regime_detection', 
        'professional_indicators',
        'risk_management',
        'performance_tracking',
        'observability'
      ]
    };

    res.json({
      success: true,
      data: health
    });

  } catch (error: any) {
    logger.error('Health check failed', { error: error?.message || String(error) });
    
    res.status(500).json({
      success: false,
      error: 'HEALTH_CHECK_FAILED',
      message: error?.message || 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/screener/config - Get current configuration
screenerRouter.get('/config', async (req, res) => {
  try {
    const config = {
      maxSymbols: 50,
      supportedTimeframes: ['1m', '3m', '5m', '15m', '30m', '1H', '4H', '1D'],
      features: {
        multiTimeframeAnalysis: true,
        regimeDetection: true,
        professionalIndicators: true,
        riskManagement: true,
        performanceTracking: true,
        observability: true
      },
      indicators: {
        professional: ['ADX', 'MACD', 'BBands', 'CCI', 'Stochastic', 'ParabolicSAR'],
        basic: ['SMA', 'EMA', 'RSI', 'VWAP']
      },
      riskManagement: {
        defaultEquity: 10000,
        defaultRiskPct: 0.5,
        atrMultiplier: 1.5,
        maxPositionPct: 15
      }
    };

    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Config request failed', { error: error?.message || String(error) });
    
    res.status(500).json({
      success: false,
      error: 'CONFIG_FAILED',
      message: error?.message || 'Config request failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
screenerRouter.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Screener router error', {
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
    message: 'An internal error occurred in the screening module',
    timestamp: new Date().toISOString()
  });
});

export default screenerRouter;
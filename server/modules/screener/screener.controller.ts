/**
 * Screening Controller
 * Handle HTTP requests untuk multi-coin screening system
 */

import { Request, Response } from 'express';
import { screenerService } from './screener.service.js';
import { screenerParamsSchema, type ScreenerParams } from '../../../shared/schema.js';
import { storage } from '../../storage.js';

/**
 * GET /api/screener - Jalankan screening on-demand
 * Query params: symbols, timeframe, limit
 */
export async function getScreener(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    // Parse dan validate query parameters
    const symbolsParam = req.query.symbols as string || 'SOL,BTC,ETH';
    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase());
    
    const params: ScreenerParams = {
      symbols,
      timeframe: (req.query.timeframe as any) || '15m',
      limit: parseInt(req.query.limit as string) || 200,
      enabledLayers: {
        smc: (req.query.smc as string) !== 'false',
        price_action: (req.query.price_action as string) !== 'false',
        ema: (req.query.ema as string) !== 'false',
        rsi_macd: (req.query.rsi_macd as string) !== 'false',
        funding: (req.query.funding as string) !== 'false',
        oi: (req.query.oi as string) !== 'false',
        cvd: (req.query.cvd as string) !== 'false',
        fibo: (req.query.fibo as string) !== 'false',
      }
    };

    // Validate params menggunakan Zod schema
    const validatedParams = screenerParamsSchema.parse(params);
    
    // Log request
    await storage.addLog({
      level: 'info',
      message: 'Screening request started',
      details: `GET /api/screener - Symbols: ${symbols.join(', ')}, Timeframe: ${params.timeframe}, Layers: ${Object.entries(params.enabledLayers).filter(([_, enabled]) => enabled).map(([name]) => name).join(', ')}`,
    });

    // Jalankan screening
    const result = await screenerService.screenMultipleSymbols(validatedParams);
    const responseTime = Date.now() - startTime;

    // Update metrics
    await storage.updateMetrics(responseTime);

    // Log success
    await storage.addLog({
      level: 'info',
      message: 'Screening request completed successfully',
      details: `GET /api/screener - ${responseTime}ms - ${result.results.length} symbols screened - BUY: ${result.stats.buySignals}, SELL: ${result.stats.sellSignals}, HOLD: ${result.stats.holdSignals}`,
    });

    res.json({
      success: true,
      data: result,
      meta: {
        responseTime,
        requestTime: new Date().toISOString(),
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Error in /api/screener:', error);

    await storage.addLog({
      level: 'error',
      message: 'Screening request failed',
      details: `GET /api/screener - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });

    const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/screener/run - Jalankan run terjadwal dengan custom parameters
 */
export async function postScreenerRun(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const params: ScreenerParams = screenerParamsSchema.parse(req.body);

    await storage.addLog({
      level: 'info',
      message: 'Scheduled screening run started',
      details: `POST /api/screener/run - Symbols: ${params.symbols.join(', ')}, Timeframe: ${params.timeframe}`,
    });

    // Jalankan screening secara asynchronous (untuk run besar)
    const result = await screenerService.screenMultipleSymbols(params);
    const responseTime = Date.now() - startTime;

    await storage.updateMetrics(responseTime);
    
    await storage.addLog({
      level: 'info',
      message: 'Scheduled screening run completed',
      details: `POST /api/screener/run - ${responseTime}ms - Run ID: ${result.run_id}`,
    });

    res.json({
      success: true,
      data: result,
      meta: {
        responseTime,
        requestTime: new Date().toISOString(),
        runId: result.run_id,
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Error in /api/screener/run:', error);

    await storage.addLog({
      level: 'error',
      message: 'Scheduled screening run failed',
      details: `POST /api/screener/run - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });

    const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/screener/:runId - Ambil hasil cached run
 */
export async function getScreenerRun(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    const { runId } = req.params;

    if (!runId) {
      return res.status(400).json({
        success: false,
        error: 'Run ID is required',
        timestamp: new Date().toISOString(),
      });
    }

    await storage.addLog({
      level: 'info',
      message: 'Cached screening result requested',
      details: `GET /api/screener/${runId}`,
    });

    // Untuk sementara, return response bahwa feature dalam development
    // Di production nanti akan fetch dari database
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: false,
      error: 'Cached results feature is under development. Please use GET /api/screener for real-time screening.',
      data: {
        runId,
        status: 'not_implemented',
        message: 'Use GET /api/screener with query parameters for immediate screening results'
      },
      meta: {
        responseTime,
        requestTime: new Date().toISOString(),
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Error in /api/screener/:runId:', error);

    await storage.addLog({
      level: 'error',
      message: 'Cached screening result request failed',
      details: `GET /api/screener/${req.params.runId} - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/screener/supported-symbols - Daftar symbols yang didukung
 */
export async function getSupportedSymbols(req: Request, res: Response) {
  try {
    // Daftar symbols yang umum diperdagangkan
    const supportedSymbols = [
      'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
      'SHIB', 'TRX', 'LINK', 'LTC', 'BCH', 'UNI', 'XLM', 'ATOM', 'ETC', 'FIL',
      'HBAR', 'ICP', 'VET', 'APT', 'NEAR', 'QNT', 'GRT', 'MANA', 'SAND', 'AXS',
      'LRC', 'ENJ', 'CHZ', 'THETA', 'AAVE', 'MKR', 'COMP', 'SUSHI', 'YFI', 'SNX',
      'CRV', 'BAT', 'ZRX', 'OMG', 'KAVA', 'WAVES', 'ZIL', 'REN', 'ICX', 'ONT',
      'QTUM', 'LSK', 'DGB', 'SC', 'ZEN', 'DCR', 'NANO', 'RVN', 'MAID', 'KMD',
      'ARDR', 'STRAT', 'BTS', 'XEM'
    ];

    res.json({
      success: true,
      data: {
        symbols: supportedSymbols,
        count: supportedSymbols.length,
        format: 'BASE (will be converted to BASE-USDT-SWAP)',
        examples: {
          input: 'BTC,ETH,SOL',
          processed: 'BTC-USDT-SWAP,ETH-USDT-SWAP,SOL-USDT-SWAP'
        },
        timeframes: ['5m', '15m', '30m', '1h', '4h', '1d'],
        defaultParams: {
          symbols: ['SOL', 'BTC', 'ETH'],
          timeframe: '15m',
          limit: 200
        }
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in /api/screener/supported-symbols:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get supported symbols',
      timestamp: new Date().toISOString(),
    });
  }
}
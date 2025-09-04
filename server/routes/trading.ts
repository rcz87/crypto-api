import type { Express, Request, Response } from 'express';
import { okxService } from '../services/okx.js';
import { premiumOrderbookService } from '../services/premiumOrderbook.js';
import { CVDService } from '../services/cvd.js';
import { ConfluenceService } from '../services/confluence.js';
import { TechnicalIndicatorsService } from '../services/technicalIndicators.js';
import { FibonacciService } from '../services/fibonacci.js';
import { OrderFlowService } from '../services/orderFlow.js';
import { LiquidationService } from '../services/liquidation.js';
import { LiquidationHeatMapService } from '../services/liquidationHeatMap.js';
import { storage } from '../storage.js';
import { 
  solCompleteDataSchema, 
  fundingRateSchema, 
  openInterestSchema, 
  volumeProfileSchema, 
  smcAnalysisSchema, 
  cvdResponseSchema 
} from '../../shared/schema.js';

/**
 * Register all SOL trading and analysis routes
 * Includes complete market data, technical analysis, and advanced trading intelligence
 */
export function registerTradingRoutes(app: Express): void {
  // Main SOL complete data endpoint
  app.get('/api/sol/complete', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const solData = await okxService.getCompleteSOLData();
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = solCompleteDataSchema.parse(solData);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'API request completed successfully',
        details: `GET /api/sol/complete - ${responseTime}ms - 200 OK`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/complete:', error);
      
      // Log error
      await storage.addLog({
        level: 'error',
        message: 'API request failed',
        details: `GET /api/sol/complete - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // SOL Funding Rate endpoint
  app.get('/api/sol/funding', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const fundingData = await okxService.getFundingRate();
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = fundingRateSchema.parse(fundingData);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Funding rate request completed',
        details: `GET /api/sol/funding - ${responseTime}ms - 200 OK`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/funding:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Funding rate request failed',
        details: `GET /api/sol/funding - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // SOL Open Interest endpoint
  app.get('/api/sol/open-interest', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const openInterestData = await okxService.getOpenInterest();
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = openInterestSchema.parse(openInterestData);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Open interest request completed',
        details: `GET /api/sol/open-interest - ${responseTime}ms - 200 OK`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/open-interest:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Open interest request failed',
        details: `GET /api/sol/open-interest - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // SOL Volume Profile endpoint
  app.get('/api/sol/volume-profile', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = (req.query.timeframe as string) || '1H';
      
      // Get required data for volume profile analysis
      const volumeProfile = await okxService.getVolumeProfile('SOL-USDT-SWAP', timeframe);
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = volumeProfileSchema.parse(volumeProfile);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Volume profile request completed',
        details: `GET /api/sol/volume-profile - ${responseTime}ms - 200 OK`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/volume-profile:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Volume profile request failed',
        details: `GET /api/sol/volume-profile - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // SMC Analysis endpoint
  app.get('/api/sol/smc', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      const smcAnalysis = await okxService.getSMCAnalysis('SOL-USDT', timeframe, limit);
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = smcAnalysisSchema.parse(smcAnalysis);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'SMC analysis request completed',
        details: `GET /api/sol/smc - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/smc:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'SMC analysis request failed',
        details: `GET /api/sol/smc - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // CVD Analysis endpoint
  app.get('/api/sol/cvd', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Initialize CVD service with OKX service
      const cvdService = new CVDService(okxService);
      
      // Get candles and trades data for CVD analysis
      const [candles, trades] = await Promise.all([
        okxService.getCandles('SOL-USDT', timeframe, limit),
        okxService.getRecentTrades('SOL-USDT', 200)
      ]);
      
      // Perform CVD analysis
      const cvdAnalysis = await cvdService.analyzeCVD(candles, trades, timeframe);
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = cvdResponseSchema.parse({
        timeframe,
        current: cvdAnalysis.current,
        confidence: cvdAnalysis.confidence,
        trend: cvdAnalysis.trend,
        divergence: cvdAnalysis.divergence
      });
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'CVD analysis request completed',
        details: `GET /api/sol/cvd - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/cvd:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'CVD analysis request failed',
        details: `GET /api/sol/cvd - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Confluence Analysis endpoint (8-layer SharpSignalEngine)
  app.get('/api/sol/confluence', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Initialize confluence service
      const confluenceService = new ConfluenceService(okxService);
      
      // Get required data for confluence analysis
      const analysisData = await confluenceService.analyzeConfluence('SOL-USDT', timeframe, limit);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Confluence analysis request completed',
        details: `GET /api/sol/confluence - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: analysisData,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/confluence:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Confluence analysis request failed',
        details: `GET /api/sol/confluence - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Technical Indicators endpoint
  app.get('/api/sol/technical', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Initialize technical indicators service
      const technicalService = new TechnicalIndicatorsService();
      
      // Get candles data for technical analysis
      const candles = await okxService.getCandles('SOL-USDT', timeframe, limit);
      
      // Perform technical analysis
      const technicalAnalysis = await technicalService.calculateIndicators(candles, timeframe);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Technical analysis request completed',
        details: `GET /api/sol/technical - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: technicalAnalysis,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/technical:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Technical analysis request failed',
        details: `GET /api/sol/technical - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Fibonacci Analysis endpoint
  app.get('/api/sol/fibonacci', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Initialize Fibonacci service
      const fibonacciService = new FibonacciService();
      
      // Get candles data for Fibonacci analysis
      const candles = await okxService.getCandles('SOL-USDT', timeframe, limit);
      
      // Perform Fibonacci analysis
      const fibonacciAnalysis = await fibonacciService.calculateFibonacci(candles, timeframe);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Fibonacci analysis request completed',
        details: `GET /api/sol/fibonacci - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: fibonacciAnalysis,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/fibonacci:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Fibonacci analysis request failed',
        details: `GET /api/sol/fibonacci - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Order Flow Analysis endpoint
  app.get('/api/sol/order-flow', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      
      // Initialize order flow service
      const orderFlowService = new OrderFlowService(okxService);
      
      // Get required data for order flow analysis
      const [candles, orderBook, trades] = await Promise.all([
        okxService.getCandles('SOL-USDT', timeframe, limit),
        okxService.getOrderBook('SOL-USDT'),
        okxService.getRecentTrades('SOL-USDT', 200)
      ]);
      
      // Perform order flow analysis
      const orderFlowAnalysis = await orderFlowService.analyzeOrderFlow(candles, orderBook, trades, timeframe);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Order flow analysis request completed',
        details: `GET /api/sol/order-flow - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: orderFlowAnalysis,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Error in /api/sol/order-flow:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Order flow analysis request failed',
        details: `GET /api/sol/order-flow - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });
}
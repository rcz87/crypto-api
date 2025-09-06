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
import { tradingSignalsService } from '../services/tradingSignals.js';
import { storage } from '../storage.js';
import { 
  solCompleteDataSchema, 
  fundingRateSchema, 
  openInterestSchema, 
  volumeProfileSchema, 
  smcAnalysisSchema
} from '../../shared/schema.js';
import { validateAndFormatPair, getSupportedPairs } from '../utils/pairValidator.js';

/**
 * Register all trading and analysis routes with multi-pair support
 * Includes complete market data, technical analysis, and advanced trading intelligence
 */
export function registerTradingRoutes(app: Express): void {
  // Get supported trading pairs endpoint
  app.get('/api/pairs/supported', async (req: Request, res: Response) => {
    try {
      const supportedPairs = getSupportedPairs();
      
      res.json({
        success: true,
        data: {
          pairs: supportedPairs,
          count: supportedPairs.length,
          format: 'BASE-USDT-SWAP',
          examples: [
            'BTC-USDT-SWAP',
            'ETH-USDT-SWAP', 
            'SOL-USDT-SWAP',
            'ADA-USDT-SWAP'
          ]
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get supported pairs',
        timestamp: new Date().toISOString(),
      });
    }
  });
  // Dynamic trading pair complete data endpoint - supports any pair like SOL, BTC, ETH
  app.get('/api/:pair/complete', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const { pair } = req.params;
      const tradingSymbol = `${pair.toUpperCase()}-USDT-SWAP`;
      const completeData = await okxService.getCompleteData(tradingSymbol);
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = solCompleteDataSchema.parse(completeData);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'API request completed successfully',
        details: `GET /api/${pair}/complete - ${responseTime}ms - 200 OK`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const { pair } = req.params;
      console.error(`Error in /api/${pair}/complete:`, error);
      
      // Log error
      await storage.addLog({
        level: 'error',
        message: 'API request failed',
        details: `GET /api/${pair}/complete - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Keep legacy SOL endpoint for backward compatibility  
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

  // Dynamic SMC Analysis endpoint
  app.get('/api/:pair/smc', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const { pair } = req.params;
      const validation = validateAndFormatPair(pair);
      
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
          timestamp: new Date().toISOString(),
        });
      }
      
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      const smcAnalysis = await okxService.getSMCAnalysis(validation.symbol, timeframe, limit);
      const responseTime = Date.now() - startTime;
      
      // Validate the response data
      const validated = smcAnalysisSchema.parse(smcAnalysis);
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'SMC analysis request completed',
        details: `GET /api/${pair}/smc - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, Limit: ${limit}`,
      });
      
      res.json({
        success: true,
        data: validated,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const { pair } = req.params;
      console.error(`Error in /api/${pair}/smc:`, error);
      
      await storage.addLog({
        level: 'error',
        message: 'SMC analysis request failed',
        details: `GET /api/${pair}/smc - ${responseTime}ms - Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Legacy SOL SMC endpoint
  app.get('/api/sol/smc', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '1H';
      const limit = parseInt(req.query.limit as string) || 100;
      const smcAnalysis = await okxService.getSMCAnalysis('SOL-USDT-SWAP', timeframe, limit);
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
      
      // No need to validate since cvdAnalysis is already properly structured
      // const validated = cvdResponseSchema.parse(cvdAnalysis);
      
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
        data: cvdAnalysis,
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
      
      // Initialize services
      const confluenceService = new ConfluenceService();
      const cvdService = new CVDService(okxService);
      const technicalService = new TechnicalIndicatorsService();
      const fibonacciService = new FibonacciService();
      const orderFlowService = new OrderFlowService();
      
      // Fetch all required data for confluence analysis in parallel
      const [
        smcData,
        candlesData,
        tradesData,
        volumeProfileData,
        fundingData,
        openInterestData,
        orderBookData
      ] = await Promise.all([
        okxService.getSMCAnalysis('SOL-USDT', timeframe, limit),
        okxService.getCandles('SOL-USDT', timeframe, limit),
        okxService.getRecentTrades('SOL-USDT', 200),
        okxService.getVolumeProfile('SOL-USDT'),
        okxService.getFundingRate(),
        okxService.getOpenInterest(),
        okxService.getOrderBook('SOL-USDT')
      ]);

      // Generate analysis from services
      const [cvdAnalysis, technicalAnalysis, fibonacciAnalysis, orderFlowAnalysis] = await Promise.all([
        cvdService.analyzeCVD(candlesData, tradesData, timeframe),
        technicalService.analyzeTechnicalIndicators(candlesData, timeframe),
        fibonacciService.analyzeFibonacci(candlesData, timeframe),
        orderFlowService.analyzeOrderFlow(tradesData, orderBookData, timeframe)
      ]);
      
      // Calculate confluence score with real data
      const analysisData = await confluenceService.calculateConfluenceScore(
        smcData,
        cvdAnalysis,
        volumeProfileData,
        fundingData,
        openInterestData,
        technicalAnalysis,
        fibonacciAnalysis,
        orderFlowAnalysis,
        timeframe
      );
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
      const technicalAnalysis = await technicalService.analyzeTechnicalIndicators(candles, timeframe);
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
      const fibonacciAnalysis = await fibonacciService.analyzeFibonacci(candles, timeframe);
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
      const tradeLimit = parseInt(req.query.tradeLimit as string) || parseInt(req.query.limit as string) || 200;
      
      // Initialize order flow service
      const orderFlowService = new OrderFlowService();
      
      // Get required data for order flow analysis
      const [candles, orderBook, trades] = await Promise.all([
        okxService.getCandles('SOL-USDT', timeframe, 100),
        okxService.getOrderBook('SOL-USDT'),
        okxService.getRecentTrades('SOL-USDT', tradeLimit)
      ]);
      
      // Perform order flow analysis
      const orderFlowAnalysis = await orderFlowService.analyzeOrderFlow(trades, orderBook, timeframe);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Order flow analysis request completed',
        details: `GET /api/sol/order-flow - ${responseTime}ms - 200 OK - Timeframe: ${timeframe}, TradeLimit: ${tradeLimit}`,
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

  // Live Trading Signals - Real-time Entry/Exit Signals
  app.get('/api/sol/trading-signals', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const timeframe = req.query.timeframe as string || '15m';
      
      const signalsData = await tradingSignalsService.generateLiveSignals(timeframe);
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      await storage.updateMetrics(responseTime);
      
      // Log successful request
      await storage.addLog({
        level: 'info',
        message: 'Trading signals generated successfully',
        details: `GET /api/sol/trading-signals - ${responseTime}ms - ${signalsData.primary.signal} signal`,
      });
      
      res.status(200).json({
        success: true,
        data: signalsData,
        timestamp: new Date().toISOString(),
        responseTime
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Trading signals error:', error);
      
      await storage.addLog({
        level: 'error',
        message: 'Trading signals generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to generate trading signals',
        timestamp: new Date().toISOString(),
        responseTime
      });
    }
  });

  // Signal History
  app.get('/api/sol/signal-history', async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const history = tradingSignalsService.getSignalHistory();
      const responseTime = Date.now() - startTime;
      
      res.status(200).json({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
        responseTime
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('Signal history error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch signal history',
        timestamp: new Date().toISOString(),
        responseTime
      });
    }
  });
}
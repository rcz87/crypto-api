// Enhanced Controller with Better Validation and Error Handling
import { Request, Response } from "express";
import { ScreenerService } from "./screener.service";
import { ScreenerRequestSchema } from "../../shared/schemas";
import { logger } from "./logger";

const service = new ScreenerService();

export class ScreenerController {
  // Main screening endpoint
  async run(req: Request, res: Response) {
    const startTime = Date.now();
    
    try {
      logger.info('Screening request received', { 
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body 
      });

      // Runtime validation with Zod
      const parsed = ScreenerRequestSchema.parse(req.body);
      
      // Execute screening
      const result = await service.run(parsed);
      const responseTime = Date.now() - startTime;

      logger.info('Screening request completed', {
        symbols: parsed.symbols.length,
        responseTime,
        resultsCount: result.results.length,
        buySignals: result.stats?.buySignals || 0,
        sellSignals: result.stats?.sellSignals || 0
      });

      return res.status(200).json({
        ...result,
        meta: {
          responseTime,
          requestTime: new Date().toISOString(),
          version: '2.0.0'
        }
      });

    } catch (err: any) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Screening request failed', {
        error: err.message,
        stack: err.stack,
        responseTime,
        body: req.body
      });

      // Handle Zod validation errors
      if (err?.issues) {
        return res.status(400).json({ 
          error: "VALIDATION_ERROR", 
          details: err.issues,
          message: "Invalid request parameters",
          responseTime
        });
      }

      // Handle service errors
      if (err.message?.includes('Market data fetch failed')) {
        return res.status(503).json({
          error: "SERVICE_UNAVAILABLE",
          message: "Market data service temporarily unavailable",
          responseTime
        });
      }

      // Generic internal error
      return res.status(500).json({ 
        error: "INTERNAL_ERROR", 
        message: err?.message || "Unknown error occurred",
        responseTime
      });
    }
  }

  // Health check endpoint
  async health(req: Request, res: Response) {
    try {
      const healthStatus = await service.healthCheck();
      
      return res.status(healthStatus.status === 'healthy' ? 200 : 503).json({
        ...healthStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      });
    } catch (error) {
      logger.error('Health check failed', error);
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  // Cache management endpoint
  async clearCache(req: Request, res: Response) {
    try {
      const result = service.clearCache();
      logger.info('Cache cleared via API', result);
      
      return res.status(200).json({
        success: true,
        message: 'Cache cleared successfully',
        ...result
      });
    } catch (error) {
      logger.error('Cache clear failed', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get screening statistics
  async getStats(req: Request, res: Response) {
    try {
      // This would be implemented to return aggregated statistics
      const stats = {
        totalRequests: 0, // would track in cache/db
        avgProcessingTime: 0,
        popularSymbols: [],
        lastUpdate: new Date().toISOString()
      };

      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Stats retrieval failed', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
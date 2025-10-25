/**
 * Brain Orchestrator API Routes
 * 
 * Endpoints for accessing Central Intelligence Layer insights
 */

import { Router, Request, Response } from 'express';
import { brainOrchestrator } from '../brain/orchestrator';

const router = Router();

/**
 * GET /api/brain/insights
 * Get recent brain orchestrator insights
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const insights = brainOrchestrator.getRecentInsights(limit);
    
    res.json({
      success: true,
      data: {
        insights,
        total: insights.length
      }
    });
  } catch (error: any) {
    console.error('Error fetching brain insights:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch brain insights'
    });
  }
});

/**
 * GET /api/brain/stats
 * Get brain orchestrator statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = brainOrchestrator.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error fetching brain stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch brain stats'
    });
  }
});

/**
 * POST /api/brain/analyze
 * Trigger immediate brain analysis
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const symbols = req.body.symbols || ['BTC', 'ETH', 'SOL'];

    const insight = await brainOrchestrator.run(symbols);

    res.json({
      success: true,
      data: insight
    });
  } catch (error: any) {
    console.error('Error running brain analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run brain analysis'
    });
  }
});

/**
 * POST /api/brain/fusion
 * 🧬 META-BRAIN: Trigger fusion analysis (CoinAPI + CoinGlass)
 *
 * This is the NEW unified intelligence endpoint that combines:
 * - CoinAPI price action + smart money flow
 * - CoinGlass derivatives intelligence (OI, funding, whale, liquidations)
 *
 * Returns comprehensive UnifiedSignal with multi-factor confidence
 */
router.post('/fusion', async (req: Request, res: Response) => {
  try {
    const symbols = req.body.symbols || ['BTC', 'ETH', 'SOL'];

    console.log(`🧬 [API] Fusion analysis requested for ${symbols.join(', ')}`);

    const fusedSignal = await brainOrchestrator.runFusion(symbols);

    res.json({
      success: true,
      data: fusedSignal,
      meta: {
        version: 'fusion-v1',
        providers: ['coinapi', 'coinglass'],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error running fusion analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run fusion analysis'
    });
  }
});

/**
 * GET /api/brain/fusion/health
 * Check health of both CoinAPI and CoinGlass services
 */
router.get('/fusion/health', async (req: Request, res: Response) => {
  try {
    const { coinGlassBridge } = await import('../services/coinGlassBridgeService.js');
    const { coinAPIWebSocket } = await import('../services/coinapiWebSocket.js');

    const coinglassHealth = await coinGlassBridge.healthCheck();
    const coinapiHealth = coinAPIWebSocket.getHealth();

    res.json({
      success: true,
      data: {
        coinglass: {
          healthy: coinglassHealth,
          status: coinGlassBridge.getHealthStatus()
        },
        coinapi: {
          healthy: coinapiHealth.wsConnected || coinapiHealth.restOrderbookOk,
          websocket: {
            connected: coinapiHealth.wsConnected,
            lastMessage: coinapiHealth.lastWsMessageTime,
            totalMessages: coinapiHealth.totalMessagesReceived
          },
          rest: {
            ok: coinapiHealth.restOrderbookOk
          }
        },
        overall: {
          healthy: coinglassHealth && (coinapiHealth.wsConnected || coinapiHealth.restOrderbookOk),
          readyForFusion: coinglassHealth && (coinapiHealth.wsConnected || coinapiHealth.restOrderbookOk)
        }
      }
    });
  } catch (error: any) {
    console.error('Error checking fusion health:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check fusion health'
    });
  }
});

export default router;

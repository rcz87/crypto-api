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

/**
 * POST /api/brain/pump/detect
 * 🚀 PUMP DETECTOR: Detect early-stage pump signals
 *
 * Analyzes multiple symbols for pump indicators:
 * - OI spikes (derivatives evidence)
 * - Volume acceleration
 * - Funding rate still neutral (retail not in yet)
 * - Price consolidation (pre-breakout)
 * - Whale accumulation
 *
 * Returns pump signals with trading recommendations
 */
router.post('/pump/detect', async (req: Request, res: Response) => {
  try {
    const symbols = req.body.symbols || ['BTC', 'ETH', 'SOL'];

    console.log(`🚀 [API] Pump detection requested for ${symbols.join(', ')}`);

    const pumpSignals = await brainOrchestrator.runPumpDetection(symbols);

    // Filter detected pumps
    const detected = pumpSignals.filter(s => s.detected);

    res.json({
      success: true,
      data: {
        signals: pumpSignals,
        detected: detected.length,
        summary: detected.length > 0
          ? `Found ${detected.length} pump signal(s): ${detected.map(s => `${s.symbol} (${s.strength})`).join(', ')}`
          : 'No pump signals detected'
      },
      meta: {
        version: 'pump-detector-v1',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error running pump detection:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run pump detection'
    });
  }
});

/**
 * POST /api/brain/unified
 * 🧬 UNIFIED ANALYSIS: Run fusion + pump detection together
 *
 * Combines all intelligence sources:
 * - Fusion engine (11 rules)
 * - Pump detector (early pump signals)
 *
 * Returns comprehensive market intelligence
 */
router.post('/unified', async (req: Request, res: Response) => {
  try {
    const symbols = req.body.symbols || ['BTC', 'ETH', 'SOL'];

    console.log(`🧬 [API] Unified analysis requested for ${symbols.join(', ')}`);

    const result = await brainOrchestrator.runUnifiedAnalysis(symbols);

    // Summary
    const pumpDetected = result.pumps.filter(p => p.detected);
    const strongPumps = pumpDetected.filter(p => p.strength === 'strong');

    res.json({
      success: true,
      data: {
        fusion: result.fusion,
        pumps: result.pumps,
        summary: {
          fusionSignal: result.fusion.final_signal,
          fusionConfidence: `${(result.fusion.confidence * 100).toFixed(1)}%`,
          pumpsDetected: pumpDetected.length,
          strongPumps: strongPumps.length,
          recommendation: strongPumps.length > 0
            ? `PRIORITY: Strong pump detected on ${strongPumps.map(p => p.symbol).join(', ')}`
            : `Follow fusion signal: ${result.fusion.final_signal}`
        }
      },
      meta: {
        version: 'unified-v1',
        providers: ['coinapi', 'coinglass', 'pump-detector'],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error running unified analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run unified analysis'
    });
  }
});

/**
 * GET /api/brain/pump/stats
 * Get pump detector statistics
 */
router.get('/pump/stats', async (req: Request, res: Response) => {
  try {
    const stats = brainOrchestrator.getPumpStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error fetching pump stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch pump stats'
    });
  }
});

export default router;

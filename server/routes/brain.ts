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

export default router;

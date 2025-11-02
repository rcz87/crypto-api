/**
 * Social Sentiment API Routes
 *
 * Endpoints for social media sentiment analysis powered by LunarCrush
 *
 * Routes:
 * - GET  /api/social/sentiment/:symbol     - Get social sentiment for a coin
 * - GET  /api/social/lunarcrush/:symbol    - Get raw LunarCrush data
 * - GET  /api/social/influencers/:symbol   - Get top influencers
 * - GET  /api/social/trending              - Get trending coins by social metrics
 * - GET  /api/social/rate-limit            - Get rate limit status
 * - GET  /api/social/health                - Health check
 */

import { Router, type Request, Response } from 'express';
import { socialSentimentService } from '../services/socialSentiment';
import { lunarCrushClient } from '../clients/lunarcrush';

const router = Router();

/**
 * GET /api/social/sentiment/:symbol
 * Get social sentiment analysis for a cryptocurrency
 */
router.get('/sentiment/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol parameter is required'
      });
    }

    const result = await socialSentimentService.getSocialSentiment(symbol.toUpperCase());

    res.json(result);

  } catch (error: any) {
    console.error('[Social Sentiment] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch social sentiment',
      message: error.message
    });
  }
});

/**
 * GET /api/social/lunarcrush/:symbol
 * Get raw LunarCrush data for a cryptocurrency
 */
router.get('/lunarcrush/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol parameter is required'
      });
    }

    if (!lunarCrushClient.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'LunarCrush is not enabled',
        message: 'Add LUNARCRUSH_API_KEY to .env to enable this feature'
      });
    }

    const data = await lunarCrushClient.getCoinData(symbol.toUpperCase());

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'No data found for this symbol',
        message: `LunarCrush does not have data for ${symbol.toUpperCase()}`
      });
    }

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      data,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('[LunarCrush Raw] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch LunarCrush data',
      message: error.message
    });
  }
});

/**
 * GET /api/social/influencers/:symbol
 * Get top influencers talking about a cryptocurrency
 */
router.get('/influencers/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol parameter is required'
      });
    }

    if (!lunarCrushClient.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'LunarCrush is not enabled'
      });
    }

    const influencers = await lunarCrushClient.getInfluencers(
      symbol.toUpperCase(),
      Math.min(limit, 50) // Max 50
    );

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      count: influencers.length,
      influencers,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('[Influencers] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch influencers',
      message: error.message
    });
  }
});

/**
 * GET /api/social/trending
 * Get trending cryptocurrencies by social metrics
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    if (!lunarCrushClient.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'LunarCrush is not enabled'
      });
    }

    const marketData = await lunarCrushClient.getMarketOverview();

    if (!marketData) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch market overview'
      });
    }

    // Sort by social volume and get top N
    const trending = (marketData.data || [])
      .sort((a: any, b: any) => b.social_volume_24h - a.social_volume_24h)
      .slice(0, Math.min(limit, 50))
      .map((coin: any) => ({
        symbol: coin.symbol,
        name: coin.name,
        social_volume_24h: coin.social_volume_24h,
        galaxy_score: coin.galaxy_score,
        alt_rank: coin.alt_rank,
        sentiment: coin.sentiment,
        price: coin.price,
        percent_change_24h: coin.percent_change_24h
      }));

    res.json({
      success: true,
      count: trending.length,
      trending,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('[Trending] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending coins',
      message: error.message
    });
  }
});

/**
 * GET /api/social/compare
 * Compare social metrics for multiple coins
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const symbols = (req.query.symbols as string)?.split(',') || [];

    if (symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Symbols parameter is required (comma-separated)'
      });
    }

    if (symbols.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 symbols allowed'
      });
    }

    if (!lunarCrushClient.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'LunarCrush is not enabled'
      });
    }

    const data = await lunarCrushClient.getMultipleCoins(
      symbols.map(s => s.toUpperCase())
    );

    const comparison = data.map((coin: any) => ({
      symbol: coin.symbol,
      galaxy_score: coin.galaxy_score,
      alt_rank: coin.alt_rank,
      sentiment: coin.sentiment,
      social_volume_24h: coin.social_volume_24h,
      social_dominance: coin.social_dominance,
      trending_score: Math.min(100,
        (coin.social_volume_24h / 1000) * 10 + (100 - coin.alt_rank)
      )
    }));

    res.json({
      success: true,
      count: comparison.length,
      comparison,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('[Compare] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare coins',
      message: error.message
    });
  }
});

/**
 * GET /api/social/rate-limit
 * Get LunarCrush API rate limit status
 */
router.get('/rate-limit', (_req: Request, res: Response) => {
  try {
    const status = socialSentimentService.getRateLimitStatus();

    res.json({
      success: true,
      ...status,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('[Rate Limit] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limit status',
      message: error.message
    });
  }
});

/**
 * GET /api/social/health
 * Health check for social sentiment service
 */
router.get('/health', (_req: Request, res: Response) => {
  try {
    const isEnabled = lunarCrushClient.isEnabled();
    const rateLimitStatus = socialSentimentService.getRateLimitStatus();

    const health = {
      status: isEnabled ? 'healthy' : 'disabled',
      lunarcrush_enabled: isEnabled,
      rate_limit: {
        requests_remaining: rateLimitStatus.requests_remaining,
        daily_limit: rateLimitStatus.daily_limit,
        percentage_used: Math.round(
          (rateLimitStatus.requests_used / rateLimitStatus.daily_limit) * 100
        )
      },
      message: isEnabled
        ? 'Social sentiment service is operational'
        : 'LunarCrush API key not configured. Add LUNARCRUSH_API_KEY to .env'
    };

    res.json({
      success: true,
      ...health,
      timestamp: Date.now()
    });

  } catch (error: any) {
    console.error('[Social Health] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message
    });
  }
});

export default router;

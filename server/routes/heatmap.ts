/**
 * Unified Heatmap API Routes
 * Combines Liquidity Heatmap and Liquidation Heatmap
 */

import { Router, Request, Response } from 'express';
import { liquidationProcessor } from '../services/liquidationProcessor';
import { binanceLiquidationWS } from '../services/binanceLiquidationWebSocket';
import { premiumOrderbookService } from '../services/premiumOrderbook';
import axios from 'axios';

const PY_BASE = process.env.PY_BASE || 'http://localhost:8000';

const router = Router();

// ============================================================================
// UNIFIED HEATMAP ENDPOINT
// ============================================================================

/**
 * GET /api/heatmap/unified/:symbol
 * Get combined liquidity + liquidation heatmap data
 */
router.get('/unified/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { 
      timeWindow = '1h',
      priceRange = 15,
      kdeBandwidth = 0.3
    } = req.query;

    // Get liquidity data from existing premium orderbook service
    const liquidityData = await premiumOrderbookService.getEnhancedMetrics();
    
    // Get liquidation data from new processor
    const liquidationData = liquidationProcessor.generateHeatmapData(
      symbol,
      timeWindow as any,
      {
        kdeBandwidth: parseFloat(kdeBandwidth as string),
        priceRange: parseFloat(priceRange as string)
      }
    );

    // Get leverage distribution
    const leverageDistribution = liquidationProcessor.getLeverageDistribution(
      symbol,
      timeWindow as any
    );

    // Get CoinGlass data via proxy (with circuit breaker)
    let coinglassData = null;
    try {
      const response = await axios.get(
        `${PY_BASE}/coinglass/advanced/liquidation/heatmap`,
        {
          params: { symbol },
          timeout: 5000
        }
      );
      coinglassData = response.data;
    } catch (error) {
      console.warn('[Heatmap API] CoinGlass unavailable:', error);
    }

    // Combine insights
    const insights = generateCombinedInsights(
      liquidityData,
      liquidationData,
      leverageDistribution
    );

    const response = {
      success: true,
      data: {
        symbol,
        timestamp: new Date().toISOString(),
        
        // Liquidity analysis
        liquidity: {
          clusters: liquidityData?.metrics?.liquidityHeatmap?.buckets || [],
          whaleActivity: liquidityData?.metrics?.whaleDetection || null,
          smartMoneyFlow: liquidityData?.metrics?.smartMoneyFlow || null,
          supportResistance: {
            support: liquidityData?.metrics?.liquidityHeatmap?.strongSupportLevels || [],
            resistance: liquidityData?.metrics?.liquidityHeatmap?.strongResistanceLevels || []
          }
        },
        
        // Liquidation analysis
        liquidation: {
          clusters: liquidationData.clusters,
          statistics: liquidationData.statistics,
          leverageDistribution,
          timeWindow: liquidationData.timeWindow
        },
        
        // External data
        external: {
          coinglass: coinglassData
        },
        
        // Combined insights
        insights
      }
    };

    res.json(response);

  } catch (error: any) {
    console.error('[Heatmap API] Error in unified endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unified heatmap data',
      message: error.message
    });
  }
});

// ============================================================================
// LIQUIDATION ENDPOINTS
// ============================================================================

/**
 * GET /api/heatmap/liquidations/:symbol
 * Get liquidation events for a symbol
 */
router.get('/liquidations/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { timeWindow = '1h', limit = 1000 } = req.query;

    const events = liquidationProcessor.getLiquidationEvents(
      symbol,
      timeWindow as any
    );

    const limitedEvents = events.slice(-parseInt(limit as string));

    res.json({
      success: true,
      data: {
        symbol,
        timeWindow,
        count: limitedEvents.length,
        events: limitedEvents
      }
    });

  } catch (error: any) {
    console.error('[Heatmap API] Error in liquidations endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch liquidation events',
      message: error.message
    });
  }
});

/**
 * GET /api/heatmap/liquidations/:symbol/heatmap
 * Get liquidation heatmap data only
 */
router.get('/liquidations/:symbol/heatmap', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { 
      timeWindow = '1h',
      priceRange = 15,
      kdeBandwidth = 0.3
    } = req.query;

    const heatmapData = liquidationProcessor.generateHeatmapData(
      symbol,
      timeWindow as any,
      {
        kdeBandwidth: parseFloat(kdeBandwidth as string),
        priceRange: parseFloat(priceRange as string)
      }
    );

    res.json({
      success: true,
      data: heatmapData
    });

  } catch (error: any) {
    console.error('[Heatmap API] Error in liquidation heatmap endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate liquidation heatmap',
      message: error.message
    });
  }
});

/**
 * GET /api/heatmap/liquidations/:symbol/leverage
 * Get leverage distribution analysis
 */
router.get('/liquidations/:symbol/leverage', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { timeWindow = '1h' } = req.query;

    const leverageDistribution = liquidationProcessor.getLeverageDistribution(
      symbol,
      timeWindow as any
    );

    res.json({
      success: true,
      data: {
        symbol,
        timeWindow,
        distribution: leverageDistribution
      }
    });

  } catch (error: any) {
    console.error('[Heatmap API] Error in leverage endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leverage distribution',
      message: error.message
    });
  }
});

// ============================================================================
// LIQUIDITY ENDPOINTS (Enhanced)
// ============================================================================

/**
 * GET /api/heatmap/liquidity/:symbol
 * Get liquidity heatmap data only
 */
router.get('/liquidity/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    const liquidityData = await premiumOrderbookService.getEnhancedMetrics();

    res.json({
      success: true,
      data: {
        symbol,
        timestamp: new Date().toISOString(),
        liquidity: liquidityData?.metrics?.liquidityHeatmap || null,
        whaleActivity: liquidityData?.metrics?.whaleDetection || null,
        smartMoneyFlow: liquidityData?.metrics?.smartMoneyFlow || null
      }
    });

  } catch (error: any) {
    console.error('[Heatmap API] Error in liquidity endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch liquidity data',
      message: error.message
    });
  }
});

// ============================================================================
// EXPORT ENDPOINTS
// ============================================================================

/**
 * GET /api/heatmap/export/:symbol
 * Export heatmap data in various formats
 */
router.get('/export/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { format = 'json', timeWindow = '1h' } = req.query;

    // Get unified data
    const liquidityData = await premiumOrderbookService.getEnhancedMetrics();
    const liquidationData = liquidationProcessor.generateHeatmapData(
      symbol,
      timeWindow as any
    );

    const exportData = {
      symbol,
      timestamp: new Date().toISOString(),
      timeWindow,
      liquidity: liquidityData?.metrics?.liquidityHeatmap || null,
      liquidation: liquidationData
    };

    if (format === 'csv') {
      const csv = convertToCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="heatmap_${symbol}_${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: exportData
      });
    }

  } catch (error: any) {
    console.error('[Heatmap API] Error in export endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export heatmap data',
      message: error.message
    });
  }
});

// ============================================================================
// STATUS ENDPOINTS
// ============================================================================

/**
 * GET /api/heatmap/status
 * Get system status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const binanceStatus = binanceLiquidationWS.getStatus();
    const trackedSymbols = liquidationProcessor.getTrackedSymbols();

    const symbolStats = trackedSymbols.map(symbol => ({
      symbol,
      eventCount: liquidationProcessor.getEventCount(symbol)
    }));

    res.json({
      success: true,
      data: {
        binanceWebSocket: {
          connected: binanceStatus.connected,
          lastUpdate: binanceStatus.lastUpdate,
          totalMessages: binanceStatus.totalMessages,
          errors: binanceStatus.errors,
          subscribedSymbols: binanceLiquidationWS.getSubscribedSymbols()
        },
        liquidationProcessor: {
          trackedSymbols: trackedSymbols.length,
          symbolStats
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[Heatmap API] Error in status endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch status',
      message: error.message
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate combined insights from liquidity and liquidation data
 */
function generateCombinedInsights(
  liquidityData: any,
  liquidationData: any,
  leverageDistribution: any[]
): any {
  const insights: any = {
    riskLevel: 'low',
    tradingSignals: [],
    keyLevels: [],
    warnings: []
  };

  // Analyze liquidation risk
  if (liquidationData.statistics.highRiskZones > 5) {
    insights.riskLevel = 'high';
    insights.warnings.push('High concentration of liquidation clusters detected');
  } else if (liquidationData.statistics.highRiskZones > 2) {
    insights.riskLevel = 'moderate';
  }

  // Analyze leverage risk
  const highLeveragePct = leverageDistribution
    .filter(tier => tier.name === 'very_high' || tier.name === 'extreme')
    .reduce((sum, tier) => sum + tier.percentage, 0);

  if (highLeveragePct > 30) {
    insights.warnings.push(`${highLeveragePct.toFixed(1)}% of liquidations are high leverage (>25x)`);
  }

  // Analyze whale activity
  if (liquidityData?.metrics?.whaleDetection?.whaleImpact === 'high') {
    insights.warnings.push('High whale activity detected');
  }

  // Analyze smart money flow
  const smartMoney = liquidityData?.metrics?.smartMoneyFlow;
  if (smartMoney) {
    if (smartMoney.accumulationSignal) {
      insights.tradingSignals.push({
        type: 'accumulation',
        confidence: 'high',
        message: 'Smart money accumulation detected'
      });
    }
    if (smartMoney.distributionSignal) {
      insights.tradingSignals.push({
        type: 'distribution',
        confidence: 'high',
        message: 'Smart money distribution detected'
      });
    }
  }

  // Identify key levels from both liquidity and liquidation
  const liquiditySupportLevels = liquidityData?.metrics?.liquidityHeatmap?.strongSupportLevels || [];
  const liquidityResistanceLevels = liquidityData?.metrics?.liquidityHeatmap?.strongResistanceLevels || [];
  
  const highRiskLiquidationClusters = liquidationData.clusters
    .filter((c: any) => c.riskLevel === 'high' || c.riskLevel === 'extreme')
    .slice(0, 5);

  insights.keyLevels = [
    ...liquiditySupportLevels.map((level: any) => ({
      price: level.price,
      type: 'support',
      source: 'liquidity',
      significance: level.significance
    })),
    ...liquidityResistanceLevels.map((level: any) => ({
      price: level.price,
      type: 'resistance',
      source: 'liquidity',
      significance: level.significance
    })),
    ...highRiskLiquidationClusters.map((cluster: any) => ({
      price: cluster.priceLevel,
      type: 'liquidation_cluster',
      source: 'liquidation',
      riskLevel: cluster.riskLevel,
      volume: cluster.totalVolume
    }))
  ];

  return insights;
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: any): string {
  const lines: string[] = [];
  
  // Header
  lines.push('Type,Price,Volume,Risk Level,Source');
  
  // Liquidation clusters
  if (data.liquidation?.clusters) {
    data.liquidation.clusters.forEach((cluster: any) => {
      lines.push(
        `Liquidation,${cluster.priceLevel},${cluster.totalVolume},${cluster.riskLevel},liquidation`
      );
    });
  }
  
  // Liquidity levels
  if (data.liquidity?.buckets) {
    data.liquidity.buckets.forEach((bucket: any) => {
      lines.push(
        `Liquidity,${bucket.priceLevel},${bucket.volume},${bucket.intensity},liquidity`
      );
    });
  }
  
  return lines.join('\n');
}

export default router;

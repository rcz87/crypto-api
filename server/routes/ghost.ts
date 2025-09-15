/**
 * 👻 Ghost Order Management Routes
 * Paper trading portfolio management and analytics
 */

import type { Express, Request, Response } from "express";
import { 
  saveGhostOrder, 
  listGhost, 
  getGhostOrder, 
  getPortfolioSummary,
  updateOrderStatus,
  cleanupOldOrders 
} from "../services/okxGhost";

/**
 * 📋 Register Ghost Order Management Routes
 */
export function registerGhostRoutes(app: Express) {
  
  /**
   * 📊 GET /api/ghost/portfolio - Portfolio Summary
   */
  app.get('/api/ghost/portfolio', async (req: Request, res: Response) => {
    try {
      const portfolio = getPortfolioSummary();
      
      res.json({
        success: true,
        portfolio,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Portfolio summary failed:', error);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * 📋 GET /api/ghost/orders - List Ghost Orders
   */
  app.get('/api/ghost/orders', async (req: Request, res: Response) => {
    try {
      const { status, symbol, mode, limit } = req.query;
      
      const filters = {
        status: status as string,
        symbol: symbol as string,
        mode: mode as string,
        limit: limit ? parseInt(limit as string) : 50
      };
      
      const result = listGhost(filters);
      
      res.json({
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ List ghost orders failed:', error);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * 🎯 GET /api/ghost/orders/:ref_id - Get Specific Order
   */
  app.get('/api/ghost/orders/:ref_id', async (req: Request, res: Response) => {
    try {
      const { ref_id } = req.params;
      const order = getGhostOrder(ref_id);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          error: `Order not found: ${ref_id}`
        });
      }
      
      res.json({
        success: true,
        order,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Get ghost order ${req.params.ref_id} failed:`, error);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * 🎯 POST /api/ghost/orders - Create New Ghost Order
   */
  app.post('/api/ghost/orders', async (req: Request, res: Response) => {
    try {
      const {
        ref_id,
        symbol,
        side,
        entry_zone,
        sl,
        tps,
        confidence,
        mode = 'ghost',
        metadata = {}
      } = req.body;

      // Validate required fields
      if (!ref_id || !symbol || !side || !entry_zone || !sl || confidence === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: ref_id, symbol, side, entry_zone, sl, confidence'
        });
      }

      const result = await saveGhostOrder({
        ref_id,
        symbol,
        side,
        entry_zone,
        sl,
        tps: tps || [],
        confidence,
        mode,
        metadata: {
          ...metadata,
          created_by: 'api',
          signal_source: 'manual'
        }
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      console.log(`👻 Ghost order created via API: ${ref_id}`);
      
      res.status(201).json({
        success: true,
        order: result.order,
        summary: result.summary,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Create ghost order failed:', error);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * 🔄 PUT /api/ghost/orders/:ref_id/status - Update Order Status
   */
  app.put('/api/ghost/orders/:ref_id/status', async (req: Request, res: Response) => {
    try {
      const { ref_id } = req.params;
      const { current_price, force_close = false } = req.body;

      if (current_price === undefined || current_price === null) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: current_price'
        });
      }

      // Update order status based on current price
      const result = await updateOrderStatus(ref_id, parseFloat(current_price));
      
      // Handle force close if requested
      if (force_close && result.success) {
        const order = getGhostOrder(ref_id);
        if (order) {
          order.status = 'closed';
          order.timestamps.last_update = Date.now();
          if (order.fill_status.entry_filled && order.pnl.unrealized !== 0) {
            order.pnl.realized = order.pnl.unrealized;
          }
          console.log(`👻 Ghost order force closed: ${ref_id}`);
        }
      }

      res.json({
        ...result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Update order status ${req.params.ref_id} failed:`, error);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * ❌ DELETE /api/ghost/orders/:ref_id - Cancel/Close Order
   */
  app.delete('/api/ghost/orders/:ref_id', async (req: Request, res: Response) => {
    try {
      const { ref_id } = req.params;
      const order = getGhostOrder(ref_id);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          error: `Order not found: ${ref_id}`
        });
      }

      // Update order status to closed
      order.status = 'closed';
      order.timestamps.last_update = Date.now();
      
      // If position was filled, realize the PnL
      if (order.fill_status.entry_filled && order.pnl.unrealized !== 0) {
        order.pnl.realized = order.pnl.unrealized;
      }

      console.log(`👻 Ghost order closed: ${ref_id}`);
      
      res.json({
        success: true,
        message: `Order ${ref_id} closed successfully`,
        order,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Close ghost order ${req.params.ref_id} failed:`, error);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * 📊 GET /api/ghost/analytics - Trading Analytics
   */
  app.get('/api/ghost/analytics', async (req: Request, res: Response) => {
    try {
      const { timeframe = '7d' } = req.query;
      
      // Get all orders for analysis
      const result = listGhost({ limit: 1000 });
      const orders = result.orders || [];
      const closedOrders = orders.filter(order => order.status === 'closed');
      
      // Calculate time filter
      const now = Date.now();
      const timeframes: Record<string, number> = {
        '1d': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        'all': Number.MAX_SAFE_INTEGER
      };
      
      const cutoff = now - (timeframes[timeframe as string] || timeframes['7d']);
      const filteredOrders = closedOrders.filter(order => order.timestamps.created >= cutoff);
      
      // Calculate analytics
      const totalTrades = filteredOrders.length;
      const winningTrades = filteredOrders.filter(order => (order.pnl.realized || 0) > 0);
      const losingTrades = filteredOrders.filter(order => (order.pnl.realized || 0) < 0);
      
      const totalPnL = filteredOrders.reduce((sum, order) => sum + (order.pnl.realized || 0), 0);
      const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
      
      const avgWin = winningTrades.length > 0 
        ? winningTrades.reduce((sum, order) => sum + (order.pnl.realized || 0), 0) / winningTrades.length 
        : 0;
      
      const avgLoss = losingTrades.length > 0 
        ? Math.abs(losingTrades.reduce((sum, order) => sum + (order.pnl.realized || 0), 0) / losingTrades.length)
        : 0;
      
      const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
      
      // Symbol breakdown
      const symbolStats = new Map<string, { trades: number; pnl: number; wins: number }>();
      filteredOrders.forEach(order => {
        const symbol = order.symbol;
        if (!symbolStats.has(symbol)) {
          symbolStats.set(symbol, { trades: 0, pnl: 0, wins: 0 });
        }
        const stats = symbolStats.get(symbol)!;
        stats.trades++;
        stats.pnl += order.pnl.realized || 0;
        if ((order.pnl.realized || 0) > 0) stats.wins++;
      });
      
      const symbolBreakdown = Array.from(symbolStats.entries()).map(([symbol, stats]) => ({
        symbol,
        trades: stats.trades,
        pnl: parseFloat(stats.pnl.toFixed(2)),
        win_rate: stats.trades > 0 ? parseFloat(((stats.wins / stats.trades) * 100).toFixed(1)) : 0
      }));
      
      res.json({
        success: true,
        analytics: {
          timeframe,
          period: {
            from: new Date(cutoff).toISOString(),
            to: new Date(now).toISOString()
          },
          performance: {
            total_trades: totalTrades,
            winning_trades: winningTrades.length,
            losing_trades: losingTrades.length,
            win_rate: parseFloat(winRate.toFixed(1)),
            total_pnl: parseFloat(totalPnL.toFixed(2)),
            avg_win: parseFloat(avgWin.toFixed(2)),
            avg_loss: parseFloat(avgLoss.toFixed(2)),
            profit_factor: parseFloat(profitFactor.toFixed(2))
          },
          symbol_breakdown: symbolBreakdown.sort((a, b) => b.pnl - a.pnl),
          portfolio: result.portfolio
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Analytics calculation failed:', error);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * 🧹 POST /api/ghost/cleanup - Cleanup Old Orders
   */
  app.post('/api/ghost/cleanup', async (req: Request, res: Response) => {
    try {
      const { max_age_days = 7 } = req.body;
      const maxAge = max_age_days * 24 * 60 * 60 * 1000; // Convert to milliseconds
      
      const cleanedCount = cleanupOldOrders(maxAge);
      
      res.json({
        success: true,
        message: `Cleaned up ${cleanedCount} old orders`,
        cleaned_count: cleanedCount,
        max_age_days,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Cleanup failed:', error);
      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });

  /**
   * 📊 GET /api/ghost/status - System Status
   */
  app.get('/api/ghost/status', async (req: Request, res: Response) => {
    try {
      const result = listGhost({ limit: 1000 });
      const orders = result.orders || [];
      
      const statusCounts = {
        created: orders.filter(o => o.status === 'created').length,
        filled: orders.filter(o => o.status === 'filled').length,
        closed: orders.filter(o => o.status === 'closed').length
      };
      
      const modeStats = {
        ghost: orders.filter(o => o.mode === 'ghost').length,
        live: orders.filter(o => o.mode === 'live').length
      };
      
      res.json({
        success: true,
        status: {
          total_orders: orders.length,
          active_monitoring: statusCounts.created + statusCounts.filled,
          status_breakdown: statusCounts,
          mode_breakdown: modeStats,
          portfolio: result.portfolio,
          system_health: 'operational',
          monitoring_active: true
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Status check failed:', error);
      res.status(500).json({
        success: false,
        error: errorMessage,
        system_health: 'degraded'
      });
    }
  });

  console.log('👻 Ghost order management routes registered successfully');
}
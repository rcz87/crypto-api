/**
 * 👻 Ghost Order OKX System - Paper Trading Simulation
 * Stores and manages simulated orders for risk-free trading practice
 */

// Using global fetch (Node 18+)
// @ts-ignore - autoSize.js is a JavaScript module without types
import { sizeByConfidence } from "./autoSize.js";

// Type definitions
interface AutoSizeResult {
  error?: string;
  sizing: {
    dollarAmount: number;
    coinAmount: number;
    contractAmount: number;
    percentage: number;
  };
  factors: {
    confidence: {
      tier: string;
    };
  };
}

interface SaveGhostOrderParams {
  ref_id: string;
  symbol: string;
  side: string;
  entry_zone: number | number[];
  sl: number;
  tps?: number[];
  confidence?: number;
  mode?: string;
  metadata?: any;
}

interface GhostOrderFilters {
  status?: string;
  symbol?: string;
  mode?: string;
  limit?: number;
}

interface GhostOrder {
  ref_id: string;
  symbol: string;
  side: string;
  entry_zone: {
    min: number;
    max: number;
    target: number;
  };
  sl: number;
  tps: number[];
  sizing: {
    usd_amount: number;
    coin_amount: number;
    contracts: number;
    percentage: number;
  };
  confidence: number;
  mode: string;
  status: string;
  fill_status: {
    entry_filled: boolean;
    sl_hit: boolean;
    tps_hit: number[];
    fill_price: number | null;
    fill_time: string | null;
  };
  pnl: {
    unrealized: number;
    realized: number;
    percentage: number;
  };
  pricing: {
    entry_price: number;
    current_price: number | null;
    sl_distance_pct: string;
    risk_reward: string;
  };
  metadata: any;
  timestamps: {
    created: number;
    last_update: number;
  };
}

interface Portfolio {
  equity: number;
  positions: Map<string, any>;
  totalPnL: number;
  winRate: number;
  trades: number;
  wins: number;
}

interface PortfolioMetrics {
  equity: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_pnl: number;
  win_rate: number;
  total_trades: number;
  winning_trades: number;
  active_positions: number;
  pending_orders: number;
}


const PY_BASE = process.env.PY_BASE || "http://localhost:5000/py";

/**
 * 🔄 Fetch Unified Endpoint Helper for Ghost Orders
 */
async function fetchUnifiedEndpoint(operation: string, params: any, timeoutMs: number = 5000): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`${PY_BASE}/gpts/advanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        op: operation,
        params: params
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// In-memory storage for ghost orders (in production use Redis/Database)
const ghostOrders = new Map<string, GhostOrder>();
const executionLog = new Map<string, any>();
const portfolio: Portfolio = {
  equity: parseFloat(process.env.EQUITY_USD || "10000"),
  positions: new Map(),
  totalPnL: 0,
  winRate: 0,
  trades: 0,
  wins: 0
};

/**
 * 💾 Save Ghost Order
 * Creates a new simulated order with auto-sizing
 * 
 * @param {Object} params - Order parameters
 * @param {string} params.ref_id - Unique reference ID from signal
 * @param {string} params.symbol - Trading symbol (e.g., 'SOL')
 * @param {string} params.side - 'LONG' or 'SHORT'
 * @param {number|number[]} params.entry_zone - Entry price or [min, max] range
 * @param {number} params.sl - Stop loss price
 * @param {number[]} params.tps - Take profit levels [TP1, TP2, TP3]
 * @param {number} params.confidence - Signal confidence (0-100) for sizing
 * @param {string} params.mode - 'ghost' or 'live' (default: 'ghost')
 * @param {Object} params.metadata - Additional signal data for analysis
 * @returns {Object} Created ghost order with sizing info
 */
export async function saveGhostOrder(params: SaveGhostOrderParams) {
  try {
    const {
      ref_id,
      symbol,
      side,
      entry_zone,
      sl,
      tps = [],
      confidence = 50,
      mode = 'ghost',
      metadata = {}
    } = params;

    // Validate required fields
    if (!ref_id || !symbol || !side || !entry_zone || !sl) {
      throw new Error('Missing required fields: ref_id, symbol, side, entry_zone, sl');
    }

    // Calculate position size using auto-sizing system
    const sizing = await sizeByConfidence({
      confidence,
      symbol,
      timeframe: metadata.timeframe || '5m'
    });

    if (sizing.error) {
      throw new Error(`Position sizing failed: ${sizing.error}`);
    }

    // Normalize entry zone
    const entryPrice = Array.isArray(entry_zone) 
      ? (entry_zone[0] + entry_zone[1]) / 2 
      : entry_zone;
    
    const entryMin = Array.isArray(entry_zone) ? entry_zone[0] : entry_zone;
    const entryMax = Array.isArray(entry_zone) ? entry_zone[1] : entry_zone;

    // Create ghost order
    const ghostOrder = {
      ref_id,
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      entry_zone: {
        min: entryMin,
        max: entryMax,
        target: entryPrice
      },
      sl,
      tps: tps.filter((tp: number) => tp && tp > 0),
      sizing: {
        usd_amount: sizing.sizing.dollarAmount,
        coin_amount: sizing.sizing.coinAmount,
        contracts: sizing.sizing.contractAmount,
        percentage: sizing.sizing.percentage
      },
      confidence,
      mode,
      status: 'created',
      fill_status: {
        entry_filled: false,
        sl_hit: false,
        tps_hit: [],
        fill_price: null,
        fill_time: null
      },
      pnl: {
        unrealized: 0,
        realized: 0,
        percentage: 0
      },
      pricing: {
        entry_price: entryPrice,
        current_price: null,
        sl_distance_pct: ((Math.abs(sl - entryPrice) / entryPrice) * 100).toFixed(2),
        risk_reward: tps.length > 0 ? ((tps[0] - entryPrice) / Math.abs(sl - entryPrice)).toFixed(2) : 'N/A'
      },
      metadata: {
        ...metadata,
        created_at: new Date().toISOString(),
        signal_source: metadata.signal_source || 'telegram',
        timeframe: metadata.timeframe || '5m'
      },
      timestamps: {
        created: Date.now(),
        last_update: Date.now()
      }
    };

    // Store in memory
    ghostOrders.set(ref_id, ghostOrder);
    
    console.log(`👻 Ghost order created: ${ref_id} | ${symbol} ${side} | $${sizing.sizing.dollarAmount} (${confidence}% conf)`);
    
    // Start price monitoring if not already active
    startPriceMonitoring();
    
    return {
      success: true,
      order: ghostOrder,
      summary: {
        ref_id,
        symbol,
        side,
        entry_range: `${entryMin} - ${entryMax}`,
        size_usd: sizing.sizing.dollarAmount,
        size_coins: sizing.sizing.coinAmount,
        sl_distance: `${ghostOrder.pricing.sl_distance_pct}%`,
        risk_reward: ghostOrder.pricing.risk_reward,
        confidence_tier: sizing.factors.confidence.tier
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Ghost order creation failed:', errorMessage);
    return {
      success: false,
      error: errorMessage,
      ref_id: params.ref_id
    };
  }
}

/**
 * 📋 List Ghost Orders
 * Retrieves ghost orders with optional filtering
 * 
 * @param {Object} filters - Optional filters
 * @param {string} filters.status - Filter by status ('created', 'filled', 'closed')
 * @param {string} filters.symbol - Filter by symbol
 * @param {string} filters.mode - Filter by mode ('ghost', 'live')
 * @param {number} filters.limit - Limit number of results
 * @returns {Object} List of ghost orders with portfolio summary
 */
export function listGhost(filters: GhostOrderFilters = {}) {
  try {
    const { status, symbol, mode, limit = 50 } = filters;
    
    let orders = Array.from(ghostOrders.values());
    
    // Apply filters
    if (status) {
      orders = orders.filter((order: GhostOrder) => order.status === status);
    }
    
    if (symbol) {
      orders = orders.filter((order: GhostOrder) => order.symbol === symbol.toUpperCase());
    }
    
    if (mode) {
      orders = orders.filter((order: GhostOrder) => order.mode === mode);
    }
    
    // Sort by creation time (newest first)
    orders.sort((a: GhostOrder, b: GhostOrder) => b.timestamps.created - a.timestamps.created);
    
    // Apply limit
    if (limit) {
      orders = orders.slice(0, limit);
    }
    
    // Calculate portfolio metrics
    const portfolioSummary = calculatePortfolioMetrics();
    
    return {
      success: true,
      orders,
      count: orders.length,
      total_orders: ghostOrders.size,
      portfolio: portfolioSummary,
      filters_applied: filters,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to list ghost orders:', errorMessage);
    return {
      success: false,
      error: errorMessage,
      orders: []
    };
  }
}

/**
 * 🔄 Update Order Status
 * Updates order status and calculates PnL based on current market price
 * 
 * @param {string} ref_id - Order reference ID
 * @param {number} current_price - Current market price
 * @param {Object} options - Update options
 * @returns {Object} Update result with PnL calculation
 */
export async function updateOrderStatus(ref_id: string, current_price: number, options: any = {}) {
  try {
    const order = ghostOrders.get(ref_id);
    
    if (!order) {
      return { success: false, error: `Order not found: ${ref_id}` };
    }
    
    const previousStatus = order.status;
    order.pricing.current_price = current_price;
    order.timestamps.last_update = Date.now();
    
    // Check if entry zone is hit
    if (!order.fill_status.entry_filled) {
      const { min, max } = order.entry_zone;
      
      if (current_price >= min && current_price <= max) {
        order.fill_status.entry_filled = true;
        order.fill_status.fill_price = current_price;
        order.fill_status.fill_time = new Date().toISOString();
        order.status = 'filled';
        
        console.log(`🎯 Ghost order filled: ${ref_id} at ${current_price}`);
      }
    }
    
    // Calculate PnL if position is filled
    if (order.fill_status.entry_filled && order.fill_status.fill_price) {
      const fillPrice = order.fill_status.fill_price;
      const pnlCalculation = calculatePnL(order, current_price, fillPrice);
      order.pnl = pnlCalculation;
      
      // Check stop loss
      if (!order.fill_status.sl_hit) {
        const slHit = (order.side === 'LONG' && current_price <= order.sl) ||
                      (order.side === 'SHORT' && current_price >= order.sl);
        
        if (slHit) {
          order.fill_status.sl_hit = true;
          order.status = 'closed';
          order.pnl.realized = order.pnl.unrealized;
          console.log(`🛑 Stop loss hit: ${ref_id} at ${current_price}`);
        }
      }
      
      // Check take profits
      order.tps.forEach((tp: number, index: number) => {
        if (!order.fill_status.tps_hit.includes(index)) {
          const tpHit = (order.side === 'LONG' && current_price >= tp) ||
                        (order.side === 'SHORT' && current_price <= tp);
          
          if (tpHit) {
            order.fill_status.tps_hit.push(index);
            console.log(`🎯 Take profit ${index + 1} hit: ${ref_id} at ${current_price}`);
            
            // Close position if all TPs hit
            if (order.fill_status.tps_hit.length === order.tps.length) {
              order.status = 'closed';
              order.pnl.realized = order.pnl.unrealized;
            }
          }
        }
      });
    }
    
    // Update portfolio if status changed
    if (previousStatus !== order.status) {
      updatePortfolioMetrics();
    }
    
    return {
      success: true,
      ref_id,
      status: order.status,
      pnl: order.pnl,
      fill_status: order.fill_status,
      price_action: {
        current_price,
        entry_zone: order.entry_zone,
        sl: order.sl,
        tps: order.tps
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to update order ${ref_id}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
      ref_id
    };
  }
}

/**
 * 💰 Calculate PnL for a Position
 */
function calculatePnL(order: GhostOrder, currentPrice: number, fillPrice: number) {
  const { side, sizing } = order;
  const coinAmount = sizing.coin_amount;
  
  let pnlUSD;
  
  if (side === 'LONG') {
    pnlUSD = (currentPrice - fillPrice) * coinAmount;
  } else { // SHORT
    pnlUSD = (fillPrice - currentPrice) * coinAmount;
  }
  
  const pnlPercentage = (pnlUSD / sizing.usd_amount) * 100;
  
  return {
    unrealized: parseFloat(pnlUSD.toFixed(2)),
    realized: 0, // Only set when position is closed
    percentage: parseFloat(pnlPercentage.toFixed(2)),
    calculation: {
      side,
      fill_price: fillPrice,
      current_price: currentPrice,
      coin_amount: coinAmount,
      usd_amount: sizing.usd_amount
    }
  };
}

/**
 * 📊 Calculate Portfolio Metrics
 */
function calculatePortfolioMetrics(): PortfolioMetrics {
  const orders = Array.from(ghostOrders.values());
  const filledOrders = orders.filter((order: GhostOrder) => order.fill_status.entry_filled);
  const closedOrders = orders.filter((order: GhostOrder) => order.status === 'closed');
  
  const totalUnrealizedPnL = filledOrders
    .filter((order: GhostOrder) => order.status !== 'closed')
    .reduce((sum: number, order: GhostOrder) => sum + (order.pnl.unrealized || 0), 0);
  
  const totalRealizedPnL = closedOrders
    .reduce((sum: number, order: GhostOrder) => sum + (order.pnl.realized || 0), 0);
  
  const winningTrades = closedOrders.filter((order: GhostOrder) => (order.pnl.realized || 0) > 0).length;
  const winRate = closedOrders.length > 0 ? (winningTrades / closedOrders.length) * 100 : 0;
  
  return {
    equity: portfolio.equity,
    unrealized_pnl: parseFloat(totalUnrealizedPnL.toFixed(2)),
    realized_pnl: parseFloat(totalRealizedPnL.toFixed(2)),
    total_pnl: parseFloat((totalUnrealizedPnL + totalRealizedPnL).toFixed(2)),
    win_rate: parseFloat(winRate.toFixed(1)),
    total_trades: closedOrders.length,
    winning_trades: winningTrades,
    active_positions: filledOrders.filter((order: GhostOrder) => order.status !== 'closed').length,
    pending_orders: orders.filter((order: GhostOrder) => order.status === 'created').length
  };
}

/**
 * 🔄 Update Portfolio Metrics
 */
function updatePortfolioMetrics() {
  const metrics = calculatePortfolioMetrics();
  Object.assign(portfolio, metrics);
}

/**
 * 📊 Start Price Monitoring
 * Monitors prices for all active ghost orders
 */
let priceMonitoringInterval: NodeJS.Timeout | null = null;

function startPriceMonitoring() {
  if (priceMonitoringInterval) return; // Already running
  
  priceMonitoringInterval = setInterval(async () => {
    try {
      const activeOrders = Array.from(ghostOrders.values())
        .filter((order: GhostOrder) => order.status === 'created' || order.status === 'filled');
      
      if (activeOrders.length === 0) {
        stopPriceMonitoring();
        return;
      }
      
      // Group by symbol to minimize API calls
      const symbolGroups = new Map<string, GhostOrder[]>();
      activeOrders.forEach((order: GhostOrder) => {
        if (!symbolGroups.has(order.symbol)) {
          symbolGroups.set(order.symbol, []);
        }
        symbolGroups.get(order.symbol)!.push(order);
      });
      
      // Update prices for each symbol
      for (const [symbol, orders] of Array.from(symbolGroups.entries())) {
        try {
          const priceData = await fetchUnifiedEndpoint('ticker', { symbol: symbol }, 3000);
          const currentPrice = priceData?.price ?? priceData?.last;
          
          if (currentPrice) {
            // Update all orders for this symbol
            await Promise.all(
              orders.map((order: GhostOrder) => updateOrderStatus(order.ref_id, parseFloat(currentPrice)))
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`⚠️ Price update failed for ${symbol}:`, errorMessage);
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Price monitoring error:', errorMessage);
    }
  }, 10000); // Check every 10 seconds
  
  console.log('📊 Ghost order price monitoring started');
}

/**
 * ⏹️ Stop Price Monitoring
 */
function stopPriceMonitoring() {
  if (priceMonitoringInterval) {
    clearInterval(priceMonitoringInterval);
    priceMonitoringInterval = null;
    console.log('⏹️ Ghost order price monitoring stopped');
  }
}

/**
 * 🔄 Fetch with Timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * 🧹 Cleanup Old Orders
 * Removes old completed orders to prevent memory bloat
 */
export function cleanupOldOrders(maxAge: number = 7 * 24 * 60 * 60 * 1000): number { // 7 days default
  const cutoffTime = Date.now() - maxAge;
  let cleanedCount = 0;
  
  for (const [ref_id, order] of Array.from(ghostOrders.entries())) {
    if (order.status === 'closed' && order.timestamps.created < cutoffTime) {
      ghostOrders.delete(ref_id);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} old ghost orders`);
  }
  
  return cleanedCount;
}

/**
 * 📈 Get Order by Reference ID
 */
export function getGhostOrder(ref_id: string): GhostOrder | null {
  return ghostOrders.get(ref_id) || null;
}

/**
 * 📊 Get Portfolio Summary
 */
export function getPortfolioSummary(): PortfolioMetrics {
  return calculatePortfolioMetrics();
}

// Auto-cleanup old orders every hour
setInterval(() => cleanupOldOrders(), 60 * 60 * 1000);
/**
 * Liquidation Processor Service
 * Ported from Python liquidation heatmap system
 * Handles liquidation event processing, clustering, and statistical analysis
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface LiquidationEvent {
  symbol: string;
  side: 'BUY' | 'SELL'; // BUY = long liquidation, SELL = short liquidation
  price: number;
  quantity: number;
  timestamp: Date;
  exchange: 'binance' | 'okx' | 'bybit';
  estimatedLeverage?: number;
  value: number; // price * quantity
}

export interface LiquidationCluster {
  priceLevel: number;
  totalVolume: number;
  longLiquidationVolume: number;
  shortLiquidationVolume: number;
  liquidationCount: number;
  zScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  averageLeverage: number;
  density: number;
  timestamp: Date;
}

export interface HeatmapData {
  symbol: string;
  clusters: LiquidationCluster[];
  statistics: {
    totalVolume: number;
    longVolume: number;
    shortVolume: number;
    averagePrice: number;
    stdDeviation: number;
    highRiskZones: number;
    dominantSide: 'long' | 'short' | 'neutral';
  };
  timeWindow: string;
  lastUpdate: Date;
}

export interface LeverageTier {
  name: string;
  range: [number, number];
  color: string;
  risk: string;
  count: number;
  percentage: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const LEVERAGE_TIERS = {
  low: { range: [1, 5] as [number, number], color: '#2ecc71', risk: 'Low Risk' },
  moderate: { range: [5, 10] as [number, number], color: '#f39c12', risk: 'Moderate Risk' },
  high: { range: [10, 25] as [number, number], color: '#e74c3c', risk: 'High Risk' },
  very_high: { range: [25, 50] as [number, number], color: '#8e44ad', risk: 'Very High Risk' },
  extreme: { range: [50, 125] as [number, number], color: '#c0392b', risk: 'Extreme Risk' }
};

const EXCHANGE_WEIGHTS = {
  binance: 0.45,
  okx: 0.18,
  bybit: 0.17,
  others: 0.20
};

const TIME_WINDOWS = {
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000
};

// ============================================================================
// LIQUIDATION PROCESSOR CLASS
// ============================================================================

export class LiquidationProcessor extends EventEmitter {
  private liquidationEvents: Map<string, LiquidationEvent[]> = new Map();
  private maxEventsPerSymbol: number = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startCleanupTask();
  }

  /**
   * Add a liquidation event to the processor
   */
  addLiquidationEvent(event: LiquidationEvent): void {
    const { symbol } = event;

    if (!this.liquidationEvents.has(symbol)) {
      this.liquidationEvents.set(symbol, []);
    }

    const events = this.liquidationEvents.get(symbol)!;
    events.push(event);

    // Keep only recent events (memory management)
    if (events.length > this.maxEventsPerSymbol) {
      events.splice(0, events.length - this.maxEventsPerSymbol);
    }

    this.emit('liquidation', event);
  }

  /**
   * Get liquidation events for a symbol within a time window
   */
  getLiquidationEvents(
    symbol: string,
    timeWindow: keyof typeof TIME_WINDOWS = '1h'
  ): LiquidationEvent[] {
    const events = this.liquidationEvents.get(symbol) || [];
    const windowMs = TIME_WINDOWS[timeWindow];
    const cutoffTime = new Date(Date.now() - windowMs);

    return events.filter(event => event.timestamp >= cutoffTime);
  }

  /**
   * Generate heatmap data with clustering and statistical analysis
   */
  generateHeatmapData(
    symbol: string,
    timeWindow: keyof typeof TIME_WINDOWS = '1h',
    options: {
      kdeBandwidth?: number;
      priceRange?: number;
      minClusterSize?: number;
    } = {}
  ): HeatmapData {
    const {
      kdeBandwidth = 0.3,
      priceRange = 15,
      minClusterSize = 3
    } = options;

    const events = this.getLiquidationEvents(symbol, timeWindow);

    if (events.length === 0) {
      return this.getEmptyHeatmapData(symbol, timeWindow);
    }

    // Calculate current price (average of recent events)
    const currentPrice = this.calculateCurrentPrice(events);

    // Filter events within price range
    const priceMin = currentPrice * (1 - priceRange / 100);
    const priceMax = currentPrice * (1 + priceRange / 100);
    const filteredEvents = events.filter(
      e => e.price >= priceMin && e.price <= priceMax
    );

    // Create price buckets and cluster liquidations
    const clusters = this.createClusters(
      filteredEvents,
      currentPrice,
      kdeBandwidth,
      minClusterSize
    );

    // Calculate statistics
    const statistics = this.calculateStatistics(filteredEvents, clusters);

    return {
      symbol,
      clusters,
      statistics,
      timeWindow,
      lastUpdate: new Date()
    };
  }

  /**
   * Create liquidation clusters using KDE-inspired binning
   */
  private createClusters(
    events: LiquidationEvent[],
    currentPrice: number,
    bandwidth: number,
    minClusterSize: number
  ): LiquidationCluster[] {
    if (events.length === 0) return [];

    // Determine price range
    const prices = events.map(e => e.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // Create bins (100 bins for high resolution)
    const numBins = 100;
    const binSize = priceRange / numBins;
    const bins: Map<number, LiquidationEvent[]> = new Map();

    // Assign events to bins
    events.forEach(event => {
      const binIndex = Math.floor((event.price - minPrice) / binSize);
      const binPrice = minPrice + (binIndex + 0.5) * binSize;

      if (!bins.has(binPrice)) {
        bins.set(binPrice, []);
      }
      bins.get(binPrice)!.push(event);
    });

    // Convert bins to clusters
    const clusters: LiquidationCluster[] = [];

    bins.forEach((binEvents, priceLevel) => {
      if (binEvents.length < minClusterSize) return;

      const longLiquidations = binEvents.filter(e => e.side === 'BUY');
      const shortLiquidations = binEvents.filter(e => e.side === 'SELL');

      const longVolume = longLiquidations.reduce((sum, e) => sum + e.value, 0);
      const shortVolume = shortLiquidations.reduce((sum, e) => sum + e.value, 0);
      const totalVolume = longVolume + shortVolume;

      // Calculate average leverage
      const leverages = binEvents
        .map(e => e.estimatedLeverage)
        .filter((l): l is number => l !== undefined);
      const averageLeverage = leverages.length > 0
        ? leverages.reduce((sum, l) => sum + l, 0) / leverages.length
        : 10;

      // Calculate density (events per price unit)
      const density = binEvents.length / binSize;

      clusters.push({
        priceLevel,
        totalVolume,
        longLiquidationVolume: longVolume,
        shortLiquidationVolume: shortVolume,
        liquidationCount: binEvents.length,
        zScore: 0, // Will be calculated later
        riskLevel: 'low',
        averageLeverage,
        density,
        timestamp: new Date()
      });
    });

    // Calculate Z-scores and risk levels
    this.calculateZScores(clusters);
    this.assignRiskLevels(clusters);

    // Sort by price level
    clusters.sort((a, b) => a.priceLevel - b.priceLevel);

    return clusters;
  }

  /**
   * Calculate Z-scores for clusters
   */
  private calculateZScores(clusters: LiquidationCluster[]): void {
    if (clusters.length === 0) return;

    const volumes = clusters.map(c => c.totalVolume);
    const mean = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    const variance = volumes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / volumes.length;
    const stdDev = Math.sqrt(variance);

    clusters.forEach(cluster => {
      cluster.zScore = stdDev > 0 ? (cluster.totalVolume - mean) / stdDev : 0;
    });
  }

  /**
   * Assign risk levels based on Z-scores
   */
  private assignRiskLevels(clusters: LiquidationCluster[]): void {
    clusters.forEach(cluster => {
      const absZScore = Math.abs(cluster.zScore);

      if (absZScore >= 3) {
        cluster.riskLevel = 'extreme';
      } else if (absZScore >= 2) {
        cluster.riskLevel = 'high';
      } else if (absZScore >= 1) {
        cluster.riskLevel = 'moderate';
      } else {
        cluster.riskLevel = 'low';
      }
    });
  }

  /**
   * Calculate statistics for heatmap data
   */
  private calculateStatistics(
    events: LiquidationEvent[],
    clusters: LiquidationCluster[]
  ): HeatmapData['statistics'] {
    const longEvents = events.filter(e => e.side === 'BUY');
    const shortEvents = events.filter(e => e.side === 'SELL');

    const totalVolume = events.reduce((sum, e) => sum + e.value, 0);
    const longVolume = longEvents.reduce((sum, e) => sum + e.value, 0);
    const shortVolume = shortEvents.reduce((sum, e) => sum + e.value, 0);

    const prices = events.map(e => e.price);
    const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    const variance = prices.reduce((sum, p) => sum + Math.pow(p - averagePrice, 2), 0) / prices.length;
    const stdDeviation = Math.sqrt(variance);

    const highRiskZones = clusters.filter(
      c => c.riskLevel === 'high' || c.riskLevel === 'extreme'
    ).length;

    let dominantSide: 'long' | 'short' | 'neutral' = 'neutral';
    const ratio = longVolume / (shortVolume || 1);
    if (ratio > 1.2) {
      dominantSide = 'long';
    } else if (ratio < 0.8) {
      dominantSide = 'short';
    }

    return {
      totalVolume,
      longVolume,
      shortVolume,
      averagePrice,
      stdDeviation,
      highRiskZones,
      dominantSide
    };
  }

  /**
   * Calculate current price from recent events
   */
  private calculateCurrentPrice(events: LiquidationEvent[]): number {
    const recentEvents = events.slice(-100); // Last 100 events
    const prices = recentEvents.map(e => e.price);
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  }

  /**
   * Get leverage distribution analysis
   */
  getLeverageDistribution(symbol: string, timeWindow: keyof typeof TIME_WINDOWS = '1h'): LeverageTier[] {
    const events = this.getLiquidationEvents(symbol, timeWindow);
    const leverages = events
      .map(e => e.estimatedLeverage)
      .filter((l): l is number => l !== undefined);

    if (leverages.length === 0) {
      return Object.entries(LEVERAGE_TIERS).map(([name, config]) => ({
        name,
        range: config.range,
        color: config.color,
        risk: config.risk,
        count: 0,
        percentage: 0
      }));
    }

    const tierCounts: Record<string, number> = {};
    Object.keys(LEVERAGE_TIERS).forEach(tier => {
      tierCounts[tier] = 0;
    });

    leverages.forEach(leverage => {
      for (const [tierName, tierConfig] of Object.entries(LEVERAGE_TIERS)) {
        const [min, max] = tierConfig.range;
        if (leverage >= min && leverage < max) {
          tierCounts[tierName]++;
          break;
        }
      }
    });

    return Object.entries(LEVERAGE_TIERS).map(([name, config]) => ({
      name,
      range: config.range,
      color: config.color,
      risk: config.risk,
      count: tierCounts[name],
      percentage: (tierCounts[name] / leverages.length) * 100
    }));
  }

  /**
   * Get empty heatmap data structure
   */
  private getEmptyHeatmapData(symbol: string, timeWindow: string): HeatmapData {
    return {
      symbol,
      clusters: [],
      statistics: {
        totalVolume: 0,
        longVolume: 0,
        shortVolume: 0,
        averagePrice: 0,
        stdDeviation: 0,
        highRiskZones: 0,
        dominantSide: 'neutral'
      },
      timeWindow,
      lastUpdate: new Date()
    };
  }

  /**
   * Start cleanup task to remove old events
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoffTime = new Date(Date.now() - TIME_WINDOWS['30d']);

      this.liquidationEvents.forEach((events, symbol) => {
        const filteredEvents = events.filter(e => e.timestamp >= cutoffTime);
        this.liquidationEvents.set(symbol, filteredEvents);
      });
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Stop the processor and cleanup
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.liquidationEvents.clear();
    this.removeAllListeners();
  }

  /**
   * Get all symbols being tracked
   */
  getTrackedSymbols(): string[] {
    return Array.from(this.liquidationEvents.keys());
  }

  /**
   * Get event count for a symbol
   */
  getEventCount(symbol: string): number {
    return this.liquidationEvents.get(symbol)?.length || 0;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const liquidationProcessor = new LiquidationProcessor();

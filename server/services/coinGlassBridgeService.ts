/**
 * CoinGlass Bridge Service
 *
 * Bridges data from CoinGlass Python service (port 8000) to TypeScript Brain
 * Handles fetching, caching, and error handling for derivative data
 */

import axios, { AxiosError } from 'axios';
import { DerivativesData } from '../brain/unifiedSignal';

const PY_BASE = process.env.PY_BASE || 'http://127.0.0.1:8000';
const CACHE_TTL_MS = 60000; // 1 minute cache

interface CoinGlassHealthStatus {
  healthy: boolean;
  lastCheck: number;
  errorCount: number;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class CoinGlassBridgeService {
  private cache = new Map<string, CachedData<any>>();
  private healthStatus: CoinGlassHealthStatus = {
    healthy: true,
    lastCheck: Date.now(),
    errorCount: 0
  };

  constructor() {
    console.log('🌉 [CoinGlassBridge] Service initialized, target:', PY_BASE);
  }

  /**
   * Get comprehensive derivatives data for a symbol
   */
  async getDerivativesData(symbol: string): Promise<DerivativesData | null> {
    const cacheKey = `derivatives:${symbol}`;
    const cached = this.getFromCache<DerivativesData>(cacheKey);
    if (cached) {
      console.log(`📦 [CoinGlassBridge] Cache hit for ${symbol}`);
      return cached;
    }

    try {
      console.log(`🔍 [CoinGlassBridge] Fetching derivatives data for ${symbol}`);

      // Parallel fetch for better performance
      const [oiData, fundingData, longShortData, whaleData] = await Promise.allSettled([
        this.getOpenInterest(symbol),
        this.getFundingRate(symbol),
        this.getLongShortRatio(symbol),
        this.getWhaleActivity(symbol)
      ]);

      // Build derivatives data from results
      const derivatives: DerivativesData = {
        oi_change_percent: oiData.status === 'fulfilled' ? oiData.value : 0,
        funding_rate: fundingData.status === 'fulfilled' ? fundingData.value : 0,
        funding_pressure: this.determineFundingPressure(
          fundingData.status === 'fulfilled' ? fundingData.value : 0
        ),
        long_short_ratio: longShortData.status === 'fulfilled' ? longShortData.value : 1.0,
        whale_activity: whaleData.status === 'fulfilled' ? whaleData.value : 'neutral'
      };

      // Get liquidation zones if available
      const liquidationData = await this.getLiquidationZones(symbol).catch(() => null);
      if (liquidationData) {
        derivatives.liquidation_zone_above = liquidationData.above;
        derivatives.liquidation_zone_below = liquidationData.below;
      }

      // Get ETF flow for BTC
      if (symbol.toUpperCase().includes('BTC')) {
        const etfFlow = await this.getETFFlow().catch(() => null);
        if (etfFlow !== null) {
          derivatives.etf_flow = etfFlow;
        }
      }

      // Cache the result
      this.setCache(cacheKey, derivatives, CACHE_TTL_MS);

      // Mark service as healthy
      this.markHealthy();

      console.log(`✅ [CoinGlassBridge] Derivatives data fetched for ${symbol}`);
      return derivatives;

    } catch (error) {
      console.error(`❌ [CoinGlassBridge] Failed to fetch derivatives for ${symbol}:`, error);
      this.markUnhealthy();
      return null;
    }
  }

  /**
   * Get Open Interest change percentage
   */
  private async getOpenInterest(symbol: string): Promise<number> {
    try {
      const response = await axios.post(
        `${PY_BASE}/gpts/advanced`,
        {
          op: 'oi_history',
          params: { symbol, interval: '1h' }
        },
        { timeout: 5000 }
      );

      if (response.data && Array.isArray(response.data.data) && response.data.data.length >= 2) {
        const data = response.data.data;
        const latest = data[data.length - 1];
        const previous = data[data.length - 2];

        if (latest.openInterest && previous.openInterest) {
          const change = ((latest.openInterest - previous.openInterest) / previous.openInterest) * 100;
          return change;
        }
      }

      return 0;
    } catch (error) {
      console.warn(`⚠️ [CoinGlassBridge] OI fetch failed for ${symbol}`);
      return 0;
    }
  }

  /**
   * Get current funding rate
   */
  private async getFundingRate(symbol: string): Promise<number> {
    try {
      const response = await axios.post(
        `${PY_BASE}/gpts/advanced`,
        {
          op: 'funding_rate',
          params: { symbol, interval: '8h' }
        },
        { timeout: 5000 }
      );

      if (response.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        const latest = response.data.data[response.data.data.length - 1];
        return latest.fundingRate || 0;
      }

      return 0;
    } catch (error) {
      console.warn(`⚠️ [CoinGlassBridge] Funding rate fetch failed for ${symbol}`);
      return 0;
    }
  }

  /**
   * Get long/short ratio
   */
  private async getLongShortRatio(symbol: string): Promise<number> {
    try {
      const response = await axios.post(
        `${PY_BASE}/gpts/advanced`,
        {
          op: 'long_short_ratio',
          params: { symbol, interval: '1h' }
        },
        { timeout: 5000 }
      );

      if (response.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
        const latest = response.data.data[response.data.data.length - 1];
        return latest.longShortRatio || 1.0;
      }

      return 1.0;
    } catch (error) {
      console.warn(`⚠️ [CoinGlassBridge] Long/short ratio fetch failed for ${symbol}`);
      return 1.0;
    }
  }

  /**
   * Get whale activity signal
   */
  private async getWhaleActivity(symbol?: string): Promise<'accumulation' | 'distribution' | 'neutral'> {
    try {
      const response = await axios.post(
        `${PY_BASE}/gpts/advanced`,
        {
          op: 'whale_alerts',
          params: { exchange: 'hyperliquid' }
        },
        { timeout: 5000 }
      );

      if (response.data && Array.isArray(response.data)) {
        const recentAlerts = response.data.slice(-10); // Last 10 whale alerts

        let buyCount = 0;
        let sellCount = 0;

        for (const alert of recentAlerts) {
          if (alert.side?.toLowerCase() === 'buy') buyCount++;
          if (alert.side?.toLowerCase() === 'sell') sellCount++;
        }

        if (buyCount > sellCount * 1.5) return 'accumulation';
        if (sellCount > buyCount * 1.5) return 'distribution';
      }

      return 'neutral';
    } catch (error) {
      console.warn(`⚠️ [CoinGlassBridge] Whale activity fetch failed`);
      return 'neutral';
    }
  }

  /**
   * Get liquidation zones from heatmap
   */
  private async getLiquidationZones(symbol: string): Promise<{ above: number; below: number } | null> {
    try {
      const response = await axios.post(
        `${PY_BASE}/gpts/advanced`,
        {
          op: 'liquidation_heatmap',
          params: { symbol }
        },
        { timeout: 5000 }
      );

      if (response.data && response.data.data) {
        // Simplified: find highest liquidation clusters
        const data = response.data.data;
        // This would need proper parsing based on actual heatmap structure
        return {
          above: data.resistance || 0,
          below: data.support || 0
        };
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ [CoinGlassBridge] Liquidation zones fetch failed for ${symbol}`);
      return null;
    }
  }

  /**
   * Get Bitcoin ETF flow
   */
  private async getETFFlow(): Promise<number | null> {
    try {
      const response = await axios.post(
        `${PY_BASE}/gpts/advanced`,
        {
          op: 'etf_flows',
          params: {}
        },
        { timeout: 5000 }
      );

      if (response.data && response.data.data && response.data.data.length > 0) {
        const latest = response.data.data[response.data.data.length - 1];
        return latest.flow_usd || 0;
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ [CoinGlassBridge] ETF flow fetch failed`);
      return null;
    }
  }

  /**
   * Get institutional bias
   */
  async getInstitutionalBias(symbol: string): Promise<'bullish' | 'bearish' | 'neutral'> {
    try {
      const response = await axios.get(
        `${PY_BASE}/advanced/institutional/bias`,
        {
          params: { symbol },
          timeout: 5000
        }
      );

      if (response.data && response.data.bias) {
        return response.data.bias.toLowerCase();
      }

      return 'neutral';
    } catch (error) {
      console.warn(`⚠️ [CoinGlassBridge] Institutional bias fetch failed for ${symbol}`);
      return 'neutral';
    }
  }

  /**
   * Determine funding pressure from funding rate
   */
  private determineFundingPressure(fundingRate: number): 'long' | 'short' | 'neutral' {
    if (fundingRate > 0.01) return 'long';      // Longs paying shorts (bullish pressure)
    if (fundingRate < -0.01) return 'short';    // Shorts paying longs (bearish pressure)
    return 'neutral';
  }

  /**
   * Check if CoinGlass service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${PY_BASE}/health`, { timeout: 3000 });
      this.markHealthy();
      return response.status === 200;
    } catch (error) {
      this.markUnhealthy();
      return false;
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): CoinGlassHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Cache helpers
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Health tracking
   */
  private markHealthy(): void {
    this.healthStatus.healthy = true;
    this.healthStatus.lastCheck = Date.now();
    this.healthStatus.errorCount = 0;
  }

  private markUnhealthy(): void {
    this.healthStatus.errorCount++;
    this.healthStatus.lastCheck = Date.now();

    // Mark unhealthy after 3 consecutive failures
    if (this.healthStatus.errorCount >= 3) {
      this.healthStatus.healthy = false;
      console.error('🚨 [CoinGlassBridge] Service marked as unhealthy after 3 failures');
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 [CoinGlassBridge] Cache cleared');
  }
}

// Export singleton instance
export const coinGlassBridge = new CoinGlassBridgeService();

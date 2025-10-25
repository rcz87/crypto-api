/**
 * Historical Data Fetcher
 *
 * Fetches historical price and derivatives data for backtesting
 */

import { coinAPIService } from '../services/coinapi';
import axios from 'axios';
import { HistoricalCandle, HistoricalDerivatives, MarketState } from './types';

const PY_BASE = process.env.PY_BASE || 'http://127.0.0.1:8000';

export class HistoricalDataFetcher {
  /**
   * Fetch complete historical data for backtesting
   */
  async fetchHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: string = '1h'
  ): Promise<MarketState[]> {
    console.log(`📊 [HistoricalData] Fetching ${symbol} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    try {
      // Fetch in parallel for speed
      const [priceData, derivativesData] = await Promise.all([
        this.fetchPriceData(symbol, startDate, endDate, timeframe),
        this.fetchDerivativesData(symbol, startDate, endDate, timeframe)
      ]);

      console.log(`✅ [HistoricalData] Fetched ${priceData.length} price candles, ${derivativesData.length} derivatives points`);

      // Merge price + derivatives data by timestamp
      const marketStates = this.mergeData(priceData, derivativesData);

      console.log(`✅ [HistoricalData] Created ${marketStates.length} complete market states`);

      return marketStates;

    } catch (error) {
      console.error('❌ [HistoricalData] Failed to fetch historical data:', error);
      throw error;
    }
  }

  /**
   * Fetch price data from CoinAPI
   */
  private async fetchPriceData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: string
  ): Promise<HistoricalCandle[]> {
    try {
      const symbolId = `BINANCE_SPOT_${symbol}_USDT`;

      // CoinAPI timeframe mapping
      const timeframeMap: { [key: string]: string } = {
        '1m': '1MIN',
        '5m': '5MIN',
        '15m': '15MIN',
        '1h': '1HRS',
        '4h': '4HRS',
        '1d': '1DAY'
      };

      const period = timeframeMap[timeframe] || '1HRS';

      // Calculate limit based on time range
      const durationMs = endDate.getTime() - startDate.getTime();
      const periodMs = this.getPeriodMilliseconds(timeframe);
      const limit = Math.ceil(durationMs / periodMs);

      console.log(`📈 [CoinAPI] Fetching ${limit} candles for ${symbolId}`);

      const data = await coinAPIService.getHistoricalData(
        symbolId,
        period,
        startDate,
        endDate,
        Math.min(limit, 10000) // CoinAPI limit
      );

      if (!data || !data.data || data.data.length === 0) {
        console.warn(`⚠️ [CoinAPI] No price data returned for ${symbolId}`);
        return [];
      }

      // Convert to HistoricalCandle format
      const candles: HistoricalCandle[] = data.data.map((candle: any) => ({
        timestamp: new Date(candle.time_period_start).getTime(),
        open: parseFloat(candle.price_open),
        high: parseFloat(candle.price_high),
        low: parseFloat(candle.price_low),
        close: parseFloat(candle.price_close),
        volume: parseFloat(candle.volume_traded || 0)
      }));

      return candles.sort((a, b) => a.timestamp - b.timestamp);

    } catch (error) {
      console.error('❌ [CoinAPI] Failed to fetch price data:', error);
      return [];
    }
  }

  /**
   * Fetch derivatives data from CoinGlass
   */
  private async fetchDerivativesData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: string
  ): Promise<HistoricalDerivatives[]> {
    try {
      // Fetch OI, funding, long/short ratio in parallel
      const [oiData, fundingData, longShortData] = await Promise.allSettled([
        this.fetchOIHistory(symbol, startDate, endDate, timeframe),
        this.fetchFundingHistory(symbol, startDate, endDate, timeframe),
        this.fetchLongShortHistory(symbol, startDate, endDate, timeframe)
      ]);

      // Merge all derivatives data
      const derivatives = this.mergeDerivativesData(
        oiData.status === 'fulfilled' ? oiData.value : [],
        fundingData.status === 'fulfilled' ? fundingData.value : [],
        longShortData.status === 'fulfilled' ? longShortData.value : []
      );

      return derivatives;

    } catch (error) {
      console.error('❌ [CoinGlass] Failed to fetch derivatives data:', error);
      return [];
    }
  }

  /**
   * Fetch Open Interest history from CoinGlass
   */
  private async fetchOIHistory(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: string
  ): Promise<any[]> {
    try {
      const response = await axios.post(
        `${PY_BASE}/gpts/advanced`,
        {
          op: 'oi_history',
          params: {
            symbol,
            interval: timeframe,
            start_time: startDate.getTime(),
            end_time: endDate.getTime()
          }
        },
        { timeout: 30000 }
      );

      return response.data?.data || [];
    } catch (error) {
      console.warn('⚠️ [CoinGlass] OI history fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch Funding Rate history from CoinGlass
   */
  private async fetchFundingHistory(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: string
  ): Promise<any[]> {
    try {
      const response = await axios.post(
        `${PY_BASE}/gpts/advanced`,
        {
          op: 'funding_rate',
          params: {
            symbol,
            interval: '8h', // Funding is always 8h
            start_time: startDate.getTime(),
            end_time: endDate.getTime()
          }
        },
        { timeout: 30000 }
      );

      return response.data?.data || [];
    } catch (error) {
      console.warn('⚠️ [CoinGlass] Funding history fetch failed:', error);
      return [];
    }
  }

  /**
   * Fetch Long/Short Ratio history from CoinGlass
   */
  private async fetchLongShortHistory(
    symbol: string,
    startDate: Date,
    endDate: Date,
    timeframe: string
  ): Promise<any[]> {
    try {
      const response = await axios.post(
        `${PY_BASE}/gpts/advanced`,
        {
          op: 'long_short_ratio',
          params: {
            symbol,
            interval: timeframe,
            start_time: startDate.getTime(),
            end_time: endDate.getTime()
          }
        },
        { timeout: 30000 }
      );

      return response.data?.data || [];
    } catch (error) {
      console.warn('⚠️ [CoinGlass] Long/Short history fetch failed:', error);
      return [];
    }
  }

  /**
   * Merge price and derivatives data by timestamp
   */
  private mergeData(
    priceData: HistoricalCandle[],
    derivativesData: HistoricalDerivatives[]
  ): MarketState[] {
    const marketStates: MarketState[] = [];

    // Create map of derivatives by timestamp
    const derivativesMap = new Map<number, HistoricalDerivatives>();
    derivativesData.forEach(d => {
      derivativesMap.set(d.timestamp, d);
    });

    // Merge with price data
    for (const candle of priceData) {
      const derivatives = derivativesMap.get(candle.timestamp) || this.getDefaultDerivatives(candle.timestamp);

      marketStates.push({
        timestamp: candle.timestamp,
        price: candle,
        derivatives
      });
    }

    return marketStates;
  }

  /**
   * Merge multiple derivatives data sources
   */
  private mergeDerivativesData(
    oiData: any[],
    fundingData: any[],
    longShortData: any[]
  ): HistoricalDerivatives[] {
    const derivativesMap = new Map<number, Partial<HistoricalDerivatives>>();

    // Merge OI data
    oiData.forEach(point => {
      const timestamp = new Date(point.timestamp || point.t).getTime();
      if (!derivativesMap.has(timestamp)) {
        derivativesMap.set(timestamp, { timestamp });
      }
      const entry = derivativesMap.get(timestamp)!;
      entry.oi = point.openInterest || point.oi || 0;
      entry.oi_change_percent = point.oiChange || 0;
    });

    // Merge Funding data
    fundingData.forEach(point => {
      const timestamp = new Date(point.timestamp || point.t).getTime();
      if (!derivativesMap.has(timestamp)) {
        derivativesMap.set(timestamp, { timestamp });
      }
      const entry = derivativesMap.get(timestamp)!;
      entry.funding_rate = point.fundingRate || point.fr || 0;
    });

    // Merge Long/Short data
    longShortData.forEach(point => {
      const timestamp = new Date(point.timestamp || point.t).getTime();
      if (!derivativesMap.has(timestamp)) {
        derivativesMap.set(timestamp, { timestamp });
      }
      const entry = derivativesMap.get(timestamp)!;
      entry.long_short_ratio = point.longShortRatio || point.ratio || 1.0;
    });

    // Convert to array and fill missing values
    const derivatives: HistoricalDerivatives[] = Array.from(derivativesMap.values()).map(d => ({
      timestamp: d.timestamp!,
      oi: d.oi || 0,
      oi_change_percent: d.oi_change_percent || 0,
      funding_rate: d.funding_rate || 0,
      long_short_ratio: d.long_short_ratio || 1.0,
      liquidations_long: 0,
      liquidations_short: 0
    }));

    return derivatives.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get default derivatives when data is missing
   */
  private getDefaultDerivatives(timestamp: number): HistoricalDerivatives {
    return {
      timestamp,
      oi: 0,
      oi_change_percent: 0,
      funding_rate: 0,
      long_short_ratio: 1.0,
      liquidations_long: 0,
      liquidations_short: 0
    };
  }

  /**
   * Get period duration in milliseconds
   */
  private getPeriodMilliseconds(timeframe: string): number {
    const map: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    return map[timeframe] || 60 * 60 * 1000;
  }
}

// Export singleton
export const historicalDataFetcher = new HistoricalDataFetcher();

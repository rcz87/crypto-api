import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { track404 } from '../services/route404Tracker';

const FEAT = (name: string) =>
  (process.env[`FEATURE_${name}`] ?? 'on').toLowerCase() !== 'off';

export interface WhaleAlert {
  exchange: string;
  symbol: string;
  side: string;
  position_size: number;
  notional_value: number;
  timestamp?: string | number;
  meta?: any;
}

export interface WhaleAlertsResponse {
  ok: boolean;
  module: string;
  symbol?: string;
  alerts: WhaleAlert[];
  counts: {
    total: number;
    large_buys: number;
    large_sells: number;
  };
  used_sources: string[];
  summary: string;
}

export async function getWhaleAlerts(exchange = 'hyperliquid'): Promise<WhaleAlertsResponse> {
  // Use unified POST endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch((process.env.PY_BASE || 'http://127.0.0.1:8000') + '/gpts/advanced', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        op: 'whale_alerts',
        params: {
          exchange: exchange
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      const rawData = await response.json();
      
      // Transform Python response to expected format
      const alerts: WhaleAlert[] = Array.isArray(rawData) ? rawData : (rawData.data || []);
      const largeBuys = alerts.filter(a => a.side?.toLowerCase() === 'buy').length;
      const largeSells = alerts.filter(a => a.side?.toLowerCase() === 'sell').length;
      
      return {
        ok: true,
        module: 'whale_alerts',
        alerts: alerts,
        counts: {
          total: alerts.length,
          large_buys: largeBuys,
          large_sells: largeSells
        },
        used_sources: ['coinglass'],
        summary: `Found ${alerts.length} whale alerts on ${exchange} exchange`
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('[WhaleAlerts] Unified endpoint failed:', error.message);
      throw error;
    }
  } catch (e: any) {
    console.warn('[WhaleAlerts] Primary endpoint failed:', e.message);
    throw e;
  }
}


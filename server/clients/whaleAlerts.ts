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
    const response = await fetch(process.env.PY_BASE || 'http://127.0.0.1:8000' + '/gpts/advanced', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        op: 'whale_alerts',
        params: {
          exchange: exchange
        }
      })
    });

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
      console.warn('[WhaleAlerts] Unified endpoint failed, trying fallback shim');
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }
  catch (e: any) {
    console.warn('[WhaleAlerts] Primary endpoint failed:', e.message);
  }

  // Fallback shim using mock data structure
  if (FEAT('WHALE_ALERTS_SHIM')) {
    console.log(`[WhaleAlerts Client] Using fallback shim for ${exchange}`);
    return await getWhaleAlertsShim(exchange);
  }

  const err: any = new Error('WHALE_ALERTS_NOT_AVAILABLE');
  err.cause = lastErr;
  throw err;
}

async function getWhaleAlertsShim(exchange: string): Promise<WhaleAlertsResponse> {
  // Mock whale alerts data for fallback
  const mockAlerts: WhaleAlert[] = [
    {
      exchange: exchange,
      symbol: 'BTC-USDT',
      side: 'buy',
      position_size: 50.0,
      notional_value: 2500000,
      timestamp: Date.now(),
      meta: { confidence: 'high' }
    },
    {
      exchange: exchange,
      symbol: 'ETH-USDT',
      side: 'sell',
      position_size: 800.0,
      notional_value: 1800000,
      timestamp: Date.now() - 300000,
      meta: { confidence: 'medium' }
    }
  ];

  return {
    ok: true,
    module: 'whale_alerts',
    alerts: mockAlerts,
    counts: {
      total: mockAlerts.length,
      large_buys: mockAlerts.filter(a => a.side === 'buy').length,
      large_sells: mockAlerts.filter(a => a.side === 'sell').length
    },
    used_sources: ['fallback_shim'],
    summary: `Fallback whale alerts data for ${exchange} (${mockAlerts.length} alerts)`
  };
}
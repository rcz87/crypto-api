import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { track404 } from '../services/route404Tracker';

const FEAT = (name: string) =>
  (process.env[`FEATURE_${name}`] ?? 'on').toLowerCase() !== 'off';

export async function getSpotOrderbook(symbol: string, exchange = 'binance', depth = 50) {
  const spot = normalizeSymbol(symbol, 'spot');         // 'SOLUSDT'

  // Use unified POST endpoint
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  
  try {
    const response = await fetch((process.env.PY_BASE || 'http://127.0.0.1:8000') + '/gpts/advanced', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        op: 'spot_orderbook',
        params: {
          symbol: spot,
          exchange: exchange,
          depth: depth
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      return await response.json();
    } else {
      if (response.status === 404) {
        track404('spot_ob');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.message?.includes('404')) {
      track404('spot_ob');
    }
    console.warn('[SpotOrderbook] Unified endpoint failed:', error.message);
    throw error;
  }
}
import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { track404 } from '../services/route404Tracker';

export type HeatmapTF = '5m' | '15m' | '1h' | '4h' | '1d';

const FEAT = (name: string) =>
  (process.env[`FEATURE_${name}`] ?? 'on').toLowerCase() !== 'off';

export async function getHeatmap(symbol: string, timeframe: HeatmapTF = '1h') {
  const sym = normalizeSymbol(symbol, 'derivatives');

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
        op: 'liquidation_heatmap',
        params: {
          symbol: sym,
          timeframe: timeframe
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        track404('heatmap');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.message?.includes('404')) {
      track404('heatmap');
    }
    console.warn('[Heatmap] Unified endpoint failed:', error.message);
    throw error;
  }
}
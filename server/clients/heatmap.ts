import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { heatmapApproxSOL } from '../shims/heatmapShim';
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
  catch (e: any) {
    if (e.message?.includes('404')) {
      track404('heatmap');
    }
    
    // SHIM fallback (optional)
    if (FEAT('HEATMAP_SHIM')) {
      try {
        const shim = await heatmapApproxSOL(timeframe);
        return shim; // shape agreed upon (see documentation below)
      } catch (shimErr: any) {
        // fall through to structured error
      }
    }

    const err: any = new Error('HEATMAP_NOT_AVAILABLE');
    err.cause = e; 
    throw err;
  }
}
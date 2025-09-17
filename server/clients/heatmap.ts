import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { heatmapApproxSOL } from '../shims/heatmapShim';
import { track404 } from '../services/route404Tracker';

export type HeatmapTF = '5m' | '15m' | '1h' | '4h' | '1d';

const FEAT = (name: string) =>
  (process.env[`FEATURE_${name}`] ?? 'on').toLowerCase() !== 'off';

export async function getHeatmap(symbol: string, timeframe: HeatmapTF = '1h') {
  const map = await getApiMap();
  const base = map['heatmap'] || '/advanced/liquidation/heatmap';
  const sym = normalizeSymbol(symbol, 'derivatives');

  const candidates = [
    `${base}?symbol=${encodeURIComponent(sym)}&timeframe=${timeframe}`,
    `${base}/${encodeURIComponent(sym)}?timeframe=${timeframe}`,
    `${base}?asset=${encodeURIComponent(sym)}&tf=${timeframe}`,
  ];

  let lastErr: any;
  for (const url of candidates) {
    try { 
      return await getJson(url); 
    }
    catch (e: any) {
      if (e.status === 404) { 
        track404('heatmap'); 
        lastErr = e; 
        continue; 
      }
      throw e;
    }
  }

  // SHIM fallback (optional)
  if (FEAT('HEATMAP_SHIM')) {
    try {
      const shim = await heatmapApproxSOL(timeframe);
      return shim; // shape agreed upon (see documentation below)
    } catch (e: any) {
      // fall through to structured error
    }
  }

  const err: any = new Error('HEATMAP_NOT_AVAILABLE');
  err.cause = lastErr; 
  throw err;
}
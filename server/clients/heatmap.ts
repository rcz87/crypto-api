import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';

export type HeatmapTF = '5m' | '15m' | '1h' | '4h' | '1d';

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
    } catch (e: any) {
      if (e.status !== 404) throw e;
      lastErr = e;
    }
  }
  const err: any = new Error('HEATMAP_NOT_AVAILABLE');
  err.cause = lastErr;
  throw err;
}
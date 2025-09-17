import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { fetchSpotOrderbookShim } from '../shims/spotOrderbookShim';
import { track404 } from '../services/route404Tracker';

const FEAT = (name: string) =>
  (process.env[`FEATURE_${name}`] ?? 'on').toLowerCase() !== 'off';

export async function getSpotOrderbook(symbol: string, exchange = 'binance', depth = 50) {
  const map = await getApiMap();
  const base = map['spot_ob'] || '/advanced/spot/orderbook';

  const spot = normalizeSymbol(symbol, 'spot');         // 'SOLUSDT'
  const instId = `${spot.replace('USDT', '')}-USDT`;    // 'SOL-USDT' for OKX

  const candidates = [
    `${base}?symbol=${spot}&exchange=${exchange}&depth=${depth}`,
    `${base}/${exchange}/${spot}?depth=${depth}`,
    `${base}/${spot}?ex=${exchange}&limit=${depth}`,
  ];

  let lastErr: any;
  for (const url of candidates) {
    try { 
      return await getJson(url); 
    }
    catch (e: any) {
      if (e.status === 404) { 
        track404('spot_ob'); 
        lastErr = e; 
        continue; 
      }
      // 402/429/5xx etc — don't skip, try shim
      lastErr = e; 
      break;
    }
  }

  if (FEAT('SPOT_OB_SHIM')) {
    console.log(`[SpotOB Client] Attempting OKX shim fallback: ${instId} (${spot})`);
    return await fetchSpotOrderbookShim(instId, spot, depth);
  }

  const err: any = new Error('SPOT_OB_NOT_AVAILABLE');
  err.cause = lastErr; 
  throw err;
}
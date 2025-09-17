import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { fetchSpotOrderbookBinance } from '../shims/spotOrderbookShim';
import { track404 } from '../services/route404Tracker';

const FEAT = (name: string) =>
  (process.env[`FEATURE_${name}`] ?? 'on').toLowerCase() !== 'off';

export async function getSpotOrderbook(
  symbol: string,
  exchange = 'binance',
  depth = 50
) {
  const map = await getApiMap();
  const base = map['spot_ob'] || '/advanced/spot/orderbook';
  const spot = normalizeSymbol(symbol, 'spot');

  const candidates = [
    `${base}?symbol=${spot}&exchange=${exchange}&depth=${depth}`,
    `${base}/${exchange}/${spot}?depth=${depth}`,
    `${base}/${spot}?ex=${exchange}&limit=${depth}`,
  ];

  let lastErr: any;
  for (const url of candidates) {
    try {
      return await getJson(url);
    } catch (e: any) {
      if (e.status === 404) { 
        track404('spot_ob'); 
        lastErr = e; 
        continue; 
      }
      throw e;
    }
  }

  // SHIM fallback (optional)
  if (FEAT('SPOT_OB_SHIM')) {
    try {
      const shim = await fetchSpotOrderbookBinance(spot, depth);
      return shim; // shape agreed upon (see documentation below)
    } catch (e: any) {
      // fall through to structured error
    }
  }

  const err: any = new Error('SPOT_OB_NOT_AVAILABLE');
  err.cause = lastErr;
  throw err;
}
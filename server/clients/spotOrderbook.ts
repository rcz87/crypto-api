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
  const shimFeatureEnabled = FEAT('SPOT_OB_SHIM');
  console.log(`[SpotOB Client] All primary endpoints failed. FEATURE_SPOT_OB_SHIM=${shimFeatureEnabled}`);
  
  if (shimFeatureEnabled) {
    console.log(`[SpotOB Client] Attempting Binance shim fallback for symbol: ${spot}`);
    try {
      const shim = await fetchSpotOrderbookBinance(spot, depth);
      console.log(`[SpotOB Client] ✅ Shim fallback SUCCESS: ${shim.source} with ${shim.bids.length} bids, ${shim.asks.length} asks`);
      return shim; // shape agreed upon (see documentation below)
    } catch (e: any) {
      console.error(`[SpotOB Client] ❌ Shim fallback FAILED:`, e.message);
      console.error(`[SpotOB Client] Shim error details:`, {
        name: e.name,
        status: e.status,
        cause: e.cause?.message || 'none'
      });
      // fall through to structured error
    }
  } else {
    console.log(`[SpotOB Client] Shim disabled, proceeding to final error`);
  }

  console.log(`[SpotOB Client] Final error: SPOT_OB_NOT_AVAILABLE (tried ${candidates.length} endpoints)`);
  const err: any = new Error('SPOT_OB_NOT_AVAILABLE');
  err.cause = lastErr;
  throw err;
}
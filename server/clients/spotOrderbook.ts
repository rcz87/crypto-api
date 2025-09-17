import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';

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
      if (e.status !== 404) throw e;
      lastErr = e;
    }
  }
  const err: any = new Error('SPOT_OB_NOT_AVAILABLE');
  err.cause = lastErr;
  throw err;
}
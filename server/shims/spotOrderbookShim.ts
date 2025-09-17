/**
 * Spot Orderbook Shim - Fallback to direct exchange APIs when native endpoints are unavailable
 */

type DepthSide = Array<{ price: number; qty: number }>;
export type SpotOB = { 
  bids: DepthSide; 
  asks: DepthSide; 
  ts: number; 
  source: string 
};

export async function fetchSpotOrderbookBinance(
  symbol = 'SOLUSDT',
  limit = 50
): Promise<SpotOB> {
  const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${limit}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`BINANCE_DEPTH_${r.status}`);
  const j = await r.json();
  const toSide = (arr: any[]) => arr.map(([p, q]: any[]) => ({ price: +p, qty: +q }));
  return {
    bids: toSide(j.bids),
    asks: toSide(j.asks),
    ts: Date.now(),
    source: 'shim-binance',
  };
}
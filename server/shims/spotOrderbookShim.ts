/**
 * Spot Orderbook Shim - OKX-first fallback (geo-friendly)
 */

import { robustFetch } from '../net/fetchHelper';

type DepthSide = Array<{ price: number; qty: number }>;
export type SpotOB = { 
  bids: DepthSide; 
  asks: DepthSide; 
  ts: number; 
  source: string 
};

function sortBook(bids: DepthSide, asks: DepthSide): {bids: DepthSide, asks: DepthSide} {
  return {
    bids: bids.slice().sort((a, b) => b.price - a.price),
    asks: asks.slice().sort((a, b) => a.price - b.price),
  };
}

/** OKX spot depth — instId example: 'SOL-USDT' */
async function fetchOKXDepth(instId = 'SOL-USDT', sz = 50): Promise<SpotOB> {
  const url = `https://www.okx.com/api/v5/market/books?instId=${instId}&sz=${sz}`;
  const response = await robustFetch(url, { label: 'okx_books' });
  if (!response) throw new Error('OKX_FETCH_FAILED');
  const j = await response.json();
  const d = j?.data?.[0];
  if (!d) throw new Error('OKX_BOOKS_EMPTY');
  const toSide = (arr: any[]) => arr.map(([p, q]: [string, string]) => ({ price: +p, qty: +q }));
  const { bids, asks } = sortBook(toSide(d.bids), toSide(d.asks));
  return { bids, asks, ts: Date.now(), source: 'shim-okx' };
}

/** Orchestrator: OKX primary fallback */
export async function fetchSpotOrderbookShim(instId = 'SOL-USDT', symbol = 'SOLUSDT', depth = 50): Promise<SpotOB> {
  // Priority from ENV, default okx only (since other exchanges are geo-blocked)
  const providers = (process.env.PROVIDERS_SPOT_OB ?? 'okx')
    .split(',').map(s => s.trim().toLowerCase());

  const tries: Array<() => Promise<SpotOB>> = [];
  for (const p of providers) {
    if (p === 'okx') tries.push(() => fetchOKXDepth(instId, depth));
    // Note: Binance and Bybit are geo-blocked, so we don't include them
  }

  const errors: string[] = [];
  for (const fn of tries) {
    try {
      const res = await fn();
      console.log(`[SPOT_OB] using shim: ${res.source}`);
      return res;
    } catch (e: any) {
      errors.push(e?.message || String(e));
    }
  }
  const err: any = new Error('SPOT_OB_SHIM_FAILED');
  err.providers = providers; 
  err.errors = errors;
  throw err;
}

// Legacy compatibility - keep this for backward compatibility but use OKX
export async function fetchSpotOrderbookBinance(
  symbol = 'SOLUSDT',
  limit = 50
): Promise<SpotOB> {
  // Convert to OKX format and use OKX instead
  const instId = `${symbol.replace('USDT', '')}-USDT`;
  return fetchOKXDepth(instId, limit);
}
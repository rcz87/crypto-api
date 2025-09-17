/**
 * Normalisasi simbol agar konsisten lintas modul:
 * - Spot   : SOL -> SOLUSDT
 * - Deriv  : SOL/SOLUSDT -> SOL-USDT-SWAP (OKX style)
 */
export type MarketType = 'spot' | 'derivatives';

export function normalizeSymbol(input: string, market: MarketType): string {
  const s = input.replace(/[:/]/g, '').toUpperCase();
  if (market === 'spot') {
    if (s === 'SOL') return 'SOLUSDT';
    return s.includes('USDT') ? s : `${s}USDT`;
  }
  // derivatives
  if (s.includes('-USDT-SWAP')) return s;
  if (s === 'SOL' || s === 'SOLUSDT') return 'SOL-USDT-SWAP';
  const base = s.replace('USDT', '');
  return `${base}-USDT-SWAP`;
}
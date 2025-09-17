/**
 * Symbol normalization utilities for OKX perpetual futures
 */

const DEFAULT_QUOTE = "USDT";
const DEFAULT_INSTR = "SWAP";

/**
 * Normalize symbol to OKX perpetual format
 * Examples:
 *   "btc"  → "BTC-USDT-SWAP"
 *   "BTC-USDT" → "BTC-USDT-SWAP" (lengkapi instr)
 *   "BTC-USD-SWAP" → tetap
 */
export function normalizePerp(symbol: string): string {
  const s = (symbol || "").toUpperCase().trim();

  // Sudah lengkap?
  if (/-[A-Z]+-(SWAP|PERP|FUTURES)$/.test(s)) return s;

  // "BTC-USDT" → "BTC-USDT-SWAP"
  if (/^[A-Z]+-[A-Z]+$/.test(s)) return `${s}-${DEFAULT_INSTR}`;

  // "BTC" → "BTC-USDT-SWAP"
  if (/^[A-Z]+$/.test(s)) return `${s}-${DEFAULT_QUOTE}-${DEFAULT_INSTR}`;

  // Fallback: biarkan apa adanya
  return s;
}
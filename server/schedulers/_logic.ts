/**
 * Pure functions for scheduler logic - easier to test
 */

export type BiasOk = { ok: true; data: any; symbol: string };
export type BiasUnavailable = { ok?: false; unavailable: true; status: 404; symbol: string; reason?: string };
export type BiasError = Error;

/**
 * Update fail counter based on result type
 * 404 unavailable is NOT considered a failure
 */
export function updateFailCounter(prev: number, result: BiasOk | BiasUnavailable | BiasError): number {
  // 404: unavailable → bukan failure
  if ((result as any)?.unavailable === true) return 0;

  // Error object → failure +1
  if (result instanceof Error) return Math.min(10, prev + 1);

  // OK → reset
  if ((result as any)?.ok === true) return 0;

  // Default: treat as failure-safe
  return Math.min(10, prev + 1);
}
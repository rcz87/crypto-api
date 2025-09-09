// ======================================================================
// Fees Helper — maker/taker & rebates, per-exchange profiles
// Author: GPT-5 Thinking (RICOZ)
// ======================================================================

export type FeeProfile = {
  taker: number;     // e.g., 0.0005
  maker: number;     // e.g., 0.0002
  rebate?: number;   // negative fee if any (rare)
};

export const FeeProfiles: Record<string, FeeProfile> = {
  OKX_PERP_DEFAULT: { taker: 0.0005, maker: 0.0002 },
  BINANCE_PERP_DEFAULT: { taker: 0.0004, maker: 0.0002 },
};

export function estimateTradeFees(notional:number, profile:FeeProfile, isMaker:boolean): number {
  const rate = isMaker ? profile.maker : profile.taker;
  const gross = notional * rate;
  const rebate = profile.rebate ? -notional * profile.rebate : 0;
  return Math.max(0, gross + rebate);
}

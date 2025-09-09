// Fees Helper — Maker/taker rates & rebates, per-exchange profiles
// Professional fee calculation for multi-exchange trading

export type FeeProfile = {
  taker: number;              // taker fee rate (e.g., 0.0005 = 0.05%)
  maker: number;              // maker fee rate (e.g., 0.0002 = 0.02%)
  rebate?: number;            // negative fee if any (rare)
  minFee?: number;            // minimum fee amount
  maxFee?: number;            // maximum fee cap
};

// Exchange-specific fee profiles
export const FeeProfiles: Record<string, FeeProfile> = {
  // Perpetual Futures
  OKX_PERP_DEFAULT: { 
    taker: 0.0005, 
    maker: 0.0002 
  },
  OKX_PERP_VIP1: { 
    taker: 0.00045, 
    maker: 0.00015 
  },
  BINANCE_PERP_DEFAULT: { 
    taker: 0.0004, 
    maker: 0.0002 
  },
  BINANCE_PERP_VIP1: { 
    taker: 0.00036, 
    maker: 0.00018 
  },
  BYBIT_PERP_DEFAULT: { 
    taker: 0.0006, 
    maker: 0.0001 
  },
  
  // Spot Trading
  OKX_SPOT_DEFAULT: { 
    taker: 0.0008, 
    maker: 0.0006 
  },
  BINANCE_SPOT_DEFAULT: { 
    taker: 0.001, 
    maker: 0.001 
  },
  
  // High-volume rebate tiers
  INSTITUTIONAL_TIER: { 
    taker: 0.0002, 
    maker: -0.00005, // rebate
    rebate: 0.00005 
  }
};

export function estimateTradeFees(
  notional: number, 
  profile: FeeProfile, 
  isMaker: boolean = false
): number {
  const rate = isMaker ? profile.maker : profile.taker;
  const grossFee = notional * Math.abs(rate);
  
  // Apply rebate if applicable
  const rebateAmount = profile.rebate ? notional * profile.rebate : 0;
  const netFee = grossFee - rebateAmount;
  
  // Apply fee caps/minimums if specified
  let finalFee = Math.max(0, netFee);
  
  if (profile.minFee && finalFee < profile.minFee) {
    finalFee = profile.minFee;
  }
  if (profile.maxFee && finalFee > profile.maxFee) {
    finalFee = profile.maxFee;
  }
  
  return finalFee;
}

// Calculate fee breakdown for complex orders
export function calculateFeeBreakdown(
  orders: Array<{
    notional: number;
    isMaker: boolean;
    profile: FeeProfile;
  }>
): {
  totalFees: number;
  makerFees: number;
  takerFees: number;
  rebates: number;
  breakdown: Array<{
    notional: number;
    fee: number;
    type: 'maker' | 'taker';
  }>;
} {
  let totalFees = 0;
  let makerFees = 0;
  let takerFees = 0;
  let rebates = 0;
  const breakdown: Array<{
    notional: number;
    fee: number;
    type: 'maker' | 'taker';
  }> = [];
  
  orders.forEach(order => {
    const fee = estimateTradeFees(order.notional, order.profile, order.isMaker);
    
    totalFees += fee;
    if (order.isMaker) {
      makerFees += fee;
    } else {
      takerFees += fee;
    }
    
    // Track rebates separately
    if (order.profile.rebate && order.isMaker) {
      rebates += order.notional * order.profile.rebate;
    }
    
    breakdown.push({
      notional: order.notional,
      fee,
      type: order.isMaker ? 'maker' : 'taker'
    });
  });
  
  return {
    totalFees: Math.round(totalFees * 1000000) / 1000000, // 6 decimal precision
    makerFees: Math.round(makerFees * 1000000) / 1000000,
    takerFees: Math.round(takerFees * 1000000) / 1000000,
    rebates: Math.round(rebates * 1000000) / 1000000,
    breakdown
  };
}

// Helper to get appropriate fee profile based on volume
export function getFeeProfileByVolume(
  exchange: 'OKX' | 'BINANCE' | 'BYBIT',
  marketType: 'PERP' | 'SPOT',
  volume30d: number // 30-day volume in USDT
): FeeProfile {
  const baseKey = `${exchange}_${marketType}_`;
  
  // Volume-based tier selection (simplified)
  if (volume30d >= 10000000) { // $10M+ volume
    return FeeProfiles[baseKey + 'VIP1'] || FeeProfiles[baseKey + 'DEFAULT'];
  }
  
  return FeeProfiles[baseKey + 'DEFAULT'];
}

// Real-time fee estimation with market conditions
export function estimateExecutionCost(
  notional: number,
  profile: FeeProfile,
  marketConditions: {
    spreadBps: number;
    slippageBps: number;
    isMakerOrder: boolean;
  }
): {
  tradingFee: number;
  spreadCost: number;
  slippageCost: number;
  totalCost: number;
} {
  const tradingFee = estimateTradeFees(notional, profile, marketConditions.isMakerOrder);
  const spreadCost = notional * (marketConditions.spreadBps / 10000);
  const slippageCost = notional * (marketConditions.slippageBps / 10000);
  
  return {
    tradingFee,
    spreadCost: Math.round(spreadCost * 100) / 100,
    slippageCost: Math.round(slippageCost * 100) / 100,
    totalCost: Math.round((tradingFee + spreadCost + slippageCost) * 100) / 100
  };
}
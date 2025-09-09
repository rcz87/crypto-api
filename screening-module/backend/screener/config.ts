// Configuration untuk Screening Module
export const layerWeights = {
  smc: 1.0,          // paling penting
  indicators: 0.6,
  derivatives: 0.5
} as const;

export const thresholds = {
  buy: 65,  // normalized score
  sell: 35
} as const;

export const security = {
  requireApiKey: true,
  allowedKeys: process.env.API_KEYS?.split(",").map(s => s.trim()).filter(Boolean) || []
};

export const cache = {
  enabled: true,
  ttlSeconds: 20
};

export const timeframes = ["1m","3m","5m","15m","30m","1h","4h","1d"] as const;
export type Timeframe = typeof timeframes[number];
// Market data types for multi-coin support
export interface Ticker {
  symbol: string;
  last: string;
  askPx: string;
  askSz: string;
  bidPx: string;
  bidSz: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string;
  vol24h: string;
  ts: string;
  changePercent?: string;
  change24h?: string;
}

export interface OrderbookLevel {
  price: string;
  quantity: string;
  count: string;
  orders: string;
}

export interface Orderbook {
  symbol: string;
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];
  timestamp: string;
  seqId?: string;
}

export interface Technical {
  symbol: string;
  timeframe: string;
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  ema: {
    ema9: number;
    ema21: number;
    ema50: number;
    ema200: number;
  };
  sma: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  stochastic: {
    k: number;
    d: number;
  };
  atr: number;
  adx: number;
  cci: number;
  williamsPR: number;
  obv: number;
  parabolicSAR: number;
  ichimoku: {
    tenkan: number;
    kijun: number;
    senkou_a: number;
    senkou_b: number;
    chikou: number;
  };
  trend: "bullish" | "bearish" | "neutral";
  momentum: "strong" | "moderate" | "weak";
  volatility: "high" | "medium" | "low";
  signal: "buy" | "sell" | "hold";
  strength: number;
  timestamp: string;
}

export interface FibonacciLevel {
  level: number;
  price: number;
  label: string;
  type: "support" | "resistance";
}

export interface Fibonacci {
  symbol: string;
  timeframe: string;
  levels: FibonacciLevel[];
  trend: "uptrend" | "downtrend";
  timestamp: string;
}

export interface Confluence {
  symbol: string;
  timeframe: string;
  score: number;
  signals: {
    technical: number;
    momentum: number;
    trend: number;
    volume: number;
    volatility: number;
    sentiment: number;
    pattern: number;
    support_resistance: number;
  };
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  confidence: number;
  timestamp: string;
}

export interface TimeframeAnalysis {
  timeframe: string;
  trend: "bullish" | "bearish" | "neutral";
  strength: number;
  rsi: number;
  macd: number;
  signal: "buy" | "sell" | "hold";
}

export interface MultiTimeframe {
  symbol: string;
  analysis: TimeframeAnalysis[];
  consensus: {
    trend: "bullish" | "bearish" | "neutral";
    strength: number;
    signal: "buy" | "sell" | "hold";
    confidence: number;
  };
  timestamp: string;
}

export interface OpenInterest {
  symbol: string;
  openInterest: string;
  openInterestCcy: string;
  oiChange24h: string;
  oiChangePercent24h: string;
  volume24h: string;
  volumeCcy24h: string;
  longShortRatio: string;
  topTraderLongRatio: string;
  topTraderShortRatio: string;
  sentiment: "bullish" | "bearish" | "neutral";
  timestamp: string;
}

export interface FundingData {
  symbol: string;
  fundingRate: string;
  fundingTime: string;
  nextFundingRate: string;
  nextFundingTime: string;
  maxFundingRate: string;
  minFundingRate: string;
  avgFundingRate: string;
  trend: "increasing" | "decreasing" | "stable";
  timestamp: string;
}

export interface AISignal {
  type: string;
  confidence: number;
  direction: "long" | "short" | "neutral";
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  reasoning: string;
  timestamp: string;
}

export interface MarketScreenerItem {
  symbol: string;
  price: string;
  change24h: string;
  changePercent24h: string;
  volume24h: string;
  rsi: number;
  trend: "bullish" | "bearish" | "neutral";
  signal: "buy" | "sell" | "hold";
  confluenceScore: number;
}

export interface CompleteMarketData {
  ticker: Ticker;
  orderbook: Orderbook;
  technical: Technical;
  fibonacci: Fibonacci;
  confluence: Confluence;
  mtf: MultiTimeframe;
  openInterest: OpenInterest;
  funding: FundingData;
  aiSignals?: AISignal[];
  timestamp: string;
}
// Mock data for testing critical algorithms

export const mockCandleData = [
  { 
    timestamp: '1756950000000', 
    open: '200.50', 
    high: '205.75', 
    low: '199.25', 
    close: '204.80', 
    volume: '15420.50' 
  },
  { 
    timestamp: '1756953600000', 
    open: '204.80', 
    high: '210.25', 
    low: '203.10', 
    close: '208.50', 
    volume: '18750.30' 
  },
  { 
    timestamp: '1756957200000', 
    open: '208.50', 
    high: '212.00', 
    low: '206.75', 
    close: '207.25', 
    volume: '22150.75' 
  },
  { 
    timestamp: '1756960800000', 
    open: '207.25', 
    high: '209.80', 
    low: '205.50', 
    close: '206.90', 
    volume: '19850.25' 
  }
];

export const mockTradeData = [
  // Regular trades
  { 
    px: '206.90', 
    sz: '2.5', 
    side: 'buy', 
    ts: '1756962000000',
    tradeId: '1001',
    count: '1'
  },
  { 
    px: '206.88', 
    sz: '1.8', 
    side: 'sell', 
    ts: '1756962001000',
    tradeId: '1002',
    count: '1'
  },
  // Large trades
  { 
    px: '206.92', 
    sz: '15.5', 
    side: 'buy', 
    ts: '1756962002000',
    tradeId: '1003',
    count: '2'
  },
  { 
    px: '206.85', 
    sz: '22.3', 
    side: 'sell', 
    ts: '1756962003000',
    tradeId: '1004',
    count: '3'
  },
  // Whale trades
  { 
    px: '206.95', 
    sz: '85.7', 
    side: 'buy', 
    ts: '1756962004000',
    tradeId: '1005',
    count: '5'
  },
  { 
    px: '206.82', 
    sz: '120.5', 
    side: 'sell', 
    ts: '1756962005000',
    tradeId: '1006',
    count: '8'
  },
  // Institutional trades
  { 
    px: '206.98', 
    sz: '250.0', 
    side: 'buy', 
    ts: '1756962006000',
    tradeId: '1007',
    count: '12'
  }
];

export const mockOrderBook = {
  asks: [
    ['206.92', '50.25', '0', '5'],
    ['206.94', '75.80', '0', '8'],
    ['206.96', '100.50', '0', '12'],
    ['206.98', '125.75', '0', '15']
  ],
  bids: [
    ['206.90', '45.60', '0', '4'],
    ['206.88', '80.25', '0', '7'],
    ['206.86', '95.40', '0', '10'],
    ['206.84', '120.80', '0', '14']
  ],
  ts: '1756962000000',
  checksum: -123456789
};

// Mock classified trades for testing
export const mockClassifiedTrades = [
  {
    id: 'test_1',
    timestamp: '1756962000000',
    price: 206.90,
    size: 2.5,
    side: 'buy' as const,
    isAggressive: false,
    isLarge: false,
    value: 517.25,
    type: 'retail' as const,
    confidence: 65
  },
  {
    id: 'test_2', 
    timestamp: '1756962001000',
    price: 206.92,
    size: 15.5,
    side: 'buy' as const,
    isAggressive: true,
    isLarge: true,
    value: 3207.26,
    type: 'market_taker' as const,
    confidence: 75
  },
  {
    id: 'test_3',
    timestamp: '1756962002000',
    price: 206.95,
    size: 85.7,
    side: 'buy' as const,
    isAggressive: true,
    isLarge: true,
    value: 17735.615,
    type: 'whale' as const,
    confidence: 80
  },
  {
    id: 'test_4',
    timestamp: '1756962003000',
    price: 206.82,
    size: 250.0,
    side: 'buy' as const,
    isAggressive: true,
    isLarge: true,
    value: 51705.0,
    type: 'institutional' as const,
    confidence: 90
  }
];

// Mock volume delta bars
export const mockVolumeDeltas = [
  {
    timestamp: '1756950000000',
    buyVolume: 8500.25,
    sellVolume: 6920.25,
    netVolume: 1580.00,
    cumulativeDelta: '1580.00',
    aggressionRatio: 0.55,
    pattern: null as any,
    volumeProfile: null as any,
    timeframe: '1H'
  },
  {
    timestamp: '1756953600000',
    buyVolume: 12750.60,
    sellVolume: 5999.70,
    netVolume: 6750.90,
    cumulativeDelta: '8330.90',
    aggressionRatio: 0.68,
    pattern: null as any,
    volumeProfile: null as any,
    timeframe: '1H'
  },
  {
    timestamp: '1756957200000',
    buyVolume: 9850.40,
    sellVolume: 12300.35,
    netVolume: -2449.95,
    cumulativeDelta: '5880.95',
    aggressionRatio: 0.44,
    pattern: null as any,
    volumeProfile: null as any,
    timeframe: '1H'
  }
];

// Expected whale activity result for testing
export const expectedWhaleActivity = {
  detected: true,
  direction: 'accumulation' as const,
  strength: 'strong' as const,
  volume: 335.7,
  confidence: 80,
  trades: expect.arrayContaining([
    expect.objectContaining({
      type: 'whale'
    }),
    expect.objectContaining({
      type: 'institutional'
    })
  ])
};

// Expected market structure for SMC testing
export const expectedMarketStructure = {
  trend: 'bullish' as const,
  lastBOS: expect.objectContaining({
    type: 'bullish',
    price: expect.any(String),
    timestamp: expect.any(String)
  }),
  lastCHoCH: null
};
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

/**
 * Ensure symbol has USDT suffix for Binance spot trading
 */
function ensureBinanceSymbol(symbol: string): string {
  const normalized = symbol.replace(/[:/\-_]/g, '').toUpperCase();
  if (normalized.endsWith('USDT')) return normalized;
  
  // Common mappings
  const symbolMappings: Record<string, string> = {
    'SOL': 'SOLUSDT',
    'BTC': 'BTCUSDT', 
    'ETH': 'ETHUSDT',
    'BNB': 'BNBUSDT',
    'ADA': 'ADAUSDT'
  };
  
  return symbolMappings[normalized] || `${normalized}USDT`;
}

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries) break;
      
      // Don't retry client errors (4xx) except rate limits
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        break;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[SpotOB Shim] Retry ${attempt + 1}/${maxRetries} after ${delay}ms delay`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export async function fetchSpotOrderbookBinance(
  symbol = 'SOLUSDT',
  limit = 50
): Promise<SpotOB> {
  const binanceSymbol = ensureBinanceSymbol(symbol);
  console.log(`[SpotOB Shim] Fetching orderbook for ${symbol} -> ${binanceSymbol} (limit: ${limit})`);
  
  const url = `https://api.binance.com/api/v3/depth?symbol=${binanceSymbol}&limit=${limit}`;
  
  try {
    const result = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      
      try {
        const response = await fetch(url, {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': 'CryptoSatX/1.0'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          const error: any = new Error(`Binance API error: ${response.status} ${response.statusText}`);
          error.status = response.status;
          error.response = errorText;
          throw error;
        }
        
        const data = await response.json();
        
        // Validate response structure
        if (!data.bids || !data.asks || !Array.isArray(data.bids) || !Array.isArray(data.asks)) {
          throw new Error('Invalid Binance API response format');
        }
        
        return data;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          const timeoutError: any = new Error('Binance API timeout');
          timeoutError.status = 408;
          throw timeoutError;
        }
        throw fetchError;
      }
    });
    
    const toSide = (arr: any[]) => arr.map(([p, q]: any[]) => ({ 
      price: parseFloat(p), 
      qty: parseFloat(q) 
    }));
    
    const response: SpotOB = {
      bids: toSide(result.bids),
      asks: toSide(result.asks),
      ts: Date.now(),
      source: 'shim-binance',
    };
    
    console.log(`[SpotOB Shim] ✅ SUCCESS: ${response.bids.length} bids, ${response.asks.length} asks`);
    return response;
    
  } catch (error: any) {
    console.error(`[SpotOB Shim] ❌ FAILED for ${binanceSymbol}:`, error.message);
    console.error(`[SpotOB Shim] Error details:`, {
      status: error.status,
      url,
      response: error.response
    });
    throw error;
  }
}
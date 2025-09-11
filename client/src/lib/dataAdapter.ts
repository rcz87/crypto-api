// Unified data adapter for all API calls with symbol parameter
import type { 
  Ticker, 
  Orderbook, 
  Technical, 
  MultiTimeframe,
  OpenInterest,
  FundingData 
} from "@/types/market";

const BASE_URL = import.meta.env.VITE_API_BASE || "";

interface MarketAdapter {
  ticker(symbol: string): Promise<any>;
  orderbook(symbol: string, depth?: number): Promise<any>;
  technical(symbol: string, timeframe?: string): Promise<any>;
  fibonacci(symbol: string, timeframe?: string): Promise<any>;
  confluence(symbol: string, timeframe?: string): Promise<any>;
  mtf(symbol: string): Promise<any>;
  openInterest(symbol: string): Promise<any>;
  funding(symbol: string): Promise<any>;
  complete(symbol: string): Promise<any>;
  aiSignals(symbol: string): Promise<any>;
  screener(symbols: string[]): Promise<any>;
}

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "APIError";
  }
}

async function fetchAPI<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);
    
    // Check content type
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new APIError(
        response.status,
        `Invalid response type (expected JSON, got ${contentType}). Body: ${text.slice(0, 200)}`
      );
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new APIError(
        response.status,
        error.message || `API error: ${response.status}`
      );
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new Error(`Network error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Convert symbol format from SOLUSDT to SOL for API compatibility
function formatSymbolForAPI(symbol: string): string {
  // Remove USDT suffix and convert to uppercase
  return symbol.replace(/USDT$/i, "").toUpperCase();
}

export const marketDataAdapter: MarketAdapter = {
  ticker: async (symbol: string) => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/ticker`);
  },
  
  orderbook: async (symbol: string, depth = 50) => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/orderbook?depth=${depth}`);
  },
  
  technical: async (symbol: string, timeframe = "1h") => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/technical?tf=${timeframe}`);
  },
  
  fibonacci: async (symbol: string, timeframe = "1h") => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/fibonacci?tf=${timeframe}`);
  },
  
  confluence: async (symbol: string, timeframe = "1h") => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/confluence?tf=${timeframe}`);
  },
  
  mtf: async (symbol: string) => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/mtf`);
  },
  
  openInterest: async (symbol: string) => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/oi`);
  },
  
  funding: async (symbol: string) => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/funding`);
  },
  
  complete: async (symbol: string) => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/complete`);
  },
  
  aiSignals: async (symbol: string) => {
    const formattedSymbol = formatSymbolForAPI(symbol);
    return fetchAPI(`${BASE_URL}/api/${formattedSymbol.toLowerCase()}/ai-signals`);
  },
  
  screener: async (symbols: string[]) => {
    const formattedSymbols = symbols.map(s => formatSymbolForAPI(s));
    const response = await fetch(`${BASE_URL}/api/screener`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ symbols: formattedSymbols })
    });
    
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new APIError(
        response.status,
        `Screener error: Expected JSON but got ${contentType}. Response: ${text.slice(0, 200)}`
      );
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new APIError(response.status, error.message || "Screener API error");
    }
    
    return response.json();
  }
};

// Export convenience hooks
export function useTicker(symbol: string) {
  return marketDataAdapter.ticker(symbol);
}

export function useOrderbook(symbol: string, depth?: number) {
  return marketDataAdapter.orderbook(symbol, depth);
}

export function useTechnical(symbol: string, timeframe?: string) {
  return marketDataAdapter.technical(symbol, timeframe);
}

export function useCompleteData(symbol: string) {
  return marketDataAdapter.complete(symbol);
}

export function useAISignals(symbol: string) {
  return marketDataAdapter.aiSignals(symbol);
}
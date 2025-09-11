// Custom hooks for fetching market data with symbol parameter
import { useQuery } from "@tanstack/react-query";
import { marketDataAdapter } from "@/lib/dataAdapter";
import { useSymbol } from "@/contexts/SymbolContext";

export function useMarketTicker(customSymbol?: string) {
  const { symbol } = useSymbol();
  const targetSymbol = customSymbol || symbol;
  
  return useQuery({
    queryKey: ["ticker", targetSymbol],
    queryFn: () => marketDataAdapter.ticker(targetSymbol),
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 4000,
  });
}

export function useMarketOrderbook(customSymbol?: string, depth = 50) {
  const { symbol } = useSymbol();
  const targetSymbol = customSymbol || symbol;
  
  return useQuery({
    queryKey: ["orderbook", targetSymbol, depth],
    queryFn: () => marketDataAdapter.orderbook(targetSymbol, depth),
    refetchInterval: 3000, // Refresh every 3 seconds
    staleTime: 2500,
  });
}

export function useMarketTechnical(customSymbol?: string, timeframe = "1h") {
  const { symbol } = useSymbol();
  const targetSymbol = customSymbol || symbol;
  
  return useQuery({
    queryKey: ["technical", targetSymbol, timeframe],
    queryFn: () => marketDataAdapter.technical(targetSymbol, timeframe),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 25000,
  });
}

export function useMarketComplete(customSymbol?: string) {
  const { symbol } = useSymbol();
  const targetSymbol = customSymbol || symbol;
  
  return useQuery({
    queryKey: ["complete", targetSymbol],
    queryFn: () => marketDataAdapter.complete(targetSymbol),
    refetchInterval: 60000, // Refresh every minute
    staleTime: 55000,
  });
}

export function useMarketAISignals(customSymbol?: string) {
  const { symbol } = useSymbol();
  const targetSymbol = customSymbol || symbol;
  
  return useQuery({
    queryKey: ["ai-signals", targetSymbol],
    queryFn: () => marketDataAdapter.aiSignals(targetSymbol),
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 115000,
  });
}

export function useMarketMTF(customSymbol?: string) {
  const { symbol } = useSymbol();
  const targetSymbol = customSymbol || symbol;
  
  return useQuery({
    queryKey: ["mtf", targetSymbol],
    queryFn: () => marketDataAdapter.mtf(targetSymbol),
    refetchInterval: 60000,
    staleTime: 55000,
  });
}

export function useMarketOI(customSymbol?: string) {
  const { symbol } = useSymbol();
  const targetSymbol = customSymbol || symbol;
  
  return useQuery({
    queryKey: ["open-interest", targetSymbol],
    queryFn: () => marketDataAdapter.openInterest(targetSymbol),
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

export function useMarketFunding(customSymbol?: string) {
  const { symbol } = useSymbol();
  const targetSymbol = customSymbol || symbol;
  
  return useQuery({
    queryKey: ["funding", targetSymbol],
    queryFn: () => marketDataAdapter.funding(targetSymbol),
    refetchInterval: 60000,
    staleTime: 55000,
  });
}

export function useMarketScreener(symbols: string[]) {
  return useQuery({
    queryKey: ["screener", symbols],
    queryFn: () => marketDataAdapter.screener(symbols),
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 115000,
    enabled: symbols.length > 0,
  });
}
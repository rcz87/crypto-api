import { useQuery } from "@tanstack/react-query";
import { useRef, useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { SolCompleteData } from "@shared/schema";
import { NavigationMenu } from "@/components/NavigationMenu";
import { DashboardContent } from "@/components/DashboardContent";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSymbol } from "@/contexts/SymbolContext";
import { marketDataAdapter } from "@/lib/dataAdapter";

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("tradingview");
  const params = useParams();
  const [, setLocation] = useLocation();
  const { symbol, setSymbol } = useSymbol();
  
  // Get symbol from URL or use context symbol
  const urlSymbol = params.symbol?.toUpperCase() || symbol;
  
  // Update context when URL changes
  useEffect(() => {
    if (urlSymbol && urlSymbol !== symbol) {
      setSymbol(urlSymbol);
    }
  }, [urlSymbol]);
  
  // Format symbol for different uses
  const selectedPair = urlSymbol.replace('USDT', '');
  const selectedSymbol = `${selectedPair}/USDT-PERP`;
  
  // Update document title
  useEffect(() => {
    document.title = `CRYPTOSATX | Crypto Dashboard`;
  }, []);
  
  // Map to TradingView compatible symbol
  const selectedTvSymbol = `BINANCE:${selectedPair}USDT`; // e.g., "BINANCE:BTCUSDT", "BINANCE:SOLUSDT"

  const { data: healthData, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ["/health"],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2, // Allow 2 retries
    staleTime: 25000, // Consider stale after 25 seconds
  });

  const { data: metricsData, error: metricsError } = useQuery({
    queryKey: ["/api/metrics"],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2, // Allow 2 retries  
    staleTime: 25000, // Consider stale after 25 seconds
  });

  // Keep REST API as fallback, but only fetch once since WebSocket provides real-time data
  const { data: marketData, isLoading: marketLoading, error: marketError } = useQuery<{ success: boolean; data: SolCompleteData; timestamp: string }>({
    queryKey: [`/api/${selectedPair.toLowerCase()}/complete`], // Use dynamic route for multi-coin support
    refetchInterval: 60000, // Refresh every 60 seconds as fallback
    retry: 2, // Allow 2 retries
    staleTime: 55000, // Cache for 55 seconds
    enabled: true, // Always enable the query
  });

  // Data validation and error handling
  useEffect(() => {
    if (marketError) {
      console.error('Market Data API Error:', marketError.message);
    }
  }, [marketError]);

  // WebSocket connection for real-time data
  const { 
    isConnected: wsConnected, 
    marketData: wsMarketData, 
    systemStatus: wsSystemStatus,
    connectionStatus
  } = useWebSocket();

  const isOnline = (healthData as any)?.data?.status === 'operational';
  
  // Store last valid ticker and order book data
  const lastTickerRef = useRef<any>(null);
  const lastOrderBookRef = useRef<any>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const UPDATE_THROTTLE_MS = 3000; // Update setiap 3 detik saja

  // Handle WebSocket data updates
  useEffect(() => {
    if (!wsMarketData?.arg?.channel || !wsMarketData.data?.length) return;

    switch (wsMarketData.arg.channel) {
      case 'tickers':
        // Handle ticker data
        const tickerData = wsMarketData.data[0];
        const changePercent = tickerData.changePercent || 
          (tickerData.last && tickerData.open24h ? 
            (((parseFloat(tickerData.last) - parseFloat(tickerData.open24h)) / parseFloat(tickerData.open24h)) * 100).toFixed(2) : '0');
        
        lastTickerRef.current = {
          ticker: {
            symbol: tickerData.instId || 'SOL-USDT-SWAP',
            price: tickerData.last,
            change24h: `${parseFloat(changePercent) >= 0 ? '+' : ''}${changePercent}%`,
            high24h: tickerData.high24h,
            low24h: tickerData.low24h,
            volume: tickerData.vol24h,
            tradingVolume24h: (parseFloat(tickerData.last || '0') * parseFloat(tickerData.vol24h || '0')).toFixed(0)
          }
        };
        break;

      case 'books':
        // Handle real-time order book data with throttling
        const bookData = wsMarketData.data[0];
        const now = Date.now();
        
        // Throttle updates - hanya update setiap 3 detik
        if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE_MS) {
          break;
        }
        
        if (bookData?.asks?.length && bookData?.bids?.length) {
          const asks = bookData.asks.slice(0, 20).map((ask: string[]) => ({
            price: parseFloat(ask[0]).toFixed(2),
            size: parseFloat(ask[1]).toFixed(3)
          }));
          const bids = bookData.bids.slice(0, 20).map((bid: string[]) => ({
            price: parseFloat(bid[0]).toFixed(2), 
            size: parseFloat(bid[1]).toFixed(3)
          }));
          const spread = (parseFloat(asks[0]?.price || '0') - parseFloat(bids[0]?.price || '0')).toFixed(4);
          
          // Only update if data significantly changed AND enough time passed
          const prevOrderBook = lastOrderBookRef.current;
          if (!prevOrderBook || 
              Math.abs(parseFloat(spread) - parseFloat(prevOrderBook.spread)) > 0.01 ||
              Math.abs(parseFloat(asks[0]?.price || '0') - parseFloat(prevOrderBook.asks?.[0]?.price || '0')) > 0.05) {
            
            lastOrderBookRef.current = {
              asks,
              bids,
              spread
            };
            lastUpdateTimeRef.current = now;
          }
        }
        break;
    }
  }, [wsMarketData]);

  // Combine WebSocket real-time data with REST fallback
  const restData = (marketData as any)?.data;
  const wsTicker = lastTickerRef.current?.ticker;
  const wsOrderBook = lastOrderBookRef.current;

  const displayMarketData = restData
    ? { 
        ...restData,
        ticker: wsTicker || restData.ticker, // Prioritize WebSocket ticker
        orderBook: wsOrderBook || restData.orderBook, // Prioritize WebSocket order book
      }
    : lastTickerRef.current;
  const isDataLoading = marketLoading && !wsMarketData;

  return (
    <div className="font-inter bg-gray-50 text-gray-900 min-h-screen">
      {/* CoinGlass-style Navigation Menu */}
      <NavigationMenu 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
      />
      
      {/* Main Content Area */}
      <DashboardContent 
        activeSection={activeSection}
        solData={displayMarketData}
        isDataLoading={isDataLoading}
        healthData={healthData}
        metricsData={metricsData}
        healthLoading={healthLoading}
        wsConnected={wsConnected}
        marketData={wsMarketData}
        selectedSymbol={selectedSymbol}
        selectedTvSymbol={selectedTvSymbol}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                © 2024 CryptoSat Intelligence - Advanced Trading Analytics
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-sm text-gray-500">
                Status: {isOnline ? '🟢 Operational' : '🔴 Offline'}
              </div>
              <div className="text-sm text-gray-500">
                WebSocket: {wsConnected ? '🔵 Connected' : '⚫ Disconnected'}
              </div>
              <div className="text-sm text-gray-500">
                Domain: guardiansofthetoken.com
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
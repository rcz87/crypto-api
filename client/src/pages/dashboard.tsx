import { useQuery } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { SolCompleteData } from "@shared/schema";
import { Database, AlertCircle, Radio } from "lucide-react";
import { StatusOverview } from "@/components/status-overview";
import { APIDocumentation } from "@/components/api-documentation";
import { RealTimeData } from "@/components/real-time-data";
import { SystemLogs } from "@/components/system-logs";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { TradingViewWidget } from "@/components/TradingViewWidget";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Dashboard() {
  const { data: healthData, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ["/health"],
    refetchInterval: false, // Disable auto-refresh to reduce errors
    retry: 0, // No retry to prevent spam
    staleTime: Infinity,
  });

  const { data: metricsData, error: metricsError } = useQuery({
    queryKey: ["/api/metrics"],
    refetchInterval: false, // Disable auto-refresh
    retry: 0,
    staleTime: Infinity,
  });

  // Keep REST API as fallback, but only fetch once since WebSocket provides real-time data
  const { data: solData, isLoading: solLoading, error: solError } = useQuery<{ success: boolean; data: SolCompleteData; timestamp: string }>({
    queryKey: ["/api/sol/complete"],
    refetchInterval: false, // Disable auto-refresh completely
    retry: 1, // Allow one retry
    staleTime: 30000, // Cache for 30 seconds
    enabled: true, // Always enable the query
  });

  // Debug log for data fetching
  useEffect(() => {
    console.log('🔍 SOL Data Debug:', { 
      hasData: !!solData, 
      isLoading: solLoading, 
      hasError: !!solError,
      errorMessage: solError?.message,
      orderBookExists: !!solData?.data?.orderBook,
      dataKeys: solData?.data ? Object.keys(solData.data) : []
    });
    if (solData?.data?.orderBook) {
      console.log('📊 Order Book Data:', {
        asks: solData.data.orderBook.asks?.length || 0,
        bids: solData.data.orderBook.bids?.length || 0,
        spread: solData.data.orderBook.spread,
        firstAsk: solData.data.orderBook.asks?.[0],
        firstBid: solData.data.orderBook.bids?.[0]
      });
    }
  }, [solData, solLoading, solError]);

  // WebSocket connection for real-time data
  const { 
    isConnected: wsConnected, 
    marketData, 
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
    if (!marketData?.arg?.channel || !marketData.data?.length) return;

    switch (marketData.arg.channel) {
      case 'tickers':
        // Handle ticker data
        const tickerData = marketData.data[0];
        const changePercent = tickerData.changePercent || 
          (tickerData.last && tickerData.open24h ? 
            (((parseFloat(tickerData.last) - parseFloat(tickerData.open24h)) / parseFloat(tickerData.open24h)) * 100).toFixed(2) : '0');
        
        lastTickerRef.current = {
          ticker: {
            symbol: tickerData.instId || 'SOL-USDT',
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
        const bookData = marketData.data[0];
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
  }, [marketData]);

  // Combine WebSocket real-time data with REST fallback
  const restData = (solData as any)?.data;
  const wsTicker = lastTickerRef.current?.ticker;
  const wsOrderBook = lastOrderBookRef.current;

  const displaySolData = restData
    ? { 
        ...restData,
        ticker: wsTicker || restData.ticker, // Prioritize WebSocket ticker
        orderBook: wsOrderBook || restData.orderBook, // Prioritize WebSocket order book
      }
    : lastTickerRef.current;
  const isDataLoading = solLoading && !marketData;

  // Debug display data
  useEffect(() => {
    console.log('🎯 Display SOL Data:', {
      restData: !!restData,
      wsTicker: !!wsTicker,
      wsOrderBook: !!wsOrderBook,
      displaySolData: !!displaySolData,
      isDataLoading,
      hasOrderBook: !!displaySolData?.orderBook
    });
  }, [restData, wsTicker, wsOrderBook, displaySolData, isDataLoading]);

  return (
    <div className="font-inter bg-gray-50 text-gray-900 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="bg-primary text-white p-2 rounded-lg">
                <Database className="text-xl" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Crypto Data Gateway</h1>
                <p className="text-sm text-gray-500">SOL Trading API Aggregator</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                isOnline ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span className={`text-sm font-medium ${
                  isOnline ? 'text-green-700' : 'text-red-700'
                }`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              
              {/* WebSocket Status */}
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                wsConnected ? 'bg-blue-50' : 'bg-gray-50'
              }`}>
                <Radio className={`w-3 h-3 ${
                  wsConnected ? 'text-blue-500 animate-pulse' : 'text-gray-400'
                }`} />
                <span className={`text-sm font-medium ${
                  wsConnected ? 'text-blue-700' : 'text-gray-500'
                }`}>
                  {wsConnected ? 'Live Stream' : connectionStatus}
                </span>
              </div>
              
              <span className="text-sm text-gray-500">guardiansofthegreentoken.com</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Overview */}
        <StatusOverview 
          healthData={(healthData as any)?.data} 
          metricsData={(metricsData as any)?.data}
          isLoading={healthLoading}
        />

        {/* Professional TradingView Chart */}
        <div className="mt-8">
          <ErrorBoundary>
            <TradingViewWidget 
              data={displaySolData} 
              isConnected={wsConnected}
            />
          </ErrorBoundary>
          
          {/* System Status - Static info only */}
          <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
            <div>🔍 System Status:</div>
            <div>🌐 API Base: {window.location.hostname === 'localhost' ? 'localhost:5000' : 'guardiansofthegreentoken.com'}</div>
            <div>WebSocket: {wsConnected ? '✅ Connected' : '❌ Disconnected'}</div>
            <div>SOL API Data: {(solData as any)?.data ? '✅ Available' : '❌ None'}</div>
            <div>Candles Data: {displaySolData?.candles ? '✅ Available' : '❌ None'}</div>
            {displaySolData?.candles && (
              <div>📊 Candles: 1H({(displaySolData.candles['1H'] || []).length}) 4H({(displaySolData.candles['4H'] || []).length}) 1D({(displaySolData.candles['1D'] || []).length})</div>
            )}
            <div>⚡ Data Source: {wsTicker ? 'WebSocket + REST' : 'REST only'}</div>
            {(healthError || metricsError || solError) && (
              <div className="text-red-600">⚠️ Some API endpoints have errors</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* API Documentation */}
          <APIDocumentation />

          {/* Real-time Data */}
          <RealTimeData 
            solData={displaySolData} 
            isLoading={isDataLoading}
            isLiveStream={wsConnected && !!marketData}
          />
        </div>

        {/* System Logs */}
        <SystemLogs />

        {/* Configuration Panel */}
        <ConfigurationPanel 
          healthData={(healthData as any)?.data}
        />
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <p className="text-sm text-gray-500">© 2024 Crypto Data Gateway</p>
              <span className="text-gray-300">|</span>
              <a 
                href="https://guardiansofthegreentoken.com" 
                className="text-sm text-primary hover:text-blue-700"
                data-testid="link-domain"
              >
                guardiansofthegreentoken.com
              </a>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Database className="w-4 h-4" />
              <span>Powered by Replit</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

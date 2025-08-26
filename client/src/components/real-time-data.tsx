import { TrendingUp, ArrowUp, ArrowDown, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SolCompleteData } from "@shared/schema";

interface RealTimeDataProps {
  solData?: SolCompleteData;
  isLoading: boolean;
  isLiveStream?: boolean;
}

const RealTimeDataComponent = ({ solData, isLoading, isLiveStream = false }: RealTimeDataProps) => {
  // Debug log
  console.log('💡 RealTimeData Component:', { 
    isLoading, 
    hasSolData: !!solData, 
    hasOrderBook: !!solData?.orderBook,
    orderBookAsks: solData?.orderBook?.asks?.length,
    orderBookBids: solData?.orderBook?.bids?.length
  });

  if (isLoading && !solData) {
    return (
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <TrendingUp className="text-primary mr-2" />
            Live SOL Data
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { ticker, orderBook } = solData || {};
  
  // More lenient check - show data if we have either ticker OR orderBook
  if (!ticker && !orderBook) {
    return (
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <TrendingUp className="text-primary mr-2" />
            Live SOL Data
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            <p>Loading market data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const isPositive = ticker?.change24h && (ticker?.change24h.startsWith('+') || !ticker?.change24h.startsWith('-'));
  const changeValue = ticker?.change24h ? ticker?.change24h.replace(/[+%]/g, '') : '0';

  const lastUpdateTime = solData?.lastUpdate ? new Date(solData.lastUpdate).toLocaleString() : 'Unknown';

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center justify-between">
          <div className="flex items-center">
            <TrendingUp className="text-primary mr-2" />
            Live SOL Data
          </div>
          {isLiveStream && (
            <div className="flex items-center space-x-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              <Radio className="w-3 h-3 animate-pulse" />
              <span>Live Stream</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 max-h-screen overflow-hidden">
        {/* Current Price */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500" data-testid="text-symbol">
              {ticker?.symbol || 'SOL-USDT'}
            </span>
            <span className="text-xs text-gray-400">
              Last updated: <span data-testid="text-last-update">{lastUpdateTime}</span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-3xl font-bold text-gray-900" data-testid="text-price">
              ${ticker?.price || '0.00'}
            </span>
            <span className={`px-2 py-1 rounded text-sm font-medium flex items-center ${
              isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isPositive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
              <span data-testid="text-change24h">{ticker?.change24h || '0%'}</span>
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">24h High</p>
            <p className="text-lg font-semibold text-gray-900" data-testid="text-high24h">
              ${ticker?.high24h || '0.00'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">24h Low</p>
            <p className="text-lg font-semibold text-gray-900" data-testid="text-low24h">
              ${ticker?.low24h || '0.00'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Volume</p>
            <p className="text-lg font-semibold text-gray-900" data-testid="text-volume">
              {parseFloat(ticker?.volume || '0').toLocaleString()} SOL
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trading Vol</p>
            <p className="text-lg font-semibold text-gray-900" data-testid="text-trading-volume">
              ${parseFloat(ticker?.tradingVolume24h || '0').toLocaleString()}
            </p>
          </div>
        </div>

        {/* Professional Order Book */}
        {orderBook && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-900 text-white px-4 py-3">
              <h3 className="text-sm font-semibold">Order Book</h3>
            </div>
            
            {/* Header */}
            <div className="grid grid-cols-3 gap-4 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-600 border-b">
              <div className="text-left">Price (USDT)</div>
              <div className="text-right">Amount (SOL)</div>
              <div className="text-right">Total</div>
            </div>

            <div className="h-80 overflow-y-auto bg-gray-50">
            {/* Calculate max size for volume bars */}
            {(() => {
              if (!orderBook?.asks || !orderBook?.bids) {
                return <div className="p-4 text-center text-gray-500">Loading order book...</div>;
              }
              
              const allSizes = [...(orderBook.asks || []), ...(orderBook.bids || [])].map(item => parseFloat(item.size));
              const maxSize = Math.max(...allSizes) || 1;
              
              return (
                <>
                  {/* Asks (Sell Orders) - Show in reverse order */}
                  {(orderBook.asks || []).slice(0, 8).reverse().map((ask, index) => {
                    const sizePercent = (parseFloat(ask.size) / maxSize) * 100;
                    const cumulativeTotal = (orderBook.asks || []).slice(0, (orderBook.asks?.length || 0) - index).reduce((sum, a) => sum + parseFloat(a.size), 0);
                    
                    return (
                      <div 
                        key={`ask-${ask.price}-${index}`} 
                        className="relative group hover:bg-red-50 transition-all duration-300 ease-in-out"
                      >
                        {/* Volume Bar Background */}
                        <div 
                          className="absolute right-0 top-0 h-full bg-red-100 opacity-30 transition-all duration-500 ease-out"
                          style={{ width: `${sizePercent}%` }}
                        />
                        
                        <div className="relative grid grid-cols-3 gap-2 px-3 py-1.5 text-xs font-mono">
                          <div className="text-red-600 font-bold" data-testid={`ask-price-${index}`}>
                            ${ask.price}
                          </div>
                          <div className="text-right text-gray-800 font-medium" data-testid={`ask-size-${index}`}>
                            {ask.size}
                          </div>
                          <div className="text-right text-gray-600 text-xs">
                            {cumulativeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Spread */}
                  <div className="border-t border-b border-gray-300 bg-gray-100 py-2 transition-all duration-500">
                    <div className="text-center text-xs font-medium text-gray-800">
                      <span className="text-gray-600">Spread:</span>{' '}
                      <span className="text-orange-600 font-semibold transition-all duration-300" data-testid="text-spread">
                        ${orderBook.spread}
                      </span>
                      <span className="text-gray-500 ml-2 transition-all duration-300">
                        ({((parseFloat(orderBook.spread) / parseFloat(orderBook.bids[0]?.price || '1')) * 100).toFixed(3)}%)
                      </span>
                    </div>
                  </div>

                  {/* Bids (Buy Orders) */}
                  {(orderBook.bids || []).slice(0, 8).map((bid, index) => {
                    const sizePercent = (parseFloat(bid.size) / maxSize) * 100;
                    const cumulativeTotal = (orderBook.bids || []).slice(0, index + 1).reduce((sum, b) => sum + parseFloat(b.size), 0);
                    
                    return (
                      <div 
                        key={`bid-${bid.price}-${index}`} 
                        className="relative group hover:bg-green-50 transition-all duration-300 ease-in-out"
                      >
                        {/* Volume Bar Background */}
                        <div 
                          className="absolute right-0 top-0 h-full bg-green-100 opacity-30 transition-all duration-500 ease-out"
                          style={{ width: `${sizePercent}%` }}
                        />
                        
                        <div className="relative grid grid-cols-3 gap-2 px-3 py-1.5 text-xs font-mono">
                          <div className="text-green-600 font-bold" data-testid={`bid-price-${index}`}>
                            ${bid.price}
                          </div>
                          <div className="text-right text-gray-800 font-medium" data-testid={`bid-size-${index}`}>
                            {bid.size}
                          </div>
                          <div className="text-right text-gray-600 text-xs">
                            {cumulativeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Export as regular component for now to avoid React.memo issues with Vite
export const RealTimeData = RealTimeDataComponent;

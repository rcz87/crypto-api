import { TrendingUp, ArrowUp, ArrowDown, Radio, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SolCompleteData } from "@shared/schema";
import { useState, useMemo } from "react";

interface RealTimeDataProps {
  solData?: SolCompleteData;
  isLoading: boolean;
  isLiveStream?: boolean;
}

// Helper functions outside component
const groupOrdersByPrecision = (orders: Array<{price: string, size: string}>, tickSize: number) => {
  const grouped: Record<string, number> = {};
  
  orders.forEach(order => {
    const price = parseFloat(order.price);
    const size = parseFloat(order.size);
    const groupedPrice = Math.floor(price / tickSize) * tickSize;
    const key = groupedPrice.toFixed(tickSize < 1 ? (tickSize === 0.01 ? 2 : 1) : 0);
    
    if (!grouped[key]) grouped[key] = 0;
    grouped[key] += size;
  });
  
  return Object.entries(grouped)
    .map(([price, size]) => ({ price, size: size.toFixed(3) }))
    .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
};

const calculateBuySellPercentage = (orderBook: any) => {
  if (!orderBook?.asks?.length || !orderBook?.bids?.length) return { buyPercent: 50, sellPercent: 50 };
  
  const totalAskVolume = orderBook.asks.reduce((sum: number, ask: any) => sum + parseFloat(ask.size), 0);
  const totalBidVolume = orderBook.bids.reduce((sum: number, bid: any) => sum + parseFloat(bid.size), 0);
  const totalVolume = totalAskVolume + totalBidVolume;
  
  if (totalVolume === 0) return { buyPercent: 50, sellPercent: 50 };
  
  const buyPercent = (totalBidVolume / totalVolume) * 100;
  const sellPercent = (totalAskVolume / totalVolume) * 100;
  
  return { buyPercent: buyPercent.toFixed(1), sellPercent: sellPercent.toFixed(1) };
};

const RealTimeDataComponent = ({ solData, isLoading, isLiveStream = false }: RealTimeDataProps) => {
  const [precision, setPrecision] = useState(0.01);
  
  // Memoized calculations for performance
  const { ticker, orderBook } = solData || {};
  
  const groupedOrdersData = useMemo(() => {
    if (!orderBook?.asks?.length || !orderBook?.bids?.length) {
      return { groupedAsks: [], groupedBids: [], maxAskSize: 0, maxBidSize: 0 };
    }
    
    const groupedAsks = groupOrdersByPrecision(orderBook.asks, precision);
    const groupedBids = groupOrdersByPrecision(orderBook.bids, precision);
    const askSizes = groupedAsks.map(item => parseFloat(item.size));
    const bidSizes = groupedBids.map(item => parseFloat(item.size));
    const maxAskSize = Math.max(...askSizes) || 1;
    const maxBidSize = Math.max(...bidSizes) || 1;
    
    return { groupedAsks, groupedBids, maxAskSize, maxBidSize };
  }, [orderBook, precision]);
  
  const buySellPercentage = useMemo(() => {
    return calculateBuySellPercentage(orderBook);
  }, [orderBook]);
  
  const priceChangeData = useMemo(() => {
    const isPositive = ticker?.change24h && (ticker?.change24h.startsWith('+') || !ticker?.change24h.startsWith('-'));
    const changeValue = ticker?.change24h ? ticker?.change24h.replace(/[+%]/g, '') : '0';
    return { isPositive, changeValue };
  }, [ticker?.change24h]);
  
  const lastUpdateTime = useMemo(() => {
    return solData?.lastUpdate ? new Date(solData.lastUpdate).toLocaleString() : 'Unknown';
  }, [solData?.lastUpdate]);

  // Loading state
  if (isLoading && !solData) {
    return (
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <TrendingUp className="text-primary mr-2" />
            Live SOL Futures Data
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

  // No data state
  if (!ticker && !orderBook) {
    return (
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <TrendingUp className="text-primary mr-2" />
            Live SOL Futures Data
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
  
  const { isPositive, changeValue } = priceChangeData;

  return (
    <div>
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center justify-between">
            <div className="flex items-center">
              <TrendingUp className="text-primary mr-2" />
              Live SOL Futures Data
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
                {ticker?.symbol || 'SOL-USDT-SWAP'}
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
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Order Book</h3>
                  
                  {/* Precision Selector */}
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-gray-300 mr-2">Precision:</span>
                    {[0.01, 0.1, 1].map((tick) => (
                      <button
                        key={tick}
                        onClick={() => setPrecision(tick)}
                        className={`px-2 py-1 text-xs rounded transition-all duration-200 ${
                          precision === tick 
                            ? 'bg-blue-600 text-white font-medium' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        data-testid={`precision-${tick}`}
                      >
                        {tick}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Buy/Sell Percentage Bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-green-400">Buy {buySellPercentage.buyPercent}%</span>
                    <span className="text-red-400">Sell {buySellPercentage.sellPercent}%</span>
                  </div>
                  <div className="flex h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="bg-green-500 transition-all duration-1000"
                      style={{ width: `${buySellPercentage.buyPercent}%` }}
                    />
                    <div 
                      className="bg-red-500 transition-all duration-1000"
                      style={{ width: `${buySellPercentage.sellPercent}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-0 h-80 bg-gray-50">
                {/* ASKS (Left Side - Sell Orders) */}
                <div className="border-r border-gray-300">
                  <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-red-50 text-xs font-medium text-gray-600 border-b">
                    <div className="text-left">Price</div>
                    <div className="text-right">Size</div>
                    <div className="text-right">Total</div>
                  </div>
                  
                  <div className="h-64 overflow-y-auto">
                    {(() => {
                      const { groupedAsks, maxAskSize } = groupedOrdersData;
                      
                      if (!groupedAsks.length) {
                        return <div className="p-4 text-center text-gray-500">Loading asks...</div>;
                      }
                      
                      return groupedAsks.slice(0, 10).reverse().map((ask, index) => {
                        const sizePercent = (parseFloat(ask.size) / maxAskSize) * 100;
                        const cumulativeTotal = groupedAsks.slice(0, groupedAsks.length - index).reduce((sum, a) => sum + parseFloat(a.size), 0);
                        
                        return (
                          <div 
                            key={`ask-${ask.price}-${index}`} 
                            className="relative group hover:bg-red-50 transition-all duration-300 ease-in-out"
                          >
                            <div 
                              className="absolute left-0 top-0 h-full bg-red-100 opacity-30 transition-all duration-1500 ease-out"
                              style={{ width: `${sizePercent}%` }}
                            />
                            
                            <div className="relative grid grid-cols-3 gap-2 px-3 py-1 text-xs font-mono transition-all duration-1000 ease-in-out">
                              <div className="text-red-600 font-bold transition-all duration-1000" data-testid={`ask-price-${index}`}>
                                ${ask.price}
                              </div>
                              <div className="text-right text-gray-800 font-medium transition-all duration-1000" data-testid={`ask-size-${index}`}>
                                {ask.size}
                              </div>
                              <div className="text-right text-gray-600 text-xs transition-all duration-1000">
                                {cumulativeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* BIDS (Right Side - Buy Orders) */}
                <div>
                  <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-green-50 text-xs font-medium text-gray-600 border-b">
                    <div className="text-left">Price</div>
                    <div className="text-right">Size</div>
                    <div className="text-right">Total</div>
                  </div>
                  
                  <div className="h-64 overflow-y-auto">
                    {(() => {
                      const { groupedBids, maxBidSize } = groupedOrdersData;
                      
                      if (!groupedBids.length) {
                        return <div className="p-4 text-center text-gray-500">Loading bids...</div>;
                      }
                      
                      return groupedBids.slice(0, 10).reverse().map((bid, index) => {
                        const sizePercent = (parseFloat(bid.size) / maxBidSize) * 100;
                        const cumulativeTotal = groupedBids.slice(0, groupedBids.length - index).reduce((sum, b) => sum + parseFloat(b.size), 0);
                        
                        return (
                          <div 
                            key={`bid-${bid.price}-${index}`} 
                            className="relative group hover:bg-green-50 transition-all duration-300 ease-in-out"
                          >
                            <div 
                              className="absolute left-0 top-0 h-full bg-green-100 opacity-30 transition-all duration-1500 ease-out"
                              style={{ width: `${sizePercent}%` }}
                            />
                            
                            <div className="relative grid grid-cols-3 gap-2 px-3 py-1 text-xs font-mono transition-all duration-1000 ease-in-out">
                              <div className="text-green-600 font-bold transition-all duration-1000" data-testid={`bid-price-${index}`}>
                                ${bid.price}
                              </div>
                              <div className="text-right text-gray-800 font-medium transition-all duration-1000" data-testid={`bid-size-${index}`}>
                                {bid.size}
                              </div>
                              <div className="text-right text-gray-600 text-xs transition-all duration-1000">
                                {cumulativeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
              
              {/* Spread Display at Bottom */}
              <div className="border-t border-gray-300 bg-gray-100 py-2">
                <div className="text-center">
                  <span className="text-xs font-medium text-gray-600">
                    Spread: <span className="text-blue-600 font-bold">${orderBook.spread}</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const RealTimeData = RealTimeDataComponent;
export default RealTimeData;
export { RealTimeData };
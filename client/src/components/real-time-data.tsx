import { TrendingUp, ArrowUp, ArrowDown, Radio, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SolCompleteData } from "@shared/schema";
import { useState } from "react";

interface RealTimeDataProps {
  solData?: SolCompleteData;
  isLoading: boolean;
  isLiveStream?: boolean;
}

const RealTimeDataComponent = ({ solData, isLoading, isLiveStream = false }: RealTimeDataProps) => {
  const [precision, setPrecision] = useState(0.01);
  
  // Group order book by precision
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
  
  // Calculate buy/sell percentages
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
  
  // Generate market depth chart data
  const generateDepthChartData = (orderBook: any) => {
    if (!orderBook?.asks?.length || !orderBook?.bids?.length) return { bidsData: [], asksData: [], maxVolume: 0 };
    
    // Group and sort orders
    const groupedBids = groupOrdersByPrecision(orderBook.bids, precision).reverse();
    const groupedAsks = groupOrdersByPrecision(orderBook.asks, precision);
    
    // Calculate cumulative volumes for bids (from highest price down)
    let cumulativeBidVolume = 0;
    const bidsData = groupedBids.map(bid => {
      cumulativeBidVolume += parseFloat(bid.size);
      return {
        price: parseFloat(bid.price),
        volume: cumulativeBidVolume,
        side: 'bid'
      };
    });
    
    // Calculate cumulative volumes for asks (from lowest price up)  
    let cumulativeAskVolume = 0;
    const asksData = groupedAsks.map(ask => {
      cumulativeAskVolume += parseFloat(ask.size);
      return {
        price: parseFloat(ask.price),
        volume: cumulativeAskVolume,
        side: 'ask'
      };
    });
    
    const maxVolume = Math.max(cumulativeBidVolume, cumulativeAskVolume);
    
    return { bidsData, asksData, maxVolume };
  };
  
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
    <div>
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

        {/* Professional Order Book - Horizontal Layout */}
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
              {(() => {
                const { buyPercent, sellPercent } = calculateBuySellPercentage(orderBook);
                return (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-green-400">Buy {buyPercent}%</span>
                      <span className="text-red-400">Sell {sellPercent}%</span>
                    </div>
                    <div className="flex h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="bg-green-500 transition-all duration-1000"
                        style={{ width: `${buyPercent}%` }}
                      />
                      <div 
                        className="bg-red-500 transition-all duration-1000"
                        style={{ width: `${sellPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="grid grid-cols-2 gap-0 h-80 bg-gray-50">
              {/* ASKS (Left Side - Sell Orders) */}
              <div className="border-r border-gray-300">
                {/* Header for Asks */}
                <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-red-50 text-xs font-medium text-gray-600 border-b">
                  <div className="text-left">Price</div>
                  <div className="text-right">Size</div>
                  <div className="text-right">Total</div>
                </div>
                
                <div className="h-64 overflow-y-auto">
                {(() => {
                  if (!orderBook?.asks) {
                    return <div className="p-4 text-center text-gray-500">Loading asks...</div>;
                  }
                  
                  // Group asks by precision
                  const groupedAsks = groupOrdersByPrecision(orderBook.asks, precision);
                  const askSizes = groupedAsks.map(item => parseFloat(item.size));
                  const maxAskSize = Math.max(...askSizes) || 1;
                  
                  return groupedAsks.slice(0, 10).reverse().map((ask, index) => {
                    const sizePercent = (parseFloat(ask.size) / maxAskSize) * 100;
                    const cumulativeTotal = groupedAsks.slice(0, groupedAsks.length - index).reduce((sum, a) => sum + parseFloat(a.size), 0);
                    
                    return (
                      <div 
                        key={`ask-${ask.price}-${index}`} 
                        className="relative group hover:bg-red-50 transition-all duration-300 ease-in-out"
                      >
                        {/* Volume Bar Background */}
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
                {/* Header for Bids */}
                <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-green-50 text-xs font-medium text-gray-600 border-b">
                  <div className="text-left">Price</div>
                  <div className="text-right">Size</div>
                  <div className="text-right">Total</div>
                </div>
                
                <div className="h-64 overflow-y-auto">
                {(() => {
                  if (!orderBook?.bids) {
                    return <div className="p-4 text-center text-gray-500">Loading bids...</div>;
                  }
                  
                  // Group bids by precision
                  const groupedBids = groupOrdersByPrecision(orderBook.bids, precision);
                  const bidSizes = groupedBids.map(item => parseFloat(item.size));
                  const maxBidSize = Math.max(...bidSizes) || 1;
                  
                  return groupedBids.slice(0, 10).reverse().map((bid, index) => {
                    const sizePercent = (parseFloat(bid.size) / maxBidSize) * 100;
                    const cumulativeTotal = groupedBids.slice(0, groupedBids.length - index).reduce((sum, b) => sum + parseFloat(b.size), 0);
                    
                    return (
                      <div 
                        key={`bid-${bid.price}-${index}`} 
                        className="relative group hover:bg-green-50 transition-all duration-300 ease-in-out"
                      >
                        {/* Volume Bar Background */}
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

    {/* Market Depth Chart - SECTION TERPISAH */}
    {orderBook && (
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
        <CardContent className="p-0">
          <div className="w-full max-w-full border-0 rounded-lg overflow-visible bg-white">
            <div className="bg-black text-white px-6 py-4 border-b border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <BarChart3 className="text-yellow-400 mr-3" size={20} />
                  <h3 className="text-lg font-bold">MARKET DEPTH</h3>
                  <span className="ml-3 text-sm text-yellow-400">Professional Trading View</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-green-400 font-medium">
                    🟢 REAL-TIME
                  </div>
                  <div className="text-xs text-gray-400">
                    Binance Style
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 w-full min-h-[400px]">
              {(() => {
                // Simplified depth chart using bars instead of SVG curves
                const groupedBids = groupOrdersByPrecision(orderBook.bids, precision).slice(0, 15);
                const groupedAsks = groupOrdersByPrecision(orderBook.asks, precision).slice(0, 15);
                
                if (groupedBids.length === 0 || groupedAsks.length === 0) {
                  return <div className="text-center text-gray-500 py-8">Loading depth chart...</div>;
                }
                
                // Calculate cumulative volumes
                let bidCumulative = 0;
                const bidDepth = groupedBids.reverse().map(bid => {
                  bidCumulative += parseFloat(bid.size);
                  return { price: parseFloat(bid.price), volume: bidCumulative };
                });
                
                let askCumulative = 0;
                const askDepth = groupedAsks.map(ask => {
                  askCumulative += parseFloat(ask.size);
                  return { price: parseFloat(ask.price), volume: askCumulative };
                });
                
                const maxVolume = Math.max(bidCumulative, askCumulative);
                const allPrices = [...bidDepth.map(d => d.price), ...askDepth.map(d => d.price)];
                const minPrice = Math.min(...allPrices);
                const maxPrice = Math.max(...allPrices);
                
                return (
                  <div className="space-y-4 w-full">
                    {/* Professional Header Info */}
                    <div className="flex justify-between items-center bg-gradient-to-r from-gray-800 to-gray-700 p-4 rounded-t-lg border-b border-yellow-500">
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <div className="text-xs text-gray-400">PRICE RANGE</div>
                          <div className="text-sm font-bold text-white">${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">MAX VOLUME</div>
                          <div className="text-sm font-bold text-yellow-400">{maxVolume.toFixed(1)} SOL</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-400">SPREAD</div>
                          <div className="text-sm font-bold text-orange-400">${(maxPrice - minPrice).toFixed(3)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">MARKET</div>
                        <div className="text-sm font-bold text-white">SOL/USDT</div>
                      </div>
                    </div>
                    
                    {/* BINANCE-STYLE DEPTH CHART - Professional SVG */}
                    <div className="relative h-80 w-full border border-gray-300 rounded-lg bg-gradient-to-b from-gray-900 to-gray-800 overflow-hidden">
                      {(() => {
                        const chartWidth = 800;
                        const chartHeight = 320;
                        const padding = 30;
                        
                        // Calculate smooth curve points for both sides
                        const bidPoints = bidDepth.map((bid, index) => {
                          const x = padding + ((maxPrice - bid.price) / (maxPrice - minPrice)) * ((chartWidth / 2) - padding);
                          const y = chartHeight - padding - (bid.volume / maxVolume) * (chartHeight - 2 * padding);
                          return { x, y, price: bid.price, volume: bid.volume };
                        });
                        
                        const askPoints = askDepth.map((ask, index) => {
                          const x = (chartWidth / 2) + ((ask.price - minPrice) / (maxPrice - minPrice)) * ((chartWidth / 2) - padding);
                          const y = chartHeight - padding - (ask.volume / maxVolume) * (chartHeight - 2 * padding);
                          return { x, y, price: ask.price, volume: ask.volume };
                        });
                        
                        // Create smooth SVG paths
                        const createSmoothPath = (points: any[], isAsk = false) => {
                          if (points.length < 2) return '';
                          
                          let path = `M ${points[0].x} ${chartHeight - padding}`;
                          path += ` L ${points[0].x} ${points[0].y}`;
                          
                          // Create smooth curves between points
                          for (let i = 1; i < points.length; i++) {
                            const prev = points[i - 1];
                            const curr = points[i];
                            const controlX = (prev.x + curr.x) / 2;
                            path += ` Q ${controlX} ${prev.y} ${curr.x} ${curr.y}`;
                          }
                          
                          // Close the path for area fill
                          const lastPoint = points[points.length - 1];
                          path += ` L ${lastPoint.x} ${chartHeight - padding}`;
                          path += ` Z`;
                          
                          return path;
                        };
                        
                        const bidPath = createSmoothPath(bidPoints);
                        const askPath = createSmoothPath(askPoints, true);
                        
                        return (
                          <svg 
                            width="100%" 
                            height="100%" 
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                            className="absolute inset-0"
                          >
                            {/* Dark grid lines */}
                            <defs>
                              <linearGradient id="bidGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                                <stop offset="0%" style={{stopColor: '#10B981', stopOpacity: 0.1}} />
                                <stop offset="100%" style={{stopColor: '#10B981', stopOpacity: 0.8}} />
                              </linearGradient>
                              <linearGradient id="askGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                                <stop offset="0%" style={{stopColor: '#EF4444', stopOpacity: 0.1}} />
                                <stop offset="100%" style={{stopColor: '#EF4444', stopOpacity: 0.8}} />
                              </linearGradient>
                            </defs>
                            
                            {/* Grid lines */}
                            {[0.2, 0.4, 0.6, 0.8].map(ratio => (
                              <line
                                key={ratio}
                                x1={padding}
                                y1={padding + ratio * (chartHeight - 2 * padding)}
                                x2={chartWidth - padding}
                                y2={padding + ratio * (chartHeight - 2 * padding)}
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth={1}
                              />
                            ))}
                            
                            {/* Vertical center line */}
                            <line
                              x1={chartWidth / 2}
                              y1={padding}
                              x2={chartWidth / 2}
                              y2={chartHeight - padding}
                              stroke="#F59E0B"
                              strokeWidth={2}
                              opacity={0.8}
                            />
                            
                            {/* Bid area (green - left side) */}
                            <path
                              d={bidPath}
                              fill="url(#bidGradient)"
                              stroke="#10B981"
                              strokeWidth={2}
                              className="transition-all duration-500"
                            />
                            
                            {/* Ask area (red - right side) */}
                            <path
                              d={askPath}
                              fill="url(#askGradient)"
                              stroke="#EF4444"
                              strokeWidth={2}
                              className="transition-all duration-500"
                            />
                            
                            {/* Interactive hover points */}
                            {bidPoints.map((point, index) => (
                              <circle
                                key={`bid-${index}`}
                                cx={point.x}
                                cy={point.y}
                                r={3}
                                fill="#10B981"
                                className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                              >
                                <title>Buy: ${point.price.toFixed(2)} | {point.volume.toFixed(1)} SOL</title>
                              </circle>
                            ))}
                            
                            {askPoints.map((point, index) => (
                              <circle
                                key={`ask-${index}`}
                                cx={point.x}
                                cy={point.y}
                                r={3}
                                fill="#EF4444"
                                className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                              >
                                <title>Sell: ${point.price.toFixed(2)} | {point.volume.toFixed(1)} SOL</title>
                              </circle>
                            ))}
                            
                            {/* Labels and text */}
                            <text x={padding + 10} y={padding + 20} fill="white" fontSize="12" fontWeight="bold">
                              Volume: {maxVolume.toFixed(0)} SOL
                            </text>
                            
                            <text x={padding + 50} y={chartHeight - 10} fill="white" fontSize="10">
                              ${minPrice.toFixed(2)}
                            </text>
                            
                            <text x={chartWidth - padding - 50} y={chartHeight - 10} fill="white" fontSize="10">
                              ${maxPrice.toFixed(2)}
                            </text>
                            
                            {/* Current price indicator */}
                            <text 
                              x={chartWidth / 2} 
                              y={padding - 5} 
                              fill="#F59E0B" 
                              fontSize="12" 
                              fontWeight="bold" 
                              textAnchor="middle"
                            >
                              CURRENT PRICE
                            </text>
                          </svg>
                        );
                      })()}
                      
                      {/* Professional labels */}
                      <div className="absolute top-4 left-4 bg-green-600 bg-opacity-20 backdrop-blur-sm border border-green-400 px-3 py-1 rounded-lg">
                        <span className="text-green-300 text-sm font-bold">BIDS</span>
                      </div>
                      
                      <div className="absolute top-4 right-4 bg-red-600 bg-opacity-20 backdrop-blur-sm border border-red-400 px-3 py-1 rounded-lg">
                        <span className="text-red-300 text-sm font-bold">ASKS</span>
                      </div>
                    </div>
                    
                    {/* Professional Legend */}
                    <div className="bg-black p-4 rounded-b-lg">
                      <div className="flex items-center justify-center space-x-8 text-sm">
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-green-600 rounded mr-3 shadow-lg"></div>
                          <span className="text-green-400 font-semibold">CUMULATIVE BIDS</span>
                        </div>
                        <div className="w-px h-6 bg-gray-600"></div>
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-gradient-to-r from-red-400 to-red-600 rounded mr-3 shadow-lg"></div>
                          <span className="text-red-400 font-semibold">CUMULATIVE ASKS</span>
                        </div>
                        <div className="w-px h-6 bg-gray-600"></div>
                        <div className="flex items-center">
                          <div className="w-4 h-4 bg-yellow-500 rounded mr-3 shadow-lg"></div>
                          <span className="text-yellow-400 font-semibold">CURRENT PRICE</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Professional Market Analysis */}
                    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6 rounded-lg border border-gray-600">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-green-900 bg-opacity-30 p-4 rounded-lg border border-green-600">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-green-400 font-bold text-sm">BUY PRESSURE</span>
                            <span className="text-green-300 text-xs">STRONG</span>
                          </div>
                          <div className="text-green-300 text-2xl font-bold mb-1">
                            {((bidCumulative / (bidCumulative + askCumulative)) * 100).toFixed(1)}%
                          </div>
                          <div className="text-green-500 text-xs">Total: {bidCumulative.toFixed(1)} SOL</div>
                        </div>
                        
                        <div className="bg-yellow-900 bg-opacity-30 p-4 rounded-lg border border-yellow-600">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-yellow-400 font-bold text-sm">LIQUIDITY</span>
                            <span className="text-yellow-300 text-xs">DEEP</span>
                          </div>
                          <div className="text-yellow-300 text-2xl font-bold mb-1">
                            {(bidCumulative + askCumulative).toFixed(0)}
                          </div>
                          <div className="text-yellow-500 text-xs">Total SOL Volume</div>
                        </div>
                        
                        <div className="bg-red-900 bg-opacity-30 p-4 rounded-lg border border-red-600">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-red-400 font-bold text-sm">SELL PRESSURE</span>
                            <span className="text-red-300 text-xs">MODERATE</span>
                          </div>
                          <div className="text-red-300 text-2xl font-bold mb-1">
                            {((askCumulative / (bidCumulative + askCumulative)) * 100).toFixed(1)}%
                          </div>
                          <div className="text-red-500 text-xs">Total: {askCumulative.toFixed(1)} SOL</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>
    )}
    </div>
  );
};

// Export as regular component for now to avoid React.memo issues with Vite
export const RealTimeData = RealTimeDataComponent;

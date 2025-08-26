import { TrendingUp, ArrowUp, ArrowDown, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SolCompleteData } from "@shared/schema";

interface RealTimeDataProps {
  solData?: SolCompleteData;
  isLoading: boolean;
  isLiveStream?: boolean;
}

export function RealTimeData({ solData, isLoading, isLiveStream = false }: RealTimeDataProps) {
  // Debug logging to see what data we're receiving
  console.log('RealTimeData component received:', { solData, isLoading, isLiveStream });
  
  if (isLoading || !solData) {
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

  const { ticker, orderBook } = solData;
  
  console.log('Extracted data:', { ticker, orderBook });
  
  // Safe checks for ticker data
  if (!ticker || !orderBook) {
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
  
  const isPositive = ticker.change24h && (ticker.change24h.startsWith('+') || !ticker.change24h.startsWith('-'));
  const changeValue = ticker.change24h ? ticker.change24h.replace(/[+%]/g, '') : '0';

  const lastUpdateTime = new Date(solData.lastUpdate).toLocaleString();

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
      <CardContent className="p-6">
        {/* Current Price */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500" data-testid="text-symbol">
              {ticker.symbol || 'SOL-USDT'}
            </span>
            <span className="text-xs text-gray-400">
              Last updated: <span data-testid="text-last-update">{lastUpdateTime}</span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-3xl font-bold text-gray-900" data-testid="text-price">
              ${ticker.price || '0.00'}
            </span>
            <span className={`px-2 py-1 rounded text-sm font-medium flex items-center ${
              isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isPositive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
              <span data-testid="text-change24h">{ticker.change24h || '0%'}</span>
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">24h High</p>
            <p className="text-lg font-semibold text-gray-900" data-testid="text-high24h">
              ${ticker.high24h}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">24h Low</p>
            <p className="text-lg font-semibold text-gray-900" data-testid="text-low24h">
              ${ticker.low24h}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Volume</p>
            <p className="text-lg font-semibold text-gray-900" data-testid="text-volume">
              {parseFloat(ticker.volume).toLocaleString()} SOL
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trading Vol</p>
            <p className="text-lg font-semibold text-gray-900" data-testid="text-trading-volume">
              ${parseFloat(ticker.tradingVolume24h || '0').toLocaleString()}
            </p>
          </div>
        </div>

        {/* Order Book Preview */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Book (Top 5)</h3>
          <div className="space-y-2">
            {orderBook.asks.slice(0, 3).map((ask, index) => (
              <div key={`ask-${index}`} className="flex justify-between items-center text-xs">
                <span className="text-red-600 font-mono" data-testid={`ask-price-${index}`}>
                  {parseFloat(ask.price).toFixed(2)}
                </span>
                <span className="text-gray-500 font-mono" data-testid={`ask-size-${index}`}>
                  {parseFloat(ask.size).toLocaleString()}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-200 py-1">
              <div className="text-center text-xs font-medium text-gray-900">
                Spread: <span data-testid="text-spread">${orderBook.spread}</span>
              </div>
            </div>
            {orderBook.bids.slice(0, 3).map((bid, index) => (
              <div key={`bid-${index}`} className="flex justify-between items-center text-xs">
                <span className="text-green-600 font-mono" data-testid={`bid-price-${index}`}>
                  {parseFloat(bid.price).toFixed(2)}
                </span>
                <span className="text-gray-500 font-mono" data-testid={`bid-size-${index}`}>
                  {parseFloat(bid.size).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

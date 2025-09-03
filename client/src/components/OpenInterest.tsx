import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, DollarSign, TrendingUp, PieChart } from 'lucide-react';

interface OpenInterestData {
  instId: string;
  instType: 'SPOT' | 'MARGIN' | 'SWAP' | 'FUTURES' | 'OPTION';
  oi: string; // Open Interest in base currency
  oiCcy: string; // Open Interest in currency  
  oiUsd: string; // Open Interest in USD
  timestamp: string;
}

export function OpenInterest() {
  const { data: oiData, isLoading, error } = useQuery<{
    success: boolean;
    data: OpenInterestData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/open-interest'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/sol/open-interest', {
        signal // AbortController signal for cleanup
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch open interest data`);
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    refetchIntervalInBackground: false, // Stop refetching when tab is not active
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Open Interest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !oiData?.success) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Open Interest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load open interest data</p>
        </CardContent>
      </Card>
    );
  }

  const oi = oiData.data;
  const oiValue = parseFloat(oi.oi);
  const oiUsdValue = parseFloat(oi.oiUsd);
  
  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatCurrency = (num: number): string => {
    if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'K';
    return '$' + num.toFixed(2);
  };

  const getInstTypeColor = (type: string) => {
    switch (type) {
      case 'SWAP': return 'bg-purple-600';
      case 'FUTURES': return 'bg-blue-600';
      case 'SPOT': return 'bg-green-600';
      case 'MARGIN': return 'bg-orange-600';
      case 'OPTION': return 'bg-pink-600';
      default: return 'bg-gray-600';
    }
  };

  const getInstTypeIcon = (type: string) => {
    switch (type) {
      case 'SWAP': return '🔄';
      case 'FUTURES': return '📅';
      case 'SPOT': return '💰';
      case 'MARGIN': return '📊';
      case 'OPTION': return '⚡';
      default: return '📈';
    }
  };

  // Calculate some relative metrics
  const averagePrice = oiUsdValue / oiValue; // Average position price
  const lastUpdate = new Date(parseInt(oi.timestamp)).toLocaleTimeString();

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Open Interest Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instrument Type */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getInstTypeIcon(oi.instType)}</span>
            <span className="text-gray-400">{oi.instId}</span>
          </div>
          <Badge className={`${getInstTypeColor(oi.instType)} text-white`}>
            {oi.instType}
          </Badge>
        </div>

        {/* Main OI Metrics */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-gray-400">
              <PieChart className="w-4 h-4" />
              <span className="text-sm">Total Open Interest</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatNumber(oiValue)} SOL
            </div>
            <div className="text-lg text-green-400">
              {formatCurrency(oiUsdValue)}
            </div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Volume (SOL)</span>
            <div className="text-lg font-semibold text-white">
              {oiValue.toLocaleString(undefined, { 
                maximumFractionDigits: 0 
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Volume (USD)</span>
            <div className="text-lg font-semibold text-green-400">
              ${oiUsdValue.toLocaleString(undefined, { 
                maximumFractionDigits: 0 
              })}
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Avg Position Price</span>
            <div className="text-lg font-semibold text-blue-400">
              ${averagePrice.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Last Update</span>
            <div className="text-sm text-gray-400">
              {lastUpdate}
            </div>
          </div>
        </div>

        {/* OI Interpretation */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Market Analysis</div>
          <div className="text-sm">
            {oiUsdValue > 500000000 ? (
              <div className="text-orange-400">
                🔥 <strong>High OI:</strong> Strong institutional interest, potential volatility
              </div>
            ) : oiUsdValue > 200000000 ? (
              <div className="text-yellow-400">
                📊 <strong>Moderate OI:</strong> Normal trading activity
              </div>
            ) : (
              <div className="text-blue-400">
                🌊 <strong>Low OI:</strong> Light trading interest
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Open Interest indicates the total value of outstanding derivative contracts
          </div>
        </div>

        {/* Risk Indicator */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Liquidation Risk:</span>
          <span className={`font-semibold ${
            oiUsdValue > 600000000 ? 'text-red-400' : 
            oiUsdValue > 300000000 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {oiUsdValue > 600000000 ? 'HIGH' : 
             oiUsdValue > 300000000 ? 'MEDIUM' : 'LOW'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
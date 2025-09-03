import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Target, TrendingUp, TrendingDown, Volume2 } from 'lucide-react';

interface VolumeNode {
  price: string;
  volume: string;
  percentage: string;
}

interface VolumeProfileData {
  poc: string; // Point of Control
  hvnLevels: VolumeNode[]; // High Volume Nodes
  lvnLevels: VolumeNode[]; // Low Volume Nodes
  totalVolume: string;
  valueArea: {
    high: string;
    low: string;
    percentage: string;
  };
  profileRange: {
    high: string;
    low: string;
    timeframe: string;
  };
  lastUpdate: string;
}

export function VolumeProfile() {
  const { data: vpData, isLoading, error } = useQuery<{
    success: boolean;
    data: VolumeProfileData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/volume-profile'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/sol/volume-profile', {
        signal // AbortController signal for cleanup
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch volume profile data`);
      }
      return response.json();
    },
    refetchInterval: 120000, // Refresh every 2 minutes
    refetchIntervalInBackground: false, // Stop refetching when tab is not active
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Volume Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-700 rounded w-3/4"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !vpData?.success) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Volume Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load volume profile data</p>
        </CardContent>
      </Card>
    );
  }

  const vp = vpData.data;
  const formatNumber = (num: string): string => {
    const n = parseFloat(num);
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(2);
  };

  const formatPrice = (price: string): string => {
    return '$' + parseFloat(price).toFixed(2);
  };

  // Create volume profile visualization data
  const maxVolume = Math.max(...vp.hvnLevels.map(node => parseFloat(node.volume)));
  const minVolume = Math.min(...vp.lvnLevels.map(node => parseFloat(node.volume)));

  const getVolumeBarWidth = (volume: string): number => {
    const vol = parseFloat(volume);
    return Math.max(10, (vol / maxVolume) * 100);
  };

  const getVolumeIntensity = (volume: string): string => {
    const vol = parseFloat(volume);
    const intensity = vol / maxVolume;
    if (intensity > 0.8) return 'text-red-400 bg-red-400/20';
    if (intensity > 0.6) return 'text-orange-400 bg-orange-400/20';
    if (intensity > 0.4) return 'text-yellow-400 bg-yellow-400/20';
    if (intensity > 0.2) return 'text-blue-400 bg-blue-400/20';
    return 'text-gray-400 bg-gray-400/20';
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Volume Profile Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* POC and Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-gray-400">
              <Target className="w-4 h-4" />
              <span className="text-sm">Point of Control</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {formatPrice(vp.poc)}
            </div>
            <div className="text-xs text-gray-500">
              Highest volume price level
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-gray-400">
              <Volume2 className="w-4 h-4" />
              <span className="text-sm">Total Volume</span>
            </div>
            <div className="text-2xl font-bold text-green-400">
              {formatNumber(vp.totalVolume)}
            </div>
            <div className="text-xs text-gray-500">
              {vp.profileRange.timeframe} timeframe
            </div>
          </div>
        </div>

        {/* Value Area */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Value Area ({vp.valueArea.percentage}%)</span>
            <Badge variant="outline" className="text-blue-400 border-blue-400">
              Fair Value
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-green-400">
              High: {formatPrice(vp.valueArea.high)}
            </div>
            <div className="text-red-400">
              Low: {formatPrice(vp.valueArea.low)}
            </div>
          </div>
        </div>

        {/* High Volume Nodes (HVN) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-semibold">High Volume Nodes (HVN)</span>
          </div>
          <div className="space-y-1">
            {vp.hvnLevels.slice(0, 3).map((node, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-800/30 rounded p-2">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded ${getVolumeIntensity(node.volume)}`}></div>
                  <span className="text-white font-mono">{formatPrice(node.price)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-2 rounded ${getVolumeIntensity(node.volume)}`} 
                       style={{ width: `${getVolumeBarWidth(node.volume)}px` }}></div>
                  <span className="text-gray-400 text-sm">{formatNumber(node.volume)}</span>
                  <span className="text-green-400 text-xs">{node.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Volume Nodes (LVN) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm font-semibold">Low Volume Nodes (LVN)</span>
          </div>
          <div className="space-y-1">
            {vp.lvnLevels.slice(0, 3).map((node, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-800/30 rounded p-2">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded bg-red-400/20"></div>
                  <span className="text-white font-mono">{formatPrice(node.price)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded bg-red-400/20" 
                       style={{ width: `${Math.max(10, getVolumeBarWidth(node.volume) * 0.3)}px` }}></div>
                  <span className="text-gray-400 text-sm">{formatNumber(node.volume)}</span>
                  <span className="text-red-400 text-xs">{node.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Profile Range */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <span className="text-gray-400">Profile High</span>
            <div className="text-green-400 font-semibold">
              {formatPrice(vp.profileRange.high)}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-gray-400">Profile Low</span>
            <div className="text-red-400 font-semibold">
              {formatPrice(vp.profileRange.low)}
            </div>
          </div>
        </div>

        {/* Trading Insights */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Trading Insights</div>
          <div className="text-sm space-y-1">
            <div className="text-yellow-400">
              🎯 <strong>POC at {formatPrice(vp.poc)}:</strong> Key support/resistance level
            </div>
            <div className="text-green-400">
              📊 <strong>HVN Levels:</strong> Strong institutional interest zones
            </div>
            <div className="text-red-400">
              ⚡ <strong>LVN Levels:</strong> Fast movement through these prices expected
            </div>
          </div>
        </div>

        {/* Last Update */}
        <div className="text-xs text-gray-500 text-center">
          Last updated: {new Date(vp.lastUpdate).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
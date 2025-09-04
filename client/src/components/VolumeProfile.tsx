import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Target, TrendingUp, TrendingDown, Volume2, Users, Brain, DollarSign, Activity, Layers, Shield } from 'lucide-react';
import { useMemo } from 'react';

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
  // Get complete SOL data for institutional analytics
  const { data: completeData } = useQuery<{
    success: boolean;
    data: {
      ticker: {
        symbol: string;
        price: string;
        changePercent24h: string;
        volume24h: string;
        high24h: string;
        low24h: string;
      };
    };
  }>({
    queryKey: ['/api/sol/complete'],
    refetchInterval: false, // Manual refresh only
    refetchIntervalInBackground: false
  });

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
    refetchInterval: false, // Manual refresh only
    refetchIntervalInBackground: false, // Stop refetching when tab is not active
    refetchOnWindowFocus: false,
  });

  // Institutional-grade market microstructure analytics
  const institutionalAnalytics = useMemo(() => {
    if (!completeData?.success || !vpData?.success) return null;
    
    const vp = vpData.data;
    const currentPrice = parseFloat(completeData.data.ticker.price);
    const volume24h = parseFloat(completeData.data.ticker.volume24h);
    const priceChange24h = parseFloat(completeData.data.ticker.changePercent24h);
    const poc = parseFloat(vp.poc);
    const totalVolumeProfile = parseFloat(vp.totalVolume);
    const valueAreaHigh = parseFloat(vp.valueArea.high);
    const valueAreaLow = parseFloat(vp.valueArea.low);
    
    // Advanced Volume Distribution Analysis
    const pocDeviation = Math.abs((currentPrice - poc) / poc) * 100; // POC deviation %
    const valueAreaPosition = currentPrice >= valueAreaLow && currentPrice <= valueAreaHigh;
    const valueAreaDeviation = !valueAreaPosition ? 
      (currentPrice > valueAreaHigh ? ((currentPrice - valueAreaHigh) / valueAreaHigh) * 100 :
       ((valueAreaLow - currentPrice) / valueAreaLow) * 100) : 0;
    
    // Liquidity Clustering Analysis
    const hvnConcentration = vp.hvnLevels.reduce((acc, node) => acc + parseFloat(node.volume), 0) / totalVolumeProfile;
    const lvnConcentration = vp.lvnLevels.reduce((acc, node) => acc + parseFloat(node.volume), 0) / totalVolumeProfile;
    const liquidityRatio = hvnConcentration / (lvnConcentration + 0.001); // Avoid division by zero
    
    // Price Acceptance Zones Classification
    const priceAcceptanceZone = valueAreaPosition ? 'accepted' :
                                currentPrice > valueAreaHigh ? 'above_value' :
                                'below_value';
    
    // Market Microstructure Metrics
    const microstructureHealth = liquidityRatio > 10 ? 'concentrated' :
                                 liquidityRatio > 5 ? 'clustered' :
                                 liquidityRatio > 2 ? 'distributed' : 'fragmented';
    
    // Institution Footprint Detection
    const largeBlockThreshold = totalVolumeProfile * 0.05; // 5% threshold for institutional size
    const institutionalNodes = vp.hvnLevels.filter(node => parseFloat(node.volume) > largeBlockThreshold);
    const institutionalFootprint = institutionalNodes.length > 3 ? 'dominant' :
                                  institutionalNodes.length > 1 ? 'present' : 'minimal';
    
    // Volume-Weighted Analytics
    const vwapProximity = Math.abs((currentPrice - poc) / poc) * 100; // VWAP/POC proximity
    const volumeEfficiency = totalVolumeProfile / (volume24h * 0.01); // What % of 24h volume is in profile
    
    // Professional Trading Metrics
    const supportResistanceStrength = hvnConcentration > 0.3 ? 'strong' :
                                     hvnConcentration > 0.2 ? 'moderate' :
                                     hvnConcentration > 0.1 ? 'weak' : 'minimal';
    
    const liquidityGaps = vp.lvnLevels.length > 5 ? 'fragmented' :
                         vp.lvnLevels.length > 3 ? 'moderate' : 'concentrated';
    
    // Algorithmic Trading Impact Score
    const algoTradingImpact = liquidityRatio > 15 ? 'high_frequency' :
                             liquidityRatio > 8 ? 'moderate_algo' :
                             liquidityRatio > 4 ? 'mixed_flow' : 'retail_dominated';
    
    // Market Structure Integrity
    const structureIntegrity = valueAreaPosition && pocDeviation < 2 && liquidityRatio > 3 ? 'intact' :
                              valueAreaPosition || pocDeviation < 5 ? 'stressed' : 'broken';
    
    return {
      currentPrice,
      volume24h,
      priceChange24h,
      poc,
      pocDeviation,
      valueAreaPosition,
      valueAreaDeviation,
      hvnConcentration,
      lvnConcentration,
      liquidityRatio,
      priceAcceptanceZone,
      microstructureHealth,
      institutionalFootprint,
      vwapProximity,
      volumeEfficiency,
      supportResistanceStrength,
      liquidityGaps,
      algoTradingImpact,
      structureIntegrity,
      institutionalNodes
    };
  }, [completeData, vpData]);

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
            Volume Profile Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load volume profile data</p>
        </CardContent>
      </Card>
    );
  }

  // Don't render if institutional analytics unavailable
  if (!institutionalAnalytics) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Volume Profile Intelligence
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

  const vp = vpData.data;
  const analytics = institutionalAnalytics;
  
  const formatNumber = (num: string | number): string => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(2);
  };

  const formatPrice = (price: string | number): string => {
    const p = typeof price === 'string' ? parseFloat(price) : price;
    return '$' + p.toFixed(2);
  };
  
  const formatPercentage = (value: number): string => {
    return Math.abs(value) < 0.01 ? '< 0.01%' : `${value.toFixed(2)}%`;
  };
  
  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      // Price acceptance zones
      'accepted': 'text-green-400',
      'above_value': 'text-orange-400', 
      'below_value': 'text-red-400',
      // Market structure
      'concentrated': 'text-green-400',
      'clustered': 'text-blue-400',
      'distributed': 'text-yellow-400',
      'fragmented': 'text-red-400',
      // Institution footprint
      'dominant': 'text-purple-400',
      'present': 'text-blue-400',
      'minimal': 'text-gray-400',
      // Support/resistance
      'strong': 'text-green-400',
      'moderate': 'text-yellow-400', 
      'weak': 'text-orange-400',
      'minimal': 'text-red-400',
      // Algo trading
      'high_frequency': 'text-cyan-400',
      'moderate_algo': 'text-blue-400',
      'mixed_flow': 'text-yellow-400',
      'retail_dominated': 'text-orange-400',
      // Structure integrity
      'intact': 'text-green-400',
      'stressed': 'text-yellow-400',
      'broken': 'text-red-400'
    };
    return colorMap[status] || 'text-gray-400';
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
          Volume Profile Intelligence
          <Badge variant="outline" className="ml-auto text-xs text-purple-400 border-purple-400">
            Institutional Grade
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Market Microstructure Overview */}
        <div className="bg-gradient-to-r from-gray-800/90 to-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="text-white font-semibold">Market Microstructure Intelligence</span>
            </div>
            <Badge variant="outline" className={`${getStatusColor(analytics.structureIntegrity)} border-current`}>
              {analytics.structureIntegrity.toUpperCase()}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-gray-400">POC Deviation</div>
              <div className="text-white font-mono text-sm">
                {formatPercentage(analytics.pocDeviation)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Liquidity Ratio</div>
              <div className="text-white font-mono text-sm">
                {analytics.liquidityRatio.toFixed(2)}x
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Volume Efficiency</div>
              <div className="text-white font-mono text-sm">
                {formatPercentage(analytics.volumeEfficiency)}
              </div>
            </div>
          </div>
        </div>

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
              VWAP Proximity: {formatPercentage(analytics.vwapProximity)}
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

        {/* Institutional Footprint Analysis */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-white font-semibold text-sm">Institutional Footprint Detection</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Institution Presence:</span>
                <Badge variant="outline" className={`${getStatusColor(analytics.institutionalFootprint)} border-current text-xs`}>
                  {analytics.institutionalFootprint.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Algo Trading Impact:</span>
                <Badge variant="outline" className={`${getStatusColor(analytics.algoTradingImpact)} border-current text-xs`}>
                  {analytics.algoTradingImpact.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">HVN Concentration:</span>
                <span className="text-white font-mono text-xs">
                  {formatPercentage(analytics.hvnConcentration * 100)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Institutional Nodes:</span>
                <span className="text-purple-400 font-mono text-xs">
                  {analytics.institutionalNodes.length} levels
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Price Acceptance & Value Area */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400 text-sm">Price Acceptance Zone Analysis</span>
            </div>
            <Badge variant="outline" className={`${getStatusColor(analytics.priceAcceptanceZone)} border-current`}>
              {analytics.priceAcceptanceZone.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <span className="text-gray-400 text-xs">Value High</span>
              <div className="text-green-400 font-mono text-sm">
                {formatPrice(vp.valueArea.high)}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-gray-400 text-xs">Current Price</span>
              <div className="text-white font-mono text-sm">
                {formatPrice(analytics.currentPrice)}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-gray-400 text-xs">Value Low</span>
              <div className="text-red-400 font-mono text-sm">
                {formatPrice(vp.valueArea.low)}
              </div>
            </div>
          </div>
          
          {!analytics.valueAreaPosition && (
            <div className="mt-2 p-2 bg-yellow-400/10 rounded border border-yellow-400/20">
              <div className="text-yellow-400 text-xs">
                ⚠ Price Outside Value Area: {formatPercentage(analytics.valueAreaDeviation)} deviation
              </div>
            </div>
          )}
        </div>

        {/* Liquidity Clustering Analysis */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-semibold text-sm">Liquidity Clustering Analysis</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Microstructure Health:</span>
                <Badge variant="outline" className={`${getStatusColor(analytics.microstructureHealth)} border-current text-xs`}>
                  {analytics.microstructureHealth.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Support/Resistance:</span>
                <Badge variant="outline" className={`${getStatusColor(analytics.supportResistanceStrength)} border-current text-xs`}>
                  {analytics.supportResistanceStrength.toUpperCase()}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Liquidity Distribution:</span>
                <Badge variant="outline" className={`${getStatusColor(analytics.liquidityGaps)} border-current text-xs`}>
                  {analytics.liquidityGaps.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">LVN Concentration:</span>
                <span className="text-white font-mono text-xs">
                  {formatPercentage(analytics.lvnConcentration * 100)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* High Volume Nodes (HVN) - Enhanced */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-semibold">High Volume Nodes (HVN)</span>
            </div>
            <Badge variant="outline" className="text-xs text-green-400 border-green-400">
              {analytics.institutionalNodes.length} Institutional
            </Badge>
          </div>
          <div className="space-y-1">
            {vp.hvnLevels.slice(0, 4).map((node, index) => {
              const isInstitutional = analytics.institutionalNodes.some(
                inst => inst.price === node.price
              );
              return (
                <div key={index} className={`flex items-center justify-between rounded p-2 ${
                  isInstitutional ? 'bg-purple-400/10 border border-purple-400/20' : 'bg-gray-800/30'
                }`}>
                  <div className="flex items-center gap-3">
                    {isInstitutional && <Users className="w-3 h-3 text-purple-400" />}
                    <div className={`w-3 h-3 rounded ${getVolumeIntensity(node.volume)}`}></div>
                    <span className="text-white font-mono text-sm">{formatPrice(node.price)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 rounded ${getVolumeIntensity(node.volume)}`} 
                         style={{ width: `${getVolumeBarWidth(node.volume)}px` }}></div>
                    <span className="text-gray-400 text-xs">{formatNumber(node.volume)}</span>
                    <span className="text-green-400 text-xs font-mono">{node.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Volume Nodes (LVN) - Enhanced */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm font-semibold">Low Volume Nodes (LVN)</span>
            </div>
            <Badge variant="outline" className={`${getStatusColor(analytics.liquidityGaps)} border-current text-xs`}>
              {analytics.liquidityGaps.toUpperCase()} GAPS
            </Badge>
          </div>
          <div className="space-y-1">
            {vp.lvnLevels.slice(0, 4).map((node, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-800/30 rounded p-2">
                <div className="flex items-center gap-3">
                  <Activity className="w-3 h-3 text-red-400/50" />
                  <span className="text-white font-mono text-sm">{formatPrice(node.price)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded bg-red-400/20" 
                       style={{ width: `${Math.max(10, getVolumeBarWidth(node.volume) * 0.3)}px` }}></div>
                  <span className="text-gray-400 text-xs">{formatNumber(node.volume)}</span>
                  <span className="text-red-400 text-xs font-mono">{node.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Volume-Weighted Analytics Dashboard */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-yellow-400" />
            <span className="text-white font-semibold text-sm">Volume-Weighted Analytics</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Profile Range:</span>
                <span className="text-white font-mono text-xs">
                  {formatPrice(vp.profileRange.low)} - {formatPrice(vp.profileRange.high)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">24h Volume:</span>
                <span className="text-green-400 font-mono text-xs">
                  {formatNumber(analytics.volume24h)}
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Price Change 24h:</span>
                <span className={`font-mono text-xs ${
                  analytics.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {analytics.priceChange24h >= 0 ? '+' : ''}{analytics.priceChange24h.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Timeframe:</span>
                <span className="text-white font-mono text-xs">
                  {vp.profileRange.timeframe}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Trading Intelligence */}
        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg p-4 border border-purple-700/30">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-white font-semibold text-sm">Professional Trading Intelligence</span>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-yellow-400" />
                <span className="text-gray-300">POC Analysis:</span>
              </div>
              <span className="text-yellow-400 font-mono">
                Deviation {formatPercentage(analytics.pocDeviation)} from current
              </span>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">Value Area Status:</span>
              </div>
              <Badge variant="outline" className={`${getStatusColor(analytics.priceAcceptanceZone)} border-current`}>
                {analytics.valueAreaPosition ? 'WITHIN VALUE AREA' : 'OUTSIDE VALUE AREA'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-gray-300">Institutional Flow:</span>
              </div>
              <Badge variant="outline" className={`${getStatusColor(analytics.institutionalFootprint)} border-current`}>
                {analytics.institutionalFootprint.toUpperCase()} PRESENCE
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-gray-800/30 rounded">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-gray-300">Market Structure:</span>
              </div>
              <Badge variant="outline" className={`${getStatusColor(analytics.microstructureHealth)} border-current`}>
                {analytics.microstructureHealth.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Real-time Update Status */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            Last updated: {new Date(vp.lastUpdate).toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400">Live Analytics Active</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
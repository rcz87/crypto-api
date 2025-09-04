import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Zap, Shield, AlertTriangle, Eye } from 'lucide-react';

interface HeatmapBucket {
  priceLevel: number;
  volume: number;
  intensity: number;
  distance: number;
}

interface LiquidityLevel {
  price: number;
  volume: number;
  significance: 'strong' | 'moderate';
}

interface HeatmapData {
  buckets: HeatmapBucket[];
  highLiquidityZones: number;
  lowLiquidityZones: number;
  liquidityGaps: number;
  strongSupportLevels: LiquidityLevel[];
  strongResistanceLevels: LiquidityLevel[];
}

interface WhaleDetection {
  whaleOrderCount: number;
  whaleVolumeRatio: number;
  whaleThreshold: number;
  whaleBidCount: number;
  whaleAskCount: number;
  dominantSide: 'bid' | 'ask';
  whaleImpact: 'high' | 'medium' | 'low';
  largestOrder: number;
}

interface SmartMoneyFlow {
  smartBidCount: number;
  smartAskCount: number;
  smartBidVolume: number;
  smartAskVolume: number;
  netSmartFlow: number;
  flowDirection: 'bullish' | 'bearish' | 'neutral';
  avgSmartBidPrice: number;
  avgSmartAskPrice: number;
  smartMoneyRatio: number;
  accumulationSignal: boolean;
  distributionSignal: boolean;
  marketSentiment: 'accumulation' | 'distribution' | 'consolidation';
}

interface InstitutionalData {
  whaleDetection: WhaleDetection | null;
  smartMoneyFlow: SmartMoneyFlow | null;
  liquidityHeatmap: HeatmapData | null;
  microstructureAnalysis: any | null;
}

interface PremiumAnalytics {
  analyticsLevel: string;
  features: string[];
  institutionalFeatures: InstitutionalData;
  lastUpdate: string;
}

export default function LiquidityHeatmap() {
  const [data, setData] = useState<PremiumAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(207.0);

  useEffect(() => {
    const fetchHeatmapData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/premium/institutional-analytics');
        
        if (!response.ok) {
          if (response.status === 403) {
            setError('VIP8+ subscription required for advanced analytics');
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error || 'Failed to fetch data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    };

    // Fetch current price
    const fetchCurrentPrice = async () => {
      try {
        const response = await fetch('/api/sol/complete');
        const result = await response.json();
        if (result.success && result.data?.ticker?.last) {
          setCurrentPrice(parseFloat(result.data.ticker.last));
        }
      } catch (err) {
        console.warn('Failed to fetch current price:', err);
      }
    };

    fetchHeatmapData();
    fetchCurrentPrice();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchHeatmapData();
      fetchCurrentPrice();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const getIntensityColor = (intensity: number): string => {
    if (intensity > 4) return 'from-red-600 to-red-400'; // Very hot
    if (intensity > 3) return 'from-orange-600 to-orange-400'; // Hot
    if (intensity > 2) return 'from-yellow-600 to-yellow-400'; // Warm
    if (intensity > 1) return 'from-blue-600 to-blue-400'; // Cool
    return 'from-gray-600 to-gray-400'; // Cold
  };

  const getIntensityLabel = (intensity: number): string => {
    if (intensity > 4) return '🔥 Very Hot';
    if (intensity > 3) return '🟠 Hot';
    if (intensity > 2) return '🟡 Warm';
    if (intensity > 1) return '🔵 Cool';
    return '⚫ Cold';
  };

  const getWhaleImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'medium': return <TrendingUp className="h-4 w-4 text-yellow-400" />;
      case 'low': return <Shield className="h-4 w-4 text-green-400" />;
      default: return <Eye className="h-4 w-4 text-gray-400" />;
    }
  };

  const getFlowDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'bullish': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'bearish': return <TrendingDown className="h-4 w-4 text-red-400" />;
      default: return <Zap className="h-4 w-4 text-gray-400" />;
    }
  };

  const renderHeatmapVisual = (heatmapData: HeatmapData) => {
    const buckets = heatmapData.buckets.slice(0, 21); // Limit to 21 buckets for visualization
    
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Price Levels</span>
          <span>Volume Intensity</span>
        </div>
        {buckets.map((bucket, index) => {
          const isNearCurrentPrice = Math.abs(bucket.priceLevel - currentPrice) < 1.0;
          const relativeIntensity = Math.min(100, (bucket.intensity / 5) * 100);
          
          return (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`flex items-center justify-between p-1 rounded transition-all cursor-pointer ${
                      isNearCurrentPrice ? 'ring-2 ring-blue-400 bg-blue-900/20' : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-mono ${
                        bucket.priceLevel > currentPrice ? 'text-red-400' : 'text-green-400'
                      }`}>
                        ${bucket.priceLevel.toFixed(2)}
                      </span>
                      {isNearCurrentPrice && (
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div 
                        className={`h-2 bg-gradient-to-r ${getIntensityColor(bucket.intensity)} rounded-sm`}
                        style={{ width: `${Math.max(10, relativeIntensity)}px` }}
                      />
                      <span className="text-xs text-gray-400 w-8">
                        {bucket.intensity.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <div><strong>Price:</strong> ${bucket.priceLevel.toFixed(2)}</div>
                    <div><strong>Volume:</strong> {bucket.volume.toLocaleString()} SOL</div>
                    <div><strong>Intensity:</strong> {getIntensityLabel(bucket.intensity)}</div>
                    <div><strong>Distance:</strong> {bucket.distance} levels from mid</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  };

  const renderSupportResistanceLevels = (supports: LiquidityLevel[], resistances: LiquidityLevel[]) => (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h4 className="text-sm font-semibold text-green-400 mb-2">🛡️ Support Levels</h4>
        <div className="space-y-1">
          {supports.slice(0, 3).map((level, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className="text-green-400">${level.price.toFixed(2)}</span>
              <span className="text-gray-400">{level.volume.toLocaleString()}</span>
              <Badge variant={level.significance === 'strong' ? 'default' : 'secondary'} className="text-xs">
                {level.significance}
              </Badge>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <h4 className="text-sm font-semibold text-red-400 mb-2">⚔️ Resistance Levels</h4>
        <div className="space-y-1">
          {resistances.slice(0, 3).map((level, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className="text-red-400">${level.price.toFixed(2)}</span>
              <span className="text-gray-400">{level.volume.toLocaleString()}</span>
              <Badge variant={level.significance === 'strong' ? 'default' : 'secondary'} className="text-xs">
                {level.significance}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white flex items-center">
            <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded mr-2 animate-pulse" />
            Liquidity Heatmap
            <Badge className="ml-2 bg-purple-600">VIP8+</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
            <span className="ml-2 text-gray-400">Loading heatmap data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white flex items-center">
            <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded mr-2" />
            Liquidity Heatmap
            <Badge className="ml-2 bg-purple-600">VIP8+</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-2" />
            <p className="text-red-400 mb-2">{error}</p>
            {error.includes('VIP8+') && (
              <p className="text-sm text-gray-400">
                Upgrade to VIP8 or Institutional for advanced liquidity analytics
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const heatmapData = data?.institutionalFeatures?.liquidityHeatmap;
  const whaleData = data?.institutionalFeatures?.whaleDetection;
  const smartMoneyData = data?.institutionalFeatures?.smartMoneyFlow;

  return (
    <div className="space-y-4">
      {/* Main Heatmap */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white flex items-center">
            <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded mr-2" />
            Liquidity Heatmap
            <Badge className="ml-2 bg-purple-600">VIP8+</Badge>
            <div className="ml-auto flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-gray-400">Real-time</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!heatmapData ? (
            <div className="text-center py-8">
              <Eye className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-400 mb-2">Waiting for orderbook data...</p>
              <p className="text-sm text-gray-500">
                Premium heatmap will appear once sufficient market data is cached
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Heatmap Overview */}
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-purple-400">{heatmapData.highLiquidityZones}</div>
                  <div className="text-xs text-gray-400">Hot Zones</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-blue-400">{heatmapData.lowLiquidityZones}</div>
                  <div className="text-xs text-gray-400">Cool Zones</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-red-400">{heatmapData.liquidityGaps}</div>
                  <div className="text-xs text-gray-400">Gaps</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-green-400">${currentPrice.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">Current Price</div>
                </div>
              </div>

              {/* Visual Heatmap */}
              <div className="bg-gray-800/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                {renderHeatmapVisual(heatmapData)}
              </div>

              {/* Support/Resistance */}
              {(heatmapData.strongSupportLevels.length > 0 || heatmapData.strongResistanceLevels.length > 0) && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  {renderSupportResistanceLevels(heatmapData.strongSupportLevels, heatmapData.strongResistanceLevels)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Whale Detection & Smart Money */}
      <div className="grid grid-cols-2 gap-4">
        {/* Whale Detection */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-md font-semibold text-white flex items-center">
              <AlertTriangle className="h-5 w-5 text-orange-400 mr-2" />
              Whale Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!whaleData ? (
              <div className="text-center py-4">
                <span className="text-gray-400">No whale data</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Impact Level</span>
                  <div className="flex items-center space-x-1">
                    {getWhaleImpactIcon(whaleData.whaleImpact)}
                    <span className={`text-sm font-semibold ${
                      whaleData.whaleImpact === 'high' ? 'text-red-400' :
                      whaleData.whaleImpact === 'medium' ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {whaleData.whaleImpact.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400">Whale Orders</div>
                    <div className="font-semibold text-white">{whaleData.whaleOrderCount}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400">Volume Ratio</div>
                    <div className="font-semibold text-white">{(whaleData.whaleVolumeRatio * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Dominant Side:</span>
                  <span className={`font-semibold ${
                    whaleData.dominantSide === 'bid' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {whaleData.dominantSide.toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Smart Money Flow */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-md font-semibold text-white flex items-center">
              <Zap className="h-5 w-5 text-blue-400 mr-2" />
              Smart Money
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!smartMoneyData ? (
              <div className="text-center py-4">
                <span className="text-gray-400">No smart money data</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Flow Direction</span>
                  <div className="flex items-center space-x-1">
                    {getFlowDirectionIcon(smartMoneyData.flowDirection)}
                    <span className={`text-sm font-semibold ${
                      smartMoneyData.flowDirection === 'bullish' ? 'text-green-400' :
                      smartMoneyData.flowDirection === 'bearish' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {smartMoneyData.flowDirection.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400">Smart Bids</div>
                    <div className="font-semibold text-green-400">{smartMoneyData.smartBidCount}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400">Smart Asks</div>
                    <div className="font-semibold text-red-400">{smartMoneyData.smartAskCount}</div>
                  </div>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Market Sentiment:</span>
                  <Badge variant={
                    smartMoneyData.marketSentiment === 'accumulation' ? 'default' :
                    smartMoneyData.marketSentiment === 'distribution' ? 'destructive' : 'secondary'
                  } className="text-xs">
                    {smartMoneyData.marketSentiment}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
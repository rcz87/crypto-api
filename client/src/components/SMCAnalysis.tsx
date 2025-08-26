import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Eye, Target, BarChart3, Zap } from 'lucide-react';
import { SMCAnalysisData } from '@shared/schema';

interface SMCProps {
  className?: string;
}

export function SMCAnalysis({ className = '' }: SMCProps) {
  const [timeframe, setTimeframe] = useState('1H');
  
  const { data: smcData, isLoading, error } = useQuery<{
    success: boolean;
    data: SMCAnalysisData;
    timestamp: string;
  }>({
    queryKey: [`/api/sol/smc`, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/sol/smc?timeframe=${timeframe}&limit=100`);
      if (!response.ok) {
        throw new Error('Failed to fetch SMC data');
      }
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const smc = smcData?.data;

  // Determine trend color and icon
  const getTrendDisplay = (trend: string) => {
    switch (trend) {
      case 'bullish':
        return { color: 'text-green-400', icon: TrendingUp, bg: 'bg-green-500/10' };
      case 'bearish':
        return { color: 'text-red-400', icon: TrendingDown, bg: 'bg-red-500/10' };
      default:
        return { color: 'text-yellow-400', icon: Activity, bg: 'bg-yellow-500/10' };
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSignificanceIcon = (significance: string) => {
    switch (significance) {
      case 'high': return '🔥';
      case 'medium': return '⚡';
      default: return '💫';
    }
  };

  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(3);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(parseInt(timestamp)).toLocaleTimeString();
  };

  if (isLoading) {
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5" />
            SMC Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            <div className="h-8 bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !smc) {
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5" />
            SMC Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-center py-4">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            Failed to load SMC analysis
          </div>
        </CardContent>
      </Card>
    );
  }

  const trendDisplay = getTrendDisplay(smc.trend);
  const TrendIcon = trendDisplay.icon;

  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5" />
            SMC Analysis
          </CardTitle>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-20 bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="30m">30m</SelectItem>
              <SelectItem value="1H">1H</SelectItem>
              <SelectItem value="4H">4H</SelectItem>
              <SelectItem value="1D">1D</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Market Structure Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-3 rounded-lg ${trendDisplay.bg} border border-gray-700`}>
            <div className="flex items-center gap-2 mb-1">
              <TrendIcon className={`h-4 w-4 ${trendDisplay.color}`} />
              <span className="text-gray-300 text-sm">Trend</span>
            </div>
            <div className={`font-semibold capitalize ${trendDisplay.color}`}>
              {smc.trend}
            </div>
          </div>
          
          <div className="p-3 rounded-lg bg-blue-500/10 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-blue-400" />
              <span className="text-gray-300 text-sm">Confidence</span>
            </div>
            <div className={`font-semibold ${getConfidenceColor(smc.confidence)}`}>
              {smc.confidence}%
            </div>
          </div>
        </div>

        {/* Market Structure Status */}
        <div className="p-3 rounded-lg bg-purple-500/10 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-purple-400" />
            <span className="text-gray-300 text-sm">Market Structure</span>
          </div>
          <Badge 
            variant="outline" 
            className={`capitalize ${
              smc.marketStructure === 'bullish' ? 'border-green-500 text-green-400' :
              smc.marketStructure === 'bearish' ? 'border-red-500 text-red-400' :
              smc.marketStructure === 'ranging' ? 'border-yellow-500 text-yellow-400' :
              'border-gray-500 text-gray-400'
            }`}
          >
            {smc.marketStructure}
          </Badge>
        </div>

        {/* BOS/CHoCH Information */}
        {(smc.lastBOS || smc.lastCHoCH) && (
          <div className="space-y-2">
            <div className="text-gray-300 text-sm font-medium">Structure Breaks</div>
            
            {smc.lastBOS && (
              <div className="p-2 rounded bg-gray-800 border border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Last BOS</span>
                  <Badge variant="outline" className={smc.lastBOS.type === 'bullish' ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}>
                    {smc.lastBOS.type}
                  </Badge>
                </div>
                <div className="text-white text-sm mt-1">
                  ${formatPrice(smc.lastBOS.price)}
                </div>
                <div className="text-gray-500 text-xs">
                  {formatTimestamp(smc.lastBOS.timestamp)}
                </div>
              </div>
            )}
            
            {smc.lastCHoCH && (
              <div className="p-2 rounded bg-gray-800 border border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Last CHoCH</span>
                  <Badge variant="outline" className="border-blue-500 text-blue-400">
                    {smc.lastCHoCH.from} → {smc.lastCHoCH.to}
                  </Badge>
                </div>
                <div className="text-white text-sm mt-1">
                  ${formatPrice(smc.lastCHoCH.price)}
                </div>
                <div className="text-gray-500 text-xs">
                  {formatTimestamp(smc.lastCHoCH.timestamp)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fair Value Gaps */}
        {smc.fvgs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-400" />
              <span className="text-gray-300 text-sm font-medium">Fair Value Gaps ({smc.fvgs.length})</span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {smc.fvgs.slice(0, 3).map((fvg) => (
                <div key={fvg.id} className="p-2 rounded bg-gray-800 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">
                      {getSignificanceIcon(fvg.significance)} 
                      <Badge variant="outline" className={fvg.type === 'bullish' ? 'border-green-500 text-green-400 ml-1' : 'border-red-500 text-red-400 ml-1'}>
                        {fvg.type}
                      </Badge>
                    </span>
                    <span className="text-gray-400 text-xs">{fvg.significance}</span>
                  </div>
                  <div className="text-white text-xs mt-1">
                    ${formatPrice(fvg.low)} - ${formatPrice(fvg.high)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order Blocks */}
        {smc.orderBlocks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-400" />
              <span className="text-gray-300 text-sm font-medium">Order Blocks ({smc.orderBlocks.length})</span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {smc.orderBlocks.slice(0, 3).map((ob) => (
                <div key={ob.id} className="p-2 rounded bg-gray-800 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={ob.type === 'demand' ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}>
                      {ob.type}
                    </Badge>
                    <span className="text-gray-400 text-xs">{ob.strength}</span>
                  </div>
                  <div className="text-white text-xs mt-1">
                    ${formatPrice(ob.price)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equal Levels & Liquidity Sweeps */}
        <div className="grid grid-cols-2 gap-2">
          {/* Equal Highs/Lows */}
          {(smc.eqh.length > 0 || smc.eql.length > 0) && (
            <div className="p-2 rounded bg-gray-800 border border-gray-700">
              <div className="text-gray-300 text-xs font-medium mb-1">Equal Levels</div>
              <div className="space-y-1">
                {smc.eqh.length > 0 && (
                  <div className="text-green-400 text-xs">EQH: {smc.eqh.length}</div>
                )}
                {smc.eql.length > 0 && (
                  <div className="text-red-400 text-xs">EQL: {smc.eql.length}</div>
                )}
              </div>
            </div>
          )}

          {/* Liquidity Sweeps */}
          {smc.liquiditySweeps.length > 0 && (
            <div className="p-2 rounded bg-gray-800 border border-gray-700">
              <div className="text-gray-300 text-xs font-medium mb-1">Liq. Sweeps</div>
              <div className="space-y-1">
                {smc.liquiditySweeps.slice(0, 2).map((sweep, idx) => (
                  <div key={idx} className="text-xs">
                    <Badge variant="outline" className={sweep.type === 'buy_side' ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}>
                      {sweep.type === 'buy_side' ? 'Buy' : 'Sell'} Side
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Last Update */}
        <div className="text-gray-500 text-xs text-center pt-2 border-t border-gray-700">
          Updated: {smcData?.timestamp ? new Date(smcData.timestamp).toLocaleTimeString() : 'Unknown'}
        </div>
      </CardContent>
    </Card>
  );
}
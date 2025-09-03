import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Zap,
  Clock,
  Target,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Volume2,
  Eye,
  DollarSign,
  Layers,
  Gauge
} from 'lucide-react';
import { CVDAnalysis } from '@shared/schema';

interface CVDProps {
  className?: string;
}

export function CVDAnalysisComponent({ className = '' }: CVDProps) {
  const [timeframe, setTimeframe] = useState('1H');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const { data: cvdData, isLoading, error, dataUpdatedAt } = useQuery<{
    success: boolean;
    data: CVDAnalysis;
    timestamp: string;
  }>({
    queryKey: [`/api/sol/cvd`, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/sol/cvd?timeframe=${timeframe}&limit=100`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch CVD data`);
      }
      return response.json();
    },
    refetchInterval: 15000, // 15 seconds - slower than SMC for heavy calculations
    staleTime: 12000, // Consider stale after 12 seconds
    retry: 3,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  const cvd = cvdData?.data;

  // Helper functions
  const getDominantSideDisplay = (side: string) => {
    switch (side) {
      case 'buyers':
        return { color: 'text-green-400 bg-green-500/20', icon: ArrowUp, label: '🟢 Buyers Control' };
      case 'sellers':
        return { color: 'text-red-400 bg-red-500/20', icon: ArrowDown, label: '🔴 Sellers Control' };
      default:
        return { color: 'text-yellow-400 bg-yellow-500/20', icon: Activity, label: '🟡 Balanced' };
    }
  };

  const getMomentumColor = (momentum: string) => {
    switch (momentum) {
      case 'bullish':
        return 'text-green-400';
      case 'bearish':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getFlowColor = (trend: string) => {
    switch (trend) {
      case 'accumulation':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'distribution':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'rotation':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    return 'bg-red-500/20 text-red-400 border-red-500';
  };

  const formatNumber = (num: string) => {
    const value = parseFloat(num);
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    }
    if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toFixed(2);
  };

  const getDataAge = () => {
    if (!lastUpdate) return null;
    const ageSeconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (ageSeconds < 60) return `${ageSeconds}s ago`;
    const ageMinutes = Math.floor(ageSeconds / 60);
    if (ageMinutes < 60) return `${ageMinutes}m ago`;
    return 'Stale';
  };

  if (isLoading) {
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Volume2 className="h-5 w-5 animate-pulse" />
            CVD Professional Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-700 rounded-lg w-full"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-24 bg-gray-700 rounded"></div>
              <div className="h-24 bg-gray-700 rounded"></div>
              <div className="h-24 bg-gray-700 rounded"></div>
            </div>
            <div className="h-40 bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !cvd) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load CVD analysis';
    
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            CVD Professional Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">CVD Analysis Unavailable</p>
            <p className="text-sm text-gray-400">{errorMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dominantSideDisplay = getDominantSideDisplay(cvd.buyerSellerAggression.dominantSide);
  const dataAge = getDataAge();

  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            CVD Professional Analysis
            {dataAge && (
              <span className={`text-xs px-2 py-1 rounded ${
                dataAge.includes('Stale') ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-gray-300'
              }`}>
                {dataAge}
              </span>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-3">
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
        </div>

        {/* CVD Summary - Prominent Display */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Badge className={`px-4 py-2 text-lg font-bold border-2 ${getConfidenceColor(cvd.confidence.overall)}`}>
              <Gauge className="h-4 w-4 mr-2" />
              {cvd.confidence.overall}% Confidence
            </Badge>

            <Badge className={`px-3 py-1 ${dominantSideDisplay.color}`}>
              <dominantSideDisplay.icon className="h-4 w-4 mr-1" />
              {dominantSideDisplay.label}
            </Badge>

            <Badge className={`px-3 py-1 ${getFlowColor(cvd.flowAnalysis.trend)}`}>
              <Layers className="h-4 w-4 mr-1" />
              {cvd.flowAnalysis.trend.charAt(0).toUpperCase() + cvd.flowAnalysis.trend.slice(1)}
            </Badge>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-400">Current CVD</div>
            <div className={`text-xl font-mono font-bold ${getMomentumColor(cvd.realTimeMetrics.momentum)}`}>
              {formatNumber(cvd.currentCVD)}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Real-time Metrics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Zap className="h-4 w-4" />
            Real-time Volume Flow
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">Buy Pressure</span>
                <span className="text-green-400 font-semibold">{cvd.realTimeMetrics.currentBuyPressure}%</span>
              </div>
              <Progress 
                value={cvd.realTimeMetrics.currentBuyPressure} 
                className="h-2 bg-gray-700"
              />
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">Sell Pressure</span>
                <span className="text-red-400 font-semibold">{cvd.realTimeMetrics.currentSellPressure}%</span>
              </div>
              <Progress 
                value={cvd.realTimeMetrics.currentSellPressure} 
                className="h-2 bg-gray-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-xs text-gray-400 mb-1">Momentum</div>
              <div className={`text-sm font-semibold ${getMomentumColor(cvd.realTimeMetrics.momentum)}`}>
                {cvd.realTimeMetrics.momentum.charAt(0).toUpperCase() + cvd.realTimeMetrics.momentum.slice(1)}
              </div>
            </div>
            
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-xs text-gray-400 mb-1">Velocity</div>
              <div className="text-sm font-mono text-white">{cvd.realTimeMetrics.velocity}</div>
            </div>
            
            <div className="bg-gray-800 p-3 rounded-lg text-center">
              <div className="text-xs text-gray-400 mb-1">Change</div>
              <div className={`text-sm font-mono ${cvd.percentageChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {cvd.percentageChange >= 0 ? '+' : ''}{cvd.percentageChange.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Buyer vs Seller Aggression */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <BarChart3 className="h-4 w-4" />
            Buyer vs Seller Aggression
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-green-500">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUp className="h-4 w-4 text-green-400" />
                <span className="text-green-400 font-semibold">Buyers</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-gray-400">Percentage</div>
                  <div className="text-white font-semibold">{cvd.buyerSellerAggression.buyerAggression.percentage}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Strength</div>
                  <div className="text-green-400 capitalize">{cvd.buyerSellerAggression.buyerAggression.strength}</div>
                </div>
                <div>
                  <div className="text-gray-400">Volume</div>
                  <div className="text-white font-mono text-xs">{formatNumber(cvd.buyerSellerAggression.buyerAggression.volume)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Avg Size</div>
                  <div className="text-white font-mono text-xs">{formatNumber(cvd.buyerSellerAggression.buyerAggression.averageSize)}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg border-l-4 border-red-500">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDown className="h-4 w-4 text-red-400" />
                <span className="text-red-400 font-semibold">Sellers</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-gray-400">Percentage</div>
                  <div className="text-white font-semibold">{cvd.buyerSellerAggression.sellerAggression.percentage}%</div>
                </div>
                <div>
                  <div className="text-gray-400">Strength</div>
                  <div className="text-red-400 capitalize">{cvd.buyerSellerAggression.sellerAggression.strength}</div>
                </div>
                <div>
                  <div className="text-gray-400">Volume</div>
                  <div className="text-white font-mono text-xs">{formatNumber(cvd.buyerSellerAggression.sellerAggression.volume)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Avg Size</div>
                  <div className="text-white font-mono text-xs">{formatNumber(cvd.buyerSellerAggression.sellerAggression.averageSize)}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Market Pressure</div>
                <Badge className={`${
                  cvd.buyerSellerAggression.marketPressure === 'buying_pressure' || cvd.buyerSellerAggression.marketPressure === 'accumulation' ? 
                  'bg-green-500/20 text-green-400' :
                  cvd.buyerSellerAggression.marketPressure === 'selling_pressure' || cvd.buyerSellerAggression.marketPressure === 'distribution' ?
                  'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {cvd.buyerSellerAggression.marketPressure.replace('_', ' ')}
                </Badge>
              </div>
              
              <div>
                <div className="text-gray-400 mb-1">Imbalance Ratio</div>
                <div className="text-white font-mono">{cvd.buyerSellerAggression.imbalanceRatio.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Flow Analysis */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Activity className="h-4 w-4" />
            Flow Analysis
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Phase</div>
                <Badge className="capitalize">{cvd.flowAnalysis.phase.replace('_', ' ')}</Badge>
              </div>
              
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Strength</div>
                <Badge className={`${
                  cvd.flowAnalysis.strength === 'strong' ? 'bg-green-500/20 text-green-400' :
                  cvd.flowAnalysis.strength === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {cvd.flowAnalysis.strength}
                </Badge>
              </div>
              
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Duration</div>
                <div className="text-white text-sm">{cvd.flowAnalysis.duration}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Net Flow</div>
                <div className={`font-mono ${
                  parseFloat(cvd.flowAnalysis.volumeProfile.netFlow) > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatNumber(cvd.flowAnalysis.volumeProfile.netFlow)}
                </div>
              </div>
              
              <div>
                <div className="text-gray-400 mb-1">Flow Direction</div>
                <Badge className={`${
                  cvd.flowAnalysis.volumeProfile.flowDirection === 'inflow' ? 'bg-green-500/20 text-green-400' :
                  cvd.flowAnalysis.volumeProfile.flowDirection === 'outflow' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {cvd.flowAnalysis.volumeProfile.flowDirection}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Money Signals */}
        {(cvd.smartMoneySignals.accumulation.detected || cvd.smartMoneySignals.distribution.detected || cvd.smartMoneySignals.manipulation.detected) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Eye className="h-4 w-4" />
              Smart Money Signals
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {cvd.smartMoneySignals.accumulation.detected && (
                <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span className="text-green-400 font-semibold">Accumulation Detected</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    Smart money accumulation pattern identified - {cvd.smartMoneySignals.accumulation.strength} strength
                  </div>
                </div>
              )}
              
              {cvd.smartMoneySignals.distribution.detected && (
                <div className="bg-red-900/20 border border-red-500/30 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-red-400" />
                    <span className="text-red-400 font-semibold">Distribution Detected</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    Smart money distribution pattern identified - {cvd.smartMoneySignals.distribution.strength} strength
                  </div>
                </div>
              )}
              
              {cvd.smartMoneySignals.manipulation.detected && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                    <span className="text-yellow-400 font-semibold">Manipulation Alert</span>
                  </div>
                  <div className="text-sm text-gray-300">
                    {cvd.smartMoneySignals.manipulation.type.replace('_', ' ')} pattern - {cvd.smartMoneySignals.manipulation.confidence}% confidence
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Alerts */}
        {cvd.alerts && cvd.alerts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Active Alerts ({cvd.alerts.length})
            </div>
            
            <div className="space-y-2">
              {cvd.alerts.slice(0, 3).map((alert, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${
                  alert.priority === 'critical' ? 'bg-red-900/20 border-red-500/30' :
                  alert.priority === 'high' ? 'bg-orange-900/20 border-orange-500/30' :
                  alert.priority === 'medium' ? 'bg-yellow-900/20 border-yellow-500/30' :
                  'bg-gray-800 border-gray-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`h-4 w-4 ${
                        alert.priority === 'critical' ? 'text-red-400' :
                        alert.priority === 'high' ? 'text-orange-400' :
                        alert.priority === 'medium' ? 'text-yellow-400' :
                        'text-gray-400'
                      }`} />
                      <span className="text-white text-sm font-medium">{alert.message}</span>
                    </div>
                    <Badge className={`text-xs ${
                      alert.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                      alert.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      alert.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {alert.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer with confidence breakdown and last update */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="text-white font-semibold text-sm">Confidence Breakdown</div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              Updated {new Date(cvd.lastUpdate).toLocaleTimeString()}
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="text-center">
              <div className="text-gray-400 mb-1">Overall</div>
              <div className="text-white font-semibold">{cvd.confidence.overall}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Data Quality</div>
              <div className="text-white font-semibold">{cvd.confidence.dataQuality}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Signal Clarity</div>
              <div className="text-white font-semibold">{cvd.confidence.signalClarity}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">TF Synergy</div>
              <div className="text-white font-semibold">{cvd.confidence.timeframeSynergy}%</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
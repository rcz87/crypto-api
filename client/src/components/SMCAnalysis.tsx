import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  Eye, 
  Target, 
  BarChart3, 
  Zap,
  Clock,
  Layers,
  MapPin,
  TrendingUpDown,
  ChevronDown,
  ChevronUp,
  Globe,
  DollarSign,
  Gauge
} from 'lucide-react';
import { SMCAnalysisData } from '@shared/schema';
import { useSymbol } from '@/contexts/SymbolContext';

interface SMCProps {
  className?: string;
}

export function SMCAnalysis({ className = '' }: SMCProps) {
  const [timeframe, setTimeframe] = useState('1H');
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { symbol } = useSymbol();
  
  // Format symbol for API (remove USDT suffix and convert to lowercase)
  const selectedPair = symbol.replace('USDT', '').toLowerCase();
  
  const { data: smcData, isLoading, error, dataUpdatedAt } = useQuery<{
    success: boolean;
    data: SMCAnalysisData;
    timestamp: string;
  }>({
    queryKey: [`/api/${selectedPair}/smc`, timeframe],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/${selectedPair}/smc?timeframe=${timeframe}&limit=100`, {
        signal // AbortController signal for cleanup
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch SMC data`);
      }
      return response.json();
    },
    refetchInterval: false, // Manual refresh only
    staleTime: 8000, // Consider stale after 8 seconds
    retry: 3,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false, // Stop refetching when tab is not active
  });

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  const smc = smcData?.data;

  // Helper functions
  const getTrendDisplay = (trend: string) => {
    switch (trend) {
      case 'bullish':
        return { color: 'text-green-400 bg-green-500/20', icon: TrendingUp, label: '🟢 Bullish' };
      case 'bearish':
        return { color: 'text-red-400 bg-red-500/20', icon: TrendingDown, label: '🔴 Bearish' };
      default:
        return { color: 'text-yellow-400 bg-yellow-500/20', icon: Activity, label: '🟡 Ranging' };
    }
  };

  const getConfluenceColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    return 'bg-red-500/20 text-red-400 border-red-500';
  };

  const getDataAge = () => {
    if (!lastUpdate) return null;
    const ageSeconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
    if (ageSeconds < 60) return `${ageSeconds}s ago`;
    const ageMinutes = Math.floor(ageSeconds / 60);
    if (ageMinutes < 60) return `${ageMinutes}m ago`;
    return 'Stale';
  };

  const formatPrice = (price: string) => {
    return parseFloat(price).toFixed(3);
  };

  const getSessionIcon = (session: string) => {
    switch (session) {
      case 'Asia': return '🌅';
      case 'London': return '🌍';
      case 'NY': return '🗽';
      default: return '🌐';
    }
  };

  if (isLoading) {
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5 animate-spin" />
            SMC Professional Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-700 rounded-lg w-48"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-gray-700 rounded"></div>
              <div className="h-16 bg-gray-700 rounded"></div>
              <div className="h-16 bg-gray-700 rounded"></div>
            </div>
            <div className="h-32 bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !smc) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load SMC analysis';
    
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5" />
            SMC Professional Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Analysis Unavailable</p>
            <p className="text-sm text-gray-400">{errorMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trendDisplay = getTrendDisplay(smc.trend);
  const dataAge = getDataAge();

  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5" />
            SMC Professional Analysis
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

        {/* Confluence Score - Prominent Display */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Badge className={`px-4 py-2 text-lg font-bold border-2 ${getConfluenceColor(smc.confluenceScore)}`}>
              <Gauge className="h-4 w-4 mr-2" />
              {smc.confluenceScore}% Confluence
            </Badge>

            <Badge className={`px-3 py-1 ${trendDisplay.color}`}>
              <trendDisplay.icon className="h-4 w-4 mr-1" />
              {trendDisplay.label}
            </Badge>

            <Badge className={`px-3 py-1 ${
              smc.regime === 'trending' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
            }`}>
              <TrendingUpDown className="h-4 w-4 mr-1" />
              {smc.regime === 'trending' ? 'Trending' : 'Ranging'}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Globe className="h-4 w-4" />
            {getSessionIcon(smc.session)} {smc.session} Session
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Enhanced: Cross-Dashboard Risk Alerts */}
        {smc.riskAlerts && smc.riskAlerts.alerts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <AlertTriangle className={`h-4 w-4 ${
                smc.riskAlerts.overallRiskLevel === 'extreme' ? 'text-red-500' :
                smc.riskAlerts.overallRiskLevel === 'high' ? 'text-red-400' :
                smc.riskAlerts.overallRiskLevel === 'medium' ? 'text-yellow-400' :
                'text-gray-400'
              }`} />
              Cross-Dashboard Risk Alerts
              <Badge className={`text-xs ${
                smc.riskAlerts.overallRiskLevel === 'extreme' ? 'bg-red-500/20 text-red-400 border-red-500' :
                smc.riskAlerts.overallRiskLevel === 'high' ? 'bg-red-500/20 text-red-400 border-red-500' :
                smc.riskAlerts.overallRiskLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500' :
                'bg-gray-500/20 text-gray-400 border-gray-500'
              }`}>
                {smc.riskAlerts.overallRiskLevel.toUpperCase()} RISK
              </Badge>
            </div>
            <div className="space-y-2">
              {smc.riskAlerts.alerts.map((alert, index) => (
                <div key={index} className={`p-3 rounded-lg border-l-4 ${
                  alert.severity === 'extreme' ? 'bg-red-950/30 border-red-500' :
                  alert.severity === 'high' ? 'bg-red-900/30 border-red-400' :
                  alert.severity === 'medium' ? 'bg-yellow-900/30 border-yellow-400' :
                  'bg-gray-900/30 border-gray-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          alert.severity === 'extreme' ? 'bg-red-500 text-white' :
                          alert.severity === 'high' ? 'bg-red-400 text-white' :
                          alert.severity === 'medium' ? 'bg-yellow-400 text-black' :
                          'bg-gray-400 text-black'
                        }`}>
                          {alert.type.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">{alert.source}</span>
                      </div>
                      <p className="text-sm text-white mb-2">{alert.message}</p>
                      <p className="text-xs text-gray-300">{alert.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Multi-Timeframe Alignment */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Layers className="h-4 w-4" />
            Multi-Timeframe Alignment
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(smc.multiTimeframe).map(([tf, trend]) => {
              const tfTrend = getTrendDisplay(trend);
              return (
                <div key={tf} className={`p-3 rounded-lg border ${tfTrend.color.split(' ')[1]}`}>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">{tf}</div>
                    <div className={`text-sm font-semibold ${tfTrend.color.split(' ')[0]}`}>
                      {trend.charAt(0).toUpperCase() + trend.slice(1)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Nearest Zones */}
        {smc.nearestZones && smc.nearestZones.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <MapPin className="h-4 w-4" />
              Nearest Key Zones
            </div>
            <div className="grid grid-cols-2 gap-3">
              {smc.nearestZones.slice(0, 4).map((zone, idx) => (
                <div key={idx} className={`p-3 rounded-lg border cursor-pointer hover:opacity-80 ${
                  zone.type === 'FVG' ? 'border-purple-500 bg-purple-500/10' : 'border-orange-500 bg-orange-500/10'
                }`} title={`${zone.type === 'FVG' ? 'Fair Value Gap' : 'Order Block'} - ${zone.significance} significance. ${zone.distancePct.toFixed(2)}% from current price`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-semibold ${
                      zone.type === 'FVG' ? 'text-purple-400' : 'text-orange-400'
                    }`}>
                      {zone.type} {zone.side === 'above' ? '↑' : '↓'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {zone.distancePct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-sm text-white font-mono">${zone.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Derivatives Analysis */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <DollarSign className="h-4 w-4" />
            Derivatives Flow
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Open Interest</div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{smc.derivatives.openInterest.value}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  smc.derivatives.openInterest.trend === 'increasing' ? 'bg-green-500/20 text-green-400' :
                  smc.derivatives.openInterest.trend === 'decreasing' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {smc.derivatives.openInterest.change24h}
                </span>
              </div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">Funding Rate</div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{smc.derivatives.fundingRate.current}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  smc.derivatives.fundingRate.sentiment === 'bullish' ? 'bg-green-500/20 text-green-400' :
                  smc.derivatives.fundingRate.sentiment === 'bearish' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {smc.derivatives.fundingRate.sentiment}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-xs text-gray-400 mb-2">Flow Analysis</div>
            <div className="flex items-center gap-3 mb-2">
              <Badge className={`${
                smc.derivatives.flowAnalysis.signal === 'absorption' ? 'bg-green-500/20 text-green-400' :
                smc.derivatives.flowAnalysis.signal === 'distribution' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {smc.derivatives.flowAnalysis.signal}
              </Badge>
              <Badge className="bg-gray-700 text-gray-300">
                {smc.derivatives.flowAnalysis.strength} strength
              </Badge>
            </div>
            <p className="text-sm text-gray-300">{smc.derivatives.flowAnalysis.description}</p>
          </div>
        </div>

        {/* Trading Scenarios */}
        {smc.scenarios && smc.scenarios.length > 0 && (
          <div className="space-y-3">
            <button 
              onClick={() => setScenariosOpen(!scenariosOpen)}
              className="flex items-center justify-between w-full p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-2 text-white font-semibold">
                <Target className="h-4 w-4" />
                Trading Scenarios ({smc.scenarios.length})
              </div>
              {scenariosOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>
            
            {scenariosOpen && (
              <div className="space-y-3">
                {smc.scenarios.map((scenario, idx) => (
                  <div key={idx} className={`p-4 rounded-lg border ${
                    scenario.side === 'bullish' ? 'border-green-500 bg-green-500/5' : 'border-red-500 bg-red-500/5'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className={`${
                          scenario.side === 'bullish' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {scenario.side === 'bullish' ? '🟢' : '🔴'} {scenario.side.charAt(0).toUpperCase() + scenario.side.slice(1)}
                        </Badge>
                        <span className="text-xs text-gray-400">{scenario.probability}% probability</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Trigger</div>
                        <div className="text-white font-mono">${scenario.trigger}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Target</div>
                        <div className="text-white font-mono">${scenario.target}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Stop Loss</div>
                        <div className="text-white font-mono">${scenario.invalidation}</div>
                      </div>
                    </div>
                    
                    {scenario.note && (
                      <p className="text-xs text-gray-300 mt-3 italic">{scenario.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Market Structure Summary */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-white font-semibold mb-3">
            <BarChart3 className="h-4 w-4" />
            Market Structure
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">Last BOS (Break of Structure)</div>
              <div className="text-white">
                {smc.lastBOS ? (
                  <>
                    <Badge className={`mr-2 ${
                      smc.lastBOS.type === 'bullish' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {smc.lastBOS.type}
                    </Badge>
                    <span className="font-mono">${formatPrice(smc.lastBOS.price)}</span>
                  </>
                ) : (
                  <span className="text-gray-500">No recent BOS</span>
                )}
              </div>
            </div>
            
            <div>
              <div className="text-gray-400 mb-1" title="Average True Range - measures volatility">
                ATR Volatility
              </div>
              <div className="text-white">
                <Badge className={`mr-2 ${
                  smc.atr.volatilityRegime === 'high' ? 'bg-red-500/20 text-red-400' :
                  smc.atr.volatilityRegime === 'low' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {smc.atr.volatilityRegime}
                </Badge>
                <span className="font-mono">{smc.atr.value}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with confidence and last update */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
          <div className="flex items-center gap-4">
            <span>Confidence: {smc.confidence}%</span>
            <span>Base Analysis: {timeframe}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Updated {new Date(smc.lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
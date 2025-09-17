import { useState, useEffect, createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle,
  Target,
  BarChart3,
  Gauge,
  Eye,
  RefreshCw,
  Grid3X3,
  Layers,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { useSymbol } from '@/contexts/SymbolContext';

// Timeframe configuration with display names and colors
const TIMEFRAMES = [
  { key: '15m', label: '15M', color: 'bg-purple-500/20 text-purple-400 border-purple-500' },
  { key: '1H', label: '1H', color: 'bg-blue-500/20 text-blue-400 border-blue-500' },
  { key: '4H', label: '4H', color: 'bg-green-500/20 text-green-400 border-green-500' },
  { key: '1D', label: '1D', color: 'bg-orange-500/20 text-orange-400 border-orange-500' }
];

interface TimeframeAnalysis {
  timeframe: string;
  smc: any;
  confluence: any;
  technical: any;
  fibonacci: any;
  cvd: any;
  isLoading: boolean;
  error: any;
}

interface MultiTimeframeContextType {
  selectedTimeframes: string[];
  setSelectedTimeframes: (timeframes: string[]) => void;
  syncMode: boolean;
  setSyncMode: (sync: boolean) => void;
}

const MultiTimeframeContext = createContext<MultiTimeframeContextType | null>(null);

export function MultiTimeframeAnalysis() {
  const [selectedTimeframes, setSelectedTimeframes] = useState(['15m', '1H', '4H', '1D']);
  const [syncMode, setSyncMode] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { symbol } = useSymbol();
  
  // Format symbol for API (remove USDT suffix and convert to lowercase)
  const selectedPair = symbol.replace('USDT', '').toLowerCase();

  // Fetch data for all selected timeframes
  const timeframeAnalyses: TimeframeAnalysis[] = selectedTimeframes.map(timeframe => {
    const { data: smcData, isLoading: smcLoading, error: smcError } = useQuery({
      queryKey: [`/api/${selectedPair}/smc`, timeframe, lastRefresh],
      queryFn: async () => {
        const response = await fetch(`/api/${selectedPair}/smc?timeframe=${timeframe}&limit=100`);
        if (!response.ok) throw new Error('SMC fetch failed');
        return response.json();
      },
      refetchInterval: false,
      staleTime: 30000,
    });

    const { data: confluenceData, isLoading: confluenceLoading, error: confluenceError } = useQuery({
      queryKey: [`/api/${selectedPair}/confluence`, timeframe, lastRefresh],
      queryFn: async () => {
        const response = await fetch(`/api/${selectedPair}/confluence?timeframe=${timeframe}`);
        if (!response.ok) throw new Error('Confluence fetch failed');
        return response.json();
      },
      refetchInterval: false,
      staleTime: 30000,
    });

    const { data: technicalData, isLoading: technicalLoading, error: technicalError } = useQuery({
      queryKey: [`/api/${selectedPair}/technical`, timeframe, lastRefresh],
      queryFn: async () => {
        const response = await fetch(`/api/${selectedPair}/technical?timeframe=${timeframe}&limit=100`);
        if (!response.ok) throw new Error('Technical fetch failed');
        return response.json();
      },
      refetchInterval: false,
      staleTime: 30000,
    });

    const { data: fibonacciData, isLoading: fibonacciLoading, error: fibonacciError } = useQuery({
      queryKey: [`/api/${selectedPair}/fibonacci`, timeframe, lastRefresh],
      queryFn: async () => {
        const response = await fetch(`/api/${selectedPair}/fibonacci?timeframe=${timeframe}&limit=100`);
        if (!response.ok) throw new Error('Fibonacci fetch failed');
        return response.json();
      },
      refetchInterval: false,
      staleTime: 30000,
    });

    const { data: cvdData, isLoading: cvdLoading, error: cvdError } = useQuery({
      queryKey: [`/api/${selectedPair}/cvd`, timeframe, lastRefresh],
      queryFn: async () => {
        const response = await fetch(`/api/${selectedPair}/cvd?timeframe=${timeframe}&limit=100`);
        if (!response.ok) throw new Error('CVD fetch failed');
        return response.json();
      },
      refetchInterval: false,
      staleTime: 30000,
    });

    return {
      timeframe,
      smc: smcData?.data,
      confluence: confluenceData?.data,
      technical: technicalData?.data,
      fibonacci: fibonacciData?.data,
      cvd: cvdData?.data,
      isLoading: smcLoading || confluenceLoading || technicalLoading || fibonacciLoading || cvdLoading,
      error: smcError || confluenceError || technicalError || fibonacciError || cvdError
    };
  });

  const handleRefreshAll = () => {
    setLastRefresh(new Date());
  };

  const getTimeframeConfig = (timeframe: string) => {
    return TIMEFRAMES.find(tf => tf.key === timeframe) || TIMEFRAMES[1];
  };


  // Multi-timeframe confluence analysis
  const overallConfluence = () => {
    const validAnalyses = timeframeAnalyses.filter(analysis => analysis.confluence && !analysis.isLoading);
    if (validAnalyses.length === 0) return { trend: 'neutral', strength: 'weak', score: 0 };

    const bullishCount = validAnalyses.filter(a => a.confluence.trend === 'bullish').length;
    const bearishCount = validAnalyses.filter(a => a.confluence.trend === 'bearish').length;
    const avgScore = validAnalyses.reduce((sum, a) => sum + (a.confluence.overall || 0), 0) / validAnalyses.length;

    let trend = 'neutral';
    let strength = 'weak';

    if (bullishCount > bearishCount) {
      trend = 'bullish';
      strength = bullishCount >= validAnalyses.length * 0.75 ? 'strong' : 'moderate';
    } else if (bearishCount > bullishCount) {
      trend = 'bearish'; 
      strength = bearishCount >= validAnalyses.length * 0.75 ? 'strong' : 'moderate';
    }

    return { trend, strength, score: Math.round(avgScore) };
  };

  const overall = overallConfluence();

  return (
    <MultiTimeframeContext.Provider value={{ selectedTimeframes, setSelectedTimeframes, syncMode, setSyncMode }}>
      <div className="space-y-6">
        {/* Header Controls */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-3">
                <Grid3X3 className="h-6 w-6 text-blue-400" />
                Multi-Timeframe Analysis
                <Badge className="bg-blue-500/20 text-blue-400 ml-2">
                  Synchronized
                </Badge>
              </CardTitle>
              
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefreshAll}
                  className="text-gray-300 border-gray-600 hover:bg-gray-800"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh All
                </Button>
                
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {lastRefresh.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {/* Overall Multi-Timeframe Confluence */}
            <div className="bg-gray-800 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">Overall Confluence</h3>
                  <Badge className={`px-3 py-1 border ${getTrendColor(overall.trend)}`}>
                    {getTrendIcon(overall.trend)}
                    <span className="ml-2">{overall.trend.toUpperCase()}</span>
                  </Badge>
                  <Badge className="bg-gray-600/50 text-gray-300">
                    {overall.strength} strength
                  </Badge>
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-gray-400">Multi-TF Score</div>
                  <div className={`text-2xl font-bold ${
                    overall.score > 0 ? 'text-green-400' : 
                    overall.score < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {overall.score > 0 ? '+' : ''}{overall.score}
                  </div>
                </div>
              </div>
            </div>

            {/* Timeframe Selection */}
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>Active Timeframes:</span>
              {TIMEFRAMES.map(tf => (
                <Badge 
                  key={tf.key} 
                  className={selectedTimeframes.includes(tf.key) ? tf.color : 'bg-gray-600/50 text-gray-400'}
                >
                  {tf.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Multi-Timeframe Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {timeframeAnalyses.map((analysis, index) => {
            const config = getTimeframeConfig(analysis.timeframe);
            
            return (
              <TimeframeCard 
                key={analysis.timeframe}
                analysis={analysis}
                config={config}
                index={index}
              />
            );
          })}
        </div>

        {/* Summary Table */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Cross-Timeframe Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 text-gray-400">Timeframe</th>
                    <th className="text-left py-2 text-gray-400">SMC Trend</th>
                    <th className="text-left py-2 text-gray-400">Confluence</th>
                    <th className="text-left py-2 text-gray-400">Technical</th>
                    <th className="text-left py-2 text-gray-400">Fibonacci</th>
                    <th className="text-left py-2 text-gray-400">CVD</th>
                  </tr>
                </thead>
                <tbody>
                  {timeframeAnalyses.map(analysis => (
                    <tr key={analysis.timeframe} className="border-b border-gray-800/50">
                      <td className="py-3">
                        <Badge className={getTimeframeConfig(analysis.timeframe).color}>
                          {getTimeframeConfig(analysis.timeframe).label}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {analysis.isLoading ? (
                          <div className="animate-pulse bg-gray-700 h-4 w-16 rounded"></div>
                        ) : (
                          <Badge className={`text-xs ${getTrendColor(analysis.smc?.trend || 'neutral')}`}>
                            {getTrendIcon(analysis.smc?.trend || 'neutral')}
                            <span className="ml-1">{analysis.smc?.trend || 'N/A'}</span>
                          </Badge>
                        )}
                      </td>
                      <td className="py-3">
                        {analysis.isLoading ? (
                          <div className="animate-pulse bg-gray-700 h-4 w-12 rounded"></div>
                        ) : (
                          <span className={`font-mono text-xs ${
                            (analysis.confluence?.overall || 0) > 0 ? 'text-green-400' : 
                            (analysis.confluence?.overall || 0) < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            {analysis.confluence?.overall || 0 > 0 ? '+' : ''}{analysis.confluence?.overall || 0}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {analysis.isLoading ? (
                          <div className="animate-pulse bg-gray-700 h-4 w-16 rounded"></div>
                        ) : (
                          <Badge className={`text-xs ${getTrendColor(analysis.technical?.momentum?.overall || 'neutral')}`}>
                            {getTrendIcon(analysis.technical?.momentum?.overall || 'neutral')}
                            <span className="ml-1">{analysis.technical?.momentum?.overall || 'N/A'}</span>
                          </Badge>
                        )}
                      </td>
                      <td className="py-3">
                        {analysis.isLoading ? (
                          <div className="animate-pulse bg-gray-700 h-4 w-16 rounded"></div>
                        ) : (
                          <Badge className={`text-xs ${getTrendColor(analysis.fibonacci?.trend?.direction || 'neutral')}`}>
                            {getTrendIcon(analysis.fibonacci?.trend?.direction || 'neutral')}
                            <span className="ml-1">{analysis.fibonacci?.trend?.direction || 'N/A'}</span>
                          </Badge>
                        )}
                      </td>
                      <td className="py-3">
                        {analysis.isLoading ? (
                          <div className="animate-pulse bg-gray-700 h-4 w-16 rounded"></div>
                        ) : (
                          <Badge className={`text-xs ${getTrendColor(
                            analysis.cvd?.buyerSellerAggression?.dominantSide === 'buyers' ? 'bullish' :
                            analysis.cvd?.buyerSellerAggression?.dominantSide === 'sellers' ? 'bearish' : 'neutral'
                          )}`}>
                            {getTrendIcon(
                              analysis.cvd?.buyerSellerAggression?.dominantSide === 'buyers' ? 'bullish' :
                              analysis.cvd?.buyerSellerAggression?.dominantSide === 'sellers' ? 'bearish' : 'neutral'
                            )}
                            <span className="ml-1">
                              {analysis.cvd?.buyerSellerAggression?.dominantSide || 'N/A'}
                            </span>
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MultiTimeframeContext.Provider>
  );
}

// Utility functions - moved outside component for reuse
const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'bullish': return <ArrowUp className="h-4 w-4 text-green-400" />;
    case 'bearish': return <ArrowDown className="h-4 w-4 text-red-400" />;
    default: return <Minus className="h-4 w-4 text-gray-400" />;
  }
};

const getTrendColor = (trend: string) => {
  switch (trend) {
    case 'bullish': return 'text-green-400 bg-green-500/20 border-green-500';
    case 'bearish': return 'text-red-400 bg-red-500/20 border-red-500';
    default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
  }
};

// Individual Timeframe Card Component
function TimeframeCard({ analysis, config, index }: { 
  analysis: TimeframeAnalysis; 
  config: typeof TIMEFRAMES[0]; 
  index: number;
}) {
  if (analysis.isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="h-5 w-5 animate-pulse" />
            <Badge className={config.color}>{config.label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (analysis.error) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <Badge className={config.color}>{config.label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-center py-4">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Failed to load {config.label} data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <Badge className={config.color}>{config.label}</Badge>
          </CardTitle>
          
          {analysis.confluence && (
            <Badge className={`text-xs ${getTrendColor(analysis.confluence.trend)}`}>
              {analysis.confluence.trend}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Confluence Score */}
        {analysis.confluence && (
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Confluence</span>
              <span className={`text-lg font-bold ${
                analysis.confluence.overall > 0 ? 'text-green-400' : 
                analysis.confluence.overall < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {analysis.confluence.overall > 0 ? '+' : ''}{analysis.confluence.overall}
              </span>
            </div>
            <div className="text-xs text-gray-400">
              Confidence: {analysis.confluence.confidence}%
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* SMC */}
          {analysis.smc && (
            <div className="bg-gray-800/50 p-2 rounded">
              <div className="text-gray-400 mb-1">SMC</div>
              <Badge className={`text-xs ${getTrendColor(analysis.smc.trend)}`}>
                {analysis.smc.trend}
              </Badge>
            </div>
          )}

          {/* Technical */}
          {analysis.technical && (
            <div className="bg-gray-800/50 p-2 rounded">
              <div className="text-gray-400 mb-1">Technical</div>
              <div className="text-white text-xs">
                RSI: {analysis.technical.rsi?.current?.toFixed(1) || 'N/A'}
              </div>
            </div>
          )}

          {/* Fibonacci */}
          {analysis.fibonacci && (
            <div className="bg-gray-800/50 p-2 rounded">
              <div className="text-gray-400 mb-1">Fibonacci</div>
              <Badge className={`text-xs ${getTrendColor(analysis.fibonacci.trend?.direction)}`}>
                {analysis.fibonacci.trend?.direction || 'neutral'}
              </Badge>
            </div>
          )}

          {/* CVD */}
          {analysis.cvd && (
            <div className="bg-gray-800/50 p-2 rounded">
              <div className="text-gray-400 mb-1">CVD</div>
              <div className="text-white text-xs">
                {analysis.cvd.buyerSellerAggression?.dominantSide || 'balanced'}
              </div>
            </div>
          )}
        </div>

        {/* Confidence Indicator */}
        {analysis.confluence && (
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center gap-2 text-xs">
              <Gauge className="h-3 w-3 text-gray-400" />
              <span className="text-gray-400">
                {analysis.confluence.strength} • {analysis.confluence.riskLevel} risk
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MultiTimeframeAnalysis;
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  BarChart3,
  Zap,
  Clock,
  Target,
  Gauge,
  Minus,
  Crosshair,
  Signal,
  LineChart,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
interface TechnicalIndicatorsAnalysis {
  timeframe: string;
  rsi: {
    current: number;
    period: number;
    signal: 'oversold' | 'overbought' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    trend: 'bullish' | 'bearish' | 'neutral';
    divergence: {
      detected: boolean;
      type?: 'bullish' | 'bearish';
      strength?: 'weak' | 'moderate' | 'strong';
    };
    historical: any[];
  };
  ema: {
    fast: any;
    slow: any;
    signal: any;
    crossover: {
      status: 'golden_cross' | 'death_cross' | 'neutral';
      strength: 'weak' | 'moderate' | 'strong';
      timestamp: string;
      confidence: number;
    };
    trend: {
      direction: 'bullish' | 'bearish' | 'neutral';
      strength: 'weak' | 'moderate' | 'strong';
      duration: string;
      consistency: number;
    };
  };
  signals: any[];
  momentum: {
    overall: 'bullish' | 'bearish' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    rsiContribution: number;
    emaContribution: number;
    confluenceScore: number;
  };
  confidence: {
    overall: number;
    rsiQuality: number;
    emaQuality: number;
    dataPoints: number;
    timeframeSynergy: number;
  };
  alerts: {
    type: 'entry' | 'exit' | 'warning' | 'confirmation';
    priority: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
    actionRequired: boolean;
  }[];
  lastUpdate: string;
  dataAge: number;
  calculationTime: number;
}

interface TechnicalIndicatorsProps {
  className?: string;
}

export function TechnicalIndicators({ className = '' }: TechnicalIndicatorsProps) {
  const [timeframe, setTimeframe] = useState('1H');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const { data: technicalData, isLoading, error, dataUpdatedAt } = useQuery<{
    success: boolean;
    data: TechnicalIndicatorsAnalysis;
    timestamp: string;
  }>({
    queryKey: [`/api/sol/technical`, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/sol/technical?timeframe=${timeframe}&limit=100`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch technical indicators data`);
      }
      return response.json();
    },
    refetchInterval: 10000, // 10 seconds
    staleTime: 8000, // Consider stale after 8 seconds
    retry: 3,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  const technical = technicalData?.data;

  // Helper functions
  const getRSIColor = (signal: string) => {
    switch (signal) {
      case 'oversold':
        return 'text-green-400 bg-green-500/20 border-green-500';
      case 'overbought':
        return 'text-red-400 bg-red-500/20 border-red-500';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'bullish':
        return 'text-green-400';
      case 'bearish':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getCrossoverColor = (status: string) => {
    switch (status) {
      case 'golden_cross':
        return 'bg-green-900/20 border-green-500/30 text-green-400';
      case 'death_cross':
        return 'bg-red-900/20 border-red-500/30 text-red-400';
      default:
        return 'bg-gray-800 border-gray-700 text-gray-400';
    }
  };

  const getMomentumColor = (momentum: string) => {
    switch (momentum) {
      case 'bullish':
        return 'text-green-400 bg-green-500/20 border-green-500';
      case 'bearish':
        return 'text-red-400 bg-red-500/20 border-red-500';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500';
    }
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
            <LineChart className="h-5 w-5 animate-pulse" />
            RSI/EMA Technical Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-gray-700 rounded-lg w-full"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-32 bg-gray-700 rounded"></div>
              <div className="h-32 bg-gray-700 rounded"></div>
            </div>
            <div className="h-24 bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !technical) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load technical indicators';
    
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            RSI/EMA Technical Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Technical Analysis Unavailable</p>
            <p className="text-sm text-gray-400">{errorMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dataAge = getDataAge();

  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <LineChart className="h-5 w-5" />
            RSI/EMA Technical Analysis
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

        {/* Overall Momentum Summary */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge className={`px-4 py-2 text-lg font-bold border-2 ${getMomentumColor(technical.momentum.overall)}`}>
                {technical.momentum.overall === 'bullish' ? (
                  <TrendingUp className="h-4 w-4 mr-2" />
                ) : technical.momentum.overall === 'bearish' ? (
                  <TrendingDown className="h-4 w-4 mr-2" />
                ) : (
                  <Minus className="h-4 w-4 mr-2" />
                )}
                {technical.momentum.overall.toUpperCase()}
              </Badge>
              
              <Badge className={`px-3 py-1 border ${
                technical.momentum.strength === 'strong' ? 'bg-blue-500/20 text-blue-400 border-blue-500' :
                technical.momentum.strength === 'moderate' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500' :
                'bg-gray-500/20 text-gray-400 border-gray-500'
              }`}>
                {technical.momentum.strength} strength
              </Badge>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-400">Confluence Score</div>
              <div className={`text-xl font-bold ${
                technical.momentum.confluenceScore > 70 ? 'text-green-400' : 
                technical.momentum.confluenceScore < 30 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {technical.momentum.confluenceScore}%
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">RSI Contribution</div>
              <Progress 
                value={technical.momentum.rsiContribution} 
                className="h-2 bg-gray-700"
              />
              <div className="text-white mt-1">{technical.momentum.rsiContribution}%</div>
            </div>
            
            <div>
              <div className="text-gray-400 mb-1">EMA Contribution</div>
              <Progress 
                value={technical.momentum.emaContribution} 
                className="h-2 bg-gray-700"
              />
              <div className="text-white mt-1">{technical.momentum.emaContribution}%</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* RSI Analysis */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Gauge className="h-4 w-4" />
            RSI Analysis (Period: {technical.rsi.period})
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400">Current RSI</span>
                <Badge className={`border ${getRSIColor(technical.rsi.signal)}`}>
                  {technical.rsi.signal}
                </Badge>
              </div>
              
              <div className="text-center mb-3">
                <div className={`text-3xl font-bold ${getTrendColor(technical.rsi.trend)}`}>
                  {technical.rsi.current.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {technical.rsi.strength} {technical.rsi.signal}
                </div>
              </div>
              
              <Progress 
                value={technical.rsi.current} 
                className="h-3 bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Oversold (30)</span>
                <span>Overbought (70)</span>
              </div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Trend Direction</span>
                  <div className="flex items-center gap-1">
                    {technical.rsi.trend === 'bullish' ? (
                      <ArrowUp className="h-4 w-4 text-green-400" />
                    ) : technical.rsi.trend === 'bearish' ? (
                      <ArrowDown className="h-4 w-4 text-red-400" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={`text-sm font-semibold ${getTrendColor(technical.rsi.trend)}`}>
                      {technical.rsi.trend}
                    </span>
                  </div>
                </div>
                
                {technical.rsi.divergence.detected && (
                  <div className="bg-yellow-900/20 border border-yellow-500/30 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-400" />
                      <span className="text-yellow-400 text-sm font-semibold">
                        {technical.rsi.divergence.type} Divergence
                      </span>
                    </div>
                    <div className="text-xs text-gray-300 mt-1">
                      {technical.rsi.divergence.strength} strength detected
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-gray-500">
                  Data Points: {technical.rsi.historical.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EMA Analysis */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Signal className="h-4 w-4" />
            EMA Analysis & Crossovers
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 p-3 rounded-lg">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Fast EMA (12)</div>
                <div className={`text-lg font-bold ${getTrendColor(technical.ema.fast.trend)}`}>
                  {technical.ema.fast.value.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  Slope: {technical.ema.fast.slope.toFixed(3)}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 p-3 rounded-lg">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Slow EMA (26)</div>
                <div className={`text-lg font-bold ${getTrendColor(technical.ema.slow.trend)}`}>
                  {technical.ema.slow.value.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  Slope: {technical.ema.slow.slope.toFixed(3)}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 p-3 rounded-lg">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Signal EMA (9)</div>
                <div className={`text-lg font-bold ${getTrendColor(technical.ema.signal.trend)}`}>
                  {technical.ema.signal.value.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  Slope: {technical.ema.signal.slope.toFixed(3)}
                </div>
              </div>
            </div>
          </div>
          
          {/* Crossover Status */}
          {technical.ema.crossover.status !== 'neutral' && (
            <div className={`p-4 rounded-lg border ${getCrossoverColor(technical.ema.crossover.status)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Crosshair className="h-5 w-5" />
                  <span className="font-semibold capitalize">
                    {technical.ema.crossover.status.replace('_', ' ')} Detected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-blue-500/20 text-blue-400">
                    {technical.ema.crossover.strength}
                  </Badge>
                  <Badge className="text-xs bg-gray-700 text-gray-300">
                    {technical.ema.crossover.confidence}% confidence
                  </Badge>
                </div>
              </div>
              <div className="text-sm text-gray-300">
                Fast EMA crossed {technical.ema.crossover.status === 'golden_cross' ? 'above' : 'below'} Slow EMA
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(technical.ema.crossover.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
          
          {/* EMA Trend Analysis */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400 mb-1">Trend Direction</div>
                <Badge className={`capitalize ${getTrendColor(technical.ema.trend.direction)}`}>
                  {technical.ema.trend.direction}
                </Badge>
              </div>
              
              <div>
                <div className="text-gray-400 mb-1">Trend Strength</div>
                <Badge className={`${
                  technical.ema.trend.strength === 'strong' ? 'bg-blue-500/20 text-blue-400' :
                  technical.ema.trend.strength === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {technical.ema.trend.strength}
                </Badge>
              </div>
              
              <div>
                <div className="text-gray-400 mb-1">Duration</div>
                <div className="text-white">{technical.ema.trend.duration}</div>
              </div>
              
              <div>
                <div className="text-gray-400 mb-1">Consistency</div>
                <div className="text-white">{technical.ema.trend.consistency}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Signals */}
        {technical.signals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Zap className="h-4 w-4" />
              Active Technical Signals ({technical.signals.length})
            </div>
            
            <div className="space-y-2">
              {technical.signals.map((signal: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border ${
                  signal.type.includes('oversold') || signal.type.includes('golden') ? 
                  'bg-green-900/20 border-green-500/30' :
                  signal.type.includes('overbought') || signal.type.includes('death') ?
                  'bg-red-900/20 border-red-500/30' : 'bg-blue-900/20 border-blue-500/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      <span className="text-white text-sm font-medium">{signal.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs bg-gray-700 text-gray-300">
                        {signal.confidence}%
                      </Badge>
                      <Badge className={`text-xs ${
                        signal.strength === 'strong' ? 'bg-blue-500/20 text-blue-400' :
                        signal.strength === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {signal.strength}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Alerts */}
        {technical.alerts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Technical Alerts ({technical.alerts.length})
            </div>
            
            <div className="space-y-2">
              {technical.alerts.map((alert: any, idx: number) => (
                <Alert key={idx} className={`border ${
                  alert.priority === 'critical' ? 'border-red-500/30 bg-red-900/10' :
                  alert.priority === 'high' ? 'border-orange-500/30 bg-orange-900/10' :
                  alert.priority === 'medium' ? 'border-yellow-500/30 bg-yellow-900/10' :
                  'border-blue-500/30 bg-blue-900/10'
                }`}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className={`h-4 w-4 ${
                      alert.priority === 'critical' ? 'text-red-400' :
                      alert.priority === 'high' ? 'text-orange-400' :
                      alert.priority === 'medium' ? 'text-yellow-400' :
                      'text-blue-400'
                    }`} />
                    <Badge className={`text-xs ${
                      alert.priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                      alert.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      alert.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {alert.type}
                    </Badge>
                  </div>
                  <AlertDescription className="mt-2 text-gray-300">
                    {alert.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Footer with confidence breakdown */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="text-white font-semibold text-sm">Analysis Confidence</div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              Updated {new Date(technical.lastUpdate).toLocaleTimeString()}
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="text-center">
              <div className="text-gray-400 mb-1">Overall</div>
              <div className="text-white font-semibold">{technical.confidence.overall}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">RSI Quality</div>
              <div className="text-white font-semibold">{technical.confidence.rsiQuality}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">EMA Quality</div>
              <div className="text-white font-semibold">{technical.confidence.emaQuality}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">TF Synergy</div>
              <div className="text-white font-semibold">{technical.confidence.timeframeSynergy}%</div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500 text-center">
            Calculation Time: {technical.calculationTime}ms | Data Points: {technical.confidence.dataPoints}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
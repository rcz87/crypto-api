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
  Target,
  Layers,
  Zap,
  Clock,
  Gauge,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  AlertCircle,
  Minus,
  Crown,
  Crosshair,
  MapPin,
  BarChart3
} from 'lucide-react';

interface FibonacciAnalysis {
  timeframe: string;
  trend: {
    direction: 'bullish' | 'bearish' | 'sideways';
    strength: 'weak' | 'moderate' | 'strong';
    phase: 'impulse' | 'correction' | 'consolidation';
  };
  swingPoints: {
    current: any;
    previous: any;
  };
  retracements: any[];
  extensions: any[];
  currentPrice: {
    value: number;
    nearestLevel: any;
    distanceToLevel: number;
    position: 'above' | 'below' | 'at';
  };
  signals: any[];
  keyZones: {
    goldenZone: {
      start: number;
      end: number;
      strength: 'weak' | 'moderate' | 'strong';
      isActive: boolean;
    };
    institutionalZone: {
      start: number;
      end: number;
      strength: 'weak' | 'moderate' | 'strong';
      isActive: boolean;
    };
  };
  confluence: {
    score: number;
    signals: string[];
    recommendation: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
  confidence: {
    overall: number;
    trendQuality: number;
    swingQuality: number;
    levelRespect: number;
    dataPoints: number;
  };
  lastUpdate: string;
  calculationTime: number;
}

interface FibonacciAnalysisProps {
  className?: string;
}

export function FibonacciAnalysis({ className = '' }: FibonacciAnalysisProps) {
  const [timeframe, setTimeframe] = useState('1H');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const { data: fibonacciData, isLoading, error, dataUpdatedAt } = useQuery<{
    success: boolean;
    data: FibonacciAnalysis;
    timestamp: string;
  }>({
    queryKey: [`/api/sol/fibonacci`, timeframe],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/sol/fibonacci?timeframe=${timeframe}&limit=100`, {
        signal // AbortController signal for cleanup
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch Fibonacci analysis data`);
      }
      return response.json();
    },
    refetchInterval: false, // Manual refresh only
    staleTime: 10000, // Consider stale after 10 seconds
    retry: 3,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false, // Stop refetching when tab is not active
  });

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  const fibonacci = fibonacciData?.data;

  // Helper functions
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

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      case 'moderate':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getLevelColor = (level: any) => {
    if (level.significance === 'critical') {
      return 'bg-red-900/20 border-red-500/50 text-red-400';
    } else if (level.significance === 'major') {
      return 'bg-yellow-900/20 border-yellow-500/50 text-yellow-400';
    } else {
      return 'bg-gray-800 border-gray-600 text-gray-400';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      default:
        return 'bg-red-500/20 text-red-400 border-red-500';
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
            <Layers className="h-5 w-5 animate-pulse" />
            Fibonacci Analysis
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

  if (error || !fibonacci) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load Fibonacci analysis';
    
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Fibonacci Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Fibonacci Analysis Unavailable</p>
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
            <Layers className="h-5 w-5" />
            Fibonacci Analysis
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

        {/* Overall Trend & Confluence Summary */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge className={`px-4 py-2 text-lg font-bold border-2 ${
                fibonacci.trend.direction === 'bullish' ? 'text-green-400 bg-green-500/20 border-green-500' :
                fibonacci.trend.direction === 'bearish' ? 'text-red-400 bg-red-500/20 border-red-500' :
                'text-gray-400 bg-gray-500/20 border-gray-500'
              }`}>
                {fibonacci.trend.direction === 'bullish' ? (
                  <TrendingUp className="h-4 w-4 mr-2" />
                ) : fibonacci.trend.direction === 'bearish' ? (
                  <TrendingDown className="h-4 w-4 mr-2" />
                ) : (
                  <Minus className="h-4 w-4 mr-2" />
                )}
                {fibonacci.trend.direction.toUpperCase()} {fibonacci.trend.phase.toUpperCase()}
              </Badge>
              
              <Badge className={`px-3 py-1 border ${getStrengthColor(fibonacci.trend.strength)}`}>
                {fibonacci.trend.strength} strength
              </Badge>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-400">Confluence Score</div>
              <div className={`text-xl font-bold ${
                fibonacci.confluence.score > 70 ? 'text-green-400' : 
                fibonacci.confluence.score < 30 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {fibonacci.confluence.score}%
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">Risk Level</div>
              <Badge className={`border ${getRiskColor(fibonacci.confluence.riskLevel)}`}>
                {fibonacci.confluence.riskLevel}
              </Badge>
            </div>
            
            <div>
              <div className="text-gray-400 mb-1">Current Price</div>
              <div className="text-white font-semibold">${fibonacci.currentPrice.value.toFixed(2)}</div>
            </div>
            
            <div>
              <div className="text-gray-400 mb-1">Nearest Level</div>
              <div className="text-white">${fibonacci.currentPrice.nearestLevel.price} ({fibonacci.currentPrice.distanceToLevel.toFixed(2)}%)</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Key Fibonacci Zones */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Crown className="h-4 w-4" />
            Key Fibonacci Zones
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Golden Zone */}
            <div className={`p-4 rounded-lg border-2 ${
              fibonacci.keyZones.goldenZone.isActive ? 
              'bg-yellow-900/20 border-yellow-500/50' : 'bg-gray-800 border-gray-600'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-4 w-4 text-yellow-400" />
                <span className="font-semibold text-yellow-400">Golden Zone (61.8%-78.6%)</span>
                {fibonacci.keyZones.goldenZone.isActive && (
                  <Badge className="text-xs bg-yellow-500/20 text-yellow-400">ACTIVE</Badge>
                )}
              </div>
              <div className="text-sm space-y-1">
                <div className="text-gray-300">
                  ${fibonacci.keyZones.goldenZone.start.toFixed(2)} - ${fibonacci.keyZones.goldenZone.end.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  High-probability reversal zone
                </div>
              </div>
            </div>

            {/* Institutional Zone */}
            <div className={`p-4 rounded-lg border-2 ${
              fibonacci.keyZones.institutionalZone.isActive ? 
              'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800 border-gray-600'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-blue-400" />
                <span className="font-semibold text-blue-400">Institutional Zone</span>
                {fibonacci.keyZones.institutionalZone.isActive && (
                  <Badge className="text-xs bg-blue-500/20 text-blue-400">ACTIVE</Badge>
                )}
              </div>
              <div className="text-sm space-y-1">
                <div className="text-gray-300">
                  ${fibonacci.keyZones.institutionalZone.start.toFixed(2)} - ${fibonacci.keyZones.institutionalZone.end.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">
                  Smart money entry zone
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fibonacci Levels */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Layers className="h-4 w-4" />
            Fibonacci Retracement Levels
          </div>
          
          <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
            {fibonacci.retracements
              .filter((level: any) => level.significance !== 'minor')
              .map((level: any, idx: number) => (
              <div key={idx} className={`p-3 rounded border ${getLevelColor(level)}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className={`h-3 w-3 ${
                      level.significance === 'critical' ? 'text-red-400' : 'text-yellow-400'
                    }`} />
                    <span className="font-medium">{level.name}</span>
                    <span className="text-sm">${level.price.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {level.isRespected && (
                      <Badge className="text-xs bg-green-500/20 text-green-400">
                        Respected ({level.touchCount}x)
                      </Badge>
                    )}
                    <Badge className={`text-xs ${
                      level.significance === 'critical' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {level.significance}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fibonacci Extensions */}
        {fibonacci.extensions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Target className="h-4 w-4" />
              Fibonacci Extension Targets
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {fibonacci.extensions.map((extension: any, idx: number) => (
                <div key={idx} className="bg-gray-800 p-3 rounded border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crosshair className="h-3 w-3 text-purple-400" />
                      <span className="font-medium text-purple-400">{extension.name}</span>
                      <span className="text-sm text-white">${extension.price.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs bg-purple-500/20 text-purple-400">
                        {extension.probability}% probability
                      </Badge>
                      <Badge className={`text-xs ${
                        extension.projection === 'conservative' ? 'bg-green-500/20 text-green-400' :
                        extension.projection === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {extension.projection}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Fibonacci Signals */}
        {fibonacci.signals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Zap className="h-4 w-4" />
              Active Fibonacci Signals ({fibonacci.signals.length})
            </div>
            
            <div className="space-y-2">
              {fibonacci.signals.map((signal: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border ${
                  signal.type === 'bounce_support' ? 'bg-green-900/20 border-green-500/30' :
                  signal.type === 'break_resistance' ? 'bg-red-900/20 border-red-500/30' :
                  signal.type === 'extension_target' ? 'bg-purple-900/20 border-purple-500/30' :
                  'bg-blue-900/20 border-blue-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`h-4 w-4 ${
                        signal.type === 'bounce_support' ? 'text-green-400' :
                        signal.type === 'break_resistance' ? 'text-red-400' :
                        signal.type === 'extension_target' ? 'text-purple-400' :
                        'text-blue-400'
                      }`} />
                      <span className="font-medium text-white capitalize">
                        {signal.type.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs border ${getStrengthColor(signal.strength)}`}>
                        {signal.strength}
                      </Badge>
                      <Badge className="text-xs bg-gray-700 text-gray-300">
                        {signal.confidence}%
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-300 mb-2">
                    {signal.description}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Level: {signal.level.name} @ ${signal.level.price.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confluence Recommendation */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            <span className="font-semibold text-white">Fibonacci Confluence Analysis</span>
          </div>
          
          <div className="space-y-3">
            <div className="text-sm text-gray-300">
              {fibonacci.confluence.recommendation}
            </div>
            
            {fibonacci.confluence.signals.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-gray-400">Key Confluence Signals:</div>
                {fibonacci.confluence.signals.slice(0, 3).map((signal: string, idx: number) => (
                  <div key={idx} className="text-xs text-gray-300 pl-4">
                    • {signal}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer with confidence breakdown */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="text-white font-semibold text-sm">Analysis Confidence</div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              Updated {new Date(fibonacci.lastUpdate).toLocaleTimeString()}
            </div>
          </div>
          
          <div className="grid grid-cols-5 gap-3 text-xs">
            <div className="text-center">
              <div className="text-gray-400 mb-1">Overall</div>
              <div className="text-white font-semibold">{fibonacci.confidence.overall}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Trend</div>
              <div className="text-white font-semibold">{fibonacci.confidence.trendQuality}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Swings</div>
              <div className="text-white font-semibold">{fibonacci.confidence.swingQuality}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Respect</div>
              <div className="text-white font-semibold">{fibonacci.confidence.levelRespect}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Data</div>
              <div className="text-white font-semibold">{fibonacci.confidence.dataPoints}</div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500 text-center">
            Calculation Time: {fibonacci.calculationTime}ms | Swing Points: {Object.keys(fibonacci.swingPoints).length}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
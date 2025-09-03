import { useState, useEffect } from 'react';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  BarChart3,
  Zap,
  Target,
  Activity
} from 'lucide-react';

interface DivergenceData {
  timestamp: number;
  price: number;
  cvd: number;
  volume: number;
  divergenceType?: 'bullish' | 'bearish' | null;
  divergenceStrength?: number;
}

interface DivergencePattern {
  type: 'bullish' | 'bearish';
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number;
  startTime: number;
  endTime: number;
  priceChange: number;
  cvdChange: number;
  description: string;
}

interface DivergenceChartProps {
  data: DivergenceData[];
  patterns: DivergencePattern[];
  currentPrice: number;
  currentCVD: number;
  className?: string;
}

export function DivergenceChart({ 
  data, 
  patterns, 
  currentPrice, 
  currentCVD, 
  className = '' 
}: DivergenceChartProps) {
  const [selectedPattern, setSelectedPattern] = useState<DivergencePattern | null>(null);
  const [alertsVisible, setAlertsVisible] = useState(true);

  // Format data for charts
  const chartData = data.map(point => ({
    ...point,
    priceNormalized: ((point.price - Math.min(...data.map(d => d.price))) / 
                     (Math.max(...data.map(d => d.price)) - Math.min(...data.map(d => d.price)))) * 100,
    cvdNormalized: ((point.cvd - Math.min(...data.map(d => d.cvd))) / 
                   (Math.max(...data.map(d => d.cvd)) - Math.min(...data.map(d => d.cvd)))) * 100,
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }));

  // Get active divergence patterns (last 24 hours)
  const activeDivergences = patterns.filter(p => 
    Date.now() - p.endTime < 24 * 60 * 60 * 1000 && p.confidence > 60
  );

  const getPatternColor = (type: string) => {
    return type === 'bullish' ? '#22c55e' : '#ef4444';
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return 'bg-red-500/20 text-red-400 border-red-500';
      case 'moderate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'weak': return 'bg-gray-500/20 text-gray-400 border-gray-500';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    if (Math.abs(num) >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(2);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Divergence Alerts */}
      {alertsVisible && activeDivergences.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Zap className="h-4 w-4 text-yellow-400" />
              Active Divergence Patterns ({activeDivergences.length})
            </div>
            <button
              onClick={() => setAlertsVisible(false)}
              className="text-gray-400 hover:text-gray-300 text-xs"
            >
              Hide
            </button>
          </div>
          
          {activeDivergences.slice(0, 3).map((pattern, idx) => (
            <Alert key={idx} className={`border ${
              pattern.type === 'bullish' ? 'border-green-500/30 bg-green-900/10' : 'border-red-500/30 bg-red-900/10'
            }`}>
              <div className="flex items-center gap-2">
                {pattern.type === 'bullish' ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              </div>
              <AlertDescription className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-semibold ${
                    pattern.type === 'bullish' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1)} Divergence
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge className={getStrengthColor(pattern.strength)}>
                      {pattern.strength}
                    </Badge>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500">
                      {pattern.confidence}% confidence
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-gray-300">
                  {pattern.description}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                  <div>
                    <span className="text-gray-400">Price Change:</span>
                    <span className={`ml-1 ${
                      pattern.priceChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {pattern.priceChange >= 0 ? '+' : ''}{pattern.priceChange.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">CVD Change:</span>
                    <span className={`ml-1 ${
                      pattern.cvdChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {pattern.cvdChange >= 0 ? '+' : ''}{formatNumber(pattern.cvdChange)}
                    </span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Divergence Visualization Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Price vs CVD Divergence Analysis
            <Badge className="bg-blue-500/20 text-blue-400 ml-2">
              {chartData.length} data points
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="time" 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tick={{ fill: '#9CA3AF' }}
                  domain={[0, 100]}
                />
                
                {/* Price Line */}
                <Line
                  type="monotone"
                  dataKey="priceNormalized"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name="Price (Normalized)"
                  connectNulls
                />
                
                {/* CVD Line */}
                <Line
                  type="monotone"
                  dataKey="cvdNormalized"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="CVD (Normalized)"
                  strokeDasharray="5 5"
                  connectNulls
                />
                
                {/* Add divergence markers */}
                {chartData.map((point, idx) => {
                  if (point.divergenceType) {
                    return (
                      <ReferenceLine 
                        key={idx}
                        x={point.time}
                        stroke={point.divergenceType === 'bullish' ? '#22c55e' : '#ef4444'}
                        strokeDasharray="2 2"
                        opacity={0.7}
                      />
                    );
                  }
                  return null;
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Chart Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-500"></div>
              <span className="text-gray-300">Price (Normalized)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-500 border-dashed"></div>
              <span className="text-gray-300">CVD (Normalized)</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-yellow-400" />
              <span className="text-gray-300">Divergence Points</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Status */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Current Price</span>
              <Target className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-lg font-mono text-white">${currentPrice.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">SOL-USDT-SWAP</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Current CVD</span>
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-lg font-mono text-white">{formatNumber(currentCVD)}</div>
            <div className="text-xs text-gray-500 mt-1">Volume Delta</div>
          </CardContent>
        </Card>
      </div>

      {/* Pattern Analysis Summary */}
      {patterns.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm">Pattern Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-400 mb-1">Total Patterns</div>
                <div className="text-white font-semibold">{patterns.length}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 mb-1">Bullish</div>
                <div className="text-green-400 font-semibold">
                  {patterns.filter(p => p.type === 'bullish').length}
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-400 mb-1">Bearish</div>
                <div className="text-red-400 font-semibold">
                  {patterns.filter(p => p.type === 'bearish').length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
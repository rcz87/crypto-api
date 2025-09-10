import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  RefreshCw,
  Grid3X3,
  Layers,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  Signal,
  Shield,
  Eye
} from 'lucide-react';

// Timeframe colors for visual consistency
const TIMEFRAME_COLORS = {
  '1m': 'bg-purple-500/20 text-purple-400 border-purple-500',
  '5m': 'bg-blue-500/20 text-blue-400 border-blue-500',
  '15m': 'bg-cyan-500/20 text-cyan-400 border-cyan-500',
  '1h': 'bg-green-500/20 text-green-400 border-green-500',
  '4h': 'bg-orange-500/20 text-orange-400 border-orange-500'
};

interface MTFAnalysisData {
  symbol: string;
  timestamp: string;
  timeframes: {
    '1m': TimeframeData;
    '5m': TimeframeData;
    '15m': TimeframeData;
    '1h': TimeframeData;
    '4h': TimeframeData;
  };
  confluence: {
    overall_bias: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    agreement_score: number;
    dominant_timeframe: string;
    signal_strength: number;
    alignment: {
      short_term: 'aligned' | 'divergent' | 'mixed';
      medium_term: 'aligned' | 'divergent' | 'mixed';
      long_term: 'aligned' | 'divergent' | 'mixed';
    };
  };
  signals: Array<{
    type: string;
    timeframe: string;
    strength: 'strong' | 'moderate' | 'weak';
    confidence: number;
    description: string;
  }>;
  risk_analysis: {
    timeframe_risk: 'low' | 'medium' | 'high';
    divergence_warning: boolean;
    volatility_cluster: boolean;
    recommendation: string;
  };
}

interface TimeframeData {
  timeframe: string;
  rsi: number;
  ema20: number;
  ema50: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bias: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  trend: 'up' | 'down' | 'sideways';
  momentum: 'strong' | 'moderate' | 'weak';
}

export function EnhancedMTFAnalysis() {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch comprehensive MTF analysis
  const { data: mtfData, isLoading, error, refetch } = useQuery<{
    success: boolean;
    data: MTFAnalysisData;
    timestamp: string;
    responseTime: string;
  }>({
    queryKey: [`/api/sol/mtf-analysis`, lastRefresh],
    queryFn: async () => {
      const response = await fetch('/api/sol/mtf-analysis');
      if (!response.ok) throw new Error('MTF Analysis fetch failed');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Cache for 30 seconds
  });

  const handleRefresh = () => {
    setLastRefresh(new Date());
    refetch();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <Grid3X3 className="h-6 w-6 text-blue-400 animate-pulse" />
              Loading Multi-Timeframe Analysis...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-20 bg-gray-700 rounded-lg"></div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-700 rounded-lg"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !mtfData?.success) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-400" />
            Multi-Timeframe Analysis Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-red-500/10 border-red-500">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-400">
              {error?.message || 'Failed to load MTF analysis data'}
            </AlertDescription>
          </Alert>
          <Button onClick={handleRefresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const analysis = mtfData.data;
  const timeframeKeys = ['1m', '5m', '15m', '1h', '4h'] as const;

  return (
    <div className="space-y-6">
      {/* Header with Overall Analysis */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-3">
              <Grid3X3 className="h-6 w-6 text-blue-400" />
              Enhanced Multi-Timeframe Analysis
              <Badge className="bg-blue-500/20 text-blue-400 ml-2">
                Institutional Grade
              </Badge>
            </CardTitle>
            
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {mtfData.responseTime}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                className="text-gray-300 border-gray-600 hover:bg-gray-800"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(analysis.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-6">
          {/* Overall Confluence Section */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Bias */}
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Overall Market Bias</div>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Badge className={`px-4 py-2 text-lg font-semibold border ${getBiasColor(analysis.confluence.overall_bias)}`}>
                    {getBiasIcon(analysis.confluence.overall_bias)}
                    <span className="ml-2">{analysis.confluence.overall_bias.toUpperCase()}</span>
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-white">
                  {analysis.confluence.confidence}% Confidence
                </div>
              </div>

              {/* Agreement Score */}
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Timeframe Agreement</div>
                <div className="relative w-24 h-24 mx-auto mb-3">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-gray-700"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={`${analysis.confluence.agreement_score * 2.51} 251`}
                      className={analysis.confluence.agreement_score >= 80 ? 'text-green-400' : 
                               analysis.confluence.agreement_score >= 60 ? 'text-yellow-400' : 'text-red-400'}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{analysis.confluence.agreement_score}%</span>
                  </div>
                </div>
                <div className="text-sm text-gray-400">Agreement Score</div>
              </div>

              {/* Dominant Timeframe */}
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Dominant Timeframe</div>
                <Badge className={`text-xl px-6 py-3 mb-3 ${TIMEFRAME_COLORS[analysis.confluence.dominant_timeframe as keyof typeof TIMEFRAME_COLORS] || 'bg-gray-500/20'}`}>
                  {analysis.confluence.dominant_timeframe.toUpperCase()}
                </Badge>
                <div className="text-sm text-gray-400">
                  Signal Strength: {analysis.confluence.signal_strength}/10
                </div>
              </div>
            </div>
          </div>

          {/* Timeframe Alignment */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Timeframe Alignment Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Short Term (1m-15m)</div>
                <Badge className={`${getAlignmentColor(analysis.confluence.alignment.short_term)}`}>
                  {getAlignmentIcon(analysis.confluence.alignment.short_term)}
                  <span className="ml-2">{analysis.confluence.alignment.short_term}</span>
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Medium Term (15m-1h)</div>
                <Badge className={`${getAlignmentColor(analysis.confluence.alignment.medium_term)}`}>
                  {getAlignmentIcon(analysis.confluence.alignment.medium_term)}
                  <span className="ml-2">{analysis.confluence.alignment.medium_term}</span>
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-2">Long Term (1h-4h)</div>
                <Badge className={`${getAlignmentColor(analysis.confluence.alignment.long_term)}`}>
                  {getAlignmentIcon(analysis.confluence.alignment.long_term)}
                  <span className="ml-2">{analysis.confluence.alignment.long_term}</span>
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Timeframes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4">
        {timeframeKeys.map((tf) => (
          <TimeframeCard key={tf} timeframe={tf} data={analysis.timeframes[tf]} />
        ))}
      </div>

      {/* Trading Signals */}
      {analysis.signals.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Signal className="h-5 w-5 text-yellow-400" />
              Active Trading Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.signals.map((signal, index) => (
                <div key={index} className="bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getSignalColor(signal.strength)}>
                        {signal.type.replace(/_/g, ' ')}
                      </Badge>
                      <Badge variant="outline" className="text-gray-400">
                        {signal.timeframe}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400">
                      {signal.confidence}% confidence
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">{signal.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Analysis */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-2">Timeframe Risk</div>
              <Badge className={getRiskColor(analysis.risk_analysis.timeframe_risk)}>
                {analysis.risk_analysis.timeframe_risk.toUpperCase()}
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-2">Divergence Warning</div>
              <Badge className={analysis.risk_analysis.divergence_warning ? 
                'bg-red-500/20 text-red-400 border-red-500' : 
                'bg-green-500/20 text-green-400 border-green-500'
              }>
                {analysis.risk_analysis.divergence_warning ? 'ACTIVE' : 'CLEAR'}
              </Badge>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-2">Volatility Cluster</div>
              <Badge className={analysis.risk_analysis.volatility_cluster ? 
                'bg-orange-500/20 text-orange-400 border-orange-500' : 
                'bg-gray-500/20 text-gray-400 border-gray-500'
              }>
                {analysis.risk_analysis.volatility_cluster ? 'DETECTED' : 'NORMAL'}
              </Badge>
            </div>
          </div>
          <Alert className="bg-blue-500/10 border-blue-500">
            <Eye className="h-4 w-4" />
            <AlertDescription className="text-blue-400">
              {analysis.risk_analysis.recommendation}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

// Individual Timeframe Card Component
function TimeframeCard({ timeframe, data }: { timeframe: string; data: TimeframeData }) {
  return (
    <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <Badge className={TIMEFRAME_COLORS[timeframe as keyof typeof TIMEFRAME_COLORS]}>
              {timeframe.toUpperCase()}
            </Badge>
          </CardTitle>
          <Badge className={`text-xs ${getBiasColor(data.bias)}`}>
            {getBiasIcon(data.bias)}
            <span className="ml-1">{data.bias}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Strength Meter */}
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Strength</span>
            <span className="text-sm font-bold text-white">{data.strength}/10</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                data.strength >= 7 ? 'bg-green-400' :
                data.strength >= 4 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${(data.strength / 10) * 100}%` }}
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-800/50 p-2 rounded">
            <div className="text-gray-400 mb-1">RSI</div>
            <div className={`font-mono ${
              data.rsi > 70 ? 'text-red-400' :
              data.rsi < 30 ? 'text-green-400' : 'text-white'
            }`}>
              {data.rsi.toFixed(1)}
            </div>
          </div>
          <div className="bg-gray-800/50 p-2 rounded">
            <div className="text-gray-400 mb-1">Trend</div>
            <Badge className={getTrendColor(data.trend)}>
              {data.trend}
            </Badge>
          </div>
          <div className="bg-gray-800/50 p-2 rounded">
            <div className="text-gray-400 mb-1">MACD</div>
            <div className={`font-mono text-xs ${
              data.macd.histogram > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {data.macd.histogram > 0 ? '+' : ''}{data.macd.histogram.toFixed(3)}
            </div>
          </div>
          <div className="bg-gray-800/50 p-2 rounded">
            <div className="text-gray-400 mb-1">Momentum</div>
            <Badge className={getMomentumColor(data.momentum)}>
              {data.momentum}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Utility functions
const getBiasIcon = (bias: string) => {
  switch (bias) {
    case 'bullish': return <ArrowUp className="h-4 w-4" />;
    case 'bearish': return <ArrowDown className="h-4 w-4" />;
    default: return <Minus className="h-4 w-4" />;
  }
};

const getBiasColor = (bias: string) => {
  switch (bias) {
    case 'bullish': return 'text-green-400 bg-green-500/20 border-green-500';
    case 'bearish': return 'text-red-400 bg-red-500/20 border-red-500';
    default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
  }
};

const getAlignmentIcon = (alignment: string) => {
  switch (alignment) {
    case 'aligned': return <Target className="h-4 w-4" />;
    case 'divergent': return <AlertTriangle className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
};

const getAlignmentColor = (alignment: string) => {
  switch (alignment) {
    case 'aligned': return 'text-green-400 bg-green-500/20 border-green-500';
    case 'divergent': return 'text-red-400 bg-red-500/20 border-red-500';
    default: return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
  }
};

const getSignalColor = (strength: string) => {
  switch (strength) {
    case 'strong': return 'bg-green-500/20 text-green-400 border-green-500';
    case 'moderate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500';
  }
};

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'low': return 'bg-green-500/20 text-green-400 border-green-500';
    case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    default: return 'bg-red-500/20 text-red-400 border-red-500';
  }
};

const getTrendColor = (trend: string) => {
  switch (trend) {
    case 'up': return 'text-green-400 bg-green-500/20 border-green-500';
    case 'down': return 'text-red-400 bg-red-500/20 border-red-500';
    default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
  }
};

const getMomentumColor = (momentum: string) => {
  switch (momentum) {
    case 'strong': return 'text-green-400 bg-green-500/20 border-green-500';
    case 'moderate': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
    default: return 'text-gray-400 bg-gray-500/20 border-gray-500';
  }
};

export default EnhancedMTFAnalysis;
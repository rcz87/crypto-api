import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Target,
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  Shield,
  Zap,
  BarChart3,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Gauge
} from 'lucide-react';

interface ConfluenceScore {
  overall: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number;
  components: {
    smc: number;
    cvd: number;
    volumeProfile: number;
    funding: number;
    openInterest: number;
  };
  signals: {
    type: string;
    source: string;
    weight: number;
    confidence: number;
  }[];
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
  timeframe: string;
  lastUpdate: string;
}

interface ConfluenceScoringProps {
  timeframe?: string;
  className?: string;
}

export function ConfluenceScoring({ timeframe = '1H', className = '' }: ConfluenceScoringProps) {
  const [showDetails, setShowDetails] = useState(false);

  const { data: confluenceData, isLoading, error } = useQuery<{
    success: boolean;
    data: ConfluenceScore;
    timestamp: string;
  }>({
    queryKey: [`/api/sol/confluence`, timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/sol/confluence?timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch confluence data`);
      }
      return response.json();
    },
    refetchInterval: 20000, // 20 seconds
    staleTime: 15000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const confluence = confluenceData?.data;

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'bullish':
        return 'text-green-400 bg-green-500/20 border-green-500';
      case 'bearish':
        return 'text-red-400 bg-red-500/20 border-red-500';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500';
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong':
        return 'text-blue-400 bg-blue-500/20 border-blue-500';
      case 'moderate':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'text-green-400 bg-green-500/20 border-green-500';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500';
      default:
        return 'text-red-400 bg-red-500/20 border-red-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getComponentIcon = (component: string) => {
    switch (component) {
      case 'smc': return <BarChart3 className="h-4 w-4" />;
      case 'cvd': return <Activity className="h-4 w-4" />;
      case 'volumeProfile': return <Target className="h-4 w-4" />;
      case 'funding': return <TrendingUp className="h-4 w-4" />;
      case 'openInterest': return <Eye className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gauge className="h-5 w-5 animate-pulse" />
            Confluence Scoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-16 bg-gray-700 rounded-lg w-full"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-12 bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-700 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !confluence) {
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Confluence Scoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Confluence Data Unavailable</p>
            <p className="text-sm text-gray-400">Unable to load multi-layer analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gray-900 border-gray-800 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Confluence Scoring
            <Badge className="bg-blue-500/20 text-blue-400 ml-2">
              {timeframe}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {new Date(confluence.lastUpdate).toLocaleTimeString()}
          </div>
        </div>

        {/* Overall Score Display */}
        <div className="bg-gray-800 p-4 rounded-lg mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge className={`px-4 py-2 text-lg font-bold border-2 ${getTrendColor(confluence.trend)}`}>
                {confluence.trend === 'bullish' ? (
                  <TrendingUp className="h-4 w-4 mr-2" />
                ) : confluence.trend === 'bearish' ? (
                  <TrendingDown className="h-4 w-4 mr-2" />
                ) : (
                  <Activity className="h-4 w-4 mr-2" />
                )}
                {confluence.trend.toUpperCase()}
              </Badge>
              
              <Badge className={`px-3 py-1 border ${getStrengthColor(confluence.strength)}`}>
                {confluence.strength} strength
              </Badge>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-400">Overall Score</div>
              <div className={`text-2xl font-bold ${
                confluence.overall > 0 ? 'text-green-400' : 
                confluence.overall < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {confluence.overall > 0 ? '+' : ''}{confluence.overall}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Confidence:</span>
              <span className={`font-semibold ${getConfidenceColor(confluence.confidence)}`}>
                {confluence.confidence}%
              </span>
            </div>
            
            <Badge className={`px-2 py-1 border text-xs ${getRiskColor(confluence.riskLevel)}`}>
              <Shield className="h-3 w-3 mr-1" />
              {confluence.riskLevel} risk
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Component Scores */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-white font-semibold text-sm">Component Analysis</div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-blue-400 hover:text-blue-300 text-xs"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(confluence.components).map(([key, score]) => (
              <div key={key} className="bg-gray-800 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getComponentIcon(key)}
                    <span className="text-sm text-white capitalize">
                      {key === 'smc' ? 'SMC Analysis' :
                       key === 'cvd' ? 'Volume Delta' :
                       key === 'volumeProfile' ? 'Volume Profile' :
                       key === 'funding' ? 'Funding Rate' :
                       'Open Interest'}
                    </span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {score > 0 ? '+' : ''}{score}
                  </span>
                </div>
                <Progress 
                  value={Math.abs(score)} 
                  className={`h-2 ${
                    score > 0 ? 'bg-green-900' : score < 0 ? 'bg-red-900' : 'bg-gray-700'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Top Signals */}
        <div className="space-y-3">
          <div className="text-white font-semibold text-sm">Key Signals</div>
          <div className="space-y-2">
            {confluence.signals.slice(0, 5).map((signal, idx) => (
              <div key={idx} className={`p-3 rounded-lg border ${
                signal.type === 'bullish' ? 'bg-green-900/20 border-green-500/30' :
                signal.type === 'bearish' ? 'bg-red-900/20 border-red-500/30' :
                'bg-gray-800 border-gray-700'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {signal.type === 'bullish' ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : signal.type === 'bearish' ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <Activity className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-white text-sm">{signal.source}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-xs bg-blue-500/20 text-blue-400">
                      {signal.weight}% weight
                    </Badge>
                    <Badge className="text-xs bg-gray-700 text-gray-300">
                      {signal.confidence}%
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <Alert className="bg-blue-900/20 border-blue-500/30">
          <Zap className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-gray-300">
            <div className="font-semibold text-blue-400 mb-2">Trading Recommendation</div>
            {confluence.recommendation}
          </AlertDescription>
        </Alert>

        {/* Details Section */}
        {showDetails && (
          <div className="space-y-3">
            <div className="text-white font-semibold text-sm">Detailed Analysis</div>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 mb-1">Total Signals</div>
                  <div className="text-white">{confluence.signals.length}</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Bullish Signals</div>
                  <div className="text-green-400">
                    {confluence.signals.filter(s => s.type === 'bullish').length}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Bearish Signals</div>
                  <div className="text-red-400">
                    {confluence.signals.filter(s => s.type === 'bearish').length}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Avg Confidence</div>
                  <div className="text-white">
                    {Math.round(confluence.signals.reduce((sum, s) => sum + s.confidence, 0) / confluence.signals.length)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
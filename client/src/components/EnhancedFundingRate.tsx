import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  BarChart3, 
  AlertTriangle, 
  Target, 
  Activity, 
  Brain, 
  Shield,
  Zap,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Info,
  Calendar,
  PieChart
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

// Enhanced Types
interface EnhancedFundingRateData {
  current: {
    instId: string;
    fundingRate: number;
    premium: number;
    nextFundingTime: string;
    fundingTime: string;
    interestRate: number;
    settState: 'settled' | 'processing';
    timestamp: string;
  };
  historical_context: {
    funding_rate_24h_avg: number;
    funding_rate_7d_avg: number;
    funding_rate_max_24h: number;
    funding_rate_min_24h: number;
    premium_24h_avg: number;
    volatility_24h: number;
    historical_percentile: number;
  };
  signal_analysis: {
    overall_sentiment: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
    confidence_score: number;
    conflicts_detected: Array<{
      detected: boolean;
      type: 'funding_premium_divergence' | 'extreme_rate_low_premium' | 'normal_rate_high_premium';
      explanation: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      recommendation: string;
    }>;
    weighted_score: number;
    primary_signal: string;
    supporting_signals: string[];
    contradicting_signals: string[];
  };
  market_structure: {
    current_structure: 'steep_contango' | 'contango' | 'neutral' | 'backwardation' | 'steep_backwardation';
    regime_classification: 'compressed' | 'normal' | 'elevated' | 'extreme';
    historical_percentile: number;
    basis_trading_score: number;
    funding_squeeze_detected: boolean;
    liquidation_pressure: 'low' | 'moderate' | 'elevated' | 'critical';
  };
  alerts: {
    liquidation_cascade_warning: {
      active: boolean;
      cluster_prices: number[];
      open_interest_at_cluster: number[];
      probability: number;
      explanation: string;
      estimated_liquidation_volume: number;
      time_to_cascade: string;
    };
    manipulation_alert: {
      active: boolean;
      absorption_levels: number[];
      institutional_flow_pattern: string;
      unusual_activity_score: number;
      explanation: string;
    };
    funding_squeeze_alert: {
      active: boolean;
      squeeze_type: 'long' | 'short' | 'both';
      intensity: number;
      duration_estimate: string;
      historical_outcomes: string;
    };
  };
  correlation_metrics: {
    funding_oi_correlation: number;
    funding_volume_correlation: number;
    premium_price_correlation: number;
    predictive_strength: number;
  };
  trading_implications: {
    immediate_bias: 'long' | 'short' | 'neutral';
    strategy_suggestions: string[];
    risk_factors: string[];
    optimal_entry_timing: string;
    position_sizing_advice: string;
  };
}

interface HistoricalFundingData {
  data_points: Array<{
    timestamp: string;
    fundingRate: number;
    premium: number;
    openInterest: number;
    price: number;
  }>;
  statistics: {
    average_funding_rate: number;
    max_funding_rate: number;
    min_funding_rate: number;
    volatility: number;
    trend_direction: 'increasing' | 'decreasing' | 'stable';
    anomaly_count: number;
  };
  trends: {
    funding_rate_trend: number[];
    premium_trend: number[];
    correlation_trend: number[];
  };
}

interface FundingCorrelationData {
  funding_oi_correlation: {
    correlation_coefficient: number;
    strength: 'weak' | 'moderate' | 'strong';
    trend: 'positive' | 'negative';
    significance: number;
  };
  funding_volume_correlation: {
    correlation_coefficient: number;
    strength: 'weak' | 'moderate' | 'strong';
    trend: 'positive' | 'negative';
    significance: number;
  };
  premium_price_correlation: {
    correlation_coefficient: number;
    strength: 'weak' | 'moderate' | 'strong';
    trend: 'positive' | 'negative';
    significance: number;
  };
  predictive_metrics: {
    funding_rate_predictive_power: number;
    premium_predictive_power: number;
    combined_predictive_score: number;
  };
}

export function EnhancedFundingRate() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  // Enhanced API Queries
  const { data: enhancedData, isLoading, error } = useQuery<{
    success: boolean;
    data: EnhancedFundingRateData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/funding/enhanced'],
    refetchInterval: 30000, // 30 seconds
  });

  const { data: historicalData } = useQuery<{
    success: boolean;
    data: HistoricalFundingData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/funding/history', selectedTimeframe],
    queryFn: async () => {
      const response = await fetch(`/api/sol/funding/history?timeframe=${selectedTimeframe}`);
      if (!response.ok) throw new Error('Failed to fetch historical data');
      return response.json();
    },
    refetchInterval: 60000, // 1 minute
  });

  const { data: correlationData } = useQuery<{
    success: boolean;
    data: FundingCorrelationData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/funding/correlation'],
    refetchInterval: 120000, // 2 minutes
  });

  // Memoized computations
  const conflictAnalysis = useMemo(() => {
    if (!enhancedData?.data) return null;
    
    const conflicts = enhancedData.data.signal_analysis.conflicts_detected || [];
    const hasConflicts = conflicts.length > 0;
    const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
    
    return {
      hasConflicts,
      conflicts,
      criticalConflicts,
      highestSeverity: conflicts.length > 0 ? conflicts.reduce((max, c) => {
        const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
        return severityOrder[c.severity] > severityOrder[max.severity] ? c : max;
      }, conflicts[0]).severity : 'low' as const
    };
  }, [enhancedData]);

  const sentimentColor = useMemo(() => {
    if (!enhancedData?.data) return 'text-gray-400';
    
    const sentiment = enhancedData.data.signal_analysis.overall_sentiment;
    switch (sentiment) {
      case 'strong_bullish': return 'text-green-400';
      case 'bullish': return 'text-green-300';
      case 'neutral': return 'text-gray-300';
      case 'bearish': return 'text-red-300';
      case 'strong_bearish': return 'text-red-400';
      default: return 'text-gray-400';
    }
  }, [enhancedData]);

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Enhanced Funding Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !enhancedData?.success) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Enhanced Funding Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Data Unavailable</AlertTitle>
            <AlertDescription>
              Failed to load enhanced funding data. Please refresh.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const data = enhancedData.data;
  const funding = data.current;
  const fundingRateValue = funding.fundingRate;
  const premiumValue = funding.premium;
  
  // Format next funding time
  const nextFundingDate = new Date(funding.nextFundingTime);
  const timeUntilNext = nextFundingDate.getTime() - Date.now();
  const hoursUntil = Math.floor(timeUntilNext / (1000 * 60 * 60));
  const minutesUntil = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));

  const isFundingPositive = fundingRateValue > 0;
  const isPremiumPositive = premiumValue > 0;

  // Historical chart data
  const chartData = historicalData?.data.data_points.slice(-24).map((point, index) => ({
    time: index,
    funding: point.fundingRate * 10000, // Convert to basis points
    premium: point.premium * 10000,
  })) || [];

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Enhanced Funding Intelligence
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${sentimentColor} border-current`}>
              {data.signal_analysis.overall_sentiment.toUpperCase()}
            </Badge>
            <Badge variant={conflictAnalysis?.hasConflicts ? "destructive" : "default"}>
              {data.signal_analysis.confidence_score.toFixed(0)}% Confidence
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gray-700 text-white">Overview</TabsTrigger>
            <TabsTrigger value="conflicts" className="data-[state=active]:bg-gray-700 text-white">Conflicts</TabsTrigger>
            <TabsTrigger value="historical" className="data-[state=active]:bg-gray-700 text-white">Historical</TabsTrigger>
            <TabsTrigger value="intelligence" className="data-[state=active]:bg-gray-700 text-white">Intelligence</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Current Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Current Rate</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${isFundingPositive ? 'text-red-400' : 'text-green-400'}`}>
                    {isFundingPositive ? '+' : ''}{(fundingRateValue * 100).toFixed(6)}%
                  </span>
                  {isFundingPositive ? 
                    <TrendingUp className="w-4 h-4 text-red-400" /> : 
                    <TrendingDown className="w-4 h-4 text-green-400" />
                  }
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Per 8h • {data.historical_context.historical_percentile.toFixed(0)}th percentile
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-400">Premium</span>
                </div>
                <div className={`text-2xl font-bold ${isPremiumPositive ? 'text-red-400' : 'text-green-400'}`}>
                  {isPremiumPositive ? '+' : ''}{(premiumValue * 100).toFixed(4)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Mark vs Index
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-gray-400">Next Funding</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {hoursUntil > 0 ? `${hoursUntil}h ` : ''}{minutesUntil}m
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {nextFundingDate.toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Market Structure & Alerts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <PieChart className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Market Structure</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Structure:</span>
                    <Badge variant="outline" className={`text-xs ${
                      data.market_structure.current_structure.includes('steep') ? 'border-orange-400 text-orange-400' :
                      data.market_structure.current_structure.includes('contango') ? 'border-red-400 text-red-400' :
                      data.market_structure.current_structure === 'neutral' ? 'border-gray-400 text-gray-400' : 'border-green-400 text-green-400'
                    }`}>
                      {data.market_structure.current_structure.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Regime:</span>
                    <Badge variant="outline" className={`text-xs ${
                      data.market_structure.regime_classification === 'extreme' ? 'border-red-400 text-red-400' :
                      data.market_structure.regime_classification === 'elevated' ? 'border-orange-400 text-orange-400' :
                      data.market_structure.regime_classification === 'normal' ? 'border-yellow-400 text-yellow-400' : 'border-green-400 text-green-400'
                    }`}>
                      {data.market_structure.regime_classification.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 rounded-lg p-4 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-orange-400">Risk Assessment</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Liquidation Risk:</span>
                    <Badge variant={
                      data.market_structure.liquidation_pressure === 'critical' ? 'destructive' :
                      data.market_structure.liquidation_pressure === 'elevated' ? 'secondary' : 'default'
                    }>
                      {data.market_structure.liquidation_pressure.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Basis Score:</span>
                    <span className="text-white font-mono">
                      {data.market_structure.basis_trading_score.toFixed(0)}/100
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Conflicts Tab */}
          <TabsContent value="conflicts" className="space-y-4">
            {conflictAnalysis?.hasConflicts ? (
              <div className="space-y-4">
                <Alert variant={conflictAnalysis.criticalConflicts.length > 0 ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center gap-2">
                    Signal Conflicts Detected
                    <Badge variant="outline">
                      {conflictAnalysis.conflicts.length} conflict{conflictAnalysis.conflicts.length !== 1 ? 's' : ''}
                    </Badge>
                  </AlertTitle>
                  <AlertDescription>
                    Conflicting signals detected in funding rate analysis. Review below for details.
                  </AlertDescription>
                </Alert>

                {conflictAnalysis.conflicts.map((conflict, index) => (
                  <Card key={index} className={`border ${
                    conflict.severity === 'critical' ? 'border-red-500/50 bg-red-900/10' :
                    conflict.severity === 'high' ? 'border-orange-500/50 bg-orange-900/10' :
                    conflict.severity === 'medium' ? 'border-yellow-500/50 bg-yellow-900/10' : 'border-blue-500/50 bg-blue-900/10'
                  }`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Zap className={`w-4 h-4 ${
                            conflict.severity === 'critical' ? 'text-red-400' :
                            conflict.severity === 'high' ? 'text-orange-400' :
                            conflict.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'
                          }`} />
                          <span className="font-medium text-white">
                            {conflict.type.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                        <Badge variant={
                          conflict.severity === 'critical' ? 'destructive' :
                          conflict.severity === 'high' ? 'secondary' : 'default'
                        }>
                          {conflict.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-gray-300">{conflict.explanation}</p>
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="w-3 h-3 text-green-400" />
                            <span className="text-xs font-medium text-green-400">Recommendation</span>
                          </div>
                          <p className="text-xs text-gray-300">{conflict.recommendation}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No Conflicts Detected</AlertTitle>
                <AlertDescription>
                  Funding rate and premium signals are aligned. Current confidence: {data.signal_analysis.confidence_score.toFixed(0)}%
                </AlertDescription>
              </Alert>
            )}

            {/* Signal Breakdown */}
            <Card className="bg-gray-800/50">
              <CardHeader>
                <CardTitle className="text-sm text-gray-400">Signal Analysis Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Weighted Score</span>
                    <span className="text-white">{data.signal_analysis.weighted_score.toFixed(3)}</span>
                  </div>
                  <Progress 
                    value={Math.abs(data.signal_analysis.weighted_score) * 50 + 50} 
                    className="h-2"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-400">Primary Signal</span>
                    <span className="text-white font-mono">{data.signal_analysis.primary_signal}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-green-400 mb-1 block">Supporting Signals</span>
                    <div className="space-y-1">
                      {data.signal_analysis.supporting_signals.map((signal, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-green-400 text-green-400">
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-red-400 mb-1 block">Contradicting Signals</span>
                    <div className="space-y-1">
                      {data.signal_analysis.contradicting_signals.map((signal, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-red-400 text-red-400">
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Historical Tab */}
          <TabsContent value="historical" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400">Historical Context & Trends</h3>
              <div className="flex gap-2">
                {['24h', '7d', '30d'].map((timeframe) => (
                  <Button
                    key={timeframe}
                    size="sm"
                    variant={selectedTimeframe === timeframe ? "default" : "outline"}
                    onClick={() => setSelectedTimeframe(timeframe as typeof selectedTimeframe)}
                    className="text-xs"
                  >
                    {timeframe.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            {/* Historical Statistics */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">24h Average</div>
                <div className={`text-lg font-bold ${data.historical_context.funding_rate_24h_avg > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {(data.historical_context.funding_rate_24h_avg * 100).toFixed(4)}%
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">7d Average</div>
                <div className={`text-lg font-bold ${data.historical_context.funding_rate_7d_avg > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {(data.historical_context.funding_rate_7d_avg * 100).toFixed(4)}%
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">24h Volatility</div>
                <div className="text-lg font-bold text-orange-400">
                  {(data.historical_context.volatility_24h * 10000).toFixed(1)} bps
                </div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Percentile Rank</div>
                <div className="text-lg font-bold text-blue-400">
                  {data.historical_context.historical_percentile.toFixed(0)}th
                </div>
              </div>
            </div>

            {/* Historical Chart */}
            {chartData.length > 0 && (
              <Card className="bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-sm text-gray-400">Funding Rate & Premium Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis 
                          dataKey="time" 
                          hide
                        />
                        <YAxis 
                          domain={['dataMin - 1', 'dataMax + 1']}
                          tick={{fontSize: 12, fill: '#9CA3AF'}}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '6px',
                            color: '#F9FAFB'
                          }}
                          formatter={(value: number, name: string) => [
                            `${value.toFixed(2)} bps`,
                            name === 'funding' ? 'Funding Rate' : 'Premium'
                          ]}
                        />
                        <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
                        <Line 
                          type="monotone" 
                          dataKey="funding" 
                          stroke="#EF4444" 
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="premium" 
                          stroke="#8B5CF6" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-400 rounded"></div>
                      <span className="text-xs text-gray-400">Funding Rate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-400 rounded"></div>
                      <span className="text-xs text-gray-400">Premium</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Trend Analysis */}
            {historicalData?.data && (
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-gray-800/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-gray-400">Trend Direction</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        historicalData.data.statistics.trend_direction === 'increasing' ? 'default' :
                        historicalData.data.statistics.trend_direction === 'decreasing' ? 'destructive' : 'secondary'
                      }>
                        {historicalData.data.statistics.trend_direction.toUpperCase()}
                      </Badge>
                      {historicalData.data.statistics.trend_direction === 'increasing' ? <ArrowUp className="w-4 h-4 text-green-400" /> :
                       historicalData.data.statistics.trend_direction === 'decreasing' ? <ArrowDown className="w-4 h-4 text-red-400" /> :
                       <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-gray-400">Anomalies</span>
                    </div>
                    <div className="text-xl font-bold text-orange-400">
                      {historicalData.data.statistics.anomaly_count}
                    </div>
                    <div className="text-xs text-gray-500">
                      in {selectedTimeframe}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-gray-400">Extremes</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Max:</span>
                        <span className="text-red-400">{(historicalData.data.statistics.max_funding_rate * 100).toFixed(4)}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Min:</span>
                        <span className="text-green-400">{(historicalData.data.statistics.min_funding_rate * 100).toFixed(4)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Intelligence Tab */}
          <TabsContent value="intelligence" className="space-y-4">
            {/* Active Alerts */}
            <div className="space-y-3">
              {data.alerts.liquidation_cascade_warning.active && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center gap-2">
                    Liquidation Cascade Warning
                    <Badge variant="destructive">{data.alerts.liquidation_cascade_warning.probability.toFixed(0)}% Risk</Badge>
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{data.alerts.liquidation_cascade_warning.explanation}</p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-red-300">Estimated Volume:</span>
                        <div className="font-mono text-white">
                          ${(data.alerts.liquidation_cascade_warning.estimated_liquidation_volume / 1000000).toFixed(1)}M
                        </div>
                      </div>
                      <div>
                        <span className="text-red-300">Time Frame:</span>
                        <div className="font-mono text-white">
                          {data.alerts.liquidation_cascade_warning.time_to_cascade}
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {data.alerts.funding_squeeze_alert.active && (
                <Alert variant="default" className="border-orange-500/50">
                  <Zap className="h-4 w-4 text-orange-400" />
                  <AlertTitle className="flex items-center gap-2 text-orange-400">
                    Funding Squeeze Alert
                    <Badge variant="outline" className="border-orange-400 text-orange-400">
                      {data.alerts.funding_squeeze_alert.squeeze_type.toUpperCase()}
                    </Badge>
                  </AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="text-gray-300">
                        Squeeze intensity: <span className="text-orange-400 font-bold">{data.alerts.funding_squeeze_alert.intensity.toFixed(0)}%</span>
                      </p>
                      <p className="text-gray-300">Duration estimate: {data.alerts.funding_squeeze_alert.duration_estimate}</p>
                      <p className="text-gray-400 text-xs">{data.alerts.funding_squeeze_alert.historical_outcomes}</p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {data.alerts.manipulation_alert.active && (
                <Alert variant="default" className="border-purple-500/50">
                  <Shield className="h-4 w-4 text-purple-400" />
                  <AlertTitle className="text-purple-400">Market Manipulation Alert</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="text-gray-300">{data.alerts.manipulation_alert.explanation}</p>
                      <p className="text-gray-300">
                        Activity Score: <span className="text-purple-400 font-bold">{data.alerts.manipulation_alert.unusual_activity_score.toFixed(0)}/100</span>
                      </p>
                      <p className="text-gray-400 text-xs">
                        Pattern: {data.alerts.manipulation_alert.institutional_flow_pattern}
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Trading Implications */}
            <Card className="bg-gradient-to-br from-green-900/20 to-blue-900/20 border-green-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <Target className="w-5 h-5" />
                  Actionable Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Immediate Bias</div>
                    <Badge 
                      variant={
                        data.trading_implications.immediate_bias === 'long' ? 'default' :
                        data.trading_implications.immediate_bias === 'short' ? 'destructive' : 'secondary'
                      }
                      className="text-lg px-3 py-1"
                    >
                      {data.trading_implications.immediate_bias.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Entry Timing</div>
                    <div className="text-sm font-medium text-white">
                      {data.trading_implications.optimal_entry_timing}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-2">Strategy Suggestions</div>
                  <div className="space-y-2">
                    {data.trading_implications.strategy_suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-green-300">
                        <ChevronRight className="w-4 h-4 mt-0.5 text-green-400" />
                        <span>{suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-2">Risk Factors</div>
                  <div className="space-y-2">
                    {data.trading_implications.risk_factors.map((risk, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-red-300">
                        <AlertTriangle className="w-4 h-4 mt-0.5 text-red-400" />
                        <span>{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Position Sizing Advice</div>
                  <p className="text-sm text-gray-300">{data.trading_implications.position_sizing_advice}</p>
                </div>
              </CardContent>
            </Card>

            {/* Correlation Analysis */}
            {correlationData?.data && (
              <Card className="bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-sm text-gray-400">Correlation Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">Funding ↔ OI</div>
                      <div className={`text-lg font-bold ${
                        correlationData.data.funding_oi_correlation.strength === 'strong' ? 'text-green-400' :
                        correlationData.data.funding_oi_correlation.strength === 'moderate' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {correlationData.data.funding_oi_correlation.correlation_coefficient.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {correlationData.data.funding_oi_correlation.strength}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">Funding ↔ Volume</div>
                      <div className={`text-lg font-bold ${
                        correlationData.data.funding_volume_correlation.strength === 'strong' ? 'text-green-400' :
                        correlationData.data.funding_volume_correlation.strength === 'moderate' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {correlationData.data.funding_volume_correlation.correlation_coefficient.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {correlationData.data.funding_volume_correlation.strength}
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">Premium ↔ Price</div>
                      <div className={`text-lg font-bold ${
                        correlationData.data.premium_price_correlation.strength === 'strong' ? 'text-green-400' :
                        correlationData.data.premium_price_correlation.strength === 'moderate' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {correlationData.data.premium_price_correlation.correlation_coefficient.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {correlationData.data.premium_price_correlation.strength}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">Combined Predictive Score</div>
                      <div className="text-2xl font-bold text-blue-400">
                        {correlationData.data.predictive_metrics.combined_predictive_score.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        Model confidence in predictions
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
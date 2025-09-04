import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Zap,
  Clock,
  Gauge,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  AlertCircle,
  Users,
  Eye,
  Target,
  Crosshair,
  BarChart3,
  DollarSign,
  Waves,
  Timer,
  FileText,
  Layers3,
  Volume2,
  Radar
} from 'lucide-react';

interface OrderFlowMetrics {
  timeframe: string;
  currentImbalance: {
    timestamp: string;
    bidSize: number;
    askSize: number;
    imbalanceRatio: number;
    strength: 'weak' | 'moderate' | 'strong';
    significance: 'minor' | 'major' | 'critical';
    prediction: 'bullish' | 'bearish' | 'neutral';
  };
  recentTrades: {
    total: number;
    buyVolume: number;
    sellVolume: number;
    netVolume: number;
    avgTradeSize: number;
    largeTradeCount: number;
    aggressiveBuyRatio: number;
    aggressiveSellRatio: number;
  };
  whaleActivity: {
    detected: boolean;
    direction: 'accumulation' | 'distribution' | 'neutral';
    strength: 'weak' | 'moderate' | 'strong';
    volume: number;
    trades: any[];
    confidence: number;
  };
  flowAnalysis: {
    makerBuyVolume: number;
    makerSellVolume: number;
    takerBuyVolume: number;
    takerSellVolume: number;
    makerTakerRatio: number;
    dominantFlow: 'maker_dominated' | 'taker_dominated' | 'balanced';
    flowStrength: 'weak' | 'moderate' | 'strong';
  };
  signals: any[];
  tapeReading: {
    momentum: 'bullish' | 'bearish' | 'neutral';
    velocity: 'slow' | 'moderate' | 'fast';
    consistency: 'inconsistent' | 'consistent' | 'very_consistent';
    largeOrderActivity: 'increasing' | 'decreasing' | 'stable';
    marketSentiment: 'bullish' | 'bearish' | 'neutral';
    predictionConfidence: number;
  };
  confidence: {
    overall: number;
    dataQuality: number;
    signalReliability: number;
    volumeConsistency: number;
    timeConsistency: number;
  };
  lastUpdate: string;
  calculationTime: number;
  tradesAnalyzed: number;
}

interface OrderFlowAnalysisProps {
  className?: string;
}

export function OrderFlowAnalysis({ className = '' }: OrderFlowAnalysisProps) {
  const [timeframe, setTimeframe] = useState('1H');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const { data: orderFlowData, isLoading, error, dataUpdatedAt } = useQuery<{
    success: boolean;
    data: OrderFlowMetrics;
    timestamp: string;
  }>({
    queryKey: [`/api/sol/order-flow`, timeframe],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/sol/order-flow?timeframe=${timeframe}&tradeLimit=200`, {
        signal // AbortController signal for cleanup
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch Order Flow analysis data`);
      }
      return response.json();
    },
    refetchInterval: false, // Manual refresh only
    staleTime: 6000, // Consider stale after 6 seconds
    retry: 3,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false, // Stop refetching when tab is not active
  });

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  const orderFlow = orderFlowData?.data;

  // Helper functions
  const getImbalanceColor = (prediction: string) => {
    switch (prediction) {
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
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      case 'moderate':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getVelocityColor = (velocity: string) => {
    switch (velocity) {
      case 'fast':
        return 'text-red-400';
      case 'moderate':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getWhaleDirectionColor = (direction: string) => {
    switch (direction) {
      case 'accumulation':
        return 'text-green-400 bg-green-500/20 border-green-500';
      case 'distribution':
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
            <Radar className="h-5 w-5 animate-pulse" />
            Order Flow Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-700 rounded-lg w-full"></div>
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

  if (error || !orderFlow) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load Order Flow analysis';
    
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Radar className="h-5 w-5" />
            Order Flow Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-400 text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Order Flow Analysis Unavailable</p>
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
            <Radar className="h-5 w-5" />
            Order Flow Analysis
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

        {/* Bid/Ask Imbalance & Tape Reading Summary */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge className={`px-4 py-2 text-lg font-bold border-2 ${getImbalanceColor(orderFlow.currentImbalance.prediction)}`}>
                {orderFlow.currentImbalance.prediction === 'bullish' ? (
                  <TrendingUp className="h-4 w-4 mr-2" />
                ) : orderFlow.currentImbalance.prediction === 'bearish' ? (
                  <TrendingDown className="h-4 w-4 mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                {orderFlow.currentImbalance.prediction.toUpperCase()} IMBALANCE
              </Badge>
              
              <Badge className={`px-3 py-1 border ${getStrengthColor(orderFlow.currentImbalance.strength)}`}>
                {orderFlow.currentImbalance.strength} strength
              </Badge>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-400">Prediction Confidence</div>
              <div className={`text-xl font-bold ${
                orderFlow.tapeReading.predictionConfidence > 70 ? 'text-green-400' : 
                orderFlow.tapeReading.predictionConfidence < 30 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {orderFlow.tapeReading.predictionConfidence}%
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-400 mb-1">Imbalance Ratio</div>
              <div className="text-white font-semibold">{(orderFlow.currentImbalance.imbalanceRatio * 100).toFixed(1)}%</div>
            </div>
            
            <div>
              <div className="text-gray-400 mb-1">Market Velocity</div>
              <div className={`font-semibold ${getVelocityColor(orderFlow.tapeReading.velocity)}`}>
                {orderFlow.tapeReading.velocity}
              </div>
            </div>
            
            <div>
              <div className="text-gray-400 mb-1">Sentiment</div>
              <div className={`font-semibold ${
                orderFlow.tapeReading.marketSentiment === 'bullish' ? 'text-green-400' :
                orderFlow.tapeReading.marketSentiment === 'bearish' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {orderFlow.tapeReading.marketSentiment}
              </div>
            </div>
            
            <div>
              <div className="text-gray-400 mb-1">Trades Analyzed</div>
              <div className="text-white font-semibold">{orderFlow.tradesAnalyzed}</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Whale Activity Detection */}
        {orderFlow.whaleActivity.detected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Users className="h-4 w-4" />
              Whale Activity Detected
            </div>
            
            <div className={`p-4 rounded-lg border-2 ${getWhaleDirectionColor(orderFlow.whaleActivity.direction)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  <span className="font-semibold text-lg capitalize">
                    {orderFlow.whaleActivity.direction}
                  </span>
                  <Badge className={`border ${getStrengthColor(orderFlow.whaleActivity.strength)}`}>
                    {orderFlow.whaleActivity.strength}
                  </Badge>
                </div>
                
                <div className="text-right">
                  <div className="text-sm opacity-80">Confidence</div>
                  <div className="text-lg font-bold">{orderFlow.whaleActivity.confidence}%</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="opacity-80 mb-1">Total Volume</div>
                  <div className="font-semibold">{orderFlow.whaleActivity.volume.toFixed(2)} SOL</div>
                </div>
                <div>
                  <div className="opacity-80 mb-1">Whale Trades</div>
                  <div className="font-semibold">{orderFlow.whaleActivity.trades.length} transactions</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Flow Metrics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Volume2 className="h-4 w-4" />
            Order Flow Metrics
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Trades Analysis */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-blue-400" />
                <span className="font-semibold text-white">Recent Trades ({orderFlow.recentTrades.total})</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Buy Volume:</span>
                  <span className="text-green-400 font-semibold">{orderFlow.recentTrades.buyVolume.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Sell Volume:</span>
                  <span className="text-red-400 font-semibold">{orderFlow.recentTrades.sellVolume.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Net Volume:</span>
                  <span className={`font-semibold ${orderFlow.recentTrades.netVolume > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {orderFlow.recentTrades.netVolume > 0 ? '+' : ''}{orderFlow.recentTrades.netVolume.toFixed(2)} SOL
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Large Trades:</span>
                  <span className="text-white font-semibold">{orderFlow.recentTrades.largeTradeCount}</span>
                </div>
              </div>
            </div>

            {/* Market Maker vs Taker Flow */}
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Layers3 className="h-4 w-4 text-purple-400" />
                <span className="font-semibold text-white">Maker vs Taker Flow</span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Dominant Flow:</span>
                  <Badge className={`text-xs ${
                    orderFlow.flowAnalysis.dominantFlow === 'taker_dominated' ? 'bg-orange-500/20 text-orange-400' :
                    orderFlow.flowAnalysis.dominantFlow === 'maker_dominated' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {orderFlow.flowAnalysis.dominantFlow.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Taker Ratio:</span>
                  <span className="text-white font-semibold">{(orderFlow.flowAnalysis.makerTakerRatio * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Flow Strength:</span>
                  <Badge className={`text-xs border ${getStrengthColor(orderFlow.flowAnalysis.flowStrength)}`}>
                    {orderFlow.flowAnalysis.flowStrength}
                  </Badge>
                </div>
                
                <div className="mt-2">
                  <div className="text-xs text-gray-400 mb-1">Taker Dominance</div>
                  <Progress 
                    value={orderFlow.flowAnalysis.makerTakerRatio * 100} 
                    className="h-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tape Reading Analysis */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <FileText className="h-4 w-4" />
            Professional Tape Reading
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-gray-400 mb-1">Momentum</div>
                <Badge className={`w-full justify-center ${
                  orderFlow.tapeReading.momentum === 'bullish' ? 'bg-green-500/20 text-green-400' :
                  orderFlow.tapeReading.momentum === 'bearish' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {orderFlow.tapeReading.momentum}
                </Badge>
              </div>
              
              <div className="text-center">
                <div className="text-gray-400 mb-1">Consistency</div>
                <Badge className={`w-full justify-center ${
                  orderFlow.tapeReading.consistency === 'very_consistent' ? 'bg-green-500/20 text-green-400' :
                  orderFlow.tapeReading.consistency === 'consistent' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {orderFlow.tapeReading.consistency.replace('_', ' ')}
                </Badge>
              </div>
              
              <div className="text-center">
                <div className="text-gray-400 mb-1">Large Orders</div>
                <Badge className={`w-full justify-center ${
                  orderFlow.tapeReading.largeOrderActivity === 'increasing' ? 'bg-green-500/20 text-green-400' :
                  orderFlow.tapeReading.largeOrderActivity === 'decreasing' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {orderFlow.tapeReading.largeOrderActivity}
                </Badge>
              </div>
              
              <div className="text-center">
                <div className="text-gray-400 mb-1">Velocity</div>
                <Badge className={`w-full justify-center ${
                  orderFlow.tapeReading.velocity === 'fast' ? 'bg-red-500/20 text-red-400' :
                  orderFlow.tapeReading.velocity === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {orderFlow.tapeReading.velocity}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Active Order Flow Signals */}
        {orderFlow.signals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Zap className="h-4 w-4" />
              Active Order Flow Signals ({orderFlow.signals.length})
            </div>
            
            <div className="space-y-2">
              {orderFlow.signals.map((signal: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border ${
                  signal.type.includes('buy') || signal.type.includes('bullish') || signal.type.includes('accumulation') ? 
                  'bg-green-900/20 border-green-500/30' :
                  signal.type.includes('sell') || signal.type.includes('bearish') || signal.type.includes('distribution') ? 
                  'bg-red-900/20 border-red-500/30' :
                  'bg-blue-900/20 border-blue-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`h-4 w-4 ${
                        signal.type.includes('buy') || signal.type.includes('bullish') || signal.type.includes('accumulation') ? 'text-green-400' :
                        signal.type.includes('sell') || signal.type.includes('bearish') || signal.type.includes('distribution') ? 'text-red-400' :
                        'text-blue-400'
                      }`} />
                      <span className="font-medium text-white capitalize">
                        {signal.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs border ${getStrengthColor(signal.strength)}`}>
                        {signal.strength}
                      </Badge>
                      <Badge className="text-xs bg-gray-700 text-gray-300">
                        {signal.confidence}%
                      </Badge>
                      <Badge className={`text-xs ${
                        signal.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                        signal.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {signal.impact} impact
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-300 mb-2">
                    {signal.description}
                  </div>
                  
                  <div className="text-xs text-gray-500 flex items-center justify-between">
                    <span>Price: ${signal.price.toFixed(2)}</span>
                    <span>Volume: {signal.volume.toFixed(2)} SOL</span>
                  </div>
                </div>
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
              Updated {new Date(orderFlow.lastUpdate).toLocaleTimeString()}
            </div>
          </div>
          
          <div className="grid grid-cols-5 gap-3 text-xs">
            <div className="text-center">
              <div className="text-gray-400 mb-1">Overall</div>
              <div className="text-white font-semibold">{orderFlow.confidence.overall}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Data</div>
              <div className="text-white font-semibold">{orderFlow.confidence.dataQuality}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Signals</div>
              <div className="text-white font-semibold">{orderFlow.confidence.signalReliability}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Volume</div>
              <div className="text-white font-semibold">{orderFlow.confidence.volumeConsistency}%</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 mb-1">Time</div>
              <div className="text-white font-semibold">{orderFlow.confidence.timeConsistency}%</div>
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500 text-center">
            Calculation Time: {orderFlow.calculationTime}ms | Aggressive Ratio: {(orderFlow.recentTrades.aggressiveBuyRatio * 100).toFixed(1)}%B / {(orderFlow.recentTrades.aggressiveSellRatio * 100).toFixed(1)}%S
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
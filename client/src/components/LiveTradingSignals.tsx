import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle,
  Target,
  Shield,
  DollarSign,
  Zap,
  Clock,
  RefreshCw,
  Bell,
  Signal,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  ExternalLink,
  Play,
  Square,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

// Utility functions for signal visualization
const getSignalIcon = (signal: string) => {
  switch (signal) {
    case 'BUY': return <ArrowUp className="h-5 w-5 text-green-400" />;
    case 'SELL': return <ArrowDown className="h-5 w-5 text-red-400" />;
    default: return <Minus className="h-5 w-5 text-gray-400" />;
  }
};

const getSignalColor = (signal: string) => {
  switch (signal) {
    case 'BUY': return 'bg-green-500/20 text-green-400 border-green-500';
    case 'SELL': return 'bg-red-500/20 text-red-400 border-red-500';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500';
  }
};

const getStrengthColor = (strength: string) => {
  switch (strength) {
    case 'VERY_STRONG': return 'bg-purple-500/20 text-purple-400 border-purple-500';
    case 'STRONG': return 'bg-blue-500/20 text-blue-400 border-blue-500';
    case 'MODERATE': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    default: return 'bg-orange-500/20 text-orange-400 border-orange-500';
  }
};

const getUrgencyIcon = (urgency: string) => {
  switch (urgency) {
    case 'CRITICAL': return <AlertTriangle className="h-4 w-4 text-red-400" />;
    case 'HIGH': return <AlertCircle className="h-4 w-4 text-orange-400" />;
    case 'MEDIUM': return <Bell className="h-4 w-4 text-yellow-400" />;
    default: return <CheckCircle className="h-4 w-4 text-green-400" />;
  }
};

export interface TradingSignal {
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  timeframe: string;
  timestamp: string;
  reasons: string[];
  explanations?: string[]; // Enhanced: Explanatory reasoning for unclear signals
  technicalAnalysis: {
    rsi: number;
    emaSignal: 'bullish' | 'bearish' | 'neutral';
    macdSignal: 'bullish' | 'bearish' | 'neutral';
    volumeConfirmation: boolean;
  };
  smartMoney: {
    bosSignal: 'bullish' | 'bearish' | 'neutral';
    liquidityGrab: boolean;
    institutionalFlow: 'buying' | 'selling' | 'neutral';
  };
  priceAction: {
    keyLevel: number;
    levelType: 'support' | 'resistance' | 'fib_level';
    distanceToLevel: number;
  };
  alerts: {
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
  };
}

export interface LiveTradingSignalsProps {
  className?: string;
}

export function LiveTradingSignals({ className = '' }: LiveTradingSignalsProps) {
  const [timeframe, setTimeframe] = useState('15m');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [alertsEnabled, setAlertsEnabled] = useState(false);

  const { data: signalsData, isLoading, error, refetch } = useQuery({
    queryKey: [`/api/sol/trading-signals`, timeframe, lastRefresh],
    queryFn: async () => {
      const response = await fetch(`/api/sol/trading-signals?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch trading signals');
      return response.json();
    },
    refetchInterval: autoRefresh ? 15000 : false, // 15 second refresh
    staleTime: 10000,
  });

  const { data: historyData } = useQuery({
    queryKey: [`/api/sol/signal-history`],
    queryFn: async () => {
      const response = await fetch(`/api/sol/signal-history`);
      if (!response.ok) throw new Error('Failed to fetch signal history');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const signals = signalsData?.data;
  const primarySignal = signals?.primary;
  const secondarySignal = signals?.secondary;
  const marketConditions = signals?.marketConditions;
  const multiTimeframeAlignment = signals?.multiTimeframeAlignment;

  useEffect(() => {
    // Play notification sound for high-priority signals
    if (primarySignal && alertsEnabled && (primarySignal.alerts.urgency === 'HIGH' || primarySignal.alerts.urgency === 'CRITICAL')) {
      // You could add audio notification here
      console.log('🚨 High Priority Signal Alert:', primarySignal.alerts.message);
    }
  }, [primarySignal, alertsEnabled]);

  const handleManualRefresh = () => {
    setLastRefresh(new Date());
    refetch();
  };


  if (isLoading) {
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <Signal className="h-6 w-6 text-blue-400" />
            Live Trading Signals
            <div className="animate-pulse bg-blue-500/20 h-6 w-16 rounded"></div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-700 rounded-lg"></div>
            <div className="h-20 bg-gray-700 rounded-lg"></div>
            <div className="h-20 bg-gray-700 rounded-lg"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-gray-900 border-gray-800 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-400" />
            Live Trading Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-red-500 bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-400">
              Failed to load trading signals. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-3">
              <Signal className="h-6 w-6 text-blue-400" />
              Live Trading Signals
              {primarySignal && (
                <Badge className={`ml-2 border ${getSignalColor(primarySignal.signal)}`}>
                  {getSignalIcon(primarySignal.signal)}
                  <span className="ml-2">{primarySignal.signal}</span>
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex items-center gap-3">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-24 bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="5m">5M</SelectItem>
                  <SelectItem value="15m">15M</SelectItem>
                  <SelectItem value="1H">1H</SelectItem>
                  <SelectItem value="4H">4H</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="text-gray-300"
              >
                {autoRefresh ? <Play className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleManualRefresh}
                className="text-gray-300 border-gray-600 hover:bg-gray-800"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>

              <Button
                variant={alertsEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className="text-gray-300"
              >
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Last update: {lastRefresh.toLocaleTimeString()}
            </div>
            {autoRefresh && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                Auto-refresh enabled
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Primary Signal */}
        {primarySignal && (
          <SignalCard 
            signal={primarySignal} 
            title="Primary Signal" 
            icon={<Target className="h-5 w-5" />}
            isPrimary={true}
          />
        )}

        {/* Secondary Signal */}
        {secondarySignal && (
          <SignalCard 
            signal={secondarySignal} 
            title="Scalp/Contrarian" 
            icon={<Zap className="h-5 w-5" />}
            isPrimary={false}
          />
        )}
      </div>

      {/* Market Conditions */}
      {marketConditions && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Market Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Price</div>
                <div className="text-white font-mono text-lg">${marketConditions.price.toFixed(2)}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Trend</div>
                <Badge className={getSignalColor(marketConditions.trend === 'bullish' ? 'BUY' : marketConditions.trend === 'bearish' ? 'SELL' : 'HOLD')}>
                  {marketConditions.trend}
                </Badge>
              </div>
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Volatility</div>
                <div className="text-white capitalize">{marketConditions.volatility}</div>
              </div>
              <div className="bg-gray-800 p-3 rounded-lg">
                <div className="text-xs text-gray-400 mb-1">Volume</div>
                <div className="text-white capitalize">{marketConditions.volume}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-Timeframe Alignment */}
      {multiTimeframeAlignment && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Multi-Timeframe Alignment
              <Badge className={`ml-2 ${
                multiTimeframeAlignment.alignment > 50 ? 'bg-green-500/20 text-green-400' :
                multiTimeframeAlignment.alignment < -50 ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {multiTimeframeAlignment.alignment > 0 ? '+' : ''}{multiTimeframeAlignment.alignment}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Short Term (5M)</span>
                <Badge className={getSignalColor(multiTimeframeAlignment.shortTerm?.signal || 'HOLD')}>
                  {multiTimeframeAlignment.shortTerm?.signal || 'HOLD'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Medium Term (1H)</span>
                <Badge className={getSignalColor(multiTimeframeAlignment.mediumTerm?.signal || 'HOLD')}>
                  {multiTimeframeAlignment.mediumTerm?.signal || 'HOLD'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Long Term (4H)</span>
                <Badge className={getSignalColor(multiTimeframeAlignment.longTerm?.signal || 'HOLD')}>
                  {multiTimeframeAlignment.longTerm?.signal || 'HOLD'}
                </Badge>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Alignment Score</span>
                  <span className={`text-sm font-medium ${
                    multiTimeframeAlignment.alignment > 0 ? 'text-green-400' : 
                    multiTimeframeAlignment.alignment < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {multiTimeframeAlignment.alignment}%
                  </span>
                </div>
                <Progress 
                  value={Math.abs(multiTimeframeAlignment.alignment)} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal History */}
      {historyData?.data && historyData.data.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {historyData.data.slice(0, 10).map((signal: TradingSignal, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${getSignalColor(signal.signal)}`}>
                      {getSignalIcon(signal.signal)}
                      <span className="ml-1">{signal.signal}</span>
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(signal.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getStrengthColor(signal.strength)}`}>
                      {signal.strength}
                    </Badge>
                    <span className="text-xs text-gray-400">{signal.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Individual Signal Card Component
function SignalCard({ signal, title, icon, isPrimary }: { 
  signal: TradingSignal; 
  title: string; 
  icon: React.ReactNode;
  isPrimary: boolean;
}) {
  return (
    <Card className={`bg-gray-900 border-gray-800 ${isPrimary ? 'ring-1 ring-blue-500/30' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {signal.alerts && (
            <div className="flex items-center gap-2">
              {getUrgencyIcon(signal.alerts.urgency)}
              <Badge className={`text-xs ${
                signal.alerts.urgency === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500' :
                signal.alerts.urgency === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border-orange-500' :
                signal.alerts.urgency === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500' :
                'bg-green-500/20 text-green-400 border-green-500'
              }`}>
                {signal.alerts.urgency}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Signal */}
        <div className="flex items-center justify-between">
          <Badge className={`text-lg px-4 py-2 border ${getSignalColor(signal.signal)}`}>
            {getSignalIcon(signal.signal)}
            <span className="ml-2 font-bold">{signal.signal}</span>
          </Badge>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-white">${signal.entryPrice.toFixed(2)}</div>
            <div className="text-xs text-gray-400">Entry Price</div>
          </div>
        </div>

        {/* Strength & Confidence */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Strength</div>
            <Badge className={getStrengthColor(signal.strength)}>
              {signal.strength}
            </Badge>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-xs text-gray-400 mb-2">Confidence</div>
            <div className="flex items-center gap-2">
              <Progress value={signal.confidence} className="h-2 flex-1" />
              <span className="text-white text-sm font-medium">{signal.confidence}%</span>
            </div>
          </div>
        </div>

        {/* Risk Management */}
        <div className="bg-gray-800 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-white font-medium">Risk Management</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-400">Stop Loss</div>
              <div className="text-red-400 font-mono">${signal.stopLoss.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-400">Take Profit 1</div>
              <div className="text-green-400 font-mono">${signal.takeProfit1.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-400">Take Profit 2</div>
              <div className="text-green-400 font-mono">${signal.takeProfit2.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-gray-400">Risk:Reward</div>
              <div className="text-blue-400 font-mono">1:{signal.riskReward}</div>
            </div>
          </div>
        </div>

        {/* Alert Message */}
        {signal.alerts && signal.alerts.message && (
          <Alert className={`border ${
            signal.alerts.urgency === 'CRITICAL' ? 'border-red-500 bg-red-500/10' :
            signal.alerts.urgency === 'HIGH' ? 'border-orange-500 bg-orange-500/10' :
            signal.alerts.urgency === 'MEDIUM' ? 'border-yellow-500 bg-yellow-500/10' :
            'border-green-500 bg-green-500/10'
          }`}>
            {getUrgencyIcon(signal.alerts.urgency)}
            <AlertDescription className={
              signal.alerts.urgency === 'CRITICAL' ? 'text-red-400' :
              signal.alerts.urgency === 'HIGH' ? 'text-orange-400' :
              signal.alerts.urgency === 'MEDIUM' ? 'text-yellow-400' :
              'text-green-400'
            }>
              {signal.alerts.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Enhanced: Explanatory Reasoning for Unclear Signals */}
        {signal.explanations && signal.explanations.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-orange-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Why Signal is Unclear:
            </div>
            <div className="space-y-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
              {signal.explanations.map((explanation, index) => (
                <div key={index} className="text-xs text-orange-300 flex items-start gap-2">
                  <div className="w-1 h-1 bg-orange-400 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div className="leading-relaxed">{explanation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signal Reasons */}
        {signal.reasons && signal.reasons.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-white">Supporting Factors:</div>
            <div className="space-y-1">
              {signal.reasons.slice(0, 3).map((reason, index) => (
                <div key={index} className="text-xs text-gray-400 flex items-center gap-2">
                  <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                  {reason}
                </div>
              ))}
            </div>
          </div>
        )}
        </div>

        <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
          Generated at {new Date(signal.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

export default LiveTradingSignals;
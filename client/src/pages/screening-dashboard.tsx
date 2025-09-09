/**
 * Multi-Coin Screening Dashboard
 * Real-time crypto screening dengan 8-layer analysis engine
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, RefreshCw, TrendingUp, TrendingDown, Minus, Clock, Activity, Target } from 'lucide-react';

interface ScreeningResult {
  symbol: string;
  score: number;
  label: 'BUY' | 'SELL' | 'HOLD';
  layers: {
    smc: { score: number; confidence: number };
    cvd: { score: number; confidence: number };
    price_action: { score: number | null; confidence: number | null };
    ema: { score: number; confidence: number };
    rsi_macd: { score: number; confidence: number };
    funding: { score: number; confidence: number };
    oi: { score: number; confidence: number };
    fibo: { score: number; confidence: number | null };
  };
  confidence: number;
  timestamp: string;
}

interface ScreeningData {
  run_id: string;
  params: {
    symbols: string[];
    timeframe: string;
    limit: number;
    enabledLayers: Record<string, boolean>;
  };
  results: ScreeningResult[];
  stats: {
    totalSymbols: number;
    buySignals: number;
    sellSignals: number;
    holdSignals: number;
    avgScore: number;
    processingTime: number;
  };
  timestamp: string;
}

const TIMEFRAMES = [
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '30m', label: '30 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' }
];

const DEFAULT_SYMBOLS = ['SOL', 'BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];

export default function ScreeningDashboard() {
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS.slice(0, 5).join(','));
  const [timeframe, setTimeframe] = useState('15m');
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);

  // Query untuk screening data
  const { data, isLoading, error, refetch, isRefetching } = useQuery<ScreeningData>({
    queryKey: ['/api/screener', symbols, timeframe],
    enabled: !!symbols,
    refetchInterval: isAutoRefresh ? refreshInterval * 1000 : false,
    staleTime: 10000, // 10 seconds
  });

  const handleRunScreening = () => {
    refetch();
  };

  const getSignalIcon = (label: string) => {
    switch (label) {
      case 'BUY':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'SELL':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getSignalBadgeVariant = (label: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (label) {
      case 'BUY':
        return 'default';
      case 'SELL':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score <= 30) return 'text-red-500';
    return 'text-yellow-500';
  };

  return (
    <div className="min-h-screen bg-black text-white p-6" data-testid="screening-dashboard">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-400" data-testid="page-title">
              🔍 Multi-Coin Screening
            </h1>
            <p className="text-gray-400 mt-1">
              Real-time 8-layer analysis engine untuk multiple crypto pairs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-400" />
            <span className="text-sm text-gray-400">
              {data ? `Last run: ${new Date(data.timestamp).toLocaleTimeString()}` : 'Ready to scan'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <Card className="bg-gray-950 border-gray-800" data-testid="screening-controls">
          <CardHeader>
            <CardTitle className="text-green-400 flex items-center gap-2">
              <Target className="h-5 w-5" />
              Screening Parameters
            </CardTitle>
            <CardDescription>
              Configure symbols, timeframe, dan auto-refresh settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Symbols (comma-separated)</label>
                <Input
                  value={symbols}
                  onChange={(e) => setSymbols(e.target.value)}
                  placeholder="SOL,BTC,ETH,BNB,XRP"
                  className="bg-gray-900 border-gray-700"
                  data-testid="input-symbols"
                />
                <p className="text-xs text-gray-500">
                  Default: {DEFAULT_SYMBOLS.slice(0, 8).join(', ')}...
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Timeframe</label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="bg-gray-900 border-gray-700" data-testid="select-timeframe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEFRAMES.map((tf) => (
                      <SelectItem key={tf.value} value={tf.value}>
                        {tf.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Auto Refresh</label>
                <div className="flex items-center gap-2">
                  <Button
                    variant={isAutoRefresh ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                    data-testid="button-auto-refresh"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    {isAutoRefresh ? 'ON' : 'OFF'}
                  </Button>
                  {isAutoRefresh && (
                    <Input
                      type="number"
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="w-20 bg-gray-900 border-gray-700"
                      min="5"
                      max="300"
                    />
                  )}
                </div>
              </div>
            </div>

            <Separator className="bg-gray-800" />

            <div className="flex items-center justify-between">
              <Button
                onClick={handleRunScreening}
                disabled={isLoading || isRefetching || !symbols.trim()}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-run-screening"
              >
                {isLoading || isRefetching ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isLoading || isRefetching ? 'Scanning...' : 'Run Screening'}
              </Button>

              {data && (
                <div className="text-sm text-gray-400">
                  ⚡ Processed {data.stats.totalSymbols} symbols in {data.stats.processingTime}ms
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert className="bg-red-950 border-red-800 text-red-200" data-testid="error-alert">
            <AlertDescription>
              Error: {error instanceof Error ? error.message : 'Failed to fetch screening data'}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Overview */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="stats-overview">
            <Card className="bg-gray-950 border-gray-800">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white">{data.stats.totalSymbols}</div>
                <div className="text-xs text-gray-400">Total Symbols</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-950 border-gray-800">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-500">{data.stats.buySignals}</div>
                <div className="text-xs text-gray-400">BUY Signals</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-950 border-gray-800">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-500">{data.stats.sellSignals}</div>
                <div className="text-xs text-gray-400">SELL Signals</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-950 border-gray-800">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-500">{data.stats.holdSignals}</div>
                <div className="text-xs text-gray-400">HOLD Signals</div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-950 border-gray-800">
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${getScoreColor(data.stats.avgScore)}`}>
                  {data.stats.avgScore}
                </div>
                <div className="text-xs text-gray-400">Avg Score</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Table */}
        {data && data.results.length > 0 && (
          <Card className="bg-gray-950 border-gray-800" data-testid="results-table">
            <CardHeader>
              <CardTitle className="text-green-400">Screening Results</CardTitle>
              <CardDescription>
                8-layer analysis results for {data.stats.totalSymbols} symbols
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-2">Symbol</th>
                      <th className="text-center py-3 px-2">Signal</th>
                      <th className="text-center py-3 px-2">Score</th>
                      <th className="text-center py-3 px-2">SMC</th>
                      <th className="text-center py-3 px-2">CVD</th>
                      <th className="text-center py-3 px-2">EMA</th>
                      <th className="text-center py-3 px-2">RSI/MACD</th>
                      <th className="text-center py-3 px-2">Funding</th>
                      <th className="text-center py-3 px-2">OI</th>
                      <th className="text-center py-3 px-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((result) => (
                      <tr key={result.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                        <td className="py-3 px-2 font-medium text-white">
                          {result.symbol}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Badge 
                            variant={getSignalBadgeVariant(result.label)}
                            className="flex items-center gap-1 w-fit mx-auto"
                            data-testid={`signal-${result.symbol.toLowerCase()}`}
                          >
                            {getSignalIcon(result.label)}
                            {result.label}
                          </Badge>
                        </td>
                        <td className={`py-3 px-2 text-center font-bold ${getScoreColor(result.score)}`}>
                          {result.score}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-400">
                          {result.layers.smc.score}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-400">
                          {result.layers.cvd.score}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-400">
                          {result.layers.ema.score}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-400">
                          {result.layers.rsi_macd.score}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-400">
                          {result.layers.funding.score}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-400">
                          {result.layers.oi.score}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-400">
                          {Math.round(result.confidence * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {(isLoading || isRefetching) && (
          <Card className="bg-gray-950 border-gray-800" data-testid="loading-state">
            <CardContent className="p-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-green-400" />
              <div className="text-lg font-medium">Running 8-Layer Analysis...</div>
              <div className="text-sm text-gray-400 mt-2">
                Processing symbols: {symbols}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !data && !error && (
          <Card className="bg-gray-950 border-gray-800" data-testid="empty-state">
            <CardContent className="p-8 text-center">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-500" />
              <div className="text-lg font-medium text-gray-400">Ready to Screen</div>
              <div className="text-sm text-gray-500 mt-2">
                Click "Run Screening" to start analyzing your selected symbols
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
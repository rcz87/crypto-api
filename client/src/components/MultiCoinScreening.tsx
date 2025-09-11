/**
 * Multi-Coin Screening Component
 * Terintegrasi dengan dashboard utama sebagai section
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, RefreshCw, TrendingUp, TrendingDown, Minus, Clock, Activity, Target, Search } from 'lucide-react';
import { DataTrustIndicator } from '@/components/DataTrustIndicator';
import { useIsMobile } from '@/hooks/use-mobile';

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
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' }
];

const POPULAR_SETS = {
  'Top 5': 'SOL,BTC,ETH,BNB,XRP',
  'Top 10': 'SOL,BTC,ETH,BNB,XRP,ADA,DOGE,MATIC,DOT,AVAX',
  'DeFi': 'UNI,AAVE,COMP,SUSHI,MKR,CRV,YFI,SNX',
  'Layer 1': 'SOL,ETH,BNB,ADA,DOT,AVAX,ATOM,NEAR'
};

export default function MultiCoinScreening() {
  const [symbols, setSymbols] = useState('SOL,BTC,ETH,BNB,XRP');
  const [timeframe, setTimeframe] = useState('15m');
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const isMobile = useIsMobile();

  // Query untuk screening data with metadata tracking
  const { data: queryResponse, isLoading, error, refetch, isRefetching } = useQuery<{
    success: boolean;
    data: ScreeningData;
    timestamp: string;
    _metadata?: {
      latency: number;
      requestTime: string;
      dataSource: string;
    };
  }>({
    queryKey: ['/api/screener', symbols, timeframe],
    queryFn: async () => {
      const requestStart = performance.now();
      const params = new URLSearchParams({
        symbols: symbols.trim(),
        timeframe: timeframe,
        limit: '100'
      });
      
      const response = await fetch(`/api/screener?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Screening failed');
      }
      
      // Inject metadata if not present
      const requestEnd = performance.now();
      if (!result._metadata) {
        result._metadata = {
          latency: Math.round(requestEnd - requestStart),
          requestTime: new Date().toISOString(),
          dataSource: 'Screener API'
        };
      }
      
      return result;
    },
    enabled: !!symbols,
    refetchInterval: isAutoRefresh ? refreshInterval * 1000 : false,
    staleTime: 10000, // 10 seconds
  });

  // Extract data and metadata
  const data = queryResponse?.data;
  const metadata = queryResponse?._metadata;

  const handleRunScreening = () => {
    refetch();
  };

  const handlePresetSelect = (preset: string) => {
    setSymbols(POPULAR_SETS[preset as keyof typeof POPULAR_SETS]);
  };

  const getSignalIcon = (label: string) => {
    switch (label) {
      case 'BUY':
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'SELL':
        return <TrendingDown className="h-3 w-3 text-red-500" />;
      default:
        return <Minus className="h-3 w-3 text-yellow-500" />;
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
    <div className="space-y-4" data-testid="multi-coin-screening">
      {/* Header & Controls */}
      <Card className="bg-gray-950 border-gray-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-green-400 flex items-center gap-2 text-lg">
            <Search className="h-5 w-5" />
            Multi-Coin Screening
          </CardTitle>
          <CardDescription className="text-sm">
            8-layer analysis engine untuk multiple crypto pairs
          </CardDescription>
          {/* Data Trust Indicator for Screening Results */}
          {metadata && (
            <div className={`mt-2 ${isMobile ? 'flex-col space-y-1' : 'flex justify-between items-center'}`}>
              <DataTrustIndicator
                dataSource={metadata.dataSource}
                timestamp={metadata.requestTime}
                latency={metadata.latency}
                isRealTime={false}
                size={isMobile ? 'sm' : 'md'}
                orientation={isMobile ? 'vertical' : 'horizontal'}
                className="opacity-80"
              />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {Object.keys(POPULAR_SETS).map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                onClick={() => handlePresetSelect(preset)}
                className="h-7 text-xs"
              >
                {preset}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400">Symbols</label>
              <Input
                value={symbols}
                onChange={(e) => setSymbols(e.target.value)}
                placeholder="SOL,BTC,ETH..."
                className="bg-gray-900 border-gray-700 h-8 text-sm"
                data-testid="input-symbols"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400">Timeframe</label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="bg-gray-900 border-gray-700 h-8" data-testid="select-timeframe">
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

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400">Auto Refresh</label>
              <div className="flex items-center gap-2">
                <Button
                  variant={isAutoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                  className="h-8 text-xs"
                  data-testid="button-auto-refresh"
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {isAutoRefresh ? 'ON' : 'OFF'}
                </Button>
                {isAutoRefresh && (
                  <Input
                    type="number"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="w-16 bg-gray-900 border-gray-700 h-8 text-xs"
                    min="5"
                    max="300"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400">Action</label>
              <Button
                onClick={handleRunScreening}
                disabled={isLoading || isRefetching || !symbols.trim()}
                className="bg-green-600 hover:bg-green-700 h-8 text-xs w-full"
                data-testid="button-run-screening"
              >
                {isLoading || isRefetching ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                {isLoading || isRefetching ? 'Scanning...' : 'Run Scan'}
              </Button>
            </div>
          </div>

          {/* Stats */}
          {data && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>⚡ {data.stats.processingTime}ms</span>
                <span>{data.stats.totalSymbols} symbols</span>
                <span className="text-green-500">{data.stats.buySignals} BUY</span>
                <span className="text-red-500">{data.stats.sellSignals} SELL</span>
                <span className="text-yellow-500">{data.stats.holdSignals} HOLD</span>
              </div>
              <div className="text-xs text-gray-500">
                {data.timestamp && `Last: ${new Date(data.timestamp).toLocaleTimeString()}`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert className="bg-red-950 border-red-800 text-red-200" data-testid="error-alert">
          <AlertDescription className="text-sm">
            Error: {error instanceof Error ? error.message : 'Failed to fetch screening data'}
          </AlertDescription>
        </Alert>
      )}

      {/* Results Table */}
      {data && data.results.length > 0 && (
        <Card className="bg-gray-950 border-gray-800" data-testid="results-table">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-400 text-base">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 px-2 font-medium">Symbol</th>
                    <th className="text-center py-2 px-2 font-medium">Signal</th>
                    <th className="text-center py-2 px-2 font-medium">Score</th>
                    <th className="text-center py-2 px-2 font-medium">SMC</th>
                    <th className="text-center py-2 px-2 font-medium">CVD</th>
                    <th className="text-center py-2 px-2 font-medium">EMA</th>
                    <th className="text-center py-2 px-2 font-medium">RSI/MACD</th>
                    <th className="text-center py-2 px-2 font-medium">Funding</th>
                    <th className="text-center py-2 px-2 font-medium">OI</th>
                    <th className="text-center py-2 px-2 font-medium">Conf</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.slice(0, 10).map((result) => (
                    <tr key={result.symbol} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                      <td className="py-2 px-2 font-medium text-white text-xs">
                        {result.symbol}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Badge 
                          variant={getSignalBadgeVariant(result.label)}
                          className="flex items-center gap-1 w-fit mx-auto text-xs h-5"
                          data-testid={`signal-${result.symbol.toLowerCase()}`}
                        >
                          {getSignalIcon(result.label)}
                          {result.label}
                        </Badge>
                      </td>
                      <td className={`py-2 px-2 text-center font-bold text-xs ${getScoreColor(result.score)}`}>
                        {result.score}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-400 text-xs">
                        {result.layers.smc.score}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-400 text-xs">
                        {result.layers.cvd.score}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-400 text-xs">
                        {result.layers.ema.score}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-400 text-xs">
                        {result.layers.rsi_macd.score}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-400 text-xs">
                        {result.layers.funding.score}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-400 text-xs">
                        {result.layers.oi.score}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-400 text-xs">
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
          <CardContent className="p-6 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 text-green-400" />
            <div className="text-sm font-medium">Running 8-Layer Analysis...</div>
            <div className="text-xs text-gray-400 mt-1">
              Processing: {symbols}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !data && !error && (
        <Card className="bg-gray-950 border-gray-800" data-testid="empty-state">
          <CardContent className="p-6 text-center">
            <Target className="h-8 w-8 mx-auto mb-3 text-gray-500" />
            <div className="text-sm font-medium text-gray-400">Ready to Screen</div>
            <div className="text-xs text-gray-500 mt-1">
              Select symbols and click "Run Scan" to start analysis
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
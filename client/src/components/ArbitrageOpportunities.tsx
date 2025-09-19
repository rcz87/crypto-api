import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, ArrowRightLeft, RefreshCw, AlertTriangle, DollarSign } from 'lucide-react';
import { useSymbol } from '@/contexts/SymbolContext';

interface ArbitrageOpportunity {
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  profit_percentage: number;
  profit_usd: number;
}

interface ArbitrageData {
  asset: string;
  total_opportunities: number;
  opportunities: ArbitrageOpportunity[];
  best_opportunity: {
    buy_exchange: string;
    sell_exchange: string;
    profit_percentage: number;
  } | null;
}

interface ArbitrageResponse {
  success: boolean;
  data: ArbitrageData;
  degraded: boolean;
  data_source: string;
  metadata: {
    source: string;
    response_time_ms: number;
    health_status: {
      status: string;
      p95_latency: number;
      error_rate: number;
    };
  };
  timestamp: string;
}

export function ArbitrageOpportunities() {
  const { symbol } = useSymbol();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Convert symbol to asset (remove USDT suffix)
  const asset = symbol.replace('USDT', '').replace('-USDT-SWAP', '');
  
  const { 
    data: arbitrageData, 
    isLoading, 
    error, 
    refetch,
    isRefetching 
  } = useQuery<ArbitrageResponse>({
    queryKey: [`/api/coinapi/arbitrage/${asset}`],
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2,
    staleTime: 25000, // Consider stale after 25 seconds
    enabled: !!asset, // Only fetch if asset is available
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const formatProfitPercentage = (percentage: number) => {
    return `+${percentage.toFixed(4)}%`;
  };

  const formatPrice = (price: number) => {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };

  const formatExchangeName = (exchange: string) => {
    return exchange.charAt(0).toUpperCase() + exchange.slice(1).toLowerCase();
  };

  const getProfitColor = (percentage: number) => {
    if (percentage >= 0.1) return 'text-green-400';
    if (percentage >= 0.05) return 'text-green-300';
    return 'text-green-200';
  };

  const renderOpportunityCard = (opportunity: ArbitrageOpportunity, index: number) => (
    <div 
      key={index}
      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-colors"
    >
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs">
            {formatExchangeName(opportunity.buy_exchange)}
          </Badge>
          <ArrowRightLeft size={14} className="text-gray-400" />
          <Badge variant="outline" className="text-xs">
            {formatExchangeName(opportunity.sell_exchange)}
          </Badge>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <div className="text-xs text-gray-400">Buy / Sell</div>
          <div className="text-sm font-mono">
            {formatPrice(opportunity.buy_price)} / {formatPrice(opportunity.sell_price)}
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-sm font-semibold ${getProfitColor(opportunity.profit_percentage)}`}>
            {formatProfitPercentage(opportunity.profit_percentage)}
          </div>
          <div className="text-xs text-gray-400">
            {formatPrice(opportunity.profit_usd)} profit
          </div>
        </div>
      </div>
    </div>
  );

  if (error) {
    return (
      <Card className="bg-gray-900/95 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-red-400 flex items-center gap-2">
            <AlertTriangle size={20} />
            Arbitrage Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-400 text-sm">
            Failed to load arbitrage opportunities: {(error as Error).message}
          </div>
          <Button 
            onClick={handleRefresh}
            variant="outline" 
            size="sm" 
            className="mt-3"
            disabled={isRefreshing}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/95 border-gray-700" data-testid="card-arbitrage-opportunities">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
            <DollarSign size={20} className="text-green-400" />
            Arbitrage Opportunities
            <Badge variant="secondary" className="ml-2 text-xs">
              {asset}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {arbitrageData?.degraded && (
              <Badge variant="destructive" className="text-xs">
                Degraded
              </Badge>
            )}
            <Button 
              onClick={handleRefresh}
              variant="ghost" 
              size="sm" 
              disabled={isLoading || isRefreshing || isRefetching}
              data-testid="button-refresh-arbitrage"
            >
              <RefreshCw size={14} className={(isLoading || isRefreshing || isRefetching) ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-gray-800" />
            ))}
          </div>
        ) : arbitrageData?.success && arbitrageData.data ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">Total Opportunities</div>
                <div className="text-xl font-semibold text-gray-100" data-testid="text-total-opportunities">
                  {arbitrageData.data.total_opportunities}
                </div>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-400 mb-1">Best Profit</div>
                <div className={`text-xl font-semibold ${getProfitColor(arbitrageData.data.best_opportunity?.profit_percentage || 0)}`} data-testid="text-best-profit">
                  {arbitrageData.data.best_opportunity 
                    ? formatProfitPercentage(arbitrageData.data.best_opportunity.profit_percentage)
                    : 'None'
                  }
                </div>
              </div>
            </div>

            {/* Best Opportunity Highlight */}
            {arbitrageData.data.best_opportunity && (
              <div className="bg-gradient-to-r from-green-900/20 to-green-800/20 rounded-lg p-4 border border-green-700/30 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-green-400" />
                  <span className="text-sm font-medium text-green-300">Best Opportunity</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-700/50 text-green-200 border-green-600">
                      Buy: {formatExchangeName(arbitrageData.data.best_opportunity.buy_exchange)}
                    </Badge>
                    <ArrowRightLeft size={14} className="text-green-400" />
                    <Badge className="bg-green-700/50 text-green-200 border-green-600">
                      Sell: {formatExchangeName(arbitrageData.data.best_opportunity.sell_exchange)}
                    </Badge>
                  </div>
                  <div className="text-green-300 font-semibold">
                    {formatProfitPercentage(arbitrageData.data.best_opportunity.profit_percentage)}
                  </div>
                </div>
              </div>
            )}

            {/* Opportunities List */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-300 mb-3">All Opportunities</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto" data-testid="list-arbitrage-opportunities">
                {arbitrageData.data.opportunities.length > 0 ? (
                  arbitrageData.data.opportunities.map(renderOpportunityCard)
                ) : (
                  <div className="text-center py-6 text-gray-400">
                    <TrendingDown size={24} className="mx-auto mb-2 opacity-50" />
                    <div className="text-sm">No arbitrage opportunities found</div>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700/50">
              <div>Source: {arbitrageData.metadata.source}</div>
              <div>Updated: {new Date(arbitrageData.timestamp).toLocaleTimeString()}</div>
              <div>Response: {arbitrageData.metadata.response_time_ms}ms</div>
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-gray-400">
            <AlertTriangle size={24} className="mx-auto mb-2 opacity-50" />
            <div className="text-sm">Failed to load arbitrage data</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
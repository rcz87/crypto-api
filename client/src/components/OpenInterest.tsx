import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, DollarSign, TrendingUp, PieChart, BarChart3, Zap, AlertTriangle, Target, TrendingDown } from 'lucide-react';
import { useState, useMemo } from 'react';

interface OpenInterestData {
  instId: string;
  instType: 'SPOT' | 'MARGIN' | 'SWAP' | 'FUTURES' | 'OPTION';
  oi: string; // Open Interest in base currency
  oiCcy: string; // Open Interest in currency  
  oiUsd: string; // Open Interest in USD
  timestamp: string;
}

interface EnhancedOpenInterestData {
  current: {
    instId: string;
    instType: string;
    openInterest: number;
    openInterestUsd: number;
    price: number;
    timestamp: string;
  };
  historical_context: {
    oi_24h_avg: number;
    oi_7d_avg: number;
    oi_change_24h: number;
    oi_change_7d: number;
    oi_volatility_24h: number;
    price_oi_correlation: number;
  };
  advanced_metrics: {
    market_efficiency: number;
    oi_pressure_ratio: number;
    long_short_ratio: number;
    oi_turnover_rate: number;
    institutional_dominance_score: number;
    liquidity_depth_score: number;
  };
  liquidation_analysis: {
    cluster_risk_score: number;
    critical_levels: Array<{
      priceLevel: number;
      liquidationVolume: number;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      positionType: 'long' | 'short' | 'mixed';
    }>;
    cascade_probability: number;
    estimated_liquidation_volume: number;
    time_to_cascade_estimate: string;
  };
  market_structure: {
    oi_distribution: 'concentrated' | 'balanced' | 'distributed';
    market_phase: 'accumulation' | 'distribution' | 'trending' | 'consolidation';
    institutional_presence: 'dominant' | 'significant' | 'moderate' | 'light';
    risk_level: 'extreme' | 'high' | 'moderate' | 'low';
  };
}

export function OpenInterest() {
  // Enhanced Open Interest data with all institutional metrics
  const { data: enhancedOIData, isLoading, error } = useQuery<{
    success: boolean;
    data: EnhancedOpenInterestData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/oi/enhanced'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/sol/oi/enhanced', {
        signal
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch enhanced open interest data`);
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  // Historical OI data for trends
  const { data: historicalOIData } = useQuery<{
    success: boolean;
    data: {
      data_points: Array<{
        timestamp: string;
        openInterest: number;
        openInterestUsd: number;
        price: number;
        volume24h: number;
        longShortRatio?: number;
      }>;
      trends: {
        oi_trend: number[];
        oi_usd_trend: number[];
        price_correlation: number[];
      };
      statistics: {
        average_oi: number;
        max_oi: number;
        min_oi: number;
        oi_volatility: number;
        correlation_with_price: number;
      };
    };
  }>({
    queryKey: ['/api/sol/oi/history', '24h'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/sol/oi/history?timeframe=24h', {
        signal
      });
      if (!response.ok) {
        throw new Error('Failed to fetch historical OI data');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    refetchIntervalInBackground: false,
  });

  // Enhanced analytics from API (no longer need to calculate manually)
  const enhancedAnalytics = useMemo(() => {
    if (!enhancedOIData?.success) return null;
    
    // All analytics now come from enhanced API
    return enhancedOIData.data;
  }, [enhancedOIData]);

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Open Interest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !enhancedOIData?.success) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Open Interest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load open interest data</p>
        </CardContent>
      </Card>
    );
  }

  // Use enhanced OI data directly 
  const oi = enhancedOIData.data.current;
  const oiValue = oi.openInterest;
  const oiUsdValue = oi.openInterestUsd;
  
  // Format numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatCurrency = (num: number): string => {
    if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'K';
    return '$' + num.toFixed(2);
  };

  const getInstTypeColor = (type: string) => {
    switch (type) {
      case 'SWAP': return 'bg-purple-600';
      case 'FUTURES': return 'bg-blue-600';
      case 'SPOT': return 'bg-green-600';
      case 'MARGIN': return 'bg-orange-600';
      case 'OPTION': return 'bg-pink-600';
      default: return 'bg-gray-600';
    }
  };

  const getInstTypeIcon = (type: string) => {
    switch (type) {
      case 'SWAP': return '🔄';
      case 'FUTURES': return '📅';
      case 'SPOT': return '💰';
      case 'MARGIN': return '📊';
      case 'OPTION': return '⚡';
      default: return '📈';
    }
  };

  // Calculate some relative metrics
  const averagePrice = oiUsdValue / oiValue; // Average position price
  const lastUpdate = new Date(parseInt(oi.timestamp)).toLocaleTimeString();

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Open Interest Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instrument Type */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getInstTypeIcon(oi.instType)}</span>
            <span className="text-gray-400">{oi.instId}</span>
          </div>
          <Badge className={`${getInstTypeColor(oi.instType)} text-white`}>
            {oi.instType}
          </Badge>
        </div>

        {/* Main OI Metrics - Compact */}
        <div className="bg-gray-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-gray-400">
            <PieChart className="w-4 h-4" />
            <span className="text-sm">Total Open Interest</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xl font-bold text-white">
                {formatNumber(oiValue)} SOL
              </div>
            </div>
            <div>
              <div className="text-lg text-green-400">
                {formatCurrency(oiUsdValue)}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Volume (SOL)</span>
            <div className="text-lg font-semibold text-white">
              {oiValue.toLocaleString(undefined, { 
                maximumFractionDigits: 0 
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Volume (USD)</span>
            <div className="text-lg font-semibold text-green-400">
              ${oiUsdValue.toLocaleString(undefined, { 
                maximumFractionDigits: 0 
              })}
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Avg Position Price</span>
            <div className="text-lg font-semibold text-blue-400">
              ${averagePrice.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Last Update</span>
            <div className="text-sm text-gray-400">
              {lastUpdate}
            </div>
          </div>
        </div>

        {/* Institutional-Grade OI Intelligence */}
        {institutionalAnalytics && (
          <div className="space-y-3">
            {/* Advanced Risk Assessment Matrix */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 rounded-lg p-3 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400 font-medium">Liquidation Cascade Risk</span>
                </div>
                <div className={`text-lg font-bold ${
                  institutionalAnalytics.cascadeRisk === 'extreme' ? 'text-red-400' :
                  institutionalAnalytics.cascadeRisk === 'high' ? 'text-orange-400' :
                  institutionalAnalytics.cascadeRisk === 'moderate' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {institutionalAnalytics.cascadeRiskScore.toFixed(1)}/100
                </div>
                <div className="text-xs text-red-300">
                  {institutionalAnalytics.cascadeRisk.toUpperCase()} RISK
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-3 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-purple-400 font-medium">Market Efficiency</span>
                </div>
                <div className={`text-lg font-bold ${
                  institutionalAnalytics.oiHealthScore > 60 ? 'text-green-400' :
                  institutionalAnalytics.oiHealthScore > 30 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {institutionalAnalytics.oiHealthScore.toFixed(1)}/100
                </div>
                <div className="text-xs text-purple-300">
                  {institutionalAnalytics.derivativesIntelligence.marketEfficiency.toUpperCase()}
                </div>
              </div>
            </div>

            {/* OI-Price Correlation Matrix */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-3">Derivatives Intelligence Matrix</div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400">OI/Volume Ratio:</span>
                  <div className={`font-semibold ${
                    institutionalAnalytics.oiVolumeRatio > 10 ? 'text-orange-400' :
                    institutionalAnalytics.oiVolumeRatio > 5 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {institutionalAnalytics.oiVolumeRatio.toFixed(2)}x
                  </div>
                  <div className="text-gray-500">{institutionalAnalytics.oiEfficiency}</div>
                </div>
                <div>
                  <span className="text-gray-400">Turnover Rate:</span>
                  <div className={`font-semibold ${
                    institutionalAnalytics.oiTurnoverRatio > 0.5 ? 'text-green-400' :
                    institutionalAnalytics.oiTurnoverRatio > 0.2 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {(institutionalAnalytics.oiTurnoverRatio * 100).toFixed(1)}%
                  </div>
                  <div className="text-gray-500">{institutionalAnalytics.microstructure}</div>
                </div>
                <div>
                  <span className="text-gray-400">OI Momentum:</span>
                  <div className={`font-semibold ${
                    institutionalAnalytics.oiMomentum === 'bullish_expansion' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {institutionalAnalytics.priceChange24h > 0 ? 'EXPANDING' : 'CONTRACTING'}
                  </div>
                  <div className="text-gray-500">
                    {institutionalAnalytics.priceChange24h > 0 ? '📈' : '📉'} {Math.abs(institutionalAnalytics.priceChange24h).toFixed(2)}%
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Institution Presence:</span>
                  <div className={`font-semibold ${
                    institutionalAnalytics.derivativesIntelligence.institutionalPresence === 'dominant' ? 'text-purple-400' :
                    institutionalAnalytics.derivativesIntelligence.institutionalPresence === 'significant' ? 'text-blue-400' : 'text-gray-400'
                  }`}>
                    {institutionalAnalytics.derivativesIntelligence.institutionalPresence.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Derivatives Risk Analysis */}
            <div className="bg-gradient-to-br from-gray-900/50 to-blue-900/30 rounded-lg p-3 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Advanced Derivatives Analysis</span>
              </div>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Price Volatility (24h):</span>
                  <span className={`font-mono ${
                    institutionalAnalytics.priceVolatility > 0.1 ? 'text-red-400' :
                    institutionalAnalytics.priceVolatility > 0.05 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {(institutionalAnalytics.priceVolatility * 100).toFixed(2)}%
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">OI Concentration:</span>
                  <span className="font-mono text-white">
                    {institutionalAnalytics.oiConcentration.toFixed(3)} per $1M
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Market Structure:</span>
                  <span className={`font-semibold ${
                    institutionalAnalytics.microstructure === 'active_trading' ? 'text-green-400' :
                    institutionalAnalytics.microstructure === 'moderate_activity' ? 'text-yellow-400' :
                    institutionalAnalytics.microstructure === 'low_activity' ? 'text-orange-400' : 'text-red-400'
                  }`}>
                    {institutionalAnalytics.microstructure.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Liquidation Cluster Risk:</span>
                  <span className={`font-semibold ${
                    institutionalAnalytics.derivativesIntelligence.liquidationClusterRisk === 'critical' ? 'text-red-400' :
                    institutionalAnalytics.derivativesIntelligence.liquidationClusterRisk === 'elevated' ? 'text-orange-400' : 'text-green-400'
                  }`}>
                    {institutionalAnalytics.derivativesIntelligence.liquidationClusterRisk.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Critical Alert for Extreme Risk */}
            {institutionalAnalytics.cascadeRisk === 'extreme' && (
              <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 rounded-lg p-3 border-2 border-red-500/60">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-red-400 animate-pulse" />
                  <span className="text-sm font-bold text-red-400">LIQUIDATION CASCADE WARNING</span>
                </div>
                <div className="text-xs text-red-300">
                  Extreme OI concentration + volatility = High liquidation cascade risk
                </div>
              </div>
            )}

            {/* Enhanced Market Analysis */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Institutional Intelligence Summary</div>
              <div className="text-sm space-y-1">
                <div className={`font-medium ${
                  oiUsdValue > 1000000000 ? 'text-purple-400' :
                  oiUsdValue > 500000000 ? 'text-orange-400' :
                  oiUsdValue > 200000000 ? 'text-yellow-400' : 'text-blue-400'
                }`}>
                  {oiUsdValue > 1000000000 ? '🏛️ Institutional Dominance' :
                   oiUsdValue > 500000000 ? '🔥 High Institutional Interest' :
                   oiUsdValue > 200000000 ? '📊 Moderate Activity' : '🌊 Light Interest'}
                </div>
                <div className="text-xs text-gray-400">
                  OI/Volume: {institutionalAnalytics.oiVolumeRatio.toFixed(1)}x • 
                  Turnover: {(institutionalAnalytics.oiTurnoverRatio * 100).toFixed(1)}% • 
                  Efficiency: {institutionalAnalytics.derivativesIntelligence.marketEfficiency}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fallback for when complete data not available */}
        {!institutionalAnalytics && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Basic Market Analysis</div>
            <div className="text-sm">
              {oiUsdValue > 500000000 ? (
                <div className="text-orange-400">
                  🔥 <strong>High OI:</strong> Strong institutional interest
                </div>
              ) : oiUsdValue > 200000000 ? (
                <div className="text-yellow-400">
                  📊 <strong>Moderate OI:</strong> Normal trading activity
                </div>
              ) : (
                <div className="text-blue-400">
                  🌊 <strong>Low OI:</strong> Light trading interest
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
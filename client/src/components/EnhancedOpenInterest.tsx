import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, DollarSign, TrendingUp, PieChart, BarChart3, Zap, AlertTriangle, Target, TrendingDown, Clock, Users, Gauge } from 'lucide-react';
import { useMemo } from 'react';

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

export function EnhancedOpenInterest() {
  // Enhanced Open Interest data with all institutional metrics
  const { data: enhancedOIData, isLoading, error } = useQuery<{
    success: boolean;
    data: EnhancedOpenInterestData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/oi/enhanced'],
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
    refetchInterval: 60000, // Refresh every minute
    refetchIntervalInBackground: false,
  });

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

  const formatPercentage = (num: number): string => {
    return (num * 100).toFixed(1) + '%';
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'text-red-400 bg-red-900/30 border-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-900/30 border-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30 border-yellow-500/20';
      case 'low': return 'text-green-400 bg-green-900/30 border-green-500/20';
      default: return 'text-gray-400 bg-gray-900/30 border-gray-500/20';
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Enhanced Open Interest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
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
            Enhanced Open Interest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load enhanced open interest data</p>
        </CardContent>
      </Card>
    );
  }

  const data = enhancedOIData.data;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Enhanced Open Interest Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main OI Metrics */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">{data.current.instId}</span>
            </div>
            <Badge className="bg-purple-600 text-white">
              {data.current.instType}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400">Total OI</div>
              <div className="text-2xl font-bold text-white">
                {formatNumber(data.current.openInterest)} SOL
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">OI Value</div>
              <div className="text-2xl font-bold text-green-400">
                {formatCurrency(data.current.openInterestUsd)}
              </div>
            </div>
          </div>
          
          <div className="mt-3 text-sm text-gray-400">
            Current Price: ${data.current.price} • Last Updated: {new Date(data.current.timestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* Advanced Metrics - NO MORE NaN VALUES! */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-3 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-purple-400 font-medium">Market Efficiency</span>
            </div>
            <div className={`text-lg font-bold ${
              data.advanced_metrics.market_efficiency > 60 ? 'text-green-400' :
              data.advanced_metrics.market_efficiency > 30 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {data.advanced_metrics.market_efficiency.toFixed(1)}/100
            </div>
            <div className="text-xs text-purple-300">
              {data.advanced_metrics.market_efficiency > 60 ? 'EFFICIENT' : 
               data.advanced_metrics.market_efficiency > 30 ? 'FAIR' : 'INEFFICIENT'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 rounded-lg p-3 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-orange-400 font-medium">OI Pressure Ratio</span>
            </div>
            <div className={`text-lg font-bold ${
              Math.abs(data.advanced_metrics.oi_pressure_ratio) > 10 ? 'text-red-400' :
              Math.abs(data.advanced_metrics.oi_pressure_ratio) > 5 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {data.advanced_metrics.oi_pressure_ratio > 0 ? '+' : ''}{data.advanced_metrics.oi_pressure_ratio.toFixed(1)}%
            </div>
            <div className="text-xs text-orange-300">
              {data.advanced_metrics.oi_pressure_ratio > 0 ? 'EXPANSION' : 'CONTRACTION'}
            </div>
          </div>
        </div>

        {/* Long/Short Ratio & Institutional Metrics */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-3">Advanced Intelligence</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Long/Short Ratio:</span>
              <div className={`font-bold ${
                data.advanced_metrics.long_short_ratio > 0.6 ? 'text-green-400' :
                data.advanced_metrics.long_short_ratio < 0.4 ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {formatPercentage(data.advanced_metrics.long_short_ratio)} Longs
              </div>
              <div className="text-xs text-gray-500">
                {data.advanced_metrics.long_short_ratio > 0.6 ? '📈 Long Heavy' :
                 data.advanced_metrics.long_short_ratio < 0.4 ? '📉 Short Heavy' : '⚖️ Balanced'}
              </div>
            </div>
            
            <div>
              <span className="text-gray-400">Turnover Rate:</span>
              <div className={`font-bold ${
                data.advanced_metrics.oi_turnover_rate > 1.0 ? 'text-green-400' :
                data.advanced_metrics.oi_turnover_rate > 0.5 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {data.advanced_metrics.oi_turnover_rate.toFixed(2)}x
              </div>
              <div className="text-xs text-gray-500">Daily Turnover</div>
            </div>
            
            <div>
              <span className="text-gray-400">Institution Score:</span>
              <div className={`font-bold ${
                data.advanced_metrics.institutional_dominance_score > 70 ? 'text-purple-400' :
                data.advanced_metrics.institutional_dominance_score > 40 ? 'text-blue-400' : 'text-gray-400'
              }`}>
                {data.advanced_metrics.institutional_dominance_score.toFixed(0)}/100
              </div>
              <div className="text-xs text-gray-500">
                {data.market_structure.institutional_presence.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* LIQUIDATION CASCADE WARNING - WITH SPECIFIC PRICE LEVELS! */}
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-red-900/30 to-orange-900/30 rounded-lg p-3 border border-red-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm font-bold text-red-400">LIQUIDATION CASCADE WARNING</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Cluster Risk:</span>
                <div className={`font-bold ${
                  data.liquidation_analysis.cluster_risk_score > 70 ? 'text-red-400' :
                  data.liquidation_analysis.cluster_risk_score > 50 ? 'text-orange-400' :
                  data.liquidation_analysis.cluster_risk_score > 30 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {data.liquidation_analysis.cluster_risk_score.toFixed(1)}/100
                </div>
              </div>
              <div>
                <span className="text-gray-400">Cascade Probability:</span>
                <div className="font-bold text-orange-400">
                  {data.liquidation_analysis.cascade_probability}%
                </div>
              </div>
              <div>
                <span className="text-gray-400">Time Estimate:</span>
                <div className="font-bold text-red-300">
                  {data.liquidation_analysis.time_to_cascade_estimate}
                </div>
              </div>
            </div>
          </div>

          {/* SPECIFIC LIQUIDATION PRICE LEVELS */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">Critical Liquidation Levels</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {data.liquidation_analysis.critical_levels.slice(0, 6).map((level, index) => (
                <div 
                  key={index}
                  className={`p-2 rounded border text-xs ${getRiskColor(level.riskLevel)}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold">
                        ${level.priceLevel}
                      </div>
                      <div className="opacity-75">
                        {level.positionType} • {formatNumber(level.liquidationVolume)} SOL
                      </div>
                    </div>
                    <div className={`px-1 py-0.5 rounded text-xs font-bold ${getRiskColor(level.riskLevel)}`}>
                      {level.riskLevel.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Estimated Total Liquidation Volume: {formatNumber(data.liquidation_analysis.estimated_liquidation_volume)} SOL
            </div>
          </div>
        </div>

        {/* Market Structure Analysis */}
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-lg p-3 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">Market Structure Intelligence</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">OI Distribution:</span>
                  <span className="font-semibold text-white">
                    {data.market_structure.oi_distribution.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Market Phase:</span>
                  <span className="font-semibold text-blue-400">
                    {data.market_structure.market_phase.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Risk Level:</span>
                  <span className={`font-semibold ${
                    data.market_structure.risk_level === 'extreme' ? 'text-red-400' :
                    data.market_structure.risk_level === 'high' ? 'text-orange-400' :
                    data.market_structure.risk_level === 'moderate' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {data.market_structure.risk_level.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Institution Presence:</span>
                  <span className="font-semibold text-purple-400">
                    {data.market_structure.institutional_presence.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Context */}
        {historicalOIData?.success && (
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-sm text-gray-400 mb-2">24h Historical Context</div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-gray-400">OI Change (24h):</span>
                <div className={`font-bold ${
                  data.historical_context.oi_change_24h > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {data.historical_context.oi_change_24h > 0 ? '+' : ''}{data.historical_context.oi_change_24h.toFixed(2)}%
                </div>
              </div>
              <div>
                <span className="text-gray-400">Volatility:</span>
                <div className="font-bold text-yellow-400">
                  {data.historical_context.oi_volatility_24h.toFixed(2)}%
                </div>
              </div>
              <div>
                <span className="text-gray-400">Price Correlation:</span>
                <div className={`font-bold ${
                  Math.abs(data.historical_context.price_oi_correlation) > 0.5 ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {data.historical_context.price_oi_correlation.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Intelligence */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-2">Institutional Intelligence Summary</div>
          <div className="text-sm">
            <div className={`font-medium ${
              data.current.openInterestUsd > 1000000000 ? 'text-purple-400' :
              data.current.openInterestUsd > 500000000 ? 'text-orange-400' :
              data.current.openInterestUsd > 200000000 ? 'text-yellow-400' : 'text-blue-400'
            }`}>
              {data.current.openInterestUsd > 1000000000 ? '🏛️ Institutional Dominance' :
               data.current.openInterestUsd > 500000000 ? '🔥 High Institutional Interest' :
               data.current.openInterestUsd > 200000000 ? '📊 Moderate Activity' : '🌊 Light Interest'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Market Efficiency: {data.advanced_metrics.market_efficiency.toFixed(1)}% • 
              Long/Short: {formatPercentage(data.advanced_metrics.long_short_ratio)} • 
              OI Pressure: {data.advanced_metrics.oi_pressure_ratio.toFixed(1)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
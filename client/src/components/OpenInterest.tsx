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

export function OpenInterest() {
  // Get complete SOL data for institutional analytics
  const { data: completeData } = useQuery<{
    success: boolean;
    data: {
      ticker: {
        symbol: string;
        price: string;
        changePercent24h: string;
        volume24h: string;
        high24h: string;
        low24h: string;
      };
    };
  }>({ 
    queryKey: ['/api/sol/complete'], 
    refetchInterval: 5000,
    refetchIntervalInBackground: false
  });

  const { data: oiData, isLoading, error } = useQuery<{
    success: boolean;
    data: OpenInterestData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/open-interest'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/sol/open-interest', {
        signal // AbortController signal for cleanup
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch open interest data`);
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    refetchIntervalInBackground: false, // Stop refetching when tab is not active
    refetchOnWindowFocus: false,
  });

  // Institutional-grade derivatives analytics (moved to top for hook rules)
  const institutionalAnalytics = useMemo(() => {
    if (!completeData?.success || !oiData?.success) return null;
    
    const oiValue = parseFloat(oiData.data.oi);
    const oiUsdValue = parseFloat(oiData.data.oiUsd);
    const currentPrice = parseFloat(completeData.data.ticker.price);
    const volume24h = parseFloat(completeData.data.ticker.volume24h);
    const priceChange24h = parseFloat(completeData.data.ticker.changePercent24h);
    const high24h = parseFloat(completeData.data.ticker.high24h);
    const low24h = parseFloat(completeData.data.ticker.low24h);
    
    // Advanced OI Analytics
    const oiVolumeRatio = oiUsdValue / (volume24h * currentPrice); // OI/Volume ratio
    const oiTurnoverRatio = volume24h / oiValue; // How many times OI turns over per day
    const oiConcentration = oiUsdValue / (currentPrice * 1e6); // OI concentration per $1M market cap
    
    // Price-OI Correlation Analysis
    const priceVolatility = Math.abs((high24h - low24h) / currentPrice);
    const oiEfficiency = oiVolumeRatio > 10 ? 'concentrated' : 
                         oiVolumeRatio > 5 ? 'balanced' : 
                         oiVolumeRatio > 2 ? 'distributed' : 'thin';
    
    // Liquidation Cascade Risk Modeling
    const cascadeRiskScore = Math.min(100, 
      (oiUsdValue / 1e9) * 30 +     // OI size factor
      (priceVolatility * 100) * 20 +  // Volatility factor
      (oiConcentration * 10)           // Concentration factor
    );
    
    const cascadeRisk = cascadeRiskScore > 70 ? 'extreme' :
                       cascadeRiskScore > 50 ? 'high' :
                       cascadeRiskScore > 30 ? 'moderate' : 'low';
    
    // OI Momentum Analysis
    const oiMomentum = priceChange24h > 0 ? 'bullish_expansion' : 'bearish_contraction';
    const oiHealthScore = Math.min(100, (oiTurnoverRatio * 10) + (oiVolumeRatio * 5));
    
    // Market Microstructure Analysis
    const microstructure = oiTurnoverRatio > 0.5 ? 'active_trading' :
                          oiTurnoverRatio > 0.2 ? 'moderate_activity' :
                          oiTurnoverRatio > 0.1 ? 'low_activity' : 'stagnant';
    
    // Derivatives Intelligence Score
    const derivativesIntelligence = {
      liquidationClusterRisk: cascadeRiskScore > 60 ? 'critical' : cascadeRiskScore > 40 ? 'elevated' : 'normal',
      marketEfficiency: oiHealthScore > 60 ? 'efficient' : oiHealthScore > 30 ? 'fair' : 'inefficient',
      institutionalPresence: oiUsdValue > 1e9 ? 'dominant' : oiUsdValue > 5e8 ? 'significant' : 'moderate'
    };
    
    return {
      currentPrice,
      volume24h,
      priceChange24h,
      oiVolumeRatio,
      oiTurnoverRatio,
      oiConcentration,
      priceVolatility,
      oiEfficiency,
      cascadeRiskScore,
      cascadeRisk,
      oiMomentum,
      oiHealthScore,
      microstructure,
      derivativesIntelligence
    };
  }, [completeData, oiData]);

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

  if (error || !oiData?.success) {
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

  // Use analytics data if available, fallback to direct data access
  const oi = oiData.data;
  const oiValue = parseFloat(oi.oi);
  const oiUsdValue = parseFloat(oi.oiUsd);
  
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

        {/* Main OI Metrics */}
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-gray-400">
              <PieChart className="w-4 h-4" />
              <span className="text-sm">Total Open Interest</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatNumber(oiValue)} SOL
            </div>
            <div className="text-lg text-green-400">
              {formatCurrency(oiUsdValue)}
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
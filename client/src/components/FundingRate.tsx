import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Clock, DollarSign, BarChart3, AlertTriangle, Target } from 'lucide-react';
import { useState, useMemo } from 'react';

interface FundingRateData {
  instId: string;
  fundingRate: string;
  nextFundingTime: string;
  fundingTime: string;
  premium: string;
  interestRate: string;
  maxFundingRate: string;
  minFundingRate: string;
  settFundingRate: string;
  settState: 'settled' | 'processing';
  timestamp: string;
}

export function FundingRate() {
  const { data: fundingData, isLoading, error } = useQuery<{
    success: boolean;
    data: FundingRateData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/funding'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/sol/funding', {
        signal // AbortController signal for cleanup
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch funding data`);
      }
      return response.json();
    },
    refetchInterval: false, // Manual refresh only
    refetchIntervalInBackground: false, // Stop refetching when tab is not active
    refetchOnWindowFocus: false,
  });

  // Institutional-grade analytics (moved to top for hook rules)
  const institutionalMetrics = useMemo(() => {
    if (!fundingData?.success) return null;
    
    const fundingRateValue = parseFloat(fundingData.data.fundingRate);
    const premiumValue = parseFloat(fundingData.data.premium);
    const absoluteFundingRate = Math.abs(fundingRateValue);
    const annualizedFundingRate = fundingRateValue * 8760;
    const premiumBasisPoints = Math.abs(premiumValue) * 10000;
    
    // Funding regime classification
    const regimeClassification = absoluteFundingRate > 0.0005 ? 'extreme' :
                                absoluteFundingRate > 0.0001 ? 'elevated' :
                                absoluteFundingRate > 0.00005 ? 'normal' : 'compressed';
    
    // Basis trading opportunity score
    const basisTradingScore = Math.min(100, (premiumBasisPoints / 100) * 20);
    
    // Funding squeeze indicator
    const isSqueeze = absoluteFundingRate > 0.0003 && Math.abs(premiumValue) > 0.002;
    
    // Contango/Backwardation classification
    const marketStructure = premiumValue > 0.001 ? 'steep_contango' :
                           premiumValue > 0.0002 ? 'contango' :
                           premiumValue > -0.0002 ? 'neutral' :
                           premiumValue > -0.001 ? 'backwardation' : 'steep_backwardation';
    
    // Liquidation risk from funding pressure
    const liquidationPressure = absoluteFundingRate > 0.0004 ? 'critical' :
                                absoluteFundingRate > 0.0002 ? 'elevated' :
                                absoluteFundingRate > 0.0001 ? 'moderate' : 'low';
    
    return {
      fundingRateValue,
      premiumValue,
      absoluteFundingRate,
      annualizedFundingRate,
      premiumBasisPoints,
      regimeClassification,
      basisTradingScore,
      isSqueeze,
      marketStructure,
      liquidationPressure
    };
  }, [fundingData]);

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Funding Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !fundingData?.success) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Funding Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load funding rate data</p>
        </CardContent>
      </Card>
    );
  }

  // Use institutional metrics data if available, fallback to direct data access
  const funding = fundingData.data;
  const fundingRateValue = institutionalMetrics?.fundingRateValue ?? parseFloat(funding.fundingRate);
  const premiumValue = institutionalMetrics?.premiumValue ?? parseFloat(funding.premium);
  const interestRateValue = parseFloat(funding.interestRate);
  
  // Convert to percentage and annualized rate
  const fundingRatePercent = (fundingRateValue * 100).toFixed(6);
  const annualizedRate = (fundingRateValue * 8760 * 100).toFixed(3); // 8760 = hours in year
  
  // Format next funding time
  const nextFundingDate = new Date(parseInt(funding.nextFundingTime));
  const timeUntilNext = nextFundingDate.getTime() - Date.now();
  const hoursUntil = Math.floor(timeUntilNext / (1000 * 60 * 60));
  const minutesUntil = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));

  const isFundingPositive = fundingRateValue > 0;
  const isPremiumPositive = premiumValue > 0;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Funding Rate Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Funding Rate */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Current Rate</span>
              {isFundingPositive ? (
                <TrendingUp className="w-4 h-4 text-red-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-green-400" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${isFundingPositive ? 'text-red-400' : 'text-green-400'}`}>
                {isFundingPositive ? '+' : ''}{fundingRatePercent}%
              </span>
              <span className="text-gray-400 text-sm">per 8h</span>
            </div>
            <div className="text-xs text-gray-500">
              Annualized: {isFundingPositive ? '+' : ''}{annualizedRate}%
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Premium</span>
            <div className={`text-xl font-semibold ${isPremiumPositive ? 'text-red-400' : 'text-green-400'}`}>
              {isPremiumPositive ? '+' : ''}{(premiumValue * 100).toFixed(4)}%
            </div>
            <div className="text-xs text-gray-500">
              Mark vs Index
            </div>
          </div>
        </div>

        {/* Funding Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Settlement Status</span>
            <Badge 
              variant={funding.settState === 'settled' ? 'default' : 'secondary'}
              className={funding.settState === 'settled' ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}
            >
              {funding.settState.toUpperCase()}
            </Badge>
          </div>

          <div className="space-y-2">
            <span className="text-gray-400 text-sm">Interest Rate</span>
            <div className="text-lg font-semibold text-blue-400">
              {(interestRateValue * 100).toFixed(4)}%
            </div>
          </div>
        </div>

        {/* Next Funding Timer */}
        <div className="bg-gray-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Next Funding</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-white">
              {hoursUntil > 0 ? `${hoursUntil}h ` : ''}{minutesUntil}m
            </div>
            <div className="text-sm text-gray-400">
              {nextFundingDate.toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Rate Limits */}
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <span className="text-red-400">Max: {(parseFloat(funding.maxFundingRate) * 100).toFixed(1)}%</span>
          </div>
          <div>
            <span className="text-green-400">Min: {(parseFloat(funding.minFundingRate) * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Institutional Analysis */}
        <div className="space-y-3">
          {/* Market Structure Analysis */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2">Market Structure & Derivatives Intelligence</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400">Structure:</span>
                <div className={`font-semibold ${
                  institutionalMetrics.marketStructure.includes('steep') ? 'text-orange-400' :
                  institutionalMetrics.marketStructure.includes('contango') ? 'text-red-400' :
                  institutionalMetrics.marketStructure === 'neutral' ? 'text-gray-300' : 'text-green-400'
                }`}>
                  {institutionalMetrics.marketStructure.toUpperCase()}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Regime:</span>
                <div className={`font-semibold ${
                  institutionalMetrics.regimeClassification === 'extreme' ? 'text-red-400' :
                  institutionalMetrics.regimeClassification === 'elevated' ? 'text-orange-400' :
                  institutionalMetrics.regimeClassification === 'normal' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {institutionalMetrics.regimeClassification.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Risk Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-3 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-purple-400 font-medium">Basis Trading Score</span>
              </div>
              <div className="text-lg font-bold text-white">
                {institutionalMetrics.basisTradingScore.toFixed(1)}/100
              </div>
              <div className="text-xs text-purple-300">
                {institutionalMetrics.basisTradingScore > 60 ? 'Strong Opportunity' :
                 institutionalMetrics.basisTradingScore > 30 ? 'Moderate Edge' : 'Limited Edge'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 rounded-lg p-3 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-orange-400 font-medium">Liquidation Pressure</span>
              </div>
              <div className={`text-lg font-bold ${
                institutionalMetrics.liquidationPressure === 'critical' ? 'text-red-400' :
                institutionalMetrics.liquidationPressure === 'elevated' ? 'text-orange-400' :
                institutionalMetrics.liquidationPressure === 'moderate' ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {institutionalMetrics.liquidationPressure.toUpperCase()}
              </div>
              <div className="text-xs text-orange-300">
                Funding-induced liquidations
              </div>
            </div>
          </div>

          {/* Funding Squeeze Alert */}
          {institutionalMetrics.isSqueeze && (
            <div className="bg-gradient-to-r from-red-900/40 to-orange-900/40 rounded-lg p-3 border-2 border-red-500/50">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="text-sm font-bold text-red-400">FUNDING SQUEEZE DETECTED</span>
              </div>
              <div className="text-xs text-red-300">
                High funding rate + significant premium = potential liquidation cascade risk
              </div>
            </div>
          )}

          {/* Professional Trading Intelligence */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-2">Institutional Intelligence</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Premium (bps):</span>
                <span className="text-white font-mono">{institutionalMetrics.premiumBasisPoints.toFixed(1)} bps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Annualized APY:</span>
                <span className={`font-mono ${institutionalMetrics.annualizedFundingRate > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {(institutionalMetrics.annualizedFundingRate * 100).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Carry Trade Alpha:</span>
                <span className={`font-semibold ${
                  Math.abs(institutionalMetrics.annualizedFundingRate) > 0.50 ? 'text-orange-400' :
                  Math.abs(institutionalMetrics.annualizedFundingRate) > 0.20 ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {Math.abs(institutionalMetrics.annualizedFundingRate) > 0.50 ? 'HIGH' :
                   Math.abs(institutionalMetrics.annualizedFundingRate) > 0.20 ? 'MODERATE' : 'LOW'}
                </span>
              </div>
            </div>
          </div>

          {/* Enhanced Market Sentiment */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Enhanced Market Sentiment</div>
            <div className="text-sm">
              {isFundingPositive ? (
                <span className="text-red-400">
                  📈 Longs pay shorts ({institutionalMetrics.regimeClassification} regime) - {institutionalMetrics.isSqueeze ? 'SQUEEZE RISK' : 'Bullish dominance'}
                </span>
              ) : (
                <span className="text-green-400">
                  📉 Shorts pay longs ({institutionalMetrics.regimeClassification} regime) - {institutionalMetrics.isSqueeze ? 'SQUEEZE RISK' : 'Bearish dominance'}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
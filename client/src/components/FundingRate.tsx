import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react';

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
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: false, // Stop refetching when tab is not active
    refetchOnWindowFocus: false,
  });

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

  const funding = fundingData.data;
  const fundingRateValue = parseFloat(funding.fundingRate);
  const premiumValue = parseFloat(funding.premium);
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

        {/* Interpretation */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Market Sentiment</div>
          <div className="text-sm">
            {isFundingPositive ? (
              <span className="text-red-400">
                📈 Longs pay shorts - Bullish sentiment dominates
              </span>
            ) : (
              <span className="text-green-400">
                📉 Shorts pay longs - Bearish sentiment dominates
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
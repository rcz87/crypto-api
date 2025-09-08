import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Target, TrendingUp, TrendingDown, Volume2, Users, Brain, DollarSign, Activity, Layers, Shield, AlertTriangle, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { useMemo } from 'react';

interface VolumeNode {
  price: string;
  volume: string;
  percentage: string;
}

interface VolumeProfileData {
  poc: string; // Point of Control
  hvnLevels: VolumeNode[]; // High Volume Nodes
  lvnLevels: VolumeNode[]; // Low Volume Nodes
  totalVolume: string;
  valueArea: {
    high: string;
    low: string;
    percentage: string;
  };
  profileRange: {
    high: string;
    low: string;
    timeframe: string;
  };
  lastUpdate: string;
}

export function EnhancedVolumeProfile() {
  // Get complete SOL data for institutional analytics
  const { data: completeData } = useQuery<{
    success: boolean;
    data: {
      ticker: {
        symbol: string;
        price: string;
        changePercent24h: string;
        volume24h: string;
        volume: string;
        high24h: string;
        low24h: string;
        tradingVolume24h: string;
      };
    };
  }>({
    queryKey: ['/api/sol/complete'],
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: false
  });

  const { data: vpData, isLoading, error } = useQuery<{
    success: boolean;
    data: VolumeProfileData;
    timestamp: string;
  }>({
    queryKey: ['/api/sol/volume-profile'],
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: false,
  });

  // Historical volume data for 24h change calculation
  const { data: historicalVolumeData } = useQuery<{
    success: boolean;
    data: {
      volume24hAgo: number;
      volumeChange24h: number;
      volumeChangePercentage: number;
    };
  }>({
    queryKey: ['/api/sol/volume-history'],
    refetchInterval: 60000, // Refresh every minute
    refetchIntervalInBackground: false,
  });

  // Institutional-grade market microstructure analytics
  const institutionalAnalytics = useMemo(() => {
    if (!completeData?.success || !vpData?.success) return null;
    
    const vp = vpData.data;
    const currentPrice = parseFloat(completeData.data.ticker.price);
    const volume24h = parseFloat(completeData.data.ticker.volume || completeData.data.ticker.volume24h);
    const priceChange24h = parseFloat(completeData.data.ticker.changePercent24h);
    const poc = parseFloat(vp.poc);
    const totalVolumeProfile = parseFloat(vp.totalVolume);
    const valueAreaHigh = parseFloat(vp.valueArea.high);
    const valueAreaLow = parseFloat(vp.valueArea.low);
    
    // Advanced Volume Distribution Analysis
    const pocDeviation = Math.abs((currentPrice - poc) / poc) * 100; // POC deviation %
    const valueAreaPosition = currentPrice >= valueAreaLow && currentPrice <= valueAreaHigh;
    const valueAreaDeviation = !valueAreaPosition ? 
      (currentPrice > valueAreaHigh ? ((currentPrice - valueAreaHigh) / valueAreaHigh) * 100 :
       ((valueAreaLow - currentPrice) / valueAreaLow) * 100) : 0;
    
    // Liquidity Clustering Analysis
    const hvnConcentration = vp.hvnLevels.reduce((acc, node) => acc + parseFloat(node.volume), 0) / totalVolumeProfile;
    const lvnConcentration = vp.lvnLevels.reduce((acc, node) => acc + parseFloat(node.volume), 0) / totalVolumeProfile;
    const liquidityRatio = hvnConcentration / (lvnConcentration + 0.001); // Avoid division by zero
    
    // Price Acceptance Zones Classification
    const priceAcceptanceZone = valueAreaPosition ? 'accepted' :
                                currentPrice > valueAreaHigh ? 'above_value' :
                                'below_value';
    
    // Market Microstructure Metrics
    const microstructureHealth = liquidityRatio > 10 ? 'concentrated' :
                                 liquidityRatio > 5 ? 'clustered' :
                                 liquidityRatio > 2 ? 'distributed' : 'fragmented';
    
    // Institution Footprint Detection
    const largeBlockThreshold = totalVolumeProfile * 0.05; // 5% threshold for institutional size
    const institutionalNodes = vp.hvnLevels.filter(node => parseFloat(node.volume) > largeBlockThreshold);
    const institutionalFootprint = institutionalNodes.length > 3 ? 'dominant' :
                                  institutionalNodes.length > 1 ? 'present' : 'minimal';
    
    // Volume-Weighted Analytics
    const vwapProximity = Math.abs((currentPrice - poc) / poc) * 100; // VWAP/POC proximity
    const volumeEfficiency = totalVolumeProfile / (volume24h * 0.01); // What % of 24h volume is in profile
    
    // Professional Trading Metrics
    const supportResistanceStrength = hvnConcentration > 0.3 ? 'strong' :
                                     hvnConcentration > 0.2 ? 'moderate' :
                                     hvnConcentration > 0.1 ? 'weak' : 'minimal';
    
    const liquidityGaps = vp.lvnLevels.length > 5 ? 'fragmented' :
                         vp.lvnLevels.length > 3 ? 'moderate' : 'concentrated';
    
    // Algorithmic Trading Impact Score
    const algoTradingImpact = liquidityRatio > 15 ? 'high_frequency' :
                             liquidityRatio > 8 ? 'moderate_algo' :
                             liquidityRatio > 3 ? 'mixed_flow' : 'retail_dominated';
    
    // Structure Integrity Assessment
    const structureIntegrity = pocDeviation < 2 && valueAreaPosition ? 'intact' :
                              pocDeviation < 5 || valueAreaDeviation < 10 ? 'stressed' : 'broken';

    // Generate actionable insights
    const actionableInsights = generateActionableInsights({
      priceAcceptanceZone,
      microstructureHealth, 
      structureIntegrity,
      liquidityGaps,
      pocDeviation,
      valueAreaDeviation,
      currentPrice,
      poc,
      valueAreaHigh,
      valueAreaLow,
      institutionalFootprint,
      supportResistanceStrength,
    });
    
    return {
      currentPrice,
      volume24h,
      priceChange24h,
      pocDeviation,
      valueAreaPosition,
      valueAreaDeviation,
      hvnConcentration,
      lvnConcentration,
      liquidityRatio,
      priceAcceptanceZone,
      microstructureHealth,
      institutionalFootprint,
      vwapProximity,
      volumeEfficiency,
      supportResistanceStrength,
      liquidityGaps,
      algoTradingImpact,
      structureIntegrity,
      actionableInsights,
      largeBlockThreshold,
      institutionalNodes
    };
  }, [completeData, vpData]);

  // Format numbers and colors
  const formatNumber = (num: string | number): string => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(2);
  };

  const formatPrice = (price: string | number): string => {
    const p = typeof price === 'string' ? parseFloat(price) : price;
    return '$' + p.toFixed(2);
  };
  
  const formatPercentage = (value: number): string => {
    return Math.abs(value) < 0.01 ? '< 0.01%' : `${value.toFixed(2)}%`;
  };
  
  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      // Price acceptance zones
      'accepted': 'text-green-400',
      'above_value': 'text-orange-400', 
      'below_value': 'text-red-400',
      // Market structure
      'concentrated': 'text-green-400',
      'clustered': 'text-blue-400',
      'distributed': 'text-yellow-400',
      'fragmented': 'text-red-400',
      // Institution footprint
      'dominant': 'text-purple-400',
      'present': 'text-blue-400',
      'minimal': 'text-gray-400',
      // Support/resistance
      'strong': 'text-green-400',
      'moderate': 'text-yellow-400', 
      'weak': 'text-orange-400',
      // Algo trading
      'high_frequency': 'text-cyan-400',
      'moderate_algo': 'text-blue-400',
      'mixed_flow': 'text-yellow-400',
      'retail_dominated': 'text-orange-400',
      // Structure integrity
      'intact': 'text-green-400',
      'stressed': 'text-yellow-400',
      'broken': 'text-red-400'
    };
    return colorMap[status] || 'text-gray-400';
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Enhanced Volume Profile Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-700 rounded w-3/4"></div>
            <div className="h-20 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !vpData?.success || !institutionalAnalytics) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Enhanced Volume Profile Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load volume profile data</p>
        </CardContent>
      </Card>
    );
  }

  const vp = vpData.data;
  const analytics = institutionalAnalytics;
  
  // Create volume profile visualization data
  const maxVolume = Math.max(...vp.hvnLevels.map(node => parseFloat(node.volume)));
  const minVolume = Math.min(...vp.lvnLevels.map(node => parseFloat(node.volume)));

  const getVolumeBarWidth = (volume: string): number => {
    const vol = parseFloat(volume);
    return Math.max(10, (vol / maxVolume) * 100);
  };

  const getVolumeIntensity = (volume: string): string => {
    const vol = parseFloat(volume);
    const intensity = vol / maxVolume;
    if (intensity > 0.8) return 'text-red-400 bg-red-400/20';
    if (intensity > 0.6) return 'text-orange-400 bg-orange-400/20';
    if (intensity > 0.4) return 'text-yellow-400 bg-yellow-400/20';
    if (intensity > 0.2) return 'text-blue-400 bg-blue-400/20';
    return 'text-gray-400 bg-gray-400/20';
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Enhanced Volume Profile Intelligence
          <Badge variant="outline" className="ml-auto text-xs text-purple-400 border-purple-400">
            Institutional Grade
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Volume Change 24h - NEW FEATURE */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-blue-400" />
              <span className="text-white font-semibold">Volume Intelligence</span>
            </div>
            {historicalVolumeData?.success && (
              <div className={`flex items-center gap-1 ${
                historicalVolumeData.data.volumeChangePercentage > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {historicalVolumeData.data.volumeChangePercentage > 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                <span className="font-bold">
                  {historicalVolumeData.data.volumeChangePercentage > 0 ? '+' : ''}{historicalVolumeData.data.volumeChangePercentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-400">Current Volume</div>
              <div className="text-xl font-bold text-green-400">
                {formatNumber(vp.totalVolume)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">24h Volume</div>
              <div className="text-xl font-bold text-blue-400">
                {formatNumber(completeData?.data.ticker.volume || completeData?.data.ticker.volume24h || '0')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Volume Status</div>
              <div className={`text-lg font-bold ${
                (historicalVolumeData?.data.volumeChangePercentage || 0) > 35 ? 'text-purple-400' :
                (historicalVolumeData?.data.volumeChangePercentage || 0) > 15 ? 'text-green-400' :
                (historicalVolumeData?.data.volumeChangePercentage || 0) > 0 ? 'text-blue-400' : 'text-red-400'
              }`}>
                {(historicalVolumeData?.data.volumeChangePercentage || 0) > 35 ? 'SURGE' :
                 (historicalVolumeData?.data.volumeChangePercentage || 0) > 15 ? 'HIGH' :
                 (historicalVolumeData?.data.volumeChangePercentage || 0) > 0 ? 'NORMAL' : 'LOW'}
              </div>
            </div>
          </div>
        </div>

        {/* ACTIONABLE INSIGHTS - NEW FEATURE */}
        <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-lg p-4 border border-orange-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-orange-400" />
            <span className="text-white font-semibold">Actionable Trading Insights</span>
          </div>
          
          <div className="space-y-3">
            {analytics.actionableInsights.map((insight, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                insight.type === 'warning' ? 'bg-red-900/20 border-red-500/30' :
                insight.type === 'opportunity' ? 'bg-green-900/20 border-green-500/30' :
                'bg-blue-900/20 border-blue-500/30'
              }`}>
                <div className="flex items-start gap-2">
                  {insight.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" /> :
                   insight.type === 'opportunity' ? <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" /> :
                   <Activity className="w-4 h-4 text-blue-400 mt-0.5" />}
                  <div>
                    <div className={`font-semibold text-sm ${
                      insight.type === 'warning' ? 'text-red-400' :
                      insight.type === 'opportunity' ? 'text-green-400' :
                      'text-blue-400'
                    }`}>
                      {insight.title}
                    </div>
                    <div className="text-gray-300 text-xs mt-1">
                      {insight.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Microstructure Overview */}
        <div className="bg-gradient-to-r from-gray-800/90 to-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="text-white font-semibold">Market Microstructure Intelligence</span>
            </div>
            <Badge variant="outline" className={`${getStatusColor(analytics.structureIntegrity)} border-current`}>
              {analytics.structureIntegrity.toUpperCase()}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-gray-400">POC Deviation</div>
              <div className="text-white font-mono text-sm">
                {formatPercentage(analytics.pocDeviation)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Liquidity Ratio</div>
              <div className="text-white font-mono text-sm">
                {analytics.liquidityRatio.toFixed(2)}x
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-gray-400">Volume Efficiency</div>
              <div className="text-white font-mono text-sm">
                {formatPercentage(analytics.volumeEfficiency)}
              </div>
            </div>
          </div>
        </div>

        {/* POC and Summary with Enhanced Visual */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-gray-400">
              <Target className="w-4 h-4" />
              <span className="text-sm">Point of Control</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {formatPrice(vp.poc)}
            </div>
            <div className="text-xs text-gray-500">
              VWAP Proximity: {formatPercentage(analytics.vwapProximity)}
            </div>
            <div className={`text-xs font-semibold ${getStatusColor(analytics.priceAcceptanceZone)}`}>
              Status: {analytics.priceAcceptanceZone.replace('_', ' ').toUpperCase()}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-gray-400">
              <Volume2 className="w-4 h-4" />
              <span className="text-sm">Total Volume</span>
            </div>
            <div className="text-2xl font-bold text-green-400">
              {formatNumber(vp.totalVolume)}
            </div>
            <div className="text-xs text-gray-500">
              {vp.profileRange.timeframe} timeframe
            </div>
            <div className={`text-xs font-semibold ${getStatusColor(analytics.microstructureHealth)}`}>
              Structure: {analytics.microstructureHealth.toUpperCase()}
            </div>
          </div>
        </div>

        {/* ENHANCED VOLUME PROFILE VISUALIZATION */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-blue-400" />
            <span className="text-white font-semibold text-sm">Volume Profile Distribution</span>
          </div>
          
          {/* Combined HVN and LVN Display with Side-by-Side Volume Bars */}
          <div className="grid grid-cols-1 gap-3">
            
            {/* High Volume Nodes - Enhanced Visual */}
            <div>
              <div className="text-xs text-green-400 mb-2 font-semibold">🟢 High Volume Nodes (HVN)</div>
              <div className="space-y-1">
                {vp.hvnLevels.slice(0, 5).map((node, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-mono">{formatPrice(node.price)}</span>
                        <span className="text-green-400">{formatNumber(node.volume)}</span>
                      </div>
                      {/* Volume Bar Visualization */}
                      <div className="mt-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${getVolumeIntensity(node.volume)} bg-gradient-to-r from-green-400 to-green-600`}
                          style={{ width: `${getVolumeBarWidth(node.volume)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* POC Highlight */}
            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-2">
              <div className="text-xs text-yellow-400 mb-1 font-semibold">🎯 POINT OF CONTROL</div>
              <div className="flex items-center justify-between">
                <span className="text-yellow-400 font-mono font-bold">{formatPrice(vp.poc)}</span>
                <span className="text-yellow-300">MAX VOLUME</span>
              </div>
            </div>

            {/* Low Volume Nodes - Enhanced Visual */}
            <div>
              <div className="text-xs text-red-400 mb-2 font-semibold">🔴 Low Volume Nodes (LVN)</div>
              <div className="space-y-1">
                {vp.lvnLevels.slice(0, 4).map((node, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-mono">{formatPrice(node.price)}</span>
                        <span className="text-red-400">{formatNumber(node.volume)}</span>
                      </div>
                      {/* Volume Bar Visualization */}
                      <div className="mt-1 bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-600"
                          style={{ width: `${Math.max(5, (parseFloat(node.volume) / maxVolume) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Value Area Display */}
            <div className="bg-blue-400/10 border border-blue-400/30 rounded-lg p-2">
              <div className="text-xs text-blue-400 mb-1 font-semibold">📊 VALUE AREA ({vp.valueArea.percentage})</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">High: </span>
                  <span className="text-blue-300 font-mono">{formatPrice(vp.valueArea.high)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Low: </span>
                  <span className="text-blue-300 font-mono">{formatPrice(vp.valueArea.low)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Institutional Footprint Analysis */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-white font-semibold text-sm">Institutional Footprint Detection</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Institution Presence:</span>
                <Badge variant="outline" className={`${getStatusColor(analytics.institutionalFootprint)} border-current text-xs`}>
                  {analytics.institutionalFootprint.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Support/Resistance:</span>
                <Badge variant="outline" className={`${getStatusColor(analytics.supportResistanceStrength)} border-current text-xs`}>
                  {analytics.supportResistanceStrength.toUpperCase()}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Algo Impact:</span>
                <Badge variant="outline" className={`${getStatusColor(analytics.algoTradingImpact)} border-current text-xs`}>
                  {analytics.algoTradingImpact.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Liquidity Gaps:</span>
                <Badge variant="outline" className={`${getStatusColor(analytics.liquidityGaps)} border-current text-xs`}>
                  {analytics.liquidityGaps.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          {/* Institutional Nodes Display */}
          {analytics.institutionalNodes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-xs text-purple-400 mb-2">🏦 Large Block Detection ({analytics.institutionalNodes.length} nodes)</div>
              <div className="grid grid-cols-2 gap-2">
                {analytics.institutionalNodes.slice(0, 4).map((node, index) => (
                  <div key={index} className="bg-purple-900/20 rounded p-2">
                    <div className="text-xs text-white font-mono">{formatPrice(node.price)}</div>
                    <div className="text-xs text-purple-300">{formatNumber(node.volume)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Summary Intelligence */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-2">Volume Profile Summary</div>
          <div className="text-sm">
            <div className={`font-medium ${
              analytics.structureIntegrity === 'intact' ? 'text-green-400' :
              analytics.structureIntegrity === 'stressed' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {analytics.structureIntegrity === 'intact' ? '✅ Structure Intact - Price Accepted in Value Area' :
               analytics.structureIntegrity === 'stressed' ? '⚠️ Structure Under Stress - Monitor for Breakout' :
               '🚨 Structure Broken - High Volatility Expected'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              POC: {formatPrice(vp.poc)} • Structure: {analytics.microstructureHealth} • 
              Institution: {analytics.institutionalFootprint} • 
              Efficiency: {formatPercentage(analytics.volumeEfficiency)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to generate actionable insights
function generateActionableInsights(params: {
  priceAcceptanceZone: string;
  microstructureHealth: string;
  structureIntegrity: string;
  liquidityGaps: string;
  pocDeviation: number;
  valueAreaDeviation: number;
  currentPrice: number;
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  institutionalFootprint: string;
  supportResistanceStrength: string;
}) {
  const insights = [];

  // Price outside value area warnings
  if (params.priceAcceptanceZone === 'above_value') {
    insights.push({
      type: 'warning' as const,
      title: 'Price Above Value Area',
      description: `Waspada! Harga berada ${((params.currentPrice - params.valueAreaHigh) / params.valueAreaHigh * 100).toFixed(1)}% di atas value area. Risiko tinggi untuk retrace kembali ke POC $${params.poc.toFixed(2)}.`
    });
  }

  if (params.priceAcceptanceZone === 'below_value') {
    insights.push({
      type: 'warning' as const,
      title: 'Price Below Value Area',
      description: `Peringatan! Harga berada ${((params.valueAreaLow - params.currentPrice) / params.valueAreaLow * 100).toFixed(1)}% di bawah value area. Potensi bounce kembali ke POC $${params.poc.toFixed(2)}.`
    });
  }

  // Structure stress warnings
  if (params.structureIntegrity === 'stressed' && params.priceAcceptanceZone !== 'accepted') {
    insights.push({
      type: 'warning' as const,
      title: 'Market Structure Under Stress',
      description: 'Kondisi pasar tidak stabil dengan harga di luar area nilai. Antisipasi pergerakan volatil dan gunakan tight stop-loss.'
    });
  }

  // Liquidity gap opportunities
  if (params.liquidityGaps === 'fragmented' || params.liquidityGaps === 'moderate') {
    insights.push({
      type: 'opportunity' as const,
      title: 'Liquidity Gap Opportunities',
      description: 'Terdapat gap likuiditas (LVN). Harga cenderung bergerak cepat melewati area ini. Manfaatkan untuk breakout trading atau scalping.'
    });
  }

  // POC proximity insights
  if (params.pocDeviation < 1) {
    insights.push({
      type: 'info' as const,
      title: 'Near Point of Control',
      description: `Harga sangat dekat dengan POC ($${params.poc.toFixed(2)}). Area ini adalah magnet harga yang kuat - expect konsolidasi atau reversal.`
    });
  }

  // Institutional presence insights
  if (params.institutionalFootprint === 'dominant') {
    insights.push({
      type: 'info' as const,
      title: 'Strong Institutional Activity',
      description: 'Aktivitas institusi dominan terdeteksi. Follow smart money flow dan perhatikan large block trading untuk konfirmasi arah trend.'
    });
  }

  // Support/resistance strength
  if (params.supportResistanceStrength === 'strong') {
    insights.push({
      type: 'opportunity' as const,
      title: 'Strong Support/Resistance Levels',
      description: 'Level support/resistance sangat kuat berdasarkan volume profile. Ideal untuk range trading atau breakout confirmation.'
    });
  }

  return insights;
}
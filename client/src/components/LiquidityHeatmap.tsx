import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Zap, Shield, AlertTriangle, Eye, RefreshCw, CheckCircle, XCircle, Bell } from 'lucide-react';
import { useSymbol } from '@/contexts/SymbolContext';

interface HeatmapBucket {
  priceLevel: number;
  volume: number;
  intensity: number;
  distance: number;
}

interface LiquidityLevel {
  price: number;
  volume: number;
  significance: 'strong' | 'moderate';
}

interface HeatmapData {
  buckets: HeatmapBucket[];
  highLiquidityZones: number;
  lowLiquidityZones: number;
  liquidityGaps: number;
  strongSupportLevels: LiquidityLevel[];
  strongResistanceLevels: LiquidityLevel[];
}

interface WhaleDetection {
  whaleOrderCount: number;
  whaleVolumeRatio: number;
  whaleThreshold: number;
  whaleBidCount: number;
  whaleAskCount: number;
  dominantSide: 'bid' | 'ask';
  whaleImpact: 'high' | 'medium' | 'low';
  largestOrder: number;
}

interface SmartMoneyFlow {
  smartBidCount: number;
  smartAskCount: number;
  smartBidVolume: number;
  smartAskVolume: number;
  netSmartFlow: number;
  flowDirection: 'bullish' | 'bearish' | 'neutral';
  avgSmartBidPrice: number;
  avgSmartAskPrice: number;
  smartMoneyRatio: number;
  accumulationSignal: boolean;
  distributionSignal: boolean;
  marketSentiment: 'accumulation' | 'distribution' | 'consolidation';
}

interface InstitutionalData {
  whaleDetection: WhaleDetection | null;
  smartMoneyFlow: SmartMoneyFlow | null;
  liquidityHeatmap: HeatmapData | null;
  microstructureAnalysis: any | null;
}

interface PremiumAnalytics {
  analyticsLevel: string;
  features: string[];
  institutionalFeatures: InstitutionalData;
  lastUpdate: string;
}

interface PriceLevelNotification {
  id: string;
  type: 'level_touch' | 'bounce_confirmation' | 'rejection_confirmation';
  level: LiquidityLevel;
  levelType: 'support' | 'resistance';
  message: string;
  timestamp: number;
  status: 'active' | 'confirmed' | 'failed';
  priceAtTouch: number;
  currentPrice: number;
}

const LiquidityHeatmap = React.memo(() => {
  const [data, setData] = useState<PremiumAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(207.0);
  const [refreshing, setRefreshing] = useState(false);
  const { symbol } = useSymbol();
  
  // Format symbol for API (remove USDT suffix and convert to lowercase)
  const selectedPair = symbol.replace('USDT', '').toLowerCase();
  
  // Enhanced: Interactive Notifications State
  const [notifications, setNotifications] = useState<PriceLevelNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(true);
  const [lastPriceCheckTime, setLastPriceCheckTime] = useState<number>(Date.now());
  const previousPriceRef = useRef<number>(207.0);
  const priceHistoryRef = useRef<{ price: number; timestamp: number }[]>([]);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchHeatmapData = useCallback(async () => {
    try {
      setRefreshing(true);
      // Only show loading on first load
      if (!data) setLoading(true);
      
      const response = await fetch('/api/premium/institutional-analytics');
      
      if (!response.ok) {
        if (response.status === 403) {
          setError('VIP8+ subscription required for advanced analytics');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  const fetchCurrentPrice = useCallback(async () => {
    try {
      const response = await fetch(`/api/${selectedPair}/complete`);
      const result = await response.json();
      if (result.success && result.data?.ticker?.last) {
        const newPrice = parseFloat(result.data.ticker.last);
        const oldPrice = previousPriceRef.current;
        
        // Update price history
        priceHistoryRef.current.push({ price: newPrice, timestamp: Date.now() });
        // Keep only last 10 price points
        if (priceHistoryRef.current.length > 10) {
          priceHistoryRef.current.shift();
        }
        
        setCurrentPrice(newPrice);
        previousPriceRef.current = newPrice;
        
        // Enhanced: Check for level interactions
        if (data?.institutionalFeatures?.liquidityHeatmap) {
          checkLevelInteractions(oldPrice, newPrice);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch current price:', err);
    }
  }, [data, selectedPair]);

  useEffect(() => {
    // Only fetch once on mount, no auto-refresh
    fetchHeatmapData();
    fetchCurrentPrice();
    
    // Enhanced: Set up price monitoring for notifications
    const priceMonitorInterval = setInterval(() => {
      fetchCurrentPrice();
    }, 3000); // Check price every 3 seconds
    
    return () => {
      clearInterval(priceMonitorInterval);
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [fetchCurrentPrice]);

  const getIntensityColor = (intensity: number): string => {
    if (intensity > 4) return 'from-red-600 to-red-400'; // Very hot
    if (intensity > 3) return 'from-orange-600 to-orange-400'; // Hot
    if (intensity > 2) return 'from-yellow-600 to-yellow-400'; // Warm
    if (intensity > 1) return 'from-blue-600 to-blue-400'; // Cool
    return 'from-gray-600 to-gray-400'; // Cold
  };

  const getIntensityLabel = (intensity: number): string => {
    if (intensity > 4) return '🔥 Very Hot';
    if (intensity > 3) return '🟠 Hot';
    if (intensity > 2) return '🟡 Warm';
    if (intensity > 1) return '🔵 Cool';
    return '⚫ Cold';
  };

  // Enhanced: Interactive Notifications System
  const checkLevelInteractions = useCallback((oldPrice: number, newPrice: number) => {
    if (!data?.institutionalFeatures?.liquidityHeatmap) return;
    
    const heatmapData = data.institutionalFeatures.liquidityHeatmap;
    const allLevels = [
      ...heatmapData.strongSupportLevels.map(level => ({ ...level, type: 'support' as const })),
      ...heatmapData.strongResistanceLevels.map(level => ({ ...level, type: 'resistance' as const }))
    ];
    
    const tolerance = newPrice * 0.003; // 0.3% tolerance for level touch
    
    allLevels.forEach(level => {
      const levelPrice = level.price;
      const wasAbove = oldPrice > levelPrice + tolerance;
      const wasBelowOrAt = oldPrice <= levelPrice + tolerance;
      const isNowAbove = newPrice > levelPrice + tolerance;
      const isNowBelowOrAt = newPrice <= levelPrice + tolerance;
      const isNearLevel = Math.abs(newPrice - levelPrice) <= tolerance;
      
      // Check for level touch (crossing or approaching)
      if (level.type === 'support') {
        // Price approaching or touching support from above
        if (wasAbove && (isNowBelowOrAt || isNearLevel)) {
          createLevelTouchNotification(level, 'support', newPrice);
          
          // Schedule bounce check after a few seconds
          setTimeout(() => {
            checkBounceConfirmation(level, 'support', newPrice);
          }, 8000);
        }
      } else {
        // Price approaching or touching resistance from below  
        if (wasBelowOrAt && (isNowAbove || isNearLevel)) {
          createLevelTouchNotification(level, 'resistance', newPrice);
          
          // Schedule rejection check after a few seconds
          setTimeout(() => {
            checkRejectionConfirmation(level, 'resistance', newPrice);
          }, 8000);
        }
      }
    });
  }, [data]);

  const createLevelTouchNotification = (level: LiquidityLevel, levelType: 'support' | 'resistance', touchPrice: number) => {
    const notification: PriceLevelNotification = {
      id: `${levelType}_${level.price}_${Date.now()}`,
      type: 'level_touch',
      level,
      levelType,
      message: `Price ${touchPrice.toFixed(2)} approaching ${levelType} level at $${level.price.toFixed(2)} (${level.significance})`,
      timestamp: Date.now(),
      status: 'active',
      priceAtTouch: touchPrice,
      currentPrice: touchPrice
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep max 5 notifications
    
    // Auto-remove after 15 seconds if not confirmed
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 15000);
  };

  const checkBounceConfirmation = (level: LiquidityLevel, levelType: 'support', touchPrice: number) => {
    const currentPriceNow = currentPrice;
    const minBounceThreshold = level.price * 1.005; // 0.5% above support
    
    if (currentPriceNow > minBounceThreshold) {
      const bounceNotification: PriceLevelNotification = {
        id: `bounce_${level.price}_${Date.now()}`,
        type: 'bounce_confirmation',
        level,
        levelType,
        message: `✅ Support level at $${level.price.toFixed(2)} successfully held! Price bounced to $${currentPriceNow.toFixed(2)}`,
        timestamp: Date.now(),
        status: 'confirmed',
        priceAtTouch: touchPrice,
        currentPrice: currentPriceNow
      };
      
      setNotifications(prev => [bounceNotification, ...prev.slice(0, 4)]);
      
      // Auto-remove after 12 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== bounceNotification.id));
      }, 12000);
    }
  };

  const checkRejectionConfirmation = (level: LiquidityLevel, levelType: 'resistance', touchPrice: number) => {
    const currentPriceNow = currentPrice;
    const maxRejectionThreshold = level.price * 0.995; // 0.5% below resistance
    
    if (currentPriceNow < maxRejectionThreshold) {
      const rejectionNotification: PriceLevelNotification = {
        id: `rejection_${level.price}_${Date.now()}`,
        type: 'rejection_confirmation',
        level,
        levelType,
        message: `❌ Resistance level at $${level.price.toFixed(2)} rejected price! Down to $${currentPriceNow.toFixed(2)}`,
        timestamp: Date.now(),
        status: 'confirmed',
        priceAtTouch: touchPrice,
        currentPrice: currentPriceNow
      };
      
      setNotifications(prev => [rejectionNotification, ...prev.slice(0, 4)]);
      
      // Auto-remove after 12 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== rejectionNotification.id));
      }, 12000);
    }
  };

  const dismissNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const getWhaleImpactIcon = (impact: string) => {
    switch (impact) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'medium': return <TrendingUp className="h-4 w-4 text-yellow-400" />;
      case 'low': return <Shield className="h-4 w-4 text-green-400" />;
      default: return <Eye className="h-4 w-4 text-gray-400" />;
    }
  };

  const getFlowDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'bullish': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'bearish': return <TrendingDown className="h-4 w-4 text-red-400" />;
      default: return <Zap className="h-4 w-4 text-gray-400" />;
    }
  };

  const renderHeatmapVisual = useMemo(() => {
    if (!data?.institutionalFeatures?.liquidityHeatmap) return null;
    
    const heatmapData = data.institutionalFeatures.liquidityHeatmap;
    const buckets = heatmapData.buckets.slice(0, 21); // Limit to 21 buckets for visualization
    
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Price Levels</span>
          <span>Volume Intensity</span>
        </div>
        {buckets.map((bucket, index) => {
          const isNearCurrentPrice = Math.abs(bucket.priceLevel - currentPrice) < 1.0;
          const relativeIntensity = Math.min(100, (bucket.intensity / 5) * 100);
          
          return (
            <TooltipProvider key={`${bucket.priceLevel}-${index}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={`flex items-center justify-between p-1 rounded transition-all cursor-pointer ${
                      isNearCurrentPrice ? 'ring-2 ring-blue-400 bg-blue-900/20' : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-mono ${
                        bucket.priceLevel > currentPrice ? 'text-red-400' : 'text-green-400'
                      }`}>
                        ${bucket.priceLevel.toFixed(2)}
                      </span>
                      {isNearCurrentPrice && (
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div 
                        className={`h-2 bg-gradient-to-r ${getIntensityColor(bucket.intensity)} rounded-sm`}
                        style={{ width: `${Math.max(10, relativeIntensity)}px` }}
                      />
                      <span className="text-xs text-gray-400 w-8">
                        {bucket.intensity.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <div><strong>Price:</strong> ${bucket.priceLevel.toFixed(2)}</div>
                    <div><strong>Volume:</strong> {bucket.volume.toLocaleString()} SOL</div>
                    <div><strong>Intensity:</strong> {getIntensityLabel(bucket.intensity)}</div>
                    <div><strong>Distance:</strong> {bucket.distance} levels from mid</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  }, [data?.institutionalFeatures?.liquidityHeatmap, currentPrice]);

  const renderSupportResistanceLevels = (supports: LiquidityLevel[], resistances: LiquidityLevel[]) => (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <h4 className="text-sm font-semibold text-green-400 mb-2">🛡️ Support Levels</h4>
        <div className="space-y-1">
          {supports.slice(0, 3).map((level, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className="text-green-400">${level.price.toFixed(2)}</span>
              <span className="text-gray-400">{level.volume.toLocaleString()}</span>
              <Badge variant={level.significance === 'strong' ? 'default' : 'secondary'} className="text-xs">
                {level.significance}
              </Badge>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <h4 className="text-sm font-semibold text-red-400 mb-2">⚔️ Resistance Levels</h4>
        <div className="space-y-1">
          {resistances.slice(0, 3).map((level, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className="text-red-400">${level.price.toFixed(2)}</span>
              <span className="text-gray-400">{level.volume.toLocaleString()}</span>
              <Badge variant={level.significance === 'strong' ? 'default' : 'secondary'} className="text-xs">
                {level.significance}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white flex items-center">
            <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded mr-2 animate-pulse" />
            Liquidity Heatmap
            <Badge className="ml-2 bg-purple-600">VIP8+</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
            <span className="ml-2 text-gray-400">Loading heatmap data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white flex items-center">
            <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded mr-2" />
            Liquidity Heatmap
            <Badge className="ml-2 bg-purple-600">VIP8+</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-2" />
            <p className="text-red-400 mb-2">{error}</p>
            {error.includes('VIP8+') && (
              <p className="text-sm text-gray-400">
                Upgrade to VIP8 or Institutional for advanced liquidity analytics
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const heatmapData = data?.institutionalFeatures?.liquidityHeatmap;
  const whaleData = data?.institutionalFeatures?.whaleDetection;
  const smartMoneyData = data?.institutionalFeatures?.smartMoneyFlow;

  return (
    <div className="space-y-4">
      {/* Enhanced: Interactive Notifications Panel */}
      {showNotifications && notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg border-l-4 backdrop-blur-sm shadow-lg transition-all duration-300 ${
                notification.type === 'bounce_confirmation' 
                  ? 'bg-green-900/80 border-green-400 text-green-100'
                  : notification.type === 'rejection_confirmation'
                  ? 'bg-red-900/80 border-red-400 text-red-100'
                  : notification.levelType === 'support'
                  ? 'bg-blue-900/80 border-blue-400 text-blue-100'
                  : 'bg-orange-900/80 border-orange-400 text-orange-100'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {notification.type === 'bounce_confirmation' ? (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    ) : notification.type === 'rejection_confirmation' ? (
                      <XCircle className="h-4 w-4 text-red-400" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {notification.levelType} {notification.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm leading-tight">{notification.message}</p>
                  <div className="text-xs opacity-75 mt-1">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="ml-2 text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          
          {/* Notification Controls */}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotifications(false)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Hide Notifications
            </Button>
          </div>
        </div>
      )}
      
      {/* Show notifications toggle when hidden */}
      {!showNotifications && (
        <div className="fixed top-4 right-4 z-50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(true)}
            className="bg-gray-800/80 text-gray-300 hover:text-white backdrop-blur-sm"
          >
            <Bell className="h-4 w-4 mr-1" />
            Show Alerts {notifications.length > 0 && `(${notifications.length})`}
          </Button>
        </div>
      )}

      {/* Main Heatmap */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-white flex items-center">
            <div className="w-6 h-6 bg-gradient-to-r from-purple-600 to-blue-600 rounded mr-2" />
            Liquidity Heatmap
            <Badge className="ml-2 bg-purple-600">VIP8+</Badge>
            <div className="ml-auto flex items-center space-x-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  fetchHeatmapData();
                  fetchCurrentPrice();
                }}
                disabled={refreshing}
                className="h-8 px-2 text-gray-400 hover:text-white"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="ml-1">Refresh</span>
              </Button>
              <div className={`w-2 h-2 rounded-full ${
                data ? 'bg-green-400' : 'bg-gray-400'
              }`} />
              <span className="text-gray-400">
                {data ? 'Manual' : 'No data'}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!heatmapData ? (
            <div className="text-center py-8">
              <Eye className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-400 mb-2">Waiting for orderbook data...</p>
              <p className="text-sm text-gray-500">
                Premium heatmap will appear once sufficient market data is cached
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Heatmap Overview */}
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-purple-400">{heatmapData.highLiquidityZones}</div>
                  <div className="text-xs text-gray-400">Hot Zones</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-blue-400">{heatmapData.lowLiquidityZones}</div>
                  <div className="text-xs text-gray-400">Cool Zones</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-red-400">{heatmapData.liquidityGaps}</div>
                  <div className="text-xs text-gray-400">Gaps</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-green-400">${currentPrice.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">Current Price</div>
                </div>
              </div>

              {/* Visual Heatmap - Fixed height to prevent layout shift */}
              <div className="bg-gray-800/50 rounded-lg p-4 h-64 overflow-y-auto">
                {renderHeatmapVisual}
              </div>

              {/* Support/Resistance */}
              {(heatmapData.strongSupportLevels.length > 0 || heatmapData.strongResistanceLevels.length > 0) && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  {renderSupportResistanceLevels(heatmapData.strongSupportLevels, heatmapData.strongResistanceLevels)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Whale Detection & Smart Money - Fixed heights */}
      <div className="grid grid-cols-2 gap-4">
        {/* Whale Detection */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-md font-semibold text-white flex items-center">
              <AlertTriangle className="h-5 w-5 text-orange-400 mr-2" />
              Whale Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="h-32">
            {!whaleData ? (
              <div className="text-center py-8">
                <span className="text-gray-400">No whale data</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Impact Level</span>
                  <div className="flex items-center space-x-1">
                    {getWhaleImpactIcon(whaleData.whaleImpact)}
                    <span className={`text-sm font-semibold ${
                      whaleData.whaleImpact === 'high' ? 'text-red-400' :
                      whaleData.whaleImpact === 'medium' ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {whaleData.whaleImpact.toUpperCase()}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400">Whale Orders</div>
                    <div className="font-semibold text-white">{whaleData.whaleOrderCount}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400">Volume Ratio</div>
                    <div className="font-semibold text-white">{(whaleData.whaleVolumeRatio * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Dominant Side:</span>
                  <span className={`font-semibold ${
                    whaleData.dominantSide === 'bid' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {whaleData.dominantSide.toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Smart Money Flow */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-md font-semibold text-white flex items-center">
              <Zap className="h-5 w-5 text-blue-400 mr-2" />
              Smart Money
            </CardTitle>
          </CardHeader>
          <CardContent className="h-32">
            {!smartMoneyData ? (
              <div className="text-center py-8">
                <span className="text-gray-400">No smart money data</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Flow Direction</span>
                  <div className="flex items-center space-x-1">
                    {getFlowDirectionIcon(smartMoneyData.flowDirection)}
                    <span className={`text-sm font-semibold ${
                      smartMoneyData.flowDirection === 'bullish' ? 'text-green-400' :
                      smartMoneyData.flowDirection === 'bearish' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {smartMoneyData.flowDirection.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400">Smart Bids</div>
                    <div className="font-semibold text-green-400">{smartMoneyData.smartBidCount}</div>
                  </div>
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-gray-400">Smart Asks</div>
                    <div className="font-semibold text-red-400">{smartMoneyData.smartAskCount}</div>
                  </div>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Market Sentiment:</span>
                  <Badge variant={
                    smartMoneyData.marketSentiment === 'accumulation' ? 'default' :
                    smartMoneyData.marketSentiment === 'distribution' ? 'destructive' : 'secondary'
                  } className="text-xs">
                    {smartMoneyData.marketSentiment}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

LiquidityHeatmap.displayName = 'LiquidityHeatmap';

export default LiquidityHeatmap;
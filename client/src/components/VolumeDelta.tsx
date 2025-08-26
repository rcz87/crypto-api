import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface Trade {
  side: 'buy' | 'sell';
  size: number;
  price: number;
  timestamp: number;
}

interface CVDData {
  cvd: number;
  buyVolume: number;
  sellVolume: number;
  netVolume: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  change24h: number;
}

export function VolumeDelta() {
  const [cvdData, setCvdData] = useState<CVDData>({
    cvd: 0,
    buyVolume: 0,
    sellVolume: 0,
    netVolume: 0,
    trend: 'neutral',
    change24h: 0
  });
  
  const [trades, setTrades] = useState<Trade[]>([]);
  const [cvdHistory, setCvdHistory] = useState<number[]>([]);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    try {
      if (lastMessage?.type === 'market_data' && lastMessage.data?.arg?.channel === 'trades') {
        const wsData = lastMessage.data;
        
        if (wsData.data && Array.isArray(wsData.data)) {
          wsData.data.forEach((tradeData: any) => {
            const newTrade: Trade = {
              side: tradeData.side,
              size: parseFloat(tradeData.sz || '0'),
              price: parseFloat(tradeData.px || '0'),
              timestamp: parseInt(tradeData.ts || Date.now().toString())
            };
            
            setTrades(prev => {
              const updated = [newTrade, ...prev].slice(0, 1000); // Keep last 1000 trades
              return updated;
            });
          });
        }
      }
    } catch (error) {
      console.error('Error parsing WebSocket trade data:', error);
    }
  }, [lastMessage]);

  useEffect(() => {
    // Calculate CVD from trades
    if (trades.length > 0) {
      let runningCVD = 0;
      let totalBuyVolume = 0;
      let totalSellVolume = 0;
      const cvdPoints: number[] = [];
      
      // Calculate from oldest to newest for proper cumulative calculation
      const reversedTrades = [...trades].reverse();
      
      reversedTrades.forEach(trade => {
        if (trade.side === 'buy') {
          totalBuyVolume += trade.size;
          runningCVD += trade.size;
        } else {
          totalSellVolume += trade.size;
          runningCVD -= trade.size;
        }
        cvdPoints.push(runningCVD);
      });
      
      const netVolume = totalBuyVolume - totalSellVolume;
      const trend = runningCVD > 0 ? 'bullish' : runningCVD < 0 ? 'bearish' : 'neutral';
      
      // Calculate 24h change (approximate based on available data)
      const change24h = cvdPoints.length > 100 ? 
        ((runningCVD - cvdPoints[Math.max(0, cvdPoints.length - 100)]) / Math.abs(cvdPoints[Math.max(0, cvdPoints.length - 100)] || 1)) * 100 : 0;
      
      setCvdData({
        cvd: runningCVD,
        buyVolume: totalBuyVolume,
        sellVolume: totalSellVolume,
        netVolume,
        trend,
        change24h
      });
      
      setCvdHistory(cvdPoints.slice(-50)); // Keep last 50 points for trend
    }
  }, [trades]);

  const getTrendIcon = () => {
    switch (cvdData.trend) {
      case 'bullish':
        return <TrendingUp className="h-5 w-5 text-green-400" />;
      case 'bearish':
        return <TrendingDown className="h-5 w-5 text-red-400" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    switch (cvdData.trend) {
      case 'bullish':
        return 'text-green-400';
      case 'bearish':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  // Simple CVD sparkline using React elements
  const renderSparkline = () => {
    if (cvdHistory.length < 2) return null;
    
    const max = Math.max(...cvdHistory);
    const min = Math.min(...cvdHistory);
    const range = max - min || 1;
    
    return cvdHistory.map((value, index) => {
      const height = ((value - min) / range) * 40 + 5; // 5-45px height
      return (
        <div
          key={index}
          className={`w-1 bg-gradient-to-t ${
            cvdData.trend === 'bullish' 
              ? 'from-green-600 to-green-400' 
              : cvdData.trend === 'bearish'
              ? 'from-red-600 to-red-400'
              : 'from-gray-600 to-gray-400'
          } opacity-70`}
          style={{ height: `${height}px` }}
        />
      );
    });
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center text-white">
          {getTrendIcon()}
          <span className="ml-2">Volume Delta (CVD)</span>
          <div className="ml-auto flex items-center space-x-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              trades.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'
            }`} />
            <span className="text-gray-400">
              {trades.length > 0 ? `${trades.length} trades` : 'Waiting...'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main CVD Value */}
        <div className="text-center">
          <div className={`text-3xl font-bold ${getTrendColor()}`}>
            {cvdData.cvd >= 0 ? '+' : ''}{cvdData.cvd.toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">
            Cumulative Volume Delta (SOL)
          </div>
          {cvdData.change24h !== 0 && (
            <div className={`text-sm ${cvdData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {cvdData.change24h >= 0 ? '+' : ''}{cvdData.change24h.toFixed(2)}% (1H est.)
            </div>
          )}
        </div>

        {/* CVD Sparkline */}
        {cvdHistory.length > 1 && (
          <div className="h-12 bg-gray-800/50 rounded-lg p-2">
            <div className="flex items-end justify-between h-full space-x-0.5">
              {renderSparkline()}
            </div>
          </div>
        )}
        
        {/* Volume Breakdown */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-green-400 font-semibold">
              {cvdData.buyVolume.toFixed(1)}
            </div>
            <div className="text-gray-400">Buy Volume</div>
          </div>
          
          <div className="text-center">
            <div className={`font-semibold ${getTrendColor()}`}>
              {cvdData.netVolume >= 0 ? '+' : ''}{cvdData.netVolume.toFixed(1)}
            </div>
            <div className="text-gray-400">Net Volume</div>
          </div>
          
          <div className="text-center">
            <div className="text-red-400 font-semibold">
              {cvdData.sellVolume.toFixed(1)}
            </div>
            <div className="text-gray-400">Sell Volume</div>
          </div>
        </div>

        {/* Market Sentiment Indicator */}
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Market Sentiment</span>
            <span className={`text-sm font-semibold ${getTrendColor()}`}>
              {cvdData.trend.charAt(0).toUpperCase() + cvdData.trend.slice(1)}
            </span>
          </div>
          
          {/* Sentiment Bar */}
          <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                cvdData.trend === 'bullish' 
                  ? 'bg-gradient-to-r from-green-600 to-green-400' 
                  : cvdData.trend === 'bearish'
                  ? 'bg-gradient-to-r from-red-600 to-red-400'
                  : 'bg-gray-600'
              }`}
              style={{ 
                width: `${Math.abs(cvdData.netVolume) / (cvdData.buyVolume + cvdData.sellVolume || 1) * 100}%`,
                marginLeft: cvdData.trend === 'bearish' ? 'auto' : '0'
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
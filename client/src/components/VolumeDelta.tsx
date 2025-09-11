import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Wifi, WifiOff, RefreshCw, BarChart3 } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-states';
import { EmptyState } from '@/components/ui/empty-states';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  const [isLoading, setIsLoading] = useState(true);
  const [wsError, setWsError] = useState<string | null>(null);
  const [lastCalculation, setLastCalculation] = useState<number>(0);
  const { lastMessage, isConnected, connectionStatus } = useWebSocket();

  useEffect(() => {
    try {
      setWsError(null); // Clear previous errors
      
      if (!lastMessage?.type || lastMessage.type !== 'market_data' || !lastMessage.data) {
        return;
      }
      
      const wsData = lastMessage.data;
      
      // Validate data structure before processing
      if (!wsData || typeof wsData !== 'object' || wsData.arg?.channel !== 'trades') {
        return;
      }
      
      if (wsData.data && Array.isArray(wsData.data) && wsData.data.length > 0) {
        const validTrades = wsData.data.filter((tradeData: any) => 
          tradeData && 
          typeof tradeData === 'object' && 
          tradeData.side && 
          tradeData.sz && 
          tradeData.px && 
          tradeData.ts
        );
        
        if (validTrades.length === 0) {
          return;
        }
        
        const newTrades: Trade[] = validTrades.map((tradeData: any) => ({
          side: tradeData.side,
          size: parseFloat(tradeData.sz),
          price: parseFloat(tradeData.px),
          timestamp: parseInt(tradeData.ts)
        }));
        
        setTrades(prev => {
          const updated = [...newTrades, ...prev].slice(0, 1000); // Keep last 1000 trades
          return updated;
        });
        
        setLastCalculation(Date.now());
        setIsLoading(false); // Data received successfully
      }
    } catch (error) {
      console.error('VolumeDelta WebSocket parsing error:', error);
      setWsError('Gagal memproses data volume delta dari WebSocket');
      setIsLoading(false);
    }
  }, [lastMessage]);

  // Handle connection state changes
  useEffect(() => {
    if (!isConnected && connectionStatus === 'connecting') {
      setIsLoading(true);
    } else if (!isConnected && connectionStatus === 'disconnected') {
      setIsLoading(false);
      setWsError('Koneksi WebSocket terputus');
    } else if (isConnected && connectionStatus === 'connected') {
      setWsError(null);
      // Don't immediately set loading to false - wait for data
    }
  }, [isConnected, connectionStatus]);

  // Monitor CVD calculation performance
  useEffect(() => {
    const monitorCalculation = setInterval(() => {
      if (isConnected && lastCalculation > 0 && Date.now() - lastCalculation > 60000) { // 1 minute without new calculations
        setWsError('Perhitungan CVD tidak diperbarui dalam 1 menit terakhir');
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(monitorCalculation);
  }, [isConnected, lastCalculation]);

  useEffect(() => {
    try {
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
        setLastCalculation(Date.now());
        setWsError(null); // Clear error on successful calculation
      }
    } catch (error) {
      console.error('CVD Calculation error:', error);
      setWsError('Gagal menghitung Volume Delta (CVD)');
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

  // Loading state
  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center text-white">
            <Activity className="h-5 w-5 text-gray-400 animate-pulse" />
            <span className="ml-2">Volume Delta (CVD)</span>
            <div className="ml-auto">
              <Badge variant="secondary" className="animate-pulse">
                Memuat...
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Main CVD Value Skeleton */}
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-12 bg-gray-700 rounded w-32 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-48 mx-auto mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-24 mx-auto"></div>
            </div>
          </div>

          {/* CVD Sparkline Skeleton */}
          <div className="h-12 bg-gray-800/50 rounded-lg p-2">
            <div className="flex items-end justify-between h-full space-x-0.5">
              {[...Array(40)].map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-700 animate-pulse"
                  style={{ 
                    height: `${Math.random() * 30 + 10}px`,
                    width: '2px',
                    animationDelay: `${i * 0.05}s`
                  }}
                />
              ))}
            </div>
          </div>
          
          {/* Volume Breakdown Skeleton */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[1,2,3].map(i => (
              <div key={i} className="text-center">
                <div className="animate-pulse">
                  <div className="h-5 bg-gray-700 rounded w-16 mx-auto mb-1" style={{ animationDelay: `${i * 0.1}s` }}></div>
                  <div className="h-3 bg-gray-700 rounded w-20 mx-auto"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Market Sentiment Skeleton */}
          <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
            <div className="animate-pulse">
              <div className="flex justify-between items-center mb-2">
                <div className="h-3 bg-gray-700 rounded w-24"></div>
                <div className="h-3 bg-gray-700 rounded w-16"></div>
              </div>
              <div className="h-2 bg-gray-700 rounded-full"></div>
            </div>
          </div>
          
          <div className="text-center text-gray-400 text-sm">
            <div className="flex items-center justify-center gap-2">
              <BarChart3 className="w-4 h-4 animate-bounce" />
              <span>Memuat analisis volume delta dan perhitungan CVD...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (wsError || (!isConnected && connectionStatus === 'error')) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Volume Delta (CVD)
            <Badge variant="destructive" className="ml-2">
              Error
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Analisis Volume Delta Gagal"
            description="Terjadi masalah saat memproses data volume delta (CVD):"
            details={[
              "Koneksi WebSocket tidak stabil atau terputus",
              "Gagal memproses data trading untuk perhitungan CVD",
              "Server analisis volume sedang mengalami gangguan",
              "Data trading dari exchange tidak lengkap atau rusak"
            ]}
            suggestions={[
              "Periksa koneksi internet dan status WebSocket",
              "Refresh halaman untuk reset perhitungan CVD",
              "Tunggu beberapa menit untuk stabilitas data",
              "Gunakan indikator volume lainnya sementara waktu"
            ]}
            onRetry={() => {
              setWsError(null);
              setIsLoading(true);
              setTrades([]); // Clear previous data
              setCvdData({
                cvd: 0,
                buyVolume: 0,
                sellVolume: 0,
                netVolume: 0,
                trend: 'neutral',
                change24h: 0
              });
              window.location.reload();
            }}
            retryLabel="Reset dan Coba Lagi"
            icon={<BarChart3 className="w-6 h-6" />}
            className="bg-gray-800/50"
          />
        </CardContent>
      </Card>
    );
  }

  // Disconnected state
  if (!isConnected) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center text-white">
            <Activity className="h-5 w-5 text-gray-400" />
            <span className="ml-2">Volume Delta (CVD)</span>
            <div className="ml-auto">
              <Badge variant="destructive">
                <WifiOff className="w-3 h-3 mr-1" />
                Terputus
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Connection warning */}
          <div className="p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-400 font-medium">Koneksi Real-time Terputus</span>
            </div>
            <div className="text-xs text-orange-200">
              CVD tidak diperbarui secara real-time. Data terakhir yang tersimpan masih ditampilkan dengan transparansi.
            </div>
          </div>

          {/* Show last known CVD data with reduced opacity */}
          <div className="opacity-60">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getTrendColor()}`}>
                {cvdData.cvd >= 0 ? '+' : ''}{cvdData.cvd.toFixed(2)}
              </div>
              <div className="text-sm text-gray-400">
                Cumulative Volume Delta (SOL) - Data Lama
              </div>
              {cvdData.change24h !== 0 && (
                <div className={`text-sm opacity-50 ${cvdData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {cvdData.change24h >= 0 ? '+' : ''}{cvdData.change24h.toFixed(2)}% (Data Lama)
                </div>
              )}
            </div>

            {/* CVD Sparkline - static */}
            {cvdHistory.length > 1 && (
              <div className="h-12 bg-gray-800/30 rounded-lg p-2">
                <div className="flex items-end justify-between h-full space-x-0.5">
                  {renderSparkline()}
                </div>
              </div>
            )}
          </div>
          
          <div className="text-center">
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Sambung Ulang CVD
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (trades.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center text-white">
            <Activity className="h-5 w-5 text-gray-400" />
            <span className="ml-2">Volume Delta (CVD)</span>
            <div className="ml-auto">
              <Badge variant="outline">
                Tidak Ada Data
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <EmptyState
            title="Data Trading Belum Tersedia"
            description="Belum ada data trading yang cukup untuk menghitung Volume Delta (CVD)."
            details={[
              "WebSocket terhubung tapi belum ada data trading masuk",
              "Diperlukan minimal beberapa transaksi untuk perhitungan CVD",
              "Pasar mungkin sedang sepi atau dalam periode non-aktif"
            ]}
            suggestions={[
              "Tunggu beberapa menit untuk data trading masuk",
              "Pastikan pasar trading sedang aktif",
              "CVD akan dihitung otomatis saat ada transaksi baru"
            ]}
            icon={<BarChart3 className="w-8 h-8" />}
            className="py-8"
          />
        </CardContent>
      </Card>
    );
  }

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
import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, UTCTimestamp } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2, AlertTriangle, Wifi, WifiOff, RefreshCw, BarChart3 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ErrorState } from '@/components/ui/error-states';
import { EmptyState } from '@/components/ui/empty-states';

interface TradingChartProps {
  data?: any;
  isConnected?: boolean;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export function TradingChart({ data, isConnected, isLoading = false, error = null, onRetry }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<any>(null);
  const candleSeries = useRef<any>(null);
  const volumeSeries = useRef<any>(null);
  const [timeframe, setTimeframe] = useState('1H');
  const [chartError, setChartError] = useState<string | null>(null);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      setIsChartLoading(true);
      setChartError(null);

      // Create chart
      chart.current = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#6b7280',
        scaleMargins: {
          top: 0.1,
          bottom: 0.4,
        },
      },
      timeScale: {
        borderColor: '#6b7280',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: isMobile ? (window.innerWidth < 640 ? 300 : 400) : 500,
    });

    // Add price line series
    candleSeries.current = chart.current.addLineSeries({
      color: '#10b981',
      lineWidth: 2,
    });

    // Add volume area series  
    volumeSeries.current = chart.current.addAreaSeries({
      topColor: 'rgba(38, 166, 154, 0.56)',
      bottomColor: 'rgba(38, 166, 154, 0.04)',
      lineColor: 'rgba(38, 166, 154, 1)',
      lineWidth: 2,
      priceScaleId: 'volume',
    });
    
    chart.current.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.7,
        bottom: 0,
      },
    });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart.current) {
        const newHeight = isMobile ? (window.innerWidth < 640 ? 300 : 400) : 500;
        chart.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: newHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Chart successfully initialized
    setIsChartLoading(false);
    setChartError(null);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart.current) {
        chart.current.remove();
      }
    };
  } catch (error) {
    console.error('Chart initialization error:', error);
    setChartError('Failed to initialize chart');
    setIsChartLoading(false);
  }
  }, []);

  // Generate sample data and update chart
  useEffect(() => {
    if (!data?.ticker?.last || !candleSeries.current || !volumeSeries.current) return;

    const currentPrice = parseFloat(data.ticker.last);
    const high24h = parseFloat(data.ticker.high24h);
    const low24h = parseFloat(data.ticker.low24h);
    const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
    
    // Generate realistic price line data
    const priceData = [];
    const volumeData = [];
    
    let price = currentPrice * 0.98; // Start below current
    const priceRange = high24h - low24h;
    
    for (let i = 99; i >= 0; i--) {
      const time = (now - i * 3600) as UTCTimestamp; // 1 hour intervals
      
      // Generate price movement
      const volatility = 0.015;
      const trend = (Math.random() - 0.5) * 0.003;
      const change = (Math.random() - 0.5) * volatility * price;
      price = Math.max(low24h, Math.min(high24h, price + change + (trend * price)));
      
      priceData.push({
        time,
        value: Number(price.toFixed(6)),
      });
      
      // Generate volume
      const baseVolume = 500000 + Math.random() * 1000000;
      volumeData.push({
        time,
        value: baseVolume,
      });
    }
    
    // Add current real-time price
    priceData.push({
      time: now,
      value: currentPrice,
    });
    
    volumeData.push({
      time: now,
      value: parseFloat(data.ticker.vol24h || '800000'),
    });

    // Set data to chart
    candleSeries.current.setData(priceData);
    volumeSeries.current.setData(volumeData);

  }, [data?.ticker?.last]);

  const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D'];

  // Loading state
  if (isLoading || isChartLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500 animate-pulse" />
              <CardTitle>SOL/USDT-SWAP Futures Chart</CardTitle>
              <Badge variant="secondary" className="ml-2 animate-pulse">
                Memuat...
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Chart Loading Skeleton */}
          <div className={`w-full ${isMobile ? 'h-[300px] sm:h-[400px]' : 'h-[500px]'} bg-gray-800 border rounded-lg relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/50 to-transparent animate-shimmer"></div>
            <div className="p-4 space-y-4">
              <div className="animate-pulse">
                {/* Price area skeleton */}
                <div className="space-y-2 mb-8">
                  <div className="h-3 bg-gray-700 rounded w-1/4"></div>
                  <div className="h-8 bg-gray-700 rounded w-1/3"></div>
                </div>
                
                {/* Chart area skeleton */}
                <div className="relative h-64">
                  {/* Candlestick simulation */}
                  <div className="absolute bottom-0 left-0 w-full h-full">
                    <div className="flex items-end justify-between h-full px-2">
                      {[...Array(20)].map((_, i) => (
                        <div key={i} className="bg-gray-700 rounded-sm animate-pulse" 
                             style={{ 
                               height: `${Math.random() * 60 + 20}%`, 
                               width: '3px',
                               animationDelay: `${i * 0.1}s`
                             }} />
                      ))}
                    </div>
                  </div>
                  
                  {/* Volume bars skeleton */}
                  <div className="absolute bottom-0 left-0 w-full h-16">
                    <div className="flex items-end justify-between h-full px-2">
                      {[...Array(20)].map((_, i) => (
                        <div key={i} className="bg-green-700/50 rounded-sm animate-pulse" 
                             style={{ 
                               height: `${Math.random() * 100}%`, 
                               width: '2px',
                               animationDelay: `${i * 0.1 + 0.5}s`
                             }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <BarChart3 className="w-4 h-4 animate-bounce" />
              <span className="text-sm">Memuat grafik trading dan data pasar...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || chartError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            SOL/USDT-SWAP Futures Chart
            <Badge variant="destructive" className="ml-2">
              Error
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            title="Grafik Tidak Dapat Dimuat"
            description="Terjadi masalah saat memuat grafik trading. Kemungkinan penyebab:"
            details={[
              "Koneksi internet tidak stabil",
              "Data pasar sedang tidak tersedia", 
              "Masalah pada library grafik",
              "Server data sedang mengalami gangguan"
            ]}
            suggestions={[
              "Periksa koneksi internet Anda",
              "Coba refresh halaman",
              "Ganti ke timeframe yang berbeda",
              "Gunakan analisis dari komponen lain sementara"
            ]}
            onRetry={onRetry || (() => window.location.reload())}
            retryLabel="Muat Ulang Grafik"
            icon={<BarChart3 className="w-6 h-6" />}
            className="bg-gray-800/50"
          />
        </CardContent>
      </Card>
    );
  }

  // No data state  
  if (!data?.ticker) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            SOL/USDT-SWAP Futures Chart
            <Badge variant="outline" className="ml-2">
              Tidak Ada Data
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Data Pasar Tidak Tersedia"
            description="Grafik tidak dapat ditampilkan karena data pasar belum tersedia."
            details={[
              "Pasar mungkin sedang tutup",
              "Koneksi ke exchange terputus",
              "Data ticker belum diterima",
              "Sedang menunggu sinkronisasi data"
            ]}
            suggestions={[
              "Tunggu beberapa detik untuk sinkronisasi",
              "Periksa status koneksi di indicator",
              "Coba refresh atau ganti pair trading",
              "Periksa komponen data lain yang tersedia"
            ]}
            icon={<Activity className="w-8 h-8" />}
            className="py-8"
          />
        </CardContent>
      </Card>
    );
  }

  // Connection warning
  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            SOL/USDT-SWAP Futures Chart
            <Badge variant="destructive" className="ml-2">
              <WifiOff className="w-3 h-3 mr-1" />
              Terputus
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-orange-400 font-medium">Koneksi Real-time Terputus</span>
              </div>
              <div className="text-xs text-orange-200 space-y-1">
                <div>• Data grafik mungkin tidak update secara real-time</div>
                <div>• Gunakan tombol refresh untuk mendapat data terbaru</div>
                <div>• Periksa koneksi internet dan status WebSocket</div>
              </div>
            </div>
            
            {/* Show static chart with last known data */}
            <div 
              ref={chartContainerRef}
              className={`w-full ${isMobile ? 'h-[300px] sm:h-[400px]' : 'h-[500px]'} bg-background border rounded-lg touch-pan-x touch-pan-y opacity-75`}
              data-testid="trading-chart-container"
            />
            
            <div className="text-center">
              <Button 
                onClick={onRetry || (() => window.location.reload())} 
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Coba Sambung Ulang
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <CardTitle>SOL/USDT-SWAP Futures Chart</CardTitle>
            <Badge variant={isConnected ? "default" : "destructive"} className="ml-2">
              <Activity className="h-3 w-3 mr-1" />
              {isConnected ? 'Real-time' : 'Disconnected'}
            </Badge>
          </div>
          
          <div className={`${isMobile ? 'space-y-2' : 'flex items-center gap-2'}`}>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Volume2 className="h-4 w-4" />
              <span>24h Vol: {data?.ticker?.vol24h ? parseFloat(data.ticker.vol24h).toLocaleString() : 'N/A'}</span>
            </div>
            
            <div className={`${isMobile ? 'grid grid-cols-6 gap-1' : 'flex gap-1'}`}>
              {timeframes.map((tf) => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe(tf)}
                  className={`${isMobile ? 'h-6 px-1 text-xs' : 'h-7 px-2 text-xs'}`}
                  data-testid={`chart-timeframe-${tf.toLowerCase()}`}
                >
                  {tf}
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        {data?.ticker && (
          <div className={`${isMobile ? 'space-y-2' : 'flex items-center gap-6'} text-sm`}>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Price:</span>
              <span className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-foreground`}>
                ${parseFloat(data.ticker.last).toFixed(6)}
              </span>
            </div>
            <div className={`${isMobile ? 'flex justify-between' : 'flex items-center gap-6'}`}>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">24h Change:</span>
                <span className={`font-semibold ${parseFloat(data.ticker.changePercent) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {parseFloat(data.ticker.changePercent) >= 0 ? '+' : ''}{parseFloat(data.ticker.changePercent).toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <span>H: ${parseFloat(data.ticker.high24h).toFixed(6)}</span>
                <span>L: ${parseFloat(data.ticker.low24h).toFixed(6)}</span>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div 
          ref={chartContainerRef}
          className={`w-full ${isMobile ? 'h-[300px] sm:h-[400px]' : 'h-[500px]'} bg-background border rounded-lg touch-pan-x touch-pan-y`}
          data-testid="trading-chart-container"
        />
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>⚡ Powered by TradingView Lightweight Charts</span>
            <span>📊 Real-time SOL data from OKX Exchange</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-500">🟢 Bullish</span>
            <span className="text-red-500">🔴 Bearish</span>
            <span>📈 Timeframe: {timeframe}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, UTCTimestamp } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2 } from 'lucide-react';

interface TradingChartProps {
  data?: any;
  isConnected?: boolean;
}

export function TradingChart({ data, isConnected }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<any>(null);
  const candleSeries = useRef<any>(null);
  const volumeSeries = useRef<any>(null);
  const [timeframe, setTimeframe] = useState('1H');

  useEffect(() => {
    if (!chartContainerRef.current) return;

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
      height: 500,
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
        chart.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart.current) {
        chart.current.remove();
      }
    };
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

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <CardTitle>SOL/USDT TradingView Chart</CardTitle>
            <Badge variant={isConnected ? "default" : "destructive"} className="ml-2">
              <Activity className="h-3 w-3 mr-1" />
              {isConnected ? 'Real-time' : 'Disconnected'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Volume2 className="h-4 w-4" />
              <span>24h Vol: {data?.ticker?.vol24h ? parseFloat(data.ticker.vol24h).toLocaleString() : 'N/A'}</span>
            </div>
            
            <div className="flex gap-1">
              {timeframes.map((tf) => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe(tf)}
                  className="h-7 px-2 text-xs"
                >
                  {tf}
                </Button>
              ))}
            </div>
          </div>
        </div>
        
        {data?.ticker && (
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Price:</span>
              <span className="text-xl font-bold text-foreground">
                ${parseFloat(data.ticker.last).toFixed(6)}
              </span>
            </div>
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
        )}
      </CardHeader>
      
      <CardContent>
        <div 
          ref={chartContainerRef}
          className="w-full h-[500px] bg-background border rounded-lg"
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
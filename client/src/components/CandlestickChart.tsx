import { useEffect, useRef } from 'react';
import { createChart, ColorType, UTCTimestamp, IChartApi, ISeriesApi } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CandlestickChartProps {
  data?: any;
  isConnected?: boolean;
}

export function CandlestickChart({ data, isConnected }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    try {
      console.log('Initializing chart...');
      
      if (!chartContainerRef.current) {
        console.error('Chart container not found');
        return;
      }

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
            bottom: 0.3,
          },
        },
        timeScale: {
          borderColor: '#6b7280',
          timeVisible: true,
          secondsVisible: false,
        },
        width: chartContainerRef.current.clientWidth || 800,
        height: 500,
      });

      console.log('Chart created:', !!chart.current);

      if (!chart.current) {
        console.error('Chart creation failed');
        return;
      }

      // Add candlestick series
      candleSeries.current = chart.current.addCandlestickSeries();
      candleSeries.current.applyOptions({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        wickUpColor: '#26a69a',
      });

      console.log('Candlestick series created:', !!candleSeries.current);

      // Add volume histogram
      volumeSeries.current = chart.current.addHistogramSeries();
      volumeSeries.current.applyOptions({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
        scaleMargins: {
          top: 0.7,
          bottom: 0,
        },
      });

      console.log('Volume series created:', !!volumeSeries.current);

      if (chart.current) {
        chart.current.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.7,
            bottom: 0,
          },
        });
      }

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chart.current) {
          chart.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);

      console.log('Chart initialized successfully');

      return () => {
        window.removeEventListener('resize', handleResize);
        if (chart.current) {
          chart.current.remove();
          chart.current = null;
          candleSeries.current = null;
          volumeSeries.current = null;
        }
      };
    } catch (error) {
      console.error('Chart initialization error:', error);
    }
  }, []);

  // Update chart with real candle data
  useEffect(() => {
    if (!data?.candles || !candleSeries.current || !volumeSeries.current) {
      console.log('Candles update skipped:', { 
        hasCandles: !!data?.candles, 
        hasCandleSeries: !!candleSeries.current, 
        hasVolumeSeries: !!volumeSeries.current 
      });
      return;
    }

    try {
      // Use 1H candles as default, fallback to 4H or 1D
      const candles = data.candles['1H'] || data.candles['4H'] || data.candles['1D'] || [];
      
      console.log('Updating chart with candles:', candles.length);
      
      if (candles.length === 0) return;

      // Convert API candle data to lightweight-charts format
      const candleData = candles.map((candle: any) => ({
        time: Math.floor(Number(candle.timestamp) / 1000) as UTCTimestamp,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
      }));

      // Generate volume data (use close price change as volume proxy)
      const volumeData = candles.map((candle: any) => ({
        time: Math.floor(Number(candle.timestamp) / 1000) as UTCTimestamp,
        value: parseFloat(candle.volume || '1000000'),
        color: parseFloat(candle.close) > parseFloat(candle.open) ? '#26a69a' : '#ef5350',
      }));

      // Set data to chart
      candleSeries.current.setData(candleData);
      volumeSeries.current.setData(volumeData);

      // Fit content to show all candles
      if (chart.current) {
        chart.current.timeScale().fitContent();
      }

      console.log('Chart updated successfully with', candleData.length, 'candles');

    } catch (error) {
      console.error('Chart data update error:', error);
    }
  }, [data?.candles]);

  // Update current price from WebSocket
  useEffect(() => {
    if (!data?.ticker?.last || !candleSeries.current) return;

    try {
      const currentPrice = parseFloat(data.ticker.last);
      const now = Math.floor(Date.now() / 1000) as UTCTimestamp;

      // Add current price as a temporary marker or update last candle
      // For now, just ensure the price scale includes current price
      if (chart.current) {
        chart.current.priceScale('').applyOptions({
          autoScale: true,
        });
      }
    } catch (error) {
      console.warn('Price update error:', error);
    }
  }, [data?.ticker?.last]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <CardTitle>SOL/USDT Candlestick Chart</CardTitle>
            <Badge variant={isConnected ? "default" : "destructive"} className="ml-2">
              <Activity className="h-3 w-3 mr-1" />
              {isConnected ? 'Real-time' : 'Disconnected'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {data?.ticker && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                <span>24h Vol: {parseFloat(data.ticker.vol24h || '0').toLocaleString()}</span>
              </div>
            )}
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
              <span className={`font-semibold ${parseFloat(data.ticker.changePercent || '0') >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {parseFloat(data.ticker.changePercent || '0') >= 0 ? '+' : ''}{parseFloat(data.ticker.changePercent || '0').toFixed(2)}%
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
          data-testid="candlestick-chart"
        />
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>📊 Professional Candlestick Chart</span>
            <span>⚡ Real-time SOL data from OKX</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-500">🟢 Bullish Candles</span>
            <span className="text-red-500">🔴 Bearish Candles</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
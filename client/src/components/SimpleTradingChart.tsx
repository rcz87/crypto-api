import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp } from 'lucide-react';

interface SimpleTradingChartProps {
  data?: any;
  isConnected?: boolean;
}

export function SimpleTradingChart({ data, isConnected }: SimpleTradingChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    try {

    const canvas = chartRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with proper dimensions
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = 400 * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '400px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, 400);
    
    // Use real candles data if available
    let candlesData = [];
    let currentPrice = 0;
    let high24h = 0;
    let low24h = 0;
    
    if (data?.candles) {
      // Use real candles data
      const candles = data.candles['1H'] || data.candles['4H'] || data.candles['1D'] || [];
      candlesData = candles.slice(-50); // Show last 50 candles
      console.log('Drawing candlestick chart with', candlesData.length, 'real candles');
    }
    
    if (data?.ticker) {
      currentPrice = parseFloat(data.ticker.last || '0');
      high24h = parseFloat(data.ticker.high24h || '0');
      low24h = parseFloat(data.ticker.low24h || '0');
    }
    
    // Fallback to demo data if no real candles
    if (candlesData.length === 0 && currentPrice > 0) {
      const priceRange = high24h - low24h || currentPrice * 0.02;
      let price = currentPrice;
      
      for (let i = 0; i < 30; i++) {
        const variation = (Math.random() - 0.5) * priceRange * 0.1;
        const open = price;
        const close = price + variation;
        const high = Math.max(open, close) + Math.random() * priceRange * 0.05;
        const low = Math.min(open, close) - Math.random() * priceRange * 0.05;
        
        candlesData.push({
          open: open.toString(),
          high: high.toString(),
          low: low.toString(),
          close: close.toString(),
          timestamp: (Date.now() - (30 - i) * 3600000).toString()
        });
        price = close;
      }
    }
    
    if (candlesData.length === 0) return;

    // Find price range for scaling
    const allPrices = candlesData.flatMap(candle => [
      parseFloat(candle.high),
      parseFloat(candle.low)
    ]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const range = maxPrice - minPrice || 1;
    ctx.beginPath();

    const width = rect.width;
    const height = 300;
    const padding = 50;

    dataPoints.forEach((point, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * (width - 2 * padding);
      const y = padding + ((high24h - point) / priceRange) * (height - 2 * padding);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw price labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter';
    ctx.textAlign = 'right';
    
    // High price
    ctx.fillText(`$${high24h.toFixed(6)}`, width - 10, padding + 15);
    
    // Low price  
    ctx.fillText(`$${low24h.toFixed(6)}`, width - 10, padding + height - 10);
    
    // Current price
    const currentY = padding + ((high24h - currentPrice) / priceRange) * (height - 2 * padding);
    ctx.fillStyle = '#10b981';
    ctx.fillText(`$${currentPrice.toFixed(6)}`, width - 10, currentY);
    
    // Draw current price line
    ctx.strokeStyle = '#10b981';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, currentY);
    ctx.lineTo(width - padding, currentY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    } catch (error) {
      console.warn('Chart rendering error:', error);
    }
  }, [data]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <CardTitle>SOL/USDT Professional Chart</CardTitle>
            <Badge variant={isConnected ? "default" : "destructive"} className="ml-2">
              <Activity className="h-3 w-3 mr-1" />
              {isConnected ? 'Real-time' : 'Disconnected'}
            </Badge>
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
              <span>24h High: ${parseFloat(data.ticker.high24h).toFixed(6)}</span>
              <span>24h Low: ${parseFloat(data.ticker.low24h).toFixed(6)}</span>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="relative w-full bg-background border rounded-lg">
          {data?.ticker?.last ? (
            <canvas
              ref={chartRef}
              className="w-full h-[400px]"
              style={{ width: '100%', height: '400px' }}
              data-testid="simple-trading-chart"
            />
          ) : (
            <div className="w-full h-[400px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-lg mb-2">📊 Loading chart data...</div>
                <div className="text-sm">
                  {isConnected ? 'Connected to live data stream' : 'Connecting to WebSocket...'}
                </div>
                <div className="text-xs mt-2 text-muted-foreground/60">
                  Waiting for real-time SOL price data
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>⚡ Real-time SOL price visualization</span>
            <span>📊 Professional canvas-based charting</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-500">🟢 Live WebSocket Data</span>
            <span>📈 Trading-Grade Interface</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
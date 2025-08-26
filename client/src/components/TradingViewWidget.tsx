import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2 } from 'lucide-react';

interface TradingViewWidgetProps {
  data?: any;
  isConnected?: boolean;
}

export function TradingViewWidget({ data, isConnected }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'OKX:SOLUSDT', // SOL/USDT pair dari OKX
      interval: '1H',         // 1 hour candlesticks
      toolbar_bg: '#1f2937',   // Dark toolbar background
      overrides: {
        // LuxAlgo-style color scheme
        "paneProperties.background": "#111827",
        "paneProperties.vertGridProperties.color": "#374151",
        "paneProperties.horzGridProperties.color": "#374151",
        "symbolWatermarkProperties.transparency": 90,
        "scalesProperties.textColor": "#9CA3AF",
        "mainSeriesProperties.candleStyle.upColor": "#10B981",
        "mainSeriesProperties.candleStyle.downColor": "#EF4444",
        "mainSeriesProperties.candleStyle.borderUpColor": "#10B981",
        "mainSeriesProperties.candleStyle.borderDownColor": "#EF4444",
        "mainSeriesProperties.candleStyle.wickUpColor": "#10B981",
        "mainSeriesProperties.candleStyle.wickDownColor": "#EF4444"
      },
      timezone: 'Etc/UTC',
      theme: 'dark',         // Dark theme
      style: '1',            // Candlestick style
      locale: 'en',
      enable_publishing: false,
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      details: true,
      hotlist: false,
      calendar: false,
      studies: [
        'Volume',                    // Volume indicator
        'RSI@tv-basicstudies',      // RSI - momentum oscillator
        'MACD@tv-basicstudies',     // MACD - trend following
        'EMA@tv-basicstudies',      // EMA - similar to LuxAlgo trend
        'BB@tv-basicstudies',       // Bollinger Bands - volatility
        'StochasticRSI@tv-basicstudies'  // Stochastic RSI
      ],
      container_id: 'tradingview_chart'
    });

    // Bersihkan container sebelum memasang script baru
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    return () => {
      // Cleanup saat component unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

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
              <span className="text-muted-foreground">Current Price:</span>
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
              <span>High: ${parseFloat(data.ticker.high24h).toFixed(6)}</span>
              <span>Low: ${parseFloat(data.ticker.low24h).toFixed(6)}</span>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div 
          ref={containerRef}
          id="tradingview_chart"
          className="w-full h-[500px] bg-gray-900 border border-gray-700 rounded-lg"
          data-testid="tradingview-chart"
        />
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>📈 Powered by TradingView</span>
            <span>⚡ Real-time SOL data from OKX</span>
            <span>🕯️ Professional Candlestick Chart</span>
          </div>
          <div className="flex items-center gap-4">
            <span>✅ Volume Analysis</span>
            <span>📊 RSI • MACD • EMA • Bollinger</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
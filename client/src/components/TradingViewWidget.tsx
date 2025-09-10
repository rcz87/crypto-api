import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2 } from 'lucide-react';

interface TradingViewWidgetProps {
  data?: any;
  isConnected?: boolean;
  tvSymbol?: string;
  displaySymbol?: string;
}

export function TradingViewWidget({ 
  data, 
  isConnected,
  tvSymbol = "OKX:SOLUSDTPERP",
  displaySymbol = "SOL/USDT-PERP" 
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol, // Use prop instead of hardcoded
      interval: '1H',
      toolbar_bg: '#1f2937',
      overrides: {
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
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      details: true,
      hotlist: false,
      calendar: false,
      studies: [
        'Volume',
        'RSI@tv-basicstudies',
        'MACD@tv-basicstudies',
        'EMA@tv-basicstudies',
        'BB@tv-basicstudies',
        'StochasticRSI@tv-basicstudies'
      ],
      container_id: 'tradingview_chart'
    });

    // Clean container and append script
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tvSymbol]); // Re-initialize when symbol changes

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <CardTitle>{displaySymbol} Futures Chart</CardTitle>
            <Badge variant={isConnected ? "default" : "destructive"} className="ml-2">
              <Activity className="h-3 w-3 mr-1" />
              {isConnected ? 'Real-time' : 'Disconnected'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {data?.ticker && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                <span>24h Vol: {parseFloat(data.ticker.volume || data.ticker.vol24h || '0').toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        
        {data?.ticker && (
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Current Price:</span>
              <span className="text-xl font-bold text-foreground">
                ${parseFloat(data.ticker.price || data.ticker.last || '0').toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">24h Change:</span>
              <span className={`font-semibold ${parseFloat((data.ticker.change24h || data.ticker.changePercent || '0').replace('%', '')) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {data.ticker.change24h || `${parseFloat(data.ticker.changePercent || '0') >= 0 ? '+' : ''}${parseFloat(data.ticker.changePercent || '0').toFixed(2)}%`}
              </span>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>High: ${parseFloat(data.ticker.high24h || '0').toFixed(2)}</span>
              <span>Low: ${parseFloat(data.ticker.low24h || '0').toFixed(2)}</span>
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
      </CardContent>
    </Card>
  );
}
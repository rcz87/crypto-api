import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2 } from 'lucide-react';

interface TradingViewWidgetProps {
  data?: any;
  isConnected?: boolean;
}

export function TradingViewWidget({ data, isConnected }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadTradingViewWidget = () => {
      if (!containerRef.current || !mounted) return;

      try {
        // Clear any existing content
        containerRef.current.innerHTML = '';

        // Create the widget container div
        const widgetDiv = document.createElement('div');
        widgetDiv.id = 'tradingview_widget_' + Date.now();
        widgetDiv.style.height = '500px';
        widgetDiv.style.width = '100%';
        
        containerRef.current.appendChild(widgetDiv);

        // Create and configure the TradingView script
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        
        const config = {
          autosize: true,
          symbol: 'OKX:SOLUSDTPERP',
          interval: '1H',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#1f2937',
          enable_publishing: false,
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          details: true,
          hotlist: false,
          calendar: false,
          container_id: widgetDiv.id,
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
          studies: [
            'Volume',
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies',
            'EMA@tv-basicstudies',
            'BB@tv-basicstudies'
          ]
        };

        script.innerHTML = JSON.stringify(config);

        script.onload = () => {
          if (mounted) {
            setIsLoading(false);
            setIsError(false);
          }
        };

        script.onerror = () => {
          if (mounted) {
            setIsLoading(false);
            setIsError(true);
          }
        };

        // Append script to widget container
        widgetDiv.appendChild(script);

        // Set timeout fallback
        setTimeout(() => {
          if (mounted) {
            setIsLoading(false);
          }
        }, 5000);

      } catch (error) {
        console.error('TradingView Widget Error:', error);
        if (mounted) {
          setIsLoading(false);
          setIsError(true);
        }
      }
    };

    // Load widget with small delay to ensure DOM is ready
    const timer = setTimeout(loadTradingViewWidget, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
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
            <CardTitle>SOL/USDT-PERP Futures Chart</CardTitle>
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
          className="w-full h-[500px] bg-gray-900 border border-gray-700 rounded-lg relative"
          data-testid="tradingview-chart"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                <div>Loading TradingView Chart...</div>
              </div>
            </div>
          )}
          
          {isError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
              <div className="text-center">
                <div className="text-red-500 mb-2">⚠️ Chart Loading Error</div>
                <div className="text-sm text-gray-400">TradingView widget failed to load</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>📈 Powered by TradingView</span>
            <span>⚡ Real-time SOL Futures data from OKX</span>
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
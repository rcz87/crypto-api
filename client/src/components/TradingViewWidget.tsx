import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2, BarChart3 } from 'lucide-react';

interface TradingViewWidgetProps {
  data?: any;
  isConnected?: boolean;
}

export function TradingViewWidget({ data, isConnected }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isWidgetLoaded, setIsWidgetLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const initTradingView = () => {
      if (!containerRef.current || !isMounted) return;

      try {
        // Clear container
        containerRef.current.innerHTML = '';
        
        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'tradingview-widget-container';
        widgetContainer.style.height = '100%';
        widgetContainer.style.width = '100%';
        
        // Create widget div
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget';
        widgetDiv.style.height = '500px';
        widgetDiv.style.width = '100%';
        
        // Create script tag
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.async = true;
        
        // TradingView configuration
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
          studies: [
            'Volume',
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies'
          ],
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
          }
        };

        script.innerHTML = JSON.stringify(config);
        
        // Add elements to container
        widgetContainer.appendChild(widgetDiv);
        widgetContainer.appendChild(script);
        containerRef.current.appendChild(widgetContainer);

        // Set loaded state after delay
        const timer = setTimeout(() => {
          if (isMounted) {
            setIsWidgetLoaded(true);
            setHasError(false);
          }
        }, 3000);

        return () => {
          clearTimeout(timer);
        };

      } catch (error) {
        console.error('TradingView Widget Error:', error);
        if (isMounted) {
          setHasError(true);
          setIsWidgetLoaded(false);
        }
      }
    };

    // Initialize with delay to avoid conflicts
    const initTimer = setTimeout(initTradingView, 500);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
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
          className="w-full h-[500px] bg-gray-900 border border-gray-700 rounded-lg relative overflow-hidden"
          data-testid="tradingview-chart"
        >
          {!isWidgetLoaded && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                <div className="text-lg font-medium">Loading SOL Chart...</div>
                <div className="text-sm text-gray-400 mt-2">Connecting to TradingView</div>
              </div>
            </div>
          )}
          
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <div className="text-lg font-medium text-red-400">Chart Loading Failed</div>
                <div className="text-sm text-gray-400 mt-2">TradingView widget unavailable</div>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>📈 Powered by TradingView</span>
            <span>⚡ Real-time SOL Futures from OKX</span>
            <span>🕯️ Professional Candlestick Chart</span>
          </div>
          <div className="flex items-center gap-4">
            <span>✅ Volume Analysis</span>
            <span>📊 RSI • MACD • Volume</span>
            <span>{isWidgetLoaded ? '🟢 Loaded' : '🟡 Loading'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
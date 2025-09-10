import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2, BarChart3 } from 'lucide-react';

interface TradingViewWidgetProps {
  data?: any;
  isConnected?: boolean;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

export function TradingViewWidget({ data, isConnected }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadTradingViewScript = async () => {
      // If script already loaded and widget exists, don't reload
      if (scriptLoadedRef.current && widgetRef.current) {
        setIsLoading(false);
        return;
      }

      try {
        // Check if TradingView is already available
        if (window.TradingView && window.TradingView.widget) {
          initializeWidget();
          return;
        }

        // Load TradingView script
        const script = document.createElement('script');
        script.id = 'tradingview-widget-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        
        script.onload = () => {
          if (isMounted) {
            scriptLoadedRef.current = true;
            // Small delay to ensure script is fully loaded
            setTimeout(initializeWidget, 500);
          }
        };

        script.onerror = () => {
          if (isMounted) {
            console.error('Failed to load TradingView script');
            setHasError(true);
            setIsLoading(false);
          }
        };

        // Remove existing script if any
        const existingScript = document.getElementById('tradingview-widget-script');
        if (existingScript) {
          existingScript.remove();
        }

        document.head.appendChild(script);

      } catch (error) {
        console.error('Error loading TradingView script:', error);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    const initializeWidget = () => {
      if (!containerRef.current || !window.TradingView || widgetRef.current) return;

      try {
        const container = containerRef.current;
        
        // Clear container
        container.innerHTML = '';
        
        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.id = `tradingview_widget_${Date.now()}`;
        widgetContainer.style.height = '500px';
        widgetContainer.style.width = '100%';
        container.appendChild(widgetContainer);

        // Initialize TradingView widget
        widgetRef.current = new window.TradingView.widget({
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
          container_id: widgetContainer.id,
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
          },
          loading_screen: {
            backgroundColor: "#111827",
            foregroundColor: "#10B981"
          }
        });

        // Set loaded after widget initialization
        setTimeout(() => {
          if (isMounted) {
            setIsLoading(false);
            setHasError(false);
          }
        }, 2000);

      } catch (error) {
        console.error('Error initializing TradingView widget:', error);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    loadTradingViewScript();

    return () => {
      isMounted = false;
      // Don't destroy widget on unmount to prevent conflicts
    };
  }, []); // Empty dependency array - only run once

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
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
                <div className="text-xl font-bold">Loading TradingView...</div>
                <div className="text-sm text-gray-400 mt-2">Memuat chart professional</div>
                <div className="text-xs text-gray-500 mt-1">Mohon tunggu sebentar</div>
              </div>
            </div>
          )}
          
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10">
              <div className="text-center">
                <BarChart3 className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                <div className="text-xl font-bold text-red-400">Chart Load Failed</div>
                <div className="text-sm text-gray-400 mt-2">TradingView widget gagal dimuat</div>
                <div className="text-xs text-gray-500 mt-1">Refresh halaman untuk mencoba lagi</div>
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
            <span>✅ Volume • RSI • MACD</span>
            <span>
              {isLoading && '🟡 Loading Widget...'}
              {!isLoading && !hasError && '🟢 Chart Ready'}
              {hasError && '🔴 Load Failed'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
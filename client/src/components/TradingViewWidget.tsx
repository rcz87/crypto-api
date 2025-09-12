import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2, Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface TradingViewWidgetProps {
  data?: any;
  isConnected?: boolean;
  tvSymbol?: string;
  displaySymbol?: string;
}

// Global flag to prevent multiple script loads
let isScriptLoading = false;
let scriptLoaded = false;

export function TradingViewWidget({ 
  data, 
  isConnected,
  tvSymbol = "OKX:SOLUSDTPERP",
  displaySymbol = "SOL/USDT-PERP" 
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerId = `tradingview_${Date.now()}`;

  useEffect(() => {
    const loadTradingViewScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (scriptLoaded) {
          resolve();
          return;
        }

        if (isScriptLoading) {
          // Wait for ongoing script load
          const checkInterval = setInterval(() => {
            if (scriptLoaded) {
              clearInterval(checkInterval);
              resolve();
            } else if (!isScriptLoading) {
              clearInterval(checkInterval);
              reject(new Error('Script loading failed'));
            }
          }, 100);
          return;
        }

        isScriptLoading = true;

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.async = true;
        
        script.onload = () => {
          isScriptLoading = false;
          scriptLoaded = true;
          resolve();
        };
        
        script.onerror = () => {
          isScriptLoading = false;
          reject(new Error('Failed to load TradingView script'));
        };

        document.head.appendChild(script);
      });
    };

    const initializeWidget = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await loadTradingViewScript();
        
        // Wait for TradingView to be available
        if (typeof window.TradingView === 'undefined') {
          throw new Error('TradingView library not loaded');
        }
        
        if (containerRef.current) {
          // Clear container safely
          try {
            containerRef.current.innerHTML = '';
          } catch (e) {
            // Ignore DOM cleanup errors
          }

          // Create widget container
          const widgetContainer = document.createElement('div');
          widgetContainer.className = 'tradingview-widget-container';
          widgetContainer.style.height = '100%';
          widgetContainer.style.width = '100%';

          // Create widget div
          const widgetDiv = document.createElement('div');
          widgetDiv.className = 'tradingview-widget';
          widgetDiv.id = containerId;
          widgetDiv.style.height = '100%';
          widgetDiv.style.width = '100%';

          widgetContainer.appendChild(widgetDiv);
          containerRef.current.appendChild(widgetContainer);

          // Safe symbol processing to prevent injection
          const safeSymbol = tvSymbol.replace(/['"\\]/g, '');
          const safeContainerId = containerId.replace(/['"\\]/g, '');

          // Create widget directly using API instead of template literals
          const widget = new window.TradingView.widget({
            autosize: true,
            symbol: safeSymbol,
            interval: "60",
            timezone: "Etc/UTC", 
            theme: "dark",
            style: "1",
            locale: "en",
            toolbar_bg: "#1f2937",
            enable_publishing: false,
            allow_symbol_change: false,
            container_id: safeContainerId,
            height: isMobile ? 400 : 500,
            width: "100%",
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
              "Volume@tv-basicstudies",
              "RSI@tv-basicstudies",
              "MACD@tv-basicstudies"
            ]
          });

          setIsLoading(false);
        }
      } catch (err) {
        console.error('TradingView initialization error:', err);
        setError('Failed to load TradingView chart');
        setIsLoading(false);
      }
    };

    initializeWidget();

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tvSymbol, containerId, isMobile]);

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
          <div className={`${isMobile ? 'space-y-3' : 'flex items-center gap-6'} text-sm`}>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Current Price:</span>
              <span className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-foreground`}>
                ${parseFloat(data.ticker.price || data.ticker.last || '0').toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">24h Change:</span>
              <span className={`font-semibold ${parseFloat((data.ticker.change24h || data.ticker.changePercent || '0').replace('%', '')) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {data.ticker.change24h || `${parseFloat(data.ticker.changePercent || '0') >= 0 ? '+' : ''}${parseFloat(data.ticker.changePercent || '0').toFixed(2)}%`}
              </span>
            </div>
            <div className={`flex items-center ${isMobile ? 'justify-between' : 'gap-4'} text-muted-foreground`}>
              <span>High: ${parseFloat(data.ticker.high24h || '0').toFixed(2)}</span>
              <span>Low: ${parseFloat(data.ticker.low24h || '0').toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div 
          ref={containerRef}
          className={`w-full ${isMobile ? 'h-[300px] sm:h-[400px]' : 'h-[500px]'} bg-gray-900 border border-gray-700 rounded-lg touch-pan-x touch-pan-y select-none relative`}
          data-testid="tradingview-chart"
        >
          {/* Loading State */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <div className="text-sm text-gray-400">Loading TradingView Chart...</div>
              </div>
            </div>
          )}
          
          {/* Error State */}
          {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="p-3 bg-red-500/20 rounded-full">
                  <TrendingUp className="h-6 w-6 text-red-400" />
                </div>
                <div className="text-sm text-red-400">
                  {error}
                </div>
                <div className="text-xs text-gray-500">
                  Please refresh the page to try again
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
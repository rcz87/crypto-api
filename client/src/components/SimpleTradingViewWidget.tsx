import { useEffect, useRef, useState } from "react";

export interface SimpleTradingViewWidgetProps {
  symbol?: string;
  theme?: "light" | "dark";
  height?: number;
  width?: string;
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

export function SimpleTradingViewWidget({
  symbol = "BINANCE:SOLUSDT",
  theme = "dark",
  height = 500,
  width = "100%"
}: SimpleTradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerId = `tradingview_${Date.now()}`;

  useEffect(() => {
    console.log('SimpleTradingViewWidget: Component mounted, starting load...');
    let isMounted = true;

    const loadWidget = async () => {
      try {
        console.log('SimpleTradingViewWidget: Loading widget for container:', containerId);
        
        // Load TradingView script if not already loaded
        if (!window.TradingView) {
          console.log('SimpleTradingViewWidget: Loading TradingView script...');
          const script = document.createElement('script');
          script.src = 'https://s3.tradingview.com/tv.js';
          script.async = true;
          document.head.appendChild(script);

          await new Promise((resolve, reject) => {
            script.onload = () => {
              console.log('SimpleTradingViewWidget: Script loaded successfully');
              resolve(void 0);
            };
            script.onerror = () => {
              console.error('SimpleTradingViewWidget: Script load failed');
              reject(new Error('Failed to load TradingView script'));
            };
          });
        } else {
          console.log('SimpleTradingViewWidget: TradingView already loaded');
        }

        if (!isMounted) return;

        console.log('SimpleTradingViewWidget: Creating widget with symbol:', symbol);
        
        // Create widget
        new window.TradingView.widget({
          width,
          height,
          symbol,
          interval: "60",
          timezone: "Etc/UTC",
          theme,
          style: "1",
          locale: "en",
          toolbar_bg: theme === "dark" ? "#1f2937" : "#ffffff",
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: containerId
        });

        console.log('SimpleTradingViewWidget: Widget created successfully');

        if (isMounted) {
          setTimeout(() => {
            console.log('SimpleTradingViewWidget: Setting loading to false');
            setIsLoading(false);
          }, 3000);
        }
      } catch (err) {
        console.error('SimpleTradingViewWidget error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load chart');
          setIsLoading(false);
        }
      }
    };

    loadWidget();

    return () => {
      console.log('SimpleTradingViewWidget: Component unmounting');
      isMounted = false;
    };
  }, [symbol, theme, height, width, containerId]);

  if (error) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center border rounded-lg bg-card">
        <div className="text-center">
          <p className="text-destructive">Chart failed to load</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {isLoading && (
        <div className="w-full h-[500px] flex items-center justify-center border rounded-lg bg-card">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">Loading chart...</p>
          </div>
        </div>
      )}
      <div 
        ref={containerRef}
        id={containerId} 
        className={`w-full ${isLoading ? 'hidden' : 'block'}`}
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
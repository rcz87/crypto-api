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
    let isMounted = true;

    const loadWidget = async () => {
      try {
        // Load TradingView script if not already loaded
        if (!window.TradingView) {
          const script = document.createElement('script');
          script.src = 'https://s3.tradingview.com/tv.js';
          script.async = true;
          document.head.appendChild(script);

          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load TradingView script'));
          });
        }

        if (!isMounted) return;

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

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('TradingView widget error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load chart');
          setIsLoading(false);
        }
      }
    };

    loadWidget();

    return () => {
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
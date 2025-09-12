import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, TrendingUp, Volume2, Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

declare global {
  interface Window { TradingView?: any }
}

interface TradingViewWidgetProps {
  data?: any;
  isConnected?: boolean;
  tvSymbol?: string;        // contoh: "OKX:SOLUSDTPERP" | "BINANCE:SOLUSDT"
  displaySymbol?: string;   // contoh: "SOL/USDT"
}

let tvScriptLoading = false;
let tvScriptLoaded = false;

function ensureTvJs(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('[TradingView] ensureTvJs - checking availability...');
    
    if (window.TradingView?.widget) {
      console.log('[TradingView] tv.js already loaded');
      return resolve();
    }

    if (tvScriptLoaded) {
      console.log('[TradingView] Script marked as loaded, waiting for TradingView...');
      // Wait a bit more for TradingView to be available
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.TradingView?.widget) {
          clearInterval(checkInterval);
          resolve();
        } else if (attempts > 50) { // 5 seconds max
          clearInterval(checkInterval);
          reject(new Error("TradingView not available after script load"));
        }
      }, 100);
      return;
    }

    if (tvScriptLoading) {
      console.log('[TradingView] Script loading in progress, waiting...');
      // tunggu sampai ready
      const iv = setInterval(() => {
        if (window.TradingView?.widget) {
          clearInterval(iv);
          tvScriptLoaded = true;
          resolve();
        }
      }, 100);
      return;
    }

    console.log('[TradingView] Loading tv.js script from CDN...');
    tvScriptLoading = true;
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.onload = () => {
      console.log('[TradingView] tv.js script loaded successfully');
      tvScriptLoading = false;
      tvScriptLoaded = true;
      
      // Additional wait for TradingView to be available
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.TradingView?.widget) {
          console.log('[TradingView] TradingView.widget now available');
          clearInterval(checkInterval);
          resolve();
        } else if (attempts > 50) { // 5 seconds max
          clearInterval(checkInterval);
          reject(new Error("TradingView.widget not available after script load"));
        }
      }, 100);
    };
    s.onerror = (e) => {
      console.error('[TradingView] Failed to load tv.js script:', e);
      tvScriptLoading = false;
      reject(new Error("Gagal memuat TradingView tv.js"));
    };
    document.head.appendChild(s);
  });
}

export function TradingViewWidget({
  data,
  isConnected,
  tvSymbol = "OKX:SOLUSDTPERP",
  displaySymbol = "SOL/USDT-PERP",
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef(`tv_${Math.random().toString(36).slice(2)}`); // ID stabil seumur komponen
  const widgetRef = useRef<any>(null);
  const isMobile = useIsMobile();

  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        console.log('[TradingView] Init started for symbol:', tvSymbol);
        setIsLoading(true);
        setErr(null);
        
        console.log('[TradingView] Loading tv.js script...');
        await ensureTvJs();
        
        if (cancelled) {
          console.log('[TradingView] Init cancelled');
          return;
        }
        
        if (!containerRef.current) {
          console.log('[TradingView] Container ref is null');
          return;
        }

        console.log('[TradingView] Cleaning up previous widget...');
        // Cleanup widget lama jika ada (navigasi / symbol berubah)
        try { 
          if (widgetRef.current?.remove) {
            widgetRef.current.remove();
          }
        } catch (e) {
          console.log('[TradingView] Error removing widget:', e);
        }
        
        // Safe container cleanup
        try {
          if (containerRef.current.firstChild) {
            containerRef.current.innerHTML = "";
          }
        } catch (e) {
          console.log('[TradingView] Error clearing container:', e);
        }

        // Buat div target dengan ID stabil
        const mount = document.createElement("div");
        mount.id = widgetIdRef.current;
        mount.style.height = "100%";
        mount.style.width = "100%";
        
        try {
          containerRef.current.appendChild(mount);
          console.log('[TradingView] Mount div created with ID:', widgetIdRef.current);
        } catch (e) {
          console.log('[TradingView] Error appending mount div:', e);
          return;
        }

        if (!window.TradingView?.widget) {
          throw new Error('TradingView.widget is not available after loading tv.js');
        }

        const cfg = {
          symbol: tvSymbol,
          interval: "60",
          container_id: widgetIdRef.current,
          timezone: "Etc/UTC",
          theme: "dark",
          autosize: true,
          allow_symbol_change: false,
          studies: [
            "Volume@tv-basicstudies",
            "RSI@tv-basicstudies",
            "MACD@tv-basicstudies",
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
            "mainSeriesProperties.candleStyle.wickDownColor": "#EF4444",
          },
        };

        console.log('[TradingView] Creating widget with config:', cfg);
        widgetRef.current = new window.TradingView.widget(cfg);
        console.log('[TradingView] Widget created successfully');
        setIsLoading(false);
        
      } catch (e: any) {
        console.error('[TradingView] Init error:', e);
        setErr(e?.message || "Gagal memuat chart TradingView");
        setIsLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      console.log('[TradingView] Cleanup started');
      try { 
        if (widgetRef.current?.remove) {
          widgetRef.current.remove();
        }
      } catch (e) {
        console.log('[TradingView] Cleanup widget error:', e);
      }
      
      try {
        if (containerRef.current && containerRef.current.firstChild) {
          containerRef.current.innerHTML = "";
        }
      } catch (e) {
        console.log('[TradingView] Cleanup container error:', e);
      }
    };
    // re-init saat ganti symbol saja
  }, [tvSymbol]);

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
          {err && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="p-3 bg-red-500/20 rounded-full">
                  <TrendingUp className="h-6 w-6 text-red-400" />
                </div>
                <div className="text-sm text-red-400">
                  {err}
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
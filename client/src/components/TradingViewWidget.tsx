"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, Volume2, BarChart3 } from "lucide-react";

/**
 * Hardened TradingViewWidget
 * - SSR-safe (guards window/document)
 * - Idempotent script loader (no duplicate <script> & no re-append storms)
 * - Re-initialize on symbol/interval/theme changes only
 * - Proper cleanup of DOM container to avoid ghost canvases
 * - Defensive parsing for mixed OKX/Binance ticker shapes
 */

type TVTheme = "light" | "dark";

type TickerShape = {
  price?: string | number;
  last?: string | number;
  vol24h?: string | number;
  volume?: string | number;
  change24h?: string; // e.g. +1.23%
  changePercent?: string | number; // e.g. 1.23 (binance style)
  high24h?: string | number;
  low24h?: string | number;
};

export interface TradingViewWidgetProps {
  data?: { ticker?: TickerShape } | any;
  isConnected?: boolean;
  /** e.g. "OKX:SOLUSDTPERP" | "BINANCE:SOLUSDT" | "OKX:BTCUSDTPERP" */
  tvSymbol?: string;
  /** Display symbol for UI (e.g. "SOL/USDT", "BTC/USDT") */
  displaySymbol?: string;
  interval?: "1" | "5" | "15" | "60" | "240" | "1H" | "4H" | "1D";
  theme?: TVTheme;
  studies?: string[]; // TradingView study identifiers
}

declare global {
  interface Window {
    TradingView?: any;
    __tvScriptPromise__?: Promise<void>;
  }
}

const isBrowser = typeof window !== "undefined";
const TV_SRC = "https://s3.tradingview.com/tv.js";

function loadTradingViewScript(): Promise<void> {
  if (!isBrowser) return Promise.resolve();
  if (window.TradingView && window.TradingView.widget) return Promise.resolve();
  if (window.__tvScriptPromise__) return window.__tvScriptPromise__;

  window.__tvScriptPromise__ = new Promise<void>((resolve, reject) => {
    // If a previous tag exists but TV not ready, reuse it by listening onload
    const existing = document.getElementById("tradingview-widget-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("TradingView script failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = "tradingview-widget-script";
    s.src = TV_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("TradingView script failed"));
    document.head.appendChild(s);
  });
  return window.__tvScriptPromise__;
}

function parseNumber(n: unknown, d = 0): number {
  const x = typeof n === "string" ? parseFloat(n) : typeof n === "number" ? n : NaN;
  return Number.isFinite(x) ? x : d;
}

export function TradingViewWidget({
  data,
  isConnected,
  tvSymbol = "OKX:SOLUSDTPERP",
  displaySymbol = "SOL/USDT-PERP",
  interval = "1H",
  theme = "dark",
  studies = ["Volume", "RSI@tv-basicstudies", "MACD@tv-basicstudies"],
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const didInit = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [containerId] = useState(() => `tradingview_widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  const ticker = data?.ticker as TickerShape | undefined;
  const price = useMemo(() => {
    return parseNumber(ticker?.price ?? ticker?.last, 0);
  }, [ticker?.price, ticker?.last]);

  const vol = useMemo(() => {
    return parseNumber(ticker?.volume ?? ticker?.vol24h, 0);
  }, [ticker?.volume, ticker?.vol24h]);

  const changePctText = useMemo(() => {
    if (typeof ticker?.change24h === "string") return ticker!.change24h;
    const pct = parseNumber(ticker?.changePercent, 0);
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
  }, [ticker?.change24h, ticker?.changePercent]);

  const tvInterval = useMemo(() => {
    // Normalize to TradingView intervals
    const map: Record<string, string> = { "1": "1", "5": "5", "15": "15", "60": "60", "240": "240", "1H": "60", "4H": "240", "1D": "D" };
    return map[String(interval)] ?? "60";
  }, [interval]);

  const cleanupWidget = useCallback(() => {
    if (widgetRef.current) {
      try {
        if (typeof widgetRef.current.remove === 'function') {
          widgetRef.current.remove();
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      widgetRef.current = null;
    }
    
    // Clear the container manually to prevent DOM conflicts
    if (containerRef.current) {
      try {
        containerRef.current.innerHTML = '';
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }, []);

  const initWidget = useCallback(async () => {
    if (!isBrowser) return;
    if (!containerRef.current) return;

    setIsLoading(true);
    setHasError(false);

    try {
      await loadTradingViewScript();
      if (!window.TradingView?.widget) throw new Error("TradingView not available after load");

      // Clean up any existing widget first
      cleanupWidget();

      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval: tvInterval,
        timezone: "Etc/UTC",
        theme,
        style: "1",
        locale: "en",
        toolbar_bg: theme === "dark" ? "#1f2937" : "#f3f4f6",
        enable_publishing: false,
        withdateranges: true,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        details: true,
        hotlist: false,
        calendar: false,
        container_id: containerId,
        studies,
        width: "100%",
        height: "500",
        overrides: {
          "paneProperties.background": theme === "dark" ? "#111827" : "#ffffff",
          "paneProperties.vertGridProperties.color": theme === "dark" ? "#374151" : "#e5e7eb",
          "paneProperties.horzGridProperties.color": theme === "dark" ? "#374151" : "#e5e7eb",
          "symbolWatermarkProperties.transparency": 90,
          "scalesProperties.textColor": theme === "dark" ? "#9CA3AF" : "#6b7280",
          "mainSeriesProperties.candleStyle.upColor": "#10B981",
          "mainSeriesProperties.candleStyle.downColor": "#EF4444",
          "mainSeriesProperties.candleStyle.borderUpColor": "#10B981",
          "mainSeriesProperties.candleStyle.borderDownColor": "#EF4444",
          "mainSeriesProperties.candleStyle.wickUpColor": "#10B981",
          "mainSeriesProperties.candleStyle.wickDownColor": "#EF4444",
        },
        loading_screen: {
          backgroundColor: theme === "dark" ? "#111827" : "#ffffff",
          foregroundColor: "#10B981",
        },
      });

      // Wait for widget to fully initialize
      setTimeout(() => setIsLoading(false), 800);
    } catch (e) {
      console.error("TV init error", e);
      setHasError(true);
      setIsLoading(false);
    }
  }, [tvSymbol, tvInterval, theme, studies, cleanupWidget]);

  // Initialize on mount & when inputs that require re-creation change
  useEffect(() => {
    if (didInit.current) return; // guard StrictMode
    didInit.current = true;
    initWidget();
    
    // Cleanup on unmount
    return () => {
      cleanupWidget();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initWidget, cleanupWidget]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <CardTitle>{displaySymbol} Futures Chart</CardTitle>
            <Badge variant={isConnected ? "default" : "destructive"} className="ml-2">
              <Activity className="h-3 w-3 mr-1" />
              {isConnected ? "Real-time" : "Disconnected"}
            </Badge>
          </div>
          {ticker && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Volume2 className="h-4 w-4" />
                <span>24h Vol: {vol.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
        {ticker && (
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Current Price:</span>
              <span className="text-xl font-bold text-foreground">${price.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">24h Change:</span>
              <span className={`font-semibold ${changePctText.startsWith("-") ? "text-red-500" : "text-emerald-500"}`}>{changePctText}</span>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>
                High: $
                {parseNumber((ticker as any)?.high24h, 0).toFixed(2)}
              </span>
              <span>
                Low: $
                {parseNumber((ticker as any)?.low24h, 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div
          id={containerId}
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
            <span>⚡ Real-time SOL Futures</span>
            <span>🕯️ Professional Candlestick Chart</span>
          </div>
          <div className="flex items-center gap-4">
            <span>✅ Volume • RSI • MACD</span>
            <span>
              {isLoading && "🟡 Loading Widget..."}
              {!isLoading && !hasError && "🟢 Chart Ready"}
              {hasError && "🔴 Load Failed"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
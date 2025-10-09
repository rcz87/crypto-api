// src/components/TradingViewWidget.tsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, Volume2, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

declare global {
  interface Window {
    TradingView?: any;
  }
}

interface TradingViewWidgetProps {
  data?: any;
  isConnected?: boolean;
  tvSymbol?: string;        // contoh: "BINANCE:SOLUSDTPERP" | "BINANCE:SOLUSDT"
  displaySymbol?: string;   // contoh: "SOL/USDT"
}

/** ---- State global untuk mencegah tv.js dimuat berkali-kali ---- */
let TV_JS_LOADING = false;
let TV_JS_LOADED = false;

/** ---- Logger kecil biar rapih di console ---- */
const TVW_TAG = "[TVW]";
function log(...args: any[]) {
  // kalau perlu dimatikan, tinggal return;
  // return;
  console.log(TVW_TAG, ...args);
}

/** ---- Pastikan tv.js sudah ter-load & TradingView.widget tersedia ---- */
function ensureTvJs(timeoutMs = 12000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TradingView?.widget) {
      TV_JS_LOADED = true;
      log("tv.js sudah siap");
      return resolve();
    }
    if (TV_JS_LOADED) {
      // tv.js pernah loaded tapi global belum siap — tunggu sebentar
      const start = Date.now();
      const iv = setInterval(() => {
        if (window.TradingView?.widget) {
          clearInterval(iv);
          log("TradingView.widget muncul (post-load)");
          return resolve();
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          return reject(new Error("Timeout menunggu TradingView.widget"));
        }
      }, 100);
      return;
    }

    // Kalau lagi loading, cukup tunggu
    if (TV_JS_LOADING) {
      log("Menunggu tv.js (loading in-flight)...");
      const start = Date.now();
      const iv = setInterval(() => {
        if (window.TradingView?.widget) {
          clearInterval(iv);
          TV_JS_LOADED = true;
          return resolve();
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          return reject(new Error("Timeout menunggu TradingView.widget (in-flight)"));
        }
      }, 100);
      return;
    }

    // Mulai load tv.js sekali saja
    TV_JS_LOADING = true;
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/tv.js";
    s.async = true;
    s.defer = true;
    s.setAttribute("data-tvjs", "1");
    s.onload = () => {
      TV_JS_LOADING = false;
      TV_JS_LOADED = true;
      log("tv.js loaded");
      // Kadang global widget ready satu/tiga tick setelah onload
      const start = Date.now();
      const iv = setInterval(() => {
        if (window.TradingView?.widget) {
          clearInterval(iv);
          return resolve();
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          return reject(new Error("tv.js loaded tapi TradingView.widget tidak muncul"));
        }
      }, 100);
    };
    s.onerror = (e) => {
      TV_JS_LOADING = false;
      log("Gagal load tv.js", e);
      return reject(new Error("Gagal memuat TradingView tv.js"));
    };

    // Cegah duplikasi script di <head>
    if (!document.querySelector('script[data-tvjs="1"]')) {
      document.head.appendChild(s);
      log("Append tv.js ke <head>");
    } else {
      TV_JS_LOADING = false;
      TV_JS_LOADED = true;
      log("Script tv.js sudah ada di <head>");
      return resolve();
    }
  });
}

export function TradingViewWidget({
  data,
  isConnected,
  tvSymbol = "BINANCE:SOLUSDT", // Default to SOL if not provided
  displaySymbol = "SOL/USDT-PERP",
}: TradingViewWidgetProps) {
  const isMobile = useIsMobile();

  /** Container root untuk widget */
  const rootRef = useRef<HTMLDivElement>(null);

  /** ID mount stabil (hindari Date.now() di deps) */
  const mountIdRef = useRef(`tv_${Math.random().toString(36).slice(2)}`);

  /** Simpan instance widget untuk cleanup */
  const widgetRef = useRef<any>(null);

  /** Hindari init ganda (race) */
  const initInFlightRef = useRef(false);

  /** Tandai unmount agar async berhenti */
  const destroyedRef = useRef(false);

  /** Pastikan container attached ke DOM sebelum init */
  const [attached, setAttached] = useState(false);
  useLayoutEffect(() => {
    setAttached(!!rootRef.current?.isConnected);
  }, []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  function safeClearRoot() {
    const root = rootRef.current;
    if (!root) return;
    try {
      // Safe DOM cleanup - remove children one by one instead of innerHTML
      while (root.firstChild) {
        root.removeChild(root.firstChild);
      }
      log("DOM cleared safely with manual removeChild");
    } catch (e) {
      // Fallback to innerHTML if removeChild fails
      try {
        root.innerHTML = "";
        log("Fallback to innerHTML cleanup");
      } catch (e2) {
        log("safeClearRoot error (ignored)", e2);
      }
    }
  }

  async function initWidget(symbol: string) {
    if (initInFlightRef.current) {
      log("Lewati init: masih in-flight");
      return;
    }
    initInFlightRef.current = true;
    setLoading(true);
    setErr(null);

    console.groupCollapsed(`${TVW_TAG} init → symbol=${symbol}`);
    try {
      await ensureTvJs(12000);
      if (destroyedRef.current) {
        log("Batal: komponen sudah unmounted");
        return;
      }
      if (!rootRef.current) throw new Error("rootRef kosong");
      if (!rootRef.current.isConnected) throw new Error("root belum ter-attach");

      // Cleanup instance lama bila ada
      try {
        if (widgetRef.current?.remove) {
          widgetRef.current.remove();
          log("Widget lama di-remove");
        }
      } catch (e) {
        log("remove widget lama error (ignored)", e);
      }
      safeClearRoot();

      // Buat mount node dengan ID stabil
      const mount = document.createElement("div");
      mount.id = mountIdRef.current;
      mount.style.height = "100%";
      mount.style.width = "100%";
      rootRef.current.appendChild(mount);
      log("Mount node ditambahkan:", mount.id);

      // Tunggu satu frame agar DOM settle
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      if (!window.TradingView?.widget) {
        throw new Error("TradingView.widget belum tersedia");
      }
      
      // Use the symbol directly as it's already in TradingView format (e.g., "BINANCE:BTCUSDT")
      const cfg = {
        symbol: symbol,
        interval: "60",
        container_id: mountIdRef.current,
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
          "paneProperties.background": "#1f2937",
          "paneProperties.vertGridProperties.color": "#374151",
          "paneProperties.horzGridProperties.color": "#374151",
          "symbolWatermarkProperties.transparency": 90,
          "scalesProperties.textColor": "#d1d5db",
          "scalesProperties.lineColor": "#6b7280",
          "mainSeriesProperties.candleStyle.upColor": "#10b981",
          "mainSeriesProperties.candleStyle.downColor": "#ef4444",
          "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
          "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
          "volumePaneSize": "medium",
        },
      } as const;
      
      log("Trying TradingView symbol:", tvSymbol, "from original:", symbol);

      log("Create widget dengan config:", cfg);
      widgetRef.current = new window.TradingView.widget(cfg);

      // Observasi sampai iframe muncul (indikasi sukses mount UI)
      const START = Date.now();
      const MAX = 15000;
      while (true) {
        if (destroyedRef.current) return;
        const iframe = rootRef.current!.querySelector("iframe");
        if (iframe) {
          log("Iframe terdeteksi → UI OK");
          break;
        }
        if (Date.now() - START > MAX) {
          log("TIMEOUT: iframe tidak muncul dalam", MAX, "ms");
          throw new Error("Timeout menunggu iframe TradingView");
        }
        await new Promise((r) => setTimeout(r, 150));
      }

      setLoading(false);
      log("Init selesai OK");
    } catch (e: any) {
      log("Init error:", e?.message || e);
      setErr(e?.message || "Gagal memuat chart TradingView");
      setLoading(false);
    } finally {
      initInFlightRef.current = false;
      console.groupEnd();
    }
  }

  // Init pertama & re-init ketika ganti symbol SAJA
  useEffect(() => {
    destroyedRef.current = false;

    // Jika belum attached (mis. tab/section belum aktif), tunda sejenak
    if (!attached) {
      const t = setTimeout(() => setAttached(!!rootRef.current?.isConnected), 50);
      return () => clearTimeout(t);
    }

    initWidget(tvSymbol);

    return () => {
      destroyedRef.current = true;
      try {
        widgetRef.current?.remove?.();
      } catch {}
      safeClearRoot();
      log("Cleanup done");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvSymbol, attached]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <CardTitle>{displaySymbol} Futures Chart</CardTitle>
            <Badge
              variant={isConnected ? "default" : "destructive"}
              className="ml-2"
            >
              <Activity className="h-3 w-3 mr-1" />
              {isConnected ? "Real-time" : "Disconnected"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {data?.ticker && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Volume2 className="h-4 w-4" />
                <span>
                  24h Vol:{" "}
                  {parseFloat(
                    data.ticker.volume || data.ticker.vol24h || "0"
                  ).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {data?.ticker && (
          <div
            className={`${
              isMobile ? "space-y-3" : "flex items-center gap-6"
            } text-sm`}
          >
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Current Price:</span>
              <span
                className={`${
                  isMobile ? "text-lg" : "text-xl"
                } font-bold text-foreground`}
              >
                $
                {parseFloat(
                  data.ticker.price || data.ticker.last || "0"
                ).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">24h Change:</span>
              <span
                className={`font-semibold ${
                  parseFloat(
                    (data.ticker.change24h ||
                      data.ticker.changePercent ||
                      "0"
                    ).replace("%", "")
                  ) >= 0
                    ? "text-emerald-500"
                    : "text-red-500"
                }`}
              >
                {data.ticker.change24h ||
                  `${parseFloat(data.ticker.changePercent || "0") >= 0 ? "+" : ""}${parseFloat(
                    data.ticker.changePercent || "0"
                  ).toFixed(2)}%`}
              </span>
            </div>
            <div
              className={`flex items-center ${
                isMobile ? "justify-between" : "gap-4"
              } text-muted-foreground`}
            >
              <span>
                High: ${parseFloat(data.ticker.high24h || "0").toFixed(2)}
              </span>
              <span>
                Low: ${parseFloat(data.ticker.low24h || "0").toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div
          ref={rootRef}
          className={`w-full ${
            isMobile ? "h-[300px] sm:h-[400px]" : "h-[500px]"
          } bg-gray-900 border border-gray-700 rounded-lg touch-pan-x touch-pan-y select-none relative`}
          data-testid="tradingview-chart"
        >
          {/* Loading State */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <div className="text-sm text-gray-400">Loading TradingView Chart...</div>
              </div>
            </div>
          )}
          
          {/* Error State */}
          {err && !loading && (
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
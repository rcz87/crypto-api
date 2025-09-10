# Replit Debug Playbook — TV Chart Hilang/Loading, WS Putus, Data REST Kosong

**Gejala (dari screenshot):**
- Banner “Memuat Komponen” tidak selesai.
- Status Sistem: WebSocket ❌ Terputus, API SOL ❌ Tidak Ada, Candles ❌ Tidak Ada → *UI tidak menerima data.*
- Network tab menunjukkan **banyak tv.js & widget chunk** (OK), tapi **data REST/WS tidak terisi**.

---

## TL;DR (urut eksekusi)
1) **Pastikan API Base benar** → set `NEXT_PUBLIC_API_BASE` di `.env` FE.  
2) **Perbaiki query React Query** → *wajib* ada `queryFn` & `enabled` bergantung pada `apiBase`.
3) **Stabilkan TradingViewWidget** → pakai loader singleton + StrictMode guard (versi canvas sudah siap).
4) **Perbaiki useWebSocket** → heartbeat + reconnect + url dari `NEXT_PUBLIC_WS_BASE`.
5) **CSP/Preview** → allow `s3.tradingview.com` dan `*.tradingview.com`; buka di tab preview terpisah.
6) **Backend health** → `/health`, `/api/metrics`, `/api/sol/complete` harus 200; jika 403/CORS, betulkan CORS di server.

---

## 1) FE Environment (PENTING)
Buat `.env` di proyek FE:
```ini
# FE
NEXT_PUBLIC_API_BASE=https://guardiansofthegreentoken.com
NEXT_PUBLIC_WS_BASE=wss://guardiansofthegreentoken.com/ws  # sesuaikan dengan gateway WS-mu
```
> Replit kadang tidak memuat env kalau hanya `env` panel. Pastikan restart dev server setelah mengubah.

Di FE, fungsi `getApiBase()` dan `getWsBase()` (jika belum ada):
```ts
export const getApiBase = () => (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '')
export const getWsBase  = () => (process.env.NEXT_PUBLIC_WS_BASE  || '')
```

---

## 2) React Query — queryFn WAJIB + enabled
> Sudah ada contoh di canvas *Dashboard_fixed_with_safe_fetchers_and_SSR_guards*. Pastikan template ini dipakai.

Patch utama (contoh):
```ts
const apiBase = getApiBase();

const health = useQuery({
  queryKey: ['/health', apiBase],
  queryFn: () => fetchJSON('/health'),
  enabled: !!apiBase,
  staleTime: Infinity,
  retry: 1,
});
```
Jika `apiBase` kosong → **jangan fetch** (menghindari 404 relatif).

---

## 3) TradingViewWidget stabil (no flicker)
Pakai komponen di canvas **“TradingViewWidget—SSR-safe, Idempotent Loader, Symbol Switch”**:
- Loader script **singleton** (`window.__tvScriptPromise__`).
- **StrictMode guard** untuk cegah `useEffect` double-run.
- **Selalu render** widget (jangan conditional mount by `data`).
- **Re-init hanya** saat `tvSymbol/interval/theme/studies` berubah.

**MUST DO:** Jangan `remove()` script existing; jangan mount widget di tab yang pakai `display:none` saat inisialisasi—gunakan `visibility:hidden`.

---

## 4) useWebSocket — Reconnect & Heartbeat
Implementasi minimal (TypeScript):
```ts
// hooks/useWebSocket.ts (ringkas)
import { useEffect, useRef, useState } from 'react';
import { getWsBase } from '@/lib/env';

const HEARTBEAT_MS = 15000;
const RECONNECT_MS = 5000;

export function useWebSocket() {
  const [isConnected, setConnected] = useState(false);
  const [connectionStatus, setStatus] = useState('disconnected');
  const [marketData, setMarketData] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const hbRef = useRef<any>(null);
  const url = getWsBase();

  useEffect(() => {
    if (!url) return;

    let stop = false;
    function connect() {
      setStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (stop) return;
        setConnected(true);
        setStatus('connected');
        // subscribe example
        ws.send(JSON.stringify({ op: 'subscribe', args: [ { channel: 'tickers', instId: 'SOL-USDT-SWAP' }, { channel: 'books', instId: 'SOL-USDT-SWAP' } ] }));
        // heartbeat
        hbRef.current = setInterval(() => ws.send(JSON.stringify({ op: 'ping', t: Date.now() })), HEARTBEAT_MS);
      };
      ws.onmessage = ev => {
        try { setMarketData(JSON.parse(ev.data)); } catch {}
      };
      ws.onclose = () => {
        setConnected(false); setStatus('disconnected');
        if (hbRef.current) { clearInterval(hbRef.current); hbRef.current = null; }
        if (!stop) setTimeout(connect, RECONNECT_MS);
      };
      ws.onerror = () => { /* swallow; onclose will handle */ };
    }

    connect();
    return () => { stop = true; if (hbRef.current) clearInterval(hbRef.current); wsRef.current?.close(); };
  }, [url]);

  return { isConnected, marketData, connectionStatus: status: connectionStatus };
}
```
> Pastikan URL WS benar; kalau tidak punya gateway WS sendiri, gunakan REST dulu (status stream non-blocking).

---

## 5) CSP / Replit Preview
Jika kamu set CSP, tambahkan:
```
script-src 'self' https://s3.tradingview.com;
frame-src https://*.tradingview.com;
connect-src https://*.tradingview.com https://s3.tradingview.com https://guardiansofthegreentoken.com wss://guardiansofthegreentoken.com;
```
Buka preview di **Tab Baru** (bukan panel kecil) dan nonaktifkan adblocker.

---

## 6) Backend Health & CORS
Di server (Flask/FastAPI), pastikan:
- `/health` return `{status:'operational'}` 200.
- `/api/metrics` 200.
- `/api/sol/complete` 200 dan **CORS allow** origin Replit dev.

**Contoh CORS (Flask-CORS):**
```py
from flask_cors import CORS
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://*.replit.dev", "http://localhost:3000", "https://guardiansofthegreentoken.com"]}})
```

---

## 7) Sanity Test — 60 detik
1. `curl -v https://guardiansofthegreentoken.com/health` → `{status:"operational"}`.
2. FE env terset → reload dev server.
3. Halaman dashboard: System Status harus berubah ke **Online** & **REST only / WS** sesuai.
4. TradingView chart **tetap tampil** > 5 detik tanpa hilang.

---

## 8) Kalau tetap hilang…
- Sementara **disable React.StrictMode** di `app` dev untuk konfirmasi; jika fix → aktifkan lagi + gunakan **guard `didInit`**.
- Pastikan tab tempat TV render **visible** saat init (jangan pakai `display:none`).
- Cek console untuk error CSP atau `TradingView not available`.

---

## 9) Next Steps (opsional tapi direkomendasikan)
- Tambah **Fallback Chart** (lightweight candlestick) kalau TradingView gagal 3x.
- Tambah **telemetry**: log tv-init-success/failed ke `SystemLogs` + Telegram alert.

---

**Siap commit?** Aku bisa siapkan patch file: `.env.example`, `lib/env.ts`, `hooks/useWebSocket.ts`, dan update `Dashboard.tsx` agar status berubah menjadi Online & chart stabil.


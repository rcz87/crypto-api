# Hotfix Pack — “Failed to fetch (localhost)”, WS Error, TradingView DOMException

Mengacu ke log kamu:
```
API Request: http://localhost:5000/health
.../api/metrics
.../api/sol/complete
WebSocket error: Event {isTrusted: true}
Failed to fetch
DOMException: removeChild ... not a child
```
Masalahnya kombinasi:
1) **Base URL salah** (pakai `http://localhost:5000` di Replit → tidak bisa diakses dari browser user).
2) **WS URL kosong/keliru** → koneksi gagal.
3) **TradingView DOM race** → `removeChild` dipanggil pada node yang sudah diganti/di-append ulang (StrictMode/rehydration).

---

## ✅ Fix 1 — Jangan pakai `localhost` di FE
Buat/ubah `.env` Frontend:
```ini
# FE
NEXT_PUBLIC_API_BASE=https://guardiansofthegreentoken.com
NEXT_PUBLIC_WS_BASE=wss://guardiansofthegreentoken.com/ws    # sesuaikan gateway WS-mu
```
> Setelah ubah env, **restart** dev server Replit (stop → run).

`lib/env.ts`:
```ts
export const isBrowser = typeof window !== 'undefined';
export const getApiBase = () => (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
export const getWsBase  = () => (process.env.NEXT_PUBLIC_WS_BASE  || '');
```

`lib/fetchJSON.ts` (hindari path relatif & error silent):
```ts
import { getApiBase } from './env';

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = base ? `${base}${path}` : path; // tolerate SSR empty base
  const res = await fetch(url, { ...init, mode: 'cors', cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url} — ${text?.slice(0,200)}`);
  }
  return res.json() as Promise<T>;
}
```

**Di React Query** → WAJIB pakai `queryFn` + `enabled: !!getApiBase()`.

---

## ✅ Fix 2 — WebSocket: URL, Heartbeat, Reconnect
`hooks/useWebSocket.ts` (ringkas, aman):
```ts
import { useEffect, useRef, useState } from 'react';
import { getWsBase } from '@/lib/env';

const HEARTBEAT_MS = 15000; const RECONNECT_MS = 5000;
export function useWebSocket() {
  const [isConnected, setConnected] = useState(false);
  const [connectionStatus, setStatus] = useState('disconnected');
  const [marketData, setMarketData] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null); const hb = useRef<any>(null);
  const url = getWsBase();
  useEffect(() => {
    if (!url) return; let stop = false;
    const connect = () => {
      setStatus('connecting'); const ws = new WebSocket(url); wsRef.current = ws;
      ws.onopen = () => { if (stop) return; setConnected(true); setStatus('connected');
        ws.send(JSON.stringify({ op: 'subscribe', args: [
          { channel: 'tickers', instId: 'SOL-USDT-SWAP' },
          { channel: 'books',   instId: 'SOL-USDT-SWAP' } ] }));
        hb.current = setInterval(() => ws.send(JSON.stringify({ op: 'ping', t: Date.now() })), HEARTBEAT_MS);
      };
      ws.onmessage = ev => { try { setMarketData(JSON.parse(ev.data)); } catch {} };
      ws.onclose = () => { setConnected(false); setStatus('disconnected'); if (hb.current) { clearInterval(hb.current); hb.current = null; }
        if (!stop) setTimeout(connect, RECONNECT_MS); };
      ws.onerror = () => { /* swallow; onclose handles retry */ };
    };
    connect();
    return () => { stop = true; if (hb.current) clearInterval(hb.current); wsRef.current?.close(); };
  }, [url]);
  return { isConnected, marketData, connectionStatus };
}
```

---

## ✅ Fix 3 — TradingView DOMException (removeChild)
**Jangan** `removeChild` manual; cukup `container.innerHTML = ''` dan **jangan** menghapus `<script>` tv.js yang sudah ada. Gunakan loader singleton + guard StrictMode.

```ts
// singleton loader
if (!window.__tvScriptPromise__) {
  window.__tvScriptPromise__ = new Promise<void>((resolve, reject) => {
    const exist = document.getElementById('tradingview-widget-script') as HTMLScriptElement | null;
    if (exist) { exist.addEventListener('load', () => resolve()); exist.addEventListener('error', () => reject(new Error('tv load error'))); return; }
    const s = document.createElement('script'); s.id='tradingview-widget-script'; s.src='https://s3.tradingview.com/tv.js'; s.async=true; s.onload=() => resolve(); s.onerror=() => reject(new Error('tv load error')); document.head.appendChild(s);
  });
}
await window.__tvScriptPromise__;

// StrictMode guard di komponen
const didInit = useRef(false);
useEffect(() => { if (didInit.current) return; didInit.current = true; initWidget(); }, [initWidget]);

// Saat re-init (symbol/interval/theme berubah):
containerRef.current!.innerHTML = '';
const mount = document.createElement('div');
mount.id = `tv_${Date.now()}`; mount.style.height = '500px'; mount.style.width = '100%';
containerRef.current!.appendChild(mount);
new window.TradingView.widget({ container_id: mount.id, /* ... */ });
```
> Versi lengkap siap pakai ada di canvas **“TradingViewWidget—SSR-safe, Idempotent Loader, Symbol Switch”**.

---

## ✅ Fix 4 — CORS & Healthcheck Backend
Server harus mengizinkan origin Replit & domain FE kamu.

**Flask CORS contoh:**
```py
from flask_cors import CORS
CORS(app, resources={r"/*": {"origins": [
    "https://*.replit.dev", "http://localhost:3000", "https://guardiansofthegreentoken.com"
]}})
```
Health routes minimal:
```py
@app.get('/health')
def health():
  return {"status": "operational"}, 200
```

---

## ✅ Sanity Checklist (urut):
- [ ] `.env` FE diisi **tanpa** `localhost` → restart dev.
- [ ] `GET https://guardiansofthegreentoken.com/health` → 200 `{status:"operational"}` dari browser.
- [ ] Dashboard system status → **Online**; WS → **Connected**.
- [ ] Chart TradingView muncul > 5 detik (tanpa flicker/hilang).
- [ ] Tidak ada lagi error `Failed to fetch` atau `removeChild` di console.

---

## Bonus: Fallback Chart
Jika TradingView gagal 3x, render candlestick ringan (Recharts/ECharts) + notice. Ini menjaga UX saat CSP/iframe bermasalah.

---

Jika kamu setuju, aku bisa siapkan **diff siap-paste**: `.env.example`, `lib/env.ts`, `lib/fetchJSON.ts`, `hooks/useWebSocket.ts`, dan update `Dashboard.tsx`/`TradingViewWidget.tsx` sesuai patch di atas.


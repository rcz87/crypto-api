# WebSocket URL Hotfix — Hindari `wss://localhost:undefined`

Error kamu:
```
SyntaxError: Failed to construct 'WebSocket': The URL 'wss://localhost:undefined/?token=...' is invalid.
```
Ini terjadi karena **URL WS dibangun otomatis dari `window.location`** atau dari Vite HMR dengan host/port kosong, sehingga jatuh ke `localhost:undefined`.

Di bawah ini patch **aman & robust** untuk FE (Next.js/Vite) + opsi setelan Vite di Replit.

---

## 1) ENV Frontend (wajib)
Buat/isi `.env` **Frontend**:
```ini
# === FRONTEND ENV ===
NEXT_PUBLIC_API_BASE=https://guardiansofthegreentoken.com
NEXT_PUBLIC_WS_BASE=wss://guardiansofthegreentoken.com/ws    # ganti sesuai gateway WS kamu
# (opsional) untuk Replit/Vite HMR stabil
VITE_DEV_HOST=0.0.0.0
VITE_DEV_PORT=5173
```
> Restart dev server Replit setelah mengubah ENV.

---

## 2) Helper URL — tahan banting (http→ws, https→wss) & anti-localhost
Buat `src/lib/env.ts` (atau `@/lib/env.ts`):
```ts
export const isBrowser = typeof window !== 'undefined';

export function getApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
  if (env) return env;
  if (!isBrowser) return '';
  const { protocol, host } = window.location;
  const base = `${protocol}//${host}`; // e.g. https://<replit-hash>.replit.dev
  return base; // fallback aman
}

export function getWsBase(): string {
  const env = (process.env.NEXT_PUBLIC_WS_BASE || '').trim();
  if (env) return env; // gunakan ENV jika ada
  if (!isBrowser) return '';
  const { protocol, host } = window.location;
  // Map http→ws, https→wss
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  // Anti-localhost: jika host mengandung 'localhost' → gunakan domain produksi
  const safeHost = /localhost/i.test(host)
    ? 'guardiansofthegreentoken.com'
    : host;
  // Default path gateway WS kamu
  return `${wsProto}//${safeHost}/ws`;
}
```

---

## 3) Pakai helper di **useWebSocket** (heartbeat + reconnect)
`src/hooks/useWebSocket.ts`:
```ts
import { useEffect, useRef, useState } from 'react';
import { getWsBase } from '@/lib/env';

const HEARTBEAT_MS = 15000;
const RECONNECT_MS = 5000;

export function useWebSocket() {
  const [isConnected, setConnected] = useState(false);
  const [connectionStatus, setStatus] = useState<'disconnected'|'connecting'|'connected'>('disconnected');
  const [marketData, setMarketData] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const hbRef = useRef<any>(null);

  useEffect(() => {
    const url = getWsBase();
    if (!url) return;
    let stop = false;

    const connect = () => {
      setStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (stop) return;
        setConnected(true);
        setStatus('connected');
        // contoh subscribe OKX style
        ws.send(JSON.stringify({ op: 'subscribe', args: [
          { channel: 'tickers', instId: 'SOL-USDT-SWAP' },
          { channel: 'books',   instId: 'SOL-USDT-SWAP' },
        ] }));
        hbRef.current = setInterval(() => {
          try { ws.send(JSON.stringify({ op: 'ping', t: Date.now() })); } catch {}
        }, HEARTBEAT_MS);
      };

      ws.onmessage = (ev) => {
        try { setMarketData(JSON.parse(ev.data)); } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        setStatus('disconnected');
        if (hbRef.current) { clearInterval(hbRef.current); hbRef.current = null; }
        if (!stop) setTimeout(connect, RECONNECT_MS);
      };

      ws.onerror = () => { /* onclose will handle retry */ };
    };

    connect();
    return () => { stop = true; if (hbRef.current) clearInterval(hbRef.current); wsRef.current?.close(); };
  }, []);

  return { isConnected, marketData, connectionStatus };
}
```

---

## 4) Hentikan Vite HMR bikin WS ke `localhost:undefined`
Jika kamu pakai **Vite** (bukan Next App Router murni), atur HMR di `vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_DEV_HOST || '0.0.0.0',
    port: Number(process.env.VITE_DEV_PORT || 5173),
    hmr: {
      host: undefined,               // biarkan Vite auto-pick dari request
      protocol: 'wss',               // Replit pakai https → wss
      clientPort: 443,               // paksa port publik untuk WS HMR
    },
  },
});
```
> Replit environment sering berada di belakang proxy; pengaturan `hmr.clientPort=443` mencegah Vite mencoba `localhost:undefined`.

> **Kalau pakai Next.js (tanpa Vite)**: abaikan bagian ini; error `@vite/client` berarti ada tooling lain yang injek Vite dev client (misal plugin/preview). Pastikan hanya satu dev tool yang aktif.

---

## 5) Sanity Checklist (1 menit)
- [ ] `.env` FE berisi `NEXT_PUBLIC_WS_BASE` **bukan localhost**.
- [ ] `getWsBase()` mengembalikan `wss://<domain>/ws` saat prod & Replit.
- [ ] Console **tidak** lagi memunculkan `wss://localhost:undefined`.
- [ ] Status WebSocket di UI → **Connected**.
- [ ] Data real-time mulai mengalir (tickers/books).

---

## 6) FYI — Error Vite HMR tidak menghalangi app
Error HMR (dev only) bisa berisik tapi bukan blocker. Pastikan **WS aplikasi** (bukan HMR) sudah memakai URL benar dari helper di atas.

---

Butuh aku siapkan **patch file siap tempel** (env.ts, useWebSocket.ts, vite.config.ts, `.env.example`)?


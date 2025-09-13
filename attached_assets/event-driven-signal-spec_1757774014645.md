
# ⚡ Event-Driven Signal Notifier — Spec v1.0 (Untuk AI Agent Replit)

> **Misi:** Kirim **alert Telegram** _hanya_ saat ada **sinyal valid** berdasarkan analisa internal (tanpa loop periodik). Sistem bersifat **event-driven** dari WebSocket market data → evaluasi → gating → **notifikasi**.  
> **Konteks stack:** OKXFetcher + SharpSignalEngine + Telegram bot.  
> **Gaya output:** corporate + Gen Z; banyak tabel, checklist, & TL;DR.

---

## 🧭 TL;DR
- **Tidak pakai loop**; semua dipicu **event WebSocket** (tick/orderbook/mark).  
- Kirim alert **jika & hanya jika** lolos: `confluence ≥ 0.75`, `p_win ≥ τ`, `RR ≥ 1.5` (scalp: 1.2–1.5), **triggers 5m OK**, spread OK, **dedup zona** & **expiry** aktif.  
- **Anti-spam:** cooldown per simbol, deduplikasi zona berbasis ATR, expiry 30–45 menit.  
- Output dua format: **human-friendly** + **JSON signal** (untuk bot/otomasi).

---

## 🎯 Goals & Non-Goals
**Goals**
- Event-driven notifier dari WS → evaluasi → gating → Telegram.
- Zero polling loop; compute **hanya saat** sinyal berpotensi valid.
- Konsisten dengan Mode ANALYSIS: 8-layer, sniper 5m, RR minimal, expiry.

**Non-Goals**
- Tidak membahas UI dashboard (opsional).  
- Tidak mengeksekusi order (hanya alert).  
- Tidak mengubah engine analisis; hanya memanggil/menyatukan.

---

## ✅ Acceptance Criteria (Wajib Lulus)
- [ ] Sistem **tidak** menjalankan loop periodik; pemicu murni event (WS).  
- [ ] Alert hanya terbit saat **semua** kriteria “Good Signal” terpenuhi.  
- [ ] Pesan Telegram berisi: **entry/SL/TP**, alasan singkat, **Sniper 5m triggers**, **expiry**.  
- [ ] JSON signal disertakan (untuk bot), skema konsisten.  
- [ ] **Cooldown** dan **dedup** zona mencegah spam.  
- [ ] **Validasi numerik**: Long `SL < Entry < TP`; Short `TP < Entry < SL`.  
- [ ] **RR minimal 1.5** (scalp TTL15 boleh 1.2–1.5).  
- [ ] **Expiry 30–45 menit**; sinyal auto-cancel jika tidak trigger.  
- [ ] Implementasi **observability**: log, rate, error; minimal p95 latency & hit rate.

---

## 🧪 Definisi “Good Signal” (Gating Rules)

| Kriteria | Batas | Catatan |
|---|---:|---|
| Confluence score | ≥ **0.75** | dari 8-layer (SMC/CVD/RSI-EMA/MACD/Structure/OI/Funding/Orderflow/Fibo) |
| Probabilitas menang `p_win` | ≥ **τ_regime** | contoh: Trend 0.62, Range 0.58, HighVol 0.64, MeanRevert 0.60 |
| Risk-Reward (RR) | ≥ **1.5** | untuk `scalp_ttl_15`: 1.2–1.5 |
| Sniper 5m trigger | **Terpenuhi** | contoh: CHoCH 5m + reclaim EMA50 + delta+ |
| Spread | ≤ **0.08%** | hindari fill buruk |
| Expiry | **30–45 mnt** | auto-cancel jika tak trigger |
| Dedup zona | **> ATR(5m) × 0.2** dari sinyal aktif | cegah spam area sama |
| Cooldown | **≥ 8 mnt** per simbol | cegah flood alert beruntun |

---

## 🏗️ Arsitektur (Event-Driven, tanpa loop)

```
OKX WebSocket (trades/orderbook/mark)
          │
          ▼
     Event Bus (Redis Pub/Sub)
          │
          ├─▶ Feature Builder (merge WS snapshot + OKXFetcher + /api/{pair}/complete)
          │
          ├─▶ SharpSignalEngine.evaluate(features)
          │        └─ {confluence, p_win, regime, levels, rr_suggest, triggers_ok, atr5m, spreadPct}
          │
          ├─▶ Gatekeeper (Good Signal Rules)
          │
          └─▶ Notifier (Telegram)  ← KIRIM **hanya jika PASS**
```

**Catatan:** Tidak ada scheduler; refresh HTF (1D/4H) memakai **event candle close**, bukan timer.

---

## ⚙️ Konfigurasi (Contoh)
```ts
// watchlist.config.ts
export const WATCHLIST = ["BTC-USDT-SWAP","ETH-USDT-SWAP","SOL-USDT-SWAP","AVAX-USDT-SWAP"];

// rules.config.ts
export const RULES = {
  confluenceMin: 0.75,
  probMin: { TRENDING: 0.62, RANGING: 0.58, HIGH_VOL: 0.64, MEAN_REVERT: 0.60 },
  rrMin: 1.5,
  rrMinScalp: 1.2,
  spreadMaxPct: 0.08,
  expiryMinutes: 30,
  cooldownMinutes: 8,
  dedupAtrMult: 0.2
};
```

---

## 🧩 Pseudocode Detektor (Inti)
```ts
// detector.ts
okxWS.subscribe({ pairs: WATCHLIST, channels: ["trades","books5","mark-price"] }, async (evt) => {
  const pair = evt.pair;
  if (cooldown.hit(pair, RULES.cooldownMinutes)) return;

  const feat = await aiEngine.buildFeatures(pair, evt.snapshot);
  const ev   = await aiEngine.evaluate(feat); // {confluence,p_win,regime,levels,rr_suggest,triggers_ok,atr5m,spreadPct}

  const isScalp = feat.mode === "scalp_ttl_15";
  const rrMin   = isScalp ? RULES.rrMinScalp : RULES.rrMin;

  const pass =
    ev.confluence >= RULES.confluenceMin &&
    ev.p_win      >= RULES.probMin[ev.regime] &&
    ev.rr_suggest >= rrMin &&
    ev.triggers_ok === true &&
    ev.spreadPct  <= RULES.spreadMaxPct &&
    !recentZoneCache.isDuplicate(pair, ev.levels.entryZone, ev.atr5m * RULES.dedupAtrMult);

  if (!pass) return;

  cooldown.set(pair);
  recentZoneCache.remember(pair, ev.levels.entryZone);

  await telegram.send(formatMessage(pair, ev, RULES.expiryMinutes), ev.jsonSignal);
});
```

---

## 💬 Format Alert Telegram

**Human-friendly**
```
[SIGNAL] SOL-USDT-SWAP — 13 Sep 10:32 WIB
Bias 1D: Bullish (82%) | Regime: TRENDING | Confluence: 0.82

PRIMARY (Long):
• Entry: 221.8–222.4
• SL: 219.7 | TP1: 224.6 | TP2: 227.3 | RR: 1.9
• Alasan: BOS + reclaim OB 15m, delta > 0, OI naik sehat
• Invalid: Close 15m < 219.9

Sniper 5m:
• Long trigger: CHOCH 5m + reclaim EMA50 + delta+

Expiry: 30 menit (auto-cancel)
```

**JSON (untuk bot/otomasi)**
```json
{
  "symbol":"SOL-USDT-SWAP",
  "timestamp_wib":"2025-09-13T10:32:00+07:00",
  "regime":"TRENDING",
  "confluence":0.82,
  "prob_win":0.67,
  "scalp_ttl_15":true,
  "levels":{"entry":[221.8,222.4],"sl":219.7,"tp":[224.6,227.3]},
  "risk_reward":1.9,
  "expiry_minutes":30,
  "triggers":{"long":"CHOCH 5m + reclaim EMA50 + delta+"}
}
```

---

## 🛡️ Anti-Spam & Safety
| Proteksi | Cara |
|---|---|
| Cooldown per simbol | Tunda X menit setelah publish |
| Dedup zona | Tolak sinyal baru dengan entry zone terlalu dekat (≤ ATR×0.2) |
| Expiry | Auto-cancel jika tidak trigger dalam 30–45 menit |
| Validasi numerik | Long: `SL < Entry < TP` ; Short: `TP < Entry < SL` |
| Throttle event | Agregasi WS 1–2 detik/simbol sebelum evaluasi |

---

## 🔌 Endpoint Internal (Opsional, jika perlu HTTP)
- `POST /internal/signal/events` → terima snapshot stream.  
- `POST /internal/signal/publish` → kirim Telegram + simpan log.  
- `GET  /internal/signal/last?pair=SOL-USDT-SWAP` → untuk dashboard/status.

**Kontrak respons minimal:**
```json
{"success": true, "data": {...}, "timestamp": "2025-09-13T10:32:00Z"}
```

---

## 🧰 Deployment & ENV
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
OKX_WS_URL=wss://ws.okx.com:8443/ws/v5/public
REDIS_URL=redis://localhost:6379
TIMEZONE=Asia/Jakarta
```

**Repo layout (saran):**
```
/src
  /config
    rules.config.ts
    watchlist.config.ts
  /services
    okx.ts
    ai_engine.ts
    telegram_notifier.ts
    state.ts          # cooldown & dedup (Redis/memory)
  detector.ts
  index.ts           # bootstrap
.env.example
```

---

## 📋 Checklist Implementasi
- [ ] Subscribes WebSocket OKX (trades + orderbook/mark) untuk WATCHLIST.  
- [ ] `buildFeatures()` event-driven (tanpa loop) — baca cache OI/Funding/indicators.  
- [ ] `evaluate()` mengembalikan: `confluence, p_win, regime, rr_suggest, triggers_ok, levels, atr5m, spreadPct`.  
- [ ] Gatekeeper sesuai “Good Signal”.  
- [ ] Cooldown + dedup zona + expiry.  
- [ ] Telegram notifier (human text + JSON).  
- [ ] Logging ke DB/Redis untuk self-learning (signal/outcome).  
- [ ] Observability sederhana: hit rate, error rate, p95 end-to-end.

---

## 🧪 Testing Plan
**Unit**
- Gatekeeper truth table (boundary confluence 0.74/0.75, RR 1.49/1.50, spread 0.079/0.081).  
- Validasi numerik level.

**Integration**
- Stub `aiEngine.evaluate()` → pastikan hanya PASS yang men-trigger Telegram.  
- Dedup & cooldown berfungsi saat sinyal berulang di area sama.

**Contract**
- Telegram payload tidak melebihi limit & escape character markdown aman.  
- JSON schema signal konsisten (types & keys).

**E2E Skenario**
1) **Strong Trend Long**: confluence 0.82, p_win 0.66, RR 1.9 → alert terkirim.  
2) **Mixed / Fail**: confluence 0.71 → **tidak** terkirim (monitor only).

---

## 📈 Observability (minimum)
| Metrik | Target |
|---|---|
| p95 latency (evaluate→notified) | ≤ 350 ms |
| Error rate publish | < 1% |
| Alert hit rate (PASS/total evaluate) | 2–10% (tergantung market) |
| Duplicate suppression | ≥ 80% zona berulang ditahan |
| Expiry no-fill ratio | < 40% (turunkan dengan trigger lebih ketat) |

---

## 🧫 Snippet — Telegram Notifier (Node/TS)
```ts
const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

export const telegram = {
  async send(text: string, json?: object) {
    const api = (method: string, body: object) =>
      fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

    await api("sendMessage", { chat_id: CHAT_ID, text, parse_mode: "Markdown" });
    if (json) {
      await api("sendMessage", {
        chat_id: CHAT_ID,
        text: "```json\n" + JSON.stringify(json, null, 2) + "\n```",
        parse_mode: "Markdown"
      });
    }
  }
};
```

---

## 🤖 Prompt Siap Tempel — Untuk AI Agent Replit
```
TASK: Buat microservice Event-Driven Signal Notifier.
GOALS:
- Subscribe OKX WebSocket (trades/books/mark) untuk WATCHLIST.
- Pada event, build features → SharpSignalEngine.evaluate().
- Terapkan Gatekeeper: confluence≥0.75, p_win≥τ_regime, RR≥1.5 (scalp 1.2–1.5), triggers 5m OK, spread≤0.08%, dedup (ATR*0.2), cooldown 8m, expiry 30m.
- Kirim Telegram (human + JSON). Simpan log untuk self-learning.

OUTPUT FILES:
- /src/config/rules.config.ts
- /src/config/watchlist.config.ts
- /src/services/okx.ts
- /src/services/ai_engine.ts  (stub panggil endpoint internal yang sudah ada)
- /src/services/telegram_notifier.ts
- /src/services/state.ts      (cooldown & dedup, Redis/memory)
- /src/detector.ts
- /src/index.ts               (bootstrap WS + handler)
- .env.example (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, OKX_WS_URL, REDIS_URL, TIMEZONE)

ACCEPTANCE:
- Tidak ada loop periodik.
- Alert hanya publish ketika semua aturan PASS.
- Pesan Telegram: human + JSON, lengkap dengan expiry.
- Dedup & cooldown bekerja (uji 2 sinyal berdekatan).
- p95 end-to-end ≤ 350ms pada beban normal.
```

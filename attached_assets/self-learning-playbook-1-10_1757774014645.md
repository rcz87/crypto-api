
# 🧠 Self-Learning Playbook — GPT Trading System (v1.0)

> **Tujuan:** Membuat sistem trading AI yang **belajar mandiri** secara terukur: _rekam → label → latih → uji → **promote** → monitor_.  
> **Scope:** SharpSignalEngine + OKXFetcher + Telegram/WA Alerts.  
> **Gaya:** Corporate + Gen Z. Fokus ke **actionable**, bukan sekadar teori.

---

## ⚡ TL;DR (1 halaman)
- **Self-learning** = data in → _label_ → _model_ → _policy_ → _risk_ → _metrics_.  
- Mulai dari **L1 Calibration** (probabilitas & threshold), lanjut **L2 Bandit** (bobot 8-layer per regime), baru **L3 Meta/RL** (timing & sizing).  
- Gunakan **champion–challenger** + gating ketat (PR-AUC, Brier, P&L) sebelum naik produksi.  
- 10% trade **paper-trade** untuk eksplorasi aman.  
- Wajib **observability** (p95 latency, winrate bins, error rate) & **contract test** (JSON valid).

---

## 1) Arsitektur Self-Learning

| Komponen | Peran | Catatan Integrasi |
|---|---|---|
| **ExecutionRecorder** | Rekam semua sinyal & outcome | Simpan entry/SL/TP/expiry, MFE/MAE, time-to-fill, regime |
| **FeatureStore** | Materialisasi fitur | Redis (stream, TTL 48h) + PostgreSQL (arsip) |
| **Labeler** | Buat label Y | `win (1/0)`, `rr_realized`, `ttf`, `hit_tp_before_sl` |
| **Trainer (offline)** | Latih model | Logistic (prob win), XGB/LightGBM (move size), Calibrator |
| **Policy Learner** | Optimasi bobot & threshold | Contextual bandit per **regime × timeframe** |
| **Evaluator** | Backtest & A/B offline | PR-AUC, Brier score, P&L sim |
| **Promoter** | Champion–Challenger | Promote jika lolos SLO; rollback jika gagal |
| **Risk Manager** | Sizing & circuit breaker | Turunkan risk saat drawdown, pause saat 3 SL beruntun |
| **Feedback Bot** | Label cepat dari user | Inline button Telegram: 👍 👎 ⛔ 📝 |

---

## 2) Level Otomasi (L1→L3)

| Level | Fokus | Yang Belajar | Output |
|---|---|---|---|
| **L1 – Calibration** | Akurasi probabilitas & threshold | Platt/Isotonic + τ(confluence/regime) | `p_win` akurat, cut fake setups |
| **L2 – Bandit Kontekstual** | Eksploitasi vs eksplorasi | Bobot **8-layer** per **regime×TF** | Skor confluence lebih tajam |
| **L3 – Meta / RL** | Timing & sizing | Policy trigger 5m + position sizing | Eksekusi lebih efisien & konsisten |

> **Saran start:** L1 minggu 1, L2 minggu 2–3, L3 setelah metrik stabil.

---

## 3) Data & Logging (wajib biar bisa belajar)

**Minimum fields yang direkam:**

```json
{
  "signal_id": "uuid",
  "ts": "2025-09-13T10:32:00+07:00",
  "pair": "SOL-USDT-SWAP",
  "side": "long|short",
  "confluence_score": 0.82,
  "layers_match": {"smc":1,"cvd":1,"rsi_ema_macd":1,"structure":1,"oi":1,"funding":0,"orderflow":1,"fibo":1},
  "setup_15m": "BOS + reclaim OB + delta > 0",
  "triggers_5m": "CHOCH + reclaim EMA50 + delta+",
  "market": {"price": 222.1, "spread": 0.06, "oi": "123456.7", "funding": "0.010%"},
  "risk": {"expiry_minutes": 30, "rr_target": 1.9},
  "orders": {"entry": [221.8, 222.4], "sl": 219.7, "tp": [224.6, 227.3]},
  "regime": "TRENDING",
  "session": "Asia/Jakarta-morning"
}
```

**Outcome (saat close/expire):**
```json
{
  "signal_id": "uuid",
  "result": "win|lose|expire|no-fill",
  "fill_price": 221.9,
  "MFE": 3.1,
  "MAE": -1.2,
  "rr_realized": 1.8,
  "pnl_model": 0.018,
  "pnl_real": 0.017
}
```

> **Labeler rule:** `win=1` jika **TP1** tersentuh sebelum SL; `expire` bila tidak trigger sebelum `expiry_minutes`.

---

## 4) Modeling & Policy

### 4.1 Model Probabilitas Menang (Logistic + Isotonic)
- **Fitur:** `layers_match`, `confluence_score`, `oi_delta`, `funding`, `spread`, `session`, `regime`, `volatility(ATR)`.  
- **Output:** `p_win` (0–1).  
- **Kalibrasi:** Isotonic Regression → probabilitas _well-calibrated_.

### 4.2 Model Magnitudo Pergerakan (Gradient Boosting)
- **Target:** `move_30m` / `move_1h` (pip/%).  
- **Fungsi:** Mengusulkan **TP/SL realistis** (RR ≥ 1.5; scalping TTL15 boleh 1.2–1.5).

### 4.3 Bandit Bobot 8-Layer (Kontekstual)
- **State:** `regime × timeframe(15m/5m)`  
- **Action:** vektor bobot (`smc, cvd, rsi/ema/macd, structure, oi, funding, orderflow, fibo`).  
- **Reward (contoh):** `RR_realized * 1.0 − 0.7*(sl_before_tp) − 0.2*(time_to_tp/target)`.

### 4.4 Decision Flow (pseudocode)
```python
score = confluence(layers, weights[regime])
p_win = clf.predict_proba(features)
move = reg.predict(features)
tp, sl = propose_levels(move, rr_min, atr, spread)

if p_win >= tau[regime] and score >= c_star and spread_ok and volatility_ok:
    if sniper_triggers_5m_met():
        publish_signal(entry, tp, sl)
    else:
        monitor_only_with_triggers()
else:
    monitor_only_with_triggers()
```

---

## 5) Gating & SLO (Champion–Challenger)

| Metrik | Syarat Promote (7D) |
|---|---|
| **PR-AUC** | ≥ champion − 2% |
| **Brier Score** | ≤ champion + 5% |
| **P&L Paper (per trade)** | ≥ champion |
| **Max Drawdown Paper** | ≤ champion + 10% |
| **Winrate by Confluence Bin** | Monoton naik (0.5→0.6→0.7→0.8) |

**Proses:**  
1) Trainer → Evaluator (offline).  
2) Lulus semua syarat → `POST /api/ai/promote` → aktifkan **challenger**.  
3) Auto-rollback jika 24–48 jam performa live < threshold.

---

## 6) Risk Sizing & Guardrails

| Aturan | Kenapa | Implementasi |
|---|---|---|
| **RR minimal 1.5** | Kualitas setup | Kecuali `scalp_ttl_15`: 1.2–1.5 |
| **3 SL beruntun** | Hentikan bleeding | Pause sinyal 60 menit / hanya primary setups |
| **Drawdown harian > −2R** | Lindungi ekuitas | Turunkan risk per trade **50%** sampai recover |
| **p_win ≥ 0.65 & conf ≥ 0.8** | Naikkan ukuran bijak | Size 1.25× (cap portofolio) |
| **Expiry default 30–45m** | Disiplin timing | Auto-cancel jika tidak trigger |
| **Anchor level teknikal** | Anti angka “ngarang” | OB/FVG/SR/POC/Fibo/VP levels wajib di catatan |

**Validasi numerik wajib sebelum publish:**  
- Long: `SL < Entry < TP`; Short: `TP < Entry < SL`.  
- **Max TP2** ≤ 2× ATR(14) H1 dari entry.

---

## 7) Eksplorasi Aman (Belajar tanpa bakar akun)
- Terapkan **epsilon-greedy 10%**: subset sinyal dijalankan sebagai **paper-trade**.  
- Fokus eksplorasi pada kombinasi fitur/regime **jarang terjadi**.  
- Semua hasil paper tetap masuk training → **pengetahuan naik, risiko nol**.

---

## 8) API & Jobs (Skeleton)

| Endpoint/Job | Fungsi | Output |
|---|---|---|
| `POST /api/ai/execution/record` | Simpan sinyal & snapshot | `{signal_id, features, policy_version}` |
| `POST /api/ai/outcome/close` | Tutup & label outcome | `{signal_id, pnl, rr, label}` |
| `POST /api/ai/train/nightly` | Latih model + calibrator | `{model_id, metrics}` |
| `POST /api/ai/eval/challenger` | Uji offline challenger | `{report_id, gating_pass}` |
| `POST /api/ai/promote` | Promote champion | `{active_model_id}` |
| `GET  /api/ai/metrics` | SLO & health | `p50/p95/p99, error_rate, winrate_bins` |

**Contract response minimal (JSON):**
```json
{"success": true, "data": {...}, "timestamp": "2025-09-13T10:32:00Z"}
```

---

## 9) Alert & Feedback Loop (Telegram/WA)
**Format alert human-friendly:**
```
[SIGNAL] SOL-USDT-SWAP — 13 Sep 10:32 WIB
Bias 1D: Bullish (82%) | Struktur 4H: Intact

PRIMARY (Long):
• Entry: 221.8–222.4
• SL: 219.7  | TP1: 224.6  | TP2: 227.3 | RR: 1.9
• Alasan: BOS + reclaim OB 15m, delta > 0, OI naik sehat
• Invalidation: Close 15m < 219.9

HEDGE:
• Short 219.6 | SL 221.1 | TP 217.8 / 216.5 | RR 1.7

Sniper 5m:
• Long trigger: CHOCH 5m + reclaim EMA50 + delta+
• Short trigger: 5m LH + swept H + delta-

Expiry: 30 menit (auto-cancel)
```

**Inline feedback:** `👍 Bagus / 👎 Jelek / ⛔ No-Fill / 📝 Catatan` → masuk `FeedbackEvent` → memperkaya label borderline.

---

## 10) Sprint Plan (1–2 Minggu)

| Hari | Deliverable |
|---|---|
| D1 | Logger lengkap (signals, snapshots, outcomes) + endpoint record/close |
| D2 | Labeler + kalkulasi MFE/MAE, rr_realized |
| D3 | Trainer L1 (logistic + isotonic) + evaluator & report |
| D4 | Threshold tuner per regime/timeframe + gating sederhana |
| D5 | **Champion–Challenger** + rollback otomatis |
| D6 | Risk sizing adaptif + circuit breaker |
| D7 | Paper-trade eksplorasi 10% + dashboard metrik |

---

## 📈 Observability & SLO (Production)

| Metrik | Target | Alarm |
|---|---|---|
| **p95 latency/endpoint** | ≤ 350 ms | > 500 ms (10 m berturut-turut) |
| **Error rate (5xx)** | < 0.5% | > 1% (5 m) |
| **429 rate** | < 2% | > 5% (15 m) |
| **WS RTT** | p95 ≤ 300 ms | > 450 ms (10 m) |
| **Freshness data** | ≤ 2 s vs upstream | > 5 s (5 m) |
| **Winrate by confluence bin** | naik monotonic | turun → rekalibrasi bobot |
| **Time-to-trigger** | < expiry | sering lewat → sempitkan entry / ubah trigger |

Expose `/metrics` Prometheus. Label minimal: `endpoint, pair, exchange, regime`.

---

## 🧪 Contract Test (wajib lulus)

**Curl sanity:**
```bash
curl -s -H "X-API-Key: $KEY" -H "Accept: application/json" \
https://yourdomain.com/api/sol-usdt-swap/cvd | jq .
```

**Aturan lulus cepat:**
- `Content-Type: application/json`
- Tidak ada `<html` di body
- Field wajib tidak `null`
- Tipe angka konsisten (number vs decimal-string)

**Schema Ajv (decimal-as-string contoh):**
```js
const decimal = { type: "string", pattern: "^-?\\d+(\\.\\d+)?$" };
```

---

## 🧱 Database Schema (contoh PostgreSQL)

```sql
CREATE TABLE ai_signals (
  signal_id UUID PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL,
  pair TEXT NOT NULL,
  side TEXT CHECK (side IN ('long','short')),
  confluence_score NUMERIC(5,2),
  layers_match JSONB,
  setup_15m TEXT,
  triggers_5m TEXT,
  market JSONB,
  risk JSONB,
  orders JSONB,
  regime TEXT,
  session TEXT,
  policy_version TEXT
);

CREATE TABLE ai_outcomes (
  signal_id UUID REFERENCES ai_signals(signal_id),
  closed_at TIMESTAMPTZ,
  result TEXT CHECK (result IN ('win','lose','expire','no-fill')),
  fill_price NUMERIC(18,8),
  mfe NUMERIC(18,8),
  mae NUMERIC(18,8),
  rr_realized NUMERIC(6,3),
  pnl_model NUMERIC(10,6),
  pnl_real NUMERIC(10,6),
  feedback JSONB,
  PRIMARY KEY(signal_id)
);
```

---

## ✅ Acceptance Criteria (siap produksi)
- [ ] L1 Calibration aktif (prob well-calibrated, threshold per regime/TF).  
- [ ] L2 Bandit aktif (bobot 8-layer per regime×TF).  
- [ ] Champion–Challenger + rollback otomatis.  
- [ ] Risk sizing adaptif + circuit breaker.  
- [ ] 10% paper-trade eksplorasi.  
- [ ] Metric p95/p99, error rate, winrate bins live di dashboard.  
- [ ] Contract test & schema lint **passed**.

---

## 📌 Catatan & Best Practices
- Gunakan **angka anchor level** (OB/FVG/SR/POC/Fibo/VP), hindari angka bulat tanpa alasan.  
- **Expiry** wajib; sinyal tanpa waktu = jebakan betmen.  
- Dokumentasikan **versi model/policy** di setiap sinyal (`policy_version`).  
- Jangan promote model kalau **monitoring** belum stabil 3–7 hari.  
- Ingat: _self-learning_ yang sehat itu **pelan tapi konsisten** — bukan lompat jurang pakai sayap harapan.

---

**Selesai.** File ini adalah SOP tempur _self-learning_ 1–10 langkah untuk GPT Trading System kamu. Gaskeun, dan jangan lupa kopi.

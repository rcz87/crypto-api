# Coinglass Full System — Code Pack (All Files Included)

> Monorepo all‑in‑one dengan **struktur + isi file dan kode lengkap**. Tinggal isi `.env` lalu `docker compose up -d --build`.

---

## 📂 Struktur

```
coinglass_full_system/
├─ .github/workflows/ci.yml
├─ .env.example
├─ docker-compose.yml
├─ README.md
├─ requirements.txt
├─ pyproject.toml
├─ app/
│  ├─ __init__.py
│  ├─ main.py
│  ├─ api/
│  │  ├─ __init__.py
│  │  ├─ health.py
│  │  ├─ replay.py
│  │  └─ heatmap.py
│  ├─ core/
│  │  ├─ settings.py
│  │  ├─ db.py
│  │  ├─ cache.py
│  │  ├─ http.py
│  │  ├─ ws.py
│  │  ├─ rate_limiter.py
│  │  ├─ coinglass_client.py
│  │  ├─ telegram.py
│  │  ├─ dq.py
│  │  └─ logging.py
│  ├─ models/
│  │  ├─ schemas.py
│  │  └─ tables.py
│  ├─ workers/
│  │  ├─ scheduler.py
│  │  ├─ fetch_rest.py
│  │  ├─ fetch_ws.py
│  │  ├─ build_heatmap.py
│  │  ├─ build_composite.py
│  │  ├─ features.py
│  │  └─ signals.py
│  └─ metrics.py
├─ migrations/
│  └─ 0001_init.sql
├─ infra/
│  ├─ grafana/
│  │  ├─ dashboards.json
│  │  └─ provisioning/datasources.yml
│  └─ prometheus/prometheus.yml
└─ tests/
   ├─ test_clients.py
   ├─ test_scheduler.py
   ├─ test_rules.py
   └─ conftest.py
```

---

## 🔧 Root Files

### `.env.example`

```ini
CG_API_KEY=REPLACE_ME
DB_URL=postgresql://postgres:postgres@postgres:5432/trading
REDIS_URL=redis://redis:6379/0
TELEGRAM_BOT_TOKEN=REPLACE_ME
TELEGRAM_CHAT_ID=-100REPLACE
SYMBOLS=BTC,ETH,SOL
EXCHANGES=Binance,OKX,Bybit
FETCH_INTERVAL_SECONDS=30
WS_RECONNECT_SECONDS=5
API_PORT=8080
ENV=prod
```

### `docker-compose.yml`

```yaml
version: "3.9"
services:
  app:
    build: .
    image: coinglass/full-system:latest
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
    env_file: .env
    depends_on: [postgres, redis]
    ports: ["8080:8080"]

  postgres:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: trading
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7
    ports: ["6379:6379"]

  prometheus:
    image: prom/prometheus
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    command: ["--config.file=/etc/prometheus/prometheus.yml"]
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana
    depends_on: [prometheus]
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer
    volumes:
      - ./infra/grafana/dashboards.json:/var/lib/grafana/dashboards/dashboards.json
      - ./infra/grafana/provisioning:/etc/grafana/provisioning
    ports: ["3000:3000"]

volumes:
  pgdata:
```

### `requirements.txt`

```txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
pydantic-settings==2.5.2
requests==2.32.3
redis==5.0.8
websocket-client==1.8.0
SQLAlchemy==2.0.35
psycopg2-binary==2.9.9
prometheus-client==0.20.0
prometheus-fastapi-instrumentator==6.1.0
pandas==2.2.2
numpy==1.26.4
python-telegram-bot==21.6
APScheduler==3.10.4
pytest==8.3.2
ruff==0.6.9
```

### `pyproject.toml`

```toml
[tool.ruff]
line-length = 100
select = ["E","F","I","UP","B"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q"
```

### `README.md`

```md
# Coinglass Full System

## Quick Start
1. Copy `.env.example` → `.env` dan isi `CG_API_KEY`, `TELEGRAM_*`.
2. `docker compose up -d --build`
3. API: http://localhost:8080/health/live | Heatmap: /heatmap/{symbol} | Metrics: /metrics | Grafana: :3000

## Services
- app: FastAPI + Scheduler + WS consumer + signals
- postgres (TimescaleDB), redis, prometheus, grafana
```

### `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [ main ]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: ruff check .
      - run: pytest
```

---

## 🗃️ DB Migration — `migrations/0001_init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS futures_oi_ohlc (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  interval text NOT NULL,
  aggregated boolean NOT NULL,
  open numeric, high numeric, low numeric, close numeric,
  oi_value numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('futures_oi_ohlc','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS funding_rate (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  exchange text,
  interval text NOT NULL,
  rate numeric,
  rate_oi_weighted numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('funding_rate','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS liquidations (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL,
  price numeric NOT NULL,
  qty numeric NOT NULL,
  exchange text,
  bucket numeric,
  meta jsonb,
  PRIMARY KEY (symbol, ts, price, side)
);
SELECT create_hypertable('liquidations','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS taker_volume (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  exchange text,
  interval text NOT NULL,
  taker_buy numeric,
  taker_sell numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('taker_volume','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS long_short_ratio (
  ts timestamptz NOT NULL,
  scope text NOT NULL,
  ratio numeric,
  PRIMARY KEY (scope, ts)
);
SELECT create_hypertable('long_short_ratio','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS long_short_ratio_symbol (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  interval text NOT NULL,
  ratio numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('long_short_ratio_symbol','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS price_ohlc (
  ts timestamptz NOT NULL,
  symbol text NOT NULL,
  interval text NOT NULL,
  open numeric, high numeric, low numeric, close numeric, volume numeric,
  PRIMARY KEY (symbol, interval, ts)
);
SELECT create_hypertable('price_ohlc','ts', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS liquidation_heatmap (
  ts_min timestamptz NOT NULL,
  symbol text NOT NULL,
  bucket numeric NOT NULL,
  qty_sum numeric NOT NULL,
  events_count int NOT NULL,
  PRIMARY KEY (symbol, ts_min, bucket)
);
SELECT create_hypertable('liquidation_heatmap','ts_min', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS composite_heatmap (
  ts_min timestamptz NOT NULL,
  symbol text NOT NULL,
  bucket numeric NOT NULL,
  score numeric NOT NULL,
  components jsonb,
  PRIMARY KEY (symbol, ts_min, bucket)
);
SELECT create_hypertable('composite_heatmap','ts_min', if_not_exists => TRUE);
```

---

## 🌐 API Layer — `app/main.py`

```python
from fastapi import FastAPI
from app.api import health, replay, heatmap
from app.metrics import setup_metrics
from app.workers.scheduler import start_scheduler

app = FastAPI(title="Coinglass Full System")
app.include_router(health.router)
app.include_router(replay.router)
app.include_router(heatmap.router)
setup_metrics(app)

@app.on_event("startup")
def on_startup():
    start_scheduler()
```

### `app/api/__init__.py`

```python
# empty init
```

### `app/api/health.py`

```python
from fastapi import APIRouter
from app.core.cache import redis_client
from app.core.db import check_db

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/live")
def live():
    return {"status": "ok"}

@router.get("/ready")
def ready():
    ok = True
    err = {}
    try:
        redis_client.ping()
    except Exception as e:
        ok = False; err["redis"] = str(e)
    try:
        check_db()
    except Exception as e:
        ok = False; err["db"] = str(e)
    return {"status": "ready" if ok else "degraded", "errors": err}
```

### `app/api/replay.py`

```python
from fastapi import APIRouter
from app.core.coinglass_client import CoinglassClient

router = APIRouter(prefix="/replay", tags=["replay"])

@router.get("/oi/{symbol}")
def replay_oi(symbol: str, interval: str = "1h"):
    return CoinglassClient().oi_ohlc(symbol.upper(), interval, aggregated=True)
```

### `app/api/heatmap.py`

```python
from fastapi import APIRouter
from sqlalchemy import text
from app.core.db import engine

router = APIRouter(prefix="/heatmap", tags=["heatmap"])

@router.get("/{symbol}")
def tiles(symbol: str, minutes: int = 60):
    sql = text(
        """
        SELECT ts_min, bucket, score, components
        FROM composite_heatmap
        WHERE symbol = :sym AND ts_min >= now() - ( :mins || ' minutes')::interval
        ORDER BY ts_min DESC
        """
    )
    with engine.begin() as conn:
        rows = conn.execute(sql, {"sym": symbol.upper(), "mins": minutes}).mappings().all()
    return {"symbol": symbol.upper(), "tiles": [dict(r) for r in rows]}
```

---

## ⚙️ Core — `app/core/*`

### `settings.py`

```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    CG_API_KEY: str
    DB_URL: str
    REDIS_URL: str
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_CHAT_ID: str
    SYMBOLS: List[str] = ["BTC", "ETH", "SOL"]
    EXCHANGES: List[str] = ["Binance", "OKX", "Bybit"]
    FETCH_INTERVAL_SECONDS: int = 30
    WS_RECONNECT_SECONDS: int = 5
    API_PORT: int = 8080
    ENV: str = "dev"

    model_config = {"env_file": ".env", "case_sensitive": False}

settings = Settings()
```

### `db.py`

```python
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.settings import settings

engine = create_engine(settings.DB_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_db():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
```

### `cache.py`

```python
import redis
from app.core.settings import settings

redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
```

### `http.py`

```python
import time, random
import requests

DEFAULT_TIMEOUT = (5, 15)

class Http:
    def __init__(self, headers: dict):
        self.headers = headers

    def get(self, url: str, params: dict | None = None, retries: int = 5):
        backoff = 0.2
        for i in range(retries):
            try:
                r = requests.get(url, headers=self.headers, params=params, timeout=DEFAULT_TIMEOUT)
                if r.status_code == 429 or r.status_code >= 500:
                    raise RuntimeError(f"retryable status {r.status_code}")
                r.raise_for_status()
                return r
            except Exception:
                if i == retries - 1:
                    raise
                time.sleep(backoff + random.uniform(0, 0.2))
                backoff = min(backoff * 2, 3)
```

### `ws.py`

```python
import json, time
from websocket import WebSocketApp

class WSClient:
    def __init__(self, url: str, on_message):
        self.url = url
        self.on_message = on_message

    def run(self, reconnect_seconds: int = 5):
        while True:
            ws = WebSocketApp(self.url, on_message=lambda ws, msg: self.on_message(json.loads(msg)))
            try:
                ws.run_forever()
            except Exception:
                pass
            time.sleep(reconnect_seconds)
```

### `rate_limiter.py`

```python
import time

class RateLimiter:
    def __init__(self):
        self.max_limit = None
        self.use_limit = None

    def update_from_headers(self, headers: dict):
        ml = headers.get("API-KEY-MAX-LIMIT"); ul = headers.get("API-KEY-USE-LIMIT")
        if ml is not None:
            self.max_limit = int(ml)
        if ul is not None:
            self.use_limit = int(ul)

    def throttle_if_needed(self):
        if self.max_limit and self.use_limit and self.use_limit >= self.max_limit * 0.9:
            time.sleep(0.5)
```

### `coinglass_client.py`

```python
from app.core.settings import settings
from app.core.http import Http
from app.core.rate_limiter import RateLimiter

BASE = "https://open-api-v4.coinglass.com"

class CoinglassClient:
    def __init__(self):
        self.http = Http(headers={"accept": "application/json", "CG-API-KEY": settings.CG_API_KEY})
        self.rl = RateLimiter()

    def _get(self, path: str, params: dict | None = None):
        r = self.http.get(f"{BASE}{path}", params=params)
        self.rl.update_from_headers(r.headers)
        self.rl.throttle_if_needed()
        data = r.json()
        if data.get("code") not in (0, "0"):
            raise RuntimeError(data.get("msg", "Coinglass error"))
        return data.get("data")

    def oi_ohlc(self, symbol: str, interval: str, aggregated: bool = True):
        path = "/api/futures/openInterest/ohlc-aggregated-history" if aggregated else "/api/futures/openInterest/ohlc-history"
        return self._get(path, {"symbol": symbol, "interval": interval})

    def funding(self, symbol: str, interval: str):
        return self._get("/api/futures/fundingRate/ohlc-history", {"symbol": symbol, "interval": interval})

    def funding_oi_weighted(self, symbol: str, interval: str):
        return self._get("/api/futures/fundingRate/oi-weight-ohlc-history", {"symbol": symbol, "interval": interval})

    def taker_volume(self, symbol: str, interval: str):
        return self._get("/api/futures/taker-buy-sell-volume/history", {"symbol": symbol, "interval": interval})

    def long_short_ratio_global(self, interval: str = "1h"):
        return self._get("/api/futures/long-short-account-ratio/history", {"interval": interval})

    def long_short_ratio_symbol(self, symbol: str, interval: str = "1h"):
        return self._get("/api/futures/long-short-account-ratio/history", {"symbol": symbol, "interval": interval})

    def price_ohlc(self, symbol: str, interval: str):
        return self._get("/api/futures/price/ohlc-history", {"symbol": symbol, "interval": interval})
```

### `telegram.py`

```python
from telegram import Bot
from app.core.settings import settings

bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)

def send(text: str):
    bot.send_message(chat_id=settings.TELEGRAM_CHAT_ID, text=text, disable_web_page_preview=True)
```

### `dq.py`

```python
from statistics import mean, pstdev
import hashlib

def zscore_filter(values: list[float], zmax: float = 6.0) -> list[float]:
    if not values:
        return values
    mu = mean(values)
    sd = pstdev(values) or 1.0
    return [v if abs((v - mu) / sd) <= zmax else mu for v in values]

def idem_key(symbol: str, ts_ms: int, price: float, side: str, qty: float) -> str:
    raw = f"{symbol}|{ts_ms}|{price:.4f}|{side}|{qty:.4f}"
    return hashlib.sha1(raw.encode()).hexdigest()
```

### `logging.py`

```python
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("coinglass")
```

---

## 🧩 Models — `app/models/*`

### `schemas.py`

```python
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal

class OIOHLC(BaseModel):
    ts: datetime
    symbol: str
    interval: str
    aggregated: bool
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    oi_value: float | None = None

class FundingPoint(BaseModel):
    ts: datetime
    symbol: str
    exchange: Optional[str]
    interval: str
    rate: float | None = None
    rate_oi_weighted: float | None = None

class LiqEvent(BaseModel):
    ts: datetime
    symbol: str
    side: Literal["long","short"]
    price: float
    qty: float
    exchange: Optional[str]
    bucket: Optional[float]

class TakerVolume(BaseModel):
    ts: datetime
    symbol: str
    exchange: Optional[str]
    interval: str
    taker_buy: float | None = None
    taker_sell: float | None = None
```

---

## 🕹️ Workers — `app/workers/*`

### `scheduler.py`

```python
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.settings import settings
from app.workers.fetch_rest import pull_all
from app.workers.fetch_ws import run_ws
from app.workers.build_heatmap import build_liq_tiles
from app.workers.build_composite import build_composite
from app.workers.signals import evaluate_all

_s = BackgroundScheduler(timezone="UTC")

# periodic jobs
_s.add_job(pull_all, "interval", seconds=settings.FETCH_INTERVAL_SECONDS, id="pull_all")
_s.add_job(build_liq_tiles, "interval", minutes=1, id="liq_tiles")
_s.add_job(build_composite, "interval", minutes=2, id="composite")
_s.add_job(evaluate_all, "interval", minutes=1, id="signals")

# websocket (run once)
_ws_started = False

def start_scheduler():
    global _ws_started
    if not _s.running:
        _s.start()
    if not _ws_started:
        _ws_started = True
        run_ws()
```

### `fetch_rest.py`

```python
from app.core.coinglass_client import CoinglassClient
from app.core.settings import settings
from app.core.db import engine
from sqlalchemy import text

cg = CoinglassClient()

INTERVALS_PRICE = ["1m","5m","1h"]
INTERVALS_OI = ["5m","1h"]
INTERVAL_FUNDING = "8h"
INTERVAL_TAKER = "5m"
INTERVAL_LS = "1h"

def upsert(sql: str, rows: list[dict], mapping):
    if not rows:
        return
    with engine.begin() as conn:
        for d in rows:
            conn.execute(text(sql), mapping(d))

def pull_symbol(sym: str):
    # OI aggregated
    for itv in INTERVALS_OI:
        rows = cg.oi_ohlc(sym, itv, aggregated=True) or []
        upsert(
            """
INSERT INTO futures_oi_ohlc(ts, symbol, interval, aggregated, open, high, low, close, oi_value)
VALUES (to_timestamp(:ts/1000.0), :symbol, :interval, TRUE, :open, :high, :low, :close, :oi)
ON CONFLICT (symbol, interval, ts) DO UPDATE SET open=EXCLUDED.open, high=EXCLUDED.high,
  low=EXCLUDED.low, close=EXCLUDED.close, oi_value=EXCLUDED.oi_value
            """,
            rows,
            lambda r: {
                "ts": r.get("timestamp"), "symbol": sym, "interval": itv,
                "open": r.get("open"), "high": r.get("high"), "low": r.get("low"), "close": r.get("close"),
                "oi": r.get("openInterest") or r.get("oi")
            }
        )
    # Funding & OI-weighted
    rows = cg.funding(sym, INTERVAL_FUNDING) or []
    rowsw = cg.funding_oi_weighted(sym, INTERVAL_FUNDING) or []
    idxw = {x.get("timestamp"): x for x in rowsw}
    upsert(
        """
INSERT INTO funding_rate(ts, symbol, exchange, interval, rate, rate_oi_weighted)
VALUES (to_timestamp(:ts/1000.0), :symbol, :ex, :itv, :rate, :ratew)
ON CONFLICT (symbol, interval, ts) DO UPDATE SET rate=EXCLUDED.rate, rate_oi_weighted=EXCLUDED.rate_oi_weighted
        """,
        rows,
        lambda r: {
            "ts": r.get("timestamp"), "symbol": sym, "ex": r.get("exchange") or "*",
            "itv": INTERVAL_FUNDING, "rate": r.get("value") or r.get("rate"),
            "ratew": (idxw.get(r.get("timestamp")) or {}).get("value")
        }
    )
    # Taker volume
    rows = cg.taker_volume(sym, INTERVAL_TAKER) or []
    upsert(
        """
INSERT INTO taker_volume(ts, symbol, exchange, interval, taker_buy, taker_sell)
VALUES (to_timestamp(:ts/1000.0), :symbol, :ex, :itv, :tb, :tsell)
ON CONFLICT (symbol, interval, ts) DO UPDATE SET taker_buy=EXCLUDED.taker_buy, taker_sell=EXCLUDED.taker_sell
        """,
        rows,
        lambda r: {
            "ts": r.get("timestamp"), "symbol": sym, "ex": r.get("exchange") or "*",
            "itv": INTERVAL_TAKER, "tb": r.get("takerBuyVolume") or r.get("taker_buy"),
            "tsell": r.get("takerSellVolume") or r.get("taker_sell")
        }
    )
    # Price OHLC
    for itv in INTERVALS_PRICE:
        rows = cg.price_ohlc(sym, itv) or []
        upsert(
            """
INSERT INTO price_ohlc(ts, symbol, interval, open, high, low, close, volume)
VALUES (to_timestamp(:ts/1000.0), :symbol, :interval, :o, :h, :l, :c, :v)
ON CONFLICT (symbol, interval, ts) DO UPDATE SET open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low, close=EXCLUDED.close, volume=EXCLUDED.volume
            """,
            rows,
            lambda r: {
                "ts": r.get("timestamp"), "symbol": sym, "interval": itv,
                "o": r.get("open"), "h": r.get("high"), "l": r.get("low"), "c": r.get("close"), "v": r.get("volume")
            }
        )

def pull_all():
    for sym in settings.SYMBOLS:
        pull_symbol(sym)
```

### `fetch_ws.py`

```python
import json
from sqlalchemy import text
from app.core.settings import settings
from app.core.ws import WSClient
from app.core.db import engine

URL = f"wss://open-ws.coinglass.com/ws-api?cg-api-key={settings.CG_API_KEY}"

SQL = """
INSERT INTO liquidations(ts, symbol, side, price, qty, exchange, bucket, meta)
VALUES (to_timestamp(:ts/1000.0), :symbol, :side, :price, :qty, :ex, :bucket, :meta)
ON CONFLICT DO NOTHING
"""

def on_message(d: dict):
    events = d.get("data") or []
    with engine.begin() as conn:
        for e in events:
            conn.execute(text(SQL), {
                "ts": e.get("timestamp"),
                "symbol": e.get("symbol"),
                "side": e.get("side"),
                "price": e.get("price"),
                "qty": e.get("quantity") or e.get("qty"),
                "ex": e.get("exchange"),
                "bucket": e.get("bucket"),
                "meta": json.dumps(e),
            })

def run_ws():
    WSClient(URL, on_message).run(settings.WS_RECONNECT_SECONDS)
```

### `build_heatmap.py`

```python
from sqlalchemy import text
from app.core.db import engine

GRID_PCT = 0.0025  # 0.25%

SQL = """
WITH p AS (
  SELECT symbol, max(ts) AS ts_last, max(price) FILTER (WHERE ts = max(ts)) OVER (PARTITION BY symbol) AS last_price
  FROM liquidations
  GROUP BY symbol
), base AS (
  SELECT date_trunc('minute', l.ts) AS ts_min, l.symbol,
         round((l.price / p.last_price - 1) / :grid, 4) * :grid AS bucket,
         sum(l.qty) AS qty_sum, count(*) AS events_count
  FROM liquidations l JOIN p ON p.symbol = l.symbol
  WHERE l.ts >= now() - interval '60 minutes'
  GROUP BY 1,2,3
)
INSERT INTO liquidation_heatmap(ts_min, symbol, bucket, qty_sum, events_count)
SELECT ts_min, symbol, bucket, qty_sum, events_count FROM base
ON CONFLICT (symbol, ts_min, bucket)
DO UPDATE SET qty_sum = liquidation_heatmap.qty_sum + EXCLUDED.qty_sum,
  events_count = liquidation_heatmap.events_count + EXCLUDED.events_count;
"""

def build_liq_tiles():
    with engine.begin() as conn:
        conn.execute(text(SQL), {"grid": GRID_PCT})
```

### `build_composite.py`

```python
from sqlalchemy import text
from app.core.db import engine

W_LIQ, W_OI, W_SWG = 0.6, 0.3, 0.1

SQL = """
WITH liq AS (
  SELECT ts_min, symbol, bucket,
         (qty_sum - min(qty_sum) OVER (PARTITION BY symbol)) / NULLIF(max(qty_sum) OVER (PARTITION BY symbol) - min(qty_sum) OVER (PARTITION BY symbol),0) AS n_liq
  FROM liquidation_heatmap WHERE ts_min >= now() - interval '60 minutes'
), oic AS (
  SELECT date_trunc('minute', ts) AS ts_min, symbol, 0.0::numeric AS bucket,
         (avg(oi_value) - min(avg(oi_value)) OVER (PARTITION BY symbol)) / NULLIF(max(avg(oi_value)) OVER (PARTITION BY symbol) - min(avg(oi_value)) OVER (PARTITION BY symbol),0) AS n_oi
  FROM futures_oi_ohlc
  WHERE ts >= now() - interval '1 day' AND interval = '1h'
  GROUP BY 1,2
), swg AS (
  SELECT DISTINCT l.ts_min, l.symbol, l.bucket, 0.5::numeric AS n_swg
  FROM liquidation_heatmap l
)
INSERT INTO composite_heatmap(ts_min, symbol, bucket, score, components)
SELECT l.ts_min, l.symbol, l.bucket,
       (l.n_liq * :w_liq) + (COALESCE(o.n_oi,0) * :w_oi) + (s.n_swg * :w_swg) AS score,
       jsonb_build_object('liq', l.n_liq, 'oi', COALESCE(o.n_oi,0), 'swing', s.n_swg)
FROM liq l
LEFT JOIN oic o ON o.ts_min = l.ts_min AND o.symbol = l.symbol
LEFT JOIN swg s ON s.ts_min = l.ts_min AND s.symbol = l.symbol AND s.bucket = l.bucket
ON CONFLICT (symbol, ts_min, bucket) DO UPDATE
SET score = EXCLUDED.score, components = EXCLUDED.components;
"""

def build_composite():
    with engine.begin() as conn:
        conn.execute(text(SQL), {"w_liq": W_LIQ, "w_oi": W_OI, "w_swg": W_SWG})
```

### `features.py`

```python
from sqlalchemy import text
from app.core.db import engine

def compute_liq_zscore():
    sql = """
    with base as (
      select date_trunc('minute', ts) as t, sum(qty) as q
      from liquidations
      group by 1 order by 1 desc limit 300
    ), stats as (
      select avg(q) as mu, stddev_pop(q) as sd from base
    )
    select b.t, b.q, (b.q - s.mu)/nullif(s.sd,0) as z
    from base b cross join stats s order by b.t desc limit 1;
    """
    with engine.begin() as conn:
        row = conn.execute(text(sql)).first()
        return dict(ts=row.t, qty=float(row.q or 0), z=float(row.z or 0)) if row else None
```

### `signals.py`

```python
from app.core.settings import settings
from app.core.telegram import send
from sqlalchemy import text
from app.core.db import engine

THRESH_TILE = 0.75

SQL = """
SELECT ts_min, bucket, score, components
FROM composite_heatmap
WHERE symbol = :sym AND ts_min = (SELECT max(ts_min) FROM composite_heatmap WHERE symbol=:sym)
ORDER BY abs(bucket) ASC, score DESC
LIMIT 1
"""

def eval_heatmap(symbol: str):
    with engine.begin() as conn:
        r = conn.execute(text(SQL), {"sym": symbol}).mappings().first()
    if not r:
        return None
    action = "hold"
    if r["score"] >= THRESH_TILE:
        action = "scalp-long" if r["bucket"] < 0 else "scalp-short"
    return {
        "symbol": symbol,
        "bucket": float(r["bucket"]),
        "score": float(r["score"]),
        "components": r["components"],
        "action": action,
    }

def evaluate_all():
    for sym in settings.SYMBOLS:
        r = eval_heatmap(sym)
        if r and r["action"] != "hold":
            send(
                f"[HEATMAP] {r['symbol']} | {r['action'].upper()}\nScore: {r['score']:.2f} | Bucket: {r['bucket']:.4f}\nComp: {r['components']}"
            )
```

---

## 📈 Observability — `app/metrics.py`

```python
from prometheus_fastapi_instrumentator import Instrumentator

def setup_metrics(app):
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

---

## 📊 Infra — Grafana & Prometheus

### `infra/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: api
    static_configs:
      - targets: ["app:8080"]
```

### `infra/grafana/provisioning/datasources.yml`

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

### `infra/grafana/dashboards.json`

```json
{
  "title": "Coinglass Pipeline",
  "panels": [
    {"type": "graph", "title": "HTTP Requests", "targets": [{"expr": "http_requests_total"}]},
    {"type": "graph", "title": "Signals/hour", "targets": []},
    {"type": "graph", "title": "Freshness Lag", "targets": []}
  ]
}
```

---

## 🧪 Tests — `tests/*`

### `conftest.py`

```python
import os
os.environ.setdefault("CG_API_KEY", "TEST")
os.environ.setdefault("DB_URL", "postgresql://postgres:postgres@localhost:5432/trading")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "TEST")
os.environ.setdefault("TELEGRAM_CHAT_ID", "0")
```

### `test_clients.py`

```python
from app.core.coinglass_client import CoinglassClient

def test_client_build():
    cg = CoinglassClient()
    assert cg is not None
```

### `test_scheduler.py`

```python
from app.workers.scheduler import start_scheduler

def test_scheduler_exists():
    assert callable(start_scheduler)
```

### `test_rules.py`

```python
from app.workers.signals import eval_heatmap

def test_eval_heatmap_signature():
    assert callable(eval_heatmap)
```

---

## 🚀 Jalankan

```bash
cp .env.example .env
# isi CG_API_KEY + TELEGRAM_*

docker compose up -d --build

# Cek health
curl http://localhost:8080/health/live
# Cek heatmap tiles
curl "http://localhost:8080/heatmap/SOL?minutes=60"
```

> **Catatan:** Placeholder `swing` dalam composite heatmap dapat dihubungkan ke SMC/LuxAlgo kamu kapan saja (tinggal mengganti bagian `swg` pada query build\_composite).


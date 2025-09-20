# -*- coding: utf-8 -*-
from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Sequence
import math
import numpy as np
import pandas as pd

# ---------- Helpers: rolling percentile & moving avg ----------

def rolling_percentile(
    values: Sequence[float],
    q: float,                 # 0..1 (e.g., 0.95 for p95)
    window: int,
    min_periods: Optional[int] = None,
    interpolation: str = "linear",
) -> pd.Series:
    """
    Rolling percentile using pandas rolling.quantile (stable & well-documented).
    For small/medium windows (<= 2000) this is fast enough & exact. 
    Docs: pandas Rolling.quantile. 
    """
    s = pd.Series(values, dtype="float64")
    if min_periods is None:
        min_periods = max(1, min(window, len(s)))
    return s.rolling(window, min_periods=min_periods).quantile(q)

def ma(values, window: int, min_periods: Optional[int] = None) -> pd.Series:
    s = pd.Series(values, dtype="float64")
    if min_periods is None:
        min_periods = max(1, min(window, len(s)))
    return s.rolling(window, min_periods=min_periods).mean()

# ---------- Funding utils ----------

def normalize_funding_to_bps_per_8h(
    funding_value: float,
    interval_hours: float,
) -> float:
    """
    Normalisasi funding ke basis 8 jam dalam basis points (bps).
    - Jika data funding dikutip per 1h, kali 8.
    - 1 bps = 0.01%.
    Referensi umum: funding dibebankan periodik (seringnya tiap 8 jam); 
    contoh Binance menjelaskan interval & formula funding. 
    """
    # funding_value diasumsikan sebagai rate desimal (contoh 0.0001 = 0.01%).
    per_8h = funding_value * (8.0 / max(1e-9, float(interval_hours)))
    return per_8h * 1e4  # convert fraction -> bps

# ---------- OI & taker utils ----------

def roc(current: float, previous: float) -> float:
    """Rate of change sederhana (Δ/prev)."""
    if previous == 0 or math.isnan(previous):
        return 0.0
    return (current - previous) / previous

def taker_ratio(buy_usd: float, sell_usd: float) -> float:
    """Taker buy/sell ratio; lindungi divide-by-zero."""
    return buy_usd / max(1e-12, sell_usd)

# ---------- Config ----------

@dataclass
class LayerConfig:
    # Bias
    bias_z_watch: float = 1.0
    bias_z_action: float = 2.0
    bias_abs_watch: float = 0.25
    bias_abs_action: float = 0.60

    # Funding (per 8h bps)
    fund_lookback: int = 24 * 30         # ~30d jika data 1h
    fund_p_watch: float = 0.85
    fund_p_action: float = 0.95
    fund_abs_watch_bps: float = 5.0
    fund_abs_action_bps: float = 10.0

    # OI ROC
    oi_roc_watch: float = 0.02           # +2% per bar
    oi_roc_action: float = 0.05          # +5% per bar

    # Taker ratio
    taker_lookback: int = 24 * 30
    taker_p_watch: float = 0.85
    taker_p_action: float = 0.95
    taker_abs_watch_hi: float = 1.40
    taker_abs_action_hi: float = 1.80
    taker_abs_watch_lo: float = 0.70
    taker_abs_action_lo: float = 0.55

    # Liquidation coin aggregated
    liq_lookback: int = 24 * 7
    liq_p_watch: float = 0.95
    liq_p_action: float = 0.99
    liq_pair_confirm: bool = True

    # ETF flows
    etf_ma_window: int = 7
    etf_mult_watch: float = 1.5
    etf_mult_action: float = 3.0
    etf_p_action_90d: float = 0.95

@dataclass
class ConfluenceConfig:
    watch_min: int = 2
    action_min: int = 3
    require_one_action: bool = True
    anti_liq_flip: bool = True           # jika spike bertentangan, turunkan level

# ---------- Evaluators per-layer ----------

def evaluate_bias(score_now: float, hist_scores: Sequence[float], cfg: LayerConfig) -> str:
    s = pd.Series(hist_scores, dtype="float64")
    mu, sd = float(s.mean()), float(s.std(ddof=1)) if len(s) > 1 else (0.0, 1.0)
    z = 0.0 if sd == 0 else (score_now - mu) / sd
    if abs(z) >= cfg.bias_z_action or abs(score_now) >= cfg.bias_abs_action:
        return "action"
    if abs(z) >= cfg.bias_z_watch or abs(score_now) >= cfg.bias_abs_watch:
        return "watch"
    return "none"

def evaluate_funding(
    funding_series: Sequence[float],    # deret funding (desimal per bar timeframenya)
    interval_hours: float,
    cfg: LayerConfig
) -> Tuple[str, Dict]:
    # Konversi semua ke bps per 8h
    bps8 = [normalize_funding_to_bps_per_8h(x, interval_hours) for x in funding_series]
    p85 = rolling_percentile(bps8, cfg.fund_p_watch, cfg.fund_lookback).iloc[-1]
    p95 = rolling_percentile(bps8, cfg.fund_p_action, cfg.fund_lookback).iloc[-1]
    now_bps8 = bps8[-1]
    level = "none"
    if abs(now_bps8) >= (p95 if not math.isnan(p95) else cfg.fund_abs_action_bps) or abs(now_bps8) >= cfg.fund_abs_action_bps:
        level = "action"
    elif abs(now_bps8) >= (p85 if not math.isnan(p85) else cfg.fund_abs_watch_bps) or abs(now_bps8) >= cfg.fund_abs_watch_bps:
        level = "watch"
    return level, {"now_bps8": now_bps8, "p85": p85, "p95": p95}

def evaluate_oi_roc(
    oi_series: Sequence[float],
    price_series: Sequence[float],
    cfg: LayerConfig
) -> Tuple[str, Dict]:
    if len(oi_series) < 2 or len(price_series) < 2:
        return "none", {"msg": "insufficient data"}
    oi_now, oi_prev = oi_series[-1], oi_series[-2]
    px_now, px_prev = price_series[-1], price_series[-2]
    r = roc(oi_now, oi_prev)
    same_dir_up = (px_now > px_prev and r >= cfg.oi_roc_watch)
    same_dir_up_strong = (px_now > px_prev and r >= cfg.oi_roc_action)
    same_dir_down = (px_now < px_prev and r <= -cfg.oi_roc_watch)
    same_dir_down_strong = (px_now < px_prev and r <= -cfg.oi_roc_action)
    if same_dir_up_strong or same_dir_down_strong:
        return "action", {"roc": r, "price_up": px_now > px_prev}
    if same_dir_up or same_dir_down:
        return "watch",  {"roc": r, "price_up": px_now > px_prev}
    return "none", {"roc": r, "price_up": px_now > px_prev}

def evaluate_taker_ratio(
    buy_series: Sequence[float],
    sell_series: Sequence[float],
    cfg: LayerConfig
) -> Tuple[str, Dict]:
    ratios = [taker_ratio(b, s) for b, s in zip(buy_series, sell_series)]
    now = ratios[-1]
    p85 = rolling_percentile(ratios, cfg.taker_p_watch, cfg.taker_lookback).iloc[-1]
    p95 = rolling_percentile(ratios, cfg.taker_p_action, cfg.taker_lookback).iloc[-1]

    # Absolute first, then percentile fallback
    if now >= cfg.taker_abs_action_hi or now <= cfg.taker_abs_action_lo or \
       (not math.isnan(p95) and (now >= p95 or now <= (1 - (p95 - 1)))):
        level = "action"
    elif now >= cfg.taker_abs_watch_hi or now <= cfg.taker_abs_watch_lo or \
         (not math.isnan(p85) and (now >= p85 or now <= (1 - (p85 - 1)))):
        level = "watch"
    else:
        level = "none"
    return level, {"now": now, "p85": p85, "p95": p95}

def evaluate_liquidation_coin_agg(
    long_series_usd: Sequence[float],
    short_series_usd: Sequence[float],
    cfg: LayerConfig
) -> Tuple[str, Dict]:
    total = [float(l + s) for l, s in zip(long_series_usd, short_series_usd)]
    now = total[-1]
    p95 = rolling_percentile(total, cfg.liq_p_watch, cfg.liq_lookback).iloc[-1]
    p99 = rolling_percentile(total, cfg.liq_p_action, cfg.liq_lookback).iloc[-1]
    if (not math.isnan(p99)) and now >= p99:
        return "action", {"now": now, "p95": p95, "p99": p99}
    if (not math.isnan(p95)) and now >= p95:
        return "watch", {"now": now, "p95": p95, "p99": p99}
    return "none", {"now": now, "p95": p95, "p99": p99}

def evaluate_etf_flows(
    flow_usd_series: Sequence[float],
    cfg: LayerConfig
) -> Tuple[str, Dict]:
    flow_list = list(flow_usd_series)
    ma7 = float(ma(flow_list, cfg.etf_ma_window).iloc[-1])
    now = flow_list[-1]
    p95_90d = rolling_percentile(flow_list, cfg.etf_p_action_90d, window=min(len(flow_list), 24*90)).iloc[-1]
    level = "none"
    if abs(now) >= cfg.etf_mult_action * abs(ma7) or (not math.isnan(p95_90d) and abs(now) >= abs(p95_90d)):
        level = "action"
    elif abs(now) >= cfg.etf_mult_watch * abs(ma7):
        level = "watch"
    return level, {"now": now, "ma7": ma7, "p95_90d": p95_90d}

# ---------- Confluence ----------

def confluence_level(
    layer_levels: Dict[str, str],
    cfg: ConfluenceConfig,
    liq_direction_conflict: bool = False
) -> str:
    """
    layer_levels: {"bias": "watch", "funding": "none", "taker": "action", ...}
    liq_direction_conflict: set True jika ada spike likuidasi yang kontra arah setup.
    """
    counts = {
        "action": sum(1 for v in layer_levels.values() if v == "action"),
        "watch": sum(1 for v in layer_levels.values() if v == "watch"),
    }
    level = "none"
    if counts["action"] >= 1 and (counts["action"] + counts["watch"]) >= cfg.action_min:
        level = "action"
    elif (counts["action"] + counts["watch"]) >= cfg.watch_min:
        level = "watch"
    if cfg.anti_liq_flip and liq_direction_conflict and level == "action":
        level = "watch"
    return level
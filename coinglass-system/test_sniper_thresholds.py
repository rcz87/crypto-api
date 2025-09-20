# -*- coding: utf-8 -*-
import math
import numpy as np
import pandas as pd
import pytest
from app.core.sniper_thresholds import (
    rolling_percentile, ma, normalize_funding_to_bps_per_8h, roc, taker_ratio,
    LayerConfig, ConfluenceConfig,
    evaluate_bias, evaluate_funding, evaluate_oi_roc, evaluate_taker_ratio,
    evaluate_liquidation_coin_agg, evaluate_etf_flows, confluence_level
)

def test_rolling_percentile_basic():
    vals = [1, 2, 3, 4, 5]
    p50 = rolling_percentile(vals, 0.5, window=3).tolist()
    # last window = [3,4,5] -> median = 4
    assert pytest.approx(p50[-1], rel=1e-6) == 4

def test_funding_normalization():
    # 0.01% per 8h = 1 bps per 8h
    bps8 = normalize_funding_to_bps_per_8h(0.0001, interval_hours=8)
    assert pytest.approx(bps8, rel=1e-6) == 1.0

def test_bias_evaluator():
    hist = [0.0, 0.1, -0.1, 0.05, -0.05, 0.2]
    # strong value should trigger action by abs threshold
    cfg = LayerConfig()
    assert evaluate_bias(0.65, hist, cfg) == "action"

def test_taker_ratio_evaluator_watch_action():
    cfg = LayerConfig()
    buys = [10, 12, 11, 13, 15, 18]
    sells= [10, 10, 10, 10, 10, 10]
    level_watch, meta = evaluate_taker_ratio(buys[:-1], sells[:-1], cfg)
    # Not evaluating; we care about last point:
    level, meta = evaluate_taker_ratio(buys, sells, cfg)
    assert meta["now"] == pytest.approx(18/10)
    assert level in {"watch","action"}

def test_funding_evaluator_abs_and_pct():
    cfg = LayerConfig()
    # series around 3 bps, last spike 12 bps -> action
    series = [0.000003]*100 + [0.00012]  # decimals per 8h? We'll convert from 1h to 8h
    # assume interval 8h so normalize no scale
    level, meta = evaluate_funding(series, interval_hours=8, cfg=cfg)
    assert level == "action"
    assert meta["now_bps8"] > meta["p95"] or meta["now_bps8"] >= cfg.fund_abs_action_bps

def test_oi_roc_evaluator():
    cfg = LayerConfig()
    oi = [100, 102, 108]  # +5.88% last bar
    px = [20, 21, 21.5]   # price up
    level, meta = evaluate_oi_roc(oi, px, cfg)
    assert level in {"watch", "action"}
    assert meta["roc"] > 0

def test_liquidation_coin_agg():
    cfg = LayerConfig()
    longs = [1e5]*100 + [5e6]  # spike
    shorts= [1e5]*100 + [1e6]
    level, meta = evaluate_liquidation_coin_agg(longs, shorts, cfg)
    assert level in {"watch","action"}
    assert meta["now"] >= (meta["p95"] if not math.isnan(meta["p95"]) else 0)

def test_etf_flows():
    cfg = LayerConfig()
    flows = [1e6]*30 + [5e6]   # ~MA7 ~1e6; 5x spike -> action
    level, meta = evaluate_etf_flows(flows, cfg)
    assert level == "action"
    assert abs(meta["now"]) >= cfg.etf_mult_action * abs(meta["ma7"])

def test_confluence_level():
    c = ConfluenceConfig()
    # 2 watch = watch level
    assert confluence_level({"a": "watch", "b": "watch"}, c) == "watch"
    # 1 action + 2 watch >= action_min (3) + require_one_action = action
    assert confluence_level({"a": "action", "b": "watch", "c": "watch"}, c) == "action"
    # anti_liq_flip downgrade
    assert confluence_level({"a": "action", "b": "action", "c": "action"}, c, liq_direction_conflict=True) == "watch"

def test_taker_ratio_basic():
    assert taker_ratio(100, 50) == 2.0
    assert taker_ratio(50, 100) == 0.5
    # zero sell protection
    assert taker_ratio(100, 0) > 0

def test_roc_basic():
    assert roc(110, 100) == 0.1  # 10%
    assert roc(90, 100) == -0.1  # -10%
    assert roc(100, 0) == 0      # zero previous protection

if __name__ == "__main__":
    pytest.main(["-v", __file__])
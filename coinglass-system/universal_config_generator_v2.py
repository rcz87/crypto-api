#!/usr/bin/env python3
"""
Universal Config Generator V2 untuk Enhanced Sniper Engine
Generates coin-specific configs dari CoinGlass v4 real data
Framework coin-agnostic: ganti coin/pair → auto-generate native config
"""

import os, json, time, math, argparse, itertools
import requests
import numpy as np

BASE = "https://open-api-v4.coinglass.com"
API_KEY = os.getenv("COINGLASS_API_KEY")
HDRS = {"CG-API-KEY": API_KEY, "Accept": "application/json"}

def _get(path, params=None):
    """Safe GET request dengan error handling"""
    try:
        r = requests.get(f"{BASE}{path}", headers=HDRS, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
        if data.get("code") == "0":
            return data.get("data", [])
        else:
            print(f"⚠️  API returned code {data.get('code')}: {data.get('msg', 'Unknown error')}")
            return []
    except Exception as e:
        print(f"❌ Error fetching {path}: {e}")
        return []

def supported_pairs():
    """Get supported exchange pairs untuk resolver simbol"""
    return _get("/api/futures/supported-exchange-pairs")

def percentile(vals, q):
    """Calculate percentile dengan 2 decimal precision"""
    if not vals or len(vals) < 5:
        return 0.0
    arr = np.array([float(x) for x in vals if x is not None], dtype=float)
    if len(arr) == 0:
        return 0.0
    return float(np.percentile(arr, q).round(2))

def normalize_funding_to_bps8(rate_dec, interval_h=1.0):
    """Convert funding fraction → per 8h bps"""
    return float(rate_dec) * (8.0/interval_h) * 1e4

def fetch_coin_data(coin: str, bars: int = 100, pair_base="USDT", ex_default="Binance"):
    """Fetch 100-bar data untuk specific coin dari CoinGlass v4"""
    print(f"📊 Fetching {bars}-bar data for {coin}...")
    
    data = {
        "funding_bps8": [],
        "taker_ratios": [],
        "oi_roc": [],
        "liq_total": [],
        "etf_abs": []
    }
    
    # 1) Funding OHLC (pair)
    pair = f"{coin}USDT"
    print(f"  📈 Funding data ({pair} @ {ex_default})...")
    funding = _get("/api/futures/funding-rate/history", {
        "symbol": pair,
        "exchange": ex_default,
        "interval": "1h",
        "limit": bars
    })
    
    if funding:
        funding_bps8 = [abs(normalize_funding_to_bps8(float(x["close"]), 1.0)) for x in funding]
        data["funding_bps8"] = funding_bps8
        print(f"    ✅ {len(funding_bps8)} funding bars")
    else:
        print(f"    ⚠️  No funding data for {coin}")
    
    # 2) OI OHLC aggregated (coin)
    print(f"  📊 OI aggregated data ({coin})...")
    oi_agg = _get("/api/futures/open-interest/aggregated-history", {
        "symbol": coin,
        "interval": "1h",
        "limit": bars
    })
    
    if oi_agg:
        oi_close = [float(x["close"]) for x in oi_agg if x.get("close")]
        oi_roc = [0.0]
        for i in range(1, len(oi_close)):
            if oi_close[i-1] and oi_close[i-1] != 0:
                roc = ((oi_close[i] - oi_close[i-1]) / oi_close[i-1]) * 100
                oi_roc.append(roc)
            else:
                oi_roc.append(0.0)
        
        data["oi_roc"] = oi_roc
        print(f"    ✅ {len(oi_roc)} OI ROC bars")
    else:
        print(f"    ⚠️  No OI data for {coin}")
    
    # 3) Taker ratio (coin aggregated)
    print(f"  🔄 Taker ratios ({coin})...")
    tk = _get("/api/futures/aggregated-taker-buy-sell-volume/history", {
        "symbol": coin,
        "interval": "1h",
        "exchange_list": "OKX,Binance,Bybit",
        "limit": bars
    })
    
    if tk:
        taker_ratios = []
        for x in tk:
            b = float(x.get("aggregated_buy_volume_usd", 0))
            s = float(x.get("aggregated_sell_volume_usd", 1))
            ratio = b / max(1.0, s) if s > 0 else 1.0
            taker_ratios.append(ratio)
        
        data["taker_ratios"] = taker_ratios
        print(f"    ✅ {len(taker_ratios)} taker ratio bars")
    else:
        print(f"    ⚠️  No taker data for {coin}")
    
    # 4) Liquidation coin aggregated
    print(f"  🚨 Liquidation data ({coin})...")
    liq = _get("/api/futures/liquidation/aggregated-history", {
        "symbol": coin,
        "interval": "1h",
        "exchange_list": "OKX,Binance,Bybit",
        "limit": bars
    })
    
    if liq:
        liq_total = []
        for x in liq:
            long_usd = float(x.get("aggregated_long_liquidation_usd", 0))
            short_usd = float(x.get("aggregated_short_liquidation_usd", 0))
            total = long_usd + short_usd
            liq_total.append(total)
        
        data["liq_total"] = liq_total
        print(f"    ✅ {len(liq_total)} liquidation bars")
    else:
        print(f"    ⚠️  No liquidation data for {coin}")
    
    # 5) ETF flows (BTC) — overlay makro
    print(f"  🏦 ETF flows (macro overlay)...")
    etf = _get("/api/etf/bitcoin/flow-history", {"limit": 100})
    
    if etf:
        etf_abs = [abs(float(row.get("flow_usd", 0))) for row in etf]
        data["etf_abs"] = etf_abs
        print(f"    ✅ {len(etf_abs)} ETF flow bars")
    else:
        print(f"    ⚠️  No ETF data available")
    
    return data

def generate_config(coin: str, data: dict):
    """Generate coin-specific config dari real data percentiles"""
    print(f"🎛️  Generating {coin}-native config...")
    
    # Calculate percentiles (2 decimals)
    fund_p85 = percentile([abs(x) for x in data["funding_bps8"]], 85)
    fund_p95 = percentile([abs(x) for x in data["funding_bps8"]], 95)
    fund_p99 = percentile([abs(x) for x in data["funding_bps8"]], 99)
    
    tr_p85 = percentile(data["taker_ratios"], 85)
    tr_p95 = percentile(data["taker_ratios"], 95)
    tr_p99 = percentile(data["taker_ratios"], 99)
    
    oi_p85 = percentile([abs(x) for x in data["oi_roc"]], 85)
    oi_p95 = percentile([abs(x) for x in data["oi_roc"]], 95)
    
    lq_p85 = percentile(data["liq_total"], 85)
    lq_p95 = percentile(data["liq_total"], 95)
    lq_p99 = percentile(data["liq_total"], 99)
    
    etf_p85 = percentile(data["etf_abs"], 85)
    etf_p95 = percentile(data["etf_abs"], 95)
    etf_p99 = percentile(data["etf_abs"], 99)
    
    # Display calculated percentiles
    print(f"  📊 Funding p85/p95/p99: {fund_p85}/{fund_p95}/{fund_p99} bps")
    print(f"  📊 Taker p85/p95/p99: {tr_p85}/{tr_p95}/{tr_p99}")
    print(f"  📊 OI ROC p85/p95: {oi_p85}/{oi_p95}%")
    print(f"  📊 Liquidation p85/p95/p99: ${lq_p85:,.0f}/${lq_p95:,.0f}/${lq_p99:,.0f}")
    
    cfg = {
        "asset": coin,
        "generated_from": f"100-bar real market data via CoinGlass v4",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        
        "data_sources": {
            "funding": "/api/futures/funding-rate/history",
            "oi_aggregated": "/api/futures/open-interest/aggregated-history",
            "taker_aggregated": "/api/futures/aggregated-taker-buy-sell-volume/history",
            "liquidation_aggregated": "/api/futures/liquidation/aggregated-history",
            "etf_flows": "/api/etf/bitcoin/flow-history"
        },
        
        "layers": {
            "bias": {"z_watch": 1.0, "z_action": 2.0, "abs_watch": 0.25, "abs_action": 0.60},
            
            "funding": {
                "lookback": "30d",
                "use_vol_weight": True,
                "abs_bps_per_8h": {
                    "watch": round(max(fund_p85, 5.0), 2),
                    "action": round(max(fund_p95, 10.0), 2),
                    "extreme": round(max(fund_p99, 10.0), 2)
                },
                "floors_bps_per_8h": {"watch": 5.0, "action": 10.0}
            },
            
            "taker_ratio": {
                "lookback": "30d",
                "hi": {
                    "watch": round(max(tr_p85, 1.40), 3),
                    "action": round(max(tr_p95, 1.80), 3),
                    "extreme": round(max(tr_p99, 1.90), 3)
                },
                "lo": {
                    "watch": round(min(0.70, 2 - tr_p85), 3),
                    "action": round(min(0.55, 2 - tr_p95), 3),
                    "extreme": 0.50
                }
            },
            
            "oi": {
                "roc_window": "1h",
                "roc_pct": {
                    "watch": round(oi_p85, 2),
                    "action": round(max(oi_p95, 5.0), 2)
                },
                "notes": "Action floor 5% untuk ketahanan regime shift"
            },
            
            "liquidation": {
                "lookback": "7d",
                "coin_agg_usd": {
                    "watch": round(lq_p85, 2),
                    "action": round(lq_p95, 2),
                    "extreme": round(lq_p99, 2)
                },
                "pair_confirm": {"enabled": True, "window_bars": 1}
            },
            
            "etf_flows": {
                "ma_window": 7,
                "abs_usd": {
                    "watch": round(etf_p85, 2),
                    "action": round(etf_p95, 2),
                    "extreme": round(etf_p99, 2)
                },
                "multiplier_fallback": {"watch": 1.5, "action": 3.0}
            }
        },
        
        "dynamic_tightening": {
            "enable": True,
            "trigger": {
                "layer": "liquidation",
                "quantile": "p95",
                "window": "7d",
                "threshold_usd": round(lq_p95, 2)
            },
            "adjustments": {
                "taker_ratio_hi_action": 0.05,
                "oi_roc_pct_action": 0.5
            },
            "decay_bars": 3
        },
        
        "confluence": {"watch_min": 2, "action_min": 3, "require_one_action": True, "anti_liq_flip": True},
        "cooldown": {"dedup_min": 5, "sustain_bars_for_escalation": 3},
        
        "percentile_stats": {
            "funding_bps_8h": {"p85": fund_p85, "p95": fund_p95, "p99": fund_p99},
            "taker_ratio": {"p85": tr_p85, "p95": tr_p95, "p99": tr_p99},
            "oi_roc_abs": {"p85": oi_p85, "p95": oi_p95},
            "liquidation_usd": {"p85": lq_p85, "p95": lq_p95, "p99": lq_p99},
            "etf_flows_abs": {"p85": etf_p85, "p95": etf_p95, "p99": etf_p99}
        }
    }
    
    return cfg

def main():
    """CLI interface untuk universal config generation"""
    ap = argparse.ArgumentParser(description="Universal Config Generator untuk Enhanced Sniper Engine V2")
    ap.add_argument("--coin", required=True, help="Coin symbol (e.g., BTC, ETH, SOL)")
    ap.add_argument("--bars", type=int, default=100, help="Number of bars to analyze (default: 100)")
    ap.add_argument("--out", required=True, help="Output config file path")
    ap.add_argument("--exchange", default="Binance", help="Exchange for funding data (default: Binance)")
    args = ap.parse_args()
    
    if not API_KEY:
        raise SystemExit("❌ COINGLASS_API_KEY environment variable not set")
    
    print(f"🚀 Universal Config Generator V2")
    print(f"🎯 Target: {args.coin.upper()}")
    print(f"📊 Analyzing: {args.bars} bars")
    print(f"📁 Output: {args.out}")
    print("=" * 50)
    
    try:
        # Fetch real market data
        data = fetch_coin_data(args.coin.upper(), bars=args.bars, ex_default=args.exchange)
        
        # Generate config
        cfg = generate_config(args.coin.upper(), data)
        
        # Save config
        os.makedirs(os.path.dirname(args.out) if os.path.dirname(args.out) else ".", exist_ok=True)
        with open(args.out, "w") as f:
            json.dump(cfg, f, indent=2)
        
        print(f"\n✅ SUCCESS: {args.coin.upper()}-native config written to {args.out}")
        
        # Quick stats
        stats = cfg.get("percentile_stats", {})
        print(f"\n📊 Key Thresholds:")
        print(f"  • Funding: {cfg['layers']['funding']['abs_bps_per_8h']['watch']}/{cfg['layers']['funding']['abs_bps_per_8h']['action']} bps")
        print(f"  • Taker: {cfg['layers']['taker_ratio']['hi']['watch']}/{cfg['layers']['taker_ratio']['hi']['action']} hi")
        print(f"  • OI ROC: {cfg['layers']['oi']['roc_pct']['watch']}/{cfg['layers']['oi']['roc_pct']['action']}%")
        print(f"  • Liquidation: ${cfg['layers']['liquidation']['coin_agg_usd']['watch']:,.0f}/${cfg['layers']['liquidation']['coin_agg_usd']['action']:,.0f}")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        raise SystemExit(1)

if __name__ == "__main__":
    main()
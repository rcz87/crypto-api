#!/usr/bin/env python3
"""
Universal Config Generator untuk Enhanced Sniper Engine V2
Generates coin-specific configs dari CoinGlass v4 real data
"""

import json
import requests
import numpy as np
from typing import Dict, List, Any
import os
import time

class UniversalConfigGenerator:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://open-api-v4.coinglass.com"
        self.headers = {
            'CG-API-KEY': api_key,
            'Accept': 'application/json'
        }
        
    def get_supported_coins(self) -> List[str]:
        """Get list of supported coins from futures pairs"""
        try:
            resp = requests.get(
                f"{self.base_url}/api/futures/supported-exchange-pairs",
                headers=self.headers,
                timeout=10
            )
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get('code') == '0':
                    pairs = data.get('data', [])
                    # Extract unique coins that have USDT pairs
                    coins = set()
                    for pair in pairs:
                        symbol = pair.get('symbol', '')
                        if 'USDT' in symbol:
                            coin = symbol.replace('USDT', '').replace('PERP', '')
                            if len(coin) <= 6:  # Filter reasonable coin names
                                coins.add(coin)
                    
                    return sorted(list(coins))
            
            return []
            
        except Exception as e:
            print(f"Error getting supported coins: {e}")
            return []
    
    def fetch_coin_data(self, coin: str, bars: int = 100) -> Dict[str, Any]:
        """Fetch 100-bar data untuk specific coin"""
        print(f"📊 Fetching {bars}-bar data for {coin}...")
        
        data = {
            'funding_rates': [],
            'funding_bps_8h': [],
            'taker_ratios': [],
            'oi_roc': [],
            'liquidations': []
        }
        
        # 1. Funding Rate Data
        try:
            resp = requests.get(
                f"{self.base_url}/api/futures/funding-rate/history",
                headers=self.headers,
                params={
                    'symbol': f'{coin}USDT',
                    'exchange': 'Binance',
                    'interval': '1h',
                    'limit': bars
                },
                timeout=15
            )
            
            if resp.status_code == 200:
                fund_data = resp.json()
                if fund_data.get('code') == '0' and fund_data.get('data'):
                    for item in fund_data['data']:
                        rate = float(item.get('close', 0))
                        bps_8h = abs(rate) * 10000
                        data['funding_rates'].append(rate)
                        data['funding_bps_8h'].append(bps_8h)
                    
                    print(f"✅ Funding: {len(data['funding_rates'])} bars")
                else:
                    print(f"⚠️  Funding: No data for {coin}")
                    
        except Exception as e:
            print(f"❌ Funding error for {coin}: {e}")
        
        # 2. Taker Ratio Data
        try:
            resp = requests.get(
                f"{self.base_url}/api/futures/aggregated-taker-buy-sell-volume/history",
                headers=self.headers,
                params={
                    'symbol': coin,
                    'interval': '1h',
                    'exchange_list': 'OKX,Binance,Bybit',
                    'limit': bars
                },
                timeout=15
            )
            
            if resp.status_code == 200:
                taker_data = resp.json()
                if taker_data.get('code') == '0' and taker_data.get('data'):
                    for item in taker_data['data']:
                        buy_vol = float(item.get('aggregated_buy_volume_usd', 0))
                        sell_vol = float(item.get('aggregated_sell_volume_usd', 1))
                        ratio = buy_vol / max(1, sell_vol)
                        data['taker_ratios'].append(ratio)
                    
                    print(f"✅ Taker: {len(data['taker_ratios'])} bars")
                else:
                    print(f"⚠️  Taker: No data for {coin}")
                    
        except Exception as e:
            print(f"❌ Taker error for {coin}: {e}")
        
        # 3. OI Data  
        try:
            resp = requests.get(
                f"{self.base_url}/api/futures/open-interest/aggregated-history",
                headers=self.headers,
                params={
                    'symbol': coin,
                    'interval': '1h',
                    'limit': bars
                },
                timeout=15
            )
            
            if resp.status_code == 200:
                oi_data = resp.json()
                if oi_data.get('code') == '0' and oi_data.get('data'):
                    oi_values = []
                    for item in oi_data['data']:
                        oi_val = float(item.get('close', 0))
                        oi_values.append(oi_val)
                    
                    # Calculate ROC
                    for i in range(1, len(oi_values)):
                        roc = ((oi_values[i] - oi_values[i-1]) / oi_values[i-1]) * 100
                        data['oi_roc'].append(roc)
                    
                    print(f"✅ OI: {len(data['oi_roc'])} ROC bars")
                else:
                    print(f"⚠️  OI: No data for {coin}")
                    
        except Exception as e:
            print(f"❌ OI error for {coin}: {e}")
        
        # 4. Liquidation Data
        try:
            resp = requests.get(
                f"{self.base_url}/api/futures/liquidation/aggregated-history",
                headers=self.headers,
                params={
                    'symbol': coin,
                    'interval': '1h',
                    'exchange_list': 'OKX,Binance,Bybit',
                    'limit': bars
                },
                timeout=15
            )
            
            if resp.status_code == 200:
                liq_data = resp.json()
                if liq_data.get('code') == '0' and liq_data.get('data'):
                    for item in liq_data['data']:
                        long_liq = float(item.get('aggregated_long_liquidation_usd', 0))
                        short_liq = float(item.get('aggregated_short_liquidation_usd', 0))
                        total_liq = long_liq + short_liq
                        data['liquidations'].append(total_liq)
                    
                    print(f"✅ Liquidation: {len(data['liquidations'])} bars")
                else:
                    print(f"⚠️  Liquidation: No data for {coin}")
                    
        except Exception as e:
            print(f"❌ Liquidation error for {coin}: {e}")
        
        return data
    
    def calculate_percentiles(self, values: List[float]) -> Dict[str, float]:
        """Calculate p85, p95, p99 percentiles"""
        if not values or len(values) < 10:
            return {'p85': 0.0, 'p95': 0.0, 'p99': 0.0}
        
        arr = np.array(values, dtype=float)
        return {
            'p85': round(float(np.percentile(arr, 85)), 2),
            'p95': round(float(np.percentile(arr, 95)), 2), 
            'p99': round(float(np.percentile(arr, 99)), 2)
        }
    
    def generate_config(self, coin: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate coin-specific config dari real data"""
        
        # Calculate percentiles untuk setiap layer
        funding_pctl = self.calculate_percentiles(data['funding_bps_8h'])
        taker_pctl = self.calculate_percentiles(data['taker_ratios'])
        oi_pctl = self.calculate_percentiles([abs(x) for x in data['oi_roc']])
        liq_pctl = self.calculate_percentiles(data['liquidations'])
        
        # Floor values (conservative)
        FUND_FLOOR_WATCH, FUND_FLOOR_ACTION = 5.0, 10.0
        TAKER_FLOOR_WATCH_HI, TAKER_FLOOR_ACTION_HI = 1.4, 1.8
        TAKER_FLOOR_WATCH_LO, TAKER_FLOOR_ACTION_LO = 0.7, 0.55
        OI_FLOOR_ACTION = 5.0
        
        config = {
            "asset": coin,
            "generated_from": "100-bar real market data",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            
            "layers": {
                "bias": {"z_watch": 1.0, "z_action": 2.0, "abs_watch": 0.25, "abs_action": 0.60},
                
                "funding": {
                    "lookback": "30d",
                    "use_vol_weight": True,
                    "abs_bps_per_8h": {
                        "watch": round(max(funding_pctl['p85'], FUND_FLOOR_WATCH), 2),
                        "action": round(max(funding_pctl['p95'], FUND_FLOOR_ACTION), 2),
                        "extreme": round(max(funding_pctl['p99'], FUND_FLOOR_ACTION), 2)
                    },
                    "floors_bps_per_8h": {"watch": FUND_FLOOR_WATCH, "action": FUND_FLOOR_ACTION}
                },
                
                "taker_ratio": {
                    "lookback": "30d",
                    "hi": {
                        "watch": round(max(taker_pctl['p85'], TAKER_FLOOR_WATCH_HI), 3),
                        "action": round(max(taker_pctl['p95'], TAKER_FLOOR_ACTION_HI), 3),
                        "extreme": round(max(taker_pctl['p99'], TAKER_FLOOR_ACTION_HI + 0.1), 3)
                    },
                    "lo": {
                        "watch": round(min(2.0 - taker_pctl['p85'], TAKER_FLOOR_WATCH_LO), 3),
                        "action": round(min(2.0 - taker_pctl['p95'], TAKER_FLOOR_ACTION_LO), 3),
                        "extreme": round(min(2.0 - taker_pctl['p99'], 0.50), 3)
                    }
                },
                
                "oi": {
                    "roc_window": "1h", 
                    "roc_pct": {
                        "watch": round(oi_pctl['p85'], 2),
                        "action": round(max(oi_pctl['p95'], OI_FLOOR_ACTION), 2)
                    }
                },
                
                "liquidation": {
                    "lookback": "7d",
                    "coin_agg_usd": {
                        "watch": round(liq_pctl['p85'], 2),
                        "action": round(liq_pctl['p95'], 2),
                        "extreme": round(liq_pctl['p99'], 2)
                    },
                    "pair_confirm": {"enabled": True, "window_bars": 1}
                }
            },
            
            "confluence": {"watch_min": 2, "action_min": 3, "require_one_action": True, "anti_liq_flip": True},
            "cooldown": {"dedup_min": 5, "sustain_bars_for_escalation": 3},
            
            "percentile_stats": {
                "funding_bps_8h": funding_pctl,
                "taker_ratio": taker_pctl, 
                "oi_roc_abs": oi_pctl,
                "liquidation_usd": liq_pctl
            }
        }
        
        return config

def main():
    """Demo universal config generation"""
    api_key = os.getenv('COINGLASS_API_KEY')
    if not api_key:
        print("❌ COINGLASS_API_KEY not found")
        return
    
    generator = UniversalConfigGenerator(api_key)
    
    # Test dengan 3 popular coins
    test_coins = ['BTC', 'ETH', 'SOL']
    
    print("🚀 UNIVERSAL CONFIG GENERATOR - Multi-Coin Demo")
    print("=" * 60)
    
    for coin in test_coins:
        print(f"\n🎯 Generating config for {coin}...")
        
        # Fetch real data
        data = generator.fetch_coin_data(coin, bars=50)  # 50 bars untuk demo
        
        # Generate config
        config = generator.generate_config(coin, data)
        
        # Save config
        filename = f"{coin.lower()}_native_config.json"
        with open(filename, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"✅ Config saved: {filename}")
        
        # Show key stats
        stats = config.get('percentile_stats', {})
        print(f"📊 Funding p85/p95: {stats.get('funding_bps_8h', {}).get('p85', 0)}/{stats.get('funding_bps_8h', {}).get('p95', 0)} bps")
        print(f"📊 Taker p85/p95: {stats.get('taker_ratio', {}).get('p85', 0)}/{stats.get('taker_ratio', {}).get('p95', 0)}")
        
        time.sleep(1)  # Rate limiting
    
    print(f"\n🎉 Universal config generation complete!")
    print(f"Enhanced Sniper Engine V2 sekarang support multi-coin!")

if __name__ == "__main__":
    main()
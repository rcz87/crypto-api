#!/usr/bin/env python3
"""
Coin Validator untuk Enhanced Sniper Engine V2
Batch smoke testing untuk validate 71-coin coverage di CoinGlass v4
"""

import os
import requests
import json
import time
from typing import Dict, List, Set, Tuple

API_KEY = os.getenv('COINGLASS_API_KEY')
BASE_URL = "https://open-api-v4.coinglass.com"
HEADERS = {"CG-API-KEY": API_KEY, "Accept": "application/json"}

class CoinValidator:
    def __init__(self):
        self.supported_pairs = []
        self.futures_coins = set()
        self.validation_results = {}
        
    def fetch_supported_pairs(self) -> List[str]:
        """Step 1: Resolve supported exchange pairs"""
        print("📡 Fetching supported exchange pairs...")
        
        try:
            resp = requests.get(
                f"{BASE_URL}/api/futures/supported-exchange-pairs",
                headers=HEADERS,
                timeout=15
            )
            
            if resp.status_code == 200:
                data = resp.json()
                if data.get('code') == '0':
                    pairs_data = data.get('data', [])
                    print(f"✅ Found {len(pairs_data)} supported pairs")
                    
                    # Extract futures coins
                    for pair_info in pairs_data:
                        if isinstance(pair_info, dict):
                            symbol = pair_info.get('symbol', '')
                            exchange = pair_info.get('exchange', '')
                        else:
                            # If it's just a string
                            symbol = str(pair_info)
                            exchange = 'Unknown'
                        
                        # Extract coin from USDT pairs
                        if 'USDT' in symbol:
                            coin = symbol.replace('USDT', '').replace('PERP', '').replace('-', '').strip().upper()
                            if len(coin) <= 8 and coin.isalpha() and len(coin) >= 2:
                                self.futures_coins.add(coin)
                                self.supported_pairs.append({
                                    'coin': coin,
                                    'symbol': symbol, 
                                    'exchange': exchange
                                })
                    
                    print(f"✅ Extracted {len(self.futures_coins)} unique futures coins")
                    return list(self.futures_coins)
                else:
                    print(f"❌ API Error: {data.get('msg', 'Unknown')}")
                    return []
            else:
                print(f"❌ HTTP Error: {resp.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ Error fetching pairs: {e}")
            return []
    
    def clean_coin_list(self, original_list: List[str]) -> Tuple[List[str], List[str], List[str]]:
        """Step 2: Clean up 71-coin list dengan validation"""
        print("\n🧹 Cleaning up 71-coin list...")
        
        # Remove duplicates dan problematic entries
        cleaned = []
        spot_only = []
        problematic = []
        
        seen = set()
        for coin in original_list:
            coin = coin.upper().strip()
            
            # Skip duplicates
            if coin in seen:
                print(f"  🔄 Duplicate removed: {coin}")
                continue
            seen.add(coin)
            
            # Check problematic coins
            if coin in ['FTT', 'HT', 'OKB', 'LEO', 'ELON', 'OSMO', 'JUNO', 'SCRT', 'ONE', 'HNT', 'LPT', 'BAT']:
                problematic.append(coin)
                print(f"  ⚠️  Flagged for manual check: {coin}")
                continue
            
            # Fix LUNA/LUNC confusion
            if coin == 'LUNA':
                # Check which version is actually supported
                if 'LUNA' in self.futures_coins:
                    cleaned.append('LUNA')
                elif 'LUNC' in self.futures_coins:
                    cleaned.append('LUNC')
                    print(f"  🔄 LUNA → LUNC (actual supported)")
                else:
                    spot_only.append('LUNA')
                continue
            
            # Check if coin has futures support
            if coin in self.futures_coins:
                cleaned.append(coin)
            else:
                spot_only.append(coin)
                print(f"  📊 Spot-only (no futures): {coin}")
        
        print(f"\n📊 Cleaning results:")
        print(f"  ✅ Futures supported: {len(cleaned)}")
        print(f"  📊 Spot-only: {len(spot_only)}")
        print(f"  ⚠️  Need manual check: {len(problematic)}")
        
        return cleaned, spot_only, problematic
    
    def batch_smoke_test(self, coins: List[str], max_coins: int = 10) -> Dict:
        """Step 3: Batch smoke test untuk validate 4 endpoints"""
        print(f"\n🧪 Batch smoke testing {min(len(coins), max_coins)} coins...")
        
        results = {}
        exchange_list = "OKX,Binance,Bybit"
        
        for i, coin in enumerate(coins[:max_coins]):
            print(f"\n🎯 Testing {coin} ({i+1}/{min(len(coins), max_coins)})...")
            
            coin_result = {
                'funding': False,
                'oi_aggregated': False, 
                'taker_aggregated': False,
                'liquidation_aggregated': False,
                'errors': []
            }
            
            # Test 1: Funding OHLC
            try:
                resp = requests.get(
                    f"{BASE_URL}/api/futures/funding-rate/history",
                    headers=HEADERS,
                    params={
                        'symbol': f'{coin}USDT',
                        'exchange': 'Binance',
                        'interval': '1h',
                        'limit': 3
                    },
                    timeout=10
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get('code') == '0' and data.get('data'):
                        coin_result['funding'] = True
                        print(f"  ✅ Funding: {len(data['data'])} bars")
                    else:
                        coin_result['errors'].append(f"Funding: {data.get('msg', 'No data')}")
                else:
                    coin_result['errors'].append(f"Funding: HTTP {resp.status_code}")
                    
            except Exception as e:
                coin_result['errors'].append(f"Funding: {str(e)[:50]}")
            
            # Test 2: OI Aggregated
            try:
                resp = requests.get(
                    f"{BASE_URL}/api/futures/open-interest/aggregated-history",
                    headers=HEADERS,
                    params={
                        'symbol': coin,
                        'interval': '1h',
                        'limit': 3
                    },
                    timeout=10
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get('code') == '0' and data.get('data'):
                        coin_result['oi_aggregated'] = True
                        print(f"  ✅ OI Agg: {len(data['data'])} bars")
                    else:
                        coin_result['errors'].append(f"OI: {data.get('msg', 'No data')}")
                else:
                    coin_result['errors'].append(f"OI: HTTP {resp.status_code}")
                    
            except Exception as e:
                coin_result['errors'].append(f"OI: {str(e)[:50]}")
            
            # Test 3: Taker Aggregated
            try:
                resp = requests.get(
                    f"{BASE_URL}/api/futures/aggregated-taker-buy-sell-volume/history",
                    headers=HEADERS,
                    params={
                        'symbol': coin,
                        'interval': '1h',
                        'exchange_list': exchange_list,
                        'limit': 3
                    },
                    timeout=10
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get('code') == '0' and data.get('data'):
                        coin_result['taker_aggregated'] = True
                        print(f"  ✅ Taker: {len(data['data'])} bars")
                    else:
                        coin_result['errors'].append(f"Taker: {data.get('msg', 'No data')}")
                else:
                    coin_result['errors'].append(f"Taker: HTTP {resp.status_code}")
                    
            except Exception as e:
                coin_result['errors'].append(f"Taker: {str(e)[:50]}")
            
            # Test 4: Liquidation Aggregated
            try:
                resp = requests.get(
                    f"{BASE_URL}/api/futures/liquidation/aggregated-history",
                    headers=HEADERS,
                    params={
                        'symbol': coin,
                        'interval': '1h',
                        'exchange_list': exchange_list,
                        'limit': 3
                    },
                    timeout=10
                )
                
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get('code') == '0' and data.get('data'):
                        coin_result['liquidation_aggregated'] = True
                        print(f"  ✅ Liquidation: {len(data['data'])} bars")
                    else:
                        coin_result['errors'].append(f"Liquidation: {data.get('msg', 'No data')}")
                else:
                    coin_result['errors'].append(f"Liquidation: HTTP {resp.status_code}")
                    
            except Exception as e:
                coin_result['errors'].append(f"Liquidation: {str(e)[:50]}")
            
            # Calculate success score
            success_count = sum([
                coin_result['funding'],
                coin_result['oi_aggregated'],
                coin_result['taker_aggregated'],
                coin_result['liquidation_aggregated']
            ])
            
            coin_result['success_score'] = f"{success_count}/4"
            coin_result['status'] = 'PASS' if success_count >= 3 else 'PARTIAL' if success_count >= 2 else 'FAIL'
            
            print(f"  📊 Score: {coin_result['success_score']} ({coin_result['status']})")
            
            results[coin] = coin_result
            
            # Rate limiting
            time.sleep(1)
        
        return results
    
    def generate_final_list(self, test_results: Dict) -> List[str]:
        """Generate final production-ready coin list"""
        print(f"\n🎯 Generating final production coin list...")
        
        tier_1 = []  # 4/4 endpoints
        tier_2 = []  # 3/4 endpoints  
        tier_3 = []  # 2/4 endpoints
        failed = []  # <2/4 endpoints
        
        for coin, result in test_results.items():
            success_count = sum([
                result['funding'],
                result['oi_aggregated'], 
                result['taker_aggregated'],
                result['liquidation_aggregated']
            ])
            
            if success_count == 4:
                tier_1.append(coin)
            elif success_count == 3:
                tier_2.append(coin)
            elif success_count == 2:
                tier_3.append(coin)
            else:
                failed.append(coin)
        
        print(f"📊 Final categorization:")
        print(f"  🟢 Tier 1 (4/4): {len(tier_1)} coins - {tier_1}")
        print(f"  🟡 Tier 2 (3/4): {len(tier_2)} coins - {tier_2}")
        print(f"  🟠 Tier 3 (2/4): {len(tier_3)} coins - {tier_3}")
        print(f"  🔴 Failed (<2/4): {len(failed)} coins - {failed}")
        
        # Production recommendation: Tier 1 + Tier 2
        production_ready = tier_1 + tier_2
        print(f"\n🚀 PRODUCTION READY: {len(production_ready)} coins")
        
        return production_ready

def main():
    """Main validation workflow"""
    if not API_KEY:
        print("❌ COINGLASS_API_KEY not set")
        return
    
    # Original 71-coin list (dengan duplicates & problematic)
    original_coins = [
        'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'LINK',
        'AVAX', 'UNI', 'LTC', 'ATOM', 'XLM', 'NEAR', 'ALGO', 'FTM', 'ONE', 'LUNA', 
        'TERRA', 'OSMO', 'JUNO', 'SCRT', 'AAVE', 'CRV', 'SUSHI', 'COMP', 'YFI', 'MKR', 
        'SNX', 'BAL', 'ZRX', '1INCH', 'CAKE', 'ALPHA', 'RUNE', 'PERP', 'GMT', 'APE',
        'LOOKS', 'SAND', 'MANA', 'ENJ', 'CHZ', 'THETA', 'AXS', 'SLP', 'GALA', 'GMT',
        'GRT', 'FIL', 'AR', 'HNT', 'STORJ', 'OCEAN', 'LPT', 'BAT', 'XMR', 'ZEC', 
        'DASH', 'ZEN', 'CRO', 'FTT', 'HT', 'OKB', 'LEO', 'SHIB', 'PEPE', 'FLOKI', 'ELON'
    ]
    
    print("🚀 COIN VALIDATOR - Enhanced Sniper Engine V2")
    print("=" * 60)
    
    validator = CoinValidator()
    
    # Step 1: Fetch supported pairs
    supported_coins = validator.fetch_supported_pairs()
    if not supported_coins:
        print("❌ Failed to fetch supported pairs")
        return
    
    # Step 2: Clean coin list
    cleaned_coins, spot_only, problematic = validator.clean_coin_list(original_coins)
    
    # Step 3: Batch smoke test (limited sample untuk demo)
    test_results = validator.batch_smoke_test(cleaned_coins, max_coins=15)
    
    # Step 4: Generate final production list
    production_coins = validator.generate_final_list(test_results)
    
    # Save results
    results = {
        'original_count': len(original_coins),
        'futures_supported': len(cleaned_coins),
        'spot_only': spot_only,
        'problematic': problematic,
        'test_results': test_results,
        'production_ready': production_coins,
        'timestamp': time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    with open('coin_validation_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✅ Validation complete! Results saved to coin_validation_results.json")
    print(f"🎯 Production ready: {len(production_coins)} coins verified")

if __name__ == "__main__":
    main()
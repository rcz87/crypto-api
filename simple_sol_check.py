#!/usr/bin/env python3
import requests
import json
from datetime import datetime

# Data dari GPT
gpt_price = 191.87
gpt_volume = 1.61e9  # $1.61 Miliar
gpt_oi = 797.43e6    # $797.43 Juta
gpt_funding = 0.0102  # +0.0102%

print("=== VERIFIKASI DATA SOL ===")
print(f"Waktu: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

try:
    # Get current price dan volume
    resp = requests.get("https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=SOLUSDT", timeout=10)
    data = resp.json()
    
    real_price = float(data['lastPrice'])
    real_volume = float(data['quoteVolume'])
    
    # Get open interest
    resp_oi = requests.get("https://fapi.binance.com/fapi/v1/openInterest?symbol=SOLUSDT", timeout=10)
    oi_data = resp_oi.json()
    real_oi = float(oi_data['openInterest']) * real_price
    
    # Get funding rate
    resp_fr = requests.get("https://fapi.binance.com/fapi/v1/premiumIndex?symbol=SOLUSDT", timeout=10)
    fr_data = resp_fr.json()
    real_funding = float(fr_data['lastFundingRate']) * 100
    
    print(f"\nData GPT:")
    print(f"  Harga: ${gpt_price}")
    print(f"  Volume: ${gpt_volume/1e9:.2f}B")
    print(f"  OI: ${gpt_oi/1e6:.1f}M")
    print(f"  Funding: +{gpt_funding:.4f}%")
    
    print(f"\nData Real Binance:")
    print(f"  Harga: ${real_price}")
    print(f"  Volume: ${real_volume/1e9:.2f}B")
    print(f"  OI: ${real_oi/1e6:.1f}M")
    print(f"  Funding: {real_funding:+.4f}%")
    
    # Calculate accuracy
    price_acc = (1 - abs(real_price - gpt_price)/real_price) * 100
    vol_acc = (1 - abs(real_volume - gpt_volume)/real_volume) * 100
    oi_acc = (1 - abs(real_oi - gpt_oi)/real_oi) * 100
    avg_acc = (price_acc + vol_acc + oi_acc) / 3
    
    print(f"\nAkurasi:")
    print(f"  Harga: {price_acc:.1f}%")
    print(f"  Volume: {vol_acc:.1f}%")
    print(f"  OI: {oi_acc:.1f}%")
    print(f"  Rata-rata: {avg_acc:.1f}%")
    
    if avg_acc >= 95:
        print("  KESIMPULAN: SANGAT AKURAT")
    elif avg_acc >= 90:
        print("  KESIMPULAN: AKURAT")
    else:
        print("  KESIMPULAN: KURANG AKURAT")
    
    # Save results
    result = {
        "timestamp": datetime.now().isoformat(),
        "gpt_data": {
            "price": gpt_price,
            "volume_24h": gpt_volume,
            "open_interest": gpt_oi,
            "funding_rate": gpt_funding
        },
        "real_data": {
            "price": real_price,
            "volume_24h": real_volume,
            "open_interest": real_oi,
            "funding_rate": real_funding
        },
        "accuracy": {
            "price": price_acc,
            "volume": vol_acc,
            "open_interest": oi_acc,
            "average": avg_acc
        }
    }
    
    with open("/root/crypto-api/sol_check_result.json", "w") as f:
        json.dump(result, f, indent=2)
    
    print(f"\nResult saved to: sol_check_result.json")
    
except Exception as e:
    print(f"Error: {e}")

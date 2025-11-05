#!/usr/bin/env python3
"""
Script untuk memverifikasi data SOL yang diberikan oleh GPT
dengan mengambil data real-time dari Binance API
"""

import requests
import json
from datetime import datetime
import sys

def get_binance_sol_data():
    """Ambil data real-time SOL dari Binance Futures API"""
    
    # Data GPT yang ingin diverifikasi
    gpt_data = {
        "price": 191.87,
        "volume_24h": 1.61e9,  # $1.61 Miliar
        "open_interest": 797.43e6,  # $797.43 Juta
        "funding_rate": 0.0102,  # +0.0102%
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    print("🔍 VERIFIKASI DATA SOL (30 Okt 2025)")
    print("=" * 50)
    print(f"⏰ Waktu Verifikasi: {gpt_data['timestamp']}")
    print()
    
    # Data dari GPT
    print("📊 DATA DARI GPT:")
    print(f"   Harga: ${gpt_data['price']:.2f}")
    print(f"   Volume 24h: ${gpt_data['volume_24h']/1e9:.2f} Miliar")
    print(f"   Open Interest: ${gpt_data['open_interest']/1e6:.2f} Juta")
    print(f"   Funding Rate: +{gpt_data['funding_rate']:.4f}%")
    print()
    
    try:
        # 1. Get ticker data (harga dan volume)
        ticker_url = "https://fapi.binance.com/fapi/v1/ticker/24hr"
        ticker_params = {"symbol": "SOLUSDT"}
        ticker_response = requests.get(ticker_url, params=ticker_params, timeout=10)
        ticker_data = ticker_response.json()
        
        # 2. Get open interest
        oi_url = "https://fapi.binance.com/fapi/v1/openInterest"
        oi_params = {"symbol": "SOLUSDT"}
        oi_response = requests.get(oi_url, params=oi_params, timeout=10)
        oi_data = oi_response.json()
        
        # 3. Get funding rate
        funding_url = "https://fapi.binance.com/fapi/v1/premiumIndex"
        funding_params = {"symbol": "SOLUSDT"}
        funding_response = requests.get(funding_url, params=funding_params, timeout=10)
        funding_data = funding_response.json()
        
        # 4. Get recent trades untuk CVD analysis (simplified)
        trades_url = "https://fapi.binance.com/fapi/v1/trades"
        trades_params = {"symbol": "SOLUSDT", "limit": 100}
        trades_response = requests.get(trades_url, params=trades_params, timeout=10)
        trades_data = trades_response.json()
        
        # Proses data real-time
        real_price = float(ticker_data['lastPrice'])
        real_volume = float(ticker_data['quoteVolume'])
        real_oi = float(oi_data['openInterest']) * real_price  # Convert to USD
        real_funding_rate = float(funding_data['lastFundingRate']) * 100  # Convert to percentage
        
        # Simple CVD calculation (buy vs sell volume)
        buy_volume = sum(float(t['quoteQty']) for t in trades_data if t['isBuyerMaker'])
        sell_volume = sum(float(t['quoteQty']) for t in trades_data if not t['isBuyerMaker'])
        cvd_trend = "Bearish" if sell_volume > buy_volume else "Bullish"
        
        print("📈 DATA REAL-TIME DARI BINANCE:")
        print(f"   Harga: ${real_price:.2f}")
        print(f"   Volume 24h: ${real_volume/1e9:.2f} Miliar")
        print(f"   Open Interest: ${real_oi/1e6:.2f} Juta")
        print(f"   Funding Rate: {real_funding_rate:+.4f}%")
        print(f"   CVD Trend (100 trades terakhir): {cvd_trend}")
        print()
        
        # Verifikasi perbedaan
        print("🔍 ANALISIS PERBANDINGAN:")
        
        # Harga
        price_diff = abs(real_price - gpt_data['price'])
        price_acc = (1 - price_diff/real_price) * 100
        print(f"   Harga: {price_acc:.1f}% akurat (selisih ${price_diff:.2f})")
        
        # Volume
        vol_diff = abs(real_volume - gpt_data['volume_24h'])
        vol_acc = (1 - vol_diff/real_volume) * 100
        print(f"   Volume: {vol_acc:.1f}% akurat (selisih ${vol_diff/1e9:.2f} Miliar)")
        
        # Open Interest
        oi_diff = abs(real_oi - gpt_data['open_interest'])
        oi_acc = (1 - oi_diff/real_oi) * 100
        print(f"   Open Interest: {oi_acc:.1f}% akurat (selisih ${oi_diff/1e6:.2f} Juta)")
        
        # Funding Rate
        fr_diff = abs(real_funding_rate - gpt_data['funding_rate'])
        print(f"   Funding Rate: Selisih {fr_diff:.4f}%")
        
        print()
        
        # Kesimpulan
        avg_accuracy = (price_acc + vol_acc + oi_acc) / 3
        
        print("📝 KESIMPULAN:")
        if avg_accuracy >= 95:
            print("   ✅ Data GPT SANGAT AKURAT (>95%)")
        elif avg_accuracy >= 90:
            print("   ✅ Data GPT AKURAT (>90%)")
        elif avg_accuracy >= 80:
            print("   ⚠️  Data GPT CUKUP AKURAT (>80%)")
        else:
            print("   ❌ Data GPT KURANG AKURAT (<80%)")
        
        print(f"   📊 Rata-rata akurasi: {avg_accuracy:.1f}%")
        print(f"   🕐 Data real-time diambil: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # CVD Analysis verification
        print()
        print("🧠 ANALISIS CVD:")
        if cvd_trend == "Bearish":
            print("   ✅ CVD bearish sesuai dengan analisis GPT")
            print("   💡 Ini menunjukkan tekanan jual dominan dalam jangka pendek")
        else:
            print("   ⚠️  CVD tidak bearish (berbeda dengan analisis GPT)")
        
        # Rekomendasi
        print()
        print("💡 REKOMENDASI TRADING:")
        if real_funding_rate > 0:
            print("   • Funding rate positif → Long positions membayar short")
            print("   • Bias bullish ringan terdeteksi")
        else:
            print("   • Funding rate negatif → Short positions membayar long")
            print("   • Bias bearish ringan terdeteksi")
        
        if cvd_trend == "Bearish" and real_volume > 1e9:
            print("   • Volume tinggi dengan CVD bearish → Potensi akumulasi institusi")
            print("   • Watch untuk reversal pattern")
        
        return {
            "gpt_data": gpt_data,
            "real_data": {
                "price": real_price,
                "volume_24h": real_volume,
                "open_interest": real_oi,
                "funding_rate": real_funding_rate,
                "cvd_trend": cvd_trend
            },
            "accuracy": avg_accuracy
        }
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error mengambil data dari Binance: {e}")
        return None
    except KeyError as e:
        print(f"❌ Error parsing data: {e}")
        return None
    except Exception as e:
        print(f"❌ Error tidak terduga: {e}")
        return None

if __name__ == "__main__":
    result = get_binance_sol_data()
    
    if result:
        # Save result untuk reference
        with open("/root/crypto-api/sol_verification_result.json", "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\n💾 Result disimpan ke: sol_verification_result.json")
    else:
        print("\n❌ Gagal memverifikasi data SOL")
        sys.exit(1)

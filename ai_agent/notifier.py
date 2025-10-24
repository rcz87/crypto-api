# ============================================
# 📦 notifier.py — Kirim notifikasi Telegram
# Bisa dimatikan tanpa hapus fungsi (flexible)
# ============================================

import os
import requests

# Ambil token & chat ID dari .env
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# Optional ENV untuk menonaktifkan pengiriman Telegram
TELEGRAM_ENABLED = os.getenv("TELEGRAM_ENABLED", "true").lower() == "true"

def send_telegram(message: str):
    """
    Kirim pesan ke Telegram.
    Jika TELEGRAM_ENABLED=false → hanya print ke console, tidak kirim.
    """
    if not TELEGRAM_ENABLED:
        print(f"🚫 [Telegram Disabled] Pesan tidak dikirim:\n{message}")
        return False

    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("⚠️ [Telegram Skipped] TOKEN atau CHAT_ID tidak ditemukan di .env")
        return False

    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        response = requests.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message
        })

        if response.status_code == 200:
            print(f"✅ [Telegram OK] Pesan terkirim: {message}")
            return True
        else:
            print(f"❌ [Telegram Error] Status Code: {response.status_code}, Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ [Telegram Exception] {e}")
        return False


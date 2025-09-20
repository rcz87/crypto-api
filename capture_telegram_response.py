#!/usr/bin/env python3
"""
Capture Raw Telegram JSON Response
Untuk verifikasi parser sesuai Bot API spec
"""

import asyncio
import aiohttp
import json
import os
import sys

async def capture_telegram_response():
    """Capture raw JSON response dari Telegram sendMessage"""
    
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    chat_id = os.getenv('TELEGRAM_CHAT_ID')
    
    if not bot_token or not chat_id:
        print("❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID")
        return None
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    
    payload = {
        'chat_id': chat_id,
        'text': '🧪 JSON Response Capture Test - Enhanced Sniper V2',
        'parse_mode': 'Markdown',
        'disable_web_page_preview': True
    }
    
    print("📤 Sending test message to capture raw JSON...")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                
                if response.status == 200:
                    raw_json = await response.json()
                    
                    print("✅ Raw JSON Response dari Telegram Bot API:")
                    print("=" * 60)
                    print(json.dumps(raw_json, indent=2, ensure_ascii=False))
                    print("=" * 60)
                    
                    # Extract 5 field inti yang diminta
                    if raw_json.get('ok'):
                        result = raw_json.get('result', {})
                        chat = result.get('chat', {})
                        
                        core_fields = {
                            'ok': raw_json.get('ok'),
                            'result.message_id': result.get('message_id'),
                            'result.chat.id': chat.get('id'),
                            'result.date': result.get('date'),
                            'result.text': result.get('text')
                        }
                        
                        print("\n📊 5 Field Inti untuk Verifikasi:")
                        print("-" * 40)
                        for field, value in core_fields.items():
                            print(f"• {field}: {value}")
                        
                        return raw_json
                    else:
                        print(f"❌ Telegram API error: {raw_json}")
                else:
                    error_text = await response.text()
                    print(f"❌ HTTP {response.status}: {error_text}")
                    
    except Exception as e:
        print(f"❌ Error: {e}")
    
    return None

if __name__ == "__main__":
    asyncio.run(capture_telegram_response())
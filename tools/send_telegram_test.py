#!/usr/bin/env python3
"""
Telegram Test Script
Send test message untuk Enhanced Sniper V2
"""

import asyncio
import sys
import os

# Add path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'coinglass-system'))

from app.core.telegram_http import get_telegram_client

async def send_test_message(message: str):
    """Send test message to Telegram"""
    try:
        telegram = get_telegram_client()
        
        if not telegram.is_configured():
            print("❌ Telegram not configured - missing BOT_TOKEN or CHAT_ID")
            return False
        
        print(f"📱 Sending test message: {message}")
        
        result = await telegram.send_message(message)
        
        if result and isinstance(result, dict) and 'message_id' in result:
            print(f"✅ Message sent successfully!")
            print(f"📊 HTTP 200 - message_id: {result['message_id']}")
            return True
        else:
            print(f"❌ Failed to send message: {result}")
            return False
            
    except Exception as e:
        print(f"❌ Error sending test message: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 tools/send_telegram_test.py 'message'")
        sys.exit(1)
    
    message = sys.argv[1]
    success = asyncio.run(send_test_message(message))
    sys.exit(0 if success else 1)
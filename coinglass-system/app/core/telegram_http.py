#!/usr/bin/env python3
"""
HTTP-based Telegram Bot Client
Lightweight Telegram integration tanpa external dependencies
"""

import os
import json
import asyncio
import aiohttp
import random
import math
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Telegram Bot API constants
MSG_LIMIT = 4096  # Official text message limit (UTF-8)

def chunk_text(text: str, limit: int = MSG_LIMIT) -> List[str]:
    """Potong pesan panjang menjadi <=4096 char per bagian (aman untuk sendMessage)"""
    if len(text) <= limit:
        return [text]
    
    parts = []
    i = 0
    while i < len(text):
        parts.append(text[i:i+limit])
        i += limit
    return parts

class TelegramHTTP:
    """Enhanced Telegram client dengan robust error handling"""
    
    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.chat_id = os.getenv('TELEGRAM_CHAT_ID')
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None
        
        if not self.bot_token or not self.chat_id:
            logger.warning("🔔 Telegram not configured - TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing")
    
    def is_configured(self) -> bool:
        """Check if Telegram is properly configured"""
        return bool(self.bot_token and self.chat_id)
    
    async def send_message(
        self, 
        text: str, 
        parse_mode: str = 'Markdown',
        disable_web_page_preview: bool = True,
        disable_notification: bool = False,
        max_retries: int = 3
    ) -> Optional[Dict[str, Any]]:
        """
        Enhanced send message dengan:
        - Auto-split kalau >4096 chars
        - Auto-retry 429 pakai parameters.retry_after  
        - Clean logging sesuai Bot API spec
        """
        
        if not self.is_configured():
            logger.debug("📤 Telegram not configured - message skipped")
            return None
        
        # Auto-split kalau terlalu panjang
        parts = chunk_text(text, MSG_LIMIT)
        
        last_result = None
        async with aiohttp.ClientSession() as session:
            
            for idx, part in enumerate(parts, start=1):
                payload = {
                    'chat_id': self.chat_id,
                    'text': part,
                    'parse_mode': parse_mode,
                    'disable_web_page_preview': disable_web_page_preview,
                    'disable_notification': disable_notification
                }
                
                attempt = 0
                while attempt <= max_retries:
                    attempt += 1
                    
                    try:
                        async with session.post(
                            f"{self.base_url}/sendMessage",
                            json=payload,
                            timeout=aiohttp.ClientTimeout(total=20)
                        ) as response:
                            
                            data = await response.json()
                            
                            # SUCCESS: Parse Message object
                            if data.get('ok'):
                                result = data.get('result', {})
                                message_id = result.get('message_id', 0)
                                chat = result.get('chat') or {}
                                chat_id = chat.get('id')
                                
                                # Clean log format
                                logger.info(f"[TELE] ✅ sent msg_id={message_id} chat={chat_id} "
                                          f"part={idx}/{len(parts)} len={len(part)}")
                                
                                last_result = {
                                    'ok': True,
                                    'message_id': message_id,
                                    'chat_id': chat_id,
                                    'date': result.get('date'),
                                    'text': result.get('text') or result.get('caption'),
                                }
                                break  # Success, lanjut ke part berikutnya
                            
                            # ERROR HANDLING terstruktur
                            code = data.get('error_code')
                            desc = (data.get('description') or '').lower()
                            params = data.get('parameters') or {}
                            
                            # 429 Too Many Requests → hormati retry_after
                            if code == 429 and 'retry_after' in params:
                                delay = float(params['retry_after']) + random.uniform(0, 0.5)
                                logger.warning(f"[TELE] ⏳ 429 Too Many Requests — retry_after={delay:.2f}s "
                                             f"(attempt {attempt}/{max_retries})")
                                await asyncio.sleep(delay)
                                continue
                            
                            # 400 'message is too long' → fallback split smaller
                            if code == 400 and 'message is too long' in desc:
                                logger.warning(f"[TELE] ✂️ 400 Message Too Long — re-splitting smaller chunks")
                                # Fallback ke chunks lebih kecil
                                smaller_parts = chunk_text(part, limit=3500)
                                parts = parts[:idx-1] + smaller_parts + parts[idx:]
                                break  # Ulang dengan potongan baru
                            
                            # 400 'chat not found' atau 403 'blocked' → terminal
                            if ((code == 400 and 'chat not found' in desc) or 
                                (code == 403 and 'blocked' in desc)):
                                logger.error(f"[TELE] 🛑 {code} {desc} — check chat_id/permission; no retry")
                                return {
                                    'ok': False,
                                    'error_code': code,
                                    'description': data.get('description', 'Unknown'),
                                    'parameters': params
                                }
                            
                            # 5xx / error lain → exponential backoff
                            if 500 <= (response.status or 0) < 600 or attempt <= max_retries:
                                backoff = min(8.0, 0.5 * (2 ** (attempt - 1)))
                                logger.warning(f"[TELE] 🔁 {code} {desc or response.status} — backoff={backoff:.2f}s "
                                             f"(attempt {attempt}/{max_retries})")
                                await asyncio.sleep(backoff)
                                continue
                            
                            # Mentok retry
                            logger.error(f"[TELE] ❌ failed after {max_retries} retries — code={code} desc={desc}")
                            return {
                                'ok': False,
                                'error_code': code,
                                'description': data.get('description', 'Max retries exceeded'),
                                'parameters': params
                            }
                    
                    except asyncio.TimeoutError:
                        logger.error(f"[TELE] ⏰ timeout (attempt {attempt}/{max_retries})")
                        if attempt <= max_retries:
                            await asyncio.sleep(1.0 * attempt)
                            continue
                        return None
                    
                    except Exception as e:
                        logger.error(f"[TELE] ❌ exception: {e} (attempt {attempt}/{max_retries})")
                        if attempt <= max_retries:
                            await asyncio.sleep(1.0 * attempt)
                            continue
                        return None
        
        return last_result
    
    async def send_whale_alert(
        self,
        coin: str,
        signal_type: str,
        confidence: str,
        taker_ratio: float,
        oi_roc: float,
        funding_bps: Optional[float] = None,
        timestamp: Optional[str] = None
    ) -> bool:
        """Send formatted whale alert"""
        
        # Format alert message
        emoji = "🟢" if signal_type == "accumulation" else "🔴"
        confidence_emoji = "🎯" if confidence == "action" else "👀"
        
        alert_text = f"{emoji} {confidence_emoji} **WHALE {signal_type.upper()}**\n"
        alert_text += f"**{coin}** (1h)\n\n"
        alert_text += f"• Taker Ratio: {taker_ratio:.2f}\n"
        alert_text += f"• OI ROC: {oi_roc*100:+.1f}%\n"
        
        if funding_bps:
            alert_text += f"• Funding: {funding_bps:.1f} bps/8h\n"
        
        alert_text += f"• Confidence: {confidence.upper()}\n"
        
        if timestamp:
            alert_text += f"• Time: {timestamp}\n"
        
        alert_text += "\n"
        
        if confidence == "action":
            action_text = "Siapkan entry plan" if signal_type == "accumulation" else "Kurangi eksposur"
            alert_text += f"💡 **Action**: {action_text}"
        else:
            alert_text += f"👁️ **Watch**: Monitor validasi di bar berikutnya"
        
        return await self.send_message(alert_text)
    
    async def send_monitor_status(self, message: str, is_error: bool = False) -> bool:
        """Send monitoring status update"""
        emoji = "❌" if is_error else "📊"
        status_text = f"{emoji} **Whale Monitor Status**\n{message}"
        return await self.send_message(status_text)
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test Telegram connection"""
        if not self.is_configured():
            return {
                'configured': False,
                'error': 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID'
            }
        
        try:
            test_message = "🧪 **Test Message**\nWhale Detection System - Connection Test"
            success = await self.send_message(test_message)
            
            return {
                'configured': True,
                'connection_test': success,
                'bot_token_set': bool(self.bot_token),
                'chat_id_set': bool(self.chat_id)
            }
            
        except Exception as e:
            return {
                'configured': True,
                'connection_test': False,
                'error': str(e)
            }

# Singleton instance
telegram_client = None

def get_telegram_client() -> TelegramHTTP:
    """Get singleton Telegram client"""
    global telegram_client
    if telegram_client is None:
        telegram_client = TelegramHTTP()
    return telegram_client
#!/usr/bin/env python3
"""
HTTP-based Telegram Bot Client
Lightweight Telegram integration tanpa external dependencies
"""

import os
import json
import asyncio
import aiohttp
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class TelegramHTTP:
    """Lightweight Telegram client menggunakan HTTP requests saja"""
    
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
        disable_notification: bool = False
    ) -> Optional[Dict[str, Any]]:
        """Send message to Telegram using HTTP API - returns message_id"""
        
        if not self.is_configured():
            logger.debug("📤 Telegram not configured - message skipped")
            return None
        
        try:
            payload = {
                'chat_id': self.chat_id,
                'text': text,
                'parse_mode': parse_mode,
                'disable_web_page_preview': disable_web_page_preview,
                'disable_notification': disable_notification
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/sendMessage",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    
                    # Parse response according to Bot API spec
                    data = await response.json()
                    
                    # Handle both success and error responses per Bot API pattern
                    if not data.get('ok'):
                        # Error response: {"ok": false, "error_code": 400, "description": "...", "parameters": {...}}
                        error_code = data.get('error_code', response.status)
                        description = data.get('description', 'Unknown error')
                        parameters = data.get('parameters', {})
                        
                        # Handle retry_after for rate limiting (429)
                        if 'retry_after' in parameters:
                            retry_after = parameters['retry_after']
                            logger.warning(f"⏳ Telegram rate limited - retry after {retry_after}s")
                        
                        logger.error(f"❌ Telegram API error {error_code}: {description}")
                        
                        return {
                            'ok': False,
                            'error_code': error_code,
                            'description': description,
                            'parameters': parameters
                        }
                    
                    # Success response: parse Message object from result
                    result = data.get('result', {})
                    message_id = result.get('message_id', 0)
                    chat = result.get('chat') or {}
                    chat_id = chat.get('id')
                    
                    logger.info(f"✅ Telegram message sent successfully - message_id: {message_id}")
                    
                    return {
                        'ok': True,
                        'message_id': message_id,
                        'chat_id': chat_id,  # Support negative IDs for groups/supergroups
                        'date': result.get('date'),
                        'text': result.get('text') or result.get('caption'),  # Support both text and media captions
                    }
                        
        except asyncio.TimeoutError:
            logger.error("❌ Telegram request timeout")
            return None
        except Exception as e:
            logger.error(f"❌ Telegram send error: {e}")
            return None
    
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
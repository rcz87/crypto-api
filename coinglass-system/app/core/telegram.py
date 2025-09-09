import asyncio
from telegram import Bot
from app.core.settings import settings

class TelegramNotifier:
    def __init__(self):
        self.bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
        self.chat_id = settings.TELEGRAM_CHAT_ID

    async def send_message(self, message: str):
        try:
            await self.bot.send_message(chat_id=self.chat_id, text=message, parse_mode='HTML')
        except Exception as e:
            print(f"Failed to send telegram message: {e}")

    def send_alert(self, alert_type: str, symbol: str, message: str):
        emoji_map = {
            "liquidation": "🔥",
            "funding": "💰", 
            "whale": "🐋",
            "anomaly": "⚠️"
        }
        emoji = emoji_map.get(alert_type, "📊")
        
        formatted_message = f"{emoji} <b>{alert_type.upper()}</b> Alert\n"
        formatted_message += f"Symbol: <code>{symbol}</code>\n"
        formatted_message += f"Message: {message}"
        
        asyncio.create_task(self.send_message(formatted_message))
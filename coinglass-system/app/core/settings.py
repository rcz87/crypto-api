from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    CG_API_KEY: str
    DB_URL: str
    REDIS_URL: str
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_CHAT_ID: str
    SYMBOLS: List[str] = ["BTC", "ETH", "SOL"]
    EXCHANGES: List[str] = ["Binance", "OKX", "Bybit"]
    FETCH_INTERVAL_SECONDS: int = 30
    WS_RECONNECT_SECONDS: int = 5
    API_PORT: int = 8080
    ENV: str = "dev"

    model_config = {"env_file": ".env", "case_sensitive": False}

settings = Settings()
from pydantic_settings import BaseSettings
from typing import List
import secrets
import os

class Settings(BaseSettings):
    # API Configuration
    CG_API_KEY: str
    DB_URL: str = os.getenv("DATABASE_URL", "sqlite:///./coinglass.db")  # Use Replit PostgreSQL
    REDIS_URL: str = "redis://localhost:6379"  # Will be replaced with ReplDB
    TELEGRAM_BOT_TOKEN: str = ""  # Optional
    TELEGRAM_CHAT_ID: str = ""  # Optional
    
    # Trading Configuration
    SYMBOLS: List[str] = ["BTC", "ETH", "SOL"]
    EXCHANGES: List[str] = ["Binance", "OKX", "Bybit"]
    FETCH_INTERVAL_SECONDS: int = 30
    WS_RECONNECT_SECONDS: int = 5
    API_PORT: int = 8080
    ENV: str = "dev"
    
    # Security Configuration
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    ALLOWED_HOSTS: List[str] = ["*"]
    CORS_ORIGINS: List[str] = ["*"]
    
    # Database Configuration
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 30
    DB_POOL_PRE_PING: bool = True
    DB_POOL_RECYCLE: int = 3600
    
    # Cache Configuration
    REDIS_MAX_CONNECTIONS: int = 100
    CACHE_TTL_SECONDS: int = 300
    
    # Performance Configuration
    WORKER_CONCURRENCY: int = 4
    BATCH_SIZE: int = 1000
    MAX_RETRIES: int = 3
    
    # Monitoring Configuration
    LOG_LEVEL: str = "INFO"
    METRICS_ENABLED: bool = True
    TRACING_ENABLED: bool = True
    
    # Business Configuration
    SIGNAL_COOLDOWN_MINUTES: int = 5
    MAX_ALERTS_PER_HOUR: int = 20
    BACKUP_RETENTION_DAYS: int = 30
    
    # CoinGlass Tier Configuration
    CG_TIER: str = "standard"  # Options: standard, pro, enterprise

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}

settings = Settings()
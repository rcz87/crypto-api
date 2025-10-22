"""
Configuration settings for the Liquidation Heatmap System
"""
import os
from typing import Dict, List

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/liquidation_heatmap")
PGHOST = os.getenv("PGHOST", "localhost")
PGPORT = os.getenv("PGPORT", "5432")
PGDATABASE = os.getenv("PGDATABASE", "liquidation_heatmap")
PGUSER = os.getenv("PGUSER", "postgres")
PGPASSWORD = os.getenv("PGPASSWORD", "password")

# Exchange Configuration
BINANCE_BASE_URL = "https://fapi.binance.com"
BINANCE_WS_URL = "wss://fstream.binance.com"
OKX_BASE_URL = "https://www.okx.com"
BYBIT_BASE_URL = "https://api.bybit.com"

# Exchange Market Share Weights for Aggregation
EXCHANGE_WEIGHTS = {
    "binance": 0.45,
    "okx": 0.18,
    "bybit": 0.17,
    "others": 0.20
}

# Leverage Tiers Configuration
LEVERAGE_TIERS = {
    "low": {"range": (1, 5), "color": "#2ecc71", "risk": "Low Risk"},
    "moderate": {"range": (5, 10), "color": "#f39c12", "risk": "Moderate Risk"},
    "high": {"range": (10, 25), "color": "#e74c3c", "risk": "High Risk"},
    "very_high": {"range": (25, 50), "color": "#8e44ad", "risk": "Very High Risk"},
    "extreme": {"range": (50, 125), "color": "#c0392b", "risk": "Extreme Risk"}
}

# Binance Maintenance Margin Rate Tiers
BINANCE_MMR_TIERS = [
    {"tier": 1, "max_amount": 50000, "mmr": 0.004, "cum": 0},
    {"tier": 2, "max_amount": 250000, "mmr": 0.005, "cum": 50},
    {"tier": 3, "max_amount": 1000000, "mmr": 0.01, "cum": 1300},
    {"tier": 4, "max_amount": 5000000, "mmr": 0.025, "cum": 16300},
    {"tier": 5, "max_amount": 20000000, "mmr": 0.05, "cum": 141300},
    {"tier": 6, "max_amount": 50000000, "mmr": 0.1, "cum": 1141300},
    {"tier": 7, "max_amount": 100000000, "mmr": 0.125, "cum": 2391300},
    {"tier": 8, "max_amount": 200000000, "mmr": 0.15, "cum": 4891300},
    {"tier": 9, "max_amount": 300000000, "mmr": 0.25, "cum": 24891300},
    {"tier": 10, "max_amount": float('inf'), "mmr": 0.5, "cum": 99891300}
]

# Popular Trading Pairs
TRADING_PAIRS = [
    "BTCUSDT", "ETHUSDT", "ADAUSDT", "BNBUSDT", "XRPUSDT",
    "SOLUSDT", "DOGEUSDT", "DOTUSDT", "AVAXUSDT", "MATICUSDT",
    "LTCUSDT", "LINKUSDT", "ATOMUSDT", "UNIUSDT", "FILUSDT"
]

# Heatmap Configuration
HEATMAP_CONFIG = {
    "price_bucket_interval": 0.001,  # 0.1% price buckets
    "z_score_threshold": 2.0,        # High liquidation zones
    "kde_bandwidth_adjust": 0.3,     # Sharp KDE visualization
    "bins_count": 100,               # High resolution binning
    "colormap": "RdBu_r",           # Diverging colormap for Z-score data
    "update_interval": 1000          # 1 second update interval (ms)
}

# WebSocket Reconnection Configuration
WEBSOCKET_CONFIG = {
    "max_retries": 10,
    "base_delay": 1,
    "max_delay": 60,
    "exponential_base": 2,
    "ping_interval": 20,
    "ping_timeout": 10
}

# Data Processing Configuration
DATA_CONFIG = {
    "max_liquidation_records": 10000,  # Maximum records in memory
    "historical_days": 30,             # Days of historical data to keep
    "batch_size": 1000,               # Batch size for database operations
    "aggregation_window": "1min"      # Time window for data aggregation
}

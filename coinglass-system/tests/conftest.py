import pytest
import os
from unittest.mock import Mock

# Set test environment variables
os.environ["CG_API_KEY"] = "test_api_key"
os.environ["DB_URL"] = "postgresql://test:test@localhost:5432/test_db"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"
os.environ["TELEGRAM_BOT_TOKEN"] = "test_bot_token"
os.environ["TELEGRAM_CHAT_ID"] = "-100123456"

@pytest.fixture
def mock_db_session():
    """Mock database session"""
    mock_session = Mock()
    mock_session.commit.return_value = None
    mock_session.rollback.return_value = None
    mock_session.close.return_value = None
    return mock_session

@pytest.fixture
def mock_redis_client():
    """Mock Redis client"""
    mock_redis = Mock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = None
    mock_redis.set.return_value = True
    mock_redis.lpush.return_value = 1
    mock_redis.brpop.return_value = None
    return mock_redis

@pytest.fixture
def sample_liquidation_data():
    """Sample liquidation data for testing"""
    return {
        "symbol": "BTC",
        "side": "long",
        "price": 45000.0,
        "qty": 1000000.0,
        "exchange": "Binance",
        "timestamp": "2023-01-01T00:00:00Z"
    }

@pytest.fixture
def sample_funding_data():
    """Sample funding rate data for testing"""
    return {
        "symbol": "ETH",
        "rate": 0.001,
        "rate_oi_weighted": 0.0015,
        "exchange": "OKX",
        "timestamp": "2023-01-01T00:00:00Z"
    }

@pytest.fixture
def sample_oi_data():
    """Sample OI data for testing"""
    return {
        "symbol": "SOL",
        "open": 100000000,
        "high": 105000000,
        "low": 95000000,
        "close": 102000000,
        "timestamp": "2023-01-01T00:00:00Z"
    }
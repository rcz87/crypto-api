import redis
import json
import pickle
from typing import Any, Optional
from app.core.settings import settings
from app.core.logging import logger

# Enhanced Redis client with connection pooling
redis_client = redis.Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    max_connections=settings.REDIS_MAX_CONNECTIONS,
    retry_on_timeout=True,
    health_check_interval=30
)

class CacheManager:
    """Advanced caching operations"""
    
    def __init__(self, redis_client):
        self.redis = redis_client
        self.default_ttl = settings.CACHE_TTL_SECONDS
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get value from cache with fallback"""
        try:
            value = self.redis.get(key)
            if value is None:
                return default
            return json.loads(value)
        except (redis.RedisError, json.JSONDecodeError) as e:
            logger.warning(f"Cache get error for key {key}: {e}")
            return default
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with TTL"""
        try:
            ttl = ttl or self.default_ttl
            serialized_value = json.dumps(value, default=str)
            return self.redis.setex(key, ttl, serialized_value)
        except (redis.RedisError, json.JSONEncodeError) as e:
            logger.warning(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            return bool(self.redis.delete(key))
        except redis.RedisError as e:
            logger.warning(f"Cache delete error for key {key}: {e}")
            return False
    
    def get_many(self, keys: list) -> dict:
        """Get multiple values from cache"""
        try:
            values = self.redis.mget(keys)
            result = {}
            for key, value in zip(keys, values):
                if value:
                    try:
                        result[key] = json.loads(value)
                    except json.JSONDecodeError:
                        result[key] = None
                else:
                    result[key] = None
            return result
        except redis.RedisError as e:
            logger.warning(f"Cache get_many error: {e}")
            return {key: None for key in keys}
    
    def set_many(self, mapping: dict, ttl: Optional[int] = None) -> bool:
        """Set multiple values in cache"""
        try:
            ttl = ttl or self.default_ttl
            pipe = self.redis.pipeline()
            for key, value in mapping.items():
                serialized_value = json.dumps(value, default=str)
                pipe.setex(key, ttl, serialized_value)
            pipe.execute()
            return True
        except (redis.RedisError, json.JSONEncodeError) as e:
            logger.warning(f"Cache set_many error: {e}")
            return False
    
    def increment(self, key: str, amount: int = 1) -> int:
        """Increment counter in cache"""
        try:
            return self.redis.incr(key, amount)
        except redis.RedisError as e:
            logger.warning(f"Cache increment error for key {key}: {e}")
            return 0
    
    def expire(self, key: str, ttl: int) -> bool:
        """Set expiration on key"""
        try:
            return self.redis.expire(key, ttl)
        except redis.RedisError as e:
            logger.warning(f"Cache expire error for key {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        try:
            return bool(self.redis.exists(key))
        except redis.RedisError as e:
            logger.warning(f"Cache exists error for key {key}: {e}")
            return False
    
    def flush_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        try:
            keys = self.redis.keys(pattern)
            if keys:
                return self.redis.delete(*keys)
            return 0
        except redis.RedisError as e:
            logger.warning(f"Cache flush_pattern error for pattern {pattern}: {e}")
            return 0
    
    def get_stats(self) -> dict:
        """Get cache statistics"""
        try:
            info = self.redis.info()
            return {
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory", 0),
                "used_memory_human": info.get("used_memory_human", "0B"),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
                "total_commands_processed": info.get("total_commands_processed", 0)
            }
        except redis.RedisError as e:
            logger.warning(f"Cache stats error: {e}")
            return {}

cache = CacheManager(redis_client)
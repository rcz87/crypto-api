import json
import time
from typing import Any, Optional
from replit import db
from app.core.settings import settings
from app.core.logging import logger

class ReplDBCacheManager:
    """ReplDB-based caching operations to replace Redis"""
    
    def __init__(self):
        self.default_ttl = settings.CACHE_TTL_SECONDS
    
    def _get_key_with_expiry(self, key: str) -> tuple[Any, bool]:
        """Get value and check if expired"""
        try:
            stored_data = db.get(key)
            if stored_data is None:
                return None, True
            
            data = json.loads(stored_data)
            if 'expires_at' in data:
                if time.time() > data['expires_at']:
                    # Expired, delete it
                    del db[key]
                    return None, True
                return data['value'], False
            else:
                # No expiry set
                return data, False
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"ReplDB get error for key {key}: {e}")
            return None, True
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get value from cache with fallback"""
        try:
            value, expired = self._get_key_with_expiry(key)
            return value if not expired else default
        except Exception as e:
            logger.warning(f"ReplDB get error for key {key}: {e}")
            return default
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with TTL"""
        try:
            ttl = ttl or self.default_ttl
            stored_data = {
                'value': value,
                'expires_at': time.time() + ttl if ttl > 0 else None
            }
            db[key] = json.dumps(stored_data, default=str)
            return True
        except Exception as e:
            logger.warning(f"ReplDB set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            if key in db:
                del db[key]
                return True
            return False
        except Exception as e:
            logger.warning(f"ReplDB delete error for key {key}: {e}")
            return False
    
    def get_many(self, keys: list) -> dict:
        """Get multiple values from cache"""
        result = {}
        for key in keys:
            result[key] = self.get(key)
        return result
    
    def set_many(self, mapping: dict, ttl: Optional[int] = None) -> bool:
        """Set multiple values in cache"""
        try:
            success_count = 0
            for key, value in mapping.items():
                if self.set(key, value, ttl):
                    success_count += 1
            return success_count == len(mapping)
        except Exception as e:
            logger.warning(f"ReplDB set_many error: {e}")
            return False
    
    def increment(self, key: str, amount: int = 1) -> int:
        """Increment counter in cache"""
        try:
            current_value = self.get(key, 0)
            if isinstance(current_value, (int, float)):
                new_value = current_value + amount
                self.set(key, new_value)
                return new_value
            else:
                # Reset to amount if not numeric
                self.set(key, amount)
                return amount
        except Exception as e:
            logger.warning(f"ReplDB increment error for key {key}: {e}")
            return 0
    
    def expire(self, key: str, ttl: int) -> bool:
        """Set expiration on key"""
        try:
            current_value = self.get(key)
            if current_value is not None:
                return self.set(key, current_value, ttl)
            return False
        except Exception as e:
            logger.warning(f"ReplDB expire error for key {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        try:
            _, expired = self._get_key_with_expiry(key)
            return not expired
        except Exception as e:
            logger.warning(f"ReplDB exists error for key {key}: {e}")
            return False
    
    def flush_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern"""
        try:
            # ReplDB doesn't support pattern matching, so we iterate
            deleted_count = 0
            keys_to_delete = []
            
            # Get all keys that match pattern (simple prefix matching)
            for key in db.prefix(pattern.replace('*', '')):
                keys_to_delete.append(key)
            
            for key in keys_to_delete:
                if self.delete(key):
                    deleted_count += 1
                    
            return deleted_count
        except Exception as e:
            logger.warning(f"ReplDB flush_pattern error for pattern {pattern}: {e}")
            return 0
    
    def get_stats(self) -> dict:
        """Get cache statistics"""
        try:
            # ReplDB doesn't provide detailed stats, so we estimate
            total_keys = len(list(db.keys()))
            return {
                "connected_clients": 1,  # Always 1 for ReplDB
                "used_memory": total_keys * 1024,  # Rough estimate
                "used_memory_human": f"{total_keys}KB",
                "total_keys": total_keys,
                "provider": "ReplDB",
                "max_storage": "50MiB",  # ReplDB limit
                "max_keys": 5000  # ReplDB limit
            }
        except Exception as e:
            logger.warning(f"ReplDB stats error: {e}")
            return {
                "connected_clients": 0,
                "used_memory": 0,
                "used_memory_human": "0B",
                "total_keys": 0,
                "provider": "ReplDB",
                "error": str(e)
            }

# Create the cache manager instance
cache = ReplDBCacheManager()
"""
Micro-cache with singleflight pattern for reducing API calls
Implements 250-500ms caching with request coalescing
"""

import time
import asyncio
from typing import Dict, Any, Optional, Tuple

# Global cache and locks
_cache: Dict[str, Dict[str, Any]] = {}
_locks: Dict[str, asyncio.Lock] = {}


def _key(path: str, params: Dict[str, Any]) -> str:
    """Generate cache key from path and sorted params"""
    if not params:
        return path
    param_str = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    return f"{path}?{param_str}"


async def singleflight(key: str) -> asyncio.Lock:
    """Get or create lock for singleflight pattern"""
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    
    lock = _locks[key]
    await lock.acquire()
    return lock


def get_cached(key: str, ttl_ms: int = 300) -> Optional[Any]:
    """Get cached data if still valid"""
    entry = _cache.get(key)
    if not entry:
        return None
    
    if time.time() - entry["ts"] > ttl_ms / 1000:
        # Remove expired entry
        _cache.pop(key, None)
        return None
    
    return entry["data"]


def set_cached(key: str, data: Any) -> None:
    """Store data in cache with current timestamp"""
    _cache[key] = {
        "ts": time.time(),
        "data": data
    }


def cleanup_cache(max_age_seconds: float = 300) -> int:
    """Cleanup expired cache entries"""
    now = time.time()
    expired_keys = [
        key for key, entry in _cache.items()
        if now - entry["ts"] > max_age_seconds
    ]
    
    for key in expired_keys:
        _cache.pop(key, None)
        _locks.pop(key, None)
    
    return len(expired_keys)


# Auto cleanup every 5 minutes
import asyncio
import threading

def _background_cleanup():
    """Background cleanup task"""
    while True:
        time.sleep(300)  # 5 minutes
        cleanup_cache()

_cleanup_thread = threading.Thread(target=_background_cleanup, daemon=True)
_cleanup_thread.start()
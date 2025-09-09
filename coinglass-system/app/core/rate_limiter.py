import time
from typing import Dict
from app.core.cache import redis_client

class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def is_allowed(self, key: str) -> bool:
        now = int(time.time())
        window = now // self.window_seconds
        redis_key = f"rate_limit:{key}:{window}"
        
        try:
            current = redis_client.get(redis_key)
            if current is None:
                redis_client.setex(redis_key, self.window_seconds, 1)
                return True
            
            if int(current) >= self.max_requests:
                return False
            
            redis_client.incr(redis_key)
            return True
        except Exception:
            return True  # Fail open
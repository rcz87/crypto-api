from fastapi import HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from functools import wraps
import jwt
import time
from typing import Optional, Dict, Any
from app.core.settings import settings
from app.core.cache import redis_client
from app.core.logging import logger

security = HTTPBearer()

class AuthManager:
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = "HS256"
        self.token_expire_hours = 24
        
    def create_api_key(self, user_id: str, tier: str = "standard") -> str:
        """Create API key for user"""
        payload = {
            "user_id": user_id,
            "tier": tier,
            "iat": int(time.time()),
            "exp": int(time.time()) + (self.token_expire_hours * 3600)
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_api_key(self, token: str) -> Dict[str, Any]:
        """Verify API key and return user info"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # Check if token is blacklisted
            if redis_client.sismember("blacklisted_tokens", token):
                raise HTTPException(status_code=401, detail="Token revoked")
            
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    
    def revoke_token(self, token: str):
        """Revoke/blacklist a token"""
        redis_client.sadd("blacklisted_tokens", token)
        redis_client.expire("blacklisted_tokens", 86400)  # 24 hours

auth_manager = AuthManager()

class TierRateLimiter:
    """Rate limiting based on user tier"""
    
    def __init__(self):
        self.tier_limits = {
            "standard": {"requests_per_minute": 60, "requests_per_hour": 1000},
            "premium": {"requests_per_minute": 300, "requests_per_hour": 10000},
            "enterprise": {"requests_per_minute": 1000, "requests_per_hour": 50000}
        }
    
    def check_rate_limit(self, user_id: str, tier: str) -> bool:
        """Check if user is within rate limits"""
        limits = self.tier_limits.get(tier, self.tier_limits["standard"])
        
        # Check minute limit
        minute_key = f"rate_limit:{user_id}:minute:{int(time.time() // 60)}"
        minute_count = redis_client.get(minute_key) or 0
        
        if int(minute_count) >= limits["requests_per_minute"]:
            return False
        
        # Check hour limit
        hour_key = f"rate_limit:{user_id}:hour:{int(time.time() // 3600)}"
        hour_count = redis_client.get(hour_key) or 0
        
        if int(hour_count) >= limits["requests_per_hour"]:
            return False
        
        # Increment counters
        pipe = redis_client.pipeline()
        pipe.incr(minute_key)
        pipe.expire(minute_key, 60)
        pipe.incr(hour_key)
        pipe.expire(hour_key, 3600)
        pipe.execute()
        
        return True

tier_rate_limiter = TierRateLimiter()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    user_info = auth_manager.verify_api_key(token)
    
    # Check rate limits
    if not tier_rate_limiter.check_rate_limit(user_info["user_id"], user_info["tier"]):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    logger.info(f"API request from user {user_info['user_id']} (tier: {user_info['tier']})")
    return user_info

def require_tier(required_tier: str):
    """Decorator to require specific tier"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user_info = kwargs.get('current_user')
            if not user_info:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            tier_hierarchy = {"standard": 1, "premium": 2, "enterprise": 3}
            user_tier_level = tier_hierarchy.get(user_info["tier"], 0)
            required_tier_level = tier_hierarchy.get(required_tier, 999)
            
            if user_tier_level < required_tier_level:
                raise HTTPException(status_code=403, detail=f"Requires {required_tier} tier")
            
            return func(*args, **kwargs)
        return wrapper
    return decorator
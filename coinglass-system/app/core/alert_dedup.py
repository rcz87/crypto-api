#!/usr/bin/env python3
"""
Alert Deduplication System
5-minute deduplication untuk mencegah spam Telegram alerts
"""

import hashlib
import time
from typing import Optional, Dict, Any
from app.core.cache import cache_manager
import logging

logger = logging.getLogger(__name__)

class AlertDeduplicator:
    """5-minute alert deduplication system"""
    
    def __init__(self, ttl_seconds: int = 300):  # 5 minutes
        self.ttl_seconds = ttl_seconds
        self.cache = cache_manager
        
    def create_fingerprint(
        self, 
        coin: str, 
        signal_type: str, 
        interval: str = "1h",
        bucket_time: Optional[int] = None
    ) -> str:
        """Create unique fingerprint for alert deduplication"""
        
        # Use 5-minute buckets for time-based dedup
        if bucket_time is None:
            bucket_time = int(time.time() // 300)  # 5-minute buckets
        
        # Create fingerprint: {coin|interval|signal_type|bucket}
        fingerprint_data = f"{coin}|{interval}|{signal_type}|{bucket_time}"
        
        # Hash untuk privacy & consistent length
        fingerprint_hash = hashlib.md5(fingerprint_data.encode()).hexdigest()[:16]
        
        return f"alert_dedup:{fingerprint_hash}"
    
    def is_duplicate(
        self, 
        coin: str, 
        signal_type: str, 
        interval: str = "1h",
        extra_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Check if alert is duplicate within TTL window"""
        
        try:
            fingerprint = self.create_fingerprint(coin, signal_type, interval)
            
            # Check if fingerprint exists in cache
            cached_data = self.cache.get(fingerprint)
            
            if cached_data:
                logger.info(f"🔁 Duplicate alert detected: {coin} {signal_type} (skipped)")
                return True
            
            # Mark as sent untuk prevent future duplicates
            alert_data = {
                'coin': coin,
                'signal_type': signal_type,
                'interval': interval,
                'timestamp': int(time.time()),
                'extra': extra_data or {}
            }
            
            self.cache.set(fingerprint, alert_data, ttl=self.ttl_seconds)
            logger.debug(f"✅ Alert fingerprint cached: {fingerprint}")
            
            return False
            
        except Exception as e:
            logger.error(f"❌ Dedup check error: {e}")
            # Fail open - allow alert if dedup system fails
            return False
    
    def mark_status_sent(self, status_type: str) -> bool:
        """Mark status message as sent (Started/Stopped dedup)"""
        
        try:
            status_key = f"status_dedup:{status_type}"
            
            # Check if status already sent recently
            if self.cache.get(status_key):
                logger.info(f"🔁 Status '{status_type}' already sent recently (skipped)")
                return True  # Duplicate
            
            # Mark status as sent untuk 10 minutes
            self.cache.set(status_key, {'sent_at': int(time.time())}, ttl=600)
            return False  # Not duplicate
            
        except Exception as e:
            logger.error(f"❌ Status dedup error: {e}")
            return False  # Fail open
    
    def clear_duplicates(self, pattern: str = "alert_dedup:*") -> int:
        """Clear all duplicate markers (admin function)"""
        
        try:
            cleared = self.cache.flush_pattern(pattern)
            logger.info(f"🧹 Cleared {cleared} alert dedup entries")
            return cleared
        except Exception as e:
            logger.error(f"❌ Clear duplicates error: {e}")
            return 0
    
    def get_stats(self) -> Dict[str, Any]:
        """Get deduplication statistics"""
        
        try:
            cache_stats = self.cache.get_stats()
            
            # Count alert dedup entries
            total_keys = cache_stats.get('total_keys', 0)
            
            return {
                'ttl_seconds': self.ttl_seconds,
                'cache_provider': cache_stats.get('provider', 'Unknown'),
                'total_cache_keys': total_keys,
                'dedup_active': True,
                'bucket_size_minutes': 5
            }
        except Exception as e:
            logger.error(f"❌ Dedup stats error: {e}")
            return {'dedup_active': False, 'error': str(e)}

# Global deduplicator instance
alert_dedup = AlertDeduplicator()

# Convenience functions
def is_duplicate_alert(coin: str, signal_type: str, interval: str = "1h") -> bool:
    """Check if alert is duplicate"""
    return alert_dedup.is_duplicate(coin, signal_type, interval)

def is_duplicate_status(status_type: str) -> bool:
    """Check if status message is duplicate"""
    return alert_dedup.mark_status_sent(status_type)
"""
Throttled logging configuration to reduce log noise
"""

import time
import logging
from typing import Dict, Tuple


class ThrottleFilter(logging.Filter):
    """Throttle log messages to reduce spam"""
    
    def __init__(self, ttl_seconds: float = 5.0):
        super().__init__()
        self.ttl = ttl_seconds
        self._log_seen: Dict[str, float] = {}
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Filter repeated log messages within TTL window"""
        # Create unique key from logger name and message
        msg = getattr(record, "msg", "")
        if hasattr(record, "args") and record.args:
            try:
                msg = msg % record.args
            except:
                pass
        
        key = f"{record.name}:{msg}"
        now = time.time()
        
        # Check if we've seen this message recently
        last_seen = self._log_seen.get(key, 0)
        if now - last_seen < self.ttl:
            return False  # Filter out (don't log)
        
        # Update last seen time
        self._log_seen[key] = now
        
        # Clean up old entries periodically
        if len(self._log_seen) > 1000:
            cutoff = now - self.ttl * 2
            self._log_seen = {
                k: v for k, v in self._log_seen.items() 
                if v > cutoff
            }
        
        return True  # Allow logging


# Configure loggers with throttling
def setup_throttled_logging():
    """Setup throttled logging for noisy components"""
    
    # Symbol mapping logger - reduce to DEBUG level with throttling
    symbol_logger = logging.getLogger("symbol_mapping")
    symbol_logger.setLevel(logging.DEBUG)  # Changed from INFO to DEBUG
    symbol_logger.addFilter(ThrottleFilter(ttl_seconds=5.0))
    
    # CoinGlass client logger - throttle API call logs  
    coinglass_logger = logging.getLogger("coinglass_client")
    coinglass_logger.addFilter(ThrottleFilter(ttl_seconds=2.0))
    
    # OKX client logger - throttle API call logs
    okx_logger = logging.getLogger("okx_client")
    okx_logger.addFilter(ThrottleFilter(ttl_seconds=2.0))
    
    return {
        "symbol_mapping": symbol_logger,
        "coinglass_client": coinglass_logger,
        "okx_client": okx_logger
    }


# Initialize loggers
LOGGERS = setup_throttled_logging()


def get_throttled_logger(name: str) -> logging.Logger:
    """Get throttled logger by name"""
    return LOGGERS.get(name, logging.getLogger(name))
"""
Configuration for GuardiansOfTheToken.com integration
"""

import os
from typing import Dict, List, Any

# GuardiansOfTheToken API Configuration
GUARDIANS_CONFIG = {
    'api': {
        'base_url': os.getenv('GUARDIANS_API_URL', 'https://api.guardiansofthetoken.com'),
        'api_key': os.getenv('GUARDIANS_API_KEY'),
        'vip_tier': int(os.getenv('GUARDIANS_VIP_TIER', '8')),
        'timeout': int(os.getenv('GUARDIANS_TIMEOUT', '30')),
        'max_retries': int(os.getenv('GUARDIANS_MAX_RETRIES', '3')),
        'rate_limit_delay': float(os.getenv('GUARDIANS_RATE_LIMIT_DELAY', '0.1'))
    },
    
    # VIP 8 Features Configuration
    'features': {
        'update_frequency_ms': 10,
        'max_depth_levels': 500,
        'buy_sell_wall_detection': True,
        'hidden_order_detection': True,
        'institutional_imbalance': True,
        'spoofing_detection': True,
        'iceberg_detection': True,
        'liquidity_analysis': True,
        'market_depth_scoring': True
    },
    
    # Data Processing Configuration
    'processing': {
        'max_history_size': int(os.getenv('GUARDIANS_MAX_HISTORY', '1000')),
        'trend_window_size': int(os.getenv('GUARDIANS_TREND_WINDOW', '10')),
        'imbalance_threshold': float(os.getenv('GUARDIANS_IMBALANCE_THRESHOLD', '1.5')),
        'liquidity_score_threshold': float(os.getenv('GUARDIANS_LIQUIDITY_THRESHOLD', '50.0')),
        'wall_detection_min_size': float(os.getenv('GUARDIANS_WALL_MIN_SIZE', '1000000'))  # $1M
    },
    
    # Symbols to monitor with GuardiansOfTheToken
    'symbols': [
        'SOLUSDT',
        'BTCUSDT',
        'ETHUSDT',
        'BNBUSDT',
        'ADAUSDT',
        'XRPUSDT',
        'DOTUSDT',
        'LINKUSDT',
        'AVAXUSDT',
        'MATICUSDT'
    ],
    
    # Alert Configuration
    'alerts': {
        'enabled': os.getenv('GUARDIANS_ALERTS_ENABLED', 'false').lower() == 'true',
        'buy_wall_threshold': float(os.getenv('GUARDIANS_BUY_WALL_THRESHOLD', '5000000')),  # $5M
        'sell_wall_threshold': float(os.getenv('GUARDIANS_SELL_WALL_THRESHOLD', '5000000')),  # $5M
        'imbalance_alert_threshold': float(os.getenv('GUARDIANS_IMBALANCE_ALERT', '2.0')),
        'liquidity_alert_threshold': float(os.getenv('GUARDIANS_LIQUIDITY_ALERT', '30.0')),
        'spoofing_alert_enabled': os.getenv('GUARDIANS_SPOOFING_ALERTS', 'true').lower() == 'true',
        'iceberg_alert_enabled': os.getenv('GUARDIANS_ICEBERG_ALERTS', 'true').lower() == 'true'
    },
    
    # Integration Settings
    'integration': {
        'update_interval': int(os.getenv('GUARDIANS_UPDATE_INTERVAL', '5')),  # seconds
        'batch_size': int(os.getenv('GUARDIANS_BATCH_SIZE', '5')),
        'concurrent_requests': int(os.getenv('GUARDIANS_CONCURRENT_REQUESTS', '3')),
        'fallback_to_binance': os.getenv('GUARDIANS_FALLBACK_BINANCE', 'true').lower() == 'true',
        'data_validation': os.getenv('GUARDIANS_DATA_VALIDATION', 'true').lower() == 'true'
    },
    
    # Visualization Settings
    'visualization': {
        'depth_chart_levels': int(os.getenv('GUARDIANS_CHART_LEVELS', '20')),
        'show_institutional_data': os.getenv('GUARDIANS_SHOW_INSTITUTIONAL', 'true').lower() == 'true',
        'highlight_walls': os.getenv('GUARDIANS_HIGHLIGHT_WALLS', 'true').lower() == 'true',
        'show_hidden_orders': os.getenv('GUARDIANS_SHOW_HIDDEN', 'true').lower() == 'true',
        'color_scheme': os.getenv('GUARDIANS_COLOR_SCHEME', 'dark')
    }
}

# Risk Levels for GuardiansOfTheToken Analysis
GUARDIANS_RISK_LEVELS = {
    'low': {
        'min_score': 0,
        'max_score': 30,
        'color': '#00ff00',
        'description': 'Low market activity, normal conditions'
    },
    'medium': {
        'min_score': 30,
        'max_score': 60,
        'color': '#ffff00',
        'description': 'Moderate activity, some volatility'
    },
    'high': {
        'min_score': 60,
        'max_score': 80,
        'color': '#ff9900',
        'description': 'High activity, increased volatility'
    },
    'extreme': {
        'min_score': 80,
        'max_score': 100,
        'color': '#ff0000',
        'description': 'Extreme activity, high volatility risk'
    }
}

# Institutional Imbalance Classifications
INSTITUTIONAL_IMBALANCE_TYPES = {
    'bullish': {
        'threshold': 1.5,
        'color': '#00ff00',
        'description': 'Strong buying pressure from institutions'
    },
    'neutral': {
        'threshold': 1.0,
        'color': '#808080',
        'description': 'Balanced institutional activity'
    },
    'bearish': {
        'threshold': 0.67,
        'color': '#ff0000',
        'description': 'Strong selling pressure from institutions'
    }
}

# Order Pattern Detection
ORDER_PATTERNS = {
    'buy_wall': {
        'min_size_ratio': 0.1,  # 10% of total volume
        'price_concentration': 0.01,  # Within 1% price range
        'min_levels': 3
    },
    'sell_wall': {
        'min_size_ratio': 0.1,
        'price_concentration': 0.01,
        'min_levels': 3
    },
    'spoofing': {
        'size_volatility': 2.0,  # 2x normal volatility
        'rapid_changes': 5,  # Changes within 10 seconds
        'disappearance_ratio': 0.8  # 80% of orders disappear
    },
    'iceberg': {
        'size_pattern': 'stepped',  # Regular size increments
        'price_spacing': 0.001,  # 0.1% price spacing
        'min_visible_orders': 5
    }
}

# Data Quality Metrics
DATA_QUALITY_THRESHOLDS = {
    'min_bid_levels': 10,
    'min_ask_levels': 10,
    'max_spread_pct': 0.5,  # 0.5% max spread
    'min_total_volume': 100000,  # $100k minimum volume
    'max_price_jump': 0.02,  # 2% max price jump between updates
    'stale_data_threshold': 30  # 30 seconds max age
}

# Performance Monitoring
PERFORMANCE_METRICS = {
    'response_time_threshold': 1000,  # 1 second max response time
    'success_rate_threshold': 95,  # 95% minimum success rate
    'error_rate_threshold': 5,  # 5% maximum error rate
    'memory_usage_threshold': 100,  # 100MB max memory usage
    'cpu_usage_threshold': 80  # 80% max CPU usage
}

def get_guardians_config() -> Dict[str, Any]:
    """Get complete GuardiansOfTheToken configuration"""
    return GUARDIANS_CONFIG

def get_guardians_symbols() -> List[str]:
    """Get list of symbols to monitor with GuardiansOfTheToken"""
    return GUARDIANS_CONFIG['symbols']

def is_guardians_enabled() -> bool:
    """Check if GuardiansOfTheToken integration is enabled"""
    return (
        os.getenv('GUARDIANS_ENABLED', 'false').lower() == 'true' and
        GUARDIANS_CONFIG['api']['api_key'] is not None
    )

def get_vip_features() -> Dict[str, Any]:
    """Get VIP features based on tier"""
    vip_tier = GUARDIANS_CONFIG['api']['vip_tier']
    
    if vip_tier >= 8:
        return {
            'update_frequency_ms': 10,
            'max_depth_levels': 500,
            'advanced_detection': True,
            'institutional_data': True,
            'pattern_recognition': True,
            'real_time_alerts': True
        }
    elif vip_tier >= 5:
        return {
            'update_frequency_ms': 50,
            'max_depth_levels': 200,
            'advanced_detection': True,
            'institutional_data': False,
            'pattern_recognition': True,
            'real_time_alerts': False
        }
    else:
        return {
            'update_frequency_ms': 100,
            'max_depth_levels': 50,
            'advanced_detection': False,
            'institutional_data': False,
            'pattern_recognition': False,
            'real_time_alerts': False
        }

def validate_guardians_config() -> Dict[str, Any]:
    """Validate GuardiansOfTheToken configuration"""
    issues = []
    warnings = []
    
    # Check required fields
    if not GUARDIANS_CONFIG['api']['api_key']:
        issues.append("GuardiansOfTheToken API key is required")
    
    if not GUARDIANS_CONFIG['api']['base_url']:
        issues.append("GuardiansOfTheToken base URL is required")
    
    # Check VIP tier
    vip_tier = GUARDIANS_CONFIG['api']['vip_tier']
    if vip_tier < 1 or vip_tier > 10:
        warnings.append(f"Unusual VIP tier: {vip_tier} (expected 1-10)")
    
    # Check timeouts
    timeout = GUARDIANS_CONFIG['api']['timeout']
    if timeout < 5 or timeout > 120:
        warnings.append(f"Timeout setting may be too aggressive: {timeout}s")
    
    # Check symbols
    if not GUARDIANS_CONFIG['symbols']:
        issues.append("No symbols configured for monitoring")
    
    return {
        'valid': len(issues) == 0,
        'issues': issues,
        'warnings': warnings,
        'config': GUARDIANS_CONFIG
    }

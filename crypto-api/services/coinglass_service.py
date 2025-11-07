#!/usr/bin/env python3
"""
CoinGlass API Service
Provides access to CoinGlass cryptocurrency futures and options data
"""

import os
import requests
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv('/root/crypto-api/crypto-api/.env')
except ImportError:
    pass
except Exception as e:
    logger.warning(f"Error loading .env file: {e}")

logger = logging.getLogger(__name__)

@dataclass
class CoinGlassMetric:
    """CoinGlass metric data structure"""
    symbol: str
    metric_name: str
    value: float
    timestamp: datetime
    exchange: str = "all"

class CoinGlassService:
    """CoinGlass API integration service"""
    
    def __init__(self):
        self.api_key = os.getenv('COINGLASS_API_KEY')
        self.base_url = "https://open-api.coinglass.com/public/v2"
        self.disabled = os.getenv('DISABLE_COINGLASS', 'false').lower() == 'true'
        
        if self.disabled:
            logger.warning("CoinGlass API is disabled via DISABLE_COINGLASS=true")
        elif not self.api_key:
            logger.warning("CoinGlass API key not configured")
        else:
            logger.info("CoinGlass Service initialized")
    
    def is_available(self) -> bool:
        """Check if CoinGlass service is available"""
        return not self.disabled and bool(self.api_key)
    
    def get_api_status(self) -> Dict[str, Any]:
        """Get CoinGlass API status"""
        return {
            'api_key_configured': bool(self.api_key),
            'disabled': self.disabled,
            'available': self.is_available(),
            'base_url': self.base_url
        }
    
    def get_open_interest(self, symbol: str = "BTC", interval: str = "1h") -> List[Dict]:
        """Get open interest data"""
        if not self.is_available():
            return []
        
        try:
            url = f"{self.base_url}/open_interest"
            params = {
                'symbol': symbol,
                'interval': interval
            }
            headers = {
                'coinglassSecret': self.api_key,
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 0:
                    return data.get('data', [])
                else:
                    logger.error(f"CoinGlass API error: {data.get('msg', 'Unknown error')}")
            else:
                logger.error(f"CoinGlass HTTP error: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error fetching open interest from CoinGlass: {e}")
        
        return []
    
    def get_funding_rate(self, symbol: str = "BTC") -> List[Dict]:
        """Get funding rate data"""
        if not self.is_available():
            return []
        
        try:
            url = f"{self.base_url}/funding_rate"
            params = {
                'symbol': symbol
            }
            headers = {
                'coinglassSecret': self.api_key,
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 0:
                    return data.get('data', [])
                else:
                    logger.error(f"CoinGlass API error: {data.get('msg', 'Unknown error')}")
            else:
                logger.error(f"CoinGlass HTTP error: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error fetching funding rate from CoinGlass: {e}")
        
        return []
    
    def get_liquidation_data(self, symbol: str = "BTC", interval: str = "1h") -> List[Dict]:
        """Get liquidation data"""
        if not self.is_available():
            return []
        
        try:
            url = f"{self.base_url}/liquidation_chart"
            params = {
                'symbol': symbol,
                'interval': interval
            }
            headers = {
                'coinglassSecret': self.api_key,
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 0:
                    return data.get('data', [])
                else:
                    logger.error(f"CoinGlass API error: {data.get('msg', 'Unknown error')}")
            else:
                logger.error(f"CoinGlass HTTP error: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error fetching liquidation data from CoinGlass: {e}")
        
        return []
    
    def get_long_short_ratio(self, symbol: str = "BTC", interval: str = "1h") -> List[Dict]:
        """Get long/short ratio data"""
        if not self.is_available():
            return []
        
        try:
            url = f"{self.base_url}/long_short_ratio"
            params = {
                'symbol': symbol,
                'interval': interval
            }
            headers = {
                'coinglassSecret': self.api_key,
                'Content-Type': 'application/json'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('code') == 0:
                    return data.get('data', [])
                else:
                    logger.error(f"CoinGlass API error: {data.get('msg', 'Unknown error')}")
            else:
                logger.error(f"CoinGlass HTTP error: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error fetching long/short ratio from CoinGlass: {e}")
        
        return []

# Global service instance
_coinglass_service = None

def get_coinglass_service() -> CoinGlassService:
    """Get CoinGlass service instance"""
    global _coinglass_service
    if _coinglass_service is None:
        _coinglass_service = CoinGlassService()
    return _coinglass_service

def get_api_status() -> Dict[str, Any]:
    """Get CoinGlass API status"""
    service = get_coinglass_service()
    return service.get_api_status()

def test_coinglass_connection() -> Dict[str, Any]:
    """Test CoinGlass API connection"""
    service = get_coinglass_service()
    
    if not service.is_available():
        return {
            'status': 'disabled',
            'message': 'CoinGlass API is disabled or not configured',
            'api_key_configured': bool(service.api_key),
            'disabled': service.disabled
        }
    
    try:
        # Test with open interest data
        oi_data = service.get_open_interest("BTC")
        
        if oi_data:
            return {
                'status': 'success',
                'message': 'CoinGlass API connection successful',
                'test_data_count': len(oi_data),
                'sample_data': oi_data[:1] if oi_data else None
            }
        else:
            return {
                'status': 'no_data',
                'message': 'CoinGlass API connected but no data returned',
                'api_key_configured': bool(service.api_key)
            }
            
    except Exception as e:
        return {
            'status': 'error',
            'message': f'CoinGlass API connection failed: {str(e)}',
            'api_key_configured': bool(service.api_key)
        }

if __name__ == "__main__":
    # Test CoinGlass service
    print("🧪 Testing CoinGlass API Service")
    print("=" * 50)
    
    # Check status
    status = get_api_status()
    print(f"API Key Configured: {status['api_key_configured']}")
    print(f"Disabled: {status['disabled']}")
    print(f"Available: {status['available']}")
    
    # Test connection
    if status['available']:
        print("\n🔍 Testing connection...")
        test_result = test_coinglass_connection()
        print(f"Status: {test_result['status']}")
        print(f"Message: {test_result['message']}")
        
        if test_result.get('sample_data'):
            print(f"Sample data: {test_result['sample_data']}")
    else:
        print("\n❌ CoinGlass API not available")

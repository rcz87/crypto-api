import numpy as np
import pandas as pd
from typing import Dict, List
from app.core.logging import logger

class FeatureEngine:
    """Feature engineering for trading signals"""
    
    def __init__(self):
        self.lookback_periods = [5, 10, 20, 50]
    
    def extract_features(self, data: pd.DataFrame) -> Dict[str, float]:
        """Extract features from time series data"""
        features = {}
        
        try:
            # Price-based features
            features.update(self._price_features(data))
            
            # Volume-based features
            features.update(self._volume_features(data))
            
            # Volatility features
            features.update(self._volatility_features(data))
            
            # Momentum features
            features.update(self._momentum_features(data))
            
            logger.debug(f"Extracted {len(features)} features")
            
        except Exception as e:
            logger.error(f"Error extracting features: {e}")
            
        return features
    
    def _price_features(self, data: pd.DataFrame) -> Dict[str, float]:
        """Extract price-based features"""
        features = {}
        
        if 'close' in data.columns:
            close = data['close']
            features['price_sma_20'] = close.rolling(20).mean().iloc[-1]
            features['price_ema_12'] = close.ewm(span=12).mean().iloc[-1]
            features['price_rsi'] = self._calculate_rsi(close, 14)
            features['price_bb_position'] = self._bollinger_position(close, 20)
        
        return features
    
    def _volume_features(self, data: pd.DataFrame) -> Dict[str, float]:
        """Extract volume-based features"""
        features = {}
        
        if 'volume' in data.columns:
            volume = data['volume']
            features['volume_sma_20'] = volume.rolling(20).mean().iloc[-1]
            features['volume_ratio'] = volume.iloc[-1] / volume.rolling(20).mean().iloc[-1]
        
        return features
    
    def _volatility_features(self, data: pd.DataFrame) -> Dict[str, float]:
        """Extract volatility features"""
        features = {}
        
        if 'close' in data.columns:
            returns = data['close'].pct_change()
            features['volatility_20'] = returns.rolling(20).std().iloc[-1]
            features['atr_14'] = self._calculate_atr(data, 14)
        
        return features
    
    def _momentum_features(self, data: pd.DataFrame) -> Dict[str, float]:
        """Extract momentum features"""
        features = {}
        
        if 'close' in data.columns:
            close = data['close']
            features['momentum_5'] = (close.iloc[-1] / close.iloc[-6] - 1) * 100
            features['momentum_10'] = (close.iloc[-1] / close.iloc[-11] - 1) * 100
        
        return features
    
    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Calculate RSI"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi.iloc[-1]
    
    def _bollinger_position(self, prices: pd.Series, period: int = 20) -> float:
        """Calculate position within Bollinger Bands"""
        sma = prices.rolling(period).mean()
        std = prices.rolling(period).std()
        upper = sma + (2 * std)
        lower = sma - (2 * std)
        
        current_price = prices.iloc[-1]
        bb_position = (current_price - lower.iloc[-1]) / (upper.iloc[-1] - lower.iloc[-1])
        return bb_position
    
    def _calculate_atr(self, data: pd.DataFrame, period: int = 14) -> float:
        """Calculate Average True Range"""
        high_low = data['high'] - data['low']
        high_close = np.abs(data['high'] - data['close'].shift())
        low_close = np.abs(data['low'] - data['close'].shift())
        
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr = true_range.rolling(period).mean()
        return atr.iloc[-1]
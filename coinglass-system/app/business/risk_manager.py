from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
from app.core.observability import structured_logger, business_metrics
from app.core.cache import cache
from app.core.settings import settings

@dataclass
class RiskAssessment:
    risk_level: str  # low, medium, high, critical
    confidence: float  # 0.0 - 1.0
    factors: List[str]
    recommendations: List[str]
    expires_at: datetime

class RiskManager:
    """Advanced risk management and assessment"""
    
    def __init__(self):
        self.logger = structured_logger
        self.risk_thresholds = {
            'liquidation_volume_24h': 100_000_000,  # $100M
            'funding_rate_extreme': 0.03,  # 3%
            'oi_change_rate': 0.5,  # 50%
            'volatility_spike': 0.2,  # 20%
            'volume_spike': 5.0,  # 5x normal
        }
        
        self.position_limits = {
            'standard': {'max_exposure': 10000, 'max_leverage': 10},
            'premium': {'max_exposure': 100000, 'max_leverage': 20},
            'enterprise': {'max_exposure': 1000000, 'max_leverage': 50}
        }
    
    def assess_market_risk(self, symbol: str, timeframe: str = "1h") -> RiskAssessment:
        """Comprehensive market risk assessment"""
        try:
            factors = []
            risk_score = 0
            recommendations = []
            
            # Get market data
            market_data = self._get_market_data(symbol, timeframe)
            
            # Assess liquidation risk
            liq_risk = self._assess_liquidation_risk(market_data)
            risk_score += liq_risk['score']
            factors.extend(liq_risk['factors'])
            
            # Assess funding rate risk
            funding_risk = self._assess_funding_risk(market_data)
            risk_score += funding_risk['score']
            factors.extend(funding_risk['factors'])
            
            # Assess volatility risk
            vol_risk = self._assess_volatility_risk(market_data)
            risk_score += vol_risk['score']
            factors.extend(vol_risk['factors'])
            
            # Assess open interest risk
            oi_risk = self._assess_oi_risk(market_data)
            risk_score += oi_risk['score']
            factors.extend(oi_risk['factors'])
            
            # Calculate overall risk level
            if risk_score >= 80:
                risk_level = "critical"
                recommendations.extend([
                    "Avoid new positions",
                    "Consider position reduction",
                    "Monitor closely for liquidation cascades"
                ])
            elif risk_score >= 60:
                risk_level = "high"
                recommendations.extend([
                    "Reduce position sizes",
                    "Tighten stop losses",
                    "Monitor funding rates"
                ])
            elif risk_score >= 40:
                risk_level = "medium"
                recommendations.extend([
                    "Use conservative position sizing",
                    "Monitor market conditions"
                ])
            else:
                risk_level = "low"
                recommendations.append("Normal trading conditions")
            
            confidence = min(len(factors) / 10.0, 1.0)  # Confidence based on data availability
            
            assessment = RiskAssessment(
                risk_level=risk_level,
                confidence=confidence,
                factors=factors,
                recommendations=recommendations,
                expires_at=datetime.utcnow() + timedelta(minutes=30)
            )
            
            # Cache assessment
            cache.set(f"risk_assessment:{symbol}:{timeframe}", assessment.__dict__, ttl=1800)
            
            # Log risk assessment
            self.logger.info(
                "Risk assessment completed",
                symbol=symbol,
                risk_level=risk_level,
                risk_score=risk_score,
                confidence=confidence
            )
            
            # Record business metric
            business_metrics.record_signal_generated("risk_assessment", symbol, risk_level)
            
            return assessment
            
        except Exception as e:
            self.logger.error(f"Risk assessment failed for {symbol}: {e}")
            return RiskAssessment(
                risk_level="unknown",
                confidence=0.0,
                factors=["Assessment failed"],
                recommendations=["Manual review required"],
                expires_at=datetime.utcnow() + timedelta(minutes=5)
            )
    
    def _get_market_data(self, symbol: str, timeframe: str) -> Dict[str, Any]:
        """Get market data for risk assessment"""
        # This would typically fetch from database or cache
        # For now, return mock data structure
        return {
            'symbol': symbol,
            'timeframe': timeframe,
            'liquidations_24h': cache.get(f"liquidations_24h:{symbol}", 0),
            'funding_rate': cache.get(f"funding_rate:{symbol}", 0),
            'oi_change': cache.get(f"oi_change:{symbol}", 0),
            'volatility': cache.get(f"volatility:{symbol}", 0),
            'volume_ratio': cache.get(f"volume_ratio:{symbol}", 1.0),
            'price': cache.get(f"price:{symbol}", 0)
        }
    
    def _assess_liquidation_risk(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess liquidation cascade risk"""
        liquidations_24h = data.get('liquidations_24h', 0)
        factors = []
        score = 0
        
        if liquidations_24h > self.risk_thresholds['liquidation_volume_24h']:
            score += 30
            factors.append(f"High liquidation volume: ${liquidations_24h:,.0f}")
        
        if liquidations_24h > self.risk_thresholds['liquidation_volume_24h'] * 2:
            score += 20
            factors.append("Extreme liquidation activity detected")
        
        return {'score': score, 'factors': factors}
    
    def _assess_funding_risk(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess funding rate risk"""
        funding_rate = abs(data.get('funding_rate', 0))
        factors = []
        score = 0
        
        if funding_rate > self.risk_thresholds['funding_rate_extreme']:
            score += 25
            direction = "positive" if data.get('funding_rate', 0) > 0 else "negative"
            factors.append(f"Extreme {direction} funding rate: {funding_rate:.4f}")
        
        return {'score': score, 'factors': factors}
    
    def _assess_volatility_risk(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess volatility risk"""
        volatility = data.get('volatility', 0)
        factors = []
        score = 0
        
        if volatility > self.risk_thresholds['volatility_spike']:
            score += 20
            factors.append(f"High volatility: {volatility:.2%}")
        
        volume_ratio = data.get('volume_ratio', 1.0)
        if volume_ratio > self.risk_thresholds['volume_spike']:
            score += 15
            factors.append(f"Volume spike: {volume_ratio:.1f}x normal")
        
        return {'score': score, 'factors': factors}
    
    def _assess_oi_risk(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess open interest risk"""
        oi_change = abs(data.get('oi_change', 0))
        factors = []
        score = 0
        
        if oi_change > self.risk_thresholds['oi_change_rate']:
            score += 15
            direction = "increase" if data.get('oi_change', 0) > 0 else "decrease"
            factors.append(f"Significant OI {direction}: {oi_change:.1%}")
        
        return {'score': score, 'factors': factors}
    
    def calculate_position_size(self, 
                              user_tier: str, 
                              symbol: str, 
                              account_balance: float,
                              risk_level: str) -> Dict[str, Any]:
        """Calculate recommended position size based on risk"""
        try:
            limits = self.position_limits.get(user_tier, self.position_limits['standard'])
            
            # Base position size (% of account)
            base_percentage = {
                'low': 0.1,      # 10%
                'medium': 0.05,  # 5%
                'high': 0.02,    # 2%
                'critical': 0.01 # 1%
            }.get(risk_level, 0.02)
            
            # Calculate position size
            position_value = min(
                account_balance * base_percentage,
                limits['max_exposure']
            )
            
            # Adjust leverage based on risk
            max_leverage = {
                'low': limits['max_leverage'],
                'medium': limits['max_leverage'] * 0.7,
                'high': limits['max_leverage'] * 0.4,
                'critical': limits['max_leverage'] * 0.2
            }.get(risk_level, limits['max_leverage'] * 0.5)
            
            return {
                'recommended_position_value': position_value,
                'max_leverage': max_leverage,
                'risk_percentage': base_percentage * 100,
                'risk_level': risk_level,
                'warnings': self._get_position_warnings(risk_level)
            }
            
        except Exception as e:
            self.logger.error(f"Position size calculation failed: {e}")
            return {
                'recommended_position_value': 0,
                'max_leverage': 1,
                'risk_percentage': 0,
                'error': str(e)
            }
    
    def _get_position_warnings(self, risk_level: str) -> List[str]:
        """Get position-specific warnings"""
        warnings = []
        
        if risk_level == "critical":
            warnings.extend([
                "Market conditions are extremely risky",
                "Consider avoiding new positions",
                "Monitor positions continuously"
            ])
        elif risk_level == "high":
            warnings.extend([
                "Elevated market risk detected",
                "Use tight stop losses",
                "Consider reducing position sizes"
            ])
        elif risk_level == "medium":
            warnings.append("Normal caution advised")
        
        return warnings

class AlertThrottler:
    """Throttle alerts to prevent spam"""
    
    def __init__(self):
        self.cooldown_minutes = settings.SIGNAL_COOLDOWN_MINUTES
        self.max_alerts_per_hour = settings.MAX_ALERTS_PER_HOUR
    
    def should_send_alert(self, alert_type: str, symbol: str, severity: str) -> bool:
        """Check if alert should be sent based on throttling rules"""
        try:
            current_time = datetime.utcnow()
            
            # Check cooldown for specific alert type + symbol
            cooldown_key = f"alert_cooldown:{alert_type}:{symbol}"
            last_sent = cache.get(cooldown_key)
            
            if last_sent:
                last_sent_time = datetime.fromisoformat(last_sent)
                if current_time - last_sent_time < timedelta(minutes=self.cooldown_minutes):
                    return False
            
            # Check hourly limit
            hour_key = f"alert_count:{current_time.strftime('%Y%m%d%H')}"
            hourly_count = cache.get(hour_key, 0)
            
            if hourly_count >= self.max_alerts_per_hour:
                return False
            
            # Update counters
            cache.set(cooldown_key, current_time.isoformat(), ttl=self.cooldown_minutes * 60)
            cache.increment(hour_key)
            cache.expire(hour_key, 3600)  # 1 hour
            
            return True
            
        except Exception as e:
            structured_logger.error(f"Alert throttling check failed: {e}")
            return True  # Fail open

# Global instances
risk_manager = RiskManager()
alert_throttler = AlertThrottler()
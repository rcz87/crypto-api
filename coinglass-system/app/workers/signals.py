from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.db import SessionLocal
from app.core.settings import settings
from app.core.telegram import TelegramNotifier
from app.workers.features import FeatureEngine
from app.core.logging import logger
import pandas as pd

class SignalGenerator:
    def __init__(self):
        self.feature_engine = FeatureEngine()
        self.telegram = TelegramNotifier()
        self.thresholds = {
            "liquidation_cascade": 50000000,  # $50M in liquidations
            "funding_extreme": 0.02,          # 2% funding rate
            "oi_spike": 0.3                   # 30% OI change
        }
    
    def generate_all_signals(self):
        """Generate signals for all configured symbols"""
        db = SessionLocal()
        
        try:
            for symbol in settings.SYMBOLS:
                signals = self.generate_symbol_signals(db, symbol)
                self.process_signals(symbol, signals)
                
        except Exception as e:
            logger.error(f"Error generating signals: {e}")
        finally:
            db.close()
    
    def generate_symbol_signals(self, db: Session, symbol: str) -> list:
        """Generate signals for a specific symbol"""
        signals = []
        
        # Check for liquidation cascade
        cascade_signal = self.check_liquidation_cascade(db, symbol)
        if cascade_signal:
            signals.append(cascade_signal)
        
        # Check for funding rate extremes
        funding_signal = self.check_funding_extremes(db, symbol)
        if funding_signal:
            signals.append(funding_signal)
        
        # Check for OI spikes
        oi_signal = self.check_oi_spike(db, symbol)
        if oi_signal:
            signals.append(oi_signal)
        
        return signals
    
    def check_liquidation_cascade(self, db: Session, symbol: str) -> dict:
        """Check for liquidation cascade conditions"""
        query = text("""
            SELECT SUM(qty) as total_liquidations
            FROM liquidations 
            WHERE symbol = :symbol 
            AND ts >= NOW() - INTERVAL '10 minutes'
        """)
        
        result = db.execute(query, {"symbol": symbol}).fetchone()
        
        if result and result[0]:
            total_liq = float(result[0])
            if total_liq > self.thresholds["liquidation_cascade"]:
                return {
                    "type": "liquidation_cascade",
                    "symbol": symbol,
                    "severity": "high",
                    "value": total_liq,
                    "message": f"Liquidation cascade detected: ${total_liq:,.0f} in 10 minutes"
                }
        
        return None
    
    def check_funding_extremes(self, db: Session, symbol: str) -> dict:
        """Check for extreme funding rates"""
        query = text("""
            SELECT rate 
            FROM funding_rate 
            WHERE symbol = :symbol 
            ORDER BY ts DESC 
            LIMIT 1
        """)
        
        result = db.execute(query, {"symbol": symbol}).fetchone()
        
        if result and result[0]:
            funding_rate = float(result[0])
            if abs(funding_rate) > self.thresholds["funding_extreme"]:
                direction = "extremely high" if funding_rate > 0 else "extremely low"
                return {
                    "type": "funding_extreme",
                    "symbol": symbol,
                    "severity": "medium",
                    "value": funding_rate,
                    "message": f"Funding rate {direction}: {funding_rate:.4f}"
                }
        
        return None
    
    def check_oi_spike(self, db: Session, symbol: str) -> dict:
        """Check for Open Interest spikes"""
        query = text("""
            SELECT close as oi_value, ts
            FROM futures_oi_ohlc 
            WHERE symbol = :symbol 
            ORDER BY ts DESC 
            LIMIT 2
        """)
        
        result = db.execute(query, {"symbol": symbol}).fetchall()
        
        if len(result) >= 2:
            current_oi = float(result[0][0]) if result[0][0] else 0
            previous_oi = float(result[1][0]) if result[1][0] else 0
            
            if previous_oi > 0:
                change_pct = (current_oi - previous_oi) / previous_oi
                
                if abs(change_pct) > self.thresholds["oi_spike"]:
                    direction = "spike" if change_pct > 0 else "drop"
                    return {
                        "type": "oi_spike",
                        "symbol": symbol,
                        "severity": "medium",
                        "value": change_pct,
                        "message": f"OI {direction}: {change_pct:.1%} change"
                    }
        
        return None
    
    def process_signals(self, symbol: str, signals: list):
        """Process and send generated signals"""
        for signal in signals:
            logger.info(f"Signal generated for {symbol}: {signal}")
            
            # Send telegram alert for high severity signals
            if signal.get("severity") == "high":
                self.telegram.send_alert(
                    signal["type"],
                    symbol,
                    signal["message"]
                )

def generate_signals():
    """Entry point for signal generation worker"""
    generator = SignalGenerator()
    generator.generate_all_signals()
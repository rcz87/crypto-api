"""
REST Verification Module for WebSocket Events
===========================================

Setelah receive WebSocket liquidation events, verify dengan REST endpoints:
- Taker (coin-agg): aggregated-taker-buy-sell-volume/history
- OI (agg OHLC): open-interest/aggregated-history  
- Funding (pair OHLC): funding-rate/history
- Liquidation (coin-agg): liquidation/aggregated-history

All endpoints support Standard package (No-Limit).
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.coinglass_client import CoinglassClient
from app.core.logging import logger


@dataclass
class LiquidationEvent:
    """Parsed liquidation event dari WebSocket"""
    base_asset: str
    exchange: str
    symbol: str
    price: float
    side: int  # 1=long, 2=short
    vol_usd: float
    timestamp: int
    
    @classmethod
    def from_ws_data(cls, ws_event: Dict[str, Any]) -> 'LiquidationEvent':
        """Parse WebSocket event data ke LiquidationEvent object"""
        return cls(
            base_asset=ws_event.get('baseAsset', ''),
            exchange=ws_event.get('exName', ''),
            symbol=ws_event.get('symbol', ''),
            price=float(ws_event.get('price', 0)),
            side=int(ws_event.get('side', 1)),
            vol_usd=float(ws_event.get('volUsd', 0)),
            timestamp=int(ws_event.get('time', 0))
        )


@dataclass
class VerificationResult:
    """Result dari REST verification"""
    success: bool
    coin: str
    exchange: str
    vol_usd: float
    verification_data: Dict[str, Any]
    alerts_triggered: List[str]
    confidence_score: float  # 0-100
    

class RestVerificationEngine:
    """
    Engine untuk verify WebSocket events dengan REST endpoints
    
    Features:
    - Multi-endpoint verification (taker/OI/funding/liq)
    - Confidence scoring berdasarkan data consistency
    - Alert generation dengan deduplication
    - Rate limiting aware
    """
    
    def __init__(self):
        self.coinglass_client = CoinglassClient()
        
        # Verification thresholds
        self.min_volume_threshold = 50000  # $50k minimum untuk verification
        self.confidence_threshold = 70  # 70% confidence untuk trigger alert
        
        # Rate limiting
        self.verification_cache: Dict[str, Dict] = {}
        self.cache_duration = 300  # 5 minutes cache
        
    async def verify_liquidation_event(self, event: LiquidationEvent) -> VerificationResult:
        """
        Main verification function untuk liquidation events
        
        Process:
        1. Check if event meets volume threshold
        2. Fetch REST data untuk verification
        3. Calculate confidence score
        4. Generate alerts if needed
        """
        try:
            logger.info(f"🔍 Verifying liquidation: {event.base_asset} ${event.vol_usd:,.2f} on {event.exchange}")
            
            # Skip small liquidations
            if event.vol_usd < self.min_volume_threshold:
                logger.debug(f"⚪ Skipping small liquidation: ${event.vol_usd:,.2f} < ${self.min_volume_threshold:,.2f}")
                return VerificationResult(
                    success=False,
                    coin=event.base_asset,
                    exchange=event.exchange,
                    vol_usd=event.vol_usd,
                    verification_data={},
                    alerts_triggered=[],
                    confidence_score=0.0
                )
            
            # Check cache untuk avoid duplicate verification
            cache_key = f"{event.base_asset}_{event.exchange}_{int(event.timestamp/60000)}"  # 1-minute buckets
            if cache_key in self.verification_cache:
                cached_result = self.verification_cache[cache_key]
                if datetime.now().timestamp() - cached_result['timestamp'] < self.cache_duration:
                    logger.debug(f"📋 Using cached verification for {cache_key}")
                    return cached_result['result']
            
            # Fetch REST verification data
            verification_data = await self._fetch_verification_data(event)
            
            # Calculate confidence score
            confidence_score = self._calculate_confidence_score(event, verification_data)
            
            # Generate alerts if confidence threshold met
            alerts = []
            if confidence_score >= self.confidence_threshold:
                alerts = await self._generate_alerts(event, verification_data, confidence_score)
            
            result = VerificationResult(
                success=True,
                coin=event.base_asset,
                exchange=event.exchange, 
                vol_usd=event.vol_usd,
                verification_data=verification_data,
                alerts_triggered=alerts,
                confidence_score=confidence_score
            )
            
            # Cache result
            self.verification_cache[cache_key] = {
                'timestamp': datetime.now().timestamp(),
                'result': result
            }
            
            # Log verification summary
            logger.info(f"✅ Verification complete: {event.base_asset} confidence={confidence_score:.1f}% alerts={len(alerts)}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Verification error for {event.base_asset}: {e}")
            return VerificationResult(
                success=False,
                coin=event.base_asset,
                exchange=event.exchange,
                vol_usd=event.vol_usd,
                verification_data={},
                alerts_triggered=[],
                confidence_score=0.0
            )
    
    async def _fetch_verification_data(self, event: LiquidationEvent) -> Dict[str, Any]:
        """
        Fetch REST data untuk verification sesuai spek final:
        - Taker (coin-agg): Standard, No-Limit
        - OI (agg OHLC): Standard, No-Limit  
        - Funding (pair OHLC): Standard, No-Limit
        - Liquidation (coin-agg): Standard, No-Limit
        """
        verification_data = {}
        
        # Extract coin dari base_asset (remove numbers, etc.)
        coin = self._normalize_coin_symbol(event.base_asset)
        
        try:
            # 1. Taker Buy/Sell Volume (coin-aggregated)
            taker_data = await self._fetch_taker_volume(coin)
            verification_data['taker'] = taker_data
            
        except Exception as e:
            logger.warning(f"⚠️ Taker data fetch failed for {coin}: {e}")
            verification_data['taker'] = {}
            
        try:
            # 2. Open Interest (aggregated OHLC)
            oi_data = await self._fetch_open_interest(coin)
            verification_data['open_interest'] = oi_data
            
        except Exception as e:
            logger.warning(f"⚠️ OI data fetch failed for {coin}: {e}")
            verification_data['open_interest'] = {}
            
        try:
            # 3. Funding Rate (pair OHLC)
            funding_data = await self._fetch_funding_rate(event.symbol, event.exchange)
            verification_data['funding'] = funding_data
            
        except Exception as e:
            logger.warning(f"⚠️ Funding data fetch failed for {event.symbol}: {e}")
            verification_data['funding'] = {}
            
        try:
            # 4. Liquidation History (coin-aggregated)
            liq_data = await self._fetch_liquidation_history(coin)
            verification_data['liquidation'] = liq_data
            
        except Exception as e:
            logger.warning(f"⚠️ Liquidation history fetch failed for {coin}: {e}")
            verification_data['liquidation'] = {}
            
        return verification_data
    
    async def _fetch_taker_volume(self, coin: str) -> Dict[str, Any]:
        """Fetch aggregated taker buy/sell volume history"""
        try:
            # Standard package, No-Limit
            result = self.coinglass_client.taker_buysell_volume_aggregated(
                coin=coin,
                interval='1h'
            )
            return result
        except Exception as e:
            logger.debug(f"Taker volume fetch error for {coin}: {e}")
            return {}
    
    async def _fetch_open_interest(self, coin: str) -> Dict[str, Any]:
        """Fetch aggregated open interest OHLC data"""
        try:
            # Standard package, No-Limit  
            result = self.coinglass_client.oi_ohlc(coin, '1h')
            return result
        except Exception as e:
            logger.debug(f"OI fetch error for {coin}: {e}")
            return {}
    
    async def _fetch_funding_rate(self, symbol: str, exchange: str) -> Dict[str, Any]:
        """Fetch funding rate OHLC data"""
        try:
            # Standard package, No-Limit
            result = self.coinglass_client.funding_rate(
                symbol=symbol.replace('USDT', '').replace('-USDT-SWAP', ''),  # Clean symbol
                exchange=exchange.lower(),
                interval='8h'  # Funding rate typically 8h
            )
            return result
        except Exception as e:
            logger.debug(f"Funding rate fetch error for {symbol} on {exchange}: {e}")
            return {}
    
    async def _fetch_liquidation_history(self, coin: str) -> Dict[str, Any]:
        """Fetch coin-aggregated liquidation history"""
        try:
            # Standard package, No-Limit
            result = self.coinglass_client.liquidation_history_coin(
                symbol=coin,
                interval='1h'
            )
            return result
        except Exception as e:
            logger.debug(f"Liquidation history fetch error for {coin}: {e}")
            return {}
    
    def _normalize_coin_symbol(self, base_asset: str) -> str:
        """Normalize coin symbol untuk REST API calls"""
        # Remove common prefixes/suffixes
        coin = base_asset.upper()
        
        # Handle special cases
        if coin.startswith('1000'):
            coin = coin[4:]  # 1000BONK -> BONK
        
        # Map common symbols
        symbol_map = {
            'WBTC': 'BTC',
            'WETH': 'ETH',
            'USDC': 'USDC',
            'USDT': 'USDT'
        }
        
        return symbol_map.get(coin, coin)
    
    def _calculate_confidence_score(self, event: LiquidationEvent, verification_data: Dict[str, Any]) -> float:
        """
        Calculate confidence score berdasarkan REST verification data
        
        Factors:
        - Data availability (25%)
        - Volume consistency (25%) 
        - Market trend alignment (25%)
        - Exchange reliability (25%)
        """
        score = 0.0
        
        # Data availability score (25%)
        data_sources = ['taker', 'open_interest', 'funding', 'liquidation']
        available_sources = sum(1 for source in data_sources if verification_data.get(source))
        data_score = (available_sources / len(data_sources)) * 25
        score += data_score
        
        # Volume consistency score (25%)
        volume_score = 0
        if verification_data.get('liquidation', {}).get('data'):
            # Check if liquidation volume aligns dengan recent history
            recent_volumes = [
                item.get('vol', 0) for item in verification_data['liquidation']['data'][-5:]
            ]
            if recent_volumes:
                avg_volume = sum(recent_volumes) / len(recent_volumes)
                if avg_volume > 0:
                    # Score berdasarkan relative volume size
                    volume_ratio = event.vol_usd / avg_volume
                    if volume_ratio > 2:  # 2x above average
                        volume_score = 25
                    elif volume_ratio > 1.5:  # 1.5x above average
                        volume_score = 20
                    elif volume_ratio > 1:  # Above average
                        volume_score = 15
                    else:
                        volume_score = 10
        score += volume_score
        
        # Market trend alignment score (25%)
        trend_score = 15  # Default moderate score
        if verification_data.get('open_interest', {}).get('data'):
            # Simplified trend analysis
            oi_data = verification_data['open_interest']['data']
            if len(oi_data) >= 2:
                recent_oi = oi_data[-1].get('o', 0)
                prev_oi = oi_data[-2].get('o', 0)
                if recent_oi > prev_oi:  # OI increasing
                    trend_score = 25
        score += trend_score
        
        # Exchange reliability score (25%)
        exchange_scores = {
            'Binance': 25,
            'OKX': 24,
            'Bybit': 23,
            'HTX': 20,
            'Bitget': 18
        }
        exchange_score = exchange_scores.get(event.exchange, 15)
        score += exchange_score
        
        return min(100.0, score)
    
    async def _generate_alerts(self, event: LiquidationEvent, verification_data: Dict[str, Any], confidence: float) -> List[str]:
        """Generate alerts berdasarkan verification results"""
        alerts = []
        
        # Large liquidation alert
        if event.vol_usd > 100000:  # $100k+
            side_text = "LONG" if event.side == 1 else "SHORT"
            alert = f"🚨 Large {side_text} Liquidation: {event.base_asset} ${event.vol_usd:,.0f} on {event.exchange} (Confidence: {confidence:.1f}%)"
            alerts.append(alert)
        
        # Cascade liquidation alert
        if verification_data.get('liquidation', {}).get('data'):
            recent_liq_count = len(verification_data['liquidation']['data'][-10:])
            if recent_liq_count > 5:  # Multiple recent liquidations
                alerts.append(f"⚡ Cascade Alert: {recent_liq_count} recent liquidations for {event.base_asset}")
        
        # OI divergence alert
        if verification_data.get('open_interest', {}).get('data'):
            oi_data = verification_data['open_interest']['data']
            if len(oi_data) >= 3:
                # Check for unusual OI patterns
                recent_oi = [item.get('o', 0) for item in oi_data[-3:]]
                if max(recent_oi) - min(recent_oi) > max(recent_oi) * 0.1:  # 10% OI change
                    alerts.append(f"📊 OI Divergence: {event.base_asset} showing unusual open interest patterns")
        
        return alerts


# Global instance
_verification_engine: Optional[RestVerificationEngine] = None

def get_verification_engine() -> RestVerificationEngine:
    """Get singleton verification engine"""
    global _verification_engine
    if _verification_engine is None:
        _verification_engine = RestVerificationEngine()
    return _verification_engine


# Integration callback untuk WebSocket events
async def websocket_liquidation_callback(ws_event_data: Dict[str, Any]):
    """
    Callback function untuk integrate dengan WebSocket client
    
    Usage:
    client.add_event_callback(websocket_liquidation_callback)
    """
    try:
        events = ws_event_data.get('data', [])
        if not events:
            return
            
        verification_engine = get_verification_engine()
        
        for event_data in events:
            # Parse event
            event = LiquidationEvent.from_ws_data(event_data)
            
            # Run verification
            result = await verification_engine.verify_liquidation_event(event)
            
            # Log results
            if result.success and result.alerts_triggered:
                for alert in result.alerts_triggered:
                    logger.info(f"📢 ALERT: {alert}")
                    
                    # TODO: Send to Telegram dengan deduplication
                    # await send_telegram_alert(alert)
            
    except Exception as e:
        logger.error(f"❌ WebSocket callback error: {e}")


if __name__ == "__main__":
    # Test verification engine
    import asyncio
    
    async def test_verification():
        engine = RestVerificationEngine()
        
        # Mock liquidation event
        test_event = LiquidationEvent(
            base_asset="BTC",
            exchange="Binance", 
            symbol="BTCUSDT",
            price=67000.0,
            side=1,
            vol_usd=150000.0,
            timestamp=1758365442311
        )
        
        result = await engine.verify_liquidation_event(test_event)
        print(f"Verification result: {result}")
        
    asyncio.run(test_verification())
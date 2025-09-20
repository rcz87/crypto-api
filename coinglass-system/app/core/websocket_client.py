#!/usr/bin/env python3
"""
CoinGlass WebSocket Client V4
Real-time liquidation monitoring untuk retail-ahead intelligence
"""

import asyncio
import json
import websockets
import os
from typing import Optional, Dict, Any, Callable
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class CoinGlassWebSocket:
    """CoinGlass v4 WebSocket client untuk real-time data"""
    
    def __init__(self):
        self.api_key = os.getenv('COINGLASS_API_KEY')
        self.ws_url = f"wss://open-ws.coinglass.com/ws-api?cg-api-key={self.api_key}"
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.is_connected = False
        self.ping_interval = 20  # CoinGlass recommends 20s ping
        self.subscriptions = set()
        
        if not self.api_key:
            logger.warning("🔑 COINGLASS_API_KEY not set - WebSocket disabled")
    
    async def connect(self) -> bool:
        """Connect to CoinGlass WebSocket"""
        if not self.api_key:
            logger.error("❌ No API key - cannot connect WebSocket")
            return False
            
        try:
            logger.info(f"🔌 Connecting to CoinGlass WebSocket...")
            self.websocket = await websockets.connect(
                self.ws_url,
                ping_interval=self.ping_interval,
                ping_timeout=10,
                close_timeout=10
            )
            self.is_connected = True
            logger.info("✅ WebSocket connected successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ WebSocket connection failed: {e}")
            self.is_connected = False
            return False
    
    async def subscribe_liquidation_orders(self, symbols: list = None) -> bool:
        """Subscribe to liquidation orders channel"""
        if not self.is_connected:
            logger.error("❌ WebSocket not connected")
            return False
        
        try:
            # Default to major coins if no symbols specified
            if symbols is None:
                symbols = ['BTC', 'ETH', 'SOL', 'BNB']
            
            subscription = {
                "method": "SUBSCRIBE",
                "params": ["liquidationOrders"],  # CoinGlass v4 channel
                "id": int(datetime.now().timestamp())
            }
            
            await self.websocket.send(json.dumps(subscription))
            self.subscriptions.add("liquidationOrders")
            logger.info(f"📡 Subscribed to liquidation orders for {len(symbols)} symbols")
            return True
            
        except Exception as e:
            logger.error(f"❌ Subscription failed: {e}")
            return False
    
    async def listen(self, message_handler: Optional[Callable] = None) -> None:
        """Listen for WebSocket messages"""
        if not self.is_connected or not self.websocket:
            logger.error("❌ WebSocket not connected")
            return
        
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    await self.handle_message(data, message_handler)
                except json.JSONDecodeError:
                    logger.warning(f"⚠️ Invalid JSON received: {message}")
                except Exception as e:
                    logger.error(f"❌ Message handling error: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.warning("🔌 WebSocket connection closed")
            self.is_connected = False
        except Exception as e:
            logger.error(f"❌ WebSocket listen error: {e}")
            self.is_connected = False
    
    async def handle_message(self, data: Dict[str, Any], handler: Optional[Callable] = None):
        """Handle incoming WebSocket message"""
        try:
            # Check if it's liquidation data
            if 'data' in data and 'liquidationOrders' in str(data):
                liquidation_data = data.get('data', {})
                symbol = liquidation_data.get('symbol', 'UNKNOWN')
                volume = liquidation_data.get('volume', 0)
                price = liquidation_data.get('price', 0)
                side = liquidation_data.get('side', 'unknown')
                
                logger.info(f"🔥 Liquidation: {symbol} {side} ${volume:,.0f} @ ${price:,.2f}")
                
                # Call custom handler if provided
                if handler:
                    await handler('liquidation', liquidation_data)
            
            # Handle ping/pong
            elif data.get('ping'):
                pong = {"pong": data['ping']}
                await self.websocket.send(json.dumps(pong))
                logger.debug("🏓 Pong sent")
            
            # Handle subscription confirmations
            elif 'result' in data:
                logger.info(f"✅ Subscription confirmed: {data}")
                
        except Exception as e:
            logger.error(f"❌ Message processing error: {e}")
    
    async def close(self):
        """Close WebSocket connection"""
        if self.websocket:
            await self.websocket.close()
            self.is_connected = False
            logger.info("🔌 WebSocket connection closed")
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

# Global instance
_ws_client: Optional[CoinGlassWebSocket] = None

def get_websocket_client() -> CoinGlassWebSocket:
    """Get singleton WebSocket client"""
    global _ws_client
    if _ws_client is None:
        _ws_client = CoinGlassWebSocket()
    return _ws_client
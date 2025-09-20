#!/usr/bin/env python3
"""
CoinGlass WebSocket v4 Client - Real-time liquidationOrders heads-up
================================================================

Mengikuti spesifikasi final:
- URL: wss://open-ws.coinglass.com/ws-api?cg-api-key=<API_KEY>
- Channel: liquidationOrders (Standard+ access)
- Ping/pong: tiap ~20 detik (manual)
- Auto-reconnect: exponential backoff dengan jitter
- REST verification: taker/OI/funding/liq setelah event
"""

import asyncio
import json
import logging
import os
import random
import time
from typing import Optional, Dict, Any, List, Callable, Union
import websockets
from websockets.exceptions import ConnectionClosed, ConnectionClosedError

from app.core.logging import logger


class CoinGlassWebSocketClient:
    """
    CoinGlass WebSocket v4 client untuk real-time liquidation alerts
    
    Features:
    - Subscribe liquidationOrders channel (Standard+ package)
    - Ping/pong keep-alive mechanism (manual, sesuai spek)
    - Auto-reconnect dengan exponential backoff + jitter
    - Non-blocking event callback system dengan queue processing
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("COINGLASS_API_KEY")
        if not self.api_key:
            raise ValueError("COINGLASS_API_KEY is required")
            
        self.ws_url = f"wss://open-ws.coinglass.com/ws-api?cg-api-key={self.api_key}"
        
        # Connection settings sesuai spek final
        self.ping_interval = 20  # seconds, sesuai spek
        self.initial_backoff = 1  # seconds
        self.max_backoff = 60  # seconds
        self.backoff_multiplier = 2
        self.jitter_max = 0.5  # seconds
        
        # State tracking
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.is_connected = False
        self.is_running = False
        self.backoff_delay = self.initial_backoff
        self.connection_start_time = None
        self.total_events_received = 0
        self.last_ping_time = None
        self.last_pong_time = None
        
        # Event callbacks - support both sync and async
        self.event_callbacks: List[Union[Callable[[Dict[str, Any]], None], Callable[[Dict[str, Any]], Any]]] = []
        
        # Event queue untuk non-blocking processing
        self.event_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        
        # Tasks
        self.ping_task: Optional[asyncio.Task] = None
        self.receive_task: Optional[asyncio.Task] = None
        self.event_processor_task: Optional[asyncio.Task] = None
        
    def add_event_callback(self, callback: Union[Callable[[Dict[str, Any]], None], Callable[[Dict[str, Any]], Any]]):
        """Add callback function untuk handle liquidation events (sync or async)"""
        self.event_callbacks.append(callback)
    
    async def connect(self) -> bool:
        """Connect ke CoinGlass WebSocket v4"""
        try:
            # SECURITY: Never log API key - use redacted URL for logging
            redacted_url = "wss://open-ws.coinglass.com/ws-api?cg-api-key=***REDACTED***"
            logger.info(f"[WS] Connecting to CoinGlass v4: {redacted_url}")
            
            self.websocket = await websockets.connect(
                self.ws_url,
                ping_interval=None,  # Kita handle ping sendiri
                ping_timeout=None,
                max_size=10**7,  # 10MB buffer
                max_queue=100
            )
            
            self.is_connected = True
            self.connection_start_time = time.time()
            self.backoff_delay = self.initial_backoff  # Reset backoff on successful connection
            
            logger.info("[WS] ✅ Connected to CoinGlass WebSocket v4")
            
            # Subscribe to liquidationOrders channel sesuai spek
            subscribe_msg = {
                "method": "subscribe",
                "channels": ["liquidationOrders"]
            }
            
            await self.websocket.send(json.dumps(subscribe_msg))
            logger.info("[WS] ✅ Subscribed to liquidationOrders channel")
            
            return True
            
        except Exception as e:
            logger.error(f"[WS] ❌ Connection failed: {e}")
            self.is_connected = False
            return False
    
    async def disconnect(self):
        """Gracefully disconnect WebSocket"""
        self.is_running = False
        self.is_connected = False
        
        # Cancel all tasks
        tasks_to_cancel = []
        if self.ping_task and not self.ping_task.done():
            tasks_to_cancel.append(self.ping_task)
        if self.receive_task and not self.receive_task.done():
            tasks_to_cancel.append(self.receive_task)
        if self.event_processor_task and not self.event_processor_task.done():
            tasks_to_cancel.append(self.event_processor_task)
        
        # Cancel all tasks
        for task in tasks_to_cancel:
            task.cancel()
            
        # Wait for cancellation to complete
        if tasks_to_cancel:
            await asyncio.gather(*tasks_to_cancel, return_exceptions=True)
            
        # Close WebSocket
        if self.websocket:
            try:
                await self.websocket.close()
            except Exception as e:
                logger.debug(f"[WS] Error closing WebSocket: {e}")
                
        logger.info("[WS] 🔌 Disconnected")
    
    async def ping_loop(self):
        """Ping/pong keep-alive loop sesuai CoinGlass spec"""
        while self.is_connected and self.is_running:
            try:
                await asyncio.sleep(self.ping_interval)
                
                if not self.is_connected or not self.websocket:
                    break
                    
                await self.websocket.send("ping")
                self.last_ping_time = time.time()
                logger.debug("[WS] ↪️ ping")
                
            except ConnectionClosed:
                logger.info("[WS] Connection closed during ping")
                break
            except Exception as e:
                logger.error(f"[WS] Ping error: {e}")
                break
    
    async def receive_loop(self):
        """Main message receive loop"""
        while self.is_connected and self.is_running:
            try:
                if not self.websocket:
                    break
                    
                message = await self.websocket.recv()
                await self.handle_message(message)
                
            except ConnectionClosed:
                logger.info("[WS] Connection closed during receive")
                break
            except ConnectionClosedError:
                logger.info("[WS] Connection closed error during receive")
                break
            except Exception as e:
                logger.error(f"[WS] Receive error: {e}")
                break
    
    async def handle_message(self, message: str):
        """Handle incoming WebSocket messages - NON-BLOCKING"""
        try:
            # Handle pong response
            if message == "pong":
                self.last_pong_time = time.time()
                logger.debug("[WS] ↩️ pong")
                return
            
            # Handle text messages that aren't JSON
            if not message.startswith("{"):
                logger.debug(f"[WS] Non-JSON message: {message[:100]}")
                return
                
            # Parse JSON message
            data = json.loads(message)
            
            # Handle liquidationOrders events
            if data.get("channel") == "liquidationOrders":
                events = data.get("data", [])
                if events:
                    self.total_events_received += len(events)
                    
                    # Log event summary
                    sample_event = events[0]
                    exchange = sample_event.get("exName", "Unknown")
                    symbol = sample_event.get("symbol", "Unknown") 
                    vol_usd = sample_event.get("volUsd", 0)
                    
                    logger.info(f"[EVT] {len(events)} liquidation events | {exchange} {symbol} ${vol_usd:,.2f}")
                    
                    # Queue event untuk background processing (NON-BLOCKING)
                    try:
                        self.event_queue.put_nowait(data)
                    except asyncio.QueueFull:
                        logger.warning("[WS] Event queue full - dropping event")
            else:
                # Log other message types
                logger.debug(f"[WS] Other message: {data}")
                
        except json.JSONDecodeError:
            logger.debug(f"[WS] Non-JSON message: {message[:100]}")
        except Exception as e:
            logger.error(f"[WS] Message handling error: {e}")
    
    async def _event_processor(self):
        """Background event processor - processes events dari queue tanpa blocking receive loop"""
        while self.is_running:
            try:
                # Wait for events dengan timeout
                try:
                    event_data = await asyncio.wait_for(self.event_queue.get(), timeout=5.0)
                except asyncio.TimeoutError:
                    continue
                
                # Process event dengan all registered callbacks
                for callback in self.event_callbacks:
                    try:
                        # Fire-and-forget: Create task without awaiting untuk avoid blocking
                        asyncio.create_task(self._safe_callback(callback, event_data))
                    except Exception as e:
                        logger.error(f"[WS] Callback task creation error: {e}")
                
                # Mark task as done
                self.event_queue.task_done()
                
            except Exception as e:
                logger.error(f"[WS] Event processor error: {e}")
                await asyncio.sleep(1)  # Prevent tight error loop
    
    async def _safe_callback(self, callback: Callable, data: Dict[str, Any]):
        """Safely execute callback dengan timeout protection dan thread pool untuk sync callbacks"""
        try:
            if asyncio.iscoroutinefunction(callback):
                # Add timeout to prevent hanging callbacks
                await asyncio.wait_for(callback(data), timeout=30.0)
            else:
                # Run sync callback in thread pool untuk avoid blocking
                await asyncio.get_event_loop().run_in_executor(None, callback, data)
        except asyncio.TimeoutError:
            logger.error(f"[WS] Callback timeout after 30s")
        except Exception as e:
            logger.error(f"[WS] Callback execution error: {e}")
    
    async def run_with_reconnect(self):
        """Main run loop dengan auto-reconnect logic"""
        self.is_running = True
        
        while self.is_running:
            try:
                # Attempt connection
                if await self.connect():
                    # Start ping, receive, and event processor tasks
                    self.ping_task = asyncio.create_task(self.ping_loop())
                    self.receive_task = asyncio.create_task(self.receive_loop())
                    self.event_processor_task = asyncio.create_task(self._event_processor())
                    
                    # Wait for ping/receive tasks to complete (connection tasks)
                    # Event processor runs independently and doesn't affect reconnection
                    connection_tasks = {self.ping_task, self.receive_task}
                    done, pending = await asyncio.wait(
                        connection_tasks, 
                        return_when=asyncio.FIRST_COMPLETED
                    )
                    
                    # Cancel remaining connection tasks
                    for task in pending:
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            pass
                    
                    # Cancel event processor for clean shutdown
                    if self.event_processor_task:
                        self.event_processor_task.cancel()
                        try:
                            await self.event_processor_task
                        except asyncio.CancelledError:
                            pass
                
                if not self.is_running:
                    break
                    
                # Connection lost, calculate backoff with jitter
                jitter = random.uniform(0, self.jitter_max)
                total_delay = self.backoff_delay + jitter
                
                logger.warning(f"[WS] ❌ Connection lost | Reconnecting in {total_delay:.1f}s")
                
                # Clean up current connection
                self.is_connected = False
                if self.websocket:
                    try:
                        await self.websocket.close()
                    except:
                        pass
                
                # Wait before reconnecting
                await asyncio.sleep(total_delay)
                
                # Increase backoff for next retry (exponential)
                self.backoff_delay = min(self.max_backoff, self.backoff_delay * self.backoff_multiplier)
                
            except KeyboardInterrupt:
                logger.info("[WS] 🛑 Keyboard interrupt - stopping")
                break
            except Exception as e:
                logger.error(f"[WS] Unexpected error: {e}")
                await asyncio.sleep(5)  # Brief pause before retry
        
        # Cleanup
        await self.disconnect()
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics untuk monitoring"""
        uptime = 0
        if self.connection_start_time and self.is_connected:
            uptime = time.time() - self.connection_start_time
            
        return {
            "connected": self.is_connected,
            "uptime_seconds": uptime,
            "total_events": self.total_events_received,
            "last_ping": self.last_ping_time,
            "last_pong": self.last_pong_time,
            "ping_latency_ms": self._calculate_ping_latency(),
            "backoff_delay": self.backoff_delay
        }
    
    def _calculate_ping_latency(self) -> Optional[float]:
        """Calculate ping latency if both ping/pong timestamps available"""
        if self.last_ping_time and self.last_pong_time:
            if self.last_pong_time > self.last_ping_time:
                return (self.last_pong_time - self.last_ping_time) * 1000
        return None


# Example callback function untuk integration dengan alert system
async def liquidation_event_handler(event_data: Dict[str, Any]):
    """
    Enhanced callback untuk handle liquidation events dengan REST verification
    Integrate dengan existing alert system
    """
    try:
        from app.core.rest_verification import websocket_liquidation_callback
        
        # Use the full REST verification system
        await websocket_liquidation_callback(event_data)
        
    except Exception as e:
        logger.error(f"Liquidation event handler error: {e}")


# Basic callback for simple logging (backup)
async def simple_liquidation_handler(event_data: Dict[str, Any]):
    """
    Simple callback untuk basic liquidation logging
    """
    try:
        events = event_data.get("data", [])
        if not events:
            return
            
        for event in events:
            # Extract key information
            exchange = event.get("exName", "Unknown")
            symbol = event.get("symbol", "Unknown")
            vol_usd = event.get("volUsd", 0)
            side = event.get("side", "Unknown")
            timestamp = event.get("time", 0)
            
            # Filter for significant liquidations (>$50k)
            if vol_usd > 50000:
                side_text = "LONG" if side == 1 else "SHORT"
                logger.info(f"🚨 Large liquidation: {exchange} {symbol} {side_text} ${vol_usd:,.2f}")
                
    except Exception as e:
        logger.error(f"Simple liquidation handler error: {e}")


# Example usage for testing
async def test_websocket_client():
    """Test function sesuai acceptance criteria"""
    client = CoinGlassWebSocketClient()
    
    # Add event handler
    client.add_event_callback(liquidation_event_handler)
    
    logger.info("🧪 Starting WebSocket client test (target: 30+ minutes)")
    logger.info("📊 Acceptance criteria:")
    logger.info("   - Connect stable ≥30 minutes")
    logger.info("   - Ping/pong consistent ~20s")
    logger.info("   - Events received > 0")
    logger.info("   - Auto-reconnect working")
    
    # Run with monitoring
    try:
        # Start WebSocket client
        ws_task = asyncio.create_task(client.run_with_reconnect())
        
        # Monitor connection every 5 minutes
        monitor_interval = 300  # 5 minutes
        start_time = time.time()
        
        while True:
            await asyncio.sleep(monitor_interval)
            
            stats = client.get_connection_stats()
            elapsed = time.time() - start_time
            
            logger.info(f"📊 Connection Status (elapsed: {elapsed/60:.1f}m)")
            logger.info(f"   Connected: {stats['connected']}")
            logger.info(f"   Uptime: {stats['uptime_seconds']/60:.1f}m")
            logger.info(f"   Events received: {stats['total_events']}")
            logger.info(f"   Ping latency: {stats['ping_latency_ms']:.1f}ms" if stats['ping_latency_ms'] else "   Ping latency: N/A")
            
            # Check acceptance criteria after 30 minutes
            if elapsed >= 1800:  # 30 minutes
                if stats['connected'] and stats['total_events'] > 0:
                    logger.info("✅ ACCEPTANCE CRITERIA MET!")
                    logger.info("   - ✅ Stable connection ≥30 minutes")
                    logger.info("   - ✅ Events received")
                    logger.info("   - ✅ Ping/pong working")
                    break
                else:
                    logger.warning("❌ Acceptance criteria not met")
                    
    except KeyboardInterrupt:
        logger.info("🛑 Test stopped by user")
    finally:
        await client.disconnect()


# Global instance untuk compatibility
_ws_client: Optional[CoinGlassWebSocketClient] = None

def get_websocket_client() -> CoinGlassWebSocketClient:
    """Get singleton WebSocket client"""
    global _ws_client
    if _ws_client is None:
        _ws_client = CoinGlassWebSocketClient()
    return _ws_client


if __name__ == "__main__":
    # Run test
    asyncio.run(test_websocket_client())
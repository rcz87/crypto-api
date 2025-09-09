import threading
from app.core.ws import WSClient
from app.core.settings import settings
from app.core.dq import DataQueue
from app.core.logging import logger

liquidation_queue = DataQueue("liquidations")
funding_queue = DataQueue("funding")

def start_websocket_feeds():
    """Start WebSocket feeds for real-time data"""
    
    def start_liquidation_feed():
        url = "wss://api.coinglass.com/ws/liquidation"
        client = WSClient(url, on_liquidation_message)
        client.run(settings.WS_RECONNECT_SECONDS)
    
    def start_funding_feed():
        url = "wss://api.coinglass.com/ws/funding"
        client = WSClient(url, on_funding_message)
        client.run(settings.WS_RECONNECT_SECONDS)
    
    # Start feeds in separate threads
    threading.Thread(target=start_liquidation_feed, daemon=True).start()
    threading.Thread(target=start_funding_feed, daemon=True).start()
    
    logger.info("WebSocket feeds started")

def on_liquidation_message(data: dict):
    """Process incoming liquidation data"""
    try:
        liquidation_queue.push(data)
        logger.debug(f"Liquidation data queued: {data}")
    except Exception as e:
        logger.error(f"Error processing liquidation message: {e}")

def on_funding_message(data: dict):
    """Process incoming funding rate data"""
    try:
        funding_queue.push(data)
        logger.debug(f"Funding data queued: {data}")
    except Exception as e:
        logger.error(f"Error processing funding message: {e}")
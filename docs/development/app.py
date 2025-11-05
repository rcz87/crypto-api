"""
Cryptocurrency Liquidation Heatmap System - Main Streamlit Application
"""
import asyncio
import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import logging
from contextlib import asynccontextmanager
import threading
import time

# Import our services and utilities
from config import TRADING_PAIRS, LEVERAGE_TIERS, HEATMAP_CONFIG, EXCHANGE_WEIGHTS
from database.connection import get_db_session
from database.models import LiquidationEvent, OrderBookSnapshot, MarketMetrics
from services.binance_websocket import BinanceWebSocketManager
from services.okx_api import OKXDataProcessor
from services.bybit_api import BybitDataProcessor
from services.data_processor import DataProcessor, LiquidationCluster
from services.database_saver import db_saver
from utils.visualization import HeatmapVisualizer, OrderBookVisualizer
from utils.helpers import format_currency, format_percentage, get_risk_color, calculate_time_ranges
import json
import csv
from io import StringIO, BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Streamlit page configuration
st.set_page_config(
    page_title="Crypto Liquidation Heatmap",
    page_icon="🔥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'data_processor' not in st.session_state:
    st.session_state.data_processor = DataProcessor()

if 'binance_manager' not in st.session_state:
    st.session_state.binance_manager = None

if 'okx_processor' not in st.session_state:
    st.session_state.okx_processor = OKXDataProcessor()

if 'bybit_processor' not in st.session_state:
    st.session_state.bybit_processor = BybitDataProcessor()

if 'heatmap_visualizer' not in st.session_state:
    st.session_state.heatmap_visualizer = HeatmapVisualizer()

if 'orderbook_visualizer' not in st.session_state:
    st.session_state.orderbook_visualizer = OrderBookVisualizer()

if 'connection_status' not in st.session_state:
    st.session_state.connection_status = {
        'binance': {'connected': False, 'last_update': None, 'total_messages': 0, 'errors': 0},
        'okx': {'connected': True, 'last_update': None, 'total_requests': 0, 'errors': 0},
        'bybit': {'connected': True, 'last_update': None, 'total_requests': 0, 'errors': 0}
    }

if 'current_data' not in st.session_state:
    st.session_state.current_data = {
        'liquidations': {},
        'market_data': {},
        'orderbooks': {},
        'heatmap_clusters': {}
    }

if 'last_update' not in st.session_state:
    st.session_state.last_update = datetime.now(timezone.utc)

if 'alerts' not in st.session_state:
    st.session_state.alerts = []

if 'alert_history' not in st.session_state:
    st.session_state.alert_history = []

class StreamlitWebSocketHandler:
    """
    Handler for WebSocket events that updates Streamlit session state
    """
    
    def __init__(self):
        self.data_processor = st.session_state.data_processor
    
    async def on_liquidation(self, data: Dict):
        """Handle liquidation events"""
        try:
            symbol = data.get('symbol')
            if symbol:
                # Add to data processor
                self.data_processor.add_liquidation_event(data)
                
                # Save to database
                db_saver.save_liquidation_event(data)
                
                # Update session state
                if symbol not in st.session_state.current_data['liquidations']:
                    st.session_state.current_data['liquidations'][symbol] = []
                
                st.session_state.current_data['liquidations'][symbol].append(data)
                
                # Keep only recent liquidations (last 1000 per symbol)
                if len(st.session_state.current_data['liquidations'][symbol]) > 1000:
                    st.session_state.current_data['liquidations'][symbol] = \
                        st.session_state.current_data['liquidations'][symbol][-1000:]
                
                # Update connection status
                st.session_state.connection_status['binance']['total_messages'] += 1
                st.session_state.connection_status['binance']['last_update'] = datetime.now(timezone.utc)
                
                logger.info(f"Processed liquidation: {symbol} {data.get('side')} {data.get('quantity')} @ {data.get('price')}")
                
        except Exception as e:
            logger.error(f"Error handling liquidation event: {e}")
    
    def on_orderbook(self, data: Dict):
        """Handle orderbook updates"""
        try:
            symbol = data.get('symbol')
            if symbol:
                # Add to data processor
                self.data_processor.add_market_data(data)
                
                # Save to database (throttled - every 10th update)
                import random
                if random.random() < 0.1:  # Save 10% of orderbook updates to avoid DB overload
                    db_saver.save_orderbook_snapshot(data)
                
                # Update session state
                st.session_state.current_data['orderbooks'][symbol] = data
                
                logger.debug(f"Updated orderbook for {symbol}")
                
        except Exception as e:
            logger.error(f"Error handling orderbook event: {e}")
    
    def on_mark_price(self, data: Dict):
        """Handle mark price updates"""
        try:
            symbol = data.get('symbol')
            if symbol:
                # Update market data
                if symbol not in st.session_state.current_data['market_data']:
                    st.session_state.current_data['market_data'][symbol] = {}
                
                st.session_state.current_data['market_data'][symbol].update(data)
                
                # Add to data processor
                self.data_processor.add_market_data(data)
                
        except Exception as e:
            logger.error(f"Error handling mark price event: {e}")
    
    def on_connection_status(self, status: Dict):
        """Handle connection status updates"""
        try:
            st.session_state.connection_status['binance'].update(status)
            
        except Exception as e:
            logger.error(f"Error handling connection status: {e}")

@st.cache_resource
def get_websocket_handler():
    """Get cached WebSocket handler"""
    return StreamlitWebSocketHandler()

def cleanup_on_shutdown():
    """Cleanup function to flush pending database writes"""
    global _event_loop
    try:
        logger.info("Flushing pending database batches...")
        db_saver.flush_all_batches()
        logger.info("Database cleanup completed")
        
        # Close event loop if it exists
        if _event_loop is not None and not _event_loop.is_closed():
            # Cancel all pending tasks
            pending = asyncio.all_tasks(_event_loop)
            for task in pending:
                task.cancel()
            # Wait for tasks to complete
            if pending:
                _event_loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            _event_loop.close()
            logger.info("Event loop closed")
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")

async def start_websocket_manager():
    """Start the Binance WebSocket manager"""
    try:
        if st.session_state.binance_manager is None:
            manager = BinanceWebSocketManager()
            handler = get_websocket_handler()
            
            # Add callbacks
            manager.add_callback('liquidation', handler.on_liquidation)
            manager.add_callback('orderbook', handler.on_orderbook)
            manager.add_callback('mark_price', handler.on_mark_price)
            manager.add_callback('connection_status', handler.on_connection_status)
            
            st.session_state.binance_manager = manager
            
            # Start in background task
            asyncio.create_task(manager.start(TRADING_PAIRS[:5]))
            
        return st.session_state.binance_manager
        
    except Exception as e:
        logger.error(f"Error starting WebSocket manager: {e}")
        st.error(f"Failed to start real-time data feed: {e}")
        return None

async def fetch_exchange_data():
    """Fetch data from OKX and Bybit APIs"""
    try:
        # Get symbols from sidebar selection
        selected_symbols = st.session_state.get('selected_symbols', TRADING_PAIRS[:5])
        
        # Fetch OKX data
        okx_data = await st.session_state.okx_processor.get_market_data(selected_symbols)
        for data in okx_data:
            symbol = data['symbol']
            st.session_state.current_data['market_data'][symbol] = {
                **st.session_state.current_data['market_data'].get(symbol, {}),
                **data
            }
            st.session_state.data_processor.add_market_data(data)
            # Save market data to database
            db_saver.save_market_data(data)
        
        # Fetch Bybit data (skip if 403 errors)
        try:
            bybit_data = await st.session_state.bybit_processor.get_market_data(selected_symbols)
            for data in bybit_data:
                symbol = data['symbol']
                st.session_state.current_data['market_data'][symbol] = {
                    **st.session_state.current_data['market_data'].get(symbol, {}),
                    **data
                }
                st.session_state.data_processor.add_market_data(data)
                # Save market data to database
                db_saver.save_market_data(data)
        except Exception as e:
            logger.warning(f"Skipping Bybit due to errors: {e}")
        
        # Update connection status
        st.session_state.connection_status['okx']['total_requests'] += len(okx_data)
        st.session_state.connection_status['okx']['last_update'] = datetime.now(timezone.utc)
        st.session_state.connection_status['bybit']['total_requests'] += len(bybit_data)
        st.session_state.connection_status['bybit']['last_update'] = datetime.now(timezone.utc)
        
        logger.info(f"Fetched data: {len(okx_data)} OKX, {len(bybit_data)} Bybit")
        
    except Exception as e:
        logger.error(f"Error fetching exchange data: {e}")
        st.session_state.connection_status['okx']['errors'] += 1
        st.session_state.connection_status['bybit']['errors'] += 1

def check_alert_conditions(symbol: str, clusters: List[LiquidationCluster]):
    """Check if any alert conditions are met"""
    try:
        if not st.session_state.get('alerts_enabled', False):
            return
        
        alert_threshold = st.session_state.get('alert_threshold_z_score', 2.0)
        alert_volume = st.session_state.get('alert_volume_threshold', 100000)
        
        for cluster in clusters:
            # Check Z-score threshold
            if abs(cluster.z_score) >= alert_threshold and cluster.total_volume >= alert_volume:
                alert = {
                    'timestamp': datetime.now(timezone.utc),
                    'symbol': symbol,
                    'price_level': cluster.price_level,
                    'z_score': cluster.z_score,
                    'total_volume': cluster.total_volume,
                    'risk_level': cluster.risk_level,
                    'message': f"High liquidation cluster detected at ${cluster.price_level:.2f} (Z-score: {cluster.z_score:.2f})"
                }
                
                # Avoid duplicate alerts within 5 minutes
                is_duplicate = False
                for existing_alert in st.session_state.alert_history[-10:]:
                    if (existing_alert['symbol'] == symbol and 
                        abs(existing_alert['price_level'] - cluster.price_level) < cluster.price_level * 0.01 and
                        (datetime.now(timezone.utc) - existing_alert['timestamp']).seconds < 300):
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    st.session_state.alerts.append(alert)
                    st.session_state.alert_history.append(alert)
                    logger.info(f"Alert triggered: {alert['message']}")
    
    except Exception as e:
        logger.error(f"Error checking alert conditions: {e}")

def update_heatmap_data():
    """Update heatmap clusters for all symbols"""
    try:
        selected_symbols = st.session_state.get('selected_symbols', TRADING_PAIRS[:5])
        time_window = st.session_state.get('time_window', '1h')
        kde_bandwidth = st.session_state.get('kde_smoothing', 0.3)
        
        for symbol in selected_symbols:
            clusters = st.session_state.data_processor.get_heatmap_data_for_symbol(
                symbol, 
                time_window,
                kde_bandwidth=kde_bandwidth
            )
            st.session_state.current_data['heatmap_clusters'][symbol] = clusters
            
            # Save heatmap data to database
            if clusters:
                db_saver.save_heatmap_data(symbol, clusters, time_window)
            
            # Check alert conditions
            check_alert_conditions(symbol, clusters)
        
        # Force flush database batches to ensure data persistence
        db_saver.flush_all_batches()
            
        st.session_state.last_update = datetime.now(timezone.utc)
        
    except Exception as e:
        logger.error(f"Error updating heatmap data: {e}")

def render_alerts():
    """Display active alerts"""
    if st.session_state.alerts:
        with st.container():
            st.markdown("### 🔔 Active Alerts")
            
            for i, alert in enumerate(st.session_state.alerts[-5:]):
                with st.expander(
                    f"⚠️ {alert['symbol']} - {alert['message']}", 
                    expanded=(i == len(st.session_state.alerts[-5:]) - 1)
                ):
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("Price Level", f"${alert['price_level']:,.2f}")
                    with col2:
                        st.metric("Z-Score", f"{alert['z_score']:.2f}")
                    with col3:
                        st.metric("Volume", f"${alert['total_volume']:,.0f}")
                    
                    st.caption(f"Detected at: {alert['timestamp'].strftime('%Y-%m-%d %H:%M:%S UTC')}")
            
            if st.button("Clear Alerts"):
                st.session_state.alerts = []
                st.rerun()

def render_header():
    """Render the main header with title and status indicators"""
    st.title("🔥 Cryptocurrency Liquidation Heatmap")
    
    # Show alerts if enabled and any exist
    if st.session_state.get('alerts_enabled', False):
        render_alerts()
    st.markdown("Real-time liquidation analysis with multi-exchange aggregation")
    
    # Status indicators
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        binance_status = st.session_state.connection_status['binance']
        status_color = "🟢" if binance_status['connected'] else "🔴"
        st.metric(
            "Binance",
            f"{status_color} {'Connected' if binance_status['connected'] else 'Disconnected'}",
            f"{binance_status['total_messages']} messages"
        )
    
    with col2:
        okx_status = st.session_state.connection_status['okx']
        last_update = okx_status.get('last_update')
        is_recent = last_update and (datetime.now(timezone.utc) - last_update).seconds < 300
        status_color = "🟢" if is_recent else "🟡"
        st.metric(
            "OKX",
            f"{status_color} API",
            f"{okx_status['total_requests']} requests"
        )
    
    with col3:
        bybit_status = st.session_state.connection_status['bybit']
        last_update = bybit_status.get('last_update')
        is_recent = last_update and (datetime.now(timezone.utc) - last_update).seconds < 300
        status_color = "🟢" if is_recent else "🟡"
        st.metric(
            "Bybit",
            f"{status_color} API",
            f"{bybit_status['total_requests']} requests"
        )
    
    with col4:
        st.metric(
            "Last Update",
            st.session_state.last_update.strftime("%H:%M:%S"),
            f"{(datetime.now(timezone.utc) - st.session_state.last_update).seconds}s ago"
        )

def export_heatmap_data_csv(clusters: List[LiquidationCluster], symbol: str) -> str:
    """Export heatmap data to CSV format"""
    output = StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'Symbol', 'Price Level', 'Total Volume', 'Long Liquidation', 'Short Liquidation',
        'Liquidation Count', 'Z-Score', 'Risk Level', 'Avg Leverage'
    ])
    
    # Write data
    for cluster in clusters:
        writer.writerow([
            symbol,
            f"{cluster.price_level:.2f}",
            f"{cluster.total_volume:.2f}",
            f"{cluster.long_liquidation_volume:.2f}",
            f"{cluster.short_liquidation_volume:.2f}",
            cluster.liquidation_count,
            f"{cluster.z_score:.4f}",
            cluster.risk_level,
            f"{cluster.average_leverage:.2f}" if cluster.average_leverage else "N/A"
        ])
    
    return output.getvalue()

def export_heatmap_data_json(clusters: List[LiquidationCluster], symbol: str) -> str:
    """Export heatmap data to JSON format"""
    data = {
        'symbol': symbol,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'clusters': [
            {
                'price_level': cluster.price_level,
                'total_volume': cluster.total_volume,
                'long_liquidation_volume': cluster.long_liquidation_volume,
                'short_liquidation_volume': cluster.short_liquidation_volume,
                'liquidation_count': cluster.liquidation_count,
                'z_score': cluster.z_score,
                'risk_level': cluster.risk_level,
                'average_leverage': cluster.average_leverage
            }
            for cluster in clusters
        ]
    }
    return json.dumps(data, indent=2)

def render_sidebar():
    """Render the sidebar with controls"""
    st.sidebar.header("⚙️ Controls")
    
    # Symbol selection
    st.sidebar.subheader("Trading Pairs")
    selected_symbols = st.sidebar.multiselect(
        "Select symbols to monitor:",
        options=TRADING_PAIRS,
        default=TRADING_PAIRS[:5],
        key='selected_symbols'
    )
    
    # Time window selection
    st.sidebar.subheader("Time Window")
    time_window = st.sidebar.selectbox(
        "Analysis period:",
        options=['1h', '4h', '1d', '7d', '30d'],
        index=0,
        key='time_window'
    )
    
    # Heatmap settings
    st.sidebar.subheader("Heatmap Settings")
    
    price_range = st.sidebar.slider(
        "Price range (%)",
        min_value=5.0,
        max_value=50.0,
        value=15.0,
        step=2.5,
        key='price_range'
    )
    
    show_estimated = st.sidebar.checkbox(
        "Show estimated liquidations",
        value=True,
        key='show_estimated',
        help="Include estimated liquidation zones based on open interest"
    )
    
    smoothing = st.sidebar.slider(
        "KDE smoothing",
        min_value=0.1,
        max_value=1.0,
        value=0.3,
        step=0.1,
        key='kde_smoothing',
        help="Kernel density estimation bandwidth adjustment"
    )
    
    # Exchange weights
    st.sidebar.subheader("Exchange Weights")
    for exchange, default_weight in EXCHANGE_WEIGHTS.items():
        if exchange != 'others':
            st.sidebar.slider(
                f"{exchange.title()}",
                min_value=0.0,
                max_value=1.0,
                value=default_weight,
                step=0.05,
                key=f'weight_{exchange}'
            )
    
    # Auto refresh
    st.sidebar.subheader("Auto Refresh")
    auto_refresh = st.sidebar.checkbox(
        "Auto refresh",
        value=True,
        key='auto_refresh'
    )
    
    if auto_refresh:
        refresh_interval = st.sidebar.slider(
            "Refresh interval (seconds)",
            min_value=1,
            max_value=60,
            value=5,
            key='refresh_interval'
        )
    
    # Manual refresh button
    if st.sidebar.button("🔄 Refresh Now", type="primary"):
        st.rerun()
    
    # Alert settings
    st.sidebar.subheader("🔔 Alerts")
    alerts_enabled = st.sidebar.checkbox(
        "Enable alerts",
        value=False,
        key='alerts_enabled',
        help="Get notified when significant liquidation clusters are detected"
    )
    
    if alerts_enabled:
        alert_threshold = st.sidebar.slider(
            "Z-score threshold",
            min_value=1.0,
            max_value=5.0,
            value=2.0,
            step=0.5,
            key='alert_threshold_z_score',
            help="Trigger alert when Z-score exceeds this value"
        )
        
        alert_volume = st.sidebar.number_input(
            "Min volume ($)",
            min_value=10000,
            max_value=1000000,
            value=100000,
            step=10000,
            key='alert_volume_threshold',
            help="Minimum liquidation volume to trigger alert"
        )
    
    # Connection management
    st.sidebar.subheader("Connection")
    if st.sidebar.button("🔌 Restart WebSocket"):
        if st.session_state.binance_manager:
            asyncio.create_task(st.session_state.binance_manager.stop())
            st.session_state.binance_manager = None
        st.rerun()
    
    return selected_symbols, time_window

def render_liquidation_heatmap(symbol: str):
    """Render the main liquidation heatmap for a symbol"""
    try:
        clusters = st.session_state.current_data['heatmap_clusters'].get(symbol, [])
        market_data = st.session_state.current_data['market_data'].get(symbol, {})
        
        if not clusters:
            st.warning(f"No liquidation data available for {symbol}")
            return
        
        current_price = market_data.get('last_price') or market_data.get('price', 0)
        
        # Create heatmap visualization
        fig = st.session_state.heatmap_visualizer.create_liquidation_heatmap(
            clusters=clusters,
            current_price=current_price,
            symbol=symbol,
            price_range_percent=st.session_state.get('price_range', 15.0)
        )
        
        if fig:
            # Export buttons (only show if there are clusters)
            if clusters:
                col1, col2, col3 = st.columns([6, 1, 1])
                with col2:
                    csv_data = export_heatmap_data_csv(clusters, symbol)
                    st.download_button(
                        label="📥 CSV",
                        data=csv_data,
                        file_name=f"liquidation_heatmap_{symbol}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                        mime="text/csv",
                        key=f"csv_{symbol}",
                        use_container_width=False
                    )
                with col3:
                    json_data = export_heatmap_data_json(clusters, symbol)
                    st.download_button(
                        label="📥 JSON",
                        data=json_data,
                        file_name=f"liquidation_heatmap_{symbol}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                        mime="application/json",
                        key=f"json_{symbol}",
                        use_container_width=False
                    )
            
            st.plotly_chart(fig, width='stretch', key=f"heatmap_{symbol}")
        else:
            st.error("Failed to create heatmap visualization")
            
    except Exception as e:
        logger.error(f"Error rendering heatmap for {symbol}: {e}")
        st.error(f"Error rendering heatmap: {e}")

def render_orderbook_chart(symbol: str):
    """Render orderbook depth chart"""
    try:
        orderbook_data = st.session_state.current_data['orderbooks'].get(symbol)
        
        if not orderbook_data:
            st.info(f"No orderbook data available for {symbol}")
            return
        
        fig = st.session_state.orderbook_visualizer.create_orderbook_chart(orderbook_data)
        
        if fig:
            st.plotly_chart(fig, width='stretch', key=f"orderbook_{symbol}")
        else:
            st.warning("Unable to create orderbook chart")
            
    except Exception as e:
        logger.error(f"Error rendering orderbook for {symbol}: {e}")
        st.error(f"Error rendering orderbook: {e}")

def render_leverage_analysis():
    """Render leverage tier analysis"""
    try:
        st.subheader("📊 Leverage Risk Analysis")
        
        # Get leverage data from current liquidations
        all_liquidations = []
        for symbol_liquidations in st.session_state.current_data['liquidations'].values():
            all_liquidations.extend(symbol_liquidations)
        
        if not all_liquidations:
            st.info("No liquidation data available for analysis")
            return
        
        # Calculate leverage distribution
        leverage_data = []
        for liq in all_liquidations[-1000:]:  # Last 1000 liquidations
            estimated_leverage = liq.get('estimated_leverage', 10)
            leverage_data.append(estimated_leverage)
        
        if leverage_data:
            # Create leverage histogram
            fig = px.histogram(
                x=leverage_data,
                nbins=20,
                title="Liquidation Leverage Distribution",
                labels={'x': 'Estimated Leverage', 'y': 'Count'},
                color_discrete_sequence=['#ff6b6b']
            )
            fig.update_layout(
                template='plotly_dark',
                height=400
            )
            st.plotly_chart(fig, width='stretch')
            
            # Leverage tier breakdown
            tier_counts = {tier: 0 for tier in LEVERAGE_TIERS.keys()}
            
            for leverage in leverage_data:
                for tier_name, tier_info in LEVERAGE_TIERS.items():
                    min_lev, max_lev = tier_info["range"]
                    if min_lev <= leverage < max_lev:
                        tier_counts[tier_name] += 1
                        break
            
            # Display tier metrics
            cols = st.columns(len(LEVERAGE_TIERS))
            for i, (tier_name, count) in enumerate(tier_counts.items()):
                tier_info = LEVERAGE_TIERS[tier_name]
                percentage = (count / len(leverage_data)) * 100 if leverage_data else 0
                
                with cols[i]:
                    st.metric(
                        f"{tier_name.replace('_', ' ').title()}",
                        f"{count}",
                        f"{percentage:.1f}%"
                    )
        
    except Exception as e:
        logger.error(f"Error rendering leverage analysis: {e}")
        st.error(f"Error rendering leverage analysis: {e}")

def render_market_metrics():
    """Render market overview metrics"""
    try:
        st.subheader("💹 Market Overview")
        
        selected_symbols = st.session_state.get('selected_symbols', TRADING_PAIRS[:5])
        
        if not selected_symbols:
            st.info("No symbols selected")
            return
        
        # Create metrics for each symbol
        metrics_data = []
        
        for symbol in selected_symbols:
            market_data = st.session_state.current_data['market_data'].get(symbol, {})
            liquidations = st.session_state.current_data['liquidations'].get(symbol, [])
            
            if market_data:
                # Calculate 24h liquidation volume
                cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
                recent_liquidations = [
                    liq for liq in liquidations 
                    if isinstance(liq.get('timestamp'), datetime) and liq.get('timestamp') >= cutoff_time
                ]
                
                liquidation_volume_24h = sum([
                    liq.get('price', 0) * liq.get('quantity', 0) 
                    for liq in recent_liquidations
                ])
                
                long_liquidations = sum([
                    liq.get('price', 0) * liq.get('quantity', 0)
                    for liq in recent_liquidations
                    if liq.get('side', '').upper() == 'SELL'  # Long liquidations
                ])
                
                short_liquidations = liquidation_volume_24h - long_liquidations
                
                metrics_data.append({
                    'Symbol': symbol,
                    'Price': market_data.get('last_price', 0),
                    'Change 24h %': market_data.get('price_change_24h', 0),
                    'Volume 24h': market_data.get('volume_24h', 0),
                    'Open Interest': market_data.get('open_interest_value', 0),
                    'Funding Rate': market_data.get('funding_rate', 0),
                    'Liquidations 24h': liquidation_volume_24h,
                    'Long Liq %': (long_liquidations / liquidation_volume_24h * 100) if liquidation_volume_24h > 0 else 0
                })
        
        if metrics_data:
            df = pd.DataFrame(metrics_data)
            
            # Format the dataframe for display
            formatted_df = df.copy()
            formatted_df['Price'] = formatted_df['Price'].apply(lambda x: f"${x:,.2f}")
            formatted_df['Change 24h %'] = formatted_df['Change 24h %'].apply(lambda x: f"{x:+.2f}%")
            formatted_df['Volume 24h'] = formatted_df['Volume 24h'].apply(lambda x: f"${x:,.0f}")
            formatted_df['Open Interest'] = formatted_df['Open Interest'].apply(lambda x: f"${x:,.0f}")
            formatted_df['Funding Rate'] = formatted_df['Funding Rate'].apply(lambda x: f"{x:.4f}%")
            formatted_df['Liquidations 24h'] = formatted_df['Liquidations 24h'].apply(lambda x: f"${x:,.0f}")
            formatted_df['Long Liq %'] = formatted_df['Long Liq %'].apply(lambda x: f"{x:.1f}%")
            
            st.dataframe(formatted_df, width='stretch')
        else:
            st.info("No market data available")
            
    except Exception as e:
        logger.error(f"Error rendering market metrics: {e}")
        st.error(f"Error rendering market metrics: {e}")

# Global event loop for async operations
_event_loop = None

def get_event_loop():
    """Get or create the global event loop"""
    global _event_loop
    if _event_loop is None or _event_loop.is_closed():
        _event_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_event_loop)
    return _event_loop

# Synchronous wrapper for async functions
def run_async(coroutine):
    """Run async coroutine in event loop"""
    try:
        loop = get_event_loop()
        return loop.run_until_complete(coroutine)
    except Exception as e:
        logger.error(f"Error running async function: {e}")
        return None

# Simplified sync main function for Streamlit
def main_sync():
    """Main application function (synchronous)"""
    try:
        # Render header and sidebar
        render_header()
        selected_symbols, time_window = render_sidebar()
        
        # Fetch exchange data periodically (sync version)
        current_time = datetime.now(timezone.utc)
        if not hasattr(st.session_state, 'last_api_fetch') or \
           (current_time - st.session_state.last_api_fetch).seconds >= 30:
            
            with st.spinner("Fetching exchange data..."):
                # Run async fetch in sync wrapper
                run_async(fetch_exchange_data())
                st.session_state.last_api_fetch = current_time
        
        # Update heatmap data
        update_heatmap_data()
        
        # Main content area
        if selected_symbols:
            # Create tabs for different views
            tab1, tab2, tab3, tab4 = st.tabs([
                "🔥 Liquidation Heatmaps", 
                "📚 Order Book", 
                "⚖️ Leverage Analysis", 
                "📊 Market Overview"
            ])
            
            with tab1:
                st.subheader("Liquidation Heatmaps")
                
                # Symbol selector for heatmaps
                if len(selected_symbols) > 1:
                    heatmap_symbol = st.selectbox(
                        "Select symbol for detailed heatmap:",
                        selected_symbols,
                        key='heatmap_symbol'
                    )
                else:
                    heatmap_symbol = selected_symbols[0]
                
                # Render main heatmap
                render_liquidation_heatmap(heatmap_symbol)
                
                # Show summary for all symbols
                st.subheader("All Symbols Summary")
                summary_cols = st.columns(min(len(selected_symbols), 3))
                
                for i, symbol in enumerate(selected_symbols[:6]):  # Limit to 6 for display
                    col_idx = i % 3
                    with summary_cols[col_idx]:
                        clusters = st.session_state.current_data['heatmap_clusters'].get(symbol, [])
                        total_volume = sum([cluster.total_volume for cluster in clusters])
                        high_risk_clusters = len([c for c in clusters if c.risk_level in ['high', 'extreme']])
                        
                        st.metric(
                            symbol,
                            f"${total_volume:,.0f}",
                            f"{high_risk_clusters} high risk zones"
                        )
            
            with tab2:
                st.subheader("Order Book Depth")
                
                # Symbol selector for orderbook
                if len(selected_symbols) > 1:
                    orderbook_symbol = st.selectbox(
                        "Select symbol for orderbook:",
                        selected_symbols,
                        key='orderbook_symbol'
                    )
                else:
                    orderbook_symbol = selected_symbols[0]
                
                render_orderbook_chart(orderbook_symbol)
            
            with tab3:
                render_leverage_analysis()
            
            with tab4:
                render_market_metrics()
        
        else:
            st.warning("Please select at least one trading pair from the sidebar.")
        
        # Auto refresh
        if st.session_state.get('auto_refresh', True):
            refresh_interval = st.session_state.get('refresh_interval', 5)
            time.sleep(refresh_interval)
            st.rerun()
            
    except Exception as e:
        logger.error(f"Error in main application: {e}")
        st.error(f"Application error: {e}")
        st.error("Please refresh the page or contact support if the problem persists.")

# Run the application
if __name__ == "__main__":
    try:
        main_sync()
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        st.error("Failed to start the application. Please check the logs and try again.")
    finally:
        # Ensure all database batches are flushed on exit
        cleanup_on_shutdown()

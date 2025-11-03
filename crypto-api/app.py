import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import asyncio
import numpy as np
from datetime import datetime, timedelta
import os
import sys
from pathlib import Path
import requests
import json

# Add the current directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Import our services and utilities
from config_guardians import (
    GUARDIANS_CONFIG, 
    get_guardians_symbols,
    is_guardians_enabled,
    validate_guardians_config,
    get_vip_features
)
from services.guardiansofthetoken_api import GuardiansOfTheTokenAPI, GuardiansDataProcessor
from utils.guardians_visualizer import GuardiansVisualizer

# Configure Streamlit page
st.set_page_config(
    page_title="🌟 GuardiansOfTheToken Premium Crypto Analytics",
    page_icon="🌟",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 1rem;
        border-radius: 10px;
        color: white;
        margin: 0.5rem 0;
    }
    .vip-badge {
        background: linear-gradient(45deg, #FFD700, #FFA500);
        color: #000;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-weight: bold;
        display: inline-block;
    }
    .status-online {
        color: #00FF00;
        font-weight: bold;
    }
    .status-offline {
        color: #FF6B6B;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# GPT Gateway API Configuration
GPT_GATEWAY_URL = "http://localhost:3000"

def fetch_gpt_symbols():
    """Fetch available symbols from GPT Gateway API"""
    try:
        response = requests.get(f"{GPT_GATEWAY_URL}/gpts/unified/symbols", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                return data['data']['symbols']
    except Exception as e:
        st.error(f"Failed to fetch GPT symbols: {e}")
    return []

def fetch_gpt_health():
    """Check GPT Gateway API health"""
    try:
        response = requests.get(f"{GPT_GATEWAY_URL}/gpts/health", timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        st.error(f"Failed to check GPT health: {e}")
    return None

def fetch_gpt_advanced_analysis(operation, symbols=None, timeframe="1h"):
    """Fetch advanced analysis from GPT Gateway API"""
    try:
        payload = {
            "op": operation,
            "timeframe": timeframe
        }
        if symbols:
            payload["symbols"] = symbols
        
        response = requests.post(
            f"{GPT_GATEWAY_URL}/gpts/unified/advanced",
            json=payload,
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        st.error(f"Failed to fetch advanced analysis: {e}")
    return None

def fetch_gpt_market_data(symbol):
    """Fetch market data for specific symbol from GPT Gateway API"""
    try:
        response = requests.get(f"{GPT_GATEWAY_URL}/gpts/unified/market/{symbol}", timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        st.error(f"Failed to fetch market data for {symbol}: {e}")
    return None

# Initialize session state
def init_session_state():
    """Initialize session state variables"""
    if 'guardians_api' not in st.session_state:
        if is_guardians_enabled():
            st.session_state.guardians_api = GuardiansOfTheTokenAPI(
                api_key=GUARDIANS_CONFIG['api']['api_key'],
                vip_tier=GUARDIANS_CONFIG['api']['vip_tier']
            )
        else:
            st.session_state.guardians_api = None
    
    if 'guardians_processor' not in st.session_state:
        st.session_state.guardians_processor = GuardiansDataProcessor()
    
    if 'guardians_visualizer' not in st.session_state:
        st.session_state.guardians_visualizer = GuardiansVisualizer()
    
    if 'last_update' not in st.session_state:
        st.session_state.last_update = None
    
    if 'current_symbol' not in st.session_state:
        st.session_state.current_symbol = 'SOL'
    
    if 'gpt_symbols' not in st.session_state:
        st.session_state.gpt_symbols = fetch_gpt_symbols()
    
    if 'gpt_health' not in st.session_state:
        st.session_state.gpt_health = fetch_gpt_health()

# Header
def render_header():
    """Render application header"""
    st.markdown('<div class="main-header">🌟 GuardiansOfTheToken Premium Analytics</div>', unsafe_allow_html=True)
    
    # Status bar
    col1, col2, col3, col4, col5 = st.columns([2, 1, 1, 1, 1])
    
    with col1:
        # GPT Gateway Status
        if st.session_state.get('gpt_health') and st.session_state.gpt_health.get('success'):
            st.markdown('<span class="status-online">● GPT Gateway Connected</span>', unsafe_allow_html=True)
        else:
            st.markdown('<span class="status-offline">● GPT Gateway Offline</span>', unsafe_allow_html=True)
        
        # Guardians Status
        if is_guardians_enabled():
            st.markdown(f'<span class="status-online">● Guardians API Connected</span>', unsafe_allow_html=True)
            vip_features = get_vip_features()
            st.markdown(f'<span class="vip-badge">VIP {GUARDIANS_CONFIG["api"]["vip_tier"]}</span>', unsafe_allow_html=True)
        else:
            st.markdown('<span class="status-offline">● Guardians API Disabled</span>', unsafe_allow_html=True)
    
    with col2:
        if st.session_state.last_update:
            st.write(f"📅 Last Update: {st.session_state.last_update.strftime('%H:%M:%S')}")
    
    with col3:
        if is_guardians_enabled():
            st.write(f"⚡ {get_vip_features()['update_frequency_ms']}ms Updates")
    
    with col4:
        gpt_symbols_count = len(st.session_state.get('gpt_symbols', []))
        guardians_symbols_count = len(get_guardians_symbols())
        st.write(f"📊 GPT: {gpt_symbols_count} | Guardians: {guardians_symbols_count}")
    
    with col5:
        if st.session_state.get('gpt_health') and st.session_state.gpt_health.get('success'):
            response_time = st.session_state.gpt_health.get('python_service', {}).get('response_time_ms', 0)
            st.write(f"🚀 GPT RT: {response_time}ms")

# Sidebar
def render_sidebar():
    """Render sidebar with controls"""
    st.sidebar.title("🎛️ Controls")
    
    # Symbol selection
    available_symbols = get_guardians_symbols()
    if available_symbols:
        selected_symbol = st.sidebar.selectbox(
            "📈 Select Symbol",
            available_symbols,
            index=available_symbols.index(st.session_state.current_symbol) if st.session_state.current_symbol in available_symbols else 0
        )
        st.session_state.current_symbol = selected_symbol
    else:
        st.sidebar.warning("No symbols available. Check configuration.")
    
    # Refresh button
    if st.sidebar.button("🔄 Refresh Data", type="primary"):
        refresh_data()
    
    # Auto-refresh
    auto_refresh = st.sidebar.checkbox("🔄 Auto Refresh", value=False)
    if auto_refresh:
        refresh_interval = st.sidebar.slider("Refresh Interval (seconds)", 5, 60, 10)
        st.session_state.refresh_interval = refresh_interval
    
    # VIP Features Info
    if is_guardians_enabled():
        st.sidebar.markdown("---")
        st.sidebar.subheader("🌟 VIP Features")
        vip_features = get_vip_features()
        
        st.sidebar.write(f"**Update Frequency:** {vip_features['update_frequency_ms']}ms")
        st.sidebar.write(f"**Max Depth:** {vip_features['max_depth_levels']} levels")
        st.sidebar.write(f"**Advanced Detection:** {'✅' if vip_features['advanced_detection'] else '❌'}")
        st.sidebar.write(f"**Institutional Data:** {'✅' if vip_features['institutional_data'] else '❌'}")
        
        # Alert settings
        st.sidebar.markdown("---")
        st.sidebar.subheader("🚨 Alert Settings")
        
        alerts_enabled = st.sidebar.checkbox("Enable Alerts", value=GUARDIANS_CONFIG['alerts']['enabled'])
        if alerts_enabled:
            st.sidebar.write(f"Buy Wall Alert: ${GUARDIANS_CONFIG['alerts']['buy_wall_threshold']:,}")
            st.sidebar.write(f"Sell Wall Alert: ${GUARDIANS_CONFIG['alerts']['sell_wall_threshold']:,}")
            st.sidebar.write(f"Imbalance Alert: {GUARDIANS_CONFIG['alerts']['imbalance_alert']}")
            st.sidebar.write(f"Liquidity Alert: {GUARDIANS_CONFIG['alerts']['liquidity_alert']}")

# Main data fetching function
async def fetch_guardians_data(symbol):
    """Fetch data from GuardiansOfTheToken API"""
    if not st.session_state.guardians_api:
        return None, None
    
    try:
        async with st.session_state.guardians_api:
            # Fetch orderbook and metrics concurrently
            orderbook_task = st.session_state.guardians_api.get_premium_orderbook(symbol, depth=100)
            metrics_task = st.session_state.guardians_api.get_market_metrics(symbol)
            
            orderbook, metrics = await asyncio.gather(orderbook_task, metrics_task, return_exceptions=True)
            
            if isinstance(orderbook, Exception):
                st.error(f"Orderbook error: {orderbook}")
                orderbook = None
            
            if isinstance(metrics, Exception):
                st.error(f"Metrics error: {metrics}")
                metrics = None
            
            return orderbook, metrics
    
    except Exception as e:
        st.error(f"Failed to fetch data: {e}")
        return None, None

def refresh_data():
    """Refresh data for current symbol"""
    if not is_guardians_enabled():
        st.warning("GuardiansOfTheToken integration is disabled. Please check your configuration.")
        return
    
    with st.spinner(f"Fetching premium data for {st.session_state.current_symbol}..."):
        # Run async operation
        orderbook, metrics = asyncio.run(fetch_guardians_data(st.session_state.current_symbol))
        
        if orderbook and metrics:
            # Add to processor
            st.session_state.guardians_processor.add_orderbook_data(orderbook)
            st.session_state.guardians_processor.add_metrics_data(metrics)
            
            # Update timestamp
            st.session_state.last_update = datetime.now()
            
            # Store in session state for display
            st.session_state.current_orderbook = orderbook
            st.session_state.current_metrics = metrics
            
            st.success("✅ Data refreshed successfully!")
        else:
            st.error("❌ Failed to fetch data")

def render_orderbook_section(orderbook, metrics):
    """Render orderbook section with charts"""
    st.subheader("📚 Premium Orderbook Analysis")
    
    if not orderbook:
        st.warning("No orderbook data available")
        return
    
    # Create tabs for different views
    tab1, tab2, tab3 = st.tabs(["📊 Orderbook Chart", "📈 Depth Analysis", "🔍 Raw Data"])
    
    with tab1:
        # Premium orderbook chart
        chart = st.session_state.guardians_visualizer.create_premium_orderbook_chart(
            orderbook, 
            metrics,
            depth_levels=30
        )
        
        if chart:
            st.plotly_chart(chart, use_container_width=True)
        else:
            st.error("Failed to create orderbook chart")
    
    with tab2:
        # Depth analysis
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("📈 Bid Depth")
            if orderbook.bid_levels:
                bid_prices = [level.price for level in orderbook.bid_levels[:20]]
                bid_volumes = [level.quantity for level in orderbook.bid_levels[:20]]
                
                fig = go.Figure()
                fig.add_trace(go.Bar(
                    x=bid_volumes,
                    y=bid_prices,
                    orientation='h',
                    name='Bid Volume',
                    marker_color='green'
                ))
                fig.update_layout(
                    title="Bid Depth (Top 20 Levels)",
                    xaxis_title="Volume",
                    yaxis_title="Price",
                    height=400
                )
                st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            st.subheader("📉 Ask Depth")
            if orderbook.ask_levels:
                ask_prices = [level.price for level in orderbook.ask_levels[:20]]
                ask_volumes = [level.quantity for level in orderbook.ask_levels[:20]]
                
                fig = go.Figure()
                fig.add_trace(go.Bar(
                    x=ask_volumes,
                    y=ask_prices,
                    orientation='h',
                    name='Ask Volume',
                    marker_color='red'
                ))
                fig.update_layout(
                    title="Ask Depth (Top 20 Levels)",
                    xaxis_title="Volume",
                    yaxis_title="Price",
                    height=400
                )
                st.plotly_chart(fig, use_container_width=True)
    
    with tab3:
        # Raw data table
        st.subheader("📋 Raw Orderbook Data")
        
        # Create DataFrame for display
        bid_data = []
        for i, level in enumerate(orderbook.bid_levels[:10]):
            bid_data.append({
                'Level': i + 1,
                'Bid Price': f"${level.price:.4f}",
                'Bid Volume': f"{level.quantity:.4f}",
                'Bid Total': f"${level.price * level.quantity:,.2f}"
            })
        
        ask_data = []
        for i, level in enumerate(orderbook.ask_levels[:10]):
            ask_data.append({
                'Level': i + 1,
                'Ask Price': f"${level.price:.4f}",
                'Ask Volume': f"{level.quantity:.4f}",
                'Ask Total': f"${level.price * level.quantity:,.2f}"
            })
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.write("**Bids**")
            if bid_data:
                st.dataframe(pd.DataFrame(bid_data), use_container_width=True)
        
        with col2:
            st.write("**Asks**")
            if ask_data:
                st.dataframe(pd.DataFrame(ask_data), use_container_width=True)

def render_institutional_section(metrics, orderbook):
    """Render institutional analysis section"""
    st.subheader("🏢 Institutional Analysis")
    
    if not metrics:
        st.warning("No institutional data available")
        return
    
    # Create institutional analysis chart
    chart = st.session_state.guardians_visualizer.create_institutional_analysis_chart(
        metrics,
        orderbook
    )
    
    if chart:
        st.plotly_chart(chart, use_container_width=True)
    
    # Institutional metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "Buy Wall",
            "Detected" if metrics.buy_wall_detected else "Not Detected",
            delta="🧱" if metrics.buy_wall_detected else None
        )
    
    with col2:
        st.metric(
            "Sell Wall",
            "Detected" if metrics.sell_wall_detected else "Not Detected",
            delta="🧱" if metrics.sell_wall_detected else None
        )
    
    with col3:
        st.metric(
            "Hidden Orders",
            "Detected" if metrics.hidden_orders_detected else "Not Detected",
            delta="👻" if metrics.hidden_orders_detected else None
        )
    
    with col4:
        st.metric(
            "Spoofing Zones",
            len(metrics.spoofing_zones),
            delta="🎭" if metrics.spoofing_zones else None
        )
    
    # Detailed analysis
    if metrics.spoofing_zones:
        st.subheader("🎭 Spoofing Detection")
        for i, zone in enumerate(metrics.spoofing_zones[:3]):  # Show top 3
            with st.expander(f"Spoofing Zone {i+1}"):
                st.write(f"**Price Range:** ${zone.price_start:.4f} - ${zone.price_end:.4f}")
                st.write(f"**Confidence:** {zone.confidence_score:.1%}")
                st.write(f"**Volume:** ${zone.volume_estimate:,.0f}")
                st.write(f"**Detection Time:** {zone.detection_time.strftime('%H:%M:%S')}")
    
    if metrics.iceberg_orders:
        st.subheader("🧊 Iceberg Orders")
        for i, iceberg in enumerate(metrics.iceberg_orders[:3]):  # Show top 3
            with st.expander(f"Iceberg Order {i+1}"):
                st.write(f"**Estimated Size:** ${iceberg.estimated_total_value:,.0f}")
                st.write(f"**Visible Portion:** ${iceberg.visible_value:,.0f}")
                st.write(f"**Hidden Ratio:** {iceberg.hidden_ratio:.1%}")
                st.write(f"**Confidence:** {iceberg.confidence_score:.1%}")

def render_vip_dashboard(orderbook, metrics):
    """Render VIP features dashboard"""
    st.subheader("🌟 VIP Features Dashboard")
    
    if not orderbook or not metrics:
        st.warning("No data available for VIP dashboard")
        return
    
    # Create VIP dashboard
    dashboard = st.session_state.guardians_visualizer.create_vip_features_dashboard(
        orderbook,
        metrics
    )
    
    if dashboard:
        st.plotly_chart(dashboard, use_container_width=True)
    
    # VIP metrics grid
    col1, col2, col3, col4, col5 = st.columns(5)
    
    with col1:
        st.metric("Update Frequency", f"{orderbook.update_frequency_ms}ms")
    
    with col2:
        st.metric("VIP Tier", orderbook.vip_tier)
    
    with col3:
        st.metric("Liquidity Score", f"{metrics.liquidity_score:.1f}/100")
    
    with col4:
        st.metric("Depth Score", f"{metrics.market_depth_score:.1f}/100")
    
    with col5:
        st.metric("Risk Level", f"{metrics.risk_level}")
    
    # Advanced features
    st.subheader("🚀 Advanced Features")
    
    feature_col1, feature_col2 = st.columns(2)
    
    with feature_col1:
        st.write("**Pattern Detection**")
        patterns_detected = []
        if metrics.buy_wall_detected:
            patterns_detected.append("🧱 Buy Wall")
        if metrics.sell_wall_detected:
            patterns_detected.append("🧱 Sell Wall")
        if metrics.hidden_orders_detected:
            patterns_detected.append("👻 Hidden Orders")
        
        if patterns_detected:
            for pattern in patterns_detected:
                st.success(pattern)
        else:
            st.info("No significant patterns detected")
    
    with feature_col2:
        st.write("**Market Quality**")
        quality_score = (metrics.liquidity_score + metrics.market_depth_score) / 2
        
        if quality_score >= 80:
            st.success(f"🏆 Excellent ({quality_score:.1f}/100)")
        elif quality_score >= 60:
            st.info(f"✅ Good ({quality_score:.1f}/100)")
        else:
            st.warning(f"⚠️ Poor ({quality_score:.1f}/100)")

def render_market_overview():
    """Render market overview with multiple symbols"""
    st.subheader("📊 Market Overview")
    
    if not is_guardians_enabled():
        st.warning("GuardiansOfTheToken integration is disabled")
        return
    
    # Get top symbols
    symbols = get_guardians_symbols()[:5]  # Top 5 symbols
    
    if not symbols:
        st.warning("No symbols available")
        return
    
    # Fetch data for multiple symbols
    with st.spinner("Fetching market overview..."):
        market_data = {}
        
        for symbol in symbols:
            try:
                orderbook, metrics = asyncio.run(fetch_guardians_data(symbol))
                if orderbook and metrics:
                    market_data[symbol] = {
                        'orderbook': orderbook,
                        'metrics': metrics
                    }
            except Exception as e:
                st.error(f"Failed to fetch data for {symbol}: {e}")
    
    if market_data:
        # Create overview table
        overview_data = []
        for symbol, data in market_data.items():
            overview_data.append({
                'Symbol': symbol,
                'Mid Price': f"${data['orderbook'].mid_price:.4f}",
                'Spread': f"${data['orderbook'].spread:.4f}",
                'Imbalance': f"{data['orderbook'].imbalance_ratio:.2f}",
                'Liquidity': f"{data['metrics'].liquidity_score:.1f}",
                'Depth': f"{data['metrics'].market_depth_score:.1f}",
                'Buy Wall': "🧱" if data['metrics'].buy_wall_detected else "❌",
                'Sell Wall': "🧱" if data['metrics'].sell_wall_detected else "❌"
            })
        
        df = pd.DataFrame(overview_data)
        st.dataframe(df, use_container_width=True)
        
        # Create comparison charts
        if len(market_data) > 1:
            fig = make_subplots(
                rows=2, cols=2,
                subplot_titles=("Liquidity Scores", "Market Depth", "Price Spreads", "Imbalance Ratios"),
                specs=[[{"secondary_y": False}, {"secondary_y": False}],
                       [{"secondary_y": False}, {"secondary_y": False}]]
            )
            
            symbols_list = list(market_data.keys())
            liquidity_scores = [data['metrics'].liquidity_score for data in market_data.values()]
            depth_scores = [data['metrics'].market_depth_score for data in market_data.values()]
            spreads = [data['orderbook'].spread for data in market_data.values()]
            imbalances = [data['orderbook'].imbalance_ratio for data in market_data.values()]
            
            # Liquidity scores
            fig.add_trace(
                go.Bar(x=symbols_list, y=liquidity_scores, name="Liquidity", marker_color='blue'),
                row=1, col=1
            )
            
            # Market depth
            fig.add_trace(
                go.Bar(x=symbols_list, y=depth_scores, name="Depth", marker_color='green'),
                row=1, col=2
            )
            
            # Spreads
            fig.add_trace(
                go.Bar(x=symbols_list, y=spreads, name="Spread", marker_color='red'),
                row=2, col=1
            )
            
            # Imbalance ratios
            fig.add_trace(
                go.Bar(x=symbols_list, y=imbalances, name="Imbalance", marker_color='orange'),
                row=2, col=2
            )
            
            fig.update_layout(
                title="Market Comparison",
                height=600,
                showlegend=False
            )
            
            st.plotly_chart(fig, use_container_width=True)

def render_gpt_gateway_section():
    """Render GPT Gateway integration section"""
    st.subheader("🤖 GPT Gateway Advanced Intelligence")
    
    # Check GPT Gateway status
    if not st.session_state.get('gpt_health') or not st.session_state.gpt_health.get('success'):
        st.error("🚫 GPT Gateway is not connected")
        st.info("Please ensure the GPT Gateway service is running on port 3000")
        return
    
    # GPT Gateway Status
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric(
            "GPT Gateway Status",
            "Connected" if st.session_state.gpt_health.get('success') else "Offline",
            delta="🟢" if st.session_state.gpt_health.get('success') else "🔴"
        )
    
    with col2:
        python_service = st.session_state.gpt_health.get('python_service', {})
        st.metric(
            "Python Service",
            python_service.get('status', 'Unknown'),
            delta=f"{python_service.get('response_time_ms', 0)}ms"
        )
    
    with col3:
        node_service = st.session_state.gpt_health.get('node_service', {})
        st.metric(
            "Node Service",
            node_service.get('status', 'Unknown'),
            delta=f"{node_service.get('response_time_ms', 0)}ms"
        )
    
    with col4:
        symbols_count = len(st.session_state.get('gpt_symbols', []))
        st.metric("Available Symbols", symbols_count)
    
    # Advanced Operations Section
    st.markdown("---")
    st.subheader("🚀 Advanced Intelligence Operations")
    
    # Operation selection
    col1, col2, col3 = st.columns(3)
    
    with col1:
        selected_operation = st.selectbox(
            "Select Operation",
            [
                "whale_alerts",
                "market_sentiment", 
                "volume_spikes",
                "multi_coin_screening",
                "new_listings",
                "opportunities",
                "alpha_screening",
                "micro_caps"
            ],
            help="Choose the advanced analysis operation to perform"
        )
    
    with col2:
        # Symbol selection for multi-symbol operations
        if selected_operation in ['multi_coin_screening', 'alpha_screening']:
            available_symbols = st.session_state.get('gpt_symbols', [])
            if available_symbols:
                selected_symbols = st.multiselect(
                    "Select Symbols",
                    available_symbols,
                    default=['SOL', 'BTC', 'ETH'][:3],
                    max_selections=10
                )
            else:
                selected_symbols = ['SOL', 'BTC', 'ETH']
        else:
            selected_symbols = [st.session_state.current_symbol]
    
    with col3:
        timeframe = st.selectbox(
            "Timeframe",
            ["1m", "5m", "15m", "30m", "1h", "4h", "1d"],
            index=4,
            help="Select analysis timeframe"
        )
    
    # Execute operation button
    if st.button(f"🔍 Execute {selected_operation.replace('_', ' ').title()}", type="primary"):
        with st.spinner(f"Executing {selected_operation}..."):
            result = fetch_gpt_advanced_analysis(
                operation=selected_operation,
                symbols=selected_symbols,
                timeframe=timeframe
            )
            
            if result:
                st.session_state[f'gpt_result_{selected_operation}'] = result
                st.success(f"✅ {selected_operation} completed successfully!")
            else:
                st.error(f"❌ Failed to execute {selected_operation}")
    
    # Display results
    result_key = f'gpt_result_{selected_operation}'
    if result_key in st.session_state:
        result = st.session_state[result_key]
        
        st.markdown("---")
        st.subheader(f"📊 {selected_operation.replace('_', ' ').title()} Results")
        
        # Results tabs
        tab1, tab2, tab3 = st.tabs(["📋 Summary", "📈 Visualization", "🔍 Raw Data"])
        
        with tab1:
            render_gpt_result_summary(result, selected_operation)
        
        with tab2:
            render_gpt_result_visualization(result, selected_operation)
        
        with tab3:
            render_gpt_result_raw_data(result, selected_operation)
    
    # Market Data Section
    st.markdown("---")
    st.subheader("📈 Individual Market Analysis")
    
    col1, col2 = st.columns(2)
    
    with col1:
        market_symbol = st.selectbox(
            "Select Symbol for Market Analysis",
            st.session_state.get('gpt_symbols', []),
            index=st.session_state.get('gpt_symbols', []).index(st.session_state.current_symbol) if st.session_state.current_symbol in st.session_state.get('gpt_symbols', []) else 0
        )
    
    with col2:
        if st.button("📊 Fetch Market Data"):
            with st.spinner(f"Fetching market data for {market_symbol}..."):
                market_data = fetch_gpt_market_data(market_symbol)
                if market_data:
                    st.session_state[f'gpt_market_{market_symbol}'] = market_data
                    st.success(f"✅ Market data for {market_symbol} loaded!")
                else:
                    st.error(f"❌ Failed to fetch market data for {market_symbol}")
    
    # Display market data
    market_key = f'gpt_market_{market_symbol}'
    if market_key in st.session_state:
        market_data = st.session_state[market_key]
        
        st.markdown("---")
        st.subheader(f"📊 {market_symbol} Market Analysis")
        
        # Market data tabs
        tab1, tab2, tab3 = st.tabs(["📋 Overview", "📈 Charts", "🔍 Details"])
        
        with tab1:
            render_market_overview_tab(market_data, market_symbol)
        
        with tab2:
            render_market_charts_tab(market_data, market_symbol)
        
        with tab3:
            render_market_details_tab(market_data, market_symbol)

def render_gpt_result_summary(result, operation):
    """Render summary of GPT operation results"""
    if not result:
        st.warning("No results available")
        return
    
    # Operation-specific summary rendering
    if operation == "whale_alerts":
        if result.get('data', {}).get('items'):
            st.write(f"🐋 **{len(result['data']['items'])} Whale Alerts Detected**")
            for i, alert in enumerate(result['data']['items'][:5]):  # Show top 5
                with st.expander(f"Alert {i+1}"):
                    st.json(alert)
        else:
            st.info("No whale alerts detected in the specified timeframe")
    
    elif operation == "market_sentiment":
        st.write("📊 **Market Sentiment Analysis**")
        if result.get('data'):
            sentiment_data = result['data']
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("Overall Sentiment", sentiment_data.get('overall', 'Neutral'))
            
            with col2:
                st.metric("Confidence", f"{sentiment_data.get('confidence', 0):.1%}")
            
            with col3:
                st.metric("Data Points", sentiment_data.get('data_points', 0))
    
    elif operation == "volume_spikes":
        st.write("📈 **Volume Spike Analysis**")
        if result.get('data', {}).get('spikes'):
            spikes = result['data']['spikes']
            st.write(f"🚀 **{len(spikes)} Volume Spikes Detected**")
            
            for spike in spikes[:3]:  # Show top 3
                st.write(f"• {spike.get('symbol', 'Unknown')}: {spike.get('volume_change', 0):.1f}% increase")
        else:
            st.info("No significant volume spikes detected")
    
    else:
        # Generic result display
        st.write(f"📊 **{operation.replace('_', ' ').title()} Results**")
        if result.get('data'):
            st.json(result['data'])
        else:
            st.info("No data available for this operation")

def render_gpt_result_visualization(result, operation):
    """Render visualization of GPT operation results"""
    if not result or not result.get('data'):
        st.warning("No data available for visualization")
        return
    
    data = result['data']
    
    if operation == "whale_alerts" and data.get('items'):
        # Whale alerts visualization
        alerts = data['items']
        if alerts:
            df = pd.DataFrame(alerts)
            
            if 'symbol' in df.columns and 'amount' in df.columns:
                fig = px.bar(
                    df.head(10),
                    x='symbol',
                    y='amount',
                    title="Top 10 Whale Alerts by Amount",
                    labels={'amount': 'Transaction Amount', 'symbol': 'Symbol'}
                )
                st.plotly_chart(fig, use_container_width=True)
    
    elif operation == "market_sentiment":
        # Sentiment visualization
        if isinstance(data, dict):
            sentiment_score = data.get('sentiment_score', 0.5)
            
            fig = go.Figure(go.Indicator(
                mode = "gauge+number+delta",
                value = sentiment_score * 100,
                domain = {'x': [0, 1], 'y': [0, 1]},
                title = {'text': "Market Sentiment Score"},
                delta = {'reference': 50},
                gauge = {
                    'axis': {'range': [None, 100]},
                    'bar': {'color': "darkblue"},
                    'steps': [
                        {'range': [0, 33], 'color': "lightgray"},
                        {'range': [33, 66], 'color': "gray"},
                        {'range': [66, 100], 'color': "lightgreen"}
                    ],
                    'threshold': {
                        'line': {'color': "red", 'width': 4},
                        'thickness': 0.75,
                        'value': 90
                    }
                }
            ))
            
            fig.update_layout(height=400)
            st.plotly_chart(fig, use_container_width=True)
    
    elif operation == "volume_spikes" and data.get('spikes'):
        # Volume spikes visualization
        spikes = data['spikes']
        if spikes:
            df = pd.DataFrame(spikes)
            
            if 'symbol' in df.columns and 'volume_change' in df.columns:
                fig = px.bar(
                    df.head(10),
                    x='symbol',
                    y='volume_change',
                    title="Top 10 Volume Spikes",
                    labels={'volume_change': 'Volume Change (%)', 'symbol': 'Symbol'},
                    color='volume_change',
                    color_continuous_scale='RdYlGn_r'
                )
                st.plotly_chart(fig, use_container_width=True)
    
    else:
        # Generic visualization
        st.info("Visualization not available for this operation type")

def render_gpt_result_raw_data(result, operation):
    """Render raw data from GPT operation results"""
    if not result:
        st.warning("No results available")
        return
    
    st.write("**Raw Response Data:**")
    st.json(result)
    
    # Additional metadata
    if result.get('timestamp'):
        st.write(f"**Timestamp:** {result['timestamp']}")
    
    if result.get('source'):
        st.write(f"**Data Source:** {result['source']}")

def render_market_overview_tab(market_data, symbol):
    """Render market overview tab"""
    if not market_data or not market_data.get('success'):
        st.warning("No market data available")
        return
    
    data = market_data.get('data', {})
    
    # Key metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Symbol", symbol)
    
    with col2:
        price = data.get('price', 0)
        st.metric("Price", f"${price:.4f}")
    
    with col3:
        volume_24h = data.get('volume_24h', 0)
        st.metric("24h Volume", f"${volume_24h:,.0f}")
    
    with col4:
        change_24h = data.get('change_24h', 0)
        st.metric("24h Change", f"{change_24h:.2f}%", delta=f"{change_24h:.2f}%")
    
    # Market statistics
    st.subheader("📊 Market Statistics")
    
    stats = data.get('statistics', {})
    if stats:
        stats_df = pd.DataFrame(list(stats.items()), columns=['Metric', 'Value'])
        st.dataframe(stats_df, use_container_width=True)

def render_market_charts_tab(market_data, symbol):
    """Render market charts tab"""
    if not market_data or not market_data.get('success'):
        st.warning("No market data available for charts")
        return
    
    data = market_data.get('data', {})
    
    # Price chart (if historical data available)
    if 'price_history' in data:
        price_data = data['price_history']
        df = pd.DataFrame(price_data)
        
        if 'timestamp' in df.columns and 'price' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=df['timestamp'],
                y=df['price'],
                mode='lines',
                name=f'{symbol} Price',
                line=dict(color='blue')
            ))
            
            fig.update_layout(
                title=f'{symbol} Price Chart',
                xaxis_title='Time',
                yaxis_title='Price (USD)',
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)
    
    # Volume chart
    if 'volume_history' in data:
        volume_data = data['volume_history']
        df = pd.DataFrame(volume_data)
        
        if 'timestamp' in df.columns and 'volume' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            
            fig = go.Figure()
            fig.add_trace(go.Bar(
                x=df['timestamp'],
                y=df['volume'],
                name=f'{symbol} Volume',
                marker_color='orange'
            ))
            
            fig.update_layout(
                title=f'{symbol} Volume Chart',
                xaxis_title='Time',
                yaxis_title='Volume',
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)

def render_market_details_tab(market_data, symbol):
    """Render market details tab"""
    if not market_data or not market_data.get('success'):
        st.warning("No market data available")
        return
    
    data = market_data.get('data', {})
    
    # Detailed information
    st.subheader("📋 Detailed Market Information")
    
    # Order book info
    if 'orderbook' in data:
        st.write("**Order Book Information:**")
        orderbook = data['orderbook']
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.write("**Bids:**")
            if 'bids' in orderbook:
                bids_df = pd.DataFrame(orderbook['bids'][:5], columns=['Price', 'Amount'])
                st.dataframe(bids_df, use_container_width=True)
        
        with col2:
            st.write("**Asks:**")
            if 'asks' in orderbook:
                asks_df = pd.DataFrame(orderbook['asks'][:5], columns=['Price', 'Amount'])
                st.dataframe(asks_df, use_container_width=True)
    
    # Technical indicators
    if 'technical_indicators' in data:
        st.write("**Technical Indicators:**")
        indicators = data['technical_indicators']
        
        for indicator, value in indicators.items():
            st.write(f"• **{indicator}:** {value}")
    
    # Additional metadata
    st.write("**Metadata:**")
    metadata = {
        'Symbol': symbol,
        'Timestamp': market_data.get('timestamp', 'Unknown'),
        'Source': market_data.get('source', 'Unknown'),
        'Data Points': len(data) if isinstance(data, dict) else 0
    }
    
    metadata_df = pd.DataFrame(list(metadata.items()), columns=['Property', 'Value'])
    st.dataframe(metadata_df, use_container_width=True)

def main():
    """Main application function"""
    # Initialize session state
    init_session_state()
    
    # Render header
    render_header()
    
    # Render sidebar
    render_sidebar()
    
    # Check if Guardians is enabled
    if not is_guardians_enabled():
        st.error("🚫 GuardiansOfTheToken integration is disabled")
        st.info("Please set GUARDIANS_ENABLED=true and provide a valid API key in your configuration.")
        
        # Show configuration validation
        validation = validate_guardians_config()
        if not validation['valid']:
            st.subheader("⚠️ Configuration Issues")
            for issue in validation['issues']:
                st.error(f"• {issue}")
        
        if validation['warnings']:
            st.subheader("⚠️ Configuration Warnings")
            for warning in validation['warnings']:
                st.warning(f"• {warning}")
        
        return
    
    # Main content area
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "📚 Orderbook Analysis",
        "🏢 Institutional Data", 
        "🌟 VIP Dashboard",
        "📊 Market Overview",
        "🤖 GPT Gateway"
    ])
    
    # Get current data
    current_orderbook = getattr(st.session_state, 'current_orderbook', None)
    current_metrics = getattr(st.session_state, 'current_metrics', None)
    
    with tab1:
        if current_orderbook and current_metrics:
            render_orderbook_section(current_orderbook, current_metrics)
        else:
            st.info("Click 'Refresh Data' to load orderbook analysis")
    
    with tab2:
        if current_metrics and current_orderbook:
            render_institutional_section(current_metrics, current_orderbook)
        else:
            st.info("Click 'Refresh Data' to load institutional analysis")
    
    with tab3:
        if current_orderbook and current_metrics:
            render_vip_dashboard(current_orderbook, current_metrics)
        else:
            st.info("Click 'Refresh Data' to load VIP dashboard")
    
    with tab4:
        render_market_overview()
    
    with tab5:
        render_gpt_gateway_section()
    
    # Auto-refresh logic
    if 'refresh_interval' in st.session_state and st.session_state.refresh_interval:
        st.rerun()

if __name__ == "__main__":
    main()

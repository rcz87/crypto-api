"""
Visualization utilities for GuardiansOfTheToken.com premium orderbook data
"""

import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
import logging

from services.guardiansofthetoken_api import GuardiansOrderbookData, GuardiansMarketMetrics
from config_guardians import (
    GUARDIANS_RISK_LEVELS, 
    INSTITUTIONAL_IMBALANCE_TYPES,
    ORDER_PATTERNS,
    GUARDIANS_CONFIG
)

logger = logging.getLogger(__name__)

class GuardiansVisualizer:
    """
    Advanced visualization for GuardiansOfTheToken premium data
    """
    
    def __init__(self):
        self.color_scheme = GUARDIANS_CONFIG['visualization']['color_scheme']
        self.show_institutional = GUARDIANS_CONFIG['visualization']['show_institutional_data']
        self.highlight_walls = GUARDIANS_CONFIG['visualization']['highlight_walls']
        self.show_hidden_orders = GUARDIANS_CONFIG['visualization']['show_hidden_orders']
    
    def create_premium_orderbook_chart(self, 
                                     orderbook_data: GuardiansOrderbookData,
                                     metrics: Optional[GuardiansMarketMetrics] = None,
                                     depth_levels: int = 20) -> go.Figure:
        """
        Create advanced orderbook depth chart with VIP 8 features
        
        Args:
            orderbook_data: Premium orderbook data
            metrics: Market metrics with institutional analysis
            depth_levels: Number of depth levels to display
        
        Returns:
            Plotly figure with advanced orderbook visualization
        """
        try:
            # Limit depth levels for visualization
            bid_levels = orderbook_data.bid_levels[:depth_levels]
            ask_levels = orderbook_data.ask_levels[:depth_levels]
            
            # Prepare data
            bid_prices = [level['price'] for level in bid_levels]
            bid_sizes = [level['size'] for level in bid_levels]
            bid_totals = [level['total'] for level in bid_levels]
            
            ask_prices = [level['price'] for level in ask_levels]
            ask_sizes = [level['size'] for level in ask_levels]
            ask_totals = [level['total'] for level in ask_levels]
            
            # Create subplots
            fig = make_subplots(
                rows=2, cols=1,
                shared_xaxes=True,
                vertical_spacing=0.05,
                subplot_titles=(
                    f"Orderbook Depth - {orderbook_data.symbol} (VIP {orderbook_data.vip_tier})",
                    "Cumulative Volume & Market Metrics"
                ),
                row_heights=[0.7, 0.3]
            )
            
            # Add bid side (green)
            fig.add_trace(
                go.Scatter(
                    x=bid_prices,
                    y=bid_sizes,
                    mode='markers',
                    name='Bid Size',
                    marker=dict(
                        color='rgba(0, 255, 0, 0.7)',
                        size=8,
                        line=dict(color='green', width=1)
                    ),
                    hovertemplate='<b>Bid</b><br>Price: $%{x:,.2f}<br>Size: %{y:,.2f}<extra></extra>'
                ),
                row=1, col=1
            )
            
            # Add ask side (red)
            fig.add_trace(
                go.Scatter(
                    x=ask_prices,
                    y=ask_sizes,
                    mode='markers',
                    name='Ask Size',
                    marker=dict(
                        color='rgba(255, 0, 0, 0.7)',
                        size=8,
                        line=dict(color='darkred', width=1)
                    ),
                    hovertemplate='<b>Ask</b><br>Price: $%{x:,.2f}<br>Size: %{y:,.2f}<extra></extra>'
                ),
                row=1, col=1
            )
            
            # Add cumulative volume bars
            cumulative_bid = np.cumsum(bid_totals)
            cumulative_ask = np.cumsum(ask_totals)
            
            fig.add_trace(
                go.Bar(
                    x=bid_prices,
                    y=cumulative_bid,
                    name='Cumulative Bid Volume',
                    marker=dict(color='rgba(0, 255, 0, 0.3)'),
                    hovertemplate='<b>Cumulative Bid</b><br>Price: $%{x:,.2f}<br>Volume: $%{y:,.0f}<extra></extra>'
                ),
                row=2, col=1
            )
            
            fig.add_trace(
                go.Bar(
                    x=ask_prices,
                    y=cumulative_ask,
                    name='Cumulative Ask Volume',
                    marker=dict(color='rgba(255, 0, 0, 0.3)'),
                    hovertemplate='<b>Cumulative Ask</b><br>Price: $%{x:,.2f}<br>Volume: $%{y:,.0f}<extra></extra>'
                ),
                row=2, col=1
            )
            
            # Highlight buy/sell walls if detected and enabled
            if self.highlight_walls and metrics:
                if metrics.buy_wall_detected:
                    self._add_wall_highlight(fig, bid_prices, bid_sizes, 'buy', orderbook_data.mid_price)
                
                if metrics.sell_wall_detected:
                    self._add_wall_highlight(fig, ask_prices, ask_sizes, 'sell', orderbook_data.mid_price)
            
            # Add institutional imbalance indicator
            if self.show_institutional and metrics:
                self._add_institutional_indicator(fig, metrics, orderbook_data.mid_price)
            
            # Update layout
            fig.update_layout(
                title=f"Premium Orderbook - {orderbook_data.symbol}<br>"
                      f"Update: {orderbook_data.update_frequency_ms}ms | "
                      f"Depth: {orderbook_data.max_depth_levels} levels | "
                      f"Imbalance: {orderbook_data.imbalance_ratio:.2f}",
                xaxis_title="Price (USD)",
                yaxis_title="Order Size",
                template="plotly_dark" if self.color_scheme == 'dark' else "plotly_white",
                height=800,
                showlegend=True,
                hovermode='x unified'
            )
            
            # Add spread information
            if orderbook_data.spread > 0:
                spread_pct = (orderbook_data.spread / orderbook_data.mid_price) * 100
                fig.add_annotation(
                    x=0.02, y=0.98,
                    xref='paper', yref='paper',
                    text=f"Spread: ${orderbook_data.spread:.4f} ({spread_pct:.3f}%)",
                    showarrow=False,
                    bgcolor='rgba(255, 255, 255, 0.8)',
                    font=dict(size=10)
                )
            
            return fig
            
        except Exception as e:
            logger.error(f"Error creating premium orderbook chart: {e}")
            return None
    
    def create_institutional_analysis_chart(self, 
                                          metrics: GuardiansMarketMetrics,
                                          orderbook_data: GuardiansOrderbookData) -> go.Figure:
        """
        Create institutional analysis visualization
        
        Args:
            metrics: Market metrics with institutional data
            orderbook_data: Orderbook data for context
        
        Returns:
            Plotly figure with institutional analysis
        """
        try:
            fig = make_subplots(
                rows=2, cols=2,
                subplot_titles=(
                    "Liquidity Score",
                    "Market Depth Score", 
                    "Institutional Imbalance",
                    "Pattern Detection"
                ),
                specs=[[{"type": "indicator"}, {"type": "indicator"}],
                       [{"type": "pie"}, {"type": "bar"}]]
            )
            
            # Liquidity Score Indicator
            fig.add_trace(
                go.Indicator(
                    mode="gauge+number+delta",
                    value=metrics.liquidity_score,
                    domain={'x': [0, 1], 'y': [0, 1]},
                    title={'text': "Liquidity Score"},
                    gauge={
                        'axis': {'range': [None, 100]},
                        'bar': {'color': "darkblue"},
                        'steps': [
                            {'range': [0, 30], 'color': "lightgray"},
                            {'range': [30, 70], 'color': "gray"},
                            {'range': [70, 100], 'color': "lightgreen"}
                        ],
                        'threshold': {
                            'line': {'color': "red", 'width': 4},
                            'thickness': 0.75,
                            'value': 90
                        }
                    }
                ),
                row=1, col=1
            )
            
            # Market Depth Score Indicator
            fig.add_trace(
                go.Indicator(
                    mode="gauge+number+delta",
                    value=metrics.market_depth_score,
                    domain={'x': [0, 1], 'y': [0, 1]},
                    title={'text': "Market Depth Score"},
                    gauge={
                        'axis': {'range': [None, 100]},
                        'bar': {'color': "darkgreen"},
                        'steps': [
                            {'range': [0, 30], 'color': "lightgray"},
                            {'range': [30, 70], 'color': "gray"},
                            {'range': [70, 100], 'color': "lightblue"}
                        ]
                    }
                ),
                row=1, col=2
            )
            
            # Institutional Imbalance Pie Chart
            imbalance_data = self._calculate_imbalance_distribution(orderbook_data)
            fig.add_trace(
                go.Pie(
                    labels=['Bid Volume', 'Ask Volume'],
                    values=[imbalance_data['bid_volume'], imbalance_data['ask_volume']],
                    name="Volume Distribution",
                    marker_colors=['green', 'red']
                ),
                row=2, col=1
            )
            
            # Pattern Detection Bar Chart
            pattern_data = self._get_pattern_detection_data(metrics)
            fig.add_trace(
                go.Bar(
                    x=list(pattern_data.keys()),
                    y=list(pattern_data.values()),
                    name="Pattern Detection",
                    marker_color=['blue', 'orange', 'red', 'purple']
                ),
                row=2, col=2
            )
            
            # Update layout
            fig.update_layout(
                title=f"Institutional Analysis - {metrics.symbol}",
                height=600,
                showlegend=False,
                template="plotly_dark" if self.color_scheme == 'dark' else "plotly_white"
            )
            
            return fig
            
        except Exception as e:
            logger.error(f"Error creating institutional analysis chart: {e}")
            return None
    
    def create_orderbook_heatmap(self, 
                                orderbook_history: List[GuardiansOrderbookData],
                                symbol: str) -> go.Figure:
        """
        Create orderbook heatmap showing price/volume changes over time
        
        Args:
            orderbook_history: List of orderbook snapshots
            symbol: Trading symbol
        
        Returns:
            Plotly figure with orderbook heatmap
        """
        try:
            if len(orderbook_history) < 2:
                logger.warning("Insufficient data for heatmap creation")
                return None
            
            # Prepare data matrix
            timestamps = [data.timestamp for data in orderbook_history]
            
            # Get price range
            all_prices = []
            for data in orderbook_history:
                all_prices.extend([level['price'] for level in data.bid_levels[:20]])
                all_prices.extend([level['price'] for level in data.ask_levels[:20]])
            
            price_bins = np.linspace(min(all_prices), max(all_prices), 50)
            
            # Create heatmap data
            heatmap_data = []
            for data in orderbook_history:
                volume_profile = np.zeros(len(price_bins) - 1)
                
                # Add bid volumes
                for level in data.bid_levels[:20]:
                    price = level['price']
                    volume = level['size']
                    bin_idx = np.digitize(price, price_bins) - 1
                    if 0 <= bin_idx < len(volume_profile):
                        volume_profile[bin_idx] += volume
                
                # Subtract ask volumes
                for level in data.ask_levels[:20]:
                    price = level['price']
                    volume = level['size']
                    bin_idx = np.digitize(price, price_bins) - 1
                    if 0 <= bin_idx < len(volume_profile):
                        volume_profile[bin_idx] -= volume
                
                heatmap_data.append(volume_profile)
            
            # Create heatmap
            fig = go.Figure(data=go.Heatmap(
                z=heatmap_data,
                x=price_bins[:-1],
                y=timestamps,
                colorscale='RdYlGn',
                name='Volume Imbalance',
                hoverongaps=False
            ))
            
            fig.update_layout(
                title=f"Orderbook Heatmap - {symbol}",
                xaxis_title="Price (USD)",
                yaxis_title="Time",
                template="plotly_dark" if self.color_scheme == 'dark' else "plotly_white",
                height=600
            )
            
            return fig
            
        except Exception as e:
            logger.error(f"Error creating orderbook heatmap: {e}")
            return None
    
    def create_vip_features_dashboard(self, 
                                    orderbook_data: GuardiansOrderbookData,
                                    metrics: GuardiansMarketMetrics) -> go.Figure:
        """
        Create comprehensive VIP 8 features dashboard
        
        Args:
            orderbook_data: Premium orderbook data
            metrics: Market metrics with institutional analysis
        
        Returns:
            Plotly figure with VIP features dashboard
        """
        try:
            fig = make_subplots(
                rows=3, cols=3,
                subplot_titles=(
                    "Update Frequency",
                    "Depth Levels",
                    "Imbalance Ratio",
                    "Buy Wall Detection",
                    "Sell Wall Detection", 
                    "Hidden Orders",
                    "Spoofing Zones",
                    "Iceberg Orders",
                    "Liquidity Analysis"
                ),
                specs=[
                    [{"type": "indicator"}, {"type": "indicator"}, {"type": "indicator"}],
                    [{"type": "indicator"}, {"type": "indicator"}, {"type": "indicator"}],
                    [{"type": "bar"}, {"type": "bar"}, {"type": "scatter"}]
                ]
            )
            
            # Update Frequency
            fig.add_trace(
                go.Indicator(
                    mode="number+gauge",
                    value=orderbook_data.update_frequency_ms,
                    title={'text': "Update (ms)"},
                    gauge={'axis': {'range': [None, 100]}, 'bar': {'color': "blue"}}
                ),
                row=1, col=1
            )
            
            # Depth Levels
            fig.add_trace(
                go.Indicator(
                    mode="number+gauge", 
                    value=orderbook_data.max_depth_levels,
                    title={'text': "Max Depth"},
                    gauge={'axis': {'range': [None, 500]}, 'bar': {'color': "green"}}
                ),
                row=1, col=2
            )
            
            # Imbalance Ratio
            fig.add_trace(
                go.Indicator(
                    mode="number+gauge",
                    value=orderbook_data.imbalance_ratio,
                    title={'text': "Imbalance"},
                    gauge={'axis': {'range': [0, 3]}, 'bar': {'color': "orange"}}
                ),
                row=1, col=3
            )
            
            # Detection indicators
            fig.add_trace(
                go.Indicator(
                    mode="number",
                    value=1 if metrics.buy_wall_detected else 0,
                    title={'text': "Buy Wall"},
                    number={'font': {'color': 'green' if metrics.buy_wall_detected else 'red'}}
                ),
                row=2, col=1
            )
            
            fig.add_trace(
                go.Indicator(
                    mode="number",
                    value=1 if metrics.sell_wall_detected else 0,
                    title={'text': "Sell Wall"},
                    number={'font': {'color': 'red' if metrics.sell_wall_detected else 'gray'}}
                ),
                row=2, col=2
            )
            
            fig.add_trace(
                go.Indicator(
                    mode="number",
                    value=1 if metrics.hidden_orders_detected else 0,
                    title={'text': "Hidden Orders"},
                    number={'font': {'color': 'purple' if metrics.hidden_orders_detected else 'gray'}}
                ),
                row=2, col=3
            )
            
            # Pattern analysis bars
            spoofing_count = len(metrics.spoofing_zones)
            iceberg_count = len(metrics.iceberg_orders)
            
            fig.add_trace(
                go.Bar(
                    x=['Spoofing', 'Iceberg'],
                    y=[spoofing_count, iceberg_count],
                    name="Pattern Detection",
                    marker_color=['red', 'blue']
                ),
                row=3, col=1
            )
            
            # Liquidity scores
            fig.add_trace(
                go.Bar(
                    x=['Liquidity', 'Depth'],
                    y=[metrics.liquidity_score, metrics.market_depth_score],
                    name="Scores",
                    marker_color=['green', 'blue']
                ),
                row=3, col=2
            )
            
            # Institutional imbalance trend (placeholder)
            fig.add_trace(
                go.Scatter(
                    x=[1, 2, 3, 4, 5],
                    y=[1.0, 1.2, 0.8, 1.5, 1.1],
                    name="Imbalance Trend",
                    line=dict(color='purple')
                ),
                row=3, col=3
            )
            
            # Update layout
            fig.update_layout(
                title=f"VIP {orderbook_data.vip_tier} Features Dashboard - {orderbook_data.symbol}",
                height=900,
                showlegend=False,
                template="plotly_dark" if self.color_scheme == 'dark' else "plotly_white"
            )
            
            return fig
            
        except Exception as e:
            logger.error(f"Error creating VIP features dashboard: {e}")
            return None
    
    def _add_wall_highlight(self, fig: go.Figure, prices: List[float], sizes: List[float], 
                           wall_type: str, mid_price: float):
        """Add buy/sell wall highlights to the chart"""
        try:
            if len(prices) < 3:
                return
            
            # Find potential wall (largest concentration of volume)
            max_size_idx = np.argmax(sizes)
            wall_price = prices[max_size_idx]
            wall_size = sizes[max_size_idx]
            
            # Add vertical line and annotation
            color = 'green' if wall_type == 'buy' else 'red'
            alpha = 0.3
            
            fig.add_vline(
                x=wall_price,
                line_dash="dash",
                line_color=color,
                line_width=2,
                opacity=alpha,
                annotation_text=f"{wall_type.title()} Wall: ${wall_price:.2f}",
                annotation_position="top"
            )
            
        except Exception as e:
            logger.error(f"Error adding wall highlight: {e}")
    
    def _add_institutional_indicator(self, fig: go.Figure, metrics: GuardiansMarketMetrics, mid_price: float):
        """Add institutional imbalance indicator"""
        try:
            imbalance_type = metrics.institutional_imbalance
            if imbalance_type in INSTITUTIONAL_IMBALANCE_TYPES:
                config = INSTITUTIONAL_IMBALANCE_TYPES[imbalance_type]
                
                fig.add_annotation(
                    x=0.98, y=0.02,
                    xref='paper', yref='paper',
                    text=f"Institutional: {imbalance_type.title()}",
                    showarrow=False,
                    bgcolor=config['color'],
                    font=dict(color='white', size=10),
                    opacity=0.8
                )
                
        except Exception as e:
            logger.error(f"Error adding institutional indicator: {e}")
    
    def _calculate_imbalance_distribution(self, orderbook_data: GuardiansOrderbookData) -> Dict[str, float]:
        """Calculate bid/ask volume distribution"""
        return {
            'bid_volume': orderbook_data.total_bid_volume,
            'ask_volume': orderbook_data.total_ask_volume
        }
    
    def _get_pattern_detection_data(self, metrics: GuardiansMarketMetrics) -> Dict[str, int]:
        """Get pattern detection counts"""
        return {
            'Buy Wall': 1 if metrics.buy_wall_detected else 0,
            'Sell Wall': 1 if metrics.sell_wall_detected else 0,
            'Hidden Orders': 1 if metrics.hidden_orders_detected else 0,
            'Spoofing': len(metrics.spoofing_zones),
            'Iceberg': len(metrics.iceberg_orders)
        }

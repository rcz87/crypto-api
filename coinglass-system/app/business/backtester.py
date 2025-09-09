import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from sqlalchemy import text
from app.core.db import engine
from app.core.observability import structured_logger
from app.core.cache import cache

@dataclass
class BacktestResult:
    signal_type: str
    symbol: str
    total_signals: int
    profitable_signals: int
    total_pnl: float
    total_pnl_percentage: float
    win_rate: float
    avg_profit: float
    avg_loss: float
    max_drawdown: float
    sharpe_ratio: float
    avg_hold_time_minutes: float
    best_trade: Dict[str, Any]
    worst_trade: Dict[str, Any]

class SignalBacktester:
    """Backtest trading signals for performance validation"""
    
    def __init__(self):
        self.logger = structured_logger
        self.commission_rate = 0.001  # 0.1% commission
        self.slippage_rate = 0.0005   # 0.05% slippage
    
    async def backtest_signal_type(self, 
                                 signal_type: str, 
                                 symbol: str, 
                                 start_date: datetime,
                                 end_date: datetime,
                                 initial_capital: float = 10000) -> BacktestResult:
        """Backtest specific signal type"""
        try:
            # Get historical signals
            signals = await self._get_historical_signals(signal_type, symbol, start_date, end_date)
            
            if not signals:
                return self._empty_backtest_result(signal_type, symbol)
            
            # Get price data for the period
            price_data = await self._get_price_data(symbol, start_date, end_date)
            
            if price_data.empty:
                return self._empty_backtest_result(signal_type, symbol)
            
            # Execute backtest
            trades = []
            current_capital = initial_capital
            position = None
            max_capital = initial_capital
            
            for signal in signals:
                signal_time = signal['generated_at']
                signal_data = signal['signal_data']
                
                # Get price at signal time
                entry_price = self._get_price_at_time(price_data, signal_time)
                if not entry_price:
                    continue
                
                # Determine position direction
                direction = self._get_signal_direction(signal_type, signal_data)
                if not direction:
                    continue
                
                # Close existing position if any
                if position:
                    exit_trade = self._close_position(position, entry_price, signal_time)
                    trades.append(exit_trade)
                    current_capital += exit_trade['pnl']
                    max_capital = max(max_capital, current_capital)
                
                # Open new position
                position_size = current_capital * 0.1  # 10% of capital per trade
                position = {
                    'signal_id': signal['id'],
                    'entry_time': signal_time,
                    'entry_price': entry_price,
                    'direction': direction,
                    'size': position_size,
                    'signal_data': signal_data
                }
            
            # Close final position if exists
            if position:
                final_price = price_data.iloc[-1]['close']
                final_time = price_data.iloc[-1]['ts']
                exit_trade = self._close_position(position, final_price, final_time)
                trades.append(exit_trade)
                current_capital += exit_trade['pnl']
            
            # Calculate backtest metrics
            result = self._calculate_backtest_metrics(
                signal_type, symbol, trades, initial_capital, current_capital, max_capital
            )
            
            # Store backtest results
            await self._store_backtest_results(trades)
            
            # Cache results
            cache_key = f"backtest:{signal_type}:{symbol}:{start_date.strftime('%Y%m%d')}"
            cache.set(cache_key, result.__dict__, ttl=86400)
            
            self.logger.info(
                "Backtest completed",
                signal_type=signal_type,
                symbol=symbol,
                total_trades=len(trades),
                win_rate=result.win_rate,
                total_pnl=result.total_pnl
            )
            
            return result
            
        except Exception as e:
            self.logger.error(f"Backtest failed for {signal_type} {symbol}: {e}")
            return self._empty_backtest_result(signal_type, symbol)
    
    async def _get_historical_signals(self, 
                                    signal_type: str, 
                                    symbol: str, 
                                    start_date: datetime,
                                    end_date: datetime) -> List[Dict[str, Any]]:
        """Get historical signals from database"""
        query = text("""
            SELECT id, signal_type, symbol, generated_at, signal_data
            FROM signal_backtest
            WHERE signal_type = :signal_type
            AND symbol = :symbol
            AND generated_at >= :start_date
            AND generated_at <= :end_date
            ORDER BY generated_at
        """)
        
        with engine.begin() as conn:
            result = conn.execute(query, {
                'signal_type': signal_type,
                'symbol': symbol,
                'start_date': start_date,
                'end_date': end_date
            })
            return [dict(row) for row in result.mappings()]
    
    async def _get_price_data(self, 
                            symbol: str, 
                            start_date: datetime, 
                            end_date: datetime) -> pd.DataFrame:
        """Get historical price data"""
        query = text("""
            SELECT ts, open, high, low, close, volume
            FROM price_ohlc
            WHERE symbol = :symbol
            AND interval = '1m'
            AND ts >= :start_date
            AND ts <= :end_date
            ORDER BY ts
        """)
        
        with engine.begin() as conn:
            result = conn.execute(query, {
                'symbol': symbol,
                'start_date': start_date,
                'end_date': end_date
            })
            
            data = [dict(row) for row in result.mappings()]
            if not data:
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            df['ts'] = pd.to_datetime(df['ts'])
            return df.set_index('ts')
    
    def _get_price_at_time(self, price_data: pd.DataFrame, timestamp: datetime) -> Optional[float]:
        """Get price at specific timestamp"""
        if price_data.empty:
            return None
        
        # Find closest price data point
        try:
            idx = price_data.index.get_indexer([timestamp], method='nearest')[0]
            if idx >= 0:
                return float(price_data.iloc[idx]['close'])
        except:
            pass
        
        return None
    
    def _get_signal_direction(self, signal_type: str, signal_data: Dict[str, Any]) -> Optional[str]:
        """Determine trade direction from signal"""
        if signal_type == "liquidation_cascade":
            # Liquidation cascades typically indicate reversal opportunities
            side = signal_data.get('dominant_side', 'long')
            return 'short' if side == 'long' else 'long'
        
        elif signal_type == "funding_extreme":
            # Extreme funding rates suggest mean reversion
            rate = signal_data.get('funding_rate', 0)
            return 'short' if rate > 0.02 else 'long'
        
        elif signal_type == "oi_spike":
            # OI spikes might indicate trend continuation
            change = signal_data.get('oi_change', 0)
            return 'long' if change > 0 else 'short'
        
        return None
    
    def _close_position(self, position: Dict[str, Any], exit_price: float, exit_time: datetime) -> Dict[str, Any]:
        """Close position and calculate P&L"""
        entry_price = position['entry_price']
        direction = position['direction']
        size = position['size']
        
        # Apply slippage and commission
        effective_exit_price = exit_price * (1 - self.slippage_rate if direction == 'long' else 1 + self.slippage_rate)
        
        # Calculate P&L
        if direction == 'long':
            pnl_percentage = (effective_exit_price - entry_price) / entry_price
        else:  # short
            pnl_percentage = (entry_price - effective_exit_price) / entry_price
        
        pnl = size * pnl_percentage
        
        # Apply commission
        commission = size * self.commission_rate * 2  # Entry + exit
        pnl -= commission
        
        # Calculate hold time
        hold_time = (exit_time - position['entry_time']).total_seconds() / 60  # minutes
        
        return {
            'signal_id': position['signal_id'],
            'entry_time': position['entry_time'],
            'exit_time': exit_time,
            'entry_price': entry_price,
            'exit_price': effective_exit_price,
            'direction': direction,
            'size': size,
            'pnl': pnl,
            'pnl_percentage': pnl_percentage,
            'hold_time_minutes': hold_time,
            'commission': commission
        }
    
    def _calculate_backtest_metrics(self, 
                                  signal_type: str,
                                  symbol: str,
                                  trades: List[Dict[str, Any]],
                                  initial_capital: float,
                                  final_capital: float,
                                  max_capital: float) -> BacktestResult:
        """Calculate comprehensive backtest metrics"""
        if not trades:
            return self._empty_backtest_result(signal_type, symbol)
        
        # Basic metrics
        total_signals = len(trades)
        profitable_trades = [t for t in trades if t['pnl'] > 0]
        profitable_signals = len(profitable_trades)
        losing_trades = [t for t in trades if t['pnl'] <= 0]
        
        total_pnl = sum(t['pnl'] for t in trades)
        total_pnl_percentage = (final_capital - initial_capital) / initial_capital * 100
        win_rate = profitable_signals / total_signals if total_signals > 0 else 0
        
        # Average profit/loss
        avg_profit = np.mean([t['pnl'] for t in profitable_trades]) if profitable_trades else 0
        avg_loss = np.mean([t['pnl'] for t in losing_trades]) if losing_trades else 0
        
        # Drawdown calculation
        running_capital = initial_capital
        peak_capital = initial_capital
        max_drawdown = 0
        
        for trade in trades:
            running_capital += trade['pnl']
            peak_capital = max(peak_capital, running_capital)
            drawdown = (peak_capital - running_capital) / peak_capital
            max_drawdown = max(max_drawdown, drawdown)
        
        # Sharpe ratio (simplified)
        returns = [t['pnl_percentage'] for t in trades]
        sharpe_ratio = np.mean(returns) / np.std(returns) if len(returns) > 1 and np.std(returns) > 0 else 0
        
        # Average hold time
        avg_hold_time = np.mean([t['hold_time_minutes'] for t in trades])
        
        # Best and worst trades
        best_trade = max(trades, key=lambda x: x['pnl']) if trades else {}
        worst_trade = min(trades, key=lambda x: x['pnl']) if trades else {}
        
        return BacktestResult(
            signal_type=signal_type,
            symbol=symbol,
            total_signals=total_signals,
            profitable_signals=profitable_signals,
            total_pnl=total_pnl,
            total_pnl_percentage=total_pnl_percentage,
            win_rate=win_rate,
            avg_profit=avg_profit,
            avg_loss=avg_loss,
            max_drawdown=max_drawdown,
            sharpe_ratio=sharpe_ratio,
            avg_hold_time_minutes=avg_hold_time,
            best_trade=best_trade,
            worst_trade=worst_trade
        )
    
    async def _store_backtest_results(self, trades: List[Dict[str, Any]]):
        """Store backtest results in database"""
        try:
            query = text("""
                UPDATE signal_backtest 
                SET entry_price = :entry_price,
                    exit_price = :exit_price,
                    pnl = :pnl,
                    pnl_percentage = :pnl_percentage,
                    hold_duration_minutes = :hold_duration_minutes
                WHERE id = :signal_id
            """)
            
            with engine.begin() as conn:
                for trade in trades:
                    conn.execute(query, {
                        'signal_id': trade['signal_id'],
                        'entry_price': trade['entry_price'],
                        'exit_price': trade['exit_price'],
                        'pnl': trade['pnl'],
                        'pnl_percentage': trade['pnl_percentage'],
                        'hold_duration_minutes': trade['hold_time_minutes']
                    })
                    
        except Exception as e:
            self.logger.error(f"Failed to store backtest results: {e}")
    
    def _empty_backtest_result(self, signal_type: str, symbol: str) -> BacktestResult:
        """Return empty backtest result"""
        return BacktestResult(
            signal_type=signal_type,
            symbol=symbol,
            total_signals=0,
            profitable_signals=0,
            total_pnl=0,
            total_pnl_percentage=0,
            win_rate=0,
            avg_profit=0,
            avg_loss=0,
            max_drawdown=0,
            sharpe_ratio=0,
            avg_hold_time_minutes=0,
            best_trade={},
            worst_trade={}
        )

# Global instance
signal_backtester = SignalBacktester()
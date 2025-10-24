#!/usr/bin/env python3
"""
🔥 WISANG GENI - QUANTITATIVE TRADING EXTENSION
==============================================

Extension module untuk advanced quant trading techniques:
- Triple-Barrier Labeling
- Meta-Labeling
- Purged Cross-Validation
- Regime Detection
- Position Sizing (Kelly)
- Drift Detection
- Cost-Aware Backtesting

Requires: pandas, numpy, scikit-learn, ta-lib (optional)
"""

import json
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

class QuantExtension:
    """
    🔥 Quantitative Trading Extension for Wisang Geni
    
    Implements advanced ML techniques dari blueprint RICOZ
    """
    
    def __init__(self, knowledge_dir: Path):
        self.knowledge_dir = knowledge_dir
        self.quant_dir = knowledge_dir / "quant"
        self.quant_dir.mkdir(exist_ok=True)
        
        self.config = self.load_config()
        
        print("="*70)
        print("🔥 WISANG GENI - QUANT EXTENSION LOADED")
        print("="*70)
        print("✅ Triple-Barrier Labeling")
        print("✅ Meta-Labeling Framework")
        print("✅ Purged Cross-Validation")
        print("✅ Regime Detection")
        print("✅ Kelly Position Sizing")
        print("✅ Cost-Aware Backtesting")
        print()
    
    def load_config(self) -> Dict:
        """Load quant configuration"""
        config_file = self.quant_dir / "config.json"
        
        if config_file.exists():
            with open(config_file, 'r') as f:
                return json.load(f)
        
        # Default config
        default_config = {
            "triple_barrier": {
                "pt_sl_ratio": 2.0,  # TP/SL ratio
                "vol_multiplier": 1.5,  # ATR multiplier
                "time_limit_bars": 20  # Max holding period
            },
            "meta_labeling": {
                "base_threshold": 0.55,
                "meta_threshold": 0.60
            },
            "regime": {
                "trend_threshold": 0.6,
                "lookback": 50
            },
            "kelly": {
                "max_fraction": 0.25,  # Conservative Kelly
                "min_edge": 0.02
            },
            "costs": {
                "maker_fee": 0.0002,  # 0.02%
                "taker_fee": 0.0005,  # 0.05%
                "slippage_bps": 2.0    # 2 bps
            },
            "risk": {
                "max_position_pct": 0.01,  # 1% per trade
                "max_dd_pct": 0.03,        # 3% daily DD
                "max_exposure": 0.20        # 20% total
            }
        }
        
        # Save default
        with open(config_file, 'w') as f:
            json.dump(default_config, f, indent=2)
        
        return default_config
    
    def triple_barrier_label(self, 
                            df: pd.DataFrame,
                            pt_sl_ratio: float = 2.0,
                            vol_multiplier: float = 1.5,
                            time_limit: int = 20) -> pd.DataFrame:
        """
        Implement Triple-Barrier Labeling
        
        Args:
            df: DataFrame dengan columns ['close', 'high', 'low']
            pt_sl_ratio: Profit target / Stop loss ratio
            vol_multiplier: ATR multiplier untuk barriers
            time_limit: Max holding period dalam bars
        
        Returns:
            DataFrame dengan label columns
        """
        print("\n🏷️  Applying Triple-Barrier Labeling...")
        
        df = df.copy()
        
        # Calculate ATR untuk dynamic barriers
        df['tr'] = np.maximum(
            df['high'] - df['low'],
            np.maximum(
                abs(df['high'] - df['close'].shift(1)),
                abs(df['low'] - df['close'].shift(1))
            )
        )
        df['atr'] = df['tr'].rolling(14).mean()
        
        # Barriers
        df['upper_barrier'] = df['close'] * (1 + vol_multiplier * df['atr'] / df['close'] * pt_sl_ratio)
        df['lower_barrier'] = df['close'] * (1 - vol_multiplier * df['atr'] / df['close'])
        
        # Label calculation
        labels = []
        for i in range(len(df) - time_limit):
            entry_price = df['close'].iloc[i]
            upper = df['upper_barrier'].iloc[i]
            lower = df['lower_barrier'].iloc[i]
            
            # Look forward
            future_prices = df['close'].iloc[i+1:i+time_limit+1]
            
            # Check barriers
            hit_upper = (future_prices >= upper).any()
            hit_lower = (future_prices <= lower).any()
            
            if hit_upper and not hit_lower:
                label = 1  # Long win
            elif hit_lower and not hit_upper:
                label = -1  # Short win / Long loss
            else:
                # Time barrier - use actual return
                final_price = future_prices.iloc[-1]
                label = 1 if final_price > entry_price else -1
            
            labels.append(label)
        
        # Pad remaining
        labels.extend([0] * time_limit)
        df['label'] = labels
        
        print(f"   ✅ Labels: {(df['label']==1).sum()} longs, {(df['label']==-1).sum()} shorts")
        
        return df
    
    def meta_labeling(self,
                     df: pd.DataFrame,
                     base_predictions: np.ndarray,
                     base_threshold: float = 0.55) -> pd.DataFrame:
        """
        Implement Meta-Labeling
        
        Meta-model learns: "Should we trade this signal or skip?"
        
        Args:
            df: DataFrame with features
            base_predictions: Probabilities from base model
            base_threshold: Threshold for base model
        
        Returns:
            DataFrame with meta_label
        """
        print("\n🎯 Applying Meta-Labeling...")
        
        df = df.copy()
        df['base_prob'] = base_predictions
        
        # Base signal
        df['base_signal'] = (df['base_prob'] > base_threshold).astype(int)
        
        # Meta label: 1 if trade was profitable, 0 if should skip
        df['meta_label'] = ((df['base_signal'] == 1) & (df['label'] == 1)).astype(int)
        
        # Meta features
        df['prob_confidence'] = abs(df['base_prob'] - 0.5)
        df['vol_recent'] = df['close'].pct_change().rolling(10).std()
        
        print(f"   ✅ Meta-labels: {df['meta_label'].sum()} trades, {len(df) - df['meta_label'].sum()} skips")
        
        return df
    
    def purged_kfold_split(self,
                          df: pd.DataFrame,
                          n_splits: int = 5,
                          embargo_pct: float = 0.01) -> List[Tuple[np.ndarray, np.ndarray]]:
        """
        Implement Purged K-Fold Cross-Validation
        
        Removes overlapping samples between train/test
        
        Args:
            df: DataFrame
            n_splits: Number of folds
            embargo_pct: Embargo period as % of total samples
        
        Returns:
            List of (train_idx, test_idx) tuples
        """
        print(f"\n🔀 Creating Purged K-Fold ({n_splits} splits)...")
        
        n_samples = len(df)
        test_size = n_samples // n_splits
        embargo_size = int(n_samples * embargo_pct)
        
        splits = []
        
        for i in range(n_splits):
            # Test set
            test_start = i * test_size
            test_end = (i + 1) * test_size if i < n_splits - 1 else n_samples
            test_idx = np.arange(test_start, test_end)
            
            # Purge: Remove train samples that overlap with test
            purge_start = max(0, test_start - embargo_size)
            purge_end = min(n_samples, test_end + embargo_size)
            
            # Train set
            train_idx = np.concatenate([
                np.arange(0, purge_start),
                np.arange(purge_end, n_samples)
            ])
            
            splits.append((train_idx, test_idx))
            
            print(f"   Fold {i+1}: Train={len(train_idx)}, Test={len(test_idx)}, Purged={purge_end-purge_start}")
        
        return splits
    
    def detect_regime(self,
                     df: pd.DataFrame,
                     lookback: int = 50) -> pd.DataFrame:
        """
        Simple Regime Detection: Trend vs Range
        
        Args:
            df: DataFrame with price data
            lookback: Lookback period
        
        Returns:
            DataFrame with regime column
        """
        print(f"\n📊 Detecting Market Regime (lookback={lookback})...")
        
        df = df.copy()
        
        # Trend strength: ADX-like measure
        df['price_range'] = df['high'].rolling(lookback).max() - df['low'].rolling(lookback).min()
        df['price_change'] = abs(df['close'] - df['close'].shift(lookback))
        df['trend_strength'] = df['price_change'] / df['price_range']
        
        # Regime classification
        trend_threshold = self.config['regime']['trend_threshold']
        df['regime'] = np.where(
            df['trend_strength'] > trend_threshold,
            'trend',
            'range'
        )
        
        # Direction for trend
        df['trend_direction'] = np.where(
            df['close'] > df['close'].shift(lookback),
            'up',
            'down'
        )
        
        regime_counts = df['regime'].value_counts()
        print(f"   ✅ Regimes: {dict(regime_counts)}")
        
        return df
    
    def kelly_position_size(self,
                           win_rate: float,
                           avg_win: float,
                           avg_loss: float,
                           max_fraction: float = 0.25) -> float:
        """
        Calculate Kelly Criterion position size
        
        Args:
            win_rate: Probability of winning
            avg_win: Average win amount
            avg_loss: Average loss amount (positive)
            max_fraction: Max Kelly fraction (for safety)
        
        Returns:
            Position size as fraction of capital
        """
        if win_rate <= 0 or win_rate >= 1:
            return 0.0
        
        # Kelly formula
        b = avg_win / avg_loss  # Win/loss ratio
        p = win_rate
        q = 1 - p
        
        kelly = (p * b - q) / b
        
        # Apply safety cap
        kelly_capped = min(kelly, max_fraction)
        kelly_capped = max(kelly_capped, 0.0)  # No negative
        
        return kelly_capped
    
    def cost_aware_backtest(self,
                           df: pd.DataFrame,
                           signals: np.ndarray,
                           maker_fee: float = 0.0002,
                           taker_fee: float = 0.0005,
                           slippage_bps: float = 2.0) -> Dict:
        """
        Backtest dengan realistic costs
        
        Args:
            df: DataFrame with price data
            signals: Trading signals (1=long, -1=short, 0=flat)
            maker_fee: Maker fee rate
            taker_fee: Taker fee rate
            slippage_bps: Slippage in basis points
        
        Returns:
            Dictionary with backtest results
        """
        print("\n💰 Running Cost-Aware Backtest...")
        
        df = df.copy()
        df['signal'] = signals
        df['position'] = df['signal'].shift(1).fillna(0)
        
        # Calculate returns
        df['returns'] = df['close'].pct_change()
        df['strategy_returns'] = df['position'] * df['returns']
        
        # Apply costs
        df['trades'] = (df['position'] != df['position'].shift(1)).astype(int)
        
        # Assume taker fees for simplicity
        df['costs'] = df['trades'] * (taker_fee + slippage_bps / 10000)
        df['net_returns'] = df['strategy_returns'] - df['costs']
        
        # Performance metrics
        total_return = (1 + df['net_returns']).prod() - 1
        sharpe = df['net_returns'].mean() / df['net_returns'].std() * np.sqrt(252)
        
        # Sortino (downside deviation)
        downside = df['net_returns'][df['net_returns'] < 0]
        sortino = df['net_returns'].mean() / downside.std() * np.sqrt(252) if len(downside) > 0 else 0
        
        # Max drawdown
        cumulative = (1 + df['net_returns']).cumprod()
        running_max = cumulative.cummax()
        drawdown = (cumulative - running_max) / running_max
        max_dd = drawdown.min()
        
        # Win rate
        winning_trades = (df['net_returns'] > 0).sum()
        total_trades = df['trades'].sum()
        win_rate = winning_trades / total_trades if total_trades > 0 else 0
        
        results = {
            "total_return": total_return,
            "sharpe_ratio": sharpe,
            "sortino_ratio": sortino,
            "max_drawdown": max_dd,
            "win_rate": win_rate,
            "total_trades": total_trades,
            "avg_trade_cost": df['costs'].sum() / total_trades if total_trades > 0 else 0
        }
        
        print(f"   ✅ Total Return: {total_return*100:.2f}%")
        print(f"   ✅ Sharpe: {sharpe:.2f}")
        print(f"   ✅ Sortino: {sortino:.2f}")
        print(f"   ✅ Max DD: {max_dd*100:.2f}%")
        print(f"   ✅ Win Rate: {win_rate*100:.1f}%")
        print(f"   ✅ Trades: {total_trades}")
        
        return results
    
    def generate_blueprint_checklist(self) -> str:
        """Generate implementation checklist"""
        
        checklist = """
🔥 WISANG GENI - QUANT TRADING IMPLEMENTATION CHECKLIST
======================================================

SPRINT 0-1: Data & Labeling (2 weeks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Collect multi-timeframe candles (1m-1D)
□ Collect order book snapshots (if HFT)
□ Collect funding rates & basis
□ Collect on-chain metrics (addresses, flows)
□ Implement Triple-Barrier labeling
□ Generate meta-labels
□ Create SMC features (BOS/CHoCH/FVG)
□ Create OFI features (if LOB available)
□ Fractional differencing untuk stationarity

SPRINT 2: Modeling & Validation (2 weeks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Train baseline XGBoost model
□ Implement regime classifier
□ Setup Purged K-Fold CV
□ Implement walk-forward validation
□ Train meta-labeling model
□ Ensemble by regime (gated)

SPRINT 3: Reliability & Calibration (1-2 weeks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Implement isotonic calibration
□ Setup probability thresholds
□ Implement Kelly position sizing
□ Add uncertainty estimation
□ Setup drift detection (ADWIN/DDM)
□ Implement champion/challenger framework

SPRINT 4: Backtesting & Cost Model (1 week)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Cost-aware backtest (fees/slippage)
□ Realistic execution model
□ Stress test across regimes
□ Reality check / SPA tests
□ Sanity tests (label flip/shuffle)

SPRINT 5: Live Simulation (2 weeks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Shadow trading setup
□ Log fills & slippage
□ Monitor calibration (ECE)
□ Test kill-switch triggers
□ Validate against paper results

SPRINT 6: Production (Ongoing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Deploy champion model
□ Monitor drift continuously
□ Track Sharpe/Sortino OOS
□ Update models (weekly/monthly)
□ Audit & model cards

CRITICAL METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ ECE (calibration) < 3-5%
□ Precision @ trade > baseline + 10%
□ Net Sharpe OOS > 1.5 (intra) / 2.0 (swing)
□ Win rate in trend > 55-60%
□ Max DD < 8-10%

RISK POLICY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Per-trade risk ≤ 1% equity
□ Daily DD limit: -3% → flatten
□ Daily DD limit: -5% → pause 24h
□ Max exposure: 20% of equity
□ Position size cap: 10% of 1-min ADV

DEPLOYMENT GATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ Shadow trading 2+ weeks successful
□ OOS Sharpe > 1.5
□ Max DD within limits
□ Calibration ECE < 5%
□ No critical bugs in logs
□ Kill-switch tested & working
□ Team sign-off on risk policy
"""
        
        return checklist

# Integration dengan Wisang Geni
def integrate_quant_extension():
    """
    Tambahkan quant extension ke Wisang Geni
    """
    
    knowledge_dir = Path("/root/crypto-api/.wisang_geni")
    quant_ext = QuantExtension(knowledge_dir)
    
    # Generate checklist
    checklist = quant_ext.generate_blueprint_checklist()
    
    # Save checklist
    checklist_file = knowledge_dir / "quant" / "implementation_checklist.txt"
    with open(checklist_file, 'w') as f:
        f.write(checklist)
    
    print(f"\n💾 Checklist saved: {checklist_file}")
    print("\n" + checklist)
    
    return quant_ext

if __name__ == "__main__":
    print("\n🔥 WISANG GENI - QUANT EXTENSION")
    print("="*70)
    quant_ext = integrate_quant_extension()
    print("\n✅ Quant Extension Ready!")
    print("   Use these methods in Wisang Geni for advanced trading ML")

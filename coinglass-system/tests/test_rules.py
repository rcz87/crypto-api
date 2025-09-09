import pytest
from unittest.mock import Mock
from app.workers.signals import SignalGenerator

class TestSignalRules:
    def setup_method(self):
        self.signal_generator = SignalGenerator()
    
    def test_liquidation_cascade_threshold(self):
        # Test threshold calculation
        threshold = self.signal_generator.thresholds["liquidation_cascade"]
        assert threshold == 50000000  # $50M
    
    def test_funding_extreme_threshold(self):
        # Test funding rate threshold
        threshold = self.signal_generator.thresholds["funding_extreme"]
        assert threshold == 0.02  # 2%
    
    def test_oi_spike_threshold(self):
        # Test OI spike threshold
        threshold = self.signal_generator.thresholds["oi_spike"]
        assert threshold == 0.3  # 30%
    
    @pytest.mark.parametrize("liquidation_amount,expected_signal", [
        (60000000, True),   # Above threshold
        (40000000, False),  # Below threshold
        (50000001, True),   # Just above threshold
        (49999999, False),  # Just below threshold
    ])
    def test_liquidation_cascade_detection(self, liquidation_amount, expected_signal):
        # Mock database result
        mock_db = Mock()
        mock_result = Mock()
        mock_result.fetchone.return_value = (liquidation_amount,)
        mock_db.execute.return_value = mock_result
        
        # Test
        signal = self.signal_generator.check_liquidation_cascade(mock_db, "BTC")
        
        # Assert
        if expected_signal:
            assert signal is not None
            assert signal["type"] == "liquidation_cascade"
            assert signal["value"] == liquidation_amount
        else:
            assert signal is None
    
    @pytest.mark.parametrize("funding_rate,expected_signal", [
        (0.025, True),    # High positive funding
        (-0.025, True),   # High negative funding
        (0.015, False),   # Within normal range
        (-0.015, False),  # Within normal range
        (0.02, False),    # Exactly at threshold
        (0.021, True),    # Just above threshold
    ])
    def test_funding_extreme_detection(self, funding_rate, expected_signal):
        # Mock database result
        mock_db = Mock()
        mock_result = Mock()
        mock_result.fetchone.return_value = (funding_rate,)
        mock_db.execute.return_value = mock_result
        
        # Test
        signal = self.signal_generator.check_funding_extremes(mock_db, "ETH")
        
        # Assert
        if expected_signal:
            assert signal is not None
            assert signal["type"] == "funding_extreme"
            assert signal["value"] == funding_rate
        else:
            assert signal is None
    
    def test_oi_spike_detection(self):
        # Mock database result - 40% increase
        mock_db = Mock()
        mock_result = Mock()
        mock_result.fetchall.return_value = [
            (140000000, "2023-01-01"),  # Current OI
            (100000000, "2023-01-01")   # Previous OI
        ]
        mock_db.execute.return_value = mock_result
        
        # Test
        signal = self.signal_generator.check_oi_spike(mock_db, "SOL")
        
        # Assert
        assert signal is not None
        assert signal["type"] == "oi_spike"
        assert signal["value"] == 0.4  # 40% increase
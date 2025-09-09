import pytest
from unittest.mock import Mock, patch
from app.core.coinglass_client import CoinglassClient
from app.core.http import Http

class TestCoinglassClient:
    def setup_method(self):
        self.client = CoinglassClient()
    
    @patch('app.core.coinglass_client.Http')
    def test_oi_ohlc_success(self, mock_http_class):
        # Setup mock
        mock_response = Mock()
        mock_response.json.return_value = {
            "data": [{"symbol": "BTC", "oi_value": 1000000}]
        }
        mock_http = Mock()
        mock_http.get.return_value = mock_response
        mock_http_class.return_value = mock_http
        
        # Test
        result = self.client.oi_ohlc("BTC", "1h", True)
        
        # Assert
        assert result["data"][0]["symbol"] == "BTC"
        mock_http.get.assert_called_once()
    
    @patch('app.core.coinglass_client.Http')
    def test_funding_rate_success(self, mock_http_class):
        # Setup mock
        mock_response = Mock()
        mock_response.json.return_value = {
            "data": [{"symbol": "ETH", "rate": 0.001}]
        }
        mock_http = Mock()
        mock_http.get.return_value = mock_response
        mock_http_class.return_value = mock_http
        
        # Test
        result = self.client.funding_rate("ETH", "1h")
        
        # Assert
        assert result["data"][0]["rate"] == 0.001
    
    @patch('app.core.coinglass_client.Http')
    def test_liquidations_success(self, mock_http_class):
        # Setup mock
        mock_response = Mock()
        mock_response.json.return_value = {
            "data": [{"symbol": "SOL", "qty": 50000}]
        }
        mock_http = Mock()
        mock_http.get.return_value = mock_response
        mock_http_class.return_value = mock_http
        
        # Test
        result = self.client.liquidations("SOL", "1h")
        
        # Assert
        assert result["data"][0]["qty"] == 50000

class TestHttp:
    def setup_method(self):
        self.http = Http({"Authorization": "Bearer test"})
    
    @patch('app.core.http.requests')
    def test_get_success(self, mock_requests):
        # Setup mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.raise_for_status.return_value = None
        mock_requests.get.return_value = mock_response
        
        # Test
        result = self.http.get("https://api.example.com/test")
        
        # Assert
        assert result.status_code == 200
        mock_requests.get.assert_called_once()
    
    @patch('app.core.http.requests')
    @patch('app.core.http.time.sleep')
    def test_get_retry_on_500(self, mock_sleep, mock_requests):
        # Setup mock for retries
        mock_response_500 = Mock()
        mock_response_500.status_code = 500
        mock_response_500.raise_for_status.side_effect = Exception("Server Error")
        
        mock_response_200 = Mock()
        mock_response_200.status_code = 200
        mock_response_200.raise_for_status.return_value = None
        
        mock_requests.get.side_effect = [mock_response_500, mock_response_200]
        
        # Test
        result = self.http.get("https://api.example.com/test")
        
        # Assert
        assert result.status_code == 200
        assert mock_requests.get.call_count == 2
        mock_sleep.assert_called_once()
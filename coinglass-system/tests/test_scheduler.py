import pytest
from unittest.mock import Mock, patch
from app.workers.scheduler import start_scheduler
from apscheduler.schedulers.background import BackgroundScheduler

class TestScheduler:
    @patch('app.workers.scheduler.BackgroundScheduler')
    @patch('app.workers.scheduler.start_websocket_feeds')
    def test_start_scheduler(self, mock_start_ws, mock_scheduler_class):
        # Setup mock
        mock_scheduler = Mock()
        mock_scheduler_class.return_value = mock_scheduler
        
        # Test
        start_scheduler()
        
        # Assert
        mock_scheduler.add_job.assert_called()
        mock_scheduler.start.assert_called_once()
        mock_start_ws.assert_called_once()
        
        # Check that jobs were added
        assert mock_scheduler.add_job.call_count >= 3  # At least 3 jobs should be added
    
    @patch('app.workers.scheduler.BackgroundScheduler')
    def test_scheduler_job_configuration(self, mock_scheduler_class):
        # Setup mock
        mock_scheduler = Mock()
        mock_scheduler_class.return_value = mock_scheduler
        
        # Test
        start_scheduler()
        
        # Assert job configurations
        job_calls = mock_scheduler.add_job.call_args_list
        
        # Check that fetch_rest_data job is configured
        fetch_job_found = False
        for call in job_calls:
            if call.kwargs.get('id') == 'fetch_rest_data':
                fetch_job_found = True
                assert call.args[1] == 'interval'  # Should be interval trigger
                break
        
        assert fetch_job_found, "fetch_rest_data job should be configured"
import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.db import get_db, Base
from app.core.auth import auth_manager

# Test database setup
SQLALCHEMY_DATABASE_URL = "postgresql://test_user:test_pass@localhost:5432/test_coinglass"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestAPIIntegration:
    """Integration tests for API endpoints"""
    
    @classmethod
    def setup_class(cls):
        """Setup test database"""
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        
        # Create test API key
        cls.test_api_key = auth_manager.create_api_key("test_user", "premium")
        cls.headers = {"Authorization": f"Bearer {cls.test_api_key}"}
    
    @classmethod
    def teardown_class(cls):
        """Cleanup test database"""
        Base.metadata.drop_all(bind=engine)
    
    def test_health_endpoints(self):
        """Test health check endpoints"""
        # Test live endpoint
        response = self.client.get("/health/live")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        
        # Test ready endpoint
        response = self.client.get("/health/ready")
        assert response.status_code in [200, 503]  # May fail due to dependencies
    
    def test_authentication_flow(self):
        """Test authentication flow"""
        # Test without authentication
        response = self.client.get("/heatmap/BTC")
        assert response.status_code == 401
        
        # Test with authentication
        response = self.client.get("/heatmap/BTC", headers=self.headers)
        assert response.status_code == 200
    
    def test_api_key_creation(self):
        """Test API key creation"""
        response = self.client.post("/auth/api-key", json={
            "user_id": "integration_test_user",
            "tier": "standard"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "api_key" in data["data"]
    
    def test_heatmap_endpoint(self):
        """Test heatmap data endpoint"""
        response = self.client.get("/heatmap/BTC?minutes=60", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["symbol"] == "BTC"
        assert "tiles" in data
    
    def test_replay_endpoint(self):
        """Test replay data endpoint"""
        response = self.client.get("/replay/oi/ETH?interval=1h", headers=self.headers)
        assert response.status_code == 200
    
    def test_export_functionality(self):
        """Test data export functionality"""
        from datetime import datetime, timedelta
        
        export_request = {
            "data_type": "liquidations",
            "format": "json",
            "symbols": ["BTC", "ETH"],
            "time_range": {
                "start_time": (datetime.utcnow() - timedelta(days=1)).isoformat(),
                "end_time": datetime.utcnow().isoformat()
            }
        }
        
        response = self.client.post("/export/data", 
                                  json=export_request, 
                                  headers=self.headers)
        assert response.status_code == 200
    
    def test_webhook_management(self):
        """Test webhook registration and management"""
        # Register webhook
        webhook_config = {
            "url": "https://example.com/webhook",
            "events": ["signal_generated", "liquidation_cascade"],
            "secret": "test_webhook_secret",
            "active": True
        }
        
        response = self.client.post("/webhooks/register",
                                  json=webhook_config,
                                  headers=self.headers)
        assert response.status_code == 200
        webhook_id = response.json()["data"]["webhook_id"]
        
        # List webhooks
        response = self.client.get("/webhooks/list", headers=self.headers)
        assert response.status_code == 200
        webhooks = response.json()["data"]
        assert len(webhooks) >= 1
        
        # Update webhook
        webhook_config["active"] = False
        response = self.client.put(f"/webhooks/{webhook_id}",
                                 json=webhook_config,
                                 headers=self.headers)
        assert response.status_code == 200
        
        # Delete webhook
        response = self.client.delete(f"/webhooks/{webhook_id}", headers=self.headers)
        assert response.status_code == 200
    
    def test_rate_limiting(self):
        """Test rate limiting functionality"""
        # Make multiple requests rapidly
        responses = []
        for i in range(70):  # Exceed standard rate limit
            response = self.client.get("/health/live")
            responses.append(response.status_code)
        
        # Should get some 429 responses
        assert 429 in responses
    
    def test_error_handling(self):
        """Test error handling"""
        # Test invalid symbol
        response = self.client.get("/heatmap/INVALID_SYMBOL", headers=self.headers)
        assert response.status_code in [400, 404, 422]
        
        # Test invalid request body
        response = self.client.post("/auth/api-key", json={
            "invalid_field": "invalid_value"
        })
        assert response.status_code == 422
    
    def test_concurrent_requests(self):
        """Test concurrent request handling"""
        async def make_request():
            response = self.client.get("/health/live")
            return response.status_code
        
        # Make 10 concurrent requests
        async def run_concurrent_tests():
            tasks = [make_request() for _ in range(10)]
            results = await asyncio.gather(*tasks)
            return results
        
        results = asyncio.run(run_concurrent_tests())
        
        # All requests should succeed
        assert all(status == 200 for status in results)

class TestDataProcessingIntegration:
    """Integration tests for data processing pipeline"""
    
    def setup_method(self):
        """Setup for each test method"""
        self.client = TestClient(app)
    
    def test_data_validation_pipeline(self):
        """Test data validation in processing pipeline"""
        # This would test the actual data processing with real data flows
        pass
    
    def test_cache_integration(self):
        """Test cache integration"""
        from app.core.cache import cache
        
        # Test cache operations
        test_key = "test_integration_key"
        test_value = {"test": "data"}
        
        # Set and get
        assert cache.set(test_key, test_value)
        retrieved = cache.get(test_key)
        assert retrieved == test_value
        
        # Delete
        assert cache.delete(test_key)
        assert cache.get(test_key) is None
    
    def test_database_integration(self):
        """Test database operations"""
        from app.core.db import db_manager
        
        # Test connection stats
        stats = db_manager.get_connection_stats()
        assert isinstance(stats, dict)
        assert "pool_size" in stats

if __name__ == "__main__":
    pytest.main([__file__])
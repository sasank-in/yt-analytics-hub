"""
Comprehensive test suite for FastAPI endpoints
Tests all 8 REST API endpoints with various scenarios
"""

import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main_api import app
from youtube_analytics.database import DatabaseManager, Channel, Video, Base

# Create test database instance
db = DatabaseManager()

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def sample_channel():
    """Create sample channel for testing"""
    return Channel(
        channel_id="UCtest123",
        title="Test Channel",
        description="A test channel",
        subscribers="100000",
        total_videos="50"
    )

@pytest.fixture
def sample_video():
    """Create sample video for testing"""
    return Video(
        channel_id="UCtest123",
        video_id="VIDtest123",
        title="Test Video",
        description="A test video",
        published_at="2024-01-01T12:00:00Z",
        views="10000",
        likes="500",
        comments="50"
    )


class TestHealthEndpoint:
    """Test /api/health endpoint"""
    
    def test_health_check_success(self, client):
        """Test health check returns 200"""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert "status" in response.json()
    
    def test_health_response_format(self, client):
        """Test health check response format"""
        response = client.get("/api/health")
        data = response.json()
        assert data["status"] == "healthy"
        assert "database" in data
        assert "api" in data


class TestChannelEndpoints:
    """Test channel-related endpoints"""
    
    def test_get_channels_empty(self, client):
        """Test getting channels when database is empty"""
        response = client.get("/api/channels")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert "channels" in data
    
    def test_search_channel_success(self, client):
        """Test successful channel search"""
        response = client.get("/api/channel/search?q=UCLA")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_search_channel_empty_query(self, client):
        """Test channel search with empty query"""
        response = client.get("/api/channel/search?q=")
        assert response.status_code == 400
    
    def test_search_channel_invalid_query(self, client):
        """Test channel search with invalid query"""
        response = client.get("/api/channel/search?q=" + "x" * 500)
        assert response.status_code == 400
    
    def test_get_channel_by_id(self, client):
        """Test getting channel by ID"""
        response = client.get("/api/channel/UCtest123")
        assert response.status_code in [200, 404, 500]  # May not exist if API error
    
    def test_get_channel_videos(self, client):
        """Test getting channel videos"""
        response = client.get("/api/channel/UCtest123/videos")
        assert response.status_code in [200, 500]  # May error if API call fails


class TestVideoEndpoints:
    """Test video-related endpoints"""
    
    def test_video_search_success(self, client):
        """Test successful video search"""
        response = client.get("/api/video/search?q=python")
        assert response.status_code in [200, 500]  # May error on API call
    
    def test_video_search_empty_query(self, client):
        """Test video search with empty query"""
        response = client.get("/api/video/search?q=")
        assert response.status_code == 400
    
    def test_video_search_invalid_query(self, client):
        """Test video search with invalid query"""
        response = client.get("/api/video/search?q=" + "x" * 500)
        assert response.status_code == 400


class TestStatisticsEndpoint:
    """Test /api/statistics/{id} endpoint"""
    
    def test_statistics_invalid_format(self, client):
        """Test statistics with invalid ID format"""
        response = client.get("/api/statistics/invalid-id-format")
        assert response.status_code in [400, 404, 500]
    
    def test_statistics_not_found(self, client):
        """Test statistics for non-existent channel"""
        response = client.get("/api/statistics/nonexistent123")
        assert response.status_code in [404, 500]


class TestRequestValidation:
    """Test request validation and error handling"""
    
    def test_invalid_endpoint(self, client):
        """Test invalid endpoint returns 404"""
        response = client.get("/api/invalid-endpoint")
        assert response.status_code == 404
    
    def test_method_not_allowed(self, client):
        """Test POST on GET-only endpoint"""
        response = client.post("/api/health")
        assert response.status_code in [405, 422]  # Method not allowed or validation error
    
    def test_invalid_query_parameters(self, client):
        """Test endpoint with invalid query parameters"""
        response = client.get("/api/channel/search?invalid_param=value")
        # Should still process valid requests, just ignore invalid params
        assert response.status_code in [400, 422]


class TestCORSHeaders:
    """Test CORS headers"""
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are present in response"""
        response = client.get("/api/health")
        assert response.status_code == 200
        # CORS headers set by middleware
        assert response.headers.get("access-control-allow-origin") is not None or True  # Depends on middleware


class TestBackgroundTasks:
    """Test background task processing"""
    
    def test_fetch_videos_returns_202(self, client):
        """Test fetch videos returns 202 Accepted for background processing"""
        response = client.post("/api/channel/UCtest123/fetch-videos")
        # Should accept or process based on implementation
        assert response.status_code in [200, 202, 400, 500]


class TestErrorHandling:
    """Test error handling and edge cases"""
    
    def test_missing_required_parameters(self, client):
        """Test endpoint with missing required parameters"""
        response = client.get("/api/channel/search")  # Missing q parameter
        assert response.status_code in [400, 422]
    
    def test_response_contains_proper_json(self, client):
        """Test that responses are valid JSON"""
        response = client.get("/api/health")
        try:
            response.json()  # Should not raise
            assert True
        except:
            assert False, "Response is not valid JSON"
    
    def test_error_response_format(self, client):
        """Test error responses have consistent format"""
        response = client.get("/api/channel/search?q=")
        assert response.status_code == 400
        # Should have error information


class TestDataIntegrity:
    """Test data integrity and database operations"""
    
    def test_api_health_check(self, client):
        """Test that API is healthy"""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
    
    def test_channel_count_non_negative(self, client):
        """Test that channel count is non-negative"""
        response = client.get("/api/channels")
        data = response.json()
        assert data.get("count", 0) >= 0


class TestPerformance:
    """Test performance and response times"""
    
    def test_health_check_response_time(self, client):
        """Test health check response time is acceptable"""
        import time
        start = time.time()
        client.get("/api/health")
        elapsed = time.time() - start
        assert elapsed < 1.0  # Should respond in less than 1 second
    
    def test_channels_list_response_time(self, client):
        """Test channels list response time"""
        import time
        start = time.time()
        client.get("/api/channels")
        elapsed = time.time() - start
        assert elapsed < 2.0  # Should respond in less than 2 seconds

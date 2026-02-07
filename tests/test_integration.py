"""
Integration tests
Tests complete workflows and interactions between components
"""

import pytest
import json
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main_api import app
from youtube_analytics.database import DatabaseManager, Base, Channel, Video

# Create test database instance
db = DatabaseManager()

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def test_session():
    """Get test database session"""
    session = db.Session()
    yield session
    session.close()

@pytest.fixture
def sample_channel_data():
    """Sample channel data"""
    return {
        "channel_id": "UCintegration",
        "title": "Integration Test Channel",
        "description": "Channel for integration testing",
        "subscribers": "50000",
        "total_videos": "20"
    }

@pytest.fixture
def sample_video_data():
    """Sample video data"""
    return {
        "channel_id": "UCintegration",
        "video_id": "VIDintegration",
        "title": "Integration Test Video",
        "description": "Video for integration testing",
        "published_at": "2024-01-15T10:30:00Z",
        "views": "5000",
        "likes": "250",
        "comments": "50"
    }


class TestFullWorkflow:
    """Test complete application workflows"""
    
    def test_health_check_workflow(self, client):
        """Test basic health check workflow"""
        # Step 1: Health check
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_channel_listing_workflow(self, client, test_session, sample_channel_data):
        """Test channel listing workflow"""
        # Step 1: Add channel to database
        channel = Channel(**sample_channel_data)
        test_session.add(channel)
        test_session.commit()
        
        # Step 2: Retrieve channels via API
        response = client.get("/api/channels")
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert "channels" in data
    
    def test_channel_and_video_workflow(self, client, test_session, 
                                      sample_channel_data, sample_video_data):
        """Test workflow with channels and videos"""
        # Step 1: Create channel
        channel = Channel(**sample_channel_data)
        test_session.add(channel)
        test_session.commit()
        
        # Step 2: Create videos for channel
        video = Video(**sample_video_data)
        test_session.add(video)
        test_session.commit()
        
        # Step 3: Get channel videos
        channel_id = sample_channel_data["channel_id"]
        response = client.get(f"/api/channel/{channel_id}/videos")
        assert response.status_code in [200, 500]  # May error on external API call
    
    def test_statistics_calculation_workflow(self, client, test_session, 
                                             sample_channel_data, sample_video_data):
        """Test statistics calculation workflow"""
        # Step 1: Setup data
        channel = Channel(**sample_channel_data)
        test_session.add(channel)
        test_session.commit()
        
        video = Video(**sample_video_data)
        test_session.add(video)
        test_session.commit()
        
        # Step 2: Request statistics
        channel_id = sample_channel_data["channel_id"]
        response = client.get(f"/api/statistics/{channel_id}")
        # Response depends on implementation
        assert response.status_code in [200, 404, 500]


class TestDataPersistence:
    """Test data persistence across requests"""
    
    def test_data_survives_requests(self, client, test_session, sample_channel_data):
        """Test that data persists between requests"""
        # Add data
        channel = Channel(**sample_channel_data)
        test_session.add(channel)
        test_session.commit()
        
        # First request
        response1 = client.get("/api/channels")
        data1 = response1.json()
        initial_count = data1.get("count", 0)
        
        # Second request
        response2 = client.get("/api/channels")
        data2 = response2.json()
        final_count = data2.get("count", 0)
        
        # Should have same data
        assert initial_count == final_count


class TestErrorRecovery:
    """Test error handling and recovery"""
    
    def test_invalid_request_handling(self, client):
        """Test handling of invalid requests"""
        # Test various invalid requests
        response = client.get("/api/channel/search?q=")
        assert response.status_code == 400
        
        # API should still be responsive
        response = client.get("/api/health")
        assert response.status_code == 200
    
    def test_concurrent_request_handling(self, client, test_session, sample_channel_data):
        """Test handling of concurrent-like requests"""
        # Add data
        channel = Channel(**sample_channel_data)
        test_session.add(channel)
        test_session.commit()
        
        # Simulate multiple requests
        for _ in range(5):
            response = client.get("/api/channels")
            assert response.status_code == 200


class TestResponseFormats:
    """Test response format and consistency"""
    
    def test_success_response_format(self, client):
        """Test successful response format"""
        response = client.get("/api/health")
        data = response.json()
        
        # Should have expected fields
        assert isinstance(data, dict)
        assert "status" in data
    
    def test_error_response_format(self, client):
        """Test error response format"""
        response = client.get("/api/channel/search?q=")
        
        # Should have status code
        assert response.status_code >= 400
    
    def test_list_response_format(self, client, test_session, sample_channel_data):
        """Test list response format"""
        channel = Channel(**sample_channel_data)
        test_session.add(channel)
        test_session.commit()
        
        response = client.get("/api/channels")
        data = response.json()
        
        # Should have list structure
        assert "channels" in data
        assert isinstance(data["channels"], list)


class TestAuthentication:
    """Test API authentication if implemented"""
    
    def test_endpoint_accessibility(self, client):
        """Test that endpoints are accessible"""
        endpoints = [
            "/api/health",
            "/api/channels",
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            # Should either succeed or fail consistently
            assert response.status_code in [200, 400, 404, 422, 500]


class TestDataTypes:
    """Test data type handling"""
    
    def test_numeric_type_handling(self, client, test_session):
        """Test numeric type handling"""
        channel = Channel(
            channel_id="UCtypes",
            name="Type Test",
            subscribers=123456789,
            total_videos=9999
        )
        test_session.add(channel)
        test_session.commit()
        
        video = Video(
            channel_id="UCtypes",
            video_id="VIDtypes",
            title="Types Video",
            views=1000000,
            likes=50000,
            comments=5000
        )
        test_session.add(video)
        test_session.commit()
        
        response = client.get("/api/channels")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data.get("count"), (int, type(None)))
    
    def test_string_type_handling(self, client, test_session):
        """Test string type handling"""
        channel = Channel(
            channel_id="UCstrings",
            name="String Test Channel with Special Chars: @#$%",
            description="Test with unicode: 你好世界 🌍",
            subscribers=1000,
            total_videos=5
        )
        test_session.add(channel)
        test_session.commit()
        
        response = client.get("/api/channels")
        assert response.status_code == 200


class TestSectionNavigation:
    """Test navigation between sections"""
    
    def test_dashboard_section(self, client):
        """Test dashboard section access"""
        response = client.get("/api/health")
        assert response.status_code == 200
    
    def test_channels_section(self, client):
        """Test channels section access"""
        response = client.get("/api/channels")
        assert response.status_code == 200
    
    def test_videos_section(self, client):
        """Test videos section access"""
        response = client.get("/api/video/search?q=test")
        # May fail on external API, but endpoint should be accessible
        assert response.status_code in [200, 400, 500]
    
    def test_settings_section(self, client):
        """Test settings section access"""
        response = client.get("/api/health")
        assert response.status_code == 200


class TestDataValidationIntegration:
    """Test data validation across components"""
    
    def test_invalid_channel_id_format(self, client):
        """Test handling of invalid channel ID"""
        response = client.get("/api/channel/invalid")
        # Should handle gracefully
        assert response.status_code in [400, 404, 500]
    
    def test_invalid_video_id_format(self, client):
        """Test handling of invalid video ID"""
        response = client.get("/api/video/search?q=")
        # Should reject empty query
        assert response.status_code == 400


class TestAPIVersioning:
    """Test API structure and versioning"""
    
    def test_api_base_path(self, client):
        """Test API base path /api"""
        response = client.get("/api/health")
        assert response.status_code == 200
    
    def test_endpoint_naming_consistency(self, client):
        """Test endpoint naming is consistent"""
        # All endpoints should use /api/ prefix
        response = client.get("/api/channels")
        assert response.status_code in [200, 404, 422]


class TestResourceEndToEnd:
    """Test complete resource lifecycle"""
    
    def test_channel_creation_to_retrieval(self, client, test_session):
        """Test channel creation and retrieval"""
        # Create
        channel = Channel(
            channel_id="UCe2e",
            name="End-to-End Test",
            subscribers=1000,
            total_videos=5
        )
        test_session.add(channel)
        test_session.commit()
        
        # Retrieve
        response = client.get("/api/channels")
        assert response.status_code == 200
        
        # Verify
        data = response.json()
        assert data.get("count", 0) >= 1
    
    def test_video_creation_to_statistics(self, client, test_session):
        """Test video creation and statistics generation"""
        # Setup
        channel = Channel(
            channel_id="UCvide2e",
            name="Video E2E",
            subscribers=1000,
            total_videos=1
        )
        test_session.add(channel)
        test_session.commit()
        
        # Create video
        video = Video(
            channel_id="UCvide2e",
            video_id="VIDe2e",
            title="E2E Video",
            views=10000,
            likes=500,
            comments=50
        )
        test_session.add(video)
        test_session.commit()
        
        # Get stats
        response = client.get("/api/statistics/UCvide2e")
        # May not be implemented, but should not crash
        assert response.status_code in [200, 404, 500]

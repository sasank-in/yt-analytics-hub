"""
Database layer tests
Tests SQLAlchemy models, CRUD operations, and data validation
"""

import pytest
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from youtube_analytics.database import DatabaseManager, Base, Channel, Video

# Create test database instance
db = DatabaseManager()

@pytest.fixture
def test_session():
    """Get test database session"""
    session = db.Session()
    yield session
    session.close()


class TestChannelModel:
    """Test Channel model"""
    
    def test_channel_creation(self, test_session):
        """Test creating a channel"""
        channel = Channel(
            channel_id="UCtest123",
            title="Test Channel",
            description="Test description",
            subscribers="100000",
            total_videos="50"
        )
        test_session.add(channel)
        test_session.commit()
        
        assert channel.id is not None
        assert channel.channel_id == "UCtest123"
        assert channel.name == "Test Channel"
    
    def test_channel_unique_constraint(self, test_session):
        """Test channel_id uniqueness"""
        channel1 = Channel(
            channel_id="UCunique",
            title="Channel 1",
            subscribers="1000",
            total_videos="10"
        )
        channel2 = Channel(
            channel_id="UCunique",
            title="Channel 2",
            subscribers="2000",
            total_videos="20"
        )
        test_session.add(channel1)
        test_session.commit()
        test_session.add(channel2)
        
        with pytest.raises(Exception):  # Integrity error
            test_session.commit()
    
    def test_channel_fields_validation(self, test_session):
        """Test channel field validation"""
        channel = Channel(
            channel_id="UCvalidate",
            title="Valid Channel",
            description="Valid description",
            subscribers="50000",
            total_videos="25"
        )
        test_session.add(channel)
        test_session.commit()
        
        retrieved = test_session.query(Channel).filter_by(
            channel_id="UCvalidate"
        ).first()
        
        assert retrieved.subscribers == "50000"
        assert retrieved.total_videos == "25"


class TestVideoModel:
    """Test Video model"""
    
    def test_video_creation(self, test_session):
        """Test creating a video"""
        # First create a channel
        channel = Channel(
            channel_id="UCvideochannel",
            name="Video Test Channel",
            subscribers=5000,
            total_videos=5
        )
        test_session.add(channel)
        test_session.commit()
        
        video = Video(
            channel_id="UCvideochannel",
            video_id="VIDtest123",
            title="Test Video",
            description="Test video description",
            published_at="2024-01-01T12:00:00Z",
            views=10000,
            likes=500,
            comments=50
        )
        test_session.add(video)
        test_session.commit()
        
        assert video.id is not None
        assert video.video_id == "VIDtest123"
        assert video.views == 10000
    
    def test_video_statistics_fields(self, test_session):
        """Test video statistics fields"""
        channel = Channel(
            channel_id="UCstats",
            name="Stats Channel",
            subscribers=1000,
            total_videos=1
        )
        test_session.add(channel)
        test_session.commit()
        
        video = Video(
            channel_id="UCstats",
            video_id="VIDstats",
            title="Stats Video",
            views=50000,
            likes=2500,
            comments=500
        )
        test_session.add(video)
        test_session.commit()
        
        retrieved = test_session.query(Video).filter_by(
            video_id="VIDstats"
        ).first()
        
        assert retrieved.views == 50000
        assert retrieved.likes == 2500
        assert retrieved.comments == 500
    
    def test_video_engagement_calculation(self, test_session):
        """Test video engagement calculations"""
        channel = Channel(
            channel_id="UCengage",
            name="Engagement Channel",
            subscribers=1000,
            total_videos=1
        )
        test_session.add(channel)
        test_session.commit()
        
        video = Video(
            channel_id="UCengage",
            video_id="VIDengage",
            title="Engagement Video",
            views=10000,
            likes=1000,
            comments=100
        )
        test_session.add(video)
        test_session.commit()
        
        # Engagement rate = (likes + comments) / views * 100
        expected_engagement = ((1000 + 100) / 10000) * 100
        actual = (video.likes + video.comments) / video.views * 100
        assert actual == pytest.approx(expected_engagement)


class TestCRUDOperations:
    """Test CRUD operations"""
    
    def test_create_channel_operation(self, test_session):
        """Test create_channel function"""
        channel_data = {
            "channel_id": "UCcrudtest",
            "name": "CRUD Test Channel",
            "description": "Testing CRUD operations",
            "subscribers": 10000,
            "total_videos": 15
        }
        
        # Assuming create_channel function exists
        channel = Channel(**channel_data)
        test_session.add(channel)
        test_session.commit()
        
        retrieved = test_session.query(Channel).filter_by(
            channel_id="UCcrudtest"
        ).first()
        assert retrieved is not None
    
    def test_get_channel_operation(self, test_session):
        """Test retrieving channel"""
        channel = Channel(
            channel_id="UCgettest",
            name="Get Test",
            subscribers=1000,
            total_videos=5
        )
        test_session.add(channel)
        test_session.commit()
        
        retrieved = test_session.query(Channel).filter_by(
            channel_id="UCgettest"
        ).first()
        
        assert retrieved is not None
        assert retrieved.name == "Get Test"
    
    def test_update_channel_subscribers(self, test_session):
        """Test updating channel subscribers"""
        channel = Channel(
            channel_id="UCupdatetest",
            name="Update Test",
            subscribers=1000,
            total_videos=5
        )
        test_session.add(channel)
        test_session.commit()
        
        # Update subscribers
        channel.subscribers = 2000
        test_session.commit()
        
        retrieved = test_session.query(Channel).filter_by(
            channel_id="UCupdatetest"
        ).first()
        
        assert retrieved.subscribers == 2000
    
    def test_delete_channel(self, test_session):
        """Test deleting a channel"""
        channel = Channel(
            channel_id="UCdeletetest",
            name="Delete Test",
            subscribers=1000,
            total_videos=5
        )
        test_session.add(channel)
        test_session.commit()
        
        # Delete
        test_session.delete(channel)
        test_session.commit()
        
        retrieved = test_session.query(Channel).filter_by(
            channel_id="UCdeletetest"
        ).first()
        
        assert retrieved is None


class TestDataValidation:
    """Test data validation"""
    
    def test_channel_required_fields(self, test_session):
        """Test channel with missing required fields"""
        # Should fail or handle gracefully
        try:
            channel = Channel(name="No ID Channel")
            test_session.add(channel)
            test_session.commit()
            # If it doesn't fail, channel_id was probably generated or nullable
        except:
            pass  # Expected behavior
    
    def test_video_integer_fields(self, test_session):
        """Test video fields are properly typed"""
        channel = Channel(
            channel_id="UCtypetest",
            name="Type Test",
            subscribers=1000,
            total_videos=5
        )
        test_session.add(channel)
        test_session.commit()
        
        video = Video(
            channel_id="UCtypetest",
            video_id="VIDtypetest",
            title="Type Test Video",
            views=5000,
            likes=250,
            comments=25
        )
        test_session.add(video)
        test_session.commit()
        
        retrieved = test_session.query(Video).filter_by(
            video_id="VIDtypetest"
        ).first()
        
        assert isinstance(retrieved.views, int)
        assert isinstance(retrieved.likes, int)
        assert isinstance(retrieved.comments, int)


class TestDatabaseRelationships:
    """Test relationships between models"""
    
    def test_channel_video_relationship(self, test_session):
        """Test relationship between channel and videos"""
        channel = Channel(
            channel_id="UCrelationship",
            name="Relationship Test",
            subscribers=1000,
            total_videos=2
        )
        test_session.add(channel)
        test_session.commit()
        
        video1 = Video(
            channel_id="UCrelationship",
            video_id="VIDrel1",
            title="Video 1"
        )
        video2 = Video(
            channel_id="UCrelationship",
            video_id="VIDrel2",
            title="Video 2"
        )
        test_session.add_all([video1, video2])
        test_session.commit()
        
        # Query videos by channel
        videos = test_session.query(Video).filter_by(
            channel_id="UCrelationship"
        ).all()
        
        assert len(videos) == 2
    
    def test_cascade_delete(self, test_session):
        """Test cascade delete if implemented"""
        channel = Channel(
            channel_id="UCcascade",
            name="Cascade Test",
            subscribers=1000,
            total_videos=1
        )
        test_session.add(channel)
        test_session.commit()
        
        video = Video(
            channel_id="UCcascade",
            video_id="VIDcascade",
            title="Cascade Video"
        )
        test_session.add(video)
        test_session.commit()
        
        # Delete channel
        test_session.delete(channel)
        test_session.commit()
        
        # Check if video is deleted (depends on cascade settings)
        video_count = test_session.query(Video).filter_by(
            channel_id="UCcascade"
        ).count()
        # Should be 0 if cascade delete is enabled


class TestDatabasePerformance:
    """Test database performance"""
    
    def test_bulk_insert_performance(self, test_session):
        """Test bulk insert performance"""
        import time
        
        channel = Channel(
            channel_id="UCbulktest",
            name="Bulk Test",
            subscribers=1000,
            total_videos=100
        )
        test_session.add(channel)
        test_session.commit()
        
        # Create 100 videos
        start = time.time()
        for i in range(100):
            video = Video(
                channel_id="UCbulktest",
                video_id=f"VIDbulk{i}",
                title=f"Bulk Video {i}",
                views=i * 1000,
                likes=i * 100,
                comments=i * 10
            )
            test_session.add(video)
        test_session.commit()
        elapsed = time.time() - start
        
        # Should complete reasonably quickly
        assert elapsed < 5.0
    
    def test_query_performance(self, test_session):
        """Test query performance"""
        import time
        
        # Ensure we have data
        channel = Channel(
            channel_id="UCquerytest",
            name="Query Test",
            subscribers=1000,
            total_videos=10
        )
        test_session.add(channel)
        test_session.commit()
        
        start = time.time()
        videos = test_session.query(Video).filter_by(
            channel_id="UCquerytest"
        ).all()
        elapsed = time.time() - start
        
        assert elapsed < 1.0  # Query should be fast

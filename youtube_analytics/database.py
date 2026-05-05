"""Database Module

Provides SQLAlchemy ORM models and database operations for
managing YouTube channel and video data in PostgreSQL.
"""

import logging
from datetime import datetime, timezone

from dateutil import parser as date_parser
from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Text, create_engine, func
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from youtube_analytics.config import DB_URL  # noqa: F401  (kept for backwards compat)

logger = logging.getLogger("youtube_analytics.db")

Base = declarative_base()


def utcnow() -> datetime:
    """Timezone-aware UTC now (replacement for deprecated datetime.utcnow)."""
    return datetime.now(timezone.utc)


def parse_datetime(date_input):
    """Convert ISO format string to Python datetime object."""
    if date_input is None:
        return None
    if isinstance(date_input, datetime):
        return date_input
    if isinstance(date_input, str):
        try:
            return date_parser.isoparse(date_input)
        except (ValueError, TypeError):
            try:
                return datetime.fromisoformat(date_input.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                return None
    return None


class Channel(Base):
    """Channel database model"""
    __tablename__ = "channels"

    channel_id = Column(String(100), primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    custom_url = Column(String(255))
    published_at = Column(DateTime)
    subscribers = Column(String(50))
    total_views = Column(String(50))
    total_videos = Column(String(50))
    profile_image = Column(String(500))
    banner_image = Column(String(500))
    fetched_at = Column(DateTime, default=utcnow)
    last_searched_at = Column(DateTime)

    videos = relationship("Video", back_populates="channel", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "channel_id": self.channel_id,
            "title": self.title,
            "description": self.description,
            "custom_url": self.custom_url,
            "published_at": self.published_at,
            "subscribers": self.subscribers,
            "total_views": self.total_views,
            "total_videos": self.total_videos,
            "profile_image": self.profile_image,
            "banner_image": self.banner_image,
            "fetched_at": self.fetched_at
        }


class Video(Base):
    """Video database model"""
    __tablename__ = "videos"

    video_id = Column(String(100), primary_key=True)
    channel_id = Column(String(100), ForeignKey("channels.channel_id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    published_at = Column(DateTime)
    duration = Column(String(50))
    views = Column(String(50))
    likes = Column(String(50))
    comments = Column(String(50))
    thumbnail = Column(String(500))
    channel_title = Column(String(255))  # Added to track source channel
    fetched_at = Column(DateTime, default=utcnow)
    last_searched_at = Column(DateTime)

    channel = relationship("Channel", back_populates="videos")

    def to_dict(self):
        return {
            "video_id": self.video_id,
            "channel_id": self.channel_id,
            "title": self.title,
            "description": self.description,
            "channel_title": self.channel_title,
            "published_at": self.published_at,
            "duration": self.duration,
            "views": self.views,
            "likes": self.likes,
            "comments": self.comments,
            "thumbnail": self.thumbnail,
            "fetched_at": self.fetched_at,
            "last_searched_at": getattr(self, "last_searched_at", None)
        }


class ChannelSetting(Base):
    """Channel settings like RPM"""
    __tablename__ = "channel_settings"

    channel_id = Column(String(100), ForeignKey("channels.channel_id"), primary_key=True)
    rpm = Column(Float, default=2.0)
    updated_at = Column(DateTime, default=utcnow)


class DatabaseManager:
    """Manages database operations for channels and videos"""

    def __init__(self):
        """Initialize database connection with proper error handling"""
        try:
            from youtube_analytics.config import DB_ECHO
            from youtube_analytics.config import DB_URL as config_db_url

            logger.info("Initializing database (url=%s)", config_db_url)
            self.engine = create_engine(config_db_url, echo=DB_ECHO)

            with self.engine.connect() as conn:
                pass
            logger.debug("Database connection ok")

            Base.metadata.create_all(self.engine)
            logger.debug("Tables ready")

            # Lightweight migration (SQLite-only): add last_searched_at if missing.
            if self.engine.dialect.name == "sqlite":
                with self.engine.connect() as conn:
                    for table in ("channels", "videos"):
                        try:
                            cols = [row[1] for row in conn.exec_driver_sql(
                                f"PRAGMA table_info({table})"
                            ).fetchall()]
                            if "last_searched_at" not in cols:
                                conn.exec_driver_sql(
                                    f"ALTER TABLE {table} ADD COLUMN last_searched_at DATETIME"
                                )
                        except Exception:
                            logger.exception("Migration check failed for table %s", table)

            self.Session = sessionmaker(bind=self.engine)
            logger.info("Database initialized successfully")
        except Exception:
            logger.exception("Database initialization failed (url=%s)", config_db_url)
            raise

    def add_channel(self, channel_data):
        """Add or update channel data with datetime conversion"""
        session = self.Session()
        try:
            # Filter channel_data to only include columns that exist in Channel model
            valid_fields = {col.name for col in Channel.__table__.columns}
            filtered_data = {k: v for k, v in channel_data.items() if k in valid_fields}

            # Convert datetime strings to Python datetime objects
            if 'published_at' in filtered_data and filtered_data['published_at']:
                filtered_data['published_at'] = parse_datetime(filtered_data['published_at'])
            filtered_data['last_searched_at'] = utcnow()

            channel = session.query(Channel).filter_by(channel_id=channel_data["channel_id"]).first()

            if channel:
                # Update existing channel
                for key, value in filtered_data.items():
                    setattr(channel, key, value)
            else:
                # Create new channel with only valid columns
                channel = Channel(**filtered_data)
                session.add(channel)

            session.commit()
            session.refresh(channel)
            logger.info("Channel saved: %s", channel_data['title'])
            return {"success": True, "message": f"Channel '{channel_data['title']}' saved/updated"}
        except Exception as e:
            session.rollback()
            logger.exception("Channel save error (keys=%s)", list(channel_data.keys()))
            return {"success": False, "error": str(e)}
        finally:
            session.close()

    def add_video(self, video_data):
        """Add or update video data with datetime conversion"""
        session = self.Session()
        try:
            # Filter video_data to only include columns that exist in Video model
            valid_fields = {col.name for col in Video.__table__.columns}

            filtered_data = {k: v for k, v in video_data.items() if k in valid_fields}

            # Convert datetime strings to Python datetime objects
            if 'published_at' in filtered_data and filtered_data['published_at']:
                filtered_data['published_at'] = parse_datetime(filtered_data['published_at'])
            filtered_data['last_searched_at'] = utcnow()

            video = session.query(Video).filter_by(video_id=video_data["video_id"]).first()

            if video:
                # Update existing video
                for key, value in filtered_data.items():
                    setattr(video, key, value)
            else:
                # Create new video with only valid columns
                video = Video(**filtered_data)
                session.add(video)

            session.commit()
            session.refresh(video)  # Refresh to get the updated timestamp
            return {"success": True, "message": f"Video '{video_data['title']}' saved/updated"}
        except Exception as e:
            session.rollback()
            logger.exception("Video save error (video_id=%s)", video_data.get("video_id"))
            return {"success": False, "error": str(e)}
        finally:
            session.close()

    def get_channel(self, channel_id):
        """Get channel by ID"""
        session = self.Session()
        try:
            channel = session.query(Channel).filter_by(channel_id=channel_id).first()
            return channel.to_dict() if channel else None
        finally:
            session.close()

    def get_video(self, video_id):
        """Get video by ID"""
        session = self.Session()
        try:
            video = session.query(Video).filter_by(video_id=video_id).first()
            return video.to_dict() if video else None
        finally:
            session.close()

    def get_all_channels(self):
        """Get all channels from database"""
        session = self.Session()
        try:
            channels = session.query(Channel).order_by(
                func.coalesce(Channel.last_searched_at, Channel.fetched_at).desc()
            ).all()
            result = [channel.to_dict() for channel in channels]
            logger.debug("Retrieved %d channel(s) from database", len(result))
            return result
        except Exception:
            logger.exception("Error fetching channels")
            return []
        finally:
            session.close()

    def get_channel_videos(self, channel_id):
        """Get all videos of a channel"""
        session = self.Session()
        try:
            videos = session.query(Video).filter_by(channel_id=channel_id).all()
            result = [video.to_dict() for video in videos]
            logger.debug("Retrieved %d video(s) for channel %s", len(result), channel_id)
            return result
        except Exception:
            logger.exception("Error fetching videos for channel %s", channel_id)
            return []
        finally:
            session.close()

    def delete_channel(self, channel_id):
        """Delete channel and its videos"""
        session = self.Session()
        try:
            session.query(Video).filter_by(channel_id=channel_id).delete()
            session.query(Channel).filter_by(channel_id=channel_id).delete()
            session.commit()
            return {"success": True, "message": "Channel deleted"}
        except Exception as e:
            session.rollback()
            return {"success": False, "error": str(e)}
        finally:
            session.close()

    def delete_channel_videos(self, channel_id):
        """Delete all videos for a channel"""
        session = self.Session()
        try:
            session.query(Video).filter_by(channel_id=channel_id).delete()
            session.commit()
            return {"success": True, "message": "Channel videos deleted"}
        except Exception as e:
            session.rollback()
            return {"success": False, "error": str(e)}
        finally:
            session.close()

    def get_all_videos(self):
        """Get all videos from database"""
        session = self.Session()
        try:
            videos = session.query(Video).all()
            result = [video.to_dict() for video in videos]
            logger.debug("Retrieved %d video(s) from database", len(result))
            return result
        except Exception:
            logger.exception("Error fetching all videos")
            return []
        finally:
            session.close()

    def delete_video(self, video_id):
        """Delete a video by ID"""
        session = self.Session()
        try:
            session.query(Video).filter_by(video_id=video_id).delete()
            session.commit()
            return {"success": True, "message": "Video deleted"}
        except Exception as e:
            session.rollback()
            return {"success": False, "error": str(e)}
        finally:
            session.close()

    def get_statistics(self, channel_id):
        """Get aggregated statistics for a channel"""
        session = self.Session()
        try:
            videos = session.query(Video).filter_by(channel_id=channel_id).all()

            if not videos:
                return None

            total_views = sum([int(v.views) if v.views != "Private" else 0 for v in videos])
            total_likes = sum([int(v.likes) if v.likes != "Private" else 0 for v in videos])
            total_comments = sum([int(v.comments) if v.comments != "Private" else 0 for v in videos])

            return {
                "total_videos": len(videos),
                "total_views": total_views,
                "total_likes": total_likes,
                "total_comments": total_comments,
                "avg_views": total_views // len(videos) if videos else 0,
                "avg_likes": total_likes // len(videos) if videos else 0,
                "avg_comments": total_comments // len(videos) if videos else 0
            }
        finally:
            session.close()

    def get_channel_rpm(self, channel_id):
        """Get RPM setting for a channel"""
        session = self.Session()
        try:
            setting = session.query(ChannelSetting).filter_by(channel_id=channel_id).first()
            return setting.rpm if setting else None
        finally:
            session.close()

    def set_channel_rpm(self, channel_id, rpm):
        """Set RPM setting for a channel"""
        session = self.Session()
        try:
            setting = session.query(ChannelSetting).filter_by(channel_id=channel_id).first()
            if setting:
                setting.rpm = rpm
                setting.updated_at = utcnow()
            else:
                setting = ChannelSetting(channel_id=channel_id, rpm=rpm)
                session.add(setting)
            session.commit()
            return {"success": True, "rpm": setting.rpm}
        except Exception as e:
            session.rollback()
            return {"success": False, "error": str(e)}
        finally:
            session.close()

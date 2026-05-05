"""YouTube Analytics Platform - Core Package"""

__version__ = "1.0.0"
__author__ = "Your Name"

from youtube_analytics.database import DatabaseManager
from youtube_analytics.fetcher import YouTubeFetcher
from youtube_analytics.visualizer import YouTubeVisualizer

__all__ = [
    "YouTubeFetcher",
    "DatabaseManager",
    "YouTubeVisualizer",
]

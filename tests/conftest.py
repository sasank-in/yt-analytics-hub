"""Pytest configuration: isolate tests from the user's real environment.

- Each test gets a fresh file-based SQLite DB in a tmp dir
- A dummy YouTube API key is injected so module imports don't blow up
- The YouTube fetcher is replaced with a Mock so no test ever hits the network
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock

# Make the project package importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# These must be set BEFORE any application module is imported.
os.environ.setdefault("YOUTUBE_API_KEY", "test-key-do-not-use")
os.environ.setdefault("LOG_LEVEL", "WARNING")

import pytest  # noqa: E402


def _reset_modules():
    """Force re-import of app modules so they pick up the new DATABASE_URL."""
    for mod in list(sys.modules):
        if mod == "main_api" or mod.startswith("youtube_analytics"):
            sys.modules.pop(mod, None)


@pytest.fixture
def temp_db_url(tmp_path):
    """Point DATABASE_URL at a tmp-dir SQLite file for the duration of a test."""
    db_file = tmp_path / "test.db"
    url = f"sqlite:///{db_file}"
    old = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = url
    _reset_modules()
    yield url
    if old is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = old
    _reset_modules()


@pytest.fixture
def fake_fetcher():
    """A MagicMock standing in for the real YouTube fetcher."""
    return MagicMock()


@pytest.fixture
def db(temp_db_url):
    from youtube_analytics.database import DatabaseManager
    return DatabaseManager()


@pytest.fixture
def app_client(temp_db_url, fake_fetcher):
    """Return a TestClient with the YouTube fetcher swapped for a Mock."""
    from fastapi.testclient import TestClient

    # Override the fetcher singleton BEFORE main_api imports get_fetcher
    from youtube_analytics.api import deps
    deps.get_fetcher.cache_clear()
    deps.get_db.cache_clear()
    deps.get_fetcher = lambda: fake_fetcher  # type: ignore[assignment]

    # Re-import api/* so they capture the patched get_fetcher
    for mod in list(sys.modules):
        if mod.startswith("youtube_analytics.api") and mod != "youtube_analytics.api.deps":
            sys.modules.pop(mod, None)
    sys.modules.pop("main_api", None)

    import main_api
    return TestClient(main_api.app)


@pytest.fixture
def sample_channel():
    return {
        "channel_id": "UCtest123",
        "title": "Test Channel",
        "description": "A channel for testing",
        "custom_url": "@testchannel",
        "published_at": "2020-01-01T00:00:00Z",
        "subscribers": "12345",
        "total_views": "9876543",
        "total_videos": "42",
        "profile_image": "https://example.com/img.jpg",
        "banner_image": "https://example.com/banner.jpg",
    }


@pytest.fixture
def sample_video():
    return {
        "video_id": "vid_abc123",
        "channel_id": "UCtest123",
        "channel_title": "Test Channel",
        "title": "Sample video",
        "description": "Description here",
        "published_at": "2024-06-15T12:00:00Z",
        "duration": "PT5M30S",
        "views": "150000",
        "likes": "8000",
        "comments": "450",
        "thumbnail": "https://example.com/thumb.jpg",
    }

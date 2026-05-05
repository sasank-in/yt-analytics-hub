"""Shared service singletons.

Constructed lazily so test fixtures can swap `DATABASE_URL` and re-import
without paying the cost of a YouTube API client they'll never call.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from youtube_analytics.database import DatabaseManager
from youtube_analytics.fetcher import YouTubeFetcher

logger = logging.getLogger("creatorscope.api")

# Refetch threshold: skip wiping/refetching if a channel was searched
# within this window.
CHANNEL_REFRESH_SECONDS = int(os.getenv("CHANNEL_REFRESH_SECONDS", "86400"))


@lru_cache(maxsize=1)
def get_db() -> DatabaseManager:
    return DatabaseManager()


@lru_cache(maxsize=1)
def get_fetcher() -> YouTubeFetcher:
    return YouTubeFetcher()

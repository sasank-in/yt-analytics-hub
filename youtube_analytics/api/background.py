"""Background tasks invoked from the API layer."""

from __future__ import annotations

import logging
import os

from youtube_analytics.config import TOP_VIDEOS_LIMIT

from .deps import get_db, get_fetcher

logger = logging.getLogger("creatorscope.api")


def _current_strategy() -> str:
    """Read VIDEO_FETCH_STRATEGY each call so env changes (e.g. in tests)
    take effect without re-importing the module."""
    return os.getenv("VIDEO_FETCH_STRATEGY", "recent").strip().lower()


def _fetch_videos_from_youtube(fetcher, channel_id: str, debug: bool, strategy: str):
    """Dispatch to the configured fetch strategy.

    - "recent": chronological via playlistItems.list. Honest sample for
      cadence and decay analytics. Cheap on quota.
    - "top":    most-viewed via search.list. Useful when you specifically
      want "this channel's hits," but biases the time-series analytics.
    """
    if strategy == "top":
        return fetcher.get_channel_top_videos(
            channel_id, max_results=TOP_VIDEOS_LIMIT, return_debug=debug,
        )
    return fetcher.get_channel_recent_videos(
        channel_id, max_results=TOP_VIDEOS_LIMIT, return_debug=debug,
    )


def fetch_channel_videos(channel_id: str, debug: bool = False) -> dict:
    """Fetch the channel's videos from YouTube and persist them.

    Strategy is controlled by `VIDEO_FETCH_STRATEGY` env var (see config.py).
    """
    db = get_db()
    fetcher = get_fetcher()
    strategy = _current_strategy()
    try:
        result = _fetch_videos_from_youtube(fetcher, channel_id, debug, strategy)

        if isinstance(result, dict) and result.get("error"):
            logger.error("YouTube fetch failed for %s: %s", channel_id, result["error"])
            return {"error": result["error"], "saved": 0, "debug": result.get("debug")}

        videos = result["videos"] if debug and isinstance(result, dict) else result
        if not videos:
            logger.warning("No videos returned for channel %s", channel_id)
            return {
                "saved": 0,
                "debug": result.get("debug") if debug and isinstance(result, dict) else None,
            }

        # Wipe existing rows only AFTER we have new data in hand.
        db.delete_channel_videos(channel_id)
        saved = sum(
            1
            for v in videos
            if "error" not in v and db.add_video(v).get("success")
        )
        logger.info(
            "Saved %d/%d videos for %s (strategy=%s)",
            saved, len(videos), channel_id, strategy,
        )
        return {
            "saved": saved,
            "strategy": strategy,
            "debug": result.get("debug") if debug and isinstance(result, dict) else None,
        }
    except Exception as e:
        logger.exception("fetch_channel_videos failed for %s", channel_id)
        return {"error": str(e), "saved": 0}

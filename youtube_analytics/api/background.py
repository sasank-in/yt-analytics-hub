"""Background tasks invoked from the API layer."""

from __future__ import annotations

import logging

from youtube_analytics.config import TOP_VIDEOS_LIMIT

from .deps import get_db, get_fetcher

logger = logging.getLogger("creatorscope.api")


def fetch_channel_videos(channel_id: str, debug: bool = False) -> dict:
    """Fetch the channel's top videos from YouTube and persist them.

    Returns a small summary dict (used by both background invocations and the
    `?sync=true` synchronous form).
    """
    db = get_db()
    fetcher = get_fetcher()
    try:
        result = fetcher.get_channel_top_videos(
            channel_id, max_results=TOP_VIDEOS_LIMIT, return_debug=debug,
        )
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
        logger.info("Saved %d/%d videos for %s", saved, len(videos), channel_id)
        return {
            "saved": saved,
            "debug": result.get("debug") if debug and isinstance(result, dict) else None,
        }
    except Exception as e:
        logger.exception("fetch_channel_videos failed for %s", channel_id)
        return {"error": str(e), "saved": 0}

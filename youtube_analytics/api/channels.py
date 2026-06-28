"""Channel routes: search, list, detail, delete, RPM, video sub-routes."""

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Request

from youtube_analytics.analytics import compute_channel_analytics

from .background import fetch_channel_videos
from .deps import CHANNEL_REFRESH_SECONDS, get_db, get_fetcher
from .pagination import page_params, paginate
from .rate_limit import LIMITS, limiter
from .schemas import ChannelSearch, RPMUpdate

logger = logging.getLogger("creatorscope.api")

router = APIRouter(prefix="/api", tags=["channels"])


def _is_fresh(fetched_at) -> bool:
    """True if `fetched_at` is within the refresh window."""
    if not fetched_at:
        return False
    if isinstance(fetched_at, str):
        try:
            fetched_at = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
        except ValueError:
            return False
    now = datetime.now(timezone.utc)
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    return (now - fetched_at).total_seconds() < CHANNEL_REFRESH_SECONDS


@router.post("/channel/search")
@limiter.limit(LIMITS["channel_search"])
async def search_channel(
    request: Request,
    background_tasks: BackgroundTasks,
    search: Annotated[ChannelSearch, Body()],
):
    """Search a channel by ID or name.

    Idempotent: returns the cached row when last fetched within
    `CHANNEL_REFRESH_SECONDS` (env-configurable, default 24 h).
    """
    fetcher = get_fetcher()
    db = get_db()
    try:
        if search.search_type == "id":
            channel_data = fetcher.get_channel_by_id(search.query)
        else:
            channel_data = fetcher.get_channel_by_name(search.query)

        if "error" in channel_data:
            raise HTTPException(status_code=404, detail=channel_data["error"])

        existing = db.get_channel(channel_data["channel_id"])
        if existing and _is_fresh(existing.get("fetched_at")):
            logger.info("Channel %s is fresh; skipping refetch", channel_data["channel_id"])
            return existing

        db.add_channel(channel_data)
        background_tasks.add_task(fetch_channel_videos, channel_data["channel_id"])
        return channel_data
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("search_channel failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/channels")
async def get_all_channels(paging: tuple[int, int] = Depends(page_params)):
    """List all saved channels.

    Paginated; response includes both legacy `channels`/`count` keys for
    older clients and the new `items`/`total`/`page`/`pages`/`size` envelope.
    """
    rows = get_db().get_all_channels()
    page, size = paging
    p = paginate(rows, page, size)
    return {"channels": p["items"], "count": p["total"], **p}


@router.get("/channel/{channel_id}")
async def get_channel_details(channel_id: str):
    db = get_db()
    channel = db.get_channel(channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    videos = db.get_channel_videos(channel_id)
    return {
        "channel": channel,
        "statistics": db.get_statistics(channel_id),
        "videos": videos,
        "videos_count": len(videos),
    }


@router.post("/channel/{channel_id}/videos/fetch")
@limiter.limit(LIMITS["videos_fetch"])
async def fetch_channel_videos_endpoint(
    request: Request,
    channel_id: str,
    background_tasks: BackgroundTasks,
    sync: bool = False,
    debug: bool = False,
):
    """Fetch and save the top videos for a channel.

    `sync=true` runs in-request and returns a summary; otherwise the work
    runs in the background and the response returns immediately.
    """
    if sync:
        result = fetch_channel_videos(channel_id, debug=debug)
        if result.get("error"):
            raise HTTPException(status_code=502, detail=result["error"])
        response = {"message": "Fetch complete", "channel_id": channel_id, "saved": result.get("saved", 0)}
        if debug:
            response["debug"] = result.get("debug")
        return response

    background_tasks.add_task(fetch_channel_videos, channel_id)
    return {"message": "Fetching videos in background", "channel_id": channel_id}


@router.get("/channel/{channel_id}/videos")
async def get_channel_videos(channel_id: str, limit: int = 50):
    """Return the channel's stored videos sorted by view count."""
    db = get_db()

    def _views(v: dict) -> int:
        try:
            return int(v.get("views") or 0)
        except (ValueError, TypeError):
            return 0

    rows = sorted(db.get_channel_videos(channel_id), key=_views, reverse=True)
    if limit:
        rows = rows[:limit]
    return {
        "videos": rows,
        "count": len(rows),
        "statistics": db.get_statistics(channel_id),
    }


@router.get("/channel/{channel_id}/analytics")
async def channel_analytics(channel_id: str):
    """Advanced analytics for a channel.

    See `youtube_analytics.analytics.compute_channel_analytics` for the
    full schema. Computes cadence, publish pattern, engagement-vs-views
    correlation, title-length impact, health score, decay exponent,
    earnings cone, and composite ranking.
    """
    db = get_db()
    channel = db.get_channel(channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    videos = db.get_channel_videos(channel_id)
    rpm = db.get_channel_rpm(channel_id)
    try:
        subscribers = int(channel.get("subscribers") or 0)
    except (ValueError, TypeError):
        subscribers = 0
    return compute_channel_analytics(videos, rpm, subscribers=subscribers)


@router.delete("/channel/{channel_id}")
async def delete_channel(channel_id: str):
    get_db().delete_channel(channel_id)
    return {"message": "Channel deleted successfully", "channel_id": channel_id}


@router.get("/channel/{channel_id}/rpm")
async def get_channel_rpm(channel_id: str):
    return {"channel_id": channel_id, "rpm": get_db().get_channel_rpm(channel_id)}


@router.put("/channel/{channel_id}/rpm")
async def set_channel_rpm(channel_id: str, payload: RPMUpdate):
    result = get_db().set_channel_rpm(channel_id, payload.rpm)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
    return {"channel_id": channel_id, "rpm": result.get("rpm")}

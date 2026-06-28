"""Video routes: search (POST + GET), detail, list, delete."""

import logging
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from .deps import get_db, get_fetcher
from .pagination import page_params, paginate
from .rate_limit import LIMITS, limiter
from .schemas import VideoSearch

logger = logging.getLogger("creatorscope.api")

router = APIRouter(prefix="/api", tags=["videos"])


def _search_video_by_id(video_id: str) -> dict:
    """Shared YouTube → DB lookup used by both POST and GET search endpoints."""
    data = get_fetcher().get_video_by_id(video_id)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    get_db().add_video(data)
    return {"videos": [data]}


@router.post("/video/search")
@limiter.limit(LIMITS["video_search"])
async def search_video(request: Request, video: Annotated[VideoSearch, Body()]):
    return _search_video_by_id(video.video_id)


@router.get("/video/search")
@limiter.limit(LIMITS["video_search"])
async def search_video_get(request: Request, q: str):
    return _search_video_by_id(q)


@router.get("/video/{video_id}")
async def get_video_details(video_id: str):
    video = get_db().get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.get("/videos")
async def get_all_videos(paging: tuple[int, int] = Depends(page_params)):
    """List all saved videos.

    Paginated; response includes both legacy `videos`/`count` keys and the
    new `items`/`total`/`page`/`pages`/`size` envelope.
    """
    rows = get_db().get_all_videos()
    page, size = paging
    p = paginate(rows, page, size)
    return {"videos": p["items"], "count": p["total"], **p}


@router.delete("/video/{video_id}")
async def delete_video(video_id: str):
    result = get_db().delete_video(video_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
    return {"message": "Video deleted successfully", "video_id": video_id}

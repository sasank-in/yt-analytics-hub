"""YouTube Analytics - FastAPI Backend Application

Professional and production-ready FastAPI backend for YouTube analytics.
Provides RESTful API endpoints for YouTube data management.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from youtube_analytics.fetcher import YouTubeFetcher
from youtube_analytics.database import DatabaseManager
from youtube_analytics.config import TOP_VIDEOS_LIMIT, LOG_LEVEL
from youtube_analytics.visualizer import YouTubeVisualizer
from pydantic import BaseModel, Field
from typing import List, Optional

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("youtube_analytics.api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("YouTube Analytics API starting up")
    yield
    logger.info("YouTube Analytics API shutting down")


app = FastAPI(
    title="YouTube Analytics Pro",
    description="Professional YouTube channel analytics and insights",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS: default to localhost only; override with CORS_ORIGINS env (comma-separated).
_default_origins = "http://localhost:8000,http://127.0.0.1:8000"
_cors_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", _default_origins).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Refetch threshold: skip wiping/refetching if a channel was searched within this window.
CHANNEL_REFRESH_SECONDS = int(os.getenv("CHANNEL_REFRESH_SECONDS", "86400"))

# Initialize services
fetcher = YouTubeFetcher()
db = DatabaseManager()
visualizer = YouTubeVisualizer()

# Frontend assets live inside the package so `pip install` can ship them.
PACKAGE_DIR = Path(__file__).resolve().parent / "youtube_analytics"
STATIC_DIR = PACKAGE_DIR / "static"
TEMPLATES_DIR = PACKAGE_DIR / "templates"

# Mount static files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ==================== Pydantic Models ====================
class ChannelSearch(BaseModel):
    """Channel search request model"""
    query: str
    search_type: str = "name"  # "id" or "name"


class VideoSearch(BaseModel):
    """Video search request model"""
    video_id: str


class RPMUpdate(BaseModel):
    """RPM update payload"""
    rpm: float = Field(ge=0)


class ChannelResponse(BaseModel):
    """Channel response model"""
    channel_id: str
    title: str
    subscribers: Optional[str]
    total_views: Optional[str]
    total_videos: Optional[str]
    description: Optional[str]
    profile_image: Optional[str]


# ==================== API Routes ====================

@app.get("/")
async def root():
    """Serve main HTML page"""
    return FileResponse(TEMPLATES_DIR / "index.html", media_type="text/html")


@app.get("/favicon.ico")
async def favicon():
    """Serve favicon to avoid 404 noise in browser console."""
    icon_path = STATIC_DIR / "favicon.ico"
    if icon_path.exists():
        return FileResponse(icon_path)
    return Response(status_code=204)


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "YouTube Analytics Pro",
        "version": "2.0.0"
    }


@app.post("/api/channel/search")
async def search_channel(search: ChannelSearch, background_tasks: BackgroundTasks):
    """Search for a channel by ID or name.

    Idempotent: if the channel was fetched within CHANNEL_REFRESH_SECONDS,
    return the cached row and skip the YouTube refetch.
    """
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

        # Upsert channel metadata (no destructive delete — videos are refreshed
        # atomically inside fetch_channel_videos via delete_channel_videos
        # only after a successful API call).
        db.add_channel(channel_data)

        background_tasks.add_task(fetch_channel_videos, channel_data['channel_id'])

        return channel_data
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("search_channel failed")
        raise HTTPException(status_code=500, detail=str(e))


def _is_fresh(fetched_at) -> bool:
    """True if fetched_at is within the refresh window."""
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


@app.get("/api/channels")
async def get_all_channels():
    """Get all saved channels"""
    try:
        channels = db.get_all_channels()
        return {"channels": channels, "count": len(channels)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/videos")
async def get_all_videos():
    """Get all saved videos"""
    try:
        videos = db.get_all_videos()
        return {"videos": videos, "count": len(videos)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/channel/{channel_id}")
async def get_channel_details(channel_id: str):
    """Get detailed channel information"""
    try:
        channel_data = db.get_channel(channel_id)
        if not channel_data:
            raise HTTPException(status_code=404, detail="Channel not found")
        
        stats = db.get_statistics(channel_id)
        videos = db.get_channel_videos(channel_id)
        
        return {
            "channel": channel_data,
            "statistics": stats,
            "videos": videos,
            "videos_count": len(videos)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/channel/{channel_id}/videos/fetch")
async def fetch_channel_videos_endpoint(
    channel_id: str,
    background_tasks: BackgroundTasks,
    sync: bool = False,
    debug: bool = False
):
    """Fetch and save videos for a channel"""
    try:
        if sync:
            result = fetch_channel_videos(channel_id, debug=debug)
            if result.get("error"):
                raise HTTPException(status_code=502, detail=result["error"])
            response = {
                "message": "Fetch complete",
                "channel_id": channel_id,
                "saved": result.get("saved", 0)
            }
            if debug:
                response["debug"] = result.get("debug")
            return response
        background_tasks.add_task(fetch_channel_videos, channel_id)
        return {"message": "Fetching videos in background", "channel_id": channel_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/channel/{channel_id}/videos")
async def get_channel_videos(channel_id: str, limit: int = 50, include_charts: bool = False):
    """Get videos for a channel"""
    try:
        all_videos = db.get_channel_videos(channel_id)
        if limit:
            def _views_int(v):
                try:
                    return int(v.get("views") or 0)
                except Exception:
                    return 0
            videos = sorted(all_videos, key=_views_int, reverse=True)[:limit]
        else:
            videos = all_videos
        stats = db.get_statistics(channel_id)
        
        # Generate charts only when requested (frontend uses client-side charts)
        charts = {}
        if include_charts and videos:
            charts = generate_visualizations(channel_id, videos)
        
        return {
            "videos": videos,
            "count": len(videos),
            "statistics": stats,
            "charts": charts
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _search_video_by_id(video_id: str) -> dict:
    """Shared video lookup logic used by POST and GET search endpoints."""
    video_data = fetcher.get_video_by_id(video_id)
    if "error" in video_data:
        raise HTTPException(status_code=404, detail=video_data["error"])
    db.add_video(video_data)
    return {"videos": [video_data]}


@app.post("/api/video/search")
async def search_video(video: VideoSearch):
    """Search for a video by ID"""
    try:
        return _search_video_by_id(video.video_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("search_video failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/video/search")
async def search_video_get(q: str):
    """Search for a video by ID (GET method)"""
    try:
        return _search_video_by_id(q)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("search_video_get failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/video/{video_id}")
async def get_video_details(video_id: str):
    """Get a video from the database by ID"""
    try:
        video = db.get_video(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        return video
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/statistics/{channel_id}")
async def get_statistics(channel_id: str):
    """Get statistics for a channel"""
    try:
        stats = db.get_statistics(channel_id)
        if not stats:
            raise HTTPException(status_code=404, detail="Statistics not found")
        
        return stats
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/channel/{channel_id}/rpm")
async def get_channel_rpm(channel_id: str):
    """Get RPM setting for a channel"""
    try:
        rpm = db.get_channel_rpm(channel_id)
        return {"channel_id": channel_id, "rpm": rpm}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/channel/{channel_id}/rpm")
async def set_channel_rpm(channel_id: str, payload: RPMUpdate):
    """Set RPM setting for a channel"""
    try:
        result = db.set_channel_rpm(channel_id, payload.rpm)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
        return {"channel_id": channel_id, "rpm": result.get("rpm")}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("set_channel_rpm failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/channel/{channel_id}")
async def delete_channel(channel_id: str):
    """Delete a channel and its videos"""
    try:
        db.delete_channel(channel_id)
        return {"message": "Channel deleted successfully", "channel_id": channel_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/video/{video_id}")
async def delete_video(video_id: str):
    """Delete a video by ID"""
    try:
        result = db.delete_video(video_id)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
        return {"message": "Video deleted successfully", "video_id": video_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Background Tasks ====================

def fetch_channel_videos(channel_id: str, debug: bool = False):
    """Fetch and save top channel videos only. Returns summary for sync calls."""
    try:
        fetch_result = fetcher.get_channel_top_videos(
            channel_id,
            max_results=TOP_VIDEOS_LIMIT,
            return_debug=debug
        )

        if isinstance(fetch_result, dict) and fetch_result.get("error"):
            logger.error("Error fetching videos for channel %s: %s", channel_id, fetch_result["error"])
            return {"error": fetch_result["error"], "saved": 0, "debug": fetch_result.get("debug")}

        videos = fetch_result["videos"] if debug and isinstance(fetch_result, dict) else fetch_result

        if not videos:
            logger.warning("No videos returned from API for channel: %s", channel_id)
            return {"saved": 0, "debug": fetch_result.get("debug") if debug and isinstance(fetch_result, dict) else None}

        # Wipe existing videos for this channel before saving new top list
        db.delete_channel_videos(channel_id)

        saved = 0
        for video in videos:
            if "error" not in video:
                result = db.add_video(video)
                if result.get("success"):
                    saved += 1
        logger.info("Fetched %d videos for channel %s, saved %d", len(videos), channel_id, saved)
        return {"saved": saved, "debug": fetch_result.get("debug") if debug and isinstance(fetch_result, dict) else None}
    except Exception as e:
        logger.exception("Error fetching videos for channel %s", channel_id)
        return {"error": str(e), "saved": 0}


def generate_visualizations(channel_id: str, videos: List[dict]) -> dict:
    """Generate visualization data from videos"""
    try:
        charts = {}
        
        if videos:
            # Video views distribution
            views_data = visualizer.plot_top_videos(channel_id)
            if views_data:
                charts["top_videos"] = views_data
            
            # Engagement metrics
            engagement_data = visualizer.plot_engagement_metrics(channel_id)
            if engagement_data:
                charts["engagement"] = engagement_data
            
            # Publishing timeline
            timeline_data = visualizer.plot_publishing_timeline(channel_id)
            if timeline_data:
                charts["timeline"] = timeline_data
        
        return charts
    except Exception as e:
        logger.exception("Error generating visualizations for channel %s", channel_id)
        return {}


# ==================== Error Handlers ====================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all handler to return JSON for unexpected errors."""
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "status_code": 500}
    )


if __name__ == "__main__":
    import uvicorn
    import sys

    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            port = 8000

    host = os.getenv("HOST", "127.0.0.1")
    logger.info("Starting server on http://%s:%d", host, port)
    uvicorn.run(app, host=host, port=port)

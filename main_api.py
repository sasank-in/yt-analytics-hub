"""YouTube Analytics - FastAPI Backend Application

Professional and production-ready FastAPI backend for YouTube analytics.
Provides RESTful API endpoints for YouTube data management.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
from youtube_analytics.fetcher import YouTubeFetcher
from youtube_analytics.database import DatabaseManager
from youtube_analytics.visualizer import YouTubeVisualizer
from pydantic import BaseModel
from typing import List, Optional
import json

# Initialize FastAPI app
app = FastAPI(
    title="YouTube Analytics Pro",
    description="Professional YouTube channel analytics and insights",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
fetcher = YouTubeFetcher()
db = DatabaseManager()
visualizer = YouTubeVisualizer()

# Current directory
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# Create directories if they don't exist
STATIC_DIR.mkdir(exist_ok=True)
TEMPLATES_DIR.mkdir(exist_ok=True)

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
    """Search for a channel by ID or name"""
    try:
        if search.search_type == "id":
            channel_data = fetcher.get_channel_by_id(search.query)
        else:
            channel_data = fetcher.get_channel_by_name(search.query)
        
        if "error" in channel_data:
            raise HTTPException(status_code=404, detail=channel_data["error"])
        
        # Save channel to database
        db.add_channel(channel_data)
        
        # Fetch videos in background
        background_tasks.add_task(fetch_channel_videos, channel_data['channel_id'])
        
        return channel_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
async def fetch_channel_videos_endpoint(channel_id: str, background_tasks: BackgroundTasks):
    """Fetch and save videos for a channel"""
    try:
        background_tasks.add_task(fetch_channel_videos, channel_id)
        return {"message": "Fetching videos in background", "channel_id": channel_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/channel/{channel_id}/videos")
async def get_channel_videos(channel_id: str, limit: int = 50):
    """Get videos for a channel"""
    try:
        all_videos = db.get_channel_videos(channel_id)
        videos = all_videos[:limit] if limit else all_videos
        stats = db.get_statistics(channel_id)
        
        # Generate charts
        charts = {}
        if videos:
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


@app.post("/api/video/search")
async def search_video(video: VideoSearch):
    """Search for a video by ID"""
    try:
        video_data = fetcher.get_video_by_id(video.video_id)
        
        if "error" in video_data:
            raise HTTPException(status_code=404, detail=video_data["error"])
        
        # Save video to database if channel exists
        db.add_video(video_data)
        
        return {"videos": [video_data]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/video/search")
async def search_video_get(q: str):
    """Search for a video by ID (GET method)"""
    try:
        video_data = fetcher.get_video_by_id(q)
        
        if "error" in video_data:
            raise HTTPException(status_code=404, detail=video_data["error"])
        
        # Save video to database if channel exists
        db.add_video(video_data)
        
        return {"videos": [video_data]}
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


# ==================== Background Tasks ====================

def fetch_channel_videos(channel_id: str):
    """Background task to fetch and save channel videos"""
    try:
        videos = fetcher.get_channel_videos(channel_id, max_results=50)
        if isinstance(videos, list):
            for video in videos:
                if "error" not in video:
                    db.add_video(video)
    except Exception as e:
        print(f"Error fetching videos: {e}")


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
        print(f"Error generating visualizations: {e}")
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


# ==================== Startup/Shutdown ====================

@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    print("YouTube Analytics API started")
    print("Backend: FastAPI")
    print("Database: SQLite")
    print("Frontend: Vanilla JavaScript + Corporate Design")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("YouTube Analytics API shutdown")


if __name__ == "__main__":
    import uvicorn
    import sys
    
    # Allow port configuration
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            port = 8000
    
    print(f"Starting server on http://localhost:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port)

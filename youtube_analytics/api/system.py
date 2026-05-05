"""System-level routes: root HTML, favicon, health."""

from pathlib import Path

from fastapi import APIRouter, Response
from fastapi.responses import FileResponse

PACKAGE_DIR = Path(__file__).resolve().parent.parent  # youtube_analytics/
STATIC_DIR = PACKAGE_DIR / "static"
TEMPLATES_DIR = PACKAGE_DIR / "templates"

router = APIRouter()


@router.get("/", include_in_schema=False)
async def root():
    """Serve the single-page app shell."""
    return FileResponse(TEMPLATES_DIR / "index.html", media_type="text/html")


@router.get("/favicon.ico", include_in_schema=False)
async def favicon():
    icon = STATIC_DIR / "favicon.ico"
    if icon.exists():
        return FileResponse(icon)
    return Response(status_code=204)


@router.get("/api/health", tags=["system"])
async def health_check():
    """Liveness probe for orchestrators."""
    return {"status": "healthy", "service": "creatorscope", "version": "2.0.0"}

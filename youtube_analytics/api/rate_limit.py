"""Per-IP rate limiting for mutating + quota-burning endpoints.

Uses slowapi which wraps `limits` and integrates with FastAPI.

Defaults:
    POST /api/channel/search           → 30/min
    POST /api/video/search             → 60/min
    GET  /api/video/search             → 60/min
    POST /api/channel/{id}/videos/fetch → 10/min  (each call burns ~100 quota units)

Override via env:
    RATE_LIMIT_CHANNEL_SEARCH  = "30/minute"
    RATE_LIMIT_VIDEO_SEARCH    = "60/minute"
    RATE_LIMIT_VIDEOS_FETCH    = "10/minute"
    RATE_LIMIT_DISABLED        = "1"   (turns the whole thing off — for tests)
"""

from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


def _env(key: str, default: str) -> str:
    return os.getenv(key, default).strip() or default


# Limits are read once at import. Tests that need to bypass the limiter set
# RATE_LIMIT_DISABLED=1 in their fixtures before importing the app.
RATE_LIMIT_DISABLED = os.getenv("RATE_LIMIT_DISABLED", "0") == "1"

LIMITS = {
    "channel_search": _env("RATE_LIMIT_CHANNEL_SEARCH", "30/minute"),
    "video_search":   _env("RATE_LIMIT_VIDEO_SEARCH",   "60/minute"),
    "videos_fetch":   _env("RATE_LIMIT_VIDEOS_FETCH",   "10/minute"),
}

limiter = Limiter(
    key_func=get_remote_address,
    enabled=not RATE_LIMIT_DISABLED,
    default_limits=[],  # opt-in per route via decorator
)


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return a JSON 429 with a retry hint instead of slowapi's HTML default."""
    return JSONResponse(
        status_code=429,
        content={
            "error": f"Rate limit exceeded: {exc.detail}. Slow down and retry shortly.",
            "status_code": 429,
        },
        headers={"Retry-After": "60"},
    )


def attach(app: FastAPI) -> None:
    """Install the limiter + custom 429 handler onto the app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

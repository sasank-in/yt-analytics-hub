"""Opt-in `X-API-Key` authentication.

When the env var `APP_API_KEY` is set, every request to a protected route
must include a matching `X-API-Key` header. When unset, the dependency is a
no-op so local dev / portfolio demos keep working.

Public routes (no key needed even when auth is on):
    GET /                         — frontend shell
    GET /favicon.ico
    GET /api/health               — liveness probe
    GET /docs, /redoc, /openapi.json  — handled by FastAPI itself, not these
                                     routes; protected routes still 401 inside

Why a header instead of a query string:
- doesn't leak into server logs / referer headers
- compatible with curl / fetch / HTTPX
"""

from __future__ import annotations

import logging
import os
import secrets

from fastapi import Header, HTTPException, status

logger = logging.getLogger("creatorscope.api")

_HEADER_NAME = "X-API-Key"


def _expected_key() -> str | None:
    """The configured key, or None to disable auth entirely."""
    key = os.getenv("APP_API_KEY", "").strip()
    return key or None


async def require_api_key(
    x_api_key: str | None = Header(default=None, alias=_HEADER_NAME),
) -> None:
    """FastAPI dependency. Raises 401 when auth is on and the header is bad."""
    expected = _expected_key()
    if expected is None:
        return  # auth disabled — anything goes (local dev / portfolio demo)
    if x_api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Missing {_HEADER_NAME} header",
            headers={"WWW-Authenticate": _HEADER_NAME},
        )
    # Constant-time compare so we don't leak the key via timing side-channels.
    if not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": _HEADER_NAME},
        )


def is_auth_enabled() -> bool:
    return _expected_key() is not None

"""HTTP layer for Creatorscope.

Routes are split across modules by resource. `register_routes(app)` wires them
all up. Shared service singletons (DatabaseManager, YouTubeFetcher) are exposed
via `youtube_analytics.api.deps`.
"""

from fastapi import Depends, FastAPI

from . import auth, channels, errors, rate_limit, statistics, system, videos


def register_routes(app: FastAPI) -> None:
    """Mount all API routers, the rate limiter, and exception handlers.

    When APP_API_KEY is set, every router except `system` requires the
    `X-API-Key` header. The health endpoint stays open so orchestrators
    can still probe.
    """
    rate_limit.attach(app)

    # System router (root, favicon, health) is always open.
    app.include_router(system.router)

    # Protected routers — auth dependency is a no-op when APP_API_KEY is unset.
    protected_deps = [Depends(auth.require_api_key)]
    app.include_router(channels.router, dependencies=protected_deps)
    app.include_router(videos.router, dependencies=protected_deps)
    app.include_router(statistics.router, dependencies=protected_deps)

    errors.register(app)


__all__ = ["register_routes"]

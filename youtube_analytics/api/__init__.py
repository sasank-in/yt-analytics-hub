"""HTTP layer for Creatorscope.

Routes are split across modules by resource. `register_routes(app)` wires them
all up. Shared service singletons (DatabaseManager, YouTubeFetcher) are exposed
via `youtube_analytics.api.deps`.
"""

from fastapi import FastAPI

from . import channels, errors, statistics, system, videos


def register_routes(app: FastAPI) -> None:
    """Mount all API routers and exception handlers onto `app`."""
    app.include_router(system.router)
    app.include_router(channels.router)
    app.include_router(videos.router)
    app.include_router(statistics.router)
    errors.register(app)


__all__ = ["register_routes"]

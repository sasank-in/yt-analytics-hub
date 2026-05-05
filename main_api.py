"""Creatorscope — FastAPI entrypoint.

The application factory is in `youtube_analytics.api`. This module exists so
that `python main_api.py [port]` and `uvicorn main_api:app` continue to work.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from youtube_analytics.api import register_routes
from youtube_analytics.api.system import STATIC_DIR
from youtube_analytics.config import LOG_LEVEL

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("creatorscope.api")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Creatorscope API starting up")
    yield
    logger.info("Creatorscope API shutting down")


def create_app() -> FastAPI:
    """Build and configure the FastAPI app."""
    app = FastAPI(
        title="Creatorscope API",
        description="Self-hosted YouTube analytics workbench — channels, videos, engagement, earnings.",
        version="2.0.0",
        lifespan=lifespan,
    )

    # CORS: default to localhost only; override with CORS_ORIGINS (comma-separated).
    default_origins = "http://localhost:8000,http://127.0.0.1:8000"
    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", default_origins).split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    register_routes(app)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    port = 8000
    if len(sys.argv) > 1:
        with suppress(ValueError):
            port = int(sys.argv[1])

    host = os.getenv("HOST", "127.0.0.1")
    logger.info("Starting server on http://%s:%d", host, port)
    uvicorn.run(app, host=host, port=port)

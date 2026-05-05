"""Centralised exception handlers — return JSON, never HTML stack traces."""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse


def register(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail, "status_code": exc.status_code},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"error": str(exc), "status_code": 500},
        )

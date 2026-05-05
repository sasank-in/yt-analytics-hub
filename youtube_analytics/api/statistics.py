"""Aggregated statistics endpoints."""

from fastapi import APIRouter, HTTPException

from .deps import get_db

router = APIRouter(prefix="/api", tags=["statistics"])


@router.get("/statistics/{channel_id}")
async def get_statistics(channel_id: str):
    stats = get_db().get_statistics(channel_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Statistics not found")
    return stats

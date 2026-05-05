"""Pydantic request/response models shared across routers."""

from pydantic import BaseModel, Field


class ChannelSearch(BaseModel):
    """Channel search request payload."""
    query: str
    search_type: str = Field(default="name", description='"id" or "name"')


class VideoSearch(BaseModel):
    """Video search request payload."""
    video_id: str


class RPMUpdate(BaseModel):
    """RPM (USD per 1,000 views) update payload."""
    rpm: float = Field(ge=0, description="Non-negative revenue per mille")

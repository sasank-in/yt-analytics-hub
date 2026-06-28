"""Shared pagination helpers.

Public envelope:
    {
        "items":   [...],    # current page
        "total":   N,        # full unpaginated count
        "page":    P,        # 1-indexed
        "pages":   M,        # ceil(total / size)
        "size":    K,        # page size used
    }

Backward-compat note: callers can mirror `items` under a domain-specific
key (e.g. `channels`, `videos`) and `total` under `count` for older clients.
"""

from __future__ import annotations

from typing import Any

from fastapi import Query

MAX_PAGE_SIZE = 200
DEFAULT_PAGE_SIZE = 50


def page_params(
    page: int = Query(1, ge=1, description="1-indexed page"),
    size: int = Query(
        DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE,
        description=f"Items per page (1–{MAX_PAGE_SIZE})",
    ),
) -> tuple[int, int]:
    """FastAPI dependency yielding (page, size)."""
    return page, size


def paginate(rows: list[Any], page: int, size: int) -> dict[str, Any]:
    """Slice rows in memory.

    For tables in the tens-of-thousands range this is fine; if the project
    ever moves to Postgres + larger tables, swap this for a `LIMIT/OFFSET`
    SQL query in DatabaseManager.
    """
    total = len(rows)
    pages = (total + size - 1) // size if size else 1
    start = (page - 1) * size
    sliced = rows[start : start + size]
    return {
        "items": sliced,
        "total": total,
        "page": page,
        "pages": max(pages, 1),
        "size": size,
    }

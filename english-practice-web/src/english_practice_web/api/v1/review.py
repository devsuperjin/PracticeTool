from __future__ import annotations

from fastapi import APIRouter, Query

from ...data import _phrase_index
from ...memory import build_review_queue
from ...store import get_all_marks

router = APIRouter()


@router.get("/review")
def review_queue(
    limit: int = Query(default=80, ge=1, le=1000),
    minutes: int = Query(default=0, ge=0, le=180),
    mode: str = Query(default="balanced", pattern="^(balanced|aggressive)$"),
    include_new: bool = True,
    include_later: bool = False,
) -> dict:
    return build_review_queue(
        _phrase_index,
        get_all_marks(),
        limit=limit,
        minutes=minutes,
        mode=mode,
        include_new=include_new,
        include_later=include_later,
    )

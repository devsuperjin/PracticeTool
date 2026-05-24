from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...models import MarkRequest
from ...store import delete_mark, get_all_marks, get_mark, save_mark

router = APIRouter()


@router.get("/marks")
def list_marks() -> dict[str, dict]:
    return get_all_marks()


@router.get("/marks/{phrase:path}")
def get_one_mark(phrase: str) -> dict:
    mark = get_mark(phrase)
    if not mark:
        raise HTTPException(status_code=404, detail="Mark not found")
    return mark


@router.post("/marks/{phrase:path}")
def save_one_mark(phrase: str, payload: MarkRequest) -> dict:
    return save_mark(phrase, payload.status)


@router.delete("/marks/{phrase:path}")
def delete_one_mark(phrase: str) -> dict[str, str]:
    delete_mark(phrase)
    return {"status": "deleted", "phrase": phrase}

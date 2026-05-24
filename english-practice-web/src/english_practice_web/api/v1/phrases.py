from __future__ import annotations

import random

from fastapi import APIRouter, HTTPException

from ...data import phrasal_data, _phrase_index

router = APIRouter()


@router.get("/next")
def next_phrase() -> dict:
    if not phrasal_data:
        raise HTTPException(status_code=500, detail="Phrasal data unavailable")
    entry = random.choice(phrasal_data)
    phrase = entry["phrase"]
    return {
        "phrase": phrase,
        "meanings": _phrase_index[phrase],
        "example": entry["example"],
    }


@router.get("/list")
def list_phrases() -> list[dict]:
    """Return unique phrases with their meanings."""
    result = []
    for phrase, meanings in sorted(_phrase_index.items()):
        result.append({
            "phrase": phrase,
            "meanings": meanings,
            "example": meanings[0]["example"],
        })
    return result

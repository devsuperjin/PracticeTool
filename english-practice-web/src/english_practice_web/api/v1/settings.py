from __future__ import annotations

from fastapi import APIRouter

from ...ollama import llm_settings

router = APIRouter()


@router.get("/settings")
def get_settings() -> dict[str, object]:
    return {"llm": llm_settings()}

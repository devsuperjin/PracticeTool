from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ...models import PlanRequest
from ...store import delete_plan, get_plan, list_plans, save_plan

router = APIRouter()


@router.get("/plans")
def api_list() -> list[dict]:
    return list_plans()


@router.get("/plans/{name:path}")
def api_get(name: str) -> dict:
    plan = get_plan(name)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.post("/plans")
def api_save(payload: PlanRequest) -> dict:
    return save_plan(payload.name, payload.words)


@router.delete("/plans/{name:path}")
def api_delete(name: str) -> dict[str, str]:
    if not delete_plan(name):
        raise HTTPException(status_code=404, detail="Plan not found")
    return {"status": "deleted", "name": name}

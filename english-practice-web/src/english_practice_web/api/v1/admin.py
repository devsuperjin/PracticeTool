from __future__ import annotations

from fastapi import APIRouter

from ...store import reset_db

router = APIRouter()


@router.post("/admin/reset")
def reset_system() -> dict[str, str]:
    """Reset all data: drop and recreate database tables."""
    reset_db()
    return {"status": "ok", "message": "Database reset successfully"}

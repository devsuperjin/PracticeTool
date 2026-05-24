from __future__ import annotations

from fastapi import APIRouter

from . import admin, check, marks, notes, phrases, plans, reading

router = APIRouter()
router.include_router(phrases.router, tags=["phrases"])
router.include_router(check.router, tags=["check"])
router.include_router(notes.router, tags=["notes"])
router.include_router(plans.router, tags=["plans"])
router.include_router(reading.router, tags=["reading"])
router.include_router(marks.router, tags=["marks"])
router.include_router(admin.router, tags=["admin"])

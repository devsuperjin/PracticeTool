from __future__ import annotations

from fastapi import APIRouter, Depends

from ...auth import require_current_user
from . import admin, auth, check, marks, notes, phrases, plans, reading, review, settings

router = APIRouter()
_protected = [Depends(require_current_user)]

router.include_router(auth.router, tags=["auth"])
router.include_router(phrases.router, tags=["phrases"], dependencies=_protected)
router.include_router(check.router, tags=["check"], dependencies=_protected)
router.include_router(notes.router, tags=["notes"], dependencies=_protected)
router.include_router(plans.router, tags=["plans"], dependencies=_protected)
router.include_router(reading.router, tags=["reading"], dependencies=_protected)
router.include_router(marks.router, tags=["marks"], dependencies=_protected)
router.include_router(review.router, tags=["review"], dependencies=_protected)
router.include_router(settings.router, tags=["settings"], dependencies=_protected)
router.include_router(admin.router, tags=["admin"], dependencies=_protected)

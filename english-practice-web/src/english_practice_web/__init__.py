from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .api.v1 import router as api_v1_router
from .store import init_db

init_db()

_DIST_DIR = Path(__file__).resolve().parent / "ui" / "dist"
_INDEX_PATH = _DIST_DIR / "index.html"
_INDEX_HTML = _INDEX_PATH.read_text(encoding="utf-8") if _INDEX_PATH.exists() else ""

app = FastAPI(title="English Practice")

if _DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST_DIR / "assets")), name="assets")

app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/{full_path:path}", response_class=HTMLResponse)
async def spa_fallback(full_path: str) -> str:
    if _INDEX_PATH.exists():
        return _INDEX_HTML
    return "<h1>ui/dist/index.html not found — run <code>npm run build</code> in ui/</h1>"

---
name: backend-api
description: FastAPI backend development for this project's English Practice web app. Use when building, debugging, or refactoring API routes, Pydantic models, SQLite stores, auth, review/mark logic, Ollama integration, or backend configuration under english-practice-web/src/english_practice_web.
---

# Backend API

Use this skill for backend work in `english-practice-web/`. The app is a FastAPI service for an English phrasal-verb practice tool. Keep changes aligned with the existing flat router-to-store architecture.

## Project Map

```text
english-practice-web/
|-- pyproject.toml
|-- phrasal_verbs.json
|-- data/notes.db
`-- src/english_practice_web/
    |-- __init__.py          # FastAPI app, static mounts, API include, SPA fallback
    |-- auth.py              # Local JWT encode/decode and bearer dependency
    |-- config.py            # Env configuration
    |-- data.py              # Phrasal-verb data loading and canonical lookup
    |-- memory.py            # Review scheduling helpers
    |-- models.py            # Pydantic request/response models
    |-- ollama.py            # Shared Ollama calls and model discovery
    |-- server.py            # Uvicorn entrypoint
    |-- store/               # SQLite persistence modules
    `-- api/v1/              # FastAPI routers
```

## Architecture

- Routers live in `api/v1/*.py` and are included from `api/v1/__init__.py`.
- Most routers are protected with `Depends(require_current_user)` at include time. Keep `/auth/login` public.
- Routers may call store modules, `data.py`, `memory.py`, or `ollama.py` directly. Do not introduce a service/repository layer unless the project already moves that way.
- Pydantic request/response models belong in `models.py`.
- SQLite table creation and migrations belong in `store/base.py:init_db()`.

## API Conventions

- Use `/api/v1` resource routes; the prefix is applied in `__init__.py`.
- Return JSON-compatible dicts/lists or Pydantic response models.
- Validate inputs with Pydantic. Use `Field(min_length=1)` for required strings and narrow patterns when the accepted values are fixed.
- Use `HTTPException` for expected client or not-found errors. Let unexpected exceptions surface through FastAPI.
- Keep endpoint responsibilities narrow. Add a new route when behavior becomes distinct.

```python
from fastapi import APIRouter, HTTPException

from ...models import PlanRequest
from ...store import plans

router = APIRouter()


@router.post("/plans")
def save_plan(payload: PlanRequest) -> dict:
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Plan name is required")
    return plans.save_plan(payload.name, payload.words)
```

## Auth

- Auth is local HMAC/JWT logic in `auth.py`; it does not use PyJWT.
- Config comes from `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, and `JWT_EXPIRES_MINUTES`.
- Protected requests expect `Authorization: Bearer <token>`.
- When adding protected routers, include them in `api/v1/__init__.py` with the shared `_protected` dependency list.

## SQLite Stores

The database is `english-practice-web/data/notes.db`. Existing store modules own their tables:

- `store/notes.py`: note CRUD keyed by canonical phrase.
- `store/plans.py`: named word lists; `words` is stored as JSON text.
- `store/recite_marks.py`: mark history and latest known/unknown status.
- `store/base.py`: `connect()`, `init_db()`, migrations, and reset.

When adding persistence:

1. Add a focused module under `store/`.
2. Export public functions from `store/__init__.py`.
3. Add table creation/migration calls in `store/base.py:init_db()`.
4. Use parameterized SQLite calls and explicit commits inside `with connect() as conn`.
5. Use `json.dumps(..., ensure_ascii=False)` for JSON text columns and `json.loads(...)` when reading.

## Ollama

Use `ollama.call_ollama(prompt, timeout=15, model=None)` for AI calls. It handles connection errors and returns a user-facing string. The selected model may come from the `X-LLM-Model` request header:

```python
from fastapi import APIRouter, Request

from ...ollama import call_ollama

router = APIRouter()


@router.post("/check")
def check_sentence(payload: CheckRequest, request: Request) -> dict[str, str]:
    prompt = f"..."
    return {"feedback": call_ollama(prompt, model=request.headers.get("x-llm-model"))}
```

Keep prompts English by default, include the phrase/meaning/user input, and state the desired reply language when needed.

## Review And Marks

- Mark keys are phrase strings unless a phrase has multiple meanings, then use `phrase::meaning_index`.
- Keep mark-key generation consistent with frontend `markKey()` and backend migration logic.
- Review endpoints should use `memory.py` helpers instead of duplicating scheduling rules.

## Config And Run

Environment defaults live in `config.py`:

```text
PORT=8080
JWT_SECRET=practice-tool-local-secret
JWT_EXPIRES_MINUTES=720
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3.2:latest
OLLAMA_MODELS=llama3.2:latest
```

Useful checks from `english-practice-web/`:

```bash
uv run python -m compileall -q src/english_practice_web
uv run python -m english_practice_web.server
```

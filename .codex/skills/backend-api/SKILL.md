---
name: backend-api
description: FastAPI backend development skill for building, debugging, and refactoring REST APIs with strict layered architecture and safe modification rules.
---

# FastAPI Skill

Use this skill for FastAPI API development, debugging, and refactoring.

---

## Architecture (Strict)

Follow this structure:

- router: HTTP layer only (no logic)
- service: business logic only
- repository: database access only
- schemas: Pydantic models only
- core: config / auth / shared utilities

Never mix layers.

---

## API Rules

- RESTful design only
- Use `/api/v1` versioning
- JSON request/response only
- Pydantic required for all inputs/outputs
- One endpoint = one responsibility

---

## Dependency Rules

- Use `Depends()` for:
  - DB session
  - auth user
  - shared services

- Never create DB session inside router
- Always close DB sessions properly

---

## Database Rules

- Use ORM (SQLAlchemy preferred)
- No DB logic in routers
- No raw SQL unless explicitly required
- Use transactions for multi-step writes

---

## Authentication

- JWT-based auth when needed
- Enforce RBAC if roles exist
- Validate permissions in service layer

---

## Error Handling

Standard error response:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "message"
}
---
name: backend-api
description: FastAPI backend development for this project's English Practice web app. Use when building, debugging, or refactoring REST API routes, Pydantic models, SQLite persistence, Ollama LLM integration, or store-layer code. Covers the actual architecture (router → store/LLM, no service layer), SQLite with JSON migration, and Ollama prompt-calling patterns.
---

# Backend API

FastAPI backend for the English Practice web app. Architecture is intentionally flat: routers handle HTTP and call the store layer or Ollama directly. There is no service or repository layer.

## Project structure

```
src/english_practice_web/
├── __init__.py          # FastAPI app, static mounts, route includes
├── config.py            # Env vars: OLLAMA_URL, MODEL_NAME, PORT
├── models.py            # Pydantic request/response models
├── server.py            # uvicorn entrypoint
├── data.py              # Loads phrasal_verbs.json into memory
├── store/               # SQLite persistence layer
│   ├── __init__.py      # Public exports
│   ├── base.py          # connect(), init_db(), JSON migration
│   ├── notes.py         # Notes CRUD
│   └── plans.py         # Plans CRUD
└── api/v1/
    ├── __init__.py      # Aggregates all routers
    ├── phrases.py       # GET /next, GET /list
    ├── check.py         # POST /check, POST /check-recite (Ollama)
    ├── reading.py       # POST /reading (Ollama)
    ├── notes.py         # GET/POST /notes, /notes/{phrase}
    └── plans.py         # CRUD /plans, /plans/{name}
```

## Router conventions

- Each router file uses `APIRouter()` and is included in `api/v1/__init__.py`
- Routers call the store layer or Ollama directly — no intermediate service layer
- Use `from ...models import ...` for Pydantic schemas
- Use `from ...store import ...` for persistence
- Use `from ...config import MODEL_NAME, OLLAMA_URL` for LLM config
- Use `from ...data import phrasal_data` for the in-memory phrase list

```python
from fastapi import APIRouter
from ...models import CheckRequest
from ...config import MODEL_NAME, OLLAMA_URL

router = APIRouter()

@router.post("/check")
def check_sentence(payload: CheckRequest) -> dict[str, str]:
    ...
```

## Pydantic models

All request/response models live in `models.py`. Use `Field(min_length=1)` for required strings. Keep models flat — no nested objects.

```python
class CheckRequest(BaseModel):
    phrase: str = Field(min_length=1)
    sentence: str = Field(min_length=1)
```

## Ollama integration

Call Ollama via `requests.post` with a prompt string. Always handle `requests.RequestException` and return a user-friendly error message.

```python
def _call_ollama(prompt: str) -> str:
    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": MODEL_NAME, "prompt": prompt, "stream": False
        }, timeout=15)
        resp.raise_for_status()
        return resp.json().get("response", "No response from AI.")
    except requests.RequestException as exc:
        return f"Connection error: {exc}. Is Ollama running?"
```

When building prompts, include the phrase, its meaning, and the user's input. Keep prompts in English for the AI but specify reply language at the end when needed (e.g. "Reply in Chinese.").

## Store layer (SQLite)

Database lives at `data/notes.db` (created by `store/base.py`). Two tables: `notes` and `plans`.

- `store/base.py` — `connect()` returns a connection with WAL mode; `init_db()` creates tables and runs JSON migration
- `store/notes.py` — `get(phrase)`, `get_all()`, `save(phrase, content)`, `delete(phrase)`
- `store/plans.py` — `list_plans()`, `get_plan(name)`, `save_plan(name, words)`, `delete_plan(name)`

Plans store `words` as a JSON string column. Always use `json.dumps(..., ensure_ascii=False)` when writing and `json.loads(...)` when reading.

When adding a new table:
1. Create the module under `store/`
2. Export it from `store/__init__.py`
3. Call its init function from `store/base.py:init_db()`

## JSON migration

Legacy notes were stored in `notes.json`. On startup, `_migrate_json()` reads it, inserts into SQLite, and renames the file to `.json.bak`. Follow this pattern for any future migrations.

## API design rules

- RESTful resource design: `/api/v1/{resource}`
- JSON request/response only
- All inputs validated through Pydantic models
- Error responses use `HTTPException` with appropriate status codes
- One endpoint per responsibility — don't overload a single route with multiple concerns

## Error handling

Use `HTTPException` for known failure cases:

```python
raise HTTPException(status_code=400, detail="Unknown phrasal verb: " + phrase)
raise HTTPException(status_code=404, detail="Plan not found")
raise HTTPException(status_code=500, detail="Phrasal data unavailable")
```

Don't wrap every endpoint in try/except — let FastAPI's default error handling catch unexpected exceptions.

## Config

All environment variables in `config.py` with sensible defaults:

```python
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "llama3.2:latest")
PORT = int(os.getenv("PORT", "8080"))
```

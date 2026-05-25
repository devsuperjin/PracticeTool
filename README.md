# PracticeTool

PracticeTool is a local English practice app for IELTS-style phrasal verb study. It combines a FastAPI backend, SQLite persistence, JWT-protected APIs, and a lightweight HTML/CSS/JavaScript UI.

## Features

- Dashboard for review progress and weak-item tracking
- Reading page that generates an article from selected phrasal verbs
- Learning flows for practice, recite, and spaced review
- Word selection and study plans
- Notes linked to canonical phrasal verbs
- SQLite storage for notes, marks, and plans
- JWT login with a default local admin user
- Ollama-backed LLM checks and reading generation
- Light, dark, and system appearance modes

## Project Layout

```text
english-practice-web/
  data/                         # Local SQLite database
  src/english_practice_web/
    api/v1/                     # FastAPI route modules
    store/                      # SQLite persistence helpers
    ui_v2/                      # Current vanilla HTML/CSS/JS UI
    ui/                         # Earlier Vue UI source/build
    auth.py                     # JWT auth helpers
    config.py                   # Runtime configuration
    server.py                   # Uvicorn entrypoint
```

## Quick Start

```bash
cd english-practice-web
uv run python -m english_practice_web.server
```

Open the app:

```text
http://localhost:8080/v2/
```

Default local login:

```text
username: admin
password: admin
```

## Configuration

The server reads configuration from environment variables:

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

For LLM features, run Ollama locally and make sure the selected model is available.

## Data

The local SQLite database lives at:

```text
english-practice-web/data/notes.db
```

Notes are stored in the `notes` table and are keyed by canonical phrasal verb text. Review marks and plans are stored in their own tables.

## API

Most API routes are under `/api/v1` and require a bearer token after login.

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

Common routes:

```text
GET  /api/v1/list
GET  /api/v1/notes
GET  /api/v1/notes/{phrase}
POST /api/v1/notes
GET  /api/v1/review
POST /api/v1/reading
POST /api/v1/check
POST /api/v1/check-recite
```

## Development Checks

```bash
cd english-practice-web
uv run python -m compileall -q src/english_practice_web
node --check src/english_practice_web/ui_v2/app.js
```
